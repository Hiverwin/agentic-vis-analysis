# WidgetVA Advanced Link Responses Development Plan

## Purpose

This document defines how to extend the current multi-widget link model so the system can support richer cross-widget analytical responses without destabilizing the existing core coordination model.

The immediate target is to support these response families as first-class multi-widget coordination behaviors:

- `drillDown`
- `reencode`
- `aggregate`
- `expand`
- `collapse`

This document is intentionally narrower than the full multi-widget model spec.
It is a development plan for adding advanced link-driven responses on top of the current core model.

## Why This Exists

The current core link/effect model is intentionally small and stable.
It already covers:

- `applyFilter`
- `applyHighlight`
- `focusTarget`
- `shareSelection`
- `syncDomain`

Those effects are good for direct target responses, but they are not sufficient for richer analytical coordination where a source interaction changes the target's analysis state rather than only its local response intensity.

Examples:

- a source selection causes a target chart to drill from yearly to monthly view
- a source selection causes a target chart to switch encoding to comparison mode
- a source selection causes a target to switch from raw rows to grouped summaries
- a source selection causes a structural target such as Sankey to expand or collapse one branch

These are still valid multi-widget coordination behaviors, but they are not the same kind of thing as `applyFilter` or `applyHighlight`.

## Design Position

The extension should not enlarge the current minimal core effect vocabulary indiscriminately.

Instead, the model should become explicitly layered:

1. `core link effects`
2. `advanced link responses`
3. `workflow/composition semantics`

This document only covers layer 2.

## Layering Rules

### Layer 1: Core Link Effects

These remain the immediate target-response layer:

- `applyFilter`
- `applyHighlight`
- `focusTarget`
- `shareSelection`
- `syncDomain`

These effects are:

- direct
- single-step
- target-local
- easy to verify
- easy to explain in propagation summaries

### Layer 2: Advanced Link Responses

These are view-transformation or analysis-state-transition responses:

- `drillDown`
- `reencode`
- `aggregate`
- `expand`
- `collapse`

These responses are:

- stronger than a direct highlight/filter/focus response
- often tied to widget runtime state or active spec transformation
- often verified through spec/view/state changes rather than row counts or highlight keys

### Layer 3: Workflow / Composition Semantics

These are not part of this development plan:

- multi-step coordination chains
- composed effect sequences
- staged propagation
- branch-aware coordination workflows
- annotation accumulation as a propagation workflow

These should not be modeled as a single link effect.

## Core Modeling Decision

Do **not** overload the current `effect` field with every advanced analytical response.

Instead:

- keep the current `effect` field stable
- add a new advanced response payload on links
- let runtime derive whether the link executes as:
  - a direct core response
  - an advanced response

## Proposed Link Extension

Each link may optionally declare:

```txt
responseSpec
```

Canonical high-level shape:

```txt
{
  primitive,
  effect,
  activationPolicy,
  effectConstraint,
  fieldMapping,
  responseSpec
}
```

Where:

- `primitive`
  classifies the coordination family
- `effect`
  remains the direct target-response label
- `responseSpec`
  defines an advanced target transformation when the link is not just a simple response link

## `responseSpec` Shape

Initial canonical shape:

```txt
{
  kind,
  params,
  verificationHints
}
```

Field semantics:

- `kind`
  the advanced response family
- `params`
  the concrete transformation payload
- `verificationHints`
  optional guidance for how to confirm the advanced response succeeded

## Supported Advanced Response Kinds

The first supported kinds should be:

- `drillDown`
- `reencode`
- `aggregate`
- `expand`
- `collapse`

This vocabulary should stay intentionally small.

## Advanced Response Semantics

### 1. `drillDown`

Use when a source interaction should move the target into a more detailed analytical state.

Canonical shape:

```txt
{
  kind: "drillDown",
  params: {
    dimension,
    fromLevel,
    toLevel,
    selectionScoped
  }
}
```

Semantics:

- target granularity becomes finer
- target may change time unit, grouping level, or detail depth
- target may also inherit source-driven subset constraints

Expected verification surfaces:

- view encoding granularity
- transform stack
- drill-down runtime metadata
- title / context metadata if the widget uses them

### 2. `reencode`

Use when a source interaction should switch the target into a different visual mapping or comparison view.

Canonical shape:

```txt
{
  kind: "reencode",
  params: {
    channels: [
      { channel, field, type, aggregate }
    ]
  }
}
```

Semantics:

- target keeps the same widget family
- target changes one or more encoding bindings
- this is a view-grammar change, not a simple direct response

