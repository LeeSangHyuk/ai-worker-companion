from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

from .codex_log import load_codex_events
from .health import HealthResult, SignalType, check_session_health


InterventionLabel = Literal["yes", "no", "uncertain"]
Outcome = Literal["TP", "FP", "FN", "TN", "unlabeled", "excluded"]


class HealthAnnotation(BaseModel):
    intervention_needed: InterventionLabel
    expected_signals: list[SignalType] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)
    notes: str = ""
    annotator: Optional[str] = None

    @model_validator(mode="after")
    def validate_annotation(self) -> "HealthAnnotation":
        if len(self.expected_signals) != len(set(self.expected_signals)):
            raise ValueError("expected_signals must not contain duplicates")
        if self.intervention_needed == "no" and self.expected_signals:
            raise ValueError("a no-intervention label cannot expect a signal")
        if self.intervention_needed == "yes" and not self.evidence_ids:
            raise ValueError("a yes-intervention label requires evidence_ids")
        return self


class HealthDatasetRecord(BaseModel):
    id: str = Field(min_length=1)
    session: str = Field(min_length=1)
    source: str = "unknown"
    cutoff: Optional[int] = Field(default=None, ge=1)
    annotation: Optional[HealthAnnotation] = None


class HealthCaseResult(BaseModel):
    id: str
    source: str
    session: str
    cutoff: Optional[int]
    detector: HealthResult
    annotation: Optional[HealthAnnotation]
    outcome: Outcome
    evidence_overlap: list[str] = Field(default_factory=list)


class DetectorMetrics(BaseModel):
    fired_sessions: int = 0
    signal_count: int = 0
    evidence_count: int = 0
    tp: int = 0
    fp: int = 0
    fn: int = 0
    tn: int = 0
    precision: Optional[float] = None
    recall: Optional[float] = None


class HealthEvaluationSummary(BaseModel):
    total_cases: int
    labeled_cases: int
    uncertain_cases: int
    unlabeled_cases: int
    tp: int
    fp: int
    fn: int
    tn: int
    precision: Optional[float]
    recall: Optional[float]
    detectors: dict[SignalType, DetectorMetrics]


class HealthEvaluationReport(BaseModel):
    summary: HealthEvaluationSummary
    cases: list[HealthCaseResult]


def load_health_dataset(manifest_path: Path) -> list[HealthDatasetRecord]:
    records: list[HealthDatasetRecord] = []
    seen_ids: set[str] = set()

    with manifest_path.open("r", encoding="utf-8") as handle:
        for line_number, raw_line in enumerate(handle, start=1):
            if not raw_line.strip():
                continue
            try:
                record = HealthDatasetRecord.model_validate_json(raw_line)
            except Exception as exc:
                raise ValueError(
                    f"invalid manifest record on line {line_number}: {exc}"
                ) from exc
            if record.id in seen_ids:
                raise ValueError(f"duplicate dataset id: {record.id}")
            seen_ids.add(record.id)
            records.append(record)

    if not records:
        raise ValueError("health evaluation manifest is empty")
    return records


def evaluate_health_dataset(manifest_path: Path) -> HealthEvaluationReport:
    records = load_health_dataset(manifest_path)
    cases = [evaluate_health_case(record, manifest_path) for record in records]
    return HealthEvaluationReport(
        summary=calculate_health_metrics(cases),
        cases=cases,
    )


def evaluate_health_case(
    record: HealthDatasetRecord,
    manifest_path: Path,
) -> HealthCaseResult:
    session_path = Path(record.session)
    if not session_path.is_absolute():
        session_path = manifest_path.parent / session_path
    session_path = session_path.resolve()

    events = load_codex_events(session_path, cutoff=record.cutoff)
    detector = check_session_health(events)
    event_ids = {event.id for event in events}

    annotation = record.annotation
    if annotation:
        invalid_ids = sorted(set(annotation.evidence_ids) - event_ids)
        if invalid_ids:
            raise ValueError(
                f"annotation for {record.id} references invalid evidence IDs: "
                + ", ".join(invalid_ids)
            )

    predicted_ids = {
        evidence_id
        for signal in detector.signals
        for evidence_id in signal.evidence_ids
    }
    manual_ids = set(annotation.evidence_ids) if annotation else set()

    return HealthCaseResult(
        id=record.id,
        source=record.source,
        session=str(session_path),
        cutoff=record.cutoff,
        detector=detector,
        annotation=annotation,
        outcome=_classify_outcome(detector, annotation),
        evidence_overlap=sorted(predicted_ids & manual_ids),
    )


def calculate_health_metrics(
    cases: list[HealthCaseResult],
) -> HealthEvaluationSummary:
    outcomes = [case.outcome for case in cases]
    tp = outcomes.count("TP")
    fp = outcomes.count("FP")
    fn = outcomes.count("FN")
    tn = outcomes.count("TN")

    detector_metrics = {
        signal_type: _calculate_detector_metrics(cases, signal_type)
        for signal_type in ("repeated_command", "repeated_error")
    }

    return HealthEvaluationSummary(
        total_cases=len(cases),
        labeled_cases=tp + fp + fn + tn,
        uncertain_cases=outcomes.count("excluded"),
        unlabeled_cases=outcomes.count("unlabeled"),
        tp=tp,
        fp=fp,
        fn=fn,
        tn=tn,
        precision=_safe_ratio(tp, tp + fp),
        recall=_safe_ratio(tp, tp + fn),
        detectors=detector_metrics,
    )


def _classify_outcome(
    detector: HealthResult,
    annotation: Optional[HealthAnnotation],
) -> Outcome:
    if annotation is None:
        return "unlabeled"
    if annotation.intervention_needed == "uncertain":
        return "excluded"

    predicted_positive = bool(detector.signals)
    actual_positive = annotation.intervention_needed == "yes"
    if predicted_positive and actual_positive:
        return "TP"
    if predicted_positive and not actual_positive:
        return "FP"
    if not predicted_positive and actual_positive:
        return "FN"
    return "TN"


def _calculate_detector_metrics(
    cases: list[HealthCaseResult],
    signal_type: SignalType,
) -> DetectorMetrics:
    fired_sessions = 0
    signal_count = 0
    evidence_count = 0
    tp = fp = fn = tn = 0

    for case in cases:
        matching_signals = [
            signal
            for signal in case.detector.signals
            if signal.type == signal_type
        ]
        predicted = bool(matching_signals)
        if predicted:
            fired_sessions += 1
            signal_count += len(matching_signals)
            evidence_count += sum(
                len(signal.evidence_ids) for signal in matching_signals
            )

        annotation = case.annotation
        if annotation is None or annotation.intervention_needed == "uncertain":
            continue
        expected = signal_type in annotation.expected_signals
        if predicted and expected:
            tp += 1
        elif predicted and not expected:
            fp += 1
        elif not predicted and expected:
            fn += 1
        else:
            tn += 1

    return DetectorMetrics(
        fired_sessions=fired_sessions,
        signal_count=signal_count,
        evidence_count=evidence_count,
        tp=tp,
        fp=fp,
        fn=fn,
        tn=tn,
        precision=_safe_ratio(tp, tp + fp),
        recall=_safe_ratio(tp, tp + fn),
    )


def _safe_ratio(numerator: int, denominator: int) -> Optional[float]:
    if denominator == 0:
        return None
    return numerator / denominator
