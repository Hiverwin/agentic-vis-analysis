const DEFAULT_METRICS = {
  gutterWidth: 74,
  columnWidth: 120,
  nodeWidth: 102,
  nodeHeight: 42,
  bandHeight: 56,
  topPadding: 12,
  bottomPadding: 12,
  leftInset: 10,
  rightInset: 16,
  nodeInsetX: 8,
  nodeInsetY: 6,
}

function buildRenderEdges(model, renderNodes = []) {
  const renderNodeIds = new Set(renderNodes.map((node) => node.id))
  const originalEdges = Array.isArray(model?.edges) ? model.edges : []
  const originalBranchEdgeByTo = new Map(
    originalEdges
      .filter((edge) => edge?.kind === 'branch')
      .map((edge) => [edge.to, edge]),
  )
  const visibleIncomingEdgeByTo = new Map(
    originalEdges
      .filter((edge) => renderNodeIds.has(edge.from) && renderNodeIds.has(edge.to))
      .map((edge) => [edge.to, edge]),
  )
  const renderSteps = Array.isArray(model?.steps)
    ? model.steps.filter((step) => renderNodeIds.has(step.id))
    : []

  const renderEdges = []
  let previousVisibleStep = null

  for (const step of renderSteps) {
    if (!previousVisibleStep) {
      previousVisibleStep = step
      continue
    }

    let fromId = previousVisibleStep.id
    let kind = previousVisibleStep.actor !== step.actor ? 'handoff' : 'sequence'
    const originalVisibleIncoming = visibleIncomingEdgeByTo.get(step.id) || null
    const originalBranchIncoming = originalBranchEdgeByTo.get(step.id) || null

    if (step.transitionType === 'branch' && originalBranchIncoming && renderNodeIds.has(originalBranchIncoming.from)) {
      fromId = originalBranchIncoming.from
      kind = 'branch'
    } else if (originalVisibleIncoming) {
      fromId = originalVisibleIncoming.from
      kind = originalVisibleIncoming.kind
    } else if (step.transitionType === 'branch') {
      kind = 'branch'
    } else if (step.transitionType === 'handoff') {
      kind = 'handoff'
    }

    if (fromId !== step.id) {
      renderEdges.push({
        id: `${fromId}__${step.id}__render`,
        from: fromId,
        to: step.id,
        kind,
      })
    }

    previousVisibleStep = step
  }

  return renderEdges
}

