import inspect
import unittest

from packages.agent_kernel import convert_mcp_tools_to_openai_format, get_model_config
from packages.widget_sdk import scatter_analyzer


class _FakeTool:
    def __init__(self, name, schema=None, description=""):
        self.name = name
        self.inputSchema = schema or {}
        self.description = description


class PlatformLayerDecouplingTest(unittest.TestCase):
    def test_widget_sdk_no_longer_imports_benchmark_modules(self):
        source = inspect.getsource(scatter_analyzer)
        self.assertNotIn("benchmark.", source)

    def test_platform_model_registry_is_available(self):
        cfg = get_model_config("gpt_protocol")
        self.assertEqual(cfg.model, "openai/gpt-5.4-mini")

    def test_convert_mcp_tools_strips_runtime_only_fields(self):
        tool = _FakeTool(
            "demo_tool",
            schema={
                "type": "object",
                "properties": {
                    "vega_spec": {"type": "object"},
                    "state": {"type": "object"},
                    "field": {"type": "string"},
                },
                "required": ["vega_spec", "field"],
            },
        )

        converted = convert_mcp_tools_to_openai_format([tool])
        params = converted[0]["function"]["parameters"]

        self.assertNotIn("vega_spec", params["properties"])
        self.assertNotIn("state", params["properties"])
        self.assertEqual(params["required"], ["field"])


if __name__ == "__main__":
    unittest.main()
