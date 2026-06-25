function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function normalizeDateValue(value) {
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const nextDate = new Date(value)
    return Number.isNaN(nextDate.getTime()) ? null : nextDate
  }
  return null
}

function normalizeRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const date = normalizeDateValue(row?.date)
      const series = typeof row?.series === 'string' ? row.series : null
      const revenue = Number(row?.revenue)
      if (!date || !series || !Number.isFinite(revenue)) return null
      return { date, series, revenue }
    })
    .filter(Boolean)
}

function buildSeries(rows = []) {
  const grouped = new Map()
  for (const row of normalizeRows(rows)) {
    const nextValues = grouped.get(row.series) || []
    nextValues.push({ date: row.date, revenue: row.revenue })
    grouped.set(row.series, nextValues)
  }

  return [...grouped.entries()].map(([key, values]) => ({
    key,
    values: values.sort((a, b) => a.date - b.date),
  }))
}

function normalizeDomain(domain) {
  if (!Array.isArray(domain) || domain.length < 2) return null
  const start = normalizeDateValue(domain[0])
  const end = normalizeDateValue(domain[1])
  if (!start || !end) return null
  return [start, end]
}

function normalizeFocusedSeries(value) {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === 'string' && entry.length > 0)
    : []
}

function normalizeHighlightedKeys(value) {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === 'string' && entry.length > 0)
    : []
}

function serializeDomain(domain) {
  return Array.isArray(domain) ? domain.map((entry) => entry.toISOString().slice(0, 10)) : null
}

function materializeRenderState({ baseSeries, xDomain, focusedSeries, highlightedKeys }) {
  const focusedSet = new Set(normalizeFocusedSeries(focusedSeries))
  const highlightedSet = new Set(normalizeHighlightedKeys(highlightedKeys))
  const hasFocusedSeries = focusedSet.size > 0
  const normalizedDomain = normalizeDomain(xDomain)

  return {
    xDomain: serializeDomain(normalizedDomain),
    focusedSeries: [...focusedSet],
    series: baseSeries
      .map((entry) => ({
        key: entry.key,
        values: entry.values.filter((point) => {
          if (!normalizedDomain) return true
          return point.date >= normalizedDomain[0] && point.date <= normalizedDomain[1]
        }),
      }))
      .filter((entry) => entry.values.length > 0)
      .map((entry) => ({
        ...entry,
        dimmed: hasFocusedSeries ? !focusedSet.has(entry.key) : false,
        highlighted: highlightedSet.has(entry.key),
      })),
  }
}

export function createD3LineChartWrapper({ rows = [], render = () => {} } = {}) {
  const baseSeries = buildSeries(rows)
  const internalState = {
    xDomain: null,
    focusedSeries: [],
    highlightedKeys: [],
  }

  function emitRender() {
    const nextRenderState = materializeRenderState({
      baseSeries,
      xDomain: internalState.xDomain,
      focusedSeries: internalState.focusedSeries,
      highlightedKeys: internalState.highlightedKeys,
    })
    render(clone(nextRenderState))
    return nextRenderState
  }

  return {
    getState() {
      return {
        rows: clone(rows),
        view: {
          xDomain: serializeDomain(normalizeDomain(internalState.xDomain)),
          focusedSeries: [...internalState.focusedSeries],
        },
        feedback: {
          highlightedKeys: [...internalState.highlightedKeys],
        },
      }
    },
    renderFromState(widgetState = {}) {
      internalState.xDomain = widgetState?.view?.xDomain || null
      internalState.focusedSeries = normalizeFocusedSeries(widgetState?.view?.focusedSeries)
      internalState.highlightedKeys = normalizeHighlightedKeys(widgetState?.feedback?.highlightedKeys)
      return emitRender()
    },
    setDomain(xDomain) {
      internalState.xDomain = xDomain || null
      return emitRender()
    },
    setFocus(focus = {}) {
      internalState.focusedSeries = normalizeFocusedSeries(focus?.focusedSeries)
      return emitRender()
    },
    setHighlights(keys = []) {
      internalState.highlightedKeys = normalizeHighlightedKeys(keys)
      return emitRender()
    },
  }
}
