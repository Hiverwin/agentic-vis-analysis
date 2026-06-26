function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function makeDataQueryContextCapabilities(capabilities = {}) {
  return {
    workspaceRead: false,
    runtimeDataRead: false,
    widgetTargetResolution: false,
    dataHandleResolution: false,
    selectionTargetResolution: false,
    explicitTargetValidation: false,
    selectionScopedQueries: false,
    traceRecording: false,
    ...capabilities,
  }
}

export function makeDataQueryContextIntegrations(integrations = {}) {
  return {
    store: false,
    traceRecorder: false,
    ...integrations,
  }
}

export function makeDataQueryContextSummary(summary = {}) {
  return {
    methods: Array.isArray(summary?.methods) ? [...summary.methods] : [],
    capabilities: makeDataQueryContextCapabilities(summary?.capabilities),
    integrations: makeDataQueryContextIntegrations(summary?.integrations),
  }
}

export function describeDataQueryContextSummarySchema() {
  return cloneValue({
    type: 'object',
    required: ['methods', 'capabilities', 'integrations'],
    properties: {
      methods: {
        type: 'array',
        items: { type: 'string' },
      },
      capabilities: {
        type: 'object',
        properties: {
          workspaceRead: { type: 'boolean' },
          runtimeDataRead: { type: 'boolean' },
          widgetTargetResolution: { type: 'boolean' },
          dataHandleResolution: { type: 'boolean' },
          selectionTargetResolution: { type: 'boolean' },
          explicitTargetValidation: { type: 'boolean' },
          selectionScopedQueries: { type: 'boolean' },
          traceRecording: { type: 'boolean' },
        },
      },
      integrations: {
        type: 'object',
        properties: {
          store: { type: 'boolean' },
          traceRecorder: { type: 'boolean' },
        },
      },
    },
  })
}
