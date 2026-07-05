"""OpenCode adapter for the agent-agnostic Session State Core CLI.

This adapter intentionally does not implement extraction, prompting, schema logic,
or recovery automation. It only calls the existing repo-level session_state.py so
an OpenCode command/plugin can display state or generate a handoff prompt.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


DEFAULT_INPUT = "outputs/representations_full_124_gemini_3_1_flash_lite"


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def resolve_input(value: str, root: Path) -> Path:
    path = Path(value).expanduser()
    if path.is_absolute():
        return path
    return root / path


def build_command(args: argparse.Namespace, root: Path, input_path: Path) -> list[str]:
    session_state = root / "session_state.py"
    command = [
        sys.executable,
        str(session_state),
        "--input",
        str(input_path),
        "--select",
        args.select,
    ]

    if args.status:
        command.extend(["--status", args.status])
    if args.limit:
        command.extend(["--limit", str(args.limit)])
    if args.resume:
        command.append("--resume")
    else:
        command.extend(["--format", args.format])

    return command


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Thin OpenCode adapter for session_state.py.",
    )
    parser.add_argument(
        "--input",
        default=os.environ.get("SESSION_STATE_INPUT", DEFAULT_INPUT),
        help="Representation JSON file or folder. Defaults to SESSION_STATE_INPUT or the Phase 0.5 output folder.",
    )
    parser.add_argument(
        "--format",
        choices=["text", "markdown", "json"],
        default="markdown",
        help="Output format passed to session_state.py.",
    )
    parser.add_argument(
        "--select",
        choices=["first", "recent", "blocked"],
        default="recent",
        help="Selection mode when --input is a folder.",
    )
    parser.add_argument(
        "--status",
        choices=["blocked", "healthy", "unknown", "low-context"],
        help="Optional status filter passed to session_state.py.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Optional limit passed to session_state.py.",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Print a handoff/resume prompt instead of a state view.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = repo_root()
    session_state = root / "session_state.py"
    input_path = resolve_input(args.input, root)

    if not session_state.exists():
        print(f"session_state.py not found: {session_state}", file=sys.stderr)
        return 2
    if not input_path.exists():
        print(
            "No representation input found.\n"
            f"Expected: {input_path}\n"
            "Set SESSION_STATE_INPUT or pass --input to point at a representation JSON file/folder.",
            file=sys.stderr,
        )
        return 2

    command = build_command(args, root, input_path)
    completed = subprocess.run(
        command,
        cwd=str(root),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )

    if completed.stdout:
        print(completed.stdout, end="")
    if completed.stderr:
        print(completed.stderr, file=sys.stderr, end="")
    return completed.returncode


if __name__ == "__main__":
    raise SystemExit(main())
