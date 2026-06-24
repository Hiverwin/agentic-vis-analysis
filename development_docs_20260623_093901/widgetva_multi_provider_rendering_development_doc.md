# WidgetVA Multi-Provider Rendering Development Document

## Overview

This document turns the existing multi-provider rendering plan into an implementation-facing development document for:

- `widgetva-kit`
- `apps/widgetva-system`

Current scope remains intentionally limited to:

- multi-provider widget abstraction
- first-party host consumption
- cross-provider interaction/runtime convergence

This document explicitly does **not** include:

- benchmark importer
- benchmark dataset packaging
- benchmark evaluation workflow

Those should only begin after the provider abstraction and host integration are stable.

---

## Product Goal

We want a real VA system in:

- [apps/widgetva-system](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system)

that can host widgets rendered by multiple mainstream visualization providers inside the same workspace, while preserving one shared semantic/runtime layer for:

- rendering
- human interaction
- shared selection/focus/viewport state
- runtime actions and perceptions
- trace/provenance
- future agent execution

At the same time, we want:

- [widgetva-kit](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit)

to be the reusable abstraction layer that other VA systems can import, rather than a kit that only works for one first-party frontend.

More specifically, the target is **not**:

- six widget kinds split across different fixed providers

The actual target is:

- the same six widget kinds can be instantiated under `vega-lite`
- the same six widget kinds can be instantiated under `echarts`
- the same six widget kinds can be instantiated under `d3`
- the first-party host can switch the workspace rendering environment for the whole widget set
- the agent can operate the six-widget workspace under all three rendering environments through the same runtime/action/perception contract

---

## Core Architectural Decision

The architecture remains:

1. `widgetva-kit` owns the reusable multi-provider contract
2. `apps/widgetva-system` consumes that contract as the first real host
3. benchmark importing is added only after the above are stable

This means:

- provider behavior should not be invented ad hoc in the app
- the host should validate kit abstractions, not replace them
- renderer-specific differences should be isolated behind adapter and render-model boundaries

---

## System Boundary

### `widgetva-kit` owns

- canonical widget semantics
- provider adapter contract
- provider capability declaration
- renderer adapter registry
- provider-agnostic runtime state semantics
- selection/focus/viewport bridge semantics
- widget action/perception semantics

### `apps/widgetva-system` owns

- shell layout
- workspace composition
- first-party session/app store
- first-party trace and analysis panels
- first-party dataset and case lifecycle
- first-party renderer mounting integration

### `apps/widgetva-system` should not own long-term

- renderer-specific dispatch as app-local special cases
- semantic behavior encoded in `widget.type` strings
- provider-specific interaction semantics outside the shared runtime contract

---

## Canonical Data Model

The canonical widget descriptor should now be treated as:

```txt
widgetId
widgetKind
provider
title
role
dataBinding
providerSpec
interactionConfig
providerCapabilities
```

Semantics:

- `widgetKind` answers what the widget is
- `provider` answers how it is rendered
- `providerSpec` carries renderer-native payload when needed
- `interactionConfig` declares direct manipulation affordances
- `providerCapabilities` declares what the provider adapter can actually support

Legacy host-local strings such as:

- `scatter-vega`
- `scatter-echarts`
- `parallel-custom`

are now compatibility inputs only. They should be normalized immediately and should not remain the main internal model.

Because of the environment-switching requirement, the canonical model must not bind a widget family to one fixed provider implementation. The correct instantiation model is:

```txt
widget family contract
    -> render model
    -> provider projection (vega-lite | echarts | d3)
    -> mounted runtime widget
```

That means provider is an instantiation dimension, not a hard-coded property of the widget family itself.

---

## Clarified Provider Requirement

The required capability is:

1. define six canonical widget families
2. allow each family to be rendered in three environments:
   - `vega-lite`
   - `echarts`
   - `d3`
3. allow the host workspace to switch or instantiate the whole six-widget set under any one of those environments
4. keep agent interaction semantics stable across all three environments

