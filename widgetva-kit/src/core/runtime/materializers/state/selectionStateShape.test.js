import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildSelectionPayloadFromState,
  buildSelectionStateInput,
} from './selectionStateShape.js'
import { makeSelectionState } from '../../../../contracts/state-contracts.js'

test('buildSelectionStateInput normalizes canonical selection metadata from mixed legacy payload fields', () => {
  const state = buildSelectionStateInput({
    selection_ref: 'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush',
    selection_id: 'brush',
    selection_type: 'interval',
    source_widget_ref: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    source_widget_id: 'scatter_a',
    scope: 'linked',
    selection_data_ref: 'wl://widgetva-app/workspace/main/data/scatter_a_selection_brush',
    predicates: [{ field: 'Horsepower', op: 'between', value: [80, 160] }],
    summary: 'Horsepower between 80 and 160',
  })

  assert.deepEqual(state, {
    selectionRef: 'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush',
    selectionId: 'brush',
    kind: 'interval',
    sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    sourceWidgetId: 'scatter_a',
    scope: 'linked',
    selectionDataRef: 'wl://widgetva-app/workspace/main/data/scatter_a_selection_brush',
    domain: null,
    predicates: [{ field: 'Horsepower', op: 'between', value: [80, 160] }],
    summary: 'Horsepower between 80 and 160',
  })
})

test('buildSelectionPayloadFromState preserves canonical selection metadata in legacy-compatible payload form', () => {
  const selectionState = makeSelectionState({
    selectionRef: 'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush',
    selectionId: 'brush',
    kind: 'interval',
    sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    sourceWidgetId: 'scatter_a',
    scope: 'local',
    selectionDataRef: 'wl://widgetva-app/workspace/main/data/scatter_a_selection_brush',
    predicates: [{ field: 'Horsepower', op: 'between', value: [80, 160] }],
    summary: 'Horsepower between 80 and 160',
  })

  const payload = buildSelectionPayloadFromState({
    selectionState,
    selectedCount: 12,
  })

  assert.deepEqual(payload, {
    selection_ref: 'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush',
    selection_id: 'brush',
    source_widget_ref: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    source_widget_id: 'scatter_a',
    selection_type: 'interval',
    scope: 'local',
    selection_data_ref: 'wl://widgetva-app/workspace/main/data/scatter_a_selection_brush',
    domain: null,
    predicates: [{ field: 'Horsepower', op: 'between', value: [80, 160] }],
    count: 12,
    summary: 'Horsepower between 80 and 160',
  })
})
