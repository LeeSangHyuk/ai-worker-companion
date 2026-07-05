import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from scripts.evaluate_samples import main as evaluate_samples_main
from scripts.ingest_raw_data import main as ingest_main


class IngestionFailureTests(unittest.TestCase):
    def test_check_fails_for_unconfigured_chatgpt_txt(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "chatgpt_1.txt").write_text("hello", encoding="utf-8")
            (root / "chatgpt_2.txt").write_text("new file", encoding="utf-8")
            manifest = self._write_manifest(
                root,
                [self._entry("chatgpt_1.txt", "user_message", [1, 1])],
            )

            error, _ = self._run_ingestion_check(manifest)

            self.assertIn("unconfigured raw ChatGPT files", str(error))
            self.assertIn("chatgpt_2.txt", str(error))

    def test_check_fails_for_out_of_bounds_line_range(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "chatgpt_1.txt").write_text("one line", encoding="utf-8")
            manifest = self._write_manifest(
                root,
                [self._entry("chatgpt_1.txt", "user_message", [1, 2])],
            )

            error, _ = self._run_ingestion_check(manifest)

            self.assertIn("range is out of bounds", str(error))

    def test_check_fails_for_invalid_role_type(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "chatgpt_1.txt").write_text("system text", encoding="utf-8")
            manifest = self._write_manifest(
                root,
                [self._entry("chatgpt_1.txt", "system_message", [1, 1])],
            )

            error, _ = self._run_ingestion_check(manifest)

            self.assertIn("invalid type", str(error))

    def test_check_fails_when_generated_jsonl_is_stale(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "chatgpt_1.txt").write_text("hello", encoding="utf-8")
            (root / "chatgpt_1.jsonl").write_text(
                '{"type":"user_message","content":"old"}\n',
                encoding="utf-8",
            )
            manifest = self._write_manifest(
                root,
                [self._entry("chatgpt_1.txt", "user_message", [1, 1])],
            )

            error, output = self._run_ingestion_check(manifest)

            self.assertEqual(error.code, 1)
            self.assertIn("stale", output)

    def test_evaluation_fails_for_unknown_expected_evidence_id(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "chatgpt_bad.jsonl").write_text(
                '{"type":"user_message","content":"review this"}\n',
                encoding="utf-8",
            )
            expected = {
                "goal": {
                    "primary_goal": {
                        "value": "Review the input.",
                        "evidence_ids": ["e999"],
                    },
                    "active_goal": {
                        "value": "Review the input.",
                        "evidence_ids": ["e999"],
                    },
                    "previous_goals": [],
                    "goal_shift_detected": False,
                    "goal_shift_evidence": [],
                },
                "current_situation": {
                    "summary": "The review request is present.",
                    "evidence_ids": ["e999"],
                },
                "blocker": {
                    "status": "none_observed",
                    "value": None,
                    "evidence_ids": ["e999"],
                },
                "evidence": [
                    {
                        "id": "e999",
                        "type": "user_message",
                        "content": "not in the session",
                        "source_line": 999,
                    }
                ],
            }
            (root / "chatgpt_bad.expected.json").write_text(
                json.dumps(expected),
                encoding="utf-8",
            )

            output = io.StringIO()
            argv = [
                "evaluate_samples.py",
                "--data-dir",
                str(root),
                "--model",
                "unused",
            ]
            with patch.object(sys, "argv", argv), redirect_stdout(output):
                with self.assertRaises(SystemExit) as context:
                    evaluate_samples_main()

            self.assertEqual(context.exception.code, 1)
            self.assertIn("e999", output.getvalue())
            self.assertIn("not present in the normalized JSONL", output.getvalue())

    def _run_ingestion_check(self, manifest: Path) -> tuple[SystemExit, str]:
        output = io.StringIO()
        argv = [
            "ingest_raw_data.py",
            "--manifest",
            str(manifest),
            "--check",
        ]
        with patch.object(sys, "argv", argv), redirect_stdout(output):
            with self.assertRaises(SystemExit) as context:
                ingest_main()
        return context.exception, output.getvalue()

    @staticmethod
    def _entry(
        source: str,
        message_type: str,
        line_range: list[int],
    ) -> dict:
        return {
            "source": source,
            "turns": [
                {
                    "type": message_type,
                    "ranges": [line_range],
                }
            ],
        }

    @staticmethod
    def _write_manifest(root: Path, entries: list[dict]) -> Path:
        manifest = root / "chatgpt_ingestion.json"
        manifest.write_text(
            json.dumps({"files": entries}),
            encoding="utf-8",
        )
        return manifest


if __name__ == "__main__":
    unittest.main()
