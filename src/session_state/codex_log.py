import json
from pathlib import Path
from typing import Any, Optional, Tuple

from .models import Event, EventType


DIRECT_TYPES: dict[str, EventType] = {
    "user_message": "user_message",
    "assistant_message": "assistant_message",
    "tool_call": "tool_call",
    "tool_result": "tool_result",
    "system_event": "system_event",
}


def load_codex_events(path: Path, cutoff: Optional[int] = None) -> list[Event]:
    if cutoff is not None and cutoff < 1:
        raise ValueError("cutoff must be at least 1")

    events: list[Event] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, raw_line in enumerate(handle, start=1):
            if not raw_line.strip():
                continue
            try:
                record = json.loads(raw_line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"invalid JSON on source line {line_number}: {exc}") from exc

            normalized = _normalize_record(record)
            if normalized is None:
                continue

            event_type, content = normalized
            events.append(
                Event(
                    id=f"e{len(events) + 1:03d}",
                    type=event_type,
                    content=content,
                    source_line=line_number,
                )
            )

    if not events:
        raise ValueError("no supported Codex events found in the JSONL file")

    return events[:cutoff] if cutoff is not None else events


def _normalize_record(record: dict[str, Any]) -> Optional[Tuple[EventType, str]]:
    record_type = record.get("type")

    if record_type in DIRECT_TYPES:
        content = _extract_text(record.get("content"))
        return (DIRECT_TYPES[record_type], content) if content else None

    payload = record.get("payload")
    if not isinstance(payload, dict):
        return None

    if record_type == "response_item":
        return _normalize_response_item(payload)

    if record_type == "event_msg":
        return _normalize_event_message(payload)

    return None


def _normalize_response_item(payload: dict[str, Any]) -> Optional[Tuple[EventType, str]]:
    payload_type = payload.get("type")

    if payload_type == "message":
        role = payload.get("role")
        event_type: Optional[EventType] = {
            "user": "user_message",
            "assistant": "assistant_message",
            "system": "system_event",
            "developer": "system_event",
        }.get(role)
        content = _extract_text(payload.get("content"))
        return (event_type, content) if event_type and content else None

    if payload_type in {"function_call", "custom_tool_call"}:
        name = str(payload.get("name") or "tool")
        arguments = _extract_text(payload.get("arguments") or payload.get("input"))
        return "tool_call", f"{name}: {arguments}" if arguments else name

    if payload_type in {"function_call_output", "custom_tool_call_output"}:
        output = _extract_text(payload.get("output"))
        return ("tool_result", output) if output else None

    return None


def _normalize_event_message(payload: dict[str, Any]) -> Optional[Tuple[EventType, str]]:
    payload_type = payload.get("type")
    event_type: Optional[EventType] = {
        "user_message": "user_message",
        "agent_message": "assistant_message",
        "tool_call": "tool_call",
        "tool_result": "tool_result",
    }.get(payload_type)
    content = _extract_text(
        payload.get("message")
        or payload.get("content")
        or payload.get("text")
        or payload.get("output")
    )
    return (event_type, content) if event_type and content else None


def _extract_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        parts = [_extract_text(item) for item in value]
        return "\n".join(part for part in parts if part)
    if isinstance(value, dict):
        for key in ("text", "content", "message", "output"):
            if key in value:
                text = _extract_text(value[key])
                if text:
                    return text
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value).strip()
