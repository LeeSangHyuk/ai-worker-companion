import json
from pathlib import Path
from typing import Any


MESSAGE_TYPES = {"user_message", "assistant_message"}


def ingest_chatgpt_manifest(
    manifest_path: Path,
    check: bool = False,
) -> list[tuple[Path, str]]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = manifest.get("files")
    if not isinstance(entries, list) or not entries:
        raise ValueError("manifest.files must be a non-empty list")

    configured_sources = {str(entry.get("source")) for entry in entries}
    discovered_sources = {
        path.name for path in manifest_path.parent.glob("chatgpt_*.txt")
    }
    missing_config = sorted(discovered_sources - configured_sources)
    missing_source = sorted(configured_sources - discovered_sources)
    if missing_config:
        raise ValueError(
            "unconfigured raw ChatGPT files: " + ", ".join(missing_config)
        )
    if missing_source:
        raise ValueError(
            "configured ChatGPT files do not exist: "
            + ", ".join(missing_source)
        )

    results: list[tuple[Path, str]] = []
    for entry in entries:
        source_path = manifest_path.parent / str(entry["source"])
        output_name = entry.get("output") or source_path.with_suffix(".jsonl").name
        output_path = manifest_path.parent / str(output_name)
        rendered = render_chatgpt_turns(source_path, entry.get("turns"))

        if check:
            if not output_path.exists():
                results.append((output_path, "missing"))
            elif output_path.read_text(encoding="utf-8") != rendered:
                results.append((output_path, "stale"))
            else:
                results.append((output_path, "ok"))
        else:
            output_path.write_text(rendered, encoding="utf-8")
            results.append((output_path, "written"))

    return results


def render_chatgpt_turns(source_path: Path, turns: Any) -> str:
    if not isinstance(turns, list) or not turns:
        raise ValueError(f"{source_path.name}: turns must be a non-empty list")

    lines = source_path.read_text(encoding="utf-8").splitlines()
    used_lines: set[int] = set()
    records: list[str] = []

    for turn_index, turn in enumerate(turns, start=1):
        message_type = turn.get("type") if isinstance(turn, dict) else None
        ranges = turn.get("ranges") if isinstance(turn, dict) else None
        if message_type not in MESSAGE_TYPES:
            raise ValueError(
                f"{source_path.name}: turn {turn_index} has invalid type"
            )
        if not isinstance(ranges, list) or not ranges:
            raise ValueError(
                f"{source_path.name}: turn {turn_index} has no ranges"
            )

        parts: list[str] = []
        for line_range in ranges:
            if (
                not isinstance(line_range, list)
                or len(line_range) != 2
                or not all(isinstance(value, int) for value in line_range)
            ):
                raise ValueError(
                    f"{source_path.name}: turn {turn_index} has invalid range"
                )
            start, end = line_range
            if start < 1 or end < start or end > len(lines):
                raise ValueError(
                    f"{source_path.name}: turn {turn_index} range is out of bounds"
                )
            selected = set(range(start, end + 1))
            overlap = selected & used_lines
            if overlap:
                raise ValueError(
                    f"{source_path.name}: line ranges overlap at {min(overlap)}"
                )
            used_lines.update(selected)
            parts.append("\n".join(lines[start - 1 : end]))

        content = _clean_content("\n\n".join(parts))
        if not content:
            raise ValueError(
                f"{source_path.name}: turn {turn_index} has empty content"
            )
        records.append(
            json.dumps(
                {"type": message_type, "content": content},
                ensure_ascii=False,
                separators=(",", ":"),
            )
        )

    return "\n".join(records) + "\n"


def _clean_content(content: str) -> str:
    lines = [line.rstrip() for line in content.replace("\r\n", "\n").split("\n")]
    cleaned: list[str] = []
    blank = False
    for line in lines:
        if line.strip():
            cleaned.append(line)
            blank = False
        elif cleaned and not blank:
            cleaned.append("")
            blank = True
    while cleaned and not cleaned[-1]:
        cleaned.pop()
    return "\n".join(cleaned).strip()
