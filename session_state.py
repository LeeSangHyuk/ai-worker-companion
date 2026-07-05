from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal


REDACTION = "****REDACTED****"

PRIVATE_KEY_BLOCK_RE = re.compile(
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----",
    re.DOTALL,
)
BEARER_TOKEN_RE = re.compile(r"(?i)\b(Bearer)\s+[A-Za-z0-9._~+/=-]{8,}")
SENSITIVE_ASSIGNMENT_RE = re.compile(
    r"""
    \b(
        api[_-]?key
        | juso[_-]?key
        | servicekey
        | confmkey
        | access[_\s-]?token
        | bearer[_\s-]?token
        | password
        | secret
        | private[_\s-]?key
        | token
    )\b
    (\s*[:=]\s*)
    (["']?)
    ([^"'\s&;,<>]+)
    (["']?)
    """,
    re.IGNORECASE | re.VERBOSE,
)
EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")

Status = Literal["blocked", "healthy", "unknown", "low-context"]


@dataclass(frozen=True)
class SessionRecord:
    path: Path
    representation: dict[str, Any]


def as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def text_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("value", "summary", "description", "content", "text"):
            if isinstance(value.get(key), str):
                return value[key]
    return str(value)


def sanitize_text(value: str) -> str:
    """Mask sensitive values in CLI handoff output without modifying source JSON."""
    if not value:
        return value

    sanitized = PRIVATE_KEY_BLOCK_RE.sub(REDACTION, value)
    sanitized = BEARER_TOKEN_RE.sub(r"\1 " + REDACTION, sanitized)

    def replace_assignment(match: re.Match[str]) -> str:
        key = match.group(1)
        separator = match.group(2)
        quote = match.group(3) or match.group(5) or ""
        if quote:
            return f"{key}{separator}{quote}{REDACTION}{quote}"
        return f"{key}{separator}{REDACTION}"

    sanitized = SENSITIVE_ASSIGNMENT_RE.sub(replace_assignment, sanitized)
    sanitized = EMAIL_RE.sub("****REDACTED_EMAIL****", sanitized)
    return sanitized


