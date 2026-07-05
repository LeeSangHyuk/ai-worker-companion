from __future__ import annotations

import argparse
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from session_state.chatgpt_ingestion import ingest_chatgpt_manifest


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Convert configured ChatGPT text exports to normalized JSONL."
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=ROOT / "raw_data" / "chatgpt_ingestion.json",
        help="turn-boundary manifest",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail when generated JSONL is missing or stale",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    try:
        results = ingest_chatgpt_manifest(args.manifest, check=args.check)
    except Exception as exc:
        raise SystemExit(f"error: {exc}") from exc

    failed = False
    for path, status in results:
        print(f"{status:7} {path}")
        failed = failed or status in {"missing", "stale"}
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
