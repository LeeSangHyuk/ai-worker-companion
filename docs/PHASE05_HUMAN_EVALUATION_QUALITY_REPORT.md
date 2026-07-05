# Phase 0.5 Human Evaluation Quality Report

## 목적

이 보고서는 실제 ChatGPT Export에서 생성된 representation 결과를 기반으로, 현재 **Evidence-grounded Session Representation Engine**이 Human Evaluation 단계로 넘어갈 만큼 안정적인지 점검한다.

이번 분석은 기능 개선이 아니라 품질 검증이다. 따라서 다음 항목은 수정하지 않았다.

- Importer
- Extractor
- Prompt
- Representation Schema
- Evaluator
- Provider behavior

또한 새 API 호출은 수행하지 않았다. 이미 생성된 JSON 파일만 분석했다.

## 입력 데이터

분석에 사용한 입력:

```text
outputs/representations_full_124_gemini_3_1_flash_lite/batch_summary.json
outputs/representations_full_124_gemini_3_1_flash_lite/batch_run.jsonl
outputs/representations_full_124_gemini_3_1_flash_lite/*.representation.json
```

모델:

```text
gemini-3.1-flash-lite
```

별도 JSON summary:

```text
reports/phase05_representation_quality_summary.json
```

이 JSON은 통계와 후보 샘플 목록을 기계적으로 재사용할 수 있도록 생성한 분석 산출물이다.

## 1. Batch 실행 결과

`batch_summary.json` 기준:

| 항목 | 값 |
| --- | ---: |
| Total | 124 |
| Success | 102 |
| Failed | 0 |
| Skipped | 22 |
| Representation JSON files | 124 |

Output directory:

```text
D:\agent-session-state-extractor\outputs\representations_full_124_gemini_3_1_flash_lite
```

해석:

- `success: 102`는 이번 batch run에서 새로 생성된 representation 수다.
- `skipped: 22`는 output 폴더에 이미 존재해서 재사용한 representation 수다.
- 따라서 최종적으로 분석 가능한 representation 파일은 `102 + 22 = 124`개다.
- `failed: 0`이므로 최종 batch 대상 124개 기준으로 실패한 conversation은 없다.

### 실행 로그 요약

`batch_run.jsonl`은 append 방식 로그이므로 전체 row 수는 179개다.

전체 로그 row 기준:

| Status | Count |
| --- | ---: |
| success | 124 |
| skipped | 55 |

최신 representation 상태 기준:

| Status | Count |
| --- | ---: |
| success | 102 |
| skipped | 22 |

실행 시간 통계는 성공 row 기준으로 다음과 같다.

| 항목 | 초 |
| --- | ---: |
| 최소 | 1.31 |
| 평균 | 2.11 |
| 최대 | 4.94 |

주의:

- 이 실행 시간은 개별 API 처리 시간 중심이며, batch 중간의 수동 중단/재시작/대기 전략 전체 시간을 의미하지 않는다.
- `batch_run.jsonl`은 append 로그이므로, 전체 로그 row 수와 최종 summary count는 다를 수 있다.

## 2. Representation 구조 통계

분석 대상:

```text
124 representation JSON files
```

### 필드 완성도

| 항목 | Count | 비율 |
| --- | ---: | ---: |
| Goal Stack empty | 3 | 2.4% |
| Current Situation empty | 0 | 0.0% |
| Blocker empty | 114 | 91.9% |
| Active Goal empty | 13 | 10.5% |

해석:

- Current Situation은 124개 모두에서 생성되었다. 이 필드는 현재 schema에서 가장 안정적으로 채워지고 있다.
- Goal Stack이 완전히 비어 있는 경우는 3개뿐이며, 모두 매우 짧은 대화다.
- Active Goal empty는 13개로, 주로 짧은 대화에서 발생한다.
- Blocker empty 114개는 대부분 `none_observed` 상태를 의미한다. 이는 schema상 반드시 오류는 아니다. 다만 blocker가 실제로 없어서 비어 있는 것인지, 모델이 blocker를 보수적으로 잡은 것인지는 Human Evaluation에서 확인해야 한다.

### Blocker status 분포

| Blocker status | Count | 비율 |
| --- | ---: | ---: |
| `present` | 9 | 7.3% |
| `none_observed` | 114 | 91.9% |
| `unknown` | 1 | 0.8% |

관찰:

