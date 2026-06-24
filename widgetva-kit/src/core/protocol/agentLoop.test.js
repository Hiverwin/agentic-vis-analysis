import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeAgentLoopHintsSchema,
  makeAgentLoopContext,
  makeAgentLoopHints,
  makeVerifiedActionEvidence,
  makeVerifiedActionResult,
} from './agentLoop.js'

test('describeAgentLoopHintsSchema allows nullable optional loop-surface names', () => {
  const schema = describeAgentLoopHintsSchema()
  const properties = schema.properties || {}

  assert.deepEqual(properties.workspacePlanName?.type, ['string', 'null'])
  assert.deepEqual(properties.dataQueryName?.type, ['string', 'null'])
  assert.deepEqual(properties.interactionTraceName?.type, ['string', 'null'])
  assert.deepEqual(properties.traceGraphName?.type, ['string', 'null'])
  assert.deepEqual(properties.snapshotName?.type, ['string', 'null'])
  assert.deepEqual(properties.stateHistoryName?.type, ['string', 'null'])
  assert.deepEqual(properties.branchListName?.type, ['string', 'null'])
  assert.deepEqual(properties.finalSnapshotName?.type, ['string', 'null'])
  assert.deepEqual(properties.jumpToStateName?.type, ['string', 'null'])
  assert.deepEqual(properties.branchFromStateName?.type, ['string', 'null'])
  assert.deepEqual(properties.responseRecorderName?.type, ['string', 'null'])
  assert.deepEqual(properties.responseReadName?.type, ['string', 'null'])
  assert.deepEqual(properties.responseListName?.type, ['string', 'null'])
  assert.deepEqual(properties.responseRecordName?.type, ['string', 'null'])
})

test('agent-loop constructors normalize loop context and verified-action contracts', () => {
  const loopHints = makeAgentLoopHints({
    workspaceDescribeName: 'describeWorkspace',
    finalSnapshotName: 'getFinalWorkspaceSnapshot',
  })
  const context = makeAgentLoopContext({
    workspace: { appId: 'demo-runtime', workspaceId: 'workspace_alpha', widgets: [], links: [] },
    view: { stateId: 'workspace_alpha:s1', createdAt: '2026-01-01T00:00:00.000Z', widgets: {}, shared: {} },
    loopHints,
  })
  const evidence = makeVerifiedActionEvidence({
    verificationHints: ['Check the resulting selection state.'],
  })
  const result = makeVerifiedActionResult({
    ok: true,
    beforeStateId: 'workspace_alpha:s0',
    actionResult: { ok: true, callId: 'call_1', actionName: 'scatter.brushRegion' },
    verificationHints: evidence.verificationHints,
  })

  assert.equal(loopHints.workspacePlanName, null)
  assert.deepEqual(loopHints.recommendedOrder, [])
  assert.equal(context.loopHints.finalSnapshotName, 'getFinalWorkspaceSnapshot')
  assert.deepEqual(evidence.linkPropagation, [])
  assert.equal(result.ok, true)
  assert.equal(result.afterView, null)
  assert.deepEqual(result.linkPropagation, [])
})
