import { cloneJsonValue as clone } from '../../../../../shared/clone.js'
import { executeVegaLiteSpecAction } from '../../../../../adapters/vegaLite/vegaLiteSpecActionExecutor.js'
import {
  buildComparableExpression,
  buildDatumFieldExpression,
  buildPredicateExpression,
} from './vegaLiteSelectionProjection.js'

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function readRuntimeTransformTag(transform = {}) {
  return transform?._widgetvaTag
    || transform?.spec?.actionName
    || transform?.linkId
    || transform?.sourceRef
    || null
}

function buildVegaLiteFilterForPredicate(predicate = {}) {
  const field = typeof predicate?.field === 'string' ? predicate.field : null
  if (!field) return null

  if ((predicate.op === 'equals' || predicate.op === 'eq') && Object.prototype.hasOwnProperty.call(predicate, 'value')) {
    return { field, equal: clone(predicate.value) }
  }
  if (predicate.op === 'in' && Array.isArray(predicate.value) && predicate.value.length > 0) {
    return { field, oneOf: clone(predicate.value) }
  }
  if (predicate.op === 'notIn' && Array.isArray(predicate.value) && predicate.value.length > 0) {
    return { not: { field, oneOf: clone(predicate.value) } }
  }
  if (predicate.op === 'between' && Array.isArray(predicate.value) && predicate.value.length >= 2) {
    return { field, range: clone(predicate.value.slice(0, 2)) }
  }
  if ((predicate.op === 'gte' || predicate.op === 'greaterThanOrEqual') && Object.prototype.hasOwnProperty.call(predicate, 'value')) {
    return { field, gte: clone(predicate.value) }
  }
  if ((predicate.op === 'lte' || predicate.op === 'lessThanOrEqual') && Object.prototype.hasOwnProperty.call(predicate, 'value')) {
    return { field, lte: clone(predicate.value) }
  }
  if ((predicate.op === 'gt' || predicate.op === 'greaterThan') && Object.prototype.hasOwnProperty.call(predicate, 'value')) {
    return { field, gt: clone(predicate.value) }
  }
  if ((predicate.op === 'lt' || predicate.op === 'lessThan') && Object.prototype.hasOwnProperty.call(predicate, 'value')) {
    return { field, lt: clone(predicate.value) }
  }
  return null
}

function buildVegaLiteTransformsFromRuntimeState(state = {}) {
  return (Array.isArray(state?.transforms) ? state.transforms : []).flatMap((transform) => {
    if (transform?._widgetvaRuntimeSelection === true) return []
    const directPredicate = isPlainObject(transform?.predicate)
      ? [transform.predicate]
      : Array.isArray(transform?.predicate)
        ? transform.predicate.filter(isPlainObject)
        : []
    const predicates = directPredicate.length > 0
      ? directPredicate
      : Array.isArray(transform?.spec?.predicates) ? transform.spec.predicates : []
    const filters = predicates.map((predicate) => buildVegaLiteFilterForPredicate(predicate)).filter(Boolean)
    if (filters.length === 0) return []
    const tag = readRuntimeTransformTag(transform)
    return filters.map((filter) => ({
      _widgetvaRuntimeTransform: true,
      ...(tag ? { _widgetvaTag: tag } : {}),
      filter,
    }))
  })
}

function readActionTransformName(transform = {}) {
  return typeof transform?.spec?.actionName === 'string' ? transform.spec.actionName : null
}

function readTransformValues(transform = {}) {
  if (Array.isArray(transform?.spec?.values)) return clone(transform.spec.values)
  const predicate = Array.isArray(transform?.spec?.predicates)
    ? transform.spec.predicates.find((entry) => Array.isArray(entry?.value))
    : null
  return predicate ? clone(predicate.value) : []
}

function readTransformField(transform = {}) {
  if (typeof transform?.spec?.field === 'string' && transform.spec.field.length > 0) {
    return transform.spec.field
  }
  const predicate = Array.isArray(transform?.spec?.predicates)
    ? transform.spec.predicates.find((entry) => typeof entry?.field === 'string' && entry.field.length > 0)
    : null
  return predicate?.field || null
}

