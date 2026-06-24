# WidgetVA Multi-Provider Rendering Development Plan

## Overview

This document defines the next development phase for:

- `widgetva-kit`
- `apps/widgetva-system/`

The goal of this phase is to make WidgetVA support multiple mainstream visualization providers, while keeping:

- widget semantics stable
- human interaction semantics stable
- agent-facing runtime semantics stable

Current scope explicitly excludes:

- benchmark importer design
- benchmark dataset packaging
- benchmark evaluation UI

This phase is only about establishing the correct architecture so that:

1. `widgetva-kit` becomes the reusable multi-provider abstraction layer
2. `apps/widgetva-system/` becomes the first real host that consumes that abstraction
3. future benchmark instances can later plug into a stable environment instead of a renderer-specific prototype

---

## Problem Statement

Right now the system can render widgets, but the rendering path is still mostly host-local and widget-type-specific.

For example:

- `apps/widgetva-system/src/workspace/WidgetSurface.jsx` branches directly on widget types such as:
  - `scatter-vega`
  - `bar-vega`
  - `line-vega`
  - `heatmap-vega`
  - `parallel-custom`
  - `sankey-custom`

This means:

- rendering provider is still encoded into widget type naming
- workspace rendering is still host-owned instead of kit-owned
- interaction wiring is still partly renderer-specific
- `rendererFamily` is not yet a real provider-agnostic dispatch layer

At the same time, `widgetva-kit` already contains early signs of the correct abstraction:

- provider identifiers such as `vega-lite`, `echarts`, `d3`, `custom`
- `WidgetRendererBridge`
- adapter-level interaction binding hooks

The current gap is therefore not whether multi-provider support is possible.
The gap is that the library and the host are not yet separated cleanly enough for multi-provider support to become a stable contract.

---

## Core Design Decision

The correct development order is:

1. define the multi-provider contract in `widgetva-kit`
2. implement provider adapters in `widgetva-kit`
3. make `apps/widgetva-system/` consume those kit abstractions
4. only later add benchmark import on top

This means `apps/widgetva-system/` should not be the place where multi-provider behavior is invented first.
It should be the first-party validation host that proves the `widgetva-kit` abstractions are real.

---

## Target Outcome

After this phase, the intended result is:

- `widgetva-kit` can describe widgets in a provider-agnostic way
- `widgetva-kit` can mount widgets through different renderer adapters
- `widgetva-kit` can bind human interactions across providers into the same runtime semantics
- `apps/widgetva-system/` can show a mixed-provider workspace inside its existing central workspace panel

That means the workspace inside:

- [apps/widgetva-system](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system)

should be able to host widgets such as:

- a scatter rendered with Vega-Lite
- a bar chart rendered with ECharts
- a sankey rendered with D3

while preserving the same:

- selection semantics
- focus semantics
- viewport semantics
- trace semantics
- agent action/perception semantics

---

## Architectural Boundary

## 1. `widgetva-kit`

`widgetva-kit` should own all reusable cross-provider abstractions:

- canonical widget descriptor
- renderer adapter contract
- provider capability contract
- runtime-to-renderer interaction bridge
- selection / focus / viewport readback semantics
- provider-agnostic action and perception surfaces

`widgetva-kit` should not know:

- the first-party shell layout
- the analysis rail layout
- the trace drawer layout
- the dataset panel layout

## 2. `apps/widgetva-system/`

`apps/widgetva-system/` should remain the first-party host system.
It should own:

- workspace layout
- rails and panel composition
- session state and case selection
- first-party shell UX
- first-party trace and analysis views

But it should stop owning provider-specific rendering logic as an app-local special case.

## 3. Provider Adapters

Provider adapters form the bridge between renderer internals and WidgetVA semantics.

They should eventually live in `widgetva-kit`, not only in the first-party app.

Initial target providers:

- `vega-lite`
- `echarts`
- `d3`

---

## Locked Design Decisions

- Widget semantics must remain provider-agnostic.
- Provider identity must be represented explicitly, not buried in ad hoc widget type strings.
- Agent-facing operations must target semantic widget behavior, not renderer-specific APIs.
- Human interactions from different renderers must converge into the same runtime event shape.
- Verification and trace semantics must not depend on whether the underlying widget was rendered by Vega-Lite, D3, or ECharts.
- `apps/widgetva-system/` is the first validation host, not the source of truth for the abstraction.

