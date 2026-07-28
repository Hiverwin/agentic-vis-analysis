import test from 'node:test'
import assert from 'node:assert/strict'

import { installWidgetVAPagePort } from './installPagePort.js'

test('installWidgetVAPagePort installs only explicit stable page-port API methods and aliases', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const calls = []
  const api = {
    describeWorkspace(options = {}) {
      calls.push(['describeWorkspace', options])
      return { workspaceId: options.workspaceId || 'main', widgets: [] }
    },
    readState(options = {}) {
      calls.push(['readState', options])
      return { stateId: options.stateId || 'main:s1' }
    },
    readView(options = {}) {
      calls.push(['readView', options])
      return { stateId: options.stateId || 'main:s1', view: true }
    },
    readSnapshot(options = {}) {
      calls.push(['readSnapshot', options])
      return { stateId: options.stateId || null, snapshot: true }
    },
    listStateHistory(options = {}) {
      calls.push(['listStateHistory', options])
      return [{ stateId: 'main:s1' }]
    },
    listBranches() {
      calls.push(['listBranches'])
      return [{ branchId: 'main' }]
    },
    executeAction(call = {}) {
      calls.push(['executeAction', call])
      return { ok: true, actionName: call.name || null }
    },
    executeVerifiedAction(call = {}, options = {}) {
      calls.push(['executeVerifiedAction', call, options])
      return { ok: true, verified: true }
    },
    jumpToState(options = {}) {
      calls.push(['jumpToState', options])
      return { ok: true, stateId: options.stateId || null }
    },
    branchFromState(options = {}) {
      calls.push(['branchFromState', options])
      return { ok: true, branchId: options.branchId || 'branch_1' }
    },
    queryPerception(call = {}) {
      calls.push(['queryPerception', call])
      return { ok: true, queryName: call.name || null }
    },
    runDataQuery(call = {}) {
      calls.push(['runDataQuery', call])
      return { ok: true, rows: [] }
    },
    readTrace(options = {}) {
      calls.push(['readTrace', options])
      return [{ stateId: options.sinceStateId || 'main:s1' }]
    },
    getTraceGraph(options = {}) {
      calls.push(['getTraceGraph', options])
      return { nodes: [], edges: [] }
    },
    getLatestAgentResponse(options = {}) {
      calls.push(['getLatestAgentResponse', options])
      return { responseId: 'response_1', workspaceId: options.workspaceId || null }
    },
    listAgentResponses(options = {}) {
      calls.push(['listAgentResponses', options])
      return [{ responseId: 'response_1' }]
    },
    evaluateLinkPropagation(options = {}) {
      calls.push(['evaluateLinkPropagation', options])
      return { ok: true, sourceRef: options.sourceRef || null }
    },
    recordAgentResponse(record = {}) {
      calls.push(['recordAgentResponse', record])
      return { responseId: 'response_2', content: record.content || null }
    },
  }

  try {
    const uninstall = installWidgetVAPagePort({ api })
    const port = globalThis.window.__widgetVA
    const description = await port.describePagePort()

    assert.equal(description.methods.includes('describeWorkspace'), true)
    assert.equal(description.methods.includes('readView'), true)
    assert.equal(description.methods.includes('executeAction'), true)
    assert.equal(description.aliases.workspace_describe, 'describeWorkspace')
    assert.equal(description.aliases.action_run, 'executeAction')
    assert.deepEqual(await port.workspace_describe({ workspaceId: 'workspace_b' }), {
      workspaceId: 'workspace_b',
      widgets: [],
    })
    assert.deepEqual(await port.view_read({ stateId: 'main:s2' }), {
      stateId: 'main:s2',
      view: true,
    })
    assert.deepEqual(await port.action_run({ name: 'scatter.brushRegion' }), {
      ok: true,
      actionName: 'scatter.brushRegion',
    })
    assert.deepEqual(await port.verified_action_run({ name: 'scatter.brushRegion' }, { verify: true }), {
      ok: true,
      verified: true,
    })
    assert.deepEqual(await port.data_query({ query: { kind: 'summary' } }), { ok: true, rows: [] })
    assert.deepEqual(await port.interaction_trace_read({ sinceStateId: 'main:s0' }), [{ stateId: 'main:s0' }])
    assert.deepEqual(await port.agent_response_record({ content: 'done' }), {
      responseId: 'response_2',
      content: 'done',
    })

    uninstall()
    assert.equal(globalThis.window.__widgetVA, undefined)
    assert.equal(calls.some(([name]) => name === 'describeWorkspace'), true)
    assert.equal(calls.some(([name]) => name === 'executeAction'), true)
  } finally {
    globalThis.window = previousWindow
  }
})