function isKnownProviderProjectedTransform(transform = {}) {
  return typeof readActionTransformName(transform) === 'string'
}

function applyVegaLiteSpecAction(spec, actionName, params = {}) {
  try {
    const result = executeVegaLiteSpecAction({
      actionName,
      spec,
      params,
    })
    return result?.handled ? { handled: true, nextSpec: result.nextSpec } : { handled: false, nextSpec: spec }
  } catch {
    return { handled: false, nextSpec: spec }
  }
}

function compactObject(value = {}) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null),
  )
}

function applyInlineDomainState(spec, { xDomain = null, yDomain = null } = {}) {
  if (!isPlainObject(spec?.encoding)) return spec
  const nextEncoding = { ...(spec.encoding || {}) }
  if (Array.isArray(xDomain) && nextEncoding.x) {
    nextEncoding.x = {
      ...nextEncoding.x,
      scale: { ...(nextEncoding.x.scale || {}), domain: clone(xDomain) },
    }
  }
  if (Array.isArray(yDomain) && nextEncoding.y) {
    nextEncoding.y = {
      ...nextEncoding.y,
      scale: { ...(nextEncoding.y.scale || {}), domain: clone(yDomain) },
    }
  }
  const nextMark = typeof spec.mark === 'string'
    ? { type: spec.mark, clip: true }
    : isPlainObject(spec.mark)
      ? { ...spec.mark, clip: true }
      : spec.mark
  return { ...spec, ...(nextMark ? { mark: nextMark } : {}), encoding: nextEncoding }
}

function applyInlineSortState(spec, sort = {}) {
  if (!isPlainObject(spec?.encoding)) return spec
  const channel = typeof sort?.channel === 'string' ? sort.channel : null
  const order = typeof sort?.order === 'string' ? sort.order : null
  if (!channel || !order || !isPlainObject(spec.encoding?.[channel])) return spec
  const currentChannel = spec.encoding[channel]
  const sortField = typeof sort.field === 'string' ? sort.field : currentChannel.field
  return {
    ...spec,
    encoding: {
      ...(spec.encoding || {}),
      [channel]: {
        ...currentChannel,
        sort: sortField
          ? { field: sortField, order, ...(typeof sort.aggregate === 'string' ? { op: sort.aggregate } : {}) }
          : order,
      },
    },
  }
}

function readTransformFields(transform = {}) {
  return Array.isArray(transform?.spec?.fields)
    ? transform.spec.fields.filter((field) => typeof field === 'string' && field.length > 0)
    : []
}

function readValueList(value) {
  if (Array.isArray(value)) return value
  return value == null ? undefined : [value]
}