- Gemini 3.1 Flash Lite 결과는 blocker를 꽤 보수적으로 판단했다.
- 이전 일부 샘플에서 blocker가 넓게 잡히던 경향과 달리, 전체 batch에서는 `none_observed`가 압도적으로 많다.
- 이 변화가 모델 차이 때문인지, prompt/schema 특성 때문인지, 실제 데이터 특성 때문인지는 Human Evaluation에서 확인해야 한다.

### Goal shift 분포

| Goal shift detected | Count | 비율 |
| --- | ---: | ---: |
| `true` | 18 | 14.5% |
| `false` | 106 | 85.5% |

관찰:

- Goal shift는 전체 대화 중 일부에서만 감지되었다.
- 짧은 대화에서는 goal shift가 거의 의미 없을 수 있으므로, goal shift 품질은 긴 대화 중심으로 리뷰하는 것이 좋다.

### Previous Goals 개수 분포

| Previous goals count | Count | 비율 |
| --- | ---: | ---: |
| 0 | 46 | 37.1% |
| 1 | 23 | 18.5% |
| 2 | 34 | 27.4% |
| 3 | 21 | 16.9% |

관찰:

- 63% 정도의 샘플에서 previous goals가 1개 이상 생성되었다.
- 긴 대화나 작업 전환이 있는 대화에서는 Goal Stack 구조가 실제로 작동하고 있다.
- 반대로 짧은 대화에서는 previous goals가 없거나 단순해지는 것이 자연스럽다.

### Evidence 개수 분포

| 항목 | Evidence count |
| --- | ---: |
| 최소 | 1 |
| 평균 | 5.15 |
| 중앙값 | 4 |
| p90 | 11 |
| 최대 | 17 |

관찰:

- 이전 3개 샘플에서 evidence가 과도하게 많아질 수 있다는 우려가 있었지만, 이번 `gemini-3.1-flash-lite` batch에서는 evidence 수가 비교적 절제되어 있다.
- 최대 evidence count가 17이므로, “evidence 과다”는 이번 전체 batch에서는 큰 문제로 나타나지 않았다.
- 다만 evidence가 적다는 것이 항상 좋은 것은 아니다. 긴 대화에서 evidence가 너무 적으면 representation이 충분히 검증 가능한지 따로 봐야 한다.

### Representation 전체 길이 분포

| 항목 | 문자 수 |
| --- | ---: |
| 최소 | 757 |
| 평균 | 4,746.61 |
| 중앙값 | 2,872 |
| p90 | 9,201 |
| 최대 | 71,330 |

관찰:

- 대부분 representation은 사람이 리뷰 가능한 길이에 들어온다.
- 다만 일부 긴 대화는 출력이 매우 길다.
- 최대 길이 샘플은 Human Evaluation용으로 그대로 읽기보다 리뷰 시트로 압축하는 편이 좋다.

### 원본 normalized record 수 분포

| 항목 | Records |
| --- | ---: |
| 최소 | 1 |
| 평균 | 19.96 |
| 중앙값 | 4 |
| p90 | 42 |
| 최대 | 464 |

해석:

- 전체 export에는 매우 짧은 대화가 많다.
- 중앙값이 4라는 점은, 전체 124개를 모두 동등하게 평가 대상으로 삼으면 짧은 대화가 평가를 왜곡할 수 있음을 의미한다.
- Human Evaluation은 전체 random sample보다 stratified sample이 적합하다.

## 3. 품질 의심 샘플 탐지

탐지 기준:

- 너무 짧은 representation
- evidence가 과도하게 많은 representation
- active goal이 비어 있는 긴 대화
- blocker가 비어 있지만 대화가 긴 샘플
- generic하거나 boilerplate처럼 보이는 출력

탐지 결과:

| Flag | Count | 해석 |
| --- | ---: | --- |
| `too_short_representation` | 54 | 대부분 원본 대화 자체가 매우 짧음 |
| `goal_stack_empty` | 3 | 짧은 대화에서 Goal Stack이 비어 있음 |
| `blocker_empty` | 114 | 대부분 `none_observed`; 오류라기보다 blocker 없음 판단 |
| `blocker_empty_or_unknown_long_session` | 7 | 긴 대화인데 blocker가 없거나 unknown |
| `excessive_evidence` | 0 | 이번 batch에서는 evidence 과다 문제 거의 없음 |
| `possibly_generic` | 0 | 단순 boilerplate 탐지는 두드러지지 않음 |

### 품질이 의심되는 샘플 10개