test('installWidgetVAPagePort does not synthesize page-port methods from store or executor objects', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}

  try {
    installWidgetVAPagePort({
      store: {
        workspaceId: 'main',
        widgets: {
          scatter: { widgetId: 'scatter' },
        },
        readState() {
          return { stateId: 'main:s1' }
        },
      },
      actionExecutor: {
        run() {
          return { ok: true }
        },
      },
      agentLoopRuntime: {
        executeVerifiedAction() {
          return { ok: true }
        },
      },
      coordinationEngine: {
        evaluatePropagation() {
          return { ok: true }
        },
      },
    })

    const port = globalThis.window.__widgetVA
    const description = await port.describePagePort()
    assert.deepEqual(description.methods, ['describePagePort', 'parseRef'])
    assert.equal(typeof port.describeWorkspace, 'undefined')
    assert.equal(typeof port.readView, 'undefined')
    assert.equal(typeof port.executeAction, 'undefined')
    assert.equal(typeof port.executeVerifiedAction, 'undefined')
    assert.equal(typeof port.evaluateLinkPropagation, 'undefined')
  } finally {
    delete globalThis.window?.__widgetVA
    globalThis.window = previousWindow
  }
})

test('installWidgetVAPagePort does not expose runtime internals, agent loop, or observation surfaces', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}

  try {
    installWidgetVAPagePort({
      api: {
        describeWorkspace: () => ({ workspaceId: 'main' }),
        readView: () => ({ stateId: 'main:s1' }),
        executeAction: () => ({ ok: true }),
      },
    })

    const port = globalThis.window.__widgetVA
    const description = await port.describePagePort()
    for (const methodName of [
      'describeRuntimeCore',
      'describeStateManager',
      'describeAgentLoop',
      'runAgentTurn',
      'runAgentSession',
      'readObservation',
      'readAgentObservation',
      'readCoordinationState',
      'readSharedAnalyticalState',
      'readPropagationSummary',
      'listWidgetAdapters',
      'planWorkspace',
    ]) {
      assert.equal(description.methods.includes(methodName), false)
      assert.equal(description.methodDescriptors?.[methodName], undefined)
      assert.equal(typeof port[methodName], 'undefined')
    }
    for (const alias of [
      'runtime_core_describe',
      'state_manager_describe',
      'agent_loop_describe',
      'observation_read',
      'coordination_state_read',
      'shared_analytical_state_read',
      'propagation_summary_read',
      'widget_adapter_list',
      'workspace_plan',
    ]) {
      assert.equal(description.aliases?.[alias], undefined)
      assert.equal(typeof port[alias], 'undefined')
    }
  } finally {
    delete globalThis.window?.__widgetVA
    globalThis.window = previousWindow
  }
})

test('installWidgetVAPagePort can install stable methods from explicit function options', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}

  try {
    installWidgetVAPagePort({
      describeWorkspace: () => ({ workspaceId: 'main' }),
      readState: () => ({ stateId: 'main:s1' }),
      executeAction: (call = {}) => ({ ok: true, actionName: call.name }),
      queryPerception: (call = {}) => ({ ok: true, queryName: call.name }),
      queryData: () => ({ ok: true }),
    })

    const port = globalThis.window.__widgetVA
    const description = await port.describePagePort()
    assert.equal(description.aliases.workspace_describe, 'describeWorkspace')
    assert.equal(description.aliases.state_read, 'readState')
    assert.equal(description.aliases.action_run, 'executeAction')
    assert.deepEqual(await port.state_read(), { stateId: 'main:s1' })
    assert.deepEqual(await port.action_run({ name: 'bar.selectCategory' }), {
      ok: true,
      actionName: 'bar.selectCategory',
    })
  } finally {
    delete globalThis.window?.__widgetVA
    globalThis.window = previousWindow
  }
})
