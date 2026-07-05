# ChatGPT Export Representation 리뷰

## 목적

이 문서는 실제 ChatGPT Export에서 선정한 3개 샘플의 representation 결과를 사람이 검토하기 쉽게 정리한 것이다.

리뷰의 목적은 “원문 대화 전체를 보지 않고도, representation만 읽고 세션을 빠르게 이해할 수 있는가?”를 확인하는 것이다.

원문 대화 전문은 포함하지 않는다. Evidence snippet도 기본적으로 제외했다. 실제 export에는 개인정보나 민감한 내용이 포함될 수 있기 때문이다. 필요하면 로컬에 보관된 private representation 파일에서 Evidence ID를 기준으로 직접 확인한다.

권장 평가 척도:

- 예
- 대체로 예
- 애매함
- 아니오

---

## Sample A — 긴 프로젝트 관련 세션

- Sample ID: `conv_109_52666294240e`
- Evidence 수: 35

### 1. Goal Stack

- Primary goal: 개인 프로젝트를 위한 효율적인 AI 개발 환경을 구성하고 새로운 도구 사용 가능성을 탐색한다.
  - Evidence: `e001`, `e211`
- Active goal: AI 도구 간 context transfer 문제를 해결하는 제품 아이디어의 시장 필요성과 제품화 전략을 검증한다.
  - Evidence: `e236`, `e254`
- Previous goals:
  - OpenCode/OMO를 비용 0원에 가깝게 운영하기 위해 로컬 모델과 클라우드 모델을 선택하고 구성한다.
    - Evidence: `e005`, `e014`, `e016`, `e019`
  - OpenCode와 OMO를 설치하고, 선택한 모델들을 연결하며, 환경 설정 문제를 해결한다.
    - Evidence: `e047`, `e049`, `e052`, `e054`, `e056`, `e058`, `e131`, `e133`, `e135`, `e139`, `e141`
  - ChatGPT Plus와 Codex CLI를 도입하고, 기존 OpenCode/OMO 환경과 함께 어떤 역할을 할 수 있는지 이해한다.
    - Evidence: `e194`, `e201`, `e202`, `e211`, `e212`, `e213`, `e215`, `e217`, `e219`, `e220`, `e221`, `e222`, `e224`
- Goal shift detected: `true`
- Goal shift evidence: `e227`, `e236`

### 2. Current Situation

사용자는 하이브리드 AI 개발 환경을 구성했고 ChatGPT Plus도 도입했다. 그 과정에서 AI 도구 간 context transfer가 중요한 문제라는 점을 발견했고, 기존 “Context Cache” 프로젝트를 확장해 제품화할 수 있는지 탐색하고 있지만, 아직 완성도와 API 비용 문제 때문에 공개/홍보를 망설이고 있다.

- Evidence: `e219`, `e236`, `e246`, `e248`, `e253`, `e254`

### 3. Blocker

- Status: `present`
- Value: 기존 “Context Cache” 프로젝트의 완성도와 API 비용에 대한 우려 때문에, 새로운 “AI Context Bridge” 아이디어의 시장 검증을 위한 공개/홍보를 망설이고 있다.
- Evidence: `e253`, `e254`

### 4. Evidence ID 목록

- 전체 Evidence IDs: `e001`, `e211`, `e236`, `e254`, `e005`, `e014`, `e016`, `e019`, `e047`, `e049`, `e052`, `e054`, `e056`, `e058`, `e131`, `e133`, `e135`, `e139`, `e141`, `e194`, `e201`, `e202`, `e212`, `e213`, `e215`, `e217`, `e219`, `e220`, `e221`, `e222`, `e224`, `e227`, `e246`, `e248`, `e253`
- Current Situation 참조 Evidence: `e219`, `e236`, `e246`, `e248`, `e253`, `e254`
- Blocker 참조 Evidence: `e253`, `e254`

### 5. 사람이 평가할 질문

1. 이 representation만 읽고 “이 세션이 무엇을 하던 세션인지” 30초 안에 이해되는가?
2. Primary goal과 Active goal의 구분이 자연스러운가?
3. Previous goals가 세션의 흐름을 이해하는 데 도움이 되는가, 아니면 너무 길어서 방해되는가?
4. Goal shift detected가 타당한가?
5. Current Situation이 checkpoint 시점의 현재 상황을 잘 잡고 있는가?
6. Blocker가 실제 blocker인가, 아니면 사용자의 고민/리스크를 blocker로 과장한 것인가?
7. Evidence ID만으로도 주요 판단을 검증할 수 있을 것 같은가?
8. 이 representation을 보고 다음 작업자가 세션을 이어받을 수 있겠는가?

---

## Sample B — 긴 코드/개발 세션

- Sample ID: `conv_000_d4223b7b84d6`
- Evidence 수: 45

### 1. Goal Stack

- Primary goal: 아파트 거래 데이터 수집/분석을 위한 Google Apps Script 코드베이스에 주소 캐싱, 재시도 로직, 로깅 등 개선 사항을 통합한다.
  - Evidence: `e004`, `e008`, `e010`, `e014`, `e017`, `e020`, `e022`, `e026`, `e030`, `e034`, `e036`, `e038`, `e040`, `e042`, `e044`, `e046`, `e048`, `e050`, `e052`, `e054`, `e065`, `e067`, `e081`, `e087`, `e089`, `e091`, `e093`, `e094`, `e096`, `e098`, `e102`, `e104`, `e106`, `e108`
- Active goal: 없음
  - Evidence: 없음
