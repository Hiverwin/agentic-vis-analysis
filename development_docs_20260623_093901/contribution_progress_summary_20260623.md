# Contribution Progress Summary

Date: 2026-06-23

This document summarizes the current implementation status of the paper-facing contributions across `visagentbench_v2`, `widgetva-kit`, and `apps/widgetva-system`.

## Overall Status

| Contribution Area | Current Status | Notes |
| --- | --- | --- |
| Renderer-agnostic benchmark packaging | Mostly complete | Public schema, packaged datasets, manifests, partitions, and materialization contract are in place. |
| High-level semantic capability layer | Complete for current legacy-tool coverage | All audited legacy operations are mapped to semantic capabilities and frontend bindings. |
| Widget/runtime/workspace abstraction | Mostly complete | Runtime, workspace, adapters, and transport surface exist and are test-backed. |
| Multi-renderer materialization | Partial to strong | Vega is ready; D3 is contract-ready with a real webpage demo; ECharts is contract-ready and partially integrated in the first-party VA system. |
| First-party VA benchmark host | In progress | `widgetva-system` is now multi-provider aware, but benchmark loading and agent-driven benchmark execution are not yet fully integrated. |
| External integration surface | Mostly complete | React UI, Python SDK, and transport clients are available, but cross-renderer benchmark execution is not yet end-to-end productized. |

## Implemented and Designed Interfaces

This section summarizes the main public or intended-to-be-stable interfaces that have already been designed in the repository.

### 1. Benchmark Object Interface

Defined in [visagentbench_v2/schema/benchmark.schema.json](/Users/chenyutong/Desktop/agentic-visual-reframe/visagentbench_v2/schema/benchmark.schema.json:1).

Top-level fields:

- `benchmark_id`
- `task_type`
- `widget_kind`
- `question_set`
- `data_source`
- `materializations`
- `benchmark_partition`

Question-level fields:

- `qid`
- `question`
- `question_style`
- `ground_truth`

Ground-truth fields:

- `task_type`
- `answer`
- `key_insights`
- `reasoning_trace`
- `required_capabilities`
- `required_perceptions`
- `capability_param_checks`
- `canonical_state_checks`
- `renderer_state_checks`
- `state_check_fields`

Data-source fields:

- `kind`
- `dataset_id`
- `dataset_path`
- `row_count`
- `dataset_scale_tag`

Materialization entry examples:

- `materializations.vega.spec_path`
- future-parallel renderer entries for `d3`, `echarts`, and `custom`

### 2. Semantic Capability Interface

Defined in [widgetva-kit/src/capabilities/semanticCapabilities.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/capabilities/semanticCapabilities.js:1), exported through [widgetva-kit/src/capabilities.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/capabilities.js:1).

Capability record fields:

- `id`
- `title`
- `description`
- `semanticKind`
- `aliases`
- `supportedWidgetKinds`
- `bindings`

Public capability API:

- `listSemanticCapabilities()`
- `getSemanticCapability(id)`
- `resolveSemanticCapabilityBindings({ semanticId, widgetKind })`
- `describeWidgetSemanticSurface(widgetKind)`

Representative semantic capability ids:

- `view.domain.zoom`
- `selection.region.set`
- `line.series.filter`
- `analysis.correlation.compute`

### 3. Widget / Workspace / Runtime Interface

Primary exports are rooted in [widgetva-kit/src/index.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/index.js:1), [widgetva-kit/src/core/index.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/core/index.js:1), and [widgetva-kit/src/workspace/widgetWorkspace.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/workspace/widgetWorkspace.js:1).

Widget creation surface:

- `createScatterWidget(...)`
- `createBarWidget(...)`
- `createLineWidget(...)`
- `createHeatmapWidget(...)`
- `createParallelCoordinatesWidget(...)`
- `createSankeyWidget(...)`

Runtime creation surface:

- `createWidgetVARuntime(...)`

Workspace creation surface:

- `createWidgetWorkspace({ widgets, runtime, links })`

Workspace operation surface:

- `executeAction(...)`
- `queryPerception(...)`
- `readCoordinationState()`
- `readSelectionState()`
- `setFocusedWidget(widgetId)`
- `setGlobalFilters(filters)`
- `setSelectionRegistry(...)`
- `setSelectionPrimary(...)`
- `setSelectionViewsByWidget(...)`
- `clearSelectionState()`
- `getTrace()`
- `readSnapshot()`
- `replay()`

