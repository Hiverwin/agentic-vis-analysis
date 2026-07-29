import { cloneJsonValue as clone } from '../../shared/clone.js'
import {
  readSelectionByWidgetView,
  readSelectionPrimaryView,
  readSelectionRegistry,
} from './selectionStateModel.js'
import { readFocusState } from './focusStateModel.js'
import { deriveHighlightState } from './highlightStateModel.js'
import { readViewportState } from './viewportStateModel.js'
import {
  readLinkDefinitions,
  readLinkTopologyState,
} from './linkStateModel.js'

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeDomain(value) {
  return Array.isArray(value) ? clone(value) : null
}

function normalizeOptionalObject(value) {
  return isPlainObject(value) ? clone(value) : null
}

function normalizeFocusKeys(value) {
  if (!isPlainObject(value)) return null
  const next = Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry != null),
  )
  return Object.keys(next).length > 0 ? next : null
}

function readOperationMode(value, fallback = null) {
  if (!isPlainObject(value)) return fallback
  if (typeof value.mode === 'string' && value.mode.trim().length > 0) {
    return value.mode.trim()
  }
  if (typeof value.sourceAction === 'string' && value.sourceAction.trim().length > 0) {
    return value.sourceAction.trim()
  }
  return fallback
}

function buildOperationModesByKind({
  sort = null,
  highlight = null,
  drillDown = null,
  aggregate = null,
  reencode = null,
  addRemove = null,
  navigate = null,
  focusKeys = null,
  xDomain = null,
  yDomain = null,
  zoom = null,
} = {}) {
  const next = {}

  const maybeSet = (kind, mode) => {
    if (typeof mode !== 'string' || mode.length === 0) return
    next[kind] = mode
  }

  if (xDomain || yDomain || zoom) {
    maybeSet('zoom', readOperationMode(zoom, 'zoom'))
  }
  if (sort) {
    maybeSet('sort', readOperationMode(sort, 'sort'))
  }
  if (highlight) {
    maybeSet('highlight', readOperationMode(highlight, 'highlight'))
  }
  if (drillDown) {
    maybeSet('drillDown', readOperationMode(drillDown, 'drillDown'))
  }
  if (aggregate) {
    maybeSet('aggregate', readOperationMode(aggregate, 'aggregate'))
  }
  if (reencode) {
    maybeSet('reencode', readOperationMode(reencode, 'reencode'))
  }
  if (addRemove) {
    maybeSet('addRemove', readOperationMode(addRemove, 'addRemove'))
  }
  if (navigate) {
    maybeSet('navigate', readOperationMode(navigate, 'navigate'))
  }
  if (focusKeys) {
    maybeSet('focus', 'focus')
  }

  return Object.keys(next).length > 0 ? next : null
}

function isNonEmptyObject(value) {
  return isPlainObject(value) && Object.keys(value).length > 0
}

function normalizePrimarySelection(value) {
  if (!isPlainObject(value)) return null
  const predicates = Array.isArray(value.predicates) ? clone(value.predicates) : []
  const hasMeaningfulSelection = [
    value.selectionRef,
    value.sourceWidgetRef,
    value.sourceWidgetId,
    value.summary,
    value.kind,
    value.scope,
  ].some((entry) => typeof entry === 'string' && entry.length > 0) || predicates.length > 0
  if (!hasMeaningfulSelection) return null
  return {
    selectionRef: value.selectionRef || null,
    sourceWidgetRef: value.sourceWidgetRef || null,
    sourceWidgetId: value.sourceWidgetId || null,
    summary: value.summary || null,
    predicates,
    kind: value.kind || null,
    scope: value.scope || null,
  }
}

function normalizeHighlightSummary(value) {
  const activeWidgetRefs = Array.isArray(value?.activeWidgetRefs)
    ? clone(value.activeWidgetRefs.filter((entry) => typeof entry === 'string' && entry.length > 0))
    : []
  const summaries = Array.from(new Set(
    (Array.isArray(value?.entries) ? value.entries : [])
      .map((entry) => entry?.summary)
      .filter((entry) => typeof entry === 'string' && entry.length > 0),
  ))
  if (activeWidgetRefs.length === 0 && summaries.length === 0) return null
  return {
    activeWidgetRefs,
    summaries,
  }
}

