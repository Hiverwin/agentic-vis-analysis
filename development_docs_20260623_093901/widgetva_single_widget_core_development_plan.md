# WidgetVA Single-Widget Core Development Plan

Date: 2026-06-23

## Purpose

This document defines the next development stage for the paper-facing `widget abstraction` work:

> finish the `single-widget` capability core first, before expanding renderer adapters, the paper agent loop, or multi-widget coordination.

The goal is not to build a minimal demo.
The goal is to make the single-widget abstraction stable enough that:

- common interaction primitives are clearly defined
- widget-local state changes are canonical and reproducible
- action, perception, and verification form a closed loop
- later adapter work has a fixed target to implement against

## Why This Stage Exists

The later work depends on single-widget capability stability:

- renderer adapters need a fixed action and state contract
- the paper agent loop needs reliable `observe -> act -> verify`
- multi-widget coordination needs stable source-side and target-side widget semantics

If single-widget semantics are still fluid, later work becomes harder to validate and easier to overfit to demos.

## Scope

This document covers only the `single-widget core`.

In scope:

- interaction primitive definition
- widget-local state model stabilization
- widget capability boundary definition
- single-widget action / perception / verification closure
- single-widget conformance tests

Out of scope:

- Vega / D3 / ECharts adapter implementation details
- multi-widget propagation / links / shared coordination
- gallery demos
- planner / memory / reasoning architecture beyond what single-widget contracts require
- benchmark execution and evaluation

## Existing Foundations To Preserve

The repository already contains a meaningful amount of correct and reusable single-widget work.
This plan should not rewrite or destabilize those parts unless a concrete contract bug is discovered.

### 1. Widget-first public surface already exists

Already in place:

- `WidgetInstance` public contract
- six first-class widget constructors
- widget-facing action/perception enumeration and execution
- workspace separated from widget-local semantics

Primary references:

- [widgetva_kit_widget_first_plan.md](/Users/chenyutong/Desktop/agentic-visual-reframe/development_docs_20260623_093901/widgetva_kit_widget_first_plan.md:1)
- [widgetva_widget_agent_operability_plan.md](/Users/chenyutong/Desktop/agentic-visual-reframe/development_docs_20260623_093901/widgetva_widget_agent_operability_plan.md:1)

### 2. Widget-owned semantic actions/perceptions already exist

Already in place:

- widget contracts live under `widgetva-kit/src/widgets/**`
- many formerly Python-only tools have already been ported into widget-owned action/perception contracts
- single-widget operability is no longer runtime-first

This is a strength and should be reused rather than replaced.

### 3. A primitive-family map already exists

Already in place:

- [widgetva-kit/src/widgets/actionPrimitiveMap.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/widgets/actionPrimitiveMap.js:1)

This file already defines reusable action primitive families:

- `filter`
- `sort`
- `drillDown`
- `aggregate`
- `reencode`
- `zoom`
- `select`
- `highlight`
- `focus`
- `annotate`
- `navigate`
- `addRemove`

This should be treated as the current baseline, not discarded.

### 4. Semantic capability surface already exists

Already in place:

- [widgetva-kit/src/capabilities/semanticCapabilities.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/capabilities/semanticCapabilities.js:1)

Relevant examples already exposed:

- `selection.region.set`
- `selection.point.set`
- `data.filter.categorical`
- `data.filter.range`
- `view.domain.zoom`
- `view.sort.encoding`

This means part of the single-widget capability vocabulary is already externally visible.

### 5. Transport/runtime scaffolding already exists

Already in place:

- widget/workspace transport methods
- widget/workspace observation and execution paths
- runtime and workspace state reads

This stage should not redesign transport.
It should make the single-widget capability contract strong enough for transport and agent use later.

## The Core Problem To Solve Now

Right now the codebase already has many widget actions, but the `single-widget core` is not yet finished in the sense needed for the paper.

The missing part is not “more actions.”
The missing part is:

> a stable, motivation-backed, capability-oriented single-widget contract that explains what the common interaction primitives are, how widgets instantiate them, how they change canonical widget state, and how they are verified.

## Locked Design Decisions

