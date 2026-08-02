import test from 'node:test'
import assert from 'node:assert/strict'

import { summarizeInteractionTraceRecord } from './summarizeInteractionTraceRecord.js'

test('summarizeInteractionTraceRecord normalizes query provenance fields', () => {
  const summary = summarizeInteractionTraceRecord({
    actor: 'human',
    eventKind: 'dataQuery',
    stateId: 'main:s1',
    parentStateId: 'main:s0',
    branchId: 'main',
    query: {
      query: {
        kind: 'summary',
      },
    },
    affectedRefs: ['wl://widgetva-app/workspace/main/data/current_selection'],
    notes: {
      userVisibleSummary: 'Summarized current selection.',
      rationale: 'Selection evidence was needed before the next action.',
      verification: 'Selected rows count matched the expected brush result.',
    },
  })

  assert.equal(summary.eventFamily, 'query')
  assert.equal(summary.querySurface, 'data')
  assert.equal(summary.displayName, 'data.summary')
  assert.equal(summary.actor, 'human')
  assert.equal(summary.outcome, 'success')
  assert.equal(summary.userVisibleSummary, 'Summarized current selection.')
  assert.equal(summary.rationale, 'Selection evidence was needed before the next action.')
  assert.equal(summary.verification, 'Selected rows count matched the expected brush result.')
})

test('summarizeInteractionTraceRecord preserves failure provenance and recovery hints', () => {
  const summary = summarizeInteractionTraceRecord({
    actor: 'agent',
    eventKind: 'action',
    action: {
      name: 'bar.filterCategories',
    },
    notes: {
      outcome: 'failure',
      errorCode: 'INVALID_TARGET',
      errorMessage: 'Target widget is not available.',
      details: {
        targetRef: 'wl://widgetva-app/workspace/main/widget/missing',
      },
      recoveryHints: [
        'Call describeWorkspace() to inspect valid widget refs.',
      ],
    },
  })

  assert.equal(summary.eventFamily, 'action')
  assert.equal(summary.displayName, 'bar.filterCategories')
  assert.equal(summary.outcome, 'failure')
  assert.equal(summary.errorCode, 'INVALID_TARGET')
  assert.equal(summary.errorMessage, 'Target widget is not available.')
  assert.deepEqual(summary.details, {
    targetRef: 'wl://widgetva-app/workspace/main/widget/missing',
  })
  assert.deepEqual(summary.recoveryHints, [
    'Call describeWorkspace() to inspect valid widget refs.',
  ])
})
