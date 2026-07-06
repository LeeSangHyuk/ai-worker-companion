"""Deprecated log-based health watcher PoC for OpenCode.

DEPRECATED: Do not use log file mtime as the OpenCode health source of truth.
Real OpenCode `run` verification showed that `~/.local/share/opencode/log/*.log`
may stop appending while a session is actively running, causing false "stuck"
results. Use `db_health_watcher.py`, which reads `opencode.db` part rows and
uses `opencode.db-wal` only as a refresh trigger.

This is intentionally independent from the Session State extractor, schema, and
session_state.py. It reads a single log/transcript-like file and emits stable
JSON that a future OpenCode plugin view can consume.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Literal


Health = Literal["active", "quiet", "stuck", "unknown"]

ERROR_PATTERN = re.compile(
    r"\b(error|exception|traceback|failed|failure|timeout|timed out|panic)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class LogSample:
    path: Path
    size: int
    mtime: float
    last_lines: list[str]

    @property
    def last_line(self) -> str:
        for line in reversed(self.last_lines):
            if line.strip():
                return line.strip()
        return ""


def read_tail_lines(path: Path, max_lines: int) -> list[str]:
    with path.open("r", encoding="utf-8", errors="replace") as handle:
        if max_lines <= 0:
            return []
        return handle.readlines()[-max_lines:]


def sample_log(path: Path, tail_lines: int) -> LogSample:
    stat = path.stat()
    return LogSample(
        path=path,
        size=stat.st_size,
        mtime=stat.st_mtime,
        last_lines=read_tail_lines(path, tail_lines),
    )


def count_repeated_suffix(lines: list[str]) -> int:
    normalized = [line.strip() for line in lines if line.strip()]
    if not normalized:
        return 0

    last = normalized[-1]
    count = 0
    for line in reversed(normalized):
        if line != last:
            break
        count += 1
    return count


def count_repeated_error_suffix(lines: list[str]) -> int:
    count = 0
    for line in reversed(lines):
        stripped = line.strip()
        if not stripped:
            continue
        if not ERROR_PATTERN.search(stripped):
            break
        count += 1
    return count


def build_result(
    *,
    health: Health,
    reason: str,
    source: Path,
    last_activity_seconds: int | None,
    sample: LogSample | None = None,
    quiet_threshold: int,
    stuck_threshold: int,
    repeated_line_count: int = 0,
    repeated_error_count: int = 0,
) -> dict[str, object]:
    result: dict[str, object] = {
        "health": health,
        "reason": reason,
        "last_activity_seconds": last_activity_seconds,
        "source": str(source),
        "quiet_threshold_seconds": quiet_threshold,
        "stuck_threshold_seconds": stuck_threshold,
    }

    if sample is not None:
        result.update(
            {
                "size_bytes": sample.size,
                "mtime": int(sample.mtime),
                "last_line": sample.last_line,
                "repeated_line_count": repeated_line_count,
                "repeated_error_count": repeated_error_count,
            }
        )

    return result


def assess_health(
    path: Path,
    *,
    quiet_threshold: int,
    stuck_threshold: int,
    tail_lines: int,
    repeated_line_threshold: int,
    repeated_error_threshold: int,
    now: float | None = None,
) -> dict[str, object]:
    current_time = time.time() if now is None else now

    if not path.exists():
        return build_result(
            health="unknown",
            reason="Log file does not exist.",
            source=path,
            last_activity_seconds=None,
            quiet_threshold=quiet_threshold,
            stuck_threshold=stuck_threshold,
        )
    if not path.is_file():
        return build_result(
            health="unknown",
            reason="Log path is not a file.",
            source=path,
            last_activity_seconds=None,
            quiet_threshold=quiet_threshold,
            stuck_threshold=stuck_threshold,
        )

    try:
        sample = sample_log(path, tail_lines)
    except OSError as exc:
        return build_result(
            health="unknown",
            reason=f"Log file could not be read: {exc}",
            source=path,
            last_activity_seconds=None,
            quiet_threshold=quiet_threshold,
            stuck_threshold=stuck_threshold,
        )

    if sample.size == 0:
        return build_result(
            health="unknown",
            reason="Log file is empty.",
            source=path,
            last_activity_seconds=None,
            sample=sample,
            quiet_threshold=quiet_threshold,
            stuck_threshold=stuck_threshold,
        )

    last_activity_seconds = max(0, int(current_time - sample.mtime))
    repeated_line_count = count_repeated_suffix(sample.last_lines)
    repeated_error_count = count_repeated_error_suffix(sample.last_lines)

    if (
        repeated_error_threshold > 0
        and repeated_error_count >= repeated_error_threshold
        and last_activity_seconds >= quiet_threshold
    ):
        return build_result(
            health="stuck",
            reason=(
                "Repeated error-like log lines observed and no recent append "
                f"for {last_activity_seconds}s."
            ),
            source=path,
            last_activity_seconds=last_activity_seconds,
            sample=sample,
            quiet_threshold=quiet_threshold,
            stuck_threshold=stuck_threshold,
            repeated_line_count=repeated_line_count,
            repeated_error_count=repeated_error_count,
        )

    if (
        repeated_line_threshold > 0
        and repeated_line_count >= repeated_line_threshold
        and last_activity_seconds >= quiet_threshold
    ):
        return build_result(
            health="stuck",
            reason=(
                f"The same last line repeated {repeated_line_count} times and "
                f"the log has been quiet for {last_activity_seconds}s."
            ),
            source=path,
            last_activity_seconds=last_activity_seconds,
            sample=sample,
            quiet_threshold=quiet_threshold,
            stuck_threshold=stuck_threshold,
            repeated_line_count=repeated_line_count,
            repeated_error_count=repeated_error_count,
        )

    if last_activity_seconds <= quiet_threshold:
        health: Health = "active"
        reason = f"Log appended {last_activity_seconds}s ago."
    elif last_activity_seconds >= stuck_threshold:
        health = "stuck"
        reason = (
            f"No log append for {last_activity_seconds}s, exceeding the "
            f"{stuck_threshold}s stuck threshold."
        )
    else:
        health = "quiet"
        reason = (
            f"No recent append for {last_activity_seconds}s, but this is below "
            f"the {stuck_threshold}s stuck threshold."
        )

    return build_result(
        health=health,
        reason=reason,
        source=path,
        last_activity_seconds=last_activity_seconds,
        sample=sample,
        quiet_threshold=quiet_threshold,
        stuck_threshold=stuck_threshold,
        repeated_line_count=repeated_line_count,
        repeated_error_count=repeated_error_count,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Assess OpenCode health from a log or transcript file.",
    )
    parser.add_argument(
        "--log",
        required=True,
        help="Path to the OpenCode log or transcript file to inspect.",
    )
    parser.add_argument(
        "--quiet-threshold",
        type=int,
        default=60,
        help="Seconds since last append before the session is considered quiet.",
    )
    parser.add_argument(
        "--stuck-threshold",
        type=int,
        default=180,
        help="Seconds since last append before the session is considered stuck.",
    )
    parser.add_argument(
        "--tail-lines",
        type=int,
        default=200,
        help="Number of trailing lines to inspect for repeated lines/errors.",
    )
    parser.add_argument(
        "--repeated-line-threshold",
        type=int,
        default=3,
        help="Repeated identical trailing lines needed to classify stuck.",
    )
    parser.add_argument(
        "--repeated-error-threshold",
        type=int,
        default=3,
        help="Trailing error-like lines needed to classify stuck after quiet.",
    )
    return parser.parse_args()


def validate_args(args: argparse.Namespace) -> str | None:
    if args.quiet_threshold < 0:
        return "--quiet-threshold must be >= 0"
    if args.stuck_threshold < 0:
        return "--stuck-threshold must be >= 0"
    if args.stuck_threshold < args.quiet_threshold:
        return "--stuck-threshold must be >= --quiet-threshold"
    if args.tail_lines < 0:
        return "--tail-lines must be >= 0"
    if args.repeated_line_threshold < 0:
        return "--repeated-line-threshold must be >= 0"
    if args.repeated_error_threshold < 0:
        return "--repeated-error-threshold must be >= 0"
    return None


def main() -> int:
    args = parse_args()
    error = validate_args(args)
    if error:
        print(error, file=sys.stderr)
        return 2

    result = assess_health(
        Path(args.log).expanduser(),
        quiet_threshold=args.quiet_threshold,
        stuck_threshold=args.stuck_threshold,
        tail_lines=args.tail_lines,
        repeated_line_threshold=args.repeated_line_threshold,
        repeated_error_threshold=args.repeated_error_threshold,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["health"] != "unknown" else 1


if __name__ == "__main__":
    raise SystemExit(main())
