# WidgetVA Multi-Widget Coordination Model Spec

## Purpose
This document defines the intended library-level coordination model for multi-widget visual analysis in `widgetva-kit`.

It is not a UI document and not an evaluation plan.
Its purpose is to make the model:

- formally describable
- implementable as a library
- hard to misuse
- extensible without ad hoc app-specific rules

This document focuses on:

- state ownership
- coordination objects
- propagation semantics
- effect semantics
- layer boundaries
- the minimum complex cases that the model must cover

This document does **not** attempt to cover every conceivable multi-view behavior.
It defines a rigorous core model for the coordination patterns most central to agentic visual analysis.

## Core Model Only

This document intentionally keeps only the coordination concepts that currently have clear implementation value.

The core coordination objects are:

- `selection`
- `globalFilters`
- `highlight`
- `focus`
- `link`

Everything else should be treated as secondary unless it is required to make those five objects work.

## Design Goals

The model should satisfy six requirements:

1. `Library-first`
The core coordination semantics should live in `widgetva-kit`, not in first-party UI glue.

2. `Ownership-first`
Every coordination object should have a clear owner.

3. `Selection-driven`
Cross-widget coordination should primarily be driven by explicit selection objects, not hidden derived UI flags.

4. `Effect-explicit`
A link should say not only *where* propagation goes, but *how* the target responds.

5. `Explainable`
Any cross-widget change should be explainable as:
source state -> activated links -> target effects.

6. `Constrained complexity`
The model should cover the most important multi-widget cases without turning into a general-purpose visual ontology.

## Scope of the Model

This model is intended to cover:

- selection-driven linking
- cross-widget filtering
- cross-widget highlighting
- cross-widget focusing
- global filter coordination
- workspace-level focus state
- propagation provenance
- verification-oriented readback

This model is **not** intended, at this stage, to fully cover:

- arbitrary multi-selection algebra
- nested workspaces
- collaborative multi-user concurrency
- probabilistic coordination policies
- fully declarative visual program synthesis

## Hard Coordination Invariants

This section exists to remove ambiguity during implementation.
If code behavior conflicts with these invariants, the code is wrong.

### Invariant 1: Single coordination owner

`workspaceShared` is the only canonical owner of shared coordination state.

That means:

- widgets may emit local interaction state
- runtime may derive read models and propagation summaries
- app UI may render coordination state
- but only workspace-owned shared state defines canonical coordination truth

No app-local mirror should introduce new coordination semantics.

### Invariant 2: One primary propagation driver

At most one `selections.views.primary` entry may exist at a time.

That means:

- multiple registry entries may coexist
- only one entry drives default link propagation
- if no primary exists, default selection-driven propagation does not run

### Invariant 3: Registry is source of truth for selection

`selections.registry` is canonical.
`selections.views.primary` and `selections.views.byWidget` are derived coordination views.

That means:

- code must not mutate primary/byWidget as independent semantic stores
- clearing a registry entry must invalidate any derived primary/byWidget view that depends on it

### Invariant 4: Selection and global filter are different states

`selection` and `globalFilters` may share predicates, but they are not interchangeable.

That means:

- clearing selection does not imply clearing global filters
- setting global filters does not imply creating a primary selection
- promotion from selection to global filter must be explicit

### Invariant 5: Link structure and link execution are different layers

`links.definitions` declare what may happen.
Propagation results declare what did happen.

That means:

- canonical link definitions must stay stable and reusable
- runtime propagation summaries must never become a second link-definition store

### Invariant 6: Declared effect and applied effect may differ

A link may declare one effect and apply a weaker one because of constraint or capability.

That means:

- provenance should preserve declared intent
- provenance should also preserve actual applied effect
- non-application or downgraded application must be explainable

### Invariant 7: Highlight and focus are not hidden filter aliases

`applyHighlight` and `focusTarget` must remain observably distinct from `applyFilter`.

That means:

- highlight should preserve broader context visibility
- focus should preserve local object-centric state
- code must not silently turn every response into filtering

## Canonical State Transitions

This section defines the minimum coordination writes the library must support.
The goal is to make development concrete and keep semantics stable.

### Transition 1: Promote local interaction to shared selection

Input:

- source widget interaction output
- shareable predicates
- selection metadata

Required effects:

- create/update a registry entry
- optionally update `views.byWidget`
- optionally set `views.primary`

Must not:

- implicitly create `globalFilters`

### Transition 2: Resolve primary selection

Input:

- selection registry
- workspace policy choosing which entry becomes primary

Required effects:

- set `selections.views.primary` to one registry-backed entry or `null`

Must not:

- invent a primary selection that is not backed by registry state

### Transition 3: Clear selection state

Input:

- optional `selectionRef`
- optional `sourceWidgetId`
- optional clear-all intent

Required effects:

- remove or invalidate affected registry entries
- recompute `views.primary`
- recompute `views.byWidget`

