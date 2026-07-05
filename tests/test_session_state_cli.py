from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CLI = ROOT / "session_state.py"


def write_representation(path: Path, *, blocker_status: str = "none_observed") -> None:
    path.write_text(
        json.dumps(
            {
                "goal": {
                    "primary_goal": {"value": "Build a stable CLI interface."},
                    "active_goal": {"value": "Expose session state to extensions."},
                    "previous_goals": [{"value": "Validate representation JSON."}],
                },
                "current_situation": {
                    "summary": "The CLI reads an existing representation JSON and prints session state."
                },
                "blocker": {
                    "status": blocker_status,
                    "value": "A sample blocker." if blocker_status == "present" else "",
                },
                "evidence": [
                    {
                        "id": "e001",
                        "content": "API_KEY=sample-secret user@example.com",
                    }
                ],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def run_cli(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(CLI), *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )


def test_text_output_for_single_file(tmp_path: Path) -> None:
    sample = tmp_path / "sample.representation.json"
    write_representation(sample)

    result = run_cli("--input", str(sample))

    assert result.returncode == 0
    assert "Session State" in result.stdout
    assert "Current Goal" in result.stdout
    assert "Expose session state to extensions." in result.stdout


def test_markdown_output_for_single_file(tmp_path: Path) -> None:
    sample = tmp_path / "sample.representation.json"
    write_representation(sample)

    result = run_cli("--input", str(sample), "--format", "markdown")

    assert result.returncode == 0
    assert "# Session State" in result.stdout
    assert "## Current Goal" in result.stdout


def test_json_output_is_normalized_session_state(tmp_path: Path) -> None:
    sample = tmp_path / "sample.representation.json"
    write_representation(sample)

    result = run_cli("--input", str(sample), "--format", "json")

    assert result.returncode == 0
    payload = json.loads(result.stdout)
    assert payload["current_goal"] == "Expose session state to extensions."
    assert payload["status"] == "low-context"


def test_resume_prompt_masks_sensitive_evidence(tmp_path: Path) -> None:
    sample = tmp_path / "sample.representation.json"
    write_representation(sample)

    result = run_cli("--input", str(sample), "--resume")

    assert result.returncode == 0
    assert "You are continuing an AI agent session." in result.stdout
    assert "API_KEY=****REDACTED****" in result.stdout
    assert "****REDACTED_EMAIL****" in result.stdout
    assert "sample-secret" not in result.stdout
    assert "user@example.com" not in result.stdout


def test_directory_select_blocked_and_limit(tmp_path: Path) -> None:
    healthy = tmp_path / "a.representation.json"
    blocked = tmp_path / "b.representation.json"
    write_representation(healthy)
    write_representation(blocked, blocker_status="present")

    result = run_cli(
        "--input",
        str(tmp_path),
        "--select",
        "blocked",
        "--status",
        "blocked",
        "--limit",
        "1",
        "--format",
        "json",
    )

    assert result.returncode == 0
    payload = json.loads(result.stdout)
    assert payload["status"] == "blocked"
    assert payload["blocker"]["description"] == "A sample blocker."

