# Widget-Centric Agent Integration

This document describes what is included in this folder and how to integrate the agent capability into an existing VA system.

## Overview

The integration supports:

- chart-aware analysis from host-provided `vega_spec`
- tool calling during analysis
- iterative and multi-turn analysis flows
- optional React UI embedding through `AgentWidget`
- host-defined tool extensions through a plugin surface

By default, backend analysis uses a fixed GPT-driven protocol agent (`gpt_protocol`).  
`model_name` is optional and only needed if backend operators enable model override.

## What Is Included

### 1) Headless SDK (`packages/widget_sdk`)

Use this layer for backend/service integration.

Core capabilities:

- single-shot analysis: `analyze_widget(AnalysisRequest)`
- session flow: `start_widget_session(...)` and `continue_analysis(...)`
- plugin registration: `register_plugin(...)` and `register_widget_tool(...)`
- chart type inference from `vega_spec`

### 2) React UI package (`packages/agent_widget_ui`)

Use this layer to mount a ready-made analysis panel in a host frontend.

Exports:

- `AgentWidget`
- `useAgentAnalysis`
- typed request/response interfaces

### 3) Protocol/runtime facade (`packages/agent_kernel`)

MCP-only protocol kernel and runtime facade used by the SDK layer.

### 4) Internal validation template (`templates/host_va_react`)

Local integration harness used to validate host-side embedding and API wiring.

## Quick Start

### React integration

```tsx
import { AgentWidget } from "@agentic-visual-reframe/agent-widget-ui";

export function AnalysisPanel({ hostWidgetSpec }: { hostWidgetSpec: Record<string, unknown> }) {
  return (
    <AgentWidget
      apiBaseUrl="https://your-agent-service.example.com"
      vegaSpec={hostWidgetSpec}
    />
  );
}
```

### Headless Python integration

```python
from packages.widget_sdk import AnalysisRequest, analyze_widget

request = AnalysisRequest(
    query="Summarize the main trend in this chart.",
    vega_spec=my_vega_spec,
)

result = await analyze_widget(request)
print(result.answer)
```

## Integration Steps

1. Keep your existing chart rendering/UI unchanged.
2. Convert current chart state into a `vega_spec` snapshot.
3. Connect to an analysis backend that exposes `/api/analyze`.
4. Choose one integration mode:
   - mount `AgentWidget` in a side panel, or
   - call the headless SDK/API directly.
5. Optionally register host-specific tools before starting analysis sessions.

Required host inputs:

- `query`
- `vega_spec`
- backend service URL (`apiBaseUrl` for React package)

Optional host inputs:

- `chart_type`
- `metadata`
- `input_mode`
- `max_iterations`
- `model_name` (only if backend enables model override)

## Service Contract Example

### Request

```json
{
  "query": "Summarize the main trend in this chart.",
  "input_mode": "text_and_image",
  "max_iterations": 6,
  "chart_type": "scatter_plot",
  "metadata": {
    "dashboard_id": "sales_overview"
  },
  "vega_spec": {
    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    "mark": "point",
    "encoding": {
      "x": { "field": "x", "type": "quantitative" },
      "y": { "field": "y", "type": "quantitative" }
    },
    "data": {
      "values": [
        { "x": 1, "y": 2 },
        { "x": 2, "y": 4 }
      ]
    }
  }
}
```

### Response

```json
{
  "request_id": "req_123456789abc",
  "query": "Summarize the main trend in this chart.",
  "success": true,
  "answer": "The chart shows a clear positive trend.",
  "tool_calls": [
    {
      "tool_name": "calculate_correlation",
      "success": true
    }
  ],
  "final_observation": {
    "widget_state": {},
    "rendered_view": "...",
    "chart_type": "scatter_plot"
  },
  "chart_type": "scatter_plot",
  "mode": "protocol",
  "error": "",
  "stop_reason": ""
}
```

## Plugin Extension

Register custom host tools before running analysis:

```python
from packages.widget_sdk import WidgetToolPlugin, register_plugin

register_plugin(
    WidgetToolPlugin(
        name="detect_custom_pattern",
        function=my_tool,
        description="Detect domain-specific anomaly pattern",
        chart_types=["scatter_plot"],
    )
)
```

## Deployment Options

- **Self-hosted**: run the backend in your own environment and point the frontend to that endpoint.
- **Hosted endpoint**: use a centrally managed backend endpoint.

## Documentation Index

- `docs/host_integration_quickstart.md`
- `docs/partner_integration_one_pager.md`
- `docs/widget_plugin_contract.md`
- `packages/widget_sdk/README.md`
- `packages/agent_widget_ui/README.md`
- `packages/agent_kernel/README.md`

## Notes

- Current host-side state carrier: `vega_spec`
- Runtime path: MCP-only
- `templates/host_va_react` is for internal validation, not required for external integration
- Before public release, add/update: `LICENSE`, `.gitignore`, release notes

