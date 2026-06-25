"""Import and runtime smoke demo for packages.agent_kernel."""

import asyncio
import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from packages.agent_kernel import (
    MCPWidgetRuntime,
    ProtocolAgentRunner,
    RuntimeSnapshot,
    append_phase,
    compose_verify_summary,
)


class _FakeText:
    def __init__(self, text: str):
        self.type = "text"
        self.text = text


class _FakeCallResult:
    def __init__(self, payload):
        self.content = [_FakeText(json.dumps(payload, ensure_ascii=False))]


class _FakeMcpSession:
    async def call_tool(self, name, arguments):
        updated = dict(arguments["vega_spec"])
        updated["mark"] = "square"
        return _FakeCallResult({"success": True, "message": f"called:{name}", "vega_spec": updated})


class _FakeVegaService:
    def render(self, _spec):
        return {"success": True, "image_base64": "demo-image"}


def _extract_state(spec, _state=None):
    return {k: v for k, v in spec.items() if k != "data"}


async def main():
    print("import_ok:", all([MCPWidgetRuntime, ProtocolAgentRunner, append_phase]))

    phase_trace = []
    append_phase(phase_trace, iteration=1, phase="observe", output={"ok": True})
    print("kernel_helper_ok:", len(phase_trace) == 1)
    print("verify_summary_example:", compose_verify_summary([{"tool_name": "demo_tool", "verify": {"passed": True, "mode": "tool_success", "message": "ok"}}]))

    spec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "mark": "point",
        "encoding": {"x": {"field": "x", "type": "quantitative"}},
        "data": {"values": [{"x": 1}]},
    }
    runtime = MCPWidgetRuntime(
        mcp_session=_FakeMcpSession(),
        snapshot=RuntimeSnapshot(spec=spec, state=_extract_state(spec), image_base64="init-image"),
        vega_service=_FakeVegaService(),
        extract_final_state=_extract_state,
        tool_analysis_keys=[],
    )
    result = await runtime.execute_tool("demo_tool", {})
    print("runtime_call_success:", result["tool_result"].get("success"))
    print("runtime_state_updated:", result.get("state_updated"))
    print("runtime_mark_after:", result["current_spec"].get("mark"))


if __name__ == "__main__":
    asyncio.run(main())

