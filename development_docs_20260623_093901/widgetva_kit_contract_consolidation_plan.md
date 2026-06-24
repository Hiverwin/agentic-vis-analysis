# WidgetVA Kit Contract Consolidation Plan

## Overview

This document defines the next development phase for `widgetva-kit`.
The goal is no longer to add more widget kinds. The goal is to move the kit from:

- six widget families that can run
- widget-owned action and perception surfaces
- a usable widget-first API

to:

- a reusable host-facing contract
- stable shared state models
- action semantics that are not tied directly to spec mutation
- perception semantics that resolve scope consistently across hosts

This plan treats `apps/widgetva-system/` as the validation host, but the work here is centered on `widgetva-kit`.

---

## Why This Phase Is Needed

Current `widgetva-kit` already has strong coverage across six first-class widget types:

- `bar`
- `line`
- `scatter`
- `parallelCoordinates`
- `sankey`
- `heatmap`

The current gap is not widget count. The gap is contract quality.

Four issues now block `widgetva-kit` from becoming a stable reusable library:

1. Host bridge is still partially placeholder-driven.
2. Many widget abilities are still implemented as direct `spec / transform / layer` mutation instead of stable state transitions.
3. Perception queries still expose loosely grouped inputs such as `dataRef / targetDataRef / selectionRef / targetRef` rather than a unified query scope.
4. `sankey` has grown powerful widget-specific behaviors, but its structured data dependencies are not yet isolated cleanly from the general widget contract layer.

This document orders those issues into an implementation sequence.

---

## Current Baseline

The current implementation already provides:

- six first-class widget constructors under `widgets/pool`
- `WidgetInstance` as the single-widget public runtime shell
- widget-owned action/perception descriptors for all six widget families
- `WidgetWorkspace` as the multi-widget coordination container
- runtime contexts that already understand focused widget and selection-scoped querying in partial form
- materializers that already project selection and highlight state into concrete widget specs

This means the next phase should consolidate and stabilize, not restart.

---

## Locked Design Decisions

- `widgetva-kit` remains widget-first at the public API layer.
- Host systems should provide semantic analysis context, not renderer-specific implementation details.
- Shared coordination state should be readable and writable without depending on Vega/Vega-Lite internals.
- Widget actions should primarily express semantic intent.
- Adapters and materializers should remain responsible for concrete provider-side projection.
- Widget-specific structural contracts are allowed, but they should be explicitly isolated from common contract layers.

---

## Priority Order

### Priority 1: Host Bridge Contract

This is the first dependency because the kit cannot become host-reusable without a stable way for the host to expose:

- current focused widget
- active selections
- primary selection
- shared filters
- viewport state
- workspace annotations

Current placeholder behavior in `widgets/pool.js` still returns empty or null values for key coordination reads such as:

- `readCurrentSelection`
- `readCurrentSelections`
- `readFocusedWidgetRef`

That is enough for standalone demos, but not enough for reusable host integration.

### Priority 2: Stable Shared State Model

Once host reads are real, the kit needs canonical state models for:

- `selection`
- `filter`
- `focus`
- `highlight`
- `viewport`

These states should become the primary contract surface between host, widget runtime, materializers, and agents.

### Priority 3: Action Refactor Toward State-First Semantics

After shared state is defined, widget actions should stop treating direct spec edits as their primary contract.

Instead:

- actions produce semantic state transitions
- adapters/materializers project those transitions into renderer-specific changes

This keeps public behavior stable even if renderers change.

### Priority 4: Perception Query Scope

Perception should stop relying on a loose parameter bundle and instead accept one normalized scope model that can resolve:

- target widget
- target data
- selection scope
- focus scope
- viewport scope

### Priority 5: Sankey-Specific Isolation

`sankey` should keep its strong structured capabilities, but its requirements such as:

- `rawLinks`
- `nodeConfig`
- `depthLabelsData`

should become an explicit widget-specific schema rather than remaining implicit assumptions buried in perception/action code.

---

## Phase Plan

## Phase 1: Host Bridge Foundation

### Task 1.1: Define the minimal host bridge read contract

Description:
Define the smallest stable read interface that every real host system should be able to implement.

Required reads:

- `readFocusedWidgetRef`
- `readSelectionRegistry`
- `readPrimarySelectionRef`
- `readSharedFilters`
- `readViewportState`
- `readWorkspaceAnnotations`
- `readComparisonTargets`
- `readCurrentSpecOverrides` if needed for host-side overlays

Acceptance criteria:

- A documented host bridge contract exists in code.
- The default bridge remains usable for isolated widget demos.
- Placeholder nulls are clearly identified as fallback behavior, not the intended integration contract.

Files likely touched:

- `widgetva-kit/src/core/runtime/hostBridge.js`
- `widgetva-kit/src/widgets/pool.js`
- `widgetva-kit/src/core/index.js`

