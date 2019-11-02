---
layout: post
title: Go net/http로 간단한 웹 프레임워크 만들어 보기
date: 2019-10-12 00:47:23 +0900
comments: true
tags:
- Web
- Golang
---

주말동안 간단한 웹 프레임워크를 만들어 보면서, Go의 기능들을 공부해 보았다.

설계가 일부 조악한 부분들이 보이긴 하지만, 비즈니스 로직 영역과 http 리퀘스트 처리에 대한 영역을
최대한 분리해 보도록 구현해 보면서, 높은 수준의 Go 애플리케이션을 작성하기 위한 방법들을 찾아보는데
중점을 둔다.

## Web Framework Overview

나는 파이썬을 주로 쓰는데, 이번 공부에서는 Golang으로 파이썬에서의
개발 경험들을 Golang으로 만들어 내기 위한 방법들을 찾아보고 구현하였다.

웹 애플리케이션의 코어 로직들은 최대한 숨기면서, 사용자 기능들만 빠르게 구현하기 위한 방법들을
위해, `core`, `app` 디렉토리로 구분하여 간단한 프레임워크와 애플리케이션 구현을 작성해 보았다.

``` sh
$ tree
.
├── app ................ 사용자 애플리케이션의 구현
│   ├── routes.go ...... url route를 관리
│   └── views.go ....... view 함수들
│
├── core ............... net/http에서 API 구현을 위한 프레임워크 로직들
│   ├── config.go ...... 프레임워크로 관리될 설정 모음
│   ├── exceptions.go .. 에러 인터페이스
│   ├── handler.go ..... request / response handler
│   ├── logger.go ...... logger 설정
│   ├── request.go ..... view 구현에 사용되는 request 스트럭처
│   ├── response.go .... response structure
│   └── server.go ...... 서버를 빌드하고 애플리케이션 동작에 대한 코드
│
├── docker-compose.yml
├── Dockerfile
│
├── go.mod
├── go.sum
│
├── main.go ............. 메인 파일
│
└── README.md
```

### Core

웹 개발 프레임워크들의 코어 로직으로서, 비즈니스 로직을 작성하기 위한 간단한 인터페이스를 제공하고
애플리케이션 라이프사이클을 관리하게 된다.

애플리케이션으로 들어오는 요청과 응답을 다루기 위한 방법들을 관리할 수 있게 한다.

### App

Core에 구현된 인터페이스를 이용해 비즈니스로직을 이해하기 쉽게 만들어 보고,
Go의 특수한 예외처리 방식을 Core로 커버 가능한지를 검증해 본다.

## Experiences in python

나는 주로 파이썬의 `Flask`, `Django`, `Sanic`, `Vibora` 등의 웹 프레임워크들을
이용해서 간단한 프로젝트들을 만들었다.

`Django`의 경우는 애플리케이션을 구현하기 위한 많은 기능들이 프레임워크에서 제공되기 때문에 프레임워크의 사상을 따라 애플리케이션을 만들 수 있다.

그외 `Flask` 류의 프레임워크들은 뷰를 구현하고 라우트를 관리하기 위한 다양한 기능들을 제공해 주긴 하지만, Django같은 DI(Dependency Injection) Framework가 내장되어 있지 않아, 큰 규모의 애플리케이션을 만들기 위해서는 DI를 위한 코드들을 별도로 작성해야 할 수 있다.

### Simple DI in python

파이썬은 모듈들을 간단한 방법으로 Dynamic import할 수 있게 만들어져 있기 때문에, DI를 위한 기능도 손쉽게 구현할 수 있다.

자바 류의 언어에서 구현된 `DI` 라이브러리들의 사용 경험을 그대로 따라가기 보다는 간단한 방식으로 application에 내가 설정을 통해 원하는 미들웨어나 의존성들을 설정으로 주입할 수 있도록 구현해서 쓰고 있다.

아래는 파이썬에서 내가 주로 사용했던 DI를 위한 dynamic import 로직과 injection의 예시이다.

#### Core module

``` python
# file: utils.py
import importlib


def get_module(module_path: str):
    """module_path를 인자로 받아 해당 모듈을 리턴한다.
    """

    module_path, _, child_name = module_path.rpartition('.')

    module = importlib.import_module(module_path)
    child = getattr(module, child_name)

    return module, child


def instantiate(classpath, constructor):
    """module_path로부터 획득한 클래스를 인스턴스로 생성해 인스턴스를 리턴한다.
    """

    _, instance_cls = get_module(classpath)
    instance = instance_cls(**constructor)

    return intsance
```

