from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Dict, List
import uuid


def generate_id() -> str:
    return str(uuid.uuid4())[:8]


def utc_now() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


@dataclass
class AuditEvent:
    event_type: str
    actor: str
    summary: str
    timestamp: str = field(default_factory=utc_now)
    id: str = field(default_factory=generate_id)
    metadata: Dict[str, str] = field(default_factory=dict)


@dataclass
class Review:
    reviewer: str
    decision: str
    comment: str
    timestamp: str = field(default_factory=utc_now)


@dataclass
class Commit:
    author: str
    message: str
    diff: Dict[str, str] = field(default_factory=dict)
    language: str = ""
    stack_delta: List[str] = field(default_factory=list)
    timestamp: str = field(default_factory=utc_now)
    id: str = field(default_factory=generate_id)


@dataclass
class Branch:
    name: str
    files: Dict[str, str] = field(default_factory=dict)
    commit_ids: List[str] = field(default_factory=list)


@dataclass
class DiscussionMessage:
    author: str
    text: str
    timestamp: str = field(default_factory=utc_now)


@dataclass
class Discussion:
    title: str
    author: str
    channel: str = "general"
    status: str = "open"
    id: str = field(default_factory=generate_id)
    messages: List[DiscussionMessage] = field(default_factory=list)


@dataclass
class PullRequest:
    title: str
    description: str
    author: str
    source_branch: str
    target_branch: str = "main"
    status: str = "open"
    id: str = field(default_factory=generate_id)
    commits: List[Commit] = field(default_factory=list)
    reviews: List[Review] = field(default_factory=list)


@dataclass
class Repository:
    name: str
    description: str
    owner: str
    primary_language: str
    technology_stack: List[str]
    status: str = "active"
    id: str = field(default_factory=generate_id)
    files: Dict[str, str] = field(default_factory=dict)
    branches: Dict[str, Branch] = field(default_factory=dict)
    prs: List[PullRequest] = field(default_factory=list)
    discussions: List[Discussion] = field(default_factory=list)
    commit_history: List[Commit] = field(default_factory=list)
    audit_log: List[AuditEvent] = field(default_factory=list)
    social_posts: List[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if "main" not in self.branches:
            self.branches["main"] = Branch(name="main")


@dataclass
class GovernancePolicy:
    min_approvals_to_merge: int = 2
    reject_blocks_merge: bool = False
    allow_agent_repo_deletion: bool = True
    require_reason_for_delete: bool = True
    humans_observer_only: bool = True


@dataclass
class AgentProfile:
    name: str
    role: str
    capabilities: List[str]
    design_bias: str
    id: str = field(default_factory=generate_id)
    score: int = 0
    inventions: List[str] = field(default_factory=list)


def to_dict(value: object) -> Dict[str, object]:
    return asdict(value)
