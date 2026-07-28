import {
  updateRepresentativeSpec,
} from '../specTree.js'
import { ensureObjectSpec, readMarkType } from '../specModel.js'
import { replaceFilterTransformForField, replaceTaggedTransform } from '../specMutators.js'
import { datumRef, expressionEqualsAny } from './specActionShared.js'

function isParallelCoordinatesSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return false
  const encoding = spec?.encoding
  const xField = encoding?.x?.field
  const transforms = Array.isArray(spec?.transform) ? spec.transform : []
  const hasFoldTransform = transforms.some((transform) => transform && typeof transform === 'object' && Array.isArray(transform.fold))
  return spec?.kind === 'parallelCoordinates'
    || (hasFoldTransform && Array.isArray(spec?.layer))
    || (
      (readMarkType(spec?.mark) === 'line' || hasFoldTransform || Array.isArray(spec?.layer))
      && typeof xField === 'string'
      && ['dimension', 'key', 'variable'].includes(xField)
    )
}

function updateParallel(spec, updater) {
  return updateRepresentativeSpec(
    spec,
    isParallelCoordinatesSpec,
    updater,
    'No representative parallel-coordinates subview could be found in the active spec.',
  )
}

function updateParallelXOrder(node, dimensionOrder) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const entry of node) updateParallelXOrder(entry, dimensionOrder)
    return
  }
  if (node.encoding && typeof node.encoding === 'object') {
    const xEncoding = node.encoding.x
    if (xEncoding && typeof xEncoding === 'object' && ['dimension', 'key', 'variable'].includes(xEncoding.field)) {
      node.encoding.x = {
        ...xEncoding,
        sort: dimensionOrder,
        scale: { ...(xEncoding.scale || {}), domain: dimensionOrder },
      }
    }
  }
  for (const value of Object.values(node)) updateParallelXOrder(value, dimensionOrder)
}

function findFoldTransform(transforms = []) {
  return (Array.isArray(transforms) ? transforms : []).find((transform) => (
    transform && typeof transform === 'object' && Array.isArray(transform.fold)
  )) || null
}

function readDimensionOrder(spec) {
  const sort = spec?.encoding?.x?.sort
  if (Array.isArray(sort) && sort.length > 0) return sort.filter((dimension) => typeof dimension === 'string')
  const domain = spec?.encoding?.x?.scale?.domain
  if (Array.isArray(domain) && domain.length > 0) return domain.filter((dimension) => typeof dimension === 'string')
  const fold = findFoldTransform(spec?.transform)
  if (Array.isArray(fold?.fold) && fold.fold.length > 0) return fold.fold.filter((dimension) => typeof dimension === 'string')
  const rows = Array.isArray(spec?.data?.values) ? spec.data.values : []
  return [...new Set(rows.map((row) => row?.dimension).filter((dimension) => typeof dimension === 'string'))]
}

const DIMENSION_VISIBILITY_TAG = 'parallelCoordinates.dimensionVisibility'

function dimensionVisibilityFilter(visibleDimensions) {
  const dimensionField = visibleDimensions?.field || 'dimension'
  const values = Array.isArray(visibleDimensions) ? visibleDimensions : []
  return {
    filter: `indexof(${JSON.stringify(values)}, datum.${dimensionField}) >= 0`,
    _widgetvaTag: DIMENSION_VISIBILITY_TAG,
  }
}

