# WidgetVA Trace Provenance Development Plan

## 1. Purpose

This document defines the stable development model for the Trace system in `apps/widgetva-system/`.

Trace is not a dev log.
Trace is not a list of agent messages.
Trace is not only a human-agent handoff strip.

Trace is the canonical provenance surface for a multi-widget visual analytics session.

It must let a user, an agent, and a future evaluator answer the same four questions:

1. what happened
2. who did it
3. which shared state changed
4. whether the analysis continued on the same path or forked from an older state

This document is implementation-facing. It is tied to the current codebase, especially:

- `apps/widgetva-system/src/runtime/runtimeBridge.js`
- `apps/widgetva-system/src/app/appStore.js`
- `apps/widgetva-system/src/trace/traceViewModel.js`
- `apps/widgetva-system/src/trace/TracePanel.jsx`

## 2. Product position

The system goal is not to visualize generic interaction telemetry.
The goal is to support a real host VA where human and agent both operate on the same multi-widget workspace, and where that process can be replayed, inspected, and verified.

So Trace is a provenance control surface with three roles:

1. process overview
2. replay anchor
3. evidence navigation spine

This means Trace must be:

- compact enough to stay visible during analysis
- structured enough to reveal branch lineage
- interactive enough to drive workspace replay
- stable enough to support different agent scaffolds over the same runtime

## 3. Core semantics

### 3.1 Step

A `step` is one recorded interaction event in runtime trace.

Examples:

- human brushes a scatter region
- human restores a historical workspace state
- agent runs a perception query
- agent verifies a current selection
- human saves a finding derived from a selected trace step

### 3.2 Workspace state

A `workspace state` is a replayable analytical snapshot.

Operationally this already exists through:

- `readWorkspaceStateHistory(...)`
- `jumpWorkspaceToState(...)`
- runtime state snapshots captured by the underlying workspace/runtime surfaces

Trace should be understood as the readable provenance layer over those replayable states.

### 3.3 Continuation

A `continuation` means:

- the step was taken from the current latest active state
- the analytical path did not fork

Actor may remain the same or may later be reclassified as a `handoff` if control changed.

### 3.4 Handoff

A `handoff` means:

- control moved from `human -> agent` or `agent -> human`
- but the step still continued on the same active path

Handoff is about control transfer, not path divergence.

### 3.5 Branch

A `branch` means:

- the session restored, replayed, or jumped to an earlier historical state
- that state was not the latest current state
- new analytical work then continued from that restored state

Branch is not:

- a new widget
- a new topic
- a new role
- a different chart encoding

Branch is specifically a fork from replayable state ancestry.

### 3.6 Replay

A `replay` step records the explicit restoration action itself.

In current implementation, replay-driven fork semantics are materialized through lineage fields such as:

- `sourceStateId`
- `resultStateId`
- `branchId`
- `branchFromStateId`
- `parentStepId`

Replay is therefore not a UI-only concept. It is the runtime mechanism that gives branch provenance objective meaning.

## 4. Non-negotiable semantic rules

### 4.1 Branch and handoff must remain distinct

If branch and handoff are mixed:

- actor switching becomes over-emphasized
- historical divergence disappears
- replay semantics become impossible to trust
- provenance cannot support evaluation or agent comparison

### 4.2 Replayable lineage is the source of truth

Trace should never infer branch semantics only from:

- actor changes
- widget changes
- textual summaries

It should derive branch semantics from state ancestry and replay history.

### 4.3 Evidence belongs to steps, not separate rails

`state` and `evidence` should be attached to nodes as lightweight encodings.
They should not become their own independent lines.

## 5. Current implemented foundation

The current codebase already has meaningful provenance groundwork:

### 5.1 Runtime lineage

`apps/widgetva-system/src/runtime/runtimeBridge.js` now records or normalizes:

- `sourceStateId`
- `resultStateId`
- `transitionType`
- `branchId`
- `branchFromStateId`
- `parentStepId`

This is the core step toward objective branch semantics.

### 5.2 Replay-linked selection

`apps/widgetva-system/src/app/appStore.js` now supports:

- `selectTraceStep(stepId)`
- workspace replay to the selected step's `resultStateId`
- trace-driven navigation from findings back to their provenance

### 5.3 Branch-aware trace normalization

`apps/widgetva-system/src/trace/traceViewModel.js` already derives:

- normalized `steps`
- projected `nodes`
- semantic `edges`
- derived `branches`
- branch ordering and stream bands
- selected/current step context

### 5.4 Evidence binding

Findings now preserve provenance references such as:

- `traceStepId`
- `stateId`
- `branchId`

