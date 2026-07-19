function normalizeArgs(args) {
  return Array.isArray(args) ? args : [args]
}

function createInvokerMethod(invoke, alias, buildArgs = () => []) {
  return (...args) => invoke(alias, normalizeArgs(buildArgs(...args)))
}

export function createPagePortClient({
  invoke,
  ready = undefined,
  close = undefined,
  socket = undefined,
} = {}) {
  if (typeof invoke !== 'function') {
    throw new Error('createPagePortClient requires an invoke(alias, args) function.')
  }

  return {
    invoke,
    ...(ready === undefined ? {} : { ready }),
    ...(socket === undefined ? {} : { socket }),
    ...(typeof close === 'function' ? { close } : {}),

    describePagePort: createInvokerMethod(invoke, 'page_port_describe'),
    describeWorkspace: createInvokerMethod(invoke, 'workspace_describe', (options = {}) => [options]),
    parseRef: createInvokerMethod(invoke, 'ref_parse', (ref) => [{ ref }]),

    readView: createInvokerMethod(invoke, 'view_read', (options = {}) => [options]),
    readState: createInvokerMethod(invoke, 'view_read', (options = {}) => [options]),
    readSnapshot: createInvokerMethod(invoke, 'read_snapshot', (options = {}) => [options]),
    readStateHistory: createInvokerMethod(invoke, 'state_history_read', (options = {}) => [options]),
    listBranches: createInvokerMethod(invoke, 'branch_list'),
    jumpToState: createInvokerMethod(invoke, 'jump_to_state', (options = {}) => [options]),
    branchFromState: createInvokerMethod(invoke, 'branch_from_state', (options = {}) => [options]),
    replay: createInvokerMethod(invoke, 'workspace_replay', (options = {}) => [options]),

    runAction: createInvokerMethod(invoke, 'action_run', (call = {}) => [call]),
    executeAction: createInvokerMethod(invoke, 'action_run', (call = {}) => [call]),
    runVerifiedAction: createInvokerMethod(invoke, 'verified_action_run', (call = {}, options = {}) => [call, options]),
    queryPerception: createInvokerMethod(invoke, 'perception_query', (call = {}) => [call]),
    queryData: createInvokerMethod(invoke, 'data_query', (call = {}) => [call]),
    runDataQuery: createInvokerMethod(invoke, 'data_query', (call = {}) => [call]),

    readInteractionTrace: createInvokerMethod(invoke, 'interaction_trace_read', (options = {}) => [options]),
    readTrace: createInvokerMethod(invoke, 'interaction_trace_read', (options = {}) => [options]),
    readTraceGraph: createInvokerMethod(invoke, 'trace_graph_read', (options = {}) => [options]),
    readLatestAgentResponse: createInvokerMethod(invoke, 'agent_response_read', (options = {}) => [options]),
    listAgentResponses: createInvokerMethod(invoke, 'agent_response_list', (options = {}) => [options]),
    recordAgentResponse: createInvokerMethod(invoke, 'agent_response_record', (record = {}) => [record]),
    evaluateLinkPropagation: createInvokerMethod(invoke, 'link_propagation_evaluate', (options = {}) => [options]),
  }
}
