import { cloneJsonValue as clone } from '../../shared/clone.js'
function makeStateManagerCapabilities(capabilities = {}) {
  return {
    stateIdGeneration: true,
    deltaCreation: true,
    statePatchCreation: true,
    refScopedReads: true,
    ...capabilities,
  }
}

function makeStateManagerCounters(counters = {}) {
  return {
    generatedStateCount: 0,
    lastGeneratedStateId: null,
    ...counters,
  }
}

function makeStateManagerSummary(summary = {}) {
  return {
    capabilities: makeStateManagerCapabilities(summary?.capabilities),
    reservedRefs: [],
    counters: makeStateManagerCounters(summary?.counters),
    ...summary,
  }
}

function stableSerialize(value) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export const SHARED_STATE_REF = 'shared'
export const TASK_CONTEXT_REF = 'taskContext'
export const REPLAY_CONTEXT_REF = 'replayContext'

function readCurrentStateId(store) {
  if (typeof store?.stateId === 'string' && store.stateId.length > 0) {
    return store.stateId
  }
  if (typeof store?.state?.stateId === 'string' && store.state.stateId.length > 0) {
    return store.state.stateId
  }
  if (Array.isArray(store?.stateSnapshots) && store.stateSnapshots.length > 0) {
    const latestSnapshot = store.stateSnapshots[store.stateSnapshots.length - 1]
    if (typeof latestSnapshot?.stateId === 'string' && latestSnapshot.stateId.length > 0) {
      return latestSnapshot.stateId
    }
  }
  return null
}

export function hasStateManagerSurface(store) {
  return typeof store?.stateManager?.describeManager === 'function'
    || typeof store?.stateManager?.createStateMeta === 'function'
    || typeof store?.buildStatePatch === 'function'
    || typeof store?.commitState === 'function'
    || typeof store?.readState === 'function'
    || typeof readCurrentStateId(store) === 'string'
    || Array.isArray(store?.stateSnapshots)
}

export function describeStateManagerFromStore(store) {
  if (typeof store?.stateManager?.describeManager === 'function') {
    return store.stateManager.describeManager()
  }

  const currentStateId = readCurrentStateId(store)
  const snapshotCount = Array.isArray(store?.stateSnapshots) ? store.stateSnapshots.length : 0
  const generatedStateCount = Number.isFinite(store?.stateManager?.generatedStateCount)
    ? store.stateManager.generatedStateCount
    : (snapshotCount > 0 ? snapshotCount : (currentStateId ? 1 : 0))
  const lastGeneratedStateId =
    store?.stateManager?.lastGeneratedStateId
    ?? currentStateId
    ?? null

  return makeStateManagerSummary({
    capabilities: makeStateManagerCapabilities({
      stateIdGeneration:
        typeof store?.commitState === 'function'
        || snapshotCount > 0
        || typeof currentStateId === 'string',
      deltaCreation:
        typeof store?.stateManager?.createDelta === 'function'
        || typeof store?.readState === 'function'
        || snapshotCount > 0,
      statePatchCreation:
        typeof store?.stateManager?.buildStatePatch === 'function'
        || typeof store?.buildStatePatch === 'function'
        || typeof store?.readState === 'function'
        || snapshotCount > 0,
      refScopedReads:
        typeof store?.stateManager?.pickRefs === 'function'
        || typeof store?.readState === 'function'
        || snapshotCount > 0
        || Boolean(store?.widgets && typeof store.widgets === 'object'),
    }),
    reservedRefs: [
      SHARED_STATE_REF,
      TASK_CONTEXT_REF,
      REPLAY_CONTEXT_REF,
    ],
    counters: makeStateManagerCounters({
      generatedStateCount,
      lastGeneratedStateId,
    }),
  })
}

export class StateManager {
  constructor() {
    this.generatedStateCount = 0
    this.lastGeneratedStateId = null
  }

  createStateMeta({
    workspaceId = 'main',
    previousState = null,
    nextWidgets = {},
    nextShared = {},
    nextTaskContext = undefined,
    nextReplayContext = undefined,
    branchId = 'main',
  } = {}) {
    const nextStateSignature = stableSerialize({
      widgets: nextWidgets,
      shared: nextShared,
      taskContext: nextTaskContext,
      replayContext: nextReplayContext,
      branchId,
    })
    const previousStateSignature = previousState
      ? stableSerialize({
          widgets: previousState.widgets || {},
          shared: previousState.shared || {},
          taskContext: previousState.taskContext,
          replayContext: previousState.replayContext,
          branchId,
        })
      : null
    const createdAt = new Date().toISOString()

    if (previousState?.stateId && previousStateSignature === nextStateSignature) {
      return {
        stateId: previousState.stateId,
        createdAt: previousState.createdAt || createdAt,
        reused: true,
      }
    }

    this.generatedStateCount += 1
    this.lastGeneratedStateId = `${workspaceId}:s${this.generatedStateCount}`
    return {
      stateId: this.lastGeneratedStateId,
      createdAt,
      reused: false,
    }
  }

