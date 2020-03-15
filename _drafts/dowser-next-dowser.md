---
layout: post
title: "[WIP] Python GC 모듈을 이용해 런타임 애플리케이션의 힙 사용량 측정해 보기"
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

``` python
from collections import defaultdict
import gc


# 정확한 힙 사용량을 측정하기 위해 GC를 수행한다.
gc.collect()

# 프로세스의 오브젝트를 수집한다.
objects = gc.get_objects()

# 수집된 오브젝트들의 타입들에 대해 카운팅한다.
types_count = defaultdict(int)
for obj in objects:
    obj_type = type(obj)
    types_count[obj_type] += 1

# 타입의 크기와 count를 이용해 힙 사이즈를 측정한다.
heap_usage = defaultdict(int)
for obj_type, count in types_count.items():
    heap_usage[obj_type] += sys.getsizeof(obj_type) * count
```