Must not:

- clear `globalFilters` unless explicitly requested

### Transition 4: Promote selection to global filter

Input:

- a registry-backed selection or equivalent predicate set

Required effects:

- update `globalFilters`
- retain provenance through `sourceSelectionRef`

May:

- clear the primary selection afterward if the workspace chooses that UX

Must not:

- erase provenance of where the filter came from

### Transition 5: Clear global filters

Input:

- clear-all or scoped filter-clear intent

Required effects:

- reset `globalFilters`
- recompute affected widget materialization

Must not:

- implicitly recreate selection state

### Transition 6: Apply selection-driven propagation

Input:

- current primary selection
- canonical link definitions
- widget capability knowledge

Required effects:

- compute activated links
- compute skipped targets with reasons
- compute target-side applied effects
- update shared highlight/focus state when those are coordination-owned
- expose provenance as runtime result

Must not:

- mutate canonical link definitions
- bypass effect constraints

### Transition 7: Apply filter-driven materialization

Input:

- current `globalFilters`
- current widget/runtime descriptors

Required effects:

- derive widget-visible constrained state
- preserve distinction between persistent slice and transient selection-driven emphasis

Must not:

- pretend filter-driven updates came from primary-selection propagation

## Top-Level Ownership Model

The stable top-level model remains:

```txt
{
  widgetLocal,
  workspaceShared,
  runtimeMeta
}
```

### `widgetLocal`
Owned by a single widget instance.

Contains:

- widget spec/runtime view state
- widget-local selections
- widget-local derived state
- provider-specific state
- temporary structural state needed only by that widget

### `workspaceShared`
Owned by `WidgetWorkspace`.

Contains the canonical coordination state shared across widgets.

### `runtimeMeta`
Owned by runtime infrastructure.

Contains:

- history
- snapshots
- branching
- trace
- response recording
- ephemeral runtime coordination results

## Coordination State Model

The canonical workspace-owned coordination shape is:

```txt
workspaceShared = {
  focusedWidget,
  selections,
  globalFilters,
  highlight,
  annotations,
  links
}
```

### `focusedWidget`
The currently focused widget ref.

Purpose:

- default target resolution
- attention handoff
- focus-aware reasoning

`focusedWidget` is a workspace attention pointer.
It is not equivalent to `focusTarget` link response state inside a widget.

The model distinguishes:

- workspace attention: which widget is currently foregrounded
- widget-local focus response: which object/substructure a widget is currently focused on

### `selections`

```txt
selections = {
  registry,
  views: {
    primary,
    byWidget
  }
}
```

#### `selections.registry`
The canonical shared selection registry.

This is the only authoritative coordination-level selection store.

Each entry should be keyed by `selectionRef`.

Canonical fields for a registry entry:

```txt
{
  selectionRef,
  selectionId,
  sourceWidgetRef,
  sourceWidgetId,
  selectionKind,
  scope,
  summary,
  predicates,
  selectionDataRef,
  metadata
}
```

Required semantic meaning:

- `sourceWidgetRef/sourceWidgetId`
  identifies the widget that originated the shared selection
- `selectionKind`
  classifies the selection form, such as `brush`, `point`, `category`, `cell`, `flow-node`
- `predicates`
  provide the canonical selection logic that targets may interpret
- `scope`
  distinguishes whether the selection is local, mirrored, or coordination-promoted

Additional requirements:

- `selectionRef` must be stable enough to support provenance and readback
- `selectionId` may be UI-facing or transport-facing, but `selectionRef` is the canonical coordination key
- `predicates` must be sufficient for target mapping and verification
- `summary` is explanatory only; it must not be treated as executable selection logic

#### `selections.views.primary`
The current primary shared selection.

This is a convenience view, not a second source of truth.

It exists to answer:

- what is the main selection right now?
- what should default verification or evidence lookup start from?

There should be at most one primary selection at a time.

#### `selections.views.byWidget`
A compact per-widget selection summary.

This is a convenience grouped view for:

- UI summaries
- agent quick reads
- host integration

It is derived from the registry and should not define new coordination meaning.

### `globalFilters`
Shared filters whose semantics apply across widgets.

These differ from selection in one critical way:

- `selection` represents an analysis act or focus
- `globalFilters` represent persistent workspace slicing constraints

Selections may be promoted into global filters.
They are not the same object.

Canonical filter shape should remain simple:

```txt
globalFilters = {
  predicates,
  summary,
  sourceSelectionRef,
  metadata
}
```

`globalFilters` should answer:

- what persistent shared slicing constraints currently apply?
- did they originate from direct filter UI, or from promoted selection state?

### `globalFilters` Semantics

`globalFilters` are durable workspace constraints.
They are not transient interaction focus.

This means:

- they may outlive the selection that created them
- they should participate in view derivation even when no primary selection is active
- they should not be silently collapsed back into selection

