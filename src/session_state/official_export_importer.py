from __future__ import annotations

import json
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, Optional


Provider = Literal["chatgpt", "gemini", "claude"]
NormalizedType = Literal[
    "user_message",
    "assistant_message",
    "tool_call",
    "tool_result",
    "system_event",
]


@dataclass(frozen=True)
class NormalizedRecord:
    type: NormalizedType
    content: str


@dataclass(frozen=True)
class ImportSummary:
    provider: Provider
    source: Path
    output: Path
    records: int
    conversation_label: str


def import_official_export(
    provider: Provider,
    source: Path,
    output: Path,
    *,
    conversation_index: int = 0,
    conversation_id: Optional[str] = None,
) -> ImportSummary:
    if provider == "chatgpt":
        records, label = import_chatgpt_export(
            source,
            conversation_index=conversation_index,
            conversation_id=conversation_id,
        )
    elif provider == "gemini":
        records, label = import_gemini_export(
            source,
            conversation_index=conversation_index,
            conversation_id=conversation_id,
        )
    elif provider == "claude":
        records, label = import_claude_export(
            source,
            conversation_index=conversation_index,
            conversation_id=conversation_id,
        )
    else:
        raise ValueError(f"unsupported provider: {provider}")

    if not records:
        raise ValueError("selected conversation produced no supported messages")

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(render_normalized_jsonl(records), encoding="utf-8")
    return ImportSummary(provider, source, output, len(records), label)


def import_chatgpt_export(
    source: Path,
    *,
    conversation_index: int = 0,
    conversation_id: Optional[str] = None,
) -> tuple[list[NormalizedRecord], str]:
    conversations = _load_chatgpt_conversations(source)

    conversation = _select_conversation(
        conversations,
        conversation_index=conversation_index,
        conversation_id=conversation_id,
    )
    records = _records_from_chatgpt_conversation(conversation)
    return records, _conversation_label(conversation, conversation_index)


def _load_chatgpt_conversations(source: Path) -> list[Any]:
    data_candidates = _load_json_candidates(
        source,
        preferred_names=("conversations.json",),
    )
    conversations: list[Any] = []
    for name, data in data_candidates:
        filename = Path(name).name
        if filename == "conversations.json" or (
            filename.startswith("conversations-") and filename.endswith(".json")
        ):
            if not isinstance(data, list):
                raise ValueError(f"ChatGPT export {filename} must contain a list")
            conversations.extend(data)
    if not conversations:
        raise ValueError(
            "ChatGPT export does not contain conversations.json or "
            "conversations-*.json"
        )
    return conversations


def import_claude_export(
    source: Path,
    *,
    conversation_index: int = 0,
    conversation_id: Optional[str] = None,
) -> tuple[list[NormalizedRecord], str]:
    conversations = _load_first_json_collection(
        source,
        preferred_names=("conversations.json", "chats.json"),
    )
    conversation = _select_conversation(
        conversations,
        conversation_index=conversation_index,
        conversation_id=conversation_id,
    )
    records = _records_from_message_like_conversation(conversation, provider="claude")
    return records, _conversation_label(conversation, conversation_index)


def import_gemini_export(
    source: Path,
    *,
    conversation_index: int = 0,
    conversation_id: Optional[str] = None,
) -> tuple[list[NormalizedRecord], str]:
    conversations = _load_first_json_collection(
        source,
        preferred_names=(
            "conversations.json",
            "gemini.json",
            "MyActivity.json",
            "My Activity.json",
        ),
    )
    conversation = _select_conversation(
        conversations,
        conversation_index=conversation_index,
        conversation_id=conversation_id,
    )
    records = _records_from_message_like_conversation(conversation, provider="gemini")
    if not records and isinstance(conversation, list):
        records = _records_from_message_like_conversation(
            {"messages": conversation},
            provider="gemini",
        )
    return records, _conversation_label(conversation, conversation_index)


def render_normalized_jsonl(records: list[NormalizedRecord]) -> str:
    lines = [
        json.dumps(
            {"type": record.type, "content": record.content},
            ensure_ascii=False,
            separators=(",", ":"),
        )
        for record in records
    ]
    return "\n".join(lines) + "\n"


def _records_from_chatgpt_conversation(conversation: Any) -> list[NormalizedRecord]:
    if not isinstance(conversation, dict):
        raise ValueError("selected ChatGPT conversation must be an object")

    mapping = conversation.get("mapping")
    if isinstance(mapping, dict):
        return _records_from_chatgpt_mapping(mapping, conversation.get("current_node"))

    return _records_from_message_like_conversation(conversation, provider="chatgpt")


def _records_from_chatgpt_mapping(
    mapping: dict[str, Any],
    current_node: Any,
) -> list[NormalizedRecord]:
    ordered_nodes = _ordered_chatgpt_nodes(mapping, current_node)
    records: list[NormalizedRecord] = []
    for node in ordered_nodes:
        if not isinstance(node, dict):
            continue
        message = node.get("message")
        if not isinstance(message, dict):
            continue
        record = _record_from_chatgpt_message(message)
        if record is not None:
            records.append(record)
    return records


