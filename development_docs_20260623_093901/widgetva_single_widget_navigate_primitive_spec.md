# WidgetVA Single-Widget Navigate Primitive Spec

Date: 2026-06-23

## Purpose

This document freezes the twelfth `single-widget` primitive slice:

> `navigate`

The goal of this slice is to make view-state restoration and structural return actions stable enough that an agent can request a return to a prior view state and then verify that:

- the widget leaves the current derived state
- the widget returns to a previously known structural baseline
- the widget verification state reports navigation as an applied effect

This slice is about state restoration and movement between view states, not arbitrary data mutation.

## What Counts As `navigate`

In the single-widget core, `navigate` means:

> the widget transitions from the current derived state to another known structural state, often a baseline or restored view.

So `navigate` is different from:

- `drillDown`: enters a more specific derived state
- `reencode`: changes the active representation within the current state
- `addRemove`: edits the current visible set incrementally

## Canonical State Effect

The canonical state effect of `navigate` is:

- the widget current spec is updated through `writeCurrentSpec`
- widget-local state records the most recent navigation operation
- the widget-local view state exposes `view.navigate`
- the widget verification state reports `checks.navigateApplied === true`

The current canonical metadata is:

- `view.navigate.mode`
- `view.navigate.sourceAction`

## Current Validated Navigate Baseline

The current validated baseline for this primitive is:

- `line.resetDrilldownXAxis`
- `heatmap.resetDrilldown`

These cover:

- returning a drilled line chart to its original baseline
- returning a drilled heatmap to its original baseline

## Observation Contract

The stable observation entry points for `navigate` are:

- `WidgetInstance.readObservation()`
- `perception.inspectViewConfig`
- `perception.verifyActionEffect`

For `navigate`, the key evidence is structural restoration:

- derived drill-down state should be gone
- baseline encoding structure should be restored

## Verification Contract

The stable verification surfaces for `navigate` are:

- `WidgetInstance.readVerificationState()`
- `WidgetInstance.readState()`
- `perception.inspectViewConfig`
- `perception.verifyActionEffect`

Minimum success evidence:

- `verification.checks.navigateApplied === true`
- `verification.view.navigate` identifies the navigation operation
- the updated `rawSpec` no longer contains the previous derived-state marker
- `perception.inspectViewConfig.result.view.navigate` exposes the same metadata
- `perception.verifyActionEffect.result.verified === true`

## Verification Boundary Clarification

`navigate` must not be reduced to “some marker disappeared.”

The canonical proof is not only the absence of prior derived state.

The canonical proof is:

- the widget explicitly records that a navigation transition happened

That is why `view.navigate` is required in addition to structural restoration.

## Current Boundary

This slice does not yet freeze:

- every reset-style action in the repository
- cross-widget navigation coordination
- history stacks or multi-step backtracking

It only freezes the single-widget contract for structured return-to-baseline actions after drill-down.

## Completion Gate For Primitive 12

`navigate` counts as landed for the single-widget core when all of the following hold:

- at least two widget families support navigation-style restoration end-to-end
- the previous derived-state marker is removed
- navigation intent is preserved in canonical runtime state
- verification reports navigation through `view.navigate`

The current validation targets for this slice are:

- `line.resetDrilldownXAxis`
- `heatmap.resetDrilldown`