---

## Canonical Model Shift

The current host often treats widgets as renderer-shaped types such as:

- `scatter-vega`
- `parallel-custom`

This phase should move the system toward a canonical descriptor shaped like:

```txt
widgetKind: scatter
provider: vega-lite
providerSpec: ...
interactionConfig: ...
providerCapabilities: ...
```

This means:

- `widgetKind` describes what the widget is
- `provider` describes how it is rendered
- `providerSpec` describes renderer-native payloads if needed
- `interactionConfig` describes human-operable affordances
- `providerCapabilities` describes what the adapter can actually support

The host should reason about `widgetKind`.
The renderer layer should reason about `provider`.

---

## Phase Plan

## Phase 1: Renderer Adapter Contract in `widgetva-kit`

### Objective

Create the stable provider-agnostic rendering contract that every supported renderer must implement.

### Required outputs

#### 1. Renderer adapter interface

Each adapter should expose a surface equivalent to:

- `provider`
- `supportedWidgetKinds`
- `describeCapabilities()`
- `mount({ container, widgetState, renderModel, runtimeContext })`
- `update({ mountedView, widgetState, renderModel, runtimeContext })`
- `dispose({ mountedView })`
- `bindHumanInteractions({ mountedView, widgetState, interactionConfig, onActionCall, onSelectionChange, onViewportChange })`
- `applyRuntimeState({ mountedView, widgetState, renderModel, interactionConfig })`
- `readSelection?({ mountedView })`
- `readViewport?({ mountedView })`

#### 2. Capability declaration model

Adapters should explicitly declare whether they support:

- point/categorical selection
- interval brush
- zoom/pan
- focus readback
- viewport readback
- highlight projection
- interaction event emission

#### 3. Adapter registry contract

The kit should provide a stable way to:

- register adapters
- resolve an adapter by provider id
- check adapter/widget-kind compatibility

### Acceptance criteria

- A formal adapter contract exists in `widgetva-kit`
- Provider capabilities are explicit, not inferred ad hoc
- Runtime rendering code can resolve adapters by provider id
- Existing renderer bridge logic is reorganized around the new contract

### Likely files touched

- `widgetva-kit/src/core/rendering/*`
- `widgetva-kit/src/core/protocol/widgetAdapters.js`
- `widgetva-kit/src/adapters/*`

### Notes

This phase is the prerequisite for every later step.
Without it, multi-provider support remains host-specific glue code.

---

## Phase 2: Canonical Widget Descriptor and Render Model

### Objective

Make `widgetva-kit` and the first-party host describe widgets semantically first and renderer second.

### Required outputs

#### 1. Canonical widget descriptor

The system should stop depending on widget-type strings that conflate semantics and provider.

The canonical descriptor should include at least:

- `widgetId`
- `widgetKind`
- `provider`
- `title`
- `role`
- `dataBinding`
- `providerSpec`
- `interactionConfig`
- `providerCapabilities`

#### 2. Provider-agnostic render model

The host should stop directly generating only Vega-Lite specs as its main intermediate representation.

Instead, each widget family should first build a provider-agnostic render model, for example:

- `buildScatterRenderModel(...)`
- `buildBarRenderModel(...)`
- `buildLineRenderModel(...)`

Then the chosen adapter projects that model into:

- Vega-Lite spec
- ECharts option
- D3 scene/config

#### 3. Compatibility bridge

During migration, old fields such as `scatter-vega` may continue to exist as compatibility inputs, but they should be normalized immediately into:

- `widgetKind`
- `provider`

### Acceptance criteria

- Widget semantics and provider identity are separated
- Render-model builders exist independently of any one provider
- The host can resolve rendering by `provider` instead of `widget.type` branching alone
- Existing first-party widgets can still render through a compatibility bridge

### Likely files touched

