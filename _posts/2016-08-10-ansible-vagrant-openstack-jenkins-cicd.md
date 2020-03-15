---
layout: post
title: Vagrant, Openstack, Jenkins, Ansible을 활용한 서비스 통합 테스트를 위한 CI/CD 구축
date: 2016-08-10 13:35:00 +0900
excerpt: |
  복잡한 서비스 구성에 대한 통합 테스트를 여러 자동화 도구를 이용해
  효율적으로 개선해 나간 경험을 소개한다.
comments: true
category: blog
toc: true
tags:
- DevOps
- Ansible
- Vagrant
- Openstack
- Jenkins
- CI/CD
---

시간이 갈 수록 시스템 덩치가 커지고 복잡해 지면서 통합 테스팅 환경 구축이 힘들어지고 있음.

개발자는 실제 환경에 대한 이해 부족으로 통합 테스트 환경에서는 동작하지 않는 코드를 만들기도 하며,
QA는 반복되는 통합 테스트 환경을 구축하는데 많은 시간을 보내고,
Ops 에서는 복잡한 배포작업을 사람 손으로 거치다 보니,
잘못된 설정작업으로 인한 장애상황이 가끔씩 발생하기도 함.

이런 문제점을 극복하고자, Virtual Machine이나 Private Cloud를 이용해,
통합 시스템 환경에 대한 자동화 도구들을 찾아보고, 팀의 개발프로세스를 개선해 보고,
파일럿 프로젝트를 진행하면서 테스팅 환경을 구축한 내용을 공유하고자 한다.

## DevOps 도구들

### Vagrant

VM들에 대한 설정정보를 코드로 관리할 수 있게 해 주는 도구.
해당 도구에 대한 설명은 아래 링크에 자세하게 기술되어 있음.
Vagrant를 이용해 로컬환경에 여러 시스템들을 Orchestration할 수 있음.

- <https://www.vagrantup.com/> - Vagrant by HashiCorp
- <http://bcho.tistory.com/806> - Vagrant를 이용한 개발환경 관리(간단한 VM관리)

### Openstack

Private Cloud 솔루션. 이미 도입 중이므로 자세한 내용은 생략.
Openstack도 Vagrant와 흡사한 기능을 하는 Heat Template이라는
시스템이 있어 인스턴스들을 코드로 관리할 수 있다.

- <https://www.openstack.org/> - Openstack
- <https://wiki.openstack.org/wiki/Heat> - Heat

### Ansible

사용법이 다소 간단한 Service Orchestration, Provisioning 도구.
YAML을 사용. 자세한 내용은 아래 링크 참조.

- <http://docs.ansible.com/ansible/> - Ansible Documentation
- <http://deview.kr/2014/session?seq=15> - Deview 2014 : Understading Ansible

### Jenkins

유명한 CI 도구. UI를 지원해서 편리하게 사용 가능.
데브옵스 툴로도 사용할 수 있어서 Delivery Pipeline을 해당 툴로 구축하였음.

- <https://jenkins.io/> - Jenkins

## 기존의 개발 환경들 조사

반복되는 작업들을 자동화 시키기 위해서는 일단 현재 반영된 정책이나, 시스템을 조사해 볼 필요가 있었다.
크게 개발 프로세스에 대한 Task들과, 팀에서 담당하는 애플리케이션들의 서비스맵에 대한 이해가 필요했다.

## 서비스 프로젝트들과 개발 프로세스 정리하기

자동화에 앞서 현재 개발 프로세스나 운영환경에 대한 정리가 필요하였음.
아래는 포탈팀 개발 프로세스를 도식화 한 것. 실무적으로 주가 되는 Task들만 나열하였으며,
일부 빠진 부분이 있을 지도 모르니 참고할 것.

붉은 글씨로 쓰여진 부분이 실제 각 팀에서 주로 하는 반복적인 작업들이다.

![fig1](/assets/2016-08-10/fig1.png)
<center>< figure 1. 현재 개발팀의 Delivery Pipeline ></center>

## 구동환경에 대한 문제

현재 프로세스를 보면 여러 팀에서 수행하는 반복되는 작업들이 많고,
애플리케이션이 구동되는 환경이 제각각 다르다는 걸 알 수 있다.
(심지어 개발자의 로컬환경마저 다름.)

환경에 차이로 인해 발생하는 문제를 우리는 수도 없이 접했기 때문에 긴 말 하지 않도록 한다.
이 외에도 여러 문제점들이 있겠지만, 여기서 해결해 보고자 하는 문제점은
각각의 애플리케이션 구동환경에 대한 불일치 정도가 된다.

