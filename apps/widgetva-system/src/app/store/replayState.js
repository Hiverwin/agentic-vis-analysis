export function buildReplayContext({
  source = 'unknown',
  triggerId = null,
  selectedTraceStepId = null,
  stateId = null,
  sourceStateId = null,
  branchId = null,
  transitionType = null,
  summary = '',
  widgetId = null,
  widgetTitle = null,
  findingId = null,
  restoredWidgetId = null,
} = {}) {
  return {
    source,
    triggerId,
    selectedTraceStepId,
    stateId,
    sourceStateId,
    branchId,
    transitionType,
    summary,
    widgetId,
    widgetTitle,
    findingId,
    restoredWidgetId,
    replayedAt: Date.now(),
  }
}

export function buildReplayContextFromTraceStep(step, {
  source = 'trace_step',
  triggerId = null,
  findingId = null,
} = {}) {
  if (!step || typeof step !== 'object') return null
  return buildReplayContext({
    source,
    triggerId: triggerId || step.id || null,
    selectedTraceStepId: step.id || null,
    stateId: step.resultStateId || null,
    sourceStateId: step.sourceStateId || null,
    branchId: step.branchId || null,
    transitionType: step.transitionType || null,
    summary: step.summary || step.label || '',
    widgetId: step.widgetId || null,
    widgetTitle: step.widgetTitle || step.widgetId || null,
    findingId,
  })
}

export function buildReplayContextFromFinding(finding, stateId) {
  if (!finding || typeof finding !== 'object') return null
  return buildReplayContext({
    source: 'finding',
    triggerId: finding.id || null,
    selectedTraceStepId: finding.traceStepId || null,
    stateId: stateId || finding.stateId || null,
    branchId: finding.branchId || null,
    transitionType: null,
    summary: finding.title || finding.note || 'Finding replay',
    widgetId: finding.widgetId || null,
    widgetTitle: finding.widgetId || 'Workspace',
    findingId: finding.id || null,
  })
}

export function buildTraceNavigationTarget(stepId, kind = 'trace') {
  if (typeof stepId !== 'string' || stepId.length === 0) return null
  return { stepId, kind, timestamp: Date.now() }
}
