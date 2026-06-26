import {
  actionRun,
  actionContextDescribe,
  actionUsageDescribe,
  actionExecutorDescribe,
  agentLoopDescribe,
  branchFromState,
  branchList,
  dataQuery,
  dataQueryContextDescribe,
  dataQueryEngineDescribe,
  dataQueryExecutorDescribe,
  describePagePort,
  interactionTraceRead,
  jumpToState,
  listAgentResponses,
  linkEngineDescribe,
  linkPropagationEvaluate,
  listWidgetAdapters,
  parseWidgetVARef,
  perceptionQuery,
  perceptionContextDescribe,
  perceptionRegistryDescribe,
  readLatestAgentResponse,
  recordAgentResponse,
  runtimeCoreDescribe,
  responseRecorderDescribe,
  runtimeStoreDescribe,
  stateManagerDescribe,
  traceRecorderDescribe,
  widgetRegistryDescribe,
  snapshotRead,
  stateHistoryRead,
  traceGraphRead,
  verifiedActionRun,
  viewRead,
  workspaceDescribe,
  workspacePlan,
  workspaceSnapshotRead,
} from './inPageTransport.js'
import { filterAvailableWidgetVAMcpTools } from './availableMcpTools.js'
export { WIDGETVA_MCP_TOOLS } from './widgetvaMcpCatalog.js'
import { WIDGETVA_MCP_TOOLS } from './widgetvaMcpCatalog.js'

const TOOL_HANDLERS = {
  page_port_describe: describePagePort,
  runtime_core_describe: runtimeCoreDescribe,
  runtime_store_describe: runtimeStoreDescribe,
  widget_registry_describe: widgetRegistryDescribe,
  state_manager_describe: stateManagerDescribe,
  trace_recorder_describe: traceRecorderDescribe,
  response_recorder_describe: responseRecorderDescribe,
  link_engine_describe: linkEngineDescribe,
  workspace_describe: workspaceDescribe,
  ref_parse: ({ ref } = {}) => parseWidgetVARef(ref),
  widget_adapter_list: listWidgetAdapters,
  workspace_plan: workspacePlan,
  view_read: viewRead,
  read_snapshot: snapshotRead,
  state_history_read: stateHistoryRead,
  branch_list: branchList,
  action_run: actionRun,
  action_executor_describe: actionExecutorDescribe,
  action_context_describe: actionContextDescribe,
  action_usage_describe: actionUsageDescribe,
  perception_context_describe: perceptionContextDescribe,
  jump_to_state: jumpToState,
  branch_from_state: branchFromState,
  agent_loop_describe: agentLoopDescribe,
  verified_action_run: ({ call, options } = {}) => verifiedActionRun(call, options),
  perception_query: perceptionQuery,
  perception_registry_describe: perceptionRegistryDescribe,
  data_query: dataQuery,
  data_query_context_describe: dataQueryContextDescribe,
  data_query_engine_describe: dataQueryEngineDescribe,
  data_query_executor_describe: dataQueryExecutorDescribe,
  interaction_trace_read: interactionTraceRead,
  trace_graph_read: traceGraphRead,
  agent_response_read: readLatestAgentResponse,
  agent_response_list: listAgentResponses,
  link_propagation_evaluate: linkPropagationEvaluate,
  workspace_snapshot_read: workspaceSnapshotRead,
  agent_response_record: recordAgentResponse,
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

export async function invokeWidgetVAMcpTool(name, args = {}) {
  const handler = TOOL_HANDLERS[name]
  if (!handler) {
    throw new Error(`Unknown WidgetVA MCP tool: ${name}`)
  }
  return handler(args)
}