Additional rule:

- `globalFilters.predicates` must be interpretable without consulting transient widget-local interaction state

### `highlight`
Shared cross-widget highlight intent.

Highlight must be modeled separately from selection and filter because it preserves context.

Expected semantics:

- selected subset is emphasized
- non-matching context remains visible
- target does not necessarily reduce its data domain

Canonical highlight shape should remain simple:

```txt
highlight = {
  sourceWidgetRef,
  sourceWidgetId,
  summary,
  predicates,
  highlightedKeys,
  metadata
}
```

The purpose of the highlight object is to preserve a workspace-level highlight cue without forcing the system to treat it as either:

- a durable filter
- a primary selection

Highlight should remain optional shared state.
If a particular propagation produces only widget-local highlight feedback and no shared highlight object is needed, runtime may keep that local.
But when the workspace needs a cross-widget highlight cue, the shared highlight object is the canonical place for it.

### `annotations`
Workspace-level notes/evidence markers.

### `links`

```txt
links = {
  definitions,
  topology
}
```

#### `links.definitions`
The canonical coordination graph.

Each link definition must be explicit enough to explain both structure and response semantics.

Canonical link shape:

```txt
{
  ref,
  linkId,
  sourceWidgetRef,
  sourceWidgetId,
  targetWidgetRef,
  targetWidgetId,
  primitive,
  effect,
  activationPolicy,
  effectConstraint,
  fieldMapping,
  metadata
}
```

Required field meanings:

- `primitive`
  the abstract coordination family, such as `filter`, `highlight`, `sharesSelection`, `syncDomain`
- `effect`
  the target-side response kind
- `activationPolicy`
  whether the link is allowed to auto-apply during default propagation
- `effectConstraint`
  whether the target-side response must be weaker or narrower than the declared effect
- `fieldMapping`
  how a source selection should map onto target-side fields

Additional requirements:

- `sourceWidgetId` and `targetWidgetId` must resolve to registered workspace widgets
- `fieldMapping` must be declarative enough for runtime to explain mapping success/failure
- `metadata` may store app-specific labels, but must not replace core semantic fields

### `primitive` vs `effect`

These two fields must not be conflated.

`primitive` answers:

- what coordination family does this link belong to?

`effect` answers:

- if this link applies, what target-side response kind should occur?

Examples:

- a link may use primitive `sharesSelection` but effect `applyHighlight`
- a link may use primitive `filter` and effect `applyFilter`
- a link may use primitive `highlight` and still be constrained by `effectConstraint`

The rule is:

- `primitive` classifies the link family
- `effect` classifies the target response

Implementation rule:

- runtime may derive `appliedEffect` from `effect` plus `effectConstraint` plus target capability
- runtime must not rewrite canonical declared `effect` inside `links.definitions`

#### `links.topology`
The derived readable graph summary.

This is a read model only.
It should support:

- inbound/outbound neighbor lookup
- grouping by source/target
- graph summaries for reasoning

It must derive from canonical definitions and widget descriptions.
It must not become a second source of truth.

## Canonical Coordination Vocabulary

This section closes the core semantic vocabulary so implementation does not drift.
If a behavior needs a new vocabulary item, that should be an explicit spec decision rather than an ad hoc code addition.

### Canonical coordination object types

The mature core model currently recognizes only:

- `selection`
- `globalFilter`
- `highlight`
- `focus`
- `link`

Anything else should be treated as:

- widget-local state
- runtime readback
- app presentation state

It should not be added as a new coordination object unless it changes shared semantic meaning.

### Canonical selection kinds

The current shared selection vocabulary should remain intentionally small:

- `point`
- `brush`
- `category`
- `range`
- `cell`
- `flow-node`
- `path`

This field exists to support:

- explainability
- capability-aware interpretation
- stable verification logic

It must not become a dumping ground for UI-specific gesture names.

### Canonical link primitives

The current link-primitive vocabulary should remain intentionally small:

- `sharesSelection`
- `filter`
- `highlight`
- `focus`
- `syncDomain`

The semantic role of each primitive is:

- `sharesSelection`
  source selection may be interpreted by the target as a meaningful shared analytical selection
- `filter`
  source state is intended to narrow the target domain
- `highlight`
  source state is intended to emphasize target matches while preserving context
- `focus`
  source state is intended to move the target into a local focused state
- `syncDomain`
  source state is intended to synchronize domain/window state rather than analytical subset membership

If a candidate primitive can be expressed as one of these plus `effect`, `fieldMapping`, or `effectConstraint`, it should not be introduced as a new primitive.

### Canonical target effects

The current target-effect vocabulary is closed to:

- `applyFilter`
- `applyHighlight`
- `focusTarget`

Runtime may compute an `appliedEffect` that is weaker than the declared effect.
It must not invent a new effect label at runtime.

