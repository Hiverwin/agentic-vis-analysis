# WidgetVA Single-Widget Annotate Primitive Spec

Date: 2026-06-23

## Purpose

This document freezes the ninth `single-widget` primitive slice:

> `annotate`

The goal of this slice is to make annotation-style view augmentations stable enough that an agent can request an explanatory overlay or summary augmentation and then verify that:

- the underlying analytical target remains intact
- the widget view is augmented with additional explanatory structure
- the widget verification state reports annotate as an applied effect

This slice is about adding explanatory structure, not re-encoding the primary view alone.

## What Counts As `annotate`

In the single-widget core, `annotate` means:

> the widget adds an overlay, companion summary, or explanatory augmentation on top of the current analytical view.

So `annotate` is different from:

- `highlight`: changes salience of existing marks
- `reencode`: changes how existing fields are encoded
- `aggregate`: changes summarization semantics of the primary view itself

## Canonical State Effect

The canonical state effect of `annotate` is:

- the widget current spec is updated through `writeCurrentSpec`
- widget-local view state exposes `view.annotate`
- the widget verification state reports `checks.annotateApplied === true`

The current canonical metadata is:

- `view.annotate.mode`
- `view.annotate.sourceAction` or augmentation-specific payload fields

## Current Validated Annotate Baseline

The current validated baseline for this primitive is:

- `line.highlightTrend`
- `heatmap.addMarginalBars`

These cover two distinct annotation archetypes:

- overlay annotations on the same base chart
- compositional summary augmentations around an existing view

## Observation Contract

The stable observation entry points for `annotate` are:

- `WidgetInstance.readObservation()`
- `perception.inspectViewConfig`
- `perception.inspectVisibleRows`

For `annotate`, visible rows are not the primary evidence:

- the main effect is usually structural augmentation
- row counts may stay stable or change when the composed output becomes a richer custom view

## Verification Contract

The stable verification surfaces for `annotate` are:

- `WidgetInstance.readVerificationState()`
- `WidgetInstance.readState()`
- `perception.inspectViewConfig`
- `perception.verifyActionEffect`

Minimum success evidence:

- `verification.checks.annotateApplied === true`
- `verification.view.annotate` exists and matches the requested augmentation semantics
- the updated `rawSpec` contains the widget-specific annotation marker
- `perception.inspectViewConfig.result.view.annotate` exposes the same metadata
- `perception.verifyActionEffect.result.verified === true`

## Verification Boundary Clarification

`annotate` must not be reduced to “the spec got another layer.”

That is too weak, because:

- some layered outputs are reencodings
- some annotations create composed views instead of simple overlays

So the canonical proof is:

- `view.annotate`

not raw spec shape alone.

## Current Boundary

This slice does not yet freeze:

- all scatter annotation paths
- compound annotation stacks applied in sequence
- interactions between annotation overlays and later focus/navigation actions

It only freezes the single-widget contract for structured annotation actions that augment the current analytical view with explanatory structure.

## Completion Gate For Primitive 9

`annotate` counts as landed for the single-widget core when all of the following hold:

- at least two widget families support annotation responses end-to-end
- annotation intent is preserved in canonical runtime state
- verification reports annotate through `view.annotate`
- widget-local raw spec markers preserve enough context for later verification

The current validation targets for this slice are:

- `line.highlightTrend`
- `heatmap.addMarginalBars`
