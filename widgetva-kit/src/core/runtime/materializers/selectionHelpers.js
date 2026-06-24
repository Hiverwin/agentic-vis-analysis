function normalizePredicateValues(predicate) {
  if (!predicate) return []
  return Array.isArray(predicate.value) ? predicate.value : [predicate.value]
}

export function rowMatchesPredicate(row, predicate) {
  if (!predicate || !row || typeof row !== 'object') return false
  const field = predicate.field
  if (typeof field !== 'string' || field.length === 0) return false
  const rowValue = row?.[field]

  if (predicate.op === 'equals') {
    return rowValue === predicate.value
  }
  if (predicate.op === 'in') {
    return normalizePredicateValues(predicate).includes(rowValue)
  }
  if (predicate.op === 'notIn') {
    return !normalizePredicateValues(predicate).includes(rowValue)
  }
  if (predicate.op === 'between') {
    const range = normalizePredicateValues(predicate)
    if (range.length < 2) return false
    const [minValue, maxValue] = [Math.min(...range), Math.max(...range)]
    return typeof rowValue === 'number' && rowValue >= minValue && rowValue <= maxValue
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
    ? activeSelection.predicates.map((predicate) => ({
        ...predicate,
        field: mappingIndex.get(predicate.field) || predicate.field,
      }))
    : []

  const fields = Array.isArray(activeSelection.fields)
    ? activeSelection.fields.map((field) => mappingIndex.get(field) || field)
    : activeSelection.fields

  const value = activeSelection.value && typeof activeSelection.value === 'object' && !Array.isArray(activeSelection.value)
    ? Object.fromEntries(
        Object.entries(activeSelection.value).map(([field, fieldValue]) => [mappingIndex.get(field) || field, fieldValue]),
      )
    : activeSelection.value

  const field = typeof activeSelection.field === 'string'
    ? mappingIndex.get(activeSelection.field) || activeSelection.field
    : activeSelection.field

  const keyField = typeof activeSelection.keyField === 'string'
    ? mappingIndex.get(activeSelection.keyField) || activeSelection.keyField
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