So the success condition is **not**:

- scatter works in Vega
- bar works in ECharts
- sankey works in D3

The success condition is closer to:

- scatter, bar, line, heatmap, parallel coordinates, and sankey each have provider projections
- a Vega workspace can contain the six-widget set
- an ECharts workspace can contain the six-widget set
- a D3 workspace can contain the six-widget set
- the same agent-facing runtime contract can operate all three

This requirement implies a stricter architectural boundary:

- `widgetva-kit` must own family-level semantics
- provider adapters must be swappable beneath that family contract
- `apps/widgetva-system` should select a provider environment, not redefine widget semantics per environment

---

## Current Implementation Status

The project is no longer at pure planning stage. The following foundation is already in place.

### Completed in `widgetva-kit`

- Adapter contract exists in [widgetva-kit/src/adapters/widgetAdapterContract.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/adapters/widgetAdapterContract.js)
- Provider adapters exist for:
  - Vega-Lite
  - ECharts
  - D3/custom
- Rendering registry foundation exists in:
  - [widgetva-kit/src/core/rendering/RendererAdapterRegistry.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/core/rendering/RendererAdapterRegistry.js)
  - [widgetva-kit/src/core/rendering/WidgetRendererBridge.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/core/rendering/WidgetRendererBridge.js)
- Host bridge contract has been extended around shared coordination state in:
  - [widgetva-kit/src/core/runtime/hostBridge.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/core/runtime/hostBridge.js)

### Completed in `apps/widgetva-system`

- Canonical `widgetKind + provider` normalization exists in [apps/widgetva-system/src/runtime/importedWidgetContracts.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/importedWidgetContracts.js)
- Provider-aware workspace renderer registry exists in [apps/widgetva-system/src/workspace/workspaceRendererRegistry.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/workspace/workspaceRendererRegistry.js)
- Provider-agnostic render-model builders exist in [apps/widgetva-system/src/workspace/renderModels.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/workspace/renderModels.js)
- Scatter has cross-provider render slices for:
  - Vega-Lite
  - ECharts
  - D3-like custom rendering
- Shared scatter brush overlay exists for non-Vega paths
- Runtime workspace source now carries:
  - `provider`
  - `providerSpec`
  - `renderModel`
  - `interactionConfig`
  - `providerCapabilities`
- Runtime host bridge wiring has been partially connected in:
  - [apps/widgetva-system/src/runtime/runtimeSessionFactory.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/runtimeSessionFactory.js)
  - [apps/widgetva-system/src/runtime/runtimeBridge.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/runtimeBridge.js)

### Current blocker

The remaining blocker is no longer adapter-contract design. It is runtime materialization consistency.

Specifically, the app runtime currently has a regression where runtime widget instances are not being materialized as fully addressable multi-widget workspace entities. The most likely cause is that widget instances are created with `widgetId` but without a stable `widgetRef` in:

- [apps/widgetva-system/src/runtime/runtimeWorkspaceAdapter.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/runtimeWorkspaceAdapter.js)

This has downstream impact on:

- action targeting
- selection creation
- propagation summary
- trace replay consistency
- app store readback

This issue must be fixed before continuing broader provider expansion.

---

## Target End State

The phase is complete when all of the following are true:

1. `widgetva-kit` owns a stable multi-provider adapter/runtime contract
2. `apps/widgetva-system` consumes that contract instead of relying on renderer-first branching
3. one widget family, starting with `scatter`, works across `vega-lite`, `echarts`, and `d3`
4. workspace coordination and runtime trace semantics remain shared across providers
5. the first-party host workspace can contain mixed-provider widgets on the same screen
6. the first-party host can also instantiate the same six-widget workspace under a single chosen provider environment
7. the same runtime and agent-facing interaction contract operates the six-widget workspace under all three environments

Only then should benchmark import begin.

---

## Development Phases

