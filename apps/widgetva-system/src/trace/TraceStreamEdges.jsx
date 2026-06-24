function buildEdgePath(edge, nodeMap) {
  const fromNode = nodeMap.get(edge.from)
  const toNode = nodeMap.get(edge.to)
  if (!fromNode || !toNode) return null

  const x1 = fromNode.x + fromNode.width - 4
  const x2 = toNode.x + 4
  const y1 = fromNode.y + fromNode.height / 2
  const y2 = toNode.y + toNode.height / 2

  if (edge.kind === 'sequence') {
    const curve = Math.max(22, Math.abs(x2 - x1) * 0.3)
    return `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`
  }
  if (edge.kind === 'handoff') {
    const curve = Math.max(28, Math.abs(x2 - x1) * 0.33)
    return `M ${x1} ${y1} C ${x1 + curve} ${y1 - 5}, ${x2 - curve} ${y2 + 5}, ${x2} ${y2}`
  }
  const curve = Math.max(30, Math.abs(x2 - x1) * 0.36)
  return `M ${x1} ${y1} C ${x1 + curve} ${y1 - 1}, ${x2 - curve} ${y2 + 1}, ${x2} ${y2}`
}

export function TraceStreamEdges({
  edges,
  nodes,
  width,
  height,
  currentBranchId = null,
  selectedBranchId = null,
  branchFocusActive = false,
  selectedStepId = null,
}) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))

  return (
    <svg className="trace-edge-layer" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {edges.map((edge) => {
        const path = buildEdgePath(edge, nodeMap)
        const fromNode = nodeMap.get(edge.from)
        const toNode = nodeMap.get(edge.to)
        if (!path) return null
        const isSelected = fromNode?.stepId === selectedStepId || toNode?.stepId === selectedStepId
        const isCurrentBranch = Boolean(currentBranchId) && (
          fromNode?.branchId === currentBranchId || toNode?.branchId === currentBranchId
        )
        const isSelectedBranch = Boolean(selectedBranchId) && (
          fromNode?.branchId === selectedBranchId || toNode?.branchId === selectedBranchId
        )
        const isMuted = branchFocusActive && !isCurrentBranch && !isSelectedBranch
        return (
          <path
            key={edge.id}
            d={path}
            className={`trace-edge-line ${edge.kind} ${isCurrentBranch ? 'current-branch' : ''} ${isSelectedBranch ? 'selected-branch' : ''} ${isMuted ? 'muted' : ''} ${isSelected ? 'selected' : ''}`}
          />
        )
      })}
    </svg>
  )
}
