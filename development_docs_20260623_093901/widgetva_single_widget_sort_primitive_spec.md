# WidgetVA Single-Widget Sort Primitive Spec

Date: 2026-06-23

## Purpose

This document freezes the fourth `single-widget` primitive slice:

> `sort`

The goal of this slice is to make ordering-changing actions stable enough that an agent can send a structured sort instruction and then verify that:

- the widget did not pretend the operation was a filter
- the widget current spec reflects the requested ordering
- the widget verification state reports sort as an applied effect

This slice is about order semantics, not data reduction and not viewport change.

## What Counts As `sort`

In the single-widget core, `sort` means:

> the same visible data rows remain in view, but the display order of one encoded categorical axis is changed by an explicit ranking rule.

So `sort` is different from:

- `filter`: changes which rows remain visible
- `zoom`: changes the view domain
- `reencode`: changes which field or channel is being used

## Canonical State Effect

The canonical state effect of `sort` is:

- the widget current spec is updated through `writeCurrentSpec`
- the target encoding carries an explicit sort rule
- the widget-local verification view exposes `view.sort`
- the widget verification state reports `checks.sortApplied === true`

For explicit categorical ranking, the minimum stable evidence is:

- `rawSpec.encoding.<channel>.sort`
- `verification.view.sort`

## Current Validated Sort Baseline

The current validated baseline for this primitive is:

- `bar.sortBars`

This baseline covers:

- category ranking by aggregated measure
- explicit sorted category-array materialization
- agent-side verify using runtime state instead of pixel inspection

## Observation Contract

The stable observation entry points for `sort` are:

- `WidgetInstance.readObservation()`
- `perception.inspectVisibleRows`
- `perception.inspectViewConfig`

For `sort`, `inspectVisibleRows` is mainly a negative check:

- visible row count should remain stable
- the change should appear in ordering metadata rather than row removal

## Verification Contract

The stable verification surfaces for `sort` are:

- `WidgetInstance.readVerificationState()`
- `WidgetInstance.readState()`
- `perception.inspectViewConfig`
- `perception.verifyActionEffect`

Minimum success evidence:

- `verification.checks.sortApplied === true`
- `verification.view.sort` matches the requested ordering semantics
- `readState().rawSpec.encoding.<channel>.sort` matches the materialized category order
- `perception.inspectViewConfig.result.view.sort` exposes the same sort metadata
- `perception.verifyActionEffect.result.verified === true`

## Verification Boundary Clarification

Ordering metadata must not be confused with zoom metadata.

In particular:

- nominal axis reordering may rewrite visible axis order metadata
- that does not mean `verification.checks.zoomApplied` should become true

This clarification keeps the primitive boundary clean for later ordering and `reencode` work.

## Current Boundary

This slice does not yet freeze:

- cross-widget ordering propagation
- a standalone `reorder` primitive family
- ranking responses on non-bar widgets
- renderer-specific animated resort behavior

It only freezes the single-widget contract for structured sort actions that change presentation order while keeping the same visible data rows.

## Completion Gate For Primitive 4

`sort` counts as landed for the single-widget core when all of the following hold:

- at least one widget action exposes `primitive === 'sort'`
- the action updates ordering state without reducing visible rows
- verification reports sort through canonical runtime state
- ordering verification is not conflated with zoom verification

The current validation target for this slice is:

- `bar.sortBars`
