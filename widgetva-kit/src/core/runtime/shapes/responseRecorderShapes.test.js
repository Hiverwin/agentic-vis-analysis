import test from 'node:test'
import assert from 'node:assert/strict'

import {
  makeAgentResponseRecord,
  makeResponseRecorderSummary,
} from './responseRecorderShapes.js'

test('response recorder shapes normalize response records and recorder summaries', () => {
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
  const summary = makeResponseRecorderSummary({
    capabilities: {
      latestResponseRead: false,
    },
    counters: {
      responseCount: 2,
    },
  })

  assert.equal(record.actor, 'agent')
  assert.equal(record.usage?.promptTokens, 120)
  assert.equal(record.usage?.tokenCost, 0.32)
  assert.equal(typeof record.createdAt, 'string')
  assert.equal(summary.capabilities.recordsFinalResponses, true)
  assert.equal(summary.capabilities.latestResponseRead, false)
  assert.equal(summary.counters.responseCount, 2)
  assert.equal(summary.counters.latestEvidenceRefCount, 0)
})