function normalizeViewportSummary(value) {
  if (!isPlainObject(value)) return null
  const next = {
    sourceWidgetRef: value.sourceWidgetRef || null,
    xDomain: normalizeDomain(value.xDomain),
    yDomain: normalizeDomain(value.yDomain),
    zoom: normalizeOptionalObject(value.zoom),
  }
  return next.sourceWidgetRef || next.xDomain || next.yDomain || next.zoom ? next : null
}

export function buildActiveAnalyticalContext({
  focusedWidgetRef = null,
  filters = {},
  primarySelection = null,
  highlight = null,
  viewport = null,
  comparisonTargets = [],
  links = null,
  viewStatesByWidget = {},
} = {}) {
  const globalFilters = isNonEmptyObject(filters) ? clone(filters) : null
  const normalizedSelection = normalizePrimarySelection(primarySelection)
  const normalizedHighlight = normalizeHighlightSummary(highlight)
  const normalizedViewport = normalizeViewportSummary(viewport)
  const normalizedViewStates = isNonEmptyObject(viewStatesByWidget) ? clone(viewStatesByWidget) : null
  const transformationContext = buildSharedTransformationContext({ viewStatesByWidget })
  const normalizedComparisonTargets = Array.isArray(comparisonTargets) && comparisonTargets.length > 0
    ? clone(comparisonTargets)
    : null
  const linkCount = Array.isArray(links?.definitions) ? links.definitions.length : 0

  const activeContextKinds = []
  if (focusedWidgetRef) activeContextKinds.push('focus')
  if (globalFilters) activeContextKinds.push('filters')
  if (normalizedSelection) activeContextKinds.push('selection')
  if (normalizedHighlight) activeContextKinds.push('highlight')
  if (normalizedViewport) activeContextKinds.push('viewport')
  if (normalizedViewStates) activeContextKinds.push('view')
  if (normalizedComparisonTargets || linkCount > 0) {
    activeContextKinds.push('structure')
  }

  return {
    activeContextKinds,
    focusedWidgetRef: focusedWidgetRef || null,
    globalFilters,
    primarySelection: normalizedSelection,
    highlight: normalizedHighlight,
    viewport: normalizedViewport,
    comparisonTargets: normalizedComparisonTargets,
    structure: {
      linkCount,
    },
    transformationContext,
    viewStatesByWidget: normalizedViewStates,
  }
}

function buildWidgetViewStateEntry(widgetRef, widgetState = {}) {
  const view = isPlainObject(widgetState?.view) ? widgetState.view : null
  if (!view) return null

  const entry = {
    widgetRef,
    widgetId: typeof widgetState?.widgetId === 'string' && widgetState.widgetId.length > 0
      ? widgetState.widgetId
      : null,
  }

  const activeKinds = []
  const xDomain = normalizeDomain(view.xDomain)
  const yDomain = normalizeDomain(view.yDomain)
  const zoom = normalizeOptionalObject(view.zoom)
  const sort = normalizeOptionalObject(view.sort)
  const highlight = normalizeOptionalObject(view.highlight)
  const drillDown = normalizeOptionalObject(view.drillDown)
  const aggregate = normalizeOptionalObject(view.aggregate)
  const reencode = normalizeOptionalObject(view.reencode)
  const addRemove = normalizeOptionalObject(view.addRemove)
  const navigate = normalizeOptionalObject(view.navigate)
  const focusKeys = normalizeFocusKeys(view.focusKeys)

  if (xDomain || yDomain || zoom) {
    activeKinds.push('zoom')
    if (xDomain) entry.xDomain = xDomain
    if (yDomain) entry.yDomain = yDomain
    if (zoom) entry.zoom = zoom
  }
  if (sort) {
    activeKinds.push('sort')
    entry.sort = sort
  }
  if (highlight) {
    activeKinds.push('highlight')
    entry.highlight = highlight
  }
  if (drillDown) {
    activeKinds.push('drillDown')
    entry.drillDown = drillDown
  }
  if (aggregate) {
    activeKinds.push('aggregate')
    entry.aggregate = aggregate
  }
  if (reencode) {
    activeKinds.push('reencode')
    entry.reencode = reencode
  }
  if (addRemove) {
    activeKinds.push('addRemove')
    entry.addRemove = addRemove
  }
  if (navigate) {
    activeKinds.push('navigate')
    entry.navigate = navigate
  }
  if (focusKeys) {
    activeKinds.push('focus')
    entry.focusKeys = focusKeys
  }

  if (activeKinds.length === 0) return null

  entry.activeKinds = activeKinds
  const operationModesByKind = buildOperationModesByKind({
    sort,
    highlight,
    drillDown,
    aggregate,
    reencode,
    addRemove,
    navigate,
    focusKeys,
    xDomain,
    yDomain,
    zoom,
  })
  if (operationModesByKind) {
    entry.operationModesByKind = operationModesByKind
  }
  return entry
}

