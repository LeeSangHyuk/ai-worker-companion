from __future__ import annotations

import argparse
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from session_state.codex_log import load_codex_events
from session_state.health import check_session_health


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Detect repeated commands and errors in a Codex JSONL log."
    )
    parser.add_argument("session", type=Path, help="path to a JSONL session log")
    parser.add_argument(
        "--cutoff",
        type=int,
        default=None,
        help="analyze only the first N normalized events",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    try:
        events = load_codex_events(args.session, cutoff=args.cutoff)
        result = check_session_health(events)
    except Exception as exc:
        raise SystemExit(f"error: {exc}") from exc

    print(result.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
