# WidgetVA Human-Agent Trace Panel Plan

## Overview

This document defines the frontend design and implementation plan for making `human-agent interaction` visible inside `apps/widgetva-system/`.

The key shell decision is:

- the `bottom Trace Panel` becomes the primary surface for interaction trajectory
- the `right Analysis Rail` keeps only `Agent Chat`, inspection, evidence, and controls

This is not a generic log viewer.
It is a visual analytics process surface that must make three things legible:

1. who acted
2. what state changed
3. how control moved between human and agent

---

## Product Decision

### Stable shell

Keep the current shell structure:

- `Setup Rail`
- `Workspace Stage`
- `Analysis Rail`
- `Trace Drawer`

### Right rail role

The right rail should no longer try to visualize the full runtime trajectory.

It should focus on:

- `Agent Chat`
- current agent step summary
- inspection details for the selected trace node
- evidence capture
- explicit controls such as `interrupt`, `replay`, `reset`

### Bottom drawer role

The bottom `Trace Drawer` becomes the canonical place for:

- human interaction history
- agent interaction history
- handoff moments
- state changes
- replay and branch entry points

---

## Design Goal

The panel must let a user answer these questions quickly:

- did the human or the agent do this step
- what widget did the step target
- was the step an action, perception, or data query
- what state changed after the step
- did the other side respond to that state
- where can I replay, branch, or inspect from here

The panel should feel like an `analysis trajectory viewer`, not a terminal log.

---

## Recommended Visualization Model

### Primary structure

Use a `dual-lane horizontal timeline`.

- upper lane: `Human`
- lower lane: `Agent`

Steps flow from left to right.

This gives immediate visibility into:

- control continuity
- control switching
- long agent runs
- human intervention points

### Why not a pure node-link graph

A pure node-link graph with only blocks and Bezier curves will become hard to scan once the session grows.

It is weak at:

- step ordering
- comparing human and agent rhythm
- showing repeated state deltas
- supporting replay/jump workflows

So the graph element should remain secondary.

### Secondary structure

Use `light Bezier links` only as continuity cues:

- same-lane links for continuous control
- cross-lane links for handoff
- dashed links for verify-follow-up relationships

This keeps the timeline readable while still showing interaction dependency.

---

## Visual Semantics

### Lanes

#### Human lane

- top row
- lighter blue stroke
- softer fill
- rounded rectangle nodes

#### Agent lane

- bottom row
- deeper cyan or steel-blue stroke
- slightly sharper geometry
- clipped or chamfered corner nodes

This creates actor distinction without introducing a second palette family.

### Node categories

Each trace node represents one runtime step.

#### Action node

- solid fill
- icon: pointer / move / zoom / filter
- examples:
  - `scatter.brushRegion`
  - `workspace.focusWidget`
  - `line.filterPhase`

#### Perception node

- outlined node
- icon: eye / inspect
- examples:
  - `perception.verifyActionEffect`
  - `perception.summarizeVisible`

#### Data query node

- outlined node with denser top border
- icon: table / sigma
- examples:
  - `summary`
  - `compareGroups`

#### Replay or branch node

- split-edge or fork marker
- icon: rewind / branch

### Node status

- `ok`: blue border
- `running`: animated glow line
- `failed`: red border with pale red wash
- `partial`: amber border

### State delta strip

Each node gets a narrow delta strip underneath.

Suggested delta tokens:

- `S` selection
- `F` focus
- `H` highlight
- `V` viewport
- `E` evidence
- `B` branch or replay
- `L` link propagation

Rules:

- filled token means changed
- outlined token means read but unchanged
- absent token means not involved

This gives dense information without expanding card size.

### Handoff links

Cross-lane links represent human-agent interaction explicitly.

#### Human to agent

Use when:

- human action is followed by agent perception or action
- agent continues from a human-produced selection, focus, or viewport

#### Agent to human

Use when:

- human interrupts
- human corrects an agent branch
- human accepts and continues an agent-produced context

Cross-lane links should carry small state badges such as:

- `selection carried`
- `focus carried`
- `viewport changed`
- `evidence added`

---

## Information Density Rules

The panel should be dense and compact.

### Default node content

Each node should show only:

- actor
- type
- target widget title
- one-line action summary
- status marker
- delta strip

Example:

- `Human`
- `Action`
- `Horsepower vs MPG`
- `Brushed mid-range horsepower band`

### Expanded node content

When selected, the node inspector should show:

- `callId`
- runtime method name
- `queryScope`
- input params
- result summary
- updated refs
- state delta
- verification evidence
- replay target if available

This keeps the timeline readable while preserving inspectability.

---

## Panel Layout

### Drawer composition

The `Trace Drawer` should be split into three vertical zones:

1. `Trace Header`
2. `Timeline Canvas`
3. `Trace Inspector`

### 1. Trace Header

Contains:

- session mode badge: `Manual / Copilot / Autonomous`
- lane legend
- timeline density controls
- trace filter chips:
  - `All`
  - `Human`
  - `Agent`
  - `Actions`
  - `Perceptions`
  - `Queries`
  - `Replay`
- compact summary:
  - total steps
  - total handoffs
  - current branch

### 2. Timeline Canvas

Contains:

- two horizontal lanes
- node sequence
- links
- branch markers
- viewport for horizontal scrubbing

This region should prioritize scan speed over long text.

### 3. Trace Inspector

Shows details for the selected node.

Tabs:

- `Summary`
- `Params`
- `Delta`
- `Evidence`

This inspector can sit inside the drawer on the right side of the timeline, or collapse beneath it on narrow widths.

---

## Right Rail Design

The right rail should be simplified around `Agent Chat`.

### Keep

- `Agent Chat`
- current agent step status
- interrupt and resume controls
- selected trace node inspector
- evidence panel

### Remove from right rail

- long execution history
- trace list duplication
- replay history list as primary structure

### Right rail sections

1. `Agent Chat`
2. `Current Step`
3. `Selected Trace Detail`
4. `Evidence`
5. `Controls`

This keeps the right side conversational and operational, while the bottom remains temporal.

---

## Data Model Requirements

The current runtime trace needs a normalized view model for UI.

### Trace step shape

Recommended view model:

```js
{
  id: 'trace_014',
  actor: 'human' | 'agent',
  kind: 'action' | 'perception' | 'data_query' | 'replay' | 'branch',
  status: 'running' | 'ok' | 'failed' | 'partial',
  timestamp: '2026-06-20T10:30:00.000Z',
  summary: 'Brushed high-horsepower region',
  methodName: 'scatter.brushRegion',
  widgetRef: 'wl://.../widget/scatter_a',
  widgetTitle: 'Horsepower vs MPG',
  callId: 'step_14',
  queryScope: {
    widgetRef: 'wl://.../widget/scatter_a',
  },
  updatedRefs: ['wl://.../widget/scatter_a'],
  stateDelta: {
    selection: true,
    focus: false,
    highlight: false,
    viewport: true,
    evidence: false,
    branch: false,
    propagation: true,
  },
  handoffFrom: 'trace_013' | null,
  handoffKind: 'human_to_agent' | 'agent_to_human' | null,
  verificationSummary: 'Selection applied to 14 points',
  evidenceSummary: 'Selected cluster has lower MPG',
}
```

### Derived UI data

The app store should derive:

- lane grouping
- handoff edges
- branch boundaries
- delta counts
- active step
- selected step

---

## Interaction Model

### Default interactions

#### Hover node

- highlight the node
- highlight its outgoing edge
- outline the target widget in the workspace
- show compact tooltip

#### Click node

- select node
- populate `Trace Inspector`
- sync `Inspect` panel context to that widget and step

#### Double click node

- trigger replay preview
- show `jump to here` affordance

### Handoff inspection

Hovering a cross-lane link should show:

- source step
- destination step
- carried state:
  - selection
  - focus
  - viewport
  - evidence

### Replay affordances

Each node should expose:

- `Replay from here`
- `Branch from here`
- `Inspect delta`

These should appear as compact hover tools, not permanent buttons.

---

## Responsive Rules

### Desktop

- full dual-lane horizontal timeline
- right-side inspector inside drawer
- fixed lane labels

### Narrow laptop

- lanes remain horizontal
- inspector collapses below timeline
- header summary compresses into chips

### Avoid

- stacking every node vertically
- turning the trace into a long list
- moving the whole trace into the right rail

The drawer should remain a temporal surface, even when compressed.

---

## Blue-White Style Direction

The trace panel must follow the current blue-white research system style.

### Token guidance

- background: soft white to pale blue
- lane backgrounds: faint blue bands
- link color: cool blue-gray
- active node: saturated blue edge
- agent emphasis: deeper blue-cyan, not purple
- error: restrained coral-red

### Typography

- smaller than current shell default
- compact labels
- strong contrast between method label and summary
- avoid oversized panel headings

### Motion

- subtle step reveal
- animated running edge for current agent step
- gentle highlight on replay hover

Avoid decorative motion unrelated to analysis progress.

---

## Component Architecture

Recommended file structure under `apps/widgetva-system/src/trace/`:

- `TraceDrawer.jsx`
- `TraceTimeline.jsx`
- `TraceLane.jsx`
- `TraceStepNode.jsx`
- `TraceEdgeLayer.jsx`
- `TraceInspector.jsx`
- `TraceFilters.jsx`
- `traceViewModel.js`
- `traceLayout.js`