function buildProviderActionParamsFromTransform(transform = {}) {
  const actionName = readActionTransformName(transform)
  if (!actionName) return null
  const spec = isPlainObject(transform?.spec) ? clone(transform.spec) : {}
  delete spec.actionName
  const field = readTransformField(transform)
  const fields = readTransformFields(transform)
  const values = readTransformValues(transform)

  switch (actionName) {
    case 'scatter.filterCategorical':
      return values.length > 0 ? compactObject({ field, categoriesToRemove: values }) : null
    case 'bar.filterCategories':
      return values.length > 0 ? compactObject({ field, categories: values }) : null
    case 'bar.filterSubcategories':
      return values.length > 0 ? compactObject({ subField: field, subcategoriesToRemove: values }) : null
    case 'bar.addBars':
    case 'bar.removeBars':
      return compactObject({
        field,
        values: Array.isArray(spec.changedValues) && spec.changedValues.length > 0 ? clone(spec.changedValues) : values,
        visibleValues: values,
      })
    case 'bar.addBarItems':
    case 'bar.removeBarItems':
      return compactObject({
        xField: fields[0],
        subField: fields[1],
        items: Array.isArray(spec.changedItems) && spec.changedItems.length > 0 ? clone(spec.changedItems) : values,
        visibleItems: values,
      })
    case 'line.filterLines':
      return values.length > 0 ? compactObject({ lineField: field, linesToRemove: values }) : null
    case 'line.boldLines':
      return compactObject({
        lineField: field,
        lineNames: values,
        boldWidth: spec.boldWidth,
        baseWidth: spec.baseWidth,
      })
    case 'line.zoomXRegion':
      return compactObject({
        start: spec.start ?? spec.xMin ?? spec.min,
        end: spec.end ?? spec.xMax ?? spec.max,
      })
    case 'parallelCoordinates.filterByCategory':
      return values.length > 0 ? compactObject({ field, values }) : null
    case 'parallelCoordinates.filterDimension':
      return compactObject({
        dimension: spec.dimension || field,
        range: spec.range || values,
      })
    case 'parallelCoordinates.hideDimensions':
      return compactObject({
        dimensions: Array.isArray(spec.dimensions) && spec.dimensions.length > 0
          ? spec.dimensions
          : spec.hiddenDimensions,
        mode: spec.operation,
      })
    case 'heatmap.filterCells':
    case 'heatmap.filterCellsByRegion':
      return compactObject({
        xField: fields[0],
        yField: fields[1],
        xValues: Array.isArray(spec.xValues)
          ? spec.xValues
          : (Array.isArray(spec.x) ? spec.x : readValueList(spec.xValue ?? (fields[0] ? spec.value?.[fields[0]] : undefined))),
        yValues: Array.isArray(spec.yValues)
          ? spec.yValues
          : (Array.isArray(spec.y) ? spec.y : readValueList(spec.yValue ?? (fields[1] ? spec.value?.[fields[1]] : undefined))),
      })
    case 'heatmap.drilldownAxis':
      return compactObject({
        axis: spec.axis,
        field,
        value: spec.value,
      })
    case 'heatmap.thresholdMask':
      return compactObject({
        threshold: spec.threshold ?? spec.minValue,
        minValue: spec.minValue,
        maxValue: spec.maxValue,
        mode: spec.mode,
        outsideOpacity: spec.outsideOpacity,
      })
    default:
      return spec
  }
}

export function applyVegaLiteFilterState(spec, transforms = []) {
  const safeTransforms = Array.isArray(transforms) ? transforms : []
  let nextSpec = spec
  const projectedTransforms = new Set()
  for (const transform of safeTransforms) {
    const actionName = readActionTransformName(transform)
    const params = buildProviderActionParamsFromTransform(transform)
    if (!actionName || !params) continue
    const result = applyVegaLiteSpecAction(nextSpec, actionName, params)
    if (result.handled) {
      nextSpec = result.nextSpec
      projectedTransforms.add(transform)
    }
  }

  const genericTransforms = safeTransforms.filter((transform) => (
    !projectedTransforms.has(transform)
    && !isKnownProviderProjectedTransform(transform)
  ))
  return genericTransforms.length > 0
    ? injectRuntimeTransformsIntoSpec(nextSpec, { transforms: genericTransforms })
    : nextSpec
}

export function applyVegaLiteViewState(spec, view = {}) {
  const xDomain = Array.isArray(view?.xDomain) ? view.xDomain : null
  const yDomain = Array.isArray(view?.yDomain) ? view.yDomain : null
  let nextSpec = spec
  if (xDomain || yDomain) {
    if (view?.zoom?.sourceAction === 'line.zoomXRegion') {
      nextSpec = applyVegaLiteSpecAction(spec, 'line.zoomXRegion', {
        start: view.zoom?.start ?? xDomain?.[0],
        end: view.zoom?.end ?? xDomain?.[1],
      }).nextSpec
    } else {
      nextSpec = applyInlineDomainState(spec, { xDomain, yDomain })
    }
  }

  if (isPlainObject(view?.sort)) {
    const actionName = view.sort.sourceAction || null
    const result = actionName ? applyVegaLiteSpecAction(nextSpec, actionName, view.sort) : { handled: false }
    nextSpec = result.handled ? result.nextSpec : applyInlineSortState(nextSpec, view.sort)
  }
  if (isPlainObject(view?.drillDown)) {
    const actionName = view.drillDown.sourceAction || 'line.drillDownXAxis'
    nextSpec = applyVegaLiteSpecAction(nextSpec, actionName, view.drillDown).nextSpec
  }
  return nextSpec
}

