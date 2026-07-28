function noop() {}

function emptyArray() {
  return []
}

function emptyObject() {
  return {}
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function selectValue(selectors, name, readState, fallbackSelector) {
  const selector = selectors?.[name] || fallbackSelector
  return typeof selector === 'function' ? selector(readState()) : null
}

function resolveAction(actions, name, fallbackFactory) {
  const action = actions?.[name]
  if (typeof action === 'function') return action
  return fallbackFactory
}

function invokeResolvedAction(actions, name, readState, fallbackKey, args = []) {
  const action = actions?.[name]
  if (typeof action === 'function') {
    return action(...args)
  }
  const state = readState() || {}
  const fallbackAction = state?.[fallbackKey]
  if (typeof fallbackAction === 'function') {
    return fallbackAction.call(state, ...args)
  }
  return undefined
}

function firstNonNull(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value
  }
  return null
}

function normalizeString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function normalizeSelectionRegistry(registry) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) return {}
  return cloneValue(registry)
}

function normalizePrimarySelectionRef(primary) {
  if (typeof primary === 'string' && primary.length > 0) return primary
  if (primary && typeof primary === 'object') {
    if (typeof primary.ref === 'string' && primary.ref.length > 0) return primary.ref
    if (typeof primary.selectionRef === 'string' && primary.selectionRef.length > 0) return primary.selectionRef
  }
  return null
}

function normalizeFocusState(focus) {
  if (!focus || typeof focus !== 'object' || Array.isArray(focus)) return null
  const widgetRef = typeof focus.widgetRef === 'string'
    ? focus.widgetRef
    : typeof focus.widget_ref === 'string'
      ? focus.widget_ref
      : null
  const widgetId = typeof focus.widgetId === 'string'
    ? focus.widgetId
    : typeof focus.widget_id === 'string'
      ? focus.widget_id
      : null
  const source = typeof focus.source === 'string' && focus.source.length > 0 ? focus.source : 'workspace'
  if (!widgetRef) return null
  return { widgetRef, widgetId, source }
}

function normalizeUniqueStringArray(values) {
  return Array.isArray(values)
    ? values.filter((value, index) => typeof value === 'string' && value.length > 0 && values.indexOf(value) === index)
    : []
}

function normalizeUniqueScalarArray(values) {
  return Array.isArray(values)
    ? cloneValue(values.filter((value, index) => value != null && values.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(value)) === index))
    : []
}

function normalizeHighlightEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
  const widgetRef = typeof entry.widgetRef === 'string'
    ? entry.widgetRef
    : typeof entry.widget_ref === 'string'
      ? entry.widget_ref
      : null
  const widgetId = typeof entry.widgetId === 'string'
    ? entry.widgetId
    : typeof entry.widget_id === 'string'
      ? entry.widget_id
      : null
  return {
    widgetRef,
    widgetId,
    highlightedKeys: normalizeUniqueScalarArray(entry.highlightedKeys || entry.highlighted_keys),
    inboundLinkIds: normalizeUniqueStringArray(entry.inboundLinkIds || entry.inbound_link_ids),
    highlightLinkIds: normalizeUniqueStringArray(entry.highlightLinkIds || entry.highlight_link_ids),
    linkedSourceRefs: normalizeUniqueStringArray(entry.linkedSourceRefs || entry.linked_source_refs),
  }
}

function normalizeHighlightState(highlight) {
  if (!highlight || typeof highlight !== 'object' || Array.isArray(highlight)) return null
  const entries = Array.isArray(highlight.entries)
    ? highlight.entries.map((entry) => normalizeHighlightEntry(entry)).filter(Boolean)
    : []
  const explicitActiveWidgetRefs = normalizeUniqueStringArray(highlight.activeWidgetRefs || highlight.active_widget_refs)
  return {
    entries,
    activeWidgetRefs: explicitActiveWidgetRefs.length > 0
      ? explicitActiveWidgetRefs
      : entries.map((entry) => entry.widgetRef).filter(Boolean),
  }
}

