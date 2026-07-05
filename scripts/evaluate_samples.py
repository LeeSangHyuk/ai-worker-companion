from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from session_state.codex_log import load_codex_events
from session_state.extractor import Provider, default_model, extract_session_state
from session_state.models import FinalResult


@dataclass
class Evaluation:
    sample: str
    expected: Optional[FinalResult] = None
    actual: Optional[FinalResult] = None
    error: Optional[str] = None

    @property
    def blocker_match(self) -> bool:
        return bool(
            self.expected
            and self.actual
            and self.actual.blocker.status == self.expected.blocker.status
        )

    @property
    def expected_evidence_ids(self) -> set[str]:
        return referenced_evidence_ids(self.expected) if self.expected else set()

    @property
    def actual_evidence_ids(self) -> set[str]:
        return referenced_evidence_ids(self.actual) if self.actual else set()

    @property
    def evidence_overlap(self) -> set[str]:
        return self.expected_evidence_ids & self.actual_evidence_ids

    @property
    def evidence_match(self) -> bool:
        return bool(self.evidence_overlap)

    @property
    def passed(self) -> bool:
        return bool(
            not self.error
            and self.blocker_match
            and self.evidence_match
        )


def referenced_evidence_ids(result: FinalResult) -> set[str]:
    goals = [
        result.goal.primary_goal,
        result.goal.active_goal,
        *result.goal.previous_goals,
    ]
    return {
        *(evidence_id for goal in goals for evidence_id in goal.evidence_ids),
        *result.goal.goal_shift_evidence,
        *result.current_situation.evidence_ids,
        *result.blocker.evidence_ids,
    }


def evaluate_sample(session_path: Path, model: str, provider: Provider) -> Evaluation:
    expected_path = session_path.with_suffix(".expected.json")
    evaluation = Evaluation(sample=session_path.stem)

    try:
        if not expected_path.exists():
            raise FileNotFoundError(f"missing expected file: {expected_path}")

        evaluation.expected = FinalResult.model_validate_json(
            expected_path.read_text(encoding="utf-8")
        )
        events = load_codex_events(session_path)
        _validate_expected_evidence(
            evaluation.expected,
            events,
            expected_path,
        )
        evaluation.actual = extract_session_state(
            events,
            model=model,
            provider=provider,
        )
    except Exception as exc:
        evaluation.error = str(exc)

    return evaluation


def _validate_expected_evidence(
    expected: FinalResult,
    events: list,
    expected_path: Path,
) -> None:
    available_ids = {event.id for event in events}
    referenced_ids = referenced_evidence_ids(expected) | {
        evidence.id for evidence in expected.evidence
    }
    invalid_ids = sorted(referenced_ids - available_ids)
    if invalid_ids:
        raise ValueError(
            f"{expected_path.name} references evidence IDs not present in "
            f"the normalized JSONL: {', '.join(invalid_ids)}"
        )


def status(value: bool) -> str:
    return "PASS" if value else "FAIL"


def cell_status(item: Evaluation, value: bool) -> str:
    return "ERROR" if item.error else status(value)


def print_table(evaluations: list[Evaluation]) -> None:
    headers = [
        "Sample",
        "Goal",
        "Situation",
        "Blocker",
        "Evidence",
        "Overall",
    ]
    rows = [
        [
            item.sample,
            "ERROR" if item.error else "REVIEW",
            "ERROR" if item.error else "REVIEW",
            cell_status(item, item.blocker_match),
            cell_status(item, item.evidence_match),
            cell_status(item, item.passed),
        ]
        for item in evaluations
    ]
    widths = [
        max(len(headers[index]), *(len(row[index]) for row in rows))
        for index in range(len(headers))
    ]

    def render(row: list[str]) -> str:
        return " | ".join(value.ljust(widths[index]) for index, value in enumerate(row))

    print(render(headers))
    print("-+-".join("-" * width for width in widths))
    for row in rows:
        print(render(row))


def print_diffs(evaluations: list[Evaluation]) -> None:
    for item in evaluations:
        print(f"\n[{item.sample}]")
        if item.error:
            print(f"  ERROR: {item.error}")
            continue

        assert item.expected is not None
        assert item.actual is not None

        print("  Goal Stack (manual review):")
        print(
            f"    primary expected: {item.expected.goal.primary_goal.value!r}"
        )
        print(
            f"    primary actual:   {item.actual.goal.primary_goal.value!r}"
        )
        print(
            f"    active expected:  {item.expected.goal.active_goal.value!r}"
        )
        print(
            f"    active actual:    {item.actual.goal.active_goal.value!r}"
        )
        print(
            "    previous expected: "
            f"{[goal.value for goal in item.expected.goal.previous_goals]!r}"
        )
        print(
            "    previous actual:   "
            f"{[goal.value for goal in item.actual.goal.previous_goals]!r}"
        )
        print(
            f"    shift expected: {item.expected.goal.goal_shift_detected}"
        )
        print(
            f"    shift actual:   {item.actual.goal.goal_shift_detected}"
        )
        shift_overlap = set(item.expected.goal.goal_shift_evidence) & set(
            item.actual.goal.goal_shift_evidence
        )
        print(f"    shift evidence overlap: {sorted(shift_overlap)}")

        print("  Current Situation (manual review):")
        print(f"    expected: {item.expected.current_situation.summary!r}")
        print(f"    actual:   {item.actual.current_situation.summary!r}")

        if not item.blocker_match:
            print("  Blocker status:")
            print(f"    expected: {item.expected.blocker.status}")
            print(f"    actual:   {item.actual.blocker.status}")

        print("  Evidence IDs:")
        print(f"    expected: {sorted(item.expected_evidence_ids)}")
        print(f"    actual:   {sorted(item.actual_evidence_ids)}")
        print(f"    overlap:  {sorted(item.evidence_overlap)}")

        if item.passed:
            print("  Result: PASS")
        elif item.blocker_match:
            print("  Result: FAIL (no evidence overlap)")
        else:
            print("  Result: FAIL")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run the session-state extractor against labeled ChatGPT samples."
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=ROOT / "raw_data",
        help="directory containing JSONL files and matching .expected.json files",
    )
    parser.add_argument(
        "--provider",
        choices=("openai", "gemini"),
        default="openai",
        help="LLM provider (default: openai)",
    )
    parser.add_argument(
        "--model",
        default=None,
        help="model name (provider-specific environment/default when omitted)",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    session_paths = sorted(
        path
        for path in args.data_dir.glob("*.jsonl")
        if path.with_suffix(".expected.json").exists()
    )
    if not session_paths:
        raise SystemExit(
            f"no JSONL files with matching .expected.json found in {args.data_dir}"
        )

    model = args.model or default_model(args.provider)
    evaluations = [
        evaluate_sample(path, model=model, provider=args.provider)
        for path in session_paths
    ]
    print_table(evaluations)
    print_diffs(evaluations)

    passed = sum(item.passed for item in evaluations)
    print(f"\nOverall: {passed}/{len(evaluations)} samples passed")
    raise SystemExit(0 if passed == len(evaluations) else 1)


if __name__ == "__main__":
    main()
