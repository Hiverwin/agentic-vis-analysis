import { makeTransformState } from '../../protocol/state.js'

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function extractPredicatesFromFilterTransform(transform) {
  const filter = transform?.filter
  if (!isPlainObject(filter)) return []

  if (typeof filter.field === 'string' && Array.isArray(filter.oneOf) && filter.oneOf.length > 0) {
    return [{ field: filter.field, op: 'in', value: [...filter.oneOf] }]
  }

  if (typeof filter.field === 'string' && Array.isArray(filter.notOneOf) && filter.notOneOf.length > 0) {
    return [{ field: filter.field, op: 'notIn', value: [...filter.notOneOf] }]
  }

  if (typeof filter.field === 'string' && Array.isArray(filter.range) && filter.range.length === 2) {
    return [{ field: filter.field, op: 'between', value: [...filter.range] }]
  }

  if (typeof filter.field === 'string' && Object.prototype.hasOwnProperty.call(filter, 'equal')) {
    return [{ field: filter.field, op: 'equals', value: filter.equal }]
  }

  return []
}

export function extractPredicatesFromTransforms(transforms = []) {
  if (!Array.isArray(transforms) || transforms.length === 0) return []
  return transforms.flatMap((transform) => extractPredicatesFromFilterTransform(transform))
}

export function applySupportedSpecTransforms({ rows, transforms = [], dataQueryEngine }) {
  let nextRows = Array.isArray(rows) ? rows : []
  for (const transform of Array.isArray(transforms) ? transforms : []) {
    const predicates = extractPredicatesFromFilterTransform(transform)
    if (predicates.length > 0) {
      nextRows = dataQueryEngine.filter(nextRows, predicates)
      continue
    }

    if (Array.isArray(transform?.aggregate) && transform.aggregate.length > 0) {
      const result = dataQueryEngine.aggregate(nextRows, {
        groupBy: Array.isArray(transform?.groupby) ? transform.groupby.filter(Boolean) : [],
        measures: transform.aggregate
          .map((measure) => ({
            op: measure?.op,
            field: measure?.field,
            as: measure?.as,
          }))
          .filter((measure) => typeof measure.op === 'string' && typeof measure.as === 'string'),
      })
      nextRows = Array.isArray(result?.rows) ? result.rows : nextRows
    }
  }
  return nextRows
}

function inferTransformKind(transform) {
  if (extractPredicatesFromFilterTransform(transform).length > 0) return 'filter'
  if (Array.isArray(transform?.aggregate) || transform?.joinaggregate) return 'aggregate'
  if (transform?.calculate) return 'derive'
  if (transform?.sample) return 'sample'
  return 'derive'
}

export function normalizeSpecTransforms(transforms = []) {
  if (!Array.isArray(transforms)) return []
  return transforms.map((transform) =>
    makeTransformState({
      kind: inferTransformKind(transform),
      source: 'widgetSpec',
      spec: {
        ...transform,
        predicates: extractPredicatesFromFilterTransform(transform),
      },
    }),
  )
}
