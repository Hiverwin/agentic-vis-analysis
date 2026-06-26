# WidgetVA Agent-Facing Runtime Contract

## Overview

This document defines the `agent-facing runtime contract` for `widgetva-kit`.

The goal of this contract is not to encode one specific agent loop.
The goal is to define a stable VA environment surface that can support:

- a bare VLM calling tools directly
- this project's closed-loop scaffold
- other agent frameworks built by future users

This contract therefore describes the environment, not the policy.

It defines:

- what an agent can observe
- what an agent can do
- how the current runtime state is exposed
- how results can be verified over multiple rounds

---

## Problem Statement

If the interface is shaped around one scaffold, then:

- bare VLM use becomes awkward
- other agent frameworks need adapter glue
- the environment leaks policy assumptions

If the interface is too renderer-specific, then:

- the contract becomes tied to Vega/Vega-Lite details
- widget semantics do not transfer cleanly across hosts
- it becomes hard to compare different agents fairly

The runtime contract should instead be:

- widget-centric
- agent-agnostic
- multi-turn
- verification-friendly
- stable across different agent policies

---

## Design Goal

The contract should let an agent repeatedly execute this loop:

1. observe the current VA environment
2. interpret the current workspace state
3. take one action or query
4. verify what changed
5. continue from the updated state

This means the contract must expose four surfaces:

- `observe`
- `act`
- `state`
- `verify`

These are not scaffold steps.
They are the minimum environment surfaces needed by any iterative agent.

---

## Compatibility Target

The same contract must support all three of these consumers:

### 1. Bare VLM

A plain VLM should be able to:

- inspect workspace structure
- inspect widget state
- call actions and queries directly
- read verification output
- decide the next step without any scaffold-specific helper

### 2. Closed-Loop Scaffold

The project scaffold should be able to:

- plan over the same environment
- call the same tools
- use the same state/trace feedback
- add reflection, retry, branching, and critique on top

### 3. Other Agent Frameworks

Other users should be able to:

- plug in different memory systems
- plug in different planners
- plug in different orchestration strategies
- still operate the same environment without changing the contract

This means the contract must remain `agent-agnostic`.

---

## Core Contract Principle

The contract should describe:

- environment capabilities
- semantic widget/workspace operations
- runtime-visible state
- verifiable outcomes

The contract should not describe:

- planning strategy
- critique strategy
- reflection prompts
- stopping policy
- agent loop order

Those belong to the agent layer, not the environment layer.

---

## Contract Surface 1: Observe

### Purpose

Observation gives the agent a readable model of the current VA environment.

### Required capabilities

- `describeWorkspace`
- `readView`
- `readState`
- `readTrace`
- widget/data/link/coordination descriptors

### Observe output must include

- workspace identity
- widget list
- widget kinds
- widget refs
- data handles
- link structure
- supported action descriptors
- supported perception descriptors
- supported data-query descriptors
- coordination capabilities

### Observe should answer

- what widgets exist
- what each widget can do
- what data is currently available
- what coordination paths exist across widgets
- what runtime features are available in this workspace

### Constraint

Observe output should stay semantic.
It should not require the agent to understand raw renderer internals.

---

## Contract Surface 2: Act

### Purpose

Action lets the agent change the VA environment intentionally.

### Required capabilities

- `executeAction`
- `queryPerception`
- `runDataQuery`

### Optional advanced capabilities

- `jumpToState`
- `branchFromState`
- `replay`

### Action must be semantic

Actions should describe analyst intent, for example:

- select
- filter
- highlight
- zoom
- compare
- annotate
- change encoding

They should not require direct spec patch authoring from the agent.

### Action input model

All targeting should be expressed through `queryScope` or direct contract fields already normalized to the same semantic model.

The environment should not require the agent to use legacy targeting fields such as:

- top-level `targetRef`
- `params.targetRef`
- `params.targetDataRef`

### Constraint

Action must remain composable.
An agent should be able to call one operation at a time without assuming a fixed scaffold loop.

---

## Contract Surface 3: State

### Purpose

State gives the agent a stable answer to: "what is true right now?"

### Required state slices

- current focused widget
- selection registry
- primary selection
- shared filters
- highlight state
- viewport state
- annotations
- comparison targets
- current branch/state identifiers

### Why state matters

Without state, an agent cannot do multi-round analysis.
It would only issue disconnected tool calls.

With state, an agent can:

- continue from previous steps
- understand whether an action changed the workspace
- compare current state to earlier state
- decide whether to branch, roll back, or continue

### State requirement

Important coordination state must be readable from the runtime.
It cannot stay hidden inside frontend-only implementation details.

---

## Contract Surface 4: Verify

### Purpose

Verification gives the agent evidence about whether a step succeeded and what it changed.

