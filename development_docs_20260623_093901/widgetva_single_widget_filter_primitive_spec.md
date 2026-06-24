# WidgetVA Single-Widget Filter Primitive Spec

Date: 2026-06-23

## Purpose

This document freezes the second `single-widget` primitive slice:

> `filter`

The goal of this slice is to make widget-local filtering stable enough that an agent can send a structured filter action and then verify that:

- the widget view definition changed
- the visible rows changed
- widget verification state reports the filter as applied

This slice exists because `filter` must be clearly separated from `selection`.

## What Counts As `filter`

In the single-widget core, `filter` means:

> the widget's active visible data view is reduced by a persistent, widget-readable data predicate.

This is different from `selection`.

`selection` marks a subset as the current focus.
`filter` changes which rows remain visible in the widget's current view.

So the defining property of `filter` is not just that an action has primitive `filter`.
The defining property is that the widget-visible data view becomes smaller or more constrained through canonical filter state.

## Canonical State Effect

The canonical state effect of `filter` is:

- the widget current spec is updated through `writeCurrentSpec`
- the widget-local transform list contains a normalized filter transform
- the widget visible rows are rematerialized from the updated spec
- widget verification reports `checks.filterApplied === true`

The minimum observable evidence is:

- `verification.transforms.hasFilterTransform === true`
- `verification.data.visibleCount < verification.data.rowCount` when the filter is reductive
- `perception.inspectViewConfig` exposes a normalized filter transform
- `perception.inspectVisibleRows` exposes the reduced row set

## Current Validated Filter Baseline

The current validated baseline for this primitive is:

- `bar.filterCategories`
- `line.filterLines`

These two cases cover the two main early filter archetypes:

- categorical inclusion filter
- categorical exclusion filter

They are enough to prove that the single-widget runtime can support structured filter mutations through the widget abstraction.

## Canonical Filter Forms

The currently validated canonical predicate forms are:

- `equals`
- `in`
- `notIn`
- `between`

At the spec-transform layer, the validated filter encodings are:

- `{ field, oneOf: [...] }`
- `{ field, notOneOf: [...] }`
- `{ field, equal: ... }`
- `{ field, range: [min, max] }`

These are normalized into predicate lists for runtime materialization and verification.

## Observation Contract

The stable observation entry points for `filter` are:

- `WidgetInstance.readObservation()`
- `perception.inspectViewConfig`
- `perception.inspectVisibleRows`

The planner should use:

- action descriptors to discover filter actions
- `inspectVisibleRows` to understand the pre-filter current view
- `inspectViewConfig` to verify transform-level changes when needed

## Verification Contract

The stable verification surfaces for `filter` are:

- `WidgetInstance.readVerificationState()`
- `perception.inspectVisibleRows`
- `perception.verifyActionEffect`

Minimum success evidence:

- `verification.checks.filterApplied === true`
- `verification.transforms.hasFilterTransform === true`
- the visible-row result matches the requested filter semantics
- `perception.verifyActionEffect.result.verified === true`

## Important Implementation Constraint Exposed By This Slice

This slice exposed a real single-widget runtime requirement:

> widget-pool host bridges must support `writeCurrentSpec`, not only `readCurrentSpec`.

Without that, any primitive implemented through `updateCurrentSpec` can return success without actually changing widget state.

This is now fixed for the single-widget widget-pool path.

## Boundary Of This Slice

This slice does not claim that every existing `filter`-named action is already a fully mature canonical filter primitive.

In particular, some existing actions still need later cleanup or audit because their naming history mixes `selection` and `filter`.

So this slice freezes only the part that is already development-ready:

- structured filter action
- spec mutation
- visible-row rematerialization
- verification closure

## Completion Gate For Primitive 2

`filter` counts as landed for the single-widget core when all of the following hold:

- at least one inclusion-style filter path is validated end-to-end
- at least one exclusion-style filter path is validated end-to-end
- the agent-style `act + verify` path changes both view config and visible rows
- widget verification reports the filter through canonical runtime state

The current validation targets for this slice are:

- `bar.filterCategories`
- `line.filterLines`
