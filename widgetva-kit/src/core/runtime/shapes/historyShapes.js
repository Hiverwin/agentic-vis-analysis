export function makeStateSnapshotMeta(meta) {
  return {
    stateId: '',
    createdAt: null,
    baseStateId: null,
    branchId: null,
    transitionType: 'continue',
    branchLabel: null,
    actor: 'system',
    changedRefs: [],
    removedRefs: [],
    ...meta,
  }
}

export function makeBranchSummary(summary) {
  return {
    branchId: '',
    label: '',
    originStateId: null,
    parentBranchId: null,
    createdAt: new Date().toISOString(),
    ...summary,
  }
}

export function makeTraceGraphNode(node) {
  return {
    id: '',
    stateId: '',
    parentStateId: null,
    branchId: null,
    branchLabel: null,
    timestamp: null,
    actor: 'system',
    eventFamily: 'systemTransition',
    querySurface: null,
    actionName: null,
    queryName: null,
    responseId: null,
    responseActor: null,
    responsePreview: null,
    label: '',
    transitionType: 'continue',
    current: false,
    ...node,
  }
}

export function makeTraceGraphEdge(edge) {
  return {
    id: '',
    from_id: '',
    to_id: '',
    edge_type: 'continue',
    branchId: null,
    label: 'continue',
    timestamp: null,
    ...edge,
  }
}

export function makeTraceGraph(graph) {
  return {
    current_state_id: null,
    current_branch_id: null,
    sinceStateId: null,
    actors: [],
    ...graph,
    branches: Array.isArray(graph?.branches)
      ? graph.branches.map((branch) => makeBranchSummary(branch))
      : [],
    nodes: Array.isArray(graph?.nodes)
      ? graph.nodes.map((node) => makeTraceGraphNode(node))
      : [],
    edges: Array.isArray(graph?.edges)
      ? graph.edges.map((edge) => makeTraceGraphEdge(edge))
      : [],
  }
}
