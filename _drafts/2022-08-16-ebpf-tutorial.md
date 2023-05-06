---
layout: post
title: bcc로 eBPF 프로그램 만들어 본 이야기
date: 2022-08-16 00:26:02 +0900
excerpt: |
  eBPF 프로그램을 고수준 언어인 파이썬을 활용해서 고도화 할 수 있는 bcc를 이용해서
  프로그램을 작성해 본 내용을 공유한다.
comments: true
category: blog
toc: true
tags:
- Network
- eBPF
---

# BPF Study

bcc 인스톨 가이드: https://github.com/iovisor/bcc/blob/master/INSTALL.md

## Install

키 등록
```
sudo apt-key adv \
  --keyserver keyserver.ubuntu.com \
  --recv-keys 4052245BD4284CDD
```

Apt Sourcelist 추가

```
# file: /etc/apt/sources.list.d/iovisor.list
deb [trusted=yes] http://repo.iovisor.org/apt/bionic bionic main
deb-src [trusted=yes] http://repo.iovisor.org/apt/bionic bionic main
```

패키지 설치

```
setproxy sudo -E apt update
setproxy sudo -E apt install \
  bcc-tools \
  bpfcc-tools \
  libncurses5 \
  libbcc-examples \
  linux-headers-$(uname -r)
```

## BPF Events

```
```

## BPF Monitoring

```
# bpf program list
# https://manpages.ubuntu.com/manpages/focal/man8/bpftool-prog.8.html

$ sudo bpftool prog
29: cgroup_skb  tag 6deef7357e7b4530  gpl
	loaded_at 2022-01-20T12:50:48+0900  uid 0
	xlated 64B  jited 61B  memlock 4096B
30: cgroup_skb  tag 6deef7357e7b4530  gpl
	loaded_at 2022-01-20T12:50:48+0900  uid 0
	xlated 64B  jited 61B  memlock 4096B
31: cgroup_skb  tag 6deef7357e7b4530  gpl
	loaded_at 2022-01-20T12:50:48+0900  uid 0
	xlated 64B  jited 61B  memlock 4096B
32: cgroup_skb  tag 6deef7357e7b4530  gpl
	loaded_at 2022-01-20T12:50:48+0900  uid 0
	xlated 64B  jited 61B  memlock 4096B
33: cgroup_skb  tag 6deef7357e7b4530  gpl
	loaded_at 2022-01-20T12:50:48+0900  uid 0
	xlated 64B  jited 61B  memlock 4096B
34: cgroup_skb  tag 6deef7357e7b4530  gpl
	loaded_at 2022-01-20T12:50:48+0900  uid 0
	xlated 64B  jited 61B  memlock 4096B
41: cgroup_skb  tag 6deef7357e7b4530  gpl
	loaded_at 2022-01-20T13:03:14+0900  uid 0
	xlated 64B  jited 61B  memlock 4096B
42: cgroup_skb  tag 6deef7357e7b4530  gpl
	loaded_at 2022-01-20T13:03:14+0900  uid 0
	xlated 64B  jited 61B  memlock 4096B
```

## BPF Registers

```
R0 – rax return value from function
R1 – rdi 1st argument
R2 – rsi 2nd argument
R3 – rdx 3rd argument
R4 – rcx 4th argument
R5 – r8 5th argument
R6 – rbx callee saved
R7 - r13 callee saved
R8 - r14 callee saved
R9 - r15 callee saved
R10 – rbp frame pointer ( read only )
```

## References

- helpers: <https://github.com/iovisor/bcc/blob/master/src/cc/export/helpers.h>
- bcc protocol structures: <https://github.com/iovisor/bcc/blob/master/src/cc/export/proto.h>

### XDP app examples

- <https://github.com/ashhadsheikh/ebpf/blob/master/router.c>
- <https://github.com/Netronome/bpf-samples/tree/a7dd7d8c38636dd0a1bb5f2380ce309f314abfe3/l4lb>
- <https://github.com/iovisor/bcc/blob/master/examples/networking/xdp/xdp_redirect_cpu.py>


## BPF XDP Test

``` python
from bcc import BPF

code = '''
// 5.4 상위 커널의 asm 심벌 관련 버그가 있음
// https://github.com/iovisor/bcc/issues/2546
#ifdef asm_inline
#undef asm_inline
#define asm_inline asm
#endif

#include <linux/bpf.h>
#include <linux/if_ether.h>
#include <linux/ip.h>

int dropper(struct xdp_md *ctx) {
  void *data = (void *)(long)ctx->data;
  void *data_end = (void *)(long)ctx->data_end;
  struct ethhdr *eth = data;

  if (data > data_end) {
    return XDP_DROP;
  }

  int ipsize = sizeof(*eth);
  struct iphdr *ip = data + ipsize;

  // ipaddr: "10.205.131.126"
  if (ip->saddr == 0x0acd837e) {
    return XDP_DROP;
  }

  return XDP_PASS;
}
'''

device = 'eth0'
print('load bpf program')
drop_code = BPF(text=code)
print('load bpf function')
drop_fn = drop_code.load_func('dropper', BPF.XDP)
try:
    print('attach xdp function to "%s"' % device)
    drop_code.attach_xdp(device, drop_fn, 0)
    while True:
        pass
except KeyboardInterrupt:
    print('detach xdp function to "%s"' % device)
    drop_code.remove_xdp(device, 0)
```

