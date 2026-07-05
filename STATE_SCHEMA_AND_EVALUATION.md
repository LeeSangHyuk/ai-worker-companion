# State Schema and Evaluation

## 목표

V0의 목표는 Codex 또는 OpenCode 세션 로그에서 사용자가 즉시 개입할 수 있는 현재 상태를 추출하는 것이다.

추출 대상은 다음 5개 필드로 제한한다.

* Current Goal
* Current State
* Blocker
* Risk
* Recommended Intervention

핵심 원칙은 모든 판단에 Evidence를 붙이는 것이다. Evidence가 없는 추론은 출력하지 않거나 낮은 confidence로 표시한다.

---

## 최소 JSON 스키마

```json
{
  "schema_version": "0.1",
  "source": {
    "agent": "codex",
    "session_id": "optional-session-id",
    "log_range": {
      "start_index": 0,
      "end_index": 128
    }
  },
  "extracted_at": "2026-06-20T00:00:00Z",
  "summary": {
    "current_goal": {
      "value": "Fix the failing frontend build",
      "confidence": 0.82,
      "evidence": [
        {
          "id": "ev-001",
          "log_index": 12,
          "type": "user_message",
          "quote": "빌드 에러를 고쳐줘",
          "reason": "The user explicitly states the requested goal."
        }
      ]
    },
    "current_state": {
      "value": "The agent inspected package scripts and is trying to reproduce the build failure.",
      "confidence": 0.76,
      "evidence": [
        {
          "id": "ev-002",
          "log_index": 31,
          "type": "tool_call",
          "quote": "npm run build",
          "reason": "The agent attempted to reproduce the reported failure."
        }
      ]
    },
    "blocker": {
      "value": "Dependency installation cannot reach the package registry.",
      "confidence": 0.91,
      "evidence": [
        {
          "id": "ev-003",
          "log_index": 44,
          "type": "tool_result",
          "quote": "getaddrinfo ENOTFOUND registry.npmjs.org",
          "reason": "The tool result shows a network resolution failure."
        }
      ]
    },
    "risk": {
      "value": "The agent may keep retrying dependency installation instead of switching to an offline or cached path.",
      "confidence": 0.68,
      "evidence": [
        {
          "id": "ev-004",
          "log_index": 48,
          "type": "assistant_message",
          "quote": "I'll try installing dependencies again",
          "reason": "A repeated retry is suggested despite the same network failure."
        }
      ]
    },
    "recommended_intervention": {
      "value": "Ask for network approval or switch to inspecting existing lockfiles and cached dependencies before retrying.",
      "confidence": 0.74,
      "evidence": [
        {
          "id": "ev-005",
          "log_index": 44,
          "type": "tool_result",
          "quote": "getaddrinfo ENOTFOUND registry.npmjs.org",
          "reason": "The failure mode requires an environment decision rather than another identical retry."
        }
      ]
    }
  },
  "global_warnings": [
    {
      "code": "low_evidence",
      "message": "Risk is inferred from repeated behavior and has weaker evidence than blocker."
    }
  ]
}
```

---

## 필드 정의

### Current Goal

Agent가 현재 달성하려고 하는 최상위 목표.

우선순위:

1. 명시적인 사용자 요청
2. 최근 assistant plan
3. 반복되는 tool/action 패턴

목표가 바뀐 경우 가장 최근의 명시적 목표를 우선한다.

### Current State

세션이 지금 어떤 작업 단계에 있는지에 대한 짧은 상태 설명.

좋은 출력:

* "빌드 실패를 재현한 뒤 에러 원인을 좁히는 중"
* "파일 구조를 탐색했지만 아직 수정 전"
* "수정은 완료했고 테스트 실행에서 막힘"

나쁜 출력:

* "작업 중"
* "문제를 해결하려고 함"

### Blocker

현재 진행을 실제로 멈추거나 다음 단계 선택을 어렵게 만드는 장애물.

Blocker가 없으면 `value`는 `null`을 허용한다.

```json
{
  "value": null,
  "confidence": 0.8,
  "evidence": []
}
```

### Risk

아직 실패로 확정되지는 않았지만 방치하면 세션 품질을 떨어뜨릴 가능성이 있는 요소.

예:

* 같은 실패 반복
* 목표 drift
* 근거 없는 대규모 수정
* 오래 걸리는 tool call 방치
* 테스트 없이 완료 선언

### Recommended Intervention

사용자 또는 supervisor가 지금 취하면 좋은 최소 개입.

개입은 명령형으로 짧게 쓴다.

좋은 출력:

* "동일한 설치 재시도 전에 네트워크 권한을 확인한다."
* "현재 목표를 다시 명시하고 수정 범위를 한 파일로 제한한다."
* "테스트 실패 로그의 첫 번째 에러만 기준으로 원인을 좁힌다."

---

## Evidence 규칙

Evidence는 추출 결과를 믿을 수 있게 만드는 최소 단위다.

각 evidence는 다음 속성을 가진다.