### Required verification outputs

- action result
- perception result
- data-query result
- affected refs
- updated refs
- verification hints
- state delta or observable state change
- interaction trace entry

### Verify should answer

- did the operation succeed
- what widget(s) or shared state changed
- what evidence was produced
- what the agent should inspect next if it wants stronger confirmation

### Constraint

Verification should be local and incremental.
An agent should not need to rerun a full workspace description after every step just to know whether one action worked.

---

## Multi-Turn Requirement

This contract must support iterative analysis, not only one-shot use.

That means:

- `observe` must be repeatable
- `state` must persist across calls
- `act` must update current state rather than reset it
- `verify` must expose enough information to choose the next step

The minimal environment loop is:

1. `describeWorkspace` or `readState`
2. `executeAction` or `queryPerception`
3. inspect `result + verification`
4. `readState` again
5. continue or stop

If that loop works, the contract supports iterative VLM analysis.

---

## Query Scope Requirement

`queryScope` is the normalized targeting model for the contract.

### Canonical fields

- `widgetRef`
- `dataRef`
- `selectionRef`
- `focusRef`
- `viewportRef`

### Why this matters

This keeps targeting stable across:

- actions
- perception queries
- data queries
- host runtime state

It also prevents each consumer from inventing different targeting conventions.

### Contract rule

`queryScope` is first-class.
Legacy targeting fields should not be part of the public contract.

---

## Non-Goals

This contract does not attempt to define:

- planning prompts
- reflection prompts
- critique templates
- task decomposition rules
- memory policy
- branch-selection policy
- reward model or evaluator policy

Those belong above the runtime contract.

---

## What Should Remain Widget-Specific

The runtime contract should be common, but not everything must be fully uniform.

Widget-specific extensions are allowed for:

- chart-family-specific action params
- widget-specific perception outputs
- structured data contracts such as Sankey-specific inputs

What must stay common is the environment shape:

- observe surface
- act surface
- state surface
- verify surface
- query scope semantics

---

## Minimum VLM-Safe Contract

The minimum contract that should work for a bare VLM is:

- `describeWorkspace`
- `readState`
- `executeAction`
- `queryPerception`
- `runDataQuery`
- `readTrace`

Plus the following guarantees:

- targeting is normalized through `queryScope`
- results contain verification-friendly output
- shared state can be reread after each step

If a bare VLM can operate using only these capabilities, the contract is likely agent-agnostic enough.

---

## Optional Advanced Contract

The following capabilities are useful but should remain optional:

- `jumpToState`
- `branchFromState`
- `replay`
- richer verification payloads
- richer topology summaries
- benchmark-specific evaluation hooks

These should enhance advanced scaffolds without being required by the minimal contract.

---

## Acceptance Criteria

The contract is in a good state when all of the following are true:

1. A bare VLM can inspect, act, and verify over multiple rounds using the same environment surface.
2. The project scaffold can use the same environment surface without requiring scaffold-specific runtime methods.
3. Another agent framework could reuse the same environment surface without adapter logic for targeting semantics.
4. Shared coordination state is readable without frontend-only hidden state.
5. The public contract uses `queryScope` rather than legacy target fields.
6. Verification output is strong enough to support closed-loop analysis.

---

## Immediate Implementation Guidance

The next implementation phase should proceed in this order:

### Phase A: Freeze the current environment surface

Stabilize:

- `describeWorkspace`
- `readState`
- `readTrace`
- `executeAction`
- `queryPerception`
- `runDataQuery`

### Phase B: Ensure state completeness

Confirm the runtime exposes:

- selection
- focus
- highlight
- viewport
- annotations
- comparison targets

### Phase C: Validate multi-turn behavior

Test that agents can:

1. observe
2. act
3. verify
4. reread state
5. continue

### Phase D: Add scaffold on top

Only after the environment surface is stable should the paper scaffold be attached.

The scaffold should consume this contract, not redefine it.

---

## Relationship to the Paper

This contract supports the paper structure cleanly:

- `main contribution`
  a widget-centric interface and runtime environment more suitable for agent-operated VA

- `system contribution`
  an agent-agnostic runtime contract that multiple agent styles can share

- `validation contribution`
  a closed-loop scaffold showing that stronger agent behavior emerges on top of the same contract

This keeps the paper from collapsing into "we built one scaffold and one demo."

---

## Summary

The agent-facing runtime contract should be defined as a reusable VA environment with four stable surfaces:

- `observe`
- `act`
- `state`
- `verify`

This is the right level because it is:

- strong enough for multi-round VLM analysis
- general enough for different agent frameworks
- narrow enough to avoid embedding scaffold policy into the runtime

The runtime should expose the environment.
The scaffold should expose the strategy.