### Responsibilities

#### `TraceDrawer.jsx`

- shell and layout
- header controls
- selected node coordination

#### `TraceTimeline.jsx`

- timeline viewport
- lane composition
- edge layer composition

#### `TraceLane.jsx`

- render one actor lane
- spacing and per-lane grouping

#### `TraceStepNode.jsx`

- node visuals
- delta strip
- hover and selection states

#### `TraceEdgeLayer.jsx`

- same-lane links
- handoff links
- branch markers

#### `TraceInspector.jsx`

- expanded detail panel
- params, delta, evidence, replay actions

#### `traceViewModel.js`

- normalize runtime trace into UI nodes and edges

#### `traceLayout.js`

- node positioning
- lane offsets
- edge routing

---

## App State Changes

Recommended additions in `apps/widgetva-system/src/app/appStore.js`:

- `traceSteps`
- `selectedTraceStepId`
- `hoveredTraceStepId`
- `traceFilters`
- `traceDensity`
- `traceViewMode`

Recommended selectors:

- `selectTraceTimelineNodes`
- `selectTraceTimelineEdges`
- `selectSelectedTraceStep`
- `selectTraceSummary`
- `selectTraceCurrentAgentStep`

---

## Development Plan

### Phase 1: Trace data normalization

#### Task 1

Build `traceViewModel.js`.

Acceptance criteria:

- normalize raw runtime trace into node records
- derive actor lane, step kind, status, and target widget
- derive state delta tokens

Verification:

- unit tests for node normalization
- unit tests for handoff detection

Files likely touched:

- `apps/widgetva-system/src/trace/traceViewModel.js`
- `apps/widgetva-system/src/app/appStore.js`
- `apps/widgetva-system/src/runtime/runtimeBridge.js`

### Phase 2: Timeline foundation

#### Task 2

Replace the current trace list surface with a dual-lane timeline.

Acceptance criteria:

- render human and agent lanes
- render nodes in time order
- render same-lane and cross-lane links
- selected node state works

Verification:

- browser check in Chrome
- no overflow or unreadable collisions at typical session lengths

Files likely touched:

- `apps/widgetva-system/src/trace/TraceTimeline.jsx`
- `apps/widgetva-system/src/trace/TraceLane.jsx`
- `apps/widgetva-system/src/trace/TraceStepNode.jsx`
- `apps/widgetva-system/src/styles/layout.css`

### Phase 3: Inspector and replay affordances

#### Task 3

Add node inspector and replay actions.

Acceptance criteria:

- click node opens inspector
- hover reveals replay and branch affordances
- selected node syncs with right-side inspection context

Verification:

- manual replay flow works
- inspector updates without layout jump

Files likely touched:

- `apps/widgetva-system/src/trace/TraceInspector.jsx`
- `apps/widgetva-system/src/layout/TraceDrawer.jsx`
- `apps/widgetva-system/src/analysis/InspectPanel.jsx`

### Phase 4: Right rail simplification

#### Task 4

Convert the right rail to `Agent Chat + current step + detail`.

Acceptance criteria:

- agent panel becomes chat-first
- long trace duplication removed
- current agent step stays visible during execution

Verification:

- right rail remains useful without timeline duplication
- trace drawer still carries all historical flow

Files likely touched:

- `apps/widgetva-system/src/analysis/AgentPanel.jsx`
- `apps/widgetva-system/src/layout/AnalysisRail.jsx`

### Phase 5: Polish and density tuning

#### Task 5

Tune density, node size, labels, hover behavior, and motion.

Acceptance criteria:

- compact on Chrome laptop viewport
- no oversized text
- no unnecessary white space
- clear state delta readability

Verification:

- manual visual QA at 1440px, 1280px, and 1024px widths

Files likely touched:

- `apps/widgetva-system/src/styles/base.css`
- `apps/widgetva-system/src/styles/layout.css`
- `apps/widgetva-system/src/styles/tokens.css`

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Timeline turns into decorative graph | High | Keep timeline as primary structure and use links only as secondary cues |
| Too many labels reduce readability | High | Default to one-line summaries and move details into inspector |
| Human and agent look too similar | Medium | Separate lane placement, node geometry, and link treatment |
| Trace data lacks explicit handoff metadata | High | Derive handoff from actor switch plus carried state refs in view model |
| Drawer becomes vertically heavy | Medium | Keep inspector collapsible and use compact header chips |

---

## Immediate Implementation Slice

The correct first slice is:

1. normalize trace data into `human/agent` lane nodes
2. render a static dual-lane timeline
3. add node selection and compact inspector

Do not start with:

- animated curves
- branch visualization
- heavy replay controls
- detailed agent reasoning transcript

Those belong after the timeline foundation is stable.
