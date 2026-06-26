function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function makeStateManagerCapabilities(capabilities) {
  return {
    stateIdGeneration: true,
    deltaCreation: true,
    statePatchCreation: true,
    refScopedReads: true,
    ...capabilities,
  }
}

export function describeStateManagerCapabilitiesSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      stateIdGeneration: { type: 'boolean' },
      deltaCreation: { type: 'boolean' },
      statePatchCreation: { type: 'boolean' },
      refScopedReads: { type: 'boolean' },
    },
  })
}

export function makeStateManagerCounters(counters) {
  return {
    generatedStateCount: 0,
    lastGeneratedStateId: null,
    ...counters,
  }
}

export function describeStateManagerCountersSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      generatedStateCount: { type: 'integer' },
      lastGeneratedStateId: { type: ['string', 'null'] },
    },
  })
}

export function makeStateManagerSummary(summary) {
  return {
    capabilities: makeStateManagerCapabilities(),
    reservedRefs: [],
    counters: makeStateManagerCounters(),
    ...summary,
  }
}

export function describeStateManagerSummarySchema() {
  return cloneValue({
    type: 'object',
    required: ['capabilities', 'counters'],
    properties: {
      capabilities: describeStateManagerCapabilitiesSchema(),
      reservedRefs: {
        type: 'array',
        items: { type: 'string' },
      },
      counters: describeStateManagerCountersSchema(),
    },
  })
}
