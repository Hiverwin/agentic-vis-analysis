import { cloneJsonValue as clone } from '../../../shared/clone.js'

const TRACE_LANES = [
  { id: 'human', label: 'Human' },
  { id: 'agent', label: 'Agent' },
]

function toSentenceCase(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return ''
  const normalized = value.replace(/[_-]+/g, ' ').trim()
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function normalizeActor(actor) {
  if (actor === 'human' || actor === 'agent') return actor
  return actor === 'system' ? 'agent' : 'human'
}

function normalizeStatus(status) {
  if (status === 'running' || status === 'failed' || status === 'partial') return status
  return 'ok'
}

function normalizeKind(kind) {
  if (['action', 'perception', 'data_query', 'replay', 'branch'].includes(kind)) return kind
  return 'action'
}

function normalizeTransitionType(value, actorChanged, kind) {
  if (value === 'continuation' || value === 'handoff' || value === 'branch') return value
  if (kind === 'branch') return 'branch'
  return actorChanged ? 'handoff' : 'continuation'
}

function normalizeDelta(stateDelta = {}) {
  return {
    selection: Boolean(stateDelta?.selection),
    focus: Boolean(stateDelta?.focus),
    highlight: Boolean(stateDelta?.highlight),
    viewport: Boolean(stateDelta?.viewport),
    evidence: Boolean(stateDelta?.evidence),
    branch: Boolean(stateDelta?.branch),
    propagation: Boolean(stateDelta?.propagation),
  }
}

function buildSummary(step) {
  if (step?.summary) return step.summary
  if (step?.label) return step.label
  if (step?.methodName) return toSentenceCase(step.methodName.split('.').pop())
  return 'Interaction step'
}

function buildShortLabel(step, kind) {
  if (step?.summary) return step.summary
  if (step?.label) return step.label
  if (step?.methodName) return toSentenceCase(step.methodName.split('.').pop())
  if (kind === 'data_query') return 'Query'
  if (kind === 'perception') return 'Verify'
  return 'Action'
}

function buildEvidenceText(step) {
  return step?.verificationSummary || step?.evidenceSummary || null
}

function buildKindLabel(kind) {
  if (kind === 'data_query') return 'Query'
  if (kind === 'perception') return 'Verify'
  if (kind === 'replay') return 'Replay'
  if (kind === 'branch') return 'Branch'
  return 'Action'
}

function buildOperationTopic(step, kind) {
  const name = `${step?.methodName || ''} ${step?.summary || ''}`.toLowerCase()
  if (/(brush|select|selection|highlight)/.test(name)) return 'selection'
  if (/(filter|domain|interval)/.test(name)) return 'filter'
  if (/(zoom|viewport|focus|reencode)/.test(name)) return 'view'
  if (kind === 'perception' || kind === 'data_query') return 'inspect'
  return 'action'
}

function buildStreamBands(steps = [], branches = []) {
  const mainBranchId = steps.find((step) => step.transitionType !== 'branch')?.branchId || steps[0]?.branchId || 'main'
  const branchDepthById = new Map([[mainBranchId, 0]])
  let nextDepth = 1

  for (const step of steps) {
    const branchId = step?.branchId || null
    if (!branchId || branchDepthById.has(branchId)) continue
    if (step.transitionType === 'branch') {
      branchDepthById.set(branchId, nextDepth)
      nextDepth += 1
      continue
    }
    branchDepthById.set(branchId, 0)
  }

  const branchMetaById = new Map((branches || []).map((branch) => [branch.branchId, branch]))
  const stepsByBranchId = new Map()
  for (const step of steps) {
    const branchId = step?.branchId || mainBranchId
    if (!stepsByBranchId.has(branchId)) stepsByBranchId.set(branchId, [])
    stepsByBranchId.get(branchId).push(step)
  }
  const streamBands = [...branchDepthById.entries()]
    .sort((left, right) => left[1] - right[1])
    .map(([branchId, depth]) => {
      const branchMeta = branchMetaById.get(branchId) || null
      const branchSteps = stepsByBranchId.get(branchId) || []
      const latestStep = branchSteps[branchSteps.length - 1] || null
      return {
        id: branchId,
        branchId,
        depth,
        label: depth === 0 ? 'Main' : `Branch ${depth}`,
        entryStepId: branchMeta?.entryStepId || null,
        entryStepNumber: branchMeta?.entryStepNumber || null,
        originStateId: branchMeta?.originStateId || null,
        originStepId: branchMeta?.originStepId || null,
        originStepNumber: branchMeta?.originStepNumber || null,
        originSequenceIndex: Number.isFinite(branchMeta?.originSequenceIndex) ? branchMeta.originSequenceIndex : 0,
        entrySequenceIndex: Number.isFinite(branchMeta?.entrySequenceIndex) ? branchMeta.entrySequenceIndex : 0,
        startSequenceIndex: Number.isFinite(branchMeta?.startSequenceIndex) ? branchMeta.startSequenceIndex : 0,
        latestStepId: latestStep?.id || null,
        latestStepNumber: latestStep?.stepNumber || null,
        latestSequenceIndex: Number.isFinite(latestStep?.sequenceIndex) ? latestStep.sequenceIndex : 0,
        stepCount: branchSteps.length,
      }
    })

  return {
    mainBranchId,
    branchDepthById,
    streamBands,
  }
}

function buildBranchSummaries(nodes = [], branches = [], streamBands = [], mainBranchId = 'main', currentBranchId = null) {
  const branchMetaById = new Map((branches || []).map((branch) => [branch.branchId, branch]))
  const bandByBranchId = new Map((streamBands || []).map((band) => [band.branchId, band]))
  const nodeBuckets = new Map()

  for (const node of nodes) {
    const branchId = node?.branchId || mainBranchId
    if (!nodeBuckets.has(branchId)) nodeBuckets.set(branchId, [])
    nodeBuckets.get(branchId).push(node)
  }

  const branchOrder = (streamBands || []).map((band) => band.branchId)
  if (!branchOrder.includes(mainBranchId)) branchOrder.unshift(mainBranchId)

  const branchSummaries = branchOrder.map((branchId, index) => {
    const branchNodes = nodeBuckets.get(branchId) || []
    const branchMeta = branchMetaById.get(branchId) || null
    const band = bandByBranchId.get(branchId) || null
    const replayNodes = branchNodes.filter((node) => node.kind === 'replay')
    const analyticalNodes = branchNodes.filter((node) => node.kind !== 'replay')
    const handoffCount = branchNodes.reduce((count, node, nodeIndex) => {
      if (nodeIndex === 0) return count
      return count + (branchNodes[nodeIndex - 1]?.actor !== node.actor ? 1 : 0)
    }, 0)

    return {
      branchId,
      label: band?.label || (index === 0 ? 'Main' : `Branch ${index}`),
      depth: Number.isFinite(band?.depth) ? band.depth : index,
      entryStepId: branchMeta?.entryStepId || branchNodes[0]?.stepId || null,
      originStepId: branchMeta?.originStepId || null,
      originStateId: branchMeta?.originStateId || null,
      stepIds: branchNodes.map((node) => node.stepId),
      nodeIds: branchNodes.map((node) => node.id),
      analyticalStepIds: analyticalNodes.map((node) => node.stepId),
      replayStepIds: replayNodes.map((node) => node.stepId),
      analyticalStepCount: analyticalNodes.length,
      replayStepCount: replayNodes.length,
      latestStepId: branchNodes[branchNodes.length - 1]?.stepId || null,
      stateDeltaCount: branchNodes.filter((node) => node.hasStateDelta).length,
      evidenceCount: branchNodes.filter((node) => node.hasEvidence).length,
      handoffCount,
      isCurrent: branchId === currentBranchId,
      actorSet: [...new Set(branchNodes.map((node) => node.actor))],
      band,
    }
  })

  return {
    branchOrder,
    branchSummaries,
    derivedBranchSummaries: branchSummaries.filter((summary) => summary.branchId !== mainBranchId),
  }
}

function buildPathSummaries(branchSummaries = [], segments = [], currentBranchId = null, selectedBranchId = null) {
  const segmentsByBranchId = new Map()
  for (const segment of segments || []) {
    if (!segmentsByBranchId.has(segment.branchId)) segmentsByBranchId.set(segment.branchId, [])
    segmentsByBranchId.get(segment.branchId).push(segment)
  }

  return (branchSummaries || []).map((branchSummary) => {
    const branchSegments = segmentsByBranchId.get(branchSummary.branchId) || []
    const actorSet = [...new Set(branchSegments.flatMap((segment) => segment.actorSet || []))]
    const dominantActor = actorSet.length === 1 ? actorSet[0] : (actorSet.length > 1 ? 'mixed' : 'human')
    const hasStateDelta = branchSegments.some((segment) => segment.hasStateDelta)
    const hasEvidence = branchSegments.some((segment) => segment.hasEvidence)
    const hasHandoff = branchSegments.some((segment) => segment.hasHandoff)
    const hasBranchEntry = branchSegments.some((segment) => segment.branchEntry)
    const firstSegment = branchSegments[0] || null
    const lastSegment = branchSegments[branchSegments.length - 1] || null

    return {
      id: `path_${branchSummary.branchId}`,
      branchId: branchSummary.branchId,
      label: branchSummary.label,
      depth: branchSummary.depth,
      entryStepId: branchSummary.entryStepId,
      originStepId: branchSummary.originStepId,
      latestStepId: branchSummary.latestStepId,
      segmentIds: branchSegments.map((segment) => segment.id),
      segmentCount: branchSegments.length,
      stepCount: branchSummary.stepIds.length,
      analyticalStepCount: branchSummary.analyticalStepCount,
      replayStepCount: branchSummary.replayStepCount,
      actorSet,
      dominantActor,
      hasStateDelta,
      hasEvidence,
      hasHandoff,
      hasBranchEntry,
      startSequenceIndex: firstSegment?.startSequenceIndex ?? branchSummary.band?.startSequenceIndex ?? 0,
      endSequenceIndex: lastSegment?.endSequenceIndex ?? branchSummary.band?.latestSequenceIndex ?? 0,
      shortSummary: `${branchSegments.length} segment${branchSegments.length === 1 ? '' : 's'} · ${branchSummary.stepIds.length} step${branchSummary.stepIds.length === 1 ? '' : 's'}`,
      current: branchSummary.branchId === currentBranchId,
      selected: branchSummary.branchId === selectedBranchId,
    }
  })
}

function shouldStartNewSegment(previousStep, nextStep) {
  if (!previousStep || !nextStep) return true
  if (previousStep.branchId !== nextStep.branchId) return true
  if (nextStep.transitionType === 'branch') return true
  if (nextStep.transitionType === 'handoff') return true
  if (previousStep.kind === 'replay' || nextStep.kind === 'replay') return true
  if (previousStep.hasEvidence !== nextStep.hasEvidence && (previousStep.hasEvidence || nextStep.hasEvidence)) return true
  return false
}

function buildTraceSegments(steps = [], nodes = []) {
  if (!Array.isArray(steps) || steps.length === 0) return []
  const nodeByStepId = new Map((nodes || []).map((node) => [node.stepId, node]))
  const segments = []
  let current = null

  const pushCurrent = () => {
    if (!current) return
    const firstStep = current.steps[0] || null
    const lastStep = current.steps[current.steps.length - 1] || null
    const actorSet = [...new Set(current.steps.map((step) => step.actor))]
    const stepIds = current.steps.map((step) => step.id)
    const nodeIds = current.steps.map((step) => nodeByStepId.get(step.id)?.id).filter(Boolean)
    segments.push({
      id: `segment_${segments.length + 1}`,
      branchId: current.branchId,
      branchDepth: current.branchDepth,
      startStepId: firstStep?.id || null,
      endStepId: lastStep?.id || null,
      startStepNumber: firstStep?.stepNumber || null,
      endStepNumber: lastStep?.stepNumber || null,
      startSequenceIndex: firstStep?.sequenceIndex ?? 0,
      endSequenceIndex: lastStep?.sequenceIndex ?? 0,
      stepCount: current.steps.length,
      stepIds,
      nodeIds,
      actorSet,
      dominantActor: actorSet.length === 1 ? actorSet[0] : 'mixed',
      hasHandoff: current.steps.some((step) => step.transitionType === 'handoff') || actorSet.length > 1,
      hasEvidence: current.steps.some((step) => step.hasEvidence),
      hasStateDelta: current.steps.some((step) => step.hasStateDelta),
      branchEntry: current.steps.some((step) => step.transitionType === 'branch'),
      label: current.steps.length > 1
        ? `${firstStep?.stepNumber}-${lastStep?.stepNumber}`
        : `${firstStep?.stepNumber}`,
      summary: lastStep?.summary || firstStep?.summary || 'Trace segment',
      shortSummary: current.steps.length > 1
        ? `${current.steps.length} steps`
        : (lastStep?.shortLabel || '1 step'),
      selected: false,
      current: false,
    })
  }

  for (const step of steps) {
    const node = nodeByStepId.get(step.id) || null
    const branchDepth = node?.branchDepth ?? 0
    const previousStep = current?.steps?.[current.steps.length - 1] || null
    if (!current || shouldStartNewSegment(previousStep, step)) {
      pushCurrent()
      current = {
        branchId: step.branchId,
        branchDepth,
        steps: [step],
      }
      continue
    }
    current.steps.push(step)
  }
  pushCurrent()
  return segments
}

export function buildTraceTimelineModel(trace = [], options = {}) {
  const selectedId = options.selectedStepId || null
  const safeTrace = Array.isArray(trace) ? trace : []
  const steps = safeTrace.map((step, index) => {
    const actor = normalizeActor(step?.actor)
    const kind = normalizeKind(step?.kind)
    const delta = normalizeDelta(step?.stateDelta)
    const hasStateDelta = delta.selection || delta.focus || delta.highlight || delta.viewport || delta.propagation
    const hasEvidence = Boolean(buildEvidenceText(step)) || delta.evidence
    const previousActor = index > 0 ? normalizeActor(safeTrace[index - 1]?.actor) : null
    const transitionType = normalizeTransitionType(step?.transitionType, previousActor && previousActor !== actor, kind)

    return {
      id: step?.id || `trace_step_${index}`,
      stepNumber: index + 1,
      sequenceIndex: index,
      actor,
      lane: actor,
      laneIndex: actor === 'human' ? 0 : 1,
      kind,
      kindLabel: buildKindLabel(kind),
      transitionType,
      status: normalizeStatus(step?.status),
      time: step?.time || null,
      methodName: step?.methodName || null,
      operationTopic: buildOperationTopic(step, kind),
      widgetId: step?.widgetId || null,
      widgetTitle: step?.widgetTitle || step?.widgetId || 'Workspace',
      summary: buildSummary(step),
      shortLabel: buildShortLabel(step, kind),
      detail: step?.detail || step?.label || '',
      verificationSummary: step?.verificationSummary || null,
      evidenceSummary: step?.evidenceSummary || null,
      queryScope: clone(step?.queryScope || null),
      updatedRefs: clone(step?.updatedRefs || []),
      sourceStateId: step?.sourceStateId || null,
      resultStateId: step?.resultStateId || null,
      branchId: step?.branchId || 'main',
      branchFromStateId: step?.branchFromStateId || null,
      parentStepId: step?.parentStepId || null,
      handoffFrom: step?.handoffFrom || null,
      handoffKind: step?.handoffKind || null,
      delta,
      hasStateDelta,
      hasEvidence,
      selected: (step?.id || `trace_step_${index}`) === selectedId,
      tooltip: [
        `${actor} · ${buildKindLabel(kind)}`,
        step?.widgetTitle || step?.widgetId || 'Workspace',
        buildSummary(step),
      ].filter(Boolean).join('\n'),
      raw: clone(step),
    }
  })

  const nodes = steps.map((step) => ({
    id: step.id,
    stepId: step.id,
    stepNumber: step.stepNumber,
    sequenceIndex: step.sequenceIndex,
    actor: step.actor,
    lane: step.lane,
    laneIndex: step.laneIndex,
    kind: step.kind,
    kindLabel: step.kindLabel,
    operationTopic: step.operationTopic,
    methodName: step.methodName,
    transitionType: step.transitionType,
    widgetTitle: step.widgetTitle,
    shortLabel: step.shortLabel,
    summary: step.summary,
    status: step.status,
    sourceStateId: step.sourceStateId,
    resultStateId: step.resultStateId,
    branchId: step.branchId,
    branchFromStateId: step.branchFromStateId,
    parentStepId: step.parentStepId,
    hasStateDelta: step.hasStateDelta,
    hasEvidence: step.hasEvidence,
    selected: step.selected,
    tooltip: step.tooltip,
  }))

  const stepByResultStateId = new Map()
  for (const step of steps) {
    if (typeof step.resultStateId === 'string' && step.resultStateId.length > 0 && !stepByResultStateId.has(step.resultStateId)) {
      stepByResultStateId.set(step.resultStateId, step)
    }
  }

  const branches = []
  const seenBranchIds = new Set()
  for (const step of steps) {
    if (step.transitionType !== 'branch' || !step.branchId || step.branchId === 'main' || seenBranchIds.has(step.branchId)) continue
    const originStep = step.branchFromStateId ? stepByResultStateId.get(step.branchFromStateId) || null : null
    branches.push({
      branchId: step.branchId,
      originStepId: originStep?.id || null,
      originStepNumber: Number.isFinite(originStep?.stepNumber) ? originStep.stepNumber : null,
      originSummary: originStep?.summary || null,
      originStateId: step.branchFromStateId || originStep?.resultStateId || null,
      entryStepId: step.id,
      entryStepNumber: step.stepNumber,
      entrySummary: step.summary || step.shortLabel,
      originSequenceIndex: Number.isFinite(originStep?.sequenceIndex) ? originStep.sequenceIndex : step.sequenceIndex,
      entrySequenceIndex: step.sequenceIndex,
      startSequenceIndex: Math.min(
        Number.isFinite(originStep?.sequenceIndex) ? originStep.sequenceIndex : step.sequenceIndex,
        step.sequenceIndex,
      ),
      actor: step.actor,
      label: step.summary || step.shortLabel,
      status: step.selected ? 'active' : 'stale',
    })
    seenBranchIds.add(step.branchId)
  }

  const branchMetaById = new Map(branches.map((branch) => [branch.branchId, branch]))
  const previousNodeByBranchId = new Map()
  const edges = []

  for (let index = 1; index < nodes.length; index += 1) {
    const node = nodes[index]
    const previousChronological = nodes[index - 1]
    const step = steps[index]
    const branchMeta = node.branchId ? branchMetaById.get(node.branchId) || null : null
    const previousInBranch = node.branchId ? previousNodeByBranchId.get(node.branchId) || null : null
    const explicitHandoff = step?.handoffFrom === previousChronological?.id

    let fromNode = previousChronological
    let edgeKind = explicitHandoff || previousChronological.actor !== node.actor ? 'handoff' : 'sequence'

    if (step?.transitionType === 'branch') {
      if (branchMeta?.entryStepId === node.id) {
        const originNode = branchMeta?.originStepId
          ? nodes.find((candidate) => candidate.id === branchMeta.originStepId) || null
          : null
        fromNode = originNode && originNode.id !== node.id ? originNode : previousChronological
        edgeKind = 'branch'
      } else if (previousInBranch) {
        fromNode = previousInBranch
        edgeKind = previousInBranch.actor !== node.actor ? 'handoff' : 'sequence'
      } else {
        edgeKind = 'branch'
      }
    }

    if (!fromNode) continue
    edges.push({
      id: `${fromNode.id}__${node.id}`,
      from: fromNode.id,
      to: node.id,
      kind: edgeKind,
    })

    if (node.branchId) previousNodeByBranchId.set(node.branchId, node)
  }

  const {
    mainBranchId,
    branchDepthById,
    streamBands,
  } = buildStreamBands(steps, branches)

  for (const node of nodes) {
    node.branchDepth = branchDepthById.get(node.branchId) ?? 0
    node.bandIndex = node.branchDepth
    node.bandId = streamBands[node.bandIndex]?.id || mainBranchId
    node.actorTone = node.actor === 'human' ? 'human' : 'agent'
  }

  const selectedStep = steps.find((step) => step.selected) || steps[steps.length - 1] || null
  const selectedNode = selectedStep ? nodes.find((node) => node.stepId === selectedStep.id) || null : null
  const currentStep = steps[steps.length - 1] || null
  const currentNode = currentStep ? nodes.find((node) => node.stepId === currentStep.id) || null : null
  const segments = buildTraceSegments(steps, nodes)
  const selectedSegment = selectedStep
    ? segments.find((segment) => segment.stepIds.includes(selectedStep.id)) || null
    : null
  const currentSegment = currentStep
    ? segments.find((segment) => segment.stepIds.includes(currentStep.id)) || null
    : null
  const segmentByStepId = new Map()
  for (const segment of segments) {
    segment.stepIds.forEach((stepId, index) => {
      segmentByStepId.set(stepId, {
        segmentId: segment.id,
        segmentIndex: index,
        segmentStepCount: segment.stepCount,
        isSegmentStart: index === 0,
        isSegmentEnd: index === segment.stepIds.length - 1,
      })
    })
  }
  for (const node of nodes) {
    const segmentMeta = segmentByStepId.get(node.stepId) || null
    node.segmentId = segmentMeta?.segmentId || null
    node.segmentIndex = Number.isFinite(segmentMeta?.segmentIndex) ? segmentMeta.segmentIndex : -1
    node.segmentStepCount = Number.isFinite(segmentMeta?.segmentStepCount) ? segmentMeta.segmentStepCount : 1
    node.isSegmentStart = Boolean(segmentMeta?.isSegmentStart)
    node.isSegmentEnd = Boolean(segmentMeta?.isSegmentEnd)
  }
  for (const segment of segments) {
    segment.selected = segment.id === selectedSegment?.id
    segment.current = segment.id === currentSegment?.id
  }
  const currentBranchId = currentStep?.branchId || null
  const selectedBranchId = selectedStep?.branchId || null
  const handoffCount = edges.filter((edge) => edge.kind === 'handoff').length
  const evidenceStepCount = steps.filter((step) => step.hasEvidence).length
  const stateDeltaStepCount = steps.filter((step) => step.hasStateDelta).length
  const { branchOrder, branchSummaries, derivedBranchSummaries } = buildBranchSummaries(
    nodes,
    branches,
    streamBands,
    mainBranchId,
    currentBranchId,
  )
  const pathSummaries = buildPathSummaries(
    branchSummaries,
    segments,
    currentBranchId,
    selectedBranchId,
  )
  const selectedPath = selectedBranchId
    ? pathSummaries.find((path) => path.branchId === selectedBranchId) || null
    : pathSummaries[pathSummaries.length - 1] || null
  const currentPath = currentBranchId
    ? pathSummaries.find((path) => path.branchId === currentBranchId) || null
    : pathSummaries[pathSummaries.length - 1] || null

  return {
    steps,
    lanes: TRACE_LANES,
    nodes,
    edges,
    branches,
    segments,
    pathSummaries,
    streamBands,
    branchOrder,
    provenanceGraph: {
      nodes,
      edges,
      branches: derivedBranchSummaries,
      paths: pathSummaries,
      segments,
    },
    selection: {
      selectedStepId: selectedStep?.id || null,
      selectedStep,
      selectedNode,
      selectedSegment,
      selectedPath,
      currentStepId: currentStep?.id || null,
      currentStep,
      currentNode,
      currentSegment,
      currentPath,
      currentBranchId,
    },
    stats: {
      stepCount: steps.length,
      branchCount: branches.length,
      segmentCount: segments.length,
      handoffCount,
      evidenceStepCount,
      stateDeltaStepCount,
    },
    stepCount: steps.length,
    handoffCount,
    currentStep,
    selectedStep,
    currentBranchId,
    mainBranchId,
  }
}
