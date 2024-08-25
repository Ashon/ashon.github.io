---
layout: post
title: 나도 eBPF 프로그램을 만들어 볼 수 있을까?
date: 2024-08-25 10:53:02 +0900
excerpt: |
  리눅스 커널 내부 TCP 통신을 위한 시스템콜을 추적하는 간단한 eBPF 프로그램을 직접 작성해 보면서,
  eBPF 개발 생태계와 주변에 어떤것들이 있는지 공부해 본 내용을 공유한다.
comments: true
category: blog
toc: true
tags:
- Network
- Linux
- eBPF
---

최근에 팀 내에서 꽤 도전적인 네트워크 관측가능성 목표들을 설정하고, 업무들을 진행해 보고 있다.
여러 워크로드로부터 발생하는 네트워크 트래픽을 좀 더 투명하게 살펴보기 위한 방법을 마련하는 것인데,

'오픈소스 도구를 쓸 까.. 직접 만들어 볼 수는 없을까..' 고민하던 중에 관심이 많았던 eBPF를 활용해서,
우리가 직접 만든 코드로 네트워크 트래픽을 측정하면 어떨까 하는 마음에 이리저리 혼자서 리서치 해 본 내용을 공유한다.

대부분의 클라우드 프로바이더들이 제공하는 네트워크 관측가능성 상품들은 (예. AWS VPC Flowlog) 프로바이더 계층에서 측정된 데이터를 제공해 주므로 훌륭한 도구이긴 하지만, 굉장히 비싸서 실제 환경에 도입하기에는 다소 어려운 점이 있다.

그리고.. 인터넷을 통해 네트워크 관측 가능성을 위한 오픈소스 도구들을 찾아보면 여러가지가 나오긴 하지만, 원하는 수준의 도구는 아직 찾지 못했다.