``` python
# file: core.py
from flask import Flask
from utils import instantiate


def build_application(settings):
    app = Flask(__name__)
    app.config.from_object(settings)

    for name, spec in settings.MIDDLEWARES.items():
        middleware = instantiate(**spec)

        # 적절한 방법으로 middleware와 app 컨텍스트를 연결.
        middleware.init_app(flask_app)

        setattr(app, name, middleware)

    return app
```

#### User Application

정의된 코어 소스코드들로 애플리케이션 라이프사이클을 제어하도록 하고, 사용자는
필요한 모듈만을 정의하여 애플리케이션을 작성할 수 있게 된다.

``` python
# file: settings.py
MIDDLEWARES = {
    'user_api_client': {
        'classpath': 'app.middlewares.user_api.Client',
        'constructor': {
            'api_url': 'http://blabla.api.com:8080',
            'api_user': 'testuser',
            'api_key': 'blabla'
        }
    }
}
```

``` python
# file: app.py
from core import build_application
import settings


flask_app = build_application(settings)
flask_app.run(...)
```

이런식으로 관리하게 되면, Django 에서의 DI를 이용해 미들웨어를 관리하는 것 처럼
application의 네임스페이스에 설정한 미들웨어를 주입하고 런타임에서 사용할 수 있게 해 준다.

미들웨어 로직과 애플리케이션 코어와의 루즈한 커플링을 제공해 줌으로써,
넓은 범위로의 재사용성을 보장해 줄 수 있다.

### Managing Views

Flask를 예로 들면 간단한 API View는 데코레이터를 이용해 정의할 수 있다.

``` python
# file: app.py
from flask import Flask


app = Flask(__name__)


@app.route('/hello')
def hello():
    return 'hello world'
```

실제 비즈니스 로직을 처리하는 거대한 애플리케이션을 만들기 위해서는 애플리케이션 컨텍스트와
강하게 연결되는 데코레이터 형식 보다는, 구현된 비즈니스 로직을 가지고 사용할 주체에서 빌드업 해서 쓰는게
옳다고 생각한다.

``` python
# file: views.py
def hello():
    return 'hello world'
```

``` python
# file: app.py
from flask import Flask
from views import hello


app = Flask(__name__)
app.route('/hello', methods=['GET'])(hello)
```

이런식으로 작성하면 비즈니스 로직을 애플리케이션 로직으로부터 분리해서 작게 관리할 수 있다.

위에서 설명한 DI와 조합하면, 애플리케이션 설정으로 사용자가 필요한 API들을 하나의 `suite`로서
관리할 수 있게 되는 장점이 있다.

## Implementation in Go

글에 적은 파이썬 경험들을 Go로 표현해 보면서, Go의 사용성이나 Go의 철학들을 이해해 보면 좋을 것 같다.

유저 애플리케이션을 작성하기 위해 API View들을 비교적 쉽게 만들 수 있게 해 보고, API Route 관리,
프레임워크의 리퀘스트 처리 흐름을 사용자가 일부 제어 가능하도록 하는 미들웨어 등을 작성할 수 있는
기능을 구현 해 보고자 했다.

### Features

Go에서는 http 요청 처리를 위한 간단한 수준의 라이브러리인 `net/http`를 제공해 주는데,
해당 라이브러리를 통해서 가벼운 HTTP 요청을 주고 받는 애플리케이션을 작성해 볼 수 있다.

```go
// file: main.go
package main

import "net/http"

// 8080포트로 "/hello" path로 HTTP 요청이 들어오면
// "hello world"를 응답해 주는 HTTP API
func main() {
    http.HandleFunc("/hello", func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte("hello world"))
    })

    http.ListenAndServe(":8080", nil)
}
```

`net/http` 라이브러리를 이용해 간단한 예제 코드를 작성해 보았고, 이 예제코드로부터 HTTP 리퀘스트를
효과적으로 다룰 수 있고, 비즈니스 로직을 잘 분리하는 간단한 프레임위크를 만들어 보고자 했다.

#### View, Route Management

첫 예제로부터 어떤 route에 매핑된 리퀘스트 처리 함수가 엉겨붙어 있는 모습을 알 수 있다.

``` go
// 이 함수 블럭에서는 application에 route를 등록하고,
// 해당 요청에 대한 비즈니스 로직을 처리하며
// 요청에 응답을 처리하는 로직들이 다같이 존재하고 있다.
http.HandleFunc("/hello", func(w http.ResponseWriter, r *http.Request) {
    w.Write([]byte("hello world"))
})
```

