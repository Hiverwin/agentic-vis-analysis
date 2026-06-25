function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function normalizeRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const date = row?.date
      const series = typeof row?.series === 'string' ? row.series : null
      const revenue = Number(row?.revenue)
      if ((typeof date !== 'string' && typeof date !== 'number') || !series || !Number.isFinite(revenue)) return null
      return { date: String(date), series, revenue }
    })
    .filter(Boolean)
}

function buildSeries(rows = []) {
  const grouped = new Map()
  for (const row of normalizeRows(rows)) {
    const nextValues = grouped.get(row.series) || []
    nextValues.push([row.date, row.revenue])
    grouped.set(row.series, nextValues)
  }
  return [...grouped.entries()].map(([name, data]) => ({ name, data }))
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

function normalizeDomain(domain) {
  if (!Array.isArray(domain) || domain.length < 2) return null
  if ((typeof domain[0] !== 'string' && typeof domain[0] !== 'number') || (typeof domain[1] !== 'string' && typeof domain[1] !== 'number')) {
    return null
  }
  return [String(domain[0]), String(domain[1])]
}

function buildOption({ baseSeries, xDomain, focusedSeries, highlightedKeys }) {
  const focusedSet = new Set(normalizeFocusedSeries(focusedSeries))
  const highlightedSet = new Set(normalizeHighlightedKeys(highlightedKeys))
  const emphasizedSeries = new Set([...focusedSet, ...highlightedSet])
  const hasEmphasis = emphasizedSeries.size > 0
  const normalizedDomain = normalizeDomain(xDomain)

  return {
    xAxis: { type: 'category' },
    yAxis: { type: 'value' },
    dataZoom: normalizedDomain
      ? [{
          type: 'inside',
          xAxisIndex: 0,
          startValue: normalizedDomain[0],
          endValue: normalizedDomain[1],
        }]
      : [],
    series: baseSeries.map((entry) => {
      const emphasized = emphasizedSeries.has(entry.name)
      return {
        type: 'line',
        name: entry.name,
        data: clone(entry.data),
        lineStyle: {
          opacity: hasEmphasis ? (emphasized ? 1 : 0.2) : 1,
          width: emphasized ? 4 : 2,
        },
      }
    }),
  }
}

export function createEChartsLineChartWrapper({ chart, rows = [] } = {}) {
  const baseSeries = buildSeries(rows)
  const internalState = {
    xDomain: null,
    focusedSeries: [],
    highlightedKeys: [],
  }

  function emitOption() {
    const nextOption = buildOption({
      baseSeries,
      xDomain: internalState.xDomain,
      focusedSeries: internalState.focusedSeries,
      highlightedKeys: internalState.highlightedKeys,
    })
    chart?.setOption?.(clone(nextOption), { notMerge: false, lazyUpdate: true })

    if (typeof chart?.dispatchAction === 'function') {
      for (const entry of baseSeries) {
        chart.dispatchAction({
          type: 'downplay',
          seriesName: entry.name,
        })
      }
      for (const seriesName of [...new Set([...internalState.focusedSeries, ...internalState.highlightedKeys])]) {
        chart.dispatchAction({
          type: 'highlight',
          seriesName,
        })
      }
    }

    return nextOption
  }

  return {
    getState() {
      return {
        rows: clone(rows),
        view: {
          xDomain: normalizeDomain(internalState.xDomain),
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
      return emitOption()
    },
    setDomain(xDomain) {
      internalState.xDomain = xDomain || null
      return emitOption()
    },
    setFocus(focus = {}) {
      internalState.focusedSeries = normalizeFocusedSeries(focus?.focusedSeries)
      return emitOption()
    },
    setHighlights(keys = []) {
      internalState.highlightedKeys = normalizeHighlightedKeys(keys)
      return emitOption()
    },
  }
}
