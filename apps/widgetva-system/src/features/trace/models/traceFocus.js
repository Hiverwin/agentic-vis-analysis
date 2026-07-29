export function deriveTraceFocus({ traceModel = null, activeReplayContext = null } = {}) {
  const mainBranchId = traceModel?.mainBranchId || 'main'
  const replayBranchId = activeReplayContext?.branchId || null
  const timelineBranchId = traceModel?.selection?.currentBranchId || mainBranchId
  const activeBranchId = replayBranchId || timelineBranchId || mainBranchId
  const hasBranchFocus = activeBranchId !== mainBranchId

  return {
    activeBranchId,
    hasBranchFocus,
    source: replayBranchId ? 'replay' : 'timeline',
  }
}
