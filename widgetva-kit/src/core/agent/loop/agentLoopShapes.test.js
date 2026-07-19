import test from 'node:test'
import assert from 'node:assert/strict'

import {
  makeAgentLoopContext,
  makeAgentLoopHints,
  makeVerifiedActionEvidence,
  makeVerifiedActionResult,
} from './agentLoopShapes.js'

test('agent loop shapes normalize loop context and verified action results', () => {
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
