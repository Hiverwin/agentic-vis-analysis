import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyWidgetStatePatches,
  buildResponsePreview,
  makeRuntimeStoreSummary,
  normalizeActorFilter,
  pickRepresentativeTraceRecord,
} from './RuntimeStoreModels.js'

test('applyWidgetStatePatches deeply merges known widget patches without mutating the original state', () => {
  const state = {
    stateId: 'main:s1',
    widgets: {
      'wl://widget/a': {
        ref: 'wl://widget/a',
        selections: {
          current: { values: ['A'] },
        },
        view: { zoom: 1 },
      },
    },
  }

  const patched = applyWidgetStatePatches(state, {
    'wl://widget/a': {
      selections: {
        current: { values: ['B'] },
      },
    },
    'wl://widget/missing': {
      view: { zoom: 2 },
    },
  })

  assert.deepEqual(patched.widgets['wl://widget/a'].selections.current.values, ['B'])
  assert.equal(patched.widgets['wl://widget/a'].view.zoom, 1)
  assert.deepEqual(state.widgets['wl://widget/a'].selections.current.values, ['A'])
})

test('runtime store model helpers normalize compact history and response surfaces', () => {
  assert.deepEqual(normalizeActorFilter(['agent', '', 'human', 'agent', null]), ['agent', 'human'])
  assert.equal(buildResponsePreview('  hello runtime  '), 'hello runtime')
  assert.equal(buildResponsePreview('abcdef', 5), 'ab...')

  const representative = pickRepresentativeTraceRecord(
    { eventKind: 'systemTransition', id: 'system' },
    { eventKind: 'action', id: 'action' },
  )
  assert.equal(representative.id, 'action')
})

test('makeRuntimeStoreSummary preserves caller values while filling nested defaults', () => {
  const summary = makeRuntimeStoreSummary({
    identity: { appId: 'app-a' },
    state: { stateId: 'main:s2' },
    history: { traceCount: 3 },
    capabilities: { traceGraph: true },
    currentStateSummary: { selectedCount: 2 },
  })

  assert.equal(summary.identity.appId, 'app-a')
  assert.equal(summary.identity.workspaceId, '')
  assert.equal(summary.state.stateId, 'main:s2')
  assert.equal(summary.history.traceCount, 3)
  assert.equal(summary.history.retention.snapshotMax, 0)
  assert.equal(summary.capabilities.traceGraph, true)
  assert.equal(summary.capabilities.deltaTracking, false)
  assert.equal(summary.currentStateSummary.selectedCount, 2)
  assert.deepEqual(summary.currentStateSummary.changedRefs, [])
})
