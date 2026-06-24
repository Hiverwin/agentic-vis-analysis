import { evaluatePagePortAlias } from '../pagePortBridge.js'

export async function describePagePortFromPage(page) {
  return evaluatePagePortAlias(page, 'page_port_describe')
}

export async function describeWorkspaceFromPage(page, options = {}) {
  return evaluatePagePortAlias(page, 'workspace_describe', [options])
}

export async function parseRefFromPage(page, ref) {
  return evaluatePagePortAlias(page, 'ref_parse', [{ ref }])
}

export async function describeRuntimeCoreFromPage(page) {
  return evaluatePagePortAlias(page, 'runtime_core_describe')
}

export async function describeRuntimeStoreFromPage(page) {
  return evaluatePagePortAlias(page, 'runtime_store_describe')
}

export async function describeWidgetRegistryFromPage(page) {
  return evaluatePagePortAlias(page, 'widget_registry_describe')
}

export async function describeActionExecutorFromPage(page) {
  return evaluatePagePortAlias(page, 'action_executor_describe')
}

export async function describeActionContextFromPage(page) {
  return evaluatePagePortAlias(page, 'action_context_describe')
}

export async function describeActionUsageFromPage(page, options = {}) {
  return evaluatePagePortAlias(page, 'action_usage_describe', [options])
}

export async function describePerceptionRegistryFromPage(page) {
  return evaluatePagePortAlias(page, 'perception_registry_describe')
}

export async function describePerceptionContextFromPage(page) {
  return evaluatePagePortAlias(page, 'perception_context_describe')
}

export async function describeDataQueryExecutorFromPage(page) {
  return evaluatePagePortAlias(page, 'data_query_executor_describe')
}

export async function describeDataQueryContextFromPage(page) {
  return evaluatePagePortAlias(page, 'data_query_context_describe')
}

export async function describeDataQueryEngineFromPage(page) {
  return evaluatePagePortAlias(page, 'data_query_engine_describe')
}

export async function describeStateManagerFromPage(page) {
  return evaluatePagePortAlias(page, 'state_manager_describe')
}

export async function describeTraceRecorderFromPage(page) {
  return evaluatePagePortAlias(page, 'trace_recorder_describe')
}

export async function describeResponseRecorderFromPage(page) {
  return evaluatePagePortAlias(page, 'response_recorder_describe')
}

export async function describeLinkEngineFromPage(page) {
  return evaluatePagePortAlias(page, 'link_engine_describe')
}

export async function planWorkspaceFromPage(page, options = {}) {
  return evaluatePagePortAlias(page, 'workspace_plan', [options])
}

export async function describeAgentLoopFromPage(page, options = {}) {
  return evaluatePagePortAlias(page, 'agent_loop_describe', [options])
}

export async function listWidgetAdaptersFromPage(page) {
  return evaluatePagePortAlias(page, 'widget_adapter_list')
}

export async function readViewFromPage(page, options = {}) {
  return evaluatePagePortAlias(page, 'view_read', [options])
}

export async function readSnapshotFromPage(page, options = {}) {
  return evaluatePagePortAlias(page, 'read_snapshot', [options])
}

export async function readStateHistoryFromPage(page, options = {}) {
  return evaluatePagePortAlias(page, 'state_history_read', [options])
}

export async function listBranchesFromPage(page) {
  return evaluatePagePortAlias(page, 'branch_list')
}

export async function jumpToStateOnPage(page, options = {}) {
  return evaluatePagePortAlias(page, 'jump_to_state', [options])
}

export async function branchFromStateOnPage(page, options = {}) {
  return evaluatePagePortAlias(page, 'branch_from_state', [options])
}

export async function runActionOnPage(page, call) {
  return evaluatePagePortAlias(page, 'action_run', [call])
}

export async function runVerifiedActionOnPage(page, call, options = {}) {
  return evaluatePagePortAlias(page, 'verified_action_run', [call, options])
}

export async function queryPerceptionOnPage(page, call) {
  return evaluatePagePortAlias(page, 'perception_query', [call])
}

export async function queryDataOnPage(page, call) {
  return evaluatePagePortAlias(page, 'data_query', [call])
}

export async function readInteractionTraceFromPage(page, options = {}) {
  return evaluatePagePortAlias(page, 'interaction_trace_read', [options])
}

export async function readTraceGraphFromPage(page, options = {}) {
  return evaluatePagePortAlias(page, 'trace_graph_read', [options])
}

export async function readLatestAgentResponseFromPage(page, options = {}) {
  return evaluatePagePortAlias(page, 'agent_response_read', [options])
}

export async function listAgentResponsesFromPage(page, options = {}) {
  return evaluatePagePortAlias(page, 'agent_response_list', [options])
}

export async function evaluateLinkPropagationOnPage(page, options = {}) {
  return evaluatePagePortAlias(page, 'link_propagation_evaluate', [options])
}

export async function readWorkspaceSnapshotFromPage(page, options = {}) {
  return evaluatePagePortAlias(page, 'workspace_snapshot_read', [options])
}

export async function recordAgentResponseOnPage(page, record = {}) {
  return evaluatePagePortAlias(page, 'agent_response_record', [record])
}

export function buildScatterBrushCall({
  callId = 'call-001',
  xField,
  yField,
  xRange,
  yRange,
  targetRef,
  actor = 'agent',
}) {
  return {
    callId,
    name: 'scatter.brushRegion',
    actor,
    ...(targetRef ? { targetRef } : {}),
    params: {
      ...(targetRef ? { targetRef } : {}),
      xField,
      yField,
      xRange,
      yRange,
    },
  }
}
