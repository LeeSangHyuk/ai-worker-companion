# Session Viewer MVP

## 제품 철학

AI Agent는 긴 세션 동안 수많은 메시지, 판단, 명령, 결과를 생성한다. 사용자가 세션을 다시 이어받으려면 보통 raw log를 처음부터 훑어야 하지만, 이 방식은 느리고 피곤하며 맥락을 놓치기 쉽다.

Session Viewer는 raw log를 다시 읽는 대신, 현재 목표, 현재 상태, blocker, evidence를 한 화면에서 보여준다. 목표는 사용자가 “내 AI가 지금 무엇을 하고 있지?”를 빠르게 이해하고, 필요한 경우 바로 개입하거나 작업을 재개할 수 있게 돕는 것이다.

즉, 이 Viewer는 단순한 JSON Viewer가 아니라 AI 작업 상태를 읽기 위한 최소한의 Agent Workspace MVP다.

## 제품 포지션

현재 이름은 `Session Viewer`지만, 장기적으로는 `Agent Workspace` 또는 `Session Workspace`로 확장될 수 있다.

단계별 포지션은 다음과 같다.

| 단계 | 제품 포지션 | 설명 |
| --- | --- | --- |
| 현재 | Representation Viewer | 생성된 Session Representation을 사람이 읽기 좋게 보여준다. |
| 다음 | Agent Workspace | 여러 세션의 현재 목표, 상태, blocker, evidence를 작업 공간처럼 탐색한다. |
| 장기 | Session Supervision Layer | 반복 오류, 대기, 막힘, 목표 이탈 등을 감지하고 사용자 개입을 돕는다. |

중요한 점은 현재 구현이 아직 Session Supervision Layer가 아니라는 것이다. 지금 단계의 핵심은 “Representation이 제품 화면에서 실제로 읽히는가”를 확인하는 것이다.

## Viewer의 목적

Session Viewer MVP는 다음 질문에 답하기 위한 제품 실험이다.

> Representation Engine이 만든 결과를 제품 화면으로 보여줬을 때, 사용자는 raw log를 열지 않고도 세션을 빠르게 이해할 수 있는가?

Viewer가 보여줘야 하는 핵심 정보는 다음 네 가지다.

- Current Goal: 지금 AI Agent가 달성하려는 목표
- Current Situation: checkpoint 시점의 현재 상태
- Blocker: 진행을 막거나 판단이 필요한 요소
- Evidence: 이 Representation을 신뢰할 수 있는 근거

## 첫 화면 UX 방향

첫 화면은 단순한 session list가 아니라 “AI 작업 현황판”처럼 읽혀야 한다.

사용자가 목록을 보자마자 다음 질문에 답할 수 있어야 한다.

- 이 세션은 정상적으로 진행 중인가?
- 지금 목표는 무엇인가?
- 현재 어디까지 왔는가?
- 막힌 것이 있는가?
- 이 판단을 뒷받침하는 evidence가 충분한가?

따라서 세션 목록에는 다음 정보를 강조한다.

- Status badge
- Active Goal
- Current Situation 1줄 요약
- Blocker 여부
- Evidence count

## MVP 화면 구조

### Left Panel: Agent Sessions

왼쪽 패널은 여러 AI 세션의 현재 상태를 빠르게 훑어보기 위한 목록이다.

각 세션 카드에 표시할 정보:

- Status badge
- Conversation ID
- Active Goal
- Current Situation 1줄 요약
- Blocker 여부
- Evidence count

### Main Panel: Agent State

오른쪽 메인 패널은 선택된 세션의 현재 상태를 보여준다.

구성:

1. Agent Status Summary
   - Status badge
   - Current Goal
   - Current Situation
   - Blocker summary

2. Goal Stack
   - Primary Goal
   - Active Goal
   - Previous Goals

3. Current Situation
   - checkpoint 기준 현재 상황

4. Blocker
   - status
   - description
   - evidence ids

5. Evidence
   - 기본적으로 일부만 표시
   - 필요한 경우 `show more`로 확장

6. Resume Prompt
   - 선택된 세션의 현재 목표, 목표 흐름, 현재 상태, blocker, 핵심 evidence를 하나의 이어받기 프롬프트로 만든다.
   - 사용자는 `Copy Resume Prompt` 버튼으로 다른 AI Agent나 새 세션에 붙여넣을 수 있다.
   - Evidence는 최대 5개만 포함한다.
   - Viewer 출력에 포함되는 evidence는 민감정보 마스킹을 거친 값을 사용한다.

7. Progress Path
   - `previous_goals`, `active_goal`, `blocker`를 이용해 작업 흐름을 간단히 보여준다.
   - 실제 timestamp가 없으므로 시간순 타임라인처럼 보이게 과장하지 않는다.
   - 목적은 “어디서 시작했고 지금 어디에 있는가”를 빠르게 이해시키는 것이다.

## Status Badge v0 Rules

