import { cloneJsonValue as clone } from '../../../shared/clone.js'
import {
  PAGE_PORT_ALIASES,
  PAGE_PORT_ERROR_CODES,
  PAGE_PORT_METHOD_DESCRIPTORS,
  PAGE_PORT_METHODS,
} from '../../../transports/pagePortProtocol.js'
import { parseRef as parseWidgetVARef } from '../../../contracts/refs-contracts.js'

function firstFunction(...candidates) {
  return candidates.find((candidate) => typeof candidate === 'function') || null
}

export function installWidgetVAPagePort({
  root = globalThis.window,
  api = {},
  describeWorkspace = null,
  readState = null,
  readView = null,
  readSnapshot = null,
  listStateHistory = null,
  listBranches = null,
  executeAction = null,
  executeVerifiedAction = null,
  jumpToState = null,
  branchFromState = null,
  replay = null,
  queryPerception = null,
  queryData = null,
  runDataQuery = null,
  readTrace = null,
  getInteractionTrace = null,
  getTraceGraph = null,
  getLatestAgentResponse = null,
  listAgentResponses = null,
  evaluateLinkPropagation = null,
  recordAgentResponse = null,
} = {}) {
  if (!root) throw new Error('installWidgetVAPagePort requires a root object such as window.')

  const describeWorkspaceFn = firstFunction(api.describeWorkspace?.bind(api), describeWorkspace)
  const readStateFn = firstFunction(api.readState?.bind(api), readState)
  const readViewFn = firstFunction(api.readView?.bind(api), readView, readStateFn)
  const readSnapshotFn = firstFunction(api.readSnapshot?.bind(api), readSnapshot)
  const listStateHistoryFn = firstFunction(api.listStateHistory?.bind(api), listStateHistory)
  const listBranchesFn = firstFunction(api.listBranches?.bind(api), listBranches)
  const executeActionFn = firstFunction(api.executeAction?.bind(api), executeAction)
  const executeVerifiedActionFn = firstFunction(api.executeVerifiedAction?.bind(api), executeVerifiedAction)
  const jumpToStateFn = firstFunction(api.jumpToState?.bind(api), jumpToState)
  const branchFromStateFn = firstFunction(api.branchFromState?.bind(api), branchFromState)
  const replayFn = firstFunction(api.replay?.bind(api), replay, jumpToStateFn)
  const queryPerceptionFn = firstFunction(api.queryPerception?.bind(api), queryPerception)
  const queryDataFn = firstFunction(
    api.queryData?.bind(api),
    api.runDataQuery?.bind(api),
    queryData,
    runDataQuery,
  )
  const readTraceFn = firstFunction(api.readTrace?.bind(api), api.getInteractionTrace?.bind(api), readTrace, getInteractionTrace)
  const getTraceGraphFn = firstFunction(api.getTraceGraph?.bind(api), getTraceGraph)
  const getLatestAgentResponseFn = firstFunction(api.getLatestAgentResponse?.bind(api), getLatestAgentResponse)
  const listAgentResponsesFn = firstFunction(api.listAgentResponses?.bind(api), listAgentResponses)
  const evaluateLinkPropagationFn = firstFunction(api.evaluateLinkPropagation?.bind(api), evaluateLinkPropagation)
  const recordAgentResponseFn = firstFunction(api.recordAgentResponse?.bind(api), recordAgentResponse)

  const port = {
    async describePagePort() {
      const methods = PAGE_PORT_METHODS.filter((name) => typeof port[name] === 'function')
      const methodSet = new Set(methods)
      const aliases = Object.fromEntries(
        Object.entries(PAGE_PORT_ALIASES).filter(([, method]) => methodSet.has(method)),
      )
      const aliasSet = new Set(Object.keys(aliases))
      return {
        version: '1.0.0',
        methods,
        aliases,
        transportHints: {
          recommendedTools: ['workspace_describe', 'view_read', 'action_run', 'perception_query', 'interaction_trace_read']
            .filter((alias) => aliasSet.has(alias)),
          optionalTools: [
            'data_query',
            'trace_graph_read',
            'read_snapshot',
            'state_history_read',
            'branch_list',
            'verified_action_run',
            'jump_to_state',
            'branch_from_state',
            'link_propagation_evaluate',
            'agent_response_read',
            'agent_response_list',
            'agent_response_record',
          ].filter((alias) => aliasSet.has(alias)),
          note: 'External transports should call stable page-port methods only; runtime internals are intentionally not exposed.',
        },
        methodDescriptors: Object.fromEntries(methods.map((name) => {
          const descriptor = clone(PAGE_PORT_METHOD_DESCRIPTORS[name] || {
            stability: 'stable',
            aliases: [],
            inputSchema: { type: 'object', additionalProperties: true, properties: {} },
            returns: { kind: 'result', description: '' },
            errors: [],
          })
          descriptor.aliases = Object.entries(PAGE_PORT_ALIASES)
            .filter(([, methodName]) => methodName === name)
            .map(([alias]) => alias)
          return [name, descriptor]
        })),
        errorCatalog: clone(PAGE_PORT_ERROR_CODES),
      }
    },
    ...(describeWorkspaceFn ? { describeWorkspace: (options = {}) => describeWorkspaceFn(options) } : {}),
    parseRef: (options = {}) => parseWidgetVARef(options?.ref),
    ...(readStateFn || readViewFn
      ? {
          readState: (options = {}) => (readStateFn || readViewFn)(options),
          readView: (options = {}) => (readViewFn || readStateFn)(options),
        }
      : {}),
    ...(readSnapshotFn ? { readSnapshot: (options = {}) => readSnapshotFn(options) } : {}),
    ...(listStateHistoryFn ? { listStateHistory: (options = {}) => listStateHistoryFn(options) } : {}),
    ...(listBranchesFn ? { listBranches: (options = {}) => listBranchesFn(options) } : {}),
    ...(executeActionFn ? { executeAction: (call = {}) => executeActionFn(call) } : {}),
    ...(executeVerifiedActionFn
      ? { executeVerifiedAction: (call = {}, options = {}) => executeVerifiedActionFn(call, options) }
      : {}),
    ...(jumpToStateFn
      ? {
          jumpToState: (options = {}) => jumpToStateFn(options),
          replay: (options = {}) => replayFn(options),
        }
      : {}),
    ...(branchFromStateFn ? { branchFromState: (options = {}) => branchFromStateFn(options) } : {}),
    ...(queryPerceptionFn ? { queryPerception: (call = {}) => queryPerceptionFn(call) } : {}),
    ...(queryDataFn
      ? {
          runDataQuery: (call = {}) => queryDataFn(call),
          queryData: (call = {}) => queryDataFn(call),
        }
      : {}),
    ...(readTraceFn
      ? {
          readTrace: (options = {}) => readTraceFn(options),
          getInteractionTrace: (options = {}) => readTraceFn(options),
        }
      : {}),
    ...(getTraceGraphFn ? { getTraceGraph: (options = {}) => getTraceGraphFn(options) } : {}),
    ...(getLatestAgentResponseFn
      ? { getLatestAgentResponse: (options = {}) => getLatestAgentResponseFn(options) }
      : {}),
    ...(listAgentResponsesFn ? { listAgentResponses: (options = {}) => listAgentResponsesFn(options) } : {}),
    ...(evaluateLinkPropagationFn
      ? { evaluateLinkPropagation: (options = {}) => evaluateLinkPropagationFn(options) }
      : {}),
    ...(recordAgentResponseFn ? { recordAgentResponse: (record = {}) => recordAgentResponseFn(record) } : {}),
  }

  for (const [alias, methodName] of Object.entries(PAGE_PORT_ALIASES)) {
    if (typeof port[methodName] === 'function') port[alias] = port[methodName]
  }

  root.__widgetVA = port
  return () => {
    if (root.__widgetVA === port) delete root.__widgetVA
  }
}
