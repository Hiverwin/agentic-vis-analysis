function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function normalizeRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const x = Number(row?.x)
      const y = Number(row?.y)
      const id = typeof row?.id === 'string' ? row.id : null
      const category = typeof row?.category === 'string' ? row.category : null
      if (!Number.isFinite(x) || !Number.isFinite(y) || !id) return null
      return { x, y, id, category }
    })
    .filter(Boolean)
}

function normalizeDomain(domain) {
  return Array.isArray(domain) && domain.length >= 2 && Number.isFinite(Number(domain[0])) && Number.isFinite(Number(domain[1]))
    ? [Number(domain[0]), Number(domain[1])]
    : null
}

function normalizeBrush(selection) {
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) return null
  const xDomain = normalizeDomain(selection?.domain?.xDomain)
  const yDomain = normalizeDomain(selection?.domain?.yDomain)
  if (!xDomain || !yDomain) return null
  return {
    kind: 'interval',
    domain: { xDomain, yDomain },
  }
}

function normalizeHighlightedKeys(value) {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === 'string' && entry.length > 0)
    : []
}

function pointInDomain(point, xDomain, yDomain) {
  const xOkay = !xDomain || (point.x >= xDomain[0] && point.x <= xDomain[1])
  const yOkay = !yDomain || (point.y >= yDomain[0] && point.y <= yDomain[1])
  return xOkay && yOkay
}

function buildOption({ rows, xDomain, yDomain, brush, highlightedKeys }) {
  const highlightedSet = new Set(normalizeHighlightedKeys(highlightedKeys))
  return {
    xAxis: {
      type: 'value',
      ...(xDomain ? { min: xDomain[0], max: xDomain[1] } : {}),
    },
    yAxis: {
      type: 'value',
      ...(yDomain ? { min: yDomain[0], max: yDomain[1] } : {}),
    },
    series: [{
      type: 'scatter',
      data: rows.map((point) => {
        const visible = pointInDomain(point, xDomain, yDomain)
        const selected = pointInDomain(point, brush?.domain?.xDomain || null, brush?.domain?.yDomain || null)
        const highlighted = highlightedSet.has(point.id)
        return {
          id: point.id,
          name: point.id,
          value: [point.x, point.y],
          symbolSize: highlighted ? 14 : (selected ? 12 : 8),
          itemStyle: {
            opacity: highlighted ? 1 : (selected ? 0.9 : (visible ? 0.55 : 0.15)),
          },
        }
      }),
    }],
  }
}

export function createEChartsScatterChartWrapper({ chart, rows = [] } = {}) {
  const normalizedRows = normalizeRows(rows)
  const internalState = {
    xDomain: null,
    yDomain: null,
    brush: null,
    highlightedKeys: [],
  }

  function emitOption() {
    const option = buildOption({
      rows: normalizedRows,
      xDomain: internalState.xDomain,
      yDomain: internalState.yDomain,
      brush: internalState.brush,
      highlightedKeys: internalState.highlightedKeys,
    })
    chart?.setOption?.(clone(option), { notMerge: false, lazyUpdate: true })

    if (internalState.brush && typeof chart?.dispatchAction === 'function') {
      chart.dispatchAction({
        type: 'brush',
        areas: [{
          brushType: 'rect',
          coordRange: [
            internalState.brush.domain.xDomain,
            internalState.brush.domain.yDomain,
          ],
        }],
      })
    }

    if (typeof chart?.dispatchAction === 'function') {
      chart.dispatchAction({
        type: 'downplay',
        seriesIndex: 0,
      })
      for (const highlightedKey of internalState.highlightedKeys) {
        const dataIndex = normalizedRows.findIndex((point) => point.id === highlightedKey)
        if (dataIndex >= 0) {
          chart.dispatchAction({
            type: 'highlight',
            seriesIndex: 0,
            dataIndex,
          })
        }
      }
    }

    return option
  }

  return {
    getState() {
      return {
        rows: clone(rows),
        view: {
          xDomain: clone(internalState.xDomain),
          yDomain: clone(internalState.yDomain),
        },
        selections: internalState.brush ? { localBrush: clone(internalState.brush) } : {},
        feedback: {
          highlightedKeys: [...internalState.highlightedKeys],
        },
      }
    },
    renderFromState(widgetState = {}) {
      const selections = Object.values(widgetState?.selections || {}).filter(Boolean)
      internalState.brush = normalizeBrush(selections.find((selection) => selection?.kind === 'interval') || null)
      internalState.xDomain = normalizeDomain(widgetState?.view?.xDomain)
      internalState.yDomain = normalizeDomain(widgetState?.view?.yDomain)
      internalState.highlightedKeys = normalizeHighlightedKeys(widgetState?.feedback?.highlightedKeys)
      return emitOption()
    },
    setBrush(selection) {
      internalState.brush = normalizeBrush(selection)
      return emitOption()
    },
    setDomain(xDomain, yDomain) {
      internalState.xDomain = normalizeDomain(xDomain)
      internalState.yDomain = normalizeDomain(yDomain)
      return emitOption()
    },
    setHighlights(keys = []) {
      internalState.highlightedKeys = normalizeHighlightedKeys(keys)
      return emitOption()
    },
  }
}