Verification:

- Existing widget pool tests still pass.
- New tests verify default bridge behavior and explicit host bridge behavior.

### Task 1.2: Route runtime/context state reads through the host bridge

Description:
Normalize runtime reads so that focused widget and selection context come from the host bridge consistently.

Acceptance criteria:

- `DataQueryContext` and `PerceptionContext` prioritize host-provided coordination state.
- Missing focus or selection yields explicit, stable behavior.
- `WidgetWorkspace` coordination reads align with host bridge semantics.

Files likely touched:

- `widgetva-kit/src/core/runtime/DataQueryContext.js`
- `widgetva-kit/src/core/runtime/PerceptionContext.js`
- `widgetva-kit/src/core/runtime/DataQueryExecutor.js`
- `widgetva-kit/src/workspace/widgetWorkspace.js`

Verification:

- Focused-widget resolution tests pass.
- Selection-scoped query resolution tests pass.

### Checkpoint: Host Bridge

- Runtime no longer depends on placeholder-only coordination reads.
- Host systems have a clear minimal read contract.
- Standalone widgets still work without a full external host.

---

## Phase 2: Shared Coordination State

### Task 2.1: Define canonical selection state

Description:
Unify interval, categorical, cell, multivariate, and path-based selection expressions into one canonical shared model.

Required fields should cover:

- `selectionId`
- `kind`
- `sourceWidgetRef`
- `scope`
- `predicates`
- `domain`
- `summary`
- `selectionDataRef`

Acceptance criteria:

- All six widget families can map their active selections into this model.
- Propagation and selection summaries use this canonical shape.
- Selection registry semantics are documented and tested.

Files likely touched:

- `widgetva-kit/src/workspace/state/selectionStateModel.js`
- `widgetva-kit/src/core/runtime/materializers/selectionStateShape.js`
- `widgetva-kit/src/adapters/widgets/shared/selectionResult.js`

Verification:

- New tests cover scatter, bar, heatmap, parallel coordinates, and sankey mappings.

### Task 2.2: Define focus, highlight, and viewport state

Description:
Extract these from renderer-specific behavior into shared coordination state.

Acceptance criteria:

- `focus` has a stable widget/item-level representation.
- `highlight` has a stable cross-widget representation.
- `viewport` can at minimum represent x/y domain state for quantitative views.

Files likely touched:

- `widgetva-kit/src/workspace/state/`
- `widgetva-kit/src/core/runtime/materializers/widgetStateBuilders.js`
- `widgetva-kit/src/adapters/widgets/shared/applyVegaLiteState.js`

Verification:

- Highlight and viewport state tests pass.
- State shapes are readable from host or workspace level.

### Checkpoint: Shared State

- `selection / focus / highlight / viewport` are first-class coordination state.
- Shared state is understandable without reading widget family internals.

---

## Phase 3: State-First Action Semantics

### Task 3.1: Refactor scatter actions to state-first behavior

Description:
Use scatter as the first migration slice because it exposes the clearest gap today.

Actions to refactor first:

- `scatter.brushRegion`
- `scatter.zoomDomain`
- `scatter.identifyClusters`
- `scatter.showRegression`

Target behavior:

- `brushRegion` updates canonical selection state
- `zoomDomain` updates canonical viewport state
- `identifyClusters` creates derived analytic overlay state
- `showRegression` creates derived analytic overlay state

Acceptance criteria:

- Action outputs are interpretable without reading Vega-Lite internals.
- Provider-specific projection happens in adapter/materializer code.

Files likely touched:

- `widgetva-kit/src/widgets/scatter/actions.js`
- `widgetva-kit/src/adapters/widgetFamilies/scatterWidgetAdapter.js`
- `widgetva-kit/src/adapters/widgets/shared/applyVegaLiteState.js`

Verification:

- Scatter action tests validate state output and rendered projection.

### Task 3.2: Migrate bar, line, heatmap, and parallel coordinates

Description:
Port the remaining general-purpose widgets to the same state-first model.

Acceptance criteria:

- Selection actions update canonical selection state.
- Filter/highlight actions update canonical filter/highlight state.
- Reorder and zoom operations update stable view state rather than directly becoming the public contract themselves.

Files likely touched:

- `widgetva-kit/src/widgets/bar/actions.js`
- `widgetva-kit/src/widgets/line/actions.js`
- `widgetva-kit/src/widgets/heatmap/actions.js`
- `widgetva-kit/src/widgets/parallelCoordinates/actions.js`

Verification:

- Each widget family gets action-state tests.

### Task 3.3: Keep sankey partially specialized

Description:
Do not force structural Sankey editing into the common contract layer.

Commonized actions:

- `sankey.focusFlow`
- `sankey.filterFlow`
- `sankey.highlightPath`

