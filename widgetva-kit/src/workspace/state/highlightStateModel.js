function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function normalizeString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function normalizeStringArray(values) {
  return Array.isArray(values)
    ? values.filter((value, index) => typeof value === 'string' && value.length > 0 && values.indexOf(value) === index)
    : []
}

function normalizeScalarArray(values) {
  return Array.isArray(values)
    ? clone(values.filter((value, index) => value != null && values.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(value)) === index))
    : []
}

export function normalizeHighlightEntry(entry = {}) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
  return {
    widgetRef: normalizeString(entry.widgetRef || entry.widget_ref),
    widgetId: normalizeString(entry.widgetId || entry.widget_id),
    sourceWidgetRef: normalizeString(entry.sourceWidgetRef || entry.source_widget_ref),
    sourceWidgetId: normalizeString(entry.sourceWidgetId || entry.source_widget_id),
    selectionRef: normalizeString(entry.selectionRef || entry.selection_ref),
    summary: normalizeString(entry.summary),
    predicates: Array.isArray(entry.predicates) ? clone(entry.predicates) : [],
    highlightedKeys: normalizeScalarArray(entry.highlightedKeys || entry.highlighted_keys),
    inboundLinkIds: normalizeStringArray(entry.inboundLinkIds || entry.inbound_link_ids),
    highlightLinkIds: normalizeStringArray(entry.highlightLinkIds || entry.highlight_link_ids),
    linkedSourceRefs: normalizeStringArray(entry.linkedSourceRefs || entry.linked_source_refs),
  }
}

export function deriveHighlightState(state = {}) {
  const explicitHighlight = normalizeHighlightState(state?.shared?.highlight || null)
  if (explicitHighlight) return explicitHighlight

  const widgets = state?.widgets && typeof state.widgets === 'object' ? state.widgets : {}
  const entries = Object.values(widgets)
    .map((widgetState) => normalizeHighlightEntry({
      widgetRef: widgetState?.ref || null,
      widgetId: widgetState?.widgetId || null,
      highlightedKeys: widgetState?.feedback?.highlightedKeys || [],
      inboundLinkIds: widgetState?.feedback?.inboundLinkIds || [],
      highlightLinkIds: widgetState?.feedback?.highlightLinkIds || [],
      linkedSourceRefs: widgetState?.feedback?.linkedSourceRefs || [],
    }))
    .filter((entry) => entry
      && (
        entry.predicates.length > 0
        || Boolean(entry.summary)
        || 
        entry.highlightedKeys.length > 0
        || entry.inboundLinkIds.length > 0
        || entry.highlightLinkIds.length > 0
        || entry.linkedSourceRefs.length > 0
      ))

  return {
    entries,
    activeWidgetRefs: entries.map((entry) => entry.widgetRef).filter(Boolean),
  }
}

export function normalizeHighlightState(highlight = null) {
  if (!highlight || typeof highlight !== 'object' || Array.isArray(highlight)) return null
  const entries = Array.isArray(highlight.entries)
    ? highlight.entries.map((entry) => normalizeHighlightEntry(entry)).filter(Boolean)
    : []
  const activeWidgetRefs = Array.isArray(highlight.activeWidgetRefs)
    ? highlight.activeWidgetRefs.filter((value, index) => typeof value === 'string' && value.length > 0 && highlight.activeWidgetRefs.indexOf(value) === index)
    : entries.map((entry) => entry.widgetRef).filter(Boolean)
  return {
    entries,
    activeWidgetRefs,
  }
}

export function withHighlightSubmodel(shared = {}, highlight = undefined) {
  return {
    ...(shared || {}),
    highlight: highlight === undefined ? normalizeHighlightState(shared?.highlight || null) : normalizeHighlightState(highlight),
  }
}
