function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function cloneArray(value) {
  return Array.isArray(value) ? [...value] : []
}

export function makeActionExecutorCounts(counts = {}) {
  return {
    descriptorCount: 0,
    handlerCount: 0,
    preconditionCount: 0,
    ...counts,
  }
}

export function describeActionExecutorCountsSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      descriptorCount: { type: 'integer' },
      handlerCount: { type: 'integer' },
      preconditionCount: { type: 'integer' },
    },
  })
}

export function makeActionExecutorCapabilities(capabilities = {}) {
  return {
    paramsValidation: false,
    preconditionValidation: false,
    stateSync: false,
    traceRecording: false,
    linkPropagation: false,
    ...capabilities,
  }
}

export function describeActionExecutorCapabilitiesSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      paramsValidation: { type: 'boolean' },
      preconditionValidation: { type: 'boolean' },
      stateSync: { type: 'boolean' },
      traceRecording: { type: 'boolean' },
      linkPropagation: { type: 'boolean' },
    },
  })
}

export function makeActionExecutorActionEntry(action = {}) {
  return {
    name: action?.name || '',
    primitive: action?.primitive ?? null,
    category: action?.category ?? null,
    targetRef: action?.targetRef ?? null,
    affectedRefs: cloneArray(action?.affectedRefs),
    affectedStatePaths: cloneArray(action?.affectedStatePaths),
    supportedWidgetKinds: Array.isArray(action?.supportedWidgetKinds)
      ? [...action.supportedWidgetKinds]
      : null,
    hasPreconditions: action?.hasPreconditions === true,
    preconditionDescriptorCount: action?.preconditionDescriptorCount || 0,
    preconditionHandlerRegistered: action?.preconditionHandlerRegistered === true,
    postconditionCount: action?.postconditionCount || 0,
    reversible: action?.reversible === true,
    effectCount: action?.effectCount || 0,
    effectKinds: cloneArray(action?.effectKinds),
  }
}

export function describeActionExecutorActionEntrySchema() {
  return cloneValue({
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
      primitive: { type: ['string', 'null'] },
      category: { type: ['string', 'null'] },
      targetRef: { type: ['string', 'null'] },
      affectedRefs: { type: 'array', items: { type: 'string' } },
      affectedStatePaths: { type: 'array', items: { type: 'string' } },
      supportedWidgetKinds: {
        anyOf: [
          { type: 'null' },
          { type: 'array', items: { type: 'string' } },
        ],
      },
      hasPreconditions: { type: 'boolean' },
      preconditionDescriptorCount: { type: 'integer' },
      preconditionHandlerRegistered: { type: 'boolean' },
      postconditionCount: { type: 'integer' },
      reversible: { type: 'boolean' },
      effectCount: { type: 'integer' },
      effectKinds: { type: 'array', items: { type: 'string' } },
    },
  })
}

export function makeActionExecutorSummary(summary = {}) {
  return {
    counts: makeActionExecutorCounts(summary?.counts),
    capabilities: makeActionExecutorCapabilities(summary?.capabilities),
    actions: Array.isArray(summary?.actions)
      ? summary.actions.map((action) => makeActionExecutorActionEntry(action))
      : [],
  }
}

export function describeActionExecutorSummarySchema() {
  return cloneValue({
    type: 'object',
    required: ['counts', 'capabilities', 'actions'],
    properties: {
      counts: describeActionExecutorCountsSchema(),
      capabilities: describeActionExecutorCapabilitiesSchema(),
      actions: {
        type: 'array',
        items: describeActionExecutorActionEntrySchema(),
      },
    },
  })
}
