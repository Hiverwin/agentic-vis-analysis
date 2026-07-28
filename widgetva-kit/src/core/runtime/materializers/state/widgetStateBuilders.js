import {
  makeInteractionFeedbackState,
  makeSelectionState,
  makeTransformState,
  makeWidgetState,
} from '../../../../contracts/state-contracts.js'
import {
  countSelectedRowsForSelections,
  rowMatchesAnySelection,
} from './selectionHelpers.js'
import { buildSelectionStateInput } from './selectionStateShape.js'
import { buildViewAddRemoveState, buildViewAggregateState, buildViewDrillDownState, buildViewFocusState, buildViewHighlightState, buildViewNavigateState, buildViewReencodeState, buildViewSortState, buildViewZoomState } from './viewStateMetadata.js'
import { normalizeSpecTransforms } from './transformHelpers.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function makeFieldEncoding(encoding) {
  return {
    field: '',
    type: 'nominal',
    aggregate: undefined,
    bin: undefined,
    scale: undefined,
    ...encoding,
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

function readMarkType(widgetSpec) {
  if (typeof widgetSpec?.mark === 'string') return widgetSpec.mark
  if (widgetSpec?.mark && typeof widgetSpec.mark === 'object' && typeof widgetSpec.mark.type === 'string') {
    return widgetSpec.mark.type
  }
  return null
}

function normalizeSelections(activeSelectionOrSelections) {
  if (Array.isArray(activeSelectionOrSelections)) {
    return activeSelectionOrSelections.filter(Boolean)
  }
  return activeSelectionOrSelections ? [activeSelectionOrSelections] : []
}

function selectionTargetsField(selections, field) {
  if (typeof field !== 'string' || field.length === 0) return false
  return selections.some((selection) => (
    selection?.field === field
    || (Array.isArray(selection?.predicates) && selection.predicates.some((predicate) => predicate?.field === field))
  ))
}

function readLineGroupingField(spec = {}) {
  return spec?.encoding?.color?.field || spec?.encoding?.detail?.field || null
}

function escapeDatumField(field) {
  return String(field).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function isTemporalLikeValue(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return true
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed)
  }
  return false
}

function buildComparableExpression(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return `toDate(${JSON.stringify(value.toISOString())})`
  }
  if (isTemporalLikeValue(value)) {
    return `toDate(${JSON.stringify(value)})`
  }
  return JSON.stringify(value)
}

function buildDatumFieldExpression(field, predicate = null) {
  const datumRef = `datum['${escapeDatumField(field)}']`
  const value = predicate?.value
  const firstValue = Array.isArray(value) ? value[0] : value
  return isTemporalLikeValue(firstValue)
    ? `toDate(${datumRef})`
    : datumRef
}

function buildPredicateExpression(predicate) {
  const field = typeof predicate?.field === 'string' ? predicate.field : null
  if (!field) return null
  const datumRef = buildDatumFieldExpression(field, predicate)

  if (predicate.op === 'equals' || predicate.op === 'eq') {
    return `${datumRef} === ${buildComparableExpression(predicate.value)}`
  }
  if (predicate.op === 'in' && Array.isArray(predicate.value) && predicate.value.length > 0) {
    return `indexof([${predicate.value.map((value) => buildComparableExpression(value)).join(', ')}], ${datumRef}) >= 0`
  }
  if (predicate.op === 'between' && Array.isArray(predicate.value) && predicate.value.length >= 2) {
    return `${datumRef} >= ${buildComparableExpression(predicate.value[0])} && ${datumRef} <= ${buildComparableExpression(predicate.value[1])}`
  }
  return null
}

function buildSelectionConditionExpression(selections) {
  const clauses = normalizeSelections(selections)
    .map((selection) => {
      const predicates = Array.isArray(selection?.predicates) ? selection.predicates : []
      const predicateClauses = predicates.map((predicate) => buildPredicateExpression(predicate)).filter(Boolean)
      return predicateClauses.length > 0 ? `(${predicateClauses.join(' && ')})` : null
    })
    .filter(Boolean)
  return clauses.length > 0 ? clauses.join(' || ') : null
}

