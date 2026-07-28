import { captureVgplotRuntime } from './vgplotRuntimeCapture.js'

function readPlotEntry(runtime, plotId) {
  return runtime?.plots?.get?.(plotId) || null
}

function readPlotObject(runtime, plotId) {
  return readPlotEntry(runtime, plotId)?.plot || null
}

function readRuntimeValue(target) {
  if (target == null) return null
  if (typeof target.get === 'function') {
    try {
      return target.get()
    } catch {
      return null
    }
  }
  if (typeof target === 'object' && Object.prototype.hasOwnProperty.call(target, 'value')) {
    return target.value
  }
  return target
}

function safeCall(listener, payload) {
  try {
    listener?.(payload)
  } catch {}
}

function readPlotMetadata(plotEntry = null) {
  const plot = plotEntry?.plot || null
  return plot?.__widgetvaVgplotMeta
    || plot?.__widgetvaVgplot
    || plot?.widgetvaVgplot
    || null
}

function readConfigActionHandler(plotEntry = null, actionName = null) {
  if (typeof actionName !== 'string' || actionName.length === 0) return null
  const metadata = readPlotMetadata(plotEntry)
  const configActions = plotEntry?.configActions || metadata?.configActions || null
  if (!configActions) return null
  if (configActions instanceof Map) {
    return configActions.get(actionName) || null
  }
  if (typeof configActions === 'object' && !Array.isArray(configActions)) {
    return configActions[actionName] || null
  }
  return null
}

export function createVgplotController({ view = null, runtime = null } = {}) {
  const capturedRuntime = captureVgplotRuntime({ view, runtime })

  return {
    describePlots() {
      return [...capturedRuntime.plots.entries()].map(([plotId, entry]) => ({
        plotId,
        widgetKind: entry?.widgetKind || null,
      }))
    },
    readPlotState(plotId) {
      const plotEntry = readPlotEntry(capturedRuntime, plotId)
      const plot = plotEntry?.plot || null
      if (!plot) return null
      return {
        plotId,
        xDomain: typeof plot.getAttribute === 'function' ? plot.getAttribute('xDomain') ?? null : null,
        yDomain: typeof plot.getAttribute === 'function' ? plot.getAttribute('yDomain') ?? null : null,
      }
    },
    readParamState(name) {
      if (typeof name !== 'string' || name.length === 0) return null
      const param = capturedRuntime.params.get(name)
      if (!param) return null
      return {
        name,
        type: typeof param?.type === 'string' ? param.type : null,
        value: readRuntimeValue(param),
      }
    },
    setPlotAttribute(plotId, name, value, options = {}) {
      const plot = readPlotObject(capturedRuntime, plotId)
      if (!plot || typeof name !== 'string' || name.length === 0) return false
      if (typeof plot.setAttribute === 'function') {
        plot.setAttribute(name, value, options)
        return true
      }
      if (plot.attributes instanceof Map) {
        plot.attributes.set(name, value)
        return true
      }
      return false
    },
    updateSelection(name, nextValue) {
      if (typeof name !== 'string' || name.length === 0) return false
      const selection = capturedRuntime.selections.get(name)
      if (selection && typeof selection.set === 'function') {
        selection.set(nextValue)
        return true
      }
      if (selection && typeof selection.update === 'function') {
        selection.update(nextValue)
        return true
      }
      if (selection && typeof selection === 'object') {
        if (
          typeof nextValue?.type === 'string'
          && Object.prototype.hasOwnProperty.call(nextValue, 'value')
        ) {
          selection.type = nextValue.type
          selection.value = nextValue.value
          return true
        }
        selection.value = nextValue
        return true
      }
      capturedRuntime.selections.set(name, { value: nextValue })
      return true
    },
    updateParam(name, nextValue) {
      if (typeof name !== 'string' || name.length === 0) return false
      const param = capturedRuntime.params.get(name)
      if (param && typeof param.set === 'function') {
        param.set(nextValue)
        return true
      }
      if (param && typeof param.update === 'function') {
        param.update(nextValue)
        return true
      }
      if (param && typeof param === 'object') {
        if (
          typeof nextValue?.type === 'string'
          && Object.prototype.hasOwnProperty.call(nextValue, 'value')
        ) {
          param.type = nextValue.type
          param.value = nextValue.value
          return true
        }
        param.value = nextValue
        return true
      }
      capturedRuntime.params.set(name, { value: nextValue })
      return true
    },
    subscribePlotAttribute(plotId, name, listener) {
      const plot = readPlotObject(capturedRuntime, plotId)
      if (!plot || typeof listener !== 'function') {
        return () => {}
      }
      if (typeof plot.addAttributeListener === 'function') {
        const disposable = plot.addAttributeListener(name, listener)
        return typeof disposable === 'function' ? disposable : () => {}
      }
      if (plot.attributes instanceof Map) {
        safeCall(listener, plot.attributes.get(name))
      }
      return () => {}
    },
    executePlotConfigAction(plotId, actionName, params = {}) {
      const plotEntry = readPlotEntry(capturedRuntime, plotId)
      const plot = plotEntry?.plot || null
      const handler = readConfigActionHandler(plotEntry, actionName)
      if (!plot || !handler) return false
      if (typeof handler === 'function') {
        return handler({
          actionName,
          params,
          plot,
          plotId,
          controller: this,
          runtime: capturedRuntime,
        }) !== false
      }
      if (typeof handler?.run === 'function') {
        return handler.run({
          actionName,
          params,
          plot,
          plotId,
          controller: this,
          runtime: capturedRuntime,
        }) !== false
      }
      if (typeof handler?.execute === 'function') {
        return handler.execute({
          actionName,
          params,
          plot,
          plotId,
          controller: this,
          runtime: capturedRuntime,
        }) !== false
      }
      return false
    },
  }
}
