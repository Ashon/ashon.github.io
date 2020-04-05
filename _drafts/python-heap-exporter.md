---
layout: post
title: "[WIP] Prometheus와 Python GC 모듈을 이용해 동작중인 애플리케이션의 힙 사용량 측정해 본 이야기"
date: 2019-12-05 23:07:50 +0900
excerpt: |
  Python의 GC 모듈을 이용해 동작하는 애플리케이션의 힙 사용량을 측정해 보고,
  Prometheus에서 메트릭을 수집할 수 있도록 exporter를 만들어 본 내용을 공유한다.
comments: true
category: blog
toc: true
tags:
- Python
- Observability
- Prometheus
---

최근에는 애플리케이션들의 관측성을 달성하기 위한 일들을 많이 하고 있다. 모니터링 시스템은
[Prometheus](https://prometheus.io/) 생태계와 [Grafana](https://grafana.com/)를 이용하고 있다.

Prometheus는 Pulling 방식을 통해 메트릭을 수집하는 오픈소스 TSDB 프로젝트이다.
프로메테우스는 메트릭을 수집하기 위한 `exporter` 라는 수집 에이전트가 있는데,
HTTP 프로토콜이며, 동작이 단순하고, 사용자가 쉽게 exporter를 만들 수 있도록 하는
라이브러리들을 제공하고 있다.

얼마전 파이썬으로 작성된 API 서버가 메모리 릭 현상으로 추정되는 동작을 보여주고 있어서,
해당 문제를 추적하기 위해 파이썬 애플리케이션의 힙 사용량을 실시간으로 측정하기 위한
프로메테우스 익스포터를 만들어 보고 가시화 한 내용을 공유한다.

## 메모리 누수

메모리 누수 현상은 간단히 애플리케이션 구동 중에 필요하지 않은 메모리를 계속 점유하고 있는 현상인데, 일반적으로 python 같은 인터프리터 언어 같은 고차원 언어에서는 애플리케이션의 메모리 관리를 위해 `Garbage Collection(GC)`을 지원한다.

하지만, GC를 지원한다 하더라도 로직의 문제로 애플리케이션이 필요 이상으로 메모리를 많이 점유하게 되는 경우도 있는데, 이 때는 언어 자체에서 지원하는 GC 모듈로는 해결이 불가능한 경우가 많고, 디버깅을 통해서 해결해야 한다.

## `gc` 모듈을 사용해 파이썬 애플리케이션의 heap 사용량 추적

파이썬에서는 파이썬으로 작성된 애플리케이션의 메모리를 관리하기 위해서 GC가 기본적으로 지원되고, 오브젝트의 메모리는 `Reference Counting` 방법을 통해서 관리하게 된다.

관련해서 사용자(개발자)가 직접 GC 동작에 관여할 수 있도록 `gc` 모듈을 제공하고 있고, 필요시 `gc` 모듈을 사용하여, 애플리케이션의 GC 관련 동작을 어느정도 제어할 수 있다.

나는 `gc` 모듈에서 `collect`, `get_objects`, `get_referrers` 세 함수를 이용해서 애플리케이션이 구동에 필요한 오브젝트들의 메모리 참조관계, 메모리 용량등을 측정해 보기로 하였다.

### gc.collect()

### gc.get_objects()

### gc.get_referrers()

## Prometheus

[CNCF](https://www.cncf.io/)에서 관리되는 오픈소스 모니터링 툴킷이다. 사운드클라우드에서
최초로 작성이 시작되었고 현재는 CNCF의 [Gradutated Project](https://www.cncf.io/projects/)로
포지셔닝 되어있다.

자세한 내용은 [공식 문서](https://prometheus.io/docs/introduction/overview/#features)를
참고하면 좋고, 여기서는 프로메테우스에 대한 소개는 생략하도록 한다.

## API에 heap 사용량을 추적하기 위한, prometheus metric endpoint 작성

## 결론

## 참고자료

- [Memory Leak](https://en.wikipedia.org/wiki/Memory_leak)
- [Garbage Collection]([https://](https://en.wikipedia.org/wiki/Garbage_collection_(computer_science)))
- [Reference Couting](https://en.wikipedia.org/wiki/Reference_counting)
- [Python gc module](https://docs.python.org/3/library/gc.html#module-gc)
- [CPython `gc.collect` Implementation](https://github.com/python/cpython/blob/ffd9753a944916ced659b2c77aebe66a6c9fbab5/Modules/gcmodule.c#L1515)
- [CPython `gc.get_objects` Implementation](https://github.com/python/cpython/blob/ffd9753a944916ced659b2c77aebe66a6c9fbab5/Modules/gcmodule.c#L1743)
- [CPython `gc.get_referrers` Implementation](https://github.com/python/cpython/blob/ffd9753a944916ced659b2c77aebe66a6c9fbab5/Modules/gcmodule.c#L1675)
- Prometheus Exporter
