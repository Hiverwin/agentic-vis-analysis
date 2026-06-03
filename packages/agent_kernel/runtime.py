"""MCP runtime used by package consumers."""

import copy
import json
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

from state_manager import StateManager


ExtractStateFn = Callable[[Dict[str, Any], Optional[Dict[str, Any]]], Dict[str, Any]]


@dataclass
class RuntimeSnapshot:
    spec: Dict[str, Any]
    state: Dict[str, Any]
    image_base64: str


class MCPWidgetRuntime:
    """Protocol runtime that executes tools through MCP session."""

    def __init__(
        self,
        *,
        mcp_session: Any,
        snapshot: RuntimeSnapshot,
        vega_service: Any,
        extract_final_state: ExtractStateFn,
        tool_analysis_keys: Optional[List[str]] = None,
    ):
        self.mcp_session = mcp_session
        self.snapshot = snapshot
        self.vega_service = vega_service
        self.extract_final_state = extract_final_state
        self.tool_analysis_keys = tool_analysis_keys or []

    def get_observation(self) -> Dict[str, Any]:
        return {
            "widget_state": self.snapshot.state,
            "rendered_view": self.snapshot.image_base64,
        }

    async def execute_tool(self, tool_name: str, tool_args: Dict[str, Any]) -> Dict[str, Any]:
        previous_spec = copy.deepcopy(self.snapshot.spec)
        mcp_result = await self.mcp_session.call_tool(
            name=tool_name,
            arguments={**(tool_args or {}), "vega_spec": self.snapshot.spec},
        )

        tool_result = _parse_tool_result(mcp_result)
        updated_spec = _restore_data_if_needed(tool_result, self.snapshot.spec)
        state_updated = False

        if updated_spec is not None:
            self.snapshot.spec = updated_spec
            self.snapshot.state = (
                tool_result["state"]
                if "state" in tool_result
                else self.extract_final_state(updated_spec)
            )
            render_result = self.vega_service.render(updated_spec)
            if render_result.get("success"):
                self.snapshot.image_base64 = render_result["image_base64"]
            state_updated = True

        return {
            "tool_result": tool_result,
            "tool_message": tool_result.get("message", "") or tool_result.get("error", ""),
            "analysis_data": {
                key: tool_result[key]
                for key in self.tool_analysis_keys
                if key in tool_result and tool_result[key] is not None
            },
            "prev_spec": previous_spec,
            "current_spec": self.snapshot.spec,
            "current_state": self.snapshot.state,
            "current_image": self.snapshot.image_base64,
            "state_updated": state_updated,
        }


def _parse_tool_result(mcp_result: Any) -> Dict[str, Any]:
    for content_item in getattr(mcp_result, "content", []) or []:
        if getattr(content_item, "type", "") != "text":
            continue
        try:
            return json.loads(content_item.text)
        except json.JSONDecodeError:
            return {"success": False, "message": content_item.text}
    return {}


def _restore_data_if_needed(tool_result: Dict[str, Any], previous_spec: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not tool_result.get("success"):
        return None

    updated_spec = tool_result.get("vega_spec") or tool_result.get("vega_state")
    if not isinstance(updated_spec, dict):
        return None

    if "data" in updated_spec and updated_spec.get("data") is not None:
        return updated_spec

    previous_data = previous_spec.get("data")
    if previous_data is None:
        return updated_spec
    return StateManager.reconstruct(updated_spec, previous_data)
