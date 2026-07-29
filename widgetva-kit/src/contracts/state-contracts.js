import { cloneJsonValue as clone } from '../shared/clone.js'
function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter((item) => item !== undefined && item !== null) : []
}

function normalizePredicate(predicate) {
  if (!isPlainObject(predicate)) return null
  const field = normalizeString(predicate.field)
  const op = normalizeString(predicate.op) || normalizeString(predicate.operator)
  if (!field || !op) return null
  return {
    field,
    op,
    value: predicate.value,
  }
}

function normalizePredicates(value) {
  return normalizeArray(value).map(normalizePredicate).filter(Boolean)
}

function normalizeIntervalChannels(selection = {}) {
  if (isPlainObject(selection.channels)) return clone(selection.channels)
  const domain = isPlainObject(selection.domain) ? selection.domain : {}
  const value = isPlainObject(selection.value) ? selection.value : {}
  const xDomain = normalizeArray(domain.xDomain || domain.x || value.x || selection.xDomain)
  const yDomain = normalizeArray(domain.yDomain || domain.y || value.y || selection.yDomain)
  const xField = normalizeString(selection.xField)
    || normalizeString(domain.xField)
    || normalizeArray(selection.fields)[0]
    || normalizeString(selection.field)
  const yField = normalizeString(selection.yField)
    || normalizeString(domain.yField)
    || normalizeArray(selection.fields)[1]
    || null
  return {
    ...(xDomain.length > 0 ? { x: { field: xField || 'x', domain: xDomain } } : {}),
    ...(yDomain.length > 0 ? { y: { field: yField || 'y', domain: yDomain } } : {}),
  }
}

function normalizeSelectionKind(selection = {}) {
  const explicitKind = normalizeString(selection.kind || selection.selection_type)
  if (explicitKind === 'point' || explicitKind === 'interval' || explicitKind === 'predicate') {
    return explicitKind
  }
  if (isPlainObject(selection.channels) || isPlainObject(selection.domain)) return 'interval'
  if (normalizePredicates(selection.predicates).length > 0) return 'predicate'
  return explicitKind || 'point'
}

function normalizeSelectionValues(selection = {}) {
  if (Array.isArray(selection.values)) return normalizeArray(selection.values)
  if (selection.value !== undefined && !isPlainObject(selection.value)) return [selection.value]
  if (isPlainObject(selection.value)) {
    const field = normalizeString(selection.field) || normalizeArray(selection.fields)[0] || null
    if (field && selection.value[field] !== undefined) return [selection.value[field]]
  }
  if (Array.isArray(selection.keys)) return normalizeArray(selection.keys)
  return []
}

function normalizeTransformSource(transform = {}) {
  const sourceType = isPlainObject(transform.source)
    ? normalizeString(transform.source.type)
    : normalizeString(transform.source)
  const ref = normalizeString(transform.sourceRef)
    || (isPlainObject(transform.source) ? normalizeString(transform.source.ref) : null)
    || normalizeString(transform.sourceSelectionRef)
    || normalizeString(transform.linkId)
    || normalizeString(transform.spec?.actionName)
    || normalizeString(transform.actionName)
  return {
    type: sourceType || 'action',
    ...(ref ? { ref } : {}),
  }
}

function normalizeTransformPredicate(transform = {}) {
  const directPredicates = normalizePredicates(transform.predicates)
  if (directPredicates.length > 0) return directPredicates.length === 1 ? directPredicates[0] : directPredicates
  const specPredicates = normalizePredicates(transform.spec?.predicates)
  if (specPredicates.length > 0) return specPredicates.length === 1 ? specPredicates[0] : specPredicates
  const field = normalizeString(transform.field || transform.spec?.field)
  if (!field) return undefined
  const values = transform.values !== undefined ? transform.values : transform.spec?.values
  if (values !== undefined) {
    return {
      field,
      op: Array.isArray(values) ? 'in' : 'eq',
      value: values,
    }
  }
  const value = transform.value !== undefined ? transform.value : transform.spec?.value
  if (value !== undefined) {
    return {
      field,
      op: 'eq',
      value,
    }
  }
  return undefined
}

