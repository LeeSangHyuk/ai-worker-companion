from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_DIR = ROOT / "outputs" / "representations_full_124_gemini_3_1_flash_lite"
DEFAULT_SUMMARY_PATH = ROOT / "reports" / "phase05_representation_quality_summary.json"
DEFAULT_OUTPUT_PATH = ROOT / "viewer" / "session_viewer.html"
REDACTION = "****REDACTED****"


PRIVATE_KEY_BLOCK_RE = re.compile(
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----",
    re.DOTALL,
)
BEARER_TOKEN_RE = re.compile(
    r"(?i)\b(Bearer)\s+[A-Za-z0-9._~+/=-]{8,}"
)
SENSITIVE_ASSIGNMENT_RE = re.compile(
    r"""
    \b(
        api[_-]?key
        | juso[_-]?key
        | servicekey
        | confmkey
        | access[_\s-]?token
        | bearer[_\s-]?token
        | password
        | secret
        | private[_\s-]?key
        | token
    )\b
    (\s*[:=]\s*)
    (["']?)
    ([^"'\s&;,<>]+)
    (["']?)
    """,
    re.IGNORECASE | re.VERBOSE,
)
EMAIL_RE = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"
)


def as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def text_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("value", "summary", "description", "content", "text"):
            if isinstance(value.get(key), str):
                return value[key]
    return str(value)


def sanitize_text(value: str) -> str:
    """Mask sensitive values only in generated viewer output."""
    if not value:
        return value

    sanitized = PRIVATE_KEY_BLOCK_RE.sub(REDACTION, value)
    sanitized = BEARER_TOKEN_RE.sub(r"\1 " + REDACTION, sanitized)

    def replace_assignment(match: re.Match[str]) -> str:
        key = match.group(1)
        separator = match.group(2)
        quote = match.group(3) or match.group(5) or ""
        if quote:
            return f"{key}{separator}{quote}{REDACTION}{quote}"
        return f"{key}{separator}{REDACTION}"

    sanitized = SENSITIVE_ASSIGNMENT_RE.sub(replace_assignment, sanitized)
    sanitized = EMAIL_RE.sub("****REDACTED_EMAIL****", sanitized)
    return sanitized


def one_line(value: str, limit: int = 150) -> str:
    compact = " ".join((value or "").split())
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1].rstrip() + "…"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def get_goal_stack(rep: dict[str, Any]) -> dict[str, Any]:
    return as_dict(rep.get("goal_stack") or rep.get("goal") or {})


def get_current_situation(rep: dict[str, Any]) -> dict[str, Any]:
    return as_dict(rep.get("current_situation") or rep.get("situation") or {})


def get_blocker(rep: dict[str, Any]) -> dict[str, Any]:
    return as_dict(rep.get("blocker"))


def get_evidence(rep: dict[str, Any]) -> list[dict[str, Any]]:
    evidence = rep.get("evidence") or rep.get("evidence_items") or []
    items: list[dict[str, Any]] = []
    for index, item in enumerate(as_list(evidence), start=1):
        if isinstance(item, dict):
            items.append(item)
        else:
            items.append({"id": f"e{index:03d}", "content": str(item)})
    return items


def previous_goals_text(goal_stack: dict[str, Any]) -> list[str]:
    result: list[str] = []
    for goal in as_list(goal_stack.get("previous_goals")):
        value = text_value(goal).strip()
        if value:
            result.append(value)
    return result


def sample_id_from_path(path: Path) -> str:
    name = path.name
    if name.endswith(".representation.json"):
        return name[: -len(".representation.json")]
    return path.stem


def load_summary_records(summary_path: Path) -> dict[str, dict[str, Any]]:
    if not summary_path.exists():
        return {}
    summary = load_json(summary_path)
    records = summary.get("records") or summary.get("samples") or []
    by_id: dict[str, dict[str, Any]] = {}
    for record in as_list(records):
        if not isinstance(record, dict):
            continue
        sample_id = (
            record.get("sample_id")
            or record.get("conversation_id")
            or record.get("id")
            or record.get("file")
        )
        if sample_id:
            by_id[str(sample_id)] = record
    return by_id


def status_badge(
    blocker_status: str,
    active_goal: str,
    evidence_count: int,
    record: dict[str, Any],
) -> str:
    if blocker_status == "present":
        return "Blocked"
    if blocker_status == "unknown":
        return "Unknown"

    turn_count = record.get("turn_count") or record.get("message_count") or record.get("records")
    try:
        turn_count_int = int(turn_count)
    except (TypeError, ValueError):
        turn_count_int = 0

    if evidence_count <= 1 or 0 < turn_count_int <= 2:
        return "Low Context"
    if not active_goal and 0 < turn_count_int <= 5:
        return "Low Context"
    if blocker_status == "none_observed" and active_goal:
        return "Healthy"
    return "Unknown"


