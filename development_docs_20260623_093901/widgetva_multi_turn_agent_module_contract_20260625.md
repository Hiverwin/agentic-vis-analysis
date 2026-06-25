# WidgetVA Multi-Turn Agent Module Contract

## Scope

This document defines the next-step contract for the `agent module` that sits on top of WidgetVA.

It does **not** redefine the runtime from scratch.
It builds on capabilities that already exist in this repository:

- `apps/widgetva-system/src/runtime/runtimeBridge.js`
- `apps/widgetva-system/src/runtime/agentRuntime.js`
- `widgetva-kit/src/core/runtime/naturalLanguagePlanner.js`
- `widgetva-kit/src/core/runtime/pagePortAgentLoop.js`
- `widgetva-kit` widget/workspace observation, action, and perception surfaces

The purpose of this document is narrower:

1. define the formal entry points for a reusable agent module
2. separate `session knowledge` from per-turn `observation`
3. define the explicit per-turn fields:
   - `observe`
   - `plan`
   - `act`
   - `verify`
   - `reason`
4. support multi-turn execution without over-packing the return shape

This document should stay aligned with the current codebase and should not invent a separate architecture that the code does not need.

---

## What Already Exists

The repository already contains most of the low-level runtime surfaces needed by an agent module.

### Runtime-facing methods already exposed

Through `createAgentRuntimeContract(caseId)`, the app runtime already exposes:

- `describeWorkspace`
- `readObservation`
- `readCoordinationState`
- `readPropagationSummary`
- `readLatestCoordinationResult`
- `listAvailableActions`
- `listAvailablePerceptions`
- `listAvailableDataQueries`
- `describeAgentLoop`
- `describeActionUsage`
- `executeAction`
- `executeVerifiedAction`
- `queryPerception`
- `runDataQuery`
- `readTrace`
- `replay`

### Existing closed-loop scaffold

`apps/widgetva-system/src/runtime/agentRuntime.js` already implements a single-step scaffold with:

- `observe`
- `plan`
- execution
- verification
- `reason`

This means the current task is **not** to invent the first agent loop.
The task is to:

- cleanly expose the right entry points
- reduce payload clutter
- separate stable knowledge from per-turn observation
- make the loop reusable for multi-turn analysis

### Existing official-page natural-language loop

For official Vega / D3 pages, `widgetva-kit/src/core/runtime/naturalLanguagePlanner.js` and `runNaturalLanguagePagePortAgentLoop(...)` already provide:

- natural-language planning
- a one-step structured operation
- execution over a page port

This should be treated as one valid frontend integration path for the same agent module idea, not as a separate design.

---

## Formal Entry Points

The agent module should expose two formal entry points.

### 1. Single-turn entry

```ts
runAgentTurn(input) -> AgentTurnRecord
```

This entry performs exactly one round of:

```text
observe -> plan -> act -> verify -> reason
```

It is the atomic execution unit.

### 2. Multi-turn session entry

```ts
runAgentSession(input) -> AgentSessionResult
```

This entry repeatedly calls `runAgentTurn(...)` until one of the stop conditions is met.

It is the reusable agent-module entry that future users should integrate against when they want a complete agent experience rather than manual orchestration.

---

## Session Knowledge vs Turn Observation

This boundary is important and should stay clean.

### Session Knowledge

`session knowledge` is stable or slowly changing information that the agent should not need to fully re-read every turn.

It should be initialized once at session start and then updated only when needed.

Recommended contents:

```ts
type AgentSessionKnowledge = {
  workspace: {
    workspaceId: string | null,
    caseId?: string | null
  },
  widgets: Array<{
    ref: string,
    widgetId: string,
    kind: string,
    title: string | null,
    provider?: string | null
  }>,
  catalogs: {
    actionsByWidgetRef: Record<string, string[]>,
    perceptionsByWidgetRef: Record<string, string[]>,
    dataQueriesByDataRef?: Record<string, string[]>
  },
  loopHints: Record<string, unknown> | null,
  history: {
    turns: Array<{
      turnId: string,
      summary: string
    }>
  }
}
```

Notes:

- `catalogs` belongs here, not in per-turn observation.
- widget identity belongs here, not in every turn payload.
- this layer may be refreshed if the workspace materially changes, but it is not the primary per-turn observation output.

### Turn Observation

`observation` is the dynamic per-turn input.

It should contain only what the agent needs **right now** to decide the next step.

Recommended shape:

```ts
type AgentTurnObserve = {
  query: string,
  previousTurnSummary: string | null,
  focusWidgetRef: string | null,
  state: {
    summary: string | null,
    stateId: string | null,
    rawRef?: string | null
  },
  view: {
    snapshot: {
      ref: string | null,
      mimeType?: string | null,
      width?: number | null,
      height?: number | null
    } | null,
    summary: string | null
  },
  perception: {
    name: string,
    resultRef?: string | null,
    summary: string | null
  } | null
}
```