def load_representation(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise SystemExit(f"Input file not found: {path}") from None
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON file: {path} ({exc})") from None


def goal_stack(rep: dict[str, Any]) -> dict[str, Any]:
    return as_dict(rep.get("goal_stack") or rep.get("goal") or {})


def primary_goal(rep: dict[str, Any]) -> str:
    return text_value(goal_stack(rep).get("primary_goal")).strip()


def active_goal(rep: dict[str, Any]) -> str:
    return text_value(goal_stack(rep).get("active_goal")).strip()


def previous_goals(rep: dict[str, Any]) -> list[str]:
    values: list[str] = []
    for item in as_list(goal_stack(rep).get("previous_goals")):
        value = text_value(item).strip()
        if value:
            values.append(value)
    return values


def current_situation(rep: dict[str, Any]) -> str:
    situation = as_dict(rep.get("current_situation") or rep.get("situation"))
    return text_value(situation.get("summary") or situation.get("value")).strip()


def blocker(rep: dict[str, Any]) -> dict[str, str]:
    item = as_dict(rep.get("blocker"))
    status = text_value(item.get("status")).strip() or "unknown"
    description = text_value(
        item.get("description") or item.get("value") or item.get("summary")
    ).strip()
    return {"status": status, "description": description}


def evidence_items(rep: dict[str, Any]) -> list[dict[str, str]]:
    raw_items = as_list(rep.get("evidence") or rep.get("evidence_items"))
    items: list[dict[str, str]] = []
    for index, item in enumerate(raw_items, start=1):
        item_dict = as_dict(item)
        evidence_id = text_value(item_dict.get("id") or item_dict.get("evidence_id") or f"e{index:03d}")
        content = text_value(
            item_dict.get("content")
            or item_dict.get("quote")
            or item_dict.get("snippet")
            or item_dict.get("text")
            or item_dict.get("summary")
        )
        items.append({"id": evidence_id, "content": sanitize_text(content)})
    return items


def normalized_status(rep: dict[str, Any]) -> Status:
    current_blocker = blocker(rep)
    if current_blocker["status"] == "present":
        return "blocked"
    if current_blocker["status"] == "unknown":
        return "unknown"
    if not active_goal(rep) or len(evidence_items(rep)) <= 1:
        return "low-context"
    return "healthy"


def next_action(rep: dict[str, Any]) -> str:
    current_blocker = blocker(rep)
    current_goal = active_goal(rep)

    if current_blocker["status"] == "present":
        return "Resolve or clarify the blocker before continuing the current goal."
    if current_goal:
        return "Continue from the current goal without restarting from scratch."
    return "Review the session context and identify the current goal before taking action."


def session_payload(record: SessionRecord) -> dict[str, Any]:
    rep = record.representation
    current_blocker = blocker(rep)
    return {
        "source": str(record.path),
        "status": normalized_status(rep),
        "current_goal": active_goal(rep),
        "primary_goal": primary_goal(rep),
        "previous_goals": previous_goals(rep),
        "current_situation": current_situation(rep),
        "blocker": current_blocker,
        "next_action": next_action(rep),
        "evidence": evidence_items(rep),
    }


def discover_records(input_path: Path) -> list[SessionRecord]:
    if input_path.is_file():
        return [SessionRecord(input_path, load_representation(input_path))]

    if not input_path.is_dir():
        raise SystemExit(f"Input path is not a file or directory: {input_path}")

    paths = sorted(input_path.glob("*.representation.json"))
    if not paths:
        raise SystemExit(f"No *.representation.json files found in: {input_path}")

    return [SessionRecord(path, load_representation(path)) for path in paths]


def filter_records(records: list[SessionRecord], status: str | None) -> list[SessionRecord]:
    if not status:
        return records
    return [record for record in records if normalized_status(record.representation) == status]


def select_records(
    records: list[SessionRecord],
    selection: str,
    limit: int,
) -> list[SessionRecord]:
    if selection == "recent":
        ordered = sorted(records, key=lambda record: record.path.stat().st_mtime, reverse=True)
    elif selection == "blocked":
        blocked = [record for record in records if normalized_status(record.representation) == "blocked"]
        ordered = blocked or records
    else:
        ordered = records

    return ordered[:limit]


def render_text(records: list[SessionRecord]) -> str:
    blocks: list[str] = []
    for record in records:
        payload = session_payload(record)
        current_blocker = payload["blocker"]
        blocks.append(
            "\n".join(
                [
                    "==================================",
                    "Session State",
                    "==================================",
                    "",
                    "Source",
                    payload["source"],
                    "",
                    "Status",
                    payload["status"],
                    "",
                    "Current Goal",
                    payload["current_goal"] or "Not specified.",
                    "",
                    "Current Situation",
                    payload["current_situation"] or "Not specified.",
                    "",
                    "Blocker",
                    f"status: {current_blocker['status']}",
                    f"description: {current_blocker['description'] or 'Not specified.'}",
                    "",
                    "Next Action",
                    payload["next_action"],
                    "",
                    "==================================",
                ]
            )
        )
    return "\n\n".join(blocks)


def render_markdown(records: list[SessionRecord]) -> str:
    sections: list[str] = []
    for record in records:
        payload = session_payload(record)
        current_blocker = payload["blocker"]
        previous = payload["previous_goals"] or []
        evidence = payload["evidence"][:5]

        lines = [
            "# Session State",
            "",
            f"- **Source:** `{payload['source']}`",
            f"- **Status:** `{payload['status']}`",
            "",
            "## Current Goal",
            "",
            payload["current_goal"] or "Not specified.",
            "",
            "## Current Situation",
            "",
            payload["current_situation"] or "Not specified.",
            "",
            "## Blocker",
            "",
            f"- **status:** `{current_blocker['status']}`",
            f"- **description:** {current_blocker['description'] or 'Not specified.'}",
            "",
            "## Previous Goals",
            "",
        ]
        lines.extend([f"- {goal}" for goal in previous] or ["- None"])
        lines.extend(
            [
                "",
                "## Key Evidence",
                "",
            ]
        )
        lines.extend([f"- **{item['id']}**: {item['content'] or 'No evidence content.'}" for item in evidence] or ["- None"])
        lines.extend(
            [
                "",
                "## Next Action",
                "",
                payload["next_action"],
            ]
        )
        sections.append("\n".join(lines))

    return "\n\n---\n\n".join(sections)


def render_json(records: list[SessionRecord]) -> str:
    payloads = [session_payload(record) for record in records]
    output: dict[str, Any] | list[dict[str, Any]]
    output = payloads[0] if len(payloads) == 1 else payloads
    return json.dumps(output, ensure_ascii=False, indent=2)


def render_resume_prompt(record: SessionRecord) -> str:
    payload = session_payload(record)
    current_blocker = payload["blocker"]
    previous = payload["previous_goals"]
    evidence = payload["evidence"][:5]

    previous_lines = "\n".join(f"- {goal}" for goal in previous) if previous else "- None"
    evidence_lines = (
        "\n".join(f"- {item['id']}: {item['content'] or 'No evidence content.'}" for item in evidence)
        if evidence
        else "- None"
    )

    return "\n".join(
        [
            "You are continuing an AI agent session.",
            "",
            "Current Goal:",
            payload["current_goal"] or "Not specified.",
            "",
            "Primary Goal:",
            payload["primary_goal"] or "Not specified.",
            "",
            "Previous Goals:",
            previous_lines,
            "",
            "Current Situation:",
            payload["current_situation"] or "Not specified.",
            "",
            "Blocker:",
            f"status: {current_blocker['status']}",
            f"description: {current_blocker['description'] or 'Not specified.'}",
            "",
            "Key Evidence:",
            evidence_lines,
            "",
            "Instructions:",
            "Continue from this state. Do not restart from scratch. Use the current goal and blocker as the immediate context.",
        ]
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read representation JSON files and print terminal-friendly session state."
    )
    parser.add_argument(
        "--input",
        required=True,
        type=Path,
        help="Path to a *.representation.json file or a directory containing representation files.",
    )
    parser.add_argument(
        "--format",
        choices=("text", "markdown", "json"),
        default="text",
        help="Output format for plugin/extension integrations.",
    )
    parser.add_argument(
        "--select",
        choices=("first", "recent", "blocked"),
        default="first",
        help="Selection strategy when --input is a directory.",
    )
    parser.add_argument(
        "--status",
        choices=("blocked", "healthy", "unknown", "low-context"),
        help="Filter sessions by normalized status.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=1,
        help="Maximum number of sessions to output when --input is a directory.",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Print a resume prompt for continuing one selected AI agent session.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Legacy mode: print one original representation JSON file unchanged.",
    )
    return parser.parse_args()


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    args = parse_args()
    if args.limit < 1:
        raise SystemExit("--limit must be >= 1")

    if args.json:
        if not args.input.is_file():
            raise SystemExit("--json legacy mode requires --input to be a single file.")
        sys.stdout.write(args.input.read_text(encoding="utf-8"))
        return 0

    records = discover_records(args.input)
    records = filter_records(records, args.status)
    if not records:
        raise SystemExit("No sessions matched the requested filters.")

    selected = select_records(records, args.select, args.limit)

    if args.resume:
        print(render_resume_prompt(selected[0]))
        return 0

    if args.format == "markdown":
        print(render_markdown(selected))
    elif args.format == "json":
        print(render_json(selected))
    else:
        print(render_text(selected))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
