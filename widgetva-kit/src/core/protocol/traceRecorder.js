function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function makeTraceRecorderCapabilities(capabilities) {
  return {
    recordsActions: true,
    recordsPerceptionQueries: true,
    recordsPerceptionQueryFailures: true,
    recordsDataQueries: true,
    recordsDataQueryFailures: true,
    normalizedQueryFamily: true,
    recordsSystemTransitions: true,
    lineageTracking: true,
    ...capabilities,
  }
}

export function describeTraceRecorderCapabilitiesSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      recordsActions: { type: 'boolean' },
      recordsPerceptionQueries: { type: 'boolean' },
      recordsPerceptionQueryFailures: { type: 'boolean' },
      recordsDataQueries: { type: 'boolean' },
      recordsDataQueryFailures: { type: 'boolean' },
      normalizedQueryFamily: { type: 'boolean' },
      recordsSystemTransitions: { type: 'boolean' },
      lineageTracking: { type: 'boolean' },
    },
  })
}

export function makeTraceRecorderCounters(counters) {
  return {
    traceCount: 0,
    latestStateId: null,
    latestBranchId: null,
    latestEventKind: null,
    latestEventFamily: null,
    latestQuerySurface: null,
    latestOutcome: null,
    ...counters,
  }
}

export function describeTraceRecorderCountersSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      traceCount: { type: 'integer' },
      latestStateId: { type: ['string', 'null'] },
      latestBranchId: { type: ['string', 'null'] },
      latestEventKind: { type: ['string', 'null'] },
      latestEventFamily: { type: ['string', 'null'] },
      latestQuerySurface: { type: ['string', 'null'] },
      latestOutcome: { type: ['string', 'null'] },
    },
  })
}

export function makeTraceRecorderSummary(summary) {
  return {
    eventKinds: [],
    eventFamilies: [],
    querySurfaces: [],
    ...summary,
    capabilities: makeTraceRecorderCapabilities(summary?.capabilities),
    counters: makeTraceRecorderCounters(summary?.counters),
  }
}

export function describeTraceRecorderEventKindsSchema() {
  return cloneValue({
    type: 'array',
    items: { type: 'string' },
  })
}

export function describeTraceRecorderEventFamiliesSchema() {
  return cloneValue({
    type: 'array',
    items: { type: 'string' },
  })
}

export function describeTraceRecorderQuerySurfacesSchema() {
  return cloneValue({
    type: 'array',
    items: { type: 'string' },
  })
}

export function describeTraceRecorderSummarySchema() {
  return cloneValue({
    type: 'object',
    required: ['capabilities', 'counters'],
    properties: {
      capabilities: describeTraceRecorderCapabilitiesSchema(),
      counters: describeTraceRecorderCountersSchema(),
      eventKinds: describeTraceRecorderEventKindsSchema(),
      eventFamilies: describeTraceRecorderEventFamiliesSchema(),
      querySurfaces: describeTraceRecorderQuerySurfacesSchema(),
    },
  })
}