This allows right-side evidence panels to anchor back into the trace and workspace.

## 6. Canonical trace data model

The long-term model has four layers:

1. runtime trace record
2. state lineage
3. trace view model
4. UI interaction state

### 6.1 Runtime trace record

Each raw trace step should converge on the following stable shape:

```js
{
  id: string,
  actor: 'human' | 'agent' | 'system',
  kind: 'action' | 'perception' | 'data_query' | 'replay' | 'branch',
  status: 'ok' | 'running' | 'failed' | 'partial',
  time: string | null,

  widgetId: string | null,
  widgetTitle: string | null,
  methodName: string | null,

  summary: string,
  detail: string | null,

  stateDelta: {
    selection: boolean,
    focus: boolean,
    highlight: boolean,
    viewport: boolean,
    evidence: boolean,
    propagation: boolean,
    branch: boolean,
  },

  verificationSummary: string | null,
  evidenceSummary: string | null,
  queryScope: object | null,
  updatedRefs: array,

  sourceStateId: string | null,
  resultStateId: string | null,
  parentStepId: string | null,
  transitionType: 'continuation' | 'handoff' | 'branch',
  branchId: string | null,
  branchFromStateId: string | null,

  handoffFrom: string | null,
  handoffKind: string | null,
}
```

### 6.2 State lineage layer

The lineage layer is not a separate stored table yet, but the semantics already exist through the fields above.

Interpretation:

- `sourceStateId`: the state from which the step was executed
- `resultStateId`: the state produced or reactivated by the step
- `branchFromStateId`: the historical origin state that a new branch forked from
- `parentStepId`: the previous trace step in the same provenance chain

### 6.3 Trace view model

`traceViewModel` is the canonical normalization boundary between runtime records and UI.

Its output should stay stable enough that:

- TracePanel can render it
- Inspect/Evidence/Agent panels can consume it
- future VLM runtime adapters can inspect it
- later visual rewrites do not force runtime recorder changes

Current target output:

```js
{
  steps: [],
  nodes: [],
  edges: [],
  branches: [],
  segments: [],
  pathSummaries: [],
  branchOrder: [],
  streamBands: [],

  provenanceGraph: {
    nodes: [],
    edges: [],
    branches: [],
    paths: [],
    segments: [],
  },

  selection: {
    selectedStepId: string | null,
    selectedStep: object | null,
    selectedNode: object | null,
    selectedSegment: object | null,
    currentStepId: string | null,
    currentStep: object | null,
    currentNode: object | null,
    currentSegment: object | null,
    currentBranchId: string | null,
  },

  stats: {
    stepCount: number,
    branchCount: number,
    segmentCount: number,
    handoffCount: number,
    evidenceStepCount: number,
    stateDeltaStepCount: number,
  },

  currentStep: object | null,
  selectedStep: object | null,
  currentBranchId: string | null,
  mainBranchId: string,
}
```

`streamBands` are not just display labels.
They are the stable branch-band metadata that Trace layout may use to draw:

- lane rails
- continuous provenance flow spans
- branch entry markers
- fork-origin annotations

### 6.3a View-model invariants

The current `traceViewModel` should be treated as the only authoritative normalization layer between:

- raw runtime trace
- store-level replay/navigation state
- trace rendering
- analysis-side provenance reading

That means the following invariants should hold:

1. every raw step maps to exactly one normalized `step`
2. every normalized `step` maps to exactly one projected `node`
3. every `node.stepId` must resolve back to one normalized `step.id`
4. `selectedStep` and `currentStep` must always come from normalized `steps`, never be recomputed ad hoc in panels
5. `selectedSegment` and `currentSegment` must always be derived from the current normalized `segments`
6. branch ordering for rendering must come from `streamBands` / `branchOrder`, not from arbitrary node sorting in the panel
7. no panel should infer branch semantics directly from actor changes, widget changes, or labels

This is the core guardrail that keeps the trace reusable across:

- the current human-facing host VA
- future VLM-driven interaction clients
- later evaluation or replay tooling

The panel renderer may derive additional render-only projections such as:

- `renderNodes`
- `renderEdges`

But those are not replacements for canonical provenance.

They are density-management projections over the normalized model.

### 6.4 UI interaction state

App-level interaction state should remain outside runtime trace itself.

Current examples:

- `selectedTraceStepId`
- `activeReplayContext`
- `traceNavigationTarget`
- `collapsedTraceSegmentIds`
- the current scroll/pan position of the trace canvas
- right-panel context derived from the selected step

This separation matters because replay state is canonical, but viewport state of the Trace panel is not.