def blocker_summary(blocker_status: str, blocker_description: str) -> str:
    if blocker_status == "present":
        return one_line(blocker_description or "Blocker is present.", 180)
    if blocker_status == "none_observed":
        return "No blocker observed."
    if blocker_status == "unknown":
        return "Blocker status is unknown."
    return blocker_status or "Unknown"


def compact_title(sample_id: str, rep: dict[str, Any], active_goal: str) -> str:
    title = rep.get("title") or rep.get("conversation_title")
    if isinstance(title, str) and title.strip():
        return title.strip()
    if active_goal:
        return one_line(active_goal, 80)
    return sample_id


def normalize_representation(
    path: Path,
    summary_records: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    rep = load_json(path)
    sample_id = sample_id_from_path(path)
    goal_stack = get_goal_stack(rep)
    current_situation = get_current_situation(rep)
    blocker = get_blocker(rep)
    evidence = get_evidence(rep)

    primary_goal = text_value(goal_stack.get("primary_goal")).strip()
    active_goal = text_value(goal_stack.get("active_goal")).strip()
    previous_goals = previous_goals_text(goal_stack)
    situation = text_value(current_situation.get("summary") or current_situation.get("value")).strip()
    blocker_status = text_value(blocker.get("status")).strip() or "unknown"
    blocker_description = text_value(
        blocker.get("description") or blocker.get("value") or blocker.get("summary")
    ).strip()

    record = summary_records.get(sample_id, {})
    badge = status_badge(blocker_status, active_goal, len(evidence), record)

    normalized_evidence = []
    for index, item in enumerate(evidence, start=1):
        normalized_evidence.append(
            {
                "id": text_value(item.get("id") or item.get("evidence_id") or f"e{index:03d}"),
                "role": text_value(item.get("role")),
                "content": sanitize_text(text_value(
                    item.get("content")
                    or item.get("quote")
                    or item.get("snippet")
                    or item.get("text")
                    or item.get("summary")
                )),
            }
        )

    return {
        "id": sample_id,
        "title": compact_title(sample_id, rep, active_goal),
        "status": badge,
        "primary_goal": primary_goal,
        "active_goal": active_goal,
        "active_goal_line": one_line(active_goal or "No active goal extracted.", 145),
        "previous_goals": previous_goals,
        "current_situation": situation,
        "current_situation_line": one_line(situation or "No current situation extracted.", 170),
        "blocker": {
            "status": blocker_status,
            "description": blocker_description,
            "summary": blocker_summary(blocker_status, blocker_description),
            "evidence_ids": as_list(blocker.get("evidence_ids")),
        },
        "evidence": normalized_evidence,
        "evidence_count": len(normalized_evidence),
        "source_file": str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
    }


def render_html(sessions: list[dict[str, Any]]) -> str:
    payload = json.dumps(sessions, ensure_ascii=False, indent=2).replace("</", "<\\/")
    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agent Workspace MVP</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f4f6fb;
      --panel: #ffffff;
      --panel-soft: #f8fafc;
      --text: #111827;
      --muted: #64748b;
      --line: #e2e8f0;
      --accent: #4f46e5;
      --accent-soft: #eef2ff;
      --blocked: #dc2626;
      --blocked-soft: #fee2e2;
      --healthy: #15803d;
      --healthy-soft: #dcfce7;
      --unknown: #64748b;
      --unknown-soft: #f1f5f9;
      --low: #b45309;
      --low-soft: #fef3c7;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
    }}
    .app {{
      display: grid;
      grid-template-columns: 410px 1fr;
      height: 100vh;
    }}
    aside {{
      border-right: 1px solid var(--line);
      background: var(--panel);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }}
    .sidebar-header {{
      padding: 22px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    }}
    .eyebrow {{
      margin: 0 0 6px;
      color: var(--accent);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
    }}
    .sidebar-header h1 {{
      margin: 0 0 8px;
      font-size: 22px;
      letter-spacing: -0.02em;
    }}
    .sidebar-header p {{
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }}
    #search {{
      width: calc(100% - 44px);
      margin: 16px 22px 8px;
      padding: 11px 13px;
      border: 1px solid var(--line);
      border-radius: 12px;
      font-size: 14px;
      outline: none;
    }}
    #search:focus {{
      border-color: #a5b4fc;
      box-shadow: 0 0 0 3px #e0e7ff;
    }}
    #session-list {{
      overflow: auto;
      padding: 10px 14px 22px;
    }}
    .session-button {{
      width: 100%;
      border: 1px solid var(--line);
      background: var(--panel);
      text-align: left;
      padding: 13px;
      border-radius: 16px;
      cursor: pointer;
      margin-bottom: 10px;
      transition: background .15s ease, border-color .15s ease, transform .15s ease;
    }}
    .session-button:hover {{
      background: #f8fafc;
      transform: translateY(-1px);
    }}
    .session-button.active {{
      background: var(--accent-soft);
      border-color: #a5b4fc;
    }}
    .session-card-top {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 9px;
    }}
    .session-id {{
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 12px;
      color: var(--muted);
    }}
    .session-title {{
      font-size: 14px;
      font-weight: 760;
      line-height: 1.35;
      margin-bottom: 7px;
      color: #0f172a;
    }}
    .session-situation {{
      font-size: 12.5px;
      color: var(--muted);
      line-height: 1.45;
      margin-bottom: 10px;
    }}
    .session-meta {{
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 12px;
      color: var(--muted);
    }}
    main {{
      overflow: auto;
      padding: 30px;
    }}
    .content {{
      max-width: 1120px;
      margin: 0 auto;
    }}
    .card {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 22px;
      margin-bottom: 18px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.045);
    }}
    .agent-summary {{
      background: radial-gradient(circle at top left, #eef2ff 0%, #ffffff 42%, #ffffff 100%);
      border-color: #c7d2fe;
      padding: 26px;
    }}
    .summary-top {{
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 20px;
    }}
    .summary-title h2 {{
      margin: 3px 0 6px;
      font-size: 28px;
      letter-spacing: -0.035em;
    }}
    .summary-grid {{
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }}
    .summary-tile {{
      background: rgba(255, 255, 255, .78);
      border: 1px solid #dbe3f0;
      border-radius: 16px;
      padding: 14px;
      min-height: 118px;
    }}
    .summary-label {{
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .06em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }}
    .summary-value {{
      line-height: 1.55;
      font-size: 14px;
      white-space: pre-wrap;
    }}
    h3 {{
      margin: 0 0 13px;
      font-size: 17px;
      letter-spacing: -0.01em;
    }}
    .muted {{
      color: var(--muted);
    }}
    .badge {{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 850;
      white-space: nowrap;
      background: var(--unknown-soft);
      color: var(--unknown);
    }}
    .badge.large {{
      padding: 8px 13px;
      font-size: 13px;
    }}
    .badge.Blocked {{ background: var(--blocked-soft); color: var(--blocked); }}
    .badge.Healthy {{ background: var(--healthy-soft); color: var(--healthy); }}
    .badge.Unknown {{ background: var(--unknown-soft); color: var(--unknown); }}
    .badge.LowContext {{ background: var(--low-soft); color: var(--low); }}
    .metric-row {{
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 10px;
    }}
    .metric {{
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 7px 10px;
      font-size: 12px;
      color: var(--muted);
      background: #fff;
    }}
    .action-row {{
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 14px;
    }}
    .resume-button {{
      border: 1px solid #4338ca;
      background: #4f46e5;
      color: #ffffff;
      border-radius: 999px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 8px 18px rgba(79, 70, 229, .22);
    }}
    .resume-button:hover {{
      background: #4338ca;
    }}
    .fallback-copy {{
      width: 100%;
      min-height: 180px;
      margin-top: 12px;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
      line-height: 1.5;
    }}
    .section-label {{
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .06em;
      text-transform: uppercase;
      margin: 14px 0 6px;
    }}
    .value {{
      white-space: pre-wrap;
      line-height: 1.65;
      font-size: 15px;
    }}
    ul {{
      margin: 0;
      padding-left: 20px;
    }}
    li {{
      margin-bottom: 7px;
      line-height: 1.55;
    }}
    .progress-list {{
      list-style: none;
      margin: 0;
      padding: 0;
      counter-reset: path-step;
    }}
    .progress-list li {{
      counter-increment: path-step;
      position: relative;
      padding: 13px 0 13px 44px;
      border-top: 1px solid var(--line);
    }}
    .progress-list li:first-child {{
      border-top: none;
    }}
    .progress-list li::before {{
      content: counter(path-step);
      position: absolute;
      left: 0;
      top: 12px;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 850;
    }}
    .progress-type {{
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .06em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }}
    .evidence-item {{
      border-top: 1px solid var(--line);
      padding: 13px 0;
    }}
    .evidence-item:first-child {{
      border-top: none;
      padding-top: 0;
    }}
    .evidence-id {{
      font-size: 12px;
      font-weight: 800;
      color: var(--accent);
      margin-bottom: 6px;
    }}
    .show-more {{
      border: 1px solid #c7d2fe;
      background: #eef2ff;
      color: #3730a3;
      border-radius: 999px;
      padding: 9px 13px;
      font-size: 13px;
      font-weight: 750;
      cursor: pointer;
      margin-top: 12px;
    }}
    @media (max-width: 1000px) {{
      .app {{ grid-template-columns: 1fr; }}
      aside {{ height: 45vh; border-right: none; border-bottom: 1px solid var(--line); }}
      main {{ height: 55vh; padding: 18px; }}
      .summary-grid {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
  <div class="app">
    <aside>
      <div class="sidebar-header">
        <p class="eyebrow">Agent Workspace MVP</p>
        <h1>AI Session State</h1>
        <p>긴 raw log 대신 현재 목표, 상황, blocker, evidence를 한 화면에서 확인합니다.</p>
      </div>
      <input id="search" type="search" placeholder="세션, 목표, 상태 검색">
      <div id="session-list"></div>
    </aside>
    <main>
      <div class="content" id="content"></div>
    </main>
  </div>
  <script id="session-data" type="application/json">{payload}</script>
  <script>
    const sessions = JSON.parse(document.getElementById('session-data').textContent);
    let selectedId = sessions[0]?.id || null;
    const expandedEvidence = new Set();

    const listEl = document.getElementById('session-list');
    const contentEl = document.getElementById('content');
    const searchEl = document.getElementById('search');

    function badgeClass(status) {{
      if (status === 'Low Context') return 'LowContext';
      return status || 'Unknown';
    }}

    function appendText(parent, tag, text, className) {{
      const el = document.createElement(tag);
      if (className) el.className = className;
      el.textContent = text || '—';
      parent.appendChild(el);
      return el;
    }}

    function blockerLabel(session) {{
      if (session.blocker.status === 'present') return 'Blocker present';
      if (session.blocker.status === 'none_observed') return 'No blocker';
      if (session.blocker.status === 'unknown') return 'Blocker unknown';
      return session.blocker.status || 'Blocker unknown';
    }}

    function buildResumePrompt(session) {{
      const previousGoals = session.previous_goals.length
        ? session.previous_goals.map((goal) => `- ${{goal}}`).join('\\n')
        : '- None';
      const evidenceLines = session.evidence.slice(0, 5).map((item) => {{
        const content = item.content || 'No evidence content.';
        return `- ${{item.id}}: ${{content}}`;
      }}).join('\\n') || '- None';

      return [
        'You are continuing an AI agent session.',
        '',
        'Current Goal:',
        session.active_goal || 'Not specified.',
        '',
        'Primary Goal:',
        session.primary_goal || 'Not specified.',
        '',
        'Previous Goals:',
        previousGoals,
        '',
        'Current Situation:',
        session.current_situation || 'Not specified.',
        '',
        'Blocker:',
        `status: ${{session.blocker.status || 'unknown'}}`,
        `description: ${{session.blocker.description || session.blocker.summary || 'Not specified.'}}`,
        '',
        'Key Evidence:',
        evidenceLines,
        '',
        'Instructions:',
        'Continue from this state. Do not restart from scratch. Use the current goal and blocker as the immediate context.'
      ].join('\\n');
    }}

    async function copyResumePrompt(session, button) {{
      const prompt = buildResumePrompt(session);
      const originalText = button.textContent;

      try {{
        if (!navigator.clipboard?.writeText) {{
          throw new Error('Clipboard API is not available.');
        }}
        await navigator.clipboard.writeText(prompt);
        button.textContent = 'Copied';
        setTimeout(() => {{
          button.textContent = originalText;
        }}, 1400);
      }} catch (error) {{
        const existing = document.getElementById('resume-fallback');
        if (existing) existing.remove();

        const textarea = document.createElement('textarea');
        textarea.id = 'resume-fallback';
        textarea.className = 'fallback-copy';
        textarea.value = prompt;
        textarea.setAttribute('readonly', 'readonly');
        contentEl.prepend(textarea);
        textarea.focus();
        textarea.select();
        alert('Clipboard copy failed. A textarea has been added at the top. Please copy it manually.');
      }}
    }}

    function renderProgressPath(session) {{
      const card = document.createElement('section');
      card.className = 'card';
      appendText(card, 'h3', 'Progress Path');

      const list = document.createElement('ol');
      list.className = 'progress-list';

      session.previous_goals.forEach((goal) => {{
        const item = document.createElement('li');
        appendText(item, 'div', 'Previous Goal', 'progress-type');
        appendText(item, 'div', goal, 'value');
        list.appendChild(item);
      }});

      const current = document.createElement('li');
      appendText(current, 'div', 'Current Goal', 'progress-type');
      appendText(current, 'div', session.active_goal || 'No active goal extracted.', 'value');
      list.appendChild(current);

      if (session.blocker.status === 'present') {{
        const blocker = document.createElement('li');
        appendText(blocker, 'div', 'Blocker', 'progress-type');
        appendText(blocker, 'div', session.blocker.summary || session.blocker.description, 'value');
        list.appendChild(blocker);
      }}

      card.appendChild(list);
      return card;
    }}

    function renderList() {{
      const query = searchEl.value.trim().toLowerCase();
      listEl.innerHTML = '';
      sessions
        .filter((session) => {{
          const haystack = [
            session.id,
            session.title,
            session.active_goal,
            session.current_situation,
            session.status,
            session.blocker.status
          ].join(' ').toLowerCase();
          return !query || haystack.includes(query);
        }})
        .forEach((session) => {{
          const button = document.createElement('button');
          button.className = 'session-button' + (session.id === selectedId ? ' active' : '');
          button.onclick = () => {{
            selectedId = session.id;
            renderList();
            renderContent();
          }};

          const top = document.createElement('div');
          top.className = 'session-card-top';
          appendText(top, 'div', session.id, 'session-id');
          const badge = document.createElement('span');
          badge.className = 'badge ' + badgeClass(session.status);
          badge.textContent = session.status;
          top.appendChild(badge);
          button.appendChild(top);

          appendText(button, 'div', session.active_goal_line || session.title, 'session-title');
          appendText(button, 'div', session.current_situation_line, 'session-situation');

          const meta = document.createElement('div');
          meta.className = 'session-meta';
          appendText(meta, 'span', blockerLabel(session));
          appendText(meta, 'span', `${{session.evidence_count}} evidence`);
          button.appendChild(meta);

          listEl.appendChild(button);
        }});
    }}

    function renderEvidence(session) {{
      const card = document.createElement('section');
      card.className = 'card';
      appendText(card, 'h3', 'Key Evidence');

      if (!session.evidence.length) {{
        appendText(card, 'div', 'Evidence가 없습니다.', 'muted');
        return card;
      }}

      const isExpanded = expandedEvidence.has(session.id);
      const visible = isExpanded ? session.evidence : session.evidence.slice(0, 5);
      visible.forEach((item) => {{
        const row = document.createElement('div');
        row.className = 'evidence-item';
        appendText(row, 'div', `${{item.id}}${{item.role ? ' · ' + item.role : ''}}`, 'evidence-id');
        appendText(row, 'div', item.content, 'value');
        card.appendChild(row);
      }});

      if (session.evidence.length > 5) {{
        const button = document.createElement('button');
        button.className = 'show-more';
        button.textContent = isExpanded
          ? 'Show less evidence'
          : `Show more key evidence (${{session.evidence.length - 5}} more)`;
        button.onclick = () => {{
          if (isExpanded) expandedEvidence.delete(session.id);
          else expandedEvidence.add(session.id);
          renderContent();
        }};
        card.appendChild(button);
      }}
      return card;
    }}

    function renderContent() {{
      const session = sessions.find((item) => item.id === selectedId) || sessions[0];
      if (!session) {{
        contentEl.textContent = '표시할 세션이 없습니다.';
        return;
      }}
      contentEl.innerHTML = '';

      const summary = document.createElement('section');
      summary.className = 'card agent-summary';

      const summaryTop = document.createElement('div');
      summaryTop.className = 'summary-top';
      const title = document.createElement('div');
      title.className = 'summary-title';
      appendText(title, 'div', 'Agent Status', 'eyebrow');
      appendText(title, 'h2', session.title);
      appendText(title, 'div', session.id, 'muted');
      const metrics = document.createElement('div');
      metrics.className = 'metric-row';
      appendText(metrics, 'span', `Evidence: ${{session.evidence_count}}`, 'metric');
      appendText(metrics, 'span', session.source_file, 'metric');
      title.appendChild(metrics);

      const badge = document.createElement('span');
      badge.className = 'badge large ' + badgeClass(session.status);
      badge.textContent = session.status;
      const actions = document.createElement('div');
      actions.className = 'action-row';
      const resumeButton = document.createElement('button');
      resumeButton.className = 'resume-button';
      resumeButton.textContent = 'Copy Resume Prompt';
      resumeButton.onclick = () => copyResumePrompt(session, resumeButton);
      actions.appendChild(resumeButton);
      title.appendChild(actions);
      summaryTop.appendChild(title);
      summaryTop.appendChild(badge);
      summary.appendChild(summaryTop);

      const grid = document.createElement('div');
      grid.className = 'summary-grid';

      const goalTile = document.createElement('div');
      goalTile.className = 'summary-tile';
      appendText(goalTile, 'div', 'Current Goal', 'summary-label');
      appendText(goalTile, 'div', session.active_goal, 'summary-value');
      grid.appendChild(goalTile);

      const situationTile = document.createElement('div');
      situationTile.className = 'summary-tile';
      appendText(situationTile, 'div', 'Current State', 'summary-label');
      appendText(situationTile, 'div', session.current_situation, 'summary-value');
      grid.appendChild(situationTile);

      const blockerTile = document.createElement('div');
      blockerTile.className = 'summary-tile';
      appendText(blockerTile, 'div', 'Blocker Summary', 'summary-label');
      appendText(blockerTile, 'div', session.blocker.summary, 'summary-value');
      grid.appendChild(blockerTile);

      summary.appendChild(grid);
      contentEl.appendChild(summary);
      contentEl.appendChild(renderProgressPath(session));

      const goals = document.createElement('section');
      goals.className = 'card';
      appendText(goals, 'h3', 'Work Path');
      appendText(goals, 'div', 'Primary Goal', 'section-label');
      appendText(goals, 'div', session.primary_goal, 'value');
      appendText(goals, 'div', 'Active Goal', 'section-label');
      appendText(goals, 'div', session.active_goal, 'value');
      appendText(goals, 'div', 'Previous Goals', 'section-label');
      if (session.previous_goals.length) {{
        const ul = document.createElement('ul');
        session.previous_goals.forEach((goal) => appendText(ul, 'li', goal));
        goals.appendChild(ul);
      }} else {{
        appendText(goals, 'div', '—', 'value');
      }}
      contentEl.appendChild(goals);

      const situation = document.createElement('section');
      situation.className = 'card';
      appendText(situation, 'h3', 'Current State');
      appendText(situation, 'div', session.current_situation, 'value');
      contentEl.appendChild(situation);

      const blocker = document.createElement('section');
      blocker.className = 'card';
      appendText(blocker, 'h3', 'Blocker');
      appendText(blocker, 'div', `status: ${{session.blocker.status}}`, 'section-label');
      appendText(blocker, 'div', session.blocker.description || session.blocker.summary, 'value');
      if (session.blocker.evidence_ids?.length) {{
        appendText(blocker, 'div', `evidence: ${{session.blocker.evidence_ids.join(', ')}}`, 'muted');
      }}
      contentEl.appendChild(blocker);

      contentEl.appendChild(renderEvidence(session));
    }}

    searchEl.addEventListener('input', renderList);
    renderList();
    renderContent();
  </script>
</body>
</html>
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a static Agent Workspace MVP from representation JSON files."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT_DIR,
        help="Directory containing *.representation.json files.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help="Output HTML path.",
    )
    parser.add_argument(
        "--summary",
        type=Path,
        default=DEFAULT_SUMMARY_PATH,
        help="Optional Phase 0.5 quality summary JSON path.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_dir = args.input if args.input.is_absolute() else ROOT / args.input
    output_path = args.output if args.output.is_absolute() else ROOT / args.output
    summary_path = args.summary if args.summary.is_absolute() else ROOT / args.summary
    summary_records = load_summary_records(summary_path)

    if not input_dir.exists():
        raise SystemExit(f"Input directory not found: {input_dir}")

    paths = sorted(input_dir.glob("*.representation.json"))
    if not paths:
        raise SystemExit(f"No representation JSON files found in: {input_dir}")

    sessions = [normalize_representation(path, summary_records) for path in paths]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(render_html(sessions), encoding="utf-8")

    print(f"Wrote {len(sessions)} sessions to {output_path}")


if __name__ == "__main__":
    main()
