import { invokePagePortAlias } from './pagePortBridge.js'
import { filterAvailableWidgetVAMcpTools } from './availableMcpTools.js'
import { WIDGETVA_MCP_TOOLS } from './widgetvaMcpCatalog.js'
import {
  describeWidgetViaTransport,
  executeWidgetActionViaTransport,
  executeWorkspaceActionViaTransport,
  listAvailableActionsViaTransport,
  listAvailablePerceptionsViaTransport,
  queryWidgetPerceptionViaTransport,
  queryWorkspacePerceptionViaTransport,
  readWorkspaceCoordinationStateViaTransport,
  readWorkspaceObservationViaTransport,
  readWorkspacePropagationSummaryViaTransport,
  readWidgetStateViaTransport,
  readWidgetTraceViaTransport,
  readWorkspaceStateViaTransport,
  readWorkspaceTraceViaTransport,
  replayWidgetViaTransport,
  replayWorkspaceViaTransport,
} from './widgetWorkspaceTransportSurface.js'

export async function describePagePort() {
  return invokePagePortAlias('page_port_describe')
}

export async function listAvailableWidgetVAMcpTools() {
  let pagePortDescription = null
  try {
    pagePortDescription = await describePagePort()
  } catch {
    pagePortDescription = null
  }

  return filterAvailableWidgetVAMcpTools({
    allTools: WIDGETVA_MCP_TOOLS,
    pagePortDescription,
  })
}

export async function workspaceDescribe(options = {}) {
  return invokePagePortAlias('workspace_describe', [options])
}

async function observationRead(options = {}) {
  return invokePagePortAlias('observation_read', [options])
}

async function coordinationStateRead() {
  return invokePagePortAlias('coordination_state_read')
}

async function propagationSummaryRead(options = {}) {
  return invokePagePortAlias('propagation_summary_read', [options])
}

async function availableActionsList() {
  return invokePagePortAlias('available_actions_list')
}

async function availablePerceptionsList() {
  return invokePagePortAlias('available_perceptions_list')
}

const inPageTransportDelegate = {
  describeWorkspace: workspaceDescribe,
  readObservation: observationRead,
  readCoordinationState: coordinationStateRead,
  readPropagationSummary: propagationSummaryRead,
  listAvailableActions: availableActionsList,
  listAvailablePerceptions: availablePerceptionsList,
  readState: readWorkspaceState,
  readView: viewRead,
  executeAction,
  runAction: actionRun,
  queryPerception: perceptionQuery,
  runDataQuery,
  readTrace,
  readInteractionTrace: interactionTraceRead,
  replay,
  jumpToState,
}

export async function describeWidget(options = {}) {
  return describeWidgetViaTransport(inPageTransportDelegate, options)
}

export async function parseWidgetVARef(ref) {
  return invokePagePortAlias('ref_parse', [{ ref }])
}

export async function runtimeCoreDescribe() {
  return invokePagePortAlias('runtime_core_describe')
}

export async function runtimeStoreDescribe() {
  return invokePagePortAlias('runtime_store_describe')
}

export async function widgetRegistryDescribe() {
  return invokePagePortAlias('widget_registry_describe')
}

export async function actionExecutorDescribe() {
  return invokePagePortAlias('action_executor_describe')
}

export async function actionContextDescribe() {
  return invokePagePortAlias('action_context_describe')
}

export async function actionUsageDescribe(options = {}) {
  return invokePagePortAlias('action_usage_describe', [options])
}

export async function perceptionRegistryDescribe() {
  return invokePagePortAlias('perception_registry_describe')
}

export async function perceptionContextDescribe() {
  return invokePagePortAlias('perception_context_describe')
}

export async function dataQueryExecutorDescribe() {
  return invokePagePortAlias('data_query_executor_describe')
}

export async function dataQueryContextDescribe() {
  return invokePagePortAlias('data_query_context_describe')
}

export async function dataQueryEngineDescribe() {
  return invokePagePortAlias('data_query_engine_describe')
}

export async function stateManagerDescribe() {
  return invokePagePortAlias('state_manager_describe')
}

export async function traceRecorderDescribe() {
  return invokePagePortAlias('trace_recorder_describe')
}

