import {
  makeCurrentSelectionDataRef,
  makeCurrentViewDataRef,
  makeSelectionScopedDataRef,
  makeWidgetSelectionDataRef,
  parseRef,
} from '../../../contracts/refs-contracts.js'
import { buildDerivedDataHandle } from '../materializers/workspace/workspaceDescriptorBuilders.js'
import { rowMatchesAnySelection, rowMatchesSelection } from '../materializers/state/selectionHelpers.js'
import { cloneJsonValue as clone } from '../../../shared/clone.js'

export function readRuntimeData(store, ref) {
  return ref ? store.runtimeData?.[ref] || null : store.runtimeData
}

export function resolveSelectionDataRef(store, selectionRef) {
  const parts = parseRef(selectionRef)
  if (!parts?.widgetId || !parts?.selectionId) return null
  return makeSelectionScopedDataRef({
    appId: parts.appId || store.appId,
    workspaceId: parts.workspaceId || store.workspaceId,
    widgetId: parts.widgetId,
    selectionId: parts.selectionId,
  })
}

export function updateRuntimeData(store, ref, updater) {
  if (!ref || typeof updater !== 'function') return null
  const currentEntry = store.runtimeData?.[ref]
  if (!currentEntry) return null
  const nextEntry = updater(clone(currentEntry))
  if (!nextEntry || typeof nextEntry !== 'object') return currentEntry
  store.upsertRuntimeData(ref, nextEntry)
  store.emitChange()
  return nextEntry
}

export function upsertRuntimeData(store, ref, entry) {
  if (!ref || !entry || typeof entry !== 'object') return null
  store.runtimeData = {
    ...(store.runtimeData || {}),
    [ref]: entry,
  }
  const nextHandle = entry.handle || store.dataHandleIndex?.[ref] || null
  if (nextHandle) {
    store.dataHandleIndex = {
      ...(store.dataHandleIndex || {}),
      [ref]: nextHandle,
    }
    store.widgetRegistry.updateDataHandle?.(ref, nextHandle)
  }
  if (Array.isArray(store.description?.dataHandles)) {
    const hasExistingHandle = store.description.dataHandles.some((handle) => handle?.ref === ref)
    store.description = {
      ...store.description,
      dataHandles: hasExistingHandle
        ? store.description.dataHandles.map((handle) => (handle?.ref === ref ? (nextHandle || handle) : handle))
        : nextHandle
          ? [...store.description.dataHandles, nextHandle]
          : store.description.dataHandles,
    }
  }
  return entry
}

export function removeRuntimeData(store, ref) {
  if (!ref || !store.runtimeData?.[ref]) return
  const nextRuntimeData = { ...(store.runtimeData || {}) }
  delete nextRuntimeData[ref]
  store.runtimeData = nextRuntimeData

  if (store.dataHandleIndex?.[ref]) {
    const nextDataHandleIndex = { ...(store.dataHandleIndex || {}) }
    delete nextDataHandleIndex[ref]
    store.dataHandleIndex = nextDataHandleIndex
    store.widgetRegistry.removeDataHandle?.(ref)
  }

  if (Array.isArray(store.description?.dataHandles)) {
    store.description = {
      ...store.description,
      dataHandles: store.description.dataHandles.filter((handle) => handle?.ref !== ref),
    }
  }
}

