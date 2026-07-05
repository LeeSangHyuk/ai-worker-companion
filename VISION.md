# AI Worker Companion

## 프로젝트 배경

최근 OpenCode, Codex, Claude Code 등의 AI 코딩 에이전트를 실제 업무와 개인 프로젝트에 활용하면서 공통적인 현상을 발견했다.

AI는 충분한 지식과 코딩 능력을 가지고 있음에도 불구하고 종종 숙련된 엔지니어처럼 행동하지 못한다.

대표적인 사례는 다음과 같다.

* Tool 응답이 비정상적으로 느려져도 무한히 대기한다.
* 동일한 실패를 반복한다.
* 원래 목표를 잊고 세부 구현에 과도하게 몰입한다.
* 현재 환경의 이상 징후를 인식하지 못한다.
* 진행 상황을 스스로 점검하지 못한다.

흥미로운 점은 이러한 문제들이 지능 부족에서 발생하는 것처럼 보이지 않는다는 것이다.

오히려 "현재 상황을 이해하고 판단하는 능력"의 부족에 가깝다.

---

## 문제 정의

현재 AI 에이전트 생태계는 다음 영역에서 빠르게 발전하고 있다.

* Knowledge Retrieval
* Memory
* RAG
* Tool Use
* Planning

하지만 실제 업무 환경에서 중요한 다음 영역은 아직 충분히 해결되지 않았다.

* Situation Awareness
* Experience Activation
* Goal Awareness
* Risk Awareness
* Mental Model Transparency

현재 대부분의 Agent Framework는

"무엇을 했는가"

는 잘 보여준다.

하지만

"왜 그렇게 행동했는가"

는 거의 보여주지 않는다.

사용자는 종종 다음과 같은 상태가 된다.

"지금 이 Agent가 뭘 하고 있는 거지?"

---

## 핵심 관찰

인간의 숙련도는 단순히 기억의 양에서 오지 않는다.

숙련된 엔지니어는 현재 상황을 보고 적절한 경험을 떠올린다.

예를 들어,

bash 명령이 비정상적으로 오래 걸릴 경우

신입은 단순히 기다린다.

반면 숙련된 엔지니어는

* 환경 문제
* 네트워크 문제
* 보안 프로그램
* 과거 유사 사례

등을 즉시 떠올리며 가설을 형성한다.

우리가 흔히 말하는 "감"은

과거 경험 네트워크의 동적 활성화에 가까울 수 있다.

---

## 가설

AI Agent의 신뢰성 문제는 지능 부족이 아니라

현재 세션 상태(Session State)의 비가시성에서 발생한다.

인간은 작업 중 다음 요소들을 지속적으로 유지한다.

* 현재 목표
* 현재 작업
* 현재 가설
* 현재 리스크
* 현재 우선순위
* 현재 막힌 지점

반면 Agent는 이러한 작업 상태를 사용자가 빠르게 판단할 수 있는 형태로 드러내지 않는다.

만약 Agent의 현재 세션 상태를 근거와 함께 추출할 수 있다면

사용자는 Agent를 더 쉽게 이해하고 신뢰할 수 있을 것이다.

---

## 비전

AI Worker Companion은

AI Agent의 행동 로그를 분석하여

현재 세션 상태(Session State)를 근거 기반으로 추출하고 보여주는 도구이다.

궁극적으로 다음 질문에 답하고자 한다.

* Agent는 현재 무엇을 목표로 하는가?
* Agent는 현재 어떤 상태에 있는가?
* Agent는 어떤 리스크를 인식하고 있는가?
* Agent는 어디에서 막혀 있는가?
* Agent는 목표에서 벗어나고 있는가?
* 사용자는 지금 어떻게 개입해야 하는가?

---

## V0 목표

Codex 또는 OpenCode 세션 로그를 입력받아

다음 정보를 추출한다.

* Current Goal
* Current State
* Blocker
* Risk
* Recommended Intervention

그리고 이를 사람이 이해하기 쉬운 형태로 보여준다.

---

## V0 범위

포함

* 로그 입력
* LLM 기반 Session State 추출
* JSON 결과 생성
* 간단한 UI 표시

제외

* OpenCode 플러그인
* MCP 연동
* 실시간 추적
* 자동 개입
* Experience Graph
* Multi-Agent 지원

---

## 성공 기준

사용자가 Agent 로그를 읽지 않아도

추출된 Session State만 보고

"아, 지금 Agent가 왜 이런 행동을 하는지 알겠다."

라고 느낄 수 있어야 한다.

---

## 장기 비전

V0는 단순한 로그 분석기이다.

하지만 장기적으로는

Mental Model Viewer

↓

Experience Activation Engine

↓

Goal Drift Detection

↓

Agent Supervisor

로 발전할 수 있다.

궁극적으로는

AI Agent가 인간의 숙련된 엔지니어처럼 상황을 이해하고 행동할 수 있도록 돕는 것을 목표로 한다.
