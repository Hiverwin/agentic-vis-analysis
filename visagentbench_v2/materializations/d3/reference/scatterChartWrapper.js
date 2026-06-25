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

function materializeRenderState({ rows, xDomain, yDomain, brush, highlightedKeys }) {
  const highlightedSet = new Set(normalizeHighlightedKeys(highlightedKeys))
  return {
    xDomain: clone(xDomain),
    yDomain: clone(yDomain),
    brush: clone(brush),
    points: rows.map((point) => ({
      ...point,
      visible: pointInDomain(point, xDomain, yDomain),
      selected: pointInDomain(point, brush?.domain?.xDomain || null, brush?.domain?.yDomain || null),
      highlighted: highlightedSet.has(point.id),
    })),
  }
}

export function createD3ScatterChartWrapper({ rows = [], render = () => {} } = {}) {
  const normalizedRows = normalizeRows(rows)
  const internalState = {
    xDomain: null,
    yDomain: null,
    brush: null,
    highlightedKeys: [],
  }

  function emitRender() {
    const payload = materializeRenderState({
      rows: normalizedRows,
      xDomain: internalState.xDomain,
      yDomain: internalState.yDomain,
      brush: internalState.brush,
      highlightedKeys: internalState.highlightedKeys,
    })
    render(clone(payload))
    return payload
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
      return emitRender()
    },
    setBrush(selection) {
      internalState.brush = normalizeBrush(selection)
      return emitRender()
    },
    setDomain(xDomain, yDomain) {
      internalState.xDomain = normalizeDomain(xDomain)
      internalState.yDomain = normalizeDomain(yDomain)
      return emitRender()
    },
    setHighlights(keys = []) {
      internalState.highlightedKeys = normalizeHighlightedKeys(keys)
      return emitRender()
    },
  }
}