export function syncCurrentSelectionRuntimeData(store) {
  const currentSelectionDataRef = makeCurrentSelectionDataRef({
    appId: store.appId,
    workspaceId: store.workspaceId,
  })
  const focusedWidgetRef =
    store.state?.shared?.focusedWidget
    || Object.keys(store.state?.widgets || {})[0]
    || store.listWidgetDescriptions()[0]?.ref
    || null
  const focusedWidget = focusedWidgetRef ? store.getWidgetState(focusedWidgetRef) : null
  const focusedWidgetId = focusedWidget?.widgetId || null
  const focusedSelectionDataRef = focusedWidgetId
    ? makeWidgetSelectionDataRef({
        appId: store.appId,
        workspaceId: store.workspaceId,
        widgetId: focusedWidgetId,
      })
    : null
  const focusedSelectionEntry = focusedSelectionDataRef ? store.readRuntimeData(focusedSelectionDataRef) : null
  const focusedSelectionRef =
    focusedWidgetRef
      ? Object.keys(store.state?.widgets?.[focusedWidgetRef]?.selections || {})[0] || null
      : null

  if (!focusedSelectionEntry?.widgetRef || !Array.isArray(focusedSelectionEntry?.rows)) {
    store.removeRuntimeData(currentSelectionDataRef)
    return null
  }

  const currentSelectionHandle = buildDerivedDataHandle({
    ref: currentSelectionDataRef,
    title: 'Current Selection Data',
    description: 'Current rows for the focused widget selection.',
    rows: focusedSelectionEntry.rows,
    selectedCount: focusedSelectionEntry.rows.length,
    kind: 'selectionData',
    scope: 'workspaceCurrent',
    widgetRef: focusedSelectionEntry.widgetRef,
    sourceSelectionRef: focusedSelectionRef,
  })
  const nextEntry = {
    ref: currentSelectionDataRef,
    rows: focusedSelectionEntry.rows,
    baseRows: focusedSelectionEntry.baseRows,
    handle: currentSelectionHandle,
    widgetRef: focusedSelectionEntry.widgetRef,
    sourceSelectionRef: focusedSelectionRef,
    kind: 'selectionData',
    scope: 'workspaceCurrent',
  }
  store.upsertRuntimeData(currentSelectionDataRef, nextEntry)
  return nextEntry
}

export function syncCurrentViewRuntimeData(store) {
  const currentViewDataRef = makeCurrentViewDataRef({
    appId: store.appId,
    workspaceId: store.workspaceId,
  })
  const focusedWidgetRef =
    store.state?.shared?.focusedWidget
    || Object.keys(store.state?.widgets || {})[0]
    || store.listWidgetDescriptions()[0]?.ref
    || null
  const focusedWidget = focusedWidgetRef ? store.getWidgetState(focusedWidgetRef) : null
  const focusedDataRef = focusedWidget?.data?.currentDataRef || focusedWidget?.data?.sourceDataRef || null
  const focusedDataEntry = focusedDataRef ? store.readRuntimeData(focusedDataRef) : null

  if (!focusedDataEntry?.widgetRef || !Array.isArray(focusedDataEntry?.rows)) {
    store.removeRuntimeData(currentViewDataRef)
    return null
  }

  const currentViewHandle = buildDerivedDataHandle({
    ref: currentViewDataRef,
    title: 'Current View Data',
    description: 'Current visible rows for the focused widget.',
    rows: focusedDataEntry.rows,
    selectedCount: focusedDataEntry.handle?.stats?.selectedCount || 0,
    kind: 'dataView',
    scope: 'workspaceCurrentView',
    widgetRef: focusedDataEntry.widgetRef,
  })
  const nextEntry = {
    ref: currentViewDataRef,
    rows: focusedDataEntry.rows,
    baseRows: focusedDataEntry.baseRows,
    handle: currentViewHandle,
    widgetRef: focusedDataEntry.widgetRef,
    kind: 'dataView',
    scope: 'workspaceCurrentView',
  }
  store.upsertRuntimeData(currentViewDataRef, nextEntry)
  return nextEntry
}