def _ordered_chatgpt_nodes(
    mapping: dict[str, Any],
    current_node: Any,
) -> list[dict[str, Any]]:
    if isinstance(current_node, str) and current_node in mapping:
        chain: list[dict[str, Any]] = []
        seen: set[str] = set()
        node_id: Optional[str] = current_node
        while node_id and node_id in mapping and node_id not in seen:
            seen.add(node_id)
            node = mapping[node_id]
            if isinstance(node, dict):
                chain.append(node)
                parent = node.get("parent")
                node_id = parent if isinstance(parent, str) else None
            else:
                node_id = None
        return list(reversed(chain))

    roots = [
        node_id
        for node_id, node in mapping.items()
        if isinstance(node, dict) and not node.get("parent")
    ]
    visited: set[str] = set()
    ordered: list[dict[str, Any]] = []

    def visit(node_id: str) -> None:
        if node_id in visited:
            return
        visited.add(node_id)
        node = mapping.get(node_id)
        if not isinstance(node, dict):
            return
        ordered.append(node)
        children = node.get("children")
        if isinstance(children, list):
            for child_id in children:
                if isinstance(child_id, str):
                    visit(child_id)

    for root in roots or list(mapping.keys()):
        visit(root)

    return ordered


def _record_from_chatgpt_message(message: dict[str, Any]) -> Optional[NormalizedRecord]:
    author = message.get("author")
    role = author.get("role") if isinstance(author, dict) else message.get("role")
    record_type = _role_to_type(role, provider="chatgpt")
    if record_type is None:
        return None

    content = _extract_text(message.get("content"))
    if not content:
        content = _extract_text(message.get("metadata"))
    return NormalizedRecord(record_type, content) if content else None


def _records_from_message_like_conversation(
    conversation: Any,
    *,
    provider: Provider,
) -> list[NormalizedRecord]:
    messages = _find_message_list(conversation)
    if messages is None:
        if isinstance(conversation, dict):
            record = _record_from_message_like(conversation, provider=provider)
            return [record] if record is not None else []
        raise ValueError("could not find a messages/chat_messages list")

    records: list[NormalizedRecord] = []
    for message in messages:
        record = _record_from_message_like(message, provider=provider)
        if record is not None:
            records.append(record)
    return records


def _find_message_list(value: Any) -> Optional[list[Any]]:
    if isinstance(value, dict):
        for key in (
            "messages",
            "chat_messages",
            "conversation",
            "turns",
            "entries",
            "items",
        ):
            candidate = value.get(key)
            if isinstance(candidate, list) and candidate:
                if any(_looks_like_message(item) for item in candidate):
                    return candidate
        for child in value.values():
            found = _find_message_list(child)
            if found is not None:
                return found
    elif isinstance(value, list):
        if value and any(_looks_like_message(item) for item in value):
            return value
        for item in value:
            found = _find_message_list(item)
            if found is not None:
                return found
    return None


def _looks_like_message(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    return bool(
        {"role", "sender", "author", "from", "type"} & set(value.keys())
    ) and bool(
        {
            "content",
            "text",
            "message",
            "parts",
            "query",
            "answer",
            "response",
            "title",
        }
        & set(value.keys())
    )


def _record_from_message_like(
    message: Any,
    *,
    provider: Provider,
) -> Optional[NormalizedRecord]:
    if not isinstance(message, dict):
        return None
    role = _extract_role(message)
    record_type = _role_to_type(role, provider=provider)
    if record_type is None:
        return None
    content = _extract_text(
        message.get("content")
        or message.get("text")
        or message.get("message")
        or message.get("parts")
        or message.get("query")
        or message.get("answer")
        or message.get("response")
        or message.get("title")
    )
    return NormalizedRecord(record_type, content) if content else None


def _extract_role(message: dict[str, Any]) -> Any:
    author = message.get("author")
    if isinstance(author, dict):
        return author.get("role") or author.get("name")
    if isinstance(author, str):
        return author
    sender = message.get("sender")
    if isinstance(sender, dict):
        return sender.get("role") or sender.get("name")
    return (
        message.get("role")
        or sender
        or message.get("from")
        or message.get("type")
    )


def _role_to_type(role: Any, *, provider: Provider) -> Optional[NormalizedType]:
    normalized = str(role or "").strip().lower()
    if normalized in {"user", "human", "customer", "me", "prompt"}:
        return "user_message"
    if normalized in {"assistant", "model", "gemini", "claude", "chatgpt", "bot"}:
        return "assistant_message"
    if normalized in {"system", "developer"}:
        return "system_event"
    if normalized in {"tool", "function", "tool_result", "function_result"}:
        return "tool_result"
    if provider == "gemini" and normalized in {"activity", "gemini_apps"}:
        return "user_message"
    return None


def _extract_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return _clean_text(value)
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, list):
        parts = [_extract_text(item) for item in value]
        return _clean_text("\n".join(part for part in parts if part))
    if isinstance(value, dict):
        content_type = value.get("content_type")
        if content_type == "code" and value.get("text"):
            return _clean_text(value["text"])
        for key in (
            "text",
            "content",
            "message",
            "value",
            "body",
            "parts",
            "result",
            "query",
            "answer",
            "response",
        ):
            if key in value:
                text = _extract_text(value[key])
                if text:
                    return text
        return ""
    return _clean_text(str(value))


