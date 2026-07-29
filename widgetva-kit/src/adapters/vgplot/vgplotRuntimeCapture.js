import { cloneJsonValue as clone } from '../../shared/clone.js'
import {
  wrapVgplotAPIContext,
  wrapVgplotPlot,
} from './vgplotRuntimeRegistry.js'

function ensureMap(value) {
  if (value instanceof Map) return new Map(value)
  if (Array.isArray(value)) return new Map(value)
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return new Map(Object.entries(value))
  }
  return new Map()
}

function isObjectRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function looksLikePlot(value) {
  return isObjectRecord(value)
    && (
      typeof value.getAttribute === 'function'
      || typeof value.setAttribute === 'function'
      || typeof value.addAttributeListener === 'function'
    )
}

function readMetadataBag(target) {
  if (!isObjectRecord(target)) return null
  return target.__widgetvaVgplotMeta
    || target.__widgetvaVgplot
    || target.widgetvaVgplot
    || null
}

function normalizeNamedEntries(value, {
  valueKey = 'value',
  additionalKeys = [],
} = {}) {
  if (value instanceof Map) {
    return [...value.entries()]
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => {
      if (Array.isArray(entry) && entry.length >= 2 && typeof entry[0] === 'string') {
        return [[entry[0], entry[1]]]
      }
      if (isObjectRecord(entry)) {
        const entryName = typeof entry.name === 'string' ? entry.name : (
          typeof entry.id === 'string' ? entry.id : (
            typeof entry.key === 'string' ? entry.key : null
          )
        )
        if (!entryName) return []
        const entryValue = entry[valueKey]
          || additionalKeys.map((key) => entry[key]).find(Boolean)
          || entry.param
          || entry.selection
          || entry.plot
          || entry
        return [[entryName, entryValue]]
      }
      if (typeof entry === 'string' && entry.length > 0) {
        return [[entry, entry]]
      }
      return [[`entry_${index}`, entry]]
    })
  }
  if (isObjectRecord(value)) {
    return Object.entries(value)
  }
  return []
}

function mergeNamedEntries(target, entries = []) {
  for (const [name, value] of entries) {
    if (typeof name !== 'string' || name.length === 0 || value == null) continue
    if (!target.has(name)) {
      target.set(name, value)
    }
  }
}

function readContextCandidates({ view = null, runtime = null, apiContext = null } = {}) {
  const candidates = [
    apiContext,
    runtime?.context,
    runtime?.apiContext,
    runtime?.__widgetvaVgplotContext,
    view?.context,
    view?.apiContext,
    view?.__widgetvaVgplotContext,
    view?.ownerDocument?.defaultView?.vg?.context,
    globalThis?.vg?.context,
  ].filter(isObjectRecord)

  const uniqueContexts = []
  for (const candidate of candidates) {
    if (!uniqueContexts.includes(candidate)) {
      uniqueContexts.push(candidate)
    }
  }
  return uniqueContexts
}

function collectNamedPlotsFromContext(context = null) {
  if (!isObjectRecord(context)) return new Map()
  const plots = new Map()
  mergeNamedEntries(plots, normalizeNamedEntries(context.namedPlots, { valueKey: 'plot' }))
  mergeNamedEntries(plots, normalizeNamedEntries(context.plotsByName, { valueKey: 'plot' }))
  return new Map(
    [...plots.entries()].filter(([, value]) => looksLikePlot(value)),
  )
}

function readPlotWidgetKind(plotEntry = null) {
  if (typeof plotEntry?.widgetKind === 'string' && plotEntry.widgetKind.length > 0) {
    return plotEntry.widgetKind
  }
  const metadata = readMetadataBag(plotEntry)
  if (typeof metadata?.widgetKind === 'string' && metadata.widgetKind.length > 0) {
    return metadata.widgetKind
  }
  return null
}

function collectPlotEntries({ view = null, runtime = null, contexts = [] } = {}) {
  const plots = new Map()
  for (const context of contexts) {
    for (const [plotId, plot] of collectNamedPlotsFromContext(context).entries()) {
      plots.set(plotId, {
        plot,
        widgetKind: readPlotWidgetKind(plot) || null,
      })
    }
  }
  if (looksLikePlot(view) && !plots.has('plot_main')) {
    plots.set('plot_main', {
      plot: view,
      widgetKind: readPlotWidgetKind(view) || null,
    })
  }
  if (looksLikePlot(runtime) && !plots.has('plot_runtime')) {
    plots.set('plot_runtime', {
      plot: runtime,
      widgetKind: readPlotWidgetKind(runtime) || null,
    })
  }
  return plots
}

function collectContextLevelEntries(contexts = [], keyNames = []) {
  const entries = new Map()
  for (const context of contexts) {
    for (const keyName of keyNames) {
      mergeNamedEntries(entries, normalizeNamedEntries(context?.[keyName]))
    }
    const metadata = readMetadataBag(context)
    for (const keyName of keyNames) {
      mergeNamedEntries(entries, normalizeNamedEntries(metadata?.[keyName]))
    }
  }
  return entries
}

