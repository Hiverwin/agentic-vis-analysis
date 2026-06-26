import test from 'node:test'
import assert from 'node:assert/strict'

import { buildAnalysisProvenanceSummary } from './provenanceSummary.js'

test('buildAnalysisProvenanceSummary merges selected trace step and branch narrative', () => {
  const summary = buildAnalysisProvenanceSummary({
    selectedTraceStep: {
      id: 'a1',
      actor: 'agent',
      kindLabel: 'Action',
      widgetTitle: 'Scatter',
      summary: 'Verify alternate region',
      branchId: 'trace_branch_1',
      resultStateId: 'main:s3',
    },
    selectedSegment: {
      id: 'segment_3',
      label: '3-4',
      summary: 'Verify alternate region',
      stepCount: 2,
    },
    selectedPath: {
      id: 'path_trace_branch_1',
      label: 'Branch 1',
      shortSummary: '2 segments · 2 steps',
      segmentCount: 2,
      stepCount: 2,
    },
    currentSegment: {
      id: 'segment_3',
    },
    currentPath: {
      id: 'path_trace_branch_1',
    },
    activeReplayContext: {
      source: 'trace_step',
      branchId: 'trace_branch_1',
      stateId: 'main:s3',
    },
    branchNarrative: {
      branchLabel: 'Branch 1',
      description: 'Forked from step 1 · Initial aligned view',
      originStepNumber: 1,
      entryStepNumber: 3,
      entrySummary: 'Restore main:s1',
    },
  })

  assert.equal(summary.branchId, 'trace_branch_1')
  assert.equal(summary.branchLabel, 'Branch 1')
  assert.equal(summary.hasBranchNarrative, true)
  assert.equal(summary.forkDescription, 'Forked from step 1 · Initial aligned view')
  assert.equal(summary.entryStepLabel, 'Step 3 · Restore main:s1')
  assert.equal(summary.selectedSegmentId, 'segment_3')
  assert.equal(summary.selectedSegmentLabel, '3-4')
  assert.equal(summary.selectedSegmentStepCount, 2)
  assert.equal(summary.selectedPathId, 'path_trace_branch_1')
  assert.equal(summary.selectedPathLabel, 'Branch 1')
  assert.equal(summary.selectedPathSummary, '2 segments · 2 steps')
  assert.equal(summary.selectedPathSegmentCount, 2)
  assert.equal(summary.selectedPathStepCount, 2)
  assert.equal(summary.currentSegmentId, 'segment_3')
  assert.equal(summary.currentPathId, 'path_trace_branch_1')
})

test('buildAnalysisProvenanceSummary falls back gracefully on mainline steps', () => {
  const summary = buildAnalysisProvenanceSummary({
    selectedTraceStep: {
      id: 'h1',
      actor: 'human',
      kindLabel: 'Action',
      widgetTitle: 'Scatter',
      summary: 'Brush scatter',
      branchId: 'main',
      resultStateId: 'main:s2',
    },
    selectedSegment: {
      id: 'segment_1',
      label: '1',
      summary: 'Brush scatter',
      stepCount: 1,
    },
    selectedPath: {
      id: 'path_main',
      label: 'Main',
      shortSummary: '1 segment · 1 step',
      segmentCount: 1,
      stepCount: 1,
    },
    currentSegment: {
      id: 'segment_1',
    },
    currentPath: {
      id: 'path_main',
    },
    activeReplayContext: null,
    branchNarrative: null,
  })

  assert.equal(summary.branchId, 'main')
  assert.equal(summary.branchLabel, 'Main')
  assert.equal(summary.hasBranchNarrative, false)
  assert.equal(summary.entryStepLabel, null)
  assert.equal(summary.selectedSegmentLabel, '1')
  assert.equal(summary.selectedPathLabel, 'Main')
  assert.equal(summary.selectedPathSegmentCount, 1)
  assert.equal(summary.currentSegmentId, 'segment_1')
  assert.equal(summary.currentPathId, 'path_main')
})
