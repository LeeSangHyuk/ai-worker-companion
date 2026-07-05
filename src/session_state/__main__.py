import argparse
from pathlib import Path

from .codex_log import load_codex_events
from .extractor import default_model, extract_session_state


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m session_state",
        description="Extract Goal Stack, Current Situation, Blocker, and Evidence from a Codex JSONL log.",
    )
    parser.add_argument("session", type=Path, help="path to a Codex JSONL session log")
    parser.add_argument(
        "--cutoff",
        type=int,
        default=None,
        help="analyze only the first N normalized events",
    )
    parser.add_argument(
        "--provider",
        choices=("openai", "gemini"),
        default="openai",
        help="LLM provider (default: openai)",
    )
    parser.add_argument(
        "--model",
        default=None,
        help="model name (provider-specific environment/default when omitted)",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    try:
        events = load_codex_events(args.session, cutoff=args.cutoff)
        model = args.model or default_model(args.provider)
        result = extract_session_state(
            events,
            model=model,
            provider=args.provider,
        )
    except Exception as exc:
        parser.exit(status=1, message=f"error: {exc}\n")

    print(result.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
