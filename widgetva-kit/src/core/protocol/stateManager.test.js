import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeStateManagerSummarySchema,
  makeStateManagerCapabilities,
  makeStateManagerCounters,
  makeStateManagerSummary,
} from './stateManager.js'

test('describeStateManagerSummarySchema admits reserved ref names for scoped reads', () => {
  const schema = describeStateManagerSummarySchema()

  assert.equal(schema.properties?.reservedRefs?.type, 'array')
  assert.equal(schema.properties?.reservedRefs?.items?.type, 'string')
})

test('state-manager constructors normalize state-manager summary contracts', () => {
  const capabilities = makeStateManagerCapabilities({
    refScopedReads: true,
  })
  const counters = makeStateManagerCounters({
    generatedStateCount: 2,
    lastGeneratedStateId: 'main:s2',
  })
  const summary = makeStateManagerSummary({
    capabilities,
    reservedRefs: ['shared'],
    counters,
  })

  assert.equal(capabilities.stateIdGeneration, true)
  assert.equal(counters.generatedStateCount, 2)
  assert.equal(summary.counters.lastGeneratedStateId, 'main:s2')
  assert.deepEqual(summary.reservedRefs, ['shared'])
})