Status Badge는 supervision 판단이 아니다. Phase 0.5 Viewer에서 사용자가 빠르게 상태를 구분하기 위한 UX 표시다.

v0 규칙:

| 조건 | Badge |
| --- | --- |
| `blocker.status == "present"` | Blocked |
| `blocker.status == "unknown"` | Unknown |
| 아주 짧은 세션 | Low Context |
| `active_goal`이 비어 있고 짧은 세션 | Low Context |
| `blocker.status == "none_observed"`이고 `active_goal`이 존재 | Healthy |
| 위 조건에 명확히 해당하지 않음 | Unknown |

주의:

- `Healthy`는 “문제 없음이 증명됨”을 의미하지 않는다.
- `Blocked`는 Viewer 수준의 표시이며, 아직 자동 supervision signal이 아니다.
- `Low Context`는 extractor 성능 문제가 아니라 입력 자체가 짧거나 판단 근거가 부족하다는 뜻일 수 있다.
- 실제 Health Detector나 Session Supervision 판단과는 분리한다.

## Handoff / Resume UX

Session Viewer MVP의 다음 제품 가치는 “세션 이해”에서 “작업 이어받기”로 이어진다.

`Copy Resume Prompt` 기능은 이 방향을 검증하기 위한 최소 기능이다. 이 버튼은 선택된 Session State를 다음 형식의 프롬프트로 변환한다.

- Current Goal
- Primary Goal
- Previous Goals
- Current State
- Blocker
- Key Evidence
- 이어받기 지시문

이 기능은 새로운 AI 분석 기능이 아니다. 기존 representation JSON을 사람이 재사용하기 쉬운 텍스트로 포장하는 handoff/resume UX다.

`Progress Path` 역시 supervision 기능이 아니다. 오류를 자동 판단하거나 개입 필요성을 탐지하지 않는다. 단지 Goal Stack과 Blocker를 작업 흐름처럼 배열해서, 사용자가 “이 AI 작업을 어디서부터 이어가야 하는지” 더 빨리 이해하게 돕는다.

## 구현 범위

MVP 범위:

- Static local web app
- 기존 static HTML generator 기반 유지
- 입력: representation JSON 폴더
- 출력: 브라우저에서 열 수 있는 단일 HTML 파일
- API 호출 없음
- DB 없음
- 로그인 없음
- 서버 없음
- Representation JSON 수정 없음

기본 입력:

```text
outputs/representations_full_124_gemini_3_1_flash_lite/*.representation.json
```

기본 출력:

```text
viewer/session_viewer.html
```

## 실행 방법

기본 경로를 사용할 경우:

```bash
python scripts/build_session_viewer.py
```

입력/출력 경로를 직접 지정할 경우:

```bash
python scripts/build_session_viewer.py \
  --input outputs/representations_full_124_gemini_3_1_flash_lite \
  --output viewer/session_viewer.html
```

생성 후 브라우저에서 다음 파일을 연다.

```text
viewer/session_viewer.html
```

생성된 Viewer에서 확인할 것:

- 124개 세션이 로드되는가
- Agent Status 영역이 보이는가
- `Copy Resume Prompt` 버튼이 보이는가
- `Progress Path`가 보이는가
- `Key Evidence`가 기본적으로 일부만 표시되고 확장 가능한가
- Evidence 원문에 포함된 민감정보가 HTML 출력에서 마스킹되는가

## 추천 기술

현재 단계에서는 Python static HTML generator가 가장 적합하다.

이유:

- 현재 repo의 핵심이 Python이다.
- 별도 프론트엔드 빌드 도구가 필요 없다.
- API, DB, 서버 없이도 제품 감각을 검증할 수 있다.
- Phase 0.5의 목적은 UI 아키텍처가 아니라 Representation의 사용성 확인이다.

Vite/React는 다음 조건이 생긴 뒤 고려한다.

- 필터/정렬/검색이 복잡해질 때
- 여러 사용자가 웹으로 접근해야 할 때
- raw log와 Representation을 나란히 비교하는 인터랙션이 필요할 때
- review annotation을 브라우저에서 저장해야 할 때

## 이번 단계에서 하지 않을 것

- Prompt 개선
- Schema 개선
- Extractor 수정
- Importer 수정
- Evaluator 수정
- Provider 추상화
- Health Signal 확장
- Session Supervision 구현
- Desktop app 개발
- Dashboard 서버 구현
- 대규모 프론트엔드 도입

## 성공 기준

Session Viewer MVP의 성공 기준은 다음과 같다.

- 사용자가 세션 목록만 보고 검토할 세션을 빠르게 고를 수 있다.
- 선택된 세션의 현재 목표와 상황을 30초 안에 이해할 수 있다.
- blocker가 있는 세션을 쉽게 발견할 수 있다.
- evidence를 통해 Representation을 어느 정도 신뢰할 수 있다.
- raw log를 열어야 하는 빈도가 줄어든다.

이 기준을 만족하면 다음 Sprint에서 Agent Workspace 방향으로 확장할 근거가 생긴다.
