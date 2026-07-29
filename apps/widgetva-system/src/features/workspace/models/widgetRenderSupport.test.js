import test from 'node:test'
import assert from 'node:assert/strict'

import {
  resolveWidgetNativePayload,
  resolveWidgetRenderMode,
} from './widgetRenderSupport.js'

test('workspace render support resolves provider-native payloads and marks unsupported widgets unavailable', () => {
  const vegaLiteMode = resolveWidgetRenderMode({
    widgetKind: 'scatter',
    provider: 'vega-lite',
    providerSpec: {
      provider: 'vega-lite',
      spec: { mark: 'point' },
    },
  })
  assert.equal(vegaLiteMode.mode, 'vega-lite')

  const echartsMode = resolveWidgetRenderMode({
    widgetKind: 'bar',
    provider: 'echarts',
    providerSpec: {
      provider: 'echarts',
      option: { series: [{ type: 'bar' }] },
    },
  })
  assert.equal(echartsMode.mode, 'echarts')

  const pureVegaMode = resolveWidgetRenderMode({
    widgetKind: 'sankey',
    provider: 'vega',
    providerSpec: {
      provider: 'vega',
      spec: { marks: [{ type: 'rect' }] },
    },
  })
  assert.equal(pureVegaMode.mode, 'vega')

  const vgplotMode = resolveWidgetRenderMode({
    widgetKind: 'line',
    provider: 'vgplot',
    providerSpec: {
      provider: 'vgplot',
      scriptText: 'export default (wg) => wg.plot(wg.line([], { x: "x", y: "y" }))',
    },
  })
  assert.equal(vgplotMode.mode, 'vgplot')

  const fallbackMode = resolveWidgetRenderMode({
    widgetKind: 'parallelCoordinates',
    provider: 'vega-lite',
    providerSpec: {
      provider: 'vega-lite',
      sceneType: 'parallelCoordinates',
    },
  })
  assert.equal(fallbackMode.mode, 'unavailable')
})

test('workspace render support exposes provider-native payloads from the projected widget surface', () => {
  const vegaPayload = resolveWidgetNativePayload({
    widgetKind: 'line',
    provider: 'vega-lite',
    providerSpec: {
      provider: 'vega-lite',
      spec: { mark: 'line' },
    },
  })
  assert.equal(vegaPayload.mode, 'vega-lite')
  assert.deepEqual(vegaPayload.payload, { mark: 'line' })
  assert.equal(vegaPayload.source, 'providerSpec')

  const pureVegaPayload = resolveWidgetNativePayload({
    widgetKind: 'sankey',
    provider: 'vega',
    providerSpec: {
      provider: 'vega',
      spec: { marks: [{ type: 'path' }] },
    },
  })
  assert.equal(pureVegaPayload.mode, 'vega')
  assert.deepEqual(pureVegaPayload.payload, { marks: [{ type: 'path' }] })
  assert.equal(pureVegaPayload.source, 'providerSpec')

  const sourceOnlyVegaPayload = resolveWidgetNativePayload({
    widgetKind: 'sankey',
    provider: 'vega',
    source: {
      providerSpec: {
        provider: 'vega',
        spec: { marks: [{ type: 'rect' }] },
      },
    },
  })
  assert.equal(sourceOnlyVegaPayload.mode, 'vega')
  assert.deepEqual(sourceOnlyVegaPayload.payload, { marks: [{ type: 'rect' }] })

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

  const vgplotPayload = resolveWidgetNativePayload({
    widgetKind: 'line',
    provider: 'vgplot',
    providerSpec: {
      provider: 'vgplot',
      scriptText: 'export default (wg) => wg.plot(wg.line([], { x: "x", y: "y" }))',
    },
  })
  assert.equal(vgplotPayload.mode, 'vgplot')
  assert.match(vgplotPayload.payload, /wg\.plot/)

  const unavailablePayload = resolveWidgetNativePayload({
    widgetKind: 'parallelCoordinates',
    provider: 'vega-lite',
    providerSpec: {
      provider: 'vega-lite',
      sceneType: 'parallelCoordinates',
    },
  })
  assert.equal(unavailablePayload.mode, 'unavailable')
  assert.equal(unavailablePayload.payload, null)
  assert.equal(unavailablePayload.source, 'none')
})
