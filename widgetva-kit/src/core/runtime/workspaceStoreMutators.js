import { readWorkspaceStateFromStore } from './workspaceStoreReaders.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function nextStateId(currentStateId = 'main:s0') {
  const prefix = typeof currentStateId === 'string' && currentStateId.includes(':')
    ? currentStateId.split(':')[0]
    : 'main'
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}:${globalThis.crypto.randomUUID()}`
  }
  return `${prefix}:${Date.now()}`
}

export function patchWidgetInStore(store, ref, patch = {}) {
  if (typeof store?.patchWidget === 'function') {
    return store.patchWidget(ref, patch)
  }

  const currentWidget = store?.widgets?.[ref]
  if (!currentWidget) {
    throw new Error(`Unknown widget: ${ref}`)
  }

  const nextWidget = mergeRuntimePatch(clone(currentWidget), patch)
  nextWidget.version = (currentWidget.version || 0) + 1
  nextWidget.updatedAt = new Date().toISOString()

  store.widgets = {
    ...(store.widgets || {}),
    [ref]: nextWidget,
  }
  store.version = (store.version || 0) + 1
  store.stateId = nextStateId(store.stateId)

  return readWorkspaceStateFromStore(store)
}

export function updateRuntimeDataInStore(store, ref, updater) {
  if (typeof store?.updateRuntimeData === 'function') {
    return store.updateRuntimeData(ref, updater)
  }
  if (!ref || typeof updater !== 'function') return null

  const currentEntry = store?.runtimeData?.[ref]
  if (!currentEntry) return null

  const nextEntry = updater(clone(currentEntry))
  if (!nextEntry || typeof nextEntry !== 'object') return currentEntry

  store.runtimeData = {
    ...(store.runtimeData || {}),
    [ref]: nextEntry,
  }

  if (nextEntry.handle) {
    store.dataHandles = {
      ...(store.dataHandles || {}),
      [ref]: nextEntry.handle,
    }
  }

  return nextEntry
}

export function beginBranchFromStateInStore(store, { stateId, label } = {}) {
  if (typeof store?.beginBranchFromState === 'function') {
    return store.beginBranchFromState({ stateId, label })
  }
  if (!stateId) {
    throw new Error('beginBranchFromState requires a stateId.')
  }

  const snapshotEntry =
    (typeof store?.readSnapshotEntry === 'function' ? store.readSnapshotEntry(stateId) : null)
    || (Array.isArray(store?.stateSnapshots) ? store.stateSnapshots.find((entry) => entry?.stateId === stateId) || null : null)

  if (!snapshotEntry) {
    throw new Error(`Unknown branch origin state: ${stateId}`)
  }

  const branchId = `branch_${Date.now()}`
  const branchLabel = label || `Branch from ${stateId}`
  const parentBranchId = snapshotEntry?.branchId || store?.currentBranchId || 'main'

  store.branchRegistry = {
    ...(store.branchRegistry || {}),
    [branchId]: {
      branchId,
      label: branchLabel,
      originStateId: stateId,
      parentBranchId,
      createdAt: new Date().toISOString(),
    },
  }
  store.currentBranchId = branchId

  return store.branchRegistry[branchId]
}

export function appendTraceRecordToStore(store, record) {
  if (typeof store?.appendTrace === 'function') {
    return store.appendTrace(record)
  }
  if (!store || !record || typeof record !== 'object') {
    return null
  }

  const fullTrace = Array.isArray(store.interactionTrace) ? [...store.interactionTrace] : []
  const nextTrace = [...fullTrace, clone(record)]
  const retention = Number.isFinite(store.maxTraceRetention) ? store.maxTraceRetention : null
  store.interactionTrace = retention && retention > 0
    ? nextTrace.slice(-retention)
    : nextTrace

  if (typeof store.emitChange === 'function') {
    store.emitChange()
  }

  return record
}

function mergeRuntimePatch(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return base
  const output = Array.isArray(base) ? [...base] : { ...(base || {}) }
  for (const [key, value] of Object.entries(patch)) {
    if (Array.isArray(value)) {
      output[key] = clone(value)
      continue
    }
    if (value && typeof value === 'object') {
      output[key] = mergeRuntimePatch(output[key], value)
      continue
    }
    output[key] = value
  }
  return output
}

export {
  hasRedoSelectionHistoryInStore,
  hasUndoSelectionHistoryInStore,
  recordSelectionHistorySnapshot,
  resetWorkspaceInteractionsInStore,
  restoreSnapshotStateInStore,
  redoSelectionInStore,
  undoSelectionInStore,
  updateSharedStateInStore,
} from '../../workspace/state/workspaceSharedStateMutators.js'
