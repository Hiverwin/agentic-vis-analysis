# WidgetVA Widget Agent-Operability Development Plan

## Scope
This document focuses only on `widget` development.

Out of scope for this document:
- agent-facing runtime contracts
- agent scaffold / planning / memory / prompting
- benchmark and evaluation implementation
- frontend shell concerns beyond what directly constrains widget design

The purpose here is narrower:

> make `widgetva-kit` widgets easier, safer, and more effective for VLMs to operate in visual analytics workflows.

## Why This Matters
If the paper claims that a widget-centric abstraction is more suitable for agentic VA interaction, the widget layer itself must support that claim.

The widget design should make the following more true:
- actions are intent-aligned rather than pixel-aligned
- intermediate state is queryable and verifiable
- the same mental model applies across chart types
- mistakes are recoverable through explicit state and observable effects
- multi-step interaction is easier to reason about than with ad hoc view controls

This means widget development is not just "add more tools".
It is about making the widget contract more:
- operable
- explainable
- verifiable
- portable

## Core Design Target
Each widget instance should be a self-contained, model-operable unit with:
- explicit state
- explicit action surface
- explicit perception surface
- a stable observation surface
- predictable state transitions

The widget layer should support VLM interaction in data space, not screen space.

## Design Principles

### 1. Intent Before Gesture
Widget operations should represent analytical intent.

Good:
- `bar.filterCategories`
- `line.zoomXRegion`
- `heatmap.highlightRegion`
- `scatter.identifyClusters`

Avoid treating low-level UI behavior as the primary contract:
- drag pixel delta
- click x/y coordinates
- provider-specific DOM events

Human interaction bindings can still exist in adapters, but widget public semantics should stay intent-level.

### 2. State Must Be Readable
After each action, a model should be able to read:
- what this widget is
- what it currently shows
- what local selection/focus/highlight state exists
- what actions/perceptions are available

This is why `readObservation()` now matters at widget level.
The widget should not require the model to reconstruct state by stitching together multiple unrelated APIs.

### 3. Perception Must Support Verification
Widget perception is not a convenience feature.
It is the verification half of the closed loop.

For a widget to be agent-operable, perception queries must support:
- inspecting view configuration
- inspecting visible rows
- summarizing current selection
- summarizing visible subset
- computing derived evidence where appropriate

### 4. Cross-Widget Logic Must Not Leak Into Single-Widget Semantics
Single-widget contracts should stay clean.

A widget can expose:
- local state
- local actions
- local perception
- local observation

But coordination semantics should remain in `workspace`.
Widget design can include coordination hints, but should not directly own multi-widget orchestration.

### 5. Chart-Type Differences Should Not Break the Mental Model
Different widgets can have different tools, but they should still feel like instances of the same design language.

Examples:
- all widgets should support a stable `describe()`
- all widgets should support action/perception enumeration
- all widgets should support state reads
- all widgets should expose a stable observation surface

The model should not have to relearn the entire interface per chart type.

## What Already Exists
Current strengths already in place:
- `WidgetInstance` stable public contract
- normalized constructor shape across six widget families
- widget-owned action/perception contracts under `widgets/`
- many migrated widget-specific semantic actions
- `readState()`
- `listActionNames()`
- `listPerceptionNames()`
- `listActionDescriptors()`
- `listPerceptionDescriptors()`
- `readObservation()`

This is enough to say the widget layer is no longer runtime-first.
But it is not yet enough to say the widget design is fully optimized for agentic VA.

## Remaining Widget-Centric Gaps

### Gap 1. Observation Contract Needs to Become First-Class
`WidgetInstance.readObservation()` now exists, but it should be treated as a first-class widget contract, not just a helper.

It should stabilize:
- identity
- title/kind/role
- current state
- action surface
- perception surface
- local coordination hints

This observation surface should become the preferred widget read model for VLM-facing interaction.

### Gap 2. Action Surface Needs Better Primitive Coherence
Many widget-specific actions exist, but the library still needs a clearer primitive map.

The action surface should be explainable in terms of reusable interaction primitives:
- filter
- sort
- drill-down
- aggregate
- re-encode
- zoom
- brush/select
- highlight/focus
- annotate/overlay
- navigate/add/remove

Widget-specific tools can remain specialized, but they should be legible as instances of a smaller primitive family.