## Phase 1: Stabilize Provider Contract in `widgetva-kit`

### Goal

Make the adapter contract and capability model the single source of truth for multi-provider behavior.

### Scope

- formalize adapter lifecycle
- formalize capability declaration
- formalize interaction readback surface
- keep old interfaces only as compatibility bridges during migration

### Required implementation

1. Adapter contract remains centered on:
   - `mount`
   - `update`
   - `dispose`
   - `bindHumanInteractions`
   - `applyState`
   - `readSelection`
   - `readViewport`
2. Capability declaration must explicitly describe support for:
   - point selection
   - interval brush
   - zoom/pan
   - selection readback
   - viewport readback
   - focus/highlight projection
   - interaction event emission
3. Host bridge must expose shared runtime-readable coordination state, including:
   - selection registry
   - primary selection ref
   - focus state
   - viewport state
   - shared filters

### Files

- [widgetva-kit/src/adapters/widgetAdapterContract.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/adapters/widgetAdapterContract.js)
- [widgetva-kit/src/core/rendering/RendererAdapterRegistry.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/core/rendering/RendererAdapterRegistry.js)
- [widgetva-kit/src/core/runtime/hostBridge.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/core/runtime/hostBridge.js)

### Acceptance criteria

- provider capability declarations are explicit
- runtime code can resolve providers without app-local inference
- host bridge can read shared coordination state from a real host

### Status

- mostly complete
- compatibility cleanup still remains after downstream host migration is stable

---

## Phase 2: Canonical Descriptor and Render-Model Pipeline

### Goal

Make widget semantics canonical before any provider projection occurs.

### Scope

- normalize old widget type strings
- build render models independent of provider
- treat provider specs as projections, not the main intermediate representation

### Required implementation

1. Every imported or derived widget should normalize to:
   - `widgetKind`
   - `provider`
2. Every widget family should build a provider-agnostic render model first
3. Renderer-native payload should be generated from the render model:
   - Vega spec
   - ECharts option
   - D3 scene/config
4. Compatibility fields may remain temporarily, but must not drive the architecture

### Files

- [apps/widgetva-system/src/runtime/importedWidgetContracts.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/importedWidgetContracts.js)
- [apps/widgetva-system/src/workspace/renderModels.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/workspace/renderModels.js)
- [apps/widgetva-system/src/workspace/widgetSpecs.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/workspace/widgetSpecs.js)
- [apps/widgetva-system/src/runtime/carsWidgetDerivation.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/carsWidgetDerivation.js)

### Acceptance criteria

- widget semantics and provider identity are separated
- render-model builders exist for the main widget families
- runtime workspace source carries canonical and provider-specific fields side by side

### Status

- largely complete for current first-party families
- still needs deeper cleanup once the host stops relying on legacy compatibility assumptions

---

## Phase 3: First-Party Host Consumption

### Goal

Make `apps/widgetva-system` the first real host that consumes the kit abstraction instead of bypassing it.

### Scope

- provider-based workspace dispatch
- mixed-provider rendering inside one workspace
- shared interaction semantics in the app store/runtime bridge

### Required implementation

1. Workspace rendering dispatches by:
   - `widgetKind`
   - `provider`
2. The same workspace can mount mixed providers
3. Human interactions converge into the same runtime semantics for:
   - selection
   - focus
   - viewport
   - trace
4. Runtime workspace entities must be fully addressable by both `widgetId` and `widgetRef`
5. The host must support provider-environment selection at workspace instantiation time, rather than treating provider as a one-off property baked into static presets

### Files

- [apps/widgetva-system/src/workspace/workspaceRendererRegistry.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/workspace/workspaceRendererRegistry.js)
- [apps/widgetva-system/src/workspace/WidgetSurface.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/workspace/WidgetSurface.jsx)
- [apps/widgetva-system/src/runtime/runtimeWorkspaceAdapter.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/runtimeWorkspaceAdapter.js)
- [apps/widgetva-system/src/runtime/runtimeSessionFactory.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/runtimeSessionFactory.js)
- [apps/widgetva-system/src/runtime/runtimeBridge.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/runtimeBridge.js)
- [apps/widgetva-system/src/app/appStore.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/app/appStore.js)