function removeRuntimeSelectionTransforms(transforms = []) {
  return (Array.isArray(transforms) ? transforms : []).filter((entry) => entry?._widgetvaRuntimeSelection !== true)
}

function applyRuntimeSelectionFilterToSpec(spec, selectionTest) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec) || !selectionTest) {
    return spec
  }

  const nextSpec = cloneValue(spec)

  function attachFilter(node) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return false

    const hasInlineValues = Array.isArray(node?.data?.values)
    const hasBoundData =
      Boolean(node?.data)
      && typeof node.data === 'object'
      && !Array.isArray(node.data)
      && !hasInlineValues

    if (hasBoundData) {
      node.transform = [
        {
          _widgetvaRuntimeSelection: true,
          filter: selectionTest,
        },
        ...removeRuntimeSelectionTransforms(node.transform),
      ]
      return true
    }

    if (node?.spec && typeof node.spec === 'object' && !Array.isArray(node.spec) && attachFilter(node.spec)) {
      return true
    }

    for (const key of ['layer', 'concat', 'vconcat', 'hconcat']) {
      if (!Array.isArray(node?.[key])) continue
      for (const child of node[key]) {
        if (attachFilter(child)) return true
      }
    }

    return false
  }

  if (!attachFilter(nextSpec)) {
    nextSpec.transform = [
      {
        _widgetvaRuntimeSelection: true,
        filter: selectionTest,
      },
      ...removeRuntimeSelectionTransforms(nextSpec.transform),
    ]
  }

  return nextSpec
}

function buildLineXSelectionSpec(nextSpec) {
  const baseMark = typeof nextSpec?.mark === 'string'
    ? { type: nextSpec.mark, point: false }
    : {
        ...(nextSpec?.mark || {}),
        point: false,
      }

  const rootEncoding = cloneValue(nextSpec?.encoding || {})
  const layeredSpec = {
    ...nextSpec,
    encoding: rootEncoding,
    layer: [
      {
        mark: baseMark,
        encoding: {
          opacity: { value: 0.22 },
        },
      },
      {
        transform: [{ filter: 'datum.__widgetva_selected === true' }],
        mark: {
          type: 'point',
          filled: true,
          size: 72,
          stroke: '#ffffff',
          strokeWidth: 1.25,
        },
        encoding: {
          opacity: { value: 1 },
        },
      },
    ],
  }

  delete layeredSpec.mark
  return layeredSpec
}

export function buildEncodings(spec) {
  const enc = spec?.encoding || {}
  const normalized = {}
  for (const [channel, value] of Object.entries(enc)) {
    if (!value || typeof value !== 'object') continue
    normalized[channel] = makeFieldEncoding({
      field: value.field,
      type: value.type,
      aggregate: value.aggregate,
      bin: value.bin,
      scale: value.scale,
    })
  }
  return normalized
}

export function buildHighlightFeedback({ link, activeSelections, existingFeedback }) {
  const selections = normalizeSelections(activeSelections)
  const values = selections
    .flatMap((selection) => Array.isArray(selection?.predicates) ? selection.predicates : [])
    .filter((predicate) => predicate.op === 'equals' || predicate.op === 'eq' || predicate.op === 'in')
    .flatMap((predicate) => (Array.isArray(predicate.value) ? predicate.value : [predicate.value]))
  return {
    ...makeInteractionFeedbackState(existingFeedback),
    highlightLinkIds: [...new Set([...(existingFeedback?.highlightLinkIds || []), link.linkId])],
    highlightedKeys: [...new Set(values)],
  }
}

function getHighlightInfo({ link, activeSelections }) {
  const predicates = normalizeSelections(activeSelections)
    .flatMap((selection) => Array.isArray(selection?.predicates) ? selection.predicates : [])
  const categoricalPredicates = predicates.filter((predicate) => predicate.op === 'equals' || predicate.op === 'eq' || predicate.op === 'in')
  if (categoricalPredicates.length === 0) return null

  const mapping = Array.isArray(link?.fieldMapping) && link.fieldMapping.length > 0 ? link.fieldMapping[0] : null
  const sourceField = mapping?.sourceField || categoricalPredicates[0].field
  const targetField = mapping?.targetField || sourceField
  const matchedPredicate = categoricalPredicates.find((predicate) => predicate.field === sourceField) || categoricalPredicates[0]
  const values = Array.isArray(matchedPredicate.value) ? matchedPredicate.value : [matchedPredicate.value]
  return {
    sourceField,
    targetField,
    values,
  }
}

