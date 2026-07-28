import { DataQueryEngine } from './DataQueryEngine.js'

function inferFieldType(value) {
  if (typeof value === 'number') return 'quantitative'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'string') return 'nominal'
  return 'nominal'
}

function applyPredicate(row, predicate) {
  const value = row?.[predicate.field]
  if (predicate.op === 'between' && Array.isArray(predicate.value)) {
    return value >= predicate.value[0] && value <= predicate.value[1]
  }
  if (predicate.op === 'gte' || predicate.op === 'greaterThanOrEqual') return value >= predicate.value
  if (predicate.op === 'lte' || predicate.op === 'lessThanOrEqual') return value <= predicate.value
  if (predicate.op === 'gt' || predicate.op === 'greaterThan') return value > predicate.value
  if (predicate.op === 'lt' || predicate.op === 'lessThan') return value < predicate.value
  if (predicate.op === 'equals' || predicate.op === 'eq') return value === predicate.value
  if (predicate.op === 'in' && Array.isArray(predicate.value)) {
    return predicate.value.includes(value)
  }
  if (predicate.op === 'notIn' && Array.isArray(predicate.value)) {
    return !predicate.value.includes(value)
  }
  return true
}

function filterRows(rows, predicates = []) {
  if (!Array.isArray(predicates) || predicates.length === 0) return rows
  return rows.filter((row) => predicates.every((predicate) => applyPredicate(row, predicate)))
}

function numericValuesForMeasure(rows, field) {
  if (!field) return []
  return rows.map((row) => row?.[field]).filter((value) => typeof value === 'number')
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return (sorted[middle - 1] + sorted[middle]) / 2
}

function computeMeasureValue(rows, measure) {
  if (!measure?.op || !measure?.as) return undefined
  if (measure.op === 'count') return rows.length

  const values = numericValuesForMeasure(rows, measure.field)
  if (measure.op === 'sum') return values.reduce((sum, value) => sum + value, 0)
  if (measure.op === 'mean') return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  if (measure.op === 'min') return values.length > 0 ? Math.min(...values) : null
  if (measure.op === 'max') return values.length > 0 ? Math.max(...values) : null
  if (measure.op === 'median') return values.length > 0 ? median(values) : null
  return undefined
}

function aggregateRows(rows, spec = {}) {
  const groupBy = Array.isArray(spec.groupBy) ? spec.groupBy.filter(Boolean) : []
  const measures = Array.isArray(spec.measures) ? spec.measures : []
  if (measures.length === 0) {
    return { rows, rowCount: rows.length }
  }

  if (groupBy.length === 0) {
    const summaryRow = {}
    measures.forEach((measure) => {
      if (!measure?.as) return
      summaryRow[measure.as] = computeMeasureValue(rows, measure)
    })
    return {
      rows: [summaryRow],
      rowCount: 1,
    }
  }

  const buckets = new Map()
  for (const row of rows) {
    const key = JSON.stringify(groupBy.map((field) => row?.[field]))
    if (!buckets.has(key)) {
      const seed = {
        __widgetva_rows: [],
      }
      groupBy.forEach((field) => {
        seed[field] = row?.[field] ?? null
      })
      buckets.set(key, seed)
    }

    const bucket = buckets.get(key)
    bucket.__widgetva_rows.push(row)
  }

  let result = Array.from(buckets.values()).map((bucket) => {
    const nextBucket = { ...bucket }
    const bucketRows = Array.isArray(bucket.__widgetva_rows) ? bucket.__widgetva_rows : []
    measures.forEach((measure) => {
      if (!measure?.as) return
      nextBucket[measure.as] = computeMeasureValue(bucketRows, measure)
    })
    delete nextBucket.__widgetva_rows
    return nextBucket
  })
  if (spec.sortBy?.field) {
    const dir = spec.sortBy.order === 'ascending' ? 1 : -1
    const field = spec.sortBy.field
    result = result.sort((a, b) => {
      const left = a?.[field]
      const right = b?.[field]
      if (left === right) return 0
      return left > right ? dir : -dir
    })
  }
  if (Number.isFinite(spec.limit) && spec.limit > 0) {
    result = result.slice(0, spec.limit)
  }
  return { rows: result, rowCount: result.length }
}

export class JsArrayDataQueryEngine extends DataQueryEngine {
  constructor(options = {}) {
    super()
    this.options = options
    this.kind = options.kind || 'js_array'
  }

  listSupportedQueryKinds() {
    return [
      'schema',
      'sampleRows',
      'filter',
      'aggregate',
      'groupBy',
      'summary',
      'computeCorrelation',
      'findExtremes',
      'findOutliers',
      'compareGroups',
    ]
  }

  getSchema(rows) {
    const resolvedRows = this.resolveQuerySource(rows)
    const sample = Array.isArray(resolvedRows) && resolvedRows.length > 0 ? resolvedRows[0] : {}
    return {
      fields: Object.keys(sample || {}).map((name) => ({
        name,
        type: inferFieldType(sample[name]),
      })),
    }
  }

  filter(rows, predicates = []) {
    return filterRows(Array.isArray(rows) ? rows : [], predicates)
  }

