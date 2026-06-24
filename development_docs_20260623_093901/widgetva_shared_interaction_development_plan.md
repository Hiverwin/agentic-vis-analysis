# WidgetVA Shared Interaction Development Plan

## Scope
This document defines the interaction-development plan for a visual analytics system where:

- humans interact through the UI
- agents interact through structured actions
- both should operate over the same analytical interaction semantics

This is a feature-development document.
It does not focus on:

- agent planning/memory/prompting
- benchmark UI
- trace/provenance completeness
- low-level frontend polish

The purpose is:

> make the VA system expose a shared analytical interaction repertoire that is available to both human users and agents.

## Core Requirement

Human interaction and agent interaction do not need to share the same input modality.

They do need to share the same analytical intent.

That means:

- a human may drag to brush
- an agent may call a structured action

but both should be expressing the same underlying interaction:

- select interval
- filter category
- highlight subset
- drill down into subset
- focus target
- compare subsets
- clear / restore interaction state

The system should therefore be designed around:

> interaction-intent parity

not:

> pixel-level parity

## Development Goal

The goal of this plan is to ensure that:

1. the first-party VA system supports a sufficiently rich human-facing interaction set
2. every important human-facing interaction has a matching structured widget/workspace action
3. those interactions operate over shared widget/workspace semantics rather than app-local ad hoc state

## Interaction Families

This plan groups interactions into seven families.

### 1. Selection

The user isolates a subset without necessarily committing to a filter.

Examples:
- brush a scatter region
- click a bar category
- click a line point/year
- click a heatmap cell
- click a parallel record
- click a sankey node

Shared intent:
- define a current analytical subset

### 2. Filter

The user constrains the visible data domain.

Examples:
- filter by origin
- filter by year
- filter by cylinders
- filter to a brushed numeric interval
- clear a filter

Shared intent:
- reduce the active data scope

### 3. Highlight

The user marks a subset for attention without fully filtering the rest out.

Examples:
- hover-like or persistent category highlight
- highlight a selected subset across linked views
- emphasize records matching a current subset

Shared intent:
- make a subset visually salient while preserving context

### 4. Focus

The user makes one target the current main object of attention.

Examples:
- focus a widget
- focus a single record in parallel coordinates
- focus a linked target after selection

Shared intent:
- promote one target for the next reasoning step

### 5. Drill-Down / Expand

The user moves from a summary/group to a more detailed structure.

Examples:
- expand a sankey node group
- expand a collapsed aggregate bucket
- isolate a category into a more detailed comparison state

Shared intent:
- transition from overview to more detailed inspection

### 6. Compare / Reconfigure

The user reorganizes the view to compare structures.

Examples:
- reorder nodes in sankey
- cluster/sort rows or columns in heatmap
- show regression / moving average / cluster overlays
- compare selected subsets against baseline

Shared intent:
- change representation to support comparison

### 7. Reset / Restore

The user clears, restores, or backs out from temporary interaction state.

Examples:
- clear selection
- clear filters
- restore previous selection
- restore snapshot / jump back

Shared intent:
- recover from exploratory state

## What Must Be True

For each interaction family above, the system should eventually support all three layers:

### A. Human UI interaction

A human can perform the interaction directly in the first-party VA system.

### B. Structured action surface

The same interaction can be expressed as a widget/workspace action without pixel mediation.

### C. Shared state consequence

The interaction updates canonical widget/workspace state, not only transient UI state.

If any of these three is missing, the interaction family is not complete.

## Current Baseline

Already in place:

- selection-first interactions exist for:
  - scatter brush
  - bar click
  - line click
  - heatmap cell click
  - parallel record click
  - sankey node click
