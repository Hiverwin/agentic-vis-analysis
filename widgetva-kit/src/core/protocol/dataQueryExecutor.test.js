import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeDataQueryExecutorSummarySchema,
  makeDataQueryExecutorCapabilities,
  makeDataQueryExecutorCounts,
  makeDataQueryExecutorEngineSummary,
  makeDataQueryExecutorSummary,
} from './dataQueryExecutor.js'

test('describeDataQueryExecutorSummarySchema admits structured supported query descriptors', () => {
  const schema = describeDataQueryExecutorSummarySchema()
  const counts = schema.properties?.counts?.properties || {}
  const capabilities = schema.properties?.capabilities?.properties || {}
  const descriptors = schema.properties?.supportedQueryDescriptors?.items

  assert.equal(counts.supportedQueryKindCount?.type, 'integer')
  assert.equal(counts.supportedQueryDescriptorCount?.type, 'integer')
  assert.equal(capabilities.returnsValidation?.type, 'boolean')
  assert.equal(descriptors?.properties?.name?.type, 'string')
  assert.equal(descriptors?.properties?.title?.type, 'string')
  assert.equal(descriptors?.properties?.resultKind?.type, 'string')
})

test('data-query-executor constructors normalize executor summary contracts', () => {
  const engine = makeDataQueryExecutorEngineSummary({
    kind: 'runtime-test',
  })
  const counts = makeDataQueryExecutorCounts({
    supportedQueryKindCount: 2,
  })
  const capabilities = makeDataQueryExecutorCapabilities({
    returnsValidation: true,
  })
  const summary = makeDataQueryExecutorSummary({
    engine,
    counts,
    capabilities,
    supportedQueryKinds: ['summary'],
  })

  assert.equal(engine.kind, 'runtime-test')
  assert.equal(counts.supportedQueryKindCount, 2)
  assert.equal(capabilities.returnsValidation, true)
  assert.deepEqual(summary.supportedQueryDescriptors, [])
})

test('makeDataQueryExecutorSummary normalizes nested summary defaults', () => {
  const summary = makeDataQueryExecutorSummary({
    engine: {
      kind: 'runtime-test',
    },
    counts: {
      supportedQueryKindCount: 2,
    },
    capabilities: {
      returnsValidation: false,
    },
  })

  assert.equal(summary.engine.kind, 'runtime-test')
  assert.equal(summary.engine.className, null)
  assert.equal(summary.counts.supportedQueryKindCount, 2)
  assert.equal(summary.counts.supportedQueryDescriptorCount, 0)
  assert.equal(summary.capabilities.returnsValidation, false)
  assert.equal(summary.capabilities.runtimeDataReads, false)
})