### Acceptance criteria

- mixed-provider workspace renders in the real host
- interaction updates coordination state through the shared runtime
- trace and replay keep functioning when provider differs
- no app-local path depends on raw renderer API semantics as the main contract

### Status

- in progress
- currently blocked by runtime widget materialization/readback inconsistency

---

## Phase 4: Cross-Provider Validation Slice

### Goal

Use one widget family to prove the architecture is real before generalizing.

### Initial validation family

- `scatter`

This is only the first validation slice. It is not the final product target.

### Required provider coverage

- `vega-lite`
- `echarts`
- `d3`

### Required behavior

- render
- click/select
- brush
- zoom
- trace emission
- runtime selection readback
- runtime viewport readback

### Acceptance criteria

- the same scatter semantics work across all three providers
- runtime outputs stay stable even when renderer changes
- trace can record interactions from all three paths

### Status

- partially implemented
- currently regressed by runtime widget registration/materialization issues

---

## Phase 5: Environment-Level Workspace Switching

### Goal

Move from “some widgets have some providers” to “the same six-widget analytical workspace can run under different rendering environments.”

### Required implementation

1. define a provider-agnostic workspace composition for the six canonical widget families
2. define family-level provider projections for:
   - scatter
   - bar
   - line
   - heatmap
   - parallel coordinates
   - sankey
3. add host-level environment selection such as:
   - `vega-lite`
   - `echarts`
   - `d3`
4. instantiate workspace widgets by:
   - `widgetKind`
   - selected provider environment
   - family-specific capability fallback rules where needed
5. keep runtime actions/perceptions stable so the agent does not branch on renderer-specific APIs

### Acceptance criteria

- the six-widget workspace can be instantiated in a Vega environment
- the six-widget workspace can be instantiated in an ECharts environment
- the six-widget workspace can be instantiated in a D3 environment
- the host can switch environment without redefining the semantic workspace
- the agent can interact with all three environments through the same runtime contract

### Notes

Provider capability differences are still real. So “same contract” does not require pixel-identical behavior. It requires:

- stable semantic action names
- stable semantic perception names
- stable runtime readback model
- explicit capability reporting when a provider cannot support a behavior at the same fidelity

---

## Immediate Implementation Sequence

This is the order we should actually execute next.

### Task 1: Fix runtime widget materialization

#### Objective

Ensure every runtime workspace widget is instantiated with a stable `widgetRef` and remains fully discoverable by the runtime, propagation layer, and app store.

#### Why first

Without this, the following all become unreliable:

- action dispatch
- linked selection propagation
- runtime selection readback
- trace replay
- agent-facing execution later

#### Likely changes

- update widget instance creation in [apps/widgetva-system/src/runtime/runtimeWorkspaceAdapter.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/runtimeWorkspaceAdapter.js)
- verify session/runtime wiring in [apps/widgetva-system/src/runtime/runtimeSessionFactory.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/runtimeSessionFactory.js)
- verify runtime read/write behavior in [apps/widgetva-system/src/runtime/runtimeBridge.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/runtimeBridge.js)

#### Acceptance criteria

- runtime can enumerate all workspace widgets, not only session shell entities
- `widget.describe()` and widget ref resolution are non-null for real widgets
- app store selection actions update runtime coordination state correctly

### Task 2: Re-stabilize scatter selection and viewport round-trip

#### Objective

Make scatter selection and zoom round-trip cleanly between renderer, app store, and runtime session.

#### Acceptance criteria

- scatter selection produces a shared selection ref
- scatter zoom writes viewport state into runtime
- selecting a trace step can restore the corresponding workspace state

### Task 3: Finish first-party provider dispatch cleanup