export function syncSelectionRuntimeData(store, widgetRef) {
  if (!widgetRef) return null
  const widgetState = store.getWidgetState(widgetRef)
  const widgetDescription = store.getWidgetDescription(widgetRef)
  const widgetId = widgetState?.widgetId || widgetDescription?.widgetId || null
  const managedSelectionDataRefs = Object.values(store.runtimeData || {})
    .filter((entry) => entry?.widgetRef === widgetRef && entry?.kind === 'selectionData')
    .map((entry) => entry?.ref)
    .filter((ref) => typeof ref === 'string')
  const currentDataRef = widgetState?.data?.currentDataRef || null
  const currentDataEntry = currentDataRef ? store.readRuntimeData(currentDataRef) : null
  if (!widgetId || !currentDataEntry) {
    for (const managedRef of managedSelectionDataRefs) {
      store.removeRuntimeData(managedRef)
    }
    store.syncCurrentViewRuntimeData()
    store.syncCurrentSelectionRuntimeData()
    store.emitChange()
    return null
  }

  const activeSelectionEntries = Object.entries(widgetState?.selections || {})
    .filter(([selectionRef, selectionState]) => Boolean(selectionRef) && Boolean(selectionState))
  const selectionDataRef = makeWidgetSelectionDataRef({
    appId: store.appId,
    workspaceId: store.workspaceId,
    widgetId,
  })
  if (activeSelectionEntries.length === 0) {
    for (const managedRef of managedSelectionDataRefs) {
      store.removeRuntimeData(managedRef)
    }
    store.syncCurrentViewRuntimeData()
    store.syncCurrentSelectionRuntimeData()
    store.emitChange()
    return null
  }

  const visibleRows = Array.isArray(currentDataEntry?.rows) ? currentDataEntry.rows : []
  const selections = activeSelectionEntries.map(([, selectionState]) => selectionState)
  const selectedRows = visibleRows.filter((row) => rowMatchesAnySelection(row, selections))
  const nextManagedRefs = new Set([selectionDataRef])
  const handle = buildDerivedDataHandle({
    ref: selectionDataRef,
    title: `${widgetDescription?.title || widgetId} Selection Data`,
    description: `Current rows selected on widget ${widgetId}.`,
    rows: selectedRows,
    selectedCount: selectedRows.length,
    kind: 'selectionData',
    scope: 'combined',
    widgetRef,
  })

  const nextEntry = {
    ref: selectionDataRef,
    rows: selectedRows,
    baseRows: visibleRows,
    handle,
    widgetRef,
    kind: 'selectionData',
    scope: 'combined',
  }
  store.upsertRuntimeData(selectionDataRef, nextEntry)

  for (const [selectionRef, selectionState] of activeSelectionEntries) {
    const selectionScopedDataRef = store.resolveSelectionDataRef(selectionRef)
    if (!selectionScopedDataRef) continue
    nextManagedRefs.add(selectionScopedDataRef)
    const selectionId = selectionRef.split('/').pop() || 'selection'
    const selectionRows = visibleRows.filter((row) => rowMatchesSelection(row, selectionState))
    const selectionScopedHandle = buildDerivedDataHandle({
      ref: selectionScopedDataRef,
      title: `${widgetDescription?.title || widgetId} Selection ${selectionId} Data`,
      description: `Current rows for selection ${selectionId} on widget ${widgetId}.`,
      rows: selectionRows,
      selectedCount: selectionRows.length,
      kind: 'selectionData',
      scope: 'selection',
      widgetRef,
      sourceSelectionRef: selectionRef,
    })
    store.upsertRuntimeData(selectionScopedDataRef, {
      ref: selectionScopedDataRef,
      rows: selectionRows,
      baseRows: visibleRows,
      handle: selectionScopedHandle,
      widgetRef,
      sourceSelectionRef: selectionRef,
      kind: 'selectionData',
      scope: 'selection',
    })
  }

  for (const managedRef of managedSelectionDataRefs) {
    if (!nextManagedRefs.has(managedRef)) {
      store.removeRuntimeData(managedRef)
    }
  }
  store.syncCurrentViewRuntimeData()
  store.syncCurrentSelectionRuntimeData()
  store.emitChange()
  return nextEntry
}
