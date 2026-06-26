export function buildWorkspaceGlobalFilters(state = {}, {
  getRuntimeSession,
} = {}) {
  const session = typeof getRuntimeSession === 'function' && state?.runtimeSessionKey
    ? getRuntimeSession(state.runtimeSessionKey)
    : null
  const workspace = session?.workspace || null
  return workspace?.buildGlobalFiltersFromControlState?.({
    origin: state.analysisOrigin,
    year: state.analysisYear,
    cylinders: state.analysisCylinders,
    horsepowerRange: [state.horsepowerMin, state.horsepowerMax],
  }, {
    rangeDomains: {
      horsepower: state.dataset?.horsepowerDomain || null,
    },
  }) || {}
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
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
      runtimeSource: cloneValue(runtimeSource),
      providerSpec: cloneValue(runtimeSource?.providerSpec || null),
      baseRenderModel: cloneValue(runtimeSource?.renderModel || null),
      interactionConfig: cloneValue(runtimeSource?.interactionConfig || null),
      providerCapabilities: cloneValue(runtimeSource?.providerCapabilities || null),
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
  const [hpMin, hpMax] = caseDef.dataset.horsepowerDomain
  const hydratedWidgets = hydrateWidgetRuntimeMetadata(composition.widgets, runtimeSession.workspaceSpec)
  const hydratedComposition = {
    ...clone(composition),
    widgets: clone(hydratedWidgets),
  }
  return {
    activeCaseId: caseDef.id,
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
    widgetActionOverrides: {},
    analysisOrigin: 'All',
    analysisYear: 'All',
    analysisCylinders: [],
    horsepowerMin: hpMin,
    horsepowerMax: hpMax,
    scatterViewport: null,
    focusedCarId: null,
  }
}

export function buildAppSnapshotFromState(state, {
  createWorkspaceViewModel,
  getRuntimeSession,
} = {}) {
  const viewModel = typeof createWorkspaceViewModel === 'function'
    ? createWorkspaceViewModel(state)
    : { widgetMap: {}, focusedCar: null, activeFilters: [] }
  return {
    mode: state.mode,
    dataset: state.dataset,
    topology: state.topology,
    widgets: Object.values(viewModel.widgetMap || {}),
    selectedWidget: viewModel.widgetMap?.[state.selectedWidgetId] || null,
    focusedCar: viewModel.focusedCar,
    findings: state.findings,
    traceOpen: state.traceOpen,
    activeFilters: viewModel.activeFilters,
    links: state.links || [],
    runtimeSession: typeof getRuntimeSession === 'function'
      ? getRuntimeSession(state.runtimeSessionKey || state.activeCaseId)
      : null,
  }
}
