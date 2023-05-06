---
layout: post
title: Rust '찍먹'해 본 이야기
date: 2023-02-22 14:27:19 +0900
excerpt: |
  Rust 언어를 사용해 보면서 느낀 점들, Rust를 도입할 때 중요하게 살펴보았던 부분, Rust로 프로젝트를 진행할 때,
  개발환경, 테스트, 디버깅은 어떻게 할 수 있는지. 프레임워크를 작성할 때, 어떤 형태로 작성하고 제공할 수 있을 지 고민해 본 내용을 정리한다.
comments: true
category: blog
toc: true
tags:
- Rust
- Software-Design

---

그동안 파이썬을 주력으로 사용 해 오면서, 높은 성능이 요구되는 애플리케이션에 대한 작성이 필요할 때에 대한
갈증 같은것들이 늘 있어 왔는데, 업무적으로.. 또는 트렌드에 반응한 것인지 `Rust`를 접해 볼 기회가 생겼다.

한글로 잘 번역 된 러스트 언어 입문서를 보면서, 그리고 튜토리얼을 따라해 보면서 내가 느꼈던 Rust 언어의
독특한 점, 재밌었던 부분들을 소개한다.

일반적으로 웹 프레임워크들이 사용자에게 인터페이스로 제공하기 위해 사용하는 데코레이터 체인을 Rust로
어떻게 표현할 수 있는지 고민하면서, Rust는 다형성을 어떻게 제공하고 있는지, 규모 있는 애플리케이션을
작성할 때는 어떻게 사용하면 좋을지도 알아보고 싶었다.

> ~~오랜만의 포스팅이라 글 쓰는게 너무 어려운 점...~~ <br/>
> 요즘 Rust에 푹 빠졌는데, 혹시나 더 좋은 내용이나 참고할 내용이 있다면 자유롭게 의견 부탁드립니다~!

# 내가 생각하는 프로그래밍 언어의 도입 타당성 검토

나는 새로운 언어를 배우면서 대체로 '복잡한 다형성을 어떻게 효과적으로 관리할 수 있게 해 주는지'가 머리속에
가장 먼저 떠오른다.

그 외에도 언어의 생태계가 얼마나 활발한 지, 빌드 시스템, 테스트, CI를 쉽게 달성할 수 있는지 등을 중요하게
생각하는 편이라서 이 부분들을 중심으로 Rust를 공부하고 있다.

## 개발, 빌드 환경은 어떻게 구성할 지?

새로 나오는 언어들은 항상(?) 최신 개발 트렌드를 반영해서 좋은 생태계를 갖추고 나오는 것 같다.

`Rust`도 마찬가지로 좋은 패키지 관리도구, 빌드, 테스트 도구 등을 제공해 주고 있는데 이 부분에 대한 소개는
다른 좋은 글들이 많으니까 생략하도록 한다.

나는 현재 개발장비로는 M1 맥북을 사용 중인데, ARM 아키텍쳐 위에서 개발하면서 크로스 컴파일 문제로 잠깐 고생좀 했다.
로컬에서 직접 빌드하고 사용할 때는 별 문제없이 소스코드를 작성하고 컴파일하는데 문제가 없었지만..

### Container 생태계를 활용한 멀티 아키텍처 빌드 환경 구성

컨테이너 환경에서는 기존 언어에서 만나 온 크로스 아키텍처 빌드(?) 문제와는 다른 양상이었다.
Rust로 컴파일 된 바이너리를 컨테이너에서 사용하기 위해서는 빌드 컨테이너부터 런타임까지 각 환경의
CPU 아키텍처를 따르도록하는 설정이 필요했다.

> 크로스 아키텍쳐 빌드라고 거창하게 썼지만 사실, 파이썬을 주로 쓰기 때문에 컴파일 언어에서 일반적으로
> 말하는 크로스 컴파일과는 다르다. 단순히 heterogeneous architecture(arm64, amd64 등)에서
> 각 환경 별 컨테이너를 빌드하는 것.

Cargo에서는 크로스컴파일 지원을 위한 기능을 제공 중이므로 이를 활용해도 좋지만, 더 간편하게 해결할 수 있는
방법을 찾아보았고, 짧은 시간동안 조사하고 적용해 본 내용으로는 아래 방법이 가장 간편하다는 생각이 든다.

