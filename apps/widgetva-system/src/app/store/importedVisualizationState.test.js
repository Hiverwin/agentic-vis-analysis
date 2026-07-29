import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildVisualizationBindSummary,
  createImportedWidgetId,
  mergeImportedVisualizationCase,
  removeWidgetFromImportedCase,
} from './importedVisualizationState.js'

test('imported visualization state helpers preserve widget roles and links', () => {
  const current = { id: 'imported', widgets: [{ id: 'a', role: 'primary' }], coordinationLinks: [{ sourceWidgetId: 'a', targetWidgetId: 'b' }] }
  const merged = mergeImportedVisualizationCase(current, { id: 'next', widgets: [{ id: 'b' }] })
  assert.deepEqual(merged.widgets.map((widget) => widget.role), ['primary', 'secondary'])

  const removed = removeWidgetFromImportedCase(merged, 'a')
  assert.deepEqual(removed.widgets.map((widget) => widget.id), ['b'])
  assert.equal(removed.widgets[0].role, 'primary')
  assert.deepEqual(removed.coordinationLinks, [])
})

test('import helpers generate collision-free ids and bind summaries', () => {
  assert.equal(createImportedWidgetId([]), 'w_imported_primary')
  assert.equal(createImportedWidgetId([{ id: 'w_imported_primary' }]), 'w_imported_2')
  assert.match(buildVisualizationBindSummary({ widgetAdapters: [{ widgetRef: 'wl://app/workspace/main/widget/a', provider: 'vega-lite' }] }, {
    ref: 'wl://app/workspace/main/widget/a',
    kind: 'bar',
    actionNames: ['x'],
    perceptionNames: ['y'],
  }), /Provider: vega-lite\./)
})