export function buildTraceStreamLayout(model, overrides = {}) {
  const metrics = { ...DEFAULT_METRICS, ...(overrides || {}) }
  const collapsedSegmentIds = Array.isArray(overrides?.collapsedSegmentIds) ? overrides.collapsedSegmentIds : []
  const collapsedSegmentIdSet = new Set(collapsedSegmentIds)
  const streamBands = Array.isArray(model?.streamBands) && model.streamBands.length > 0
    ? model.streamBands
    : [{
        id: model?.mainBranchId || 'main',
        branchId: model?.mainBranchId || 'main',
        depth: 0,
        label: 'Main',
        startSequenceIndex: 0,
      }]

  const bandCount = Math.max(streamBands.length, 1)
  const stepCount = Math.max(model?.stepCount || 0, 1)
  const canvasWidth = Math.max(stepCount * metrics.columnWidth, metrics.columnWidth + 24)
  const canvasHeight = metrics.topPadding + metrics.bottomPadding + (bandCount * metrics.bandHeight)

  const placedNodes = Array.isArray(model?.nodes)
    ? model.nodes.map((node) => ({
        ...node,
        x: (node.sequenceIndex * metrics.columnWidth) + metrics.nodeInsetX,
        y: metrics.topPadding + ((node.bandIndex || 0) * metrics.bandHeight) + metrics.nodeInsetY,
        width: metrics.nodeWidth,
        height: metrics.nodeHeight,
      }))
    : []

  const renderNodes = placedNodes.filter((node) => {
    if (!node?.segmentId || !collapsedSegmentIdSet.has(node.segmentId)) return true
    if (node.isSegmentEnd) return true
    if (node.selected) return true
    if (node.stepId === model?.selection?.currentStepId) return true
    return false
  })

  const bandLabels = streamBands.map((band) => ({
    ...band,
    x: 10,
    y: metrics.topPadding + ((band.depth || 0) * metrics.bandHeight) + 15,
  }))

  const bandRails = streamBands.map((band) => {
    const startX = metrics.leftInset + Math.max(0, (band.startSequenceIndex || 0) * metrics.columnWidth) + metrics.nodeInsetX
    const endX = Math.max(startX + 46, canvasWidth - metrics.rightInset)
    return {
      ...band,
      x: startX,
      y: metrics.topPadding + ((band.depth || 0) * metrics.bandHeight) + Math.round(metrics.nodeHeight / 2) + 1,
      width: Math.max(42, endX - startX),
      height: 10,
    }
  })

  const bandMarkers = streamBands
    .filter((band) => (band.depth || 0) > 0)
    .map((band) => {
      const rail = bandRails.find((entry) => entry.branchId === band.branchId)
      return {
        ...band,
        x: rail?.x || metrics.leftInset,
        y: metrics.topPadding + ((band.depth || 0) * metrics.bandHeight) + 2,
      }
    })

  const bandFlows = streamBands.map((band) => {
    const matchingNodes = placedNodes.filter((node) => node.branchId === band.branchId)
    const firstNode = matchingNodes[0] || null
    const latestNode = matchingNodes[matchingNodes.length - 1] || null
    const fallbackRail = bandRails.find((entry) => entry.branchId === band.branchId) || null
    const startX = firstNode
      ? Math.max(fallbackRail?.x || 0, firstNode.x - 5)
      : fallbackRail?.x || 0
    const endX = latestNode
      ? latestNode.x + latestNode.width + 4
      : (fallbackRail?.x || 0) + (fallbackRail?.width || 42)
    return {
      ...band,
      x: startX,
      y: metrics.topPadding + ((band.depth || 0) * metrics.bandHeight) + Math.round(metrics.nodeHeight / 2) - 2,
      width: Math.max(38, endX - startX),
      height: 8,
      stepCount: matchingNodes.length,
    }
  })

  const branchJunctions = streamBands
    .filter((band) => (band.depth || 0) > 0 && band.originStepId && band.entryStepId)
    .map((band) => {
      const rail = bandRails.find((entry) => entry.branchId === band.branchId) || null
      const flow = bandFlows.find((entry) => entry.branchId === band.branchId) || null
      return {
        ...band,
        x: Math.max(metrics.leftInset, (flow?.x || rail?.x || metrics.leftInset) - 1),
        y: metrics.topPadding + ((band.depth || 0) * metrics.bandHeight) + metrics.nodeHeight + 1,
      }
    })

  const segmentChips = Array.isArray(model?.segments)
    ? model.segments
      .filter((segment) => Number.isFinite(segment?.startSequenceIndex) && Number.isFinite(segment?.endSequenceIndex))
      .map((segment) => {
        const branchDepth = segment?.branchDepth || 0
        const x = (segment.startSequenceIndex * metrics.columnWidth) + metrics.nodeInsetX
        const endX = ((segment.endSequenceIndex + 1) * metrics.columnWidth) - 12
        const width = Math.max(46, endX - x)
        return {
          ...segment,
          x,
          y: metrics.topPadding + (branchDepth * metrics.bandHeight) - 10,
          width,
        }
      })
    : []

  const pathChips = Array.isArray(model?.pathSummaries)
    ? model.pathSummaries
      .filter((path) => (path?.stepCount || 0) > 0)
      .map((path) => {
      const branchDepth = path?.depth || 0
      const x = Math.max(
        metrics.leftInset + 2,
        (path.startSequenceIndex * metrics.columnWidth) + metrics.nodeInsetX,
      )
      const endX = ((path.endSequenceIndex + 1) * metrics.columnWidth) - 12
      const width = Math.max(80, endX - x)
      return {
        ...path,
        x,
        y: metrics.topPadding + (branchDepth * metrics.bandHeight) + 1,
        width,
      }
    })
    : []

  const renderEdges = buildRenderEdges(model, renderNodes)

  return {
    metrics,
    bandCount,
    canvasWidth,
    canvasHeight,
    bandLabels,
    bandRails,
    bandFlows,
    bandMarkers,
    branchJunctions,
    pathChips,
    segmentChips,
    placedNodes,
    renderNodes,
    renderEdges,
  }
}
