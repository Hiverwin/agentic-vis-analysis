import {
  executeVegaLiteAggregateData,
  executeVegaLiteChangeEncoding,
} from './families/widgetSpecActions.js'
import {
  executeVegaLiteScatterBrushLike,
  executeVegaLiteScatterFilterCategorical,
  executeVegaLiteScatterIdentifyClusters,
  executeVegaLiteScatterShowRegression,
} from './families/scatterSpecActions.js'
import {
  executeVegaLiteBarAddRemoveBars,
  executeVegaLiteBarAddRemoveItems,
  executeVegaLiteBarExpandStack,
  executeVegaLiteBarFilterCategories,
  executeVegaLiteBarFilterSubcategories,
  executeVegaLiteBarHighlightTopN,
  executeVegaLiteBarSortBars,
  executeVegaLiteBarToggleStackMode,
} from './families/barSpecActions.js'
import {
  executeVegaLiteLineBoldLines,
  executeVegaLiteLineDrilldown,
  executeVegaLiteLineFilterLines,
  executeVegaLiteLineFocusLines,
  executeVegaLiteLineHighlightTrend,
  executeVegaLiteLineResample,
  executeVegaLiteLineResetDrilldown,
  executeVegaLiteLineResetResample,
  executeVegaLiteLineShowMovingAverage,
  executeVegaLiteLineZoomXRegion,
} from './families/lineSpecActions.js'
import {
  executeVegaLiteParallelFilterByCategory,
  executeVegaLiteParallelFilterDimension,
  executeVegaLiteParallelHideDimensions,
  executeVegaLiteParallelHighlightCategory,
  executeVegaLiteParallelReorderDimensions,
  executeVegaLiteParallelResetHiddenDimensions,
} from './families/parallelCoordinatesSpecActions.js'
import {
  executeVegaLiteHeatmapAddMarginalBars,
  executeVegaLiteHeatmapAdjustColorScale,
  executeVegaLiteHeatmapClusterRowsCols,
  executeVegaLiteHeatmapDrilldownAxis,
  executeVegaLiteHeatmapFilterCells,
  executeVegaLiteHeatmapFilterCellsByRegion,
  executeVegaLiteHeatmapHighlightRegion,
  executeVegaLiteHeatmapHighlightRegionByValue,
  executeVegaLiteHeatmapResetDrilldown,
  executeVegaLiteHeatmapThresholdMask,
  executeVegaLiteHeatmapTranspose,
} from './families/heatmapSpecActions.js'
import {
  executeVegaSankeyAutoCollapseByRank,
  executeVegaSankeyCollapseNodes,
  executeVegaSankeyColorFlows,
  executeVegaSankeyExpandNode,
  executeVegaSankeyFilterFlow,
  executeVegaSankeyHighlightPath,
  executeVegaSankeyReorderNodesInLayer,
  executeVegaSankeyTraceNode,
} from './families/sankeySpecActions.js'