function buildPredicateExpressionList(predicates = []) {
  return (Array.isArray(predicates) ? predicates : [predicates])
    .filter(isPlainObject)
    .map((predicate) => buildPredicateExpression(predicate))
    .filter((expression) => typeof expression === 'string' && expression.length > 0)
}

function readReencodePredicateExpression(reencode = {}) {
  const selectionPredicates = Array.isArray(reencode?.sourceSelection?.predicates)
    ? reencode.sourceSelection.predicates
    : []
  const sourcePredicates = Array.isArray(reencode?.sourcePredicate)
    ? reencode.sourcePredicate
    : isPlainObject(reencode?.sourcePredicate)
      ? [reencode.sourcePredicate]
      : []
  const ownPredicates = Array.isArray(reencode?.predicates) ? reencode.predicates : []
  const expressions = buildPredicateExpressionList([
    ...selectionPredicates,
    ...sourcePredicates,
    ...ownPredicates,
  ])
  if (expressions.length === 0) return null
  if (expressions.length === 1) return expressions[0]
  return expressions.map((expression) => `(${expression})`).join(' && ')
}

function applyFocusContextEncodingToSpec(spec = {}, expression = null, options = {}) {
  if (!isPlainObject(spec) || typeof expression !== 'string' || expression.length === 0) return spec
  const activeOpacity = Number.isFinite(options.activeOpacity) ? options.activeOpacity : 0.98
  const inactiveOpacity = Number.isFinite(options.inactiveOpacity) ? options.inactiveOpacity : 0.18
  const activeStrokeWidth = Number.isFinite(options.activeStrokeWidth) ? options.activeStrokeWidth : 3.5
  const inactiveStrokeWidth = Number.isFinite(options.inactiveStrokeWidth) ? options.inactiveStrokeWidth : 1.2
  const rewrite = (viewSpec) => ({
    ...viewSpec,
    encoding: {
      ...(viewSpec.encoding || {}),
      opacity: {
        condition: { test: expression, value: activeOpacity },
        value: inactiveOpacity,
      },
      strokeWidth: {
        condition: { test: expression, value: activeStrokeWidth },
        value: inactiveStrokeWidth,
      },
    },
  })

  if (isPlainObject(spec.encoding)) return rewrite(spec)
  let changed = false
  const nextSpec = { ...spec }
  for (const key of ['layer', 'vconcat', 'hconcat', 'concat']) {
    if (!Array.isArray(spec[key])) continue
    const nextChildren = spec[key].map((child) => {
      const nextChild = applyFocusContextEncodingToSpec(child, expression, options)
      if (nextChild !== child) changed = true
      return nextChild
    })
    nextSpec[key] = nextChildren
  }
  if (isPlainObject(spec.spec)) {
    const nextChild = applyFocusContextEncodingToSpec(spec.spec, expression, options)
    if (nextChild !== spec.spec) changed = true
    nextSpec.spec = nextChild
  }
  return changed ? nextSpec : spec
}

function applyVegaLiteCoordinationReencodeState(spec, reencode = {}) {
  const expression = readReencodePredicateExpression(reencode)
  if (!expression) return spec
  return applyFocusContextEncodingToSpec(spec, expression, reencode)
}

function uniqueNonNull(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => value != null))]
}

function hasEncodingField(spec = {}, field = null) {
  if (!isPlainObject(spec?.encoding) || typeof field !== 'string' || field.length === 0) return false
  return Object.values(spec.encoding).some((channelDef) => (
    isPlainObject(channelDef)
    && channelDef.field === field
  ))
}

