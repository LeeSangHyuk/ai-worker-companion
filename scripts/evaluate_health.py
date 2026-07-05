from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Optional


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from session_state.codex_log import load_codex_events
from session_state.health_evaluation import (
    HealthCaseResult,
    HealthDatasetRecord,
    HealthEvaluationReport,
    evaluate_health_dataset,
    load_health_dataset,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Evaluate Session Health detectors against manual labels."
    )
    parser.add_argument("manifest", type=Path, help="JSONL evaluation manifest")
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="optional path for the complete JSON report",
    )
    parser.add_argument(
        "--show-events",
        metavar="CASE_ID",
        default=None,
        help="print normalized events for one case instead of evaluating",
    )
    parser.add_argument(
        "--summary-only",
        action="store_true",
        help="omit per-case evidence details",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    try:
        if args.show_events:
            _show_events(args.manifest, args.show_events)
            return

        report = evaluate_health_dataset(args.manifest)
    except Exception as exc:
        raise SystemExit(f"error: {exc}") from exc

    _print_case_table(report)
    _print_summary(report)
    if not args.summary_only:
        _print_case_details(report)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            report.model_dump_json(indent=2),
            encoding="utf-8",
        )
        print(f"\nJSON report: {args.output}")


def _show_events(manifest: Path, case_id: str) -> None:
    records = load_health_dataset(manifest)
    record = next((item for item in records if item.id == case_id), None)
    if record is None:
        raise ValueError(f"unknown case id: {case_id}")

    session_path = _resolve_session_path(manifest, record)
    events = load_codex_events(session_path, cutoff=record.cutoff)
    for event in events:
        print(f"[{event.id}][{event.type}] {event.content}")


def _resolve_session_path(
    manifest: Path,
    record: HealthDatasetRecord,
) -> Path:
    path = Path(record.session)
    if not path.is_absolute():
        path = manifest.parent / path
    return path.resolve()


def _print_case_table(report: HealthEvaluationReport) -> None:
    headers = [
        "Case",
        "Source",
        "Health",
        "Commands",
        "Errors",
        "Label",
        "Outcome",
    ]
    rows = []
    for case in report.cases:
        rows.append(
            [
                case.id,
                case.source,
                case.detector.health,
                str(_signal_count(case, "repeated_command")),
                str(_signal_count(case, "repeated_error")),
                (
                    case.annotation.intervention_needed
                    if case.annotation
                    else "unlabeled"
                ),
                case.outcome,
            ]
        )
    _print_table(headers, rows)


def _print_summary(report: HealthEvaluationReport) -> None:
    summary = report.summary
    print("\nIntervention metrics")
    print(
        f"  cases={summary.total_cases} labeled={summary.labeled_cases} "
        f"uncertain={summary.uncertain_cases} "
        f"unlabeled={summary.unlabeled_cases}"
    )
    print(f"  TP={summary.tp} FP={summary.fp} FN={summary.fn} TN={summary.tn}")
    print(f"  precision={_format_metric(summary.precision)}")
    print(f"  recall={_format_metric(summary.recall)}")
    if summary.labeled_cases < 10:
        print("  note=provisional metrics; fewer than 10 labeled cases")

    print("\nDetector metrics")
    headers = [
        "Detector",
        "Sessions",
        "Signals",
        "Evidence",
        "TP",
        "FP",
        "FN",
        "Precision",
        "Recall",
    ]
    rows = []
    for signal_type, metrics in summary.detectors.items():
        rows.append(
            [
                signal_type,
                str(metrics.fired_sessions),
                str(metrics.signal_count),
                str(metrics.evidence_count),
                str(metrics.tp),
                str(metrics.fp),
                str(metrics.fn),
                _format_metric(metrics.precision),
                _format_metric(metrics.recall),
            ]
        )
    _print_table(headers, rows)

    false_positives = [case.id for case in report.cases if case.outcome == "FP"]
    false_negatives = [case.id for case in report.cases if case.outcome == "FN"]
    print(f"\nFalse positives: {false_positives}")
    print(f"False negatives: {false_negatives}")


def _print_case_details(report: HealthEvaluationReport) -> None:
    print("\nEvidence details")
    for case in report.cases:
        print(f"\n[{case.id}] {case.outcome}")
        if case.detector.signals:
            for signal in case.detector.signals:
                print(
                    f"  detected {signal.type}: {signal.evidence_ids} "
                    f"- {signal.message}"
                )
        else:
            print("  detected: none")

        if case.annotation:
            print(
                "  manual: "
                f"{case.annotation.intervention_needed} "
                f"signals={case.annotation.expected_signals} "
                f"evidence={case.annotation.evidence_ids}"
            )
            if case.annotation.notes:
                print(f"  notes: {case.annotation.notes}")
        else:
            print("  manual: unlabeled")
        print(f"  evidence overlap: {case.evidence_overlap}")


def _signal_count(case: HealthCaseResult, signal_type: str) -> int:
    return sum(
        signal.type == signal_type for signal in case.detector.signals
    )


def _format_metric(value: Optional[float]) -> str:
    return "N/A" if value is None else f"{value:.3f}"


def _print_table(headers: list[str], rows: list[list[str]]) -> None:
    widths = [
        max(len(headers[index]), *(len(row[index]) for row in rows))
        for index in range(len(headers))
    ]

    def render(row: list[str]) -> str:
        return " | ".join(
            value.ljust(widths[index]) for index, value in enumerate(row)
        )

    print(render(headers))
    print("-+-".join("-" * width for width in widths))
    for row in rows:
        print(render(row))


if __name__ == "__main__":
    main()
