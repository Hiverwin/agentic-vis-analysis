export function buildAnalysisProvenanceSummary({
  selectedTraceStep = null,
  selectedSegment = null,
  selectedPath = null,
  currentSegment = null,
  currentPath = null,
  activeReplayContext = null,
  branchNarrative = null,
} = {}) {
  const branchId = activeReplayContext?.branchId || selectedTraceStep?.branchId || 'main'
  const branchLabel = branchNarrative?.branchLabel || (branchId === 'main' ? 'Main' : 'Branch')
  const entryStepLabel = branchNarrative?.entryStepNumber
    ? `Step ${branchNarrative.entryStepNumber}${branchNarrative.entrySummary ? ` · ${branchNarrative.entrySummary}` : ''}`
    : null

  return {
    branchId,
    branchLabel,
    hasBranchNarrative: Boolean(branchNarrative),
    forkDescription: branchNarrative?.description || null,
    entryStepLabel,
    selectedSegmentId: selectedSegment?.id || null,
    selectedSegmentLabel: selectedSegment?.label || null,
    selectedSegmentSummary: selectedSegment?.summary || null,
    selectedSegmentStepCount: selectedSegment?.stepCount || 0,
    selectedPathId: selectedPath?.id || null,
    selectedPathLabel: selectedPath?.label || null,
    selectedPathSummary: selectedPath?.shortSummary || null,
    selectedPathSegmentCount: selectedPath?.segmentCount || 0,
    selectedPathStepCount: selectedPath?.stepCount || 0,
    currentSegmentId: currentSegment?.id || null,
    currentPathId: currentPath?.id || null,
  }
}
