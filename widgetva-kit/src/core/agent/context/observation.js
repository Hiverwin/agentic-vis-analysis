function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function collectInlineRowsFromSpec(spec = null, rows = []) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return rows
  if (Array.isArray(spec?.data?.values)) {
    rows.push(...spec.data.values.filter((row) => row && typeof row === 'object' && !Array.isArray(row)))
  }
  for (const key of ['layer', 'vconcat', 'hconcat', 'concat']) {
    if (Array.isArray(spec?.[key])) {
      for (const child of spec[key]) {
        collectInlineRowsFromSpec(child, rows)
      }
    }
  }
  if (spec?.spec && typeof spec.spec === 'object' && !Array.isArray(spec.spec)) {
    collectInlineRowsFromSpec(spec.spec, rows)
  }
  return rows
}

function shouldSummarizeField(field = {}, rows = []) {
  const type = typeof field?.type === 'string' ? field.type.toLowerCase() : ''
  if (type === 'nominal' || type === 'ordinal') return true
  return false
}

function buildFieldValueSummary({ fields = [], widgetState = null, maxValuesPerField = 12 } = {}) {
  const rows = collectInlineRowsFromSpec(widgetState?.rawSpec || widgetState?.currentSpec || null)
  if (rows.length === 0) return {}
  const summary = {}
  for (const field of Array.isArray(fields) ? fields : []) {
    const name = field?.name
    if (typeof name !== 'string' || name.length === 0) continue
    if (!shouldSummarizeField(field, rows)) continue
    const values = []
    const seen = new Set()
    for (const row of rows) {
      const value = row?.[name]
      if (value == null || typeof value === 'object') continue
      const key = JSON.stringify(value)
      if (seen.has(key)) continue
      seen.add(key)
      values.push(value)
      if (values.length >= maxValuesPerField) break
    }
    if (values.length > 0) {
      summary[name] = values
    }
  }
  return summary
}

function normalizeObservationWidgetState(widget = {}) {
  const normalized = {
    ref: widget?.ref || null,
    kind: widget?.kind || null,
    recognizedKinds: Array.isArray(widget?.recognizedKinds) ? [...widget.recognizedKinds] : [],
    focused: Boolean(widget?.focused),
  }
  if (typeof widget?.widgetId === 'string' && widget.widgetId.length > 0) {
    normalized.widgetId = widget.widgetId
  }
  if (typeof widget?.title === 'string' && widget.title.length > 0) {
    normalized.title = widget.title
  }
  if (Array.isArray(widget?.actionNames) && widget.actionNames.length > 0) {
    normalized.actionNames = [...new Set(widget.actionNames.filter((name) => typeof name === 'string' && name.length > 0))]
  }
  if (Array.isArray(widget?.perceptionNames) && widget.perceptionNames.length > 0) {
    normalized.perceptionNames = [...new Set(widget.perceptionNames.filter((name) => typeof name === 'string' && name.length > 0))]
  }
  if (widget?.data && typeof widget.data === 'object' && !Array.isArray(widget.data)) {
    const data = clone(widget.data)
    if (
      data.currentDataRef
      || data.primaryDataRef
      || Number.isFinite(data.visibleCount)
      || Number.isFinite(data.selectedCount)
      || (Array.isArray(data.fields) && data.fields.length > 0)
    ) {
      delete data.rowCount
      normalized.data = data
    }
  }
  if (widget?.encodings && typeof widget.encodings === 'object' && !Array.isArray(widget.encodings) && Object.keys(widget.encodings).length > 0) {
    normalized.encodings = clone(widget.encodings)
  }
  return normalized
}

function readActiveWidgetRefs(...candidates) {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((ref) => typeof ref === 'string' && ref.length > 0)
    }
  }
  return []
}