  createDelta({ previousState, nextState, previousReplayContext = undefined, nextReplayContext = undefined }) {
    const previousWidgets = previousState?.widgets || {}
    const nextWidgets = nextState?.widgets || {}
    const changedRefs = []
    const removedRefs = []

    const allRefs = new Set([...Object.keys(previousWidgets), ...Object.keys(nextWidgets)])
    for (const ref of allRefs) {
      if (!(ref in nextWidgets)) {
        removedRefs.push(ref)
        continue
      }
      if (!(ref in previousWidgets)) {
        changedRefs.push(ref)
        continue
      }
      if (stableSerialize(previousWidgets[ref]) !== stableSerialize(nextWidgets[ref])) {
        changedRefs.push(ref)
      }
    }

    if (stableSerialize(previousState?.shared || null) !== stableSerialize(nextState?.shared || null)) {
      changedRefs.push(SHARED_STATE_REF)
    }

    const previousTaskContextExists = previousState?.taskContext !== undefined
    const nextTaskContextExists = nextState?.taskContext !== undefined
    if (previousTaskContextExists || nextTaskContextExists) {
      if (!nextTaskContextExists) {
        removedRefs.push(TASK_CONTEXT_REF)
      } else if (!previousTaskContextExists || stableSerialize(previousState?.taskContext) !== stableSerialize(nextState?.taskContext)) {
        changedRefs.push(TASK_CONTEXT_REF)
      }
    }

    const previousReplayContextExists = previousReplayContext !== undefined
    const nextReplayContextExists = nextReplayContext !== undefined
    if (previousReplayContextExists || nextReplayContextExists) {
      if (!nextReplayContextExists) {
        removedRefs.push(REPLAY_CONTEXT_REF)
      } else if (!previousReplayContextExists || stableSerialize(previousReplayContext) !== stableSerialize(nextReplayContext)) {
        changedRefs.push(REPLAY_CONTEXT_REF)
      }
    }

    return {
      baseStateId: previousState?.stateId || null,
      changedRefs,
      removedRefs,
    }
  }

  buildStatePatch({ state, refs, replayContext = undefined }) {
    const widgets = state?.widgets || {}
    const patch = {}
    for (const ref of refs || []) {
      if (ref === SHARED_STATE_REF) {
        patch[ref] = clone(state?.shared)
        continue
      }
      if (ref === TASK_CONTEXT_REF) {
        patch[ref] = clone(state?.taskContext)
        continue
      }
      if (ref === REPLAY_CONTEXT_REF) {
        patch[ref] = clone(replayContext)
        continue
      }
      if (widgets[ref]) {
        patch[ref] = clone(widgets[ref])
      }
    }
    return patch
  }

  pickRefs({ state, refs, replayContext = undefined }) {
    if (!Array.isArray(refs) || refs.length === 0) {
      return clone(state)
    }
    const widgets = {}
    const includeShared = refs.includes(SHARED_STATE_REF)
    const includeTaskContext = refs.includes(TASK_CONTEXT_REF)
    const includeReplayContext = refs.includes(REPLAY_CONTEXT_REF)
    for (const ref of refs) {
      if (state?.widgets?.[ref]) {
        widgets[ref] = clone(state.widgets[ref])
      }
    }
    const nextState = {
      ...clone(state),
      widgets,
    }
    if (!includeShared) {
      delete nextState.shared
    }
    if (!includeTaskContext) {
      delete nextState.taskContext
    }
    if (includeReplayContext) {
      nextState.replayContext = clone(replayContext)
    } else {
      delete nextState.replayContext
    }
    return nextState
  }

  describeManager() {
    return makeStateManagerSummary({
      capabilities: makeStateManagerCapabilities({
        stateIdGeneration: true,
        deltaCreation: true,
        statePatchCreation: true,
        refScopedReads: true,
      }),
      reservedRefs: [
        SHARED_STATE_REF,
        TASK_CONTEXT_REF,
        REPLAY_CONTEXT_REF,
      ],
      counters: makeStateManagerCounters({
        generatedStateCount: this.generatedStateCount,
        lastGeneratedStateId: this.lastGeneratedStateId,
      }),
    })
  }
}
