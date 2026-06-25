"""Tool contract types for widget-centric agent runtime."""

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional

SINGLE_WIDGET_AGENT_CONTRACT_VERSION = "widgetva.single-widget.agent.v1"


@dataclass
class ToolDescriptor:
    """Serializable tool metadata exposed to agents."""

    name: str
    category: str
    description: str
    params: Dict[str, Any]


@dataclass
class ToolExecutionResult:
    """Normalized tool execution result contract."""

    success: bool
    message: str
    error: str = ""
    data: Optional[Dict[str, Any]] = None
    state: Optional[Dict[str, Any]] = None
    vega_spec: Optional[Dict[str, Any]] = None


@dataclass
class ToolCallRecord:
    """Trace-friendly tool call record."""

    tool_name: str
    parameters: Dict[str, Any]
    result: ToolExecutionResult


@dataclass
class SingleWidgetAgentContract:
    """Serializable mirror of the widgetva single-widget agent contract."""

    version: str = SINGLE_WIDGET_AGENT_CONTRACT_VERSION
    widget: Dict[str, Any] = field(
        default_factory=lambda: {
            "ref": None,
            "widgetId": None,
            "kind": None,
            "title": None,
            "role": None,
        }
    )
    observe: Dict[str, Any] = field(
        default_factory=lambda: {
            "observationMethodName": "readObservation",
            "stateMethodName": "readState",
            "verificationStateMethodName": "readVerificationState",
            "perceptionMethodName": "queryPerception",
        }
    )
    act: Dict[str, Any] = field(
        default_factory=lambda: {
            "actionMethodName": "executeAction",
            "verifiedActionMethodName": "executeVerifiedAction",
        }
    )
    verify: Dict[str, Any] = field(
        default_factory=lambda: {
            "verifyQueryName": "perception.verifyActionEffect",
            "verificationStateMethodName": "readVerificationState",
            "verificationContract": None,
        }
    )
    catalog: Dict[str, Any] = field(
        default_factory=lambda: {
            "actionDescriptors": [],
            "perceptionDescriptors": [],
            "availableActionNames": [],
            "availablePerceptionNames": [],
        }
    )
    schemas: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Return a JSON-serializable contract payload."""
        return asdict(self)


def descriptors_from_openai_tools(openai_tools: List[Dict[str, Any]]) -> List[ToolDescriptor]:
    """Convert OpenAI tool schema list to ToolDescriptor list."""
    out: List[ToolDescriptor] = []
    for tool in openai_tools or []:
        fn = tool.get("function", {})
        name = fn.get("name")
        if not name:
            continue
        out.append(
            ToolDescriptor(
                name=name,
                category="action",
                description=fn.get("description", ""),
                params=fn.get("parameters", {}),
            )
        )
    return out


def build_single_widget_agent_contract(
    *,
    widget: Optional[Dict[str, Any]] = None,
    action_descriptors: Optional[List[Dict[str, Any]]] = None,
    perception_descriptors: Optional[List[Dict[str, Any]]] = None,
    verification_contract: Optional[Dict[str, Any]] = None,
    schemas: Optional[Dict[str, Any]] = None,
) -> SingleWidgetAgentContract:
    """Build the normalized Python mirror of the widgetva single-widget contract."""
    action_descriptors = list(action_descriptors or [])
    perception_descriptors = list(perception_descriptors or [])
    return SingleWidgetAgentContract(
        widget={**SingleWidgetAgentContract().widget, **(widget or {})},
        verify={
            **SingleWidgetAgentContract().verify,
            "verificationContract": verification_contract,
        },
        catalog={
            "actionDescriptors": action_descriptors,
            "perceptionDescriptors": perception_descriptors,
            "availableActionNames": [
                descriptor.get("name")
                for descriptor in action_descriptors
                if isinstance(descriptor, dict) and descriptor.get("name")
            ],
            "availablePerceptionNames": [
                descriptor.get("name")
                for descriptor in perception_descriptors
                if isinstance(descriptor, dict) and descriptor.get("name")
            ],
        },
        schemas=dict(schemas or {}),
    )
