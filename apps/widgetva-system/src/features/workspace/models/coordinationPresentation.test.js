import test from 'node:test'
import assert from 'node:assert/strict'

import { buildKitLinkRows, formatKitStateRef } from './coordinationPresentation.js'

test('formats Kit state references without inferring a different operation', () => {
  const widgets = new Map([['bar', { title: 'Region bar' }]])

  assert.equal(
    formatKitStateRef('wl://widgetva-app/workspace/main/widget/bar/selection/brush', widgets),
    'Region bar.selection/brush',
  )
  assert.equal(
    formatKitStateRef('wl://widgetva-app/workspace/main/widget/bar/view/zoom', widgets),
    'Region bar.view/zoom',
  )
})

test('buildKitLinkRows preserves Kit source and target state paths', () => {
  const [link] = buildKitLinkRows([{
    ref: 'link:brush-filter',
    sourceStateRef: 'wl://widgetva-app/workspace/main/widget/bar/selection/brush',
    targetStateRef: 'wl://widgetva-app/workspace/main/widget/scatter/transform/filter',
    transform: { kind: 'selectionToFilter' },
  }], [
    { id: 'bar', title: 'Region bar' },
    { id: 'scatter', title: 'Spend scatter' },
  ])

  assert.equal(link.source, 'Region bar.selection/brush')
  assert.equal(link.target, 'Spend scatter.transform/filter')
  assert.equal(link.transformKind, 'selectionToFilter')
})