이런 현상에 대한 원인을 살펴보고 느낀 바로는 현재 크게 세가지로 정리해 보았다.

- 우리 시스템에는 구동환경에 대해 정리해 놓은 문서가 없고,
- 미세한 세팅에서 작업자들의 실수가 발생할 수 있고,
- 복잡한 설정의 경우 해당 부분을 지나칠 수 있음.

## 반복되는 단순한 작업들

해당 다이어그램을 토대로 Action Table을 정리해 보고, 자동화 될 수 있는 Task들을 선택해 봄.

|Idx | Actions | Dev | QA | Ops | Can be automated? | Description |
|----|---------|-----|----|-----|-------------------|-------------|
| 1 | Change code | O | - | - | - | 코딩할 수 있는 AI가 있다면 몰라도... 아직은 개발자가 해야한다. |
| 2 | Commit to VCS | O | - | - | - | change code 이후에 올 수 있는 액션 |
| 3 | Setup infrastructure | O | O | O | O | 개발자와 QA는 매번 환경을 구성해 주어야 함. 오퍼레이터는 새로운 환경정보가 추가될 때 새롭게 구성해 주어야 한다.  |
| 4 | Build RPM | O | O | - | O | |
| 5 | Uplaod RPM to target system | O | O | O | O | |
| 6 | Install application | O | O | O | O | 5,6,7 세 개 항목은 실제 서비스에 올라가기 위해, Deploy Task를 거친다. |
| 7 | Configure application | O | O | O | O | |
| 8 | Manage daemons | O | O | O | O | |
| 9 | Manual testing | O | O | - | - | |
| 10 | Service operation | - | - | O | - | 자동화 될 수 있는 부분이 충분히 있겠지만, 논외이므로 생략한다. |

## 개발팀의 서비스 구성과, 외부 환경과의 연관성 조사

아래는 개발팀에서 관리하는 애플리케이션들에 대한 구조를 다이어그램으로 표현한 것.
팀의 프로젝트와 직접적으로 관련 된 애플리케이션 서비스들만 해당하는 정보이며,
프로젝트 이외의 애플리케이션은 제외되어 있거나, External API로만 묘사되어 있다.

선은 애플리케이션 단위든 컴포넌트 단위든 참조를 하고 있으면 서로 이어 놓은것임.
즉, Configuration 과정에서 실제 구동 전에 해 주어야 할 작업들이고,
실수로 인해 장애가 발생할 수 있는 지점들이다.

![fig2](/assets/2016-08-10/fig2.png)
<center>< figure 2. Project Service Map ></center>

다이어그램이 복잡하므로 설명을 하자면...

개발팀 애플리케이션 중 Project Service set이 구동되는 서버는 총 4대이고,
애플리케이션들이 각각 UI서버 2대, API서버 2대로 오케스트레이션 되어 있다.

이마저도 정확하지는 않겠지만, 조사한 내용을 토대로 테스트 인프라 자동화 작업을 진행하기로 함.

UI 서버군과 API 서버군은 로드 밸런서가 적용되어 Active - Standby 구조로 운영이 되고 있음.
로드밸런서까지 테스팅 환경을 확장시키면 더 정확하겠지만, 일단은 해당 Scope내에서 작업을 진행하기로 하였음.

로드밸런서로 Active환경만 운영한다고 가정을 하면 Active 그룹만 활성화 시키면 됨.
프로젝트 애플리케이션의 외부 환경 중 Robust하다고 판단되는 것들은 Default Configuration을 사용.
필요한 Parameter 몇개만 인프라 자동화 코드로 작성하기로 함.

## 물리 환경을 가상 환경으로 전환하기

여러 문제들이 있었지만, 이런 문제들을 처리하기 위해서는 가장 먼저 시스템에 대한 통합이 필요하다고 생각했다.
개발자들의 로컬 테스트 환경부터 바로잡지 않으면, 빠른 대처가 힘들기 때문.
(보통 QA단계로 넘어가 통합 테스트를 수행할 때 발견되고, 문제를 처리하기 위해 드는 커뮤니케이션 코스트가 많아진다고 느꼈다..)

그래서 figure1에서 표현된 팀 내 시스템에 대한 통합을 코드로 정리하기로 하였음.

### Vagrant를 이용한 개발단계 서버형상 가상화

