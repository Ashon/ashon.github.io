---
layout: post
title: Ansible에 대한 간단한 정리
date: 2017-09-09 15:06:00 +0900
excerpt: IT 인프라 자동화 도구 중 하나인 Ansible의 기능을 간단하게 알아본다.
comments: true
toc: true
tags:
- DevOps
- Ansible
---


IT 인프라 자동화 도구 중 하나인 Ansible을 간단히 소개한다. 내용의 앤서블에는 호스트를 코드로 정의하고
자동화해서 다루기 위한 많은 개념들이 있는데, 각 개념들에 대한 간단한 정보들을 알아본다.

문서에서는 각 개념별로 내용의 깊이가 제각각이고 생략된 내용들도 있으므로 이 문서 이후의
자세한 내용은 공식 문서를 찾아보는것이 좋다.

## Ansible

Provisioning, Configuration Management, Continuous Delivery, Orchestration 등의 작업들을 위한 자동화 도구.

## 다른 자동화 도구들

- Chef : <https://www.chef.io/chef/>, <https://github.com/chef>
- Puppet : <https://puppet.com/>, <https://github.com/puppetlabs>
- CF Engine : <https://cfengine.com/>, <https://github.com/cfengine>
- Saltstack : <https://saltstack.com/>, <https://github.com/saltstack>

## 다른 도구들과의 비교

| - | Ansible | Chef | Puppet | CF Engine | Saltstack |
|-----------|------------|--------------|--------------|--------------|--------------|
| 동작 방식   | push (ssh) | pull (agent) | pull (agent) | pull (agent) | pull (agent) |
| 리소스 정의  | YAML      | DSL          | DSL          | DSL          | DSL          |
| GitHub ⭐️ | 24K        | 4K           | 4K           | 0.2K         | 8K           |

## Ansible이 다른 도구들보다 좋은 점

- 다른 자동화도구들 DSL 배울 시간이 없다. (따로 배우기 귀찮고.. 복잡함..)
- Master/Agent 방식의 자동화 도구는 별도의 프로비저닝이 필요하다.
  (만약 기존에 없었다면, 모두 배포해 줘야하는 고통..)
- 타겟 서버가 SSH 프로토콜만 열려있으면 가능하다.
- 구조가 단순하고 유연하기 때문에 다른 시스템과 엮기 쉽다.
- 파이썬이라 좋다...

## 다른 도구들보다 안 좋은 점

- Push 방식이라. 마스터가 타겟 서버들 하나씩 돌면서 처리해야함. (어느정도 컨커런시를 보장하긴 하지만.)
- 서비스가 아니라 정말로 도구이기 때문에, 변경사항 탐지나.. 뭐 그런 작업들이 필요하다면 별도로 개발해야 함.
  (이미 python 라이브러리도 있고, 젠킨스같은 자동화 도구에 이미 플러그인들이 있어서, 클릭 몇번만 하면 되긴 함.)
- 단순한 만큼, 자동화를 위해 챙겨줘야 할 부분들이 좀 있음. (하지만 역시 유연함)

## Ansible 동작 방식

아래와 같은 서비스 구조가 있다고 하자.

![fig1](/assets/2017-09-09/fig1.png)
<center>< figure 1. master 서버가 3대의 웹서버 호스트에 ssh로 명령을 내리는 모습 ></center>

### inventory

앤서블에서 타겟 호스트들을 정의하는 파일

#### host_vars

각각의 호스트마다 변수를 할당해서 사용할 수 있게 해 주는 기능

``` conf
# file: inventory
webserver1 my_var=1
:
```

처럼 직접 inventory에 입력할 수도 있고,

``` sh
$ tree
.
├── inventory
└── host_vars
    └── webserver1
```

inventory파일과 같은 레벨에 host_vars디렉토리, 그 하위에 webserver1 라는 호스트와 매치되는 파일명으로 yaml형식으로 변수를 선언할 수도 있음.

``` yaml
# file: host_vars/webserver1

---
my_var: 1
my_list:
  - "hello"
  - "world"

```

#### 변수 접근

jinja2 문법을 이용해서, 선언한 변수에 접근이 가능하다.

``` sh
# 타겟 서버에서 할당한 변수를 echo하는 명령어

$ ansible all -l webserver1 -m shell -a "echo {{ my_var }}"
webserver1 | SUCCESS | rc=0 >>
1

$ ansible all -l webserver1 -m shell -a "echo {{ my_list[0] }} {{ my_list[1] }}"
webserver1 | SUCCESS | rc=0 >>
hello world
```

#### group_vars

그룹에서 공통으로 사용할 수 있는 변수를 관리할 수 있음.
host_vars와 비슷한 형식으로 group_vars/[그룹명] 식으로 yaml파일을 만들어서 관리 가능

#### 더 알아보기 - Dynamic inventory

