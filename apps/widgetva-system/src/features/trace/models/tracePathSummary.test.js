import test from 'node:test'
import assert from 'node:assert/strict'

import { buildTracePathSummary } from './tracePathSummary.js'

test('buildTracePathSummary produces compact path-level tokens', () => {
  const summary = buildTracePathSummary({
    dominantActor: 'mixed',
    hasBranchEntry: true,
    hasHandoff: true,
    hasStateDelta: true,
    hasEvidence: true,
    shortSummary: '2 segments · 4 steps',
  })

  assert.deepEqual(summary.tokens.map((token) => token.label), ['M', 'BR', 'HF', 'ST', 'EV'])
  assert.equal(summary.descriptor, '2 segments · 4 steps')
})
