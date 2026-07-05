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
EXAMPLE_INPUT = "examples/session.state.example.json"


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def resolve_input(value: str, root: Path) -> Path:
    path = Path(value).expanduser()
    if path.is_absolute():
        return path
    return root / path


def input_candidates(root: Path) -> list[tuple[str, Path]]:
    return [
        ("default outputs", resolve_input(DEFAULT_INPUT, root)),
        ("public example", resolve_input(EXAMPLE_INPUT, root)),
    ]


def select_input(args: argparse.Namespace, root: Path) -> tuple[Path | None, list[tuple[str, Path]]]:
    if args.input:
        path = resolve_input(args.input, root)
        return (path if path.exists() else None), [("--input", path)]

    env_value = os.environ.get("SESSION_STATE_INPUT")
    if env_value:
        path = resolve_input(env_value, root)
        return (path if path.exists() else None), [("SESSION_STATE_INPUT", path)]

    candidates = input_candidates(root)
    for _, path in candidates:
        if path.exists():
            return path, candidates
    return None, candidates


def print_missing_input(candidates: list[tuple[str, Path]], root: Path) -> None:
    print("No representation input found.", file=sys.stderr)
    print("", file=sys.stderr)
    print("Checked candidate paths:", file=sys.stderr)
    for label, path in candidates:
        status = "found" if path.exists() else "missing"
        print(f"- {label}: {path} ({status})", file=sys.stderr)
    print("", file=sys.stderr)
    print("How to fix:", file=sys.stderr)
    print("- Generate or restore a representation output folder.", file=sys.stderr)
    print("- Or point SESSION_STATE_INPUT at a representation JSON file/folder.", file=sys.stderr)
    print("- Public clone example:", file=sys.stderr)
    print(
        f'  export SESSION_STATE_INPUT="{root / EXAMPLE_INPUT}"',
        file=sys.stderr,
    )


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
        help="Representation JSON file or folder. Overrides SESSION_STATE_INPUT and the adapter fallback paths.",
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
    input_path, candidates = select_input(args, root)

    if not session_state.exists():
        print(f"session_state.py not found: {session_state}", file=sys.stderr)
        return 2
    if input_path is None:
        print_missing_input(candidates, root)
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
