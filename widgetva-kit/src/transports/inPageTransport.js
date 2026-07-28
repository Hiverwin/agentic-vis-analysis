import { invokePagePortAlias } from './pagePortBridge.js'

export async function describePagePort() {
  return invokePagePortAlias('page_port_describe')
}

export async function workspaceDescribe(options = {}) {
  return invokePagePortAlias('workspace_describe', [options])
}

export async function parseWidgetVARef(ref) {
  return invokePagePortAlias('ref_parse', [{ ref }])
}

export async function viewRead(options = {}) {
  return invokePagePortAlias('view_read', [options])
}

export async function readState(options = {}) {
  return invokePagePortAlias('state_read', [options])
}

export async function snapshotRead(options = {}) {
  return invokePagePortAlias('read_snapshot', [options])
}

export async function stateHistoryRead(options = {}) {
  return invokePagePortAlias('state_history_read', [options])
}

export async function branchList(options = {}) {
  return invokePagePortAlias('branch_list', [options])
}

export async function actionRun(call = {}) {
  return invokePagePortAlias('action_run', [call])
}

export async function executeAction(call = {}) {
  return actionRun(call)
}

export async function verifiedActionRun(call = {}, options = {}) {
  return invokePagePortAlias('verified_action_run', [call, options])
}

export async function jumpToState(options = {}) {
  return invokePagePortAlias('jump_to_state', [options])
}

export async function branchFromState(options = {}) {
  return invokePagePortAlias('branch_from_state', [options])
}

export async function replay(options = {}) {
  return invokePagePortAlias('workspace_replay', [options])
}

export async function perceptionQuery(call = {}) {
  return invokePagePortAlias('perception_query', [call])
}

export async function dataQuery(call = {}) {
  return invokePagePortAlias('data_query', [call])
}

export async function runDataQuery(call = {}) {
  return dataQuery(call)
}

export async function interactionTraceRead(options = {}) {
  return invokePagePortAlias('interaction_trace_read', [options])
}

export async function readTrace(options = {}) {
  return interactionTraceRead(options)
}

export async function traceGraphRead(options = {}) {
  return invokePagePortAlias('trace_graph_read', [options])
}

export async function readLatestAgentResponse(options = {}) {
  return invokePagePortAlias('agent_response_read', [options])
}

export async function listAgentResponses(options = {}) {
  return invokePagePortAlias('agent_response_list', [options])
}

export async function linkPropagationEvaluate(options = {}) {
  return invokePagePortAlias('link_propagation_evaluate', [options])
}

export async function recordAgentResponse(record = {}) {
  return invokePagePortAlias('agent_response_record', [record])
}
