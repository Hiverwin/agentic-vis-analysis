import { describeRefSchema } from './refs.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export const WIDGET_ADAPTER_PROVIDERS = ['vega-lite', 'echarts', 'd3', 'custom']

export function makeWidgetAdapterProviderCapabilities(capabilities = {}) {
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

export function makeWidgetAdapterHumanInteraction(interaction = {}) {
  return {
    mode: 'none',
    actionName: null,
    supportsDirectManipulation: false,
    ...interaction,
  }
}

export function makeWidgetAdapterCapabilities(capabilities = {}) {
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

export function makeWidgetAdapterSummary(summary = {}) {
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

export function describeWidgetAdapterProviderCapabilitiesSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      supportedWidgetKinds: { type: 'array', items: { type: 'string' } },
      renderStrategy: { type: 'string' },
      stateApplyStrategy: { type: 'string' },
      interactionBindingStrategy: { type: 'string' },
      supportsRendererMount: { type: 'boolean' },
      supportsRendererUpdate: { type: 'boolean' },
      supportsRendererDispose: { type: 'boolean' },
      supportsSignalPatching: { type: 'boolean' },
      supportsOptionMerging: { type: 'boolean' },
      supportsImperativeRender: { type: 'boolean' },
      supportsPointSelection: { type: 'boolean' },
      supportsIntervalSelection: { type: 'boolean' },
      supportsZoomPan: { type: 'boolean' },
      supportsFocusReadback: { type: 'boolean' },
      supportsSelectionReadback: { type: 'boolean' },
      supportsViewportReadback: { type: 'boolean' },
      supportsHighlightProjection: { type: 'boolean' },
      supportsInteractionEvents: { type: 'boolean' },
    },
  })
}

export function describeWidgetAdapterHumanInteractionSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      mode: { type: 'string' },
      actionName: { type: ['string', 'null'] },
      supportsDirectManipulation: { type: 'boolean' },
    },
  })
}

export function describeWidgetAdapterCapabilitiesSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      canDescribe: { type: 'boolean' },
      canReadState: { type: 'boolean' },
      canApplyState: { type: 'boolean' },
      canMount: { type: 'boolean' },
      canUpdate: { type: 'boolean' },
      canDisposeRenderer: { type: 'boolean' },
      canBindHumanInteractions: { type: 'boolean' },
      canReadSelection: { type: 'boolean' },
      canReadViewport: { type: 'boolean' },
      canRegisterActions: { type: 'boolean' },
      canRegisterPerceptionQueries: { type: 'boolean' },
    },
  })
}

export function describeWidgetAdapterSummarySchema() {
  return cloneValue({
    type: 'object',
    required: ['widgetRef', 'provider', 'capabilities', 'humanInteraction'],
    properties: {
      widgetRef: describeRefSchema(),
      dataRef: {
        anyOf: [describeRefSchema(), { type: 'null' }],
      },
      kind: { type: ['string', 'null'] },
      title: { type: 'string' },
      description: { type: 'string' },
      analyticRoles: { type: 'array', items: { type: 'string' } },
      primaryDataRef: {
        anyOf: [describeRefSchema(), { type: 'null' }],
      },
      provider: { type: 'string', enum: WIDGET_ADAPTER_PROVIDERS },
      providerCapabilities: describeWidgetAdapterProviderCapabilitiesSchema(),
      role: { type: ['string', 'null'] },
      sourceKind: { type: ['string', 'null'] },
      supportsSpecMutation: { type: 'boolean' },
      metadata: { type: 'object' },
      usageNotes: { type: 'array', items: { type: 'string' } },
      actionNames: { type: 'array', items: { type: 'string' } },
      perceptionQueryNames: { type: 'array', items: { type: 'string' } },
      humanInteraction: describeWidgetAdapterHumanInteractionSchema(),
      capabilities: describeWidgetAdapterCapabilitiesSchema(),
    },
  })
}
