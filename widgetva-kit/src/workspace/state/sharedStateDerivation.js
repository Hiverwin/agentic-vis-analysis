import { extractPredicatesFromTransforms } from '../../core/runtime/materializers/state/transformHelpers.js'
import { readSelectionRegistry } from './selectionStateModel.js'

function uniquePredicates(predicates = []) {
  const seen = new Set()
  const nextPredicates = []
  for (const predicate of Array.isArray(predicates) ? predicates : []) {
    const key = JSON.stringify(predicate)
    if (seen.has(key)) continue
    seen.add(key)
    nextPredicates.push(predicate)
  }
  return nextPredicates
}

function uniqueValues(values = []) {
  return (Array.isArray(values) ? values : []).filter((value, index, list) => {
    const key = JSON.stringify(value)
    return list.findIndex((candidate) => JSON.stringify(candidate) === key) === index
  })
}

function resolveLinkedSelectionPredicates(transform, activeSelections = {}) {
  const sourceSelectionRef =
    transform?.source
    || transform?.sourceSelectionRef
    || transform?.spec?.sourceSelectionRef
    || null
  if (sourceSelectionRef && Array.isArray(activeSelections?.[sourceSelectionRef]?.predicates)) {
    return activeSelections[sourceSelectionRef].predicates
  }

  const sourceWidgetId = transform?.sourceWidgetId || transform?.spec?.sourceWidgetId || null
  if (!sourceWidgetId) return []

  return Object.entries(activeSelections || {})
    .filter(([selectionRef, selectionState]) =>
      typeof selectionRef === 'string'
      && selectionRef.includes(`/widget/${sourceWidgetId}/selection/`)
      && Array.isArray(selectionState?.predicates),
    )
    .flatMap(([, selectionState]) => selectionState.predicates)
}

export function deriveHighlightPredicatesFromState(highlightState = null) {
  const entries = Array.isArray(highlightState?.entries) ? highlightState.entries : []
  return uniquePredicates(
    entries.flatMap((entry) => Array.isArray(entry?.predicates) ? entry.predicates : []),
  )
}

export function deriveHighlightSummaryFromState(highlightState = null) {
  const entries = Array.isArray(highlightState?.entries) ? highlightState.entries : []
  return entries.find((entry) => typeof entry?.summary === 'string' && entry.summary.length > 0)?.summary || null
}

export function rowMatchesPredicate(row, predicate) {
  if (!predicate || typeof predicate !== 'object') return true
  if (!row || typeof row !== 'object') return false
  const field = predicate.field
  const op = predicate.op
  const value = predicate.value
  if (!field || !(field in row)) return true
  if (op === 'equals' || op === 'eq') return row[field] === value
  if (op === 'in' && Array.isArray(value)) return value.includes(row[field])
  if (op === 'notIn' && Array.isArray(value)) return !value.includes(row[field])
  if (op === 'between' && Array.isArray(value) && value.length === 2) {
    const [min, max] = value
    return row[field] >= min && row[field] <= max
  }
  return true
}

export function filterRowsByPredicates(rows = [], predicates = []) {
  const normalizedPredicates = Array.isArray(predicates) ? predicates : []
  if (normalizedPredicates.length === 0) return Array.isArray(rows) ? [...rows] : []
  return (Array.isArray(rows) ? rows : []).filter((row) => normalizedPredicates.every((predicate) => rowMatchesPredicate(row, predicate)))
}

export function deriveSelectionFilteredRows(rows = [], primarySelection = null) {
  const predicates = Array.isArray(primarySelection?.predicates) ? primarySelection.predicates : []
  return filterRowsByPredicates(rows, predicates)
}

export function deriveHighlightedRows(rows = [], highlightState = null) {
  const predicates = deriveHighlightPredicatesFromState(highlightState)
  return filterRowsByPredicates(rows, predicates)
}