export function makeTransformState(transform = {}) {
  const kind = normalizeString(transform?.kind) || 'derive'
  const source = normalizeTransformSource(transform)
  const predicate = normalizeTransformPredicate(transform)
  const params = isPlainObject(transform.params)
    ? clone(transform.params)
    : isPlainObject(transform.spec)
      ? clone(transform.spec)
      : {}
  return {
    ref: normalizeString(transform.ref || transform.transformRef) || null,
    kind,
    source: source.type,
    sourceRef: source.ref || null,
    ...(predicate !== undefined ? { predicate } : {}),
    params,

    // Compatibility aliases for existing coordination/action-family readers.
    sourceWidgetId: undefined,
    sourceSelectionRef: undefined,
    linkId: undefined,
    spec: {},
    ...transform,
    kind,
    source: source.type,
    sourceRef: source.ref || null,
  }
}

function makeViewTransformState(view) {
  return {
    xDomain: undefined,
    yDomain: undefined,
    zoom: undefined,
    sort: undefined,
    highlight: undefined,
    drillDown: undefined,
    aggregate: undefined,
    reencode: undefined,
    addRemove: undefined,
    navigate: undefined,
    ...view,
  }
}

export function makeSelectionState(selection = {}) {
  const ref = normalizeString(selection.ref || selection.selectionRef || selection.selection_ref)
  const id = normalizeString(selection.id || selection.selectionId || selection.selection_id)
    || (ref ? ref.split('/').pop() || null : null)
  const kind = normalizeSelectionKind(selection)
  const sourceWidgetRef = normalizeString(selection.sourceWidgetRef || selection.source_widget_ref)
  const values = normalizeSelectionValues(selection)
  const predicates = normalizePredicates(selection.predicates)
  const field = normalizeString(selection.field) || normalizeArray(selection.fields)[0] || null
  const channels = kind === 'interval' ? normalizeIntervalChannels(selection) : undefined

  return {
    ref,
    id,
    kind,
    sourceWidgetRef,
    ...(kind === 'point' && field ? { field } : {}),
    ...(kind === 'point' ? { values } : {}),
    ...(kind === 'interval' ? { channels: channels || {} } : {}),
    ...(kind === 'predicate' ? { predicates } : {}),

    // Compatibility aliases for existing selection views and host bridges.
    selectionRef: ref,
    selectionId: id,
    sourceWidgetId: null,
    scope: 'local',
    selectionDataRef: null,
    fields: [],
    value: {},
    domain: null,
    predicates: [],
    summary: '',
    aggregateName: null,
    ...selection,
    ref,
    id,
    kind,
    sourceWidgetRef,
    selectionRef: ref,
    selectionId: id,
    ...(kind === 'interval' ? { channels: channels || {} } : {}),
    ...(kind === 'predicate' ? { predicates } : {}),
    ...(kind === 'point' && field ? { field } : {}),
    ...(kind === 'point' ? { values } : {}),
  }
}

export function makeInteractionFeedbackState(feedback) {
  return {
    hoveredItem: undefined,
    highlightedKeys: [],
    tooltip: undefined,
    inboundLinkIds: [],
    highlightLinkIds: [],
    linkedSourceRefs: [],
    sharedSelectionSourceWidgetId: undefined,
    ...feedback,
  }
}

export function makeWidgetState(state) {
  const data = state?.data || {}
  const materializedDataRef = data.materializedDataRef || data.currentDataRef || null
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    ...state,
    data: {
      sourceDataRef: null,
      materializedDataRef,
      // Compatibility alias: prefer materializedDataRef for new code.
      currentDataRef: materializedDataRef,
      rowCount: 0,
      visibleCount: 0,
      selectedCount: 0,
      ...data,
      materializedDataRef,
    },
    encodings: { ...(state?.encodings || {}) },
    transforms: Array.isArray(state?.transforms) ? state.transforms.map((item) => makeTransformState(item)) : [],
    view: makeViewTransformState(state?.view),
    selections: Object.fromEntries(
      Object.entries(state?.selections || {}).map(([ref, selection]) => [ref, makeSelectionState(selection)]),
    ),
    feedback: makeInteractionFeedbackState(state?.feedback),
    humanInteraction: state?.humanInteraction || undefined,
  }
}

export function makeWorkspaceState(state) {
  return {
    stateId: 'main:empty',
    createdAt: new Date().toISOString(),
    widgets: {},
    shared: {
      selections: {
        registry: {},
        views: {
          primary: null,
          byWidget: {},
        },
      },
      focus: null,
      highlight: null,
      viewport: null,
      globalFilters: {},
      focusedWidget: undefined,
      links: {
        definitions: [],
        topology: {},
      },
      ...(state?.shared || {}),
    },
    coordination: {
      relations: {},
      ...(state?.coordination || {}),
    },
    taskContext: state?.taskContext || undefined,
    replayContext: state?.replayContext || undefined,
    delta: state?.delta || undefined,
    ...state,
  }
}
