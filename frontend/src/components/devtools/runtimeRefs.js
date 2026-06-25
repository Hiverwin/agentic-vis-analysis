import t from '../../locale.js'

export function isSpecialRuntimeRef(ref) {
  return ref === 'shared' || ref === 'taskContext' || ref === 'replayContext'
}

export function formatRuntimeRef(ref) {
  if (ref === 'shared') return t.runtimeRefShared
  if (ref === 'taskContext') return t.runtimeRefTaskContext
  if (ref === 'replayContext') return t.runtimeRefReplayContext
  return ref
}

export function pickRuntimeTargetRef({ targetRef, affectedRefs = [] } = {}) {
  if (typeof targetRef === 'string' && targetRef.trim() && !isSpecialRuntimeRef(targetRef)) {
    return targetRef
  }
  return (Array.isArray(affectedRefs) ? affectedRefs : []).find(
    (ref) => typeof ref === 'string' && ref.trim() && !isSpecialRuntimeRef(ref),
  )
}
