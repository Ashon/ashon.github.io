---
layout: post
title: "Ansible에서 전략 패턴을 이용해 자동화 프로젝트의 확장성을 확보하기"
date: 2019-10-31 00:07:50 +0900
toc: true
comments: true
tags:
- devops
- ansible
---

## 개요

`Ansible`은 현재 널리 사용되고 있는 인프라스트럭쳐 자동화 도구다. 많은 서버들을 편리하게 제어할 수 있는 경험을 제공해 준다.

`Ansible`을 사용하다 보면, `Playbook`과 `Task`들 `Role`들을 적절한 단위로 나누어 인프라스트럭쳐 자동화 작업을 하는데,
간혹 자동화의 특정 작업들에 대해 다양성이 필요한 경우가 발생하곤 한다.

이 경우 `Ansible` 에서는 `when` 지시자 같은 조건문 기반으로 태스크들을 쪼개서 관리하는 등의 가이드가 많은데,
이런 방식으로만 코드를 작성해 나가다 보면 조건들이 많아질 경우 태스크들과 조건문들의 참조 관계가 복잡해져 관리가 힘들어지게 되는 문제가 발생한다.

이 경우 적절한 조건이나 값을 이용하여, `Task` 블록들을 독립적인 파일로 만들고 `include_task` 모듈을 통해,
좀 더 깨끗하고 뚜렷한 목적의 `Task` 파일들로 구성하도록 만들어 자동화 프로젝트 코드를 더 깔끔하게 유지하는 방법을 알아본다.

## 전략 패턴?

디자인 패턴과 `OOP`에서 자주 등장하는 단어이고, 서비스 코드를 작성하다 보면 항상 만나는 주제이다.

**어떤 하나의 목적**을 달성하기 위한 **다양한 방식의 행위**들을 **인터페이스**를 맞추고 **캡슐화** 하여,
필요할 때 적절히 교체해서 사용할 수 있게 만들기 위한 디자인 패턴이다.

`Ansible`에서는 `OOP`만큼 지켜야 할 강력한 규칙이나 관계들을 정의하기는 힘들지만,
패턴의 개념을 적절히 `Ansible`의 컴포넌트들로 비추어 전략 패턴으로 큰 로직 흐름은
최소한의 수정으로 유지하면서 풀고자 하는 문제를 해결할 수 있다.

> 아래에 풀어나갈 예제와 해결방법들에 대한 고민은, 사실 객체지향에서 말하는 전략패턴과는
> 많이 다른 부분이 있을 수 있다.

## 문제: 웹 애플리케이션을 배포해 봅시다

어떤 웹 애플리케이션을 배포하는 방식은 여러가지가 있다.
적절히... 시대상(?)을 반영하여 애플리케이션을 배포하는 방식을 전통적인 것 부터 현대적인 방법까지 대략 3단계로 나누어 보았다.

- 베어메탈 서버에 한땀한땀 프로비저닝을 진행하고, 애플리케이션 설정을 한다.
- 요즘같은 시대에 컨테이너를 이용해서, 좀 더 편리하게 애플리케이션을 배포해 보자.
- 오케스트레이터는 기본으로 써야한다. `Kubernetes`도 설치해서 그 위에 애플리케이션을 올리자.

위 세 방식 다 서버를 다루기 위한 공통적인 단계들로 구성되어 있다고 보자. 여기서는 대략 2가지 단계로
나누어 보았다.

1. 인프라스트럭쳐를 셋업하는 부분
1. 애플리케이션을 배포하는 부분

`Ansible`을 이용해서 자동화 한다고 했을 때, 나의 경우는 `Playbook`을 큰 단계로 구분하고,
`Role`, `Task`는 하위 디테일한 작업을 정의하는데 쓴다. 이 경우 대략..

``` sh
$ tree
.
|-- inventory                 # 인벤토리 파일
|
|-- playbooks                 # 서버들을 관리하기 위한 플레이북 모음
|  |-- infrastructure.yml     # 인프라스트럭쳐를 구성한다.
|  \-- deploy.yml             # 애플리케이션을 배포한다.
|
\-- roles                     # 플레이북에 사용되는 롤들을 관리한다.
   |-- infrastructure
   |   \-- tasks
   |       \-- main.yml       # 인프라스트럭쳐 구성 task
   |
   \-- deploy
       \-- tasks
           \-- main.yml       # 배포작업 task
```

같은 형식으로 디렉토리를 구성해서 사용한다.

