import { cloneJsonValue as clone } from '../../shared/clone.js'
import {
  normalizePrimarySelectionView,
  readSelectionRegistry,
  withSelectionSubmodel,
} from '../state/selectionStateModel.js'
import { withHighlightSubmodel } from '../state/highlightStateModel.js'
import {
  deriveGlobalFiltersFromSelection,
  deriveHighlightStateFromSelection,
} from '../state/sharedStateDerivation.js'

function cloneObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? clone(value)
    : {}
}

export function syncGlobalFiltersFromControlState(workspace, controlState = {}, { rangeDomains = {} } = {}) {
  const globalFilters = workspace.buildGlobalFiltersFromControlState(controlState, { rangeDomains })
  workspace.setGlobalFilters(globalFilters)
  return globalFilters
}

export function setHighlightState(workspace, highlight = null) {
  return workspace.updateSharedCoordinationState((shared) => withHighlightSubmodel(shared, highlight))
}

export function clearHighlightState(workspace) {
  const previousHighlightState = workspace.readHighlightState()
  const hadHighlight = Array.isArray(previousHighlightState?.entries) && previousHighlightState.entries.length > 0
  if (!hadHighlight) {
    return {
      changed: false,
      previousHighlightState,
      nextHighlightState: previousHighlightState,
    }
  }
  setHighlightState(workspace, null)
  return {
    changed: true,
    previousHighlightState,
    nextHighlightState: workspace.readHighlightState(),
  }
}

export function commitClearHighlightState(workspace, options = {}) {
  const transition = clearHighlightState(workspace)
  return workspace.commitCoordinationOperationResult({
    ...options,
    changed: transition?.changed === true,
  })
}

export function setSelectionPrimary(workspace, selection = null) {
  const currentState = workspace.readState() || {}
  const currentShared = currentState?.shared || {}
  const normalizedSelection = selection == null
    ? null
    : normalizePrimarySelectionView(selection, readSelectionRegistry(currentShared))
  return workspace.updateSharedCoordinationState((shared) => withSelectionSubmodel(shared, {
    primary: normalizedSelection,
  }))
}

export function setSelectionViewsByWidget(workspace, selectionViewsByWidget = {}) {
  return workspace.updateSharedCoordinationState((shared) => withSelectionSubmodel(shared, {
    byWidget: cloneObject(selectionViewsByWidget),
  }))
}

export function setSelectionRegistry(workspace, selectionRegistry = {}) {
  return workspace.updateSharedCoordinationState((shared) => withSelectionSubmodel(shared, {
    registry: cloneObject(selectionRegistry),
  }))
}

export function upsertSelectionEntry(workspace, selectionEntry, options = {}) {
  if (!selectionEntry || typeof selectionEntry !== 'object') {
    throw new Error('WidgetWorkspace.upsertSelectionEntry requires a selection entry object.')
  }

  const selectionRef = typeof selectionEntry.selectionRef === 'string' && selectionEntry.selectionRef.length > 0
    ? selectionEntry.selectionRef
    : null
  if (!selectionRef) {
    throw new Error('WidgetWorkspace.upsertSelectionEntry requires selectionEntry.selectionRef.')
  }

  const sourceWidget = workspace.getWidget(selectionEntry.sourceWidgetId || selectionEntry.sourceWidgetRef || null)
  const sourceWidgetId = selectionEntry.sourceWidgetId
    || sourceWidget?.resolveWidgetId?.()
    || sourceWidget?.describe?.()?.widgetId
    || null
  const sourceWidgetRef = selectionEntry.sourceWidgetRef
    || sourceWidget?.resolveWidgetRef?.()
    || sourceWidget?.describe?.()?.ref
    || null

  if (!sourceWidgetId) {
    throw new Error('WidgetWorkspace.upsertSelectionEntry requires a sourceWidgetId or resolvable source widget.')
  }

  const makePrimary = options?.makePrimary !== false
  const updateByWidget = options?.updateByWidget !== false
  const focusSourceWidget = options?.focusSourceWidget !== false

  const currentSelectionState = workspace.readSelectionState() || { registry: {}, views: { primary: null, byWidget: {} } }
  const previousFocusedWidgetRef = workspace.readCoordinationState()?.focusedWidgetRef || null
  const nextRegistry = {
    ...(currentSelectionState?.registry || {}),
    [selectionRef]: clone({
      ...selectionEntry,
      selectionRef,
      sourceWidgetId,
      sourceWidgetRef,
    }),
  }
  const nextByWidget = updateByWidget
    ? {
        ...(currentSelectionState?.views?.byWidget || {}),
        [sourceWidgetId]: { selectionRef },
      }
    : (currentSelectionState?.views?.byWidget || {})
  const nextPrimary = makePrimary
    ? normalizePrimarySelectionView({ selectionRef }, nextRegistry)
    : currentSelectionState?.views?.primary || null

  workspace.updateSharedCoordinationState((shared) => {
    const nextShared = withSelectionSubmodel(shared, {
      registry: nextRegistry,
      byWidget: cloneObject(nextByWidget),
      primary: nextPrimary,
    })
    if (focusSourceWidget) {
      nextShared.focusedWidget = sourceWidgetRef || nextShared.focusedWidget || null
    }
    return nextShared
  })

  const nextSelectionState = workspace.readSelectionState() || { registry: {}, views: { primary: null, byWidget: {} } }
  const nextFocusedWidgetRef = workspace.readCoordinationState()?.focusedWidgetRef || null
  return {
    changed:
      JSON.stringify(nextSelectionState) !== JSON.stringify(currentSelectionState)
      || nextFocusedWidgetRef !== previousFocusedWidgetRef,
    previousSelectionState: currentSelectionState,
    nextSelectionState,
    previousFocusedWidgetRef,
    nextFocusedWidgetRef,
    selectionRef,
    sourceWidgetId,
    sourceWidgetRef,
  }
}