### Canonical skipped-target reasons

Skipped-target explanation should use a stable reason vocabulary.
The current minimum set is:

- `noApplicableLink`
- `manualLink`
- `sourceMismatch`
- `mappingUnavailable`
- `mappingFailed`
- `unsupportedEffect`
- `effectDowngradeUnavailable`
- `constraintBlocked`

This matters because skipped-target explanation is part of the model's claim to explainable coordination.
Free-form prose may be added for humans, but the machine-readable reason should stay canonical.

## Effect Model

The library should formally distinguish at least three target response classes:

- `applyFilter`
- `applyHighlight`
- `focusTarget`

### `applyFilter`
Target data domain is narrowed or subsetted.

Expected observable result:

- visible rows/count change
- grouped summaries change
- selected subset becomes the new active data slice

### `applyHighlight`
Target preserves context but visually emphasizes matching elements.

Expected observable result:

- highlight markers/keys change
- non-matching items remain visible
- data row count typically does not collapse to only matching rows

### `focusTarget`
Target moves into a focused local state around one object or a narrow set.

Expected observable result:

- focused item/key changes
- viewport or local structural state may change
- emphasis is stronger than highlight but does not necessarily imply full filter

## Capability Gating

Propagation must be capability-aware.
The runtime must distinguish between:

- link is structurally valid
- target supports the declared effect
- target supports a constrained weaker effect

The minimum runtime decision table is:

1. if target supports declared effect, apply it
2. else if constraint yields a weaker supported effect, apply the weaker effect
3. else mark target as skipped with explicit reason

This is required so coordination behavior is both explainable and portable across widget types.

## Activation and Effect-Constraint Model

The model should distinguish two different questions:

1. when is a link allowed to apply?
2. if it applies, how strong is the allowed target response?

These are different semantic layers and should not be merged.

### `activationPolicy`

The initial activation-policy vocabulary should remain constrained:

- `automatic`
- `manual`

#### `automatic`
Apply the declared link during default propagation when activation conditions are met.

#### `manual`
The link is structurally present but should not auto-apply during default propagation.
It may still appear in explanation surfaces or be invoked by explicit user/agent action later.

### `effectConstraint`

`effectConstraint` is optional.
If omitted, the link may apply its declared effect normally.

The initial effect-constraint vocabulary should remain constrained:

- `highlightOnly`
- `focusOnly`

#### `highlightOnly`
Even if the declared effect or primitive could support stronger target changes, the target response must be constrained to highlight semantics.

#### `focusOnly`
Even if the declared effect or primitive could support stronger target changes, the target response must be constrained to focus semantics.

### Why the split matters

`activationPolicy` answers:

- should this link auto-apply at all?

`effectConstraint` answers:

- if it applies, is the target allowed to fully realize the declared effect?

This prevents a common modeling confusion where:

- `automatic/manual`
  are activation-time permissions
- `highlightOnly/focusOnly`
  are target-response constraints

They should not live in the same semantic slot.

### Current implementation note

Some current implementation paths still use `propagationPolicy` as a compressed field carrying both activation and response-constraint meaning.

That is acceptable as a temporary implementation shortcut, but it is **not** the mature model.
The mature library-level model should separate:

- `activationPolicy`
- `effectConstraint`

## Core Propagation Semantics

The coordination model should explain a propagation as a four-stage process.

## Coordination Drivers and Precedence

Not every shared object should drive propagation in the same way.

The current mature-core model should distinguish:

1. `primary selection`
2. `global filters`

### Driver 1: Primary selection

The primary selection is the default cross-widget propagation driver.

It is used for:

- default link activation
- linked filtering/highlighting/focusing
- propagation provenance

### Driver 2: Global filters

Global filters are persistent shared constraints.

They should affect:

- workspace view derivation
- widget state/materialization
- filtering-sensitive target reads

They do **not** need to behave as if they were always a current primary selection.

### Modifiers: Focus and highlight

Focus and highlight are coordination modifiers, not full propagation drivers.

They may influence:

- target emphasis
- default attention
- inspection framing

### Precedence Rule

The current core model should be explicit about precedence:

1. `globalFilters`
  constrain the persistent workspace slice
2. `primary selection`
  drives default link activation within that slice
3. `highlight` and `focus`
  modify emphasis and attention inside the currently active slice

This is a constrained but clean precedence model.
It is preferable to leaving these relationships implicit.

### Stage 1: Source promotion
A widget-local interaction may promote a widget-local selection into a shared selection entry.

Promotion is allowed when:

- the interaction is semantically relevant beyond the widget itself
- the widget/action contract marks it as shareable
- the workspace chooses to coordinate from it

Not every widget-local state change should become shared selection.

### Stage 2: Primary selection resolution
The workspace resolves the current primary selection from the selection registry.

For now, the model assumes a single primary selection drives default propagation.
This keeps propagation deterministic.

