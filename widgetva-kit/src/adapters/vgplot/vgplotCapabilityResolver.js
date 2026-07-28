import { captureVgplotRuntime } from './vgplotRuntimeCapture.js'
import { isVgplotSupportedWidgetKind } from './vgplotSupportedKinds.js'

const PERCEPTION_NAMES_BY_WIDGET_KIND = Object.freeze({
  scatter: ['perception.computeCorrelation', 'perception.findOutliers', 'perception.findExtremes'],
  bar: ['perception.compareGroups', 'perception.findExtremes'],
  line: ['perception.detectAnomalies', 'perception.findExtremes', 'perception.compareGroups'],
  heatmap: ['perception.findExtremes', 'perception.findOutliers'],
})

const CONFIG_ACTIONS_BY_WIDGET_KIND = Object.freeze({
  scatter: ['scatter.identifyClusters', 'scatter.showRegression'],
  bar: ['bar.toggleStackMode', 'bar.sortBars', 'bar.expandStack', 'bar.highlightTopN', 'bar.filterSubcategories', 'bar.addBars', 'bar.removeBars', 'bar.addBarItems', 'bar.removeBarItems'],
  line: ['line.highlightTrend', 'line.showMovingAverage', 'line.boldLines', 'line.filterLines', 'line.drillDownXAxis', 'line.resetDrilldownXAxis', 'line.resampleXAxis', 'line.resetResampleXAxis'],
  heatmap: ['heatmap.adjustColorScale', 'heatmap.transpose', 'heatmap.highlightRegionByValue', 'heatmap.drilldownAxis', 'heatmap.resetDrilldown', 'heatmap.addMarginalBars', 'heatmap.thresholdMask', 'heatmap.clusterRowsCols'],
})

function readSelectionType(selection) {
  const value = typeof selection?.get === 'function' ? selection.get() : selection?.value
  if (value && typeof value === 'object' && typeof value.type === 'string') {
    return value.type
  }
  if (typeof selection?.type === 'string') return selection.type
  return null
}

function readParamType(param) {
  const value = typeof param?.get === 'function' ? param.get() : param?.value
  if (value && typeof value === 'object' && typeof value.type === 'string') {
    return value.type
  }
  if (typeof param?.type === 'string') return param.type
  return null
}

function readPlotDomains(plot) {
  if (!plot) return { hasXDomain: false, hasYDomain: false }
  if (typeof plot.getAttribute === 'function') {
    return {
      hasXDomain: plot.getAttribute('xDomain') != null,
      hasYDomain: plot.getAttribute('yDomain') != null,
    }
  }
  if (plot.attributes instanceof Map) {
    return {
      hasXDomain: plot.attributes.has('xDomain'),
      hasYDomain: plot.attributes.has('yDomain'),
    }
  }
  return { hasXDomain: false, hasYDomain: false }
}

function unique(values = []) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))]
}

function hasAnySelectionType(selectionTypes = [], allowedTypes = []) {
  return allowedTypes.some((selectionType) => selectionTypes.includes(selectionType))
}

function readPlotMetadata(entry = null) {
  const plot = entry?.plot || null
  return plot?.__widgetvaVgplotMeta
    || plot?.__widgetvaVgplot
    || plot?.widgetvaVgplot
    || null
}

function readConfigActionNames(entry = null) {
  const metadata = readPlotMetadata(entry)
  const configActions = entry?.configActions || metadata?.configActions || null
  if (!configActions) return []
  if (configActions instanceof Map) {
    return [...configActions.keys()].filter((name) => typeof name === 'string' && name.length > 0)
  }
  if (typeof configActions === 'object' && !Array.isArray(configActions)) {
    return Object.keys(configActions).filter((name) => typeof name === 'string' && name.length > 0)
  }
  return []
}

function buildSelectionTypeToNamesMap(selections = new Map()) {
  const result = {}
  for (const [selectionName, selection] of selections.entries()) {
    const selectionType = readSelectionType(selection)
    if (typeof selectionType !== 'string' || selectionType.length === 0) continue
    if (!Array.isArray(result[selectionType])) {
      result[selectionType] = []
    }
    result[selectionType].push(selectionName)
  }
  return result
}

function buildParamTypeToNamesMap(params = new Map()) {
  const result = {}
  for (const [paramName, param] of params.entries()) {
    const paramType = readParamType(param)
    if (typeof paramType !== 'string' || paramType.length === 0) continue
    if (!Array.isArray(result[paramType])) {
      result[paramType] = []
    }
    result[paramType].push(paramName)
  }
  return result
}