export function deriveHighlightStateFromSelection(primarySelection = null, widgets = []) {
  if (!primarySelection?.sourceWidgetId) {
    return { entries: [], activeWidgetRefs: [] }
  }

  const predicates = uniquePredicates(
    Array.isArray(primarySelection?.predicates)
      ? primarySelection.predicates.map((predicate) => ({ ...predicate }))
      : [],
  )
  const highlightedKeys = uniqueValues(
    predicates
      .filter((predicate) => (predicate?.op === 'equals' || predicate?.op === 'eq') && predicate?.value != null)
      .map((predicate) => predicate.value),
  )
  const activeWidgetRefs = (Array.isArray(widgets) ? widgets : [])
    .map((widget) => widget?.resolveWidgetRef?.() || widget?.describe?.()?.ref || null)
    .filter(Boolean)
  const sourceWidget = (Array.isArray(widgets) ? widgets : [])
    .find((widget) => (widget?.resolveWidgetId?.() || widget?.describe?.()?.widgetId || null) === primarySelection.sourceWidgetId)
  const sourceWidgetRef = sourceWidget?.resolveWidgetRef?.()
    || sourceWidget?.describe?.()?.ref
    || primarySelection?.sourceWidgetRef
    || null

  return {
    entries: (Array.isArray(widgets) ? widgets : []).map((widget) => ({
      widgetRef: widget?.resolveWidgetRef?.() || widget?.describe?.()?.ref || null,
      widgetId: widget?.resolveWidgetId?.() || widget?.describe?.()?.widgetId || null,
      sourceWidgetRef,
      sourceWidgetId: primarySelection.sourceWidgetId,
      selectionRef: primarySelection.selectionRef || null,
      summary: primarySelection.summary || null,
      predicates,
      highlightedKeys,
      linkedSourceRefs: primarySelection.selectionRef ? [primarySelection.selectionRef] : [],
    })),
    activeWidgetRefs,
  }
}

function clampNumericRange(range = [], domain = null) {
  if (!Array.isArray(range) || range.length !== 2) return null
  const start = Number(range[0])
  const end = Number(range[1])
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null

  let min = Math.min(start, end)
  let max = Math.max(start, end)
  if (Array.isArray(domain) && domain.length === 2) {
    const domainStart = Number(domain[0])
    const domainEnd = Number(domain[1])
    if (Number.isFinite(domainStart) && Number.isFinite(domainEnd)) {
      const domainMin = Math.min(domainStart, domainEnd)
      const domainMax = Math.max(domainStart, domainEnd)
      min = Math.max(min, domainMin)
      max = Math.min(max, domainMax)
    }
  }
  return min <= max ? [min, max] : null
}

export function deriveGlobalFiltersFromSelection(primarySelection = null, { rangeDomains = {} } = {}) {
  const predicates = Array.isArray(primarySelection?.predicates) ? primarySelection.predicates : []
  if (predicates.length === 0) return null

  const globalFilters = {}
  for (const predicate of predicates) {
    if (!predicate || typeof predicate !== 'object') return null
    if (predicate.field === 'origin' && (predicate.op === 'equals' || predicate.op === 'eq') && typeof predicate.value === 'string') {
      globalFilters.origin = predicate.value
      continue
    }
    if (predicate.field === 'year' && (predicate.op === 'equals' || predicate.op === 'eq') && Number.isFinite(predicate.value)) {
      globalFilters.year = Number(predicate.value)
      continue
    }
    if (predicate.field === 'cylinders' && (predicate.op === 'equals' || predicate.op === 'eq') && Number.isFinite(predicate.value)) {
      globalFilters.cylinders = [Number(predicate.value)]
      continue
    }
    if (predicate.field === 'horsepower' && predicate.op === 'between') {
      const range = clampNumericRange(predicate.value, rangeDomains?.horsepower || null)
      if (!range) return null
      globalFilters.horsepowerRange = range
      continue
    }
    return null
  }

  return Object.keys(globalFilters).length > 0 ? globalFilters : null
}

export function deriveGlobalFiltersFromState(state) {
  const widgets = state?.widgets || {}
  const activeSelections = readSelectionRegistry(state?.shared || {})
  const globalFilters = {}

  for (const [widgetRef, widgetState] of Object.entries(widgets)) {
    const transforms = Array.isArray(widgetState?.transforms) ? widgetState.transforms : []
    const transformPredicates = extractPredicatesFromTransforms(
      transforms.map((transform) => transform?.spec || transform),
    )
    const linkedPredicates = transforms
      .filter((transform) => transform?.kind === 'filter')
      .flatMap((transform) => resolveLinkedSelectionPredicates(transform, activeSelections))

    const predicates = uniquePredicates([...transformPredicates, ...linkedPredicates])
    if (predicates.length > 0) {
      globalFilters[widgetRef] = predicates
    }
  }

  return globalFilters
}