> Docker에서는 CPU 아키텍쳐 별로 컨테이너 레지스트리를 운영하고 있는데, ARM의 경우 `armv8/{container}`
> 형태로 ARM 아키텍처로 제공하는 이미지들에 접근할 수 있다.

``` docker
# file: Dockerfile
ARG container_prefix=""

# multistage를 활용해서 빌드 컨테이너와 런타임 컨테이너를 분리한다.
FROM ${container_prefix}rust:1.67-alpine as builder
WORKDIR /build
COPY . .
RUN cargo build --release

# 런타임에서는 빌드 환경과 같은 ARM alpine 컨테이너가 필요하다.
FROM ${container_prefix}alpine:3.12
WORKDIR /app
COPY --from=builder /build/target/release/_study_rust .
CMD ["./_study_rust"]
```

아키텍쳐 별 컨테이너 빌드 인자 설정을 `docker-compose`로 관리하면 좋다고 생각했다.

``` yaml
# file: docker-compose.yml
version: '3'

services:
  server-amd64:
    build:
      context: .

  server-arm64:
    build:
      context: .
      args:
        container_prefix: arm64v8/
```

이정도면 예제로 진행해 본 코드들을 빌드하거나 간단한 프로젝트를 진행할 때도 문제없이 동일한 설정으로
개발 빌드 환경을 정의할 수 있다고 생각이 들었다.

## 테스트 작성, 관리는 쉬운지?

Rust는 매크로를 통해서 테스트 코드를 정의할 수 있고, 컴파일 타임에서 해당 코드가 제외되도록 관리하고 있다.
별도의 테스트 모듈이나 패키지 형태로 관리할 수 있는데, 이 부분에서 cargo의 패키지 관리 특성에 따라
테스트코드 관리 형태도 달라질 수 있는 점을 발견했는데..

`main.rs` vs `lib.rs`

## 디버깅은 어떻게 하는지?

### LLDB를 통한 디버깅

### CodeLLDB - VSCode LLDB 플러그인

### 어셈블러 수준 분석

`rustc --emit asm {soruce}` 명령어를 이용해서 컴파일 결과물을 어셈블리어 코드로 출력할 수 있다.

`cargo-asm` 패키지를 이용하면 `cargo` 를 통해서 어셈블리 결과를 확인 할 수 있어서, 이렇게 사용하는
것이 더 좋지 않을까 생각이 들었다.

VSCode plugin Assembly syntax highlighting

- `x86 and x86_64 Assembly`
- `Arm Assembly`

## 프레임워크 형태의 코드를 작성하고 제공한다면?

### Rust로 만들어보는 데코레이터 체인

# 소감

# 참고해 보면 좋은 자료

- [러스트 한글 입문서](https://rinthel.github.io/rust-lang-book-ko/foreword.html)
- [Rust by Example](https://doc.rust-lang.org/rust-by-example/index.html)
- [Async Rust](https://rust-lang.github.io/async-book/01_getting_started/01_chapter.html)
- [Rust Reference](https://doc.rust-lang.org/reference/introduction.html)
- [Rust CLI](https://rust-cli.github.io/book/index.html)

커뮤니티 웹 문서, 도구

- [Rust Cheat Sheet](https://cheats.rs/)
- [Polymorphism in Rust](https://oswalt.dev/2021/06/polymorphism-in-rust/)
- [러스트 바이너리의 어셈블리 추적하기](https://stackoverflow.com/questions/39219961/how-to-get-assembly-output-from-building-with-cargo)
- [CompilerExplorer - Rust](https://rust.godbolt.org/) - 웹에서 Rust 코드와 빌드되는 어셈블리를 확인할 수 있는 도구

크레이트(Crates) 관련

- [Cargo ASM](https://github.com/gnzlbg/cargo-asm) - 공식 프로젝트 관리 도구인 Cargo를 통해서, 어셈블리 수준으로 분석할 수 있게 해 주는 도구

웹 프레임워크

> 세 프레임워크가 제공하는 인터페이스가 각각 다른 점이 흥미롭다.

- [Axum](https://docs.rs/axum/latest/axum/)
- [Actix](https://actix.rs/)
- [Graphul](https://graphul-rs.github.io/)

라이브러리 관련

- [Box](https://doc.rust-lang.org/std/boxed/struct.Box.html)
- [FnMut](https://doc.rust-lang.org/std/ops/trait.FnMut.html)
- [async-std](https://book.async.rs/introduction.html)
