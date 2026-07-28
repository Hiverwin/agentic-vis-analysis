import test from 'node:test'
import assert from 'node:assert/strict'

import { WidgetVAPlaywrightClient } from './playwrightClient.js'

function withWindow(pagePort, callback, arg) {
  const previousWindow = globalThis.window
  globalThis.window = { __widgetVA: pagePort }
  try {
    return callback(arg)
  } finally {
    globalThis.window = previousWindow
  }
}

function createMockPage(pagePort = {}) {
  return {
    calls: [],
    async evaluate(callback, arg) {
      this.calls.push(arg)
      return withWindow(pagePort, callback, arg)
    },
  }
}

test('WidgetVAPlaywrightClient exposes only the stable page-port client surface', async () => {
  const page = createMockPage({
    describePagePort() {
      return {
        methods: ['describeWorkspace', 'readView', 'executeAction'],
        aliases: ['workspace_describe', 'view_read', 'action_run'],
      }
    },
    workspace_describe(options = {}) {
      return { workspaceId: options.workspaceId || 'main' }
    },
    view_read(options = {}) {
      return { stateId: options.stateId || 'main:s1', refs: options.refs || [] }
    },
    read_snapshot(options = {}) {
      return { stateId: options.stateId || 'main:s1' }
    },
    state_history_read() {
      return [{ stateId: 'main:s0' }]
    },
    branch_list() {
      return [{ branchId: 'main' }]
    },
    action_run(call = {}) {
      return { ok: true, actionName: call.name || null }
    },
    verified_action_run(call = {}, options = {}) {
      return { ok: true, actionName: call.name || null, verification: options.strategy || 'default' }
    },
    jump_to_state(options = {}) {
      return { ok: true, stateId: options.stateId || null }
    },
    branch_from_state(options = {}) {
      return { ok: true, branchId: options.branchId || 'branch_1' }
    },
    workspace_replay(options = {}) {
      return { ok: true, stateId: options.stateId || null }
    },
    perception_query(call = {}) {
      return { ok: true, queryName: call.name || null }
    },
    data_query(call = {}) {
      return { ok: true, queryName: call.name || null }
    },
    interaction_trace_read(options = {}) {
      return [{ limit: options.limit || 0 }]
    },
    trace_graph_read() {
      return { nodes: [], edges: [] }
    },
    agent_response_read(options = {}) {
      return { responseId: 'response_1', workspaceId: options.workspaceId || null }
    },
    agent_response_list(options = {}) {
      return [{ responseId: 'response_1', limit: options.limit || null }]
    },
    link_propagation_evaluate(options = {}) {
      return { ok: true, sourceRef: options.sourceRef || null }
    },
    agent_response_record(record = {}) {
      return { responseId: 'response_2', response: record.response || null }
    },
  })

  const client = new WidgetVAPlaywrightClient(page)

  assert.deepEqual(await client.describePagePort(), {
    methods: ['describeWorkspace', 'readView', 'executeAction'],
    aliases: ['workspace_describe', 'view_read', 'action_run'],
  })
  assert.deepEqual(await client.describeWorkspace({ workspaceId: 'workspace_b' }), { workspaceId: 'workspace_b' })
  assert.deepEqual(await client.readView({ refs: ['scatter'] }), { stateId: 'main:s1', refs: ['scatter'] })
  assert.deepEqual(await client.readState({ refs: ['scatter'] }), { stateId: 'main:s1', refs: ['scatter'] })
  assert.deepEqual(await client.readSnapshot({ stateId: 'main:s1' }), { stateId: 'main:s1' })
  assert.deepEqual(await client.readStateHistory(), [{ stateId: 'main:s0' }])
  assert.deepEqual(await client.listBranches(), [{ branchId: 'main' }])
  assert.deepEqual(await client.runAction({ name: 'scatter.brushRegion' }), {
    ok: true,
    actionName: 'scatter.brushRegion',
  })
  assert.deepEqual(await client.executeAction({ name: 'workspace.focusWidget' }), {
    ok: true,
    actionName: 'workspace.focusWidget',
  })
  assert.deepEqual(await client.runVerifiedAction({ name: 'scatter.brushRegion' }, { strategy: 'verify' }), {
    ok: true,
    actionName: 'scatter.brushRegion',
    verification: 'verify',
  })
  assert.deepEqual(await client.jumpToState({ stateId: 'main:s0' }), { ok: true, stateId: 'main:s0' })
  assert.deepEqual(await client.replay({ stateId: 'main:s1' }), { ok: true, stateId: 'main:s1' })
  assert.deepEqual(await client.branchFromState({ branchId: 'branch_2' }), { ok: true, branchId: 'branch_2' })
  assert.deepEqual(await client.queryPerception({ name: 'perception.inspectSelection' }), {
    ok: true,
    queryName: 'perception.inspectSelection',
  })
  assert.deepEqual(await client.queryData({ name: 'sampleRows' }), { ok: true, queryName: 'sampleRows' })
  assert.deepEqual(await client.readInteractionTrace({ limit: 2 }), [{ limit: 2 }])
  assert.deepEqual(await client.readTrace({ limit: 2 }), [{ limit: 2 }])
  assert.deepEqual(await client.readTraceGraph(), { nodes: [], edges: [] })
  assert.deepEqual(await client.readLatestAgentResponse({ workspaceId: 'workspace_b' }), {
    responseId: 'response_1',
    workspaceId: 'workspace_b',
  })
  assert.deepEqual(await client.listAgentResponses({ limit: 2 }), [{ responseId: 'response_1', limit: 2 }])
  assert.deepEqual(await client.evaluateLinkPropagation({ sourceRef: 'scatter' }), { ok: true, sourceRef: 'scatter' })
  assert.deepEqual(await client.recordAgentResponse({ response: 'done' }), {
    responseId: 'response_2',
    response: 'done',
  })

  for (const removedName of [
    'describeWidget',
    'readWorkspaceState',
    'readWidgetState',
    'executeWorkspaceAction',
    'executeWidgetAction',
    'queryWorkspacePerception',
    'queryWidgetPerception',
    'readWorkspaceTrace',
    'readWidgetTrace',
    'replayWorkspace',
    'replayWidget',
    'listAvailableWidgetVAMcpTools',
    'buildScatterBrushCall',
    'describeRuntimeCore',
    'describeStateManager',
    'describeAgentLoop',
    'planWorkspace',
    'listWidgetAdapters',
  ]) {
    assert.equal(removedName in client, false)
  }
})