- `widgetva-kit/src/core/protocol/*`
- `apps/widgetva-system/src/runtime/importedWidgetContracts.js`
- `apps/widgetva-system/src/runtime/*`
- `apps/widgetva-system/src/workspace/WidgetSurface.jsx`
- `apps/widgetva-system/src/workspace/widgetSpecs.js`

### Notes

This phase is where the data model shifts from:

- renderer-first

to:

- widget-semantics-first

---

## Phase 3: First-Party Host Consumption in `apps/widgetva-system`

### Objective

Make the real workspace inside `apps/widgetva-system/` consume the new multi-provider kit abstractions.

### Required outputs

#### 1. Provider-based workspace dispatch

The workspace should keep its current shell and slots, but widget rendering should dispatch by:

- `widgetKind`
- `provider`

instead of only by host-local type branches.

#### 2. Mixed-provider workspace support

The first-party host should be able to render a workspace where different widgets use different providers inside the same page.

#### 3. Unified interaction wiring

Human interactions from:

- Vega-Lite
- ECharts
- D3

should all enter the same app/runtime semantics for:

- selection
- viewport
- focus
- trace

#### 4. Minimal validation slice

The first required end-to-end slice should be:

- `scatter` in `vega-lite`
- `scatter` in `echarts`
- `scatter` in `d3`

All three should support:

- render
- click/select
- brush
- zoom
- trace emission
- basic verification readback

### Acceptance criteria

- `apps/widgetva-system/` workspace can mount provider-mixed widgets
- The central workspace panel remains the actual host surface for all providers
- At least one widget family works across all three target providers
- Human interactions are no longer wired only through app-local renderer-specific code paths

### Likely files touched

- `apps/widgetva-system/src/workspace/*`
- `apps/widgetva-system/src/runtime/*`
- `apps/widgetva-system/src/app/appStore.js`

### Notes

This phase is the first real proof that the `widgetva-kit` abstraction is sufficient.

---

## Explicitly Out of Scope for This Document

The following work is intentionally deferred:

- benchmark importer
- benchmark-to-widget normalization
- benchmark instance packaging
- benchmark capability auditing UI
- automated benchmark adapter generation

Those should only begin after the three phases above are stable.

---

## Milestones

## Milestone A: Multi-Provider Contract Exists in `widgetva-kit`

Success means:

- adapter interface is defined
- capability model is defined
- adapter registry exists

This milestone does not yet require the first-party app to display all providers.

## Milestone B: `apps/widgetva-system/` Consumes the Contract

Success means:

- the existing workspace in `apps/widgetva-system/` can host mixed providers
- rendering is dispatched by semantic descriptor plus provider
- the host remains the same VA app, not a separate demo

## Milestone C: Cross-Provider Interaction Works for One Widget Family

Success means:

- one widget family, starting with `scatter`, is operable in:
  - Vega-Lite
  - ECharts
  - D3
- human interactions and runtime trace semantics are shared across all three

Only after Milestone C should benchmark import begin.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Provider APIs differ too much for one adapter surface | High | Keep the contract semantic and capability-driven; allow optional methods |
| Host app keeps leaking renderer-specific assumptions | High | Move rendering and interaction bridge ownership into `widgetva-kit` first |
| Widget descriptor migration breaks existing cases | Medium | Use a normalization bridge from old `widget.type` fields into canonical descriptor fields |
| D3 adapters become too bespoke | Medium | Start with one widget family and define strict adapter obligations before expanding |
| Trace semantics diverge by provider | High | Route all human interactions through the same runtime event shape before provider-specific side effects |

---

## Immediate Next Steps

1. Define the formal `RendererAdapter` contract in `widgetva-kit`
2. Introduce canonical `widgetKind + provider` descriptor normalization
3. Refactor `apps/widgetva-system` workspace rendering to consume provider-based dispatch
4. Implement the first cross-provider validation slice with `scatter`

---

## Completion Condition for This Phase

This phase is complete when:

- `widgetva-kit` owns a real multi-provider rendering contract
- `apps/widgetva-system/` imports and consumes that contract
- the existing workspace in `apps/widgetva-system/` can show mixed-provider widgets
- one widget family can be rendered and interacted with across Vega-Lite, ECharts, and D3 inside the same host VA system

At that point, benchmark importer work can begin on top of a stable foundation.