These decisions should guide this stage unless a strong counterexample appears.

### 1. Primitive-first, not action-name-first

We should not keep growing the system by adding isolated widget-specific action names without first locating them in a common primitive vocabulary.

The development order should be:

1. define primitive
2. define widget support boundary
3. define canonical state effect
4. define verification path
5. then implement or normalize widget-specific actions

### 2. Single-widget semantics must stay renderer-agnostic

At this stage we define:

- what the action means
- what state it changes
- how to verify it

We do **not** yet define provider-specific implementation details as part of the single-widget core.

### 3. Verification is part of the contract

An interaction is not complete if it can be executed but not reliably checked.

Each supported primitive must define:

- what changed in canonical state
- what perception reads should confirm it
- what minimal verification evidence counts as success

### 4. Multi-widget semantics stay out of scope

Single-widget work can define local selection, view, encoding, ordering, and verification semantics.

It should not absorb:

- link propagation
- shared coordination state
- target-effect policies
- cross-widget planning

Those belong to later stages.

## Single-Widget Primitive Baseline

This stage should stabilize a first usable primitive baseline.

The baseline should preserve the existing primitive families in [actionPrimitiveMap.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/widgets/actionPrimitiveMap.js:1), but sharpen them into a more explicit single-widget contract.

### Priority A: Selection primitives

Motivation:

- almost every later capability and coordination path depends on stable local selection semantics

Baseline primitives:

- `selectPoint`
- `selectCategory`
- `brushRegion`
- `selectRange`
- `clearSelection`

### Priority B: Filter primitives

Motivation:

- filter must be distinct from transient selection
- many tasks and adapters will rely on filter as a canonical state mutation

Baseline primitives:

- `filterByValues`
- `filterByRange`
- `clearFilter`

### Priority C: View / viewport primitives

Motivation:

- `zoom / pan / viewport` are central paper-facing examples
- later cross-renderer work depends on these being defined cleanly

Baseline primitives:

- `zoomDomain`
- `panDomain`
- `resetView`

### Priority D: Ordering primitives

Motivation:

- `rank / sort / reorder` are common across multiple widget kinds
- these are also strong paper-facing examples of intent-level structured interaction

Baseline primitives:

- `sortByField`
- `sortByAggregate`
- `reorderAxis`
- `reorderLayer`

### Priority E: Transformation primitives

Motivation:

- these change the analytical state of a widget, not just its transient focus
- later advanced interactions should be rooted here instead of growing ad hoc

Baseline primitives:

- `reencode`
- `drillDown`
- `aggregateView`

### Priority F: Attention / emphasis primitives

Motivation:

- highlight and focus are useful in single-widget analysis and later matter in coordination

Baseline primitives:

- `highlightValues`
- `focusTarget`
- `clearHighlight`

## Required Definition For Every Primitive

Before a primitive is considered “defined,” the project should be able to point to a spec entry containing all of the following:

1. `motivation`
2. `semantic intent`
3. `parameter schema`
4. `canonical widget-state effect`
5. `supported widget kinds`
6. `preferred perception / verification readback`

If any of these are missing, the primitive is not yet stable enough to anchor adapter work.

## Development Phases

## Phase 1: Freeze the single-widget primitive registry

Goal:

- convert the current primitive-family intuition into an explicit single-widget primitive registry

What to do:

- preserve the current family map in `actionPrimitiveMap.js`
- define the canonical primitive entries in a dedicated development/spec doc
- normalize naming where existing action names map ambiguously to different primitive meanings
- identify which existing widget actions already correctly instantiate a primitive
- identify which actions are still too renderer-specific, too ad hoc, or semantically overlapping

Expected output:

- `single_widget_primitive_spec.md`

Acceptance criteria:

- every baseline primitive has a written motivation
- every baseline primitive has a semantic intent and parameter shape
- no obviously duplicated primitive meanings remain in the baseline set

## Phase 2: Freeze the canonical widget-local state model

Goal:

- define exactly which widget-local state layers the primitives are allowed to mutate

Minimum state layers to stabilize:

- chart type
- data transform
- visual mapping
- view transform
- interactive selection
- widget-local feedback / verification state

