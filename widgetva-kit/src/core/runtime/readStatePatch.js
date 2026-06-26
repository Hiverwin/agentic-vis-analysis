import { readWorkspaceStateFromStore } from './workspaceStoreReaders.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function readStatePatch(store, refs = []) {
  const normalizedRefs = Array.isArray(refs) ? refs.filter(Boolean) : []

  if (typeof store?.buildStatePatch === 'function') {
    return store.buildStatePatch(normalizedRefs)
  }

  const state = readWorkspaceStateFromStore(store, { refs: normalizedRefs }) || {}
  const patch = {}

  for (const ref of normalizedRefs) {
    if (state?.widgets?.[ref]) {
      patch[ref] = clone(state.widgets[ref])
      continue
    }
    if (ref === 'shared' && state?.shared !== undefined) {
      patch.shared = clone(state.shared)
      continue
    }
    if (ref === 'taskContext' && state?.taskContext !== undefined) {
      patch.taskContext = clone(state.taskContext)
      continue
    }
    if (ref === 'replayContext' && state?.replayContext !== undefined) {
      patch.replayContext = clone(state.replayContext)
    }
  }

  return patch
}
