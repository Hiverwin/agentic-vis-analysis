# WidgetVA Single-Widget AddRemove Primitive Spec

Date: 2026-06-23

## Purpose

This document freezes the tenth `single-widget` primitive slice:

> `addRemove`

The goal of this slice is to make visibility-set expansion and contraction stable enough that an agent can request items to be removed from or restored to the current view and then verify that:

- the widget visible set changed in the requested direction
- the widget retained explicit visibility-set state
- the widget verification state reports add/remove as an applied effect

This slice is about managed visibility sets, not arbitrary filtering.

## What Counts As `addRemove`

In the single-widget core, `addRemove` means:

> the widget maintains an explicit current visible set and updates that set incrementally by adding items back or removing items out.

So `addRemove` is different from:

- `filter`: applies a standalone constraint without necessarily preserving managed visibility-set semantics
- `highlight`: keeps items visible while only changing emphasis
- `navigate`: restores a previously known structural state rather than editing the current visible set directly

## Canonical State Effect

The canonical state effect of `addRemove` is:

- the widget current spec is updated through `writeCurrentSpec`
- widget-local visibility state preserves the current managed visible set
- widget-local view state exposes `view.addRemove`
- the widget verification state reports `checks.addRemoveApplied === true`

The current canonical metadata is:

- `view.addRemove.mode`
- `view.addRemove.operation`
- `view.addRemove` payload fields describing the active visible set

## Current Validated AddRemove Baseline

The current validated baseline for this primitive is:

- `bar.removeBars`
- `bar.addBars`

These cover:

- shrinking a managed category-visible set
- expanding the same managed category-visible set back outward

## Observation Contract

The stable observation entry points for `addRemove` are:

- `WidgetInstance.readObservation()`
- `perception.inspectVisibleRows`
- `perception.inspectViewConfig`

For `addRemove`, visible-row evidence is essential:

- the visible set should actually shrink or expand
- this family should not be validated only through stored state markers

## Verification Contract

The stable verification surfaces for `addRemove` are:

- `WidgetInstance.readVerificationState()`
- `WidgetInstance.readState()`
- `perception.inspectVisibleRows`
- `perception.inspectViewConfig`
- `perception.verifyActionEffect`

Minimum success evidence:

- `verification.checks.addRemoveApplied === true`
- `verification.view.addRemove` exists and matches the requested operation
- `readState().rawSpec` preserves the managed visibility-set state
- `perception.inspectVisibleRows` reflects the requested visible-set change
- `perception.inspectViewConfig.result.view.addRemove` exposes the same metadata
- `perception.verifyActionEffect.result.verified === true`

## Verification Boundary Clarification

`addRemove` must not be collapsed back into generic filter semantics.

The defining feature is not just “some rows disappeared.”

The defining feature is:

- a managed visible set exists
- later actions can expand or contract it incrementally

That is why the canonical proof is `view.addRemove`, not row-count change alone.

## Current Boundary

This slice does not yet freeze:

- grouped or stacked bar item-level add/remove as a separate validated path
- cross-widget propagation of add/remove actions
- add/remove behavior on non-bar widgets

It only freezes the single-widget contract for incremental category-visibility management on bar charts.

## Completion Gate For Primitive 10

`addRemove` counts as landed for the single-widget core when all of the following hold:

- at least one widget family supports both add and remove directions end-to-end
- visible rows actually change in response to the operation
- add/remove intent is preserved in canonical runtime state
- verification reports add/remove through `view.addRemove`

The current validation targets for this slice are:

- `bar.removeBars`
- `bar.addBars`
