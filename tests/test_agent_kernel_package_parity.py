import unittest

from agent.protocol_kernel import (
    append_phase as core_append_phase,
    build_step_record as core_build_step_record,
    compose_verify_summary as core_compose_verify_summary,
)
from packages.agent_kernel import (
    MCPWidgetRuntime,
    RuntimeSnapshot,
    append_phase as pkg_append_phase,
    build_step_record as pkg_build_step_record,
    compose_verify_summary as pkg_compose_verify_summary,
)


class _FakeText:
    def __init__(self, text):
        self.type = "text"
        self.text = text


class _FakeCallResult:
    def __init__(self, text):
        self.content = [_FakeText(text)]


class _FakeMcpSession:
    async def call_tool(self, name, arguments):
        import json

        updated = dict(arguments["vega_spec"])
        updated["mark"] = "triangle"
        payload = {"success": True, "message": f"called:{name}", "vega_spec": updated, "metric": 1}
        return _FakeCallResult(json.dumps(payload))


class _FakeVegaService:
    def render(self, _spec):
        return {"success": True, "image_base64": "rendered"}


def _extract_state(spec, _state=None):
    return {k: v for k, v in spec.items() if k != "data"}


class AgentKernelPackageParityTest(unittest.TestCase):
    def test_append_phase_parity(self):
        core_trace = []
        pkg_trace = []
        core_append_phase(core_trace, iteration=1, phase="observe", output={"x": 1})
        pkg_append_phase(pkg_trace, iteration=1, phase="observe", output={"x": 1})
        self.assertEqual(core_trace, pkg_trace)

    def test_compose_verify_summary_parity(self):
        records = [{"tool_name": "t1", "verify": {"passed": True, "mode": "tool_success", "message": "ok"}}]
        self.assertEqual(core_compose_verify_summary(records), pkg_compose_verify_summary(records))

    def test_build_step_record_parity(self):
        kwargs = dict(
            iteration=1,
            observe_output={"obs": "a"},
            plan_output={"tool_name": "x", "tool_args": {}, "stop_or_continue": "continue"},
            observation_context={"user_query": "q", "widget_state": {"a": 1}, "rendered_view": "img"},
            knowledge_context={"system_prompt": "sp", "tool_registry": [], "chart_specific_usage": "scatter_plot"},
        )
        self.assertEqual(core_build_step_record(**kwargs), pkg_build_step_record(**kwargs))

    def test_runtime_import_and_execution(self):
        import asyncio

        spec = {
            "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
            "mark": "point",
            "encoding": {"x": {"field": "x", "type": "quantitative"}},
            "data": {"values": [{"x": 1}]},
        }
        runtime = MCPWidgetRuntime(
            mcp_session=_FakeMcpSession(),
            snapshot=RuntimeSnapshot(spec=spec, state=_extract_state(spec), image_base64="init"),
            vega_service=_FakeVegaService(),
            extract_final_state=_extract_state,
            tool_analysis_keys=["metric"],
        )
        result = asyncio.run(runtime.execute_tool("demo_tool", {}))
        self.assertTrue(result["tool_result"]["success"])
        self.assertTrue(result["state_updated"])
        self.assertEqual(result["current_spec"]["mark"], "triangle")


if __name__ == "__main__":
    unittest.main()
