import test from 'node:test'
import assert from 'node:assert/strict'

import { groupFindingsByPath } from './evidenceGrouping.js'

test('groupFindingsByPath groups findings by path context first', () => {
  const groups = groupFindingsByPath([
    {
      id: 'f1',
      title: 'First',
      widgetId: 'w_scatter',
      pathContext: {
        pathId: 'path_main',
        pathLabel: 'Main',
        pathSummary: '1 segment · 2 steps',
      },
      branchId: 'main',
    },
    {
      id: 'f2',
      title: 'Second',
      widgetId: 'w_bar',
      pathContext: {
        pathId: 'path_main',
        pathLabel: 'Main',
        pathSummary: '1 segment · 2 steps',
      },
      branchId: 'main',
    },
    {
      id: 'f3',
      title: 'Third',
      pathContext: {
        pathId: 'path_trace_branch_1',
        pathLabel: 'Branch 1',
        pathSummary: '2 segments · 2 steps',
      },
      branchId: 'trace_branch_1',
    },
  ])

  assert.equal(groups.length, 2)
  assert.equal(groups[0]?.pathId, 'path_main')
  assert.equal(groups[0]?.label, 'Path Main')
  assert.equal(groups[0]?.summary, '1 segment · 2 steps')
  assert.equal(groups[0]?.comparisonSummary, '2 findings · 2 widgets')
  assert.deepEqual(groups[0]?.comparisonBadges, ['most findings'])
  assert.deepEqual(groups[0]?.entries.map((entry) => entry.id), ['f1', 'f2'])
  assert.equal(groups[1]?.label, 'Path Branch 1')
  assert.equal(groups[1]?.pathId, 'path_trace_branch_1')
  assert.equal(groups[1]?.comparisonSummary, '1 finding')
  assert.deepEqual(groups[1]?.comparisonBadges, [])
  assert.deepEqual(groups[1]?.entries.map((entry) => entry.id), ['f3'])
})

test('groupFindingsByPath falls back for unscoped findings', () => {
  const groups = groupFindingsByPath([
    {
      id: 'f1',
      title: 'Loose',
      branchId: 'main',
    },
  ])

  assert.equal(groups.length, 1)
  assert.equal(groups[0]?.pathId, null)
  assert.equal(groups[0]?.label, 'Main / Unscoped')
  assert.equal(groups[0]?.summary, '1 finding')
  assert.equal(groups[0]?.comparisonSummary, '1 finding')
})

test('groupFindingsByPath builds a compact comparison summary for trace-linked fork-aware findings', () => {
  const groups = groupFindingsByPath([
    {
      id: 'f1',
      title: 'Forked one',
      widgetId: 'w_scatter',
      traceStepId: 't1',
      branchNarrative: { branchLabel: 'Branch 1' },
      pathContext: {
        pathId: 'path_trace_branch_1',
        pathLabel: 'Branch 1',
        pathSummary: '2 segments · 2 steps',
      },
    },
    {
      id: 'f2',
      title: 'Forked two',
      widgetId: 'w_scatter',
      traceStepId: 't2',
      branchNarrative: { branchLabel: 'Branch 1' },
      pathContext: {
        pathId: 'path_trace_branch_1',
        pathLabel: 'Branch 1',
        pathSummary: '2 segments · 2 steps',
      },
    },
  ])

  assert.equal(groups.length, 1)
  assert.equal(groups[0]?.comparisonSummary, '2 findings · 2 trace-linked · 2 fork-aware')
  assert.deepEqual(groups[0]?.comparisonBadges, ['most findings', 'most fork-aware'])
})

test('groupFindingsByPath marks the most fork-aware path across groups', () => {
  const groups = groupFindingsByPath([
    {
      id: 'f1',
      title: 'Main',
      pathContext: {
        pathId: 'path_main',
        pathLabel: 'Main',
        pathSummary: '1 segment · 1 step',
      },
    },
    {
      id: 'f2',
      title: 'Fork one',
      branchNarrative: { branchLabel: 'Branch 1' },
      pathContext: {
        pathId: 'path_trace_branch_1',
        pathLabel: 'Branch 1',
        pathSummary: '2 segments · 2 steps',
      },
    },
    {
      id: 'f3',
      title: 'Fork two',
      branchNarrative: { branchLabel: 'Branch 1' },
      pathContext: {
        pathId: 'path_trace_branch_1',
        pathLabel: 'Branch 1',
        pathSummary: '2 segments · 2 steps',
      },
    },
  ])

  assert.deepEqual(groups[0]?.comparisonBadges, [])
  assert.deepEqual(groups[1]?.comparisonBadges, ['most findings', 'most fork-aware'])
})
