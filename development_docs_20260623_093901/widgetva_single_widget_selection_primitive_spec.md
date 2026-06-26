# WidgetVA Single-Widget Selection Primitive Spec

Date: 2026-06-23

## Purpose

This document freezes the first `single-widget` primitive slice:

> `selection`

The goal of this slice is not to define every future interaction variant.
The goal is to make sure one primitive family is already rigorous enough to support:

- widget-local structured action calls
- canonical widget state mutation
- stable observation for planning
- stable verification for agent execution

This is the first primitive because later `filter`, `zoom`, and `multi-widget` coordination all depend on local selection semantics being trustworthy.

## What Counts As `selection`

In the single-widget core, `selection` means:

> an agent or user identifies a subset of marks, rows, categories, records, or regions within one widget, and that subset becomes explicit widget-readable state.

At this layer, selection is not yet multi-widget coordination.
It is also not renderer-specific brush implementation.

This layer defines:

- what kind of subset was selected
- how that subset is represented in widget state
- how the widget reports the active selection back to the agent
- how the runtime verifies that the action took effect

## Supported Selection Forms

The current repository already supports the following widget-local selection forms:

- `category`
  bar, line, sankey
- `interval`
  scatter, parallel coordinates
- `cell`
  heatmap
- `region`
  heatmap submatrix selection
- `record`
  parallel coordinates record selection
- `aggregate`
  sankey aggregate-node selection

These are not separate primitive families.
They are widget-specific forms of the shared `select` primitive.

## Canonical State Effect

The canonical state effect of `selection` is:

- widget-local selection entries are written under `state.selections`
- shared selection views are derived by the runtime from those local entries
- widget observation exposes the currently active local selection in a normalized summary form

The minimum state fields expected for an active local selection are:

- `kind`
- `sourceWidgetRef`
- `sourceWidgetId`
- `fields` when field-based selection exists
- `value` when a value payload exists
- `predicates` when the selection implies data predicates
- `summary`

This means an agent does not need to infer selection from pixels.
It can read structured selection state directly.

## Current Action Surface

The existing widget actions that instantiate the `select` primitive are:

- `bar.selectCategory`
- `line.selectSeries`
- `line.selectXValue`
- `scatter.brushRegion`
- `heatmap.selectCell`
- `heatmap.selectSubmatrix`
- `parallelCoordinates.brushAxes`
- `parallelCoordinates.selectRecord`
- `sankey.selectAggregateNode`

This mapping is already encoded in [widgetva-kit/src/widgets/actionPrimitiveMap.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/widgets/actionPrimitiveMap.js:1).

## Observation Contract

The stable observation entry point is `WidgetInstance.readObservation()`.

For `selection`, the required observation fields are:

- `selection.contract`
- `selection.localSelectionCount`
- `selection.activeSelectionRef`
- `selection.activeSelectionKind`
- `selection.activeSelectionSummary`
- `selection.activeSelectionFields` when applicable

The widget-local contract source is [widgetva-kit/src/widgets/localSelectionContract.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/widgets/localSelectionContract.js:1).

This is the surface the planner should read before choosing a selection action.

## Verification Contract

The stable verification surfaces for `selection` are:

- `WidgetInstance.readVerificationState()`
- `perception.summarizeSelection`
- `perception.verifyActionEffect`

Minimum success evidence:

- `verification.checks.selectionApplied === true`
- `verification.selections.count >= 1`
- `perception.summarizeSelection.result.hasSelection === true`
- `perception.verifyActionEffect.result.verified === true`

This gives the agent both a lightweight state check and a stronger post-action verification path.

## Boundaries Of This Slice

This slice intentionally does not freeze:

- multi-widget propagation semantics
- target-side highlight/filter policy
- renderer-specific Vega/D3/ECharts mutation logic
- planner heuristics for deciding which widget to operate
- the full clear/reset lifecycle of all future selection variants

Those are later stages.
This slice only guarantees that setting a widget-local selection is structured, readable, and verifiable.

## What Is Already Implemented Correctly

The following parts already exist and are reused as-is:

- widget-local selection contracts
- widget action descriptors with primitive `select`
- widget action execution for local selection writes
- observation exposure through `readObservation()`
- verification exposure through `readVerificationState()`
- perception support through `summarizeSelection` and `verifyActionEffect`

This slice should not rewrite those parts unless a concrete contract bug appears.

## Completion Gate For Primitive 1

`selection` counts as landed for the single-widget core when all of the following hold:

- at least one `category` selection path is validated end-to-end
- at least one `interval` selection path is validated end-to-end
- the agent-style loop can `observe -> act -> verify` without pixel interaction
- the verification evidence comes from widget/runtime state and perception, not ad hoc inspection

The current validation targets for this slice are:

- `bar.selectCategory`
- `scatter.brushRegion`

These two cases cover the two most important early archetypes:

- discrete categorical selection
- continuous spatial interval selection

Once this gate is stable, the next primitive can be started.