function countLinks(shared = {}) {
  const explicitCount = shared?.sharedStructuralContext?.linkCount
    ?? shared?.structure?.linkCount
    ?? null
  if (Number.isFinite(explicitCount)) return explicitCount
  const definitions = shared?.links?.definitions
    || shared?.sharedStructuralContext?.links?.definitions
    || []
  return Array.isArray(definitions) ? definitions.length : 0
}

function buildAgentSharedAnalyticalState(shared = {}) {
  const sharedFilterContext = shared?.sharedFilterContext || {}
  const sharedViewportContext = shared?.sharedViewportContext || {}
  const sharedSemanticFocus = shared?.sharedSemanticFocus || {}
  const sharedViewContext = shared?.sharedViewContext || {}
  const sharedTransformationContext = shared?.sharedTransformationContext || {}
  const activeAnalyticalContext = shared?.activeAnalyticalContext || {}
  const highlight = shared?.highlight || {}

  return {
    filters: clone(sharedFilterContext?.globalFilters || shared?.filters || {}),
    viewport: clone(sharedViewportContext?.viewport || shared?.viewport || null),
    focus: {
      selectionSummary: sharedSemanticFocus?.selectionSummary
        || shared?.focus?.selectionSummary
        || null,
      highlightedWidgetRefs: readActiveWidgetRefs(
        sharedSemanticFocus?.highlightedWidgetRefs,
        highlight?.activeWidgetRefs,
        shared?.focus?.highlightedWidgetRefs,
      ),
    },
    activeContextKinds: readActiveWidgetRefs(
      activeAnalyticalContext?.activeContextKinds,
      shared?.activeContextKinds,
    ),
    comparisonTargets: readActiveWidgetRefs(
      sharedViewportContext?.comparisonTargets,
      shared?.comparisonTargets,
    ),
    structure: {
      linkCount: countLinks(shared),
    },
    sharedView: {
      activeWidgetRefs: readActiveWidgetRefs(
        sharedViewContext?.activeWidgetRefs,
        shared?.sharedView?.activeWidgetRefs,
      ),
    },
    transformation: {
      activeWidgetRefs: readActiveWidgetRefs(
        sharedTransformationContext?.activeWidgetRefs,
        shared?.transformation?.activeWidgetRefs,
      ),
      widgets: clone(
        sharedTransformationContext?.widgets
          || shared?.transformation?.widgets
          || {},
      ),
    },
  }
}

export function buildAgentObservationState({
  stateId = null,
  summary = null,
  widgets = [],
  sharedAnalyticalState = {},
} = {}) {
  return {
    stateId,
    summary,
    widgets: (Array.isArray(widgets) ? widgets : [])
      .map(normalizeObservationWidgetState)
      .filter((widget) => widget.ref),
    sharedAnalyticalState: buildAgentSharedAnalyticalState(sharedAnalyticalState || {}),
  }
}

export function buildAgentObservationView({
  stateId = null,
  snapshot = undefined,
  image = null,
  summary = null,
} = {}) {
  return {
    snapshot: snapshot !== undefined
      ? clone(snapshot)
      : stateId
        ? {
          ref: `widgetva-view:${stateId}`,
          mimeType: 'application/widgetva-view+json',
        }
        : null,
    image: clone(image),
    summary,
  }
}

function buildViewObservation({ state = null, view = null } = {}) {
  if (view && typeof view === 'object') {
    return buildAgentObservationView({
      stateId: state?.stateId || null,
      snapshot: view.snapshot,
      image: view.image || null,
      summary: view.summary || null,
    })
  }

  return buildAgentObservationView({
    stateId: state?.stateId || null,
  })
}

export function buildAgentObservation({
  query = null,
  state = null,
  view = null,
} = {}) {
  return {
    query,
    state: buildAgentObservationState(state || {}),
    view: buildViewObservation({ state, view }),
  }
}