export function executeVegaLiteSpecAction({ actionName = null, spec = null, params = {} } = {}) {
  switch (actionName) {
    case 'widget.aggregateData':
      return { handled: true, nextSpec: executeVegaLiteAggregateData(spec, params) }
    case 'widget.changeEncoding':
      return { handled: true, nextSpec: executeVegaLiteChangeEncoding(spec, params) }
    case 'scatter.brushRegion':
      return { handled: true, nextSpec: executeVegaLiteScatterBrushLike(spec, params, 'brush') }
    case 'scatter.selectRegion':
      return { handled: true, nextSpec: executeVegaLiteScatterBrushLike(spec, params, 'region') }
    case 'scatter.filterCategorical':
      return { handled: true, nextSpec: executeVegaLiteScatterFilterCategorical(spec, params) }
    case 'scatter.identifyClusters':
      return { handled: true, nextSpec: executeVegaLiteScatterIdentifyClusters(spec, params) }
    case 'scatter.showRegression':
      return { handled: true, nextSpec: executeVegaLiteScatterShowRegression(spec, params) }
    case 'bar.filterCategories':
      return { handled: true, nextSpec: executeVegaLiteBarFilterCategories(spec, params) }
    case 'bar.sortBars':
      return { handled: true, nextSpec: executeVegaLiteBarSortBars(spec, params) }
    case 'bar.highlightTopN':
      return { handled: true, nextSpec: executeVegaLiteBarHighlightTopN(spec, params) }
    case 'bar.addBars':
      return { handled: true, nextSpec: executeVegaLiteBarAddRemoveBars(spec, params, 'add') }
    case 'bar.removeBars':
      return { handled: true, nextSpec: executeVegaLiteBarAddRemoveBars(spec, params, 'remove') }
    case 'bar.addBarItems':
      return { handled: true, nextSpec: executeVegaLiteBarAddRemoveItems(spec, params, 'add') }
    case 'bar.removeBarItems':
      return { handled: true, nextSpec: executeVegaLiteBarAddRemoveItems(spec, params, 'remove') }
    case 'bar.filterSubcategories':
      return { handled: true, nextSpec: executeVegaLiteBarFilterSubcategories(spec, params) }
    case 'bar.expandStack':
      return { handled: true, nextSpec: executeVegaLiteBarExpandStack(spec, params) }
    case 'bar.toggleStackMode':
      return { handled: true, nextSpec: executeVegaLiteBarToggleStackMode(spec, params) }
    case 'line.zoomXRegion':
      return { handled: true, nextSpec: executeVegaLiteLineZoomXRegion(spec, params) }
    case 'line.focusLines':
      return { handled: true, nextSpec: executeVegaLiteLineFocusLines(spec, params) }
    case 'line.highlightTrend':
      return { handled: true, nextSpec: executeVegaLiteLineHighlightTrend(spec, params) }
    case 'line.showMovingAverage':
      return { handled: true, nextSpec: executeVegaLiteLineShowMovingAverage(spec, params) }
    case 'line.drillDownXAxis':
      return { handled: true, nextSpec: executeVegaLiteLineDrilldown(spec, params) }
    case 'line.resetDrilldownXAxis':
      return { handled: true, nextSpec: executeVegaLiteLineResetDrilldown(spec, params) }
    case 'line.resampleXAxis':
      return { handled: true, nextSpec: executeVegaLiteLineResample(spec, params) }
    case 'line.resetResampleXAxis':
      return { handled: true, nextSpec: executeVegaLiteLineResetResample(spec, params) }
    case 'line.boldLines':
      return { handled: true, nextSpec: executeVegaLiteLineBoldLines(spec, params) }
    case 'line.filterLines':
      return { handled: true, nextSpec: executeVegaLiteLineFilterLines(spec, params) }
    case 'parallelCoordinates.reorderDimensions':
      return { handled: true, nextSpec: executeVegaLiteParallelReorderDimensions(spec, params) }
    case 'parallelCoordinates.filterDimension':
      return { handled: true, nextSpec: executeVegaLiteParallelFilterDimension(spec, params) }
    case 'parallelCoordinates.filterByCategory':
      return { handled: true, nextSpec: executeVegaLiteParallelFilterByCategory(spec, params) }
    case 'parallelCoordinates.highlightCategory':
      return { handled: true, nextSpec: executeVegaLiteParallelHighlightCategory(spec, params) }
    case 'parallelCoordinates.hideDimensions':
      return { handled: true, nextSpec: executeVegaLiteParallelHideDimensions(spec, params) }
    case 'parallelCoordinates.resetHiddenDimensions':
      return { handled: true, nextSpec: executeVegaLiteParallelResetHiddenDimensions(spec, params) }
    case 'heatmap.filterCells':
      return { handled: true, nextSpec: executeVegaLiteHeatmapFilterCells(spec, params) }
    case 'heatmap.drilldownAxis':
      return { handled: true, nextSpec: executeVegaLiteHeatmapDrilldownAxis(spec, params) }
    case 'heatmap.resetDrilldown':
      return { handled: true, nextSpec: executeVegaLiteHeatmapResetDrilldown(spec, params) }
    case 'heatmap.addMarginalBars':
      return { handled: true, nextSpec: executeVegaLiteHeatmapAddMarginalBars(spec, params) }
    case 'heatmap.highlightRegion':
      return { handled: true, nextSpec: executeVegaLiteHeatmapHighlightRegion(spec, params) }
    case 'heatmap.adjustColorScale':
      return { handled: true, nextSpec: executeVegaLiteHeatmapAdjustColorScale(spec, params) }
    case 'heatmap.thresholdMask':
      return { handled: true, nextSpec: executeVegaLiteHeatmapThresholdMask(spec, params) }
    case 'heatmap.filterCellsByRegion':
      return { handled: true, nextSpec: executeVegaLiteHeatmapFilterCellsByRegion(spec, params) }
    case 'heatmap.highlightRegionByValue':
      return { handled: true, nextSpec: executeVegaLiteHeatmapHighlightRegionByValue(spec, params) }
    case 'heatmap.clusterRowsCols':
      return { handled: true, nextSpec: executeVegaLiteHeatmapClusterRowsCols(spec, params) }
    case 'heatmap.transpose':
      return { handled: true, nextSpec: executeVegaLiteHeatmapTranspose(spec, params) }
    case 'sankey.filterFlow':
      return { handled: true, nextSpec: executeVegaSankeyFilterFlow(spec, params) }
    case 'sankey.collapseNodes':
      return { handled: true, nextSpec: executeVegaSankeyCollapseNodes(spec, params) }
    case 'sankey.expandNode':
      return { handled: true, nextSpec: executeVegaSankeyExpandNode(spec, params) }
    case 'sankey.highlightPath':
      return { handled: true, nextSpec: executeVegaSankeyHighlightPath(spec, params) }
    case 'sankey.traceNode':
      return { handled: true, nextSpec: executeVegaSankeyTraceNode(spec, params) }
    case 'sankey.colorFlows':
      return { handled: true, nextSpec: executeVegaSankeyColorFlows(spec, params) }
    case 'sankey.reorderNodesInLayer':
      return { handled: true, nextSpec: executeVegaSankeyReorderNodesInLayer(spec, params) }
    case 'sankey.autoCollapseByRank':
      return { handled: true, nextSpec: executeVegaSankeyAutoCollapseByRank(spec, params) }
    default:
      return { handled: false, reason: 'unsupported_action' }
  }
}

