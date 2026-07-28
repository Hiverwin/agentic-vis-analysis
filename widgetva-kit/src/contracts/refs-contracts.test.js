import test from 'node:test'
import assert from 'node:assert/strict'

import {
  makeCurrentSelectionDataRef,
  makeCurrentViewDataRef,
  makeDataRef,
  makeLinkRef,
  makeSelectionRef,
  makeSelectionScopedDataRef,
  makeWidgetRef,
  makeWidgetSelectionDataRef,
  parseRef,
} from './refs-contracts.js'

test('refs contracts build canonical workspace refs', () => {
  assert.equal(makeWidgetRef({ widgetId: 'bar_a' }), 'wl://widgetva-app/workspace/main/widget/bar_a')
  assert.equal(
    makeSelectionRef({ widgetId: 'scatter_a', selectionId: 'brush' }),
    'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush',
  )
  assert.equal(makeDataRef({ dataId: 'cars' }), 'wl://widgetva-app/workspace/main/data/cars')
  assert.equal(makeCurrentViewDataRef(), 'wl://widgetva-app/workspace/main/data/current_view')
  assert.equal(makeCurrentSelectionDataRef(), 'wl://widgetva-app/workspace/main/data/current_selection')
  assert.equal(makeWidgetSelectionDataRef({ widgetId: 'scatter_a' }), 'wl://widgetva-app/workspace/main/data/scatter_a_selection')
  assert.equal(
    makeSelectionScopedDataRef({ widgetId: 'scatter_a', selectionId: 'brush' }),
    'wl://widgetva-app/workspace/main/data/scatter_a_selection_brush',
  )
  assert.equal(makeLinkRef({ linkId: 'link_a' }), 'wl://widgetva-app/workspace/main/link/link_a')
})

test('refs contracts parse canonical refs into address parts', () => {
  assert.deepEqual(
    parseRef('wl://demo/workspace/alpha/widget/scatter_a/selection/brush'),
    {
      appId: 'demo',
      workspaceId: 'alpha',
      kind: 'selection',
      path: 'widget/scatter_a/selection/brush',
      localId: 'brush',
      segments: ['widget', 'scatter_a', 'selection', 'brush'],
      widgetId: 'scatter_a',
      selectionId: 'brush',
      dataId: null,
      linkId: null,
      actionId: null,
    },
  )
  assert.equal(parseRef('not-a-ref'), null)
})
