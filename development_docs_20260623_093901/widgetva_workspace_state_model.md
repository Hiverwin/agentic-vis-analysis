# WidgetVA Workspace State Model

## Purpose
This document defines the long-term state model for `widgetva-kit` under the widget-first architecture.

It exists to keep three boundaries stable:

- what belongs to a single `WidgetInstance`
- what belongs to `WidgetWorkspace`
- what belongs to runtime history / trace / replay infrastructure

The model is intentionally ownership-first.
It is not primarily a UI taxonomy.

## Top-Level Model

The state model has three top-level layers:

```txt
{
  widgetLocal,
  workspaceShared,
  runtimeMeta
}
```

### `widgetLocal`
State owned by a single widget instance.

### `workspaceShared`
State owned by the workspace as the coordination unit across widgets.

### `runtimeMeta`
State owned by runtime infrastructure for history, trace, replay, and branching.

This three-layer split is the stable long-term classification.
Future expansion should happen inside these layers, not by replacing them.

## Ownership Rules

### `WidgetInstance`
`WidgetInstance` owns `widgetLocal`.

It may read `workspaceShared` when coordination affects the widget, but it does not own shared coordination state.

### `WidgetWorkspace`
`WidgetWorkspace` owns `workspaceShared`.

It is the public manager for multi-widget coordination state and workspace-level composition semantics.

### Runtime Core
Runtime/store/history/trace infrastructure owns `runtimeMeta`.

It records and restores state transitions, but it does not define product semantics for widget-local or workspace-shared meaning.

## Layer 1: `widgetLocal`

`widgetLocal` contains state whose meaning is local to one widget.

Typical contents:

```txt
widgetLocal[widgetRef] = {
  spec,
  baselineSpec,
  viewState,
  localSelections,
  localDerivedState,
  dataState,
  widgetMode,
  providerState
}
```

Examples:

- current widget spec
- baseline widget spec
- widget-local transform state
- widget-local selection payloads
- widget-local derived rows / current data ref
- widget-specific temporary structural state
  - `_line_drilldown_state`
  - `_resample_state`
  - `_stack_mode`
  - `_heatmap_state`

`widgetLocal` should not directly store cross-widget coordination semantics unless the data is only a local mirror of shared state.

### `widgetLocal` Write Authority

Allowed writers:

- widget actions
- widget perception helpers that materialize local derived state
- adapter state-apply logic
- runtime patch helpers that mutate a specific widget record

Primary implementation path today:

- `patchWidgetInStore(...)`
- widget-owned actions executed through `ActionContext`

## Layer 2: `workspaceShared`

`workspaceShared` contains state whose meaning is shared across widgets.

This is the state layer that `WidgetWorkspace` should manage directly.

Current canonical shape:

```txt
workspaceShared = {
  focusedWidget,
  selections,
  globalFilters,
  annotations,
  comparisonTargets,
  links
}
```

This shape may grow, but only with coordination-level semantics.

### `workspaceShared.focusedWidget`
The currently focused widget ref for coordinated analysis.

Use cases:

- direct agent attention
- human/agent focus handoff
- default target resolution

### Selection Submodel

`workspaceShared` uses a canonical registry plus derived views:

```txt
workspaceShared = {
  selections: {
    registry,
    views: {
      primary,
      byWidget,
    },
  },
  ...
}
```

#### `selections.registry`
The canonical shared selection registry.

This is the authoritative workspace-level coordination surface for:

- propagation
- linked filtering/highlighting
- data queries against current selection handles
- replay/verification of selection-driven state

`registry` should contain shared selection entries keyed by selection ref.

#### `selections.views.primary`
The primary selection in current focus.

This is a convenience surface for:

- the current main user/agent selection
- default evidence lookup
- quick inspection

It is allowed to be `null`.

It should be treated as the singular, most immediately relevant selection payload.

#### `selections.views.byWidget`
A compact current selection map keyed by logical widget/source scope.

This is a convenience aggregation layer for:

- current per-widget selection summaries
- host bridge interoperability
- UI-facing or agent-facing compact state reads

It is not the canonical coordination registry.

### Selection Ownership Rule

The intended rule is:

- `selections.views.primary`
  - convenience singular view
- `selections.views.byWidget`
  - convenience grouped view
- `selections.registry`
  - canonical coordination registry

Legacy field names such as `currentSelection`, `currentSelections`, and `activeSelections` may still appear in compatibility adapters, but they are no longer the canonical model.

### `workspaceShared.globalFilters`
Filters that conceptually apply across widgets or across a coordinated view of the workspace.

These are workspace semantics, not one widget's local transform.

### `workspaceShared.annotations`
Human or agent authored notes, labels, evidence markers, or analysis breadcrumbs that belong to the workspace.

### `workspaceShared.comparisonTargets`
The widget refs or analysis targets currently being compared.

### `workspaceShared.links`
Workspace-level coordination links.

This should be modeled as a two-level submodel:

```txt
workspaceShared.links = {
  definitions,
  topology
}
```

#### `links.definitions`
The canonical registered link definitions.

This is the source-of-truth configuration layer for workspace coordination links.

Typical contents:

