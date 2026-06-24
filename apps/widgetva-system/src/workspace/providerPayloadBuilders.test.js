import test from 'node:test'
import assert from 'node:assert/strict'

import { projectWidgetRuntimeSurface } from './providerPayloadBuilders.js'

test('projectWidgetRuntimeSurface derives live vega-lite and echarts payloads from current widget state', () => {
  const scatterWidget = projectWidgetRuntimeSurface({
    widgetKind: 'scatter',
    provider: 'vega-lite',
    derivedData: [
      { id: 'car-1', name: 'Car 1', origin: 'USA', horsepower: 150, mpg: 18, weight: 3200 },
      { id: 'car-2', name: 'Car 2', origin: 'Japan', horsepower: 82, mpg: 31, weight: 1900 },
    ],
    viewState: {
      activeRange: [70, 160],
      highlightPredicates: [{ field: 'origin', op: 'equals', value: 'USA' }],
    },
    runtimeSource: { providerSpec: null, renderModel: null },
  })

  assert.equal(scatterWidget.baseRenderModel?.widgetKind, 'scatter')
  assert.equal(scatterWidget.providerSpec?.provider, 'vega-lite')
  assert.equal(scatterWidget.providerSpec?.spec?.mark?.type || scatterWidget.providerSpec?.spec?.mark, 'circle')
  assert.equal(scatterWidget.runtimeSource?.providerSpec?.provider, 'vega-lite')

  const lineWidget = projectWidgetRuntimeSurface({
    widgetKind: 'line',
    provider: 'echarts',
    derivedData: [
      { year: 1970, origin: 'USA', avgMpg: 15.2, count: 9 },
      { year: 1971, origin: 'Japan', avgMpg: 31.5, count: 4 },
    ],
    viewState: {
      analysisYear: 1971,
    },
  })

  assert.equal(lineWidget.baseRenderModel?.widgetKind, 'line')
  assert.equal(lineWidget.providerSpec?.provider, 'echarts')
  assert.equal(lineWidget.providerSpec?.optionType, 'line')
  assert.equal(lineWidget.providerSpec?.option?.series?.[0]?.type, 'line')
})
