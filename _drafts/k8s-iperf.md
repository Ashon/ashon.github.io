---
layout: post
title: "[WIP] Kubernetes Flannel CNI 성능 측정"
date: 2019-12-02 00:07:50 +0900
comments: true
tags:
- Kubernetes
- Network
- CNI
- Flannel
---

``` sh
# loopback
iperf3-server iperf3-server Accepted connection from 127.0.0.1, port 59184
iperf3-server iperf3-server [  5] local 127.0.0.1 port 5201 connected to 127.0.0.1 port 59186
iperf3-server iperf3-server [ ID] Interval           Transfer     Bandwidth
iperf3-server iperf3-server [  5]   0.00-1.00   sec  2.68 GBytes  23.0 Gbits/sec
iperf3-server iperf3-server [  5]   1.00-2.00   sec  2.94 GBytes  25.2 Gbits/sec
iperf3-server iperf3-server [  5]   2.00-3.00   sec  2.83 GBytes  24.3 Gbits/sec
iperf3-server iperf3-server [  5]   3.00-4.00   sec  2.86 GBytes  24.6 Gbits/sec
iperf3-server iperf3-server [  5]   4.00-5.00   sec  2.80 GBytes  24.1 Gbits/sec
iperf3-server iperf3-server [  5]   5.00-6.00   sec  2.90 GBytes  24.9 Gbits/sec
iperf3-server iperf3-server [  5]   6.00-7.00   sec  2.82 GBytes  24.2 Gbits/sec
iperf3-server iperf3-server [  5]   7.00-8.00   sec  2.75 GBytes  23.6 Gbits/sec
iperf3-server iperf3-server [  5]   8.00-9.00   sec  2.82 GBytes  24.2 Gbits/sec
iperf3-server iperf3-server [  5]   9.00-10.00  sec  2.80 GBytes  24.1 Gbits/sec
iperf3-server iperf3-server [  5]  10.00-10.04  sec  98.2 MBytes  21.8 Gbits/sec
iperf3-server iperf3-server - - - - - - - - - - - - - - - - - - - - - - - - -
iperf3-server iperf3-server [ ID] Interval           Transfer     Bandwidth       Retr
iperf3-server iperf3-server [  5]   0.00-10.04  sec  28.3 GBytes  24.2 Gbits/sec    4             sender
iperf3-server iperf3-server [  5]   0.00-10.04  sec  28.3 GBytes  24.2 Gbits/sec                  receiver
```

``` sh
# same host

iperf3-server iperf3-server Accepted connection from 10.233.64.12, port 52474
iperf3-server iperf3-server [  5] local 10.233.64.10 port 5201 connected to 10.233.64.12 port 52476
iperf3-server iperf3-server [ ID] Interval           Transfer     Bandwidth
iperf3-server iperf3-server [  5]   0.00-1.00   sec  2.18 GBytes  18.8 Gbits/sec
iperf3-server iperf3-server [  5]   1.00-2.00   sec  2.29 GBytes  19.7 Gbits/sec
iperf3-server iperf3-server [  5]   2.00-3.00   sec  2.27 GBytes  19.5 Gbits/sec
iperf3-server iperf3-server [  5]   3.00-4.00   sec  2.27 GBytes  19.5 Gbits/sec
iperf3-server iperf3-server [  5]   4.00-5.00   sec  2.29 GBytes  19.7 Gbits/sec
iperf3-server iperf3-server [  5]   5.00-6.00   sec  2.27 GBytes  19.5 Gbits/sec
iperf3-server iperf3-server [  5]   6.00-7.00   sec  2.26 GBytes  19.4 Gbits/sec
iperf3-server iperf3-server [  5]   7.00-8.00   sec  2.23 GBytes  19.1 Gbits/sec
iperf3-server iperf3-server [  5]   8.00-9.00   sec  2.23 GBytes  19.1 Gbits/sec
iperf3-server iperf3-server [  5]   9.00-10.00  sec  2.28 GBytes  19.6 Gbits/sec
iperf3-server iperf3-server [  5]  10.00-10.04  sec  88.4 MBytes  19.6 Gbits/sec
iperf3-server iperf3-server - - - - - - - - - - - - - - - - - - - - - - - - -
iperf3-server iperf3-server [ ID] Interval           Transfer     Bandwidth       Retr
iperf3-server iperf3-server [  5]   0.00-10.04  sec  22.7 GBytes  19.4 Gbits/sec  427             sender
iperf3-server iperf3-server [  5]   0.00-10.04  sec  22.7 GBytes  19.4 Gbits/sec                  receive
```

``` sh
# different host

iperf3-server iperf3-server Accepted connection from 10.233.65.4, port 57864
iperf3-server iperf3-server [  5] local 10.233.64.10 port 5201 connected to 10.233.65.4 port 57866
iperf3-server iperf3-server [ ID] Interval           Transfer     Bandwidth
iperf3-server iperf3-server [  5]   0.00-1.00   sec   103 MBytes   866 Mbits/sec
iperf3-server iperf3-server [  5]   1.00-2.00   sec   108 MBytes   904 Mbits/sec
iperf3-server iperf3-server [  5]   2.00-3.00   sec   107 MBytes   901 Mbits/sec
iperf3-server iperf3-server [  5]   3.00-4.00   sec   107 MBytes   901 Mbits/sec
iperf3-server iperf3-server [  5]   4.00-5.00   sec   108 MBytes   905 Mbits/sec
iperf3-server iperf3-server [  5]   5.00-6.00   sec   107 MBytes   895 Mbits/sec
iperf3-server iperf3-server [  5]   6.00-7.00   sec   107 MBytes   898 Mbits/sec
iperf3-server iperf3-server [  5]   7.00-8.00   sec   108 MBytes   905 Mbits/sec
iperf3-server iperf3-server [  5]   8.00-9.00   sec   107 MBytes   899 Mbits/sec
iperf3-server iperf3-server [  5]   9.00-10.00  sec   108 MBytes   906 Mbits/sec
iperf3-server iperf3-server [  5]  10.00-10.04  sec  4.31 MBytes   906 Mbits/sec
iperf3-server iperf3-server - - - - - - - - - - - - - - - - - - - - - - - - -
iperf3-server iperf3-server [ ID] Interval           Transfer     Bandwidth       Retr
iperf3-server iperf3-server [  5]   0.00-10.04  sec  1.05 GBytes   901 Mbits/sec    7             sender
iperf3-server iperf3-server [  5]   0.00-10.04  sec  1.05 GBytes   898 Mbits/sec                  receiver
```
