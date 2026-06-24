import test from 'node:test'
import assert from 'node:assert/strict'

import { summarizeWorkspaceState } from './summarizeWorkspaceState.js'

test('summarizeWorkspaceState returns focused-widget and shared-state counters', () => {
  const summary = summarizeWorkspaceState({
    stateId: 'main:s4',
    widgets: {
      'wl://widgetva-app/workspace/main/widget/scatter_a': {
        ref: 'wl://widgetva-app/workspace/main/widget/scatter_a',
        kind: 'scatter',
        data: {
          rowCount: 12,
          visibleCount: 8,
          selectedCount: 3,
        },
      },
    },
    shared: {
      focusedWidget: 'wl://widgetva-app/workspace/main/widget/scatter_a',
      selections: {
        registry: {
          'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush': {
            summary: 'Origin: USA',
            predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
          },
        },
        views: {
          primary: null,
          byWidget: {},
        },
      },
      annotations: [{ annotationId: 'a1', text: 'note' }],
      globalFilters: {
        'wl://widgetva-app/workspace/main/widget/scatter_a': [{ field: 'Origin', op: 'equals', value: 'USA' }],
      },
    },
    taskContext: {
      taskMode: 'benchmark',
      coordinationScope: 'workspace',
      evidenceType: 'aggregate',
    },
    replayContext: {
      runMode: 'autonomous',
      userIntent: 'compare cohorts',
    },
    delta: {
      changedRefs: ['shared', 'taskContext', 'replayContext'],
      removedRefs: [],
    },
  })

  assert.equal(summary.focusedWidgetKind, 'scatter')
  assert.equal(summary.visibleCount, 8)
  assert.equal(summary.selectedCount, 3)
  assert.equal(summary.selectionCount, 1)
  assert.equal(summary.annotationCount, 1)
  assert.equal(summary.globalFilterCount, 1)
  assert.equal(summary.primarySelectionSummary, 'Origin: USA')
  assert.equal(summary.taskMode, 'benchmark')
  assert.equal(summary.replayRunMode, 'autonomous')
  assert.equal(summary.replayUserIntent, 'compare cohorts')
  assert.equal(summary.sharedChanged, true)
  assert.equal(summary.taskContextChanged, true)
  assert.equal(summary.replayContextChanged, true)
})

test('summarizeWorkspaceState prefers the primary selection view over registry insertion order', () => {
  const firstSelectionRef = 'wl://widgetva-app/workspace/main/widget/bar_a/selection/first'
  const secondSelectionRef = 'wl://widgetva-app/workspace/main/widget/line_b/selection/second'
  const summary = summarizeWorkspaceState({
    stateId: 'main:s5',
    widgets: {
      'wl://widgetva-app/workspace/main/widget/bar_a': {
        ref: 'wl://widgetva-app/workspace/main/widget/bar_a',
        kind: 'bar',
        data: { rowCount: 10 },
      },
    },
    shared: {
      selections: {
        registry: {
          [firstSelectionRef]: {
            summary: 'First selection',
            predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
          },
          [secondSelectionRef]: {
            summary: 'Second selection',
            predicates: [{ field: 'Year', op: '>=', value: 1975 }],
          },
        },
        views: {
          primary: {
            selectionRef: secondSelectionRef,
            summary: 'Second selection',
            predicates: [{ field: 'Year', op: '>=', value: 1975 }],
          },
          byWidget: {},
        },
      },
    },
  })

  assert.deepEqual(summary.activeSelectionRefs, [firstSelectionRef, secondSelectionRef])
  assert.equal(summary.primarySelectionRef, secondSelectionRef)
  assert.equal(summary.primarySelectionSummary, 'Second selection')
  assert.deepEqual(summary.primarySelectionPredicates, [{ field: 'Year', op: '>=', value: 1975 }])
})

test('summarizeWorkspaceState reuses runtime-store current-state defaults for sparse states', () => {
  const summary = summarizeWorkspaceState({
    stateId: 'main:s0',
    widgets: {},
    shared: {},
  })

  assert.deepEqual(summary.activeSelectionRefs, [])
  assert.equal(summary.primarySelectionSummary, '')
  assert.equal(summary.replayUserIntent, '')
  assert.equal(summary.sharedChanged, false)
  assert.equal(summary.taskContextChanged, false)
  assert.equal(summary.replayContextChanged, false)
})
