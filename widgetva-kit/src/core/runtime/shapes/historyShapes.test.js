import test from 'node:test'
import assert from 'node:assert/strict'

import {
  makeBranchSummary,
  makeStateSnapshotMeta,
  makeTraceGraph,
  makeTraceGraphEdge,
  makeTraceGraphNode,
} from './historyShapes.js'

test('historyShapes normalizes snapshot and trace graph data', () => {
  const snapshotMeta = makeStateSnapshotMeta({ stateId: 'main:s1' })
  const branchSummary = makeBranchSummary({ branchId: 'main', label: 'Main' })
  const node = makeTraceGraphNode({ id: 'main:s1', stateId: 'main:s1' })
  const edge = makeTraceGraphEdge({ id: 'main:s0->main:s1', from_id: 'main:s0', to_id: 'main:s1' })
  const graph = makeTraceGraph({ nodes: [node], edges: [edge], branches: [branchSummary] })

  assert.equal(snapshotMeta.actor, 'system')
  assert.equal(branchSummary.branchId, 'main')
  assert.equal(graph.nodes[0]?.stateId, 'main:s1')
  assert.equal(graph.edges[0]?.edge_type, 'continue')
})
