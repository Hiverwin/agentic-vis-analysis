import test from 'node:test'
import assert from 'node:assert/strict'

import { deriveWorkspaceTopology } from './deriveWorkspaceTopology.js'

test('deriveWorkspaceTopology returns normalized workspace-topology summaries', () => {
  const summary = deriveWorkspaceTopology({
    widgets: [
      { widgetId: 'scatter_main' },
      { widgetId: 'bar_detail', role: 'detail' },
    ],
    links: [
      {
        kind: 'filters',
        sourceWidgetId: 'scatter_main',
        targetWidgetId: 'bar_detail',
      },
    ],
  })

  assert.equal(summary.topology, 'T3')
  assert.equal(summary.topologyLabel, 'Overview + Detail')
  assert.equal(summary.widgetCount, 2)
  assert.equal(summary.edgeCount, 1)
  assert.equal(summary.linkDensity, 0.5)
  assert.equal(summary.sourceWidgetCount, 1)
  assert.equal(summary.targetWidgetCount, 1)
  assert.equal(summary.maxOutDegree, 1)
  assert.equal(summary.maxInDegree, 1)
  assert.deepEqual(summary.rationale, [
    'A detail-role widget is present in the current workspace plan.',
  ])
})

test('deriveWorkspaceTopology treats primitive-only coordination links as topology edges', () => {
  const summary = deriveWorkspaceTopology({
    widgets: [
      { widgetId: 'scatter_main' },
      { widgetId: 'bar_detail' },
      { widgetId: 'table_detail' },
    ],
    links: [
      {
        primitive: 'filter',
        sourceWidgetId: 'scatter_main',
        targetWidgetId: 'bar_detail',
      },
      {
        primitive: 'filter',
        sourceWidgetId: 'scatter_main',
        targetWidgetId: 'table_detail',
      },
    ],
  })

  assert.equal(summary.topology, 'T6')
  assert.equal(summary.edgeCount, 2)
  assert.equal(summary.sourceWidgetCount, 1)
  assert.equal(summary.targetWidgetCount, 2)
  assert.equal(summary.maxOutDegree, 2)
})
