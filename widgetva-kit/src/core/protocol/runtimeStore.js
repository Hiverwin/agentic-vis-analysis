function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function makeRuntimeStoreCurrentStateSummary(summary) {
  return {
    stateId: null,
    focusedWidgetRef: null,
    focusedWidgetKind: null,
    focusedWidgetTitle: null,
    visibleCount: null,
    selectedCount: null,
    selectionCount: 0,
    activeSelectionRefs: [],
    primarySelectionRef: null,
    primarySelectionSummary: '',
    primarySelectionPredicates: [],
    annotationCount: 0,
    comparisonTargetCount: 0,
    globalFilterCount: 0,
    taskMode: null,
    coordinationScope: null,
    evidenceType: null,
    interactionHorizon: null,
    replayRunMode: null,
    replayUserIntent: '',
    changedRefs: [],
    removedRefs: [],
    sharedChanged: false,
    taskContextChanged: false,
    replayContextChanged: false,
    ...summary,
  }
}

export function describeRuntimeStoreCurrentStateSummarySchema() {
  return cloneValue({
    type: ['object', 'null'],
    properties: {
      stateId: { type: ['string', 'null'] },
      focusedWidgetRef: { type: ['string', 'null'] },
      focusedWidgetKind: { type: ['string', 'null'] },
      focusedWidgetTitle: { type: ['string', 'null'] },
      visibleCount: { type: ['number', 'null'] },
      selectedCount: { type: ['number', 'null'] },
      selectionCount: { type: 'integer' },
      activeSelectionRefs: { type: 'array', items: { type: 'string' } },
      primarySelectionRef: { type: ['string', 'null'] },
      primarySelectionSummary: { type: 'string' },
      primarySelectionPredicates: { type: 'array', items: { type: 'object' } },
      annotationCount: { type: 'integer' },
      comparisonTargetCount: { type: 'integer' },
      globalFilterCount: { type: 'integer' },
      taskMode: { type: ['string', 'null'] },
      coordinationScope: { type: ['string', 'null'] },
      evidenceType: { type: ['string', 'null'] },
      interactionHorizon: { type: ['string', 'null'] },
      replayRunMode: { type: ['string', 'null'] },
      replayUserIntent: { type: 'string' },
      changedRefs: { type: 'array', items: { type: 'string' } },
      removedRefs: { type: 'array', items: { type: 'string' } },
      sharedChanged: { type: 'boolean' },
      taskContextChanged: { type: 'boolean' },
      replayContextChanged: { type: 'boolean' },
    },
  })
}

export function makeRuntimeStoreHistoryRetention(retention) {
  return {
    snapshotMax: 0,
    traceMax: 0,
    responseMax: 0,
    ...retention,
  }
}

export function describeRuntimeStoreRetentionSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      snapshotMax: { type: 'integer' },
      traceMax: { type: 'integer' },
      responseMax: { type: 'integer' },
    },
  })
}

export function makeRuntimeStoreIdentity(identity) {
  return {
    appId: '',
    workspaceId: '',
    ...identity,
  }
}

export function describeRuntimeStoreIdentitySchema() {
  return cloneValue({
    type: 'object',
    properties: {
      appId: { type: 'string' },
      workspaceId: { type: 'string' },
    },
  })
}

export function makeRuntimeStoreStateSummary(summary) {
  return {
    stateId: null,
    currentBranchId: null,
    previousStateId: null,
    version: 0,
    ...summary,
  }
}

export function describeRuntimeStoreStateSummarySchema() {
  return cloneValue({
    type: 'object',
    required: ['stateId', 'currentBranchId'],
    properties: {
      stateId: { type: ['string', 'null'] },
      currentBranchId: { type: ['string', 'null'] },
      previousStateId: { type: ['string', 'null'] },
      version: { type: 'integer' },
    },
  })
}

export function makeRuntimeStoreIndexes(indexes) {
  return {
    widgetCount: 0,
    dataHandleCount: 0,
    linkCount: 0,
    widgetAdapterCount: 0,
    actionDescriptorCount: 0,
    perceptionDescriptorCount: 0,
    widgetPatchCount: 0,
    ...indexes,
  }
}

export function describeRuntimeStoreIndexesSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      widgetCount: { type: 'integer' },
      dataHandleCount: { type: 'integer' },
      linkCount: { type: 'integer' },
      widgetAdapterCount: { type: 'integer' },
      actionDescriptorCount: { type: 'integer' },
      perceptionDescriptorCount: { type: 'integer' },
      widgetPatchCount: { type: 'integer' },
    },
  })
}

export function makeRuntimeStoreHistory(history) {
  return {
    snapshotCount: 0,
    traceCount: 0,
    responseCount: 0,
    branchCount: 0,
    retention: makeRuntimeStoreHistoryRetention(),
    maxSnapshotRetention: 0,
    maxTraceRetention: 0,
    maxResponseRetention: 0,
    ...history,
  }
}

export function describeRuntimeStoreHistorySchema() {
  return cloneValue({
    type: 'object',
    properties: {
      snapshotCount: { type: 'integer' },
      traceCount: { type: 'integer' },
      responseCount: { type: 'integer' },
      branchCount: { type: 'integer' },
      retention: describeRuntimeStoreRetentionSchema(),
      maxSnapshotRetention: { type: 'integer' },
      maxTraceRetention: { type: 'integer' },
      maxResponseRetention: { type: 'integer' },
    },
  })
}

export function makeRuntimeStoreCapabilities(capabilities) {
  return {
    deltaTracking: false,
    snapshotHistory: false,
    actorScopedHistory: false,
    branchReplay: false,
    traceGraph: false,
    runtimeDataIndex: false,
    adapterRegistry: false,
    widgetStatePatching: false,
    ...capabilities,
  }
}

export function describeRuntimeStoreCapabilitiesSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      deltaTracking: { type: 'boolean' },
      snapshotHistory: { type: 'boolean' },
      actorScopedHistory: { type: 'boolean' },
      branchReplay: { type: 'boolean' },
      traceGraph: { type: 'boolean' },
      runtimeDataIndex: { type: 'boolean' },
      adapterRegistry: { type: 'boolean' },
      widgetStatePatching: { type: 'boolean' },
    },
  })
}

export function makeRuntimeStoreSummary(summary) {
  return {
    currentStateSummary: null,
    ...summary,
    identity: makeRuntimeStoreIdentity(summary?.identity),
    state: makeRuntimeStoreStateSummary(summary?.state),
    currentStateSummary: summary?.currentStateSummary == null
      ? null
      : makeRuntimeStoreCurrentStateSummary(summary.currentStateSummary),
    indexes: makeRuntimeStoreIndexes(summary?.indexes),
    history: makeRuntimeStoreHistory(summary?.history),
    capabilities: makeRuntimeStoreCapabilities(summary?.capabilities),
  }
}

export function describeRuntimeStoreSummarySchema() {
  return cloneValue({
    type: 'object',
    required: ['identity', 'state', 'indexes', 'history', 'capabilities'],
    properties: {
      identity: describeRuntimeStoreIdentitySchema(),
      state: describeRuntimeStoreStateSummarySchema(),
      currentStateSummary: describeRuntimeStoreCurrentStateSummarySchema(),
      indexes: describeRuntimeStoreIndexesSchema(),
      history: describeRuntimeStoreHistorySchema(),
      capabilities: describeRuntimeStoreCapabilitiesSchema(),
    },
  })
}
