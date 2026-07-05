# Health Evaluation Dataset

## 구조

```text
evaluation/
  ANNOTATION_GUIDE.md
  health_manifest.jsonl
  sessions/
    codex-001.jsonl
    opencode-001.jsonl
  results/
    health-report.json
```

manifest의 각 줄은 하나의 checkpoint다.

```json
{
  "id": "codex-001-c42",
  "session": "sessions/codex-001.jsonl",
  "source": "codex",
  "cutoff": 42,
  "annotation": {
    "intervention_needed": "yes",
    "expected_signals": ["repeated_error"],
    "evidence_ids": ["e031", "e039"],
    "notes": "같은 빌드 오류가 수정 없이 반복됐다.",
    "annotator": "reviewer-a"
  }
}
```

아직 라벨하지 않은 레코드는 `annotation`을 `null`로 둔다. 같은 원본 세션의
여러 checkpoint를 서로 다른 `id`와 `cutoff`로 등록할 수 있다.

## 실행

```powershell
python scripts/evaluate_health.py evaluation/health_manifest.jsonl
python scripts/evaluate_health.py evaluation/health_manifest.jsonl `
  --output evaluation/results/health-report.json
python scripts/evaluate_health.py evaluation/health_manifest.jsonl `
  --show-events codex-001-c42
```

precision과 recall은 분모가 0이면 `N/A`로 출력한다. 라벨된 case가 10개
미만이면 결과를 provisional로 표시한다.
