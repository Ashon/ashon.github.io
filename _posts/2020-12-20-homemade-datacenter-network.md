---
layout: post
title: 컨테이너로 데이터센터 네트워크를 모방해 볼 수 있을까?
date: 2020-12-20 17:07:00 +0900
excerpt: |
  데이터센터 2-Tier BGP 네트워크의 간단한 구성을 랩탑 안에서 container로 구성해보며
  알게 된 내용들을 공유한다.
comments: true
category: blog
toc: true
tags:
- DataCenter
- Network
- Linux
- Container
---

요즘 클라우드 네트워크를 더 확장할 수 있는 방법들을 고민해 보고 있다. 잘 짜여진 기성 모듈들을
이용하면 이런 요구들을 잘 만족시킬 수 있을지는 모르겠지만, 적용 시 기존 환경과의 차이로 인해
나타날 수 있는 다양한 사이드 이펙트들이 발생할 수 있다.

BlackBox 영역으로만 두던 곳에서 문제들이 발생할 경우, 정확히 추적하고 해결하기까지는 더 많은
리소스가 필요할 수 있다. 단순히 사용자 수준에서만 그친다면, 이런 문제들이나 요구사항이 발생했을때
문제들을 깊이있게 이해하고, 정확하게 해결해 나가기 힘들 것이라고 생각했다.

그래서, 집에서 직접 데이터센터 네트워크를 모방해 보면서, 네트워크 구성에 필요한 컴포넌트들은
어떤 것들이 있고, 어떻게 관리되는지 이해할 필요가 있다고 배워보기 위해서 컨테이너를 이용해서
**2-Tier** 데이터센터 네트워크 구성을 모방해 본 내용을 공유한다.

> 내가 네트워크 엔지니어는 아니고 이런 부분들을 접할 기회가 없었으므로,
> 공부하면서 구현한 데이터센터 네트워크 형상이 실제 네트워크 장비 내부의 네트워크 리소스
> 형상과는 다른 부분이 있을 수 있다.
>
> 공부를 하면서 작성한 결과물은 <https://github.com/Ashon/homemade-datacenter> 에서
> 관리하고 있으며, 이 환경을 바탕으로 다양한 테스트들을 진행해 볼 예정이다.
>
> **정확하지 않은 내용은 코멘트 주시면 수정해 보도록 하겠습니다. 고맙습니다.**

## 왜 컨테이너를 사용하나요?

데이터센터 네트워크를 구성하는 각 노드들의 구성을 VM으로 만들어서 진행해 보면,
`하드웨어 가상화` + `Network OS`도 해서 더 실제 환경과 비슷한 구성을 할 수 있지만 현재 가진
개발장비로는 필요한 구성을 시뮬레이션 하기에는 리소스가 많이 부족하므로 컨테이너의
network namespace를 이용해서 각 노드들의 네트워크 격리, BGP 설정들을 구성 해 보기로 하였다.

