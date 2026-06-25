function deriveNodeActionType(node) {
  if (node?.actionName || node?.queryName) {
    return 'tool_call'
  }
  if (node?.responseId) {
    return 'answer'
  }
  if (node?.transitionType === 'branch') {
    return 'user_query'
  }
  if (node?.transitionType === 'reset') {
    return 'reset'
  }
  if (node?.transitionType === 'undo' || node?.transitionType === 'jump_back') {
    return 'undo'
  }
  return 'baseline'
}

export function normalizeRuntimeTraceGraph(runtimeGraph) {
  const nodes = Array.isArray(runtimeGraph?.nodes) ? runtimeGraph.nodes : []
  const edges = Array.isArray(runtimeGraph?.edges) ? runtimeGraph.edges : []
  const normalizedNodes = nodes.map((node, index) => ({
    id: node.id,
    timestamp: node.timestamp ? Date.parse(node.timestamp) || index : index,
    tool_name: node.actionName || node.queryName || node.label || node.transitionType || 'state',
    label: node.label || node.actionName || node.queryName || node.id,
    action_type: deriveNodeActionType(node),
    branch_id: node.branchId || null,
    message_preview:
      node.transitionType && node.transitionType !== 'continue'
        ? node.transitionType
        : node.responsePreview || '',
    has_response: Boolean(node.responseId),
    response_id: node.responseId || null,
    response_actor: node.responseActor || null,
    response_preview: node.responsePreview || null,
    iteration: index,
  }))
  const normalizedEdges = edges.map((edge, index) => ({
    id: edge.id || `${edge.from_id}-${edge.to_id}-${index}`,
    from_id: edge.from_id,
    to_id: edge.to_id,
    timestamp: edge.timestamp ? Date.parse(edge.timestamp) || index : index,
    edge_type:
      edge.edge_type === 'branch'
        ? 'branch'
        : edge.edge_type === 'reset'
          ? 'jump_back'
          : edge.edge_type === 'undo'
            ? 'jump_back'
            : edge.edge_type === 'jump_back'
              ? 'jump_back'
              : 'continue',
    jump_type:
      edge.edge_type === 'reset'
        ? 'reset'
        : edge.edge_type === 'undo'
          ? 'undo'
          : edge.edge_type === 'jump_back'
            ? 'jump_back'
            : 'none',
    semantic_type: edge.edge_type || 'continue',
    iteration: index,
  }))
  return {
    baseline_node_id: normalizedNodes[0]?.id || null,
    current_node_id: runtimeGraph?.current_state_id || normalizedNodes[normalizedNodes.length - 1]?.id || null,
    nodes: normalizedNodes,
    edges: normalizedEdges,
  }
}

export function computeTraceGraphLayout(graph) {
  const nodes = Array.isArray(graph?.nodes) ? [...graph.nodes] : []
  const edges = Array.isArray(graph?.edges) ? [...graph.edges] : []
  nodes.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
  edges.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out = new Map()
  for (const e of edges) {
    if (!e?.from_id || !e?.to_id) continue
    if (!out.has(e.from_id)) out.set(e.from_id, [])
    out.get(e.from_id).push(e)
  }

  const root = graph?.baseline_node_id || nodes[0]?.id
  const depth = new Map()
  const q = []
  if (root) {
    depth.set(root, 0)
    q.push(root)
  }

  while (q.length) {
    const cur = q.shift()
    const d = depth.get(cur) || 0
    for (const e of out.get(cur) || []) {
      if (e.edge_type === 'jump_back' || e.edge_type === 'reset' || e.edge_type === 'undo') continue
      if (!byId.has(e.to_id)) continue
      const nd = d + 1
      if (!depth.has(e.to_id) || nd < depth.get(e.to_id)) {
        depth.set(e.to_id, nd)
        q.push(e.to_id)
      }
    }
  }

  const groups = new Map()
  for (const n of nodes) {
    const d = depth.get(n.id)
    if (d == null) continue
    if (!groups.has(d)) groups.set(d, [])
    groups.get(d).push(n)
  }
  for (const [d, arr] of groups.entries()) {
    arr.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    groups.set(d, arr)
  }

  const maxDepth = Math.max(0, ...Array.from(groups.keys()))
  const nodeW = 190
  const nodeH = 40
  const colGap = 52
  const rowGap = 18
  const margin = 16
  const positions = new Map()
  for (let d = 0; d <= maxDepth; d += 1) {
    const arr = groups.get(d) || []
    for (let i = 0; i < arr.length; i += 1) {
      positions.set(arr[i].id, {
        x: margin + d * (nodeW + colGap),
        y: margin + i * (nodeH + rowGap),
      })
    }
  }

  const width = margin * 2 + (maxDepth + 1) * nodeW + maxDepth * colGap
  const maxRows = Math.max(1, ...Array.from(groups.values()).map((a) => a.length))
  const height = margin * 2 + maxRows * nodeH + Math.max(0, maxRows - 1) * rowGap
  return { nodes, edges, positions, width, height, nodeW, nodeH, root }
}