### 4. Adapter Interface

Core adapter contract is defined in [widgetva-kit/src/adapters/widgetAdapterContract.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/adapters/widgetAdapterContract.js:1).

Adapter instance methods and hooks:

- `getDescription()`
- `getState()`
- `buildActionDescriptors()`
- `buildPerceptionDescriptors()`
- `registerActions()`
- `registerPerceptionQueries()`
- `bindHumanInteractions()`
- `applyState()`
- `getHumanInteractionConfig()`

Provider adapter families already exist for:

- `VegaLiteWidgetAdapter`
- `D3WidgetAdapter`
- `EChartsWidgetAdapter`
- `CustomWidgetAdapter`

### 5. Transport Interface

Transport surface is defined in [widgetva-kit/src/transports/widgetWorkspaceTransportSurface.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/transports/widgetWorkspaceTransportSurface.js:1).

Transport methods:

- `describeWidget`
- `readWidgetState`
- `executeWidgetAction`
- `queryWidgetPerception`
- `readWorkspaceState`
- `executeWorkspaceAction`
- `queryWorkspacePerception`
- `readWorkspaceTrace`
- `replayWorkspace`

Concrete client environments already implemented:

- in-page
- Playwright
- WebSocket
- browser extension

### 6. Renderer Materialization Interface

Current materialization contract is documented in [visagentbench_v2/materializations/README.md](/Users/chenyutong/Desktop/agentic-visual-reframe/visagentbench_v2/materializations/README.md:1).

Shared materialization expectation:

1. load benchmark JSON
2. load packaged dataset
3. instantiate widget by `widget_kind`
4. bind renderer-side actions/perceptions to semantic capabilities
5. run benchmark through agent/runtime stack

D3-side benchmark materializer API, from [visagentbench_v2/materializations/d3/benchmarkD3Materializer.js](/Users/chenyutong/Desktop/agentic-visual-reframe/visagentbench_v2/materializations/d3/benchmarkD3Materializer.js:1):

- `readBenchmarkFile(benchmarkPath)`
- `readPackagedDataset({ benchmark, packageRoot })`
- `createD3RuntimeAdapter({ widgetKind, widgetRef, chart, dataRef })`
- `collectD3CapabilityBindings({ benchmark })`
- `describeD3BenchmarkMaterialization({ benchmark })`

Expected host-chart hooks on the D3 side:

- `getState()`
- `renderFromState(widgetState)`
- `applyAction(name, params)`
- optional hooks such as `setBrush`, `setDomain`, `changeEncoding`, `clearSelection`, `onBrush`, `onCategoryClick`, `onCellClick`

### 7. First-Party VA Host Interface

The emerging host-side renderer interface is visible in:

- [apps/widgetva-system/src/workspace/workspaceRendererRegistry.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/workspace/workspaceRendererRegistry.js:1)
- [apps/widgetva-system/src/workspace/widgetRenderSupport.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/workspace/widgetRenderSupport.js:1)
- [apps/widgetva-system/src/runtime/importedWidgetContracts.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/importedWidgetContracts.js:1)

Current host-side renderer concepts:

- provider: `vega-lite`, `echarts`, `d3`
- widget kind: `scatter`, `bar`, `line`, `heatmap`, `parallelCoordinates`, `sankey`
- render modes:
  - `vega-lite`
  - `echarts`
  - `glyph`

Current host-side registry interface:

- `createWorkspaceRendererRegistry(entries)`
- `register(entry)`
- `resolveProvider(provider)`
- `resolveWidget(widget)`
- `renderWidget({ widget, ...args })`
- `list()`
- `supportsWidget(widget)`

This is not yet a finished benchmark-host API, but the provider-switching boundary is already designed and partly implemented.

## 1. Renderer-Agnostic Benchmark Packaging

Status: Mostly complete

Implemented:

- Public benchmark schema is defined in [visagentbench_v2/schema/benchmark.schema.json](/Users/chenyutong/Desktop/agentic-visual-reframe/visagentbench_v2/schema/benchmark.schema.json:1).
- Benchmark package layout is defined in [visagentbench_v2/README.md](/Users/chenyutong/Desktop/agentic-visual-reframe/visagentbench_v2/README.md:1).
- Benchmarks are normalized into three partitions:
  - `main`: 1349
  - `hinted`: 1183
  - `stress`: 116
