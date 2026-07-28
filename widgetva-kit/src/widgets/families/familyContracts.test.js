import test from 'node:test'
import assert from 'node:assert/strict'

import { describeBarWidgetContract } from './bar/index.js'
import { describeHeatmapWidgetContract } from './heatmap/index.js'
import { describeLineWidgetContract } from './line/index.js'
import { describeParallelCoordinatesWidgetContract } from './parallelCoordinates/index.js'
import { describeSankeyWidgetContract } from './sankey/index.js'
import { describeScatterWidgetContract } from './scatter/index.js'
import { listWidgetFamilies } from './index.js'

test('scatter family contract enumerates the scatter action/perception surface', () => {
  const contract = describeScatterWidgetContract()
  assert.equal(contract.kind, 'scatter')
  assert.deepEqual(contract.actionNames, ['scatter.brushRegion', 'scatter.selectRegion', 'scatter.zoomDomain', 'scatter.filterCategorical', 'scatter.identifyClusters', 'scatter.showRegression'])
  assert.deepEqual(contract.perceptionNames, [
    'perception.computeCorrelation',
    'perception.findOutliers',
    'perception.findExtremes',
  ])
  assert.equal(contract.localSelection?.localSelectionFamily, 'interval')
  assert.deepEqual(contract.localSelection?.sourceActionNames, ['scatter.brushRegion', 'scatter.selectRegion'])
  assert.equal(contract.verification?.preferredReadMethod, 'readVerificationState')
  assert.equal(contract.verification?.supportedEffectTypes.includes('zoom'), true)
})

test('bar family contract enumerates the bar action/perception surface', () => {
  const contract = describeBarWidgetContract()
  assert.equal(contract.kind, 'bar')
  assert.deepEqual(contract.actionNames, ['bar.clickCategory', 'bar.selectCategory', 'bar.sortBars', 'bar.highlightTopN', 'bar.filterCategories', 'bar.addBars', 'bar.removeBars', 'bar.addBarItems', 'bar.removeBarItems', 'bar.filterSubcategories', 'bar.expandStack', 'bar.toggleStackMode'])
  assert.deepEqual(contract.perceptionNames, [
    'perception.compareGroups',
  ])
  assert.equal(contract.localSelection?.localSelectionFamily, 'category')
  assert.deepEqual(contract.localSelection?.sourceActionNames, ['bar.clickCategory', 'bar.selectCategory'])
  assert.equal(contract.verification?.supportedEffectTypes.includes('highlight'), true)
})

test('line family contract enumerates the line action/perception surface', () => {
  const contract = describeLineWidgetContract()
  assert.equal(contract.kind, 'line')
  assert.deepEqual(contract.actionNames, ['line.selectSeries', 'line.selectXValue', 'line.zoomXRegion', 'line.focusLines', 'line.highlightTrend', 'line.showMovingAverage', 'line.drillDownXAxis', 'line.resetDrilldownXAxis', 'line.resampleXAxis', 'line.resetResampleXAxis', 'line.boldLines', 'line.filterLines'])
  assert.deepEqual(contract.perceptionNames, [
    'perception.detectAnomalies',
    'perception.findExtremes',
    'perception.compareGroups',
  ])
  assert.equal(contract.localSelection?.localSelectionFamily, 'category')
  assert.deepEqual(contract.localSelection?.sourceActionNames, ['line.selectSeries', 'line.selectXValue'])
  assert.equal(contract.verification?.supportedEffectTypes.includes('zoom'), true)
})

test('heatmap family contract enumerates the heatmap action/perception surface', () => {
  const contract = describeHeatmapWidgetContract()
  assert.equal(contract.kind, 'heatmap')
  assert.deepEqual(contract.actionNames, ['heatmap.filterCells', 'heatmap.selectCell', 'heatmap.selectSubmatrix', 'heatmap.drilldownAxis', 'heatmap.resetDrilldown', 'heatmap.addMarginalBars', 'heatmap.highlightRegion', 'heatmap.adjustColorScale', 'heatmap.thresholdMask', 'heatmap.filterCellsByRegion', 'heatmap.highlightRegionByValue', 'heatmap.clusterRowsCols', 'heatmap.transpose'])
  assert.deepEqual(contract.perceptionNames, [
    'perception.findExtremes',
    'perception.findOutliers',
  ])
  assert.equal(contract.localSelection?.localSelectionFamily, 'cell')
  assert.deepEqual(contract.localSelection?.selectionKinds, ['cell', 'region'])
  assert.equal(contract.verification?.supportedEffectTypes.includes('highlight'), true)
})

test('parallel coordinates family contract enumerates the parallel coordinates action/perception surface', () => {
  const contract = describeParallelCoordinatesWidgetContract()
  assert.equal(contract.kind, 'parallelCoordinates')
  assert.deepEqual(contract.actionNames, ['parallelCoordinates.selectRecord', 'parallelCoordinates.reorderDimensions', 'parallelCoordinates.filterDimension', 'parallelCoordinates.filterByCategory', 'parallelCoordinates.highlightCategory', 'parallelCoordinates.hideDimensions', 'parallelCoordinates.resetHiddenDimensions'])
  assert.deepEqual(contract.perceptionNames, ['perception.findOutliers'])
  assert.equal(contract.localSelection?.localSelectionFamily, 'record')
  assert.deepEqual(contract.localSelection?.sourceActionNames, ['parallelCoordinates.selectRecord'])
  assert.equal(contract.verification?.supportedEffectTypes.includes('focus'), true)
})

test('sankey family contract enumerates the sankey action/perception surface', () => {
  const contract = describeSankeyWidgetContract()
  assert.equal(contract.kind, 'sankey')
  assert.deepEqual(contract.actionNames, ['sankey.focusFlow', 'sankey.selectAggregateNode', 'sankey.filterFlow', 'sankey.collapseNodes', 'sankey.expandNode', 'sankey.highlightPath', 'sankey.traceNode', 'sankey.colorFlows', 'sankey.reorderNodesInLayer', 'sankey.autoCollapseByRank'])
  assert.deepEqual(contract.perceptionNames, [
    'perception.getNodeOptions',
    'perception.calculateConversionRate',
    'perception.findBottleneck',
    'perception.findExtremes',
    'perception.compareGroups',
  ])
  assert.equal(contract.localSelection?.localSelectionFamily, 'category')
  assert.deepEqual(contract.localSelection?.sourceActionNames, ['sankey.focusFlow', 'sankey.selectAggregateNode'])
  assert.equal(contract.verification?.supportedEffectTypes.includes('focus'), true)
})

test('widget families do not carry duplicate workflow playbooks', () => {
  for (const family of listWidgetFamilies()) {
    assert.equal('playbook' in family, false, `${family.kind} should not duplicate canonical workflows`)
  }
})