### Stage 3: Link activation
Links are evaluated against the primary selection:

- source widget match
- activation-policy allowance
- field mapping resolvability

Activated links produce a propagation plan.

### Stage 4: Target effect application
Each activated link applies its target response according to:

- declared effect
- effect constraint
- target widget capability

This produces target-side state changes that are observable in widget-local or shared derived feedback state.

### Required propagation outputs

Every default propagation pass should be able to produce:

- source selection reference
- activated links
- applied effects
- skipped targets with reasons
- any shared highlight/focus/filter state updates caused by propagation

This output is runtime readback.
It is not canonical coordination state by itself.

## Minimal Complex-Case Coverage

To be publishable and library-like, the model should formally cover a small number of complex situations.
It does not need to fully solve all of them yet, but it must define what happens.

### Case A: Source widget should also show its own response
If a widget emits a shared selection, it must still be able to display its own active selection cue.

The model should not assume propagation is only outward.

### Case B: Target non-application must be explainable
A target may not change because:

- no applicable link exists
- activation policy suppresses application
- mapping fails
- target effect is unsupported
- effect constraint prevents the stronger form of response

This must be explainable in provenance surfaces.

### Case C: Selection promotion and filter promotion are distinct
If a user converts a selection into a global filter:

- the selection may be cleared
- the filter persists
- propagation should now derive from filter state, not from a transient selection

### Case D: Single-primary model with explicit limits
The current model may intentionally prefer one primary selection for propagation.
If multiple selections exist, the library must define:

- only one drives default propagation
- others remain readable in the registry
- multi-selection algebra is out of current scope

This is a valid constrained design, as long as it is explicit.

## Provenance Model

The runtime should be able to explain a propagation with a stable structure like:

```txt
{
  sourceSelectionRef,
  sourceWidgetId,
  activatedLinks: [
    {
      linkId,
      targetWidgetId,
      effect,
      activationPolicy,
      effectConstraint
    }
  ],
  affectedTargets: [
    {
      targetWidgetId,
      effect,
      activationPolicy,
      effectConstraint,
      verification
    }
  ],
  skippedTargets: [{ targetWidgetId, reason }]
}
```

This is a runtime read model.
It must derive from canonical shared state plus widget/runtime descriptions.
It must not become a second coordination store.

## Link Graph Contract

The coordination graph should be modeled as a directed multigraph over registered widgets.

The graph contract is:

- nodes are registered widget refs
- edges are explicit link definitions
- multiple edges between the same source and target are allowed when they differ semantically
- reverse behavior is not implied by forward links

This means:

- `A -> B` does not imply `B -> A`
- one widget pair may have both filter and highlight links
- source-local self-response should not require an explicit self-link unless the workspace wants self-links to be inspectable as graph structure

The graph should remain explicit because many multi-widget behaviors that look symmetrical in the UI are not actually symmetric in semantics.

## Library Boundary Rules

This section defines what belongs in `widgetva-kit` and what does not.

### Must belong to `widgetva-kit`

- selection registry model
- primary/byWidget selection views
- link definition model
- effect, activation-policy, and effect-constraint semantics
- propagation planning and provenance read surfaces
- canonical workspace-owned coordination writes
- verification-oriented coordination result surfaces
- capability-aware effect downgrading rules
- shared-to-derived precedence rules

### May belong to first-party app layer

- concrete visual styling of highlight/focus cues
- app-specific control layout
- app-specific preset compositions
- app-specific wording and labeling
- app-specific convenience projections that do not introduce new coordination meaning

### Should migrate out of first-party app over time

- coordination logic that decides target response semantics
- app-owned interpretation of canonical link effects
- app-owned derivation of which widgets are actual propagation targets

If behavior is semantically part of coordination, it should prefer library ownership.

## Clean Layer Boundaries

To keep the model library-like rather than app-like, implementation should follow this split.

### Layer 1: Coordination model layer

Owned by `widgetva-kit`.

Responsibilities:

- canonical shared-state shapes
- mutation semantics
- validation rules
- link-definition normalization
- state invariants

This layer answers:

- what coordination objects exist?
- what fields are canonical?
- what writes are legal?

This layer should not know:

- concrete React component structure
- first-party layout choices
- app-specific labels or panels

Allowed dependencies:

- may be depended on by every higher layer
- may not depend on app runtime or widget implementation details

### Layer 2: Coordination execution layer

Owned by `widgetva-kit`.

Responsibilities:

- primary-selection resolution
- link activation
- field-mapping resolution
- capability-aware effect application
- skipped-target explanation
- provenance packaging
- verification-oriented readback

This layer answers:

- given current shared state and link graph, what propagation should happen?

This layer should not know:

- how a first-party page visually displays the result
- where a specific control button is placed

Allowed dependencies:

