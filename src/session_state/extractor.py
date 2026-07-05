import os
from typing import Literal, Optional

from openai import OpenAI

from .models import Evidence, Extraction, FinalResult, Event
from .prompt import SYSTEM_PROMPT, render_events


Provider = Literal["openai", "gemini"]


def default_model(provider: Provider) -> str:
    if provider == "gemini":
        return os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    return os.environ.get("OPENAI_MODEL", "gpt-5-mini")


def extract_session_state(
    events: list[Event],
    model: str,
    provider: Provider = "openai",
    client: Optional[OpenAI] = None,
) -> FinalResult:
    if not events:
        raise ValueError("at least one event is required")

    if provider == "openai":
        api = client or OpenAI()
        response = api.responses.parse(
            model=model,
            input=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": render_events(events)},
            ],
            text_format=Extraction,
        )
        extraction = response.output_parsed
    elif provider == "gemini":
        api_key = os.environ.get("GEMINI_API_KEY")
        if client is None and not api_key:
            raise ValueError("GEMINI_API_KEY is not set")
        api = client or OpenAI(
            api_key=api_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        )
        completion = api.chat.completions.parse(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": render_events(events)},
            ],
            response_format=Extraction,
        )
        extraction = completion.choices[0].message.parsed
    else:
        raise ValueError(f"unsupported provider: {provider}")

    if extraction is None:
        raise RuntimeError("the model did not return a parsed extraction")

    events_by_id = {event.id: event for event in events}
    referenced_ids = _referenced_evidence_ids(extraction)
    invalid_ids = sorted(set(referenced_ids) - set(events_by_id))
    if invalid_ids:
        raise ValueError(
            "model referenced evidence outside the analyzed cutoff: "
            + ", ".join(invalid_ids)
        )

    evidence = [
        Evidence(
            id=events_by_id[event_id].id,
            type=events_by_id[event_id].type,
            content=events_by_id[event_id].content,
            source_line=events_by_id[event_id].source_line,
        )
        for event_id in _unique_in_order(referenced_ids)
    ]

    return FinalResult(
        goal=extraction.goal,
        current_situation=extraction.current_situation,
        blocker=extraction.blocker,
        evidence=evidence,
    )


def _referenced_evidence_ids(extraction: Extraction) -> list[str]:
    goals = [
        extraction.goal.primary_goal,
        extraction.goal.active_goal,
        *extraction.goal.previous_goals,
    ]
    return [
        *(evidence_id for goal in goals for evidence_id in goal.evidence_ids),
        *extraction.goal.goal_shift_evidence,
        *extraction.current_situation.evidence_ids,
        *extraction.blocker.evidence_ids,
    ]


def _unique_in_order(values: list[str]) -> list[str]:
    return list(dict.fromkeys(values))
