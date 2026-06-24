# WidgetVA Kit Widget-First Implementation Plan

## Overview
This plan moves `widgetva-kit` from a runtime-first library surface to a widget-first surface.
The public mental model becomes:

- import a widget type from `widgetva-kit/widgets`
- instantiate it with user data/spec/container
- let human and agent both operate the widget instance
- compose multiple widget instances into a workspace when coordinated analysis is needed

The internal model remains:

- `core` provides runtime/state/action/perception/trace/link machinery
- `adapters` connect widget contracts to concrete visualization providers
- `transports` let agents access widget/workspace instances

## Locked Design Decisions
- Public primary interface is `widgets`, not `core`.
- `runtime` remains an internal/shared mechanism behind widget instances.
- Widget-specific `action` and `perception` belong to the widget contract.
- `adapters` implement provider-side binding, human interaction binding, and state application.
- Multi-widget coordination belongs to `workspace`, not to a single widget.
- Current scope explicitly excludes evaluation and benchmark work.
- Workspace state ownership follows the three-layer model in [widgetva_workspace_state_model.md](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva_workspace_state_model.md:1):
  - `widgetLocal`
  - `workspaceShared`
  - `runtimeMeta`
- Transport clients should evolve toward widget-facing and workspace-facing access, not raw runtime-first access.
- First-class widget types are fixed to:
  - `bar`
  - `line`
  - `scatter`
  - `parallelCoordinates`
  - `sankey`
  - `heatmap`

