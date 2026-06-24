# WidgetVA Single-Widget DrillDown Primitive Spec

Date: 2026-06-23

## Purpose

This document freezes the sixth `single-widget` primitive slice:

> `drillDown`

The goal of this slice is to make structured temporal drill-down actions stable enough that an agent can request a finer-grained view and then verify that:

- the widget encoding moved to a finer temporal representation
- the widget spec carries drill-down state and tagged transforms
- the widget verification state reports drill-down as an applied effect

This slice is about semantic refinement of the current view, not viewport zoom and not generic filtering.

## What Counts As `drillDown`

In the single-widget core, `drillDown` means:

> the widget narrows analytical context to a chosen parent period and rewrites the visible encoding to a finer temporal level.

So `drillDown` is different from:

- `zoom`: narrows the viewing domain without changing semantic granularity
- `filter`: narrows rows without changing the intended axis level
- `reencode`: changes fields or channels without necessarily representing a hierarchical refinement step

## Canonical State Effect

The canonical state effect of `drillDown` is:

- the widget current spec is updated through `writeCurrentSpec`
- widget-local tagged state markers preserve drill-down context
- the widget-local view state exposes `view.drillDown`
- the widget verification state reports `checks.drillDownApplied === true`

The current canonical metadata is:

- `view.drillDown.axis`
- `view.drillDown.level`
- `view.drillDown.parent`
- `view.drillDown.targetField`

## Current Validated DrillDown Baseline

The current validated baseline for this primitive is:

- `line.drillDownXAxis`
- `heatmap.drilldownAxis`

These cover two common temporal drill-down forms:

- line chart x-axis refinement from yearly to monthly aggregation
- heatmap temporal x-axis refinement from yearly to monthly buckets

## Observation Contract

The stable observation entry points for `drillDown` are:

- `WidgetInstance.readObservation()`
- `perception.inspectViewConfig`
- `perception.inspectVisibleRows`

For `drillDown`, `inspectVisibleRows` is supportive but not the sole proof:

- some widgets may show fewer rows after the drill-down
- some widgets may preserve row count while changing encoded temporal granularity

So the primary evidence comes from spec/view state, not row count alone.

## Verification Contract

The stable verification surfaces for `drillDown` are:

- `WidgetInstance.readVerificationState()`
- `WidgetInstance.readState()`
- `perception.inspectViewConfig`
- `perception.verifyActionEffect`

Minimum success evidence:

- `verification.checks.drillDownApplied === true`
- `verification.view.drillDown` matches the requested drilled context
- the updated `rawSpec` contains the widget-specific drill-down state marker
- the target spec encoding reflects the finer-grained x-axis field or time unit
- `perception.inspectViewConfig.result.view.drillDown` exposes the same metadata
- `perception.verifyActionEffect.result.verified === true`

## Verification Boundary Clarification

`drillDown` must not be reduced to “a filter happened.”

Even when a drill-down inserts one or more filter transforms, it still remains a separate primitive because:

- the target semantic level changed
- the encoding was rewritten for a finer analytical view
- the widget now carries persistent drill-down context

That is why the canonical evidence is `view.drillDown`, not only `transforms.kinds`.

## Current Boundary

This slice does not yet freeze:

- reset or navigate-back semantics
- multi-step chained drill-down verification across more than one level in one test
- non-temporal hierarchical drill-down
- cross-widget drill-down propagation

It only freezes the single-widget contract for one-step structured drill-down actions that refine the temporal x-axis and preserve drill-down context in runtime state.

## Completion Gate For Primitive 6

`drillDown` counts as landed for the single-widget core when all of the following hold:

- at least two widget families support one-step drill-down end-to-end
- the action rewrites semantic drill-down state, not just viewport state
- verification reports drill-down through canonical runtime state
- the updated raw spec preserves enough drill-down context for follow-up actions

The current validation targets for this slice are:

- `line.drillDownXAxis`
- `heatmap.drilldownAxis`
