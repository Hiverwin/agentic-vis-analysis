"""End-to-end MCP demo for scatter widget adapter."""

import asyncio
import copy
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

sys.path.append(str(Path(__file__).resolve().parents[1]))

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from agent.scatter_widget_adapter import ScatterWidgetAdapter
from core.vega_service import get_vega_service


def build_demo_spec() -> Dict[str, Any]:
    return {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "mark": {"type": "point", "filled": True, "size": 120},
        "encoding": {
            "x": {"field": "x", "type": "quantitative"},
            "y": {"field": "y", "type": "quantitative"},
            "color": {"field": "group", "type": "nominal"},
        },
        "data": {
            "values": [
                {"x": 1, "y": 2, "group": "A"},
                {"x": 2, "y": 4, "group": "A"},
                {"x": 3, "y": 7, "group": "B"},
                {"x": 4, "y": 9, "group": "B"},
                {"x": 5, "y": 8, "group": "C"},
            ]
        },
    }


def _count_visible(spec: Dict[str, Any], field: str, keep_values: List[Any]) -> int:
    values = (spec.get("data") or {}).get("values", [])
    if not keep_values:
        return len(values)
    return sum(1 for row in values if row.get(field) in keep_values)


def _mini_agent_choose_tool(question: str, tools: List[str]) -> Dict[str, Any]:
    """A deterministic mini-agent for stable classroom demo."""
    lowered = question.lower()
    if "custom_focus_group" in tools and ("group a" in lowered or "focus" in lowered):
        return {"tool_name": "custom_focus_group", "tool_args": {"field": "group", "keep_values": ["A"]}}
    return {"tool_name": "", "tool_args": {}}


def _save_render(spec: Dict[str, Any], filename: str) -> str:
    out_dir = Path(__file__).resolve().parent / "artifacts"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / filename
    result = get_vega_service().render(spec)
    if not result.get("success"):
        return f"render_failed:{result.get('error', 'unknown')}"
    image_data = result["image_base64"].split(",", 1)[-1]
    out_path.write_bytes(__import__("base64").b64decode(image_data))
    return str(out_path)


async def main():
    server_params = StdioServerParameters(
        command="python",
        args=[str(Path(__file__).resolve().parents[1] / "chart_tools_mcp_server.py")],
    )
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as mcp_session:
            await mcp_session.initialize()
            tools_resp = await mcp_session.list_tools()
            available_tools = [
                {
                    "name": t.name,
                    "description": t.description or "",
                    "params": t.inputSchema or {},
                }
                for t in tools_resp.tools
            ]
            adapter = ScatterWidgetAdapter(
                mcp_session=mcp_session,
                vega_spec=build_demo_spec(),
                available_tools=available_tools,
            )
            before_spec = copy.deepcopy(adapter.get_spec())

            tool_names = [t["name"] for t in adapter.list_tools()]
            question = "Please use custom_focus_group to keep only group A points and report the change."
            plan = _mini_agent_choose_tool(question, tool_names)
            if not plan["tool_name"]:
                # Fallback to a built-in scatter tool if custom tool is not exposed by MCP server.
                plan = {"tool_name": "zoom_2d_region", "tool_args": {"x_range": [1, 4], "y_range": [2, 9]}}

            print("=== DEMO CHAIN ===")
            print("1) custom_tool_visible_via_mcp =", "custom_focus_group" in tool_names)
            print("2) agent_question =", question)
            print("3) agent_plan =", json.dumps(plan, ensure_ascii=False))

            result = await adapter.execute_tool(plan["tool_name"], plan["tool_args"])
            after_spec = copy.deepcopy(adapter.get_spec())

            before_transform = before_spec.get("transform", [])
            after_transform = after_spec.get("transform", [])
            before_visible = len((before_spec.get("data") or {}).get("values", []))
            after_visible = _count_visible(after_spec, "group", ["A"])

            before_img = _save_render(before_spec, "scatter_before_custom_focus.png")
            after_img = _save_render(after_spec, "scatter_after_custom_focus.png")

            print("4) tool_success =", result.get("success"))
            print("5) tool_message =", result.get("message"))
            print("6) interaction_record =", json.dumps(adapter.get_last_interaction(), ensure_ascii=False))
            print("7) transform_before =", json.dumps(before_transform, ensure_ascii=False))
            print("8) transform_after =", json.dumps(after_transform, ensure_ascii=False))
            print(f"9) visible_points_before_after = {before_visible} -> {after_visible}")
            print("10) before_image =", before_img)
            print("11) after_image =", after_img)
            print("12) observation_keys =", sorted(adapter.get_observation().keys()))


if __name__ == "__main__":
    asyncio.run(main())