- Packaged row-oriented datasets are extracted into [visagentbench_v2/datasets](/Users/chenyutong/Desktop/agentic-visual-reframe/visagentbench_v2/datasets:1), with 101 dataset files.
- Manifest files are generated in [visagentbench_v2/manifests](/Users/chenyutong/Desktop/agentic-visual-reframe/visagentbench_v2/manifests:1).
- Public benchmark fields now center on:
  - `benchmark_id`
  - `task_type`
  - `widget_kind`
  - `question_set`
  - `data_source`
  - `materializations`
  - `benchmark_partition`
- Ground-truth fields are elevated to semantic capability and state-check layers rather than renderer-specific tool names.

What is done well:

- Benchmark semantics are no longer Vega-only.
- Public benchmark objects no longer expose legacy conversion lineage.
- Data packaging is separated from renderer packaging.

Remaining gaps:

- `renderer_state_checks` still contain some Vega-specific expressions where canonical state checks are not yet rich enough.
- The benchmark package is ready, but full host-side execution inside the VA system is not yet complete.

## 2. High-Level Semantic Capability Layer

Status: Complete for current migration scope

Implemented:

- Semantic capability registry is defined in [widgetva-kit/src/capabilities/semanticCapabilities.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/capabilities/semanticCapabilities.js:1).
- Public capability API is exported from:
  - [widgetva-kit/src/capabilities.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/capabilities.js:1)
  - [widgetva-kit/src/capabilities/index.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/capabilities/index.js:1)
- Coverage audit exists in [tools/audit_semantic_capabilities.mjs](/Users/chenyutong/Desktop/agentic-visual-reframe/tools/audit_semantic_capabilities.mjs:1).

Current audited coverage:

- `legacyOperationCount`: 49
- `mappedOperationCount`: 49
- `fullyBoundOperationCount`: 49

What is done well:

- The system now has a stable semantic layer between old tool names and frontend/runtime functions.
- Benchmark `required_capabilities` now align to this semantic layer.

Remaining gaps:

- Parameter normalization is still uneven for some capability-specific checks.
- The semantic layer is complete as a registry, but not yet fully surfaced in the first-party VA benchmark workflow UI.

## 3. Widget/Runtime/Workspace Abstraction

Status: Mostly complete

Implemented:

- Public widget-facing exports exist in [widgetva-kit/src/index.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/index.js:1).
- Workspace model exists in [widgetva-kit/src/workspace/widgetWorkspace.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/workspace/widgetWorkspace.js:1).
- Runtime core is assembled in [widgetva-kit/src/core/index.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/core/index.js:1).
- Adapter contracts and provider adapters exist in [widgetva-kit/src/adapters](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/adapters:1).
- Transport surface exists in [widgetva-kit/src/transports/widgetWorkspaceTransportSurface.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/transports/widgetWorkspaceTransportSurface.js:1).
- Workspace, adapters, widget instances, and transport clients have tests across the kit.

What is done well:

- The core abstraction layers are present: widget, runtime, workspace, adapter, transport.
- The design is already strong enough to support benchmark packaging and multi-provider rendering.

Remaining gaps:

- The abstraction is mature as a library, but the paper demo path still needs stronger end-to-end host integration.
- Some host-specific execution paths are still implemented as app logic rather than clean reusable benchmark-runner interfaces.

## 4. Multi-Renderer Materialization

Status: Partial to strong

### Vega

Status: Ready

- Renderer profile marks Vega as `ready` in [visagentbench_v2/manifests/renderer_profiles.json](/Users/chenyutong/Desktop/agentic-visual-reframe/visagentbench_v2/manifests/renderer_profiles.json:1).
- Vega materialization paths are stored under each benchmark’s `materializations.vega.spec_path`.
- `widgetva-system` already has a Vega renderer component in [apps/widgetva-system/src/workspace/VegaLiteView.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/workspace/VegaLiteView.jsx:1).

### D3

Status: Contract-ready with concrete demo

- D3 materialization contract is documented in [visagentbench_v2/materializations/d3/README.md](/Users/chenyutong/Desktop/agentic-visual-reframe/visagentbench_v2/materializations/d3/README.md:1).
- D3 benchmark materializer exists in [visagentbench_v2/materializations/d3/benchmarkD3Materializer.js](/Users/chenyutong/Desktop/agentic-visual-reframe/visagentbench_v2/materializations/d3/benchmarkD3Materializer.js:1).
- A concrete D3 benchmark webpage demo exists under [visagentbench_v2/materializations/d3/demo](/Users/chenyutong/Desktop/agentic-visual-reframe/visagentbench_v2/materializations/d3/demo:1).

