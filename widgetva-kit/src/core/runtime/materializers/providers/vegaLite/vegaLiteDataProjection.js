import { cloneJsonValue as clone } from '../../../../../shared/clone.js'
import { extractPredicatesFromFilterTransform } from '../../state/transformHelpers.js'
import { rowMatchesAnySelection } from '../../state/selectionHelpers.js'

export function normalizeWidgetSelections(state) {
  return Object.values(state?.selections || {}).filter(Boolean)
}

function normalizeSelectionKind(selection) {
  return selection?.kind || selection?.selection_type || null
}

export function isCompositeDataMaterializingSelection(selection) {
  const kind = normalizeSelectionKind(selection)
  if (kind === 'interval' || kind === 'region' || kind === 'cell') {
    return true
  }
  const hasDomain = Boolean(selection?.domain?.xDomain || selection?.domain?.yDomain)
  if (hasDomain) {
    return true
  }
  const predicates = Array.isArray(selection?.predicates) ? selection.predicates : []
  return predicates.some((predicate) => predicate?.op === 'between')
}

export function hasCompositeChildren(spec) {
  return (
    Array.isArray(spec?.concat)
    || Array.isArray(spec?.vconcat)
    || Array.isArray(spec?.hconcat)
    || Array.isArray(spec?.layer)
  )
}

function readChildSpecs(spec = {}) {
  const compositeChildren = [
    ...(Array.isArray(spec?.vconcat) ? spec.vconcat : []),
    ...(Array.isArray(spec?.hconcat) ? spec.hconcat : []),
    ...(Array.isArray(spec?.concat) ? spec.concat : []),
    ...(Array.isArray(spec?.layer) ? spec.layer : []),
  ]
  return compositeChildren.filter((child) => child && typeof child === 'object')
}

export function findFirstContinuousXYEncoding(spec = {}) {
  const xField = typeof spec?.encoding?.x?.field === 'string' ? spec.encoding.x.field : null
  const yField = typeof spec?.encoding?.y?.field === 'string' ? spec.encoding.y.field : null
  const xType = typeof spec?.encoding?.x?.type === 'string' ? spec.encoding.x.type : null
  const yType = typeof spec?.encoding?.y?.type === 'string' ? spec.encoding.y.type : null
  const xContinuous = xType === 'quantitative' || xType === 'temporal'
  const yContinuous = yType === 'quantitative' || yType === 'temporal'

  if (xField && yField && xContinuous && yContinuous) {
    return { xField, yField, xType, yType }
  }

  for (const child of readChildSpecs(spec)) {
    const resolved = findFirstContinuousXYEncoding(child)
    if (resolved) return resolved
  }
  return null
}

