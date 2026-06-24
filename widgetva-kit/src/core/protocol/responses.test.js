import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeResponseRecorderSummarySchema,
  makeAgentResponseRecord,
  makeResponseRecorderCapabilities,
  makeResponseRecorderCounters,
  makeResponseRecorderSummary,
} from './responses.js'

test('makeAgentResponseRecord defaults response lineage fields for runtime assembly', () => {
  const record = makeAgentResponseRecord({
    responseId: 'response_1',
    content: 'Selected points are concentrated in the high-horsepower range.',
  })

  assert.equal(record.responseId, 'response_1')
  assert.equal(record.actor, 'agent')
  assert.equal(record.content, 'Selected points are concentrated in the high-horsepower range.')
  assert.equal(record.runId, null)
  assert.equal(record.workspaceId, null)
  assert.deepEqual(record.evidenceRefs, [])
  assert.equal(record.usage?.tokenCost, null)
  assert.equal(typeof record.createdAt, 'string')
})

test('makeAgentResponseRecord preserves optional usage metadata for token-cost evaluation', () => {
  const record = makeAgentResponseRecord({
    responseId: 'response_usage',
    content: 'Answer with tracked usage.',
    usage: {
      promptTokens: 120,
      completionTokens: 40,
      totalTokens: 160,
      tokenCost: 0.32,
      tokenCostUnit: 'usd',
    },
  })

  assert.equal(record.usage?.promptTokens, 120)
  assert.equal(record.usage?.completionTokens, 40)
  assert.equal(record.usage?.totalTokens, 160)
  assert.equal(record.usage?.tokenCost, 0.32)
  assert.equal(record.usage?.tokenCostUnit, 'usd')
})

test('describeResponseRecorderSummarySchema admits latest response provenance counters', () => {
  const schema = describeResponseRecorderSummarySchema()
  const capabilities = schema.properties?.capabilities?.properties || {}
  const counters = schema.properties?.counters?.properties || {}

  assert.equal(capabilities.latestResponseRead?.type, 'boolean')
  assert.equal(capabilities.responseHistoryRead?.type, 'boolean')
  assert.equal(counters.workspaceId?.type?.[0], 'string')
  assert.equal(counters.workspaceId?.type?.[1], 'null')
  assert.equal(counters.latestActor?.anyOf?.[0]?.type, 'string')
  assert.equal(counters.latestMode?.type?.[0], 'string')
  assert.equal(counters.latestQuery?.type?.[0], 'string')
  assert.equal(counters.latestEvidenceRefCount?.type, 'integer')
})

test('response-recorder constructors normalize recorder summary contracts', () => {
  const capabilities = makeResponseRecorderCapabilities({
    latestResponseRead: true,
  })
  const counters = makeResponseRecorderCounters({
    workspaceId: 'main',
    responseCount: 2,
    latestResponseId: 'response_2',
  })
  const summary = makeResponseRecorderSummary({
    capabilities,
    counters,
  })

  assert.equal(capabilities.recordsFinalResponses, true)
  assert.equal(counters.workspaceId, 'main')
  assert.equal(counters.latestResponseId, 'response_2')
  assert.equal(summary.capabilities.latestResponseRead, true)
  assert.equal(summary.counters.responseCount, 2)
})

test('makeResponseRecorderSummary normalizes nested capability and counter defaults', () => {
  const summary = makeResponseRecorderSummary({
    capabilities: {
      latestResponseRead: false,
    },
    counters: {
      responseCount: 2,
    },
  })

  assert.equal(summary.capabilities.recordsFinalResponses, true)
  assert.equal(summary.capabilities.latestResponseRead, false)
  assert.equal(summary.capabilities.workspaceScopedReads, true)
  assert.equal(summary.counters.responseCount, 2)
  assert.equal(summary.counters.latestResponseId, null)
})
