import { readWorkspaceStateFromStore } from '../store/workspaceStoreReaders.js'
import {
  withSelectionSubmodel,
} from './selectionStateModel.js'
import { withFocusSubmodel } from './focusStateModel.js'
import { withHighlightSubmodel } from './highlightStateModel.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function ensureSelectionTimeline(store) {
  if (!store.__selectionTimeline || typeof store.__selectionTimeline !== 'object') {
    store.__selectionTimeline = {
      past: [],
      future: [],
    }
  }
  return store.__selectionTimeline
}

function selectionSnapshot(store) {
  const state = readWorkspaceStateFromStore(store)
  return {
    widgets: clone(state?.widgets || {}),
    shared: clone(state?.shared || {}),
  }
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

function commitStateUpdate(store, { widgets, shared, transitionType = 'continue' } = {}) {
  const currentState = readWorkspaceStateFromStore(store)
  const nextState = {
    ...clone(currentState || {}),
    stateId: nextStateId(currentState?.stateId),
    createdAt: new Date().toISOString(),
    widgets: clone(widgets || currentState?.widgets || {}),
    shared: clone(shared || currentState?.shared || {}),
  }
  return store.commitState(nextState, { transitionType })
}

export function updateSharedStateInStore(store, updater) {
  if (!store || typeof updater !== 'function') return readWorkspaceStateFromStore(store)

  const currentState = readWorkspaceStateFromStore(store)
  const currentShared = clone(currentState?.shared || {})
  const nextShared = updater(currentShared)

  if (!nextShared || typeof nextShared !== 'object') {
    return currentState
  }

  if (typeof store?.commitState === 'function') {
    return commitStateUpdate(store, {
      widgets: currentState?.widgets || {},
      shared: nextShared,
    })
  }

  if (store.state?.shared && typeof store.state === 'object') {
    store.state.shared = nextShared
  }
  store.shared = nextShared
  store.version = (store.version || 0) + 1
  store.stateId = nextStateId(store.stateId)

  return readWorkspaceStateFromStore(store)
}

export function resetWorkspaceInteractionsInStore(store) {
  const currentState = readWorkspaceStateFromStore(store)
  const nextWidgets = {}

  for (const [ref, widgetState] of Object.entries(currentState?.widgets || {})) {
    nextWidgets[ref] = {
      ...clone(widgetState),
      version: (widgetState?.version || 0) + 1,
      updatedAt: new Date().toISOString(),
      selections: {},
      data: {
        ...(widgetState?.data || {}),
        selectedCount: 0,
      },
    }
  }

  store.widgets = nextWidgets
  if (store.state?.widgets && typeof store.state === 'object') {
    store.state.widgets = nextWidgets
  }

  const nextShared = withHighlightSubmodel(withFocusSubmodel({
    ...withSelectionSubmodel(currentState?.shared || {}, {
      registry: {},
      primary: null,
      byWidget: {},
    }),
  }, null), null)

  if (typeof store?.commitState === 'function') {
    return commitStateUpdate(store, {
      widgets: nextWidgets,
      shared: nextShared,
      transitionType: 'reset',
    })
  }

  if (store.state?.shared && typeof store.state === 'object') {
    store.state.shared = nextShared
  }
  store.shared = nextShared
  store.version = (store.version || 0) + 1
  store.stateId = nextStateId(store.stateId)

  return readWorkspaceStateFromStore(store)
}

export function restoreSnapshotStateInStore(store, snapshot) {
  const snapshotState = snapshot?.state || snapshot || {}
  const nextWidgets = clone(snapshotState?.widgets || {})
  const nextSharedBase = withSelectionSubmodel({
    globalFilters: {},
    focusedWidget: null,
    ...(clone(snapshotState?.shared) || {}),
  }, {
      registry: undefined,
      primary: undefined,
      byWidget: undefined,
    })
  const nextShared = withHighlightSubmodel(withFocusSubmodel(nextSharedBase, undefined, nextWidgets), undefined)

  if (typeof store?.commitState === 'function') {
    return commitStateUpdate(store, {
      widgets: nextWidgets,
      shared: nextShared,
      transitionType: 'continue',
    })
  }

  if (store.state?.widgets && typeof store.state === 'object') {
    store.state.widgets = nextWidgets
  }
  if (store.state?.shared && typeof store.state === 'object') {
    store.state.shared = nextShared
  }

  store.widgets = nextWidgets
  store.shared = nextShared
  store.version = (store.version || 0) + 1
  store.stateId = nextStateId(store.stateId)

  return readWorkspaceStateFromStore(store)
}

export function recordSelectionHistorySnapshot(store) {
  if (!store) return
  const timeline = ensureSelectionTimeline(store)
  timeline.past = [...(timeline.past || []), selectionSnapshot(store)].slice(-50)
  timeline.future = []
}

export function hasUndoSelectionHistoryInStore(store) {
  return Array.isArray(store?.__selectionTimeline?.past) && store.__selectionTimeline.past.length > 0
}

export function hasRedoSelectionHistoryInStore(store) {
  return Array.isArray(store?.__selectionTimeline?.future) && store.__selectionTimeline.future.length > 0
}

export function undoSelectionInStore(store) {
  const timeline = ensureSelectionTimeline(store)
  if (!timeline.past.length) {
    return readWorkspaceStateFromStore(store)
  }
  const previous = timeline.past.pop()
  timeline.future = [...(timeline.future || []), selectionSnapshot(store)].slice(-50)
  return restoreSnapshotStateInStore(store, previous)
}

export function redoSelectionInStore(store) {
  const timeline = ensureSelectionTimeline(store)
  if (!timeline.future.length) {
    return readWorkspaceStateFromStore(store)
  }
  const next = timeline.future.pop()
  timeline.past = [...(timeline.past || []), selectionSnapshot(store)].slice(-50)
  return restoreSnapshotStateInStore(store, next)
}
