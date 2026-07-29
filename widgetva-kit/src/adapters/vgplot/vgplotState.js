import { cloneJsonValue as clone } from '../../shared/clone.js'
import { captureVgplotRuntime } from './vgplotRuntimeCapture.js'
import { readVgplotBinding } from './vgplotBinding.js'

function readSelectionType(selection) {
  if (selection == null) return null
  if (typeof selection?.get === 'function') {
    try {
      const value = selection.get()
      if (value && typeof value === 'object' && typeof value.type === 'string') {
        return value.type
      }
    } catch {}
  }
  if (typeof selection?.type === 'string') return selection.type
  return null
}

function readParamType(param) {
  if (param == null) return null
  if (typeof param?.get === 'function') {
    try {
      const value = param.get()
      if (value && typeof value === 'object' && typeof value.type === 'string') {
        return value.type
      }
    } catch {}
  }
  if (typeof param?.type === 'string') return param.type
  return null
}

function normalizeViewport(viewport = null) {
  if (!viewport || typeof viewport !== 'object' || Array.isArray(viewport)) return null
  const normalized = {
    ...(Array.isArray(viewport.xDomain) ? { xDomain: clone(viewport.xDomain) } : {}),
    ...(Array.isArray(viewport.yDomain) ? { yDomain: clone(viewport.yDomain) } : {}),
    ...(viewport.zoom && typeof viewport.zoom === 'object' ? { zoom: clone(viewport.zoom) } : {}),
  }
  return Object.keys(normalized).length > 0 ? normalized : null
}

function readSelectionValue(selection) {
  if (selection == null) return null
  if (typeof selection.get === 'function') {
    try {
      return clone(selection.get())
    } catch {
      return null
    }
  }
  if (
    selection
    && typeof selection === 'object'
    && typeof selection.type === 'string'
    && Object.prototype.hasOwnProperty.call(selection, 'value')
  ) {
    return clone({
      type: selection.type,
      value: selection.value,
    })
  }
  if (selection && typeof selection === 'object' && Object.prototype.hasOwnProperty.call(selection, 'value')) {
    return clone(selection.value)
  }
  return clone(selection)
}

function readParamValue(param) {
  if (param == null) return null
  if (typeof param.get === 'function') {
    try {
      return clone(param.get())
    } catch {
      return null
    }
  }
  if (
    param
    && typeof param === 'object'
    && typeof param.type === 'string'
    && Object.prototype.hasOwnProperty.call(param, 'value')
  ) {
    return clone({
      type: param.type,
      value: param.value,
    })
  }
  if (param && typeof param === 'object' && Object.prototype.hasOwnProperty.call(param, 'value')) {
    return clone(param.value)
  }
  return clone(param)
}

function readPlotAttribute(plot, attributeName) {
  if (!plot) return null
  if (typeof plot.getAttribute === 'function') {
    try {
      return clone(plot.getAttribute(attributeName))
    } catch {
      return null
    }
  }
  if (plot.attributes instanceof Map) {
    return clone(plot.attributes.get(attributeName))
  }
  return null
}

function readPlotMetadata(plot) {
  return plot?.__widgetvaVgplotMeta
    || plot?.__widgetvaVgplot
    || plot?.widgetvaVgplot
    || null
}

function readConfigStateFromPlot(plot) {
  const metadata = readPlotMetadata(plot)
  const configStateKeys = Array.isArray(metadata?.configStateKeys)
    ? metadata.configStateKeys.filter((key) => typeof key === 'string' && key.length > 0)
    : []
  if (typeof metadata?.readConfigState === 'function') {
    try {
      const customConfig = metadata.readConfigState(plot)
      if (customConfig && typeof customConfig === 'object' && !Array.isArray(customConfig) && Object.keys(customConfig).length > 0) {
        return clone(customConfig)
      }
    } catch {}
  }
  const stackMode = readPlotAttribute(plot, 'stackMode')
  const xOffsetMode = readPlotAttribute(plot, 'xOffsetMode')
  const sortMode = readPlotAttribute(plot, 'sortMode')
  const colorEncodingMode = readPlotAttribute(plot, 'colorEncodingMode')
  const expandStackCategory = readPlotAttribute(plot, 'expandStackCategory')
  const expandStackGroupField = readPlotAttribute(plot, 'expandStackGroupField')
  const colorScaleScheme = readPlotAttribute(plot, 'colorScaleScheme')
  const colorScaleDomain = readPlotAttribute(plot, 'colorScaleDomain')
  const transposeMode = readPlotAttribute(plot, 'transposeMode')
  const trendMode = readPlotAttribute(plot, 'trendMode')
  const movingAverageWindow = readPlotAttribute(plot, 'movingAverageWindow')
  const drilldownLevel = readPlotAttribute(plot, 'drilldownLevel')
  const drilldownValue = readPlotAttribute(plot, 'drilldownValue')
  const highlightValueRange = readPlotAttribute(plot, 'highlightValueRange')
  const config = {
    ...(stackMode != null ? { stackMode } : {}),
    ...(xOffsetMode != null ? { xOffsetMode } : {}),
    ...(sortMode != null ? { sortMode } : {}),
    ...(colorEncodingMode != null ? { colorEncodingMode } : {}),
    ...(expandStackCategory != null ? { expandStackCategory } : {}),
    ...(expandStackGroupField != null ? { expandStackGroupField } : {}),
    ...(colorScaleScheme != null ? { colorScaleScheme } : {}),
    ...(Array.isArray(colorScaleDomain) ? { colorScaleDomain } : {}),
    ...(transposeMode != null ? { transposeMode } : {}),
    ...(trendMode != null ? { trendMode } : {}),
    ...(movingAverageWindow != null ? { movingAverageWindow } : {}),
    ...(drilldownLevel != null ? { drilldownLevel } : {}),
    ...(drilldownValue != null ? { drilldownValue } : {}),
    ...(highlightValueRange != null ? { highlightValueRange } : {}),
  }
  for (const key of configStateKeys) {
    if (Object.prototype.hasOwnProperty.call(config, key)) continue
    const value = readPlotAttribute(plot, key)
    if (value != null) {
      config[key] = value
    }
  }
  return Object.keys(config).length > 0 ? config : null
}