원하는 바에 가장 근접한 오픈소스 도구로는 옆 팀원분이 소개해 준 **[coroot](https://coroot.com/)** 라는 도구가 있는데 목표를 달성하는 방식도 내가 지향하는 방향과 가깝다고 생각했다.

이 기술적 방향에 좀 더 확신이 생겨서 열심히 공부해 보면서, eBPF 생태계에 대해서 조금 더 알게 된 내용들을 공유한다.
스터디 결과 내용은 개인 저장소로 올려두었음. <https://github.com/Ashon/_study-ebpf-and-bcc>

> 해당 글에서는 eBPF 기술 자체에 대한 소개는 많지 않습니다.
>
> eBPF 기술에 대한 약간의 배경지식을 가지고, 뭔가 도구를 직접 만들어 보고 싶은 분이나,
> eBPF의 활용 사례들은 어떤게 있을 지 감을 잡는 분들에게 조금 더 도움이 될 것 같습니다.
>
> 제가 리눅스 커널에 대한 지식이 많지 않은 상태에서 필요한 내용들을 찾아가면서 공부한 내용이다 보니, 글 내용에서는 이론적 깊이가 다소 얕을 수 있습니다.
>
> eBPF 관련 도구를 도입 할 예정이거나, 공부하려는 분들이, 이 글을 통해서 eBPF 기술을 활용하는데 조금 더 탄력이 붙을 수 있으면 좋겠습니다.
>
> 다양한 의견과 오류에 대한 수정은 댓글로 알려주시면 저도 더 공부 해 보도록 하겠습니다. 감사합니다.

## "eBPF" 가 뭔가요? 에 대한 개인적인 생각..

eBPF에 대한 자세한 내용은 아래 링크를 참조.

- [What is eBPF? An Introduction and Deep Dive into the eBPF Technology](https://ebpf.io/what-is-ebpf/)
- [BPF Documentation — The Linux Kernel  documentation](https://www.kernel.org/doc/html/v5.17/bpf/index.html#)

리눅스 커널 내부에 사용자 프로그램을 배치해서, 커널 내부의 상태들을 사용자가 원하는 대로 파악할 수 있게 해 주는 강력한 관측 가능성 기술이다.

매우 강력한 만큼 eBPF를 사용하기 위한 진입 장벽도 생각보다 높은 편이긴 해서, 일반적으로는 eBPF를 활용한 오픈소스 구현체를 레버리지해서 사용하는 경우가 많은 것 같고, 내가 생각해 볼 때 시작이 어려운 이유를 좀 생각해 봤다.

- **"eBPF"** 는 커널 내부를 관측하는 기술 자체를 의미하는 용어 (BPF 기술로부터 발전)
- **"eBPF를 사용한다"** 라는 말은...
  - eBPF 기술을 활용해서,
  - 내가 직접 **"커널 내부의 관측가능성을 달성하는 프로그램을 구현"**해 낸다는 말이라고 생각함.
    > ~~엄밀히 말하면 관측가능성 문제만 푸는건 아님~~

- 그러므로, 커널 내부의 어떤 부분을 관측해야 할 지 사용자(개발자)가 알아야 함.
  - '커널이 어떻게 동작하는지를 알아야 관측할 대상을 지정할 수 있다.'
    - 다른말로... '커널의 어떤 부분을 관측할 수 있는지 내가 알아야 한다.'
      > ~~... 쉽지않아.~~

현대의 리눅스 커널~~(옛날에도 그랬지만)~~은 정말 넓고 다양한 기술들을 담고 있으므로 커널을 공부해야지 하는 생각을 하면 시작부터 머리가 아득한데.. 목표치를 낮춰서 접근 할 필요가 있음.

- 어차피 한사람이 모든걸 다 알수는 없음..
- 리눅스 커널 안의 특정 부분 (네트워킹, 그 중에서도 TCP.. 예를 들자면) 을 좀 공부해 보고...
- 이 부분의 특정 지점을 공부해서 eBPF 프로그램을 만들어 본다거나..
  > ~~(이것도 난이도가 있긴 해...)~~

그래도 이런 식의 접근이라면.. (물론 TCP 자체를 아는것은 요즘 시대에서는 꽤 난이도가 있는 일이지만),
한번 비벼볼 만 하다고 생각함. ~~(그리고 우리에겐 ChatGPT가 있다.)~~

뿐만아니라, eBPF 기술 안에도 굉장히 넓은 세계가 있다.

> XDP, 커널의 네트워킹 성능을 우회하여 초고속으로 데이터를 주고받을 수 있도록 하는 기술.. 이라거나..

여기서는 eBPF를 이용해 [kprobe(kernel probe)](https://docs.kernel.org/trace/kprobes.html) 를 등록해서, 커널 내부의 네트워크 가시성을 확보하기 위한 내용을 진행했다.

## eBPF를 활용해 만들어 볼 네트워크 관측 도구

보편적인 http 웹서버 애플리케이션들은 리눅스 커널 TCP 스택의 tcp_sendmsg, tcp_recvmsg 시스템콜을 이용해 네트워크 통신을 수행한다. (~~QUIC은 UDP니까 제외합니다.~~)

> 엄격하게 따져보면 웹서버들은 더 다양한 tcp 시스템콜 사용할텐데, 소개하는 자리니까 간단히 tcp_sendmsg, tcp_recvmsg만 살펴보자.

나는 저 tcp_sendmsg, tcp_recvmsg 함수에 kprobe를 붙여서, 여러 웹서버들이 주고받는 데이터로부터 SRC IP, DST IP, payload size 등을 측정하는 애플리케이션을 만들어 보았다.

![](/assets/2024-08-25/fig1.png)

작성하는 애플리케이션의 기능은 아주 단순하다.

- SRC IP, DST IP 정보가 있으면, 어떤 네트워크 구간을 이동하는지 알 수 있다.

하지만 단순한 기능을 활용해서 다른 모니터링 시스템과 강력한 시너지를 낼 수 있게 만들 수 있을 것이다.

- 이 정보를 활용하면, 특정 워크로드가 어떤 네트워크 경로로 통신을 하는지 확인할 수 있음.
- 비용 최적화, 경로 최적화를 하는데 사용할 수 있음.
- 장애 발생 시 네트워크 구간을 투명하게 확인해서 트러블슈팅 할 수 있게 됨.
- 이 정보를 별도 데이터베이스로 수집하고, IP 프로파일링 도구를 활용하면 더더욱 강력한 모니터링이 가능해 진다.
  - IP profiling: k8s pod들을 확인한다거나, VM 인스턴스들의 정체, 외부 IP를 파악하는 용도

### 배경지식

#### kprobe, kretprobe - kernel probes

kprobe는 kernel probe의 줄임말로 여러 커널 함수들의 진입점에 어떤 값이 들어가는지 확인할 수 있도록 하는 관측 기술이다. ([링크 - Kernel Probes @ kernel.org](https://docs.kernel.org/trace/kprobes.html))

- 함수 진입점을 살펴볼 때는 kprobe를 사용할 수 있고,
- 함수 응답값을 살펴볼 때는 kretprobe를 사용하면 된다. (kernel return probe)

![](/assets/2024-08-25/fig2.png)

대략... 이렇게 생겼다.

kprobe, kretprobe는 커널 함수 앞뒤에 사용자가 작성한 함수를 후킹하는 방식으로 관측가능성을 제공하는데.. 사용자는 아래 준비물들을 가지고 커널 내부를 관찰할 수 있다.

- 관찰하고자 하는 커널 함수 -> **어떤 함수를 디버깅 할 지 알아야 함.**
- 관찰값을 어떻게 처리할 것인지 핸들링하는 함수 -> **후킹된 값을 어떻게 볼 지 작성해야 함.**

#### Kernel Tracepoints - 내가 확인해 볼 수 있는 커널 함수들 목록은 어디에 있지?

리눅스 커널은 문제가 발생했을 때 내부 상태를 들여다보거나, 복구하기 위한 별도의 기능을 파일시스템 형태로 제공한다.

대부분은 서버 내부에 **/sys/kernel/debug** 라는 디렉토리 하위에 debugFS가 마운트 되어 있을텐데, 여기서 내가 계측하고자 하는 커널 함수들을 확인할 수 있다.

``` sh
# 만약 서버에 debugFS가 마운트 되어 있지 않다면, 직접 마운트 해 주면 된다.
$ sudo mount -t debugfs none /sys/kernel/debug
```

debugFS를 보면 다양한 파일들이 보이는데 일단 eBPF에서 추적 가능한 함수 목록을 찾기 위해서는 **/sys/kernel/debug/tracing/** 디렉토리 내의 파일들을 찾아보면 된다.

``` sh
# 트레이싱 할 수 있는 함수 목록들이 적힌 파일들
$ find /sys/kernel/debug -name avail*

/sys/kernel/debug/tracing/available_filter_functions_addrs
/sys/kernel/debug/tracing/available_filter_functions  # 추적 가능한 함수 목록
/sys/kernel/debug/tracing/available_tracers
/sys/kernel/debug/tracing/available_events
/sys/kernel/debug/tracing/rv/available_reactors
/sys/kernel/debug/tracing/rv/available_monitors
...
```

아래와 같이 추적가능한 함수 목록에서 필요한 함수들을 찾을 수 있다.

``` sh
# 추적 가능한 함수 목록에서 tcp 관련 함수들 찾기
$ cat /sys/kernel/debug/tracing/available_filter_functions | grep tcp_

...
tcp_sendmsg
...
tcp_recvmsg
...
```

`위에서 조회되는 함수들을 진입점으로 삼아서 커널 내부에서 수행하는 기능을 확인해 보고, 어떻게 계측할 지 결정하면 된다.`

#### BCC(BPF Compiler Collection) - eBPF 프로그램 툴킷

[https://github.com/iovisor/bcc](https://github.com/iovisor/bcc)

[IOvisor](https://www.iovisor.org/) 프로젝트에서 관리되는 BPF 프로그램 툴킷인데, 이를 이용하면 사용자(개발자)는 보다 편리하게 ebpf 프로그램을 작성하고 관리할 수 있게 된다.

하는일을 크게 살펴봤을때,

- eBPF 프로그램 코드(백엔드) 를 작성하면
- 다양한 언어로 eBPF 프로그램(백엔드)에 대한 프론트엔드 인터페이스를 만들수 있게 해 줌.
  - eBPF 기술 + 기능을 확장.

이런게 가능해 진다.

- 커널 함수의 어떤 기능을 추적하는 eBPF 코드를 작성하고,
- 내가 잘 아는 파이썬과 FastAPI를 이용해서,
- **eBPF 프로그램이 측정한 값을 HTTP로 노출할 수 있음.**

> 브렌단 그렉이 과거에 eBPF를 소개하면서 커널계의 브라우저 Javascript Engine 같은 것이라고 소개한 적이 있다. ([링크](https://www.brendangregg.com/blog/2024-03-10/ebpf-documentary.html))
>
> 나는 처음에 저런 비유를 드는것에 도무지 이해가 가지 않았는데, 이번에 BCC로 직접 프로그램을 작성해 보면서, 그제서야 저 비유의 의미를 조금 알게 된 것 같다..

## 예제 프로젝트 소개 - tcp_monitor

아래는 eBPF 스터디를 진행해 보면서 작성해 본 프로젝트.

[https://github.com/Ashon/_study-ebpf-and-bcc](https://github.com/Ashon/_study-ebpf-and-bcc)

- lima로 vm 정의, 초기 프로비저닝 코드
  - VM 정의 템플릿: ([링크](https://github.com/Ashon/_study-ebpf-and-bcc/blob/main/ebpf-dev.tpl.yaml))
  - VM 실행 스크립트: ([링크](https://github.com/Ashon/_study-ebpf-and-bcc/blob/main/launch.sh))
- eBPF 프로그램 코드 디렉토리 ([링크](https://github.com/Ashon/_study-ebpf-and-bcc/tree/main/workspace))
    - docker compose를 활용해서 빌드하고 실행할 수 있음.
    - k8s 워커노드에 데몬셋으로 띄워서 테스트 해 보고싶긴 한데.. 일단은 좀 더 디밸롭 해 보기
- 개발환경 구축 가이드는 ([링크](https://github.com/Ashon/_study-ebpf-and-bcc/tree/main?tab=readme-ov-file#22-define--start-development-vm-instance)) 참고

### 준비물: Lima - 리눅스 가상화 도구

맥 위에서 eBPF개발을 해 보려면 리눅스 가상머신이 필요하다.

Lima는 MacOS 안에서 Linux VM을 구동할 수 있게 해 주는 가상화 API인데, 지금까지 파악해 본 내용으로는 가장 사용성이 좋고, 기술적으로도 많이 오픈되어 있는 것 같아서 요걸 선택했음.

![](/assets/2024-08-25/fig3.png)

리눅스 머신 위에서 개발할 때 VSCode Remote Development를 활용하면 좀 더 편리하게 접근할 수 있음.
이제 Lima를 가지고 Linux VM을 올려서, VM 위에서 eBPF 프로그램을 만들어 볼 수 있다.

- [Github lima-vm/lima](https://github.com/lima-vm/lima)
- [Github lima-vm/socket_vmnet](https://github.com/lima-vm/socket_vmnet)

### tcp_monitor 프로그램 자세히 살펴보기

이번에 작성한 프로그램을 좀 더 자세히 들여다 보면...

![](/assets/2024-08-25/fig4.png)

eBPF 프로그램 ([Code](https://github.com/Ashon/_study-ebpf-and-bcc/blob/main/tcp_monitor/tcp_monitor.c))

- tcp_sendmsg 함수로 들어오는 소켓 구조체 정보에서 필요한 데이터를 계측하는 함수 작성
- tcp_recvmsg 함수로 들어오는 소켓 구조체 정보에서 필요한 데이터를 계측하는 함수 작성
- 각 함수에서 src, dst, tcp payload 크기를 추출해서 BPF HASH에 저장.

파이썬 프로그램 ([Code](https://github.com/Ashon/_study-ebpf-and-bcc/blob/main/tcp_monitor/tcp_monitor.py))

- eBPF 프로그램을 로드하고, 커널 함수에 어태치 함.
- BPF_HASH에서 주기적으로 정보를 추출해서 python dict로 저장
- FastAPI는 트래픽 정보를 저장하는 python dict를 응답하는 API가 존재함.

컨테이너 정의 ([Code](https://github.com/Ashon/_study-ebpf-and-bcc/blob/main/tcp_monitor/Dockerfile))

- BCC로 작성 된 프로그램을 컨테이너로 빌드할 수 있음.
- 런타임 정의는 docker compose를 활용. ([Code](https://github.com/Ashon/_study-ebpf-and-bcc/blob/main/tcp_monitor/docker-compose.yml))
  - K8s로 배포 정의를 작성할 때 참고하면 됨.

> 코드를 들여다 보면 "MAX_ENTRIES" 나, "ktime_map" 이라는 값들을 볼 수 있는데, 이는 트래픽 계측을
> 좀 더 정확하고 안전하게 하기 위한 부가 장치들이므로 코드 작성 내용에서는 설명을 하지 않는다.

### BPF 프로그램 상태 조회

bpftool을 활용하면 커널에 로드된 BPF 프로그램들과 프로그램이 사용중인 데이터들을 쉽게 확인해 볼 수 있다.

```bash
# linux 툴 설치 (우분투를 예시로.. cent계열은 패키지 따로 찾아보세용~)
$ sudo apt install linux-tools-$(uname -r)

# bpf program list 조회
$ sudo bpftool prog list

...

184: kprobe  name poll_sendmsg  tag 8d470dd2a021dc12  gpl
#                 ^^^^^^^^^^^^ 내가 작성한 함수의 이름
    loaded_at 2024-08-22T20:51:51+0900  uid 0
    xlated 624B  jited 560B  memlock 4096B  map_ids 6,8
#                                           ^^^^^^^^^^^ 해당 함수가 사용하는 BPF MAP ID
    btf_id 81
185: kprobe  name poll_recvmsg  tag 9e1707d2f89dc165  gpl
    loaded_at 2024-08-22T20:51:51+0900  uid 0
    xlated 624B  jited 560B  memlock 4096B  map_ids 6,7
    btf_id 81
```

작성한 ebpf 프로그램들이 잘 올라간 것을 확인할 수 있다.

### BPF 프로그램에서 사용중인 데이터 살펴보기

```bash
# BPF 프로그램이 사용중인 map들 살펴보기
$ sudo bpftool map list

...

7: hash  name recv_bytes  flags 0x0
    key 12B  value 16B  max_entries 300000  memlock 32389744B
    btf_id 81
8: hash  name send_bytes  flags 0x0
    key 12B  value 16B  max_entries 300000  memlock 32389744B
    btf_id 81
```

tcp_monitor가 사용중인 recv_bytes, send_bytes 맵들이 잘 올라간 것을 볼 수 있음.

```bash
# 직접 map id를 덤프해서 어떤 데이터가 매핑되어 있는지도 확인할 수 있다.
# 동작중인 애플리케이션 맵을 자세히 관찰해 볼 수 있음.
$ sudo bpftool map dump id 8
[{
        "key": {
            "src_ip": 252029120,
            "dst_ip": 33925312,
            "src_port": 22,
            "dst_port": 54357
        },
        "value": {
            "bytes": 21120,
            "timestamp": 740363868867
        }
    }
]
```

bpftool 바이너리를 활용해서 프로그램 상태를 투명하게 볼 수 있는데...

이 말은 굳이 BCC를 사용하지 않더라도, eBPF 프로그램 코드를 Native 로 작성하고, 다른 외부 언어들을 활용해서 BPF MAP을 통해서 데이터를 주고받을 수 있게 됨을 의미한다.

## 소감

지금까지,

- ebpf에 대한 간단한 소개
- bcc를 활용해서 ebpf 프로그램을 만드는 방법
- bpf 프로그램들의 상태를 추적해 보는 방법

들을 알아보았는데...

- eBPF는 접근하기 꽤 어려운 기술이긴 하지만.. 요즘에 다양한 학습 도구가 있어서, 꽤 편리하게 접근해 볼 수 있게 되었다.
  > ~~우리에겐 ChatGPT가 있다.~~
- 세상에 다양한 관측가능성 도구들이 있지만...
  - eBPF를 활용해서 우리에게 최적화된 메트릭을 수집할 수 있을 것 같은 가능성을 보았음.
- BCC는 매우 훌륭하게 eBPF 프로그램을 확장할 수 있게 해 주는 것 같다.

이번 내용을 발판삼아 직접 eBPF 작성도 해 보고, 다른 eBPF 프로젝트를 만나면 반가운 마음(?)으로, 코드를 들여다 보면서 또 한 수 배울 수 있도록 하면 좋을 것 같다.

## 함께보면 좋은 내용

- [What is eBPF? An Introduction and Deep Dive into the eBPF Technology](https://ebpf.io/what-is-ebpf/)
- [BPF Documentation — The Linux Kernel  documentation](https://www.kernel.org/doc/html/v5.17/bpf/index.html#)
- [Cloudflare - 초당 천만개의 패킷을 버리는 방법](https://blog.cloudflare.com/ko-kr/how-to-drop-10-million-packets-ko-kr)
  - eBPF의 XDP 기술을 활용해서 커널 네트워킹 스택에 들어오기도 전에 packet을 다 쳐내버리는 이야기
- [Cloudflare - Introducing ebpf_exporter](https://blog.cloudflare.com/introducing-ebpf_exporter)
  - Cloudflare에서 만든 ebpf exporter 를 소개하는 내용
  - [Github - cloudflare/ebpf_exporter](https://github.com/cloudflare/ebpf_exporter)

BCC 관련 내용

- [bcc helpers](https://github.com/iovisor/bcc/blob/master/src/cc/export/helpers.h)
- [bcc protocol structures](https://github.com/iovisor/bcc/blob/master/src/cc/export/proto.h)

XDP 애플리케이션 예제들

- [XDP로 만든 Router](https://github.com/ashhadsheikh/ebpf/blob/master/router.c)
- [XDP L4LB 예제](https://github.com/Netronome/bpf-samples/tree/a7dd7d8c38636dd0a1bb5f2380ce309f314abfe3/l4lb)
  - 널리 알려진 오픈소스로는 [Facebook의 Katran](https://github.com/facebookincubator/katran) 이 있음
- [XDP를 이용해 패킷처리를 특정 CPU Core에만 할당하도록 처리하는 예제](https://github.com/iovisor/bcc/blob/master/examples/networking/xdp/xdp_redirect_cpu.py)

그 외 eBPF를 활용한 오픈소스들

- [L3AF](https://l3af.io/): Linux Foundation에서 관리하는 eBPF Marketplace project.
  > 지금의 Docker 레지스트리같이, eBPF 프로그램들도 마켓플레이스를 통해 다양한 기능들이 제공될 것이라 생각한다.
  > 눈여겨 보는 프로젝트 중 하나.
- [cilium](https://cilium.io/): eBPF XDP 기반 K8s CNI.
- eBPF 기반 관측가능성 도구
  - [coroot](https://github.com/coroot/coroot)
  - [retina](https://github.com/microsoft/retina)
  - [kepler](https://github.com/sustainable-computing-io/kepler)
