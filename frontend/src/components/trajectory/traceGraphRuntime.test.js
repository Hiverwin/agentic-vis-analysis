import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeRuntimeTraceGraph } from './traceGraphRuntime.js'

test('normalizeRuntimeTraceGraph keeps action nodes as tool calls even when transitionType is jump_back', () => {
  const graph = normalizeRuntimeTraceGraph({
    current_state_id: 'main:s2',
    nodes: [
      {
        id: 'main:s2',
        stateId: 'main:s2',
        actionName: 'workspace.jumpToState',
        label: 'workspace.jumpToState',
        transitionType: 'jump_back',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ],
    edges: [],
  })

  assert.equal(graph.nodes[0].tool_name, 'workspace.jumpToState')
  assert.equal(graph.nodes[0].label, 'workspace.jumpToState')
  assert.equal(graph.nodes[0].action_type, 'tool_call')
  assert.equal(graph.nodes[0].message_preview, 'jump_back')
})

test('normalizeRuntimeTraceGraph keeps branch actions as tool calls when action identity is present', () => {
  const graph = normalizeRuntimeTraceGraph({
    current_state_id: 'main:s3',
    nodes: [
      {
        id: 'main:s3',
        stateId: 'main:s3',
        actionName: 'workspace.branchFromState',
        label: 'workspace.branchFromState',
        transitionType: 'branch',
        timestamp: '2026-01-01T00:00:01.000Z',
      },
    ],
    edges: [],
  })

  assert.equal(graph.nodes[0].action_type, 'tool_call')
  assert.equal(graph.nodes[0].message_preview, 'branch')
})

test('normalizeRuntimeTraceGraph preserves response metadata on tool-call nodes', () => {
  const graph = normalizeRuntimeTraceGraph({
    current_state_id: 'main:s4',
    nodes: [
      {
        id: 'main:s4',
        stateId: 'main:s4',
        actionName: 'perception.summarizeSelection',
        label: 'perception.summarizeSelection',
        responseId: 'response_4',
        responseActor: 'agent',
        responsePreview: 'Final answer: sales are concentrated in the selected western stores.',
        transitionType: 'continue',
        timestamp: '2026-01-01T00:00:02.000Z',
      },
    ],
    edges: [],
  })

  assert.equal(graph.nodes[0].action_type, 'tool_call')
  assert.equal(graph.nodes[0].has_response, true)
  assert.equal(graph.nodes[0].response_id, 'response_4')
  assert.equal(graph.nodes[0].response_preview, 'Final answer: sales are concentrated in the selected western stores.')
  assert.equal(graph.nodes[0].message_preview, 'Final answer: sales are concentrated in the selected western stores.')
})

test('normalizeRuntimeTraceGraph marks response-only nodes as answers', () => {
  const graph = normalizeRuntimeTraceGraph({
    current_state_id: 'main:s5',
    nodes: [
      {
        id: 'main:s5',
        stateId: 'main:s5',
        label: 'state',
        responseId: 'response_5',
        responseActor: 'agent',
        responsePreview: 'Final answer: the outlier is store 17.',
        transitionType: 'continue',
        timestamp: '2026-01-01T00:00:03.000Z',
      },
    ],
    edges: [],
  })

  assert.equal(graph.nodes[0].action_type, 'answer')
  assert.equal(graph.nodes[0].has_response, true)
  assert.equal(graph.nodes[0].message_preview, 'Final answer: the outlier is store 17.')
})