  sampleRows(rows, limit = 20) {
    const safeRows = Array.isArray(rows) ? rows : []
    return safeRows.slice(0, Math.max(0, limit))
  }

  executeSql() {
    return {
      ok: false,
      error: {
        code: 'SQL_QUERY_UNSUPPORTED',
        message: 'SQL queries are not supported by the in-memory JS array query engine.',
      },
    }
  }

  aggregate(rows, spec = {}) {
    return aggregateRows(Array.isArray(rows) ? rows : [], spec)
  }

  summarize(rows, options = {}) {
    const safeRows = Array.isArray(rows) ? rows : []
    const groupBy = Array.isArray(options.groupBy) ? options.groupBy.filter(Boolean) : []
    const measures = Array.isArray(options.measures) ? options.measures : [{ op: 'count', as: 'count' }]
    return this.aggregate(safeRows, {
      groupBy,
      measures,
      sortBy: options.sortBy,
      limit: options.limit,
    })
  }

  computeCorrelation(rows, { xField, yField } = {}) {
    const safeRows = Array.isArray(rows) ? rows : []
    if (!xField || !yField) {
      return { ok: false, reason: 'xField and yField are required.' }
    }
    const pairs = safeRows
      .map((row) => [row?.[xField], row?.[yField]])
      .filter(([x, y]) => typeof x === 'number' && typeof y === 'number')
    if (pairs.length < 2) {
      return { ok: false, reason: 'Not enough numeric rows to compute correlation.' }
    }

    const n = pairs.length
    const sumX = pairs.reduce((acc, [x]) => acc + x, 0)
    const sumY = pairs.reduce((acc, [, y]) => acc + y, 0)
    const meanX = sumX / n
    const meanY = sumY / n
    let num = 0
    let denX = 0
    let denY = 0
    for (const [x, y] of pairs) {
      const dx = x - meanX
      const dy = y - meanY
      num += dx * dy
      denX += dx * dx
      denY += dy * dy
    }
    const denominator = Math.sqrt(denX * denY)
    return {
      ok: denominator > 0,
      coefficient: denominator > 0 ? num / denominator : null,
      sampleSize: n,
      fields: [xField, yField],
    }
  }

  findExtremes(rows, { field, order = 'descending', limit = 5 } = {}) {
    const safeRows = Array.isArray(rows) ? rows : []
    if (!field) return { rows: [] }
    const sorted = safeRows
      .filter((row) => typeof row?.[field] === 'number')
      .sort((a, b) => {
        const diff = (a?.[field] || 0) - (b?.[field] || 0)
        return order === 'ascending' ? diff : -diff
      })
    return {
      rows: sorted.slice(0, Math.max(0, limit)),
    }
  }

  findOutliers(rows, { field, xField, yField, zThreshold = 2, limit = 10 } = {}) {
    const safeRows = Array.isArray(rows) ? rows : []
    const fields = [field, xField, yField].filter(Boolean)
    if (fields.length === 0) {
      return { rows: [], summary: { reason: 'No numeric field specified.' } }
    }

    const scored = []
    for (const currentField of fields) {
      const numericValues = safeRows
        .map((row) => row?.[currentField])
        .filter((value) => typeof value === 'number')
      if (numericValues.length < 2) continue

      const mean = numericValues.reduce((acc, value) => acc + value, 0) / numericValues.length
      const variance = numericValues.reduce((acc, value) => acc + (value - mean) ** 2, 0) / numericValues.length
      const std = Math.sqrt(variance)
      if (!std) continue

      for (const row of safeRows) {
        const value = row?.[currentField]
        if (typeof value !== 'number') continue
        const zScore = Math.abs((value - mean) / std)
        if (zScore >= zThreshold) {
          scored.push({
            row,
            field: currentField,
            value,
            zScore,
          })
        }
      }
    }

    const deduped = []
    const seen = new Set()
    for (const item of scored.sort((a, b) => b.zScore - a.zScore)) {
      const key = JSON.stringify(item.row)
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(item)
      if (deduped.length >= Math.max(0, limit)) break
    }

    return {
      rows: deduped.map((item) => ({
        ...item.row,
        __widgetva_outlier_field: item.field,
        __widgetva_outlier_score: item.zScore,
      })),
      summary: {
        inspectedFields: fields,
        zThreshold,
        count: deduped.length,
      },
    }
  }

  compareGroups(rows, { groupField, valueField, groups = [] } = {}) {
    const safeRows = Array.isArray(rows) ? rows : []
    if (!groupField || !valueField || groups.length < 2) {
      return { ok: false, reason: 'groupField, valueField, and at least two groups are required.' }
    }
    const result = groups.map((group) => {
      const groupRows = safeRows.filter((row) => row?.[groupField] === group)
      const numericValues = groupRows.map((row) => row?.[valueField]).filter((value) => typeof value === 'number')
      const count = numericValues.length
      const sum = numericValues.reduce((acc, value) => acc + value, 0)
      return {
        group,
        count,
        mean: count > 0 ? sum / count : null,
        min: count > 0 ? Math.min(...numericValues) : null,
        max: count > 0 ? Math.max(...numericValues) : null,
      }
    })
    return {
      ok: true,
      groups: result,
    }
  }
}