Notes:

- `view.snapshot` is the visual-modality entry.
- it is returned as a reference-based visual artifact, not as embedded base64.
- `view.summary` is optional supporting text, not a substitute for the image.
- `perception` only appears when the current turn actually used perception or is carrying forward a directly relevant perception result.

---

## Why the Visual Input Uses a Snapshot Reference

The agent module should treat the current visualization image as a first-class input.

However, the contract should not require every turn payload to inline image bytes.

The preferred pattern is:

```ts
view.snapshot.ref
```

where the runtime guarantees that:

1. a current-view visual artifact exists
2. the agent stack can resolve the reference into an actual image when needed

This keeps the contract reusable across:

- first-party app runtime
- official Vega / D3 page integrations
- future third-party transports

This document intentionally does not hard-code one storage or transport mechanism for snapshot resolution.

---

## Single-Turn Output Contract

Each turn should return exactly these top-level fields:

```ts
type AgentTurnRecord = {
  observe: AgentTurnObserve,
  plan: AgentTurnPlan,
  act: AgentTurnAct,
  verify: AgentTurnVerify,
  reason: AgentTurnReason
}
```

No extra top-level scaffolding fields should be required by the formal contract.

### Plan

Current direction is already close to the desired shape.

```ts
type AgentTurnPlan = {
  objective: string,
  step: {
    kind: 'action' | 'perception' | 'data_query',
    name?: string,
    queryScope?: {
      widgetRef?: string
    },
    params?: Record<string, unknown>,
    dataRef?: string,
    query?: Record<string, unknown>
  },
  rationale: string
}
```

Notes:

- `plan` is explicit and should stay explicit.
- this contract does not add a separate public `planningHints` surface.
- any internal planning support should stay internal unless it becomes truly necessary as a public contract element.

### Act

`act` should record what this turn actually executed.

```ts
type AgentTurnAct = {
  kind: 'action' | 'perception' | 'data_query',
  name: string,
  params?: Record<string, unknown>,
  queryScope?: {
    widgetRef?: string
  },
  ok: boolean,
  outputSummary: string | null,
  stateId: string | null,
  updatedRefs?: string[]
}
```

Notes:

- do not action-specialize this shape.
- the contract must support perception turns and data-query turns too.

### Verify

`verify` must support the next round.

It should therefore return both:

- structured check results
- a next-step hint

```ts
type AgentTurnVerify = {
  ok: boolean,
  summary: string,
  checks: {
    stepChoice: {
      status: 'pass' | 'fail' | 'uncertain',
      reason: string
    },
    params: {
      status: 'pass' | 'fail' | 'uncertain',
      reason: string
    },
    stateChange: {
      status: 'pass' | 'fail' | 'uncertain' | 'not_applicable',
      reason: string
    },
    visualChange: {
      status: 'pass' | 'fail' | 'uncertain' | 'not_applicable',
      reason: string
    }
  },
  nextStepHint: {
    kind: 'action' | 'perception' | 'answer' | 'stop',
    guidance: string
  } | null
}
```

Notes:

- `verify` is where retry guidance belongs.
- this structure should stay compact.
- `verify` should not be used as a place to expose developer-only materialization diagnostics.

### Reason

`reason` should stay minimal.

```ts
type AgentTurnReason = {
  answer: string
}
```

---

## Verification Execution Model

`verify` should not be treated as purely VLM-generated or purely rule-generated.

The current direction should be a hybrid model.

### Rule-driven checks

These should come from deterministic runtime evidence whenever possible:

- parameter presence / obvious validity
- before-state vs after-state change
- whether expected state slices changed
- whether a verification perception returned a positive result

This aligns well with existing runtime capabilities such as:

- `executeVerifiedAction`
- `queryPerception({ name: 'perception.verifyActionEffect', ... })`
- `readObservation()`
- `readLatestCoordinationResult()`

### Model-driven semantic judgment

The model should still help with:

- whether the chosen step actually matches the user query
- whether the observed change is analytically useful
- whether another action or perception should come next

This means `verify` should be constructed from:

1. deterministic runtime checks
2. optional semantic interpretation on top of those checks

This matches the current code direction better than a pure rule system or a pure free-form model response.

---

## Multi-Turn Session Contract

The formal multi-turn entry should return:

```ts
type AgentSessionResult = {
  ok: boolean,
  answer: string,
  stopReason: string,
  turns: AgentTurnRecord[]
}
```

The agent session loop should be free to iterate until one of these conditions holds:

- the user goal appears satisfied
- `verify.nextStepHint.kind === 'answer'`
- `verify.nextStepHint.kind === 'stop'`
- a maximum turn budget is reached
- the module concludes that no valid next step can be produced

This document does not hard-code the internal stopping algorithm further than that.

---

## How This Connects to Existing Code

This contract should be implemented by tightening and reorganizing current code, not by replacing it.

