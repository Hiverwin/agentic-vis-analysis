import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CANONICAL_WORKSPACE_WIDGET_KINDS,
  resolveWidgetNativePayload,
  listProviderSupportedWidgetKinds,
  resolveWidgetRenderMode,
} from './widgetRenderSupport.js'

test('workspace render support exposes all six canonical widget families for each provider environment', () => {
  for (const provider of ['vega-lite', 'echarts', 'd3']) {
    assert.deepEqual(listProviderSupportedWidgetKinds(provider), CANONICAL_WORKSPACE_WIDGET_KINDS)
  }
})

test('workspace render support resolves provider-native payloads first and falls back to glyph rendering otherwise', () => {
  const vegaMode = resolveWidgetRenderMode({
    widgetKind: 'scatter',
    provider: 'vega-lite',
    providerSpec: {
      provider: 'vega-lite',
      spec: { mark: 'point' },
    },
  })
  assert.equal(vegaMode.mode, 'vega-lite')

  const echartsMode = resolveWidgetRenderMode({
    widgetKind: 'bar',
    provider: 'echarts',
    providerSpec: {
      provider: 'echarts',
      option: { series: [{ type: 'bar' }] },
    },
  })
  assert.equal(echartsMode.mode, 'echarts')

  const fallbackMode = resolveWidgetRenderMode({
    widgetKind: 'parallelCoordinates',
    provider: 'vega-lite',
    providerSpec: {
      provider: 'vega-lite',
      sceneType: 'parallelCoordinates',
    },
  })
  assert.equal(fallbackMode.mode, 'glyph')
})

test('workspace render support exposes provider-native payloads from the projected widget surface', () => {
  const vegaPayload = resolveWidgetNativePayload({
    widgetKind: 'line',
    provider: 'vega-lite',
    providerSpec: {
      provider: 'vega-lite',
      spec: { mark: 'line' },
    },
    baseRenderModel: { widgetKind: 'line' },
  })
  assert.equal(vegaPayload.mode, 'vega-lite')
  assert.deepEqual(vegaPayload.payload, { mark: 'line' })
  assert.equal(vegaPayload.source, 'providerSpec')

  const echartsPayload = resolveWidgetNativePayload({
    widgetKind: 'heatmap',
    provider: 'echarts',
    providerSpec: {
      provider: 'echarts',
      option: { series: [{ type: 'heatmap' }] },
    },
  })
  assert.equal(echartsPayload.mode, 'echarts')
  assert.equal(echartsPayload.payload.series[0].type, 'heatmap')
})
