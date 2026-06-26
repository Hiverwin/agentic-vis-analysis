export function deriveCarsContextualRows(rows = [], {
  analysisOrigin = 'All',
  analysisYear = 'All',
  analysisCylinders = [],
} = {}) {
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const originOk = analysisOrigin === 'All' || row.origin === analysisOrigin
    const yearOk = analysisYear === 'All' || row.year === analysisYear
    const cylinderOk = !Array.isArray(analysisCylinders)
      || analysisCylinders.length === 0
      || analysisCylinders.includes(row.cylinders)
    return originOk && yearOk && cylinderOk
  })
}

export function deriveCarsHorsepowerFilteredRows(rows = [], {
  horsepowerMin = 0,
  horsepowerMax = 1,
} = {}) {
  return (Array.isArray(rows) ? rows : []).filter((row) => (
    row.horsepower >= horsepowerMin && row.horsepower <= horsepowerMax
  ))
}

export function deriveFocusedCar(rows = [], focusedCarId = null) {
  const normalizedRows = Array.isArray(rows) ? rows : []
  return normalizedRows.find((row) => row.id === focusedCarId) || normalizedRows[0] || null
}

export function deriveCarsActiveFilters({
  analysisOrigin = 'All',
  analysisYear = 'All',
  analysisCylinders = [],
  horsepowerMin = 0,
  horsepowerMax = 1,
  horsepowerDomain = [0, 1],
  primarySelectionSummary = null,
  highlightSummary = null,
} = {}) {
  const activeFilters = []
  if (analysisOrigin !== 'All') activeFilters.push(`origin: ${analysisOrigin}`)
  if (analysisYear !== 'All') activeFilters.push(`year: ${analysisYear}`)
  if (Array.isArray(analysisCylinders) && analysisCylinders.length > 0) {
    activeFilters.push(`cylinders: ${analysisCylinders.join(', ')}`)
  }
  if (horsepowerMin !== horsepowerDomain[0] || horsepowerMax !== horsepowerDomain[1]) {
    activeFilters.push(`horsepower: ${horsepowerMin}-${horsepowerMax}`)
  }
  if (typeof primarySelectionSummary === 'string' && primarySelectionSummary.length > 0) {
    activeFilters.push(`selection: ${primarySelectionSummary}`)
  }
  if (typeof highlightSummary === 'string' && highlightSummary.length > 0) {
    activeFilters.push(`highlight: ${highlightSummary}`)
  }
  return activeFilters
}
