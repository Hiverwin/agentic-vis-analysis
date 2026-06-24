import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHeatmapRenderModel,
  buildLineRenderModel,
  buildParallelCoordinatesRenderModel,
  buildSankeyRenderModel,
  buildScatterRenderModel,
} from './renderModels.js'
import {
  buildBarOriginEChartsOption,
  buildHeatmapEChartsOptionFromRenderModel,
  buildLineEChartsOptionFromRenderModel,
  buildParallelCoordinatesEChartsOption,
  buildParallelCoordinatesSpec,
  buildSankeyEChartsOption,
  buildSankeyVegaSpec,
  buildScatterEChartsOptionFromRenderModel,
} from './widgetSpecs.js'

test('buildBarOriginEChartsOption produces provider-native bar series state for echarts', () => {
  const option = buildBarOriginEChartsOption([
    { origin: 'USA', avgHorsepower: 180, count: 12 },
    { origin: 'Japan', avgHorsepower: 92, count: 9 },
  ], {
    analysisOrigin: 'USA',
  })

  assert.equal(option.xAxis.type, 'category')
  assert.equal(option.series[0].type, 'bar')
  assert.equal(option.series[0].data[0].origin, 'USA')
  assert.equal(option.series[0].data[0].value, 180)
  assert.equal(option.series[0].data[0].itemStyle.opacity, 1)
  assert.equal(option.series[0].data[1].itemStyle.opacity, 0.92)
})

test('buildScatterEChartsOptionFromRenderModel maps a semantic scatter model into echarts option data', () => {
  const renderModel = buildScatterRenderModel([
    { id: 'car-1', name: 'Car 1', origin: 'USA', horsepower: 150, mpg: 18, weight: 3200 },
    { id: 'car-2', name: 'Car 2', origin: 'Japan', horsepower: 82, mpg: 31, weight: 1900 },
  ])
  const option = buildScatterEChartsOptionFromRenderModel(renderModel)

  assert.equal(option.series[0].type, 'scatter')
  assert.deepEqual(option.series[0].data[0].value, [150, 18])
  assert.equal(option.series[0].data[1].category, 'Japan')
  assert.equal(option.xAxis.type, 'value')
  assert.equal(option.yAxis.type, 'value')
})

test('buildLineEChartsOptionFromRenderModel maps semantic line data into echarts series grouped by origin', () => {
  const renderModel = buildLineRenderModel([
    { year: 1970, origin: 'USA', avgMpg: 15.2, count: 9 },
    { year: 1971, origin: 'Japan', avgMpg: 31.5, count: 4 },
    { year: 1971, origin: 'USA', avgMpg: 16.4, count: 8 },
  ], {
    analysisYear: 1971,
  })
  const option = buildLineEChartsOptionFromRenderModel(renderModel, {
    analysisYear: 1971,
  })

  assert.equal(option.xAxis.type, 'category')
  assert.equal(option.series.length, 2)
  assert.equal(option.series[0].type, 'line')
  assert.equal(option.series.flatMap((series) => series.data).some((datum) => datum.year === 1971 && datum.itemStyle.opacity === 0.96), true)
})

test('buildHeatmapEChartsOptionFromRenderModel maps semantic heatmap cells into echarts heatmap tuples', () => {
  const renderModel = buildHeatmapRenderModel([
    { origin: 'USA', cylinders: 8, avgHorsepower: 190, count: 7 },
    { origin: 'Japan', cylinders: 4, avgHorsepower: 88, count: 5 },
  ], {
    analysisOrigin: 'Japan',
  }, {
    analysisCylinders: [4],
  })
  const option = buildHeatmapEChartsOptionFromRenderModel(renderModel, {
    analysisOrigin: 'Japan',
  }, {
    analysisCylinders: [4],
  })

  assert.equal(option.series[0].type, 'heatmap')
  assert.equal(Array.isArray(option.series[0].data[0].value), true)
  assert.equal(option.series[0].data[1].value[4], 'Japan')
  assert.equal(option.series[0].data[1].itemStyle.opacity, 0.96)
})

test('parallel coordinates provider builders project one semantic render model into vega-lite and echarts payloads', () => {
  const renderModel = buildParallelCoordinatesRenderModel([
    { id: 'car-1', name: 'Car 1', origin: 'USA', horsepower: 140, mpg: 18, weight: 3200, acceleration: 12 },
    { id: 'car-2', name: 'Car 2', origin: 'Japan', horsepower: 82, mpg: 31, weight: 1900, acceleration: 16 },
  ], {
    focusedCarId: 'car-2',
    visibleDimensionKeys: ['horsepower', 'mpg', 'weight'],
  })

  const spec = buildParallelCoordinatesSpec(renderModel)
  const option = buildParallelCoordinatesEChartsOption(renderModel)

  assert.equal(spec.mark.type, 'line')
  assert.deepEqual(spec.transform[0].fold, ['horsepower', 'mpg', 'weight'])
  assert.equal(option.series[0].type, 'parallel')
  assert.equal(option.parallelAxis.length, 3)
  assert.equal(option.series[0].data[1].lineStyle.opacity, 0.96)
})

test('sankey provider builders project one semantic render model into vega-lite and echarts payloads', () => {
  const renderModel = buildSankeyRenderModel({
    nodes: [
      { id: 'origin:USA', kind: 'origin', value: 'USA', label: 'USA', column: 0 },
      { id: 'cylinders:8', kind: 'cylinders', value: 8, label: '8 cyl', column: 1 },
      { id: 'year:1970', kind: 'year', value: 1970, label: '1970', column: 2 },
    ],
    links: [
      { source: 'origin:USA', target: 'cylinders:8', count: 7 },
      { source: 'cylinders:8', target: 'year:1970', count: 7 },
    ],
  }, {
    analyticalOverlay: { kind: 'sankeyTraceNode', nodeName: 'origin:USA' },
  })

  const spec = buildSankeyVegaSpec(renderModel)
  const option = buildSankeyEChartsOption(renderModel)

  assert.equal(spec.marks[0].type, 'path')
  assert.equal(spec.data[0].values[0].kind, 'origin')
  assert.equal(option.series[0].type, 'sankey')
  assert.equal(option.series[0].data[0].name, 'origin:USA')
  assert.equal(option.series[0].links[0].value, 7)
})