- these now write into real workspace selection state
- linked behavior propagates through real link-aware coordination
- propagation summary and verification summary exist
- first-party controls now expose:
  - direct category filters for origin / year / cylinders
  - commit current supported selection into persistent workspace filters
  - clear selection without clearing filters
  - promote current selection to shared highlight
  - clear shared highlight
  - clear filters / reset workspace
  - undo / redo selection history
  - restore previous / earliest workspace state through canonical replay
  - contextual analytical controls for:
    - scatter regression / clustering
    - bar top-N highlight
    - line trend highlight / moving average
    - heatmap row/column clustering
    - parallel dimension hiding / restore
    - sankey node tracing / collapse / expand / layer reordering / auto-collapse

What is still incomplete:

- explicit drill-down / expand interactions in first-party UI
- consistent reset / clear / restore controls across widget families
- human-visible interaction coverage is still thinner than the widget semantic surface
- direct scatter/bar/line/heatmap/parallel/sankey node gestures now run through canonical widget actions and are locked by focused runtime tests

## Shared Interaction Contract

Each important interaction should be representable by a canonical structured action.

This document does not require every action to be widget-generic.
It does require that each user-facing analytical interaction map to one stable action family.

Examples:

- scatter brush
  - human: drag brush
  - action: `scatter.selectRegion`

- bar category filter
  - human: click category chip/bar
  - action: `bar.filterCategories`

- bar category highlight
  - human: hover/toggle highlight
  - action: `bar.highlightCategories`

- sankey expand
  - human: click expand affordance
  - action: `sankey.expandNode`

- heatmap reorder
  - human: choose cluster/sort mode
  - action: `heatmap.clusterRowsCols`

- reset
  - human: clear interaction control
  - action: `workspace.clearSelectionState` / `workspace.clearGlobalFilters`

## Development Themes

This plan implements four concrete themes.

1. complete selection/filter/highlight/focus parity
2. expose drill-down/reconfigure interactions in the first-party UI
3. add reset/restore interaction completeness
4. ensure shared interaction execution goes through canonical widget/workspace state

## Theme I1: Selection / Filter / Highlight / Focus Parity

## Goal

Make the core interaction families available to both humans and agents across the first-party widget set.

## Target Design

For each first-party widget:

- identify which of `select`, `filter`, `highlight`, `focus` are meaningful
- ensure a human can trigger them in the UI
- ensure a structured action exists or is added
- ensure resulting state is visible in observation/verification surfaces

### Expected per-widget target

#### Scatter

- select interval
- clear selection
- filter by selected interval
- highlight linked subset
- focus selected subset/widget

#### Bar

- select category
- filter categories
- highlight categories
- clear category interaction

#### Line

- select time/category point
- filter by x region or value
- highlight selected trend segment
- clear line interaction

#### Heatmap

- select cell/region
- filter by row/column/cell subset
- highlight row/column/cell
- clear heatmap interaction

#### Parallel Coordinates

- select record
- filter to focused records/subset
- highlight record(s)
- focus record
- clear interaction

#### Sankey

- select node/path
- filter flow subset
- color/highlight subset
- focus node/path
- clear interaction

## Implementation Tasks

### Task I1.1: Audit parity gaps per widget

Files likely touched:

- [apps/widgetva-system/src/workspace/WidgetSurface.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/workspace/WidgetSurface.jsx:1)
- [apps/widgetva-system/src/app/appStore.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/app/appStore.js:1)
- [widgetva-kit/src/widgets](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/widgets:1)

Work:

- produce a concrete parity table for six widget families
- mark each interaction as:
  - human-supported
  - action-supported
  - workspace-state-backed
  - verification-readable

### Current parity audit