function rewriteDimensionVisibilityFilter(node, visibleDimensions = null, dimensionField = 'dimension') {
  if (!node || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map((entry) => rewriteDimensionVisibilityFilter(entry, visibleDimensions, dimensionField))
  const next = { ...node }
  const hasDimensionRows = Array.isArray(next?.data?.values) && next.data.values.some((row) => typeof row?.[dimensionField] === 'string')
  const usesDimensionX = next?.encoding?.x?.field === dimensionField
  if (hasDimensionRows || usesDimensionX) {
    next.transform = replaceTaggedTransform(
      next.transform,
      DIMENSION_VISIBILITY_TAG,
      visibleDimensions ? dimensionVisibilityFilter(Object.assign([...visibleDimensions], { field: dimensionField })) : null,
    )
  }
  for (const key of ['layer', 'vconcat', 'hconcat', 'concat']) {
    if (Array.isArray(next[key])) next[key] = next[key].map((entry) => rewriteDimensionVisibilityFilter(entry, visibleDimensions, dimensionField))
  }
  if (next.spec && typeof next.spec === 'object' && !Array.isArray(next.spec)) {
    next.spec = rewriteDimensionVisibilityFilter(next.spec, visibleDimensions, dimensionField)
  }
  return next
}

export function executeVegaLiteParallelReorderDimensions(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for parallel-coordinate reordering.')
  const dimensions = Array.isArray(params.dimensions)
    ? params.dimensions.filter((dimension) => typeof dimension === 'string' && dimension.trim())
    : (Array.isArray(params.dimensionOrder) ? params.dimensionOrder.filter((dimension) => typeof dimension === 'string' && dimension.trim()) : [])
  if (dimensions.length === 0) throw new Error('parallelCoordinates.reorderDimensions requires dimensions.')
  return updateParallel(spec, (parallelSpec) => {
    const nextSpec = { ...parallelSpec, transform: Array.isArray(parallelSpec.transform) ? [...parallelSpec.transform] : [] }
    const foldIndex = nextSpec.transform.findIndex((transform) => transform && typeof transform === 'object' && Array.isArray(transform.fold))
    if (foldIndex >= 0) nextSpec.transform[foldIndex] = { ...nextSpec.transform[foldIndex], fold: dimensions }
    updateParallelXOrder(nextSpec, dimensions)
    nextSpec._pc_reencode_state = { mode: 'dimensionOrder', dimensions }
    return nextSpec
  })
}

export function executeVegaLiteParallelFilterDimension(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for parallel-coordinate dimension filtering.')
  const dimension = typeof params.dimension === 'string' ? params.dimension : null
  const range = Array.isArray(params.range) ? params.range : null
  if (!dimension || !range || range.length !== 2) throw new Error('parallelCoordinates.filterDimension requires dimension and range.')
  return updateParallel(spec, (parallelSpec) => {
    const transforms = Array.isArray(parallelSpec.transform) ? [...parallelSpec.transform] : []
    const filterTransform = {
      filter: `${datumRef('dimension')} === ${JSON.stringify(dimension)} ? (${datumRef('value')} >= ${Math.min(...range)} && ${datumRef('value')} <= ${Math.max(...range)}) : true`,
      _widgetvaTag: 'parallelCoordinates.filterDimension',
    }
    const nextTransforms = transforms.filter((transform) => transform?._widgetvaTag !== 'parallelCoordinates.filterDimension')
    const foldIndex = nextTransforms.findIndex((transform) => transform && typeof transform === 'object' && Array.isArray(transform.fold))
    nextTransforms.splice(foldIndex >= 0 ? foldIndex + 1 : 0, 0, filterTransform)
    return { ...parallelSpec, transform: nextTransforms }
  })
}

export function executeVegaLiteParallelFilterByCategory(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for parallel-category filtering.')
  const field = typeof params.field === 'string' ? params.field : null
  const values = Array.isArray(params.values) ? params.values.filter((value) => value != null) : []
  if (!field || values.length === 0) throw new Error('parallelCoordinates.filterByCategory requires field and values.')
  return updateParallel(spec, (parallelSpec) => ({
    ...parallelSpec,
    transform: replaceFilterTransformForField(parallelSpec.transform, field, {
      filter: { not: { field, oneOf: values } },
      _widgetvaTag: 'parallelCoordinates.filterByCategory',
    }),
  }))
}

export function executeVegaLiteParallelHighlightCategory(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for parallel-category highlighting.')
  const field = typeof params.field === 'string' ? params.field : null
  const values = Array.isArray(params.values) ? params.values.filter((value) => value != null) : []
  if (!field || values.length === 0) throw new Error('parallelCoordinates.highlightCategory requires field and values.')
  return updateParallel(spec, (parallelSpec) => ({
    ...parallelSpec,
    encoding: {
      ...(parallelSpec.encoding || {}),
      opacity: {
        condition: { test: expressionEqualsAny(field, values), value: 1 },
        value: 0.1,
      },
    },
    _pc_highlight_state: { field, values },
  }))
}

export function executeVegaLiteParallelHideDimensions(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for hiding parallel-coordinate dimensions.')
  const dimensions = Array.isArray(params.dimensions) ? params.dimensions.filter((dimension) => typeof dimension === 'string' && dimension.trim()) : []
  const mode = params.mode === 'show' ? 'show' : 'hide'
  if (dimensions.length === 0) throw new Error('parallelCoordinates.hideDimensions requires dimensions.')
  return updateParallel(spec, (parallelSpec) => {
    const transforms = Array.isArray(parallelSpec.transform) ? [...parallelSpec.transform] : []
    const fold = findFoldTransform(transforms)
    const storedState = parallelSpec._pc_hidden_state && typeof parallelSpec._pc_hidden_state === 'object' ? parallelSpec._pc_hidden_state : {}
    const allDimensions = Array.isArray(storedState.all_dimensions) && storedState.all_dimensions.length > 0
      ? storedState.all_dimensions
      : (fold?.fold || readDimensionOrder(parallelSpec))
    const hiddenSet = new Set(Array.isArray(storedState.hidden) ? storedState.hidden : [])
    for (const dimension of dimensions) {
      if (mode === 'hide') hiddenSet.add(dimension)
      else hiddenSet.delete(dimension)
    }
    const visibleDimensions = allDimensions.filter((dimension) => !hiddenSet.has(dimension))
    const foldIndex = transforms.findIndex((transform) => transform === fold)
    if (foldIndex >= 0) transforms[foldIndex] = { ...transforms[foldIndex], fold: visibleDimensions }
    let nextSpec = {
      ...parallelSpec,
      transform: transforms,
      _pc_hidden_state: { hidden: allDimensions.filter((dimension) => hiddenSet.has(dimension)), all_dimensions: allDimensions },
      _pc_reencode_state: { mode: 'dimensionVisibility', operation: mode, visible_dimensions: visibleDimensions },
    }
    updateParallelXOrder(nextSpec, visibleDimensions)
    if (!fold) {
      const dimensionField = parallelSpec?.encoding?.x?.field || 'dimension'
      nextSpec = rewriteDimensionVisibilityFilter(nextSpec, visibleDimensions, dimensionField)
    }
    return nextSpec
  })
}

export function executeVegaLiteParallelResetHiddenDimensions(spec) {
  ensureObjectSpec(spec, 'No active base spec is available for resetting hidden parallel-coordinate dimensions.')
  return updateParallel(spec, (parallelSpec) => {
    const hiddenState = parallelSpec._pc_hidden_state && typeof parallelSpec._pc_hidden_state === 'object' ? parallelSpec._pc_hidden_state : null
    const allDimensions = Array.isArray(hiddenState?.all_dimensions) && hiddenState.all_dimensions.length > 0
      ? hiddenState.all_dimensions
      : readDimensionOrder(parallelSpec)
    const transforms = Array.isArray(parallelSpec.transform) ? [...parallelSpec.transform] : []
    const foldIndex = transforms.findIndex((transform) => transform && typeof transform === 'object' && Array.isArray(transform.fold))
    if (foldIndex >= 0 && allDimensions.length > 0) transforms[foldIndex] = { ...transforms[foldIndex], fold: allDimensions }
    const { _pc_hidden_state: _removed, ...rest } = parallelSpec
    let nextSpec = {
      ...rest,
      transform: transforms,
      _pc_reencode_state: { mode: 'dimensionVisibility', operation: 'reset', hidden_dimensions: [], visible_dimensions: allDimensions },
    }
    if (allDimensions.length > 0) updateParallelXOrder(nextSpec, allDimensions)
    nextSpec = rewriteDimensionVisibilityFilter(nextSpec, null, parallelSpec?.encoding?.x?.field || 'dimension')
    return nextSpec
  })
}
