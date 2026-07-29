import { cloneJsonValue as cloneValue } from '../../shared/clone.js'

export function buildWorkspaceGlobalFilters(state = {}, {
  getRuntimeSession,
} = {}) {
  const session = typeof getRuntimeSession === 'function' && state?.runtimeSessionKey
    ? getRuntimeSession(state.runtimeSessionKey)
    : null
  const workspace = session?.workspace || null
  return workspace?.buildGlobalFiltersFromControlState?.(state.controlState || {}, {
    rangeDomains: state.controlRangeDomains || {},
  }) || {}
}

function hydrateWidgetRuntimeMetadata(widgets = [], workspaceSpec = {}) {
  const runtimeWidgetsById = Object.fromEntries(
    (Array.isArray(workspaceSpec?.widgets) ? workspaceSpec.widgets : [])
      .map((widget) => [widget?.widgetId, widget]),
  )

  return (Array.isArray(widgets) ? widgets : []).map((widget) => {
    const runtimeWidget = runtimeWidgetsById[widget?.id] || null
    const runtimeSource = runtimeWidget?.source || null
    return {
      ...widget,
      provider: runtimeWidget?.provider || widget?.provider,
      widgetKind: runtimeWidget?.kind || widget?.widgetKind,
      recognizedKinds: cloneValue(runtimeWidget?.recognizedKinds || widget?.recognizedKinds || []),
      runtimeSource: cloneValue(runtimeSource),
      providerSpec: cloneValue(runtimeSource?.providerSpec || null),
    }
  })
}

export function createInitialSessionStateFromCase(caseDef, {
  composition,
  runtimeSession,
  selectedWidgetId = null,
  buildEvidenceEntry,
  clone,
} = {}) {
  const hydratedWidgets = hydrateWidgetRuntimeMetadata(composition.widgets, runtimeSession.workspaceSpec)
  const hydratedComposition = {
    ...clone(composition),
    widgets: clone(hydratedWidgets),
  }
  return {
    activeCaseId: caseDef.id,
    workspaceSourceType: caseDef.sourceType || 'preset',
    caseTitle: caseDef.title,
    caseSummary: caseDef.summary,
    dataset: clone(caseDef.dataset),
    runtimeSessionKey: caseDef.id,
    currentWorkspaceSpec: runtimeSession.workspaceSpec,
    workspaceComposition: hydratedComposition,
    widgets: clone(hydratedWidgets),
    links: clone(composition.links),
    topology: composition.topology,
    workspaceProviderEnvironment: caseDef.workspaceProviderEnvironment || 'mixed',
    findings: (Array.isArray(caseDef.findings) ? caseDef.findings : []).map((entry, index) => buildEvidenceEntry(entry, index)),
    trace: clone(runtimeSession.trace || []),
    selectedTraceStepId: runtimeSession.trace?.[runtimeSession.trace.length - 1]?.id || null,
    traceNavigationTarget: null,
    collapsedTraceSegmentIds: [],
    traceFilters: ['all'],
    traceDensity: 'compact',
    agentMessages: clone(runtimeSession.agentMessages || []),
    activeReplayContext: null,
    branches: (Array.isArray(caseDef.branches) ? caseDef.branches : []).map((item) => ({ ...item })),
    log: (Array.isArray(caseDef.log) ? caseDef.log : []).map((item) => ({ ...item })),
    replaySteps: (Array.isArray(caseDef.replaySteps) ? caseDef.replaySteps : []).map((item) => ({ ...item })),
    selectedWidgetId,
    controlState: {},
    controlRangeDomains: {},
    scatterViewport: null,
  }
}

export function buildAppSnapshotFromState(state, {
  getRuntimeSession,
} = {}) {
  const widgets = Array.isArray(state.widgets) ? state.widgets : []
  const widgetMap = Object.fromEntries(widgets.map((widget) => [widget?.id, widget]).filter(([id]) => id))
  return {
    mode: state.mode,
    dataset: state.dataset,
    topology: state.topology,
    widgets,
    selectedWidget: widgetMap?.[state.selectedWidgetId] || null,
    focusedRecord: null,
    findings: state.findings,
    traceOpen: state.traceOpen,
    activeFilters: [],
    links: state.links || [],
    runtimeSession: typeof getRuntimeSession === 'function'
      ? getRuntimeSession(state.runtimeSessionKey || state.activeCaseId)
      : null,
  }
}
