import { describeDataQueryDescriptorSchema } from './dataHandles.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function makeDataQueryExecutorEngineSummary(summary) {
  return {
    kind: null,
    className: null,
    ...summary,
  }
}

export function describeDataQueryExecutorEngineSummarySchema() {
  return cloneValue({
    type: 'object',
    properties: {
      kind: { type: ['string', 'null'] },
      className: { type: ['string', 'null'] },
    },
  })
}

export function makeDataQueryExecutorCounts(counts) {
  return {
    supportedQueryKindCount: 0,
    supportedQueryDescriptorCount: 0,
    ...counts,
  }
}

export function describeDataQueryExecutorCountsSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      supportedQueryKindCount: { type: 'integer' },
      supportedQueryDescriptorCount: { type: 'integer' },
    },
  })
}

export function makeDataQueryExecutorCapabilities(capabilities) {
  return {
    schemaValidation: true,
    returnsValidation: true,
    traceRecording: false,
    runtimeDataReads: false,
    ...capabilities,
  }
}

export function describeDataQueryExecutorCapabilitiesSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      schemaValidation: { type: 'boolean' },
      returnsValidation: { type: 'boolean' },
      traceRecording: { type: 'boolean' },
      runtimeDataReads: { type: 'boolean' },
    },
  })
}

export function makeDataQueryExecutorSummary(summary) {
  return {
    supportedQueryKinds: [],
    supportedQueryDescriptors: [],
    ...summary,
    engine: makeDataQueryExecutorEngineSummary(summary?.engine),
    counts: makeDataQueryExecutorCounts(summary?.counts),
    capabilities: makeDataQueryExecutorCapabilities(summary?.capabilities),
  }
}

export function describeDataQueryExecutorSummarySchema() {
  return cloneValue({
    type: 'object',
    required: ['engine', 'counts', 'capabilities', 'supportedQueryKinds', 'supportedQueryDescriptors'],
    properties: {
      engine: describeDataQueryExecutorEngineSummarySchema(),
      counts: describeDataQueryExecutorCountsSchema(),
      capabilities: describeDataQueryExecutorCapabilitiesSchema(),
      supportedQueryKinds: { type: 'array', items: { type: 'string' } },
      supportedQueryDescriptors: { type: 'array', items: describeDataQueryDescriptorSchema() },
    },
  })
}
