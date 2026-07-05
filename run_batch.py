from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from session_state.codex_log import load_codex_events
from session_state.extractor import Provider, default_model, extract_session_state


@dataclass(frozen=True)
class BatchConfig:
    input: Path
    output: Path
    provider: Provider
    model: Optional[str]
    api_key: Optional[str]
    api_key_env: Optional[str]
    retries: int
    retry_wait_seconds: int
    rate_limit_wait_seconds: int
    request_wait_seconds: int
    recursive: bool
    cutoff: Optional[int]
    log_file: Optional[Path]
    summary_file: Optional[Path]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Generate Session Representations for a folder of normalized JSONL "
            "sessions. This runner is intended to be executed by the user locally."
        )
    )
    parser.add_argument(
        "--config",
        type=Path,
        help="optional JSON/YAML config file",
    )
    parser.add_argument(
        "--input",
        type=Path,
        help="folder containing normalized JSONL files",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="folder where representation JSON files will be written",
    )
    parser.add_argument(
        "--provider",
        choices=("openai", "gemini"),
        help="LLM provider",
    )
    parser.add_argument(
        "--model",
        help="model name; defaults to provider-specific environment/default",
    )
    parser.add_argument(
        "--api-key-env",
        help=(
            "environment variable containing the API key. Defaults to "
            "GEMINI_API_KEY for gemini and OPENAI_API_KEY for openai"
        ),
    )
    parser.add_argument(
        "--retries",
        type=int,
        help="retry attempts per failed conversation, default: 3",
    )
    parser.add_argument(
        "--retry-wait-seconds",
        type=int,
        help="wait between non-rate-limit retries, default: 10",
    )
    parser.add_argument(
        "--rate-limit-wait-seconds",
        type=int,
        help="wait after 429/rate-limit errors, default: 60",
    )
    parser.add_argument(
        "--request-wait-seconds",
        type=int,
        help=(
            "proactive wait after each non-skipped conversation before moving "
            "to the next file; useful for staying under TPM/RPM limits, default: 0"
        ),
    )
    parser.add_argument(
        "--recursive",
        action="store_true",
        default=None,
        help="scan input folder recursively",
    )
    parser.add_argument(
        "--cutoff",
        type=int,
        help="analyze only the first N normalized events from each file",
    )
    parser.add_argument(
        "--log-file",
        type=Path,
        help="JSONL execution log path; default: <output>/batch_run.jsonl",
    )
    parser.add_argument(
        "--summary-file",
        type=Path,
        help="summary JSON path; default: <output>/batch_summary.json",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    try:
        config = load_config(args)
        apply_api_key_config(config)
        summary = run_batch(config)
    except Exception as exc:
        raise SystemExit(f"error: {exc}") from exc

    print()
    print(f"Total:   {summary['total']}")
    print(f"Success: {summary['success']}")
    print(f"Failed:  {summary['failed']}")
    print(f"Skipped: {summary['skipped']}")
    print(f"Output:  {config.output}")
    print(f"Log:     {summary['log_file']}")
    print(f"Summary: {summary['summary_file']}")


def load_config(args: argparse.Namespace) -> BatchConfig:
    file_config = load_config_file(args.config) if args.config else {}

    provider = str(
        cli_or_file(args.provider, file_config, "provider", default="openai")
    )
    if provider not in {"openai", "gemini"}:
        raise ValueError("provider must be one of: openai, gemini")

    input_value = cli_or_file(args.input, file_config, "input")
    output_value = cli_or_file(args.output, file_config, "output")
    if not input_value:
        raise ValueError("--input or config.input is required")
    if not output_value:
        raise ValueError("--output or config.output is required")

    output = Path(output_value)
    log_file = cli_or_file(args.log_file, file_config, "log_file")
    summary_file = cli_or_file(args.summary_file, file_config, "summary_file")

    return BatchConfig(
        input=Path(input_value),
        output=output,
        provider=provider,  # type: ignore[arg-type]
        model=optional_str(cli_or_file(args.model, file_config, "model")),
        api_key=optional_str(file_config.get("api_key")),
        api_key_env=optional_str(
            cli_or_file(args.api_key_env, file_config, "api_key_env")
        ),
        retries=int(cli_or_file(args.retries, file_config, "retries", default=3)),
        retry_wait_seconds=int(
            cli_or_file(
                args.retry_wait_seconds,
                file_config,
                "retry_wait_seconds",
                default=10,
            )
        ),
        rate_limit_wait_seconds=int(
            cli_or_file(
                args.rate_limit_wait_seconds,
                file_config,
                "rate_limit_wait_seconds",
                default=60,
            )
        ),
        request_wait_seconds=int(
            cli_or_file(
                args.request_wait_seconds,
                file_config,
                "request_wait_seconds",
                default=0,
            )
        ),
        recursive=bool(cli_or_file(args.recursive, file_config, "recursive", default=False)),
        cutoff=optional_int(cli_or_file(args.cutoff, file_config, "cutoff")),
        log_file=Path(log_file) if log_file else output / "batch_run.jsonl",
        summary_file=Path(summary_file)
        if summary_file
        else output / "batch_summary.json",
    )


def load_config_file(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise ValueError(f"config file does not exist: {path}")

    text = path.read_text(encoding="utf-8")
    suffix = path.suffix.lower()
    if suffix == ".json":
        data = json.loads(text)
    elif suffix in {".yaml", ".yml"}:
        data = load_yaml_like_config(text)
    else:
        raise ValueError("config file must be .json, .yaml, or .yml")

    if not isinstance(data, dict):
        raise ValueError("config file must contain a mapping/object")
    return data


def load_yaml_like_config(text: str) -> dict[str, Any]:
    try:
        import yaml  # type: ignore
    except ImportError:
        return parse_simple_yaml_mapping(text)

    data = yaml.safe_load(text) or {}
    if not isinstance(data, dict):
        raise ValueError("YAML config must contain a mapping/object")
    return data


def parse_simple_yaml_mapping(text: str) -> dict[str, Any]:
    data: dict[str, Any] = {}
    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            raise ValueError(
                "PyYAML is not installed and simple YAML parsing failed at "
                f"line {line_number}: {raw_line}"
            )
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if value.lower() in {"true", "false"}:
            parsed: Any = value.lower() == "true"
        elif value.lower() in {"none", "null", "~", ""}:
            parsed = None
        else:
            try:
                parsed = int(value)
            except ValueError:
                parsed = value
        data[key] = parsed
    return data


def cli_or_file(
    cli_value: Any,
    file_config: dict[str, Any],
    key: str,
    *,
    default: Any = None,
) -> Any:
    if cli_value is not None:
        return cli_value
    return file_config.get(key, default)


def optional_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value)
    return text if text else None


def optional_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    return int(value)


def apply_api_key_config(config: BatchConfig) -> None:
    env_name = config.api_key_env or default_api_key_env(config.provider)
    if config.api_key:
        os.environ[env_name] = config.api_key
        if env_name != default_api_key_env(config.provider):
            os.environ[default_api_key_env(config.provider)] = config.api_key
        return
    if os.environ.get(env_name):
        if env_name != default_api_key_env(config.provider):
            os.environ[default_api_key_env(config.provider)] = os.environ[env_name]
        return

    raise ValueError(
        f"API key is not configured. Set {env_name}, pass --api-key-env, "
        "or provide api_key in a local config file."
    )


def default_api_key_env(provider: Provider) -> str:
    if provider == "gemini":
        return "GEMINI_API_KEY"
    return "OPENAI_API_KEY"


def run_batch(config: BatchConfig) -> dict[str, Any]:
    if not config.input.exists() or not config.input.is_dir():
        raise ValueError(f"input folder does not exist: {config.input}")

    config.output.mkdir(parents=True, exist_ok=True)
    assert config.log_file is not None
    assert config.summary_file is not None
    config.log_file.parent.mkdir(parents=True, exist_ok=True)
    config.summary_file.parent.mkdir(parents=True, exist_ok=True)

    sessions = discover_sessions(config.input, recursive=config.recursive)
    model = config.model or default_model(config.provider)

    totals = {
        "total": len(sessions),
        "success": 0,
        "failed": 0,
        "skipped": 0,
        "provider": config.provider,
        "model": model,
        "started_at": utc_now(),
        "finished_at": None,
        "log_file": str(config.log_file),
        "summary_file": str(config.summary_file),
        "input": str(config.input),
        "output": str(config.output),
    }

    with config.log_file.open("a", encoding="utf-8") as log:
        for index, session_path in enumerate(sessions, start=1):
            conversation_id = session_path.stem
            output_path = config.output / f"{conversation_id}.representation.json"
            if output_path.exists() and output_path.stat().st_size > 0:
                totals["skipped"] += 1
                record = build_log_record(
                    conversation_id=conversation_id,
                    session_path=session_path,
                    output_path=output_path,
                    model=model,
                    status="skipped",
                    started_at=utc_now(),
                    ended_at=utc_now(),
                    duration_sec=0.0,
                    error_message=None,
                )
                write_log(log, record)
                print_progress(index, len(sessions), conversation_id, "SKIP")
                continue

            (
                status,
                error_message,
                duration_sec,
                started_at,
                ended_at,
            ) = run_one_with_retry(
                session_path=session_path,
                output_path=output_path,
                config=config,
                model=model,
            )

            if status == "success":
                totals["success"] += 1
            else:
                totals["failed"] += 1

            record = build_log_record(
                conversation_id=conversation_id,
                session_path=session_path,
                output_path=output_path,
                model=model,
                status=status,
                started_at=started_at,
                ended_at=ended_at,
                duration_sec=duration_sec,
                error_message=error_message,
            )
            write_log(log, record)
            print_progress(index, len(sessions), conversation_id, status.upper())
            wait_between_requests(config, index, len(sessions))

    totals["finished_at"] = utc_now()
    config.summary_file.write_text(
        json.dumps(totals, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return totals


def discover_sessions(input_dir: Path, *, recursive: bool) -> list[Path]:
    pattern = "**/*.jsonl" if recursive else "*.jsonl"
    return sorted(path for path in input_dir.glob(pattern) if path.is_file())


def run_one_with_retry(
    *,
    session_path: Path,
    output_path: Path,
    config: BatchConfig,
    model: str,
) -> tuple[str, Optional[str], float, str, str]:
    started_monotonic = time.monotonic()
    started_at = utc_now()
    attempts = max(config.retries, 0) + 1
    last_error: Optional[str] = None

    for attempt in range(1, attempts + 1):
        try:
            events = load_codex_events(session_path, cutoff=config.cutoff)
            result = extract_session_state(
                events,
                model=model,
                provider=config.provider,
            )
            output_path.write_text(
                result.model_dump_json(indent=2) + "\n",
                encoding="utf-8",
            )
            ended_at = utc_now()
            return (
                "success",
                None,
                round(time.monotonic() - started_monotonic, 2),
                started_at,
                ended_at,
            )
        except Exception as exc:
            last_error = str(exc)
            if attempt >= attempts:
                break
            wait_seconds = retry_wait_for_error(
                last_error,
                retry_wait_seconds=config.retry_wait_seconds,
                rate_limit_wait_seconds=config.rate_limit_wait_seconds,
            )
            print(
                f"  retry {attempt}/{attempts - 1} after {wait_seconds}s: "
                f"{session_path.name} ({short_error(last_error)})",
                flush=True,
            )
            time.sleep(wait_seconds)

    ended_at = utc_now()
    return (
        "failed",
        last_error,
        round(time.monotonic() - started_monotonic, 2),
        started_at,
        ended_at,
    )


def retry_wait_for_error(
    error_message: str,
    *,
    retry_wait_seconds: int,
    rate_limit_wait_seconds: int,
) -> int:
    lowered = error_message.lower()
    if "429" in lowered or "rate limit" in lowered or "ratelimit" in lowered:
        return max(rate_limit_wait_seconds, 0)
    return max(retry_wait_seconds, 0)


def short_error(error_message: str, limit: int = 160) -> str:
    compact = " ".join(error_message.split())
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1].rstrip() + "…"


def build_log_record(
    *,
    conversation_id: str,
    session_path: Path,
    output_path: Path,
    model: str,
    status: str,
    started_at: str,
    ended_at: str,
    duration_sec: float,
    error_message: Optional[str],
) -> dict[str, Any]:
    return {
        "conversation_id": conversation_id,
        "session_path": str(session_path),
        "output_path": str(output_path),
        "start_time": started_at,
        "end_time": ended_at,
        "duration_sec": duration_sec,
        "model": model,
        "success": status in {"success", "skipped"},
        "status": status,
        "error_message": error_message,
    }


def write_log(log: Any, record: dict[str, Any]) -> None:
    log.write(json.dumps(record, ensure_ascii=False) + "\n")
    log.flush()


def print_progress(
    current: int,
    total: int,
    conversation_id: str,
    status: str,
) -> None:
    print(f"[{current}/{total}] {status} {conversation_id}", flush=True)


def wait_between_requests(config: BatchConfig, current: int, total: int) -> None:
    wait_seconds = max(config.request_wait_seconds, 0)
    if wait_seconds <= 0 or current >= total:
        return
    print(
        f"  waiting {wait_seconds}s before next request "
        "(proactive TPM/RPM throttle)",
        flush=True,
    )
    time.sleep(wait_seconds)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


if __name__ == "__main__":
    main()
