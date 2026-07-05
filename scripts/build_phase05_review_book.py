from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional


ROOT = Path(__file__).resolve().parents[1]
REPRESENTATION_DIR = (
    ROOT / "outputs" / "representations_full_124_gemini_3_1_flash_lite"
)
SUMMARY_PATH = ROOT / "reports" / "phase05_representation_quality_summary.json"
OUTPUT_PATH = ROOT / "reviews" / "PHASE05_REPRESENTATION_REVIEW_BOOK.md"
MAX_EVIDENCE_ITEMS = 10
MAX_INLINE_CHARS = 180
MAX_EVIDENCE_CHARS = 260


def main() -> None:
    summary = load_json(SUMMARY_PATH)
    quality_by_id = {
        item["sample_id"]: item for item in summary.get("items", [])
    }
    representation_paths = sorted(
        REPRESENTATION_DIR.glob("*.representation.json")
    )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        render_review_book(summary, representation_paths, quality_by_id),
        encoding="utf-8",
    )
    print(OUTPUT_PATH)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def render_review_book(
    summary: dict[str, Any],
    representation_paths: list[Path],
    quality_by_id: dict[str, dict[str, Any]],
) -> str:
    lines: list[str] = []
    structure = summary.get("structure", {})
    blocker_dist = structure.get("blocker_status_distribution", {})

    lines.extend(
        [
            "# Phase 0.5 세션 표현 리뷰북",
            "",
            "## 요약",
            "",
            "이 문서는 Phase 0.5 Human Evaluation을 위해 생성된 124개 representation을 사람이 한 번에 훑어볼 수 있도록 렌더링한 리뷰북이다.",
            "",
            "새 API 호출 없이 이미 생성된 representation JSON 파일만 사용했다.",
            "",
            "| 항목 | 개수 |",
            "| --- | ---: |",
            f"| 전체 representation 개수 | {len(representation_paths)} |",
            f"| Goal Stack 비어 있음 | {structure.get('goal_stack_empty', 0)} |",
            f"| Current Situation 비어 있음 | {structure.get('current_situation_empty', 0)} |",
            f"| Active Goal 비어 있음 | {structure.get('active_goal_empty', 0)} |",
            f"| Blocker 있음 | {blocker_dist.get('present', 0)} |",
            f"| Blocker 관찰 안 됨 | {blocker_dist.get('none_observed', 0)} |",
            f"| Blocker 알 수 없음 | {blocker_dist.get('unknown', 0)} |",
            "",
            "## 리뷰 인덱스",
            "",
            "| 번호 | 대화 ID | 제목 | 목표 수 | 현재 목표 | 차단 상태 | 근거 수 | 표시 | 리뷰 상태 |",
            "| ---: | --- | --- | ---: | --- | --- | ---: | --- | --- |",
        ]
    )

    loaded: list[tuple[int, Path, dict[str, Any], dict[str, Any]]] = []
    for index, path in enumerate(representation_paths, start=1):
        conversation_id = path.name.removesuffix(".representation.json")
        representation = load_json(path)
        quality = quality_by_id.get(conversation_id, {})
        loaded.append((index, path, representation, quality))
        lines.append(
            render_index_row(index, conversation_id, representation, quality)
        )

    lines.append("")
    lines.append("---")
    lines.append("")

    for index, path, representation, quality in loaded:
        conversation_id = path.name.removesuffix(".representation.json")
        lines.extend(
            render_conversation_section(
                index,
                conversation_id,
                representation,
                quality,
            )
        )
        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def render_index_row(
    index: int,
    conversation_id: str,
    representation: dict[str, Any],
    quality: dict[str, Any],
) -> str:
    goal = representation.get("goal", {})
    active_goal = goal_entry_value(goal.get("active_goal"))
    evidence_count = len(representation.get("evidence", []) or [])
    blocker_status = (representation.get("blocker", {}) or {}).get(
        "status", ""
    )
    return (
        f"| {index} "
        f"| `{conversation_id}` "
        f"| {markdown_cell(title_if_available(representation))} "
        f"| {goal_count(goal)} "
        f"| {markdown_cell(shorten(active_goal or ''))} "
        f"| {markdown_cell(korean_blocker_status(blocker_status))} "
        f"| {evidence_count} "
        f"| {markdown_cell(markers(quality))} "
        f"|  |"
    )