로컬 환경에 매번 VM들을 올렸다 내렸다 하는 반복작업을 최대한 줄이기 위해 Vagrant를 사용하였음.
아래는 개발팀 로컬환경에 VM을 올리기 위한 각 서버들에 대한 가상화 스크립트임.

Openstack환경과 사용하는 VM을 일치시키기 위해 Openstack에 올라가 있는 커스텀 이미지를 Export하였음.
네트워크 레벨까지 가상화 할 수 는 없었지만.. 애플리케이션 서버단 까지만 코드로 관리를 해도 충분히 시간을 절약할 수 있음.

### Openstack Heat를 이용한 통합 테스트 환경(Dev, QA)의 형상 가상화

Local환경에서는 Vagrant로 서버 가상화를 하였고, Openstack으로까지 확장이 가능해야 했음.
Openstack에 서버를 구동시키는 작업도 시간이 필요하고, 몇가지 귀찮은 작업들이 많음.

이런 서비스 스택을 코드로 관리하기 위해 Heat Template을 사용함.

### 실제 환경은?

여기에 대해서는 아직 시도해 본 바가 없다.
뭐 Openstack을 실 서비스로까지 확장을 한다면, 현재 사용하는 Heat로도 충분히 커버가 될 것이라 생각함.

그리고 현재는 물리서버를 사용 중이므로 가상화가 필요 없음.

## Ansible을 이용한 서버 프로비저닝과 오케스트레이션 작업

이제 세팅 된 서버들에 `figure 2` 로 정리한 팀의 Service map들에 대한
오케스트레이션과 프로비전에 대한 작업들을 코드로 정리해야 했다.

Ansible에 대한 사용법에 대한 소개는 이번 문서에서는 생략하도록 하고,
각 환경에 대한 디렉토리 구조나 구현 된 `Inventory`, `Role`, `Playbook` 구성에 대한 소개 정도만 한다.
정리가 필요한 시점이 오긴 했지만, 지금 현재상태를 간단히 정리해서 공유해 본다.

디자인 컨셉은 각 운영 환경을 따로 관리할 수 있도록 environment라는 디렉토리를 만들어
내부에서 각 환경들에 대한 config정보들을 관리하고,

각 환경에서 수행하는 Task는 공유할 수 있도록 하는데 중점을 두었다.

``` sh
.
│   # 해당 디렉토리 내에서 사용 할 ansible config파일
├── ansible.cfg
│
│   # 환경을 구분해서 사용하게 되면 ansible명령어에 추가 argument들을 지정해 주어야 하는데
│   # 이런 부분을 완화하고자 shell script를 하나 만들었음..
│   # usage: ./apl [envname] [playbook-file]
├── apl
│
│   # 프로젝트의 서비스에 설치되는 애플리케이션들을 설치하는 playbook
├── application.yml
│
│   # SSL 인증서를 설치하는 playbook
├── certificates.yml
│
│   # 설치된 application들에 대한 configuration을 수행하는 playbook
├── config_application.yml
│
│   # celery job worker를 configure하는 playbook
├── config_celery.yml
│
│   # memcached 설정, redis 설정, apache vhost를 설정하는 playbook
├── config_memcached.yml
├── config_redis.yml
├── config_vhosts.yml
│
│   # Stage를 구분하여 각 환경들에 맞는 configuration정보들이 저장되어 있음.
│   # 버전 별로 분리 된 테스팅 환경을 구축할 수 있도록 구조를 잡음.
├── environments
│   ├── ci-2_8_43    # 2.8.43 버전에 대한 CI환경
│   ├── mitaka       # Openstack Migration 테스트를 위한 환경정보
│   ├── openstack    # 현재 Openstack에 올라간 dev integration 환경
│   ├── qa_env       # qa 환경
│   └── vagrant      # 로컬에 정의된 vm 환경
│
│   # VM환경에 DNS까지 확장을 시키지 않아 domainname을 /etc/hosts에 등록하게 하는 playbook
├── hosts.yml
│
│   # application을 구동하기 전에 각 서버 인프라를 프로비저닝 하는 playbook
├── infrastructure.yml
│
│   # 필요한 경우 ssh key를 등록하는 playbook
├── insert_key.yml
│
├── keys # 각 환경에 접근하기 위한 ssh key directory
│   ├── deploy
│   ├── inf-openstack-key
│   └── inf-openstack-key.pub
│
│   # ping을 때려봄
├── ping.yml
│
│   # 위에서 정의한 configuration 과정을 거치고 서비스를 리스타트 하는 playbook
├── provision.yml
│
├── README.md
│
│   # inventory에 정의된 redis 그룹에 redis를 설치하는 playbook
├── redis.yml
│
│   # ansible host에서 가지고 있는 RPM을 각 서버로 릴리즈하는 playbook
├── release.yml
│
│   # 서비스들을 restart하는 playbook
├── restart.yml
│
│   # playbook에서 사용하기 위해 정의한 role
│   # provision과 configuration을 제대로 정리하지 않아 다소 어지러운 감이 있긴 하지만...
│   # (뭐 나는 이렇게 사용했음.. 지금 보면 role단위로 쪼개는 것이 더 유연할 것 같기도 함.)
├── roles
│   ├── install_api
│   ├── install_pkgs
│   ├── install_redis
│   ├── install_ui
│   ├── prov_api_memcached
│   ├── prov_api_vhosts
│   ├── prov_redis
│   ├── prov_redis_sentinel
│   ├── prov_ui_celery
│   ├── prov_ui_cfg
│   └── prov_ui_vhosts
│
│   # 서버들의 상태를 점검해서 start시키는 playbook
├── service.yml
│
│   # 오케스트레이션부터 서비스 스타트까지 한번에 구동되는 playbook
└── up.yml
```