function normalizeComparableValue(value, type = null) {
  if (value == null) return null
  if (type === 'temporal') {
    if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime()
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function rowMatchesSelectionDomain(row = {}, selection = {}, encoding = null) {
  if (!encoding || !selection?.domain || !row || typeof row !== 'object') return false
  const xDomain = Array.isArray(selection.domain?.xDomain) ? selection.domain.xDomain : null
  const yDomain = Array.isArray(selection.domain?.yDomain) ? selection.domain.yDomain : null
  const hasXDomain = Array.isArray(xDomain) && xDomain.length >= 2
  const hasYDomain = Array.isArray(yDomain) && yDomain.length >= 2
  if (!hasXDomain && !hasYDomain) return false

  if (hasXDomain) {
    const rowX = normalizeComparableValue(row?.[encoding.xField], encoding.xType)
    const domainX0 = normalizeComparableValue(xDomain[0], encoding.xType)
    const domainX1 = normalizeComparableValue(xDomain[1], encoding.xType)
    if (![rowX, domainX0, domainX1].every(Number.isFinite)) {
      return false
    }
    const xLow = Math.min(domainX0, domainX1)
    const xHigh = Math.max(domainX0, domainX1)
    if (rowX < xLow || rowX > xHigh) {
      return false
    }
  }

  if (hasYDomain) {
    const rowY = normalizeComparableValue(row?.[encoding.yField], encoding.yType)
    const domainY0 = normalizeComparableValue(yDomain[0], encoding.yType)
    const domainY1 = normalizeComparableValue(yDomain[1], encoding.yType)
    if (![rowY, domainY0, domainY1].every(Number.isFinite)) {
      return false
    }
    const yLow = Math.min(domainY0, domainY1)
    const yHigh = Math.max(domainY0, domainY1)
    if (rowY < yLow || rowY > yHigh) {
      return false
    }
  }

  return true
}

export function rowMatchesCompositeSelection(row = {}, activeSelections = [], encoding = null) {
  const selections = Array.isArray(activeSelections) ? activeSelections.filter(Boolean) : []
  if (selections.length === 0) return false
  return selections.some((selection) => {
    const hasDomain = Boolean(selection?.domain?.xDomain || selection?.domain?.yDomain)
    const hasPredicates = Array.isArray(selection?.predicates) && selection.predicates.length > 0
    if (hasDomain && encoding) {
      return rowMatchesSelectionDomain(row, selection, encoding)
    }
    if (hasPredicates) {
      return rowMatchesAnySelection(row, [selection])
    }
    return hasDomain && encoding
      ? rowMatchesSelectionDomain(row, selection, encoding)
      : false
  })
}

function isRuntimeMaterializedTransform(transform) {
  if (!transform || typeof transform !== 'object') return false
  return (
    Array.isArray(transform.aggregate)
    || (Array.isArray(transform.fold) && transform.fold.length > 0)
    || extractPredicatesFromFilterTransform(transform).length > 0
  )
}

function hasDistinctRuntimeDataRef(state = {}) {
  const sourceDataRef = state?.data?.sourceDataRef || null
  const currentDataRef = state?.data?.currentDataRef || null
  return Boolean(currentDataRef && currentDataRef !== sourceDataRef)
}

function runtimeRowsMatchVisibleState(state = {}, runtimeRows = null) {
  const visibleCount = state?.data?.visibleCount
  return !Number.isFinite(visibleCount)
    || (Array.isArray(runtimeRows) && runtimeRows.length === visibleCount)
}

export function resolveSelectionMaterialization({ semanticSpec, state, runtime }) {
  const dataRef = state?.data?.currentDataRef || state?.data?.sourceDataRef || null
  const runtimeRows = dataRef ? runtime?.store?.readRuntimeData?.(dataRef)?.rows : null
  const hasRuntimeMaterializedTransforms = Array.isArray(semanticSpec?.transform)
    && semanticSpec.transform.some((transform) => isRuntimeMaterializedTransform(transform))

  if (
    hasDistinctRuntimeDataRef(state)
    && hasRuntimeMaterializedTransforms
    && Array.isArray(runtimeRows)
    && runtimeRowsMatchVisibleState(state, runtimeRows)
  ) {
    return {
      rows: clone(runtimeRows),
      stripMaterializedTransforms: true,
    }
  }

  if (Array.isArray(semanticSpec?.data?.values)) {
    return {
      rows: clone(semanticSpec.data.values),
      stripMaterializedTransforms: false,
    }
  }

  return Array.isArray(runtimeRows)
    ? {
        rows: clone(runtimeRows),
        stripMaterializedTransforms: false,
      }
    : null
}

export function hasRuntimeDataProjection(state = {}) {
  if (hasDistinctRuntimeDataRef(state)) return true
  return Array.isArray(state?.transforms) && state.transforms.length > 0
}

export function buildRuntimeDataProjectionSpec({ semanticSpec, state, runtime }) {
  const dataRef = state?.data?.currentDataRef || state?.data?.sourceDataRef || null
  const runtimeRows = dataRef ? runtime?.store?.readRuntimeData?.(dataRef)?.rows : null
  const usesRuntimeProjection = hasDistinctRuntimeDataRef(state) && Array.isArray(runtimeRows)
  const materialization = resolveSelectionMaterialization({
    semanticSpec,
    state,
    runtime,
  })
  const rows = usesRuntimeProjection ? clone(runtimeRows) : materialization?.rows
  if (!Array.isArray(rows)) return null

  const nextSpec = {
    ...semanticSpec,
    data: {
      values: rows,
    },
  }
  if (materialization?.stripMaterializedTransforms && Array.isArray(semanticSpec?.transform)) {
    nextSpec.transform = semanticSpec.transform.filter((transform) => !isRuntimeMaterializedTransform(transform))
  }
  return nextSpec
}
