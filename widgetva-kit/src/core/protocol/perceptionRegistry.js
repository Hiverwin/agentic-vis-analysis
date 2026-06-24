function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function makePerceptionRegistryCounts(counts) {
  return {
    descriptorCount: 0,
    handlerEntryCount: 0,
    ...counts,
  }
}

export function describePerceptionRegistryCountsSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      descriptorCount: { type: 'integer' },
      handlerEntryCount: { type: 'integer' },
    },
  })
}

export function makePerceptionRegistryCapabilities(capabilities) {
  return {
    paramsValidation: true,
    returnsValidation: true,
    traceRecording: false,
    linkPropagationEvidence: false,
    ...capabilities,
  }
}

export function describePerceptionRegistryCapabilitiesSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      paramsValidation: { type: 'boolean' },
      returnsValidation: { type: 'boolean' },
      traceRecording: { type: 'boolean' },
      linkPropagationEvidence: { type: 'boolean' },
    },
  })
}

export function makePerceptionRegistryQueryEntry(entry) {
  return {
    name: '',
    category: null,
    targetRef: null,
    handlerVariantCount: 0,
    sideEffectFree: true,
    evidenceKinds: [],
    verificationTargets: [],
    supportedWidgetKinds: null,
    ...entry,
  }
}

export function describePerceptionRegistryQueryEntrySchema() {
  return cloneValue({
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
      category: { type: ['string', 'null'] },
      targetRef: { type: ['string', 'null'] },
      handlerVariantCount: { type: 'integer' },
      sideEffectFree: { type: 'boolean' },
      evidenceKinds: { type: 'array', items: { type: 'string' } },
      verificationTargets: { type: 'array', items: { type: 'string' } },
      supportedWidgetKinds: {
        anyOf: [
          { type: 'null' },
          { type: 'array', items: { type: 'string' } },
        ],
      },
    },
  })
}

export function makePerceptionRegistrySummary(summary) {
  return {
    queries: [],
    ...summary,
    counts: makePerceptionRegistryCounts(summary?.counts),
    capabilities: makePerceptionRegistryCapabilities(summary?.capabilities),
    queries: Array.isArray(summary?.queries)
      ? summary.queries.map((query) => makePerceptionRegistryQueryEntry(query))
      : [],
  }
}

export function describePerceptionRegistrySummarySchema() {
  return cloneValue({
    type: 'object',
    required: ['counts', 'capabilities', 'queries'],
    properties: {
      counts: describePerceptionRegistryCountsSchema(),
      capabilities: describePerceptionRegistryCapabilitiesSchema(),
      queries: {
        type: 'array',
        items: describePerceptionRegistryQueryEntrySchema(),
      },
    },
  })
}
