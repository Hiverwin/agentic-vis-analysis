import {
  WIDGETVA_WEBSOCKET_REQUEST_SOURCE,
  WIDGETVA_WEBSOCKET_REQUEST_TYPE,
  WIDGETVA_WEBSOCKET_RESPONSE_SOURCE,
  WIDGETVA_WEBSOCKET_RESPONSE_TYPE,
} from './webSocketBridge.js'
import { filterAvailableWidgetVAMcpTools } from './availableMcpTools.js'
import { WIDGETVA_MCP_TOOLS } from './widgetvaMcpCatalog.js'
import { attachWidgetWorkspaceTransportSurface } from './widgetWorkspaceTransportSurface.js'

function randomId() {
  return `widgetva_ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function parseMessageEvent(event) {
  const payload = event?.data
  if (typeof payload !== 'string') return null
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

function createReadyPromise(socket) {
  if (socket.readyState === socket.OPEN) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const handleOpen = () => {
      cleanup()
      resolve()
    }
    const handleError = () => {
      cleanup()
      reject(new Error('WidgetVA WebSocket transport failed to connect.'))
    }
    const cleanup = () => {
      socket.removeEventListener('open', handleOpen)
      socket.removeEventListener('error', handleError)
    }
    socket.addEventListener('open', handleOpen)
    socket.addEventListener('error', handleError)
  })
}

export function createWebSocketTransportClient({
  socket = null,
  url = '',
  protocols = undefined,
  WebSocketImpl = globalThis.WebSocket,
  timeoutMs = 5000,
} = {}) {
  const activeSocket = socket || (url ? new WebSocketImpl(url, protocols) : null)
  if (!activeSocket) {
    throw new Error('createWebSocketTransportClient requires an existing socket or a WebSocket URL.')
  }

  const ready = createReadyPromise(activeSocket)
  const pending = new Map()

  const handleMessage = (event) => {
    const message = parseMessageEvent(event)
    if (
      !message ||
      typeof message !== 'object' ||
      message.source !== WIDGETVA_WEBSOCKET_RESPONSE_SOURCE ||
      message.type !== WIDGETVA_WEBSOCKET_RESPONSE_TYPE ||
      typeof message.id !== 'string'
    ) {
      return
    }

    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id)
    clearTimeout(entry.timer)
    if (message.ok) {
      entry.resolve(message.result)
      return
    }
    entry.reject(new Error(message?.error?.message || 'WidgetVA WebSocket request failed.'))
  }

  activeSocket.addEventListener('message', handleMessage)

  const invoke = async (alias, args = []) => {
    await ready
    return new Promise((resolve, reject) => {
      const id = randomId()
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`Timed out waiting for WidgetVA WebSocket response: ${alias}`))
      }, timeoutMs)
      pending.set(id, { resolve, reject, timer })
      activeSocket.send(JSON.stringify({
        source: WIDGETVA_WEBSOCKET_REQUEST_SOURCE,
        type: WIDGETVA_WEBSOCKET_REQUEST_TYPE,
        id,
        alias,
        args: Array.isArray(args) ? args : [args],
      }))
    })
  }

  const client = {
    socket: activeSocket,
    ready,
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
    close() {
      activeSocket.removeEventListener('message', handleMessage)
      activeSocket.close()
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
    describeWorkspace(options = {}) {
      return invoke('workspace_describe', [options])
    },
    planWorkspace(options = {}) {
      return invoke('workspace_plan', [options])
    },
    describeAgentLoop(options = {}) {
      return invoke('agent_loop_describe', [options])
    },
    listWidgetAdapters() {
      return invoke('widget_adapter_list')
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