Expected verification surfaces:

- encoding fields
- scale/domain changes if any
- transform changes if aggregate or grouping is introduced with the re-encoding

### 3. `aggregate`

Use when a source interaction should push the target into a grouped summary state.

Canonical shape:

```txt
{
  kind: "aggregate",
  params: {
    groupBy,
    measures
  }
}
```

Semantics:

- target data organization changes
- target visible rows become grouped summary rows
- this is stronger than ordinary filtering because it changes data shape

Expected verification surfaces:

- aggregate transform presence
- grouped row count
- grouped measure fields
- summary-specific runtime metadata

### 4. `expand`

Use when a source interaction should reveal hidden structural detail in a target.

Canonical shape:

```txt
{
  kind: "expand",
  params: {
    target,
    keyField,
    keys
  }
}
```

Semantics:

- target reveals a previously compressed structural region
- common for Sankey or hierarchy-like widgets

Expected verification surfaces:

- structural runtime state
- visible node/link count
- expanded group metadata

### 5. `collapse`

Use when a source interaction should compress structural detail in a target.

Canonical shape:

```txt
{
  kind: "collapse",
  params: {
    target,
    keyField,
    keys
  }
}
```

Semantics:

- target hides a structural region behind an aggregate node or collapsed representation

Expected verification surfaces:

- structural runtime state
- visible node/link count
- collapsed group metadata

## Primitive Strategy

The core primitive vocabulary should remain small, but the system does need a controlled way to classify advanced responses.

Recommended strategy:

- keep current core primitives
- add a second small band of transformation primitives

### Core primitives to retain

- `sharesSelection`
- `filter`
- `highlight`
- `focus`
- `syncDomain`

### New transformation primitives to introduce

- `drillDown`
- `reencode`
- `aggregate`
- `structure`

Where:

- `structure` is the primitive family for `expand` / `collapse`

This lets the runtime answer:

- is this a direct response link?
- or is this a transformation-oriented link?

## Effect Strategy

Do not create one new top-level `effect` label for every advanced behavior.

Instead, introduce only a very small extension:

- `transformView`
- `transformDataView`
- `transformStructure`

Recommended mapping:

- `drillDown`
  - `primitive: drillDown`
  - `effect: transformView`
- `reencode`
  - `primitive: reencode`
  - `effect: transformView`
- `aggregate`
  - `primitive: aggregate`
  - `effect: transformDataView`
- `expand`
  - `primitive: structure`
  - `effect: transformStructure`
- `collapse`
  - `primitive: structure`
  - `effect: transformStructure`

This keeps the effect vocabulary from exploding while still letting propagation summaries distinguish:

- response effects
- transformation effects

## Declared Effect vs Applied Effect for Advanced Responses

The current rule should still hold:

- declared effect is what the link intends
- applied effect is what the runtime actually executed

For advanced responses:

- the runtime may still downgrade or skip execution
- the runtime should not invent arbitrary new effect labels
- the runtime should preserve:
  - declared primitive
  - declared effect
  - responseSpec kind
  - applied result

For example:

```txt
declared:
  primitive: drillDown
  effect: transformView
  responseSpec.kind: drillDown

applied:
  effect: transformView
  responseKind: drillDown
```

If the target cannot support the requested advanced response:

- skip the target
- emit a stable skip reason

## Verification Model for Advanced Responses

Advanced responses need a distinct verification strategy from ordinary filter/highlight/focus.

### Existing direct-response verification

Still applies to:

- row counts
- highlighted keys
- focus state
- shared selection mirroring
- synced domains

### New advanced-response verification

Must verify one or more of:

- encoding changes
- transform stack changes
- runtime metadata changes
- structure-state changes
- derived title/context changes if they are part of the widget contract

This means `verificationHints` should be added into `responseSpec`, not hidden in app-specific logic.

## Provenance Requirements

Propagation provenance for advanced responses must include:

- `primitive`
- `declaredEffect`
- `appliedEffect`
- `activationPolicy`
- `effectConstraint`
- `responseSpec.kind`
- `responseSpec.params` or a safe summary of them

This is necessary because:

- `transformView` alone is not sufficiently informative
- the system must explain whether the target:
  - drilled down
  - reencoded
  - aggregated
  - expanded
  - collapsed

## Capability Gating

Advanced responses must remain capability-aware.

The runtime must distinguish:

1. link structurally exists
2. target supports the response kind
3. target can apply the requested params
4. target can verify the result

If any of these fail:

- do not silently fall back to an unrelated response
- skip with a stable reason

Recommended new skipped-target reasons:

- `unsupported_advanced_response`
- `advanced_response_params_invalid`
- `advanced_response_verification_unavailable`

These should be normalized into the same skipped-target vocabulary system already used by the runtime.

## Implementation Plan

### Phase A1: Schema Extension

Add to link schema:

- `responseSpec`
- `responseSpec.kind`
- `responseSpec.params`
- `responseSpec.verificationHints`

Primary files:

- [widgetva-kit/src/core/protocol/widgetLinks.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/core/protocol/widgetLinks.js:1)
- [widgetva-kit/src/core/protocol/workspaceSpec.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/core/protocol/workspaceSpec.js:1)
- [widgetva-kit/src/core/protocol/planning.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/core/protocol/planning.js:1)

Success criteria:

- link schema admits `responseSpec`
- public normalized link objects preserve `responseSpec`
- old links without `responseSpec` remain valid

### Phase A2: Primitive / Effect Vocabulary Extension

Add:

- new primitives:
  - `drillDown`
  - `reencode`
  - `aggregate`
  - `structure`
- new effects:
  - `transformView`
  - `transformDataView`
  - `transformStructure`

Primary files:

- [widgetva-kit/src/core/protocol/widgetLinks.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/core/protocol/widgetLinks.js:1)
- [widgetva-kit/src/core/runtime/linkSemantics.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/core/runtime/linkSemantics.js:1)

Success criteria:

- normalization recognizes new primitive/effect combinations
- declared/applied effect logic remains stable

### Phase A3: LinkEngine Advanced Response Path

Extend propagation execution to:

- detect `responseSpec`
- route transformation responses through dedicated handlers
- preserve provenance

Primary file:

- [widgetva-kit/src/core/runtime/LinkEngine.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/core/runtime/LinkEngine.js:1)

Success criteria:

- engine can describe and execute advanced response entries
- unsupported advanced responses skip cleanly
- propagation summary remains canonical

### Phase A4: Widget Capability Surface

Each advanced response must be gated by widget capability.

Primary files:

- widget action/perception contracts by family
- semantic capability registry

Likely files:

- [widgetva-kit/src/capabilities/semanticCapabilities.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/capabilities/semanticCapabilities.js:1)
- widget family action/perception definitions

Success criteria:

- runtime can ask whether a widget supports:
  - `drillDown`
  - `reencode`
  - `aggregate`
  - `expand/collapse`

### Phase A5: Verification Surface

Add advanced-response verification hints and checks.

Primary files:

- [widgetva-kit/src/core/runtime/agentFacingSurface.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/core/runtime/agentFacingSurface.js:1)
- [widgetva-kit/src/widgets/verificationContract.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/widgets/verificationContract.js:1)

Success criteria:

- propagation result can recommend how to verify advanced response execution
- runtime can expose verification metadata without app-only logic

### Phase A6: First-Party Adoption

Adopt advanced links in `widgetva-system` for at least one strong path first.

Recommended order:

1. `drillDown`
2. `aggregate`
3. `reencode`
4. `expand/collapse`

Recommended first first-party path:

- source selection on overview chart
- target line or heatmap drill-down response

Primary first-party files:

- [apps/widgetva-system/src/runtime/workspaceComposition.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/workspaceComposition.js:1)
- [apps/widgetva-system/src/runtime/runtimeBridge.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/runtime/runtimeBridge.js:1)
- first-party widget/runtime adapters as needed

Success criteria:

- first-party app demonstrates at least one advanced response through canonical link execution
- UI behavior, runtime result, and verification surface all agree

## Recommended Rollout Order

The safest rollout is:

1. schema extension
2. `drillDown`
3. `aggregate`
4. `reencode`
5. `expand/collapse`

Reason:

- `drillDown` is analytically central and easiest to justify
- `aggregate` is the next most general
- `reencode` is powerful but easier to overgeneralize
- `expand/collapse` is more widget-family-specific

## What Not To Do

Do not:

- add one new top-level `effect` label for every advanced behavior
- collapse workflow semantics into a link effect
- let app-only code invent advanced propagation semantics outside the link/runtime model
- treat `drillDown` as merely a disguised `applyFilter`
- treat `reencode` as merely a widget-local UI change if it is link-driven

## Deliverable Standard

This extension is complete only when:

- schema accepts advanced link responses
- runtime can normalize them
- propagation can execute or skip them cleanly
- provenance records them explicitly
- verification can reason about them
- at least one first-party path uses them end-to-end

At that point the system will support not only direct response coordination, but also analytical transformation coordination as part of the multi-widget link model.