What to do:

- audit existing widget state reads and writes
- align supported primitives with the state layers they actually mutate
- document which state effects are canonical and which are renderer/provider-local

Expected output:

- `single_widget_state_model_spec.md`

Acceptance criteria:

- each baseline primitive can point to a canonical state effect
- state effects are described renderer-agnostically
- widget-local state boundaries are explicit enough for adapter work to target later

## Phase 3: Build the widget capability matrix

Goal:

- define exactly which widgets support which baseline primitives now

Widgets:

- `bar`
- `line`
- `scatter`
- `heatmap`
- `parallelCoordinates`
- `sankey`

What to do:

- map all six widget kinds against the baseline primitive set
- mark each cell as:
  - `implemented and stable`
  - `implemented but needs contract cleanup`
  - `not yet implemented`
  - `out of scope / unsupported by design`
- add a short motivation for unsupported or deferred cells

Expected output:

- `single_widget_capability_matrix.md`

Acceptance criteria:

- every baseline primitive has an explicit widget support matrix
- unsupported cases are explicit rather than accidental
- future adapter work can read this matrix as its implementation target

## Phase 4: Harden single-widget action / perception / verification closure

Goal:

- make the first-priority primitives fully closed-loop at single-widget level

Priority primitives for closure:

- selection
- filter
- zoom / pan / reset view
- sort / reorder

For each supported primitive, ensure:

- there is a canonical action entry
- there is a canonical state change
- there is at least one stable perception readback
- there is a verification path that can confirm success

Important rule:

- if an existing widget action already behaves correctly, keep it and document it
- do not rewrite working actions merely to rename them unless the contract is truly wrong

Acceptance criteria:

- first-priority primitives have act/read/verify closure
- closure is test-backed
- verification is explicit rather than inferred from manual visual inspection only

## Phase 5: Add single-widget conformance tests

Goal:

- define when a widget is “single-widget contract compliant”

Test classes:

- schema/descriptor tests
- action-to-state transition tests
- perception readback tests
- verification tests
- widget support matrix conformance tests

Acceptance criteria:

- each first-priority primitive has at least one conformance-style test
- tests prove contract behavior rather than only first-party UI behavior

## Phase 6: Add agent-in-the-loop validation cases

Goal:

- validate that the single-widget contract is not only internally coherent, but also usable by the paper agent loop

Why this phase is needed:

- some design mistakes only appear when a real agent tries to use the contract
- an action can be executable but still be awkward for planning
- an observation can be complete in theory but still insufficient for next-step action selection
- a verification read can exist but still be too weak for closed-loop reasoning

This phase is **not** about building polished demos.
It is a development-time validation layer to catch contract problems early.

Validation principle:

> each first-priority primitive family should be exercised by at least one small agent case before the project treats the single-widget core as stable.

Development policy for this project:

> do not batch-implement many primitives first and validate later.
> implement one primitive (or one tightly coupled primitive pair such as `zoomDomain` + `resetView`), run agent-in-the-loop validation immediately, and only then move to the next primitive.

Recommended validation granularity:

- one widget
- one query
- one or two actions
- one verification cycle

The purpose is not long-horizon evaluation.
The purpose is to confirm:

- the observation gives the agent enough context
- the action is easy to choose and parameterize
- the runtime executes it correctly
- the resulting state/perception is strong enough to verify the intended effect

### Validation layers

Each primitive family should be checked at three levels:

1. `contract-level validation`
   - is the primitive definition itself clear and well-bounded?
2. `runtime-level validation`
   - does `act -> state -> verify` work deterministically?
3. `agent-in-the-loop validation`
   - can the actual loop use the primitive successfully?

### Required first-pass agent validation families

Before starting the dedicated adapter stage, provide at least one agent validation case for:

- `selection`
- `filter`
- `zoom / pan / reset view`
- `sort / reorder`

### Required per-primitive development rhythm

For each first-priority primitive, the development rhythm should be:

1. define or confirm the primitive contract
2. implement or normalize the widget-side action
3. confirm canonical state effect
4. confirm perception / verification path
5. run a small real agent case
6. if the agent case exposes contract problems, revise the primitive before starting the next one