## 도입 전/후 비교

프로젝트 서비스를 구동하는데 드는 작업들에 대한 Before - After를 정리 해 보았다.

### 도입 전

`figure 1`에서 언급한

- Setup infrastructure
- Install application
- Manage daemons

등의 작업들을 각 서버마다 수동으로 해 주어야 했음.

### 도입 후

- 사용자는 제공된 `Vagrantfile`이나 `Heat Template`으로 `VM Instance`들을 구동시킨다.
- ansible로 구동하기 위해 environment에 대한 코드를 작성.
  (처음부터 한다면 다소 시간이 걸릴 수 있으나, 기존에 정의된 environment를 복사해서 편집하면 된다.)
- 서비스를 올리는 `up.yml` Playbook을 실행함.

크게 3단계로 시간을 매우 단축시킬 수 있었음.

### 한계점들

현재 구현된 코드들을 Live로까지 확장 시키기 위해서는 해결해야 할 몇가지 과제들이 있음. (보안문제 등..)
Ansible Playbook은 Local환경을 대상으로 provision이 가능하기 때문에 배포때 수행하는 Task를
playbook으로 정의하는 방법도 좋을 것 같음.

## Jenkins를 이용한 배포 파이프라인

인프라 자동화가 Stable한 단계로 접어들면서 Jenkins를 사용해 Delivery Pipeline을 만들어 보기로 함.
Dev나 QA가 주로 하는 Task들을 Jenkins Job으로 구현하는 작업을 진행하였음.

크게 4단계로 나누어 보고, 각 단계 별 자동화된 Task를 만들어 Pipeline을 만들어 보기로 함.

유닛 테스트
빌드
Integration 환경으로 배포
인수 테스트(Acceptance Test)
때마침 Jenkins 2.x버전이 릴리즈 되면서 파이프라인에 대한 기능이 보강되어, 이것을 사용하기로 결정.

## 배포 자동화를 위한 Git 브랜칭 전략 수정

일단 CI를 위해서는 현재 개발팀에서 운영하는 브랜칭 방식을 변경 할 필요가 있었음.