일단 처음 Golang을 접하는 입장에서 당장 주석에 써 놓은 관심사 별로 코드를 쪼갤때 쉽다고 생각했던
부분은 func를 따로 정의하고, `http.HandleFunc`에 route와 뷰 함수를 등록 해 보는 것이었다.

``` go
// 뷰 함수를 분리한다.
//
// 정확히는 모르지만, http.ResponseWrite가 하는 동작으로 보아
// 응답을 위한 스트림을 뷰에서 바로 처리하도록 되어 있는 것 같았다.
// 이런 스트림 처리는 비즈니스 로직단에서 하기 보다는,
// 좀 더 프레임워크 레벨에서 고도화 시킬 필요가 있다고 생각했다.
func HelloWorld(w http.ResponseWrite, r *http.Request) {
    w.Write([]byte("hello world"))
}

// main에서 app을 조립하고 동작시킨다.
func main() {
    http.HandleFunc("/hello", HelloWorld)
    http.ListenAndServe(":8080", nil)
}
```

뷰는 잘 분리 되었지만, main app을 빌드할 때, route 설정 또한 사용자 설정으로 다루게 하고 싶었다.
Python의 사용경험을 살려 dict 타입으로 route와 함수를 매핑하는 식의 경험으로 풀어보고자 했다.

``` go
func main() {
    // Go에서는 map을 이용해 dictionary 형태의 데이터 타입을 만들 수 있다.
    var Routes = map[string](func(w http.ResponseWriter, r *http.Request)){
        "/hello": HelloWorld,
    }

    // 많은 route view 매핑을 등록하기 위해 반복문을 사용한다.
    for route, view := range Routes {
        http.HandleFunc(route, view)
    }
}
```

이런 형태로 라우트와 비즈니스 로직 처리를 위한 함수를 애플리케이션 빌드 로직과 분리해서
관리할 수 있는 형태가 되었다.

#### Request Flow Control

view와 route관리는 떨어졌지만, 여전히 view에서 응답 스트림을 직접 컨트롤 하는 부분이 마음에
들지 않아서 이 부분도 따로 떼어서 처리 할 수 있는지 알아보았다.

최대한 요청과 응답 흐름을 처리하는 부분과, 요청이 들어왔을 때의 로직을 분리해서 관리하면 좋겠다는
생각이 들어서 이 부분을 처리하기 위한 방법을 알아보던 중..

`net/http`에는 `ServeHTTP(rw ResponseWriter, req *Request)`라는
인터페이스 함수를 제공해 주는데, 이를 오버라이드 함으로써 애플리케이션으로 흐르는 전체 리퀘스트를 직접
컨트롤 할 수 있는 걸 알 수 있었다. `Python Flask`와 마찬가지로 이 라이브러리는 단일 애플리케이션으로
들어오는 요청에 대한 동시성 처리는 제공해 주지는 않는 것 같다.

들어오는 request는 비즈니스 로직으로 던지고, 프레임워크에서 적당한 리스폰스 인터페이스를 제공해 주고
이를 이용해 스트림을 제어하면 좋겠다는 생각이 들었다.

#### Middleware Management

아직 이 부분은 현재 예제에서는 완성하지 못했다. Golang을 써본건 처음이기도 했고, DI를 위한
방법들을 익히기엔 주말은 너무 짧은 시간이었다.

## 소감

- `tab`은 영 적응이 안되지만 `vscode`의 코딩 어시스턴트 기능들에 의존했기 때문에,
  별다른 불편함 없이 코드를 작성할 수 있었다.
  - 타입 시스템으로 코드를 작성하면서 바로 코드 스펙들을 알 수 있는게 장점이기도 하다고 생각하지만..
    너무 IDE 의존적이 되어, 이런 부분들에 무뎌질 수 있겠다는 생각이 들었다.
- 파이썬에 비해 일부 비즈니스 로직들의 표현이, verbose 하다는 느낌은 여전히 지울 수 없다.
  - 성능을 위해선 어쩔 수 없는 부분인 걸까..
- 프레임워크에서 할 일들이 표현되는 방식을 보면, 결국 `Go`, `Python` 할 것 없이 비슷하게 표현됨을
  알 수 있었다.

## 무엇을 배웠나

### net/http

작성 중

### go mod

작성 중

### panic

Golang에서는 예외처리를 위해 `panic()`, `recover()` 라는 내부 함수를 이용하게 되어 있다.
다른 언어들에서의 `try-catch` 구문과 비슷한데, Golang에서는 `try-catch` 구문은 없고,
`defer` 지시자와 패닉이 발생할 코드에서 `recover()` 를 통해 예외가 발생할 수 있는 코드를 감싸도록
하고 있다.