def render_conversation_section(
    index: int,
    conversation_id: str,
    representation: dict[str, Any],
    quality: dict[str, Any],
) -> list[str]:
    title = title_if_available(representation)
    heading_title = f" - {title}" if title != "N/A" else ""
    goal = representation.get("goal", {}) or {}
    situation = representation.get("current_situation", {}) or {}
    blocker = representation.get("blocker", {}) or {}
    evidence = representation.get("evidence", []) or []
    primary = goal_entry_value(goal.get("primary_goal"))
    active = goal_entry_value(goal.get("active_goal"))
    previous = goal.get("previous_goals", []) or []
    blocker_status = blocker.get("status")
    blocker_value = blocker.get("value")
    blocker_evidence = blocker.get("evidence_ids", []) or []
    current_summary = situation.get("summary", "")
    flags = quality.get("flags", []) or []

    lines = [
        f"## [{index:03d}] {conversation_id}{heading_title}",
        "",
        "### 빠른 확인",
        "",
        f"- 주요 목표: {primary or '없음'}",
        f"- 현재 목표: {active or '없음'}",
        f"- 현재 상황: {current_summary or '없음'}",
        f"- 차단 요소: {blocker_value or korean_blocker_status(blocker_status) or '없음'}",
        f"- 근거 수: {len(evidence)}",
        f"- 리뷰 표시: {markers(quality) or '없음'}",
        "",
        "### 목표 스택",
        "",
        f"- 주요 목표: {primary or '없음'}",
        f"- 현재 목표: {active or '없음'}",
        "- 이전 목표:",
    ]

    if previous:
        for item in previous:
            lines.append(f"  - {goal_entry_value(item) or '없음'}")
    else:
        lines.append("  - 없음")

    lines.extend(
        [
            "",
            "### 현재 상황",
            "",
            current_summary or "없음",
            "",
            "### 차단 요소",
            "",
            f"- 상태: {korean_blocker_status(blocker_status)}",
            f"- 설명: {blocker_value or '없음'}",
            f"- 근거: {', '.join(f'`{item}`' for item in blocker_evidence) or '없음'}",
            "",
            "### 근거",
            "",
        ]
    )

    lines.extend(render_evidence(evidence))

    lines.extend(
        [
            "",
            "### Human Evaluation",
            "",
            "- [ ] 원래 대화가 바로 떠오른다",
            "- [ ] Goal Stack이 자연스럽다",
            "- [ ] Current Situation이 현재 상태를 잘 설명한다",
            "- [ ] Blocker가 적절하다",
            "- [ ] Evidence가 충분하다",
            "- [ ] 이 Representation만으로 세션을 이어받을 수 있다",
            "- [ ] Raw conversation을 다시 열어보고 싶다",
            "",
            "Overall:",
            "",
            "- [ ] PASS",
            "- [ ] MINOR ISSUE",
            "- [ ] MAJOR ISSUE",
            "",
            "Notes:",
            "",
        ]
    )

    if flags:
        lines.extend(
            [
                "<!--",
                f"Auto-detected flags: {', '.join(flags)}",
                "-->",
            ]
        )

    return lines


def render_evidence(evidence: list[dict[str, Any]]) -> list[str]:
    if not evidence:
        return ["없음"]

    lines = []
    visible = evidence[:MAX_EVIDENCE_ITEMS]
    for item in visible:
        evidence_id = item.get("id", "")
        event_type = item.get("type", "")
        source_line = item.get("source_line", "")
        content = shorten(
            normalize_space(item.get("content", "")),
            limit=MAX_EVIDENCE_CHARS,
        )
        lines.append(
            f"- `{evidence_id}` (`{korean_event_type(event_type)}`, line {source_line}): {content}"
        )

    remaining = len(evidence) - len(visible)
    if remaining > 0:
        lines.append(f"- ... {remaining}개 더 있음")
    return lines


def title_if_available(representation: dict[str, Any]) -> str:
    for key in ("title", "conversation_title", "name"):
        value = representation.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return "없음"


def goal_entry_value(entry: Any) -> Optional[str]:
    if isinstance(entry, dict):
        value = entry.get("value")
        return value if isinstance(value, str) and value.strip() else None
    if isinstance(entry, str) and entry.strip():
        return entry
    return None


def goal_count(goal: dict[str, Any]) -> int:
    count = 0
    if goal_entry_value(goal.get("primary_goal")):
        count += 1
    if goal_entry_value(goal.get("active_goal")):
        count += 1
    count += len(goal.get("previous_goals", []) or [])
    return count


def markers(quality: dict[str, Any]) -> str:
    marker_values: list[str] = []
    flags = quality.get("flags", []) or []
    blocker_status = quality.get("blocker_status")
    if blocker_status == "present":
        marker_values.append("차단요소")
    if "too_short_representation" in flags:
        marker_values.append("짧음")
    if "goal_stack_empty" in flags:
        marker_values.append("Goal 비어 있음")
    if "blocker_empty_or_unknown_long_session" in flags:
        marker_values.append("긴 대화/Blocker 없음")
    if quality.get("goal_shift_detected"):
        marker_values.append("Goal 전환")
    return ", ".join(marker_values)


def korean_blocker_status(status: Any) -> str:
    return {
        "present": "`present` / 있음",
        "none_observed": "`none_observed` / 관찰 안 됨",
        "unknown": "`unknown` / 알 수 없음",
    }.get(str(status), str(status or "없음"))


def korean_event_type(event_type: Any) -> str:
    return {
        "user_message": "사용자 메시지",
        "assistant_message": "assistant 메시지",
        "tool_call": "tool call",
        "tool_result": "tool result",
        "system_event": "system event",
    }.get(str(event_type), str(event_type or "unknown"))


def markdown_cell(value: str) -> str:
    text = normalize_space(value)
    text = text.replace("|", "\\|")
    return text or " "


def normalize_space(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def shorten(value: str, limit: int = MAX_INLINE_CHARS) -> str:
    value = normalize_space(value)
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "…"


if __name__ == "__main__":
    main()
