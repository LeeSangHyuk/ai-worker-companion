"""DB-based health watcher PoC for OpenCode.

This watcher treats OpenCode's SQLite `part` table as the source of truth,
uses the WAL file only as a cheap refresh signal, and still re-checks the DB on
each polling interval as a safety net.

It intentionally does not modify the plugin, Session State analyzer, schema,
extractor, or recovery behavior.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal


Health = Literal["active", "quiet", "stuck", "failed", "idle", "unknown"]


@dataclass(frozen=True)
class WalState:
    path: Path
    exists: bool
    size_bytes: int | None
    mtime: int | None
    mtime_ns: int | None

    @property
    def signature(self) -> tuple[bool, int | None, int | None]:
        return (self.exists, self.size_bytes, self.mtime_ns)


@dataclass(frozen=True)
class SessionRow:
    id: str
    title: str
    directory: str
    time_created: int
    time_updated: int


@dataclass(frozen=True)
class PartRow:
    id: str
    time_created: int
    time_updated: int
    data: dict[str, Any]


def wal_path_for(db_path: Path) -> Path:
    return Path(f"{db_path}-wal")


def read_wal_state(db_path: Path) -> WalState:
    wal_path = wal_path_for(db_path)
    try:
        stat = wal_path.stat()
    except FileNotFoundError:
        return WalState(
            path=wal_path,
            exists=False,
            size_bytes=None,
            mtime=None,
            mtime_ns=None,
        )
    return WalState(
        path=wal_path,
        exists=True,
        size_bytes=stat.st_size,
        mtime=int(stat.st_mtime),
        mtime_ns=stat.st_mtime_ns,
    )


def connect_readonly(db_path: Path) -> sqlite3.Connection:
    uri = f"file:{db_path}?mode=ro"
    connection = sqlite3.connect(uri, uri=True, timeout=1)
    connection.row_factory = sqlite3.Row
    return connection


def fetch_session(connection: sqlite3.Connection, selector: str) -> SessionRow | None:
    if selector == "latest":
        row = connection.execute(
            """
            select id, title, directory, time_created, time_updated
            from session
            order by time_updated desc
            limit 1
            """
        ).fetchone()
    else:
        row = connection.execute(
            """
            select id, title, directory, time_created, time_updated
            from session
            where id = ?
            limit 1
            """,
            (selector,),
        ).fetchone()

    if row is None:
        return None
    return SessionRow(
        id=row["id"],
        title=row["title"],
        directory=row["directory"],
        time_created=int(row["time_created"]),
        time_updated=int(row["time_updated"]),
    )


def parse_part(row: sqlite3.Row) -> PartRow | None:
    try:
        data = json.loads(row["data"])
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    return PartRow(
        id=row["id"],
        time_created=int(row["time_created"]),
        time_updated=int(row["time_updated"]),
        data=data,
    )


def fetch_latest_tool_part(
    connection: sqlite3.Connection,
    session_id: str,
) -> PartRow | None:
    rows = connection.execute(
        """
        select id, time_created, time_updated, data
        from part
        where session_id = ?
        order by time_updated desc
        limit 100
        """,
        (session_id,),
    ).fetchall()

    for row in rows:
        part = parse_part(row)
        if part is not None and part.data.get("type") == "tool":
            return part
    return None


def milliseconds_to_seconds(value: int | float | None) -> int | None:
    if value is None:
        return None
    return int(value / 1000)


def tool_elapsed_seconds(part: PartRow, now_ms: int) -> int | None:
    state = part.data.get("state")
    if not isinstance(state, dict):
        return None
    tool_time = state.get("time")
    started_at = None
    ended_at = None
    if isinstance(tool_time, dict):
        started_at = tool_time.get("start")
        ended_at = tool_time.get("end")
    if started_at is None:
        started_at = part.time_updated
    try:
        end_or_now = now_ms if ended_at is None else int(ended_at)
        return max(0, int((end_or_now - int(started_at)) / 1000))
    except (TypeError, ValueError):
        return None


def tool_field(part: PartRow | None, path: tuple[str, ...]) -> Any:
    current: Any = part.data if part is not None else None
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def fixed_result(
    *,
    health: Health,
    reason: str,
    db_path: Path,
    wal_state: WalState,
    refresh_reason: str,
    quiet_threshold: int,
    stuck_threshold: int,
    checked_at: int,
    session_selector: str,
    session: SessionRow | None = None,
    tool_part: PartRow | None = None,
    last_activity_seconds: int | None = None,
    tool_elapsed: int | None = None,
) -> dict[str, Any]:
    start_ms = tool_field(tool_part, ("state", "time", "start"))
    end_ms = tool_field(tool_part, ("state", "time", "end"))
    return {
        "health": health,
        "reason": reason,
        "source": str(db_path),
        "checked_at": checked_at,
        "refresh_reason": refresh_reason,
        "session": {
            "selector": session_selector,
            "id": session.id if session else None,
            "title": session.title if session else None,
            "directory": session.directory if session else None,
            "time_updated": milliseconds_to_seconds(session.time_updated) if session else None,
        },
        "tool": {
            "part_id": tool_part.id if tool_part else None,
            "name": tool_part.data.get("tool") if tool_part else None,
            "status": tool_field(tool_part, ("state", "status")),
            "command": tool_field(tool_part, ("state", "input", "command")),
            "exit": tool_field(tool_part, ("state", "metadata", "exit")),
            "started_at": milliseconds_to_seconds(start_ms),
            "ended_at": milliseconds_to_seconds(end_ms),
            "elapsed_seconds": tool_elapsed,
        },
        "last_activity_seconds": last_activity_seconds,
        "thresholds": {
            "quiet_seconds": quiet_threshold,
            "stuck_seconds": stuck_threshold,
        },
        "wal": {
            "path": str(wal_state.path),
            "exists": wal_state.exists,
            "size_bytes": wal_state.size_bytes,
            "mtime": wal_state.mtime,
        },
    }


def assess_health(
    *,
    db_path: Path,
    session_selector: str,
    quiet_threshold: int,
    stuck_threshold: int,
    refresh_reason: str,
    now: float | None = None,
) -> dict[str, Any]:
    checked_at = int(time.time() if now is None else now)
    now_ms = checked_at * 1000
    wal_state = read_wal_state(db_path)

    if not db_path.exists():
        return fixed_result(
            health="unknown",
            reason="OpenCode DB file does not exist.",
            db_path=db_path,
            wal_state=wal_state,
            refresh_reason=refresh_reason,
            quiet_threshold=quiet_threshold,
            stuck_threshold=stuck_threshold,
            checked_at=checked_at,
            session_selector=session_selector,
        )

    try:
        with connect_readonly(db_path) as connection:
            session = fetch_session(connection, session_selector)
            if session is None:
                return fixed_result(
                    health="unknown",
                    reason="No matching OpenCode session found.",
                    db_path=db_path,
                    wal_state=wal_state,
                    refresh_reason=refresh_reason,
                    quiet_threshold=quiet_threshold,
                    stuck_threshold=stuck_threshold,
                    checked_at=checked_at,
                    session_selector=session_selector,
                )
            tool_part = fetch_latest_tool_part(connection, session.id)
    except sqlite3.Error as exc:
        return fixed_result(
            health="unknown",
            reason=f"OpenCode DB could not be read: {exc}",
            db_path=db_path,
            wal_state=wal_state,
            refresh_reason=refresh_reason,
            quiet_threshold=quiet_threshold,
            stuck_threshold=stuck_threshold,
            checked_at=checked_at,
            session_selector=session_selector,
        )

    if tool_part is None:
        return fixed_result(
            health="unknown",
            reason="No tool part found for the selected session.",
            db_path=db_path,
            wal_state=wal_state,
            refresh_reason=refresh_reason,
            quiet_threshold=quiet_threshold,
            stuck_threshold=stuck_threshold,
            checked_at=checked_at,
            session_selector=session_selector,
            session=session,
        )

    status = tool_field(tool_part, ("state", "status"))
    exit_code = tool_field(tool_part, ("state", "metadata", "exit"))
    tool_elapsed = tool_elapsed_seconds(tool_part, now_ms)
    last_activity_seconds = max(0, int((now_ms - tool_part.time_updated) / 1000))

    if status == "running":
        if tool_elapsed is None:
            return fixed_result(
                health="unknown",
                reason="Tool is running but start time could not be determined.",
                db_path=db_path,
                wal_state=wal_state,
                refresh_reason=refresh_reason,
                quiet_threshold=quiet_threshold,
                stuck_threshold=stuck_threshold,
                checked_at=checked_at,
                session_selector=session_selector,
                session=session,
                tool_part=tool_part,
                last_activity_seconds=last_activity_seconds,
                tool_elapsed=tool_elapsed,
            )
        if tool_elapsed < quiet_threshold:
            health: Health = "active"
            reason = f"Tool is running for {tool_elapsed}s, below quiet threshold."
        elif tool_elapsed < stuck_threshold:
            health = "quiet"
            reason = f"Tool is running for {tool_elapsed}s, below stuck threshold."
        else:
            health = "stuck"
            reason = f"Tool is running for {tool_elapsed}s, exceeding stuck threshold."
    elif status == "completed":
        if exit_code is None:
            health = "unknown"
            reason = "Tool completed but exit code is missing."
        elif exit_code == 0:
            health = "idle"
            reason = "Latest tool completed successfully."
        else:
            health = "failed"
            reason = f"Latest tool completed with non-zero exit code {exit_code}."
    else:
        health = "unknown"
        reason = f"Unknown or unsupported tool status: {status!r}."

    return fixed_result(
        health=health,
        reason=reason,
        db_path=db_path,
        wal_state=wal_state,
        refresh_reason=refresh_reason,
        quiet_threshold=quiet_threshold,
        stuck_threshold=stuck_threshold,
        checked_at=checked_at,
        session_selector=session_selector,
        session=session,
        tool_part=tool_part,
        last_activity_seconds=last_activity_seconds,
        tool_elapsed=tool_elapsed,
    )


def print_json(result: dict[str, Any]) -> None:
    print(json.dumps(result, ensure_ascii=False, sort_keys=True), flush=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Assess OpenCode health from opencode.db and db-wal.",
    )
    parser.add_argument(
        "--db",
        required=True,
        help="Path to OpenCode's opencode.db.",
    )
    parser.add_argument(
        "--session",
        default="latest",
        help='Session id to inspect, or "latest".',
    )
    parser.add_argument(
        "--poll-interval",
        type=int,
        default=5,
        help="Seconds between WAL checks and safety DB polling.",
    )
    parser.add_argument(
        "--quiet-threshold",
        type=int,
        default=60,
        help="Seconds a running tool may run before health becomes quiet.",
    )
    parser.add_argument(
        "--stuck-threshold",
        type=int,
        default=180,
        help="Seconds a running tool may run before health becomes stuck.",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Print one JSON assessment and exit.",
    )
    return parser.parse_args()


def validate_args(args: argparse.Namespace) -> str | None:
    if args.poll_interval <= 0:
        return "--poll-interval must be > 0"
    if args.quiet_threshold < 0:
        return "--quiet-threshold must be >= 0"
    if args.stuck_threshold < 0:
        return "--stuck-threshold must be >= 0"
    if args.stuck_threshold < args.quiet_threshold:
        return "--stuck-threshold must be >= --quiet-threshold"
    return None


def main() -> int:
    args = parse_args()
    error = validate_args(args)
    if error:
        print(error, file=sys.stderr)
        return 2

    db_path = Path(args.db).expanduser()
    last_wal_signature: tuple[bool, int | None, int | None] | None = None
    refresh_reason = "initial"

    try:
        while True:
            wal_state = read_wal_state(db_path)
            if last_wal_signature is None:
                refresh_reason = "initial"
            elif wal_state.signature != last_wal_signature:
                refresh_reason = "wal_changed"
            else:
                refresh_reason = "safety_poll"
            last_wal_signature = wal_state.signature

            result = assess_health(
                db_path=db_path,
                session_selector=args.session,
                quiet_threshold=args.quiet_threshold,
                stuck_threshold=args.stuck_threshold,
                refresh_reason=refresh_reason,
            )
            print_json(result)

            if args.once:
                return 0 if result["health"] != "unknown" else 1
            time.sleep(args.poll_interval)
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