export function buildSharedViewStateByWidget(state = {}) {
  const next = {}
  for (const [widgetRef, widgetState] of Object.entries(state?.widgets || {})) {
    if (typeof widgetRef !== 'string' || widgetRef.length === 0) continue
    const entry = buildWidgetViewStateEntry(widgetRef, widgetState)
    if (!entry) continue
    next[widgetRef] = entry
  }
  return next
}

export function buildSharedViewContext({ viewStatesByWidget = {} } = {}) {
  const normalized = isPlainObject(viewStatesByWidget) ? clone(viewStatesByWidget) : {}
  return {
    activeWidgetRefs: Object.keys(normalized),
    widgets: normalized,
  }
}

export function buildSharedTransformationContext({ viewStatesByWidget = {} } = {}) {
  const normalized = isPlainObject(viewStatesByWidget) ? viewStatesByWidget : {}
  const transformationKinds = new Set([
    'sort',
    'drillDown',
    'aggregate',
    'reencode',
    'addRemove',
    'navigate',
  ])
  const next = {}

  for (const [widgetRef, entry] of Object.entries(normalized)) {
    if (!isPlainObject(entry)) continue
    const activeKinds = (Array.isArray(entry.activeKinds) ? entry.activeKinds : [])
      .filter((kind) => transformationKinds.has(kind))
    if (activeKinds.length === 0) continue

    const nextEntry = {
      widgetRef,
      widgetId: typeof entry.widgetId === 'string' && entry.widgetId.length > 0
        ? entry.widgetId
        : null,
      activeKinds,
    }

    if (entry.sort) nextEntry.sort = clone(entry.sort)
    if (entry.drillDown) nextEntry.drillDown = clone(entry.drillDown)
    if (entry.aggregate) nextEntry.aggregate = clone(entry.aggregate)
    if (entry.reencode) nextEntry.reencode = clone(entry.reencode)
    if (entry.addRemove) nextEntry.addRemove = clone(entry.addRemove)
    if (entry.navigate) nextEntry.navigate = clone(entry.navigate)
    if (isPlainObject(entry.operationModesByKind)) {
      nextEntry.operationModesByKind = Object.fromEntries(
        activeKinds
          .filter((kind) => typeof entry.operationModesByKind[kind] === 'string' && entry.operationModesByKind[kind].length > 0)
          .map((kind) => [kind, entry.operationModesByKind[kind]]),
      )
    }

    next[widgetRef] = nextEntry
  }

  return {
    activeWidgetRefs: Object.keys(next),
    widgets: next,
  }
}

export function buildSharedFilterContext({
  filters = {},
  primarySelection = null,
} = {}) {
  return {
    globalFilters: clone(filters || {}),
    selectionRef: primarySelection?.selectionRef || null,
    selectionPredicates: Array.isArray(primarySelection?.predicates)
      ? clone(primarySelection.predicates)
      : [],
  }
}

export function buildSharedViewportContext({
  focusedWidgetRef = null,
  viewport = null,
  comparisonTargets = [],
} = {}) {
  return {
    focusedWidgetRef: focusedWidgetRef || null,
    viewport: clone(viewport || null),
    comparisonTargets: clone(Array.isArray(comparisonTargets) ? comparisonTargets : []),
  }
}

