---
layout: post
title: CNCF CNI 프로젝트 살펴보기
date: 2021-02-05 21:17:02 +0900
excerpt: |
  CNCF에서 관리되고 있고, Kubernetes에서 컨테이너 네트워킹을 달성하기 위해 표준으로
  사용하고 있는 CNI 프로젝트에 대해서 살펴보고 중요하다고 생각한 내용들을 정리한다.
comments: true
category: blog
toc: true
tags:
- Network
- Linux
- Container
- CNI
---

과거에 [컨테이너로 데이터센터 네트워크를 모방해 볼 수 있을까?](/blog/2020/12/20/homemade-datacenter-network.html)
라는 제목으로 컨테이너를 활용한 데이터센터 네트워크를 모방해 보기 위한 글을 올린 적이 있다.

이에 대한 연장선으로서, 그리고 **Open Container Korea** 슬랙에서 Kubernetes에 관심이
많은 분들과 스터디를 진행하면서 **CNI**에 대한 발표를 할 기회가 생겨서 공부를 하면서 정리해
본 내용을 공유한다.

> [CNI](https://github.com/containernetworking/cni) 에서 소개하고 있는 내용들을
> 나름대로 이해하기 쉽게 적당히 의역한 부분들이 있고, 중요하다고 생각했던 부분들만 정리하였습니다.
>
> **정확하지 않은 내용은 코멘트 주시면 수정해 보도록 하겠습니다. 고맙습니다.**

## CNI가 무엇인가요?

**컨테이너 런타임**을 위한 컨테이너 **네트워크 플러그인**의 인터페이스 표준이다. 대표적인 컨테이너
런타임으로는 Kubernetes, Mesos, rkt 등이 있고, 컨테이너 네트워크 플러그인은 Weave NET,
Calico, Cillium, Flannel 등이 있다. `CNI`는 **컨테이너 런타임**과 **네트워크 플러그인**
둘 사이의 인터페이스에 대한 스펙을 정의한 프로젝트이며, `libcni`라는 driver API를 제공한다.

## CNI에서 관리되는 컴포넌트들

CNI 에서 관리하는 컴포넌트들 중에 libcni, Spec, Plugins, Extention Conventions 등을
조사하였다.

- **libcni**: CNI 구현체들을 사용하기 위한 driver API
  - [https://github.com/containernetworking/cni/blob/master/libcni/api.go](https://github.com/containernetworking/cni/blob/master/libcni/api.go)
  - k8s에서는 `libcni`를 이용해서 CNI 구현체들을 사용하고있음.
    > Kubernetes에서 CNI를 활용하는 부분은 [addToNetwork(\*)](https://github.com/kubernetes/kubernetes/blob/cea1d4e20b4a7886d8ff65f34c6d4f95efcb4742/pkg/kubelet/dockershim/network/cni/cni.go#L364),
    > [deleteFromNetwork(\*)](https://github.com/kubernetes/kubernetes/blob/cea1d4e20b4a7886d8ff65f34c6d4f95efcb4742/pkg/kubelet/dockershim/network/cni/cni.go#L383) 부분들을 참고한다.

- **Spec**: 별도 컨테이너 네트워크 플러그인을 구현하기 위한 스펙
- **Extention** **Conventions**: 플러그인 작성시 지켜야할 사항들
  - **Spec**에서 다 보면 안되는것인지 별도 문서가 따로 존재한다.
- **Plugins**: CNI 프로젝트에서 관리하는 레퍼런스 플러그인들

## Example: CNI 레퍼런스 플러그인 `bridge` 사용해 보기

스펙을 설명하기 전에 `CNI` 구현체가 사용되는 방식을 예제를 통해 설명한다. 스펙 문서는 내용이
장황한 부분이 있어서 필요한 경우는 사용 예만 보면 좋을 것 같고, 왜 이렇게 동작하는지 궁금하다면
이어서 스펙 섹션을 참고하도록 한다.

### bridge CNI Plugin

**bridge** plugin은 docker에서 기본으로 지원하는 bridge 모드 네트워크와 유사한 방식으로
컨테이너의 네트워크를 구성해 주는 플러그인이다. 최종적으로 프로비저닝 되는 형태는 docker bridge
네트워크와 같은 형태이지만, 구성 방식이 CNI의 메커니즘을 따라 프로비저닝 된다.

`bridge` CNI의 네트워크 구성 과정은 요약하면 다음과 같다.

1. 호스트 네트워크에 **bridge** 인터페이스를 생성한다.
2. 호스트와, 컨테이너간의 연결을 위해 각 네트워크 네임스페이스에 veth 인터페이스 쌍을 생성한다.
3. 이후 준비된 인터페이스에 IP주소, 인터페이스 옵션 등을 설정한다.

bridge CNI 플러그인 소개 문서는 아래를 참고한다.

- (CNI) bridge: <https://www.cni.dev/plugins/main/bridge/>
- (IPAM) host-local: <https://www.cni.dev/plugins/ipam/host-local/>

#### 컨테이너 생성하기

CNI를 적용하기 위해서는 미리 컨테이너가 생성되어 있어야 한다.
어떤 컨테이너가 하나 있고 아래와 같은 정보를 가지고 있다고 가정한다.

```sh
container ID: b4cc640b25ea
container network sandbox: /var/run/docker/netns/5fe32f1805bd
```

#### bridge.conf 설정파일 준비하기

브릿지 플러그인 구성을 위해서는 컨테이너 네트워크를 정의할 설정 파일이 필요하다.

> 이후에 소개할 내용으로 파일로 구성을 관리하는 방법 대신 플러그인 바이너리에 **STDIN**으로
> 값을 넘겨서 네트워크를 구성하기도 한다.

```sh
# file bridge.conf

{
    "cniVersion": "0.3.1",
    "name": "mynet",
    "type": "bridge",
    "bridge": "mynet0",
    "isDefaultGateway": true,
    "forceAddress": false,
    "ipMasq": true,
    "hairpinMode": true,
    "ipam": {
        "type": "host-local",
        "subnet": "10.10.0.0/16"
    }
}
```

#### bridge CNI를 실행하여 네트워크 구성하기

프로비저닝에 필요한 인자들을 환경변수로 설정하여 플러그인을 실행하면, 프로비저닝이 완료된다.

```sh
# shell
CNI_COMMAND="ADD"
CNI_CONTAINERID="b4cc640b25ea"
CNI_NETNS="/var/run/docker/netns/5fe32f1805bd"
CNI_IFNAME="br0"
CNI_PATH="/vagrant/plugins/bin/bridge"
./bridge < bridge.conf
```

#### 요약

사용 예에서 설명한 것 처럼 CNI 플러그인들은 다음과 같은 같은 특징들이 있다.

- CNI 구현체들은 실행가능한 파일로 존재한다.
- 구현체로 들어가는 실행 옵션들은 환경변수로 관리된다.
- CNI 구현체가 프로비저닝 해야하는 네트워크 형상은 별도의 설정파일이나
  (STDIN, 예제에서는 설명하지 않았지만) 으로 넘겨받는다.
- **docker의 컨테이너 라이프사이클과는 별개로 움직이게 되므로, CNI 라이프사이클을 관리하지
  않는 컨테이너 런타임을 사용할 경우, 컨테이너가 올라온 이후 추가적으로 동작시켜 주어야 한다.**

## Spec (v0.4.0 기준)

- [원문 링크](https://github.com/containernetworking/cni/blob/master/SPEC.md)
- 스펙 문서에서는 **오버뷰**, **CNI 표준화 시 고려사항**, **플러그인 동작 상세** 등을 설명하고 있다.

> 이후 하위 섹션들은 정확한 번역은 아닐 수 있으며, 개인적으로 적당히 이해하기 쉽게 풀어놓은
> 부분들이 있으므로 유의해서 보면 좋을 것 같다.

### Overview

컨테이너에 플러그인 형태의 네트워크 솔루션을 도입해 보고 싶다면 스펙을 읽고 구현해서 목적을 달성하면 된다.

- CNI는 rkt의 컨테이너 네트워킹 설계에서 발전된 형태라고 한다.
- ~~rkt는 지금은 망했다..~~

스펙 문서에서는 `컨테이너`와 `네트워크`, 두가지 개념을 좀 더 강조해서 풀어 설명하고 있다.

- **컨테이너**: 컨테이너는 리눅스 네트워크 네임 스페이스와 동의어로 간주될 수 있다.
- **네트워크**: 서로 통신할 수 있는, 고유하게 주소 지정이 가능한 엔티티들의 그룹.
  - 대충 서버끼리 IP를 할당하고 관리할 수 있는 네트워크 영역이라고 설명하고 있다.
  - **172.17.30.0/24** 이런 형태로 표현할 수 있는 네트워크들을 관리하고, IP와 IP가 할당
    될 컨테이너들 사이에서 일어나는 문제들(여러 네트워크들을 어떻게 관리할 지, IP 주소들을
    어떻게 관리할 지 등)을 해결한다.

### General Considerations

CNI 스펙을 제안하면서 고려했던 내용들을 설명한다.

- **컨테이너 런타임**은 **플러그인이 반영되기 전**에 반드시 **컨테이너만의 새로운 네트워크 네임스페이스**를 가져야 한다.
- 이후에 컨테이너 런타임에서 컨테이너가 속해야 하는 네트워크와, 네트워크를 프로비저닝 하기 위한 플러그인들을 결정해야 한다.
- 네트워크 구성은 `JSON` 포맷을 사용하고 파일로 쉽게 저장될 수 있어야 한다.
  - 네턱 설정은 필수적으로 `name` , `type` 필드들을 가져야 한다.
  - 그밖의 네트워크 프로비저닝에 필요한 정보들을 관리하기 위해서 `args` 필드를 사용한다.
- 컨테이너 런타임은 각 네트워크에 해당하는 플러그인을 순차적으로 실행하여, 네트워크에 컨테이너를 추가해야 한다.
- 컨테이너가 제거될 때, 런타임은 네트워크에서 컨테이너 연결을 끊기 위해 플러그인을 역순으로 실행해야 한다.
- 컨테이너 런타임에서는 동일한 컨테이너에 병렬 작업을 허용하지 않는다. 다른 컨테이너에 대해서는 가능하다.
- 컨테이너 런타임은 `ADD`, `DEL` 명령을 통해 네트워크 플러그인으로 작업을 전달한다.
  - `ADD`가 있으면 `DEL` 도 있다. `DEL` 명령이 멱등성을 보장할 수 있도록 구현해야 한다.
- 컨테이너는 컨테이너 ID로 고유하게 식별되어야 한다. 플러그인에서 상태를 저장할때는 컨테이너
  ID를 PK로 사용해서 리소스들을 다룰수 있게 만들어야 한다.
- 하나의 컨테이너에 대해 `ADD` 가 두번 불리는 일(`DEL` 없이)은 없도록 하자.
  - `ADD -> DEL` 선후 관계가 항상 잘 지켜질 수 있도록 하자.
- CNI 구조의 필드들은 **optional** 마크가 없는 이상 필수사항이다.

### CNI Plugin

각각의 CNI 플러그인들은 컨테이너 관리 시스템에 의해 실행가능한 파일로 구현되어야 한다.

CNI 플러그인은 컨테이너 네트워크 네임스페이스에 대해 네트워크 인터페이스를 삽입하고 호스트에서 필요한 변경을 수행한다.

1. veth 인터페이스를 만들고 컨테이너 네임스페이스 안으로 주입
2. 이후 다른 포트를 호스트에서 제어해서 필요한 네트워크 연결 구성을 진행한다.
    - 포트에 대한 IP를 할당하는 행위 등

다음 명령어들이 지원되어야 한다. (`ADD`, `DEL`, `CHECK`, `VERSION`)

- `ADD` : 컨테이너에 네트워크를 추가한다.
  - **Params**
    - Container ID
    - netns path
    - network configuration
    - extra arguments
    - name of iface inside the container
  - **Result**
    - Interfaces list
    - IP configuration assigned to each interface
    - DNS information
- `DEL` : 컨테이너에서 네트워크를 제거한다.
  - **Params**: `ADD` 때 사용된 값과 동일
  - 모든 패러미터들은 `ADD` 오퍼레이션때 사용된 값과 동일해야 한다.
  - 제거 작업은 컨테이너 구성에 사용된 모든 네트워크 리소스를 해제해야한다.
  - 제거 이전에 `ADD` 작업이 있는 경우 `prevResult` 필드를 추가해야 한다.
  바로 이전 `ADD` 작업의 결과가 들어간다. (꼭)
  - 컨테이너 런타임은 결과 캐싱에 대해 `libcni` 의 지원을 사용할 수 있음.
  - `CNI_NETNS` 또는 `prevResult` 값이 넘어오지 경우, 플러그인은 가능한 많은 리소스를 제거하고 결과를 반환하도록 해야한다.
  - 컨테이너 런타임이 컨테이너에 대한 `ADD` 결과를 캐싱하고 있는 경우,
  `DEL` 에서는 캐시된 결과를 제거해야 한다.

    `DEL` 명령은 일부 누락된 리소스가 있더라도 잘 완수되어야 한다.
    구구절절한 이유가있는데, 이건 스펙 문서를 참고한다.

- `CHECK` : 컨테이너 네트워크가 기대한 대로 잘 있는지 확인한다.
  - **Params**: `ADD` 때 사용된 값과 동일
  - **Result**: 플러그인이 에러 없이 잘 끝나야함.
  - 플러그인은 기대한 결과를 위해 `prevResult` 를 참조해야 한다.
- `VERSION` : CNI의 버전을 리포팅한다.
  - **Params**: 없음
  - **Result**: CNI 스펙의 버전과 지원되는 버전 정보

컨테이너 런타임은 네트워크 타입을 호출할 실행파일 이름으로 사용해야 한다. 런타임은 사전 정의된 디렉토리 목록에서 이 실행파일을 찾아야 한다.

런타임이 플러그인 파일을 찾게되면 다음 환경변수를 사용해서 파일을 실행한다.

- `CNI_COMMAND`: 위에서 소개한 오퍼레이션 목록 (`ADD`, `DEL`, `CHECK`, `VERSION`)
- `CNI_CONTAIERID`: 컨테이너 ID
- `CNI_NETNS`: netns 경로
- `CNI_IFNAME`: 셋업 할 네트워크 인터페이스 이름. 플러그인에서 주어진 인터페이스 이름을 사용할 수 없다면 반드시 에러를 일으켜야한다.
- `CNI_ARGS`: 호출시 전달하는 별도 인자들, `FOO=BAR;ABC=123` 형태
- `CNI_PATH`: CNI 플러그인의 실행가능한 경로들. OS-specific seperator를 사용한다.
  - Linux에서는 `:` 윈도는 `;` (`PATH` 환경변수를 생각하면 될듯)

네트워크 플러그인으로 넘어가는 설정은 `stdin` 을 통한다. (꼭 파일을 통해 전달되지 않아도됨을 의미함)

### * 중간 정리

그럼 여기까지 알아본 내용을 다시 정리하고 넘어가면, 앞서 설명한 실행 예제의 과정들이 왜 이렇게
진행되어야 했는지 알 수 있을 것이라 생각한다.

이후 아래 섹션부터는 CNI 스펙의 세부적인 디테일들을 설명하고 있다.

### Result

CNI 플러그인이 동작하고 난 결과는 이런 형태의 응답을 출력한다.

문서에서는 결과 예시를 보여주며 각 스트럭쳐의 디테일을 설명하고 있음.

```js
{
  // CNI의 버전
  "cniVersion": "1.0.0",

  // 네트워크 인터페이스의 정보,
  // 이후에 'IP Allocation' 섹션에서 IPAM 플러그인의 소개를 하게 되는데,
  // IPAM 플러그인의 결과도 현재의 json 객체와 동일한 형태에서
  // 'interfaces' 정보는 빠진다고 한다.
  "interfaces": [
      {
          "name": "<name>",
          "mac": "<MAC address>",
          "sandbox": "<netns path or hypervisor identifier>"
      }
  ],

  // IP 설정들의 리스트
  "ips": [
      {
          // IP Address
          "address": "192.168.0.12/24",

          // Gateway 주소
          "gateway": "192.168.0.1",

          // 위 interfaces list에서 매치되는 인덱스
          "interface": 0
      },
      ...
  ],
  "routes": [
      {
          // routing path의 CIDR
          "dst": "10.0.20.0/24",

          // 해당 네트워크의 라우팅을 담당하는 게이트웨이 IP주소
          "gw": "10.0.20.1"
      },
      ...
  ],

  "dns": {
    "nameservers": ["8.8.8.8", "8.8.4.4"]

    // dns short name을 위한, local domain 리스트
    "domain": ["local", "home"]

    // dns short name을 위한, 별도 dns 룩업을 위한 레이블 리스트
    "search": ["mysite"]

    // dns resolver로 들어갈 별도 옵션들
    // resolved를 사용한다면
    // https://man7.org/linux/man-pages/man5/resolv.conf.5.html 문서에 있는
    // 옵션들이 들어가게 되는 것 같다.
    "options": ["debug", "rotate", "timeout:30"]
  }
}
```

실행 중 Error가 발생하면 아래와 같은 포맷으로 리턴되어야 한다.

```js
{
  "cniVersion": "1.0.0",
  "code": <numeric-error-code>,
  "msg": <short-error-message>,
  "details": <long-error-message> (optional)
}
```

### Network Configuration

네트워크 설정 예

```js
{
  "cniVersion": "1.0.0",
  "name": "dbnet",
  "type": "bridge",

  // 플러그인에 필요한 인자들
  // 내가 만든 플러그인이 아래와 같은 형식의 데이터를 필요로 한다고 보면 좋을 것 같다.
  // 아래는 CNI 레퍼런스 플러그인 중 'bridge' CNI plugin에 필요한 설정값이다.
  "bridge": "cni0",
  "dns": {
    "nameservers": [ "10.1.0.1" ]
  }
  // 기타등등 인자들 ..

  // 이후 소개할 'IPAM 플러그인'의 타입이다.
  "ipam": {

    // host-local이라는 IPAM 플러그인을 사용한다.
    // 앞서 소개한 CNI 플러그인의 형태를 따른다.
    // (실행가능한 파일이고, 환경변수를 통한 설정 등...)
    "type": "host-local", /

    // ipam specific
    "subnet": "10.1.0.0/16",
    "gateway": "10.1.0.1"
  },

  // 여기는 별도 패러미터
  // CNI 스펙에서 정의한 별도 유저 데이터의 경우
  "args": {
    "labels": {
      "appVersion": "1.0"
    }
  }
}
```

### Network Configuration Lists

이 섹션에서는 하나의 컨테이너에 여러 CNI 플러그인이 적용될 때에 대한 메커니즘을 소개하고 있다.

- `cniVersion` CNI 스펙 버전
- `name` 네트워크 이름(unique 해야함)
- `disableCheck`: `true/false`  값이 들어감.
  - `true`: 컨테이너 런타임에서 네트워크에 대한 `CHECK` 오퍼레이션을 수행하지 않는다.
- `plugins`: CNI설정 오브젝트들의 리스트

아래는 Network Configuration List로 프로비저닝 되는 설정 예

```js
{
  "cniVersion": "1.0.0",
  "name": "dbnet",

  // 이런 식으로 여러 타입의 CNI플러그인들을 통해
  // 컨테이너로 다양한 네트워크를 설정할 수 있다.
  // plugins 배열에 정의된 순서대로 네트워크 설정이 반영된다.
  "plugins": [
    {
      "type": "bridge",
      ...
    },
    {
      "type": "tuning",
      ...
    }
  ]
}
```

### IP Allocation

- 동작의 일부로 CNI 플러그인은 IP주소를 할당하고 인터페이스와 관련된 경로들을 설치해야 한다.
- CNI(CNI 자체)의 유연성은 높아지지만 부담도 커진다.
- CNI 플러그인이 이 모든것들을 다 관리해 주도록 코드를 작성해야 한다고 한다.
- 이런 부담을 줄이기 위해 별도 **IPAM 플러그인**이 필요하다고 한다.
- **CNI 플러그인**이 적절한 시점에 **IPAM 플러그인**을 호출하도록 만들어야 한다.
- IPAM 플러그인은 IP/서브넷, GW, 라우트 인터페이스들을 설정하고 적용하기 위해 정보를 main 플러그인으로 전달해야 한다.
- IPAM 플러그인은 로컬 파일 시스템에 저장된 네트워크 구성 파일의 "ipam" 섹션의 정보를 통해 얻을 수 있다.

### * 이후 섹션들 (Well-known Structures, Error Codes, ...)

- 이 부분에서는 Network Configuration에서 소개한 각 입출력 스키마들을 예시를 통해서 설명하고 있다.
- 원문을 보는것이 크게 부담이 되지 않는 상황이라 정리는 생략한다.

## 정리

## 함께 보면 좋은 내용들

- [https://kubernetes.io/ko/docs/concepts/cluster-administration/networking/](https://kubernetes.io/ko/docs/concepts/cluster-administration/networking/)
- [https://www.cncf.io/wp-content/uploads/2020/08/Introduction-to-CNI-2.pdf](https://www.cncf.io/wp-content/uploads/2020/08/Introduction-to-CNI-2.pdf)
