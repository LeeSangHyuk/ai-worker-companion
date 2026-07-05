from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CLI = ROOT / "session_state.py"


def write_sample(path: Path, *, blocker_status: str = "none_observed") -> None:
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


def assert_ok(name: str, condition: bool, detail: str = "") -> None:
    if not condition:
        raise SystemExit(f"FAIL {name}: {detail}")
    print(f"PASS {name}")


def main() -> int:
    with tempfile.TemporaryDirectory() as temp_dir:
        temp = Path(temp_dir)
        healthy = temp / "a.representation.json"
        blocked = temp / "b.representation.json"
        write_sample(healthy)
        write_sample(blocked, blocker_status="present")

        text_result = run_cli("--input", str(healthy))
        assert_ok("text output", text_result.returncode == 0 and "Session State" in text_result.stdout)

        markdown_result = run_cli("--input", str(healthy), "--format", "markdown")
        assert_ok(
            "markdown output",
            markdown_result.returncode == 0 and "# Session State" in markdown_result.stdout,
        )

        json_result = run_cli("--input", str(healthy), "--format", "json")
        payload = json.loads(json_result.stdout)
        assert_ok(
            "json output",
            json_result.returncode == 0
            and payload["current_goal"] == "Expose session state to extensions.",
        )

        resume_result = run_cli("--input", str(healthy), "--resume")
        assert_ok(
            "resume redaction",
            resume_result.returncode == 0
            and "****REDACTED****" in resume_result.stdout
            and "sample-secret" not in resume_result.stdout
            and "user@example.com" not in resume_result.stdout,
        )

        folder_result = run_cli(
            "--input",
            str(temp),
            "--select",
            "blocked",
            "--status",
            "blocked",
            "--limit",
            "1",
            "--format",
            "json",
        )
        folder_payload = json.loads(folder_result.stdout)
        assert_ok(
            "folder blocked selection",
            folder_result.returncode == 0 and folder_payload["status"] == "blocked",
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
