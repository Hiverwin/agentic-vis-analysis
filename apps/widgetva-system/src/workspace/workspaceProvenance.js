function toBranchLabel(branchId) {
  if (!branchId || branchId === 'main') return 'Main'
  return 'Branch'
}

export function deriveWorkspaceProvenance({
  selectedWidgetId = null,
  selectedTraceStep = null,
  activeReplayContext = null,
} = {}) {
  const activeBranchId = activeReplayContext?.branchId
    || selectedTraceStep?.branchId
    || 'main'
  const focusedReplayWidgetId = activeReplayContext?.restoredWidgetId
    || activeReplayContext?.widgetId
    || selectedTraceStep?.widgetId
    || null
  const replaySummary = activeReplayContext?.summary
    || selectedTraceStep?.summary
    || ''

  return {
    activeBranchId,
    branchLabel: toBranchLabel(activeBranchId),
    hasReplayAnchor: Boolean(activeReplayContext),
    replaySource: activeReplayContext?.source || null,
    focusedReplayWidgetId,
    replaySummary,
    shouldAccentSelectedWidget: Boolean(
      focusedReplayWidgetId
      && selectedWidgetId
      && focusedReplayWidgetId === selectedWidgetId,
    ),
  }
}