function deriveCurrentSelectionFromRegistry(registry, primarySelectionRef) {
  const normalizedRegistry = normalizeSelectionRegistry(registry)
  if (primarySelectionRef && normalizedRegistry[primarySelectionRef]) {
    return cloneValue(normalizedRegistry[primarySelectionRef])
  }
  const firstSelection = Object.values(normalizedRegistry).find(Boolean) || null
  return cloneValue(firstSelection)
}

function defaultReadSelectionRegistry(state) {
  return firstNonNull(
    state?.shared?.selections?.registry,
    state?.selectionRegistry,
    state?.currentSelections,
    {},
  )
}

function defaultReadPrimarySelectionRef(state) {
  return firstNonNull(
    state?.shared?.selections?.views?.primary?.ref,
    state?.shared?.selections?.views?.primary?.selectionRef,
    state?.primarySelectionRef,
    state?.currentSelectionRef,
  )
}

export function createDefaultWidgetVAHostBridge() {
  const defaultSelectionRegistry = emptyObject
  const defaultPrimarySelectionRef = () => null
  return {
    subscribe: () => noop,
    readSessionId: () => null,
    readBaselineSpec: () => null,
    readCurrentSpec: () => null,
    readWorkspaceSpec: () => null,
    readPlanningRequest: () => null,
    readRunMode: () => 'goal_oriented',
    readUserIntent: () => '',
    readSelectionRegistry: defaultSelectionRegistry,
    readPrimarySelectionRef: defaultPrimarySelectionRef,
    readCurrentSelection: () => deriveCurrentSelectionFromRegistry(defaultSelectionRegistry(), defaultPrimarySelectionRef()),
    readCurrentSelections: defaultSelectionRegistry,
    readFocusedWidgetRef: () => null,
    readFocusState: () => null,
    readHighlightState: () => null,
    readSharedFilters: emptyObject,
    readViewportState: emptyObject,
    readSelectionHistory: emptyArray,
    readSelectionsHistory: emptyArray,
    readSelectionFuture: emptyArray,
    readSelectionsFuture: emptyArray,
    writeCurrentSpec: undefined,
    resetCurrentSpec: undefined,
    writeWorkspaceSpec: undefined,
    writePlanningRequest: undefined,
    writeRunMode: undefined,
    writeUserIntent: undefined,
    writeCurrentSelection: undefined,
    writeCurrentSelections: undefined,
    resetSelectionHistory: undefined,
    setFocusedWidgetRef: undefined,
    undoSelection: undefined,
    redoSelection: undefined,
  }
}

