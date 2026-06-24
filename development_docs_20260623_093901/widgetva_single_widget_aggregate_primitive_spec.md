# WidgetVA Single-Widget Aggregate Primitive Spec

Date: 2026-06-23

## Purpose

This document freezes the seventh `single-widget` primitive slice:

> `aggregate`

The goal of this slice is to make aggregation-changing actions stable enough that an agent can request a coarser summary or aggregate-driven restructuring and then verify that:

- the widget spec now carries aggregate intent explicitly
- the widget verification state reports aggregate as an applied effect
- the resulting view semantics are distinguishable from plain sort or generic re-encoding

This slice is about aggregate semantics, not filtering and not drill-down.

## What Counts As `aggregate`

In the single-widget core, `aggregate` means:

> the widget changes how values are summarized or ranked by introducing an explicit aggregation policy into the current analytical view.

So `aggregate` is different from:

- `sort`: changes order without necessarily changing the summarization semantics
- `reencode`: changes fields or channels without necessarily introducing aggregate computation
- `drillDown`: refines to a more detailed level instead of summarizing to a coarser one

## Canonical State Effect

The canonical state effect of `aggregate` is:

- the widget current spec is updated through `writeCurrentSpec`
- the widget-local view state exposes `view.aggregate`
- the widget verification state reports `checks.aggregateApplied === true`

The current canonical metadata is:

- `view.aggregate.mode`
- `view.aggregate` payload fields that describe the aggregate strategy

## Current Validated Aggregate Baseline

The current validated baseline for this primitive is:

- `line.resampleXAxis`
- `heatmap.clusterRowsCols`

These cover two aggregate archetypes:

- temporal resampling with a value aggregation
- aggregate-driven row/column reordering on a matrix

## Observation Contract

The stable observation entry points for `aggregate` are:

- `WidgetInstance.readObservation()`
- `perception.inspectViewConfig`
- `perception.inspectVisibleRows`

For `aggregate`, visible row count may or may not change depending on widget family.

So the primary evidence should come from explicit aggregate metadata and spec changes, not row count alone.

## Verification Contract

The stable verification surfaces for `aggregate` are:

- `WidgetInstance.readVerificationState()`
- `WidgetInstance.readState()`
- `perception.inspectViewConfig`
- `perception.verifyActionEffect`

Minimum success evidence:

- `verification.checks.aggregateApplied === true`
- `verification.view.aggregate` exists and matches the requested aggregate semantics
- the updated `rawSpec` preserves widget-specific aggregate state
- the target spec encoding or state reflects the requested aggregate behavior
- `perception.inspectViewConfig.result.view.aggregate` exposes the same metadata
- `perception.verifyActionEffect.result.verified === true`

## Verification Boundary Clarification

`aggregate` must not be reduced to “any encoding has aggregate metadata.”

The canonical proof is not just:

- `encodings.aggregateChannels`

because some specs may already start aggregated.

The canonical proof is:

- `view.aggregate`

which records that an aggregate primitive was explicitly applied in the current runtime state.

## Current Boundary

This slice does not yet freeze:

- navigate/reset behavior after aggregate changes
- Sankey topology compression as a stable aggregate primitive
- all possible matrix clustering algorithms
- cross-widget propagation of aggregate responses

It only freezes the single-widget contract for structured aggregate actions that explicitly rewrite summarization intent in the current widget state.

## Completion Gate For Primitive 7

`aggregate` counts as landed for the single-widget core when all of the following hold:

- at least two widget families support aggregate responses end-to-end
- aggregate intent is preserved in canonical runtime state
- verification reports aggregate through `view.aggregate`
- the updated raw spec preserves widget-specific aggregate context for follow-up actions

The current validation targets for this slice are:

- `line.resampleXAxis`
- `heatmap.clusterRowsCols`