export function buildSharedSemanticFocus({
  focusedWidgetRef = null,
  focus = null,
  primarySelection = null,
  highlight = null,
} = {}) {
  return {
    focusedWidgetRef: focusedWidgetRef || null,
    focus: clone(focus || null),
    primarySelection: clone(primarySelection || null),
    highlight: clone(highlight || {
      entries: [],
      activeWidgetRefs: [],
    }),
  }
}

export function buildSharedStructuralContext({
  links = null,
  comparisonTargets = [],
} = {}) {
  return {
    links: clone(links || {
      definitions: [],
      topology: null,
    }),
    comparisonTargets: clone(Array.isArray(comparisonTargets) ? comparisonTargets : []),
  }
}

export function buildSharedAnalyticalStateModel(state = {}, { derivedTopology = {} } = {}) {
  const shared = state?.shared || {}
  const focusedWidgetRef = shared?.focusedWidget || null
  const selections = {
    registry: readSelectionRegistry(shared),
    primary: readSelectionPrimaryView(shared),
    byWidget: readSelectionByWidgetView(shared),
  }
  const filters = clone(shared?.globalFilters || {})
  const focus = readFocusState(shared, state?.widgets || {})
  const highlight = deriveHighlightState(state)
  const viewport = readViewportState(shared)
  const comparisonTargets = clone(Array.isArray(shared?.comparisonTargets) ? shared.comparisonTargets : [])
  const viewStatesByWidget = buildSharedViewStateByWidget(state)
  const sharedTopology = readLinkTopologyState(shared)
  const links = {
    definitions: readLinkDefinitions(shared),
    topology: Object.keys(sharedTopology).length > 0 ? sharedTopology : clone(derivedTopology || {}),
  }

  return {
    focusedWidgetRef,
    selections,
    filters,
    focus,
    highlight,
    viewStatesByWidget,
    viewport,
    comparisonTargets,
    links,
    sharedFilterContext: buildSharedFilterContext({
      filters,
      primarySelection: selections.primary,
    }),
    sharedViewportContext: buildSharedViewportContext({
      focusedWidgetRef,
      viewport,
      comparisonTargets,
    }),
    sharedViewContext: buildSharedViewContext({
      viewStatesByWidget,
    }),
    sharedTransformationContext: buildSharedTransformationContext({
      viewStatesByWidget,
    }),
    sharedSemanticFocus: buildSharedSemanticFocus({
      focusedWidgetRef,
      focus,
      primarySelection: selections.primary,
      highlight,
    }),
    sharedStructuralContext: buildSharedStructuralContext({
      links,
      comparisonTargets,
    }),
    activeAnalyticalContext: buildActiveAnalyticalContext({
      focusedWidgetRef,
      filters,
      primarySelection: selections.primary,
      highlight,
      viewport,
      comparisonTargets,
      links,
      viewStatesByWidget,
    }),
  }
}

export function readSharedAnalyticalState(state = {}, options = {}) {
  return buildSharedAnalyticalStateModel(state, options)
}

export function readSharedFilterContext(state = {}, options = {}) {
  return clone(readSharedAnalyticalState(state, options).sharedFilterContext)
}

export function readSharedViewportContext(state = {}, options = {}) {
  return clone(readSharedAnalyticalState(state, options).sharedViewportContext)
}

export function readSharedSemanticFocus(state = {}, options = {}) {
  return clone(readSharedAnalyticalState(state, options).sharedSemanticFocus)
}

export function readSharedStructuralContext(state = {}, options = {}) {
  return clone(readSharedAnalyticalState(state, options).sharedStructuralContext)
}

export function readActiveAnalyticalContext(state = {}, options = {}) {
  return clone(readSharedAnalyticalState(state, options).activeAnalyticalContext)
}

export function readViewStatesByWidget(state = {}) {
  return buildSharedViewStateByWidget(state)
}

export function readSharedViewContext(state = {}) {
  return buildSharedViewContext({
    viewStatesByWidget: readViewStatesByWidget(state),
  })
}

export function readSharedTransformationContext(state = {}) {
  return buildSharedTransformationContext({
    viewStatesByWidget: readViewStatesByWidget(state),
  })
}
