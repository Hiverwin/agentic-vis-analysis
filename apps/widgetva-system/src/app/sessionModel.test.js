import test from 'node:test'
import assert from 'node:assert/strict'

import { buildEvidenceEntry } from './sessionModel.js'

test('buildEvidenceEntry preserves provenance narrative snapshots', () => {
  const entry = buildEvidenceEntry({
    id: 'e1',
    title: 'Alternate branch finding',
    note: 'Saved from replayed branch.',
    widgetId: 'w_scatter_cars',
    provenance: 'manual_trace',
    traceStepId: 'a1',
    stateId: 'main:s3',
    branchId: 'trace_branch_1',
    branchNarrative: {
      branchLabel: 'Branch 1',
      forkDescription: 'Forked from step 1 · Initial aligned view',
      entryStepLabel: 'Step 3 · Restore main:s1',
      originStepId: 'h0',
      entryStepId: 'r1',
    },
  }, 0)

  assert.equal(entry.branchNarrative?.branchLabel, 'Branch 1')
  assert.equal(entry.branchNarrative?.forkDescription, 'Forked from step 1 · Initial aligned view')
  assert.equal(entry.branchNarrative?.entryStepLabel, 'Step 3 · Restore main:s1')
  assert.equal(entry.branchNarrative?.originStepId, 'h0')
  assert.equal(entry.branchNarrative?.entryStepId, 'r1')
})
