import { cloneJsonValue as clone } from '../../../shared/clone.js'
import { makeWidgetState, makeWorkspaceState } from '../../../contracts/state-contracts.js'

export function makeDescriptorKey(name, targetRef) {
  return `${name || 'unknown'}::${targetRef || 'workspace'}`
}

export function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

export function mergeRuntimePatch(base, patch) {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return clone(patch)
  }
  const nextValue = { ...clone(base) }
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(nextValue[key])) {
      nextValue[key] = mergeRuntimePatch(nextValue[key], value)
    } else {
      nextValue[key] = clone(value)
    }
  }
  return nextValue
}

export function applyWidgetStatePatches(state, patches = {}) {
  if (!state?.widgets || !isPlainObject(patches) || Object.keys(patches).length === 0) {
    return state
  }

  const nextWidgets = { ...(state.widgets || {}) }
  let changed = false
  for (const [ref, patch] of Object.entries(patches)) {
    if (!nextWidgets[ref] || !isPlainObject(patch)) continue
    nextWidgets[ref] = mergeRuntimePatch(nextWidgets[ref], patch)
    changed = true
  }

  return changed
    ? {
        ...state,
        widgets: nextWidgets,
      }
    : state
}

function normalizeWidgetStateMap(widgets = {}) {
  return Object.fromEntries(
    Object.entries(widgets || {}).map(([ref, widgetState]) => [
      ref,
      makeWidgetState({
        ref,
        ...clone(widgetState),
      }),
    ]),
  )
}

export function normalizeWorkspaceState(state) {
  return makeWorkspaceState({
    ...clone(state),
    widgets: normalizeWidgetStateMap(state?.widgets || {}),
  })
}

function getTraceRecordPriority(record) {
  const eventKind = record?.eventKind || null
  if (eventKind === 'action') return 3
  if (eventKind === 'perceptionQuery' || eventKind === 'dataQuery') return 2
  if (eventKind === 'systemTransition') return 1
  return 0
}

export function pickRepresentativeTraceRecord(currentRecord, nextRecord) {
  if (!currentRecord) return nextRecord || null
  if (!nextRecord) return currentRecord
  return getTraceRecordPriority(nextRecord) >= getTraceRecordPriority(currentRecord)
    ? nextRecord
    : currentRecord
}

export function buildResponsePreview(content, maxLength = 160) {
  const text = String(content || '').trim()
  if (!text) return null
  if (!Number.isFinite(maxLength) || maxLength <= 0 || text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, maxLength - 3)}...`
}

export function normalizeActorFilter(actors) {
  if (!Array.isArray(actors) || actors.length === 0) return []
  return Array.from(
    new Set(
      actors.filter((actor) => typeof actor === 'string' && actor.length > 0),
    ),
  )
}

export function createMutableMapFacade({ keys, getEntry, setEntry, deleteEntry }) {
  return new Proxy({}, {
    get(_target, prop) {
      if (typeof prop === 'symbol') return undefined
      return getEntry(prop)
    },
    set(_target, prop, value) {
      if (typeof prop === 'symbol') return true
      setEntry(prop, value)
      return true
    },
    deleteProperty(_target, prop) {
      if (typeof prop === 'symbol') return true
      deleteEntry(prop)
      return true
    },
    ownKeys() {
      return keys()
    },
    has(_target, prop) {
      if (typeof prop === 'symbol') return false
      return keys().includes(prop)
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop === 'symbol') return undefined
      const value = getEntry(prop)
      if (value == null) return undefined
      return {
        configurable: true,
        enumerable: true,
        writable: true,
        value,
      }
    },
  })
}

export function makeRuntimeStoreCurrentStateSummary(summary = {}) {
  return {
    stateId: null,
    focusedWidgetRef: null,
    focusedWidgetKind: null,
    focusedWidgetTitle: null,
    visibleCount: null,
    selectedCount: null,
    selectionCount: 0,
    activeSelectionRefs: [],
    primarySelectionRef: null,
    primarySelectionSummary: '',
    primarySelectionPredicates: [],
    comparisonTargetCount: 0,
    globalFilterCount: 0,
    taskMode: null,
    coordinationScope: null,
    evidenceType: null,
    interactionHorizon: null,
    replayRunMode: null,
    replayUserIntent: '',
    changedRefs: [],
    removedRefs: [],
    sharedChanged: false,
    taskContextChanged: false,
    replayContextChanged: false,
    ...summary,
  }
}

export function makeRuntimeStoreHistoryRetention(retention = {}) {
  return {
    snapshotMax: 0,
    traceMax: 0,
    responseMax: 0,
    ...retention,
  }
}

export function makeRuntimeStoreIdentity(identity = {}) {
  return {
    appId: '',
    workspaceId: '',
    ...identity,
  }
}

export function makeRuntimeStoreStateSummary(summary = {}) {
  return {
    stateId: null,
    currentBranchId: null,
    previousStateId: null,
    version: 0,
    ...summary,
  }
}

export function makeRuntimeStoreIndexes(indexes = {}) {
  return {
    widgetCount: 0,
    dataHandleCount: 0,
    linkCount: 0,
    widgetAdapterCount: 0,
    actionDescriptorCount: 0,
    perceptionDescriptorCount: 0,
    widgetPatchCount: 0,
    ...indexes,
  }
}

export function makeRuntimeStoreHistory(history = {}) {
  return {
    snapshotCount: 0,
    traceCount: 0,
    responseCount: 0,
    branchCount: 0,
    retention: makeRuntimeStoreHistoryRetention(),
    maxSnapshotRetention: 0,
    maxTraceRetention: 0,
    maxResponseRetention: 0,
    ...history,
  }
}

export function makeRuntimeStoreCapabilities(capabilities = {}) {
  return {
    deltaTracking: false,
    snapshotHistory: false,
    actorScopedHistory: false,
    branchReplay: false,
    traceGraph: false,
    runtimeDataIndex: false,
    widgetAdapterIndex: false,
    widgetStatePatching: false,
    ...capabilities,
  }
}

export function makeRuntimeStoreSummary(summary = {}) {
  return {
    currentStateSummary: null,
    ...summary,
    identity: makeRuntimeStoreIdentity(summary?.identity),
    state: makeRuntimeStoreStateSummary(summary?.state),
    currentStateSummary: summary?.currentStateSummary == null
      ? null
      : makeRuntimeStoreCurrentStateSummary(summary.currentStateSummary),
    indexes: makeRuntimeStoreIndexes(summary?.indexes),
    history: makeRuntimeStoreHistory(summary?.history),
    capabilities: makeRuntimeStoreCapabilities(summary?.capabilities),
  }
}
