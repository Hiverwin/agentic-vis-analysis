function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function makeWidgetAdapterProviderCapabilities(capabilities = {}) {
  return {
    supportedWidgetKinds: [],
    renderStrategy: 'custom',
    stateApplyStrategy: 'custom',
    interactionBindingStrategy: 'custom',
    supportsRendererMount: false,
    supportsRendererUpdate: false,
    supportsRendererDispose: false,
    supportsSignalPatching: false,
    supportsOptionMerging: false,
    supportsImperativeRender: false,
    supportsPointSelection: false,
    supportsIntervalSelection: false,
    supportsZoomPan: false,
    supportsFocusReadback: false,
    supportsSelectionReadback: false,
    supportsViewportReadback: false,
    supportsHighlightProjection: false,
    supportsInteractionEvents: false,
    ...capabilities,
  }
}

function makeWidgetAdapterHumanInteraction(interaction = {}) {
  return {
    mode: 'none',
    actionName: null,
    supportsDirectManipulation: false,
    ...interaction,
  }
}

function makeWidgetAdapterCapabilities(capabilities = {}) {
  return {
    canDescribe: false,
    canReadState: false,
    canApplyState: false,
    canMount: false,
    canUpdate: false,
    canDisposeRenderer: false,
    canBindHumanInteractions: false,
    canReadSelection: false,
    canReadViewport: false,
    canRegisterActions: false,
    canRegisterPerceptionQueries: false,
    ...capabilities,
  }
}

function makeWidgetAdapterSummary(summary = {}) {
  return {
    widgetRef: null,
    dataRef: null,
    kind: null,
    title: '',
    description: '',
    analyticRoles: [],
    primaryDataRef: null,
    provider: 'custom',
    providerCapabilities: makeWidgetAdapterProviderCapabilities(),
    role: null,
    sourceKind: null,
    supportsSpecMutation: false,
    metadata: {},
    usageNotes: [],
    actionNames: [],
    perceptionQueryNames: [],
    humanInteraction: makeWidgetAdapterHumanInteraction(),
    capabilities: makeWidgetAdapterCapabilities(),
    ...summary,
    providerCapabilities: makeWidgetAdapterProviderCapabilities(summary?.providerCapabilities),
    humanInteraction: makeWidgetAdapterHumanInteraction(summary?.humanInteraction),
    capabilities: makeWidgetAdapterCapabilities(summary?.capabilities),
  }
}

export function summarizeWidgetAdapter(adapter) {
  if (!adapter) return null
  const humanInteraction = adapter.getHumanInteractionConfig?.() || null
  const description = adapter.getDescription?.() || null
  return makeWidgetAdapterSummary({
    widgetRef: adapter.widgetRef,
    dataRef: adapter.dataRef || null,
    kind: adapter.kind || description?.kind || null,
    title: description?.title || adapter.title || '',
    description: description?.description || adapter.description || '',
    analyticRoles: Array.isArray(description?.analyticRoles)
      ? [...description.analyticRoles]
      : (Array.isArray(adapter.analyticRoles) ? [...adapter.analyticRoles] : []),
    primaryDataRef: description?.primaryDataRef || adapter.primaryDataRef || null,
    provider: adapter.provider || 'custom',
    providerCapabilities: makeWidgetAdapterProviderCapabilities(clone(adapter.providerCapabilities || {})),
    role: description?.role || adapter.role || null,
    sourceKind: description?.sourceKind || adapter.sourceKind || null,
    supportsSpecMutation: description?.supportsSpecMutation === true || adapter.supportsSpecMutation === true,
    metadata: clone(adapter.metadata || {}),
    usageNotes: Array.isArray(description?.usageNotes)
      ? [...description.usageNotes]
      : (Array.isArray(adapter.usageNotes) ? [...adapter.usageNotes] : []),
    actionNames: Array.isArray(description?.actionNames)
      ? [...description.actionNames]
      : (Array.isArray(adapter.actionNames) ? [...adapter.actionNames] : []),
    perceptionQueryNames: Array.isArray(description?.perceptionQueryNames)
      ? [...description.perceptionQueryNames]
      : (Array.isArray(adapter.perceptionQueryNames) ? [...adapter.perceptionQueryNames] : []),
    humanInteraction: makeWidgetAdapterHumanInteraction(clone(humanInteraction || adapter.humanInteraction || null)),
    capabilities: makeWidgetAdapterCapabilities({
      canDescribe: typeof adapter.getDescription === 'function',
      canReadState: typeof adapter.getState === 'function',
      canApplyState: typeof adapter.applyState === 'function',
      canMount: typeof adapter.mount === 'function',
      canUpdate: typeof adapter.update === 'function',
      canDisposeRenderer: typeof adapter.dispose === 'function',
      canBindHumanInteractions: typeof adapter.bindHumanInteractions === 'function',
      canReadSelection: typeof adapter.readSelection === 'function',
      canReadViewport: typeof adapter.readViewport === 'function',
      canRegisterActions: typeof adapter.registerActions === 'function',
      canRegisterPerceptionQueries: typeof adapter.registerPerceptionQueries === 'function',
    }),
  })
}