- Previous goals:
  - 주소 정보 조회를 하나의 API 호출로 통합하고, 시트 기반 캐시에 저장한다.
    - Evidence: `e085`, `e086`
  - 통합 주소 캐싱 로직을 `cacheRecentJeonseData`와 `cacheTransactionStatsByYearToSingleSheet` 두 함수 모두에 적용한다.
    - Evidence: `e089`, `e090`
  - 캐싱, 주소 처리, 로깅, 주소 API 호출 통합 등 논의된 모든 개선 사항을 사용자가 제공한 전체 코드베이스 템플릿에 빠짐없이 통합한다.
    - Evidence: `e093`, `e094`, `e096`, `e098`
- Goal shift detected: `true`
- Goal shift evidence: `e109`, `e110`

### 2. Current Situation

에이전트는 Google Apps Script의 `UrlFetchApp` 일일 quota 초과 때문에 스크립트 실행이 막혔고, 이 quota가 KST 오전 9시에 리셋된다고 사용자에게 확인해주고 있다. 사용자는 그 이전에 에이전트가 요청한 코드 변경을 제대로 반영하지 못한 것에 강한 불만을 보였고, 주된 코드 통합 작업은 중단된 상태다.

- Evidence: `e110`, `e115`

### 3. Blocker

- Status: `present`
- Value: Google Apps Script `UrlFetchApp` 일일 quota가 초과되었다.
- Evidence: `e116`, `e118`, `e120`, `e122`, `e124`

### 4. Evidence ID 목록

- 전체 Evidence IDs: `e004`, `e008`, `e010`, `e014`, `e017`, `e020`, `e022`, `e026`, `e030`, `e034`, `e036`, `e038`, `e040`, `e042`, `e044`, `e046`, `e048`, `e050`, `e052`, `e054`, `e065`, `e067`, `e081`, `e087`, `e089`, `e091`, `e093`, `e094`, `e096`, `e098`, `e102`, `e104`, `e106`, `e108`, `e085`, `e086`, `e090`, `e109`, `e110`, `e115`, `e116`, `e118`, `e120`, `e122`, `e124`
- Current Situation 참조 Evidence: `e110`, `e115`
- Blocker 참조 Evidence: `e116`, `e118`, `e120`, `e122`, `e124`

### 5. 사람이 평가할 질문

1. 이 representation만 읽고 세션의 핵심 작업이 코드 통합/수정이라는 점이 분명한가?
2. Active goal이 “없음”인 것이 타당한가, 아니면 “quota reset 대기” 또는 “실행 가능 상태 회복”이 active goal이어야 하는가?
3. Previous goals가 Primary goal과 중복되지 않고 흐름을 설명하는가?
4. Goal shift detected가 “작업 진행”에서 “quota/blocker 확인”으로 바뀐 것을 잘 표현하는가?
5. Current Situation이 사용자 감정과 기술적 상태를 균형 있게 설명하는가?
6. Blocker가 명확하고 actionability가 있는가?
7. Evidence 수가 너무 많아 리뷰 부담을 늘리지는 않는가?
8. 이 representation을 보고 다음 작업자가 어떤 상태에서 이어받아야 하는지 알 수 있는가?

---

## Sample C — 중간 길이 상담/설명형 세션

- Sample ID: `conv_090_b16ead817e36`
- Evidence 수: 7

### 1. Goal Stack

- Primary goal: `agent-handoff` 프로젝트를 이해하고 효과적으로 사용한다. 특히 새 raw data를 통합하고 출력 결과를 이해하는 것이 중요하다.
  - Evidence: `e015`, `e017`, `e018`, `e021`
- Active goal: 사용자의 혼란을 줄이기 위해 프로젝트의 데이터 흐름과 출력 결과를 초보자도 이해할 수 있게 설명한다.
  - Evidence: `e021`, `e022`
- Previous goals:
  - OpenCode에서 sub-agent를 만드는 방법을 이해한다.
    - Evidence: `e013`, `e014`
  - 두 개의 새 raw data 파일을 `agent-handoff` 프로젝트의 데이터 파이프라인에 통합한다.
    - Evidence: `e015`, `e017`, `e018`
- Goal shift detected: `true`
- Goal shift evidence: `e014`, `e015`

### 2. Current Situation

사용자는 두 개의 새 raw data 파일을 `agent-handoff` 프로젝트의 데이터 파이프라인에 통합하고 ingestion/processing을 확인했다. 하지만 Codex가 정확히 무엇을 했는지와 결과를 어떻게 이해해야 하는지 혼란스러워하고 있으며, 에이전트는 이를 쉽게 설명하고 초보자용 문서 작성을 제안하는 중이다.

- Evidence: `e018`, `e021`, `e022`

### 3. Blocker

- Status: `present`
- Value: 사용자가 프로젝트 출력 결과와 Codex가 수행한 작업을 이해하기 어려워하고 있다.
- Evidence: `e021`

### 4. Evidence ID 목록

- 전체 Evidence IDs: `e015`, `e017`, `e018`, `e021`, `e022`, `e013`, `e014`
- Current Situation 참조 Evidence: `e018`, `e021`, `e022`
- Blocker 참조 Evidence: `e021`

### 5. 사람이 평가할 질문

1. 이 representation만 읽고 세션의 현재 목적을 빠르게 이해할 수 있는가?
2. Primary goal과 Active goal이 적절히 분리되어 있는가?
3. Previous goals가 짧은 세션에서도 도움이 되는가?
4. Goal shift detected가 실제 전환을 말하는가, 아니면 너무 민감하게 감지된 것인가?
5. Current Situation이 “현재 사용자가 어려워하는 지점”을 잘 표현하는가?
6. Blocker를 `present`로 보는 것이 타당한가, 아니면 `none_observed` 또는 약한 blocker가 더 적절한가?
7. Evidence 7개만으로 판단을 검증하기 충분한가?
8. 이 샘플은 Phase 0 human usefulness 평가에 포함할 가치가 있는가?