export function syncPrimarySelectionEntry(workspace, selectionEntry = null, options = {}) {
  if (selectionEntry == null) {
    const transition = clearSelectionState(workspace)
    return workspace.commitCoordinationOperationResult({
      ...options,
      changed: transition?.changed === true,
    })
  }

  const transition = upsertSelectionEntry(workspace, selectionEntry, {
    makePrimary: options?.makePrimary !== false,
    updateByWidget: options?.updateByWidget !== false,
    focusSourceWidget: options?.focusSourceWidget !== false,
  })
  return workspace.commitCoordinationOperationResult({
    ...options,
    changed: transition?.changed === true,
  })
}

export function clearSelectionState(workspace) {
  const previousSelectionState = workspace.readSelectionState() || { registry: {}, views: { primary: null, byWidget: {} } }
  const hadSelection = Object.keys(previousSelectionState?.registry || {}).length > 0
    || previousSelectionState?.views?.primary != null
    || Object.keys(previousSelectionState?.views?.byWidget || {}).length > 0
  if (!hadSelection) {
    return {
      changed: false,
      previousSelectionState,
      nextSelectionState: previousSelectionState,
    }
  }
  workspace.updateSharedCoordinationState((shared) => withSelectionSubmodel(shared, {
    primary: null,
    byWidget: {},
    registry: {},
  }))
  return {
    changed: true,
    previousSelectionState,
    nextSelectionState: workspace.readSelectionState() || { registry: {}, views: { primary: null, byWidget: {} } },
  }
}

export function promotePrimarySelectionToGlobalFilters(workspace, options = {}) {
  const primarySelection = workspace.readSelectionState()?.views?.primary || null
  if (!primarySelection?.selectionRef) {
    return {
      changed: false,
      globalFilterPatch: null,
      nextGlobalFilters: workspace.readGlobalFilters(),
    }
  }

  const globalFilterPatch = workspace.controlStateAdapter?.deriveGlobalFiltersFromSelection
    ? workspace.controlStateAdapter.deriveGlobalFiltersFromSelection(primarySelection, {
        rangeDomains: options?.rangeDomains || {},
      })
    : deriveGlobalFiltersFromSelection(primarySelection, { rangeDomains: options?.rangeDomains || {} })
  if (!globalFilterPatch) {
    return {
      changed: false,
      globalFilterPatch: null,
      nextGlobalFilters: workspace.readGlobalFilters(),
    }
  }

  const baseGlobalFilters = options?.baseGlobalFilters && typeof options.baseGlobalFilters === 'object' && !Array.isArray(options.baseGlobalFilters)
    ? clone(options.baseGlobalFilters)
    : clone(workspace.readGlobalFilters() || {})
  const nextGlobalFilters = {
    ...baseGlobalFilters,
    ...globalFilterPatch,
  }
  const clearSelection = options?.clearSelection !== false
  const focusSourceWidget = options?.focusSourceWidget !== false
  const focusedWidgetRef = focusSourceWidget
    ? workspace.resolveWorkspaceWidgetRef(primarySelection.sourceWidgetId || primarySelection.sourceWidgetRef, { allowNull: true })
    : null

  workspace.updateSharedCoordinationState((shared) => {
    const nextShared = {
      ...(shared || {}),
      globalFilters: clone(nextGlobalFilters),
    }
    if (clearSelection) {
      return withSelectionSubmodel({
        ...nextShared,
        focusedWidget: focusedWidgetRef || nextShared.focusedWidget || null,
      }, {
        primary: null,
        byWidget: {},
        registry: {},
      })
    }
    if (focusSourceWidget) {
      nextShared.focusedWidget = focusedWidgetRef || nextShared.focusedWidget || null
    }
    return nextShared
  })

  return {
    changed: true,
    selectionRef: primarySelection.selectionRef,
    globalFilterPatch,
    nextGlobalFilters,
  }
}