Recommended replay context shape:

```js
{
  source: 'trace_step' | 'finding' | 'history_restore' | 'unknown',
  triggerId: string | null,
  selectedTraceStepId: string | null,
  stateId: string | null,
  sourceStateId: string | null,
  branchId: string | null,
  transitionType: string | null,
  summary: string,
  widgetId: string | null,
  widgetTitle: string | null,
  restoredWidgetId: string | null,
  findingId: string | null,
  replayedAt: number,
}
```

Recommended transient navigation target shape:

```js
{
  stepId: string,
  kind: 'trace' | 'origin' | 'entry',
  timestamp: number,
}
```

Semantics:

- this is a UI-navigation affordance, not runtime provenance
- it is written when a panel intentionally sends the user to a provenance anchor
- it may drive a short-lived node emphasis in Trace
- it must not replace `selectedTraceStepId`

## 7. Canonical node, edge, and branch contracts

### 7.1 Node contract

Each node is one projected trace step.

```js
{
  id: string,
  stepId: string,
  stepNumber: number,
  sequenceIndex: number,

  actor: 'human' | 'agent',
  actorTone: 'human' | 'agent',

  kind: string,
  kindLabel: string,
  status: string,

  widgetTitle: string,
  shortLabel: string,
  summary: string,

  transitionType: 'continuation' | 'handoff' | 'branch',
  branchId: string | null,
  branchDepth: number,
  bandIndex: number,
  bandId: string | null,

  sourceStateId: string | null,
  resultStateId: string | null,
  branchFromStateId: string | null,
  parentStepId: string | null,

  hasStateDelta: boolean,
  hasEvidence: boolean,
  selected: boolean,

  segmentId: string | null,
  segmentIndex: number,
  segmentStepCount: number,
  isSegmentStart: boolean,
  isSegmentEnd: boolean,

  tooltip: string,
}
```

### 7.2 Edge contract

Each edge expresses provenance flow between nodes.

```js
{
  id: string,
  from: string,
  to: string,
  kind: 'sequence' | 'handoff' | 'branch',
}
```

Meaning:

- `sequence`: same path progression, no role switch worth elevating
- `handoff`: same path progression, actor changed
- `branch`: diverges from a historical origin or branch entry point

### 7.3 Branch summary contract

Branch summaries are derived objects used by UI and evaluation layers.

Current target contract:

```js
{
  branchId: string,
  label: string,
  depth: number,

  entryStepId: string | null,
  originStepId: string | null,
  originStateId: string | null,

  stepIds: string[],
  nodeIds: string[],

  analyticalStepIds: string[],
  replayStepIds: string[],
  analyticalStepCount: number,
  replayStepCount: number,

  latestStepId: string | null,
  stateDeltaCount: number,
  evidenceCount: number,
  handoffCount: number,

  isCurrent: boolean,
  actorSet: string[],
}
```

Important distinction:

- `provenanceGraph.branches` should represent actual forked branches
- `provenanceGraph.paths` should represent branch-level aggregated path summaries used for path-first reading

### 7.3c Path summary contract

`pathSummaries` sit above segments and below the full provenance graph.

They make one analytical path per branch readable before the user drills into individual segments or steps.

Current target shape:

```js
{
  id: string,
  branchId: string,
  label: string,
  depth: number,

  entryStepId: string | null,
  originStepId: string | null,
  latestStepId: string | null,

  segmentIds: string[],
  segmentCount: number,
  stepCount: number,
  analyticalStepCount: number,
  replayStepCount: number,

  actorSet: string[],
  dominantActor: 'human' | 'agent' | 'mixed',
  hasStateDelta: boolean,
  hasEvidence: boolean,
  hasHandoff: boolean,
  hasBranchEntry: boolean,

  startSequenceIndex: number,
  endSequenceIndex: number,
  shortSummary: string,
  current: boolean,
  selected: boolean,
}
```

Semantics:

- one path summary corresponds to one branch-aligned analytical path
- path summaries are derived from branch summaries plus segments
- path summaries are render/usefulness objects, not replay primitives
- path summaries should help the trace surface feel path-first rather than step-first in longer sessions

### 7.3a Stream band contract

`streamBands` are additive layout-facing metadata derived from branch lineage, not a replacement for `branches`.

Current target shape:

```js
{
  id: string,
  branchId: string,
  depth: number,
  label: string,

  entryStepId: string | null,
  entryStepNumber: number | null,
  originStepId: string | null,
  originStepNumber: number | null,
  originStateId: string | null,

  originSequenceIndex: number,
  entrySequenceIndex: number,
  startSequenceIndex: number,
  latestStepId: string | null,
  latestStepNumber: number | null,
  latestSequenceIndex: number,
  stepCount: number,
}
```