### Existing app runtime scaffold to reuse

`apps/widgetva-system/src/runtime/agentRuntime.js`

Already provides:

- observation summarization
- model planning call
- action/perception/data-query dispatch
- verification query fallback
- trace append
- one-step result object

What should change:

- split stable session knowledge from per-turn observation
- rename / reshape return fields to the explicit formal contract
- reduce payload clutter
- support a true session-level loop on top of the current step runner

### Existing runtime contract to reuse

`apps/widgetva-system/src/runtime/runtimeBridge.js`

Already provides the app-facing runtime methods that the session runner should call.

This is the current best base for:

- session knowledge initialization
- turn observation reads
- act/perception/data-query dispatch
- verification support

### Existing official-page loop to reuse

`widgetva-kit/src/core/runtime/naturalLanguagePlanner.js`

Already provides:

- natural-language step planning
- repair pass for malformed model output
- normalized one-step operation
- page-port loop entry

This should be aligned with the same formal turn contract where practical, rather than treated as unrelated logic.

---

## Recommended Development Sequence

### Step 1. Freeze the formal turn/session shapes in documentation

Do this before further implementation drift.

### Step 2. Refactor current single-step runtime return shape

Target:

- current `runOpenRouterAgentStep(...)`

So that it returns the formal:

- `observe`
- `plan`
- `act`
- `verify`
- `reason`

instead of the current mixed bundle.

### Step 3. Introduce session knowledge initialization

Add a reusable knowledge bootstrap built from:

- `describeWorkspace`
- `describeAgentLoop`
- action/perception/data-query catalogs

### Step 4. Add `runAgentSession(...)`

Implement a multi-turn wrapper over the single-turn runner.

### Step 5. Align official-page natural-language flows

Where practical, make the official Vega / D3 page natural-language loop return the same turn/session shape.

---

## Out of Scope

This document does not attempt to define:

- planner prompt wording as a public contract
- one fixed snapshot transport implementation
- provider-specific materialization details
- benchmark/evaluation protocol
- trace UI shape

Those can continue evolving as long as the agent-module boundary stays stable.

---

## Immediate Implication

The next implementation task is not “build a new agent system”.

The next implementation task is:

1. consolidate the current runtime step runner into the explicit turn contract
2. add stable session knowledge management
3. add a multi-turn session wrapper

That is the shortest path from the current codebase to a reusable agent module that other users can actually integrate.

---

## Acceptance Criteria

The agent-module work described here should be treated as complete only when the following acceptance criteria hold.

### A. Formal entry points exist

The implementation exposes:

- a single-turn entry equivalent to `runAgentTurn(...)`
- a multi-turn entry equivalent to `runAgentSession(...)`

Both entries should follow the documented contract shape closely enough that downstream callers do not need ad hoc field inspection.

### B. Single-turn payload is explicit and compact

A completed turn returns explicit top-level fields for:

- `observe`
- `plan`
- `act`
- `verify`
- `reason`

The returned payload should not require consumers to search through extra mixed scaffolding fields in order to understand the turn result.

### C. Knowledge and observation are separated

The implementation maintains a stable `session knowledge` layer and does not redundantly pack widget catalogs, action catalogs, and perception catalogs into every turn observation payload.

### D. Multi-turn loop is reusable

The multi-turn entry can execute repeated:

```text
observe -> plan -> act -> verify -> reason
```

rounds until a stop condition is reached, rather than only supporting one-shot execution.

### E. Vega official-page agent path works end-to-end

The final agent module must work on a real official Vega page, not only in isolated unit logic.

Minimum acceptance target:

- load the WidgetVA extension/integration on a Vega-Lite official example page
- configure the agent successfully
- submit a natural-language objective
- the agent produces a structured widget step
- the runtime executes the step through WidgetVA
- the Vega view changes accordingly
- the returned turn/session payload includes explicit `observe / plan / act / verify / reason`

### F. Vega real-page test passes

There must be at least one concrete validation path showing that the agent capability is usable on Vega in practice.

This can be satisfied through the project’s existing real-page acceptance path, as long as it demonstrates all of the following together:

- natural-language input
- structured WidgetVA operation generation
- runtime execution
- visible Vega view update
- verification result readback

The key requirement is not a synthetic mock-only pass used merely to fill an empty acceptance slot.
The key requirement is that the agent capability can actually be used on Vega and verified through testing.

### G. Development-side responsibility stays limited and clear

For this line of work, the implementation task is:

- complete the code changes
- add or update repository tests where appropriate
- provide explicit manual acceptance instructions for real-page verification

It is **not** required that every completion step include a browser end-to-end acceptance run performed by the developer during implementation.

In other words:

- development should land real code and real automated tests
- final real-page acceptance can be executed manually by the project owner or collaborator using the provided instructions
- acceptance standards should not be weakened by introducing placeholder mock-only logic solely to claim completion