export function createOfficialPageHostBridge({
  sessionId,
  baselineSpec,
  currentSpecRef,
  workspaceSpec = null,
  userIntent = null,
  emitOnWrite = false,
  actions = null,
} = {}) {
  const listeners = new Set()
  let currentSelectionRegistry = {}
  let currentPrimarySelectionRef = null
  let currentFocusedWidgetRef = null
  let currentFocusState = null
  const emit = (event = {}) => {
    if (!emitOnWrite) return
    for (const listener of listeners) {
      try {
        listener(event)
      } catch {}
    }
  }
  const cloneRegistry = () => normalizeSelectionRegistry(currentSelectionRegistry)
  const makeSelectionRef = (selection) => {
    const sourceWidgetId = typeof selection?.source_widget_id === 'string' && selection.source_widget_id.length > 0
      ? selection.source_widget_id
      : typeof selection?.sourceWidgetId === 'string' && selection.sourceWidgetId.length > 0
        ? selection.sourceWidgetId
        : null
    const selectionId = typeof selection?.selection_id === 'string' && selection.selection_id.length > 0
      ? selection.selection_id
      : typeof selection?.selectionId === 'string' && selection.selectionId.length > 0
        ? selection.selectionId
        : null
    if (!sourceWidgetId || !selectionId) return null
    return `${sourceWidgetId}::${selectionId}`
  }
  const setSelectionRegistry = (nextRegistry = {}, explicitPrimarySelectionRef = null, event = null) => {
    currentSelectionRegistry = normalizeSelectionRegistry(nextRegistry)
    currentPrimarySelectionRef = normalizePrimarySelectionRef(explicitPrimarySelectionRef)
      || Object.keys(currentSelectionRegistry)[0]
      || null
    if (event !== false) emit(event || {})
  }
  const setFocusState = (focus = null, explicitFocusedWidgetRef = null) => {
    currentFocusState = normalizeFocusState(focus)
    currentFocusedWidgetRef =
      normalizeString(explicitFocusedWidgetRef)
      || currentFocusState?.widgetRef
      || null
  }

  return {
    subscribe(listener) {
      if (!emitOnWrite || typeof listener !== 'function') {
        return noop
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    readSessionId: () => sessionId,
    readBaselineSpec: () => cloneValue(baselineSpec),
    readCurrentSpec: () => cloneValue(currentSpecRef?.current),
    writeCurrentSpec(nextSpec) {
      if (currentSpecRef && typeof currentSpecRef === 'object') {
        currentSpecRef.current = cloneValue(nextSpec)
      }
      emit()
    },
    readWorkspaceSpec: () => cloneValue(workspaceSpec),
    readPlanningRequest: () => null,
    readRunMode: () => 'goal_oriented',
    readUserIntent: () => userIntent,
    readSelectionRegistry: () => cloneRegistry(),
    readPrimarySelectionRef: () => currentPrimarySelectionRef,
    readCurrentSelection: () => deriveCurrentSelectionFromRegistry(cloneRegistry(), currentPrimarySelectionRef),
    readCurrentSelections: () => cloneRegistry(),
    readFocusedWidgetRef: () => currentFocusedWidgetRef,
    readFocusState: () => cloneValue(currentFocusState),
    readComparisonTargets: () => [],
    writeCurrentSelection(selection, nextOptions = {}) {
      const event = {
        visual: nextOptions?.emit !== false,
        reason: nextOptions?.reason || 'selection-write',
      }
      if (!selection || typeof selection !== 'object' || Array.isArray(selection)) {
        setFocusState(nextOptions?.focusState || null, nextOptions?.focusedWidgetRef || null)
        setSelectionRegistry({}, null, event)
        return
      }
      const selectionRef = makeSelectionRef(selection)
      if (!selectionRef) return
      setFocusState(nextOptions?.focusState || null, nextOptions?.focusedWidgetRef || null)
      setSelectionRegistry({
        ...cloneRegistry(),
        [selectionRef]: cloneValue(selection),
      }, nextOptions?.primarySelectionRef || selectionRef, event)
    },
    writeCurrentSelections(selections, nextOptions = {}) {
      const event = {
        visual: nextOptions?.emit !== false,
        reason: nextOptions?.reason || 'selection-write',
      }
      const rawSelections = selections && typeof selections === 'object' && !Array.isArray(selections)
        ? selections
        : {}
      const nextRegistry = {}
      for (const selection of Object.values(rawSelections)) {
        if (!selection || typeof selection !== 'object' || Array.isArray(selection)) continue
        const selectionRef = makeSelectionRef(selection)
        if (!selectionRef) continue
        nextRegistry[selectionRef] = cloneValue(selection)
      }
      setFocusState(nextOptions?.focusState || null, nextOptions?.focusedWidgetRef || null)
      setSelectionRegistry(nextRegistry, nextOptions?.primarySelectionRef || null, event)
    },
    setFocusedWidgetRef(widgetRef) {
      setFocusState(
        widgetRef
          ? {
            widgetRef,
            widgetId: currentFocusState?.widgetId || null,
            source: currentFocusState?.source || 'workspace',
          }
          : null,
        widgetRef,
      )
      emit()
    },
  }
}

export function createWidgetVAHostBridge(options = {}) {
  const {
    getState,
    getAppState,
    subscribe,
    subscribeAppState,
    selectors = {},
    actions = {},
    ...bridgeMethods
  } = options

  const defaultBridge = createDefaultWidgetVAHostBridge()
  const hasDirectBridgeMethods = Object.keys(bridgeMethods).some((key) => typeof bridgeMethods[key] === 'function')
  if (hasDirectBridgeMethods) {
    return {
      ...defaultBridge,
      subscribe: typeof subscribe === 'function' ? subscribe : defaultBridge.subscribe,
      ...bridgeMethods,
    }
  }

  const readState = typeof getState === 'function'
    ? getState
    : typeof getAppState === 'function'
      ? getAppState
      : () => ({})
  const subscribeToState = typeof subscribe === 'function'
    ? subscribe
    : typeof subscribeAppState === 'function'
      ? subscribeAppState
      : () => noop
  const initialState = readState() || {}
  const readSelectionRegistry = () => normalizeSelectionRegistry(
    selectValue(selectors, 'readSelectionRegistry', readState, defaultReadSelectionRegistry) || {},
  )
  const readPrimarySelectionRef = () => normalizePrimarySelectionRef(
    selectValue(selectors, 'readPrimarySelectionRef', readState, defaultReadPrimarySelectionRef),
  )

  return {
    subscribe: subscribeToState,
    readSessionId: () => selectValue(selectors, 'readSessionId', readState, (state) => state?.currentSessionId || null),
    readBaselineSpec: () => selectValue(selectors, 'readBaselineSpec', readState, (state) => state?.baselineSpec || null),
    readCurrentSpec: () => selectValue(selectors, 'readCurrentSpec', readState, (state) => state?.currentSpec || null),
    readWorkspaceSpec: () => selectValue(selectors, 'readWorkspaceSpec', readState, (state) => state?.workspaceSpec || null),
    readPlanningRequest: () => selectValue(selectors, 'readPlanningRequest', readState, (state) => state?.planningRequest || null),
    readRunMode: () => selectValue(selectors, 'readRunMode', readState, (state) => state?.runMode || 'goal_oriented') || 'goal_oriented',
    readUserIntent: () => selectValue(selectors, 'readUserIntent', readState, (state) => state?.userIntent || '') || '',
    readSelectionRegistry,
    readPrimarySelectionRef,
    readCurrentSelection: () => {
      const explicitSelection = selectValue(selectors, 'readCurrentSelection', readState, (state) => state?.currentSelection || null)
      if (explicitSelection) return cloneValue(explicitSelection)
      return deriveCurrentSelectionFromRegistry(readSelectionRegistry(), readPrimarySelectionRef())
    },
    readCurrentSelections: () => {
      const explicitSelections = selectValue(selectors, 'readCurrentSelections', readState, (state) => state?.currentSelections || null)
      if (explicitSelections && typeof explicitSelections === 'object' && !Array.isArray(explicitSelections)) {
        return cloneValue(explicitSelections)
      }
      return readSelectionRegistry()
    },
    readFocusedWidgetRef: () => selectValue(selectors, 'readFocusedWidgetRef', readState, (state) => state?.currentFocusedWidgetRef || null),
    readFocusState: () => normalizeFocusState(
      selectValue(selectors, 'readFocusState', readState, (state) => state?.shared?.focus || state?.currentFocusState || null),
    ),
    readHighlightState: () => normalizeHighlightState(
      selectValue(selectors, 'readHighlightState', readState, (state) => state?.shared?.highlight || state?.currentHighlightState || null),
    ),
    readSharedFilters: () => selectValue(selectors, 'readSharedFilters', readState, (state) => state?.shared?.globalFilters || state?.sharedFilters || state?.currentSharedFilters || {}) || {},
    readViewportState: () => selectValue(selectors, 'readViewportState', readState, (state) => state?.shared?.viewport || state?.viewportState || state?.currentViewportState || {}) || {},
    readSelectionHistory: () => selectValue(selectors, 'readSelectionHistory', readState, (state) => state?.currentSelectionHistory || []) || [],
    readSelectionsHistory: () => selectValue(selectors, 'readSelectionsHistory', readState, (state) => state?.currentSelectionsHistory || []) || [],
    readSelectionFuture: () => selectValue(selectors, 'readSelectionFuture', readState, (state) => state?.currentSelectionFuture || []) || [],
    readSelectionsFuture: () => selectValue(selectors, 'readSelectionsFuture', readState, (state) => state?.currentSelectionsFuture || []) || [],
    writeCurrentSpec: typeof resolveAction(actions, 'writeCurrentSpec', initialState?.setCurrentSpec) === 'function'
      ? (nextSpec, options = {}) => invokeResolvedAction(actions, 'writeCurrentSpec', readState, 'setCurrentSpec', [nextSpec, options])
      : undefined,
    resetCurrentSpec: typeof resolveAction(actions, 'resetCurrentSpec', initialState?.resetCurrentSpec) === 'function'
      ? () => invokeResolvedAction(actions, 'resetCurrentSpec', readState, 'resetCurrentSpec')
      : undefined,
    writeWorkspaceSpec: typeof resolveAction(actions, 'writeWorkspaceSpec', initialState?.setWorkspaceSpec) === 'function'
      ? (workspaceSpec) => invokeResolvedAction(actions, 'writeWorkspaceSpec', readState, 'setWorkspaceSpec', [workspaceSpec])
      : undefined,
    writePlanningRequest: typeof resolveAction(actions, 'writePlanningRequest', initialState?.setPlanningRequest) === 'function'
      ? (planningRequest) => invokeResolvedAction(actions, 'writePlanningRequest', readState, 'setPlanningRequest', [planningRequest])
      : undefined,
    writeRunMode: typeof resolveAction(actions, 'writeRunMode', initialState?.setRunMode) === 'function'
      ? (runMode) => invokeResolvedAction(actions, 'writeRunMode', readState, 'setRunMode', [runMode])
      : undefined,
    writeUserIntent: typeof resolveAction(actions, 'writeUserIntent', initialState?.setUserIntent) === 'function'
      ? (userIntent) => invokeResolvedAction(actions, 'writeUserIntent', readState, 'setUserIntent', [userIntent])
      : undefined,
    writeCurrentSelection: typeof resolveAction(actions, 'writeCurrentSelection', initialState?.setCurrentSelection) === 'function'
      ? (selection, nextOptions = {}) => invokeResolvedAction(actions, 'writeCurrentSelection', readState, 'setCurrentSelection', [selection, nextOptions])
      : undefined,
    writeCurrentSelections: typeof resolveAction(actions, 'writeCurrentSelections', initialState?.setCurrentSelections) === 'function'
      ? (selections, nextOptions = {}) => invokeResolvedAction(actions, 'writeCurrentSelections', readState, 'setCurrentSelections', [selections, nextOptions])
      : undefined,
    resetSelectionHistory: typeof resolveAction(actions, 'resetSelectionHistory', initialState?.resetSelectionHistory) === 'function'
      ? () => invokeResolvedAction(actions, 'resetSelectionHistory', readState, 'resetSelectionHistory')
      : undefined,
    setFocusedWidgetRef: typeof resolveAction(actions, 'setFocusedWidgetRef', initialState?.setCurrentFocusedWidgetRef) === 'function'
      ? (widgetRef) => invokeResolvedAction(actions, 'setFocusedWidgetRef', readState, 'setCurrentFocusedWidgetRef', [widgetRef])
      : undefined,
    undoSelection: typeof resolveAction(actions, 'undoSelection', initialState?.undoCurrentSelection) === 'function'
      ? () => invokeResolvedAction(actions, 'undoSelection', readState, 'undoCurrentSelection')
      : undefined,
    redoSelection: typeof resolveAction(actions, 'redoSelection', initialState?.redoCurrentSelection) === 'function'
      ? () => invokeResolvedAction(actions, 'redoSelection', readState, 'redoCurrentSelection')
      : undefined,
  }
}
