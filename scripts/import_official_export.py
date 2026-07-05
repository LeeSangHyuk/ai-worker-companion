from __future__ import annotations

import argparse
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from session_state.official_export_importer import import_official_export


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Convert one official AI service export conversation to the "
            "project's normalized JSONL format."
        )
    )
    parser.add_argument(
        "--provider",
        choices=("chatgpt", "gemini", "claude"),
        required=True,
        help="official export provider",
    )
    parser.add_argument(
        "--input",
        type=Path,
        required=True,
        help="export ZIP, extracted export directory, or provider JSON file",
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="normalized JSONL output path",
    )
    parser.add_argument(
        "--conversation-index",
        type=int,
        default=0,
        help="0-based conversation index when no --conversation-id is provided",
    )
    parser.add_argument(
        "--conversation-id",
        default=None,
        help="provider conversation id/uuid when available",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    try:
        summary = import_official_export(
            args.provider,
            args.input,
            args.output,
            conversation_index=args.conversation_index,
            conversation_id=args.conversation_id,
        )
    except Exception as exc:
        raise SystemExit(f"error: {exc}") from exc

    print(f"provider: {summary.provider}")
    print(f"source:   {summary.source}")
    print(f"output:   {summary.output}")
    print(f"session:  {summary.conversation_label}")
    print(f"records:  {summary.records}")


if __name__ == "__main__":
    main()
