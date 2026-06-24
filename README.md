# Agentic Visual Reframe

This repository has been trimmed around three code layers that should remain the mainline for handoff and future development:

1. Runtime demo: single-session agent + visualization interaction
2. MCP chart tools: chart mutation / perception tool server
3. Host integration: package-style Python SDK and embeddable React UI

## Main Entrypoints

- Runtime backend: `web_server.py`
- Runtime frontend: `frontend/`
- Session/state core: `core/session_manager.py`
- MCP tool server: `chart_tools_mcp_server.py`
- Tool implementations: `tools/`
- Host SDK: `packages/widget_sdk/`
- Shared protocol kernel/platform runtime: `packages/agent_kernel/`
- Host UI package: `packages/agent_widget_ui/`

## Current Platform Split

The host-facing SDK no longer depends on `benchmark/`. Shared model registry and protocol runtime now live in:

- `packages/agent_kernel/model_registry.py`
- `packages/agent_kernel/protocol_runtime.py`

`benchmark/config.py` is kept only as a backward-compatible facade.

## What A New Maintainer Should Focus On

If the goal is `multi-widget` long-sequence work, the most important existing primitives are:

- session lifecycle, persistence, pause/resume/interrupt
- provenance graph and trajectory branching
- selection-aware follow-up queries
- MCP tool registration and widget-specific tool plugins
- host-side persistent analysis session API

Detailed handoff notes are in `HANDOVER.md`.

## Non-Core Directories

These still exist in the repo for reference, but they are not the mainline platform surface:

- `benchmark/`
- `benchmark_annotation_system/`
- `visagentbench/`
- `external_va_demo/`
- `templates/`
- `examples/`

They should not be the starting point for the next phase unless a benchmark or migration task explicitly needs them.