## Current State
- Done:
  - `widgetva-kit` is split into `core / adapters / transports`.
  - `widgets/` and `workspace/` public entries exist.
  - `WidgetInstance` and `WidgetWorkspace` minimal contracts exist.
  - `WidgetInstance` now explicitly exposes widget-facing action/perception contract readers (`listActionNames`, `listPerceptionNames`, descriptor reads) in addition to execution methods.
  - `widget pool` exposes the six first-class widget constructors.
  - `WidgetInstance` public contract is documented in code/tests.
  - the six widget constructors share a normalized mount-target option shape.
  - widget-owned semantic contracts now live under `widgets/` for all six first-class widget types.
  - first-class adapter widget modules now only expose provider glue concerns (`humanInteraction` / `state apply`) and no longer re-export semantic action/perception builders.
  - `WidgetWorkspace` now exposes a documented public contract for widget registration, link registration, composition summaries, workspace-level action/perception calls, trace reads, and replay.
  - `WidgetWorkspace` now also exposes explicit workspace-facing contract readers for widget descriptions plus workspace-level action/perception names and descriptors.
  - the first tool-capability migration slice is now landing directly in widget semantics: `line.zoomXRegion` has been ported into the line widget contract as a frontend action rather than remaining a Python-only tool.
  - a second tool-capability migration slice is now in place: `heatmap.highlightRegion` has been ported into the heatmap widget contract as a frontend action rather than remaining a Python-only tool.
  - a third tool-capability migration slice is now in place: `heatmap.adjustColorScale` has been ported into the heatmap widget contract as a frontend action rather than remaining a Python-only tool.
  - a fourth tool-capability migration slice is now in place: `bar.highlightTopN` has been ported into the bar widget contract as a frontend action rather than remaining a Python-only tool.
  - a fifth tool-capability migration slice is now in place: `line.focusLines` has been ported into the line widget contract as a frontend action rather than remaining a Python-only tool.
  - a sixth tool-capability migration slice is now in place: `bar.filterCategories` has been ported into the bar widget contract as a frontend action rather than remaining a Python-only tool.
  - a seventh tool-capability migration slice is now in place: `heatmap.thresholdMask` has been ported into the heatmap widget contract as a frontend action rather than remaining a Python-only tool.
  - an eighth tool-capability migration slice is now in place: `heatmap.filterCellsByRegion` has been ported into the heatmap widget contract as a frontend action rather than remaining a Python-only tool.
  - a ninth tool-capability migration slice is now in place: `heatmap.highlightRegionByValue` has been ported into the heatmap widget contract as a frontend action rather than remaining a Python-only tool.
  - a tenth tool-capability migration slice is now in place: `line.filterLines` has been ported into the line widget contract as a frontend action rather than remaining a Python-only tool.
  - an eleventh tool-capability migration slice is now in place: `bar.filterSubcategories` has been ported into the bar widget contract as a frontend action rather than remaining a Python-only tool.
  - a twelfth tool-capability migration slice is now in place: `bar.expandStack` has been ported into the bar widget contract as a frontend action rather than remaining a Python-only tool.
  - a thirteenth tool-capability migration slice is now in place: `heatmap.transpose` has been ported into the heatmap widget contract as a frontend action rather than remaining a Python-only tool.
  - a fourteenth tool-capability migration slice is now in place: `bar.toggleStackMode` has been ported into the bar widget contract as a frontend action rather than remaining a Python-only tool.
  - a fifteenth tool-capability migration slice is now in place: `line.boldLines` has been ported into the line widget contract as a frontend action rather than remaining a Python-only tool.
  - a sixteenth tool-capability migration slice is now in place: `line.highlightTrend` has been ported into the line widget contract as a frontend action rather than remaining a Python-only tool.
  - a seventeenth tool-capability migration slice is now in place: `line.drillDownXAxis` has been ported into the line widget contract as a frontend action rather than remaining a Python-only tool.
  - an eighteenth tool-capability migration slice is now in place: `line.resetDrilldownXAxis` has been ported into the line widget contract as a frontend action rather than remaining a Python-only tool.
  - a nineteenth tool-capability migration slice is now in place: `line.resampleXAxis` has been ported into the line widget contract as a frontend action rather than remaining a Python-only tool.
  - a twentieth tool-capability migration slice is now in place: `line.resetResampleXAxis` has been ported into the line widget contract as a frontend action rather than remaining a Python-only tool.
  - a twenty-first tool-capability migration slice is now in place: `heatmap.selectSubmatrix` has been ported into the heatmap widget contract as a frontend action rather than remaining a Python-only tool.
  - a twenty-second tool-capability migration slice is now in place: `heatmap.drilldownAxis` has been ported into the heatmap widget contract as a frontend action rather than remaining a Python-only tool.
  - a twenty-third tool-capability migration slice is now in place: `heatmap.resetDrilldown` has been ported into the heatmap widget contract as a frontend action rather than remaining a Python-only tool.
  - a twenty-fourth tool-capability migration slice is now in place: `heatmap.addMarginalBars` has been ported into the heatmap widget contract as a frontend action rather than remaining a Python-only tool.
  - a twenty-fifth tool-capability migration slice is now in place: `bar.addBars` has been ported into the bar widget contract as a frontend action rather than remaining a Python-only tool.
  - a twenty-sixth tool-capability migration slice is now in place: `bar.removeBars` has been ported into the bar widget contract as a frontend action rather than remaining a Python-only tool.
  - a twenty-seventh tool-capability migration slice is now in place: `bar.addBarItems` has been ported into the bar widget contract as a frontend action rather than remaining a Python-only tool.
  - a twenty-eighth tool-capability migration slice is now in place: `bar.removeBarItems` has been ported into the bar widget contract as a frontend action rather than remaining a Python-only tool.
  - a twenty-ninth tool-capability migration slice is now in place: `bar.sortBars` has been fully front-end-rewritten into an explicit-array bar sorting action rather than remaining dependent on the old Python/pandas tool path.
  - a thirtieth tool-capability migration slice is now in place: `parallelCoordinates.reorderDimensions` has been ported into the parallel-coordinates widget contract as a widget-owned structural axis-order action rather than remaining a Python-only tool.
  - a thirty-first tool-capability migration slice is now in place: `parallelCoordinates.filterDimension` has been ported into the parallel-coordinates widget contract as a widget-owned numeric range-filter action rather than remaining a Python-only tool.
  - a thirty-second tool-capability migration slice is now in place: `parallelCoordinates.hideDimensions` has been ported into the parallel-coordinates widget contract as a widget-owned dimension-visibility action rather than remaining a Python-only tool.
  - a thirty-third tool-capability migration slice is now in place: `parallelCoordinates.resetHiddenDimensions` has been ported into the parallel-coordinates widget contract as a widget-owned visibility-reset action rather than remaining a Python-only tool.
  - a thirty-fourth tool-capability migration slice is now in place: `parallelCoordinates.filterByCategory` has been ported into the parallel-coordinates widget contract as a widget-owned categorical exclusion filter rather than remaining a Python-only tool.
  - a thirty-fifth tool-capability migration slice is now in place: `parallelCoordinates.highlightCategory` has been ported into the parallel-coordinates widget contract as a widget-owned category-highlighting action rather than remaining a Python-only tool.
  - a thirty-sixth tool-capability migration slice is now in place: `sankey.collapseNodes` has been ported into the sankey widget contract as a widget-owned structural aggregation action rather than remaining a Python-only tool.
  - a thirty-seventh tool-capability migration slice is now in place: `sankey.expandNode` has been ported into the sankey widget contract as a widget-owned structural restoration action rather than remaining a Python-only tool.
  - a thirty-eighth tool-capability migration slice is now in place: `sankey.highlightPath` has been ported into the sankey widget contract as a widget-owned path-highlighting action rather than remaining a Python-only tool.
  - a thirty-ninth tool-capability migration slice is now in place: `sankey.reorderNodesInLayer` has been ported into the sankey widget contract as a widget-owned layer-ordering action rather than remaining a Python-only tool.
  - a fortieth tool-capability migration slice is now in place: `sankey.autoCollapseByRank` has been ported into the sankey widget contract as a widget-owned per-layer rank-based collapsing action rather than remaining a Python-only tool.
  - a forty-first tool-capability migration slice is now in place: `sankey.traceNode` has been ported into the sankey widget contract as a widget-owned focused exploration action rather than remaining a Python-only tool.
  - a forty-second tool-capability migration slice is now in place: `sankey.colorFlows` has been ported into the sankey widget contract as a widget-owned flow-styling action rather than remaining a Python-only tool.
  - a forty-third tool-capability migration slice is now in place: `get_node_options` has been ported into the sankey widget contract as the widget-owned perception query `perception.getNodeOptions` rather than remaining a Python-only tool.
  - a forty-fourth tool-capability migration slice is now in place: `calculate_conversion_rate` has been ported into the sankey widget contract as the widget-owned compute/perception query `perception.calculateConversionRate` rather than remaining a Python-only tool.
  - a forty-fifth tool-capability migration slice is now in place: `find_bottleneck` has been ported into the sankey widget contract as the widget-owned compute/perception query `perception.findBottleneck` rather than remaining a Python-only tool.
  - a forty-sixth tool-capability migration slice is now in place: `detect_anomalies` has been ported into the line widget contract as the widget-owned compute/perception query `perception.detectAnomalies` rather than remaining a Python-only tool.
  - a forty-seventh tool-capability migration slice is now in place: `show_moving_average` has been ported into the line widget contract as the widget-owned augmentation action `line.showMovingAverage` rather than remaining a Python-only tool.
  - a forty-eighth tool-capability migration slice is now in place: `show_regression` has been ported into the scatter widget contract as the widget-owned augmentation action `scatter.showRegression` rather than remaining a Python-only tool.
  - a forty-ninth tool-capability migration slice is now in place: `identify_clusters` has been ported into the scatter widget contract as the widget-owned frontend clustering action `scatter.identifyClusters` rather than remaining a Python-only tool.
  - a fiftieth tool-capability migration slice is now in place: `cluster_rows_cols` has been ported into the heatmap widget contract as the widget-owned reordering action `heatmap.clusterRowsCols` rather than remaining a Python-only tool.
  - a fifty-first tool-capability migration slice is now in place: `filter_flow` has been ported into the sankey widget contract as the widget-owned threshold/filter action `sankey.filterFlow` rather than remaining a Python-only tool.
  - workspace shared-state coordination now follows the three-layer state model more directly: `WidgetWorkspace` owns `workspaceShared` writes, and the shared coordination mutators live under `workspace/state` instead of being defined only under `core/runtime`.
  - `WidgetWorkspace` now exposes a broader `workspaceShared` write surface directly aligned with the state model:
    - selections
    - focus
    - comparison targets
    - global filters
    - annotations
  - `core-runtime` is narrower again: inspect/compose-facing helpers such as workspace-state readers, summaries, ref helpers, page-port alias metadata, and `buildSingleWidgetWorkspace` now stay on dedicated subentries instead of continuing to leak through the runtime compatibility entry.
  - `transport-runtime` is narrower again: it now exposes only legacy transport clients rather than re-exporting broad runtime inspect/execute helper aliases through the compatibility entry.
  - transport clients now expose additive widget-facing and workspace-facing methods on top of the legacy page-port/runtime aliases.
  - runtime assembly now lives in `core/runtime/createWidgetRuntime.js` instead of being implemented inline in the top-level entry.
  - widget-instance-created runtimes now register their provided widget adapter by default instead of auto-installing the full first-party widget family set.
  - generic `createWidgetVARuntime()` now requires explicit opt-in (`registerDefaultWidgetFamilies: true`) before installing the first-party widget family set.
  - the package root now exports a widget/workspace-first surface only; first-party workspace code has been moved to `widgetva-kit/core` and `widgetva-kit/transport`.
  - workspace now exposes explicit coordination-state reads for focused widget, selections, annotations, state history, branches, trace graph, and recorded agent responses.
  - transport mainline exports are slimmer: formal clients plus widget/workspace-first methods stay on `transport(s)`, while example helper wrappers live on a dedicated `transport-examples` entry.
  - formal transport client creators on `transport(s)` now return widget/workspace-first surfaces only; legacy alias-rich clients remain available under `transport-runtime`.
  - `transport-runtime` is now strictly the runtime compatibility layer; example helper wrappers no longer piggyback on it.
  - first-party inspection/devtools reads now have a dedicated `transport-inspect` entry instead of depending directly on the broader runtime compatibility surface.
  - first-party execution/verification helpers now have a dedicated `transport-execute` entry instead of sharing a broad runtime compatibility surface with unrelated inspection reads.
  - the formal `transport(s)` entry now exposes widget/workspace-first methods only; execution-oriented helpers such as agent-loop and response-recording live on `transport-execute` instead of the formal transport surface.
  - `core` now acts as a slimmer integration surface, while historical runtime-heavy readers, summaries, and convenience helpers move under `core-runtime` for first-party workspace and devtools use.
  - framework-scaffold examples now have a dedicated `core-examples` entry instead of hiding inside runtime compatibility surfaces.
  - first-party workspace composition helpers now have a dedicated `core-compose` entry instead of piggybacking on broader runtime compatibility exports.
  - first-party runtime readers, summaries, ref helpers, and page-port alias metadata now have a dedicated `core-inspect` entry instead of remaining bundled inside `core-runtime`.
  - first-party frontend code no longer imports `core-runtime` or `transport-runtime` directly; those compatibility surfaces are now isolated behind narrower `core-inspect`, `core-compose`, `transport-inspect`, and `transport-execute` entries.