#### Objective

Reduce remaining renderer-first assumptions in the host and centralize dispatch through canonical provider resolution.

#### Acceptance criteria

- host does not need raw `widget.type` branching as the primary path
- provider-based resolution is the default path in the workspace

### Task 4: Expand the cross-provider validation slice from scatter outward

#### Objective

After scatter is stable, expand the same render-model plus adapter pattern to additional widget families.

#### Candidate order

1. `bar`
2. `line`
3. `heatmap`
4. `parallelCoordinates`
5. `sankey`

#### Acceptance criteria

- each family first lands on canonical descriptor + render-model discipline
- provider-specific behavior remains behind adapter/projection boundaries

### Task 5: Add environment-level workspace instantiation

#### Objective

Allow the six-widget workspace in `apps/widgetva-system` to be created against a selected rendering environment rather than using fixed per-widget provider assignments.

#### Required outputs

- a workspace-level provider selection model
- projection logic from widget family to provider-specific renderer payload
- preset/case generation that derives six widgets from one semantic workspace definition plus one selected provider

#### Acceptance criteria

- one semantic workspace definition can produce:
  - Vega six-widget workspace
  - ECharts six-widget workspace
  - D3 six-widget workspace
- the agent/runtime layer does not need renderer-specific branching to operate them

---

## Verification Matrix

Every major step should be checked against the same four layers.

### 1. Contract verification

- adapter contract tests pass
- provider capability declarations are explicit
- host bridge selectors return real state

### 2. Runtime verification

- workspace spec includes canonical provider fields
- runtime can enumerate and target all widgets
- selection/focus/viewport state is readable after interaction

### 3. Host verification

- `apps/widgetva-system` can render a mixed-provider workspace
- `apps/widgetva-system` can render the same six-widget workspace under a selected single provider environment
- interaction on one provider updates shared host/runtime state
- trace remains consistent

### 4. Build verification

- targeted test files pass
- `npm run build` passes in `apps/widgetva-system`

---

## Testing Targets

The main tests that should remain green during this phase are:

- [widgetva-kit/src/adapters/widgetAdapterContract.test.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/adapters/widgetAdapterContract.test.js)
- [widgetva-kit/src/core/runtime/hostBridge.test.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/core/runtime/hostBridge.test.js)
- [apps/widgetva-system/src/runtime/importedWidgetContracts.test.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/importedWidgetContracts.test.js)
- [apps/widgetva-system/src/runtime/runtimeWorkspaceAdapter.test.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/runtimeWorkspaceAdapter.test.js)
- [apps/widgetva-system/src/runtime/runtimeSessionFactory.test.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/runtimeSessionFactory.test.js)
- [apps/widgetva-system/src/runtime/runtimeBridge.test.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/runtimeBridge.test.js)
- [apps/widgetva-system/src/app/appStore.test.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/app/appStore.test.js)
- [apps/widgetva-system/src/workspace/renderModels.test.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/workspace/renderModels.test.js)
- [apps/widgetva-system/src/workspace/widgetSpecs.test.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/workspace/widgetSpecs.test.js)
- [apps/widgetva-system/src/workspace/workspaceRendererRegistry.test.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/workspace/workspaceRendererRegistry.test.js)

---

## Non-Goals For This Phase

Do not expand scope into the following before the above is stable:

- benchmark importer
- benchmark metadata schema
- automated provider instance generation
- benchmark UI auditing workflow
- broader agent scaffold experiments

The correct sequence is still:

1. provider abstraction
2. first-party host consumption
3. cross-provider validation
4. environment-level six-widget switching
5. benchmark import

---

## Practical Next Step

The next code task after this document should be:

1. fix runtime widget materialization in `runtimeWorkspaceAdapter`
2. rerun runtime/app store test suites
3. then continue provider-expansion and interaction cleanup on top of a stable multi-widget runtime

That is the shortest path to turning the current partial architecture into a real reusable foundation.