- may depend on coordination model layer
- may depend on widget capability descriptors
- may not depend on first-party UI state
- may not read React component internals directly

### Layer 3: Widget adapter layer

Joint boundary, but semantics should remain library-defined.

Responsibilities:

- expose widget capability descriptors
- expose widget verification/read methods
- translate canonical effects into widget-consumable view state hooks

This layer answers:

- how does a concrete widget instance express library-defined effects?

This layer is the correct place for:

- per-widget effect support declarations
- per-widget verification contracts
- narrow adapter logic needed to bind library semantics to widget internals

This layer is not the right place for:

- inventing new coordination semantics in app code

Allowed dependencies:

- may depend on coordination model and execution layers
- may depend on widget runtime/view implementation details
- may not redefine canonical effect or link meaning
- may not own cross-widget precedence rules

### Layer 4: First-party app layer

Owned by `apps/widgetva-system`.

Responsibilities:

- render UI
- bind controls to semantic workspace operations
- choose preset workspace compositions
- display inspection/provenance surfaces

This layer answers:

- how does the demo/system expose the coordination model to humans and agents?

This layer should consume coordination results.
It should not redefine them.

Allowed dependencies:

- may depend on all lower layers
- may compose semantic operations into UX flows
- may not create a second coordination store with different meaning
- may not override link/effect/precedence semantics locally

## Boundary Violation Checklist

The following are signs that coordination logic is in the wrong layer.

### Wrongly in app layer

These should move into `widgetva-kit`:

- app code decides whether a link auto-applies
- app code decides how to downgrade filter to highlight
- app code invents skipped-target reasons
- app code decides primary-selection precedence semantically
- app code derives cross-widget target applicability using reusable semantic logic

### Wrongly in widget adapter layer

These should move lower into model or execution:

- adapter introduces a new effect name
- adapter changes the meaning of `globalFilters`
- adapter chooses whether selection and filter are equivalent
- adapter defines cross-widget propagation order

### Correctly in app layer

These may stay in `apps/widgetva-system`:

- which toolbar button invokes `promotePrimarySelectionToGlobalFilters`
- whether inspection results appear in a side panel or drawer
- how a highlight badge is worded
- how provenance text is summarized for users

## Development Contract

This section states what "done correctly" means for ongoing implementation.

### A feature belongs in `widgetva-kit` when

- it changes shared-state meaning
- it changes propagation meaning
- it changes link activation semantics
- it changes effect application semantics
- it changes provenance or verification semantics

### A feature may stay in the app when

- it only changes presentation
- it only changes layout or control placement
- it only creates a read-only convenience projection with no new semantic meaning

### A refactor is required when

- the app contains effect-selection rules that another consumer would also need
- the app contains skipped-target reasoning
- the app interprets `effectConstraint` or `activationPolicy` by itself
- the app decides link applicability using semantic rules that should be portable

## Minimal Public Development API

The exact method names may evolve, but these semantic operations should exist clearly somewhere in the kit surface.

### Shared-state operations

- create/update/remove selection registry entries
- resolve/set/clear primary selection
- create/update/clear global filters
- create/update/clear shared highlight
- set/clear focused widget
- register/remove/read links

### Coordination execution operations

- read normalized link graph
- evaluate default propagation
- read latest propagation summary
- read skipped-target explanations
- read verification-oriented coordination result

### Widget adapter operations

- declare supported effects
- declare verification read method
- translate canonical effect into widget-facing response state
- expose verification state for readback

## Public Surface Rules

The library should expose semantic methods, not raw store mutation surfaces.

Preferred workspace-level public reads:

- `readObservation()`
- `readCoordinationState()`
- `readPropagationSummary()`
- `readLatestCoordinationResult()`

Preferred workspace-level public writes:

- `setSelectionPrimary(...)`
- `setSelectionViewsByWidget(...)`
- `setSelectionRegistry(...)`
- `clearSelectionState()`
- `setHighlightState(...)`
- `clearHighlightState()`
- `setFocusedWidget(...)`
- `setGlobalFilters(...)`
- `clearGlobalFilters()`
- `registerLink(...)`
- `removeLink(...)`

The public surface should remain semantic and stable.
Raw mutator internals should stay internal.

## Development Priorities for a Stronger Model

If the goal is a more mature, publishable, library-like coordination model, the highest-value next steps are:

1. `Harden formal semantics`
- define promotion rules
- define effect semantics precisely
- define activation-policy semantics precisely
- define effect-constraint semantics precisely
- define source/target/non-target response rules

2. `Reduce app-owned coordination execution`
- move more target-effect interpretation into `widgetva-kit`
- keep first-party app as a consumer, not the owner of semantics

3. `Strengthen non-application explanation`
- explain skipped propagation targets
- explain suppressed links
- explain unsupported effects

4. `Keep multi-selection scope explicit`
- do not pretend full multi-selection algebra is solved
- define the current single-primary propagation model cleanly