export function buildLinkedViewState({ widgetSpec, inboundLinks, activeSelections }) {
  const viewState = {
    xDomain: widgetSpec?.encoding?.x?.scale?.domain,
    yDomain: widgetSpec?.encoding?.y?.scale?.domain,
  }
  const selections = normalizeSelections(activeSelections)
  for (const link of inboundLinks) {
    if (link.kind === 'syncDomain') {
      for (const activeSelection of selections) {
        if (!activeSelection?.domain) continue
        if (Array.isArray(activeSelection.domain.xDomain)) viewState.xDomain = activeSelection.domain.xDomain
        if (Array.isArray(activeSelection.domain.yDomain)) viewState.yDomain = activeSelection.domain.yDomain
      }
    }
  }
  viewState.zoom = buildViewZoomState({
    widgetSpec,
    xDomain: viewState.xDomain,
    yDomain: viewState.yDomain,
  })
  viewState.sort = buildViewSortState({ widgetSpec })
  viewState.highlight = buildViewHighlightState({ widgetSpec })
  viewState.drillDown = buildViewDrillDownState({ widgetSpec })
  viewState.aggregate = buildViewAggregateState({ widgetSpec })
  viewState.reencode = buildViewReencodeState({ widgetSpec })
  viewState.addRemove = buildViewAddRemoveState({ widgetSpec })
  viewState.navigate = buildViewNavigateState({ widgetSpec })
  Object.assign(viewState, buildViewFocusState({ widgetSpec }))
  return viewState
}

export function applyLinkedViewStateToSpec({ widgetSpec, inboundLinks, activeSelections }) {
  if (!widgetSpec?.encoding) return widgetSpec
  const hasDomainSync = inboundLinks.some((link) => link.kind === 'syncDomain')
  const selections = normalizeSelections(activeSelections).filter((selection) => selection?.domain)
  if (!hasDomainSync || selections.length === 0) return widgetSpec

  const nextSpec = cloneValue(widgetSpec)
  const resolvedXDomain = [...selections]
    .reverse()
    .find((selection) => Array.isArray(selection?.domain?.xDomain))
    ?.domain?.xDomain || null
  const resolvedYDomain = [...selections]
    .reverse()
    .find((selection) => Array.isArray(selection?.domain?.yDomain))
    ?.domain?.yDomain || null

  if (Array.isArray(resolvedXDomain) && nextSpec.encoding?.x) {
    nextSpec.encoding.x = {
      ...nextSpec.encoding.x,
      scale: {
        ...(nextSpec.encoding.x.scale || {}),
        domain: resolvedXDomain,
      },
    }
  }
  if (Array.isArray(resolvedYDomain) && nextSpec.encoding?.y) {
    nextSpec.encoding.y = {
      ...nextSpec.encoding.y,
      scale: {
        ...(nextSpec.encoding.y.scale || {}),
        domain: resolvedYDomain,
      },
    }
  }
  return nextSpec
}

export function applyHighlightToSpec({ widgetSpec, inboundLinks, activeSelections }) {
  const highlightLink = inboundLinks.find((link) => link.kind === 'highlight')
  if (!highlightLink || !Array.isArray(widgetSpec?.data?.values)) return widgetSpec
  const highlightInfo = getHighlightInfo({ link: highlightLink, activeSelections })
  if (!highlightInfo || highlightInfo.values.length === 0) return widgetSpec

  const nextSpec = cloneValue(widgetSpec)
  const highlightedRows = nextSpec.data.values.map((row) => ({
    ...row,
    __widgetva_highlight: highlightInfo.values.includes(row?.[highlightInfo.targetField]),
  }))
  nextSpec.data = { values: highlightedRows }
  nextSpec.encoding = {
    ...(nextSpec.encoding || {}),
    opacity: {
      condition: {
        test: "datum.__widgetva_highlight === true",
        value: 0.95,
      },
      value: 0.18,
    },
  }
  return nextSpec
}

