import {
  WIDGETVA_EXTENSION_REQUEST_SOURCE,
  WIDGETVA_EXTENSION_REQUEST_TYPE,
  WIDGETVA_EXTENSION_RESPONSE_SOURCE,
  WIDGETVA_EXTENSION_RESPONSE_TYPE,
} from './browserExtensionBridge.js'
import { filterAvailableWidgetVAMcpTools } from './availableMcpTools.js'
import { WIDGETVA_MCP_TOOLS } from './widgetvaMcpCatalog.js'
import { attachWidgetWorkspaceTransportSurface } from './widgetWorkspaceTransportSurface.js'

function randomId() {
  return `widgetva_ext_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function createBrowserExtensionTransportClient({
  targetWindow = window,
  responseWindow = window,
  targetOrigin = '*',
  timeoutMs = 5000,
} = {}) {
  const invoke = (alias, args = []) =>
    new Promise((resolve, reject) => {
      const id = randomId()
      const timer = setTimeout(() => {
        responseWindow.removeEventListener('message', handleMessage)
        reject(new Error(`Timed out waiting for WidgetVA browser-extension response: ${alias}`))
      }, timeoutMs)

      const handleMessage = (event) => {
        const message = event?.data
        if (
          !message ||
          typeof message !== 'object' ||
          message.source !== WIDGETVA_EXTENSION_RESPONSE_SOURCE ||
          message.type !== WIDGETVA_EXTENSION_RESPONSE_TYPE ||
          message.id !== id
        ) {
          return
        }

        clearTimeout(timer)
        responseWindow.removeEventListener('message', handleMessage)
        if (message.ok) {
          resolve(message.result)
          return
        }
        reject(new Error(message?.error?.message || `WidgetVA browser-extension request failed: ${alias}`))
      }

      responseWindow.addEventListener('message', handleMessage)
      targetWindow.postMessage(
        {
          source: WIDGETVA_EXTENSION_REQUEST_SOURCE,
          type: WIDGETVA_EXTENSION_REQUEST_TYPE,
          id,
          alias,
          args: Array.isArray(args) ? args : [args],
        },
        targetOrigin,
      )
    })

  const client = {
    invoke,
    describePagePort() {
      return invoke('page_port_describe')
    },
    async listAvailableWidgetVAMcpTools() {
      let pagePortDescription = null
      try {
        pagePortDescription = await invoke('page_port_describe')
      } catch {
        pagePortDescription = null
      }

      return filterAvailableWidgetVAMcpTools({
        allTools: WIDGETVA_MCP_TOOLS,
        pagePortDescription,
      })
    },
    describeWorkspace(options = {}) {
      return invoke('workspace_describe', [options])
    },
    parseRef(ref) {
      return invoke('ref_parse', [{ ref }])
    },
    describeRuntimeCore() {
      return invoke('runtime_core_describe')
    },
    describeRuntimeStore() {
      return invoke('runtime_store_describe')
    },
    describeWidgetRegistry() {
      return invoke('widget_registry_describe')
    },
    describeActionExecutor() {
      return invoke('action_executor_describe')
    },
    describeActionContext() {
      return invoke('action_context_describe')
    },
    describeActionUsage(options = {}) {
      return invoke('action_usage_describe', [options])
    },
    describePerceptionRegistry() {
      return invoke('perception_registry_describe')
    },
    describePerceptionContext() {
      return invoke('perception_context_describe')
    },
    describeDataQueryExecutor() {
      return invoke('data_query_executor_describe')
    },
    describeDataQueryContext() {
      return invoke('data_query_context_describe')
    },
    describeDataQueryEngine() {
      return invoke('data_query_engine_describe')
    },
    describeStateManager() {
      return invoke('state_manager_describe')
    },
    describeTraceRecorder() {
      return invoke('trace_recorder_describe')
    },
    describeResponseRecorder() {
      return invoke('response_recorder_describe')
    },
    describeLinkEngine() {
      return invoke('link_engine_describe')
    },
    planWorkspace(options = {}) {
      return invoke('workspace_plan', [options])
    },
    describeAgentLoop(options = {}) {
      return invoke('agent_loop_describe', [options])
    },
    readObservation(options = {}) {
      return invoke('observation_read', [options])
    },
    listWidgetAdapters() {
      return invoke('widget_adapter_list')
    },
    readLatestCoordinationResult() {
      return invoke('latest_coordination_result_read')
    },
    readView(options = {}) {
      return invoke('view_read', [options])
    },
    readSnapshot(options = {}) {
      return invoke('read_snapshot', [options])
    },
    runAction(call) {
      return invoke('action_run', [call])
    },
    runVerifiedAction(call, options = {}) {
      return invoke('verified_action_run', [call, options])
    },
    queryPerception(call) {
      return invoke('perception_query', [call])
    },
    queryData(call) {
      return invoke('data_query', [call])
    },
    readInteractionTrace(options = {}) {
      return invoke('interaction_trace_read', [options])
    },
    readTraceGraph(options = {}) {
      return invoke('trace_graph_read', [options])
    },
    readStateHistory(options = {}) {
      return invoke('state_history_read', [options])
    },
    listBranches() {
      return invoke('branch_list')
    },
    readWorkspaceSnapshot(options = {}) {
      return invoke('workspace_snapshot_read', [options])
    },
    jumpToState(options = {}) {
      return invoke('jump_to_state', [options])
    },
    branchFromState(options = {}) {
      return invoke('branch_from_state', [options])
    },
    readLatestAgentResponse(options = {}) {
      return invoke('agent_response_read', [options])
    },
    listAgentResponses(options = {}) {
      return invoke('agent_response_list', [options])
    },
    recordAgentResponse(record = {}) {
      return invoke('agent_response_record', [record])
    },
    evaluateLinkPropagation(options = {}) {
      return invoke('link_propagation_evaluate', [options])
    },
  }

  return attachWidgetWorkspaceTransportSurface(client)
}