- Not done yet:
  - legacy alias-rich transport clients still exist under `transport-runtime` for compatibility, even though the main `transport(s)` entry now exposes widget/workspace-first clients only
  - legacy runtime-heavy helpers still exist under `core-runtime` for first-party workspace/devtools compatibility, even though the main `core` entry is slimmer

## Phase 1: Stabilize Widget Public Contract

### Task 1.1: Freeze `WidgetInstance` public contract
Description:
Define the stable public methods and semantics for a single widget instance.

Acceptance criteria:
- [x] `WidgetInstance` methods are explicitly documented in code and tests
- [x] method semantics are stable for:
  - `mount`
  - `unmount`
  - `describe`
  - `readState`
  - `executeAction`
  - `queryPerception`
  - `getTrace`
  - `replay`
  - `dispose`
- [x] runtime-specific leakage is minimized from the widget-facing surface

Verification:
- [x] Tests pass: `node --test widgetva-kit/src/widgets/widgetInstance.test.js`

Files likely touched:
- `widgetva-kit/src/widgets/widgetInstance.js`
- `widgetva-kit/src/widgets/widgetInstance.test.js`

### Task 1.2: Normalize widget constructor params across six widget types
Description:
Define a consistent creation contract for all six widget types.

Acceptance criteria:
- [x] all six constructors accept a coherent shape for:
  - `spec`
  - `data`
  - `runtime`
  - `sessionId`
  - `container/view/surface`
  - optional host/runtime options
