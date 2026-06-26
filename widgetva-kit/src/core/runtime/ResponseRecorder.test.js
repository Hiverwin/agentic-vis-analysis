import test from 'node:test'
import assert from 'node:assert/strict'

import { ResponseRecorder } from './ResponseRecorder.js'

test('ResponseRecorder.describeRecorder exposes latest response provenance counters', () => {
  const recorder = new ResponseRecorder({
    store: {
      workspaceId: 'main',
      responseHistory: [
        {
          responseId: 'response_1',
          runId: 'run_1',
          actor: 'agent',
          mode: 'final',
          query: 'Summarize the outlier cluster.',
          stateId: 'main:s3',
          branchId: 'branch_a',
          evidenceRefs: ['wl://widgetva-app/workspace/main/data/current_selection'],
        },
      ],
      readState() {
        return { stateId: 'main:s3' }
      },
      readLatestResponse() {
        return this.responseHistory[this.responseHistory.length - 1]
      },
    },
  })

  const summary = recorder.describeRecorder()

  assert.equal(summary.counters.workspaceId, 'main')
  assert.equal(summary.capabilities.latestResponseRead, true)
  assert.equal(summary.capabilities.responseHistoryRead, true)
  assert.equal(summary.counters.latestResponseId, 'response_1')
  assert.equal(summary.counters.latestRunId, 'run_1')
  assert.equal(summary.counters.latestStateId, 'main:s3')
  assert.equal(summary.counters.latestBranchId, 'branch_a')
  assert.equal(summary.counters.latestActor, 'agent')
  assert.equal(summary.counters.latestMode, 'final')
  assert.equal(summary.counters.latestQuery, 'Summarize the outlier cluster.')
  assert.equal(summary.counters.latestEvidenceRefCount, 1)
})

test('ResponseRecorder.describeRecorder scopes counters to the current workspace', () => {
  const recorder = new ResponseRecorder({
    store: {
      workspaceId: 'main',
      responseHistory: [
        {
          responseId: 'response_a',
          workspaceId: 'other',
          actor: 'agent',
          content: 'Other workspace answer.',
          createdAt: '2026-01-01T00:00:00.000Z',
          evidenceRefs: [],
        },
        {
          responseId: 'response_b',
          workspaceId: 'main',
          actor: 'agent',
          mode: 'final',
          query: 'What changed after filtering?',
          content: 'Main workspace answer.',
          stateId: 'main:s4',
          branchId: 'branch_main',
          createdAt: '2026-01-01T00:00:01.000Z',
          evidenceRefs: ['wl://widgetva-app/workspace/main/data/current_view'],
        },
      ],
      readLatestResponse(options = {}) {
        const workspaceId = options.workspaceId || this.workspaceId || null
        const filtered = this.responseHistory.filter((record) => {
          if (!workspaceId) return true
          return record?.workspaceId === workspaceId
        })
        return filtered[filtered.length - 1] || null
      },
    },
  })

  const summary = recorder.describeRecorder()

  assert.equal(summary.counters.workspaceId, 'main')
  assert.equal(summary.counters.responseCount, 1)
  assert.equal(summary.counters.latestResponseId, 'response_b')
  assert.equal(summary.counters.latestStateId, 'main:s4')
  assert.equal(summary.counters.latestBranchId, 'branch_main')
  assert.equal(summary.counters.latestQuery, 'What changed after filtering?')
  assert.equal(summary.counters.latestEvidenceRefCount, 1)
})

test('ResponseRecorder.recordResponse normalizes records through the shared response contract', () => {
  const appended = []
  const recorder = new ResponseRecorder({
    store: {
      workspaceId: 'main',
      currentBranchId: 'branch_main',
      appendResponse(record) {
        appended.push(record)
      },
      readState() {
        return { stateId: 'main:s8' }
      },
    },
  })

  const record = recorder.recordResponse({
    responseId: 'response_final',
    content: '  Final answer.  ',
    evidenceRefs: ['wl://widgetva-app/workspace/main/data/current_selection'],
  })

  assert.equal(record.responseId, 'response_final')
  assert.equal(record.workspaceId, 'main')
  assert.equal(record.sessionId, 'main')
  assert.equal(record.branchId, 'branch_main')
  assert.equal(record.stateId, 'main:s8')
  assert.equal(record.content, 'Final answer.')
  assert.deepEqual(record.evidenceRefs, ['wl://widgetva-app/workspace/main/data/current_selection'])
  assert.deepEqual(appended, [record])
})

test('ResponseRecorder.recordResponse preserves usage metadata for downstream token-cost metrics', () => {
  const appended = []
  const recorder = new ResponseRecorder({
    store: {
      workspaceId: 'main',
      currentBranchId: 'branch_main',
      appendResponse(record) {
        appended.push(record)
      },
      readState() {
        return { stateId: 'main:s8' }
      },
    },
  })

  const record = recorder.recordResponse({
    responseId: 'response_usage',
    content: 'Tracked answer.',
    usage: {
      promptTokens: 120,
      completionTokens: 30,
      totalTokens: 150,
      tokenCost: 0.45,
      tokenCostUnit: 'usd',
    },
  })

  assert.equal(record.usage?.promptTokens, 120)
  assert.equal(record.usage?.completionTokens, 30)
  assert.equal(record.usage?.totalTokens, 150)
  assert.equal(record.usage?.tokenCost, 0.45)
  assert.equal(record.usage?.tokenCostUnit, 'usd')
  assert.deepEqual(appended, [record])
})
