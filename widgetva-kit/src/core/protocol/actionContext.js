function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function makeActionContextCapabilities(capabilities = {}) {
  return {
    workspaceRead: false,
    workspaceWrite: false,
    specMutation: false,
    snapshotReplay: false,
    runtimeDataRead: false,
    runtimeDataWrite: false,
    widgetTargetResolution: false,
    selectionMutation: false,
    annotationMutation: false,
    linkPropagation: false,
    ...capabilities,
  }
}

export function makeActionContextIntegrations(integrations = {}) {
  return {
    store: false,
    appState: false,
    linkEngine: false,
    traceRecorder: false,
    ...integrations,
  }
}

export function makeActionContextSummary(summary = {}) {
  return {
    methods: Array.isArray(summary?.methods) ? [...summary.methods] : [],
    capabilities: makeActionContextCapabilities(summary?.capabilities),
    integrations: makeActionContextIntegrations(summary?.integrations),
  }
}

export function describeActionContextSummarySchema() {
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
          workspaceWrite: { type: 'boolean' },
          specMutation: { type: 'boolean' },
          snapshotReplay: { type: 'boolean' },
          runtimeDataRead: { type: 'boolean' },
          runtimeDataWrite: { type: 'boolean' },
          widgetTargetResolution: { type: 'boolean' },
          selectionMutation: { type: 'boolean' },
          annotationMutation: { type: 'boolean' },
          linkPropagation: { type: 'boolean' },
        },
      },
      integrations: {
        type: 'object',
        properties: {
          store: { type: 'boolean' },
          appState: { type: 'boolean' },
          linkEngine: { type: 'boolean' },
          traceRecorder: { type: 'boolean' },
        },
      },
    },
  })
}
