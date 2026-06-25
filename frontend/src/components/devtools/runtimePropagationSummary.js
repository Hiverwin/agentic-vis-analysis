import { summarizeLinkPropagationEvaluations } from '../trajectory/runtimeEvidence.js'

function selectionSummary(selection = {}) {
  if (typeof selection?.summary === 'string' && selection.summary.trim().length > 0) {
    return selection.summary.trim()
  }
  const keys = Array.isArray(selection?.keys) ? selection.keys.filter((key) => key != null) : []
  if (keys.length > 0) {
    return `${keys.length} keys`
  }
  const predicates = Array.isArray(selection?.predicates) ? selection.predicates.filter(Boolean) : []
  if (predicates.length > 0) {
    return `${predicates.length} predicates`
  }
  return ''
}

export function summarizeRuntimePropagation({ snapshot, evaluations } = {}) {
  const activeSelections = snapshot?.shared?.selections?.registry && typeof snapshot.shared.selections.registry === 'object'
    ? snapshot.shared.selections.registry
    : {}
  const sources = Object.entries(activeSelections).map(([sourceRef, selection]) => ({
    sourceRef,
    selectionCount: Number.isFinite(selection?.selectedCount)
      ? selection.selectedCount
      : Array.isArray(selection?.keys)
        ? selection.keys.length
        : 0,
    summary: selectionSummary(selection),
  }))
  const propagation = summarizeLinkPropagationEvaluations(evaluations)
  const targetRefs = [...new Set(
    (Array.isArray(evaluations) ? evaluations : [])
      .flatMap((entry) => Array.isArray(entry?.results) ? entry.results : [])
      .map((entry) => entry?.targetRef)
      .filter((ref) => typeof ref === 'string' && ref.length > 0),
  )]

  return {
    stateId: snapshot?.stateId || snapshot?.__meta?.stateId || null,
    sourceCount: sources.length,
    sources,
    targetRefs,
    propagation,
  }
}
