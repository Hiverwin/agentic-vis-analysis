# WidgetVA Single-Widget Reencode Primitive Spec

Date: 2026-06-23

## Purpose

This document freezes the eighth `single-widget` primitive slice:

> `reencode`

The goal of this slice is to make structure-preserving encoding changes stable enough that an agent can request a new visual encoding configuration and then verify that:

- the widget keeps the same underlying visible data
- the encoding semantics changed in a controlled way
- the widget verification state reports reencode as an applied effect

This slice is about changing representational structure, not filtering, sorting, or aggregation.

## What Counts As `reencode`

In the single-widget core, `reencode` means:

> the widget changes how existing fields are visually encoded or laid out without changing the analytical target set itself.

So `reencode` is different from:

- `sort`: changes order
- `aggregate`: changes summarization semantics
- `highlight`: changes salience
- `navigate`: restores or moves between previously-defined structural states

## Canonical State Effect

The canonical state effect of `reencode` is:

- the widget current spec is updated through `writeCurrentSpec`
- widget-local state preserves enough context to identify the active encoding rewrite
- the widget-local view state exposes `view.reencode`
- the widget verification state reports `checks.reencodeApplied === true`

The current canonical metadata is:

- `view.reencode.mode`
- `view.reencode` payload fields specific to the encoding rewrite

## Current Validated Reencode Baseline

The current validated baseline for this primitive is:

- `bar.toggleStackMode`
- `heatmap.adjustColorScale`

These cover two distinct reencode archetypes:

- layout-structure rewrites within the same mark family
- visual-channel parameter rewrites on an existing encoding

## Observation Contract

The stable observation entry points for `reencode` are:

- `WidgetInstance.readObservation()`
- `perception.inspectVisibleRows`
- `perception.inspectViewConfig`

For `reencode`, `inspectVisibleRows` is mainly a negative check:

- visible row count should usually remain stable
- the main evidence should come from encoding/view metadata instead of row removal

## Verification Contract

The stable verification surfaces for `reencode` are:

- `WidgetInstance.readVerificationState()`
- `WidgetInstance.readState()`
- `perception.inspectViewConfig`
- `perception.verifyActionEffect`

Minimum success evidence:

- `verification.checks.reencodeApplied === true`
- `verification.view.reencode` exists and matches the requested encoding rewrite
- the updated `rawSpec` preserves the widget-specific reencode marker or structure
- `perception.inspectViewConfig.result.view.reencode` exposes the same metadata
- `perception.verifyActionEffect.result.verified === true`

## Verification Boundary Clarification

`reencode` must not be inferred only from “the encoding object changed.”

That signal is too weak because:

- many primitives mutate encoding state indirectly
- not every encoding mutation is semantically a reencode primitive

So the canonical proof is:

- `view.reencode`

instead of raw encoding diff alone.

## Current Boundary

This slice does not yet freeze:

- all reorder-style responses under the broader reencode family
- Sankey color-path rewriting
- transpose and other matrix orientation rewrites as separately validated cases
- multi-step reencode chains

It only freezes the single-widget contract for structured reencode actions that change representation while preserving the same underlying visible data scope.

## Completion Gate For Primitive 8

`reencode` counts as landed for the single-widget core when all of the following hold:

- at least two widget families support reencode responses end-to-end
- visible rows remain stable across the action
- reencode intent is preserved in canonical runtime state
- verification reports reencode through `view.reencode`

The current validation targets for this slice are:

- `bar.toggleStackMode`
- `heatmap.adjustColorScale`