export function executeProviderSpecAction({
  provider = null,
  actionName = null,
  spec = null,
  params = {},
} = {}) {
  const normalizedProvider = typeof provider === 'string' ? provider.toLowerCase() : null
  if (normalizedProvider === 'vega-lite' || normalizedProvider === 'vegalite') {
    return executeVegaLiteSpecAction({ actionName, spec, params })
  }
  if (normalizedProvider === 'vega') {
    switch (actionName) {
      case 'sankey.filterFlow':
        return { handled: true, nextSpec: executeVegaSankeyFilterFlow(spec, params) }
      case 'sankey.collapseNodes':
        return { handled: true, nextSpec: executeVegaSankeyCollapseNodes(spec, params) }
      case 'sankey.expandNode':
        return { handled: true, nextSpec: executeVegaSankeyExpandNode(spec, params) }
      case 'sankey.highlightPath':
        return { handled: true, nextSpec: executeVegaSankeyHighlightPath(spec, params) }
      case 'sankey.traceNode':
        return { handled: true, nextSpec: executeVegaSankeyTraceNode(spec, params) }
      case 'sankey.colorFlows':
        return { handled: true, nextSpec: executeVegaSankeyColorFlows(spec, params) }
      case 'sankey.reorderNodesInLayer':
        return { handled: true, nextSpec: executeVegaSankeyReorderNodesInLayer(spec, params) }
      case 'sankey.autoCollapseByRank':
        return { handled: true, nextSpec: executeVegaSankeyAutoCollapseByRank(spec, params) }
      default:
        return { handled: false, reason: 'unsupported_action' }
    }
  }
  return { handled: false, reason: 'unsupported_provider' }
}
