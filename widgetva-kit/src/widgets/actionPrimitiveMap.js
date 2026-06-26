import { describeBarWidgetContract } from './bar/index.js'
import { describeHeatmapWidgetContract } from './heatmap/index.js'
import { describeLineWidgetContract } from './line/index.js'
import { describeParallelCoordinatesWidgetContract } from './parallelCoordinates/index.js'
import { describeSankeyWidgetContract } from './sankey/index.js'
import { describeScatterWidgetContract } from './scatter/index.js'

export const WIDGET_ACTION_PRIMITIVE_FAMILIES = [
  'filter',
  'sort',
  'drillDown',
  'aggregate',
  'reencode',
  'zoom',
  'select',
  'highlight',
  'focus',
  'annotate',
  'navigate',
  'addRemove',
]

export const WIDGET_ACTION_PRIMITIVE_MAP = {
  'bar.selectCategory': 'select',
  'bar.sortBars': 'sort',
  'bar.highlightTopN': 'highlight',
  'bar.filterCategories': 'filter',
  'bar.addBars': 'addRemove',
  'bar.removeBars': 'addRemove',
  'bar.addBarItems': 'addRemove',
  'bar.removeBarItems': 'addRemove',
  'bar.filterSubcategories': 'filter',
  'bar.expandStack': 'reencode',
  'bar.toggleStackMode': 'reencode',

  'line.selectSeries': 'select',
  'line.selectXValue': 'select',
  'line.zoomXRegion': 'zoom',
  'line.focusLines': 'focus',
  'line.highlightTrend': 'annotate',
  'line.showMovingAverage': 'annotate',
  'line.drillDownXAxis': 'drillDown',
  'line.resetDrilldownXAxis': 'navigate',
  'line.resampleXAxis': 'aggregate',
  'line.resetResampleXAxis': 'navigate',
  'line.boldLines': 'highlight',
  'line.filterLines': 'filter',

  'scatter.brushRegion': 'select',
  'scatter.zoomDomain': 'zoom',
  'scatter.identifyClusters': 'annotate',
  'scatter.showRegression': 'annotate',

  'heatmap.filterCells': 'filter',
  'heatmap.selectCell': 'select',
  'heatmap.selectSubmatrix': 'select',
  'heatmap.drilldownAxis': 'drillDown',
  'heatmap.resetDrilldown': 'navigate',
  'heatmap.addMarginalBars': 'annotate',
  'heatmap.highlightRegion': 'highlight',
  'heatmap.adjustColorScale': 'reencode',
  'heatmap.thresholdMask': 'highlight',
  'heatmap.filterCellsByRegion': 'filter',
  'heatmap.highlightRegionByValue': 'highlight',
  'heatmap.clusterRowsCols': 'aggregate',
  'heatmap.transpose': 'reencode',

  'parallelCoordinates.brushAxes': 'select',
  'parallelCoordinates.selectRecord': 'select',
  'parallelCoordinates.reorderDimensions': 'reencode',
  'parallelCoordinates.filterDimension': 'filter',
  'parallelCoordinates.filterByCategory': 'filter',
  'parallelCoordinates.highlightCategory': 'highlight',
  'parallelCoordinates.hideDimensions': 'reencode',
  'parallelCoordinates.resetHiddenDimensions': 'reencode',

  'sankey.focusFlow': 'select',
  'sankey.selectAggregateNode': 'select',
  'sankey.filterFlow': 'filter',
  'sankey.collapseNodes': 'aggregate',
  'sankey.expandNode': 'navigate',
  'sankey.highlightPath': 'highlight',
  'sankey.traceNode': 'focus',
  'sankey.colorFlows': 'reencode',
  'sankey.reorderNodesInLayer': 'reencode',
  'sankey.autoCollapseByRank': 'aggregate',
}

const WIDGET_CONTRACT_DESCRIBERS = [
  describeBarWidgetContract,
  describeLineWidgetContract,
  describeScatterWidgetContract,
  describeHeatmapWidgetContract,
  describeParallelCoordinatesWidgetContract,
  describeSankeyWidgetContract,
]

export function listAllWidgetActionNames() {
  return WIDGET_CONTRACT_DESCRIBERS.flatMap((describeContract) => describeContract().actionNames || [])
}

export function getWidgetActionPrimitive(actionName) {
  return WIDGET_ACTION_PRIMITIVE_MAP[actionName] || null
}

export function listUnmappedWidgetActions() {
  return listAllWidgetActionNames().filter((name) => !getWidgetActionPrimitive(name))
}