커널에 앱 로딩이 안되고 있음..

```
load bpf program
load bpf function
bpf: Failed to load program: Permission denied
0: (b7) r0 = 1
1: (61) r2 = *(u32 *)(r1 +0)
2: (61) r1 = *(u32 *)(r1 +4)
3: (2d) if r2 > r1 goto pc+4
 R0_w=inv1 R1_w=pkt_end(id=0,off=0,imm=0) R2_w=pkt(id=0,off=0,r=0,imm=0) R10=fp0
4: (61) r1 = *(u32 *)(r2 +26)
invalid access to packet, off=26 size=4, R2(id=0,off=0,r=0)
R2 offset is outside of the packet
processed 5 insns (limit 1000000) max_states_per_insn 0 total_states 0 peak_states 0 mark_read 0

Traceback (most recent call last):
  File "run.py", line 39, in <module>
    drop_fn = drop_code.load_func('dropper', BPF.XDP)
  File "/usr/lib/python2.7/dist-packages/bcc/__init__.py", line 384, in load_func
    (func_name, errstr))
Exception: Failed to load BPF program dropper: Permission denied
```

수정된 버전

``` python
from bcc import BPF


code = '''
// https://github.com/iovisor/bcc/issues/2546
#ifdef asm_inline
#undef asm_inline
#define asm_inline asm
#endif

#include <linux/bpf.h>
#include <linux/if_ether.h>
#include <linux/ip.h>

int dropper(struct xdp_md *ctx) {
  void *data_end = (void *)(long)ctx->data_end;

  void *data = (void *)(long)ctx->data;
  struct ethhdr *eth = data;

  uint64_t ip_header_offset = sizeof(*eth);
  struct iphdr *ip_header = data + ip_header_offset;
  if (data + ip_header_offset + sizeof(*ip_header) > data_end) {
    return XDP_DROP;
  }

  // ipaddr: "10.205.131.126"
  if (ip_header->saddr == 2122566922) {
    // bpf_trace_printk("drop ip packet %d\\n", ip_header->saddr);
    return XDP_DROP;
  }

  // bpf_trace_printk("flow %d\\n", ip_header->saddr);
  return XDP_PASS;
}
'''

device = 'eth0'

print('load bpf program')
drop_code = BPF(text=code)

print('load bpf function')
drop_fn = drop_code.load_func('dropper', BPF.XDP)

try:
    print('attach xdp function to "%s"' % device)
    drop_code.attach_xdp(device, drop_fn, 0)

    while True:
        pass

except KeyboardInterrupt:
    print('detach xdp function to "%s"' % device)
    drop_code.remove_xdp(device, 0)
```

좀 더 개선된 버전

```c
// https://github.com/iovisor/bcc/issues/2546
#ifdef asm_inline
#undef asm_inline
#define asm_inline asm
#endif

#include <linux/bpf.h>
#include <linux/if_ether.h>
#include <linux/if_vlan.h>
#include <linux/ip.h>

int drop_packet(struct xdp_md *ctx) {
    // packet contents are between ctx->data ~ ctx->data_end
    void *data = (void *)(long)ctx->data;
    void *data_end = (void *)(long)ctx->data_end;

    uint64_t header_offset;
    uint16_t header_proto;

    // build ethhdr
    struct ethhdr *ethernet_header = data;
    header_offset = sizeof(*ethernet_header);
    if (data + header_offset > data_end) {
        return XDP_DROP;
    }

    // parse vlan
    // check packet type "802.1Q", "802.1ad" which has vlan id
    // extract ip packets
    header_proto = ethernet_header->h_proto;
    if (header_proto == __constant_htons(ETH_P_8021Q) ||
        header_proto == __constant_htons(ETH_P_8021AD)) {

        struct vlan_hdr *vlan_header = data + header_offset;

        // add vlan offset to header_offset
        header_offset += sizeof(*vlan_header);
        if (data + header_offset > data_end) {
            return XDP_DROP;
        }
        header_proto = vlan_header->h_vlan_encapsulated_proto;
    }

    // pass non-ip packets
    if (header_proto != __constant_htons(ETH_P_IP)) {
        return XDP_PASS;
    }

    // drop ip packet
    struct iphdr *ip_header = data + header_offset;
    if ((void*)(struct iphdr *)(ip_header + 1) > data_end) {
        return XDP_DROP;
    }

    // ipaddr: "10.205.131.126"
    if (ip_header->saddr == 2122566922) {
        // bpf_trace_printk("drop ip packet %d\\n", ip_header->saddr, ntohs());
        return XDP_DROP;
    }

    // bpf_trace_printk("flow %d\\n", ip_header->saddr);
    return XDP_PASS;
}
```