export function applySelectionToSpec({ widgetSpec, activeSelections, selectionEnabled = false }) {
  const selections = normalizeSelections(activeSelections)
  if (!selectionEnabled || selections.length === 0) return widgetSpec

  const nextSpec = cloneValue(widgetSpec)
  const markType = readMarkType(nextSpec)
  if (markType === 'rect') {
    const selectionTest = buildSelectionConditionExpression(selections)
    if (!selectionTest) return nextSpec
    nextSpec.encoding = {
      ...(nextSpec.encoding || {}),
      opacity: {
        condition: {
          test: selectionTest,
          value: 1,
        },
        value: 0.22,
      },
    }
    return nextSpec
  }

  if (!Array.isArray(nextSpec?.data?.values)) {
    const selectionTest = buildSelectionConditionExpression(selections)
    if (!selectionTest) return widgetSpec
    return applyRuntimeSelectionFilterToSpec(nextSpec, selectionTest)
  }

  const selectedRows = nextSpec.data.values.map((row) => ({
    ...row,
    __widgetva_selected: rowMatchesAnySelection(row, selections),
  }))
  nextSpec.data = {
    ...(nextSpec.data || {}),
    values: selectedRows,
  }

  const xField = nextSpec?.encoding?.x?.field || null
  if (markType === 'line' && selectionTargetsField(selections, xField)) {
    return buildLineXSelectionSpec(nextSpec)
  }
  const lineGroupingField = readLineGroupingField(nextSpec)
  if (markType === 'line' && selectionTargetsField(selections, lineGroupingField)) {
    const selectionTest = buildSelectionConditionExpression(selections)
    if (!selectionTest) return nextSpec
    nextSpec.encoding = {
      ...(nextSpec.encoding || {}),
      opacity: {
        condition: {
          test: selectionTest,
          value: 0.98,
        },
        value: 0.18,
      },
      strokeWidth: {
        condition: {
          test: selectionTest,
          value: 3.5,
        },
        value: 1.2,
      },
    }
    return nextSpec
  }

  const nextEncoding = {
    ...(nextSpec.encoding || {}),
    opacity: {
      condition: {
        test: 'datum.__widgetva_selected === true',
        value: 0.98,
      },
      value: 0.22,
    },
  }
  if (markType === 'bar') {
    const barSelectionTest = buildSelectionConditionExpression(selections) || 'datum.__widgetva_selected === true'
    nextEncoding.stroke = {
      condition: {
        test: barSelectionTest,
        value: '#1f4f82',
      },
      value: null,
    }
    nextEncoding.strokeWidth = {
      condition: {
        test: barSelectionTest,
        value: 2,
      },
      value: 0,
    }
    nextEncoding.opacity = {
      condition: {
        test: barSelectionTest,
        value: 0.98,
      },
      value: 0.22,
    }
  }
  if (markType === 'rect') {
    nextEncoding.opacity = {
      condition: {
        test: 'datum.__widgetva_selected === true',
        value: 1,
      },
      value: 0.22,
    }
  }
  if (markType === 'point' || markType === 'circle') {
    nextEncoding.opacity = {
      condition: {
        test: 'datum.__widgetva_selected === true',
        value: 0.98,
      },
      value: 0.38,
    }
    nextEncoding.strokeOpacity = {
      condition: {
        test: 'datum.__widgetva_selected === true',
        value: 1,
      },
      value: 0.24,
    }
    nextEncoding.strokeWidth = {
      condition: {
        test: 'datum.__widgetva_selected === true',
        value: 1.8,
      },
      value: 0.6,
    }
    nextEncoding.fillOpacity = {
      condition: {
        test: 'datum.__widgetva_selected === true',
        value: 0.9,
      },
      value: 0.12,
    }
  }
  nextSpec.encoding = nextEncoding

  return nextSpec
}

