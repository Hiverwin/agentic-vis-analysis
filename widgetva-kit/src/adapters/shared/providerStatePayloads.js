export function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function normalizeSelections(state) {
  return Object.values(state?.selections || {}).filter(Boolean)
}

export function resolveRepresentativeSelection(selections) {
  const normalizedSelections = Array.isArray(selections) ? selections.filter(Boolean) : []
  if (normalizedSelections.length === 1) return normalizedSelections[0] || null
  const pointSelections = normalizedSelections.filter((selection) => selection?.kind === 'point')
  if (pointSelections.length === 1) return pointSelections[0] || null
  return normalizedSelections[0] || null
}

export function resolvePrimaryIntervalSelection(selections) {
  return (Array.isArray(selections) ? selections : []).find((selection) => selection?.kind === 'interval') || null
}

export function resolveFocusPayload(state) {
  const view = state?.view && typeof state.view === 'object' && !Array.isArray(state.view)
    ? state.view
    : null
  if (!view) return null

  const focusPayload = {
    ...(view.focusedCarId != null ? { focusedCarId: view.focusedCarId } : {}),
    ...(view.focusedSeries != null ? { focusedSeries: clone(view.focusedSeries) } : {}),
    ...(view.focusedNode != null ? { focusedNode: view.focusedNode } : {}),
    ...(view.focusedFlow != null ? { focusedFlow: clone(view.focusedFlow) } : {}),
  }

  return Object.keys(focusPayload).length > 0 ? focusPayload : null
}

export function resolveHighlightStatePayload(state) {
  const highlight = state?.view?.highlight
  if (!highlight || typeof highlight !== 'object' || Array.isArray(highlight)) return null
  return clone(highlight)
}

export function resolveAggregateStatePayload(state) {
  const aggregate = state?.view?.aggregate
  if (!aggregate || typeof aggregate !== 'object' || Array.isArray(aggregate)) return null
  return clone(aggregate)
}

export function resolveAddRemoveStatePayload(state) {
  const addRemove = state?.view?.addRemove
  if (!addRemove || typeof addRemove !== 'object' || Array.isArray(addRemove)) return null
  return clone(addRemove)
}

export function resolveDrillDownStatePayload(state) {
  const drillDown = state?.view?.drillDown
  if (!drillDown || typeof drillDown !== 'object' || Array.isArray(drillDown)) return null
  return clone(drillDown)
}

export function resolveNavigateStatePayload(state) {
  const navigate = state?.view?.navigate
  if (!navigate || typeof navigate !== 'object' || Array.isArray(navigate)) return null
  return clone(navigate)
}

export function resolveReencodeStatePayload(state) {
  const reencode = state?.view?.reencode
  if (!reencode || typeof reencode !== 'object' || Array.isArray(reencode)) return null
  return clone(reencode)
}

export function resolveSortPayload(state) {
  const sort = state?.view?.sort
  if (!sort || typeof sort !== 'object' || Array.isArray(sort)) return null

  const payload = {
    ...(typeof sort.channel === 'string' ? { channel: sort.channel } : {}),
    ...(typeof sort.field === 'string' ? { field: sort.field } : {}),
    ...(typeof sort.mode === 'string' ? { mode: sort.mode } : {}),
    ...(typeof sort.order === 'string' ? { order: sort.order } : {}),
    ...(typeof sort.aggregate === 'string' ? { aggregate: sort.aggregate } : {}),
    ...(Array.isArray(sort.values) ? { values: clone(sort.values) } : {}),
  }

  return Object.keys(payload).length > 0 ? payload : null
}
