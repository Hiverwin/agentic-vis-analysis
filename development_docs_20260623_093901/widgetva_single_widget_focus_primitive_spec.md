# WidgetVA Single-Widget Focus Primitive Spec

Date: 2026-06-23

## Purpose

This document freezes the eleventh `single-widget` primitive slice:

> `focus`

The goal of this slice is to make local-attention actions stable enough that an agent can request a focused subset of the current view and then verify that:

- the widget preserves the surrounding context
- one entity or series becomes the current local focus target
- the widget verification state reports focus as an applied effect

This slice is about concentrated local attention, not selection propagation.

## What Counts As `focus`

In the single-widget core, `focus` means:

> the widget promotes one local target into the current interpretive center while retaining nearby context in the same view.

So `focus` is different from:

- `select`: creates a selection object intended for coordination
- `highlight`: emphasizes targets visually without necessarily promoting a canonical focused target
- `navigate`: changes which structural state or view variant is active

## Canonical State Effect

The canonical state effect of `focus` is:

- the widget current spec is updated through `writeCurrentSpec`
- widget-local state preserves the focused target marker
- the widget-local view state exposes `view.focusKeys`
- the widget verification state reports `checks.focusApplied === true`

The current canonical metadata is:

- `view.focusKeys.focusedSeries`
- `view.focusKeys.focusedNode`

## Current Validated Focus Baseline

The current validated baseline for this primitive is:

- `line.focusLines`
- `sankey.traceNode`

These cover two focus archetypes:

- focusing one or more series inside a comparative chart
- focusing one connected node-centered region inside a flow graph

## Observation Contract

The stable observation entry points for `focus` are:

- `WidgetInstance.readObservation()`
- `perception.inspectViewConfig`
- `perception.inspectVisibleRows`

For `focus`, visible rows are usually not the main evidence:

- the view usually preserves the same data scope
- the main change is which target is treated as the current center of attention

## Verification Contract

The stable verification surfaces for `focus` are:

- `WidgetInstance.readVerificationState()`
- `WidgetInstance.readState()`
- `perception.inspectViewConfig`
- `perception.verifyActionEffect`

Minimum success evidence:

- `verification.checks.focusApplied === true`
- `verification.view.focusKeys` identifies the requested focused target
- the updated `rawSpec` preserves the widget-specific focus marker
- `perception.inspectViewConfig.result.view.focusKeys` exposes the same focus target
- `perception.verifyActionEffect.result.verified === true`

## Verification Boundary Clarification

`focus` must not be reduced to “opacity changed.”

Opacity is just one possible visual mechanism.

The canonical proof is:

- a focus target is explicitly represented in runtime state

That is why the canonical surface is `view.focusKeys`, not a style diff alone.

## Current Boundary

This slice does not yet freeze:

- selection-style Sankey focus actions intended for coordination
- all possible chart-local focus interactions
- multi-target focus transitions across widgets

It only freezes the single-widget contract for local focus actions that preserve context while elevating one target into the current focal state.

## Completion Gate For Primitive 11

`focus` counts as landed for the single-widget core when all of the following hold:

- at least two widget families support focus responses end-to-end
- focused targets are preserved in canonical runtime state
- verification reports focus through `view.focusKeys`
- the underlying visible scope is not replaced by a coordination-style selection object

The current validation targets for this slice are:

- `line.focusLines`
- `sankey.traceNode`
