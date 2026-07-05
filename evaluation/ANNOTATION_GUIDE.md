# Session Health Detector Annotation Guide

## 목적

현재 detector 두 개(`repeated_command`, `repeated_error`)가 실제로 사람의
개입 판단에 도움이 되는지 평가한다. 새 detector 후보를 라벨링하거나 구현하지
않는다.

## 평가 단위

한 레코드는 하나의 세션 checkpoint다. `cutoff`이 있으면 해당 정규화 이벤트
까지만 보고 판단한다. checkpoint 이후의 로그를 보면 미래 정보 누수가 생긴다.

## 라벨링 순서

1. detector 결과를 보기 전에 normalized event를 읽는다.
2. checkpoint에서 에이전트를 그대로 계속 실행하게 둘지 판단한다.
3. `intervention_needed`를 `yes`, `no`, `uncertain` 중 하나로 기록한다.
4. 개입 이유가 현재 detector 패턴이라면 `expected_signals`에 해당 유형을 넣는다.
5. 판단을 직접 뒷받침하는 최소 Evidence ID와 짧은 메모를 기록한다.
6. 라벨 저장 후 detector 결과를 실행한다.

이벤트 확인:

```powershell
python scripts/evaluate_health.py evaluation/health_manifest.jsonl `
  --show-events <case-id>
```

## Intervention 라벨

### `yes`

합리적인 개발자라면 이 checkpoint에서 에이전트를 멈추거나, 방향을 바꾸거나,
추가 정보를 제공해야 한다. 최소 하나의 수동 Evidence ID가 필요하다.

### `no`

반복처럼 보여도 정상적인 재시도이거나 새로운 조사·수정·성공이 관측된다.
`expected_signals`는 비워 둔다.

### `uncertain`

로그만으로 개입 필요성을 결정할 수 없다. precision/recall 계산에서 제외되지만
case 결과에는 남는다.

## Detector 유형 라벨

### `repeated_command`

같은 명령이 상태 변화 없이 세 번 이상 반복됐고, 그 반복 때문에 사람의 개입이
필요하다고 판단할 때만 지정한다. 환경 변경이나 파일 수정 후의 재실행은 같은
incident로 보지 않는다.

### `repeated_error`

같은 오류가 명확한 성공 없이 두 번 이상 반복됐고, 추가 자동 재시도보다 사람의
개입이 적절할 때 지정한다.

현재 detector 외의 이유로 개입이 필요하면 `intervention_needed: yes`로
라벨링하되 `expected_signals`는 비운다. 이 경우는 전체 intervention recall의
false negative가 될 수 있지만, detector 유형별 recall에는 포함되지 않는다.

## FP/FN 정의

- TP: detector signal이 있고 수동 라벨도 `yes`
- FP: detector signal이 있지만 수동 라벨은 `no`
- FN: detector signal이 없지만 수동 라벨은 `yes`
- TN: detector signal이 없고 수동 라벨도 `no`
- `uncertain`: 지표에서 제외
- unlabeled: 지표에서 제외

유형별 precision/recall은 `expected_signals`를 기준으로 별도로 계산한다.

## 권장 데이터 구성

실제 Codex/OpenCode checkpoint 약 20개를 사용한다.

- detector가 발생한 사례와 발생하지 않은 사례를 모두 포함
- 성공적으로 복구된 재시도를 포함해 false positive를 확인
- 실제 개입이 필요했지만 두 detector가 잡지 못한 사례도 포함
- Codex와 OpenCode를 가능하면 각각 5개 이상 포함
- 첫 5개 정도는 두 사람이 독립 라벨링하고 불일치를 합의해 기준을 맞춤

API 키, 사내 코드, 개인정보 등 민감 정보는 데이터셋에 넣기 전에 제거한다.