Explicitly widget-specific actions:

- `sankey.collapseNodes`
- `sankey.expandNode`
- `sankey.reorderNodesInLayer`
- `sankey.autoCollapseByRank`

Acceptance criteria:

- Common Sankey actions align with shared state.
- Structural Sankey actions are marked as widget-specific structural transforms.

Files likely touched:

- `widgetva-kit/src/widgets/sankey/actions.js`
- `widgetva-kit/src/widgets/sankey/index.js`

Verification:

- Sankey contract tests separate common and specific capabilities.

### Checkpoint: Actions

- General widget actions no longer use direct spec mutation as their primary contract story.
- State-first behavior is established across the major widget families.

---

## Phase 4: Unified Perception Query Scope

### Task 4.1: Introduce `queryScope`

Description:
Replace the current loosely grouped parameter pattern with a normalized query scope.

Minimum scope fields:

- `widgetRef`
- `dataRef`
- `selectionRef`
- `focusRef`
- `viewportRef`

Acceptance criteria:

- Query scope has stable resolution rules.
- Older parameter style remains supported temporarily through normalization.

Files likely touched:

- `widgetva-kit/src/core/protocol/perception.js`
- `widgetva-kit/src/core/runtime/PerceptionContext.js`
- `widgetva-kit/src/core/runtime/DataQueryContext.js`

Verification:

- Scope normalization tests pass.

### Task 4.2: Migrate widget perception descriptors to `queryScope`

Description:
Update all widget perception descriptors and runtime handlers to normalize inputs through `queryScope`.

Acceptance criteria:

- Scatter, bar, line, heatmap, parallel coordinates, and sankey perception definitions support `queryScope`.
- Existing behavior remains backward compatible during migration.

Files likely touched:

- `widgetva-kit/src/widgets/*/perception.js`
- `widgetva-kit/src/transportInspect.js`

Verification:

- Perception tests cover both legacy and normalized call shapes.

### Checkpoint: Perception

- Query scope is consistent across widgets.
- Perception reads no longer depend on ad hoc parameter grouping.

---

## Phase 5: Sankey Structural Isolation

### Task 5.1: Define explicit sankey structured data schema

Description:
Pull Sankey-specific structured requirements into an explicit schema instead of leaving them as implicit named-data conventions.

Schema must account for:

- raw flow links
- node configuration
- layer/depth labels
- collapsed-group state

Acceptance criteria:

- Sankey-specific structured data requirements are documented in code.
- Errors clearly identify missing structured fields.
- General widget contract layers are not polluted by these details.

Files likely touched:

- `widgetva-kit/src/widgets/sankey/perception.js`
- `widgetva-kit/src/widgets/sankey/actions.js`
- new sankey schema/helper module

Verification:

- Sankey tests validate schema assumptions directly.

### Checkpoint: Sankey

- Sankey remains powerful.
- Sankey no longer defines the common contract shape accidentally.

---

## Phase 6: Validation and Migration

### Task 6.1: Expand tests from name enumeration to semantic contract verification

Description:
Current tests prove descriptor presence. The next phase needs tests that prove host integration semantics and state semantics.

Add tests for:

- host bridge reads
- canonical selection state
- focus/highlight/viewport state
- action-to-state transitions
- perception scope resolution
- Sankey-specific schema validation

Files likely touched:

- `widgetva-kit/src/widgets/*.test.js`
- `widgetva-kit/src/core/runtime/*.test.js`
- workspace or integration tests

Verification:

- `node --test` passes across widget and runtime contract suites.

### Task 6.2: Validate against `apps/widgetva-system`

Description:
Use the host VA app as the main regression surface to ensure contract changes still support direct human analysis flows.

Acceptance criteria:

- scatter brush remains usable
- focus and linked selection remain readable
- host-facing state can be mapped cleanly into the app shell

Files likely touched:

- `apps/widgetva-system/src/...`
- future integration bridge files

Verification:

- host VA build passes
- manual interaction flow remains intact

---

## Recommended Execution Order

1. Host bridge foundation
2. Canonical selection state
3. Focus/highlight/viewport state
4. Scatter action refactor
5. General widget action migration
6. Unified perception query scope
7. Sankey structural isolation
8. Semantic contract tests
9. Host VA validation

---

## Immediate First Slice

If implementation starts now, the recommended first slice is:

1. define the host bridge read contract
2. route runtime contexts through it
3. define canonical selection state

This is the smallest slice that unlocks the rest without rework.

---

## Success Criteria For This Whole Phase

This phase is complete when:

- a host VA system can expose focus and selection through a stable bridge
- widget actions can be explained in state terms before renderer terms
- perception queries use a normalized scope model
- Sankey remains expressive without distorting the common contract
- tests verify semantics, not just exported names

