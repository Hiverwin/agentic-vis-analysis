# agent_kernel (MCP-only)

`agent_kernel` is an importable facade for the protocol kernel and MCP runtime.

## What is exported

- `append_phase`, `build_step_record`, `compose_verify_summary`, `dedupe_insights`, `derive_final_answer`
- `ProtocolAgentRunner`, `ProtocolRunnerDeps`
- `MCPWidgetRuntime`, `RuntimeSnapshot`
- `ModelConfig`, `get_model_config`, `create_client`
- `convert_mcp_tools_to_openai_format`, `run_protocol_va_with_mcp`

## Minimal usage

```python
from packages.agent_kernel import RuntimeSnapshot, MCPWidgetRuntime
```

For an executable example, run:

```bash
python examples/package_import_demo.py
```

## Scope

- This package is MCP-only by design.
- It now also owns the shared model registry and protocol runtime used by both `benchmark/` and `packages/widget_sdk/`.
- Main project runtime path is intentionally unchanged.
