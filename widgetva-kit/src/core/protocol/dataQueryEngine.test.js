import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeDataQueryEngineSummarySchema,
  makeDataQueryEngineCapabilities,
  makeDataQueryEngineCounts,
  makeDataQueryEngineEngineSummary,
  makeDataQueryEngineSummary,
} from './dataQueryEngine.js'

test('describeDataQueryEngineSummarySchema admits structured supported query descriptors', () => {
  const schema = describeDataQueryEngineSummarySchema()
  const counts = schema.properties?.counts?.properties || {}
  const descriptors = schema.properties?.supportedQueryDescriptors?.items

  assert.equal(counts.supportedQueryKindCount?.type, 'integer')
  assert.equal(counts.supportedQueryDescriptorCount?.type, 'integer')
  assert.equal(descriptors?.properties?.name?.type, 'string')
  assert.equal(descriptors?.properties?.title?.type, 'string')
  assert.equal(descriptors?.properties?.resultKind?.type, 'string')
})

test('data-query-engine constructors normalize runtime engine summary contracts', () => {
  const engine = makeDataQueryEngineEngineSummary({
    kind: 'js_array',
  })
  const counts = makeDataQueryEngineCounts({
    supportedQueryKindCount: 6,
  })
  const capabilities = makeDataQueryEngineCapabilities({
    localExecution: true,
  })
  const summary = makeDataQueryEngineSummary({
    engine,
    counts,
    supportedQueryKinds: ['schema', 'summary'],
    supportedQueryDescriptors: [{ name: 'schema', title: 'Inspect data schema' }],
    capabilities,
  })

  assert.deepEqual(summary, {
    engine: {
      kind: 'js_array',
      className: null,
    },
    counts: {
      supportedQueryKindCount: 6,
      supportedQueryDescriptorCount: 0,
    },
    supportedQueryKinds: ['schema', 'summary'],
    supportedQueryDescriptors: [{ name: 'schema', title: 'Inspect data schema' }],
    capabilities: {
      localExecution: true,
      remoteExecution: false,
      sqlSupport: false,
      fallbackEngine: false,
    },
  })
})
