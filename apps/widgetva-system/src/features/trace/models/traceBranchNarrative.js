export function deriveTraceBranchNarrative({ traceModel = null, traceFocus = null } = {}) {
  const activeBranchId = traceFocus?.activeBranchId || null
  const mainBranchId = traceModel?.mainBranchId || 'main'
  if (!activeBranchId || activeBranchId === mainBranchId) return null

  const branch = (traceModel?.provenanceGraph?.branches || []).find((entry) => entry?.branchId === activeBranchId) || null
  if (!branch) return null

  const stepById = new Map((traceModel?.steps || []).map((step) => [step.id, step]))
  const originStep = branch.originStepId ? stepById.get(branch.originStepId) || null : null
  const entryStep = branch.entryStepId ? stepById.get(branch.entryStepId) || null : null

  const originStepNumber = originStep?.stepNumber || null
  const entryStepNumber = entryStep?.stepNumber || null
  const originSummary = originStep?.summary || null
  const entrySummary = entryStep?.summary || branch.label || null

  const description = originStepNumber
    ? `Forked from step ${originStepNumber}${originSummary ? ` · ${originSummary}` : ''}`
    : `Forked from ${branch.originStateId || 'historical state'}`

  return {
    activeBranchId,
    branchLabel: branch.label || 'Branch',
    originStepId: branch.originStepId || null,
    originStepNumber,
    originSummary,
    originStateId: branch.originStateId || null,
    entryStepId: branch.entryStepId || null,
    entryStepNumber,
    entrySummary,
    description,
  }
}