function rewriteEncodedSpecTree(spec = {}, rewrite) {
  if (!isPlainObject(spec)) return spec
  let nextSpec = isPlainObject(spec.encoding) ? rewrite(spec) : spec
  for (const key of ['layer', 'vconcat', 'hconcat', 'concat']) {
    if (!Array.isArray(nextSpec[key])) continue
    const nextChildren = nextSpec[key].map((child) => rewriteEncodedSpecTree(child, rewrite))
    if (!deepEqual(nextChildren, nextSpec[key])) {
      nextSpec = { ...nextSpec, [key]: nextChildren }
    }
  }
  if (isPlainObject(nextSpec.spec)) {
    const nextChild = rewriteEncodedSpecTree(nextSpec.spec, rewrite)
    if (!deepEqual(nextChild, nextSpec.spec)) {
      nextSpec = { ...nextSpec, spec: nextChild }
    }
  }
  return nextSpec
}

function readReencodeSortValues(reencode = {}) {
  return uniqueNonNull(
    Array.isArray(reencode.sortedValues) ? reencode.sortedValues
      : Array.isArray(reencode.sortValues) ? reencode.sortValues
        : Array.isArray(reencode.values) ? reencode.values
          : Array.isArray(reencode.orderValues) ? reencode.orderValues
            : [],
  )
}

function buildReencodeSortDefinition(reencode = {}) {
  const explicitValues = readReencodeSortValues(reencode)
  if (explicitValues.length > 0) return explicitValues
  const order = reencode.order === 'ascending' ? 'ascending' : 'descending'
  const field = typeof reencode.sortField === 'string' && reencode.sortField.length > 0
    ? reencode.sortField
    : reencode.field
  if (typeof field !== 'string' || field.length === 0) return order
  return {
    field,
    order,
    ...(typeof reencode.aggregate === 'string' && reencode.aggregate.length > 0 ? { op: reencode.aggregate } : {}),
  }
}

function applySortOrderReencodeToSpec(spec, reencode = {}) {
  const field = typeof reencode.field === 'string' && reencode.field.length > 0 ? reencode.field : null
  if (!field) return spec
  const sort = buildReencodeSortDefinition(reencode)
  return rewriteEncodedSpecTree(spec, (viewSpec) => {
    const encoding = viewSpec.encoding || {}
    let changed = false
    const nextEncoding = { ...encoding }
    for (const channel of ['x', 'y']) {
      const channelDef = encoding[channel]
      if (!isPlainObject(channelDef) || channelDef.field !== field) continue
      nextEncoding[channel] = {
        ...channelDef,
        sort: clone(sort),
      }
      changed = true
    }
    return changed ? { ...viewSpec, encoding: nextEncoding } : viewSpec
  })
}

function readGroupingReencodeValues(reencode = {}) {
  return uniqueNonNull([
    ...(Array.isArray(reencode.nodes) ? reencode.nodes : []),
    ...(Array.isArray(reencode.collapsedNodes) ? reencode.collapsedNodes : []),
    ...(typeof reencode.aggregateName === 'string' && reencode.aggregateName.length > 0 ? [reencode.aggregateName] : []),
    ...(Array.isArray(reencode.groups)
      ? reencode.groups.flatMap((group) => [
          ...(Array.isArray(group?.nodes) ? group.nodes : []),
          ...(Array.isArray(group?.collapsedNodes) ? group.collapsedNodes : []),
          ...(typeof group?.aggregateName === 'string' && group.aggregateName.length > 0 ? [group.aggregateName] : []),
        ])
      : []),
  ])
}

