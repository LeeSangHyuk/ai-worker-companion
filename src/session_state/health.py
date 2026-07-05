import hashlib
import json
import re
from typing import Literal

from pydantic import BaseModel, Field

from .models import Event


HealthStatus = Literal["healthy", "watch", "needs_attention", "unknown"]
SignalType = Literal["repeated_command", "repeated_error"]

MIN_TOOL_EVENTS = 2
REPEATED_COMMAND_THRESHOLD = 3
REPEATED_ERROR_THRESHOLD = 2

_ANSI_ESCAPE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
_ERROR_PATTERN = re.compile(
    r"(?:\b(?:error|exception|traceback|fatal|failed|failure)\b"
    r"|permission denied|timed out|timeout"
    r"|exit(?:_code| code)?\s*[:=]?\s*[1-9]\d*"
    r"|\b(?:오류|실패|시간 초과)\b|권한.{0,8}거부|찾을 수 없)",
    re.IGNORECASE,
)
_SUCCESS_PATTERN = re.compile(
    r"(?:\b(?:success|succeeded|completed|passed|ok)\b"
    r"|exit(?:_code| code)?\s*[:=]?\s*0\b"
    r"|no broken requirements found|\b성공|완료됨?)",
    re.IGNORECASE,
)
_ZERO_FAILURES = re.compile(
    r"\b0\s+(?:errors?|failures?|failed)\b", re.IGNORECASE
)
_STATE_CHANGE_TOOLS = {
    "apply_patch",
    "write_file",
    "edit_file",
    "create_file",
    "delete_file",
    "move_file",
    "rename_file",
}


class HealthSignal(BaseModel):
    type: SignalType
    message: str
    evidence_ids: list[str] = Field(min_length=1)


class HealthResult(BaseModel):
    health: HealthStatus
    signals: list[HealthSignal] = Field(default_factory=list)


def check_session_health(events: list[Event]) -> HealthResult:
    tool_events = [
        event for event in events if event.type in {"tool_call", "tool_result"}
    ]
    if len(tool_events) < MIN_TOOL_EVENTS:
        return HealthResult(health="unknown")

    command_occurrences: dict[str, list[str]] = {}
    error_occurrences: dict[str, list[str]] = {}

    for event in events:
        if event.type == "tool_call":
            if _is_state_change_tool_call(event.content):
                command_occurrences.clear()
                error_occurrences.clear()
                continue

            fingerprint = _fingerprint(_normalize_command(event.content))
            command_occurrences.setdefault(fingerprint, []).append(event.id)
            continue

        if event.type != "tool_result":
            continue

        if _is_error(event.content):
            fingerprint = _fingerprint(_normalize_text(event.content))
            error_occurrences.setdefault(fingerprint, []).append(event.id)
        elif _is_clear_success(event.content):
            command_occurrences.clear()
            error_occurrences.clear()

    signals: list[HealthSignal] = []

    for evidence_ids in error_occurrences.values():
        if len(evidence_ids) >= REPEATED_ERROR_THRESHOLD:
            signals.append(
                HealthSignal(
                    type="repeated_error",
                    message=(
                        "The same error occurred "
                        f"{len(evidence_ids)} times without a clear success."
                    ),
                    evidence_ids=evidence_ids,
                )
            )

    for evidence_ids in command_occurrences.values():
        if len(evidence_ids) >= REPEATED_COMMAND_THRESHOLD:
            signals.append(
                HealthSignal(
                    type="repeated_command",
                    message=(
                        "The same command was issued "
                        f"{len(evidence_ids)} times without a state change."
                    ),
                    evidence_ids=evidence_ids,
                )
            )

    if any(signal.type == "repeated_error" for signal in signals):
        health: HealthStatus = "needs_attention"
    elif any(signal.type == "repeated_command" for signal in signals):
        health = "watch"
    else:
        health = "healthy"

    return HealthResult(health=health, signals=signals)


def _normalize_command(content: str) -> str:
    normalized = _normalize_text(content)
    name, separator, arguments = normalized.partition(":")
    if not separator:
        return normalized

    try:
        parsed = json.loads(arguments.strip())
    except (json.JSONDecodeError, TypeError):
        return normalized

    canonical_arguments = json.dumps(
        parsed,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return f"{name.strip()}:{canonical_arguments}"


def _normalize_text(content: str) -> str:
    without_ansi = _ANSI_ESCAPE.sub("", content)
    return " ".join(without_ansi.strip().split()).casefold()


def _fingerprint(normalized: str) -> str:
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _is_error(content: str) -> bool:
    normalized = _normalize_text(content)
    normalized = _ZERO_FAILURES.sub("", normalized)
    return bool(_ERROR_PATTERN.search(normalized))


def _is_clear_success(content: str) -> bool:
    return bool(_SUCCESS_PATTERN.search(_normalize_text(content)))


def _is_state_change_tool_call(content: str) -> bool:
    normalized = _normalize_text(content)
    tool_name = normalized.partition(":")[0].strip()
    return (
        tool_name in _STATE_CHANGE_TOOLS
        or "tools.apply_patch(" in normalized
        or "apply_patch(" in normalized
    )