## What This Model Is Strong Enough To Claim

If implemented cleanly, this model can reasonably claim:

- support for the core coordination patterns of agentic multi-widget visual analysis
- explicit, explainable propagation semantics
- separation between widget-local and workspace-shared state
- a library-level coordination substrate rather than app-only wiring

It should **not** yet claim:

- full coverage of arbitrary multi-selection composition
- complete generalization to every multi-view analytical topology
- exhaustive activation-policy or effect-constraint theory

## What This Model Deliberately Does Not Try To Be

This model is not trying to be:

- a full visual-analysis ontology
- a general graph-rewrite system
- a rich trigger language
- a role-driven execution engine
- a complete multi-selection logic system

If a concept does not directly strengthen:

- selection-driven coordination
- filter/highlight/focus response
- explainable propagation
- clean library ownership

it should stay out of the core model for now.

## Success Criteria

This model should be considered mature enough for a strong library/paper foundation when:

- the formal semantics match the implementation
- the core coordination semantics live in `widgetva-kit`
- first-party app code mostly consumes, rather than invents, coordination behavior
- every major propagation event is explainable through source, link, effect, and verification
- the limits of the current model are explicit rather than implicit

## Implementation Mapping

This section is intentionally short.
Its purpose is to make the spec directly usable for implementation work.

### `selection`

Primary implementation sites today:

- `widgetva-kit/src/workspace/state/selectionStateModel.js`
- `widgetva-kit/src/workspace/state/workspaceSharedStateMutators.js`
- `widgetva-kit/src/workspace/widgetWorkspace.js`
- `widgetva-kit/src/core/runtime/materializers/selectionStateShape.js`
- `widgetva-kit/src/core/runtime/sharedStateDerivation.js`
- `apps/widgetva-system/src/runtime/runtimeBridge.js`

Use this section when auditing:

- selection registry ownership
- primary-selection resolution
- selection promotion and clearing

### `globalFilters`

Primary implementation sites today:

- `widgetva-kit/src/workspace/state/workspaceSharedStateMutators.js`
- `widgetva-kit/src/workspace/widgetWorkspace.js`
- `apps/widgetva-system/src/runtime/runtimeBridge.js`
- `apps/widgetva-system/src/app/appStore.js`

Use this section when auditing:

- filter promotion from selection
- persistent workspace slicing
- filter reset / restore semantics

### `highlight`

Primary implementation sites today:

- `widgetva-kit/src/workspace/state/highlightStateModel.js`
- `widgetva-kit/src/workspace/widgetWorkspace.js`
- `widgetva-kit/src/core/runtime/LinkEngine.js`
- `apps/widgetva-system/src/runtime/runtimeBridge.js`
- `apps/widgetva-system/src/workspace/widgetSpecs.js`

Use this section when auditing:

- highlight as a separate coordination object
- highlight vs filter semantics
- target-side highlight response

### `focus`

Primary implementation sites today:

- `widgetva-kit/src/workspace/state/focusStateModel.js`
- `widgetva-kit/src/workspace/widgetWorkspace.js`
- `apps/widgetva-system/src/runtime/runtimeBridge.js`
- `apps/widgetva-system/src/app/appStore.js`

Use this section when auditing:

- workspace focus ownership
- focus propagation and focus readback
- source-widget self-feedback

### `links`

Primary implementation sites today:

- `widgetva-kit/src/workspace/state/linkStateModel.js`
- `widgetva-kit/src/core/protocol/widgetLinks.js`
- `widgetva-kit/src/workspace/widgetWorkspace.js`
- `widgetva-kit/src/core/runtime/deriveWorkspaceTopology.js`
- `apps/widgetva-system/src/runtime/workspaceComposition.js`

Use this section when auditing:

- canonical link definition shape
- effect typing
- activation-policy/effect-constraint shape
- topology derivation

### Link activation and propagation execution

Primary implementation sites today:

- `widgetva-kit/src/core/runtime/LinkEngine.js`
- `widgetva-kit/src/core/runtime/sharedStateDerivation.js`
- `apps/widgetva-system/src/runtime/runtimeBridge.js`

Use this section when auditing:

- what actually activates a link
- which targets are affected
- which effect is applied
- what still remains app-owned instead of library-owned

### Provenance and verification readback

Primary implementation sites today:

- `widgetva-kit/src/core/runtime/agentFacingSurface.js`
- `widgetva-kit/src/workspace/widgetWorkspace.js`
- `widgetva-kit/src/core/runtime/AgentLoopRuntime.js`
- `apps/widgetva-system/src/runtime/runtimeBridge.js`
- `apps/widgetva-system/src/analysis/InspectPanel.jsx`
- `apps/widgetva-system/src/analysis/AgentPanel.jsx`

Use this section when auditing:

