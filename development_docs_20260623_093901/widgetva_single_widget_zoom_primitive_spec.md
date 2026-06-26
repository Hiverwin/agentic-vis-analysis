# WidgetVA Single-Widget Zoom Primitive Spec

Date: 2026-06-23

## Purpose

This document freezes the third `single-widget` primitive slice:

> `zoom`

The goal of this slice is to make viewport-changing actions stable enough that an agent can send a structured zoom instruction and then verify that:

- the widget view state changed
- the widget spec reflects the requested domain override
- widget verification reports the zoom as applied

This slice is intentionally about viewport semantics, not data reduction.

## What Counts As `zoom`

In the single-widget core, `zoom` means:

> the widget keeps the same current visible data rows, but its view domain is narrowed or shifted to a requested region.

So `zoom` is different from `filter`:

- `filter` changes the visible data view
- `zoom` changes the viewport/view-domain state

This distinction matters for both planning and verification.

## Canonical State Effect

The canonical state effect of `zoom` is:

- the widget current spec is updated through `writeCurrentSpec`
- the widget-local view state exposes `xDomain` and/or `yDomain`
- the widget verification state reports `checks.zoomApplied === true`

When available, the widget may also expose derived zoom metadata such as:

- `view.zoom.center`
- `view.zoom.level`

The minimum required evidence is the domain override itself.

## Current Validated Zoom Baseline

The current validated baseline for this primitive is:

- `scatter.zoomDomain`
- `line.zoomXRegion`

These two cases cover the two early zoom archetypes:

- 2D quantitative viewport zoom
- 1D temporal x-axis zoom

## Observation Contract

The stable observation entry points for `zoom` are:

- `WidgetInstance.readObservation()`
- `perception.inspectViewConfig`
- `perception.inspectVisibleRows`

For `zoom`, `inspectVisibleRows` is mainly a negative check:

- rows should usually stay the same
- the change should appear in view state rather than visible-row reduction

## Verification Contract

The stable verification surfaces for `zoom` are:

- `WidgetInstance.readVerificationState()`
- `perception.inspectViewConfig`
- `perception.verifyActionEffect`

Minimum success evidence:

- `verification.checks.zoomApplied === true`
- `verification.view.xDomain` and/or `verification.view.yDomain` match the requested domain
- `perception.inspectViewConfig` exposes the same domain change in the widget spec/view state
- `perception.verifyActionEffect.result.verified === true`

## Current Boundary

This slice does not yet freeze:

- full pan semantics
- viewport reset semantics
- linked cross-widget domain synchronization
- renderer-specific animated zoom behavior

It only freezes the single-widget contract for structured zoom actions that mutate the widget viewport state.

## Completion Gate For Primitive 3

`zoom` counts as landed for the single-widget core when all of the following hold:

- at least one 2D zoom path is validated end-to-end
- at least one 1D axis zoom path is validated end-to-end
- the agent-style `act + verify` path changes view-domain state without pretending to be a filter
- widget verification reports zoom through canonical runtime state

The current validation targets for this slice are:

- `scatter.zoomDomain`
- `line.zoomXRegion`
