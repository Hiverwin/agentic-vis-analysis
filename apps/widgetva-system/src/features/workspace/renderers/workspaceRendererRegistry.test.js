import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorkspaceRendererRegistry } from './workspaceRendererRegistry.js'

test('workspace renderer registry resolves renderers by canonical provider and widgetKind', () => {
  const registry = createWorkspaceRendererRegistry([
    {
      provider: 'vega-lite',
      supportedWidgetKinds: ['scatter', 'bar'],
      renderWidget() {
        return 'vega'
      },
    },
    {
      provider: 'd3',
      supportedWidgetKinds: ['scatter', 'parallelCoordinates'],
      renderWidget() {
        return 'd3'
      },
    },
    {
      provider: 'echarts',
      supportedWidgetKinds: ['scatter', 'bar'],
      renderWidget() {
        return 'echarts'
      },
    },
  ])

  const resolved = registry.resolveWidget({
    widgetKind: 'scatter',
    provider: 'vega-lite',
  })

  assert.equal(resolved?.provider, 'vega-lite')
  assert.equal(resolved?.widgetKind, 'scatter')
  assert.equal(registry.renderWidget({
    widget: {
      widgetKind: 'scatter',
      provider: 'vega-lite',
    },
  }), 'vega')
  assert.equal(registry.renderWidget({
    widget: {
      widgetKind: 'bar',
      provider: 'echarts',
    },
  }), 'echarts')
  assert.equal(registry.renderWidget({
    widget: {
      widgetKind: 'scatter',
      provider: 'd3',
    },
  }), 'd3')
})

test('workspace renderer registry rejects unsupported provider/widgetKind combinations', () => {
  const registry = createWorkspaceRendererRegistry([
    {
      provider: 'vega-lite',
      supportedWidgetKinds: ['scatter'],
      renderWidget() {
        return 'vega'
      },
    },
  ])

  assert.equal(registry.resolveWidget({
    widgetKind: 'sankey',
    provider: 'vega-lite',
  }), null)
  assert.equal(registry.renderWidget({
    widget: {
      widgetKind: 'sankey',
      provider: 'vega-lite',
    },
  }), null)
})
