---
layout: post
title: '[WIP] RabbitMQ shovel 플러그인을 이용한 메시지 미러링'
date: 2018-10-14
excerpt: |
  RabbitMQ shovel plugin을 활용해서 Queue로 들어오는 메시지들을 다른 Queue로 미러링을
  구성해 실 서비스에서 흘러가는 메시지들을 트레이싱하는 방법을 알아본다.
comments: true
toc: true
tags:
- RabbitMQ
- WebSTOMP
- Celery
- Python
---

RabbitMQ shovel plugin을 활용해서 Queue로 들어오는 메시지들을 다른 Queue로 미러링을 구성해
실 서비스에서 흘러가는 메시지들을 트레이싱하는 방법을 알아본다.

파이썬의 분산 태스크 프레임워크인 `Celery`를 이용하여 간단한 `Message Broker` - `Worker`
구성을 만들어 보고, 그 사이에 일어나는 메시지들을 트레이싱 해 보는 예제를 작성해 보고, 사용성을
검증해 본다.

## 미러링은 왜 하나요?

메시지 미러링은 다양한 용도로 사용될 수 있다. 실제 서비스에서 흘러가는 메시지들의 흐름을 방해하지
않고 디버깅 한다거나, 모니터링을 위해 수집해 본다거나 하는 등의 운영성, 관측성을 좀 더 높이기
위해 사용될 수 있고, 동작하고 있는 비즈니스 워크플로우 구성을 최대한 변경하지 않으면서
다른 컨텍스트의 이슈를 처리하기 위해서도 용이하게 사용할 수 있다.

> 해당 포스트의 내용은 HA 구성을 위한 Mirror Replication 과는 다른 내용이다.
>
> 이 미러링 구성은 RabbitMQ의 고 가용성을 위한 클러스터 구성과는 다르게,
> shovel plugin을 이용하여 외부의 RabbitMQ로 메시지를 미러링 하는 방법을 알아본다.

## 기본적인 브로커-워커 구성

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

## 우리도 너네 메시지를 받아보고 싶다

기본적인 비즈니스 워크플로우가 워커 브로커 형태가 되었을 때, 다른 팀이나 다른 서비스에서
해당 메시지를 볼 경우가 생길 수 있다. (bounded-context)

이 경우 RabbitMQ에서는 메시지를 받을 `Exchange`를 `fanout`모드로 만들고, 다른 서비스에서도
메시지를 받을 수 있게 컨슈머로 들어올 수 있다.

``` text

           +--- amqp:// --------------------------+
           |                                      |
message ----> exchange ---------------+---> queue --> consumer
           |  <fanout>    ignore       \          |
           |              routing-key   +-> queue --> others
           |                                      |
           +--------------------------------------+

```

fanout exchange에 많은 컨슈머들이 붙게 될 경우, RabbitMQ 노드에 부하가 많이 걸릴 수 있고,
이 경우 `HA` 구성이 필요하게 된다.

## RabbitMQ HA

## RabbitMQ Federation

## 테스트 애플리케이션 구성

테스트에 사용된 서비스 구성은 `docker-compose.yml`에 잘 정리되어 있다.
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

`external MQ` 에서는 기존에 사용 중인 MQ의 메시지를 미러링하여, 흘러가는 메시지들을 이용해 다른 서비스에 이용하거나, 모니터링 할 수 있도록 구성한다.

`monitor`는 Web browser에서 `STOMP` 프로토콜을 이용해, 미러링되는 MQ의 메시지들을 웹 브라우저로 스트리밍해서 모니터링 할 수 있게 만들어 보았다.

### RabbitMQ

celery worker의 메시지 브로커.

#### Enabled plugins

- rabbitmq_web_stomp
- rabbitmq_shovel
- rabbitmq_shovel_management

#### After

shovel 플러그인 설정을 통해 워커의 큐로 흘러가는 메시지를 fanout exchange로 우회시키고
fanout exchange에서, 다양한 큐들을 붙여서 메시지를 따로 처리할 수 있도록 구성한다.

기존 레거시 시스템에서 브로커로 던지는 메시지 형식을 변경할 필요가 없다.

``` text

           +--- amqp:// ---------------------------+
           |                                       |
message ----> exchange --> X             +-> queue --> consumer
           |  <topic>                    |         |   <worker>
           |    |                        |         |
           |    +-> shovel --> exchange -+         |
           |                   <fanout>  |         |
           |                             +-> queue --> consumer
           |                                       |   <mon>
           +---------------------------------------+

```

- 해당 구성도는 기존 사용되던 AMQP 호스트의 exchange에 직접 모니터링이나 외부 API를 위한 큐를 붙여서 사용한다.
- 컨슈머들이 많아질 경우, fanout exchange의 특성으로 성능에 많은 영향을 줄 수 있다.

#### Federation using Shovel

- shovel은 여러 rabbitMQ 인스턴스들을 묶어서 federation 구성을 가능하게 해 준다.
- 기존 RabbitMQ 인스턴스의 성능을 가능한 유지하면서, 다른 MQ 인스턴스를 통해 메시지를 소화할 수 있다.

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

```

### Celery worker

브로커로부터 메시지를 받아 작업을 수행.

#### Tasks

- `tasks.hello`: 'hello' 메시지를 리턴한다.

### Mon

브로커로 들어오는 메시지를 웹소켓을 이용해서 실시간으로 트레이싱한다.
webstomp를 이용해서 메시지를 실시간으로 브라우저 화면에 보이게 한다.

## Demo

docker-compose를 이용해서 간단한 서비스 스택을 만들고,
rabbitmq에 트레이싱을 위한 설정을 ansible을 이용해서 관리함.

### setup services

``` sh
$ docker-compose build
$ docker-compose up -d
```

### setup shovels

실제 서비스가 동작하고 있는 환경을 모방하기 위해서,
트레이싱 설정도 메시지가 흘러가고 있다는 가정하에 설정했다.

``` sh
$ cd ansible
$ ansible-playbook setup.yml
```

### throttling workers, generators

docker-compose의 scale 명령어를 통해 워커나, 태스크 제너레이터를 쓰로틀링해 본다.

``` sh
# generator는 마구잡이로 태스크를 생성하고, 결과를 컨슘한다.
# worker는 메시지를 받아 처리한다.
$ docker-compose scale worker=3 generator=5
```

### open localhost:8080 with browser

브라우저로 접근해서 webstomp 메시지가 잘 들어오는지 확인한다.

### teardown services

``` sh
$ docker-compose down -v
```

## Conclusion

메시지 브로커로 RabbitMQ를 사용하는 실 환경에서 레거시 환경을 최대한 수정하지 않고,
새로운 서비스를 추가하여 부가적인 로직들을 수행할 수 있도록 하는 방법을 알아보았음.

실제로 Shovel을 설정 하였을 때 퍼포먼스 저하가 일어나긴 할 텐데, 얼마나 발생할 지는 잘 모르겠음.
하지만 그 부분에 대해서는 MQ 클러스터의 스케일업으로 충분히 소화 가능하다고 생각함.

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