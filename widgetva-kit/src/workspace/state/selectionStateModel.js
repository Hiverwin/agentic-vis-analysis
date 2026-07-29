import { cloneJsonValue as clone } from '../../shared/clone.js'
function cloneObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? clone(value)
    : {}
}

function normalizeString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function normalizePredicates(value) {
  return Array.isArray(value) ? clone(value) : []
}

function normalizePrimarySelectionPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return clone(value)
}

function normalizeWidgetGroupingKey(value) {
  return normalizeString(value)
}

export function normalizePrimarySelectionView(primary = null, registry = {}) {
  const normalizedPrimary = normalizePrimarySelectionPayload(primary)
  if (!normalizedPrimary) return null

  const normalizedRegistry = cloneObject(registry)
  const selectionRef = normalizeString(normalizedPrimary.selectionRef || normalizedPrimary.selection_ref)
  const registryEntry = selectionRef ? normalizedRegistry[selectionRef] || null : null
  const merged = {
    ...(registryEntry && typeof registryEntry === 'object' ? clone(registryEntry) : {}),
    ...normalizedPrimary,
  }

  return {
    ...merged,
    selectionRef: selectionRef || normalizeString(registryEntry?.selectionRef || registryEntry?.selection_ref),
    selectionId: normalizeString(merged.selectionId || merged.selection_id),
    sourceWidgetRef: normalizeString(merged.sourceWidgetRef || merged.source_widget_ref),
    sourceWidgetId: normalizeString(merged.sourceWidgetId || merged.source_widget_id),
    summary: typeof merged.summary === 'string' ? merged.summary : '',
    predicates: normalizePredicates(merged.predicates),
    selectionDataRef: normalizeString(merged.selectionDataRef || merged.selection_data_ref),
    scope: normalizeString(merged.scope) || 'local',
  }
}

function deriveByWidgetViewFromRegistry(registry = {}) {
  const normalizedRegistry = cloneObject(registry)
  const nextByWidget = {}

  for (const [selectionRef, selectionState] of Object.entries(normalizedRegistry)) {
    if (!selectionState || typeof selectionState !== 'object') continue
    const normalizedView = normalizePrimarySelectionView({
      ...selectionState,
      selectionRef,
    }, normalizedRegistry)
    const widgetKey = normalizeWidgetGroupingKey(
      normalizedView?.sourceWidgetId
      || normalizedView?.source_widget_id
      || normalizedView?.sourceWidgetRef
      || normalizedView?.source_widget_ref,
    )
    if (!widgetKey || !normalizedView) continue
    nextByWidget[widgetKey] = normalizedView
  }

  return nextByWidget
}

export function readSelectionRegistry(shared = {}) {
  const canonicalRegistry = cloneObject(shared?.selections?.registry)
  if (Object.keys(canonicalRegistry).length > 0) return canonicalRegistry
  return cloneObject(shared?.activeSelections)
}

export function readSelectionPrimaryView(shared = {}) {
  const registry = readSelectionRegistry(shared)
  const explicitPrimary = shared?.selections?.views?.primary
  if (explicitPrimary != null) {
    return normalizePrimarySelectionView(explicitPrimary, registry)
  }
  const legacyPrimarySelectionRef = normalizeString(shared?.primarySelectionRef)
  return legacyPrimarySelectionRef
    ? normalizePrimarySelectionView({ selectionRef: legacyPrimarySelectionRef }, registry)
    : null
}

export function readSelectionByWidgetView(shared = {}) {
  const registry = readSelectionRegistry(shared)
  const explicitByWidget = shared?.selections?.views?.byWidget
  if (!explicitByWidget || typeof explicitByWidget !== 'object' || Array.isArray(explicitByWidget)) {
    return deriveByWidgetViewFromRegistry(registry)
  }

  const normalizedByWidget = {}
  for (const [widgetKey, value] of Object.entries(explicitByWidget)) {
    const normalizedWidgetKey = normalizeWidgetGroupingKey(widgetKey)
    const normalizedView = normalizePrimarySelectionView(value, registry)
    if (!normalizedWidgetKey || !normalizedView) continue
    normalizedByWidget[normalizedWidgetKey] = normalizedView
  }

  return Object.keys(normalizedByWidget).length > 0
    ? normalizedByWidget
    : deriveByWidgetViewFromRegistry(registry)
}

export function readPrimarySelectionRef(shared = {}) {
  return readSelectionPrimaryView(shared)?.selectionRef || null
}

export function resolvePrimarySelectionEntry(shared = {}) {
  const registry = readSelectionRegistry(shared)
  const primaryView = readSelectionPrimaryView(shared)
  const primarySelectionRef = primaryView?.selectionRef || null
  if (primarySelectionRef && registry[primarySelectionRef]) {
    return [primarySelectionRef, normalizePrimarySelectionView(primaryView, registry)]
  }

  const selectionEntries = Object.entries(registry)
  if (selectionEntries.length === 0) return null
  const [selectionRef, selectionState] = selectionEntries[0]
  return [selectionRef, normalizePrimarySelectionView({
    ...(selectionState && typeof selectionState === 'object' ? selectionState : {}),
    selectionRef,
  }, registry)]
}

export function withSelectionSubmodel(shared = {}, {
  registry,
  primary,
  byWidget,
} = {}) {
  const previousSelections = shared?.selections || {}
  const previousViews = previousSelections?.views || {}
  const nextRegistry = registry === undefined ? readSelectionRegistry(shared) : cloneObject(registry)
  const nextPrimary = primary === undefined
    ? normalizePrimarySelectionView(previousViews?.primary, nextRegistry)
      || (normalizeString(shared?.primarySelectionRef)
        ? normalizePrimarySelectionView({ selectionRef: shared.primarySelectionRef }, nextRegistry)
        : null)
    : normalizePrimarySelectionView(primary, nextRegistry)
  const nextByWidget = byWidget === undefined
    ? readSelectionByWidgetView({
      ...(shared || {}),
      selections: {
        ...previousSelections,
        registry: nextRegistry,
        views: {
          ...previousViews,
          byWidget: previousViews?.byWidget,
        },
      },
    })
    : (() => {
      const normalizedByWidget = {}
      const rawByWidget = cloneObject(byWidget)
      for (const [widgetKey, value] of Object.entries(rawByWidget)) {
        const normalizedWidgetKey = normalizeWidgetGroupingKey(widgetKey)
        const normalizedView = normalizePrimarySelectionView(value, nextRegistry)
        if (!normalizedWidgetKey || !normalizedView) continue
        normalizedByWidget[normalizedWidgetKey] = normalizedView
      }
      return normalizedByWidget
    })()

  return {
    ...(shared || {}),
    activeSelections: nextRegistry,
    primarySelectionRef: nextPrimary?.selectionRef || null,
    selections: {
      ...previousSelections,
      registry: nextRegistry,
      views: {
        ...previousViews,
        primary: nextPrimary,
        byWidget: nextByWidget,
      },
    },
  }
}
