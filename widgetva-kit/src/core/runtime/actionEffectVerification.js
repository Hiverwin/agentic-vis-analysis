import {
  buildActionVerificationPayload,
  resolveActionDescriptorForVerification,
} from './actionVerification.js'
import { makeActionVerificationResult } from '../protocol/results.js'
import {
  readCurrentSnapshotMetaFromStore,
  readInteractionTraceFromStore,
  readSnapshotEntryFromStore,
  readWorkspaceStateFromStore,
} from './workspaceStoreReaders.js'
import { readSelectionRegistry } from '../../workspace/state/selectionStateModel.js'

export function evaluateActionEffectVerification({
  store,
  getFinalWorkspaceSnapshot,
  evaluateLinkPropagation,
  actionName = null,
  stateId = null,
  refs = [],
  targetRef = null,
  traceLimit = 50,
} = {}) {
  const trace = readInteractionTraceFromStore(store, { limit: traceLimit })
  const expectedRefs = Array.isArray(refs) ? refs : []
  const matchingRecord = [...trace].reverse().find((record) => {
    if (stateId && record?.stateId !== stateId) return false
    if (actionName && record?.action?.name !== actionName) return false
    return true
  })
  const affectedRefs = Array.isArray(matchingRecord?.affectedRefs) ? matchingRecord.affectedRefs : []
  const missingRefs = expectedRefs.filter((ref) => !affectedRefs.includes(ref))
  const matchedActionName = matchingRecord?.action?.name || actionName || null
  const matchedTargetRef = matchingRecord?.action?.targetRef || targetRef || null
  const descriptor = resolveActionDescriptorForVerification({
    store,
    actionName: matchedActionName,
    targetRef: matchedTargetRef,
    affectedRefs,
  })
  const verificationPayload = buildActionVerificationPayload({
    descriptor,
    updatedRefs: expectedRefs.length > 0 ? expectedRefs : affectedRefs,
  })
  const finalSnapshot = getFinalWorkspaceSnapshot({
    stateId,
    refs: expectedRefs.length > 0 ? expectedRefs : undefined,
    includeMeta: true,
  }) || null
  const fullFinalSnapshot = getFinalWorkspaceSnapshot({
    stateId,
    includeMeta: true,
  }) || finalSnapshot
  const activeSelectionRefs = Object.keys(readSelectionRegistry(fullFinalSnapshot?.shared || {}))
  const linkPropagation = activeSelectionRefs.map((sourceRef) =>
    evaluateLinkPropagation({ sourceRef }) || {
      ok: false,
      sourceRef,
      linkCount: 0,
      passedCount: 0,
      consistencyScore: 0,
      results: [],
    },
  )
  const propagationOk = linkPropagation.every((entry) => entry.ok)
  const snapshotEntry = stateId
    ? readSnapshotEntryFromStore(store, stateId)
    : readCurrentSnapshotMetaFromStore(store)
  const updatedState = stateId
    ? snapshotEntry?.state || null
    : readWorkspaceStateFromStore(store)
  const replayContext = stateId
    ? snapshotEntry?.replayContext || null
    : store?.replayContext || null
  const statePatch = expectedRefs.length > 0
    ? store?.stateManager?.buildStatePatch?.({
        state: updatedState,
        replayContext,
        refs: expectedRefs,
      }) || {}
    : {}
  const verified = !!matchingRecord && missingRefs.length === 0 && propagationOk

  return makeActionVerificationResult({
    verified,
    matchedStateId: matchingRecord?.stateId || null,
    matchedActionName,
    affectedRefs,
    missingRefs,
    expectedPostconditions: verificationPayload.expectedPostconditions,
    verificationHints: verificationPayload.verificationHints,
    traceEvidence: matchingRecord || null,
    statePatch,
    finalSnapshot,
    linkPropagation,
  })
}