export function resolveVgplotCapabilities({
  widgetKind = null,
  view = null,
  runtime = null,
} = {}) {
  const capturedRuntime = captureVgplotRuntime({ view, runtime })
  const selectionTypes = unique([...capturedRuntime.selections.values()].map(readSelectionType))
  const paramTypes = unique([...capturedRuntime.params.values()].map(readParamType))
  const plotStates = [...capturedRuntime.plots.values()].map((entry) => readPlotDomains(entry?.plot || null))
  const supportsXDomain = plotStates.some((state) => state.hasXDomain)
  const supportsYDomain = plotStates.some((state) => state.hasYDomain)
  const supportsPanZoom = paramTypes.includes('panZoom')
  const supportsPanZoomX = paramTypes.includes('panZoomX')
  const supportsPanZoomY = paramTypes.includes('panZoomY')
  const supported = isVgplotSupportedWidgetKind(widgetKind)
  const configActionNames = unique(
    [...capturedRuntime.plots.values()].flatMap((entry) => readConfigActionNames(entry)),
  )

  const actionNames = []
  if (supported && widgetKind === 'scatter' && hasAnySelectionType(selectionTypes, ['intervalXY', 'intervalX', 'intervalY', 'region'])) {
    actionNames.push('scatter.brushRegion', 'scatter.selectRegion')
  }
  if (supported && widgetKind === 'scatter' && selectionTypes.some((type) => type?.startsWith?.('toggle'))) {
    actionNames.push('scatter.filterCategorical')
  }
  if (supported && widgetKind === 'scatter' && ((supportsXDomain && supportsYDomain) || supportsPanZoom)) {
    actionNames.push('scatter.zoomDomain')
  }
  if (supported && widgetKind === 'bar' && selectionTypes.some((type) => type?.startsWith?.('toggle'))) {
    actionNames.push('bar.clickCategory', 'bar.selectCategory', 'bar.filterCategories')
  }
  if (supported && Array.isArray(CONFIG_ACTIONS_BY_WIDGET_KIND[widgetKind])) {
    for (const actionName of CONFIG_ACTIONS_BY_WIDGET_KIND[widgetKind]) {
      if (configActionNames.includes(actionName)) {
        actionNames.push(actionName)
      }
    }
  }
  if (supported && widgetKind === 'line' && selectionTypes.some((type) => type?.startsWith?.('toggle'))) {
    actionNames.push('line.selectSeries')
  }
  if (supported && widgetKind === 'line' && selectionTypes.some((type) => type?.startsWith?.('toggle'))) {
    actionNames.push('line.focusLines')
  }
  if (supported && widgetKind === 'line' && selectionTypes.includes('nearestX')) {
    actionNames.push('line.selectXValue')
  }
  if (supported && widgetKind === 'line' && (supportsXDomain || supportsPanZoom || supportsPanZoomX)) {
    actionNames.push('line.zoomXRegion')
  }
  if (supported && widgetKind === 'heatmap' && selectionTypes.some((type) => type?.startsWith?.('toggle'))) {
    actionNames.push('heatmap.filterCells', 'heatmap.selectCell')
  }
  if (supported && widgetKind === 'heatmap' && hasAnySelectionType(selectionTypes, ['intervalXY', 'intervalX', 'intervalY', 'region'])) {
    actionNames.push('heatmap.selectSubmatrix', 'heatmap.filterCellsByRegion')
  }
  if (supported && widgetKind === 'heatmap' && hasAnySelectionType(selectionTypes, ['intervalXY', 'intervalX', 'intervalY', 'region'])) {
    actionNames.push('heatmap.highlightRegion')
  }
  return {
    widgetKind,
    supported: Boolean(supported),
    supportedActionNames: unique(actionNames),
    supportedPerceptionNames: supported ? [...(PERCEPTION_NAMES_BY_WIDGET_KIND[widgetKind] || [])] : [],
    selectionTypes,
    selectionTypeToNames: buildSelectionTypeToNamesMap(capturedRuntime.selections),
    paramTypes,
    paramTypeToNames: buildParamTypeToNamesMap(capturedRuntime.params),
    plotIds: [...capturedRuntime.plots.keys()],
    selectionNames: [...capturedRuntime.selections.keys()],
    paramNames: [...capturedRuntime.params.keys()],
    configActionNames,
    supportsXDomain,
    supportsYDomain,
    supportsPanZoom,
    supportsPanZoomX,
    supportsPanZoomY,
  }
}
