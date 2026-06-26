function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function stableSerialize(value) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function summarizeEncodings(encodings = {}) {
  const entries = Object.entries(encodings || {})
    .filter(([, encoding]) => encoding && typeof encoding === 'object')
  const channels = entries.map(([channel]) => channel)
  const fieldsByChannel = Object.fromEntries(
    entries.map(([channel, encoding]) => [channel, encoding.field || null]),
  )
  const typesByChannel = Object.fromEntries(
    entries.map(([channel, encoding]) => [channel, encoding.type || null]),
  )
  const aggregateChannels = entries
    .filter(([, encoding]) => typeof encoding.aggregate === 'string' && encoding.aggregate.length > 0)
    .map(([channel]) => channel)

  return {
    channels,
    fieldsByChannel,
    typesByChannel,
    aggregateChannels,
    signature: stableSerialize({
      channels,
      fieldsByChannel,
      typesByChannel,
      aggregateChannels,
    }),
  }
}

function summarizeTransforms(transforms = []) {
  const normalized = Array.isArray(transforms) ? transforms : []
  const kinds = normalized
    .map((transform) => transform?.kind)
    .filter((kind) => typeof kind === 'string' && kind.length > 0)
  const countsByKind = Object.fromEntries(
    [...new Set(kinds)].map((kind) => [kind, kinds.filter((candidate) => candidate === kind).length]),
  )

  return {
    count: normalized.length,
    kinds,
    countsByKind,
    hasFilterTransform: kinds.includes('filter'),
    hasSortTransform: kinds.includes('sort'),
    hasAggregateTransform: kinds.includes('aggregate'),
    hasHighlightTransform: kinds.includes('highlight'),
    signature: stableSerialize({
      kinds,
      countsByKind,
    }),
  }
}

function summarizeSelections(selections = {}) {
  const entries = Object.entries(selections || {})
    .filter(([ref, selection]) => Boolean(ref) && selection && typeof selection === 'object')
  const refs = entries.map(([ref]) => ref)
  const activeKinds = entries
    .map(([, selection]) => selection.kind || null)
    .filter((kind) => typeof kind === 'string' && kind.length > 0)
  const activeSummary = entries
    .map(([, selection]) => selection.summary || null)
    .find((summary) => typeof summary === 'string' && summary.length > 0) || null

  return {
    count: refs.length,
    refs,
    activeKinds,
    hasSelection: refs.length > 0,
    activeSummary,
    signature: stableSerialize({
      refs,
      activeKinds,
      activeSummary,
    }),
  }
}

function summarizeView(view = {}) {
  const xDomain = Array.isArray(view?.xDomain) ? clone(view.xDomain) : null
  const yDomain = Array.isArray(view?.yDomain) ? clone(view.yDomain) : null
  const zoom = view?.zoom && typeof view.zoom === 'object' ? clone(view.zoom) : null
  const sort = view?.sort && typeof view.sort === 'object' ? clone(view.sort) : null
  const highlight = view?.highlight && typeof view.highlight === 'object' ? clone(view.highlight) : null
  const drillDown = view?.drillDown && typeof view.drillDown === 'object' ? clone(view.drillDown) : null
  const aggregate = view?.aggregate && typeof view.aggregate === 'object' ? clone(view.aggregate) : null
  const reencode = view?.reencode && typeof view.reencode === 'object' ? clone(view.reencode) : null
  const annotate = view?.annotate && typeof view.annotate === 'object' ? clone(view.annotate) : null
  const addRemove = view?.addRemove && typeof view.addRemove === 'object' ? clone(view.addRemove) : null
  const navigate = view?.navigate && typeof view.navigate === 'object' ? clone(view.navigate) : null
  const focusKeys = Object.fromEntries(
    Object.entries({
      focusedCarId: view?.focusedCarId || null,
      focusedSeries: view?.focusedSeries || null,
      focusedNode: view?.focusedNode || null,
      focusedFlow: view?.focusedFlow || null,
    }).filter(([, value]) => value != null),
  )

  return {
    xDomain,
    yDomain,
    zoom,
    sort,
    highlight,
    drillDown,
    aggregate,
    reencode,
    annotate,
    addRemove,
    navigate,
    focusKeys,
    hasXDomainOverride: Array.isArray(xDomain),
    hasYDomainOverride: Array.isArray(yDomain),
    hasZoom: Boolean(zoom),
    hasSort: Boolean(sort),
    hasHighlight: Boolean(highlight),
    hasDrillDown: Boolean(drillDown),
    hasAggregate: Boolean(aggregate),
    hasReencode: Boolean(reencode),
    hasAnnotate: Boolean(annotate),
    hasAddRemove: Boolean(addRemove),
    hasNavigate: Boolean(navigate),
    hasFocus: Object.keys(focusKeys).length > 0,
    signature: stableSerialize({
      xDomain,
      yDomain,
      zoom,
      sort,
      highlight,
      drillDown,
      aggregate,
      reencode,
      annotate,
      addRemove,
      navigate,
      focusKeys,
    }),
  }
}