This contract exists so the renderer can show branch continuity as a stable stream band rather than inferring it ad hoc from node positions.

### 7.3b Segment contract

`segments` are the first aggregation layer above raw steps.

They do not replace nodes.
They summarize contiguous analytical progress within a branch so long sessions can later be compressed without losing provenance structure.

Current target shape:

```js
{
  id: string,
  branchId: string,
  branchDepth: number,

  startStepId: string | null,
  endStepId: string | null,
  startStepNumber: number | null,
  endStepNumber: number | null,
  startSequenceIndex: number,
  endSequenceIndex: number,

  stepCount: number,
  stepIds: string[],
  nodeIds: string[],

  actorSet: string[],
  dominantActor: 'human' | 'agent' | 'mixed',
  hasHandoff: boolean,
  hasEvidence: boolean,
  hasStateDelta: boolean,
  branchEntry: boolean,

  label: string,
  summary: string,
  shortSummary: string,
}
```

Semantics:

- segments are derived from current chronological trace order
- a segment boundary currently occurs when branch context changes, when a handoff begins, when replay becomes explicit, or when evidence status changes
- later versions may introduce finer segment splitting or true collapse controls without changing raw step semantics
- segment selection is a UI convenience over existing step replay, not a new runtime replay primitive
- segment renderers may attach compact summary encodings derived from these fields, but those encodings should stay representational rather than becoming new provenance primitives

### 7.4 Navigation target contract

The store-level navigation target is intentionally narrower than replay context.

Use it only when the UI wants to answer:

- which provenance anchor did we just jump to
- was that jump a general trace jump, a fork origin jump, or a branch entry jump

Do not overload it with runtime semantics that already exist in step lineage or replay context.

## 8. Deterministic classification rules

Each step must be classifiable without UI guesswork.

### 8.1 Continuation rule

Classify as `continuation` when:

- the step uses the latest active state
- no historical replay/fork occurred
- actor either stays the same or handoff metadata does not apply

### 8.2 Handoff rule

Classify as `handoff` when:

- the step is still on the same path
- actor differs from the immediately preceding effective step

Handoff is still same-path progression.

### 8.3 Branch rule

Classify as `branch` when:

- the step follows an explicit replay/jump to an older state
- that older state is not the latest state
- lineage fields identify a branch context

### 8.4 Branch entry semantics

Current implementation allows replay-derived branch creation to be represented directly in lineage fields.

Operationally:

- replay creates or activates the fork context
- subsequent steps inherit that branch context
- branch UI should connect the fork to the historical origin node where possible

### 8.5 What must not create a new branch

This rule is important because the system is trying to model analytical provenance, not just visual difference.

The following should not create a new branch by themselves:

- human switches to another widget
- agent operates after a human step
- a selection changes on the current live path
- a zoom, brush, focus, filter, or highlight changes the current live view
- a finding is saved
- a verification step adds evidence on the current live path
- the current UI layout changes

These may create:

- a new `continuation`
- a `handoff`
- a step with `hasStateDelta = true`
- a step with `hasEvidence = true`

But they are not branches unless they continue from a restored historical state.

### 8.6 Practical branch test

When future contributors are unsure whether some new behavior should be modeled as a branch, use this test:

1. did the system explicitly restore, jump to, or reactivate an older replayable workspace state?
2. was that state older than the latest active state at that moment?
3. did new analytical work continue from there?

If all three answers are yes, it is a branch.

If not, it is some form of same-path progression and should stay within continuation/handoff semantics.

### 8.7 Segment boundary rule

Segments are intentionally weaker than branches.

They are a density-management abstraction over already-classified steps.

Current boundary rule in `traceViewModel` is:

1. start a new segment at the first step
2. start a new segment when `branchId` changes
3. start a new segment when the next step begins a `branch`
4. start a new segment when the next step is a `handoff`
5. start a new segment when either side is an explicit `replay`
6. start a new segment when evidence status changes across adjacent steps and that change matters

This means:

- branch remains the stronger topological split
- handoff remains the stronger interaction-rhythm split
- segment is a compact analytical chunk, not a new provenance path

Later versions may add:

- topic-aware segmentation
- widget-local segmentation hints
- evidence-driven summarization
- manual segment collapse / expansion

But those should stay derived, not foundational.

## 9. View-model design decision

### 9.1 Chronological stream first

The new trace should be modeled as a provenance stream, not as a grid of isolated step cards.

