export async function applyTableState({ view, surface, state }) {
  const pointSelections = Object.values(state?.selections || {}).filter((selection) => selection?.kind === 'point')
  const focusedSelection = pointSelections.length === 1 ? pointSelections[0] : null
  const selectionSummaries = pointSelections.map((selection) => selection?.summary || '').filter(Boolean)
  const selectionPredicates = pointSelections
    .map((selection) => Array.isArray(selection?.predicates) ? selection.predicates : [])
    .flat()
  const selectionFields = selectionPredicates
    .filter((predicate) => predicate?.field && (predicate.op === 'equals' || predicate.op === 'in'))
    .map((predicate) => predicate.field)
  const selectionField = selectionFields.length === 1
    ? selectionFields[0]
    : (new Set(selectionFields)).size === 1
      ? selectionFields[0]
      : ''

  if (surface) {
    surface.dataset.widgetvaSelectedCount = String(state?.data?.selectedCount ?? 0)
    surface.dataset.widgetvaVisibleCount = String(state?.data?.visibleCount ?? 0)
    surface.dataset.widgetvaSelectionSummary = focusedSelection?.summary || selectionSummaries.join(' · ')
    surface.dataset.widgetvaSelectionField = selectionField
    surface.dataset.widgetvaSelectionCount = String(pointSelections.length)
    surface.dataset.widgetvaSelectionSummaries = JSON.stringify(selectionSummaries)
  }

  if (!view) return
  try {
    if (typeof view.signal === 'function') {
      view.signal('widgetva_tableSelection', focusedSelection || null)
      view.signal('widgetva_tableSelections', pointSelections)
    }
    await view.runAsync?.()
  } catch {}
}
