---
layout: post
title: 파이썬에서의 의존성 주입 문제 해결
date: 2019-11-02 20:51:45 +0900
comments: true
toc: true
tags:
- Web
- Python
- Software-Design
---

## 개요

나는 주로 파이썬의 `Flask`, `Django`, `Sanic`, `Vibora` 등의 웹 프레임워크들을
이용해서 간단한 프로젝트들을 만들어 오고 있다.

`Django`의 경우는 애플리케이션을 구현하기 위한 많은 기능들이 프레임워크에서 제공되기 때문에
프레임워크의 사상을 따라 애플리케이션을 만들 수 있다.

그외 `Flask` 류의 프레임워크들은 뷰를 구현하고 라우트를 관리하기 위한 다양한 기능들을 제공해 주긴 하지만,
Django같은 DI(Dependency Injection) Framework가 내장되어 있지 않아,
큰 규모의 애플리케이션을 만들기 위해서는 DI를 위한 코드들을 별도로 작성해야 할 수 있다.

`importlib`와 `Module namespace`를 이용해 단순한 구조의 `DI Container`를 만들어 사용하는
방법을 소개한다.

### Simple DI in python

파이썬은 모듈들을 간단한 방법으로 Dynamic import할 수 있게 만들어져 있기 때문에,
DI를 위한 기능도 손쉽게 구현할 수 있다.

자바 류의 언어에서 구현된 `DI` 라이브러리들의 사용 경험을 그대로 따라가기 보다는 간단한 방식으로
application에 내가 설정을 통해 원하는 미들웨어나 의존성들을 설정으로 주입할 수 있도록 구현해서 쓰고 있다.

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

## 결론

`Zen of Python`의 맨 마지막 문구로 대신한다.

> Namespaces are one honking great idea -- let's do more of those!

## 참고

- [Python Importlib](https://docs.python.org/3/library/importlib.html)
- [Zen of Python Explained](https://inventwithpython.com/blog/2018/08/17/the-zen-of-python-explained/)