function applyGroupingReencodeToSpec(spec, reencode = {}) {
  const field = typeof reencode.field === 'string' && reencode.field.length > 0 ? reencode.field : null
  const values = readGroupingReencodeValues(reencode)
  if (!field || values.length === 0) return spec
  const expression = `indexof([${values.map((value) => buildComparableExpression(value)).join(', ')}], ${buildDatumFieldExpression(field)}) >= 0`
  const activeColor = typeof reencode.color === 'string' && reencode.color.length > 0 ? reencode.color : '#2f5f9e'
  const inactiveColor = typeof reencode.inactiveColor === 'string' && reencode.inactiveColor.length > 0 ? reencode.inactiveColor : '#d7dee8'
  const channel = typeof reencode.channel === 'string' ? reencode.channel : 'opacity'

  return rewriteEncodedSpecTree(spec, (viewSpec) => {
    if (!hasEncodingField(viewSpec, field)) return viewSpec
    const nextEncoding = { ...(viewSpec.encoding || {}) }
    if (channel === 'color') {
      nextEncoding.color = {
        condition: { test: expression, value: activeColor },
        value: inactiveColor,
      }
    } else if (channel === 'stroke') {
      nextEncoding.stroke = {
        condition: { test: expression, value: activeColor },
        value: inactiveColor,
      }
    } else {
      nextEncoding.opacity = {
        condition: { test: expression, value: Number.isFinite(reencode.activeOpacity) ? reencode.activeOpacity : 0.98 },
        value: Number.isFinite(reencode.inactiveOpacity) ? reencode.inactiveOpacity : 0.22,
      }
    }
    nextEncoding.strokeWidth = {
      condition: { test: expression, value: Number.isFinite(reencode.activeStrokeWidth) ? reencode.activeStrokeWidth : 1.8 },
      value: Number.isFinite(reencode.inactiveStrokeWidth) ? reencode.inactiveStrokeWidth : 0,
    }
    return {
      ...viewSpec,
      encoding: nextEncoding,
    }
  })
}

export function applyVegaLiteReencodeState(spec, reencode = null) {
  if (!isPlainObject(reencode)) return spec
  const actionName = reencode.sourceAction || null
  if (!actionName) return spec
  switch (actionName) {
    case 'coordination.selectionToReencode':
    case 'coordination.domainToReencode':
      return applyVegaLiteCoordinationReencodeState(spec, reencode)
    case 'coordination.reencodeToReencode':
      if (reencode.mode === 'alignSortOrder') {
        return applySortOrderReencodeToSpec(spec, reencode)
      }
      if (reencode.mode === 'projectGrouping') {
        return applyGroupingReencodeToSpec(spec, reencode)
      }
      if (typeof reencode.channel === 'string' && typeof reencode.field === 'string') {
        return applyVegaLiteSpecAction(spec, 'widget.changeEncoding', reencode).nextSpec
      }
      return applyVegaLiteCoordinationReencodeState(spec, reencode)
    case 'line.resampleXAxis':
      return applyVegaLiteSpecAction(spec, actionName, {
        granularity: reencode.timeUnit || reencode.granularity || 'month',
        agg: reencode.agg || reencode.aggregate || 'mean',
      }).nextSpec
    case 'line.highlightTrend':
    case 'scatter.identifyClusters':
    case 'scatter.showRegression':
    case 'heatmap.adjustColorScale':
    case 'heatmap.clusterRowsCols':
    case 'heatmap.transpose':
      return applyVegaLiteSpecAction(spec, actionName, reencode).nextSpec
    case 'bar.expandStack':
      return applyVegaLiteSpecAction(spec, actionName, {
        category: reencode.category,
        categoryField: reencode.categoryField,
        subField: reencode.subField,
      }).nextSpec
    case 'bar.toggleStackMode':
      return applyVegaLiteSpecAction(spec, actionName, {
        mode: reencode.layout || reencode.mode,
        subField: reencode.subField,
      }).nextSpec
    case 'parallelCoordinates.reorderDimensions':
      return applyVegaLiteSpecAction(spec, actionName, {
        dimensions: reencode.dimensionOrder || reencode.dimensions,
      }).nextSpec
    case 'parallelCoordinates.hideDimensions':
      return applyVegaLiteSpecAction(spec, actionName, {
        dimensions: reencode.dimensions || reencode.hiddenDimensions,
        mode: reencode.operation,
      }).nextSpec
    case 'parallelCoordinates.resetHiddenDimensions':
      return applyVegaLiteSpecAction(spec, actionName, {}).nextSpec
    case 'sankey.filterFlow':
    case 'sankey.colorFlows':
    case 'sankey.reorderNodesInLayer':
      return applyVegaLiteSpecAction(spec, actionName, reencode).nextSpec
    default:
      return applyVegaLiteSpecAction(spec, actionName, reencode).nextSpec
  }
}

