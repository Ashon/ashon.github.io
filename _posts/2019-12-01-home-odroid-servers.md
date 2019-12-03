---
layout: post
title: Odroid H2로 홈서버 클러스터 구축한 이야기
date: 2019-12-01 22:42:17 +0900
comments: true
toc: true
tags:
- devops
- server
- network
---

예전부터 항상 개인 공부를 위한 서버 클러스터를 가지고 싶었다.

**서비스 애플리케이션**을 만들다 보면, 나의 앱이 올라가는 **서버는 어떻게 생겼고**,
**네트워크는 어떻게 구성**이 되고, 애플리케이션까지는 **어떻게 트래픽이 전달**이 되고
이런 과정을 항상 글로만, 어깨너머로만 보아오고 실제로 직접 구성해 본 경험이 없으니
항상 손에 잡히지 않는 미지의 영역이었다.

최근에 팀에 합류하신 **[Ssup2](https://ssup2.github.io)** 님의 도움으로 글을 참고하여,
저렴하고 작은 규모의 서버 클러스터를 만들면서 네트워크 세팅작업을 진행하며 알아본 내용을 소개한다.

**[ODROID-H2 Cluster 구축](https://ssup2.github.io/record/ODROID-H2_Cluster_%EA%B5%AC%EC%B6%95/)**
글을 참고하여 나도 `ODROID-H2` 장비를 이용해서 서버 클러스터를 만들어 보기로 하였다.
혹시나 `H2` 말고 다른 대안이 있나 싶어 <https://hardkernel.com> 사이트를 찾아본 결과 `x86_64` 아키텍쳐는
`ODROID-H2`밖에 없어서 결국 이걸 이용해서 클러스터를 구성 해 보기로 하였다.

![home-servers](/assets/2019-12-01/fig1.jpg)
<center>< figure 1. ODROID-H2 홈서버 클러스터, 선따느라 힘들었다.. ></center>

## Hardwares

### ipTIME (External Network)

집에서 사용중인 공유기인데, 큰 문제없어서 계속 사용중이다. 인터넷 게이트웨이로 사용한다.

### Netgear GS108E (Internal Network)

`ODROID-H2`의 내부 네트워크를 위한 스위치가 하나 더 필요하서 구매하게 되었다.
포트는 8구이며, 4포트씩 나누어 `VLAN` ID를 할당해서 서버 클러스터의 네트워크를 나누어
관리하게 된다.

### Odroid H2

`ODROID-H2` 서버의 스펙은 아래와 같다. 구매하면 CPU와 보드는 있지만,
`RAM`과 `Storage`는 별도로 구매해서 장착 해 주어야 한다.

- CPU: Intel Celeron J4105
- RAM: DDR4 8GB PC4-19200
- Storage: PM981 SSD NVMe 256GB
- Networking: 2xGbE LAN ports (RJ45, supports 10/100/1000 Mbps, Realtek RTL8111G)

OS는 `ubuntu-server` `19.04` 버전을 사용하기로 하였다.

## Network Architecture

아래는 서버 클러스터의 네트워크 구성이다. `ipTIME`은 인터넷 연결을 담당하고,
`Netgear` 스위치는 서버 클러스터의 내부 네트워크를 담당하게 된다.

![home-servers-network](/assets/2019-12-01/fig2.png)
<center>< figure 2. 홈서버 클러스터 네트워크 구성 ></center>

### 스위치에서 `VLAN`으로 네트워크 나누기

![netgear vlan](/assets/2019-12-01/fig3.png)
<center>< figure 3. Netgear VLAN 설정 화면 ></center>

사실 서브넷으로 분리되면 VLAN을 굳이 나눌 필요가 있나 싶지만, 인터페이스의 서브넷이
다르더라도, 인터널 네트워크의 인터페이스를 타고 외부로 트래픽이 전달될 수 있기 때문에
VLAN 으로 망을 나누어서 관리해야 한다.

### `netplan` 으로 서버 네트워크 설정

`Ubuntu 18.04` 부터 들어간 우분투 서버의 네트워크를 `YAML`로 정의해서 관리할 수 있게
도와주는 네트워크 매니저이다.

하위 버전에서는 `NetworkManager`로 서버의 네트워크 인터페이스를 관리했던것 같은데, `YAML`로
변경된 부분이 관리 측면에서는 용이하지만, 기존 작업 경험과는 다소 생소해서 삽질을 좀 했다.

Ubuntu server의 `cloud-init`에서 `netplan`을 이용해 서버가 부팅되면서
서버의 네트워크 인터페이스들을 셋업하게 된다.

``` yaml
# file: homeuser@home-server-1:/etc/netplan/50-cloud-init.yaml
network:
  version: 2
  ethernets:
    # 해당 인터페이스의 IP는 ipTime의 DHCP를 통해 얻어온다.
    enp2s0:
      dhcp4: true
    # 내부 네트워크의 IP는 netplan에 정의된 VLAN IP를 이용한다.
    enp3s0:
      dhcp4: false

  vlans:
    enp3s0.2:
      id: 2
      link: enp3s0
      addresses:
      - 10.0.0.101/24
```

파일이 준비되면 `netplan apply` 명령을 통해서, 설정을 바로 서버에 반영해서
인터페이스를 구성할 수 있다.

``` sh
homeuser@home-server-1 $ sudo netplan apply
```

생성된 인터페이스를 확인한다.

``` sh
homeuser@home-server-1 $ ip a
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host
       valid_lft forever preferred_lft forever
2: enp2s0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000
    link/ether 00:1e:06:0a:0b:0c brd ff:ff:ff:ff:ff:ff
    inet 192.168.10.101/24 brd 192.168.10.255 scope global dynamic enp2s0
       valid_lft 4910sec preferred_lft 4910sec
    inet6 fe80::21e:6ff:fe45:c8f/64 scope link
       valid_lft forever preferred_lft forever
3: enp3s0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000
    link/ether 00:1e:06:1a:1b:1c brd ff:ff:ff:ff:ff:ff
    inet6 fe80::21e:6ff:fe45:c90/64 scope link
       valid_lft forever preferred_lft forever
4: enp3s0.2@enp3s0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/ether 00:1e:06:1a:1b:1c brd ff:ff:ff:ff:ff:ff
    inet 10.0.0.101/24 brd 10.0.0.255 scope global enp3s0.2
       valid_lft forever preferred_lft forever
    inet6 fe80::21e:6ff:fe45:c90/64 scope link
       valid_lft forever preferred_lft forever
```

`enp3s0` 디바이스에 연결된 `enp3s0.2` 인터페이스를 확인할 수 있다. `enp3s0.2@enp3s0`

### Admin node (Laptop) 에서 연결 테스트

`home-server-1`에 설정된 인터페이스로 트래픽이 잘 전달되는지 Admin node (laptop)에서 확인해 본다.
확인하기 전에 Admin node에도 VLAN ip를 할당해서 내부 네트워크에 참여한다.

``` sh
IFACE="xxxx"

VLAN_ID="2"
VLAN_ADDR="10.0.0.210/24"
VLAN_NAME="vlan.$VLAN_ID"

sudo ip link add link $IFACE name $VLAN_NAME type vlan id $VLAN_ID
sudo ip link set dev $VLAN_NAME up
sudo ip a add $VLAN_ADDR dev $VLAN_NAME
```

다시 `home-server-1`에서 트래픽을 받아보기 위해 tcpdump 를 올린다.

``` sh
homeuser@home-server-1 $ sudo tcpdump -ni enp3s0.2 ip or vlan
```

Admin node에서 ping을 날려 트래픽이 잘 전달되는지 확인한다.

``` sh
# Admin node
$ ping 10.0.0.101 -c 1
PING 10.0.0.101 (10.0.0.101) 56(84) bytes of data.
64 bytes from 10.0.0.101: icmp_seq=1 ttl=64 time=0.537 ms

--- 10.0.0.101 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 0.537/0.537/0.537/0.000 ms
```

``` sh
# home-server-1에서 캡쳐된 트래픽
13:32:59.735815 xx:xx:xx:xx:xx:xx > 00:1e:06:1a:1b:1c, ethertype IPv4 (0x0800), length 98: (tos 0x0, ttl 64, id 51830, offset 0, flags [DF], proto ICMP (1), length 84)
    10.0.0.210 > 10.0.0.101: ICMP echo request, id 30870, seq 1, length 64
13:32:59.735913 00:1e:06:1a:1b:1c > xx:xx:xx:xx:xx:xx, ethertype IPv4 (0x0800), length 98: (tos 0x0, ttl 64, id 56401, offset 0, flags [none], proto ICMP (1), length 84)
    10.0.0.101 > 10.0.0.210: ICMP echo reply, id 30870, seq 1, length 64
```

### `iperf3`로 네트워크 라인스피드 테스트

네트웍 연결이 된 김에 라인스피드도 한번 측정 해 보기로 하였다.

`iperf3`를 설치한다.

``` sh
homeuser@home-server-1 $ sudo apt install iperf3
```

`home-server-1`에서 `iperf3`를 서버 모드로 동작시킨다.

``` sh
homeuser@home-server-1 $ iperf3 -s
```

`home-server-2`에서 `home-server-1`로 성능 테스트를 측정한다.

``` sh
homeuser@home-server-2 $ iperf3 -c 10.0.0.101
Connecting to host 10.0.0.101, port 5201
[  5] local 10.0.0.102 port 39460 connected to 10.0.0.101 port 5201
[ ID] Interval           Transfer     Bitrate         Retr  Cwnd
[  5]   0.00-1.00   sec   113 MBytes   949 Mbits/sec    0    240 KBytes
[  5]   1.00-2.00   sec   112 MBytes   938 Mbits/sec    0    240 KBytes
[  5]   2.00-3.00   sec   112 MBytes   938 Mbits/sec    0    240 KBytes
[  5]   3.00-4.00   sec   112 MBytes   938 Mbits/sec    0    240 KBytes
[  5]   4.00-5.00   sec   112 MBytes   938 Mbits/sec    0    240 KBytes
[  5]   5.00-6.00   sec   112 MBytes   938 Mbits/sec    0    240 KBytes
[  5]   6.00-7.00   sec   112 MBytes   942 Mbits/sec    0    240 KBytes
[  5]   7.00-8.00   sec   112 MBytes   938 Mbits/sec    0    240 KBytes
[  5]   8.00-9.00   sec   112 MBytes   938 Mbits/sec    0    240 KBytes
[  5]   9.00-10.00  sec   112 MBytes   938 Mbits/sec    0    240 KBytes
- - - - - - - - - - - - - - - - - - - - - - - - -
[ ID] Interval           Transfer     Bitrate         Retr
[  5]   0.00-10.00  sec  1.09 GBytes   940 Mbits/sec    0             sender
[  5]   0.00-10.04  sec  1.09 GBytes   936 Mbits/sec                  receiver

iperf Done.
```

`home-server-1`에서의 로그

``` sh
-----------------------------------------------------------
Server listening on 5201
-----------------------------------------------------------
Accepted connection from 10.0.0.102, port 39458
[  5] local 10.0.0.101 port 5201 connected to 10.0.0.102 port 39460
[ ID] Interval           Transfer     Bitrate
[  5]   0.00-1.00   sec   108 MBytes   906 Mbits/sec
[  5]   1.00-2.00   sec   112 MBytes   939 Mbits/sec
[  5]   2.00-3.00   sec   112 MBytes   939 Mbits/sec
[  5]   3.00-4.00   sec   112 MBytes   939 Mbits/sec
[  5]   4.00-5.00   sec   112 MBytes   939 Mbits/sec
[  5]   5.00-6.00   sec   112 MBytes   939 Mbits/sec
[  5]   6.00-7.00   sec   112 MBytes   939 Mbits/sec
[  5]   7.00-8.00   sec   112 MBytes   939 Mbits/sec
[  5]   8.00-9.00   sec   112 MBytes   939 Mbits/sec
[  5]   9.00-10.00  sec   112 MBytes   939 Mbits/sec
[  5]  10.00-10.04  sec  3.89 MBytes   937 Mbits/sec
- - - - - - - - - - - - - - - - - - - - - - - - -
[ ID] Interval           Transfer     Bitrate
[  5]   0.00-10.04  sec  1.09 GBytes   936 Mbits/sec                  receiver
```

`ODROID-H2`의 NIC 스펙에 근접하는 성능을 볼 수 있다. 찾아보면 이 부분도 튜닝 할 수 있는
부분이 많을 것 같지만, 이정도 까지만 알아보기로 했다.

### WoL(Wake on LAN) 기능으로 Admin node에서 쉽게 켜고 끌 수 있도록 만들기

서버를 켜고 끄는데 매번 스위치를 사용하기엔 비효율적이므로 Ansible의 `wakeonlan`
모듈을 이용해서 Admin node에서 서버들을 쉽게 켜고 끌 수 있도록 플레이북을 작성하였다.

``` yaml
# inventory.yml
# 해당 인벤토리는 kubernetes cluster를 구성하기 위한 kubespray 설정도 포함되어 있다.
all:
  hosts:
    home-server-1:
      ansible_host: &home1_ip 10.0.0.101
      ansible_user: homeuser
      mac_addr: 00:1e:06:1a:1b:1c

      ip: *home1_ip
      access_ip: *home1_ip
      etcd_member_name: etcd1

    home-server-2:
      ansible_host: &home2_ip 10.0.0.102
      ansible_user: homeuser
      mac_addr: 00:1e:06:2a:2b:2c

      ip: *home2_ip
      access_ip: *home2_ip
      etcd_member_name: etcd2

    home-server-3:
      ansible_host: &home3_ip 10.0.0.103
      ansible_user: homeuser
      mac_addr: 00:1e:06:3a:3b:3c

      ip: *home3_ip
      access_ip: *home3_ip
      etcd_member_name: etcd3

# kubespray
kube-master:
  hosts:
    home-server-1:

etcd:
  hosts:
    home-server-[1:3]:

kube-node:
  hosts:
    home-server-[1:3]:

k8s-cluster:
  children:
    kube-master:
    kube-node:
```

``` yaml
# file: wakeup.yml
- hosts: all
  gather_facts: no
  tasks:
  - name: Check Server is stopped
    wait_for:
      host: "{% raw %}{{ ansible_host }}{% endraw %}"
      port: 22
      state: stopped
      timeout: 1
    ignore_errors: yes
    delegate_to: localhost
    register: shutdown

  - name: Start Servers
    wakeonlan:
      mac: "{% raw %}{{ mac_addr }}{% endraw %}"
      broadcast: 10.0.0.0
    delegate_to: localhost
    when: not shutdown.changed

  - name: Wait for SSH port opening
    wait_for:
      host: "{% raw %}{{ ansible_host }}{% endraw %}"
      port: 22
      state: started
    delegate_to: localhost
```

사용 후 전원을 끄는 플레이북도 만들어 주었다.

``` yaml
# file: poweroff.yml
- hosts: all
  gather_facts: no
  tasks:
  - name: Check SSH port is opened
    wait_for:
      host: "{% raw %}{{ ansible_host }}{% endraw %}"
      port: 22
      state: started
      timeout: 1
    ignore_errors: yes
    delegate_to: localhost
    register: sshport

  - block:
    - name: Shutdown server
      shell: sleep 1 && shutdown -P now "Power off"
      async: 1
      poll: 0
      become: yes
      ignore_errors: yes

    - name: Wait for SSH port closing.
      wait_for:
        host: "{% raw %}{{ ansible_host }}{% endraw %}"
        port: 22
        state: stopped
      delegate_to: localhost
    when: not sshport.failed and not sshport.changed
```

## Conclusion

`ODROID-H2`는 `x86_64` 아키텍쳐의 소형 컴퓨터이고 작은 규모의 클러스터를 꾸리고
테스트 해 보는데 적당한 사용성을 제공해 주는 것 같다.

실제 업계에서 사용되는 네트워크 구성을 최대한 따라 만들어 보면서 신경써야 할 부분들은
어떤 것들이 있고, 클라이언트로부터 서버까지 `end-to-end`로의 네트워크 통신은 어떻게
이루어 지는지 좀 더 자세히 알 수 있었다.

앞으로는 구성된 클러스터를 이용하여, 좀 더 재미난 기능들을 공부할 수 있을 것 같다.

## References

- [ODROID-H2 Cluster 구축](https://ssup2.github.io/record/ODROID-H2_Cluster_%EA%B5%AC%EC%B6%95/)
- [netplan - reference](https://netplan.io/reference)
- [cloud-init with netplan](https://cloudinit.readthedocs.io/en/latest/topics/network-config-format-v2.html)
- [VLAN](https://en.wikipedia.org/wiki/Virtual_LAN)
- [Iperf](http://linux-command.org/ko/iperf.html)
- [Wake-on-Lan](https://en.wikipedia.org/wiki/Wake-on-LAN)
- [Ansible - wakeonlan](https://docs.ansible.com/ansible/latest/modules/wakeonlan_module.html)