### Gap 3. Perception Surface Needs Better Primitive Coherence
Perception queries should be auditable as belonging to a small family:
- inspect
- summarize
- compute
- verify

Today the library already contains many useful perception tools, but the design still needs stronger primitive-level explanation and consistency.

### Gap 4. Local Selection Semantics Need Sharper Widget-Level Shape
The current system has strong `workspaceShared` selection modeling, but widget-local selection semantics still need clearer documentation and contract expectations.

At widget level, we should be able to answer:
- what counts as a local selection
- how local selection appears in state
- how local selection appears in observation
- how local selection is summarized for perception

### Gap 5. Widget-Level Verification Helpers Are Still Underspecified
A VLM should be able to ask:
- did the action actually change the view as intended?
- what subset is now active?
- what encoding/transform changed?

Some of this exists through perception APIs, but widget development should explicitly treat verification as a contract requirement.

## Development Priorities

### Priority 1. Stabilize Widget Observation
Goal:
make `readObservation()` the canonical widget-facing read surface for models.

Required outcomes:
- stable return shape
- code/test documentation of semantics
- explicit statement of what belongs in widget observation
- no unnecessary runtime leakage

### Priority 2. Formalize Action Primitive Mapping
Goal:
show that widget actions are not an arbitrary toolbox.

Required outcomes:
- document primitive families
- map existing widget actions to those families
- identify obvious gaps and redundancies
- prefer consistent naming when adding future actions

### Priority 3. Formalize Perception Primitive Mapping
Goal:
show that perception supports closed-loop verification rather than ad hoc querying.

Required outcomes:
- explicit inspect/summarize/compute/verify mapping
- identify missing verification-oriented reads
- reduce ambiguity around which perception query should be used for what

### Priority 4. Strengthen Widget-Local Selection Semantics
Goal:
make local widget interaction state easier to reason about.

Required outcomes:
- explicit guidance for local selection shape
- explicit observation/perception exposure rules
- consistency across scatter, bar, line, heatmap, parallel coordinates, sankey

### Priority 5. Add Widget-Level Verification Patterns
Goal:
make action outcomes easier to check after each step.

Required outcomes:
- clear verification queries or observation fields for common effect types
- better support for:
  - filter applied?
  - selection active?
  - zoom domain changed?
  - encoding changed?

## Concrete Next Tasks

### Task W1. Freeze `readObservation()` as a documented widget contract
Status:
- completed

Acceptance criteria:
- `WidgetInstance.describeContract()` documents `readObservation`
- tests cover observation shape and coordination hints
- observation is treated as stable public surface

### Task W2. Write a primitive map for all current widget actions
Status:
- completed

Acceptance criteria:
- every current widget action is mapped to one primitive family
- obvious inconsistencies are listed
- future additions can be judged against the primitive map

### Task W3. Write a primitive map for all current widget perception queries
Status:
- completed

Acceptance criteria:
- every perception query is mapped to inspect/summarize/compute/verify
- missing verification helpers are identified

### Task W4. Define local-selection contract expectations for six widget families
Status:
- completed

Acceptance criteria:
- local selection semantics are documented per family
- observation/perception expectations are explicit
- chart-specific differences do not break the common mental model

### Task W5. Add or normalize verification-oriented widget reads where needed
Status:
- completed

Acceptance criteria:
- common action outcomes can be checked without ad hoc logic
- verification-oriented reads are explicit and reusable

## Non-Goals
This document does not attempt to:
- define the final agent runtime scaffold
- decide prompt design
- define planner memory
- compare agent frameworks
- specify benchmark implementation details

Those depend on the widget layer, but are downstream of it.

## Success Criteria
Widget development is in good shape for the paper when all of the following are true:
- a VLM can inspect a widget through a stable observation surface
- a VLM can discover and understand widget actions through a coherent primitive model
- a VLM can query widget perception through a coherent primitive model
- action outcomes can be verified through state/observation/perception without relying on screenshots alone
- widget contracts are consistent enough across chart types that the same agent logic can generalize

## Recommended Order
1. Freeze `readObservation()` as a stable documented contract
2. Document action primitive mapping
3. Document perception primitive mapping
4. Define local selection expectations per widget family
5. Fill verification-oriented gaps

This order keeps the work focused on the widget layer itself and avoids drifting too early into agent runtime design.
