import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from session_state.codex_log import load_codex_events
from session_state.official_export_importer import import_official_export


class OfficialExportImporterTests(unittest.TestCase):
    def test_imports_chatgpt_conversations_json_mapping(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            archive = root / "chatgpt_export.zip"
            output = root / "chatgpt_session.jsonl"
            conversation = {
                "id": "chat-1",
                "title": "ChatGPT sample",
                "current_node": "assistant-1",
                "mapping": {
                    "root": {
                        "id": "root",
                        "parent": None,
                        "children": ["user-1"],
                        "message": None,
                    },
                    "user-1": {
                        "id": "user-1",
                        "parent": "root",
                        "children": ["assistant-1"],
                        "message": {
                            "author": {"role": "user"},
                            "content": {
                                "content_type": "text",
                                "parts": ["Review this project."],
                            },
                        },
                    },
                    "assistant-1": {
                        "id": "assistant-1",
                        "parent": "user-1",
                        "children": [],
                        "message": {
                            "author": {"role": "assistant"},
                            "content": {
                                "content_type": "text",
                                "parts": ["I reviewed the project."],
                            },
                        },
                    },
                },
            }
            self._write_zip_json(archive, "conversations.json", [conversation])

            summary = import_official_export("chatgpt", archive, output)

            self.assertEqual(summary.records, 2)
            self.assertEqual(summary.conversation_label, "ChatGPT sample")
            self.assertEqual(
                output.read_text(encoding="utf-8").splitlines(),
                [
                    '{"type":"user_message","content":"Review this project."}',
                    '{"type":"assistant_message","content":"I reviewed the project."}',
                ],
            )
            events = load_codex_events(output)
            self.assertEqual([event.id for event in events], ["e001", "e002"])
            self.assertEqual(events[0].type, "user_message")
            self.assertEqual(events[1].type, "assistant_message")

    def test_imports_claude_export_message_list(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            archive = root / "claude_export.zip"
            output = root / "claude_session.jsonl"
            conversations = [
                {
                    "uuid": "claude-1",
                    "name": "Claude sample",
                    "chat_messages": [
                        {"sender": "human", "text": "Explain the architecture."},
                        {"sender": "assistant", "text": "The architecture has three layers."},
                    ],
                }
            ]
            self._write_zip_json(archive, "conversations.json", conversations)

            summary = import_official_export("claude", archive, output)

            self.assertEqual(summary.records, 2)
            self.assertIn("Explain the architecture.", output.read_text(encoding="utf-8"))
            events = load_codex_events(output)
            self.assertEqual([event.type for event in events], ["user_message", "assistant_message"])

    def test_imports_gemini_takeout_like_message_list(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            archive = root / "gemini_takeout.zip"
            output = root / "gemini_session.jsonl"
            conversations = [
                {
                    "id": "gemini-1",
                    "title": "Gemini sample",
                    "messages": [
                        {"role": "user", "text": "Summarize this session."},
                        {"role": "model", "text": "The session is about import design."},
                    ],
                }
            ]
            self._write_zip_json(
                archive,
                "Takeout/Gemini Apps/conversations.json",
                conversations,
            )

            summary = import_official_export("gemini", archive, output)

            self.assertEqual(summary.records, 2)
            events = load_codex_events(output)
            self.assertEqual([event.type for event in events], ["user_message", "assistant_message"])

    def test_can_select_conversation_by_id(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            archive = root / "chatgpt_export.zip"
            output = root / "selected.jsonl"
            conversations = [
                self._chatgpt_message_conversation("first", "First", "skip"),
                self._chatgpt_message_conversation("second", "Second", "keep"),
            ]
            self._write_zip_json(archive, "conversations.json", conversations)

            summary = import_official_export(
                "chatgpt",
                archive,
                output,
                conversation_id="second",
            )

            self.assertEqual(summary.conversation_label, "Second")
            self.assertIn("keep", output.read_text(encoding="utf-8"))
            self.assertNotIn("skip", output.read_text(encoding="utf-8"))

    @staticmethod
    def _write_zip_json(path: Path, member: str, data: object) -> None:
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr(member, json.dumps(data))

    @staticmethod
    def _chatgpt_message_conversation(
        conversation_id: str,
        title: str,
        user_text: str,
    ) -> dict:
        return {
            "id": conversation_id,
            "title": title,
            "messages": [
                {
                    "role": "user",
                    "content": user_text,
                },
                {
                    "role": "assistant",
                    "content": f"response to {user_text}",
                },
            ],
        }


if __name__ == "__main__":
    unittest.main()
