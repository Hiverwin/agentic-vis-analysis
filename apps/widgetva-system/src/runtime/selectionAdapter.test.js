import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildScatterBrushSelectionEntry,
  buildWorkspaceSelectionEntry,
  normalizeScatterBrushSelection,
} from './selectionAdapter.js'

test('normalizeScatterBrushSelection accepts canonical and aliased brush inputs', () => {
  assert.deepEqual(
    normalizeScatterBrushSelection({
      Horsepower: [140, 80],
      MPG: [30, 18],
    }),
    {
      xRange: [80, 140],
      yRange: [18, 30],
    },
  )
  assert.equal(normalizeScatterBrushSelection(null), null)
})

test('buildScatterBrushSelectionEntry derives canonical predicates and widget metadata', () => {
  const session = {
    workspace: {
      getWidget(widgetId) {
        if (widgetId !== 'w_scatter_cars') return null
        return {
          resolveWidgetId: () => 'w_scatter_cars',
          resolveWidgetRef: () => 'wl://workspace/widget/w_scatter_cars',
        }
      },
    },
  }
  const entry = buildScatterBrushSelectionEntry(session, {
    xRange: [80, 140],
    yRange: [18, 30],
  })

  assert.equal(entry.sourceWidgetId, 'w_scatter_cars')
  assert.equal(entry.sourceWidgetRef, 'wl://workspace/widget/w_scatter_cars')
  assert.equal(entry.kind, 'brush')
  assert.deepEqual(entry.predicates, [
    { field: 'horsepower', op: 'between', value: [80, 140] },
    { field: 'mpg', op: 'between', value: [18, 30] },
  ])
})

test('buildWorkspaceSelectionEntry derives canonical selection refs for first-party widget actions', () => {
  const session = {
    workspace: {
      getWidget(widgetId) {
        if (widgetId !== 'w_bar_origin') return null
        return {
          resolveWidgetRef: () => 'wl://workspace/widget/w_bar_origin',
        }
      },
    },
  }
  const entry = buildWorkspaceSelectionEntry(session, {
    sourceWidgetId: 'w_bar_origin',
    selectionId: 'origin',
    summary: 'Origin: Japan',
    predicates: [{ field: 'origin', op: 'equals', value: 'Japan' }],
    values: ['Japan'],
  })

  assert.equal(entry.selectionRef, 'selection://widgetva-system/w_bar_origin/origin')
  assert.equal(entry.sourceWidgetRef, 'wl://workspace/widget/w_bar_origin')
  assert.equal(entry.kind, 'point')
  assert.deepEqual(entry.values, ['Japan'])
})