| Sample ID | Records | Length | Evidence | Previous goals | Blocker | Flags |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `conv_012_f46fd698b266` | 2 | 920 | 2 | 0 | `none_observed` | too short, goal stack empty |
| `conv_100_d85906367670` | 2 | 890 | 2 | 0 | `none_observed` | too short, goal stack empty |
| `conv_056_5b11b69768a1` | 2 | 1,278 | 2 | 0 | `present` | too short, goal stack empty |
| `conv_054_3015ce9999e6` | 2 | 1,909 | 2 | 0 | `none_observed` | too short |
| `conv_095_21e3b4dac980` | 2 | 2,117 | 2 | 0 | `none_observed` | too short |
| `conv_002_17e9735ba932` | 2 | 2,465 | 2 | 1 | `none_observed` | too short |
| `conv_040_0b8d3b5361f2` | 2 | 1,879 | 2 | 1 | `none_observed` | too short |
| `conv_051_df1d918713fb` | 2 | 1,849 | 2 | 1 | `none_observed` | too short |
| `conv_087_6cc20385911d` | 2 | 1,303 | 2 | 1 | `none_observed` | too short |
| `conv_099_0093f6ad4e80` | 2 | 1,757 | 2 | 1 | `none_observed` | too short |

해석:

- 품질 의심 샘플 대부분은 representation 모델 실패라기보다 원본 대화가 너무 짧은 경우다.
- 짧은 대화에서는 Goal Stack 구조 자체가 과한 표현일 수 있다.
- Human Evaluation에서는 짧은 대화를 별도 그룹으로 분리해야 한다.

### 긴 대화인데 blocker가 비어 있는 샘플

| Sample ID | Records | Evidence | Previous goals | Blocker |
| --- | ---: | ---: | ---: | --- |
| `conv_109_52666294240e` | 254 | 17 | 3 | `none_observed` |
| `conv_064_43bdc81473b6` | 213 | 11 | 2 | `none_observed` |
| `conv_102_88bb2c07cceb` | 90 | 13 | 3 | `none_observed` |
| `conv_094_a6a1b3419bec` | 66 | 10 | 2 | `none_observed` |
| `conv_107_d652a748e499` | 66 | 16 | 3 | `none_observed` |
| `conv_105_64f41c5c9c4b` | 58 | 7 | 2 | `none_observed` |
| `conv_120_084de5a85777` | 54 | 7 | 3 | `none_observed` |

해석:

- 긴 대화라고 해서 반드시 blocker가 있어야 하는 것은 아니다.
- 하지만 이 그룹은 blocker 기준 검토에 중요하다.
- 사람이 봤을 때 “정말 blocker가 없었는가?” 또는 “모델이 blocker를 놓쳤는가?”를 확인해야 한다.

## 4. Human Evaluation 후보 추천

### 가장 품질이 좋아 보이는 샘플 10개

자동 점수는 구조적 완성도, Goal Stack 풍부도, Current Situation 존재, evidence 수 적정성, suspicious flag 부재를 기준으로 계산했다. 정답 점수가 아니라 후보 추천용 휴리스틱이다.

| Sample ID | Records | Evidence | Previous goals | Blocker | Goal shift | 비고 |
| --- | ---: | ---: | ---: | --- | --- | --- |
| `conv_011_da85e38812fd` | 20 | 14 | 3 | `present` | false | 구조적으로 가장 균형적 |
| `conv_118_e5c1c732b9ae` | 464 | 16 | 3 | `present` | true | 가장 긴 대화, Goal Stack 검증에 좋음 |
| `conv_000_d4223b7b84d6` | 125 | 11 | 2 | `present` | false | 긴 코드/개발형 |
| `conv_016_037a77078a29` | 46 | 11 | 3 | `none_observed` | false | blocker 없음 기준 검토 |
| `conv_005_fa7e362ee49b` | 42 | 9 | 3 | `none_observed` | false | 중간 길이, Goal Stack 풍부 |
| `conv_076_e283946d529f` | 42 | 11 | 3 | `none_observed` | false | 중간 길이, evidence 적정 |
| `conv_112_1cdf5aaacc01` | 39 | 12 | 3 | `none_observed` | true | goal shift 검토 |
| `conv_106_c11190b3ccf8` | 36 | 12 | 2 | `present` | true | blocker present + shift |
| `conv_068_70b85163591c` | 30 | 10 | 3 | `none_observed` | false | 적당한 리뷰 길이 |
| `conv_019_234027074c66` | 26 | 13 | 3 | `none_observed` | true | 짧지 않으면서 Goal Stack 뚜렷 |