`defer` 지시자는 파이썬의 `with` 지시자 처럼 스코프 밖으로 빠져나갈 때, 어떤 동작을 할 수 있게
해 준다.

``` python
content = ''

# with 지시자를 이용하면 log.txt를 읽고 난 후, file을 close한다.
with open('log.txt') as f:
    content = f.read()
```

``` go
func ReadFile() {
    f := os.Open("log.txt")
    defer f.Close()

    content := f.Read()
}
```

이런 식으로 deferred function을 이용해서 scope로 발생한 리소스들을 처리하기 위한 방법들을
위에서 명시할 수 있도록 해 준다.

어쨌든 Golang에서는 `defer` 지시자를 이용해 애플리케이션의 `panic`을 처리하도록 하고 있다.
아래 파이썬 코드는 이후에 등장하는 Go로 표현한 코드와 동일한 흐름을 보여준다.

``` python
try:
    raise Error('exception raised')
except Exception as e:
    print('recovered: ', e)

# stdout
# recovered: exception raised
```

``` go
package main

import "fmt"

func main() {
    // 프로그램 동작 이후에 deffered function이 수행된다.
    defer func() {
        // recover() 함수를 실행함으로써 panic이 발생한 지점 전체를 감싼다.
        if r := recover(); r != nil {
            fmt.Println(fmt.Sprintf("recovered: %s", r))
        }
    }()

    panic("exception raised")
}

// stdout
// recovered: exception raised
```

아직 왜 굳이 `defer`를 써서 귀찮게 예외처리를 하게 만들었는지는 모르겠지만
이런 흐름을 가지고 있는게 신기했다.

아마 `C`언어에서 예외가 발생했을 경우, `goto`로 빠지도록 하는 행위와 비슷한 것 같다.
(~~내가 C언어로 업을 쌓아오진 않았지만.. 이런 방법을 요즘 `C`에서도 쓰는지는 잘 모르겠다.~~)

패닉이 발생하고 다양한 예외 종류가 있다면.. Go 코드에서 가독성 좋게 표현할 수 있을까?
하는 생각도 든다.

### interface

Golang 에서는 `다형성(Polymorphism)`을 실현하기 위해 `interface`를 지원한다.
Java에서와 마찬가지로 메서드 시그니처들의 모음이다.

Python에서는 굳이 인터페이스를 만들지 않았지만, `duck-typing`을 통해 다형성을 지원한다.

`panic()` 함수의 시그니처는 `func panic(v interface{})` 인데, 이때 인자로 들어가는
`interface{}`는 `any type`으로써 사용되는 것 같다.

### package system

내가 처음 맨땅에 헤딩하면서 가장 헷갈렸던 부분인데, Golang에서는 앞글자가 대문자가 아니면
모듈 밖으로 노출되지 않는다는 것이었다.
(~~이것때문에 처음에 소스코드를 쪼개면서 엄청 삽질했는데..~~)

해당 기능은 Golang의 스펙이며, 다른 언어를 할 줄 알지만..
처음 Golang을 접한다면 꼭 알고 넘어가야 할 부분이라고 생각한다.

## 더 알아보고픈 내용

### Dependency injection

현재까지 나의 경험으로는 프레임워크에서 정한 리퀘스트 라이프사이클을
유저 영역의 코드로 제어하기 위한 방법을 구현하기 위해서는 DI가 필수적이라고 생각한다.

Go에서는 어떻게 DI를 구현하고 사용할 수 있는지 이해 할 필요가 있다.

### Types in go

Go의 타입 시스템을 정확하게 이해하고 작성한 코드가 아니므로, 이 부분을 정확하게 알면 더 깔끔한
코드를 작성할 수 있을 것 같다.

### Other Go Web Framework

아직 Go의 생태계를 잘 모르기 때문에, 다른 웹 프레임워크는 어떤 식으로 구현되어 있는지 알아 볼 필요가 있다.

## 함께보면 좋은 내용

- [Python Importlib](https://docs.python.org/3/library/importlib.html)
- [Defer Panic and Recover](https://blog.golang.org/defer-panic-and-recover)
- [Go Exported_identifiers](https://golang.org/ref/spec#Exported_identifiers)
- [Go net/http](https://golang.org/pkg/net/http/)
- [Go net/http server.go](https://golang.org/src/net/http/server.go)
- [Go interface](https://gobyexample.com/interfaces)
- [Go Data Structures: Interfaces](https://research.swtch.com/interfaces)