- propagation explanation
- non-application explanation
- verification result packaging
- latest coordination result ownership

### Boundary-cleanup priority

If using this spec to guide the next implementation phase, the highest-value audit order is:

1. `links` plus link activation
2. propagation execution that still lives in `apps/widgetva-system`
3. `highlight / focus / globalFilters` response semantics
4. provenance and verification readback consistency

This order is recommended because it most directly improves:

- library ownership
- model/implementation consistency
- explainable multi-widget coordination

## Next Development Tasks

This spec is ready to guide development if the next steps stay narrow and concrete.

Recommended implementation order:

1. move remaining app-owned target-response resolution into `widgetva-kit`
2. make selection/global-filter transitions obey the invariants above
3. make skipped-target reasons complete and stable
4. make widget adapters declare capabilities explicitly enough for propagation execution
5. keep first-party app limited to rendering and semantic command wiring

If a proposed change does not strengthen one of those five items, it likely does not belong in the current core model.

## Development Slices

The remaining work should be executed as a small number of implementation slices.
Each slice should end in a stable library surface plus a concrete verification pass.

### Slice 1: Finish library-owned propagation execution

Goal:

- make `widgetva-kit` own target-response resolution for the core effects:
  - `applyFilter`
  - `applyHighlight`
  - `focusTarget`
  - `setSelectionMirror` where still needed

Implementation focus:

- move remaining target-effect interpretation out of `apps/widgetva-system/src/runtime/runtimeBridge.js`
- keep widget/app code responsible only for:
  - invoking semantic workspace methods
  - rendering returned coordination state and verification readback
- keep link activation, effect downgrade, and skipped-target reasoning library-owned

Acceptance checks:

- triggering the same source selection no longer depends on app-specific target resolution logic
- propagation summaries can be read from workspace/library surfaces without app-only reconstruction
- app runtime glue does not introduce new effect semantics

### Slice 2: Close the canonical selection/filter/highlight/focus write paths

Goal:

- make every core coordination write happen through explicit semantic workspace methods

Implementation focus:

- audit writes for:
  - primary selection sync
  - selection clear
  - selection promotion to global filters
  - selection promotion to highlight
  - highlight clear
  - focus set/clear when shared focus is involved
- remove any remaining app-local coordination mutations that bypass canonical workspace methods

Acceptance checks:

- every shared coordination change can be traced to one workspace-level semantic write
- selection clear does not implicitly clear global filters
- selection promotion retains provenance
- highlight remains distinct from filter state in both write path and readback

### Slice 3: Harden widget capability declarations

Goal:

- make propagation depend on explicit widget capability declarations rather than app-side guessing

Implementation focus:

- ensure widget adapters/specs declare:
  - supported effect types
  - verification read shape
  - any effect-specific downgrade or unsupported cases
- keep this declaration minimal and effect-oriented
- do not turn it into a broad widget ontology

Acceptance checks:

- unsupported target behavior yields stable skipped/downgraded reasons
- adding a new widget does not require ad hoc propagation logic in the app layer
- capability declarations are sufficient to explain why a target filtered, highlighted, focused, or was skipped

### Slice 4: Stabilize explanation and verification surfaces

Goal:

- make coordination outcomes readable in a consistent way by UI and future agent layers

Implementation focus:

- standardize:
  - propagation summary shape
  - latest coordination result shape
  - skipped-target reason vocabulary
  - verification result packaging
- ensure these are read surfaces, not a second coordination store

Acceptance checks:

- a single interaction can be explained as:
  - source state
  - activated links
  - applied or downgraded effects
  - verification/readback result
- skipped targets report stable reason codes rather than app-specific prose
- inspect/explanation UI can render directly from the standardized read surfaces

## Development Rules

During implementation, prefer the following rules:

1. if a change affects shared coordination meaning, it belongs in `widgetva-kit`
2. if a change only affects rendering, control layout, or demo-specific presentation, it belongs in the app
3. do not add a new coordination object unless one of the five core objects becomes insufficient
4. do not add a new policy layer unless current propagation behavior cannot be expressed with existing link/effect semantics
5. do not add agent-specific abstractions in this phase; the current task is to finish the widget/multi-widget substrate

## Out of Scope for This Phase

The following should stay out unless a concrete blocker appears:

- arbitrary multi-selection algebra
- ranking or scoring competing links
- collaborative or multi-user coordination
- declarative workflow languages over links
- widget-role taxonomies beyond what core propagation needs
- agent planning abstractions

## Minimum Release Bar for the Current Coordination Model

The current phase should be considered functionally complete when all of the following are true:

- the core shared coordination objects are library-owned
- the app no longer decides core target-response semantics
- selection, global filter, highlight, and focus transitions obey the invariants in this spec
- propagation results and skipped-target explanations are stable enough for UI readback
- a new widget can join the workspace primarily by declaring capabilities and links, not by adding custom propagation code