- source widget ref
- target widget ref
- primitive / link kind
- optional propagation config
- optional metadata

These are the links users or first-party code explicitly register through the workspace.

#### `links.topology`
The derived coordination topology.

This is a computed read surface derived from:

- registered link definitions
- registered widgets
- runtime-readable workspace descriptions

It should support:

- neighbor lookup
- inbound/outbound link summaries
- source/target grouping
- topology inspection for agent reasoning

### Link Ownership Rule

The intended rule is:

- `links.definitions`
  - canonical workspace-owned registration layer
- `links.topology`
  - derived read layer

If a runtime needs additional propagation caches or execution-specific link artifacts, those should not replace the workspace-owned definitions layer.
They belong either in derived runtime state or runtime infrastructure.

### `workspaceShared` Write Authority

Allowed writers:

- `WidgetWorkspace`
- selected workspace-level actions
- `ActionContext` methods whose semantics are explicitly workspace-shared

Current public write surface should remain semantic, not generic.

Preferred public methods:

- `setSelectionPrimary(...)`
- `setSelectionViewsByWidget(...)`
- `setSelectionRegistry(...)`
- `clearSelectionState()`
- `setFocusedWidget(...)`
- `setComparisonTargets(...)`
- `setGlobalFilters(...)`
- `clearGlobalFilters()`
- `setAnnotations(...)`
- `addAnnotation(...)`
- `clearAnnotations()`
- `registerLink(...)`
- `removeLink(...)`
- `listLinks()`
- `readLinkTopology()`

Internal implementation path:

- `workspace/state/workspaceSharedStateMutators.js`

The workspace should not expose raw store mutators as its public API.

## Layer 3: `runtimeMeta`

`runtimeMeta` contains infrastructure state used to support replay, trace, and branching.

Typical contents:

```txt
runtimeMeta = {
  history,
  snapshots,
  branches,
  interactionTrace,
  responses,
  replayContext
}
```

Examples:

- state snapshots
- branch registry
- interaction trace records
- recorded agent responses
- replay context

This layer is runtime-owned.
It should be readable from workspace and transport surfaces, but its semantics are not owned by `WidgetWorkspace`.

### `runtimeMeta` Write Authority

Allowed writers:

- runtime store
- trace recorder
- response recorder
- snapshot/history/branch helpers
- replay helpers

Typical implementation sites today:

- `core/runtime/*`
- `InteractionTraceRecorder`
- `ResponseRecorder`
- runtime store snapshot machinery

## What Does Not Belong In `workspaceShared`

The following should stay out of `workspaceShared` unless there is a clear coordination reason:

- a widget's current spec
- provider-specific rendering handles
- temporary hover state
- drag-in-progress UI state
- widget-private local transforms
- widget-private visual encoding patch details

These belong in `widgetLocal`, not in the workspace owner layer.

## What Does Not Belong In `runtimeMeta`

The following should not be treated as runtime-only infrastructure:

- focused widget
- workspace annotations
- comparison targets
- global filters

These are product semantics and belong in `workspaceShared`.

## Single-Widget Case

This model still applies when there is only one widget.

In that case:

- `widgetLocal` still belongs to the single `WidgetInstance`
- `workspaceShared` becomes a degenerate one-widget coordination layer
- `runtimeMeta` still records history/trace/replay

This is why moving shared coordination mutators under `workspace/state` does not break the single-widget architecture.
Single-widget flows still use runtime primitives, while shared coordination semantics now have a clearer owner.

## Read / Write Boundary Summary

```txt
WidgetInstance
  owns: widgetLocal
  reads: workspaceShared, runtimeMeta
  writes: widgetLocal

WidgetWorkspace
  owns: workspaceShared
  reads: widgetLocal, workspaceShared, runtimeMeta
  writes: workspaceShared

Runtime Core
  owns: runtimeMeta
  reads: widgetLocal, workspaceShared, runtimeMeta
  writes: runtimeMeta
  may provide generic mutation primitives for the other two layers
```

## Current Code Alignment

### Already aligned

- `WidgetWorkspace` public contract now writes workspace-shared coordination fields such as:
  - focus
  - comparison targets
  - global filters
  - annotations
- workspace-shared mutators now live under:
  - `widgetva-kit/src/workspace/state/workspaceSharedStateMutators.js`

### Still intentionally runtime-owned

- widget patch/update primitives
- runtime data update primitives
- branch creation
- trace append

These remain under `core/runtime`.

## Evolution Rules

When adding new state, apply these rules in order:

1. If the state is local to one widget, put it in `widgetLocal`.
2. If the state coordinates multiple widgets, put it in `workspaceShared`.
3. If the state exists to support history/trace/replay/branch infrastructure, put it in `runtimeMeta`.
4. Do not create a fourth top-level bucket unless this model has clearly failed in real usage.

## Practical Rule For New APIs

Before adding a new method, ask:

- Is this changing one widget's state?
  - add it to widget-facing logic
- Is this changing shared coordination state?
  - add it to `WidgetWorkspace`
- Is this recording or restoring runtime history?
  - keep it in runtime infrastructure

That rule is the intended long-term guardrail for `widgetva-kit`.