def _clean_text(value: str) -> str:
    lines = [line.rstrip() for line in value.replace("\r\n", "\n").split("\n")]
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


def _load_named_json(source: Path, names: tuple[str, ...]) -> Any:
    if source.is_file() and source.suffix.lower() == ".json":
        return json.loads(source.read_text(encoding="utf-8"))
    if source.is_file() and zipfile.is_zipfile(source):
        with zipfile.ZipFile(source) as archive:
            members = {Path(name).name: name for name in archive.namelist()}
            for name in names:
                member = members.get(name)
                if member:
                    return json.loads(archive.read(member).decode("utf-8"))
            raise ValueError(
                "export archive does not contain any of: " + ", ".join(names)
            )
    if source.is_dir():
        for name in names:
            path = next(source.rglob(name), None)
            if path is not None:
                return json.loads(path.read_text(encoding="utf-8"))
    raise ValueError(f"unsupported export source: {source}")


def _load_first_json_collection(
    source: Path,
    *,
    preferred_names: tuple[str, ...],
) -> list[Any]:
    data_candidates = _load_json_candidates(source, preferred_names)
    for _, data in data_candidates:
        conversations = _as_conversation_list(data)
        if conversations:
            return conversations
    raise ValueError("could not find a conversation-like JSON collection")


def _load_json_candidates(
    source: Path,
    preferred_names: tuple[str, ...],
) -> list[tuple[str, Any]]:
    paths_and_data: list[tuple[str, Any]] = []
    if source.is_file() and source.suffix.lower() == ".json":
        return [(source.name, json.loads(source.read_text(encoding="utf-8")))]
    if source.is_file() and zipfile.is_zipfile(source):
        with zipfile.ZipFile(source) as archive:
            json_members = [
                name for name in archive.namelist() if name.lower().endswith(".json")
            ]
            json_members.sort(
                key=lambda name: (
                    Path(name).name not in preferred_names,
                    len(Path(name).parts),
                    name.lower(),
                )
            )
            for member in json_members:
                try:
                    paths_and_data.append(
                        (member, json.loads(archive.read(member).decode("utf-8")))
                    )
                except Exception:
                    continue
            return paths_and_data
    if source.is_dir():
        json_paths = list(source.rglob("*.json"))
        json_paths.sort(
            key=lambda path: (
                path.name not in preferred_names,
                len(path.parts),
                str(path).lower(),
            )
        )
        for path in json_paths:
            try:
                paths_and_data.append(
                    (str(path), json.loads(path.read_text(encoding="utf-8")))
                )
            except Exception:
                continue
        return paths_and_data
    raise ValueError(f"unsupported export source: {source}")


def _as_conversation_list(data: Any) -> list[Any]:
    if isinstance(data, list):
        if data and any(_find_message_list(item) is not None for item in data):
            return data
        if data and any(_looks_like_message(item) for item in data):
            return [data]
    if isinstance(data, dict):
        for key in ("conversations", "chats", "sessions", "data"):
            value = data.get(key)
            if isinstance(value, list):
                return value
        if _find_message_list(data) is not None:
            return [data]
    return []


def _select_conversation(
    conversations: list[Any],
    *,
    conversation_index: int,
    conversation_id: Optional[str],
) -> Any:
    if not conversations:
        raise ValueError("export contains no conversations")
    if conversation_id:
        for conversation in conversations:
            if _conversation_matches_id(conversation, conversation_id):
                return conversation
        raise ValueError(f"conversation id not found: {conversation_id}")
    if conversation_index < 0 or conversation_index >= len(conversations):
        raise ValueError(
            f"conversation index {conversation_index} out of range "
            f"(0..{len(conversations) - 1})"
        )
    return conversations[conversation_index]


def _conversation_matches_id(conversation: Any, expected: str) -> bool:
    if not isinstance(conversation, dict):
        return False
    for key in ("id", "conversation_id", "uuid", "chat_id"):
        value = conversation.get(key)
        if value is not None and str(value) == expected:
            return True
    return False


def _conversation_label(conversation: Any, index: int) -> str:
    if not isinstance(conversation, dict):
        return f"conversation[{index}]"
    for key in ("title", "name", "summary", "id", "uuid", "conversation_id"):
        value = conversation.get(key)
        if value:
            return str(value)
    return f"conversation[{index}]"