This is a hard gate, not a nice-to-have.

The purpose is to prevent a late discovery that:

- parameter schemas are unnatural for planning
- observations are insufficient for action choice
- verification is too weak for closed-loop use
- multiple primitives were built on the wrong abstraction boundary

### Stop-the-line rule

If an agent validation case fails for a reason that appears to be contract-related, pause further primitive expansion.

Do not continue by saying “the rest are probably similar.”

Instead:

1. diagnose whether the failure came from:
   - primitive semantics
   - observation packing
   - action schema
   - verification weakness
   - runtime bug
2. fix the contract or implementation
3. rerun the same validation
4. only continue after the primitive passes

This rule exists because this project is trying to validate an agent-operable abstraction, not just accumulate action implementations.

Suggested case style:

- `selection`
  - “Select the Japan category / select this brushed region.”
- `filter`
  - “Filter to a named subset.”
- `zoom / pan`
  - “Zoom into a requested data-space domain.”
- `sort / reorder`
  - “Reorder the current view so the most relevant items appear first.”

### Acceptance criteria

- each first-priority primitive has passed at least one small agent validation case before the next primitive begins
- the case records:
  - input observation
  - chosen action
  - action result
  - verification result
  - whether the contract had to be revised
- failures are treated as contract feedback, not just model errors

### Important boundary

These validations should use the real paper-facing agent loop where practical, but they do **not** require:

- a polished gallery demo
- a full multi-widget setting
- a large benchmark run
- a finalized planner

They are intended to keep single-widget contract development grounded in actual agent use.

## What Counts As Already Correct And Should Not Be Rewritten

The following should be treated as current assets to build on:

- widget-first public contract
- six first-class widget constructors
- widget-owned action/perception organization under `widgets/`
- existing primitive-family map in `actionPrimitiveMap.js`
- existing semantic capability registry entries
- already migrated widget-owned actions that already follow intent-level semantics
- existing observation / descriptor / perception enumeration surfaces

This stage should mostly:

- normalize
- document
- audit
- close verification gaps

It should not reset the widget layer from scratch.

## What Still Should Be Considered Incomplete

Single-widget is **not** finished if any of the following is still true:

- common primitives exist only as loose action-name conventions
- primitive boundaries are unclear
- two widgets use the same primitive label for materially different semantics
- actions can execute but canonical state effects are unclear
- state changes occur but there is no stable verification readback
- support boundaries differ per widget but are undocumented
- tests only prove first-party rendering behavior instead of widget contract behavior

## Adapter-Readiness Gate

The project can start the dedicated adapter stage when all of the following are true:

1. the baseline primitive registry is frozen
2. the canonical widget-local state model is frozen
3. the six-widget capability matrix is complete
4. the first-priority primitives are closed-loop at single-widget level
5. conformance tests exist for those first-priority primitives
6. each first-priority primitive has passed its own small agent-in-the-loop validation case in development order

In short:

> adapter work should start only after we know exactly what is being adapted.

## Recommended Implementation Order

1. primitive registry
2. state model
3. capability matrix
4. selection closure
5. filter closure
6. zoom / pan / reset view closure
7. sort / reorder closure
8. conformance tests
9. agent-in-the-loop validation after each primitive or tightly coupled primitive pair
10. adapter stage

## Practical Guidance For The Next Session

The next concrete work should be:

1. write `single_widget_primitive_spec.md`
2. reuse [actionPrimitiveMap.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/widgets/actionPrimitiveMap.js:1) as the starting inventory instead of rebuilding a new primitive list from memory
3. audit current widget actions into:
   - already contract-sound
   - needs normalization
   - should be deferred
4. define the completion gate for `zoom / pan / viewport` and `sort / reorder` first, because these are both analytically important and near-term paper-facing

## Summary

This stage is complete when `single-widget` is no longer “a lot of widget actions that mostly work,” but instead:

- a stable primitive-backed interaction core
- with explicit widget-local state effects
- explicit widget support boundaries
- explicit verification paths
- validated by small real agent-use cases
- and enough conformance evidence to make adapter work a clean next phase
