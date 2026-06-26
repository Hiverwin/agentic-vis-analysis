# WidgetVA Single-Widget Highlight Primitive Spec

Date: 2026-06-23

## Purpose

This document freezes the fifth `single-widget` primitive slice:

> `highlight`

The goal of this slice is to make emphasis-changing actions stable enough that an agent can send a structured highlight instruction and then verify that:

- the widget still shows the same visible data rows
- the widget spec now contains emphasis logic instead of destructive filtering
- the widget verification state reports highlight as an applied effect

This slice is about visual emphasis, not selection, filtering, or viewport change.

## What Counts As `highlight`

In the single-widget core, `highlight` means:

> the widget visually emphasizes one subset of marks while dimming or de-emphasizing the rest, without removing the other marks from the current view.

So `highlight` is different from:

- `filter`: removes rows from the visible view
- `select`: creates a selection object that can propagate
- `focus`: may later become a stronger local-attention primitive with widget-specific semantics

## Canonical State Effect

The canonical state effect of `highlight` is:

- the widget current spec is updated through `writeCurrentSpec`
- the widget-local view state exposes `view.highlight`
- the widget verification state reports `checks.highlightApplied === true`

The current canonical metadata is:

- `view.highlight.channels`
- `view.highlight.entries`

Each entry describes where the emphasis was encoded, for example:

- an `encoding.opacity` condition
- an `encoding.strokeWidth` condition
- a mark-level signal-based opacity override

## Current Validated Highlight Baseline

The current validated baseline for this primitive is:

- `bar.highlightTopN`
- `line.boldLines`

These cover two distinct highlight archetypes:

- dimming via `opacity`
- emphasis via `strokeWidth`

## Observation Contract

The stable observation entry points for `highlight` are:

- `WidgetInstance.readObservation()`
- `perception.inspectVisibleRows`
- `perception.inspectViewConfig`

For `highlight`, `inspectVisibleRows` is primarily a negative check:

- visible row count should remain stable
- the change should appear in emphasis metadata rather than data reduction

## Verification Contract

The stable verification surfaces for `highlight` are:

- `WidgetInstance.readVerificationState()`
- `WidgetInstance.readState()`
- `perception.inspectViewConfig`
- `perception.verifyActionEffect`

Minimum success evidence:

- `verification.checks.highlightApplied === true`
- `verification.view.highlight` exists and describes the emphasis channel(s)
- the updated `rawSpec` contains the corresponding conditional emphasis logic
- `perception.inspectViewConfig.result.view.highlight` exposes the same metadata
- `perception.verifyActionEffect.result.verified === true`

## Verification Boundary Clarification

`highlight` must not be inferred from linked-widget feedback alone.

For single-widget validation, highlight evidence should come from the target widget's own view/spec state.

That is why this slice promotes:

- `view.highlight`

instead of relying only on:

- `feedback.highlightedKeys`

## Current Boundary

This slice does not yet freeze:

- cross-widget highlight propagation
- a stronger `focus` primitive
- semantic path tracing in Sankey-like custom marks
- annotation overlays that add new statistical or explanatory marks

It only freezes the single-widget contract for structured emphasis actions that preserve the visible data view while changing visual salience.

## Completion Gate For Primitive 5

`highlight` counts as landed for the single-widget core when all of the following hold:

- at least one opacity-based highlight path is validated end-to-end
- at least one non-opacity emphasis path is validated end-to-end
- visible rows remain stable across the action
- verification reports highlight through canonical runtime state

The current validation targets for this slice are:

- `bar.highlightTopN`
- `line.boldLines`
