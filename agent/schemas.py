"""Minimal schemas for framework-aligned agent loop."""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class AgentObservation:
    """Dynamic context aligned with paper Observation."""

    user_query: str
    widget_state: Dict[str, Any]
    rendered_view: str
    widget_ref: str = ""
    widget_kind: str = ""
    action_contract: Optional[Dict[str, Any]] = None
    verification_state: Optional[Dict[str, Any]] = None
    available_actions: List[Dict[str, Any]] = field(default_factory=list)
    available_perceptions: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class AgentKnowledge:
    """Persistent context aligned with paper Knowledge."""

    system_prompt: str
    tool_registry: List[Dict[str, Any]]
    chart_specific_usage: str
    action_contract: Optional[Dict[str, Any]] = None
    preferred_action_surface: str = "executeAction"
    preferred_verify_surface: str = "perception.verifyActionEffect"
