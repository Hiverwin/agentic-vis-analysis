import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildBarRenderModel,
  buildHeatmapRenderModel,
  buildLineRenderModel,
  buildParallelCoordinatesRenderModel,
  buildSankeyRenderModel,
  buildScatterRenderModel,
} from './renderModels.js'

test('buildScatterRenderModel normalizes semantic scatter data independently of provider', () => {
  const model = buildScatterRenderModel([
    { id: 'a', name: 'Car A', origin: 'USA', horsepower: 100, mpg: 20, weight: 2500 },
    { id: 'b', name: 'Car B', origin: 'Japan', horsepower: 80, mpg: 32, weight: 1900 },
  ], {
    activeRange: [70, 120],
    highlightPredicates: [{ field: 'origin', op: 'equals', value: 'USA' }],
  })

  assert.equal(model.widgetKind, 'scatter')
  assert.equal(model.rows.length, 2)
  assert.deepEqual(model.domains.x, [70, 120])
  assert.deepEqual(model.domains.y, [20, 32])
  assert.equal(model.rows[0].category, 'USA')
  assert.equal(model.rows[1].size, 1900)
  assert.equal(model.highlightPredicates.length, 1)
})

test('other render model builders normalize semantic bar/line/heatmap/parallel/sankey data independently of provider', () => {
  const barModel = buildBarRenderModel([
    { origin: 'USA', avgHorsepower: 180, count: 12 },
    { origin: 'Japan', avgHorsepower: 92, count: 8 },
  ], { analysisOrigin: 'USA' })
  const lineModel = buildLineRenderModel([
    { year: 1970, origin: 'USA', avgMpg: 15.2, count: 9 },
    { year: 1971, origin: 'Japan', avgMpg: 31.5, count: 4 },
  ], { analysisYear: 1971 })
  const heatmapModel = buildHeatmapRenderModel([
    { origin: 'USA', cylinders: 8, avgHorsepower: 190, count: 7 },
    { origin: 'Japan', cylinders: 4, avgHorsepower: 88, count: 5 },
  ], { analysisOrigin: 'Japan' }, { analysisCylinders: [4] })
  const parallelModel = buildParallelCoordinatesRenderModel([
    { id: 'car-1', name: 'Car 1', origin: 'USA', horsepower: 140, mpg: 18, weight: 3200, acceleration: 12 },
    { id: 'car-2', name: 'Car 2', origin: 'Japan', horsepower: 82, mpg: 31, weight: 1900, acceleration: 16 },
  ], {
    focusedCarId: 'car-2',
    visibleDimensionKeys: ['horsepower', 'mpg', 'weight'],
    highlightPredicates: [{ field: 'origin', op: 'equals', value: 'Japan' }],
  })
  const sankeyModel = buildSankeyRenderModel({
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
    analyticalOverlay: { kind: 'sankeyAutoCollapse', topN: 2 },
  })

  assert.equal(barModel.widgetKind, 'bar')
  assert.equal(barModel.rows[0].category, 'USA')
  assert.equal(barModel.selectedCategory, 'USA')
  assert.equal(lineModel.widgetKind, 'line')
  assert.equal(lineModel.rows[1].series, 'Japan')
  assert.equal(lineModel.selectedX, 1971)
  assert.equal(heatmapModel.widgetKind, 'heatmap')
  assert.equal(heatmapModel.rows[0].x, 8)
  assert.equal(heatmapModel.selectedOrigin, 'Japan')
  assert.deepEqual(heatmapModel.selectedCylinders, [4])
  assert.equal(parallelModel.widgetKind, 'parallelCoordinates')
  assert.equal(parallelModel.rows[1].dimensions.weight, 1900)
  assert.deepEqual(parallelModel.visibleDimensions, ['horsepower', 'mpg', 'weight'])
  assert.equal(parallelModel.focusedRowId, 'car-2')
  assert.equal(parallelModel.highlightPredicates.length, 1)
  assert.equal(sankeyModel.widgetKind, 'sankey')
  assert.equal(sankeyModel.nodes[0].x, 48)
  assert.equal(sankeyModel.links[0].sourceNode?.id, 'origin:USA')
  assert.equal(sankeyModel.analyticalOverlay?.kind, 'sankeyAutoCollapse')
})
