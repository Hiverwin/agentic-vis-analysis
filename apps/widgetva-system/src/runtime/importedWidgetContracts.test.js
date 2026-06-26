import test from 'node:test'
import assert from 'node:assert/strict'

import {
  decorateImportedWidget,
  normalizeImportedWidgetDefinition,
  resolveWidgetKind,
  resolveWidgetProvider,
} from './importedWidgetContracts.js'

test('imported widget contract helpers normalize legacy type strings into canonical widgetKind and provider fields', () => {
  assert.equal(resolveWidgetKind('scatter-vega'), 'scatter')
  assert.equal(resolveWidgetProvider('scatter-vega'), 'vega-lite')
  assert.equal(resolveWidgetKind('scatter-echarts'), 'scatter')
  assert.equal(resolveWidgetProvider('scatter-echarts'), 'echarts')
  assert.equal(resolveWidgetKind('scatter-d3'), 'scatter')
  assert.equal(resolveWidgetProvider('scatter-d3'), 'd3')
  assert.equal(resolveWidgetKind('bar-echarts'), 'bar')
  assert.equal(resolveWidgetProvider('bar-echarts'), 'echarts')
  assert.equal(resolveWidgetKind('line-d3'), 'line')
  assert.equal(resolveWidgetProvider('line-d3'), 'd3')
  assert.equal(resolveWidgetKind('heatmap-echarts'), 'heatmap')
  assert.equal(resolveWidgetProvider('heatmap-echarts'), 'echarts')
  assert.equal(resolveWidgetKind('parallel-custom'), 'parallelCoordinates')
  assert.equal(resolveWidgetProvider('parallel-custom'), 'd3')
  assert.equal(resolveWidgetKind('parallel-vega'), 'parallelCoordinates')
  assert.equal(resolveWidgetProvider('parallel-vega'), 'vega-lite')
  assert.equal(resolveWidgetKind('sankey-echarts'), 'sankey')
  assert.equal(resolveWidgetProvider('sankey-echarts'), 'echarts')

  const normalized = normalizeImportedWidgetDefinition({
    id: 'w_scatter',
    type: 'scatter-vega',
  })

  assert.equal(normalized.widgetKind, 'scatter')
  assert.equal(normalized.provider, 'vega-lite')
})

test('imported widget contract helpers normalize whole-workspace provider environment type strings for all six widget families', () => {
  const typeCases = [
    ['scatter-d3', 'scatter', 'd3'],
    ['bar-vega', 'bar', 'vega-lite'],
    ['line-echarts', 'line', 'echarts'],
    ['heatmap-d3', 'heatmap', 'd3'],
    ['parallel-echarts', 'parallelCoordinates', 'echarts'],
    ['sankey-vega', 'sankey', 'vega-lite'],
  ]

  for (const [type, expectedKind, expectedProvider] of typeCases) {
    const normalized = normalizeImportedWidgetDefinition({
      id: `widget-${type}`,
      type,
    })

    assert.equal(normalized.widgetKind, expectedKind)
    assert.equal(normalized.provider, expectedProvider)
  }
})

test('decorateImportedWidget preserves explicit provider-facing fields while attaching widget contract metadata', () => {
  const decorated = decorateImportedWidget({
    id: 'w_sankey',
    title: 'Flow',
    type: 'sankey-custom',
    widgetKind: 'sankey',
    provider: 'd3',
  })

  assert.equal(decorated.widgetKind, 'sankey')
  assert.equal(decorated.provider, 'd3')
  assert.equal(decorated.widgetContract.kind, 'sankey')
  assert.equal(decorated.contractSummary.kind, 'sankey')
})