- [x] `parallelCoordinates` and `sankey` are supported without Vega mark inference hacks leaking to users
- [x] constructor naming stays uniform across all six widget types

Verification:
- [x] Tests pass: `node --test widgetva-kit/src/widgets/pool.test.js`

Files likely touched:
- `widgetva-kit/src/widgets/pool.js`
- `widgetva-kit/src/widgets/pool.test.js`

### Checkpoint: Widget Contract
- [x] widgets can be instantiated without reading internal runtime code
- [x] tests pass
- [x] build succeeds

## Phase 2: Separate Widget Contract From Adapter Wiring

### Task 2.1: Move widget-owned action/perception definitions under `widgets`
Description:
Make widget contracts clearly own their action and perception surfaces.

Acceptance criteria:
- [x] widget-specific action/perception definitions are represented as widget-owned contract modules
- [x] adapters no longer appear to own the semantic definition of widget abilities
- [x] `widgets` becomes the clear source of truth for “what this widget can do”

Verification:
- [x] tests pass for the affected widget families
- [x] existing widget pool tests still pass

Files likely touched:
- `widgetva-kit/src/widgets/**`
- `widgetva-kit/src/adapters/widgets/**`
- `widgetva-kit/src/adapters/widgetFamilies/**`

### Task 2.2: Narrow adapter responsibilities
Description:
Restrict adapters to provider-side implementation concerns only.