export function buildAgentObservationFromWorkspaceState({
  query = null,
  workspace = null,
  state = null,
  sharedAnalyticalState = {},
  view = null,
} = {}) {
  const focusedWidgetRef =
    sharedAnalyticalState?.focusedWidgetRef
    || sharedAnalyticalState?.sharedSemanticFocus?.focusedWidgetRef
    || state?.shared?.focusedWidget
    || null
  const widgetStatesByRef = state?.widgets && typeof state.widgets === 'object' && !Array.isArray(state.widgets)
    ? state.widgets
    : {}
  const dataHandlesByRef = new Map(
    (Array.isArray(workspace?.dataHandles) ? workspace.dataHandles : [])
      .filter((handle) => typeof handle?.ref === 'string' && handle.ref.length > 0)
      .map((handle) => [handle.ref, handle]),
  )
  const widgets = (Array.isArray(workspace?.widgets) ? workspace.widgets : [])
    .map((widget) => {
      const widgetState = widget?.ref ? widgetStatesByRef[widget.ref] || null : null
      const currentDataRef = widgetState?.data?.currentDataRef || widget?.primaryDataRef || null
      const currentDataHandle = currentDataRef ? dataHandlesByRef.get(currentDataRef) || null : null
      const data = {
        primaryDataRef: widget?.primaryDataRef || widgetState?.data?.sourceDataRef || null,
        currentDataRef,
        visibleCount: widgetState?.data?.visibleCount ?? currentDataHandle?.stats?.visibleCount ?? null,
        selectedCount: widgetState?.data?.selectedCount ?? currentDataHandle?.stats?.selectedCount ?? null,
        fields: Array.isArray(currentDataHandle?.schema?.fields)
          ? clone(currentDataHandle.schema.fields)
          : [],
      }
      const fieldValues = buildFieldValueSummary({
        fields: data.fields,
        widgetState,
      })
      if (Object.keys(fieldValues).length > 0) {
        data.fieldValues = fieldValues
      }
      return {
        ref: widget?.ref || null,
        widgetId: widget?.widgetId || widgetState?.widgetId || null,
        title: widget?.title || null,
        kind: widget?.kind || widgetState?.kind || null,
        recognizedKinds: Array.isArray(widget?.recognizedKinds) ? [...widget.recognizedKinds] : [],
        actionNames: Array.isArray(widget?.actionNames) ? [...widget.actionNames] : [],
        perceptionNames: Array.isArray(widget?.perceptionNames) ? [...widget.perceptionNames] : [],
        data,
        encodings: widgetState?.encodings && typeof widgetState.encodings === 'object'
          ? clone(widgetState.encodings)
          : null,
        focused: Boolean(widget?.ref && widget.ref === focusedWidgetRef),
      }
    })
    .filter((widget) => widget.ref)

  return buildAgentObservation({
    query,
    state: {
      stateId: state?.stateId || null,
      summary: state?.summary || null,
      widgets,
      sharedAnalyticalState,
    },
    view: view || {
      stateId: state?.stateId || null,
      summary: state?.summary || null,
    },
  })
}

export function readObservation({
  query = null,
  workspace = null,
  state = null,
  sharedAnalyticalState = null,
  view = null,
  describeWorkspace = null,
  readState = null,
  readSharedAnalyticalState = null,
  options = {},
} = {}) {
  const resolvedWorkspace = workspace || (
    typeof describeWorkspace === 'function' ? describeWorkspace() : null
  )
  const resolvedState = state || (
    typeof readState === 'function'
      ? readState(options?.readStateOptions || options)
      : null
  )
  const resolvedSharedAnalyticalState = sharedAnalyticalState || (
    typeof readSharedAnalyticalState === 'function'
      ? readSharedAnalyticalState({
          state: resolvedState,
          workspace: resolvedWorkspace,
        })
      : {}
  )

  return buildAgentObservationFromWorkspaceState({
    query,
    workspace: resolvedWorkspace,
    state: resolvedState,
    sharedAnalyticalState: resolvedSharedAnalyticalState,
    view,
  })
}
