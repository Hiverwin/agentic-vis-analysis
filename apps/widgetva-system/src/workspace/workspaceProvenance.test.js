import test from 'node:test'
import assert from 'node:assert/strict'

import { deriveWorkspaceProvenance } from './workspaceProvenance.js'

test('deriveWorkspaceProvenance merges selected trace and replay anchor into a workspace-friendly summary', () => {
  const summary = deriveWorkspaceProvenance({
    selectedWidgetId: 'w_bar_origin',
    selectedTraceStep: {
      id: 't2',
      branchId: 'trace_branch_1',
      transitionType: 'branch',
      widgetId: 'w_bar_origin',
      widgetTitle: 'Average Horsepower by Origin',
      summary: 'Selected origin: USA',
    },
    activeReplayContext: {
      source: 'trace_step',
      selectedTraceStepId: 't2',
      branchId: 'trace_branch_1',
      restoredWidgetId: 'w_bar_origin',
      summary: 'Selected origin: USA',
    },
  })

  assert.equal(summary.activeBranchId, 'trace_branch_1')
  assert.equal(summary.branchLabel, 'Branch')
  assert.equal(summary.hasReplayAnchor, true)
  assert.equal(summary.focusedReplayWidgetId, 'w_bar_origin')
  assert.equal(summary.shouldAccentSelectedWidget, true)
  assert.equal(summary.replaySummary, 'Selected origin: USA')
})

test('deriveWorkspaceProvenance falls back to mainline semantics without replay anchor', () => {
  const summary = deriveWorkspaceProvenance({
    selectedWidgetId: 'w_scatter_cars',
    selectedTraceStep: null,
    activeReplayContext: null,
  })

  assert.equal(summary.activeBranchId, 'main')
  assert.equal(summary.branchLabel, 'Main')
  assert.equal(summary.hasReplayAnchor, false)
  assert.equal(summary.focusedReplayWidgetId, null)
  assert.equal(summary.shouldAccentSelectedWidget, false)
})