> - Network OS를 탑재한 VM인 `Cumulus VX`가 있다. [[Link]](https://docs.cumulusnetworks.com/cumulus-vx/Overview/)
> - SDN의 Functionality 구현하고자 하는 것이 아니므로, `netns` 만으로도 네트워크 노드들의
>   가상 구성을 충분히 실현할 수 있다고 생각한다.

## 대표적인 네트워크 구성 두가지

다양한 형상들이 존재하겠지만, 대부분의 문서나 자료에서는 데이터센터 네트워크의 형상이
2가지 정도로 정리되는 것 같다. 아래는 네트워크 구성의 간단한 소개이며, 자세한 내용은
**[참고자료](#참고자료)**로 대체한다.

### 3-Tier Architecture

전통적인 DCN(datacenter network) 형상. 세 가지의 네트워크 워크로드를 담당하는
계층으로 나누어져 있다.

- **Core**: Internet으로 연결되는 계층이다.
- **Aggregation**: L2/L3를 연결하는 계층이며, IP Routing까지 책임진다.
- **Access**: L2 switch들의 집합이며 IP까지는 Aggregation까지 패킷이 전달되어야 한다.
- **Pod**: Aggregation 노드들을 하나의 집합으로 다루기 위한 단위. (`k8s`의 pod와는 다른 개념)
  같은 Pod안에서 Aggregation node들은 이중화 구성을 위해 Failover 구성이 되어있다.

이 구성에서는 같은 Pod 구성 안에서는 네트워크 패킷 통신에 대한 비용을 효과적으로 처리할 수 있다.

하지만, 다른 Pod의 노드와 통신하기 위해서는 Aggregation을 넘어서 Core까지 패킷이 전달되어야
하기 때문에, 확장성이 다소 떨어지는 점이 있다.

### 2-Tier Architecture

**3-Tier** 네트워크보다 단순화되어있고, 좀 더 효율적으로 설계될 수 있는 구조.
네트워크 계층이 2단계로 나누어져 있고 메쉬 구성이 되어 있다.

- **Spine**: Leaf 노드간의 연결들을 담당하며, 네트워크 구성의 중추 역할을 한다.
- **Leaf**: 하위 서버들과의 Access Layer이기도 하면서, L2/L3간의 IP 라우팅들을 관장한다.

이 경우에는 데이터센터의 어떤 호스트들이든 같은 네트워크 경로를 거쳐 트래픽이 전달될 수 있으므로
네트워크 경로에 대한 사이드이펙트를 줄일 수 있고, 계층이 단순해 관리가 용이한 장점이 있다고 한다.

## 랩탑 안에서 데이터센터 네트워크 모방해보기

### 네트워크 구성

![bridge-mode-network](/assets/2020-12-20/fig1.png)
<center>< figure 1. Datacenter Network in a Laptop ></center>

위 그림은 랩탑 안에서 컨테이너들을 이용해, 격리된 network 공간을 만들고 각 컨테이너 간 연결이
모두 인터페이스로 정의되어 서로 연결되어있는 모습을 나타낸 그림이다.

컨테이너를 이용해 `Spine-Leaf` 네트워크를 구성하고, 네트워크 노드들은 BGP를 이용해 하위 랙에
들어간 서버들 또는 서버 하위의 가상화 리소스들을 다루기 위한 방법들을 앞으로 공부해 볼 예정이다.

### Docker 네트워크 모드 소개

컨테이너로 네트워크 노드들을 구성하기에 앞서, 컨테이너를 정의하는데 나는 Docker를 이용할
예정이므로 Docker에서 제공하는 네트워크 프로비저닝 방식들을 이해할 필요가 있었다.

Docker에서는 container network 프로비저닝을 위해 `bridge`, `host`, `none` 3가지 모드를
제공하고 있다. 아래는 각 컨테이너 네트워크 모드에 대한 간단한 소개이고, 사용법에 대한 자세한
내용은 이 문서에서는 소개하지 않는다.

- `bridge`: 기본으로 설정된 bridge 인터페이스에 contaier network interface를 구성한다.
- `host`: 호스트 네트워크 네임스페이스를 그대로 이용한다.
- `none`: container 네트워크 구성에 필요한 리소스들을 구성하지 않음.

#### 1. Bridge Mode, 한계점

![bridge-mode-network](/assets/2020-12-20/fig2.png)
<center>< figure 2. 원하는 형상과 bridge mode 차이 ></center>

브릿지 네트워크 모드는 docker에서 제공하는 기본 구성이다. 특별한 설정이 없다면 컨테이너 워크로드는
네트워크 리소스를 브릿지 네트워크 모드로 구성하게 된다.

기본적으로 `docker0` 라는 기본 브릿지가 구성이 되고, 새로 생성되는 컨테이너는 `docker0`
와 컨테이너 네트워크에 `veth` 인터페이스 페어가 생성되어 둘을 연결하는 방식으로 네트워크 구성이
이루어 진다.

이런 구성을 사용하게 되면 `Spine-Leaf` 구성이 실패하게 된다. 각 네트워크 레이어간 트래픽이
격리되어야 할 필요가 있는데, 호스트에 존재하는 bridge 구성으로 인해 어떻게든 다른 컨테이너로
트래픽이 흐를 위험이 있고, 실험 환경을 구성하기에는 한계가 있다.

#### 2. Host Mode, 한계점

![host-mode-network](/assets/2020-12-20/fig3.png)
<center>< figure 3. 원하는 형상과 host mode 차이 ></center>

호스트와 네트워크를 완전히 공유하는 모드인데, 이것은 실험 구성에서는 사용할 수 없다.

#### 3. 기본 제공 네트워크 모드들의 한계

Docker에서 기본적으로 제공해 주는 network 구성 방식들은, 내가 구성하고자 하는 모습과는
많이 달랐다. 실험 환경을 최대한 비슷하게 만들기 위해서 network mode를 `none`으로 생성하여,
컨테이너에 네트워크 인터페이스가 구성되지 않은 상태에서 직접 인터페이스들을 프로비저닝 해 주기로
하였다.

### 해결책: 컨테이너를 `network=none`으로 생성 후, 직접 네트워크 구성하기

직접 구성작업을 하기 위해서는 docker가 container 구성 정보를 저장하는 방식을 알아야 했는데,
여기서는 네트워크 정보만 접근할 수 있으면 되므로 그 부분만 확인해 보기로 한다.

#### 1. 컨테이너 `netns`(네트워크 네임스페이스) 포워딩하기

docker에서는 구동되는 컨테이너에 대한 별도의 netns를 `/var/run/docker/netns/~`
형태의 파일로 관리하고 있다. 이 netns file은 특별한 구현이 존재하는 것이 아니라
linux netns를 그대로 사용하고 있으므로 호스트에서 컨테이너의 네트워크를
보기 위해서는 `/var/run/netns/` 디렉토리로 symlink를 생성하기만 하면 된다.

``` sh
{% raw %}# container의 network namespace 정보를 조회한다.
$ docker inspect {{ container_name }} -f '{{ .NetworkSettings.SandboxKey }}'
/var/run/docker/netns/... # 해당 파일이 network namespace에 해당한다.

# 호스트의 netns로 symlink를 생성한다.
$ link -s /var/run/docker/netns/... /var/run/netns/{{ container_name }}

# net ns를 확인한다.
$ ip netns
...
{% endraw %}
```

#### 2. 컨테이너 간 `veth` 인터페이스를 할당하기

`veth` 타입 인터페이스는 **Virtual Ethernet Devices**의 줄임말인데, 말 그대로 가상
인터페이스 연결 쌍을 만들어 준다. 흔히 우리가 다루는 **Network Cable**이 가상화 되어있다고
보면 좋을 것 같다.

그래서 veth 인터페이스는 항상 쌍으로 생성되고 핸들링 되며, 하나가 지워지면 마찬가지로
다른 인터페이스도 data plane에서 사라지게 된다.

이를 이용해 각 컨테이너의 `netns`로 각 노드간 연결을 구성할 수 있다.

``` sh
{% raw %}# 일반적인 veth 생성 커맨드
$ ip link add veth0 type veth

# ip link 커맨드로 확인해 보면 veth0-veth1 쌍이 생성된 것을 확인할 수 있다.
$ ip link
...
11: veth0@veth1: ...
12: veth1@veth0: ...
...{% endraw %}
```

위 방식을 이용하여 두 컨테이너 `conatiner_a`, `container_b`가 있을 때, 각 컨테이너의
`netns`를 포워딩 한 다음 호스트에서 각 컨테이너에 대한 네트워크 연결을 만들어 준다.

![container-veth-peering](/assets/2020-12-20/fig4.png)
<center>< figure 4. 컨테이너 간 veth로 연결된 모습 ></center>

``` sh
{% raw %}# veth interface를 생성할 때, 특정 네임스페이스에 바로 생성할 수 있다.
#
# => container_a netns에 container_b라는 이름의 인터페이스를 만들고,
#    container_b netns에 container_a라는 peer 인터페이스를 정의한다.
$ ip link add \
    name container_b \
    netns conatiner_a \
  type veth peer \
    name conatiner_a \
    netns container_b

# container_a netns에서 네트워크 정보를 조회해 본다.
# => container_a 내부 네트워크를 조회한다.
$ ip netns exec conatiner_a ip link

# conatiner_a 내부에서 container_b로의 링크를 확인할 수 있음.
1: container_b@..: ...
...{% endraw %}
```

이렇게 호스트와 `netns`간 격리된 네트워크 구성을 이용하여, `L2`까지의 환경을 구성할 수 있었다.

#### 3. 각 Peer node로의 Routing Table 구성

`1`, `2` 과정을 통해 L2 구성까지 완료되었다. 일반적인 네트워크라고 하면 L3인 IP까지 구성이
필요하다. 적어도 각 호스트로의 ping이 성공하기 위해서는 각 노드에 대한 IP가 필요하다.

이를 달성하기 위해서 각 노드 안에 routing table을 구성해 주어, 이웃 노드로의 트래픽이 커널에
구성된 routing table을 따라 흘러갈 수 있도록 설정을 해 주어야 했다.

![routing-table-in-network-node](/assets/2020-12-20/fig5.png)
<center>< figure 5. 네트워크 노드 내 라우팅 테이블 정의 ></center>

``` sh
# 호스트에서 spine-0 컨테이너 netns에 exit-0에 대한 라우팅 엔트리를 추가한다.
# CIDR bit를 32로 명시하여, exact match되는 트래픽만 exit-0로 흘러갈 수 있도록 한다.
$ ip netns exec spine-0 ip route add 10.0.0.11/32 dev exit-0
```

#### 4. 더미 인터페이스를 통한 네트워크 노드 IP 정의

이렇게 구성되면, `ping` 명령어를 이용해서 타겟 노드로 트래픽을 흘려보낼 수 있다. 하지만,
전달된 트래픽을 받아서 커널까지 전달할 수는 없다. 왜냐하면 들어오는 패킷에 해당하는 IP를 가진
인터페이스가 없으므로 그대로 네트워크 패킷을 Drop 해 버리기 때문이다.

이 문제를 해결하기 위해서, 각 네트워크 노드에 자신의 IP를 정의해 놓기 위해 dummy interface를
한개씩 만들어 주고, 자신의 IP를 부여한다. 해당 더미 네트워크는 이후에 `BGP` 서비스를 위한
인터페이스로 활용 할 예정이다.

![lo0-icmp](/assets/2020-12-20/fig6.png)
<center>< figure 6. lo0 더미 인터페이스를 정의를 통한 고유 IP 부여 ></center>

``` sh
# spine-0 노드에 lo0 라는 더미 인터페이스를 만든다.
$ ip netns exec spine-0 ip link add lo0 type dummy

# 생성한 더미 인터페이스를 활성화한다.
$ ip netns exec spine-0 ip link set dev lo0 up

# 더미 인터페이스에 자신의 IP를 부여한다.
$ ip netns exec spine-0 ip addr add 10.10.0.13/32 dev lo0
```

`1-4` 단계를 통해 전체 네트워크 노드의 IP 구성까지 모두 완료할 수 있다.

#### 왜 이렇게 하나요?

결과부터 말하자면 Network topology 상의 loop를 생성하지 않도록 원천적으로 막기 위함이다.

L3의 IP 패킷의 datagram에는 TTL이라고 해서 노드간 패킷이 전달될 때 처리되지 못하는 패킷들이
계속 네트워크 상에 존재할 수 없도록 하는 일종의 수명을 관장하는 항목이 있다.

TTL은 패킷이 노드간 홉을 뛸 때마다 1씩 줄어들도록 구현되어 있고, 패킷을 받은 호스트에서 TTL이
0 미만이 되면 다음노드로 전달하지 않고 버리도록 되어 있으므로, 어느정도 네트워크를 안정적으로
유지할 수 있는 안전장치가 마련되어 있다.

하지만, ARP에서는 TTL의 개념이 없기 때문에 ARP 요청(IP의 주인이 누구인지?)의 해결될 때 까지
자신이 속한 네트워크로 L2 브로드캐스트 패킷을 보내게 된다.

> ARP는 L3일까 L2일까..

이 브로드캐스트 패킷은 노드들의 L2 interface인 Bridge interface를 타고 다른 네트워크
노드로 전염될 수 있으며, 해결되지 않은 ARP요청이 네트워크 루프를 돌며 계속 쌓이게 되고,
끝내 과부하를 일으켜 전체 네트워크를 마비시킬 수 있는 위험성을 가지고 있다.

이 문제를 `ARP Storm`이라고 부른다고 한다.

> 이런 네트워크 루프가 구성되더라도, STP라는 프로토콜을 이용하여 네트워크 구성에서 발생한
> 경로 루프를 트리 형태로 재구성하여 트래픽 경로를 단방향으로 만들어 주는 메커니즘도 있다.

### 프로비저닝 과정 자동화

전체 네트워크 노드의 Fabric 구성을 위해서 Ansible를 활용하였다. 위 컨테이너 네트워크 노드
구성과 인터페이스 구성은 <https://github.com/Ashon/homemade-datacenter> 에서 확인해
볼 수 있다.

글에서 설명한 각 노드간의 interface들을 프로비저닝하는 작업들을 이용해서 전체 네트워크를
구성하는 작업들로 이루어져 있다. Ansible 코드에 대한 소개는 여기서는 하지 않는다.

## 정리

- 우리가 일반적으로 end-user 단에서만 보던 네트워크 구성 차이를 이해할 수 있었다.
- 데이터센터 네트워크를 직접 시뮬레이션 해 보면서 발생할 수 있는 문제들을 피부로 느낄 수 있었다.
- 흔히 클라우드에서 제공하고 있는 사용자 VPC 구성을 위해서 하고 있는 시도들, 그리고 할 수 있는
  시도들에 대한 철학들을 조금 이해할 수 있게 된 것 같다.
  - 이 부분은 컨테이너 세상에서도 일어나고 있는 일이며, CNI와 그 구현체들이 대표적일 것이다.
- SDN책을 3년전에 사 놓고 안보고 있었는데, 이번 공부 덕분에 다시한번 펼쳐보고 그때는 생소했던
  키워드들이 조금씩 보이기 시작했다.

### 이후 진행해 보고 싶은 작업들

- L3까지 네트워크 노드 구성이 완료되었기 때문에, VPC 구성과 IP 전파를 위해서 BGP를 구성해
  보고 테스트 해 볼 예정이다.
  - 지금 진행한 데이터센터 네트워크 스택과 과거에 O-droid 서버군을 결합해서 테스트 환경을
    확장해 볼 수 있을 것 같다. [[Link]](https://ashon.github.io/blog/2019/12/01/home-odroid-servers.html)
- 위 과정을 만족하는 간단한 CNI 구현체도 만들어 볼 수 있을것 같은데, 이 부분은 아직 뜬구름잡는
  아이디어만 있으므로 정확한 내용은 좀 더 알아볼 필요가 있다.
  - 글에서 소개한 내용들과 앞으로의 방향성과 가장 비슷한 CNI 구현체로는 Calico가 있는데,
    이 부분도 한번 비교해 볼 수 있으면 좋을 것 같다.

## 참고자료

- Cisco의 Spine-Leaf Architecture 소개: <https://www.cisco.com/c/en/us/products/collateral/switches/nexus-7000-series-switches/white-paper-c11-737022.html>
- 2-Tier, 3-Tier 네트워크 소개: <https://www.wwt.com/article/comparing-two-tier-three-tier-data-center-networks>
- DC 네트워크의 종류 소개 유튜브 영상: <https://www.youtube.com/watch?v=6-66D9J5PkY>
- VM을 이용한 DC network BGP 구성 예제: <https://github.com/oreillymedia/bgp_in_the_data_center>
- 컨테이너 네트워크는 어떻게 구성되는가: <https://dev.to/polarbit/how-docker-container-networking-works-mimic-it-using-linux-network-namespaces-9mj>
- 리눅스 네트워크 인터페이스의 종류들, 특성: <https://developers.redhat.com/blog/2018/10/22/introduction-to-linux-interfaces-for-virtual-networking/>
- 루프백 인터페이스와 더미 인터페이스 유즈케이스: <https://blog.vyos.io/loopback-and-the-dummies>
- 네트워크 패킷 흐름도 분석: <https://wiki.mikrotik.com/wiki/Manual:Packet_Flow>

### 더 보기

아래 링크들은 구축을 진행하면서, 리눅스 커널의 네트워킹 스택에 대해
조금 더 공부해 보기 위해 수집한 링크들이다.

- 리눅스 커널에서의 네트워크 흐름 분석 가이드: <https://wiki.linuxfoundation.org/networking/kernel_flow>
- Network interface 관련
  - Netdevice: <https://elixir.bootlin.com/linux/latest/source/include/linux/netdevice.h>
  - Bridge interface: <https://elixir.bootlin.com/linux/latest/source/net/bridge/br_if.c>
  - Dummy interface: <https://elixir.bootlin.com/linux/latest/source/drivers/net/dummy.c>
  - Veth interface: <https://elixir.bootlin.com/linux/latest/source/drivers/net/veth.c>
- Linux Netowrking Stack 관련
  - loopback: <https://elixir.bootlin.com/linux/latest/source/drivers/net/loopback.c>
  - arp: <https://github.com/torvalds/linux/blob/master/net/ipv4/arp.c>
  - ipv4
    - ip_input: <https://elixir.bootlin.com/linux/latest/source/net/ipv4/ip_input.c>
    - ip_output: <https://elixir.bootlin.com/linux/latest/source/net/ipv4/ip_output.c>
- Netns 관련
  - netns: <https://elixir.bootlin.com/linux/latest/source/include/net/net_namespace.h>
  - iproute2 netns command: <https://fossies.org/linux/iproute2/ip/ipnetns.c>