Primary structure:

- chronological progression on x-axis
- path lineage on y-offset / branch bands
- actor encoded on nodes and edges

### 9.2 Why actor lanes are no longer the primary abstraction

Permanent `Human` / `Agent` lanes help with handoff rhythm but hurt:

- branch readability
- replay lineage legibility
- long-session density
- provenance-focused interpretation

Actor is still important, but branch ancestry is the stronger organizing structure.

### 9.3 Visual priority order

Trace UI should prioritize:

1. main path vs branch structure
2. selected/current step
3. actor identity
4. state/evidence markers

That priority order should remain stable even if the exact drawing style changes later.

When the workspace is currently replayed onto an older path, Trace should treat that replayed branch as the active provenance focus even if the latest chronological step belongs to another path. Concretely:

- latest chronological step controls recency
- active replay branch controls current provenance focus

These two semantics should remain separate.

If the user selects a step on a different branch while replay focus remains elsewhere, the renderer should preserve that distinction:

- active replay branch keeps the strongest path emphasis
- selected branch keeps a secondary but still visible emphasis
- unrelated branches may be deemphasized

## 10. Current file responsibilities

### 10.1 `src/runtime/runtimeBridge.js`

Responsibilities:

- append runtime trace steps
- normalize lineage semantics
- preserve replay-derived branch context
- expose workspace coordination and selection propagation reads

Should not:

- contain TracePanel layout logic
- encode UI-only node geometry

### 10.2 `src/app/appStore.js`

Responsibilities:

- own `selectedTraceStepId`
- coordinate trace selection with workspace replay
- bind findings to trace/state provenance
- expose selection actions used by panels

Should not:

- normalize low-level edge topology
- decide node layout positions

### 10.3 `src/trace/traceViewModel.js`

Responsibilities:

- normalize raw trace steps
- derive nodes/edges/branches
- expose stable provenance graph contract
- expose selected/current step summaries
- remain UI-agnostic except for lightweight band metadata

Should not:

- directly manipulate store state
- render React components

### 10.4 `src/trace/TracePanel.jsx`

Responsibilities:

- draw the interaction stream
- handle drag/pan
- render nodes and edges from normalized model
- call `selectTraceStep(stepId)` when a node is clicked

Should not:

- compute lineage semantics itself
- duplicate branch classification logic

### 10.5 `src/analysis/InspectPanel.jsx`

Responsibilities:

- show selected-step context
- show current coordination/selection/focus state
- bridge from trace selection to readable analysis context
- surface branch fork context when the current replay anchor comes from a branch

### 10.6 `src/analysis/EvidencePanel.jsx`

Responsibilities:

- show selected-step evidence context
- save findings with provenance
- let saved findings navigate back to trace/workspace state
- expose whether the current evidence context belongs to the mainline or a forked branch

## 11. Interaction contract

### 11.1 Selecting a trace node

Expected behavior:

1. user clicks a trace node
2. store updates `selectedTraceStepId`
3. workspace replays to the node's `resultStateId` when available
4. workspace restores the analytical focus widget when the step carries a stable `widgetId`
5. right-side panels refresh using the selected trace step and active replay context

This is already partially implemented and should remain stable.

### 11.2 Replaying from a selected historical step

If the selected step is not on the latest state and the user continues analysis, the next new step should produce a new branch context rather than silently mutating the latest mainline path.

This is the provenance-critical bridge between trace and live analysis.

### 11.3 Findings as provenance anchors

When a finding is saved from a selected trace step, it should preserve:

- `traceStepId`
- `stateId`
- `branchId`
- `pathContext`
- a lightweight branch narrative snapshot when the context belongs to a forked branch

So later:

- clicking a finding can restore the linked state
- the system can compare findings across branches
- the system can compare findings across branch-aligned paths
- evaluation can inspect whether a claim came from human, agent, or replayed branch context
- a saved finding can remain interpretable even before replay is invoked
- a saved finding may expose direct navigation targets for its branch entry and fork origin when that branch narrative snapshot is available
- a saved finding may still remain path-aware even when replay is only step-grounded

### 11.3a Path-aware finding grouping

Once findings preserve `pathContext`, the evidence surface should be able to group them by path.

Expected behavior:

1. evidence items may be grouped by `pathContext.pathId`
2. group headers should expose path label and lightweight path summary
3. group headers may expose a compact comparison summary across findings in that path
4. the surface may expose cross-path comparison cues such as “most findings” or “most fork-aware”
5. selected/current path context may highlight the matching evidence group
6. a group header may focus a representative finding from that path
7. grouping is a comparison/readability affordance, not a replay primitive
8. individual findings still retain their own step-grounded navigation behavior