Acceptance criteria:
- [x] adapters are responsible for:
  - human interaction bindings
  - state apply logic
  - provider-specific glue
- [x] adapters are not the semantic source of widget actions/perceptions
- [x] provider adapters remain usable for Vega-Lite, D3, ECharts, and custom renderers

Verification:
- [x] Tests pass: adapter and rendering bridge tests

Files likely touched:
- `widgetva-kit/src/adapters/**`
- `widgetva-kit/src/core/rendering/**`

### Checkpoint: Widget vs Adapter Boundary
- [x] the answer to “what can this widget do?” lives in `widgets`
- [x] the answer to “how is it rendered/bound?” lives in `adapters`

## Phase 3: Build the Workspace Contract

### Task 3.1: Define the stable `WidgetWorkspace` public contract
Description:
Turn workspace from a thin wrapper into a clear multi-widget management API.

Acceptance criteria:
- [x] `WidgetWorkspace` documents and stabilizes:
  - widget registration/composition
  - link registration
  - shared state reads
  - workspace-level action/perception calls
  - trace/replay behavior
- [x] workspace semantics clearly distinguish single-widget vs multi-widget use

Verification:
- [x] Tests pass: `node --test widgetva-kit/src/workspace/widgetWorkspace.test.js`

Files likely touched:
- `widgetva-kit/src/workspace/widgetWorkspace.js`
- `widgetva-kit/src/workspace/widgetWorkspace.test.js`

### Task 3.2: Add explicit link/composition setup at workspace level
Description:
Make multi-widget coordination a public composition feature, not just an internal runtime side effect.

Acceptance criteria:
- [x] users can compose multiple widget instances and attach links through `workspace`
- [~] link semantics are expressed at workspace level
  - registration/listing/topology are explicit; deeper coordination-state surfaces still need expansion
- [~] coordination state is readable and replayable
  - topology/trace/snapshot/replay plus focused-widget/selection/annotation/history/branch/agent-response reads are exposed; workspace-shared writes for selections/focus/comparison/global-filters/annotations now exist, while richer coordination tooling can still expand later

Verification:
- [x] focused workspace tests pass

Files likely touched:
- `widgetva-kit/src/workspace/**`
- `widgetva-kit/src/core/runtime/LinkEngine.js`
- `widgetva-kit/src/core/runtime/WorkspaceMaterializer.js`

