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

test('WidgetVAPlaywrightClient exposes the core page-port surface', async () => {
  const page = createMockPage({
    describePagePort() {
      return {
        methods: ['describeWorkspace', 'readView', 'executeAction'],
        aliases: ['workspace_describe', 'view_read', 'action_run'],
      }
    },
    describeWorkspace(options = {}) {
      return {
        workspaceId: options.workspaceId || 'main',
        widgets: [{ ref: 'wl://widgetva-app/workspace/main/widget/scatter_a', widgetId: 'scatter_a' }],
      }
    },
    workspace_describe(options = {}) {
      return {
        workspaceId: options.workspaceId || 'main',
        widgets: [{ ref: 'wl://widgetva-app/workspace/main/widget/scatter_a', widgetId: 'scatter_a' }],
      }
    },
    describeRuntimeCore() {
      return { components: { runtimeStore: true } }
    },
    describeStateManager() {
      return { stateId: 'main:s1', snapshotCount: 2 }
    },
    describeAgentLoop() {
      return { loopHints: { nextStep: 'act' } }
    },
    readView(options = {}) {
      return {
        stateId: options.stateId || 'main:s1',
        refs: options.refs || [],
      }
    },
    view_read(options = {}) {
      return {
        stateId: options.stateId || 'main:s1',
        refs: options.refs || [],
      }
    },
    readSnapshot(options = {}) {
      return {
        stateId: options.stateId || 'main:s1',
        ref: options.ref || null,
      }
    },
    read_snapshot(options = {}) {
      return {
        stateId: options.stateId || 'main:s1',
        ref: options.ref || null,
      }
    },
    readStateHistory() {
      return [{ stateId: 'main:s0' }, { stateId: 'main:s1' }]
    },
    state_history_read() {
      return [{ stateId: 'main:s0' }, { stateId: 'main:s1' }]
    },
    listBranches() {
      return [{ branchId: 'main' }]
    },
    branch_list() {
      return [{ branchId: 'main' }]
    },
    executeAction(call = {}) {
      return {
        ok: true,
        callId: call.callId || null,
        actionName: call.name || null,
      }
    },
    action_run(call = {}) {
      return {
        ok: true,
        callId: call.callId || null,
        actionName: call.name || null,
      }
    },
    runVerifiedAction(call = {}, options = {}) {
      return {
        ok: true,
        actionName: call.name || null,
        verification: { strategy: options.strategy || 'default' },
      }
    },
    verified_action_run(call = {}, options = {}) {
      return {
        ok: true,
        actionName: call.name || null,
        verification: { strategy: options.strategy || 'default' },
      }
    },
    queryPerception(call = {}) {
      return { ok: true, queryName: call.name || null }
    },
    perception_query(call = {}) {
      return { ok: true, queryName: call.name || null }
    },
    queryData(call = {}) {
      return { ok: true, queryName: call.name || null }
    },
    data_query(call = {}) {
      return { ok: true, queryName: call.name || null }
    },
    getInteractionTrace(options = {}) {
      return [{ limit: options.limit || 0 }]
    },
    interaction_trace_read(options = {}) {
      return [{ limit: options.limit || 0 }]
    },
    getTraceGraph() {
      return { nodes: [], edges: [] }
    },
    trace_graph_read() {
      return { nodes: [], edges: [] }
    },
    getLatestAgentResponse(options = {}) {
      return {
        responseId: 'response_1',
        workspaceId: options.workspaceId || null,
      }
    },
    agent_response_read(options = {}) {
      return {
        responseId: 'response_1',
        workspaceId: options.workspaceId || null,
      }
    },
    listAgentResponses(options = {}) {
      return [{ responseId: 'response_1', limit: options.limit || null }]
    },
    agent_response_list(options = {}) {
      return [{ responseId: 'response_1', limit: options.limit || null }]
    },
    evaluateLinkPropagation(options = {}) {
      return { ok: true, sourceRef: options.sourceRef || null }
    },
    link_propagation_evaluate(options = {}) {
      return { ok: true, sourceRef: options.sourceRef || null }
    },
    readWorkspaceSnapshot(options = {}) {
      return { workspaceId: options.workspaceId || 'main' }
    },
    workspace_snapshot_read(options = {}) {
      return { workspaceId: options.workspaceId || 'main' }
    },
    recordAgentResponse(record = {}) {
      return { responseId: 'response_2', response: record.response || null }
    },
    agent_response_record(record = {}) {
      return { responseId: 'response_2', response: record.response || null }
    },
    planWorkspace(options = {}) {
      return { workspaceId: options.workspaceId || 'main', widgets: [] }
    },
    workspace_plan(options = {}) {
      return { workspaceId: options.workspaceId || 'main', widgets: [] }
    },
    jumpToState(options = {}) {
      return { ok: true, stateId: options.stateId || null }
    },
    jump_to_state(options = {}) {
      return { ok: true, stateId: options.stateId || null }
    },
    branchFromState(options = {}) {
      return { ok: true, branchId: options.branchId || 'branch_1' }
    },
    branch_from_state(options = {}) {
      return { ok: true, branchId: options.branchId || 'branch_1' }
    },
    listWidgetAdapters() {
      return [{ widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a' }]
    },
    widget_adapter_list() {
      return [{ widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a' }]
    },
  })

  const client = new WidgetVAPlaywrightClient(page)

  assert.deepEqual(await client.describePagePort(), {
    methods: ['describeWorkspace', 'readView', 'executeAction'],
    aliases: ['workspace_describe', 'view_read', 'action_run'],
  })
  assert.deepEqual(await client.describeWorkspace({ workspaceId: 'workspace_b' }), {
    workspaceId: 'workspace_b',
    widgets: [{ ref: 'wl://widgetva-app/workspace/main/widget/scatter_a', widgetId: 'scatter_a' }],
  })
  assert.deepEqual(await client.describeWidget({ widgetId: 'scatter_a' }), {
    ref: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    widgetId: 'scatter_a',
  })
  assert.deepEqual(await client.describeRuntimeCore(), { components: { runtimeStore: true } })
  assert.deepEqual(await client.describeStateManager(), { stateId: 'main:s1', snapshotCount: 2 })
  assert.deepEqual(await client.describeAgentLoop(), { loopHints: { nextStep: 'act' } })
  assert.deepEqual(await client.readView({ refs: ['scatter'] }), {
    stateId: 'main:s1',
    refs: ['scatter'],
  })
  assert.deepEqual(await client.readWorkspaceState({ refs: ['scatter'] }), {
    stateId: 'main:s1',
    refs: ['scatter'],
  })
  assert.deepEqual(await client.readWidgetState({ widgetId: 'scatter_a' }), {
    stateId: 'main:s1',
    refs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
  })
  assert.deepEqual(await client.readSnapshot({ stateId: 'main:s1', ref: 'scatter' }), {
    stateId: 'main:s1',
    ref: 'scatter',
  })
  assert.deepEqual(await client.readStateHistory(), [{ stateId: 'main:s0' }, { stateId: 'main:s1' }])
  assert.deepEqual(await client.listBranches(), [{ branchId: 'main' }])
  assert.deepEqual(await client.runAction({ callId: 'call_1', name: 'scatter.brushRegion' }), {
    ok: true,
    callId: 'call_1',
    actionName: 'scatter.brushRegion',
  })
  assert.deepEqual(await client.executeWorkspaceAction({ name: 'workspace.focusWidget' }), {
    ok: true,
    callId: null,
    actionName: 'workspace.focusWidget',
  })
  assert.deepEqual(await client.executeWidgetAction({ name: 'scatter.brushRegion' }), {
    ok: true,
    callId: null,
    actionName: 'scatter.brushRegion',
  })
  assert.deepEqual(
    await client.runVerifiedAction({ name: 'scatter.brushRegion' }, { strategy: 'verify' }),
    { ok: true, actionName: 'scatter.brushRegion', verification: { strategy: 'verify' } },
  )
  assert.deepEqual(await client.queryPerception({ name: 'perception.inspectSelection' }), {
    ok: true,
    queryName: 'perception.inspectSelection',
  })
  assert.deepEqual(await client.queryWorkspacePerception({ name: 'perception.findExtremes' }), {
    ok: true,
    queryName: 'perception.findExtremes',
  })
  assert.deepEqual(
    await client.queryWidgetPerception({
      name: 'perception.inspectSelection',
      targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    }),
    {
      ok: true,
      queryName: 'perception.inspectSelection',
    },
  )
  assert.deepEqual(await client.queryData({ name: 'sampleRows' }), {
    ok: true,
    queryName: 'sampleRows',
  })
  assert.deepEqual(await client.readInteractionTrace({ limit: 2 }), [{ limit: 2 }])
  assert.deepEqual(await client.readWorkspaceTrace({ limit: 2 }), [{ limit: 2 }])
  assert.deepEqual(
    await client.readWidgetTrace({ widgetId: 'scatter_a', limit: 2 }),
    [],
  )
  assert.deepEqual(await client.readTraceGraph(), { nodes: [], edges: [] })
  assert.deepEqual(await client.readLatestAgentResponse({ workspaceId: 'workspace_b' }), {
    responseId: 'response_1',
    workspaceId: 'workspace_b',
  })
  assert.deepEqual(await client.listAgentResponses({ limit: 2 }), [{ responseId: 'response_1', limit: 2 }])
  assert.deepEqual(await client.evaluateLinkPropagation({ sourceRef: 'scatter' }), {
    ok: true,
    sourceRef: 'scatter',
  })
  assert.deepEqual(await client.readWorkspaceSnapshot({ workspaceId: 'workspace_b' }), {
    workspaceId: 'workspace_b',
  })
  assert.deepEqual(await client.recordAgentResponse({ response: 'done' }), {
    responseId: 'response_2',
    response: 'done',
  })
  assert.deepEqual(await client.planWorkspace({ workspaceId: 'workspace_b' }), {
    workspaceId: 'workspace_b',
    widgets: [],
  })
  assert.deepEqual(await client.jumpToState({ stateId: 'main:s0' }), {
    ok: true,
    stateId: 'main:s0',
  })
  assert.deepEqual(await client.replayWorkspace('main:s1'), {
    ok: true,
    stateId: 'main:s1',
  })
  assert.deepEqual(await client.replayWidget({ stateId: 'main:s2' }), {
    ok: true,
    stateId: 'main:s2',
  })
  assert.deepEqual(await client.branchFromState({ branchId: 'branch_2' }), {
    ok: true,
    branchId: 'branch_2',
  })
  assert.deepEqual(await client.listWidgetAdapters(), [
    { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a' },
  ])
})

test('WidgetVAPlaywrightClient only reports page-port MCP tools', async () => {
  const page = createMockPage({
    describePagePort() {
      return {
        methods: ['describeWorkspace', 'readView', 'executeAction', 'queryPerception'],
        aliases: ['workspace_describe', 'view_read', 'action_run', 'perception_query'],
      }
    },
  })

  const client = new WidgetVAPlaywrightClient(page)
  const tools = await client.listAvailableWidgetVAMcpTools()
  const toolNames = tools.map((tool) => tool.name)

  assert.ok(toolNames.includes('workspace_describe'))
  assert.ok(toolNames.includes('view_read'))
  assert.ok(toolNames.includes('action_run'))
  assert.ok(toolNames.includes('perception_query'))
  assert.equal(toolNames.some((name) => name.startsWith('evaluation_')), false)
})