This supports path-level comparison without breaking the fact that replay remains anchored on exact steps.

### 11.4 Provenance-target navigation feedback

When a finding explicitly navigates to `fork origin` or `branch entry`, expected behavior is:

1. the finding invokes `focusFindingProvenance(findingId, target)`
2. the store resolves the target step id from the saved branch narrative snapshot
3. the store writes a transient `traceNavigationTarget`
4. the store reuses `selectTraceStep(stepId)` for actual replay/selection
5. Trace visually emphasizes that target node for a short period

This feedback channel exists to make provenance navigation legible without creating a permanent inspector in the trace panel.

### 11.5 Segment interaction

Segments should remain subordinate to steps.

Expected behavior for current implementation:

1. user clicks a segment chip
2. the UI resolves that segment's `endStepId`
3. the UI reuses existing `selectTraceStep(endStepId)`
4. workspace replay and right-rail refresh continue through the existing step-selection path

This keeps segment interaction additive:

- users get a denser navigation affordance for longer sessions
- runtime semantics remain step-grounded
- later segment collapse/aggregation can evolve without redefining replay semantics

### 11.6 Segment-aware analysis context

Segments should not stay isolated inside the bottom trace surface.

Expected behavior for the current system:

- selected trace step remains the canonical replay anchor
- selected segment remains a derived analytical context over that step
- right-side analysis panels may show segment label, span size, and summary alongside the selected step

This allows segment-level provenance to become reusable across the UI without introducing a second replay model.

### 11.6a Path-aware analysis context

Segments are not enough once the trace becomes path-first.

Expected behavior for the current system:

- selected trace step remains the canonical replay anchor
- selected path remains a derived branch-level analytical context over that step
- right-side rails may show path label, segment count, and step count alongside segment context

This lets the analysis rails explain not only:

- which step is selected
- which segment it belongs to

but also:

- which broader analytical path the step belongs to
- how large that path is in segment and step terms

### 11.7 Canonical panel consumption contract

The current UI should consume provenance in a disciplined order:

1. `appStore` owns `selectedTraceStepId`, `activeReplayContext`, and transient `traceNavigationTarget`
2. `traceViewModel` derives `selectedStep`, `currentStep`, `selectedSegment`, `currentSegment`, branch summaries, and stream bands
3. `TracePanel` renders the provenance stream and calls `selectTraceStep(stepId)`
4. `InspectPanel`, `EvidencePanel`, and `AgentPanel` read the same normalized selection context rather than each deriving their own

Concretely:

- replay is still step-grounded
- segment is a contextual summary over the selected step
- branch narrative is a readable explanation over lineage metadata
- provenance summary is the rail-facing summary object, not the source of truth

This prevents the common failure mode where:

- the trace panel thinks one step is selected
- the replay context points somewhere else
- the evidence rail builds its own interpretation
- the agent rail shows stale branch semantics

### 11.8 Workspace replay contract

For the current host VA, trace selection should continue to mean:

1. resolve target step by `selectedTraceStepId`
2. replay to `resultStateId` if one exists
3. restore focused widget when recoverable from interaction bindings
4. preserve `traceNavigationTarget` only as transient emphasis metadata
5. let right-side panels re-read normalized trace state after replay

Important:

- `traceNavigationTarget` is not a replay primitive
- `selectedSegment` is not a replay primitive
- branch narrative is not a replay primitive

The only canonical replay anchor remains the selected step and its resolved state lineage.

### 11.9 Segment collapse / expand contract

Segment collapse is a trace-density affordance, not a provenance rewrite.

Current contract:

1. collapse state lives in app UI state as `collapsedTraceSegmentIds`
2. collapsing a segment does not change runtime trace records
3. collapsing a segment does not change `selectedTraceStepId`
4. collapsing a segment does not change replay lineage or branch semantics
5. segment click still routes through `selectTraceStep(endStepId)`
6. collapsed segments may visually compress interior steps, but the terminal step remains the primary replay anchor

Current implementation strategy:

- the segment chip remains visible
- interior steps in a collapsed segment may be visually compressed or removed from the primary render projection
- selected/current steps remain readable even when their surrounding segment is collapsed

This is intentionally conservative.

It gives long-session density relief without introducing a second replay model or a speculative aggregation layer too early.

### 11.10 Render-level aggregation contract

The current system now distinguishes between:

1. canonical provenance objects
2. render-level aggregated objects

Canonical provenance remains:

- `steps`
- `nodes`
- `edges`
- `segments`

