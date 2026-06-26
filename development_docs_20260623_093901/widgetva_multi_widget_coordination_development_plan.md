# WidgetVA Multi-Widget Coordination Development Plan

## Scope
This document is a development plan, not a design essay.

Only coordination work with already-accepted motivation is included here.
The purpose is to turn those motivated items into concrete design and implementation tasks.

This document focuses on:

- `widgetva-kit` coordination/runtime design
- `apps/widgetva-system` first-party validation path

This document does **not** focus on:

- benchmark UI
- agent scaffold implementation
- speculative coordination theory
- motivation writeups beyond what is needed to justify implementation order

## Current Baseline

Already in place:

- canonical shared selection model
  - `shared.selections.registry`
  - `shared.selections.views.primary`
  - `shared.selections.views.byWidget`
- canonical shared link model
  - `shared.links.definitions`
  - `shared.links.topology`
- real linked behavior in `apps/widgetva-system`
- real propagation summary read surface
- first-party runtime/workspace integration

That means this plan starts from:

- a working coordination substrate

not from:

- raw multi-view wiring

## What This Plan Will Implement

Only four motivated coordination themes are included:

1. explicit link effects
2. widget roles
3. stronger propagation provenance
4. propagation policy

Each theme below is written as:

- target design
- where it lives
- implementation tasks
- expected verification

## Theme 1: Explicit Link Effects

## Goal

Make every coordination link explicitly state how the target should respond.

The system should stop treating propagation as if "linked" were enough.

## Target Design

### 1. Extend `links.definitions`

Each canonical coordination link should explicitly include:

```txt
{
  ref,
  sourceWidgetId,
  targetWidgetId,
  primitive,
  trigger,
  effect,
  propagationPolicy,
  ...
}
```

For this phase, `effect` should be constrained to:

- `applyFilter`
- `applyHighlight`
- `focusTarget`

No broader effect vocabulary should be introduced yet.

### 2. Make effect visible in topology/provenance reads

Current topology/provenance reads should expose:

- source widget
- target widget
- effect type

This should be true for:

- workspace coordination reads
- propagation summary reads

### 3. Make linked behavior effect-aware

Current linked behavior should stop assuming a single response mode.

Expected behavior:

- links with `applyFilter` drive filtered rows / filtered widget state
- links with `applyHighlight` drive highlight-oriented target response
- links with `focusTarget` drive focus-oriented target response

## Implementation Tasks

### Task M1.1: Extend link schema

Files likely touched:

- [widgetva-kit/src/core/protocol/widgetLinks.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/core/protocol/widgetLinks.js:1)
- [widgetva-kit/src/workspace/widgetWorkspace.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/workspace/widgetWorkspace.js:1)

Work:

- tighten `effect` handling in canonical link shape
- ensure normalization always preserves intended effect type
- make effect explicit in workspace-owned link definitions

### Task M1.2: Update workspace composition defaults

Files likely touched:

- [apps/widgetva-system/src/runtime/workspaceComposition.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/workspaceComposition.js:1)

Work:

- replace generic/default link entries with effect-typed links
- stop relying on implied behavior

### Task M1.3: Make runtime linked behavior effect-aware

Files likely touched:

- [apps/widgetva-system/src/runtime/runtimeBridge.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/runtimeBridge.js:1)
- possibly `widgetva-kit` runtime link execution surfaces if downshifted later

Work:

- route linked propagation by link effect
- keep current filtering path for `applyFilter`
- add highlight/focus response path without breaking current filtering path

### Task M1.4: Expose effect in propagation summary

Files likely touched:

- [apps/widgetva-system/src/runtime/runtimeBridge.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/runtimeBridge.js:1)
- [apps/widgetva-system/src/analysis/InspectPanel.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/analysis/InspectPanel.jsx:1)
- [apps/widgetva-system/src/analysis/AgentPanel.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/analysis/AgentPanel.jsx:1)

Work:

- show effect type per activated target
- stop presenting propagation as source/target only

## Verification

- selecting in one widget should still propagate correctly
- propagation summary should name target effect explicitly
- filter/highlight/focus targets should be distinguishable in reads

## Theme 2: Widget Roles

## Goal

Give each widget a small, explicit analytical role so propagation structure is not purely edge-driven.

## Target Design

### 1. Add a minimal role vocabulary

Allowed roles for now:

- `overview`
- `detail`
- `context`
- `comparison`

This is intentionally small.

### 2. Roles live at composition/description layer

Roles should be attached to widget descriptions / workspace composition, not invented ad hoc in panels.

### 3. Roles influence interpretation before they influence execution

First use roles to improve:

- workspace descriptions
- coordination reads
- propagation explanation

Only after that should roles influence execution policy.

## Implementation Tasks

### Task M2.1: Add role to workspace composition

Files likely touched:

- [apps/widgetva-system/src/runtime/workspaceComposition.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/workspaceComposition.js:1)

Work:

- assign explicit roles to the six first-party widgets per preset
- make the role assignment deterministic and readable