`playbooks/infrastructure.yml` 플레이북은 `infrastructure` `Role`을 호출하게 되고,
호스트들은 정의 된 `Task` 블록들로, 적절히 애플리케이션 배포를 위한 프로비저닝 작업이 진행된다.

`playbooks/deploy.yml` 플레이북은 적절히 애플리케이션을 배포하고 설정하는 로직을 갖는다.

### 새로운 배포환경으로 점진적으로 변경해 나가기

지금까지 구현 된 `Ansible` 자동화 프로젝트를 이용해서, 새로운 배포환경으로 애플리케이션을 점진적으로
업그레이드 해 나가기로 한다.

이 경우, 애플리케이션 배포 환경에 대한 `infrastructure` `Role`의 `Task`들을 모두 교체하게 된다면,
기존 운영환경의 부득이한 사정으로 새로운 배포환경으로 갈 수 없는 상태의 호스트는 해당 자동화 스크립트를
사용할 수 없게 된다.

그렇다면, 이전 가능한 호스트들만 새로운 롤을 적용해 보는건 어떨까?

이 경우에는 기존 인벤토리에서 이전할 호스트들을 새롭게 `Inventory Group`을 만들고,
해당 그룹을 위한 task들을 따로 할당해 주는 방법이 좋을 것 같다.

#### `Inventory` 나누기

먼저 이전할 호스트들을 선정하고 새로운 `Inventory Group`을 할당한다.

``` conf
# file: inventory

# 변경하기 전의 인벤토리의 webserver 그룹
[webservers]
region-app-[01:30].mysite.com
```

에서

``` conf
# file: inventory

[webservers]
region-app-[01:20].mysite.com

# 21 ~ 30번 까지의 호스트는 새로운 배포환경으로 가기로 하였다.
[webservers_v2]
region-app[21:30].mysite.com
```

#### 새로운 `Inventory Group`을 위한 `Task` 만들기

이제 새로운 호스트를 위한 `Task`를 만들고, `infrastructure` `Playbook`에 추가해 주어야 한다.

##### 방법 1. 호스트별 `Group` 네이밍으로 분기문을 만들어 Task 흐름 제어하기

새로운 배포방식을 적용할 Inventory Group이 정의 되었으니 기존 Role의 Task 코드를 수정한다.

아래는 기존의 `Task`를 그룹 분기문을 넣어, 프로비저닝 과정을 제어하는 과정에 대한 예시이다.

``` yaml
# file: roles/infrastructure/tasks/main.yml

# legacy tasks
- name: Update apt cache
  apt:
    update_cache: yes
  become: yes

- name: Install Nginx
  apt:
    name: nginx
  become: yes
...
```

기존 `Task`들을 `block`으로 감싸고 `group_name` 별로 분기하도록 변경해 본다.

``` yaml
# file: roles/infrastructure/tasks/main.yml

# legacy block
- block:
  - name: Update apt cache
    apt:
      update_cache: yes
    become: yes

  - name: Install Nginx
    apt:
      name: nginx
    become: yes
  when: inventory_hostname in group['webserver']

# new provisioning blocks
- block:
  - name: Install docker
    apt:
      name: docker.io
    become: yes
  when: inventory_hostname in group['webserver_v2']
...
```

이 경우 `Task` 블록들이 작고 간단한 경우는 쉽게 변경하고 전체 코드의 수정도 적어 편리하지만,
이런 방식으로 계속 유지보수를 하게 될 경우 복잡한 조건들로 인해 `Task`의 조작이 힘들어 질 수 있다.

> 애플리케이션 코드에서 깊은 단계의 `중첩 If 문`을 가진 코드를 만났다고 생각해 보자... ㅇ<-<

##### 방법 2. 새로운 `Inventory Group`에 대한 Play를 정의하기

`방법 1`에서 `Task`에 다른 컨텍스트를 끼워넣는 행위는 좋지 않은 것 같다고 생각한다. 그렇다면
새 `Inventory Group`에 대한 새로운 `Role`을 만들어 보는건 어떨까?

새로운 `Role`을 만들게 되면 `Playbook`의 코드를 수정해야 하긴 하지만, 기존 `Task` 코드의
수정이 발생해서 버그가 생길 여지를 만들거나, 유지보수가 어려워지는 문제는 피할 수 있을 것 같다.

그래서 새로운 `infrastructure_v2` 라는 새로운 Role을 만들고 `webserver_v2` 그룹이
새 Role을 적용하는 `Play`를 추가한다.

