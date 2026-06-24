import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeRuntimeStoreSummarySchema,
  makeRuntimeStoreCapabilities,
  makeRuntimeStoreCurrentStateSummary,
  makeRuntimeStoreHistory,
  makeRuntimeStoreIdentity,
  makeRuntimeStoreIndexes,
  makeRuntimeStoreStateSummary,
  makeRuntimeStoreSummary,
} from './runtimeStore.js'

test('describeRuntimeStoreSummarySchema admits currentStateSummary, widgetPatchCount, and richer history capabilities', () => {
  const schema = describeRuntimeStoreSummarySchema()
  const currentStateSummary = schema.properties?.currentStateSummary?.properties || {}
  const indexes = schema.properties?.indexes?.properties || {}
  const capabilities = schema.properties?.capabilities?.properties || {}

  assert.equal(currentStateSummary?.focusedWidgetRef?.type?.includes?.('string') ?? false, true)
  assert.equal(currentStateSummary?.selectionCount?.type, 'integer')
  assert.equal(currentStateSummary?.replayRunMode?.type?.includes?.('string') ?? false, true)
  assert.equal(currentStateSummary?.changedRefs?.items?.type, 'string')
  assert.equal(indexes?.widgetPatchCount?.type, 'integer')
  assert.equal(capabilities?.actorScopedHistory?.type, 'boolean')
  assert.equal(capabilities?.widgetStatePatching?.type, 'boolean')
})

test('runtime-store constructors normalize runtime store summary contracts', () => {
  const identity = makeRuntimeStoreIdentity({
    appId: 'demo-runtime',
  })
  const state = makeRuntimeStoreStateSummary({
    stateId: 'workspace_alpha:s1',
  })
  const currentStateSummary = makeRuntimeStoreCurrentStateSummary({
    selectionCount: 1,
  })
  const indexes = makeRuntimeStoreIndexes({
    widgetCount: 2,
  })
  const history = makeRuntimeStoreHistory({
    snapshotCount: 3,
  })
  const capabilities = makeRuntimeStoreCapabilities({
    widgetStatePatching: true,
  })
  const summary = makeRuntimeStoreSummary({
    identity,
    state,
    currentStateSummary,
    indexes,
    history,
    capabilities,
  })

  assert.equal(identity.appId, 'demo-runtime')
  assert.equal(state.stateId, 'workspace_alpha:s1')
  assert.equal(currentStateSummary.selectionCount, 1)
  assert.equal(indexes.widgetCount, 2)
  assert.equal(history.snapshotCount, 3)
  assert.equal(capabilities.widgetStatePatching, true)
  assert.equal(summary.capabilities.widgetStatePatching, true)
})

test('makeRuntimeStoreSummary normalizes nested summary defaults', () => {
  const summary = makeRuntimeStoreSummary({
    identity: {
      appId: 'demo-runtime',
    },
    state: {
      stateId: 'workspace_alpha:s1',
    },
    history: {
      snapshotCount: 3,
    },
    capabilities: {
      widgetStatePatching: true,
    },
  })

  assert.equal(summary.identity.appId, 'demo-runtime')
  assert.equal(summary.identity.workspaceId, '')
  assert.equal(summary.state.stateId, 'workspace_alpha:s1')
  assert.equal(summary.state.currentBranchId, null)
  assert.equal(summary.history.snapshotCount, 3)
  assert.equal(summary.history.retention.snapshotMax, 0)
  assert.equal(summary.capabilities.widgetStatePatching, true)
  assert.equal(summary.capabilities.traceGraph, false)
})
