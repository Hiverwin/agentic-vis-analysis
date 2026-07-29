import test from 'node:test'
import assert from 'node:assert/strict'

import { deriveTraceFocus } from './traceFocus.js'

test('deriveTraceFocus prefers active replay branch over latest chronological branch', () => {
  const focus = deriveTraceFocus({
    traceModel: {
      mainBranchId: 'main',
      selection: {
        currentBranchId: 'main',
        selectedStepId: 't2',
      },
    },
    activeReplayContext: {
      branchId: 'trace_branch_1',
      source: 'trace_step',
    },
  })

  assert.equal(focus.activeBranchId, 'trace_branch_1')
  assert.equal(focus.hasBranchFocus, true)
  assert.equal(focus.source, 'replay')
})

test('deriveTraceFocus falls back to the model current branch when no replay anchor exists', () => {
  const focus = deriveTraceFocus({
    traceModel: {
      mainBranchId: 'main',
      selection: {
        currentBranchId: 'trace_branch_2',
        selectedStepId: 't4',
      },
    },
    activeReplayContext: null,
  })

  assert.equal(focus.activeBranchId, 'trace_branch_2')
  assert.equal(focus.hasBranchFocus, true)
  assert.equal(focus.source, 'timeline')
})

test('deriveTraceFocus keeps the main branch unforced when neither replay nor branch divergence is active', () => {
  const focus = deriveTraceFocus({
    traceModel: {
      mainBranchId: 'main',
      selection: {
        currentBranchId: 'main',
        selectedStepId: null,
      },
    },
    activeReplayContext: null,
  })

  assert.equal(focus.activeBranchId, 'main')
  assert.equal(focus.hasBranchFocus, false)
  assert.equal(focus.source, 'timeline')
})