### 품질이 의심되는 샘플 10개

위의 “품질 의심 샘플” 표와 동일하다. 대부분 2-record 샘플이므로, Human Evaluation에서 “짧은 대화는 representation schema가 과한가?”를 검토하는 데 사용하면 좋다.

추천:

- `conv_012_f46fd698b266`
- `conv_100_d85906367670`
- `conv_056_5b11b69768a1`
- `conv_054_3015ce9999e6`
- `conv_095_21e3b4dac980`
- `conv_002_17e9735ba932`
- `conv_040_0b8d3b5361f2`
- `conv_051_df1d918713fb`
- `conv_087_6cc20385911d`
- `conv_099_0093f6ad4e80`

### 긴 대화 샘플

| Sample ID | Records | Evidence | Blocker | Goal shift |
| --- | ---: | ---: | --- | --- |
| `conv_118_e5c1c732b9ae` | 464 | 16 | `present` | true |
| `conv_109_52666294240e` | 254 | 17 | `none_observed` | false |
| `conv_064_43bdc81473b6` | 213 | 11 | `none_observed` | false |
| `conv_000_d4223b7b84d6` | 125 | 11 | `present` | false |
| `conv_102_88bb2c07cceb` | 90 | 13 | `none_observed` | false |

긴 대화는 Goal Stack과 Current Situation이 실제로 시간을 줄여주는지 평가하기에 가장 중요하다.

### 짧은 대화 샘플

| Sample ID | Records | Length | Evidence | Blocker |
| --- | ---: | ---: | ---: | --- |
| `conv_006_5f0158d94934` | 1 | 757 | 1 | `none_observed` |
| `conv_081_14f309cefba7` | 1 | 802 | 1 | `present` |
| `conv_100_d85906367670` | 2 | 890 | 2 | `none_observed` |
| `conv_012_f46fd698b266` | 2 | 920 | 2 | `none_observed` |
| `conv_077_6a1cdc6a1499` | 2 | 1,076 | 2 | `present` |

짧은 대화는 별도 평가군으로 분리하는 것이 좋다.

### Blocker 기준 검토용 샘플

| Sample ID | Records | Blocker | 이유 |
| --- | ---: | --- | --- |
| `conv_000_d4223b7b84d6` | 125 | `present` | 긴 코드/개발형에서 blocker가 잡힘 |
| `conv_118_e5c1c732b9ae` | 464 | `present` | 가장 긴 대화에서 blocker가 잡힘 |
| `conv_106_c11190b3ccf8` | 36 | `present` | 중간 길이 + goal shift |
| `conv_109_52666294240e` | 254 | `none_observed` | 긴 대화인데 blocker 없음 |
| `conv_064_43bdc81473b6` | 213 | `none_observed` | 긴 대화인데 blocker 없음 |
| `conv_102_88bb2c07cceb` | 90 | `none_observed` | 긴 대화인데 blocker 없음 |

핵심 질문:

> Blocker는 실제로 작업을 막는 조건만 의미해야 하는가, 아니면 사용자의 혼란/망설임/판단 보류도 포함해야 하는가?

### Goal Stack이 잘 드러나는 샘플

| Sample ID | Records | Previous goals | Goal shift | Evidence |
| --- | ---: | ---: | --- | ---: |
| `conv_118_e5c1c732b9ae` | 464 | 3 | true | 16 |
| `conv_107_d652a748e499` | 66 | 3 | true | 16 |
| `conv_112_1cdf5aaacc01` | 39 | 3 | true | 12 |
| `conv_019_234027074c66` | 26 | 3 | true | 13 |
| `conv_007_89cce919088a` | 14 | 3 | true | 7 |
| `conv_075_64e7cc9937ae` | 12 | 3 | true | 7 |
| `conv_001_3c10e5969ea5` | 10 | 3 | true | 9 |
| `conv_109_52666294240e` | 254 | 3 | false | 17 |
| `conv_102_88bb2c07cceb` | 90 | 3 | false | 13 |
| `conv_120_084de5a85777` | 54 | 3 | false | 7 |

이 샘플들은 Goal Stack이 단일 goal보다 더 설명력이 있는지 확인하기에 좋다.

## 5. 품질 분석 요약

### Goal Stack이 잘 추출되는 대화의 특징

Goal Stack은 다음 유형에서 잘 작동하는 것으로 보인다.

