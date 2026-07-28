function isObjectRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function clone(value) {
  if (value == null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((entry) => clone(entry))
  const next = {}
  for (const [key, entry] of Object.entries(value)) {
    next[key] = clone(entry)
  }
  return next
}

function readMetadataBag(target) {
  if (!isObjectRecord(target)) return null
  return target.__widgetvaVgplotMeta
    || target.__widgetvaVgplot
    || target.widgetvaVgplot
    || null
}

function mergeMetadata(target, metadata = {}) {
  if (!isObjectRecord(target)) return target
  const currentMetadata = readMetadataBag(target)
  target.__widgetvaVgplotMeta = {
    ...(isObjectRecord(currentMetadata) ? clone(currentMetadata) : {}),
    ...(isObjectRecord(metadata) ? clone(metadata) : {}),
  }
  return target
}

function ensureRegistryStore(registry) {
  if (!isObjectRecord(registry)) {
    throw new Error('A vgplot runtime registry store is required.')
  }
  if (!(registry.contexts instanceof Map)) {
    registry.contexts = new Map()
  }
  if (!(registry.plots instanceof Map)) {
    registry.plots = new Map()
  }
  return registry
}

function inferEntryName(entry, fallback = null) {
  if (typeof entry === 'string' && entry.length > 0) return entry
  if (Array.isArray(entry) && typeof entry[0] === 'string' && entry[0].length > 0) {
    return entry[0]
  }
  if (isObjectRecord(entry)) {
    if (typeof entry.name === 'string' && entry.name.length > 0) return entry.name
    if (typeof entry.id === 'string' && entry.id.length > 0) return entry.id
    if (typeof entry.key === 'string' && entry.key.length > 0) return entry.key
  }
  return fallback
}

function ensureNamedPlotMap(context) {
  if (!(context.namedPlots instanceof Map)) {
    const nextMap = new Map()
    if (Array.isArray(context.namedPlots)) {
      for (const entry of context.namedPlots) {
        const name = inferEntryName(entry)
        const value = Array.isArray(entry) ? entry[1] : entry
        if (name && value) nextMap.set(name, value)
      }
    }
    context.namedPlots = nextMap
  }
  return context.namedPlots
}

function ensureNamedStoreArray(metadata, key) {
  if (!Array.isArray(metadata[key])) {
    metadata[key] = []
  }
  return metadata[key]
}

function registerNamedEntries(metadata, key, entries = []) {
  const target = ensureNamedStoreArray(metadata, key)
  for (const entry of entries) {
    if (Array.isArray(entry) && typeof entry[0] === 'string') {
      const index = target.findIndex((item) => Array.isArray(item) && item[0] === entry[0])
      if (index >= 0) target[index] = entry
      else target.push(entry)
      continue
    }
    const name = inferEntryName(entry)
    if (!name) continue
    const normalizedEntry = Array.isArray(entry) ? entry : [name, entry]
    const index = target.findIndex((item) => Array.isArray(item) && item[0] === name)
    if (index >= 0) target[index] = normalizedEntry
    else target.push(normalizedEntry)
  }
}

function ensureConfigActionStore(metadata) {
  if (!isObjectRecord(metadata.configActions)) {
    metadata.configActions = {}
  }
  return metadata.configActions
}

function ensureConfigStateKeys(metadata) {
  if (!Array.isArray(metadata.configStateKeys)) {
    metadata.configStateKeys = []
  }
  return metadata.configStateKeys
}

function registerConfigActions(metadata, configActions = {}, { stateKeys = [], readConfigState = null } = {}) {
  const target = ensureConfigActionStore(metadata)
  if (configActions instanceof Map) {
    for (const [actionName, handler] of configActions.entries()) {
      if (typeof actionName !== 'string' || actionName.length === 0 || typeof handler !== 'function') continue
      target[actionName] = handler
    }
  } else if (isObjectRecord(configActions)) {
    for (const [actionName, handler] of Object.entries(configActions)) {
      if (typeof actionName !== 'string' || actionName.length === 0 || typeof handler !== 'function') continue
      target[actionName] = handler
    }
  }
  const targetStateKeys = ensureConfigStateKeys(metadata)
  for (const stateKey of Array.isArray(stateKeys) ? stateKeys : []) {
    if (typeof stateKey !== 'string' || stateKey.length === 0) continue
    if (!targetStateKeys.includes(stateKey)) {
      targetStateKeys.push(stateKey)
    }
  }
  if (typeof readConfigState === 'function') {
    metadata.readConfigState = readConfigState
  }
}

export function createWidgetVAVgplotRegistry({ registryId = 'widgetva-vgplot-registry' } = {}) {
  const registry = ensureRegistryStore({
    registryId,
    contexts: new Map(),
    plots: new Map(),
  })

  return {
    registryId,
    describe() {
      return {
        registryId,
        contextIds: [...registry.contexts.keys()],
        plotIds: [...registry.plots.keys()],
      }
    },
    registerContext(contextId, context, metadata = {}) {
      if (!contextId || !isObjectRecord(context)) return context
      ensureNamedPlotMap(context)
      mergeMetadata(context, {
        contextId,
        ...metadata,
      })
      registry.contexts.set(contextId, context)
      return context
    },
    registerPlot(plotId, plot, metadata = {}) {
      if (!plotId || !isObjectRecord(plot)) return plot
      mergeMetadata(plot, {
        plotId,
        ...metadata,
      })
      registry.plots.set(plotId, plot)
      return plot
    },
    attachSelectionEntries(target, selections = []) {
      if (!isObjectRecord(target)) return target
      mergeMetadata(target, {})
      registerNamedEntries(target.__widgetvaVgplotMeta, 'selections', selections)
      return target
    },
    attachParamEntries(target, params = []) {
      if (!isObjectRecord(target)) return target
      mergeMetadata(target, {})
      registerNamedEntries(target.__widgetvaVgplotMeta, 'params', params)
      return target
    },
    attachConfigActions(target, configActions = {}, options = {}) {
      if (!isObjectRecord(target)) return target
      mergeMetadata(target, {})
      registerConfigActions(target.__widgetvaVgplotMeta, configActions, options)
      return target
    },
    getContext(contextId) {
      return registry.contexts.get(contextId) || null
    },
    getPlot(plotId) {
      return registry.plots.get(plotId) || null
    },
    readContexts() {
      return new Map(registry.contexts)
    },
    readPlots() {
      return new Map(registry.plots)
    },
  }
}

export function wrapVgplotAPIContext(context, {
  registry = null,
  contextId = null,
  metadata = {},
} = {}) {
  if (!isObjectRecord(context)) return context
  if (registry) {
    registry.registerContext(contextId || metadata?.contextId || `context_${registry.readContexts().size + 1}`, context, metadata)
  } else {
    mergeMetadata(context, {
      ...(contextId ? { contextId } : {}),
      ...metadata,
    })
    ensureNamedPlotMap(context)
  }
  return context
}

export function wrapVgplotPlot(plot, {
  registry = null,
  plotId = null,
  context = null,
  widgetKind = null,
  metadata = {},
} = {}) {
  if (!isObjectRecord(plot)) return plot
  const resolvedPlotId = plotId || metadata?.plotId || 'plot_main'
  const nextMetadata = {
    ...(widgetKind ? { widgetKind } : {}),
    ...metadata,
  }
  if (registry) {
    registry.registerPlot(resolvedPlotId, plot, nextMetadata)
    if (context && isObjectRecord(context)) {
      ensureNamedPlotMap(context).set(resolvedPlotId, plot)
    }
  } else {
    mergeMetadata(plot, {
      plotId: resolvedPlotId,
      ...nextMetadata,
    })
    if (context && isObjectRecord(context)) {
      ensureNamedPlotMap(context).set(resolvedPlotId, plot)
    }
  }
  return plot
}

export function installVgplotRuntimeAssembly({
  registryId = 'widgetva-vgplot-registry',
  registry = null,
} = {}) {
  const activeRegistry = registry || createWidgetVAVgplotRegistry({ registryId })

  return {
    registry: activeRegistry,
    describe() {
      return activeRegistry.describe()
    },
    createContext(context = {}, {
      contextId = null,
      metadata = {},
    } = {}) {
      return wrapVgplotAPIContext(context, {
        registry: activeRegistry,
        contextId,
        metadata,
      })
    },
    registerPlot(plot, {
      context = null,
      plotId = null,
      widgetKind = null,
      metadata = {},
      selections = [],
      params = [],
      configActions = {},
      configStateKeys = [],
      readConfigState = null,
    } = {}) {
      const wrappedPlot = wrapVgplotPlot(plot, {
        registry: activeRegistry,
        context,
        plotId,
        widgetKind,
        metadata,
      })
      if (Array.isArray(selections) && selections.length > 0) {
        activeRegistry.attachSelectionEntries(wrappedPlot, selections)
      }
      if (Array.isArray(params) && params.length > 0) {
        activeRegistry.attachParamEntries(wrappedPlot, params)
      }
      if (
        (configActions instanceof Map && configActions.size > 0)
        || (isObjectRecord(configActions) && Object.keys(configActions).length > 0)
        || (Array.isArray(configStateKeys) && configStateKeys.length > 0)
        || typeof readConfigState === 'function'
      ) {
        activeRegistry.attachConfigActions(wrappedPlot, configActions, {
          stateKeys: configStateKeys,
          readConfigState,
        })
      }
      return wrappedPlot
    },
    attachSelections(target, selections = []) {
      return activeRegistry.attachSelectionEntries(target, selections)
    },
    attachParams(target, params = []) {
      return activeRegistry.attachParamEntries(target, params)
    },
    attachConfigActions(target, configActions = {}, options = {}) {
      return activeRegistry.attachConfigActions(target, configActions, options)
    },
  }
}
