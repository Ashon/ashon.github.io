---
layout: post
title: 'RabbitMQ shovel 플러그인을 이용한 메시지 미러링'
date: 2018-10-14
excerpt: |
  RabbitMQ shovel plugin을 활용해서 Queue로 들어오는 메시지들을 다른 Queue로 미러링을
  구성해 실 서비스에서 흘러가는 메시지들을 트레이싱하는 방법을 알아본다.
comments: true
toc: true
tags:
- RabbitMQ
- Celery
- Python
---

RabbitMQ shovel plugin을 활용해서 Queue로 들어오는 메시지들을 다른 Queue로 미러링을 구성해
실 서비스에서 흘러가는 메시지들을 트레이싱하는 방법을 알아본다.

파이썬의 분산 태스크 프레임워크인 `Celery`를 이용하여 간단한 `Message Broker` - `Worker`
구성을 만들어 보고, 그 사이에 일어나는 메시지들을 트레이싱 해 보는 예제를 작성해 보고, 사용성을
검증해 본다.

> 해당 포스트에서는 RabbitMQ를 HA나 Federation을 구성하는 방법은 다루지 않는다.
>
> HA 클러스터를 구성하는 것 과는 별개로 MQ의 컨센서스는 맞추지 않고, Shovel 플러그인을
> 이용하여 필요한 메시지를 미러링 할 수 있는 방안을 고민해 본 내용을 중점적으로 다룬다.

## 미러링은 왜 하나요?

메시지 미러링은 다양한 용도로 사용될 수 있다. 실제 서비스에서 흘러가는 메시지들의 흐름을 방해하지
않고 디버깅 한다거나, 모니터링을 위해 수집해 본다거나 하는 등의 운영성, 관측성을 좀 더 높이기
위해 사용될 수 있고, 동작하고 있는 비즈니스 워크플로우 구성을 최대한 변경하지 않으면서
다른 컨텍스트의 이슈를 처리하기 위해서도 용이하게 사용할 수 있다.

## Case. 기본적인 브로커-워커 구성

대개 `Python` 생태계에서 비동기 작업들을 처리할 때는 `Celery`를 이용하게 되는데,
`RabbitMQ`를 이용하게 될 경우, 간단하게는 아래와 같은 형상을 가지게 된다.

``` text

           +--- amqp:// --------------------------+
           |                                      |
message ----> exchange -- <routing-key> --> queue --> consumer
           |  <topic>                             |   <worker>
           |                                      |
           +--------------------------------------+

```

`RabbitMQ`로 메시지가 보내지면 내부적으로 `Exchange`를 거쳐, `Queue`로 메시지가 전달되고
`Queue`에 연결된 `Celery Worker`가 메시지를 받아서 작업을 수행하게 된다.

### 우리도 너네 메시지를 받아보고 싶다

기본적인 비즈니스 워크플로우가 워커 브로커 형태가 되었을 때, 다른 팀이나 다른 서비스에서
해당 메시지를 볼 경우가 생길 수 있다. (bounded-context)

### Fanout Exchange를 이용하기

``` text

           +--- amqp:// --------------------------+
           |                                      |
message ----> exchange ---------------+---> queue --> consumer
           |  <fanout>    ignore       \          |
           |              routing-key   +-> queue --> others
           |                                      |
           +--------------------------------------+

```

이 경우 RabbitMQ에서는 메시지를 받을 `Exchange`를 `fanout`모드로 만들고, 다른 서비스에서도
메시지를 받을 수 있게 컨슈머로 들어올 수 있다.

``` text

           +--- amqp:// --------------------------+
           |                                      |
message ----> exchange ---------------+---> queue --> consumer
           |  <fanout>    ignore       \          |
           |              routing-key   +-> queue --> others
           |                            +-> queue --> others
           |                            +-> ...   --> ...
           |                                      |
           +--------------------------------------+

            >> 외부 컨슈머로 인해 MQ 노드의 부하를
               예측할 수 없는 상황이 발생한다.

```

하지만 Exchange에 많은 컨슈머들이 붙게 될 경우, RabbitMQ 노드에 부하가 많이 걸릴 수 있고,
이 경우 `HA` 구성이 필요하게 된다.

## Shovel Plugin을 이용해 외부 컨슈머들을 위한 미러 MQ 구성

RabbitMQ의 `Shovel` 플러그인은 특정 토픽으로 들어오는 메시지를 다른 MQ로 옮겨담을 수 있는
기능을 제공하는데 이를 이용하여 유입되는 메시지의 스펙을 지킬 수 있고, 외부 MQ에서 shovel을
통해 원하는 메시지를 트레이싱 해 올 수 있게 된다.

- `AMQP`의 스펙 상 `Exchange`가 `Fanout` 타입이 되어버리면, 기존에 `routing-key`를 가지고 들어오는 메시지들의 라우팅을 보장해 줄 수 없게 된다.
- `Topic Exchange`는 그대로 두면서, 기존 Consumer로 보내고 Shovel에게도 전달하기 위한
  `Fanout Exchange`를 중간에 만들고 내부에 Shovel이 `Topic -> Fanout` 으로 전달하는 형태를 구성해서 사용한다.
- 기존 MQ의 메시지 TPS는 조금 느려질 수 있지만, 예측하기 힘든 외부 컨슈머들로부터의 부작용은 최소화 할 수 있다.

