import { evaluatePagePortAlias } from './pagePortBridge.js'
import { createPagePortClient } from './pagePortClient.js'

function createPlaywrightInvoke(page) {
  return (alias, args = []) => evaluatePagePortAlias(page, alias, args)
}

export class WidgetVAPlaywrightClient {
  constructor(page) {
    this.page = page
    this.client = createPagePortClient({
      invoke: createPlaywrightInvoke(page),
    })
  }

  invoke(alias, args = []) {
    return this.client.invoke(alias, args)
  }

  describePagePort() {
    return this.client.describePagePort()
  }

  describeWorkspace(options = {}) {
    return this.client.describeWorkspace(options)
  }

  parseRef(ref) {
    return this.client.parseRef(ref)
  }

  readView(options = {}) {
    return this.client.readView(options)
  }

  readState(options = {}) {
    return this.client.readState(options)
  }

  readSnapshot(options = {}) {
    return this.client.readSnapshot(options)
  }

  readStateHistory(options = {}) {
    return this.client.readStateHistory(options)
  }

  listBranches() {
    return this.client.listBranches()
  }

  jumpToState(options = {}) {
    return this.client.jumpToState(options)
  }

  branchFromState(options = {}) {
    return this.client.branchFromState(options)
  }

  runAction(call = {}) {
    return this.client.runAction(call)
  }

  executeAction(call = {}) {
    return this.client.executeAction(call)
  }

  runVerifiedAction(call = {}, options = {}) {
    return this.client.runVerifiedAction(call, options)
  }

  queryPerception(call = {}) {
    return this.client.queryPerception(call)
  }

  queryData(call = {}) {
    return this.client.queryData(call)
  }

  runDataQuery(call = {}) {
    return this.client.runDataQuery(call)
  }

  readInteractionTrace(options = {}) {
    return this.client.readInteractionTrace(options)
  }

  readTrace(options = {}) {
    return this.client.readTrace(options)
  }

  readTraceGraph(options = {}) {
    return this.client.readTraceGraph(options)
  }

  readLatestAgentResponse(options = {}) {
    return this.client.readLatestAgentResponse(options)
  }

  listAgentResponses(options = {}) {
    return this.client.listAgentResponses(options)
  }

  evaluateLinkPropagation(options = {}) {
    return this.client.evaluateLinkPropagation(options)
  }

  recordAgentResponse(record = {}) {
    return this.client.recordAgentResponse(record)
  }

  replay(stateIdOrOptions) {
    return this.client.replay(stateIdOrOptions)
  }
}

export function createPlaywrightTransportClient(page) {
  return new WidgetVAPlaywrightClient(page)
}

export async function describePagePort(page) {
  return createPlaywrightInvoke(page)('page_port_describe')
}

export async function workspaceDescribe(page, options = {}) {
  return createPlaywrightInvoke(page)('workspace_describe', [options])
}

export async function parseWidgetVARef(page, ref) {
  return createPlaywrightInvoke(page)('ref_parse', [{ ref }])
}

export async function viewRead(page, options = {}) {
  return createPlaywrightInvoke(page)('view_read', [options])
}

export async function snapshotRead(page, options = {}) {
  return createPlaywrightInvoke(page)('read_snapshot', [options])
}

export async function stateHistoryRead(page, options = {}) {
  return createPlaywrightInvoke(page)('state_history_read', [options])
}

export async function branchList(page) {
  return createPlaywrightInvoke(page)('branch_list')
}

export async function jumpToState(page, options = {}) {
  return createPlaywrightInvoke(page)('jump_to_state', [options])
}

export async function branchFromState(page, options = {}) {
  return createPlaywrightInvoke(page)('branch_from_state', [options])
}

export async function actionRun(page, call = {}) {
  return createPlaywrightInvoke(page)('action_run', [call])
}

export async function verifiedActionRun(page, call = {}, options = {}) {
  return createPlaywrightInvoke(page)('verified_action_run', [call, options])
}

export async function perceptionQuery(page, call = {}) {
  return createPlaywrightInvoke(page)('perception_query', [call])
}

export async function dataQuery(page, call = {}) {
  return createPlaywrightInvoke(page)('data_query', [call])
}

export async function interactionTraceRead(page, options = {}) {
  return createPlaywrightInvoke(page)('interaction_trace_read', [options])
}

export async function traceGraphRead(page, options = {}) {
  return createPlaywrightInvoke(page)('trace_graph_read', [options])
}

export async function readLatestAgentResponse(page, options = {}) {
  return createPlaywrightInvoke(page)('agent_response_read', [options])
}

export async function listAgentResponses(page, options = {}) {
  return createPlaywrightInvoke(page)('agent_response_list', [options])
}

export async function linkPropagationEvaluate(page, options = {}) {
  return createPlaywrightInvoke(page)('link_propagation_evaluate', [options])
}

export async function recordAgentResponse(page, record = {}) {
  return createPlaywrightInvoke(page)('agent_response_record', [record])
}