Render-level aggregation may derive:

- `renderNodes`
- `renderEdges`
- path-level render chips / summaries

Rules:

1. render-level aggregation may hide or compress interior steps from the default view
2. render-level aggregation must not mutate canonical `steps/nodes/edges`
3. `selectTraceStep(stepId)` remains valid even if a step is not currently rendered in full
4. selected/current steps should stay recoverable in the render projection
5. branch lineage should remain interpretable after compression

This is the transition point from simple collapse controls to true long-session path aggregation.

### 11.11 Branch-level path summarization

The current trace should now support a path-first reading mode at the branch level.

Expected behavior:

1. each branch exposes a compact path summary
2. the path summary communicates how many segments and steps belong to that path
3. the path summary carries lightweight actor/state/evidence/handoff/branch-entry cues
4. the path summary stays subordinate to replayable step semantics

This means:

- users can first scan the branch/path layer
- then inspect segments within a chosen path
- then replay or inspect exact steps when needed

## 12. Visual encoding rules

### 12.1 Overall style

The system should keep the established blue-white academic VA tone:

- light background
- restrained borders
- blue-family emphasis
- clear but low-noise structure

Avoid:

- saturated rainbow branch colors
- heavy card stacks
- overly large annotation blocks inside the trace

### 12.2 Actor encoding

Recommended:

- human: darker slate-blue
- agent: lighter cyan-blue

Actor should be noticeable but should not overpower topology.

### 12.3 Branch encoding

Recommended:

- stream divergence
- branch rail offset
- continuous branch flow span within the branch band
- branch tag near entry
- compact fork-origin annotation near branch start
- branch edge treatment stronger than ordinary sequence edges
- active branch focus should explain which earlier step the branch forked from when origin lineage is available

### 12.4 State/evidence encoding

Recommended:

- `hasStateDelta`: small token, underline, or low-profile badge
- `hasEvidence`: tiny dot, corner chip, or upper token

Do not convert these into separate structural lines.

### 12.4a Segment summary encoding

Segments should be readable as compact analytical units before the user drills back into steps.

Recommended compact summary cues:

- dominant actor cue
- branch-entry cue
- handoff cue
- state-change cue
- evidence cue

These cues should stay:

- lightweight
- low-saturation
- secondary to the overall path structure

They exist to help the user read aggregated analysis rhythm, not to replace node-level provenance.

### 12.5 Density

Default visible node content should stay minimal:

- step number
- short label
- actor cue
- state/evidence cue

Detailed explanation belongs in the right rail.

## 13. Current implementation status

### 13.1 Done

- runtime lineage fields added and normalized
- trace-driven workspace replay selection added
- branch-aware view model added
- findings now capture provenance references
- bottom trace moved away from pure segment-grid semantics
- tests cover lineage preservation, replay selection, branch normalization

### 13.2 In progress

- trace visual language still needs to become more compact and more stream-like
- branch/path rendering still needs visual refinement
- selected node replay should later support richer “restore exact analytical context” semantics
- provenance-target jumps now need to mature from transient highlight into stronger branch-aware navigation cues

Current implemented refinement:

- branch bands now carry enough metadata to render continuous provenance flow spans
- branch bands can render compact fork-origin annotations keyed to historical step numbers
- selected branch and active replay branch can be emphasized separately
- node density is further reduced by pushing repeated step semantics into tokens/tooltip instead of repeating full meta text
- trace now derives a first segment layer so contiguous same-branch progress can be surfaced without replacing raw step nodes
- multi-step segments are now clickable and route through the existing trace-step selection/replay path
- segment boundaries now reflect a first notion of analysis rhythm rather than only raw branch switches
- segment context is now surfaced in analysis rails as part of the unified provenance summary
- trace now tracks segment membership at node level so later density-management passes can stay aligned with replay semantics
- trace now supports a first collapse/expand skeleton through app-level `collapsedTraceSegmentIds` without changing raw trace or replay behavior
- collapsed segments can compress interior nodes into minimal anchors while preserving the end-step replay anchor
- trace layout now distinguishes canonical provenance nodes from render-level aggregated nodes/edges, so long-session compression can evolve without rewriting trace semantics
- segment chips now expose compact summary cues for actor dominance, branch entry, handoff, state change, and evidence so aggregated paths remain interpretable before step-level drill-down
- branch-aligned path summaries now expose path-level segment/step counts plus compact semantic cues so the trace can be read path-first before segment drill-down
- right-side analysis rails now consume selected path context as part of the unified provenance summary, so path-first reading is not isolated to the bottom trace surface

### 13.3 Not done yet