``` text

           +--- amqp://original -------------------+
           |                                       |
message ----> exchange --> X             +-> queue --> worker
           |  <topic>                    |         |
           |    |                        |         |
           |    +-> shovel --> exchange -+         |
           |                   <fanout>  |         |
           |                             +-> queue --+
           |                                       | |
           +---------------------------------------+ |
                                                     |
            >> Minimize side-effects                 |
               from external consumers               |
                                                     |
        +--------------------------------------------+
        |
        |  +--- amqp://mirror ------------------+
        |  |                                    |
        +---> shovel --> exchange -+----> queue --> another
           |             <fanout>   \           |   worker
           |                         \          |
           |                          +-> queue --> another
           |                                    |   API
           +------------------------------------+

            >> Manage external consumer
               with mirror MQ

(한글로 인해 ascii 도형이 깨지는 경우를 방지한다.. ;)

```

위 도식은 기존 서비스의 MQ에 Shovel과 중간에 Fanout Exchange를 구성하고, 외부 소비자를 위한 미러 MQ를 별도로 둔 상황을 표현한 것이다.

기존 MQ 노드(또는 클러스터)의 가용성을 최대한 보장함과 동시에, 외부 MQ의 메시지 부하는 따로 분리해서 문제를 해결할 수 있게 된다.

## Demo Service

<https://github.com/Ashon/_study-rabbitmq_shovel> 에 PoC 프로젝트 코드들을 작성해 보았다.

테스트에 사용된 서비스 구성은 `docker-compose.yml`에 정리되어 있다.
아래는 테스트에 사용된 서비스들의 간단한 구성도.

``` text

                 +- generator -----+
                 |                 |
+-- send --------| ./flow_tasks.py |
|   messages     |                 |
|                +-----------------+
|
|  +- rabbitmq --------------------+
|  |                               |
+->| :5672 - mq port               |----+- consume -----+
   |                               |    |  messages     |
   | :15672 - management port      |    |               V
   |                               |    |        +-- worker --+
   +-------------------------------+    |        | +-- worker --+
                                        |        | |            |
                                     trace       | | worker.py  |
                                     messages    +-|            |
                                        |          +------------+
   +- external mq -----------------+    |
   |                               |<---+
   | :5672 - mq port               |             +-- monitor ---+
   | :15672 - management port      |             |              |
   | :15674 - websocket (webstomp) |<------------| :8080 - web  |
   |                               |             |              |
   +-------------------------------+             +--------------+

```

`flow_tasks.py` 는 RabbitMQ로 Celery Task를 계속 트리거링 하는 스크립트이고,
`worker.py`는 Celery Worker 코드인데, MQ로 들어오는 태스크 요청들을 받아 작업을 수행한다.

`external MQ` 에서는 기존에 사용 중인 MQ의 메시지를 미러링하여, 흘러가는 메시지들을 이용해
다른 서비스에 이용하거나, 모니터링 할 수 있도록 구성한다.

`monitor`는 Web browser에서 `STOMP` 프로토콜을 이용해, 미러링되는 MQ의 메시지들을 웹
브라우저로 스트리밍해서 모니터링 할 수 있게 만들어 보았다.

구성된 RabbitMQ에 필요한 플러그인들을 활성화 한다.

- rabbitmq_shovel
- rabbitmq_shovel_management

> 예제에서는 `rabbitmq_web_stomp` 플러그인도 추가하였는데, 실시간으로 오가는 메시지를 웹 소켓을 이용해 캡쳐해 보기 위해 추가하였다.

## Conclusion

메시지 브로커로 RabbitMQ를 사용하는 실 환경에서 레거시 환경을 최대한 수정하지 않고,
새로운 서비스를 추가하여 부가적인 로직들을 수행할 수 있도록 하는 방법을 알아보았다.

실제로 Shovel을 설정 하였을 때 퍼포먼스 저하가 일어나긴 할 텐데, 얼마나 발생할 지는 잘 모르겠지만, 그 부분에 대해서는 MQ 클러스터의 `scale-up`(또는 `-out`)으로 충분히 소화 가능하다고 생각함.

Shovel을 이용하면 scale-out 문제를 내부 문제와 외부 문제로 분리해서 생각해 볼 수 있는
여지도 제공해 준다고 생각한다.

### with Openstack

Openstack의 경우, 각 컴포넌트간 메시지 브로커로 rabbitMQ를 사용하고 있고,
흘러가는 메시지들을 모니터링하고 디버깅하기 위한 `stacktach`라는 프로젝트가 있지만,
`stacktach`에서 사용되는 워커는 `Celery`만큼 견고하지 못하고, 실제로는 유실되는 메시지도 발생했었다.

`shovel`로 federation을 구성해서 openstack과 비즈니스의 bounded-context를
잘 해결할 수 있을 것 같다는 생각이 들었음.

아무튼 비단 Openstack뿐만 아니라 RabbitMQ를 사용하는 환경이라면, 충분히 비슷한 상황에 대한
해결책이 될 수 있지 않을까 한다.

## References

- Stackoverflow RabbitMQ Federation - <https://stackoverflow.com/questions/19357272/when-to-use-rabbitmq-shovels-and-when-federation-plugin>
- RabbitMQ Federated Queues - <http://www.rabbitmq.com/federated-queues.html>
- RabbitMQ REST API Doc - <https://pulse.mozilla.org/api/>
- RabbitMQ Dynamic Shovel - <https://www.rabbitmq.com/shovel-dynamic.html>
- RabbitMQ WebStomp - <https://www.rabbitmq.com/web-stomp.html>
- Stomp over Websocket - <http://jmesnil.net/stomp-websocket/doc/>
- Openstack Stacktach - <https://github.com/openstack/stacktach>