| Widget | Interaction | Human UI | Structured action | Canonical workspace/widget state | Verification-readable | Notes |
|---|---|---:|---:|---:|---:|---|
| Scatter | brush/select interval | yes | yes | yes | yes | `scatter.brushRegion` is the canonical path |
| Scatter | filter to selected interval | yes | yes | yes | yes | committed through workspace global filters |
| Scatter | highlight linked subset | yes | yes | yes | yes | via shared highlight state |
| Scatter | clear selection/highlight | yes | yes | yes | yes | shared clear/reset controls exist |
| Bar | select category | yes | yes | yes | yes | UI click now uses `bar.selectCategory` |
| Bar | highlight top categories | yes | yes | yes | yes | contextual control uses `bar.highlightTopN` |
| Bar | direct category filter | yes | yes | yes | yes | category filter controls write workspace global filters |
| Line | select x-axis value | yes | yes | yes | yes | UI click now uses `line.selectXValue` |
| Line | highlight trend | yes | yes | yes | yes | contextual control uses `line.highlightTrend` |
| Line | moving average overlay | yes | yes | yes | yes | contextual control uses `line.showMovingAverage` |
| Heatmap | select cell/region | yes | yes | yes | yes | UI click uses `heatmap.selectSubmatrix` |
| Heatmap | filter to current selection | yes | yes | yes | yes | promoted through workspace global filters |
| Heatmap | highlight rows / columns / selected region / hotspots | yes | yes | yes | yes | contextual controls use `heatmap.highlightRegion` and `heatmap.highlightRegionByValue` |
| Heatmap | cluster rows/cols | yes | yes | yes | yes | contextual control uses `heatmap.clusterRowsCols` |
| Parallel | select record | yes | yes | yes | yes | UI line click now uses `parallelCoordinates.selectRecord` |
| Parallel | focus selected record | yes | yes | yes | yes | UI focus now rebinds from canonical workspace selection |
| Parallel | hide/restore dimensions | yes | yes | yes | yes | contextual controls use hide/reset hidden dimensions |
| Sankey | select node by origin/year/cylinders | yes | yes | yes | yes | UI node click now uses `sankey.focusFlow` |
| Sankey | select aggregate node | yes | yes | yes | yes | UI aggregate click now uses `sankey.selectAggregateNode` |
| Sankey | trace selected node | yes | yes | yes | yes | contextual control uses `sankey.traceNode` |
| Sankey | collapse/expand/reorder/auto-collapse | yes | yes | yes | yes | contextual controls use canonical sankey actions |
| Heatmap | highlight selected region | yes | yes | yes | yes | contextual control uses `heatmap.highlightRegion` |

Primary remaining parity gaps:

- no major parity gap remains in the current first-party interaction surface; future work can expand optional heatmap highlight variants beyond the current row/column/region/hotspot set

### Task I1.2: Add missing highlight interactions

Primary expected work:

- add explicit first-party UI triggers for highlight where currently only filter is present
- add or reuse widget actions such as:
  - `bar.highlightCategories`
  - `heatmap.highlightRegion`
  - `sankey.highlightPath`
  - `scatter.traceNode` / linked highlight flows where appropriate

### Task I1.3: Separate filter from selection where currently conflated

Work:

- stop using filter as the only visible consequence of a selection
- allow selection to remain selection when appropriate
- allow target widgets to respond by highlight or focus rather than always by filter

### Task I1.4: Add explicit clear interaction affordances

Work:

- ensure each major interaction family has a human-visible clear/reset path
- map it to workspace/widget actions rather than app-local mutation only

## Verification

- human can perform select/filter/highlight/focus interactions in the UI
- corresponding structured actions exist
- state updates appear in workspace coordination state and widget verification state
- linked views respond according to link effect and policy

## Theme I2: Drill-Down / Expand / Reconfigure Interaction Exposure

## Goal

Make nontrivial analytical reconfiguration actions available in the first-party VA system, not only in backend/widget contracts.

## Target Design

High-value widget actions that already exist in `widgetva-kit` should become reachable through the first-party UI where appropriate.

Examples:

- sankey
  - expand node
  - collapse node/group
  - reorder nodes in layer
  - auto-collapse by rank

- scatter
  - show regression
  - identify clusters

- line
  - show moving average

- heatmap
  - cluster rows/cols

These actions need not all be always visible.
They should be available through explicit controls when they are analytically meaningful.

## Implementation Tasks

### Task I2.1: Define first-party analytical controls surface

Files likely touched:

- [apps/widgetva-system/src/analysis](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/analysis:1)
- [apps/widgetva-system/src/setup](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/setup:1)

