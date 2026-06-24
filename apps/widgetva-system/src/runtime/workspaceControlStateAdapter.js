export function buildFirstPartyControlState(state = {}) {
  return {
    origin: state.analysisOrigin,
    year: state.analysisYear,
    cylinders: state.analysisCylinders,
    horsepowerRange: [state.horsepowerMin, state.horsepowerMax],
  }
}

export function buildFirstPartyRangeDomains(state = {}) {
  return {
    horsepower: state?.dataset?.horsepowerDomain || null,
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

export function deriveFirstPartyCoordinationControlState({
  globalFilters = {},
  primarySelection = null,
  focusedWidgetId = null,
  rangeDomains = {},
} = {}) {
  const horsepowerRange = clampNumericRange(
    globalFilters?.horsepowerRange,
    rangeDomains?.horsepower || null,
  ) || (
    Array.isArray(rangeDomains?.horsepower) && rangeDomains.horsepower.length === 2
      ? [...rangeDomains.horsepower]
      : [0, 1]
  )
  const focusedRecordId = Array.isArray(primarySelection?.predicates)
    ? primarySelection.predicates.find((predicate) => predicate?.field === 'id' && predicate?.op === 'equals')?.value || null
    : null

  return {
    filters: {
      origin: typeof globalFilters?.origin === 'string' && globalFilters.origin.length > 0 ? globalFilters.origin : null,
      year: Number.isFinite(globalFilters?.year) ? Number(globalFilters.year) : null,
      cylinders: Array.isArray(globalFilters?.cylinders)
        ? [...globalFilters.cylinders].map((value) => Number(value)).filter(Number.isFinite).sort((a, b) => a - b)
        : [],
      horsepowerRange,
    },
    focus: {
      focusedRecordId,
    },
    focusedWidgetId: focusedWidgetId || null,
  }
}

export function deriveFirstPartyInteractionBindings(controlState = {}, {
  fallbackSelectedWidgetId = null,
} = {}) {
  const filters = controlState?.filters || {}
  const focus = controlState?.focus || {}
  const horsepowerRange = Array.isArray(filters?.horsepowerRange) && filters.horsepowerRange.length === 2
    ? filters.horsepowerRange
    : [0, 1]

  return {
    analysisOrigin: filters.origin || 'All',
    analysisYear: filters.year ?? 'All',
    analysisCylinders: Array.isArray(filters.cylinders) ? [...filters.cylinders] : [],
    horsepowerMin: horsepowerRange[0],
    horsepowerMax: horsepowerRange[1],
    focusedCarId: focus.focusedRecordId || null,
    selectedWidgetId: controlState?.focusedWidgetId || fallbackSelectedWidgetId || null,
  }
}

export function deriveFirstPartyInteractionFilterPatch(globalFilterPatch = {}) {
  const nextFilterState = {}
  if (typeof globalFilterPatch?.origin === 'string') nextFilterState.analysisOrigin = globalFilterPatch.origin
  if (Number.isFinite(globalFilterPatch?.year)) nextFilterState.analysisYear = Number(globalFilterPatch.year)
  if (Array.isArray(globalFilterPatch?.cylinders)) {
    nextFilterState.analysisCylinders = [...globalFilterPatch.cylinders].map((value) => Number(value)).filter(Number.isFinite)
  }
  if (Array.isArray(globalFilterPatch?.horsepowerRange) && globalFilterPatch.horsepowerRange.length === 2) {
    nextFilterState.horsepowerMin = Number(globalFilterPatch.horsepowerRange[0])
    nextFilterState.horsepowerMax = Number(globalFilterPatch.horsepowerRange[1])
  }
  return nextFilterState
}

export function deriveFirstPartyGlobalFiltersFromControlState(controlState = {}, { rangeDomains = {} } = {}) {
  const globalFilters = {}

  if (typeof controlState?.origin === 'string' && controlState.origin.length > 0 && controlState.origin !== 'All') {
    globalFilters.origin = controlState.origin
  }
  if (Number.isFinite(controlState?.year)) {
    globalFilters.year = Number(controlState.year)
  }

  const cylinders = Array.isArray(controlState?.cylinders)
    ? [...controlState.cylinders].map((value) => Number(value)).filter(Number.isFinite).sort((a, b) => a - b)
    : []
  if (cylinders.length > 0) {
    globalFilters.cylinders = cylinders
  }

  const domainRange = Array.isArray(rangeDomains?.horsepower) && rangeDomains.horsepower.length === 2
    ? clampNumericRange(rangeDomains.horsepower)
    : null
  const selectedRange = clampNumericRange(controlState?.horsepowerRange, rangeDomains?.horsepower || null)
  if (selectedRange && (!domainRange || selectedRange[0] !== domainRange[0] || selectedRange[1] !== domainRange[1])) {
    globalFilters.horsepowerRange = selectedRange
  }

  return globalFilters
}

export function deriveFirstPartyGlobalFiltersFromSelection(primarySelection = null, { rangeDomains = {} } = {}) {
  const predicates = Array.isArray(primarySelection?.predicates) ? primarySelection.predicates : []
  if (predicates.length === 0) return null

  const readSingletonPredicateValue = (predicate) => {
    if (!predicate || typeof predicate !== 'object') return null
    if (predicate.op === 'equals') return predicate.value
    if (predicate.op === 'in' && Array.isArray(predicate.value) && predicate.value.length === 1) {
      return predicate.value[0]
    }
    return null
  }

  const globalFilters = {}
  for (const predicate of predicates) {
    if (!predicate || typeof predicate !== 'object') return null
    const singletonValue = readSingletonPredicateValue(predicate)
    if (predicate.field === 'origin' && typeof singletonValue === 'string') {
      globalFilters.origin = singletonValue
      continue
    }
    if (predicate.field === 'year' && Number.isFinite(singletonValue)) {
      globalFilters.year = Number(singletonValue)
      continue
    }
    if (predicate.field === 'cylinders' && Number.isFinite(singletonValue)) {
      globalFilters.cylinders = [Number(singletonValue)]
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

export function buildFirstPartyWorkspaceControlStateAdapter() {
  return {
    deriveCoordinationControlState: deriveFirstPartyCoordinationControlState,
    deriveInteractionBindings: deriveFirstPartyInteractionBindings,
    deriveGlobalFiltersFromControlState: deriveFirstPartyGlobalFiltersFromControlState,
    deriveGlobalFiltersFromSelection: deriveFirstPartyGlobalFiltersFromSelection,
  }
}