function summarizeFeedback(feedback = {}) {
  const linkedSourceRefs = Array.isArray(feedback?.linkedSourceRefs)
    ? [...feedback.linkedSourceRefs]
    : []
  const highlightedKeys = Array.isArray(feedback?.highlightedKeys)
    ? [...feedback.highlightedKeys]
    : []

  return {
    linkedSourceRefCount: linkedSourceRefs.length,
    highlightKeyCount: highlightedKeys.length,
    sharedSelectionSourceWidgetId: feedback?.sharedSelectionSourceWidgetId || null,
    signature: stableSerialize({
      linkedSourceRefs,
      highlightedKeys,
      sharedSelectionSourceWidgetId: feedback?.sharedSelectionSourceWidgetId || null,
    }),
  }
}

export function buildWidgetVerificationState({ widgetRef = null, widgetId = null, kind = null, state = null } = {}) {
  const safeState = state && typeof state === 'object' ? state : {}
  const data = safeState?.data && typeof safeState.data === 'object' ? safeState.data : {}
  const encodings = summarizeEncodings(safeState.encodings || {})
  const transforms = summarizeTransforms(safeState.transforms || [])
  const selections = summarizeSelections(safeState.selections || {})
  const view = summarizeView(safeState.view || {})
  const feedback = summarizeFeedback(safeState.feedback || {})

  const xEncodingType = encodings.typesByChannel?.x || null
  const yEncodingType = encodings.typesByChannel?.y || null
  const xDomainCanRepresentZoom = xEncodingType === 'quantitative' || xEncodingType === 'temporal'
  const yDomainCanRepresentZoom = yEncodingType === 'quantitative' || yEncodingType === 'temporal'

  return {
    widgetRef,
    widgetId,
    kind,
    data: {
      rowCount: Number.isFinite(data?.rowCount) ? data.rowCount : 0,
      visibleCount: Number.isFinite(data?.visibleCount) ? data.visibleCount : 0,
      selectedCount: Number.isFinite(data?.selectedCount) ? data.selectedCount : 0,
      sourceDataRef: data?.sourceDataRef || null,
      currentDataRef: data?.currentDataRef || null,
    },
    selections,
    transforms,
    view,
    encodings,
    feedback,
    checks: {
      selectionApplied: selections.hasSelection || (Number.isFinite(data?.selectedCount) && data.selectedCount > 0),
      filterApplied: transforms.hasFilterTransform || (
        Number.isFinite(data?.visibleCount)
        && Number.isFinite(data?.rowCount)
        && data.visibleCount > 0
        && data.rowCount > 0
        && data.visibleCount < data.rowCount
      ),
      zoomApplied: view.hasZoom
        || (view.hasXDomainOverride && xDomainCanRepresentZoom)
        || (view.hasYDomainOverride && yDomainCanRepresentZoom),
      sortApplied: view.hasSort || transforms.hasSortTransform,
      highlightApplied: view.hasHighlight || feedback.highlightKeyCount > 0,
      drillDownApplied: view.hasDrillDown,
      aggregateApplied: view.hasAggregate || transforms.hasAggregateTransform,
      reencodeApplied: view.hasReencode,
      annotateApplied: view.hasAnnotate,
      addRemoveApplied: view.hasAddRemove,
      navigateApplied: view.hasNavigate,
      focusApplied: view.hasFocus,
      linkedPropagationApplied: feedback.linkedSourceRefCount > 0,
      encodingReadable: encodings.channels.length > 0,
    },
    signatures: {
      selections: selections.signature,
      transforms: transforms.signature,
      view: view.signature,
      encodings: encodings.signature,
      feedback: feedback.signature,
    },
  }
}