export function commitPrimarySelectionToGlobalFilters(workspace, options = {}) {
  const promotionResult = promotePrimarySelectionToGlobalFilters(workspace, options)
  if (!promotionResult?.changed) {
    return {
      ...workspace.commitCoordinationOperationResult({
        ...options,
        changed: false,
      }),
      changed: false,
      selectionRef: promotionResult?.selectionRef || null,
      globalFilterPatch: promotionResult?.globalFilterPatch || null,
      nextGlobalFilters: promotionResult?.nextGlobalFilters || workspace.readGlobalFilters(),
    }
  }

  return {
    ...workspace.commitCoordinationOperationResult({
      ...options,
      changed: true,
    }),
    changed: true,
    selectionRef: promotionResult.selectionRef || null,
    globalFilterPatch: promotionResult.globalFilterPatch || null,
    nextGlobalFilters: promotionResult.nextGlobalFilters || workspace.readGlobalFilters(),
  }
}

export function promotePrimarySelectionToHighlight(workspace, options = {}) {
  const primarySelection = workspace.readSelectionState()?.views?.primary || null
  if (!primarySelection?.selectionRef) {
    return {
      changed: false,
      highlightState: workspace.readHighlightState(),
    }
  }

  const highlightState = deriveHighlightStateFromSelection(primarySelection, workspace.listWidgets())
  const clearSelection = options?.clearSelection !== false
  const focusSourceWidget = options?.focusSourceWidget !== false
  const focusedWidgetRef = focusSourceWidget
    ? workspace.resolveWorkspaceWidgetRef(primarySelection.sourceWidgetId || primarySelection.sourceWidgetRef, { allowNull: true })
    : null

  workspace.updateSharedCoordinationState((shared) => {
    const nextShared = withHighlightSubmodel(shared, highlightState)
    if (clearSelection) {
      return withSelectionSubmodel({
        ...nextShared,
        focusedWidget: focusedWidgetRef || nextShared.focusedWidget || null,
      }, {
        primary: null,
        byWidget: {},
        registry: {},
      })
    }
    if (focusSourceWidget) {
      nextShared.focusedWidget = focusedWidgetRef || nextShared.focusedWidget || null
    }
    return nextShared
  })

  return {
    changed: true,
    selectionRef: primarySelection.selectionRef,
    highlightState: workspace.readHighlightState(),
  }
}

export function commitPrimarySelectionToHighlight(workspace, options = {}) {
  const promotionResult = promotePrimarySelectionToHighlight(workspace, options)
  if (!promotionResult?.changed) {
    return {
      ...workspace.commitCoordinationOperationResult({
        ...options,
        changed: false,
      }),
      changed: false,
      selectionRef: promotionResult?.selectionRef || null,
      highlightState: promotionResult?.highlightState || workspace.readHighlightState(),
    }
  }

  return {
    ...workspace.commitCoordinationOperationResult({
      ...options,
      changed: true,
    }),
    changed: true,
    selectionRef: promotionResult.selectionRef || null,
    highlightState: promotionResult.highlightState || workspace.readHighlightState(),
  }
}

export function setFocusedWidget(workspace, refOrId) {
  const widgetRef = workspace.resolveWorkspaceWidgetRef(refOrId, { allowNull: true })
  return workspace.updateSharedCoordinationState((shared) => ({
    ...shared,
    focusedWidget: widgetRef,
  }))
}

export function setGlobalFilters(workspace, globalFilters = {}) {
  const nextGlobalFilters = globalFilters && typeof globalFilters === 'object' && !Array.isArray(globalFilters)
    ? clone(globalFilters)
    : {}
  return workspace.updateSharedCoordinationState((shared) => ({
    ...shared,
    globalFilters: nextGlobalFilters,
  }))
}

export function clearGlobalFilters(workspace) {
  return setGlobalFilters(workspace, {})
}