하나의 굵은 브랜치에 작은 피쳐들을 합쳐 나가는 git-flow방식은 CI에 적합하지 않다고 판단하였음.
비슷한 내용의 Topic이 이미 오래전에 온라인 상에서 논의되었고
([link](https://groups.google.com/forum/#!topic/gitflow-users/1Cu8ml4opoQ>)),

나도 당시에 비슷한 생각을 가지고 있었으므로, 좀 더 유연한 브랜칭 전략을 가져가기로 팀원들과 논의하였다.
브랜칭 전략에 대한 자세한 내용은 아래 링크로 대신한다.

- [git workflows(7)](https://www.kernel.org/pub/software/scm/git/docs/gitworkflows.html)
- [slideshare: git workflows(7) illustrated](http://www.slideshare.net/ktateish/the-gitworkflows7-illustrated?qid=ec8eb5a5-3233-453b-be03-56056b09d287&v=&b=&from_search=1)

## 배포 파이프라인 톺아보기

### Jenkins Pipeline Job

Jenkins 2.x 에서는 Pipeline Job을 만들기 위한 DSL이 존재한다. (Groovy 문법을 사용해야 함)
다행히 Code Snippet을 지원해서 편리하게 만들 수 있었다.

Pipeline Job을 생성할 때, 내부에다 각 Task의 Detail한 내용을 적을 수도 있지만,
확장을 고려해서 각 단계별 Task를 별도의 Jenkins Job으로 정의하고
Pipeline에서는 정의한 Job을 빌드하도록 구현하였다.

``` groovy

// pipeline job에서 사용할 parameter들을 정의한다.
// 해당 Job Build에 사용되는 변수들을 할당해 주는 부분.
branchName = "${BRANCH_NAME}"
targetEnviron = "${ENVIRON}"

pipeline {
  stages {
    // Unit Test Stage
    stage('Test - unit test') {
      steps {
        // 'TEST-project-ui1-UNITTEST' 라는 Job을 실행한다.
        build job: 'TEST-project-ui1-UNITTEST', parameters: [
          [$class: 'StringParameterValue', name: 'BRANCH_NAME', value: branchName]
        ], propagate: false
      }
    }

    // Build Stage
    stage('Build') {
      steps {
        build job: 'BUILD-project-ui1', parameters: [
          [$class: 'StringParameterValue', name: 'BRANCH_NAME', value: branchName]
        ]
      }
    }

    // Provision Stage
    stage('Provision') {
      steps {
        build job: 'PROVISION-project-ui1', parameters: [
          [$class: 'StringParameterValue', name: 'ENVIRON', value: targetEnviron]
        ]

        // Provision Job이 끝난 후 Cooldown을 위해 1초 sleep
        sleep 1
      }
    }

    // Integration환경에 Provision이 끝나면, 해당 환경을 타겟으로
    // Acceptance test를 수행한다.
    stage('Test - scenario test') {
      steps {
        // selenium test는 시간이 오래 걸리므로 parallel하게 수행되도록 test job들을 구성하였다.
        parallel(feature_a: {
          build job: 'TEST-project-ui1-SELENIUM', parameters: [
              [$class: 'StringParameterValue', name: 'BRANCH_NAME', value: branchName],
              [$class: 'StringParameterValue', name: 'COMPONENT_NAME', value: 'app/feature_b']
            ], propagate: false
          }, feature_b: {
            build job: 'TEST-project-ui1-SELENIUM', parameters: [
              [$class: 'StringParameterValue', name: 'BRANCH_NAME', value: branchName],
              [$class: 'StringParameterValue', name: 'COMPONENT_NAME', value: 'app/feature_b']
            ], propagate: false
          }
          // :
          , feature_z: {
            build job: 'TEST-project-ui1-SELENIUM', parameters: [
              [$class: 'StringParameterValue', name: 'BRANCH_NAME', value: 'app/feature_z']
            ], propagate: false
          },
          failFast: true|false)
        }
      }
    }
  }
}
```

### Ansible with Jenkins

Jenkins에는 Ansible Plugin이 있어서, Ansible의 주요 기능들을
Jenkins Job으로 쉽게 만들 수 있도록 지원해 주고 있다.

Provision 단계에서 Ansible Plugin을 이용해 Job을 생성하려고 했지만,
기존에 구현된 몇가지 제약사항으로 오히려 쓰기 힘들어져서,
나는 그냥 shell로 ansible을 구동하는 방향으로 작업을 진행했다.

### 프론트엔드 통합테스트 자동화를 위한 Selenium Grid와 Jenkins 구성

개발팀 에서는 Acceptance Test 툴로 Selenium을 사용하고 있는데,
Provision Job 이후 Acceptance Test 자동화를 위해
Jenkins에 Selenium Plugin을 이용해 Jenkins Slave Node에
Selenium grid node를 구동할 수 있도록 세팅해 주었다.

실제 세팅을 하기 위해서는 굉장히 많은 문제들을 만나게 되는데,
버그가 많고 추적하기까지 큰 노력이 들었으므로, 추천하지 않는다.
(그냥 selenium grid를 따로 구축해서 쓰는것을 추천한다.)

### Webhooks

CI CD(for testing) 을 좀 더 편하게 핸들링 하기 위해 Gitlab과 Jenkins를 webhook을 이용해 엮어 놓았다.
Feature들을 통합하는 CI브랜치가 main repo에 푸시되면 파이프라인 잡이 가동되는 형태로 구성했음.

1. 개발자가 feature 브랜치들을 통합해 CI브랜치를 만들고 Gitlab의 Main Repository에 push를 하면,
2. Gitlab에서 push event를 받아 Jenkins로 Pipeline을 가동.
3. Jenkins에서는 CI Branch를 Pull 해서
    - Unit test를 수행하고
    - 패키지를 Build
    - Integration환경으로 Provision
    - 이후 Integration 환경을 타겟으로 Acceptance Test를 수행

크게 세 단계로 작업이 진행되게 된다.

### Slack 확장을 이용한 빌드 알림 구성

파이프라인에서 실행되는 Job들의 결과를 Slack으로 받아보기 위해
Slack integration을 달아서 언제든지 Build Status를 확인 가능하도록 하였음.

### 개발 팀 내부에서도 Jenkins와 Ansible를 이용해 배포 테스트를 한다

어쨌든 팀의 CI를 위한 테스트 서비스를 구축하는데도 Ansible을 사용하였다.
개발팀의 Jenkins 빌드서버에 대한 인프라정보, 테스팅을 위한 인프라 정보들이 코드로 정리되어 있음.

## 결론

### 변경된 개발 프로세스

아무튼 저 위의 작업들을 진행한 이후
변경된 개발팀 개발 프로세스를 다이어그램으로 정리해 보았다.

![fig3](/assets/2016-08-10/fig3.png)
<center>< figure 3. 도입 이후 변경 된 개발 프로세스 ></center>

`figure 1`에서 정리했던 작업들이 일부 자동화되고 통일되면서 더 안정성 있게 변경되었고, 더 빠르게 처리할 수 있게 되었다.
남는 시간을 활용해 서로 다른 버전들에 대한 테스트 환경을 빠르게 구축할 수 있었음..

하지만 CI 환경을 누군가는 계속 관리를 해 주어야 하고, 인프라에 대한 코드들도 꾸준히 관리 해 줄 필요도 있었다.

개인적인 생각인데 이런 부분들은 기존 개발자의 인식 ('나는 서비스 코드만 짜면 돼..' 등의 인식),
개발문화가 바뀌지 않으면 시스템을 유지하기가 쉽지 않을 것 같다는 생각이 들었다.

### 자동화 이전에 고려해야 할 것들

작업을 진행하면서 먼저 생각했으면 좋았을 것 같은 준비물들을 정리해 보았음.

- 기존 작업흐름을 깊이 파악해 볼 필요가 있음. (팀 단위를 떠나서 개개인에 대해서도.. 개발자의 인식이 중요하다고 생각하는 이유)
- 자동화 자체로 하나의 일이 될 수 있기 때문에, 기존 수동으로 해 주던 작업들이 자동화 되었다고 해서
  완전히 손 놓을수는 없었다. 자동화 할 작업들을 잘 선별해야 할 필요가 있다.
- CI를 위해서 브랜칭 전략을 바꿔야 할 필요도 있다.
- 테스트 자동화를 위해 사용중인 테스팅 툴들에 대한 점검이 필요함.

물론 이 밖에도 고려해야 할 것들이 많을듯.

### 적용 이후 생겨난 몇가지 작업들. (더 고민해 볼 문제들)

물론 적용 이후 생겨난 과제들도 많다.

- 인프라 환경에 대한 정리작업을 개발자가 계속 해 주어야 한다.
- 언젠가는 stable한 단계로 접어들겠지만, 시간이 많이 걸리는 작업이기 때문에 신경을 계속 써 주어야 한다.
- Live Stage까지는 CD적용이 힘든 상황... CM Task를 일부 자동화 시키기 위한 방안이 필요함.
- 각 팀간에 공유해야하는 영역이 생기게 되었고, 충돌이 날 수 있는 부분이 생기게 되었다.
  - 이 부분을 해소하기 위해 팀을 분리하는게 좋을지는 생각해 보아야 함.
  - 개인적으로는 공유하는게 맞고, 팀으로 분리하는 것은 오히려 커뮤니케이션 코스트가 더 들 수 있다고 생각함.
    (뭐가 정답인지 모르겠음...ㅡ,.ㅡ)
- 기존에 Manual로 수행하던 일들이 Code로 관리 되면서, 수동으로 하던 작업들에 대한 Verification을 위해서는
  Dev, QA, Ops 모두 Code를 읽을 줄 알아야 함.

## 참고

- [Wikipedia : Infrastructure as code](https://en.wikipedia.org/wiki/Infrastructure_as_Code)
- [HashiCorp의 도 (The Tao of HashiCorp)](https://blog.outsider.ne.kr/1173)
- [Multistage environments with Ansible](http://rosstuck.com/multistage-environments-with-ansible/)