export async function responseRecorderDescribe() {
  return invokePagePortAlias('response_recorder_describe')
}

export async function linkEngineDescribe() {
  return invokePagePortAlias('link_engine_describe')
}

export async function workspacePlan(options = {}) {
  return invokePagePortAlias('workspace_plan', [options])
}

export async function agentLoopDescribe(options = {}) {
  return invokePagePortAlias('agent_loop_describe', [options])
}

export async function listWidgetAdapters() {
  return invokePagePortAlias('widget_adapter_list')
}

export async function readObservation(options = {}) {
  return readWorkspaceObservationViaTransport(inPageTransportDelegate, options)
}

export async function readCoordinationState() {
  return readWorkspaceCoordinationStateViaTransport(inPageTransportDelegate)
}

export async function readPropagationSummary(options = {}) {
  return readWorkspacePropagationSummaryViaTransport(inPageTransportDelegate, options)
}

export async function listAvailableActions() {
  return listAvailableActionsViaTransport(inPageTransportDelegate)
}

export async function listAvailablePerceptions() {
  return listAvailablePerceptionsViaTransport(inPageTransportDelegate)
}

export async function viewRead(options = {}) {
  return invokePagePortAlias('view_read', [options])
}

export async function readWorkspaceState(options = {}) {
  return readWorkspaceStateViaTransport(inPageTransportDelegate, options)
}

export async function readState(options = {}) {
  return readWorkspaceState(options)
}

export async function readWidgetState(options = {}) {
  return readWidgetStateViaTransport(inPageTransportDelegate, options)
}

export async function snapshotRead(options = {}) {
  return invokePagePortAlias('read_snapshot', [options])
}

export async function stateHistoryRead(options = {}) {
  return invokePagePortAlias('state_history_read', [options])
}

export async function branchList() {
  return invokePagePortAlias('branch_list')
}

export async function actionRun(call) {
  return invokePagePortAlias('action_run', [call])
}

export async function executeWorkspaceAction(call = {}) {
  return executeWorkspaceActionViaTransport(inPageTransportDelegate, call)
}

export async function executeAction(call = {}) {
  return executeWorkspaceAction(call)
}

export async function executeWidgetAction(call = {}) {
  return executeWidgetActionViaTransport(inPageTransportDelegate, call)
}

export async function jumpToState(options = {}) {
  return invokePagePortAlias('jump_to_state', [options])
}

export async function branchFromState(options = {}) {
  return invokePagePortAlias('branch_from_state', [options])
}

export async function verifiedActionRun(call, options = {}) {
  return invokePagePortAlias('verified_action_run', [call, options])
}

export async function perceptionQuery(call) {
  return invokePagePortAlias('perception_query', [call])
}

export async function queryWorkspacePerception(call = {}) {
  return queryWorkspacePerceptionViaTransport(inPageTransportDelegate, call)
}

export async function queryWidgetPerception(call = {}) {
  return queryWidgetPerceptionViaTransport(inPageTransportDelegate, call)
}

export async function dataQuery(call) {
  return invokePagePortAlias('data_query', [call])
}

export async function runDataQuery(call = {}) {
  return dataQuery(call)
}

export async function interactionTraceRead(options = {}) {
  return invokePagePortAlias('interaction_trace_read', [options])
}

export async function readWorkspaceTrace(options = {}) {
  return readWorkspaceTraceViaTransport(inPageTransportDelegate, options)
}

export async function readTrace(options = {}) {
  return readWorkspaceTrace(options)
}

export async function readWidgetTrace(options = {}) {
  return readWidgetTraceViaTransport(inPageTransportDelegate, options)
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

export async function workspaceSnapshotRead(options = {}) {
  return invokePagePortAlias('workspace_snapshot_read', [options])
}

export async function recordAgentResponse(record = {}) {
  return invokePagePortAlias('agent_response_record', [record])
}

export async function replayWorkspace(stateIdOrOptions) {
  return replayWorkspaceViaTransport(inPageTransportDelegate, stateIdOrOptions)
}

export async function replay(stateIdOrOptions) {
  return replayWorkspace(stateIdOrOptions)
}

export async function replayWidget(stateIdOrOptions) {
  return replayWidgetViaTransport(inPageTransportDelegate, stateIdOrOptions)
}
