import { describeDataQueryDescriptorSchema } from './dataHandles.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function makeDataQueryEngineEngineSummary(summary = {}) {
  return {
    kind: summary?.kind ?? null,
    className: summary?.className ?? null,
  }
}

export function describeDataQueryEngineCountsSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      supportedQueryKindCount: { type: 'integer' },
      supportedQueryDescriptorCount: { type: 'integer' },
    },
  })
}

export function makeDataQueryEngineCounts(counts = {}) {
  return {
    supportedQueryKindCount: 0,
    supportedQueryDescriptorCount: 0,
    ...counts,
  }
}

export function makeDataQueryEngineCapabilities(capabilities = {}) {
  return {
    localExecution: false,
    remoteExecution: false,
    sqlSupport: false,
    fallbackEngine: false,
    ...capabilities,
  }
}

export function makeDataQueryEngineSummary(summary = {}) {
  return {
    engine: makeDataQueryEngineEngineSummary(summary?.engine),
    counts: makeDataQueryEngineCounts(summary?.counts),
    supportedQueryKinds: Array.isArray(summary?.supportedQueryKinds)
      ? [...summary.supportedQueryKinds]
      : [],
    supportedQueryDescriptors: Array.isArray(summary?.supportedQueryDescriptors)
      ? [...summary.supportedQueryDescriptors]
      : [],
    capabilities: makeDataQueryEngineCapabilities(summary?.capabilities),
  }
}

export function describeDataQueryEngineSummarySchema() {
  return cloneValue({
    type: 'object',
    required: ['engine', 'counts', 'supportedQueryKinds', 'supportedQueryDescriptors', 'capabilities'],
    properties: {
      engine: {
        type: 'object',
        properties: {
          kind: { type: ['string', 'null'] },
          className: { type: ['string', 'null'] },
        },
      },
      counts: describeDataQueryEngineCountsSchema(),
      supportedQueryKinds: {
        type: 'array',
        items: { type: 'string' },
      },
      supportedQueryDescriptors: {
        type: 'array',
        items: describeDataQueryDescriptorSchema(),
      },
      capabilities: {
        type: 'object',
        properties: {
          localExecution: { type: 'boolean' },
          remoteExecution: { type: 'boolean' },
          sqlSupport: { type: 'boolean' },
          fallbackEngine: { type: 'boolean' },
        },
      },
    },
  })
}
