import test from 'node:test'
import assert from 'node:assert/strict'

import { buildTraceTimelineModel } from './traceViewModel.js'
import { deriveTraceFocus } from './traceFocus.js'
import { deriveTraceBranchNarrative } from './traceBranchNarrative.js'

test('deriveTraceBranchNarrative explains the active replay branch using origin and entry steps', () => {
  const traceModel = buildTraceTimelineModel([
    {
      id: 'h0',
      actor: 'human',
      kind: 'action',
      summary: 'Initial aligned view',
      widgetTitle: 'Scatter',
      resultStateId: 'main:s1',
      transitionType: 'continuation',
      branchId: 'main',
    },
    {
      id: 'h1',
      actor: 'human',
      kind: 'action',
      summary: 'Brush scatter',
      widgetTitle: 'Scatter',
      resultStateId: 'main:s2',
      transitionType: 'continuation',
      branchId: 'main',
    },
    {
      id: 'r1',
      actor: 'human',
      kind: 'replay',
      summary: 'Restore main:s1',
      widgetTitle: 'Workspace',
      sourceStateId: 'main:s2',
      resultStateId: 'main:s1',
      transitionType: 'branch',
      branchId: 'trace_branch_1',
      branchFromStateId: 'main:s1',
      stateDelta: { branch: true, viewport: true },
    },
    {
      id: 'a1',
      actor: 'agent',
      kind: 'action',
      summary: 'Verify alternate region',
      widgetTitle: 'Scatter',
      sourceStateId: 'main:s1',
      resultStateId: 'main:s3',
      transitionType: 'branch',
      branchId: 'trace_branch_1',
      branchFromStateId: 'main:s1',
      verificationSummary: 'Checked the alternate region.',
      stateDelta: { evidence: true, propagation: true },
    },
  ], { selectedStepId: 'a1' })

  const focus = deriveTraceFocus({
    traceModel,
    activeReplayContext: {
      branchId: 'trace_branch_1',
      source: 'trace_step',
    },
  })

  const narrative = deriveTraceBranchNarrative({
    traceModel,
    traceFocus: focus,
  })

  assert.equal(narrative.activeBranchId, 'trace_branch_1')
  assert.equal(narrative.branchLabel, 'Branch 1')
  assert.equal(narrative.originStepId, 'h0')
  assert.equal(narrative.entryStepId, 'r1')
  assert.equal(narrative.originSummary, 'Initial aligned view')
  assert.equal(narrative.entrySummary, 'Restore main:s1')
  assert.equal(narrative.description.includes('Forked from step 1'), true)
})

test('deriveTraceBranchNarrative returns null for mainline focus', () => {
  const traceModel = buildTraceTimelineModel([
    { id: 'h1', actor: 'human', kind: 'action', summary: 'Brush scatter', widgetTitle: 'Scatter', branchId: 'main' },
  ], { selectedStepId: 'h1' })
  const focus = deriveTraceFocus({ traceModel, activeReplayContext: null })
  const narrative = deriveTraceBranchNarrative({ traceModel, traceFocus: focus })

  assert.equal(narrative, null)
})