Dynamic inventory는 inventory를 실행 가능한 프로그램으로 만들어, 동적으로 인벤토리 정보를 참조할 수 있도록 하는 스크립트다.

- DB에서 값을 읽어서 인벤토리를 구성한다거나..
- AWS같은 플랫폼에서 제공하는 API를 이용해서 인스턴스 목록들을 동적으로 가져와서 인벤토리로 사용한다거나..

이런 일들을 할 수 있음.

ref: <http://docs.ansible.com/ansible/latest/intro_dynamic_inventory.html>

### module

앤서블에는 타겟 호스트로 실제 작업을 처리하는 단위로 module이라는 개념을 사용한다.

apt-get yum sysctl systemd file copy git docker_container ... 등
엄청 많은 모듈들이 있음. (문서를 찾아서 하나씩 만들면 된다.)

webservers 그룹에 ping을 날려보기

``` sh
# -i: inventory file
      ansible의 기본 설정에서는 인벤토리가 /etc/ansible/hosts라는 파일을 보기 때문에,
      따로 인벤토리를 지정해 주어야 한다.
      http://docs.ansible.com/ansible/latest/intro_configuration.html#inventory

# -m: module 이름

$ ansible -i inventory webservers -m ping
webserver1 | SUCCESS => {
    "changed": false,
    "ping": "pong"
}
webserver2 | SUCCESS => {
    "changed": false,
    "ping": "pong"
}
webserver3 | SUCCESS => {
    "changed": false,
    "ping": "pong"
}
```

webservers 그룹 중 webserver1에만 ping 날려 보기

``` sh
# -l: limit

$ ansible -i inventory webservers -l webserver1 -m ping
webserver1 | SUCCESS => {
    "changed": false,
    "ping": "pong"
}
shell 모듈로 타겟 서버들에 명령어 한번에 실행시켜 보기

# -a: arguments

$ ansible -i inventory all -m shell -a "cat /etc/hostname"
webserver1 | SUCCESS | rc=0 >>
webserver1

webserver2 | SUCCESS | rc=0 >>
webserver2

webserver3 | SUCCESS | rc=0 >>
webserver3
```

#### Dry-run

실제로 환경에 적용하기 전에 변경사항들을 체크할 수 있다.

``` sh
# --check: dry-run

$ ansible -i inventory all -m service -a "name=nginx state=restarted" --check
:
```

### Playbook

여러 모듈(작업)들을 모아서 하나의 큰 역할을 수행할 수 있도록 해 주는 기능

``` yaml
# file: webserver.yml

---
- name: 웹서버에 필요한 태스크를 수행합니다.
  hosts:
    - webservers
  tasks:
    - name: nginx 웹서버를 설치합니다.
      apt: name=nginx update_cache=yes

      # 마지막에 "apt: name=nginx update_cache=yes" 라고 적혀있는 부분은
      # 아래 형식으로 작성해도 됨.

      apt:
        name: nginx
        update_cache: yes
```

#### Templating

ansible에서는 동작을 정의하는 yaml을 좀 더 유연하게 사용할 수 있도록, jinja2 template 문법으로 템플릿 형식으로도 작성할 수 있음.

템플릿을 렌더링 할 때 ansible에서 기본적으로 사용되는 predefined context 변수들이 있는데,
이 부분이 좀 불투명해서, 처음에 사용하기는 좀 까다로울 수 있음.

terraform의 interpolation과 비슷한 방식임.

#### example.1 with_items

tasks에서 사용되는 하나의 아이템(모듈)과 더불어, template기능을 활용한 특별한 기능들 중에.. with_items라는 key로 리스트를 작성하면, loop 기능을 사용할 수 있음.

아래는 파이썬 개발환경을 구성하는데 사용하는 playbook

``` yaml
# file: python-development-env.yml

---
- name: 파이썬 개발환경을 구성합니다.
  hosts: localhost
  tasks:
    - name: Aptitude로 pythond-dev, pip등의 패키지를 설치합니다.
      apt: name={{ item }} update_cache=yes
      with_items:
        - python-dev
        - python-pip
        - virtualenv
        - pylint
        - flake8

    - name: pip로 웹서버 프레임워크들을 설치합니다.
      pip: name={{ item }}
      with_items:
        - django
        - flask

    - name: pip로 파이썬 테스팅 도구들을 설치합니다.
      pip: name={{ item }}
      with_items:
        - pudb
        - nose
        - line_profiler
        - memory_profiler
```

### Role

여러 플레이북에서 공통으로 사용할 수 있는 task 묶음들을 Role 이라는 개념으로 묶어서 사용할 수 있다.

#### Role 만들어 보기

ansible role은 정해진 디렉토리 구조를 따라야 한다.

