import { installWebSocketBridge } from '../webSocketBridge.js'
import { createWebSocketTransportClient } from '../webSocketClient.js'
import { runPagePortAgentLoop } from '../../core/runtime/pagePortAgentLoop.js'

const WEBSOCKET_CLIENT_OPTION_KEYS = new Set([
  'socket',
  'url',
  'protocols',
  'WebSocketImpl',
  'timeoutMs',
])

function splitWebSocketExampleOptions(options = {}, clientOptions = null) {
  if (clientOptions != null) {
    return {
      requestOptions: options || {},
      transportOptions: clientOptions || {},
    }
  }

  const source = options && typeof options === 'object' ? options : {}
  const requestOptions = {}
  const transportOptions = {}

  for (const [key, value] of Object.entries(source)) {
    if (WEBSOCKET_CLIENT_OPTION_KEYS.has(key)) {
      transportOptions[key] = value
      continue
    }
    requestOptions[key] = value
  }

  return {
    requestOptions,
    transportOptions,
  }
}

export function installWidgetVAWebSocketBridge(options = {}) {
  return installWebSocketBridge(options)
}

export function createWidgetVAWebSocketClient(options = {}) {
  return createWebSocketTransportClient(options)
}

export async function describePagePortFromWebSocket(options = {}, clientOptions = null) {
  const { transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.describePagePort()
}

export async function describeWorkspaceFromWebSocket(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.describeWorkspace(requestOptions)
}

export async function planWorkspaceFromWebSocket(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.planWorkspace(requestOptions)
}

export async function describeRuntimeCoreFromWebSocket(options = {}, clientOptions = null) {
  const { transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.describeRuntimeCore()
}

export async function describeRuntimeStoreFromWebSocket(options = {}, clientOptions = null) {
  const { transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.describeRuntimeStore()
}

export async function describeWidgetRegistryFromWebSocket(options = {}, clientOptions = null) {
  const { transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.describeWidgetRegistry()
}

export async function describeActionExecutorFromWebSocket(options = {}, clientOptions = null) {
  const { transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.describeActionExecutor()
}

export async function describeActionContextFromWebSocket(options = {}, clientOptions = null) {
  const { transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.describeActionContext()
}

export async function describePerceptionRegistryFromWebSocket(options = {}, clientOptions = null) {
  const { transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.describePerceptionRegistry()
}

export async function describePerceptionContextFromWebSocket(options = {}, clientOptions = null) {
  const { transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.describePerceptionContext()
}

export async function describeDataQueryExecutorFromWebSocket(options = {}, clientOptions = null) {
  const { transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.describeDataQueryExecutor()
}

export async function describeDataQueryContextFromWebSocket(options = {}, clientOptions = null) {
  const { transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.describeDataQueryContext()
}

export async function describeDataQueryEngineFromWebSocket(options = {}, clientOptions = null) {
  const { transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.describeDataQueryEngine()
}

export async function describeStateManagerFromWebSocket(options = {}, clientOptions = null) {
  const { transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.describeStateManager()
}

export async function describeTraceRecorderFromWebSocket(options = {}, clientOptions = null) {
  const { transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.describeTraceRecorder()
}

export async function describeAgentLoopFromWebSocket(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.describeAgentLoop(requestOptions)
}

export async function readObservationFromWebSocket(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.readObservation(requestOptions)
}

export async function describeResponseRecorderFromWebSocket(options = {}, clientOptions = null) {
  const { transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.describeResponseRecorder()
}

export async function describeLinkEngineFromWebSocket(options = {}, clientOptions = null) {
  const { transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.describeLinkEngine()
}

export async function listWidgetAdaptersFromWebSocket(options = {}, clientOptions = null) {
  const { transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.listWidgetAdapters()
}

export async function readLatestCoordinationResultFromWebSocket(options = {}, clientOptions = null) {
  const { transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.readLatestCoordinationResult()
}

export async function readViewFromWebSocket(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.readView(requestOptions)
}

export async function readSnapshotFromWebSocket(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.readSnapshot(requestOptions)
}

export async function readStateHistoryFromWebSocket(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.readStateHistory(requestOptions)
}

export async function listBranchesFromWebSocket(options = {}, clientOptions = null) {
  const { transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.listBranches()
}

export async function jumpToStateFromWebSocket(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.jumpToState(requestOptions)
}

export async function branchFromStateFromWebSocket(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.branchFromState(requestOptions)
}

export async function queryPerceptionFromWebSocket(call = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitWebSocketExampleOptions(call, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.queryPerception(requestOptions)
}

export async function queryDataFromWebSocket(call = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitWebSocketExampleOptions(call, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.queryData(requestOptions)
}

export async function runActionFromWebSocket({ call, ...options } = {}, clientOptions = null) {
  const { transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.runAction(call)
}

export async function runVerifiedActionFromWebSocket({ call, options = {}, ...clientLikeOptions } = {}, clientOptions = null) {
  const { transportOptions } = splitWebSocketExampleOptions(clientLikeOptions, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.runVerifiedAction(call, options)
}

export async function runAgentLoopFromWebSocket(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return runPagePortAgentLoop(client, requestOptions)
}

export async function readInteractionTraceFromWebSocket(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.readInteractionTrace(requestOptions)
}

export async function readTraceGraphFromWebSocket(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.readTraceGraph(requestOptions)
}

export async function readLatestAgentResponseFromWebSocket(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.readLatestAgentResponse(requestOptions)
}

export async function listAgentResponsesFromWebSocket(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.listAgentResponses(requestOptions)
}

export async function recordAgentResponseFromWebSocket(record = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitWebSocketExampleOptions(record, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.recordAgentResponse(requestOptions)
}

export async function evaluateLinkPropagationFromWebSocket(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitWebSocketExampleOptions(options, clientOptions)
  const client = createWebSocketTransportClient(transportOptions)
  return client.evaluateLinkPropagation(requestOptions)
}
