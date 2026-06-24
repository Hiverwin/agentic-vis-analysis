import { createBrowserExtensionTransportClient } from '../browserExtensionClient.js'
import { installBrowserExtensionBridge } from '../browserExtensionBridge.js'

const EXTENSION_CLIENT_OPTION_KEYS = new Set([
  'targetWindow',
  'responseWindow',
  'targetOrigin',
  'timeoutMs',
])

function splitBrowserExtensionExampleOptions(options = {}, clientOptions = null) {
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
    if (EXTENSION_CLIENT_OPTION_KEYS.has(key)) {
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

export function installWidgetVABrowserExtensionBridge(options = {}) {
  return installBrowserExtensionBridge(options)
}

export function createWidgetVABrowserExtensionClient(options = {}) {
  return createBrowserExtensionTransportClient(options)
}

export async function describePagePortFromExtension(options = {}, clientOptions = null) {
  const { transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.describePagePort()
}

export async function describeWorkspaceFromExtension(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.describeWorkspace(requestOptions)
}

export async function planWorkspaceFromExtension(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.planWorkspace(requestOptions)
}

export async function describeRuntimeCoreFromExtension(options = {}, clientOptions = null) {
  const { transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.describeRuntimeCore()
}

export async function describeRuntimeStoreFromExtension(options = {}, clientOptions = null) {
  const { transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.describeRuntimeStore()
}

export async function describeWidgetRegistryFromExtension(options = {}, clientOptions = null) {
  const { transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.describeWidgetRegistry()
}

export async function describeActionExecutorFromExtension(options = {}, clientOptions = null) {
  const { transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.describeActionExecutor()
}

export async function describeActionContextFromExtension(options = {}, clientOptions = null) {
  const { transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.describeActionContext()
}

export async function describePerceptionRegistryFromExtension(options = {}, clientOptions = null) {
  const { transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.describePerceptionRegistry()
}

export async function describePerceptionContextFromExtension(options = {}, clientOptions = null) {
  const { transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.describePerceptionContext()
}

export async function describeDataQueryExecutorFromExtension(options = {}, clientOptions = null) {
  const { transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.describeDataQueryExecutor()
}

export async function describeDataQueryContextFromExtension(options = {}, clientOptions = null) {
  const { transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.describeDataQueryContext()
}

export async function describeDataQueryEngineFromExtension(options = {}, clientOptions = null) {
  const { transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.describeDataQueryEngine()
}

export async function describeStateManagerFromExtension(options = {}, clientOptions = null) {
  const { transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.describeStateManager()
}

export async function describeTraceRecorderFromExtension(options = {}, clientOptions = null) {
  const { transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.describeTraceRecorder()
}

export async function describeAgentLoopFromExtension(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.describeAgentLoop(requestOptions)
}

export async function describeResponseRecorderFromExtension(options = {}, clientOptions = null) {
  const { transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.describeResponseRecorder()
}

export async function describeLinkEngineFromExtension(options = {}, clientOptions = null) {
  const { transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.describeLinkEngine()
}

export async function listWidgetAdaptersFromExtension(options = {}, clientOptions = null) {
  const { transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.listWidgetAdapters()
}

export async function readViewFromExtension(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.readView(requestOptions)
}

export async function readSnapshotFromExtension(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.readSnapshot(requestOptions)
}

export async function readStateHistoryFromExtension(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.readStateHistory(requestOptions)
}

export async function listBranchesFromExtension(options = {}, clientOptions = null) {
  const { transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.listBranches()
}

export async function jumpToStateFromExtension(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.jumpToState(requestOptions)
}

export async function branchFromStateFromExtension(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.branchFromState(requestOptions)
}

export async function queryPerceptionFromExtension(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.queryPerception(requestOptions)
}

export async function queryDataFromExtension(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.queryData(requestOptions)
}

export async function runActionFromExtension(callOrOptions = {}, clientOptions = null) {
  if (callOrOptions && typeof callOrOptions === 'object' && 'call' in callOrOptions) {
    const { call = null, ...options } = callOrOptions
    const { transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
    const client = createWidgetVABrowserExtensionClient(transportOptions)
    return client.runAction(call)
  }

  const client = createWidgetVABrowserExtensionClient(clientOptions || {})
  return client.runAction(callOrOptions)
}

export async function runVerifiedActionFromExtension({ call, options = {}, ...clientLikeOptions } = {}, clientOptions = null) {
  const { transportOptions } = splitBrowserExtensionExampleOptions(clientLikeOptions, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.runVerifiedAction(call, options)
}

export async function readInteractionTraceFromExtension(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.readInteractionTrace(requestOptions)
}

export async function readTraceGraphFromExtension(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.readTraceGraph(requestOptions)
}

export async function readLatestAgentResponseFromExtension(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.readLatestAgentResponse(requestOptions)
}

export async function listAgentResponsesFromExtension(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.listAgentResponses(requestOptions)
}

export async function recordAgentResponseFromExtension(record = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitBrowserExtensionExampleOptions(record, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.recordAgentResponse(requestOptions)
}

export async function evaluateLinkPropagationFromExtension(options = {}, clientOptions = null) {
  const { requestOptions, transportOptions } = splitBrowserExtensionExampleOptions(options, clientOptions)
  const client = createWidgetVABrowserExtensionClient(transportOptions)
  return client.evaluateLinkPropagation(requestOptions)
}
