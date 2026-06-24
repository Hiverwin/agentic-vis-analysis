import test from 'node:test'
import assert from 'node:assert/strict'

import { buildTraceSegmentSummary } from './traceSegmentSummary.js'

test('buildTraceSegmentSummary produces compact cues for a mixed branch-entry evidence segment', () => {
  const summary = buildTraceSegmentSummary({
    dominantActor: 'mixed',
    branchEntry: true,
    hasHandoff: true,
    hasStateDelta: true,
    hasEvidence: true,
  })

  assert.equal(summary.actorToken.label, 'M')
  assert.deepEqual(summary.semanticTokens.map((token) => token.label), ['BR', 'HF', 'ST', 'EV'])
  assert.equal(summary.descriptor.includes('branch entry'), true)
  assert.equal(summary.descriptor.includes('handoff'), true)
  assert.equal(summary.descriptor.includes('state change'), true)
  assert.equal(summary.descriptor.includes('evidence'), true)
})

test('buildTraceSegmentSummary falls back to continuation for a simple human segment', () => {
  const summary = buildTraceSegmentSummary({
    dominantActor: 'human',
    branchEntry: false,
    hasHandoff: false,
    hasStateDelta: false,
    hasEvidence: false,
  })

  assert.equal(summary.actorToken.label, 'H')
  assert.deepEqual(summary.semanticTokens, [])
  assert.equal(summary.descriptor, 'continuation')
})