``` yaml
# file: playbooks/infrastructure.yml

- name: Prepare infrastructure
  hosts: webserver
  roles:
  - infrastructure

# 새로운 Role을 실행하는 Play를 추가한다.
- name: Prepare infrastructure_v2
  hosts: webserver_v2
  roles:
  - infrastructure_v2
```

이 경우는 `방법 1`에서 보다 훨씬 안전하게 자동화 코드들을 다룰 수 있게 된다는 점에서, 더 깔끔하다고 생각한다.
하지만, `Playbook`의 수정이 필요하고, 새로운 `Role`이 추가되는 문제를 계속 해결해야 한다.

새로운 그룹이 생길 때 마다, 전체 프로비저닝 흐름을 수정해 주어야만 한다.

#### `infrastructure` `Role`에 `include_task`로 태스크를 완전히 분리해서 관리하기

기존의 `Playbook`의 흐름과, `Role`의 태스크를 최대한 수정 없이 유지하면서 새로운 작업들을
끼워넣을 수 없을까 고민해 보다가, `전략 패턴`을 적용 해 보기로 했다.

`include_task` 모듈은, Playbook이 동작하는 시점에 필요한 `Task` 파일을 불러와서 작업을 진행할
수 있게 해 주는 모듈이다.

해당 모듈을 이용해서, 그룹별로 필요한 프로비저닝 방식을 선택해서 자동화 작업이 이루어 질 수 있게
변경해 본다.

##### 기존 inventory의 형상을 최대한 유지하면서, 새로운 그룹 만들기

``` conf
# file: inventory

# 위의 예제들에서는 webserver group이 일부 분리되었으나, 전략 패턴을 사용하면
# 기존 그룹을 그대로 유지할 수 있다.
[webservers]
region-app-[01:30].mysite.com

# 새로운 프로비저닝 방식을 적용하기 위한 서버들은 별도의 그룹이 정의되어야 한다.
# 21 ~ 30번 까지의 호스트는 새로운 배포환경으로 가기로 하였다.
[webservers_v2]
region-app[21:30].mysite.com

# `infrastructure_version` 이라는 플래그를 정의하자
[webservers_v2:vars]
infrastructure_version=2
```

##### `Role`이 버전 플래그를 이용해 프로비저닝 방식을 선택해서 동작하도록 만들기

앞서 말한 `방법 1`과 비슷하지만, 이번에는 파일단위로 로직을 나누어 관리할 수 있게 변경해 본다.

`infrastructure` `Role`의 레거시 태스크들을 `versions/v1.yml`로 옮기고,
새롭게 적용되어야 하는 작업들은 `versions/v2.yml`로 정의해 본다.

``` sh
$ tree roles
roles
|-- infrastructure
|   \-- tasks
|       \-- main.yml
|       \-- versions       # versions 디렉토리를 만들고,
|           |-- v1.yml     # legacy task는 이곳으로 옮긴다.
|           \-- v2.yml     # 새로운 프로비저닝 task는 여기에 정의한다.
|
\-- deploy
    \-- tasks
        \-- main.yml       # 배포작업 task
```

이제 `main.yml`에서 `infrastructure_version` 플래그를 이용해, 각 호스트에 적용 될
작업들을 선택할 수 있게 변경한다.

``` yaml
# file: roles/infrastructure/tasks/main.yml

- name: Resolve task by version
  include_tasks: "./versions/v{% raw %}{{ infrastructure_version }}{% endraw %}.yml"
```

이렇게 `inventory`에 특정 변수를 할당하여 태스크를 선택할 수 있게 만들게 되면,
`Playbook`의 흐름에 대해 코드를 수정할 필요가 없고, `Role`에 정의 된
기존 `Task` 코드들을 해치지 않으면서 수정이 필요한 부분에만 변경을 할 수 있게 코드가 구성될 수 있다.

`Inventory`의 형상에 대해서도 기존 형상을 최대한 유지하면서, 필요한 부분만 추가해 나갈 수 있는
안정성과 확장성이 보장된다고 생각한다.

## 결론

`Infrastructure as Code` 분야에서 다양한 도구들이 나오고, 각자 적절한 언어를 선택하여 `DSL`을
지원하고 있다. 비록 소프트웨어 개발언어만큼 유연하고, 복잡하게 구현할 수 있는 자유도는 적지만
프로그래밍 언어에서의 소프트웨어 공학적인 개념을 잘 이용하면 충분히 확장 가능하고 지속 가능한 자동화
코드를 만들 수 있는 것 같다.
