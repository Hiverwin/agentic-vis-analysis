import {
  makeFieldEncoding,
  makeInteractionFeedbackState,
  makeSelectionState,
  makeTransformState,
  makeViewTransformState,
  makeWidgetState,
} from '../../protocol/state.js'
import {
  countSelectedRowsForSelections,
  rowMatchesAnySelection,
} from './selectionHelpers.js'
import { buildSelectionStateInput } from './selectionStateShape.js'
import { buildViewAddRemoveState, buildViewAggregateState, buildViewAnnotateState, buildViewDrillDownState, buildViewFocusState, buildViewHighlightState, buildViewNavigateState, buildViewReencodeState, buildViewSortState, buildViewZoomState } from './viewStateMetadata.js'
import { normalizeSpecTransforms } from './transformHelpers.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
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

function escapeDatumField(field) {
  return String(field).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function buildPredicateExpression(predicate) {
  const field = typeof predicate?.field === 'string' ? predicate.field : null
  if (!field) return null
  const datumRef = `datum['${escapeDatumField(field)}']`

  if (predicate.op === 'equals') {
    return `${datumRef} === ${JSON.stringify(predicate.value)}`
  }
  if (predicate.op === 'in' && Array.isArray(predicate.value) && predicate.value.length > 0) {
    return `indexof(${JSON.stringify(predicate.value)}, ${datumRef}) >= 0`
  }
  if (predicate.op === 'between' && Array.isArray(predicate.value) && predicate.value.length >= 2) {
    const [left, right] = predicate.value
    const minValue = Math.min(left, right)
    const maxValue = Math.max(left, right)
    return `${datumRef} >= ${JSON.stringify(minValue)} && ${datumRef} <= ${JSON.stringify(maxValue)}`
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
    .filter((predicate) => predicate.op === 'equals' || predicate.op === 'in')
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
  const categoricalPredicates = predicates.filter((predicate) => predicate.op === 'equals' || predicate.op === 'in')
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
    if (link.primitive === 'syncDomain') {
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
  viewState.annotate = buildViewAnnotateState({ widgetSpec })
  viewState.addRemove = buildViewAddRemoveState({ widgetSpec })
  viewState.navigate = buildViewNavigateState({ widgetSpec })
  Object.assign(viewState, buildViewFocusState({ widgetSpec }))
  return viewState
}

export function applyLinkedViewStateToSpec({ widgetSpec, inboundLinks, activeSelections }) {
  if (!widgetSpec?.encoding) return widgetSpec
  const hasDomainSync = inboundLinks.some((link) => link.primitive === 'syncDomain')
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
  const highlightLink = inboundLinks.find((link) => link.primitive === 'highlight')
  if (!highlightLink || !Array.isArray(widgetSpec?.data?.values)) return widgetSpec
  const highlightInfo = getHighlightInfo({ link: highlightLink, activeSelections })
  if (!highlightInfo || highlightInfo.values.length === 0) return widgetSpec

  const nextSpec = cloneValue(widgetSpec)
  const highlightedRows = nextSpec.data.values.map((row) => ({
    ...row,
    __widgetva_highlight: highlightInfo.values.includes(row?.[highlightInfo.targetField]),
  }))
  nextSpec.data = { values: highlightedRows }
  if (nextSpec.kind === 'table') {
    return nextSpec
  }
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

  if (!Array.isArray(nextSpec?.data?.values)) return widgetSpec
  const selectedRows = nextSpec.data.values.map((row) => ({
    ...row,
    __widgetva_selected: rowMatchesAnySelection(row, selections),
  }))
  nextSpec.data = {
    ...(nextSpec.data || {}),
    values: selectedRows,
  }

  if (nextSpec.kind === 'table') {
    return nextSpec
  }

  const xField = nextSpec?.encoding?.x?.field || null
  if (markType === 'line' && selectionTargetsField(selections, xField)) {
    return buildLineXSelectionSpec(nextSpec)
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
    nextEncoding.fill = {
      condition: {
        test: 'datum.__widgetva_selected === true',
        value: '#4c78a8',
      },
      value: '#4c78a8',
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
      .filter((link) => link.primitive === 'filter' || link.primitive === 'syncDomain')
      .map((link) => makeTransformState({
        kind: link.primitive,
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
  const inboundHighlightLink = inboundLinks.find((link) => link.primitive === 'highlight')
  const inboundSharedSelectionLink = inboundLinks.find((link) => link.primitive === 'sharesSelection')
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