### Checkpoint: Multi-Widget Ready
- [x] multi-widget composition is a real public contract
- [~] workspace can serve as the first-class composition unit for coordinated VA
  - current contract is usable; next step is broadening coordination-specific write surfaces or richer workspace-level tooling only if real composition use cases require them

## Phase 4: Reorient Transports Around Widgets and Workspaces

### Task 4.1: Define widget-facing transport surfaces
Description:
Let transport clients operate against widget instances instead of assuming raw runtime-first access.

Acceptance criteria:
- [x] widget-facing transport methods exist conceptually and in API shape
- [x] transport clients can target a widget instance directly
- [x] widget-level describe/read/action/perception/trace semantics are explicit

Verification:
- [x] transport tests pass after surface adjustments

Files likely touched:
- `widgetva-kit/src/transports/**`

### Task 4.2: Define workspace-facing transport surfaces
Description:
Make workspace-level transport access explicit for multi-widget analysis.

Acceptance criteria:
- [x] workspace-facing transport methods are distinct from widget-facing ones
- [x] workspace coordination and replay surfaces are available without exposing raw runtime internals

Verification:
- [x] transport tests pass

Files likely touched:
- `widgetva-kit/src/transports/**`

### Checkpoint: Agent Access Model
- [x] agent can operate either a single widget or a composed workspace through transports
- [~] transport mental model is widget/workspace-first, not runtime-first
  - new widget/workspace-first methods exist and are tested; the formal `transport(s)` surface now excludes execution helpers, while `transport-execute` and `transport-runtime` carry the remaining execution/compatibility concerns

## Phase 5: Shrink Runtime-First Leakage

### Task 5.1: Slim `widgetva-kit/src/index.js`
Description:
Stop using the main kit entry as a giant re-export and runtime bootstrap hub.

Acceptance criteria:
- [x] top-level export surface is intentionally narrow
- [x] widget/workspace entries are first-class
- [x] internal assembly logic moves out of the main index where possible

Verification:
- [x] `widgetva-kit/src/index.test.js` passes

Files likely touched:
- `widgetva-kit/src/index.js`
- `widgetva-kit/src/index.test.js`

### Task 5.2: Reduce default built-in widget-family assumptions in runtime creation
Description:
Make runtime less opinionated about first-party widget families.

Acceptance criteria:
- [x] default runtime does not over-assume first-party widget family registration
- [~] widget/workspace assembly layers own more of that wiring
  - widget instances own their adapter registration path and generic runtime now requires explicit opt-in for first-party families; broader workspace/runtime assembly can still be narrowed further

Verification:
- [x] runtime and rendering tests pass

Files likely touched:
- `widgetva-kit/src/index.js`
- `widgetva-kit/src/core/**`

### Task 5.3: Split public `core` from runtime-heavy `core-runtime`
Description:
Keep formal integration APIs on `core` while moving first-party workspace readers, summaries, and convenience helpers to a narrower compatibility subentry.

Acceptance criteria:
- [x] `core` exposes a slimmer integration-oriented surface
- [x] `core-runtime` carries runtime-heavy readers/summaries/convenience helpers needed by first-party workspace and devtools
- [x] first-party workspace imports move off the formal `core` surface when they rely on runtime-heavy helpers

Verification:
- [x] package surface tests pass
- [x] frontend build still succeeds

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Widget and adapter semantics stay interleaved | High | Move ownership language and tests first, then refactor implementation |
| Public API churn becomes confusing | High | Keep tests on public exports and do not widen top-level exports casually |
| Workspace composition becomes runtime-dependent again | Medium | Keep workspace contract explicit and test through public workspace methods |
| Transport refactor breaks existing helpers | Medium | Preserve compatibility aliases until widget/workspace-facing clients are stable |

## Recurring Review Checklist
Use this after each 1-2 implementation tasks:

- [ ] Are widget abilities defined under `widgets`, not implicitly owned by adapters?
- [ ] Are adapters only handling binding/apply/provider concerns?
- [ ] Did any new runtime-first leakage appear in the public API?
- [ ] Can an external user understand the new API without reading `core/`?
- [ ] Do tests still prove widget-first behavior?


Do not expand workspace or transports further until the widget contract is stable.