What is done well:

- The benchmark can already be materialized into a real D3 webpage outside the legacy benchmark pipeline.

Remaining gaps:

- D3 is still not integrated as a general benchmark renderer inside `widgetva-system`.
- The current D3 path is still closer to a proof-of-concept than a unified benchmark-host driver.

### ECharts

Status: Contract-ready and partially host-integrated

- Renderer profile marks ECharts as `contract_ready` in [visagentbench_v2/manifests/renderer_profiles.json](/Users/chenyutong/Desktop/agentic-visual-reframe/visagentbench_v2/manifests/renderer_profiles.json:1).
- ECharts adapter exists in [widgetva-kit/src/adapters/EChartsWidgetAdapter.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/adapters/EChartsWidgetAdapter.js:1).
- `widgetva-system` now includes [apps/widgetva-system/src/workspace/EChartsView.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/workspace/EChartsView.jsx:1) and has `echarts` as a dependency in [apps/widgetva-system/package.json](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/package.json:1).

What is done well:

- ECharts is no longer only theoretical at the adapter level; it now has an actual frontend render path in the first-party system.

Remaining gaps:

- There is not yet a packaged ECharts benchmark materializer parallel to the D3 one.
- End-to-end benchmark execution in ECharts is not yet demonstrated.

## 5. First-Party VA System (`apps/widgetva-system`)

Status: In progress

Implemented:

- The app exists as a first-party VA shell in [apps/widgetva-system/src](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src:1).
- It now supports mixed provider awareness in:
  - [apps/widgetva-system/src/runtime/importedWidgetContracts.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/importedWidgetContracts.js:1)
  - [apps/widgetva-system/src/workspace/widgetRenderSupport.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/workspace/widgetRenderSupport.js:1)
  - [apps/widgetva-system/src/workspace/workspaceRendererRegistry.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/workspace/workspaceRendererRegistry.js:1)
- `WorkspaceCase` presets now mix providers:
  - Vega-Lite
  - ECharts
  - D3-backed custom views
- Widget rendering now supports:
  - Vega views
  - ECharts views
  - glyph/custom fallback views

What is done well:

- The system has crossed from Vega-only UI into multi-provider host architecture.
- It is now a plausible first-party benchmark host rather than only a design prototype.

Remaining gaps:

- The app is still workspace-case driven, not benchmark-instance driven.
- There is no full `visagentbench_v2` loader inside the app yet.
- Renderer switching for the same benchmark instance is not yet productized.
- Agent-driven benchmark execution inside the host is still incomplete.

## 6. External Integration Surface

Status: Mostly complete

Implemented:

- Frontend embedding package exists in [packages/agent_widget_ui](/Users/chenyutong/Desktop/agentic-visual-reframe/packages/agent_widget_ui:1).
- Python SDK exists in [packages/widget_sdk](/Users/chenyutong/Desktop/agentic-visual-reframe/packages/widget_sdk:1).
- Agent kernel exists in [packages/agent_kernel](/Users/chenyutong/Desktop/agentic-visual-reframe/packages/agent_kernel:1).
- External integration notes exist in [Widget_Integration/README.md](/Users/chenyutong/Desktop/agentic-visual-reframe/Widget_Integration/README.md:1).

What is done well:

- There are already usable external entry points for frontend embedding and backend access.

Remaining gaps:

- External packages are not yet framed around the new benchmark-host workflow.
- The connection between benchmark package, first-party VA host, and agent evaluation loop is still not fully unified.

## Practical Paper-Level Takeaway

If the paper contributions are framed as:

1. a renderer-agnostic benchmark package
2. a semantic capability abstraction
3. a widget/runtime/workspace library for agentic visual analytics
4. a first-party VA host that can eventually execute the benchmark across renderers

then the current maturity is:

- Contribution 1: ready to present
- Contribution 2: ready to present
- Contribution 3: ready to present with implementation evidence
- Contribution 4: presentable as in-progress system integration, not yet fully finished

## Recommended Next Milestone

The highest-value next step is not more schema work. It is to turn `apps/widgetva-system` into a true benchmark host by adding:

- benchmark loader for `visagentbench_v2`
- same-benchmark multi-renderer switching
- agent-driven capability execution on benchmark instances
- at least one end-to-end demo where the same benchmark runs in two renderers inside the same host
