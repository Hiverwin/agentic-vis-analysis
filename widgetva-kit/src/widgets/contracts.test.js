import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeBarWidgetContract,
  describeHeatmapWidgetContract,
  describeLineWidgetContract,
  describeParallelCoordinatesWidgetContract,
  describeSankeyWidgetContract,
  describeScatterWidgetContract,
} from './index.js'

test('scatter widget contract lives under widgets and enumerates its widget-owned action/perception surface', () => {
  const contract = describeScatterWidgetContract()
  assert.equal(contract.kind, 'scatter')
  assert.deepEqual(contract.actionNames, ['scatter.brushRegion', 'scatter.zoomDomain', 'scatter.identifyClusters', 'scatter.showRegression'])
  assert.deepEqual(contract.perceptionNames, [
    'perception.computeCorrelation',
    'perception.findOutliers',
    'perception.findExtremes',
  ])
  assert.equal(contract.localSelection?.localSelectionFamily, 'interval')
  assert.deepEqual(contract.localSelection?.sourceActionNames, ['scatter.brushRegion'])
  assert.equal(contract.verification?.preferredReadMethod, 'readVerificationState')
  assert.equal(contract.verification?.supportedEffectTypes.includes('zoom'), true)
})

test('bar widget contract lives under widgets and enumerates its widget-owned action/perception surface', () => {
  const contract = describeBarWidgetContract()
  assert.equal(contract.kind, 'bar')
  assert.deepEqual(contract.actionNames, ['bar.selectCategory', 'bar.sortBars', 'bar.highlightTopN', 'bar.filterCategories', 'bar.addBars', 'bar.removeBars', 'bar.addBarItems', 'bar.removeBarItems', 'bar.filterSubcategories', 'bar.expandStack', 'bar.toggleStackMode'])
  assert.deepEqual(contract.perceptionNames, [
    'perception.compareGroups',
    'perception.findExtremes',
  ])
  assert.equal(contract.localSelection?.localSelectionFamily, 'category')
  assert.deepEqual(contract.localSelection?.sourceActionNames, ['bar.selectCategory'])
  assert.equal(contract.verification?.supportedEffectTypes.includes('highlight'), true)
})

test('line widget contract lives under widgets and enumerates its widget-owned action/perception surface', () => {
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

test('heatmap widget contract lives under widgets and enumerates its widget-owned action/perception surface', () => {
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

test('parallel coordinates widget contract lives under widgets and enumerates its widget-owned action/perception surface', () => {
  const contract = describeParallelCoordinatesWidgetContract()
  assert.equal(contract.kind, 'parallelCoordinates')
  assert.deepEqual(contract.actionNames, ['parallelCoordinates.brushAxes', 'parallelCoordinates.selectRecord', 'parallelCoordinates.reorderDimensions', 'parallelCoordinates.filterDimension', 'parallelCoordinates.filterByCategory', 'parallelCoordinates.highlightCategory', 'parallelCoordinates.hideDimensions', 'parallelCoordinates.resetHiddenDimensions'])
  assert.deepEqual(contract.perceptionNames, ['perception.findOutliers'])
  assert.equal(contract.localSelection?.localSelectionFamily, 'interval')
  assert.deepEqual(contract.localSelection?.sourceActionNames, ['parallelCoordinates.brushAxes', 'parallelCoordinates.selectRecord'])
  assert.equal(contract.verification?.supportedEffectTypes.includes('focus'), true)
})

test('sankey widget contract lives under widgets and enumerates its widget-owned action/perception surface', () => {
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
