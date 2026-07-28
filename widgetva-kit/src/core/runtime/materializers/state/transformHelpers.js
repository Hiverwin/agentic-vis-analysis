import { makeTransformState } from '../../../../contracts/state-contracts.js'

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function parseLiteralValue(rawValue) {
  if (typeof rawValue !== 'string') return rawValue
  const trimmed = rawValue.trim()
  if (
    (trimmed.startsWith('\'') && trimmed.endsWith('\''))
    || (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1)
  }
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null') return null
  if (/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(trimmed)) {
    const numeric = Number(trimmed)
    if (Number.isFinite(numeric)) return numeric
  }
  return trimmed
}

function extractPredicatesFromStringFilter(filter) {
  if (typeof filter !== 'string' || filter.trim().length === 0) return []
  const clauses = filter
    .split(/\s*&&\s*/u)
    .map((entry) => entry.trim())
    .filter(Boolean)
  if (clauses.length === 0) return []

  const predicates = []
  for (const clause of clauses) {
    const match = clause.match(/^datum\.([A-Za-z_$][\w$]*)\s*(===|==)\s*(.+)$/u)
    if (!match) {
      return []
    }
    const [, field, operator, rawValue] = match
    if ((operator !== '===' && operator !== '==') || typeof field !== 'string' || field.length === 0) {
      return []
    }
    predicates.push({
      field,
      op: 'equals',
      value: parseLiteralValue(rawValue),
    })
  }
  return predicates
}

function applyFoldTransform(rows, transform) {
  const fields = Array.isArray(transform?.fold)
    ? transform.fold.filter((field) => typeof field === 'string' && field.length > 0)
    : []
  if (fields.length === 0) {
    return rows
  }

  const as = Array.isArray(transform?.as) && transform.as.length >= 2
    ? transform.as
    : ['key', 'value']
  const [keyField, valueField] = as

  return rows.flatMap((row) => fields.map((field) => ({
    ...row,
    [keyField]: field,
    [valueField]: row?.[field],
  })))
}

export function extractPredicatesFromFilterTransform(transform) {
  const filter = transform?.filter
  if (typeof filter === 'string') {
    return extractPredicatesFromStringFilter(filter)
  }
  if (!isPlainObject(filter)) return []

  if (typeof filter.field === 'string' && Array.isArray(filter.oneOf) && filter.oneOf.length > 0) {
    return [{ field: filter.field, op: 'in', value: [...filter.oneOf] }]
  }

  if (typeof filter.field === 'string' && Array.isArray(filter.notOneOf) && filter.notOneOf.length > 0) {
    return [{ field: filter.field, op: 'notIn', value: [...filter.notOneOf] }]
  }

  const nestedNot = filter?.not
  if (
    isPlainObject(nestedNot)
    && typeof nestedNot.field === 'string'
    && Array.isArray(nestedNot.oneOf)
    && nestedNot.oneOf.length > 0
  ) {
    return [{ field: nestedNot.field, op: 'notIn', value: [...nestedNot.oneOf] }]
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

    if (Array.isArray(transform?.fold) && transform.fold.length > 0) {
      nextRows = applyFoldTransform(nextRows, transform)
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
  if (Array.isArray(transform?.fold) && transform.fold.length > 0) return 'derive'
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
