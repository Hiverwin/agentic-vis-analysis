function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function makePerceptionContextCapabilities(capabilities = {}) {
  return {
    workspaceRead: false,
    runtimeDataRead: false,
    widgetTargetResolution: false,
    dataHandleResolution: false,
    selectionScopedQueries: false,
    traceRecording: false,
    ...capabilities,
  }
}

export function makePerceptionContextIntegrations(integrations = {}) {
  return {
    store: false,
    traceRecorder: false,
    ...integrations,
  }
}

export function makePerceptionContextSummary(summary = {}) {
  return {
    methods: Array.isArray(summary?.methods) ? [...summary.methods] : [],
    capabilities: makePerceptionContextCapabilities(summary?.capabilities),
    integrations: makePerceptionContextIntegrations(summary?.integrations),
  }
}

export function describePerceptionContextSummarySchema() {
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