export function applyVegaLiteEmphasisState(spec, highlight = null) {
  if (!isPlainObject(highlight)) return spec
  const actionName = highlight.sourceAction || null
  if (!actionName) return spec
  switch (actionName) {
    case 'line.boldLines':
      return applyVegaLiteSpecAction(spec, actionName, {
        lineField: highlight.lineField,
        lineNames: Array.isArray(highlight.lineNames) ? highlight.lineNames : [],
        ...(Number.isFinite(highlight.boldWidth) ? { boldWidth: highlight.boldWidth } : {}),
        ...(Number.isFinite(highlight.baseWidth) ? { baseWidth: highlight.baseWidth } : {}),
      }).nextSpec
    case 'bar.highlightTopN':
      return applyVegaLiteSpecAction(spec, actionName, highlight).nextSpec
    case 'parallelCoordinates.highlightCategory':
      return applyVegaLiteSpecAction(spec, actionName, highlight).nextSpec
    case 'sankey.highlightPath':
      return applyVegaLiteSpecAction(spec, actionName, {
        nodes: Array.isArray(highlight.path) ? highlight.path : highlight.nodes,
        links: highlight.links,
      }).nextSpec
    case 'sankey.traceNode':
      return applyVegaLiteSpecAction(spec, actionName, {
        nodeName: highlight.nodeName,
        node: highlight.node,
      }).nextSpec
    case 'heatmap.highlightRegion':
    case 'heatmap.highlightRegionByValue':
    case 'heatmap.thresholdMask':
      return applyVegaLiteSpecAction(spec, actionName, highlight).nextSpec
    default:
      return applyVegaLiteSpecAction(spec, actionName, highlight).nextSpec
  }
}

export function applyVegaLiteAddRemoveState(spec, addRemove = null) {
  if (!isPlainObject(addRemove)) return spec
  const actionName = addRemove.sourceAction || null
  if (!actionName) return spec
  switch (actionName) {
    case 'bar.addBars':
    case 'bar.removeBars':
      return applyVegaLiteSpecAction(spec, actionName, {
        field: addRemove.field,
        values: addRemove.changedValues,
        visibleValues: addRemove.visibleValues,
      }).nextSpec
    case 'bar.addBarItems':
    case 'bar.removeBarItems':
      return applyVegaLiteSpecAction(spec, actionName, {
        xField: addRemove.xField,
        subField: addRemove.subField,
        items: addRemove.changedItems,
        visibleItems: addRemove.visibleItems,
      }).nextSpec
    case 'line.showMovingAverage':
    case 'heatmap.addMarginalBars':
    case 'sankey.collapseNodes':
    case 'sankey.expandNode':
    case 'sankey.autoCollapseByRank':
      return applyVegaLiteSpecAction(spec, actionName, addRemove).nextSpec
    default:
      return applyVegaLiteSpecAction(spec, actionName, addRemove).nextSpec
  }
}

function injectRuntimeTransformsIntoSpec(spec = {}, state = {}) {
  if (!isPlainObject(spec)) return spec
  const runtimeTransforms = buildVegaLiteTransformsFromRuntimeState(state)
  if (runtimeTransforms.length === 0) return spec
  const runtimeTags = new Set(runtimeTransforms.map((transform) => transform._widgetvaTag).filter(Boolean))
  const existingTransforms = (Array.isArray(spec?.transform) ? spec.transform : []).filter((transform) => {
    if (transform?._widgetvaRuntimeTransform === true) return false
    return !(transform?._widgetvaTag && runtimeTags.has(transform._widgetvaTag))
  })
  return {
    ...spec,
    transform: [
      ...existingTransforms,
      ...runtimeTransforms,
    ],
  }
}