- multi-branch density management for long sessions
- true path aggregation / interactive segment-level summarization beyond the current collapse skeleton
- richer, theory-backed segmentation heuristics for longer analytical narratives
- explicit branch naming UX
- timeline zoom/scale controls inside trace
- richer evidence overlays on provenance stream

## 14. Development phases

### Phase 1. Runtime semantic normalization

Goal:

- make branch and replay semantics deterministic

Status:

- largely done

Tasks:

1. preserve lineage fields for both human and agent steps
2. keep replay-derived branch context stable across subsequent actions
3. maintain backward compatibility only where current callers still require it

Acceptance:

- every step can be classified as continuation / handoff / branch
- replay-derived branch origin is inspectable

### Phase 2. Provenance graph contract

Goal:

- make trace normalization stable and reusable across UI surfaces

Status:

- partially done

Tasks:

1. keep `traceViewModel` as the single normalization boundary
2. expose `provenanceGraph`, `selection`, and `stats`
3. avoid leaking UI geometry into runtime or store layers

Acceptance:

- multiple panels can consume the same normalized contract
- tests prove branch summaries, selection context, and edge semantics

### Phase 2.5 Segment and density contract

Goal:

- make long-session compression possible without redefining replay semantics

Tasks:

1. keep `segments` derived from chronological trace plus lineage semantics
2. ensure segment selection reuses step replay rather than creating a parallel replay system
3. prepare for future collapse/expand by keeping segment ids, span, and node membership stable

Acceptance:

- segment summaries are reusable across trace and analysis rails
- later collapse logic can be added without changing raw trace recording
- step-grounded replay remains intact

### Phase 3. Stream UI refinement

Goal:

- improve readability and density of the bottom trace surface

Tasks:

1. reduce node visual bulk
2. improve branch flow readability
3. support drag/pan cleanly for longer sessions
4. make current/selected path more visually explicit
5. preserve transient provenance-target emphasis for branch origin and entry jumps

Acceptance:

- first glance reveals path progression and branch divergence
- trace remains readable without opening extra inspectors
- provenance jumps are visible enough that users can tell where a finding sent them

### Phase 4. Provenance-driven analysis panels

Goal:

- make right-side panels read selected trace context directly

Tasks:

1. show selected step summary in inspect/evidence/agent rails
2. allow finding navigation to restore trace/workspace context
3. keep provenance references visible but compact
4. distinguish general finding replay from explicit branch-origin / branch-entry navigation

Acceptance:

- a user can move from node -> state -> evidence without losing context
- a user can tell whether a saved finding came from the mainline or a fork, and can jump to both the fork source and branch entry

### Phase 5. Evaluation and agent-facing use

Goal:

- ensure trace can support human use, VLM use, and scaffolded agent use through the same runtime

Tasks:

1. expose stable trace reads to agent/runtime contracts
2. verify replay and provenance remain consistent after agent actions
3. support later evaluation across mainline and branch paths

Acceptance:

- different agent styles can consume the same environment trace semantics

## 15. Testing and verification

### 15.1 Required tests

At minimum keep coverage for:

- runtime lineage preservation
- replay-derived branch context stability
- trace-step selection replay
- finding-to-trace provenance navigation
- trace view-model branch normalization

### 15.2 Current key test files

- `apps/widgetva-system/src/runtime/runtimeBridge.test.js`
- `apps/widgetva-system/src/app/appStore.test.js`
- `apps/widgetva-system/src/trace/traceViewModel.test.js`

### 15.3 Build gate

Required project verification after trace changes:

1. `npm exec -- node --test src/trace/traceViewModel.test.js`
2. targeted app/runtime trace tests when semantics changed
3. `npm run build`

## 16. Design constraints for future contributors

When extending Trace:

- do not add branch semantics only in UI
- do not replace replay lineage with text heuristics
- do not store rich panel-only state in runtime trace steps
- do not inflate node content until the trace becomes a card list again
- do not treat actor switch as equivalent to branch

When in doubt:

- lineage first
- replayability second
- UI decoration third

## 17. Near-term next actions

Recommended execution order from here:

1. keep `traceViewModel` as the single normalization contract and avoid duplicating provenance derivation in rails
2. continue shrinking visual bulk in `TracePanel`
3. tighten selected/current path emphasis
4. improve branch rendering so mainline vs fork is clearer at a glance
5. connect trace selection to richer workspace restoration semantics
6. later add path aggregation for long-session traces

This keeps the core contribution in the right order:

- provenance semantics first
- reusable runtime contract second
- higher-level agent evaluation and scaffold work third
