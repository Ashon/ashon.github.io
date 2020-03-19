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

## Prometheus

[CNCF](https://www.cncf.io/)에서 관리되는 오픈소스 모니터링 툴킷이다. 사운드클라우드에서
최초로 작성이 시작되었고 현재는 CNCF의 [Gradutated Project](https://www.cncf.io/projects/)로
포지셔닝 되어있다.

자세한 내용은 [공식 문서](https://prometheus.io/docs/introduction/overview/#features)를
참고하면 좋고, 여기서는 프로메테우스에 대한 소개는 생략하도록 한다.

## `gc` 모듈을 사용해 파이썬 애플리케이션의 heap 사용량 추적

### gc.collect()

### gc.get_objects()

### gc.get_referrers()

## API에 heap 사용량을 추적하기 위한, prometheus metric endpoint 작성

## 결론

## 참고자료