* `id`: evidence 고유 ID
* `log_index`: 원본 로그 이벤트 번호
* `type`: `user_message`, `assistant_message`, `tool_call`, `tool_result`, `system_event`, `file_diff` 중 하나
* `quote`: 판단의 근거가 되는 짧은 원문
* `reason`: 이 evidence가 왜 해당 판단을 지지하는지

규칙:

* 값이 있는 각 필드는 evidence 1개 이상을 가져야 한다.
* 값이 `null`인 필드는 evidence가 비어 있을 수 있다.
* `quote`는 짧게 유지한다.
* Evidence 없이 강한 confidence를 주지 않는다.
* 같은 evidence를 여러 필드에서 재사용할 수 있다.
* 추론이 필요한 필드는 `reason`에 추론 과정을 짧게 남긴다.

---

## Confidence 기준

`confidence`는 0부터 1 사이 숫자다.

* `0.90 - 1.00`: 로그에 명시적으로 드러남
* `0.70 - 0.89`: 여러 evidence가 일관되게 지지함
* `0.50 - 0.69`: 합리적 추론이지만 반대 가능성이 있음
* `0.00 - 0.49`: 출력하지 않거나 warning으로만 표시

V0에서는 0.5 미만의 필드 값을 UI에서 강조하지 않는다.

---

## 평가 방법

### 평가 데이터셋

초기 데이터셋은 실제 코딩 에이전트 세션 20개로 시작한다.

세션 구성:

* 성공 세션 5개
* tool 실패 또는 timeout 세션 5개
* 반복 실패 세션 5개
* 목표 drift 또는 과도한 구현 세션 5개

각 세션은 사람이 다음 gold label을 작성한다.

* Current Goal
* Current State
* Blocker
* Risk
* Recommended Intervention
* 각 항목의 근거 로그 인덱스

### 정량 평가

각 필드는 0, 1, 2점으로 채점한다.

* 0점: 틀렸거나 근거 없음
* 1점: 부분적으로 맞지만 부정확하거나 너무 모호함
* 2점: 정확하고 행동 가능하며 evidence가 타당함

총점은 세션당 10점이다.

V0 통과 기준:

* 평균 7점 이상
* Blocker 평균 1.5점 이상
* Recommended Intervention 평균 1.4점 이상
* Evidence precision 80% 이상

### Evidence Precision

Evidence precision은 모델이 제시한 evidence 중 사람이 "해당 판단을 실제로 지지한다"고 인정한 비율이다.

```text
Evidence Precision = valid evidence count / total evidence count
```

V0에서는 recall보다 precision을 우선한다. 빠뜨리는 것보다 근거 없는 추론을 자신 있게 말하는 것이 더 위험하다.

### Time-to-Understanding 평가

사용자에게 같은 세션을 두 방식으로 보여준다.

1. 원본 로그만 보기
2. 추출된 JSON/요약 먼저 보기

측정 질문:

* 현재 목표가 무엇인가?
* 어디서 막혔는가?
* 지금 개입한다면 무엇을 해야 하는가?

측정 지표:

* 답변까지 걸린 시간
* 답변 정확도
* 사용자의 신뢰도 1-5점

V0 통과 기준:

* 원본 로그 대비 상황 파악 시간이 30% 이상 감소
* 정확도 저하 없음
* 신뢰도 평균 4점 이상

---

## 평가 Rubric

### Current Goal

2점: 사용자 요청 또는 최근 명시 목표와 일치한다.

1점: 방향은 맞지만 범위가 넓거나 오래된 목표를 사용한다.

0점: 현재 목표와 다르거나 evidence가 없다.

### Current State

2점: 현재 단계와 완료/미완료 상태를 구분한다.

1점: 대략적인 작업 단계만 맞힌다.

0점: 너무 일반적이거나 실제 로그와 맞지 않는다.

### Blocker

2점: 진행을 막는 직접 원인을 정확히 식별한다.

1점: 증상은 맞지만 원인 또는 영향이 불명확하다.

0점: blocker가 아닌 것을 blocker로 표시하거나 실제 blocker를 놓친다.

### Risk

2점: 방치 시 문제가 될 가능성과 근거가 명확하다.

1점: 가능성은 있지만 너무 일반적이다.

0점: 근거 없는 위험을 만든다.

### Recommended Intervention

2점: 현재 blocker/risk에 직접 대응하며 즉시 실행 가능하다.

1점: 방향은 맞지만 추상적이다.

0점: 현재 상황과 맞지 않거나 너무 큰 개입이다.

---

## V0에서 하지 않을 것

* Agent의 진짜 내부 생각을 안다고 주장하지 않는다.
* 장기 memory 또는 experience graph를 만들지 않는다.
* 자동 개입하지 않는다.
* multi-agent causal graph를 만들지 않는다.
* 모든 로그 포맷을 지원하려고 하지 않는다.

V0의 제품 약속은 단순하다.

> 긴 코딩 에이전트 세션 로그를 evidence 기반의 현재 상태 요약으로 바꿔, 사용자가 더 빨리 판단하고 개입하게 한다.
