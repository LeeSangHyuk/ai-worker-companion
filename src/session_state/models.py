import re
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


EventType = Literal[
    "user_message",
    "assistant_message",
    "tool_call",
    "tool_result",
    "system_event",
]

StatePhase = Literal[
    "planning",
    "working",
    "waiting",
    "reporting",
    "completed",
    "unknown",
]

LEGACY_STATE_PHASE_MAP = {
    "orienting": "working",
    "investigating": "working",
    "modifying": "working",
    "verifying": "working",
    "waiting": "waiting",
    "reporting": "reporting",
    "completed": "completed",
    "unknown": "unknown",
}

BlockerStatus = Literal["present", "none_observed", "unknown"]


class Event(BaseModel):
    id: str
    type: EventType
    content: str
    source_line: int


class GoalEntry(BaseModel):
    value: Optional[str]
    evidence_ids: list[str] = Field(default_factory=list)


class GoalStack(BaseModel):
    primary_goal: GoalEntry
    active_goal: GoalEntry
    previous_goals: list[GoalEntry] = Field(default_factory=list)
    goal_shift_detected: bool = False
    goal_shift_evidence: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_shift_evidence(self) -> "GoalStack":
        if self.goal_shift_detected and not self.goal_shift_evidence:
            raise ValueError(
                "detected goal shift requires goal_shift_evidence"
            )
        return self


class CurrentSituation(BaseModel):
    summary: str = Field(min_length=1)
    evidence_ids: list[str] = Field(min_length=1)

    @field_validator("summary")
    @classmethod
    def limit_to_two_sentences(cls, value: str) -> str:
        summary = value.strip()
        sentence_endings = re.findall(r"[.!?。！？]+(?:\s|$)", summary)
        if len(sentence_endings) > 2:
            raise ValueError("current situation must contain at most two sentences")
        return summary


class Blocker(BaseModel):
    status: BlockerStatus
    value: Optional[str]
    evidence_ids: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_status_fields(self) -> "Blocker":
        if self.status == "present":
            if not self.value:
                raise ValueError("present blocker requires a value")
            if not self.evidence_ids:
                raise ValueError("present blocker requires evidence_ids")
        elif self.status == "none_observed" and self.value is not None:
            raise ValueError("none_observed blocker must have a null value")
        return self


class Extraction(BaseModel):
    goal: GoalStack
    current_situation: CurrentSituation
    blocker: Blocker
    experimental_phase: StatePhase = "unknown"

    @field_validator("experimental_phase", mode="before")
    @classmethod
    def map_legacy_phase(cls, value: object) -> object:
        if isinstance(value, str):
            return LEGACY_STATE_PHASE_MAP.get(value, value)
        return value


class Evidence(BaseModel):
    id: str
    type: EventType
    content: str
    source_line: int


class FinalResult(BaseModel):
    goal: GoalStack
    current_situation: CurrentSituation
    blocker: Blocker
    evidence: list[Evidence]
