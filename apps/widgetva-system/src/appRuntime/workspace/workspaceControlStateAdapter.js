export function buildFirstPartyControlState(state = {}) {
  return state.controlState && typeof state.controlState === 'object'
    ? { ...state.controlState }
    : {}
}

export function buildFirstPartyRangeDomains(state = {}) {
  return state.controlRangeDomains && typeof state.controlRangeDomains === 'object'
    ? { ...state.controlRangeDomains }
    : {}
}

export function deriveFirstPartyCoordinationControlState({
  focusedWidgetId = null,
} = {}) {
  return {
    filters: {},
    focus: {},
    focusedWidgetId: focusedWidgetId || null,
  }
}

export function deriveFirstPartyControlProjection(controlState = {}, {
  fallbackSelectedWidgetId = null,
} = {}) {
  return {
    controlState: controlState?.filters || {},
    selectedWidgetId: controlState?.focusedWidgetId || fallbackSelectedWidgetId || null,
  }
}

export function deriveFirstPartyControlFilterPatch() {
  return {}
}

export function deriveFirstPartyGlobalFiltersFromControlState(controlState = {}) {
  return controlState && typeof controlState === 'object' ? { ...controlState } : {}
}

export function deriveFirstPartyGlobalFiltersFromSelection(primarySelection = null) {
  const predicates = Array.isArray(primarySelection?.predicates) ? primarySelection.predicates : []
  return predicates.length > 0 ? { predicates } : null
}

export function buildFirstPartyWorkspaceControlStateAdapter() {
  return {
    deriveCoordinationControlState: deriveFirstPartyCoordinationControlState,
    deriveControlProjection: deriveFirstPartyControlProjection,
    deriveGlobalFiltersFromControlState: deriveFirstPartyGlobalFiltersFromControlState,
    deriveGlobalFiltersFromSelection: deriveFirstPartyGlobalFiltersFromSelection,
  }
}