### Task M2.2: Persist role in widget/workspace descriptions

Files likely touched:

- [widgetva-kit/src/workspace/widgetWorkspace.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/workspace/widgetWorkspace.js:1)
- any description-building path used by the app/runtime

Work:

- ensure widget role is available in normalized descriptions
- ensure it survives runtime bridge reads

### Task M2.3: Show role in coordination/inspection surfaces

Files likely touched:

- [apps/widgetva-system/src/analysis/InspectPanel.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/analysis/InspectPanel.jsx:1)
- [apps/widgetva-system/src/analysis/AgentPanel.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/analysis/AgentPanel.jsx:1)

Work:

- expose widget role in current coordination context
- make role visible in propagation explanation

## Verification

- every first-party widget has a stable role in runtime descriptions
- roles appear in coordination reads and inspection views
- link/provenance reads can reference role without recomputing it in the UI

## Theme 3: Stronger Propagation Provenance

## Goal

Turn current propagation summary into a stronger runtime provenance model.

## Target Design

Current summary should evolve toward:

```txt
{
  sourceSelectionRef,
  sourceWidgetId,
  sourceWidgetRole,
  activatedLinks: [...],
  affectedTargets: [
    {
      targetWidgetId,
      targetWidgetRole,
      effect,
      linkId,
    }
  ]
}
```

This is still a read model, not a second runtime state system.

## Implementation Tasks

### Task M3.1: Strengthen runtime propagation read shape

Files likely touched:

- [apps/widgetva-system/src/runtime/runtimeBridge.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/runtimeBridge.js:1)

Work:

- replace coarse propagation summary with structured provenance object
- include link ids, effect, source role, target role

### Task M3.2: Keep propagation provenance aligned with canonical shared state

Files likely touched:

- [widgetva-kit/src/workspace/widgetWorkspace.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/workspace/widgetWorkspace.js:1)
- runtime bridge reads

Work:

- provenance must derive from:
  - `shared.selections`
  - `shared.links`
  - widget descriptions/roles
- provenance must not invent a parallel coordination store

### Task M3.3: Surface provenance in first-party inspection

Files likely touched:

- [apps/widgetva-system/src/analysis/InspectPanel.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/analysis/InspectPanel.jsx:1)
- [apps/widgetva-system/src/analysis/AgentPanel.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/analysis/AgentPanel.jsx:1)

Work:

- show which link fired
- show why a target changed
- show which targets did not receive propagation

## Verification

- a selection-driven change should be explainable as:
  - source selection
  - activated links
  - target effects
- the read model should stay stable across repeated runs

## Theme 4: Propagation Policy

## Goal

Model propagation strength explicitly instead of assuming every link is equally automatic.

## Target Design

Initial policy vocabulary:

- `automatic`
- `highlightOnly`
- `focusOnly`

This is not a general policy engine.
It is a constrained differentiation layer.

## Implementation Tasks

### Task M4.1: Extend canonical link definitions with policy

Files likely touched:

- [widgetva-kit/src/core/protocol/widgetLinks.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/core/protocol/widgetLinks.js:1)
- [widgetva-kit/src/workspace/widgetWorkspace.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/workspace/widgetWorkspace.js:1)

Work:

- constrain policy vocabulary
- make policy explicit in normalized links

### Task M4.2: Make first-party propagation respect policy

Files likely touched:

- [apps/widgetva-system/src/runtime/runtimeBridge.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/runtimeBridge.js:1)

Work:

- `automatic` keeps current propagation behavior
- `highlightOnly` suppresses destructive filtering behavior
- `focusOnly` updates focus-oriented target state only

### Task M4.3: Show policy in coordination/provenance reads

Files likely touched:

- [apps/widgetva-system/src/analysis/InspectPanel.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/analysis/InspectPanel.jsx:1)
- [apps/widgetva-system/src/analysis/AgentPanel.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/analysis/AgentPanel.jsx:1)

Work:

- make policy visible in propagation inspection
- distinguish effect type from propagation policy

## Verification

- policy differences should create observable target-response differences
- policy should be visible in the same coordination read surface that explains propagation

## Development Order

Recommended order:

1. `M1` explicit link effects
2. `M2` widget roles
3. `M3` propagation provenance
4. `M4` propagation policy

Reason:

- `M1` fixes the shallowest current coordination gap
- `M2` gives analytical structure to links
- `M3` makes the coordination graph explainable
- `M4` adds nuanced response control after the previous three are stable

## What Not To Build Yet

Do not add these yet:

- multi-selection conflict algebra
- rich role hierarchies
- generalized coordination ontology
- cross-workspace propagation
- large policy taxonomies

Those may become useful later, but they are not part of the current motivated development path.

## Definition of Success

This plan is succeeding only if future changes make the system more:

- explicit
- predictable
- explainable
- verifiable

And only if each added coordination field or mechanism is:

- used by runtime behavior
- visible in read surfaces
- backed by tests or first-party validation behavior

If a change only increases conceptual completeness without improving those properties, it should not be added.
