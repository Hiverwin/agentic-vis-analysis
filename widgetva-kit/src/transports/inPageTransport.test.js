import test from 'node:test'
import assert from 'node:assert/strict'

import * as inPageTransport from './inPageTransport.js'
import {
  actionRun,
  branchFromState,
  branchList,
  dataQuery,
  executeAction,
  interactionTraceRead,
  jumpToState,
  linkPropagationEvaluate,
  listAgentResponses,
  parseWidgetVARef,
  perceptionQuery,
  readLatestAgentResponse,
  readState,
  readTrace,
  recordAgentResponse,
  replay,
  runDataQuery,
  snapshotRead,
  stateHistoryRead,
  traceGraphRead,
  verifiedActionRun,
  viewRead,
  workspaceDescribe,
} from './inPageTransport.js'

test('inPageTransport dispatches stable page-port aliases only', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {
    __widgetVA: {
      workspace_describe: (options = {}) => ({ workspaceId: options.workspaceId || 'main' }),
      ref_parse: ({ ref }) => ({ ref }),
      view_read: (options = {}) => ({ stateId: options.stateId || 'main:s1', refs: options.refs || [] }),
      state_read: (options = {}) => ({ stateId: options.stateId || 'main:s1', refs: options.refs || [] }),
      read_snapshot: (options = {}) => ({ stateId: options.stateId || null }),
      state_history_read: () => [{ stateId: 'main:s1' }],
      branch_list: () => [{ branchId: 'main' }],
      action_run: (call = {}) => ({ ok: true, actionName: call.name || null }),
      verified_action_run: (call = {}, options = {}) => ({ ok: true, actionName: call.name || null, options }),
      jump_to_state: (options = {}) => ({ ok: true, stateId: options.stateId || null }),
      branch_from_state: (options = {}) => ({ ok: true, branchId: options.branchId || 'branch_1' }),
      workspace_replay: (options = {}) => ({ ok: true, stateId: options.stateId || null }),
      perception_query: (call = {}) => ({ ok: true, queryName: call.name || null }),
      data_query: (call = {}) => ({ ok: true, queryName: call.name || null }),
      interaction_trace_read: (options = {}) => [{ stateId: options.sinceStateId || 'main:s1' }],
      trace_graph_read: () => ({ nodes: [], edges: [] }),
      agent_response_read: (options = {}) => ({ responseId: 'response_1', workspaceId: options.workspaceId || null }),
      agent_response_list: () => [{ responseId: 'response_1' }],
      link_propagation_evaluate: (options = {}) => ({ ok: true, sourceRef: options.sourceRef || null }),
      agent_response_record: (record = {}) => ({ responseId: 'response_2', content: record.content || null }),
    },
  }

  try {
    assert.deepEqual(await workspaceDescribe({ workspaceId: 'workspace_b' }), { workspaceId: 'workspace_b' })
    assert.deepEqual(await parseWidgetVARef('wl://demo/workspace/main/widget/a'), {
      ref: 'wl://demo/workspace/main/widget/a',
    })
    assert.deepEqual(await viewRead({ stateId: 'main:s2', refs: ['a'] }), { stateId: 'main:s2', refs: ['a'] })
    assert.deepEqual(await readState({ refs: ['a'] }), { stateId: 'main:s1', refs: ['a'] })
    assert.deepEqual(await snapshotRead({ stateId: 'main:s1' }), { stateId: 'main:s1' })
    assert.deepEqual(await stateHistoryRead(), [{ stateId: 'main:s1' }])
    assert.deepEqual(await branchList(), [{ branchId: 'main' }])
    assert.deepEqual(await actionRun({ name: 'scatter.brushRegion' }), {
      ok: true,
      actionName: 'scatter.brushRegion',
    })
    assert.deepEqual(await executeAction({ name: 'workspace.focusWidget' }), {
      ok: true,
      actionName: 'workspace.focusWidget',
    })
    assert.deepEqual(await verifiedActionRun({ name: 'scatter.brushRegion' }, { verify: true }), {
      ok: true,
      actionName: 'scatter.brushRegion',
      options: { verify: true },
    })
    assert.deepEqual(await jumpToState({ stateId: 'main:s0' }), { ok: true, stateId: 'main:s0' })
    assert.deepEqual(await branchFromState({ branchId: 'branch_2' }), { ok: true, branchId: 'branch_2' })
    assert.deepEqual(await replay({ stateId: 'main:s3' }), { ok: true, stateId: 'main:s3' })
    assert.deepEqual(await perceptionQuery({ name: 'perception.inspectViewConfig' }), {
      ok: true,
      queryName: 'perception.inspectViewConfig',
    })
    assert.deepEqual(await dataQuery({ name: 'summary' }), { ok: true, queryName: 'summary' })
    assert.deepEqual(await runDataQuery({ name: 'rows' }), { ok: true, queryName: 'rows' })
    assert.deepEqual(await interactionTraceRead({ sinceStateId: 'main:s0' }), [{ stateId: 'main:s0' }])
    assert.deepEqual(await readTrace({ sinceStateId: 'main:s0' }), [{ stateId: 'main:s0' }])
    assert.deepEqual(await traceGraphRead(), { nodes: [], edges: [] })
    assert.deepEqual(await readLatestAgentResponse({ workspaceId: 'workspace_b' }), {
      responseId: 'response_1',
      workspaceId: 'workspace_b',
    })
    assert.deepEqual(await listAgentResponses(), [{ responseId: 'response_1' }])
    assert.deepEqual(await linkPropagationEvaluate({ sourceRef: 'scatter' }), { ok: true, sourceRef: 'scatter' })
    assert.deepEqual(await recordAgentResponse({ content: 'done' }), {
      responseId: 'response_2',
      content: 'done',
    })
  } finally {
    globalThis.window = previousWindow
  }
})

test('inPageTransport does not expose runtime, agent-loop, MCP, or widget/workspace convenience surfaces', () => {
  for (const removedName of [
    'listAvailableWidgetVAMcpTools',
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
    'runtimeCoreDescribe',
    'stateManagerDescribe',
    'actionExecutorDescribe',
    'agentLoopDescribe',
    'workspacePlan',
    'listWidgetAdapters',
    'readObservation',
    'readCoordinationState',
    'readPropagationSummary',
  ]) {
    assert.equal(removedName in inPageTransport, false)
  }
})
