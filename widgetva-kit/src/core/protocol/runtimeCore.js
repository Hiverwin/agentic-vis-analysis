function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function makeRuntimeCoreComponents(components) {
  return {
    workspacePlanner: false,
    widgetRegistry: false,
    actionExecutor: false,
    actionContext: false,
    agentLoopRuntime: false,
    perceptionQueryRegistry: false,
    perceptionContext: false,
    dataQueryExecutor: false,
    dataQueryContext: false,
    dataQueryEngine: false,
    linkEngine: false,
    stateManager: false,
    interactionTraceRecorder: false,
    responseRecorder: false,
    ...components,
  }
}

export function describeRuntimeCoreComponentsSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      workspacePlanner: { type: 'boolean' },
      widgetRegistry: { type: 'boolean' },
      actionExecutor: { type: 'boolean' },
      actionContext: { type: 'boolean' },
      agentLoopRuntime: { type: 'boolean' },
      perceptionQueryRegistry: { type: 'boolean' },
      perceptionContext: { type: 'boolean' },
      dataQueryExecutor: { type: 'boolean' },
      dataQueryContext: { type: 'boolean' },
      dataQueryEngine: { type: 'boolean' },
      linkEngine: { type: 'boolean' },
      stateManager: { type: 'boolean' },
      interactionTraceRecorder: { type: 'boolean' },
      responseRecorder: { type: 'boolean' },
    },
  })
}

export function makeRuntimeCoreRegistries(registries) {
  return {
    widgetCount: 0,
    dataHandleCount: 0,
    linkCount: 0,
    adapterCount: 0,
    snapshotCount: 0,
    branchCount: 0,
    actionDescriptorCount: 0,
    actionHandlerCount: 0,
    actionPreconditionCount: 0,
    perceptionDescriptorCount: 0,
    perceptionHandlerCount: 0,
    dataQueryKindCount: 0,
    dataQueryDescriptorCount: 0,
    linkPrimitiveCount: 0,
    traceRecordCount: 0,
    responseCount: 0,
    ...registries,
  }
}

export function describeRuntimeCoreRegistriesSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      widgetCount: { type: 'integer' },
      dataHandleCount: { type: 'integer' },
      linkCount: { type: 'integer' },
      adapterCount: { type: 'integer' },
      snapshotCount: { type: 'integer' },
      branchCount: { type: 'integer' },
      actionDescriptorCount: { type: 'integer' },
      actionHandlerCount: { type: 'integer' },
      actionPreconditionCount: { type: 'integer' },
      perceptionDescriptorCount: { type: 'integer' },
      perceptionHandlerCount: { type: 'integer' },
      dataQueryKindCount: { type: 'integer' },
      dataQueryDescriptorCount: { type: 'integer' },
      linkPrimitiveCount: { type: 'integer' },
      traceRecordCount: { type: 'integer' },
      responseCount: { type: 'integer' },
    },
  })
}

export function makeRuntimeCoreCapabilities(capabilities) {
  return {
    paramsValidation: false,
    perceptionReturnsValidation: false,
    dataQueryReturnsValidation: false,
    actionRun: false,
    perceptionQueryRun: false,
    dataQueryRun: false,
    workspacePlanning: false,
    verifiedActionRun: false,
    agentLoopContextRead: false,
    statePatching: false,
    stateDelta: false,
    workspaceDescriptionRead: false,
    runtimeStoreRead: false,
    widgetRegistryRead: false,
    widgetAdapterListRead: false,
    viewRead: false,
    snapshotRead: false,
    stateHistoryRead: false,
    branchListRead: false,
    interactionTraceRead: false,
    primitiveTraceRead: false,
    affectedRefsTraceRead: false,
    actionCallTraceRead: false,
    stateDeltaTraceRead: false,
    verifyQueryResultsRead: false,
    branchReplayEventsRead: false,
    traceGraphRead: false,
    stateJump: false,
    branchCreate: false,
    finalWorkspaceSnapshotRead: false,
    linkPropagationEvaluation: false,
    traceRecording: false,
    branchReplay: false,
    answerRecording: false,
    latestResponseRead: false,
    responseHistoryRead: false,
    protocolIntrospection: false,
    ...capabilities,
  }
}

export function describeRuntimeCoreCapabilitiesSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      paramsValidation: { type: 'boolean' },
      perceptionReturnsValidation: { type: 'boolean' },
      dataQueryReturnsValidation: { type: 'boolean' },
      actionRun: { type: 'boolean' },
      perceptionQueryRun: { type: 'boolean' },
      dataQueryRun: { type: 'boolean' },
      workspacePlanning: { type: 'boolean' },
      verifiedActionRun: { type: 'boolean' },
      agentLoopContextRead: { type: 'boolean' },
      statePatching: { type: 'boolean' },
      stateDelta: { type: 'boolean' },
      workspaceDescriptionRead: { type: 'boolean' },
      runtimeStoreRead: { type: 'boolean' },
      widgetRegistryRead: { type: 'boolean' },
      widgetAdapterListRead: { type: 'boolean' },
      viewRead: { type: 'boolean' },
      snapshotRead: { type: 'boolean' },
      stateHistoryRead: { type: 'boolean' },
      branchListRead: { type: 'boolean' },
      interactionTraceRead: { type: 'boolean' },
      primitiveTraceRead: { type: 'boolean' },
      affectedRefsTraceRead: { type: 'boolean' },
      actionCallTraceRead: { type: 'boolean' },
      stateDeltaTraceRead: { type: 'boolean' },
      verifyQueryResultsRead: { type: 'boolean' },
      branchReplayEventsRead: { type: 'boolean' },
      traceGraphRead: { type: 'boolean' },
      stateJump: { type: 'boolean' },
      branchCreate: { type: 'boolean' },
      finalWorkspaceSnapshotRead: { type: 'boolean' },
      linkPropagationEvaluation: { type: 'boolean' },
      traceRecording: { type: 'boolean' },
      branchReplay: { type: 'boolean' },
      answerRecording: { type: 'boolean' },
      latestResponseRead: { type: 'boolean' },
      responseHistoryRead: { type: 'boolean' },
      protocolIntrospection: { type: 'boolean' },
    },
  })
}

export function makeRuntimeCoreSummary(summary) {
  return {
    ...summary,
    components: makeRuntimeCoreComponents(summary?.components),
    registries: makeRuntimeCoreRegistries(summary?.registries),
    capabilities: makeRuntimeCoreCapabilities(summary?.capabilities),
  }
}

export function describeRuntimeCoreSummarySchema() {
  return cloneValue({
    type: 'object',
    required: ['components', 'registries', 'capabilities'],
    properties: {
      components: describeRuntimeCoreComponentsSchema(),
      registries: describeRuntimeCoreRegistriesSchema(),
      capabilities: describeRuntimeCoreCapabilitiesSchema(),
    },
  })
}