export function readSelectionStateFromRuntime({ view = null, runtime = null, state = null } = {}) {
  const cachedSelections = Object.values(state?.selections || {}).filter(Boolean)
  if (cachedSelections.length > 0) {
    return clone(cachedSelections[0])
  }
  const capturedRuntime = captureVgplotRuntime({ view, runtime })
  for (const selection of capturedRuntime.selections.values()) {
    const value = readSelectionValue(selection)
    if (value != null) return value
  }
  return null
}

export function readViewportStateFromRuntime({ view = null, runtime = null, state = null } = {}) {
  const stateViewport = normalizeViewport(state?.view)
  if (stateViewport) return stateViewport

  const capturedRuntime = captureVgplotRuntime({ view, runtime })
  const viewportFromPlots = {
    xDomain: null,
    yDomain: null,
  }
  for (const entry of capturedRuntime.plots.values()) {
    const plot = entry?.plot || null
    if (viewportFromPlots.xDomain == null) {
      viewportFromPlots.xDomain = readPlotAttribute(plot, 'xDomain')
    }
    if (viewportFromPlots.yDomain == null) {
      viewportFromPlots.yDomain = readPlotAttribute(plot, 'yDomain')
    }
  }
  const viewportFromParams = {
    xDomain: null,
    yDomain: null,
  }
  for (const param of capturedRuntime.params.values()) {
    const value = readParamValue(param)
    if (!value || typeof value !== 'object') continue
    const normalizedValue = value?.value && typeof value.value === 'object' ? value.value : value
    if (viewportFromParams.xDomain == null && Array.isArray(normalizedValue?.xDomain)) {
      viewportFromParams.xDomain = clone(normalizedValue.xDomain)
    }
    if (viewportFromParams.yDomain == null && Array.isArray(normalizedValue?.yDomain)) {
      viewportFromParams.yDomain = clone(normalizedValue.yDomain)
    }
  }
  return normalizeViewport({
    xDomain: viewportFromPlots.xDomain ?? viewportFromParams.xDomain,
    yDomain: viewportFromPlots.yDomain ?? viewportFromParams.yDomain,
  })
}

export function readVgplotState({ view = null, runtime = null, state = null } = {}) {
  const capturedRuntime = captureVgplotRuntime({ view, runtime })
  let config = null
  const viewportDrivers = []
  for (const entry of capturedRuntime.plots.values()) {
    const plot = entry?.plot || null
    config = readConfigStateFromPlot(plot)
    if (config) break
    if (readPlotAttribute(plot, 'xDomain') != null && !viewportDrivers.includes('plotAttribute.xDomain')) {
      viewportDrivers.push('plotAttribute.xDomain')
    }
    if (readPlotAttribute(plot, 'yDomain') != null && !viewportDrivers.includes('plotAttribute.yDomain')) {
      viewportDrivers.push('plotAttribute.yDomain')
    }
  }
  if (viewportDrivers.length === 0) {
    for (const entry of capturedRuntime.plots.values()) {
      const plot = entry?.plot || null
      if (readPlotAttribute(plot, 'xDomain') != null && !viewportDrivers.includes('plotAttribute.xDomain')) {
        viewportDrivers.push('plotAttribute.xDomain')
      }
      if (readPlotAttribute(plot, 'yDomain') != null && !viewportDrivers.includes('plotAttribute.yDomain')) {
        viewportDrivers.push('plotAttribute.yDomain')
      }
    }
  }
  const selectionTypes = []
  for (const selection of capturedRuntime.selections.values()) {
    const selectionType = readSelectionType(selection)
    if (typeof selectionType === 'string' && selectionType.length > 0 && !selectionTypes.includes(selectionType)) {
      selectionTypes.push(selectionType)
    }
  }
  const paramTypes = []
  for (const param of capturedRuntime.params.values()) {
    const paramType = readParamType(param)
    if (typeof paramType === 'string' && paramType.length > 0) {
      if (!paramTypes.includes(paramType)) {
        paramTypes.push(paramType)
      }
      const paramDriver = `param.${paramType}`
      if (!viewportDrivers.includes(paramDriver)) {
        viewportDrivers.push(paramDriver)
      }
    }
  }
  return {
    selection: readSelectionStateFromRuntime({ view, runtime, state }),
    viewport: readViewportStateFromRuntime({ view, runtime, state }),
    config,
    focus: state?.focus || null,
    binding: readVgplotBinding({ view, runtime }),
    providerState: {
      plotIds: [...capturedRuntime.plots.keys()],
      selectionNames: [...capturedRuntime.selections.keys()],
      selectionTypes,
      paramNames: [...capturedRuntime.params.keys()],
      paramTypes,
      viewportDrivers,
      configKeys: config ? Object.keys(config) : [],
    },
  }
}
