import { summarizeWorkspaceState } from 'widgetva-kit/core-inspect'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function getPrimarySnapshotSpec(snapshot) {
  if (!snapshot?.widgets) return null
  const widgets = Object.values(snapshot.widgets)
  const primaryWidget = widgets.find((widget) => widget?.role === 'primary') || widgets[0] || null
  return primaryWidget?.rawSpec || null
}

export function summarizeSnapshot(snapshot) {
  if (!snapshot) return null
  const stateSummary = summarizeWorkspaceState(snapshot) || {}
  const taskContext = snapshot.taskContext || null
  const replayContext = snapshot.replayContext || null
  return {
    stateId: snapshot.__meta?.stateId || snapshot.stateId || null,
    parentStateId: snapshot.__meta?.parentStateId || null,
    branchId: snapshot.__meta?.branchId || null,
    transitionType: snapshot.__meta?.transitionType || 'continue',
    focusedWidgetRef: stateSummary.focusedWidgetRef || null,
    focusedWidgetKind: stateSummary.focusedWidgetKind || null,
    visibleCount: stateSummary.visibleCount ?? null,
    selectedCount: stateSummary.selectedCount ?? null,
    selectionSummary: stateSummary.primarySelectionSummary || '',
    selectionPredicates: stateSummary.primarySelectionPredicates || [],
    annotationCount: stateSummary.annotationCount ?? 0,
    comparisonTargetCount: stateSummary.comparisonTargetCount ?? 0,
    taskMode: taskContext?.taskMode || stateSummary.taskMode || null,
    coordinationScope: taskContext?.coordinationScope || stateSummary.coordinationScope || null,
    evidenceType: taskContext?.evidenceType || stateSummary.evidenceType || null,
    replayRunMode: replayContext?.runMode || null,
    replayUserIntent: replayContext?.userIntent || '',
    sharedChanged: stateSummary.sharedChanged || false,
    taskContextChanged: stateSummary.taskContextChanged || false,
    replayContextChanged: stateSummary.replayContextChanged || false,
    removedRefs: stateSummary.removedRefs || [],
  }
}

export function summarizeLinkPropagationEvaluations(evaluations) {
  const entries = Array.isArray(evaluations) ? evaluations.filter(Boolean) : []
  if (!entries.length) {
    return {
      sourceCount: 0,
      ok: true,
      passedCount: 0,
      linkCount: 0,
      consistencyScore: 1,
      failingLinks: [],
      primitives: [],
    }
  }

  let passedCount = 0
  let linkCount = 0
  const primitiveSet = new Set()
  const failingLinks = []

  for (const entry of entries) {
    passedCount += Number.isFinite(entry?.passedCount) ? entry.passedCount : 0
    linkCount += Number.isFinite(entry?.linkCount) ? entry.linkCount : 0
    for (const result of entry?.results || []) {
      if (result?.primitive) primitiveSet.add(result.primitive)
      if (result?.ok === false) {
        failingLinks.push({
          linkId: result.linkId || null,
          primitive: result.primitive || null,
          targetRef: result.targetRef || null,
          reason: result.reason || '',
        })
      }
    }
  }

  return {
    sourceCount: entries.length,
    ok: failingLinks.length === 0,
    passedCount,
    linkCount,
    consistencyScore: linkCount > 0 ? passedCount / linkCount : 1,
    failingLinks: clone(failingLinks),
    primitives: [...primitiveSet],
  }
}

export async function collectRuntimeSnapshotEvidence(port, stateId) {
  if (!port?.readSnapshot || !stateId) return null
  const snapshot = await port.readSnapshot({ stateId, includeMeta: true })
  const activeSelectionRefs = Object.keys(snapshot?.shared?.selections?.registry || {})
  const linkEvaluations = port?.evaluateLinkPropagation
    ? await Promise.all(activeSelectionRefs.map((sourceRef) => port.evaluateLinkPropagation({ sourceRef })))
    : []
  return {
    snapshot,
    summary: summarizeSnapshot(snapshot),
    linkPropagation: summarizeLinkPropagationEvaluations(linkEvaluations),
  }
}
