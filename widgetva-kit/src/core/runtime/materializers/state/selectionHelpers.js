function normalizePredicateValues(predicate) {
  if (!predicate) return []
  return Array.isArray(predicate.value) ? predicate.value : [predicate.value]
}

function normalizeComparableValue(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return { kind: 'temporal', value: value.getTime() }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { kind: 'numeric', value }
  }
  if (typeof value === 'string') {
    const parsedDate = Date.parse(value)
    if (Number.isFinite(parsedDate)) {
      return { kind: 'temporal', value: parsedDate }
    }
    const parsedNumber = Number(value)
    if (Number.isFinite(parsedNumber)) {
      return { kind: 'numeric', value: parsedNumber }
    }
  }
  return { kind: 'raw', value }
}

function normalizeComparableValueForKind(value, expectedKind = 'raw') {
  if (expectedKind === 'temporal') {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      return { kind: 'temporal', value: value.getTime() }
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return { kind: 'temporal', value }
    }
    if (typeof value === 'string') {
      const parsedDate = Date.parse(value)
      if (Number.isFinite(parsedDate)) {
        return { kind: 'temporal', value: parsedDate }
      }
    }
    return { kind: 'raw', value }
  }
  if (expectedKind === 'numeric') {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return { kind: 'numeric', value }
    }
    if (typeof value === 'string') {
      const parsedNumber = Number(value)
      if (Number.isFinite(parsedNumber)) {
        return { kind: 'numeric', value: parsedNumber }
      }
    }
    return { kind: 'raw', value }
  }
  return normalizeComparableValue(value)
}

function comparableEquals(left, right) {
  const normalizedLeft = normalizeComparableValue(left)
  const normalizedRight = normalizeComparableValue(right)
  if (normalizedLeft.kind === normalizedRight.kind && normalizedLeft.kind !== 'raw') {
    return normalizedLeft.value === normalizedRight.value
  }
  return left === right
}

export function rowMatchesPredicate(row, predicate) {
  if (!predicate || !row || typeof row !== 'object') return false
  const field = predicate.field
  if (typeof field !== 'string' || field.length === 0) return false
  const rowValue = row?.[field]

  if (predicate.op === 'equals' || predicate.op === 'eq') {
    return comparableEquals(rowValue, predicate.value)
  }
  if (predicate.op === 'in') {
    return normalizePredicateValues(predicate).some((value) => comparableEquals(rowValue, value))
  }
  if (predicate.op === 'notIn') {
    return !normalizePredicateValues(predicate).some((value) => comparableEquals(rowValue, value))
  }
  if (predicate.op === 'between') {
    const range = normalizePredicateValues(predicate)
    if (range.length < 2) return false
    const normalizedStart = normalizeComparableValue(range[0])
    const normalizedEnd = normalizeComparableValue(range[1])
    if (
      normalizedStart.kind === 'raw'
      || normalizedEnd.kind === 'raw'
      || normalizedStart.kind !== normalizedEnd.kind
    ) {
      return false
    }
    const normalizedRow = normalizeComparableValueForKind(rowValue, normalizedStart.kind)
    if (
      normalizedRow.kind === 'raw'
      || normalizedRow.kind !== normalizedStart.kind
    ) {
      return false
    }
    const minValue = Math.min(normalizedStart.value, normalizedEnd.value)
    const maxValue = Math.max(normalizedStart.value, normalizedEnd.value)
    return normalizedRow.value >= minValue && normalizedRow.value <= maxValue
  }
  if (
    predicate.op === 'gte'
    || predicate.op === 'greaterThanOrEqual'
    || predicate.op === 'lte'
    || predicate.op === 'lessThanOrEqual'
    || predicate.op === 'gt'
    || predicate.op === 'greaterThan'
    || predicate.op === 'lt'
    || predicate.op === 'lessThan'
  ) {
    const normalizedBoundary = normalizeComparableValue(predicate.value)
    const normalizedRow = normalizeComparableValueForKind(rowValue, normalizedBoundary.kind)
    if (
      normalizedBoundary.kind === 'raw'
      || normalizedRow.kind === 'raw'
      || normalizedRow.kind !== normalizedBoundary.kind
    ) {
      return false
    }
    if (predicate.op === 'gte' || predicate.op === 'greaterThanOrEqual') return normalizedRow.value >= normalizedBoundary.value
    if (predicate.op === 'lte' || predicate.op === 'lessThanOrEqual') return normalizedRow.value <= normalizedBoundary.value
    if (predicate.op === 'gt' || predicate.op === 'greaterThan') return normalizedRow.value > normalizedBoundary.value
    return normalizedRow.value < normalizedBoundary.value
  }
  return false
}

export function rowMatchesSelection(row, activeSelection) {
  const predicates = Array.isArray(activeSelection?.predicates) ? activeSelection.predicates : []
  if (predicates.length === 0) return false
  return predicates.every((predicate) => rowMatchesPredicate(row, predicate))
}

export function countSelectedRows(rows, activeSelection) {
  if (!Array.isArray(rows) || rows.length === 0 || !activeSelection) return 0
  return rows.filter((row) => rowMatchesSelection(row, activeSelection)).length
}

export function rowMatchesAnySelection(row, activeSelections) {
  const selections = Array.isArray(activeSelections) ? activeSelections.filter(Boolean) : []
  if (selections.length === 0) return false
  return selections.some((selection) => rowMatchesSelection(row, selection))
}

export function countSelectedRowsForSelections(rows, activeSelections) {
  if (!Array.isArray(rows) || rows.length === 0) return 0
  return rows.filter((row) => rowMatchesAnySelection(row, activeSelections)).length
}

export function mapSelectionToTargetSelection(activeSelection, fieldMapping = []) {
  if (!activeSelection) return null
  const mappingIndex = new Map(
    (Array.isArray(fieldMapping) ? fieldMapping : [])
      .filter((entry) => typeof entry?.sourceField === 'string' && typeof entry?.targetField === 'string')
      .map((entry) => [entry.sourceField, entry.targetField]),
  )
  if (mappingIndex.size === 0) return activeSelection

  const predicates = Array.isArray(activeSelection.predicates)
    ? activeSelection.predicates
        .filter((predicate) => mappingIndex.has(predicate?.field))
        .map((predicate) => ({
          ...predicate,
          field: mappingIndex.get(predicate.field),
        }))
    : []
  if (Array.isArray(activeSelection.predicates) && activeSelection.predicates.length > 0 && predicates.length === 0) {
    return null
  }

  const fields = Array.isArray(activeSelection.fields)
    ? activeSelection.fields
        .filter((field) => mappingIndex.has(field))
        .map((field) => mappingIndex.get(field))
    : activeSelection.fields

  const value = activeSelection.value && typeof activeSelection.value === 'object' && !Array.isArray(activeSelection.value)
    ? Object.fromEntries(
        Object.entries(activeSelection.value)
          .filter(([field]) => mappingIndex.has(field))
          .map(([field, fieldValue]) => [mappingIndex.get(field), fieldValue]),
      )
    : activeSelection.value

  const field = typeof activeSelection.field === 'string'
    ? mappingIndex.get(activeSelection.field)
    : activeSelection.field

  const keyField = typeof activeSelection.keyField === 'string'
    ? mappingIndex.get(activeSelection.keyField)
    : activeSelection.keyField

  return {
    ...activeSelection,
    ...(fields ? { fields } : {}),
    ...(value ? { value } : {}),
    ...(field ? { field } : {}),
    ...(keyField ? { keyField } : {}),
    predicates,
  }
}