export function buildTransforms({ widgetSpec, inboundLinks }) {
  const specTransforms = normalizeSpecTransforms(widgetSpec?.transform)
  const sankeyFilterState = widgetSpec?._sankey_filter_state
  if (sankeyFilterState && typeof sankeyFilterState === 'object') {
    specTransforms.push(makeTransformState({
      kind: 'filter',
      source: 'widgetSpec',
      spec: {
        mode: sankeyFilterState.mode || 'threshold',
        minValue: Number.isFinite(sankeyFilterState.min_value) ? sankeyFilterState.min_value : null,
        sourceAction: sankeyFilterState.source_action || null,
      },
    }))
  }

  return [
    ...specTransforms,
    ...inboundLinks
      .filter((link) => link.kind === 'filter' || link.kind === 'syncDomain')
      .map((link) => makeTransformState({
        kind: link.kind,
        sourceWidgetId: link.sourceWidgetId,
        linkId: link.linkId,
        spec: {
          linkRef: link.ref || null,
          sourceWidgetId: link.sourceWidgetId,
          targetWidgetId: link.targetWidgetId,
        },
      })),
  ]
}

export function buildWidgetState({
  widgetRef,
  widgetId,
  role,
  kind,
  updatedAt,
  sourceDataRef,
  currentDataRef,
  rowCount,
  visibleCount,
  selectedCount,
  widgetSpec,
  inboundLinks,
  activeSelections,
  widgetSelectionRefs,
  mirroredSelectionEntries,
  humanInteraction,
  linkedRefs,
  existingFeedback,
}) {
  const inboundHighlightLink = inboundLinks.find((link) => link.kind === 'highlight')
  const inboundSharedSelectionLink = inboundLinks.find((link) => link.kind === 'sharesSelection')
  const normalizedSelections = normalizeSelections(activeSelections)
  const feedback = inboundHighlightLink
    ? buildHighlightFeedback({
        link: inboundHighlightLink,
        activeSelections: normalizedSelections,
        existingFeedback,
      })
    : {
        ...makeInteractionFeedbackState(existingFeedback),
        inboundLinkIds: inboundLinks.length > 0
          ? inboundLinks.map((link) => link.linkId)
          : makeInteractionFeedbackState(existingFeedback).inboundLinkIds,
        linkedSourceRefs: linkedRefs.length > 0
          ? linkedRefs
          : makeInteractionFeedbackState(existingFeedback).linkedSourceRefs,
        ...(inboundSharedSelectionLink
          ? {
              sharedSelectionSourceWidgetId: inboundSharedSelectionLink.sourceWidgetId,
            }
          : {}),
      }

  const selectionStateMap = {}
  for (const entry of Array.isArray(widgetSelectionRefs) ? widgetSelectionRefs : []) {
    if (!entry?.ref || !entry?.selection) continue
    selectionStateMap[entry.ref] = makeSelectionState(buildSelectionStateInput(entry.selection))
  }
  for (const entry of Array.isArray(mirroredSelectionEntries) ? mirroredSelectionEntries : []) {
    if (!entry?.ref || !entry?.selection) continue
    selectionStateMap[entry.ref] = makeSelectionState(buildSelectionStateInput(entry.selection))
  }

  const state = makeWidgetState({
    ref: widgetRef,
    widgetId,
    role,
    kind,
    version: 1,
    updatedAt,
    data: {
      sourceDataRef,
      currentDataRef,
      rowCount,
      visibleCount,
      selectedCount: countSelectedRowsForSelections(widgetSpec?.data?.values || [], [
        ...(Array.isArray(widgetSelectionRefs) ? widgetSelectionRefs.map((entry) => entry?.selection) : []),
        ...(Array.isArray(mirroredSelectionEntries) ? mirroredSelectionEntries.map((entry) => entry?.selection) : []),
      ]) || selectedCount,
    },
    encodings: buildEncodings(widgetSpec),
    transforms: buildTransforms({ widgetSpec, inboundLinks }),
    view: makeViewTransformState(buildLinkedViewState({
      widgetSpec,
      inboundLinks,
      activeSelections: normalizedSelections,
    })),
    selections: selectionStateMap,
    feedback: makeInteractionFeedbackState(feedback),
    rawSpec: widgetSpec,
    humanInteraction,
  })

  if (!state.feedback.inboundLinkIds) {
    state.feedback = {
      ...(state.feedback || {}),
      inboundLinkIds: inboundLinks.map((link) => link.linkId),
      linkedSourceRefs: linkedRefs,
    }
  }

  return state
}