- record 수가 충분히 많은 대화
- 사용자가 여러 단계로 요구를 구체화한 대화
- 설치, 설정, 코드 수정, 전략 논의처럼 하위 목표가 구분되는 대화
- goal shift가 명확한 대화
- previous goals가 2~3개로 잡히는 대화

특히 `conv_118_e5c1c732b9ae`, `conv_109_52666294240e`, `conv_102_88bb2c07cceb`는 Goal Stack 평가에 적합하다.

### Goal Stack이 부족한 대화의 특징

Goal Stack이 부족하거나 비어 있는 경우는 대부분 매우 짧은 대화다.

대표 특징:

- records가 1~2개
- previous goals가 없음
- active goal이 비어 있음
- Goal Stack을 만들 근거 자체가 부족함

따라서 짧은 대화에서 Goal Stack이 비어 있는 것은 extractor 실패라기보다 schema 적용 범위의 문제일 수 있다.

### Current Situation이 특히 유용한 경우

Current Situation은 124개 모두에서 생성되었다.

이 필드는 다음 상황에서 특히 가치가 있을 가능성이 높다.

- 긴 대화의 마지막 checkpoint를 빠르게 파악해야 할 때
- Goal Stack만으로는 “지금 상태”가 드러나지 않을 때
- 사용자의 작업이 완료/중단/대기/혼란 중 어디에 있는지 파악해야 할 때
- 다음 사람이 세션을 이어받아야 할 때

전체 통계상 Current Situation empty가 0이라는 점은 Phase 0.5에서 긍정적인 신호다.

### Blocker가 부족하거나 애매한 경우

Blocker는 가장 주의 깊게 봐야 할 필드다.

전체 124개 중 `present`는 9개뿐이다.

가능한 해석:

1. 실제로 대부분 대화에는 blocker가 없었다.
2. Gemini 3.1 Flash Lite가 blocker를 보수적으로 판단했다.
3. 현재 prompt/schema가 blocker를 “명시적 장애물” 중심으로 유도한다.
4. 사용자의 혼란/망설임/불확실성 같은 soft blocker가 누락될 수 있다.

Human Evaluation에서는 blocker를 다음 두 범주로 나누어 평가하는 것이 좋다.

- Hard blocker: quota 초과, 오류 반복, 인증 실패, 파일 누락 등 실제 진행 불가 조건
- Soft blocker: 사용자의 이해 부족, 방향성 불확실, 제품화 망설임, 다음 결정 대기

현재 schema는 이 둘을 구분하지 않는다. 따라서 blocker 기준 개선 필요성이 있다.

## 6. Human Evaluation으로 넘어갈 수 있는가?

판단:

> 넘어갈 수 있다.

이유:

- Import는 124/124 성공했다.
- Representation batch는 124 대상 중 최종 실패 0이다.
- 102개는 새로 생성되었고, 22개는 기존 생성 파일을 재사용했다.
- Current Situation은 모든 샘플에서 생성되었다.
- Goal Stack empty는 3개뿐이며, 대부분 너무 짧은 대화다.
- Evidence count는 과도하지 않다.
- Human Evaluation 후보군을 유형별로 구성할 수 있다.

다만 Human Evaluation은 전체 124개를 무작위로 보는 방식보다, 다음처럼 나누는 것이 좋다.

1. 긴 대화
2. 중간 길이 대화
3. 짧은 대화
4. blocker present
5. blocker none on long session
6. goal shift detected
7. Goal Stack rich
8. 품질 의심 샘플

## 7. 결론

Phase 0.5 기준으로 현재 구조는 실제 ChatGPT Export 데이터에 대해 충분히 의미 있는 검증 단계에 도달했다.

가장 강한 결과:

```text
Import: 124 / 124 성공
Representation files: 124 / 124 존재
Batch failed: 0
Current Situation empty: 0
```

가장 약한 부분:

```text
Blocker 기준
짧은 대화에서 Goal Stack 의미
긴 대화에서 blocker none_observed가 타당한지 여부
```

다음 단계는 기능 개선이 아니라 Human Evaluation이다.

Human reviewer가 확인해야 할 핵심 질문은 다음과 같다.

> 이 representation만 보고 사람이 30초 안에 세션을 이해하고, 이어받을 수 있는가?

그리고 blocker에 대해서는 별도 질문이 필요하다.

> blocker는 실제 진행 불가 조건만 의미해야 하는가, 아니면 사용자의 혼란/망설임 같은 soft blocker도 포함해야 하는가?