function collectPlotLevelEntries(plots = new Map(), keyNames = []) {
  const entries = new Map()
  for (const [plotId, entry] of plots.entries()) {
    const plot = entry?.plot || null
    const metadata = readMetadataBag(plot)
    for (const keyName of keyNames) {
      mergeNamedEntries(entries, normalizeNamedEntries(plot?.[keyName]))
      mergeNamedEntries(entries, normalizeNamedEntries(metadata?.[keyName]))
    }
    if (metadata?.plotId && !entries.has(metadata.plotId) && keyNames.includes('plots')) {
      entries.set(metadata.plotId, plot)
    }
    if (!entries.has(plotId) && keyNames.includes('plots')) {
      entries.set(plotId, plot)
    }
  }
  return entries
}

function inferSelectionType(value) {
  if (typeof value?.type === 'string' && value.type.length > 0) return value.type
  if (typeof value?.selectionType === 'string' && value.selectionType.length > 0) return value.selectionType
  return null
}

function inferParamType(value) {
  if (typeof value?.type === 'string' && value.type.length > 0) return value.type
  if (typeof value?.paramType === 'string' && value.paramType.length > 0) return value.paramType
  return null
}

function finalizeSelectionEntries(entries = new Map()) {
  const selections = new Map()
  for (const [name, value] of entries.entries()) {
    if (!isObjectRecord(value)) continue
    const selectionType = inferSelectionType(value)
    if (!selectionType && typeof value.get !== 'function' && !Object.prototype.hasOwnProperty.call(value, 'value')) {
      continue
    }
    selections.set(name, value)
  }
  return selections
}

function finalizeParamEntries(entries = new Map()) {
  const params = new Map()
  for (const [name, value] of entries.entries()) {
    if (!isObjectRecord(value)) continue
    const paramType = inferParamType(value)
    if (!paramType && typeof value.get !== 'function' && !Object.prototype.hasOwnProperty.call(value, 'value')) {
      continue
    }
    params.set(name, value)
  }
  return params
}

export function createEmptyVgplotRuntime() {
  return {
    provider: 'vgplot',
    plots: new Map(),
    selections: new Map(),
    params: new Map(),
    context: null,
    binding: null,
  }
}

export function attachVgplotPlotRuntimeMetadata(plot, metadata = {}) {
  return wrapVgplotPlot(plot, {
    plotId: metadata?.plotId || null,
    context: metadata?.context || null,
    widgetKind: metadata?.widgetKind || null,
    metadata,
  })
}

export function attachVgplotContextRuntimeMetadata(context, metadata = {}) {
  return wrapVgplotAPIContext(context, {
    contextId: metadata?.contextId || null,
    metadata,
  })
}

export function normalizeVgplotRuntime(runtime = null) {
  if (!isObjectRecord(runtime)) {
    return createEmptyVgplotRuntime()
  }
  return {
    provider: 'vgplot',
    plots: ensureMap(runtime.plots),
    selections: ensureMap(runtime.selections),
    params: ensureMap(runtime.params),
    context: runtime.context || null,
    binding: runtime.binding && typeof runtime.binding === 'object' && !Array.isArray(runtime.binding)
      ? clone(runtime.binding)
      : null,
  }
}

function captureStructuredVgplotRuntime({ view = null, runtime = null, apiContext = null } = {}) {
  const contexts = readContextCandidates({ view, runtime, apiContext })
  const plots = collectPlotEntries({ view, runtime, contexts })
  const selectionEntries = new Map()
  const paramEntries = new Map()

  mergeNamedEntries(selectionEntries, collectContextLevelEntries(contexts, [
    'selections',
    'namedSelections',
    'selectionsByName',
  ]).entries())
  mergeNamedEntries(paramEntries, collectContextLevelEntries(contexts, [
    'params',
    'namedParams',
    'paramsByName',
  ]).entries())

  mergeNamedEntries(selectionEntries, collectPlotLevelEntries(plots, [
    'selections',
    'namedSelections',
    'selectionSet',
    'interactors',
    'interactorSet',
  ]).entries())
  mergeNamedEntries(paramEntries, collectPlotLevelEntries(plots, [
    'params',
    'namedParams',
    'paramSet',
    'interactors',
    'interactorSet',
  ]).entries())

  return normalizeVgplotRuntime({
    provider: 'vgplot',
    plots,
    selections: finalizeSelectionEntries(selectionEntries),
    params: finalizeParamEntries(paramEntries),
    context: contexts[0] || null,
    binding: null,
  })
}

export function captureVgplotRuntime({
  view = null,
  runtime = null,
  apiContext = null,
} = {}) {
  if (isObjectRecord(runtime?.__widgetvaVgplotRuntime)) {
    return normalizeVgplotRuntime(runtime.__widgetvaVgplotRuntime)
  }
  if (isObjectRecord(view?.__widgetvaVgplotRuntime)) {
    return normalizeVgplotRuntime(view.__widgetvaVgplotRuntime)
  }
  return captureStructuredVgplotRuntime({ view, runtime, apiContext })
}