``` sh
$ tree
.
└── roles # roles라는 디렉토리 안에 role들을 정의할 수 있다.
    └── nginx # role의 이름 (nginx
        │
        │   # 해당 role에서 실제 수행하는 task
        ├── tasks
        │   └── main.yml
        │
        │   # 해당 role에서 사용하는 파일을 보관하는 디렉토리
        ├── files
        │
        │   # 해당 role에서 사용하는 jinja2 템플릿 파일을 보관하는 디렉토리
        └── templates
```

#### Role 사용하기

playbook안에서 롤을 사용할 때는 아래와 같이 사용할 수 있음.

``` yaml
# file: nginx.yml

---
- name: install nginx
  hosts:
    - all
  become: yes
  roles:
    - nginx
```

### Galaxy

사용자들이 사용하는 playbook들을 공유할 수 있는 기능. (docker hub 같은 느낌)
제너럴하게 사용할 수 있는 playbook들을 사용자들끼리 공유할 수 있음.
npm의 package.json 처럼 의존성 관리를 requirements.txt로 관리할 수 있음.

#### requirements.yml

``` yaml
# file: requirements.yml

---
# from galaxy
- src: yatesr.timezone

# from GitHub
- src: https://github.com/bennojoy/nginx

# from GitHub, overriding the name and specifying a specific tag
- src: https://github.com/bennojoy/nginx
  version: master
  name: nginx_role
```

#### requirements.yml에서 playbook 의존성 설치

``` sh
$ ansible-galaxy install -r requirements.yml
```

## 사용 패턴

### 기본

![fig2](/assets/2017-09-09/fig2.png)
<center>< figure 2. master 서버가 타겟 호스트에 ssh로 명령을 내리는 모습 ></center>

예제로 사용되었던 기본적인 구성.

### 로컬 프로비저닝

![fig3](/assets/2017-09-09/fig3.png)
<center>< figure 3. ansible로 로컬호스트를 대상으로 프로비저닝 작업이 처리되는 모습 ></center>

ssh를 사용할 수 없는 환경에서는 이런 식으로도 사용할 수 있음.
-c local 옵션으로 ssh를 사용하지 않고, 바로 ansible playbook을 사용할 수 있음.

``` sh
$ ansible all -c local -m ping
```

또는

``` sh
$ ansible-playbook -c local ping.yml
```

### ssh 프록시를 통한 타겟서버 프로비저닝

![fig4](/assets/2017-09-09/fig4.png)
<center>< figure 4. ssh proxy 서버들을 통해 타겟 서버로 접근하는 모습 ></center>

ssh proxy 설정을 통해 타겟 서버들로 접근할 수 있다.
이것을 이용해서 ansible 명령도 내릴 수 있다.
아래는 프록시 설정을 ansible에서 사용하기 위한 파일 예시

네트워크 보안을 위해 망분리된 환경에서 Bastion 서버를 통한 타겟 호스트로의 접근.

``` conf
# file: ssh_config

Host 172.16.*
  ProxyCommand ssh -W %h:%p user@bastion_a -i ~/.ssh/bastion_a_key.pem
  StrictHostKeyChecking no

Host 172.17.*
  ProxyCommand ssh -W %h:%p user@bastion_b -i ~/.ssh/bastion_b_key.pem
  StrictHostKeyChecking no
```

``` conf
# file: ansible.cfg

[ssh_connection]
ssh_args = -F ./ssh.cfg -o ControlMaster=auto -o ControlPersist=30m -o ForwardAgent=yes
control_path = ~/.ssh/ansible-%%r@%%h:%%p
```

### 여러 프로비저닝 노드를 이용하는 방법

![fig5](/assets/2017-09-09/fig5.png)
<center>< figure 5. 프로비저닝을 위한 슬레이브 워커들을 통해 분산처리 되는 모습 ></center>

jenkins같은 태스크 자동화 도구를 이용해서 여러 프로비저닝 슬레이브 노드들을 두고,
대규모의 타겟 서버들에 분산해서 프로비저닝을 진행할 수 있음.

많은 수의 타겟 서버들을 다룰 때 쓰면 좋겠지만,
관리하는 서버들이 100대 이상 아니면 굳이 필요가 없다고 생각함.

## References

- Sysadmin Study Google Group wiki - <http://wiki.tunelinux.pe.kr/display/sysadmin/Ansible>
- Puppet mini seminar - 2015.10.14 - <http://wiki.tunelinux.pe.kr/display/sysadmin/Puppet+mini+seminar+-+2015.10.14>
- GitHub Ansible Examples - <https://github.com/ansible/ansible-examples>
- Ansible Module Index - <http://docs.ansible.com/ansible/latest/list_of_all_modules.html>
- Ansible Galaxy doc. - <http://docs.ansible.com/ansible/latest/galaxy.html>
- Ansible Configuration File - <http://docs.ansible.com/ansible/latest/intro_configuration.html>
- Ansible Dynamic Inventory - <http://docs.ansible.com/ansible/latest/intro_dynamic_inventory.html>