Work:

- decide where analytical controls live
  - per-widget controls
  - side-panel controls
  - contextual controls

### Task I2.2: Expose sankey structure operations

Expected actions:

- `sankey.expandNode`
- `sankey.collapseNode`
- `sankey.reorderNodesInLayer`
- `sankey.autoCollapseByRank`

### Task I2.3: Expose analytical overlays / transforms

Expected actions:

- `scatter.showRegression`
- `scatter.identifyClusters`
- `line.showMovingAverage`
- `heatmap.clusterRowsCols`

### Task I2.4: Bind actions through canonical execution path

Work:

- UI controls should call workspace/widget actions through the canonical runtime path
- avoid bypassing widget action semantics via one-off app mutation

## Verification

- a human can trigger these analytical actions from the first-party VA system
- action effects are visible in widget state / verification state
- the same actions remain callable by structured agent action surface

## Theme I3: Reset / Restore Interaction Completeness

## Goal

Make exploratory interaction state safely reversible for both human users and agents.

## Target Design

The system should support:

- clear current selection
- clear global filters
- clear widget-local highlight/focus where applicable
- restore previous interaction state where already supported
- jump back through workspace state when needed

This is critical for exploratory VA, not just convenience.

## Implementation Tasks

### Task I3.1: Add visible clear/reset controls

Work:

- first-party UI must expose:
  - clear selection
  - clear filters
  - reset current analytical interaction

### Task I3.2: Normalize clear actions across widget families

Work:

- align on widget/workspace actions used for reset
- reduce ad hoc per-view clearing behavior

### Task I3.3: Connect restore/replay where already available

Work:

- use existing workspace/runtime restore surfaces when a UI-level restore is needed
- avoid duplicating history semantics in app-local state

## Verification

- after any major interaction, a human can return to a clean state
- the same reset/restore path is available to structured runtime actions

## Theme I4: Shared Execution Path Integrity

## Goal

Ensure that important interactions are executed through canonical widget/workspace semantics, not parallel app-only logic.

## Target Design

For high-value interactions:

- UI event
  -> structured widget/workspace action
  -> workspace shared/local state update
  -> linked propagation
  -> verification read

This path should be the default for major analytical interactions.

## Implementation Tasks

### Task I4.1: Audit app-local shortcuts

Files likely touched:

- [apps/widgetva-system/src/runtime/runtimeBridge.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/runtimeBridge.js:1)
- [apps/widgetva-system/src/app/appStore.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/app/appStore.js:1)
- [apps/widgetva-system/src/workspace](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/workspace:1)

Work:

- identify interactions still handled only by local UI/store logic
- classify which should stay local and which must move to canonical runtime path

### Task I4.2: Move high-value interactions to canonical execution

Priority interactions:

- selection / clear selection
- filter / clear filter
- highlight
- focus
- drill-down / expand

### Task I4.3: Verify each path through widget/workspace reads

Work:

- after execution, verify through:
  - `readObservation`
  - `readVerificationState`
  - `readCoordinationState`
  - `readLatestCoordinationResult`

## Verification

- key interactions are no longer app-only shortcuts
- resulting state can be read back through formal runtime surfaces

## Priority Order

Recommended implementation order:

1. `I1` selection/filter/highlight/focus parity
2. `I3` reset/restore completeness
3. `I2` drill-down/reconfigure exposure
4. `I4` execution-path cleanup

Reason:

- parity and reversibility are the minimum needed for a real VA interaction system
- analytical reconfiguration is high value, but comes after core interaction completeness
- execution-path cleanup is ongoing and should follow the highest-value interaction flows first

## Success Criteria

This plan is complete when:

- the first-party VA system supports a clearly enumerated human interaction repertoire
- each important human interaction has a corresponding structured action surface
- key interactions are backed by canonical widget/workspace semantics
- interaction consequences are observable through formal runtime reads

At that point, the system can more credibly claim:

> the widget-centric design supports both human and agent interaction over the same VA semantics.
