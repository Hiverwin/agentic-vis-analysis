function setSignalSafely(view, name, value) {
  if (!view || typeof view.signal !== 'function') return
  try {
    view.signal(name, value)
  } catch {}
}

function normalizeSelections(state) {
  return Object.values(state?.selections || {}).filter(Boolean)
}

function resolveRepresentativeSelection(selections) {
  const normalizedSelections = Array.isArray(selections) ? selections.filter(Boolean) : []
  if (normalizedSelections.length !== 1) return null
  return normalizedSelections[0] || null
}

function resolvePrimaryIntervalSelection(selections) {
  return (Array.isArray(selections) ? selections : []).find((selection) => selection?.kind === 'interval') || null
}

function selectionValuesFromPredicates(predicates) {
  if (!Array.isArray(predicates)) return []
  return predicates
    .filter((predicate) => predicate?.op === 'equals' || predicate?.op === 'in')
    .flatMap((predicate) => (Array.isArray(predicate?.value) ? predicate.value : [predicate?.value]))
    .filter((value) => value != null)
}

function setDomainSignals(view, state) {
  const xDomain = state?.view?.xDomain
  const yDomain = state?.view?.yDomain
  if (Array.isArray(xDomain)) {
    setSignalSafely(view, 'xDomain', xDomain)
    setSignalSafely(view, 'widgetva_xDomain', xDomain)
  }
  if (Array.isArray(yDomain)) {
    setSignalSafely(view, 'yDomain', yDomain)
    setSignalSafely(view, 'widgetva_yDomain', yDomain)
  }
}

function setIntervalSelectionSignals(view, selection) {
  const xDomain = selection?.domain?.xDomain
  const yDomain = selection?.domain?.yDomain
  if (!Array.isArray(xDomain) || !Array.isArray(yDomain)) {
    setSignalSafely(view, 'brush', null)
    setSignalSafely(view, 'brush_x_1', null)
    setSignalSafely(view, 'brush_x_2', null)
    setSignalSafely(view, 'brush_y_1', null)
    setSignalSafely(view, 'brush_y_2', null)
    return
  }

  const normalizedBrush = { x: xDomain, y: yDomain }
  setSignalSafely(view, 'brush', normalizedBrush)
  setSignalSafely(view, 'brush_x_1', xDomain[0])
  setSignalSafely(view, 'brush_x_2', xDomain[1])
  setSignalSafely(view, 'brush_y_1', yDomain[0])
  setSignalSafely(view, 'brush_y_2', yDomain[1])
}

function setSelectionSummarySignals(view, selection, selections = []) {
  const normalizedSelections = Array.isArray(selections) ? selections.filter(Boolean) : []
  const predicates = selection
    ? (Array.isArray(selection?.predicates) ? selection.predicates : [])
    : normalizedSelections.flatMap((entry) => Array.isArray(entry?.predicates) ? entry.predicates : [])
  const selectionSummaries = normalizedSelections
    .map((entry) => entry?.summary || '')
    .filter(Boolean)
  const selectionPredicates = normalizedSelections
    .map((entry) => Array.isArray(entry?.predicates) ? entry.predicates : [])
  setSignalSafely(view, 'widgetva_selectionKind', selection?.kind || null)
  setSignalSafely(view, 'widgetva_selectionDomain', selection?.domain || null)
  setSignalSafely(view, 'widgetva_selectedValues', selectionValuesFromPredicates(predicates))
  setSignalSafely(view, 'widgetva_selectionCount', normalizedSelections.length)
  setSignalSafely(view, 'widgetva_selections', normalizedSelections)
  setSignalSafely(view, 'widgetva_selectionSummaries', selectionSummaries)
  setSignalSafely(view, 'widgetva_selectionPredicateGroups', selectionPredicates)
}

function setWidgetVASignals(view, state, selection, selections) {
  const feedback = state?.feedback || {}
  setSignalSafely(view, 'widgetva_selection', selection || null)
  setSelectionSummarySignals(view, selection, selections)
  const normalizedSelections = Array.isArray(selections) ? selections.filter(Boolean) : []
  const aggregatedSummary = normalizedSelections
    .map((entry) => entry?.summary || '')
    .filter(Boolean)
    .join(' · ')
  const aggregatedPredicates = selection
    ? (Array.isArray(selection?.predicates) ? selection.predicates : [])
    : normalizedSelections.flatMap((entry) => Array.isArray(entry?.predicates) ? entry.predicates : [])
  setSignalSafely(view, 'widgetva_selectionSummary', selection?.summary || aggregatedSummary)
  setSignalSafely(view, 'widgetva_selectionPredicates', aggregatedPredicates)
  setSignalSafely(view, 'widgetva_selectedCount', state?.data?.selectedCount ?? 0)
  setSignalSafely(view, 'widgetva_visibleCount', state?.data?.visibleCount ?? 0)
  setSignalSafely(view, 'widgetva_highlightedKeys', Array.isArray(feedback?.highlightedKeys) ? feedback.highlightedKeys : [])
  setSignalSafely(view, 'widgetva_inboundLinkIds', Array.isArray(feedback?.inboundLinkIds) ? feedback.inboundLinkIds : [])
  setSignalSafely(view, 'widgetva_linkedSourceRefs', Array.isArray(feedback?.linkedSourceRefs) ? feedback.linkedSourceRefs : [])
}

export async function applyVegaLiteRuntimeState({ view, state }) {
  if (!view || !state) return

  const selections = normalizeSelections(state)
  const selection = resolveRepresentativeSelection(selections)
  const intervalSelection = resolvePrimaryIntervalSelection(selections)
  setDomainSignals(view, state)
  setIntervalSelectionSignals(view, intervalSelection)

  setWidgetVASignals(view, state, selection, selections)

  try {
    await view.runAsync?.()
  } catch {}
}
