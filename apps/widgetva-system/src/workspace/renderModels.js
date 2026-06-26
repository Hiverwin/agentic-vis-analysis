function deriveNumericDomain(values = [], fallback = [0, 1]) {
  const numericValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
  if (numericValues.length === 0) return [...fallback]
  return [Math.min(...numericValues), Math.max(...numericValues)]
}

export function buildBarRenderModel(rows = [], viewState = {}) {
  const palette = {
    USA: '#2d5f98',
    Europe: '#7d95b3',
    Japan: '#7da685',
  }
  const normalizedRows = Array.isArray(rows)
    ? rows
      .filter((row) => row && typeof row.origin === 'string' && Number.isFinite(row.avgHorsepower))
      .map((row) => ({
        category: row.origin,
        value: Number(row.avgHorsepower),
        count: Number(row.count) || 0,
        raw: row,
      }))
    : []

  return {
    widgetKind: 'bar',
    providerCapabilities: {
      clickSelect: true,
      highlight: true,
    },
    fields: {
      category: 'origin',
      value: 'avgHorsepower',
      count: 'count',
    },
    rows: normalizedRows,
    palette,
    selectedCategory: typeof viewState === 'string' ? viewState : (viewState?.analysisOrigin || 'All'),
    highlightPredicates: Array.isArray(viewState?.highlightPredicates || viewState?.predicates)
      ? (viewState.highlightPredicates || viewState.predicates)
      : [],
  }
}

export function buildLineRenderModel(rows = [], viewState = {}) {
  const palette = {
    USA: '#2d5f98',
    Europe: '#7d95b3',
    Japan: '#7da685',
  }
  const normalizedRows = Array.isArray(rows)
    ? rows
      .filter((row) => row && Number.isFinite(row.year) && Number.isFinite(row.avgMpg))
      .map((row) => ({
        x: Number(row.year),
        series: row.origin,
        value: Number(row.avgMpg),
        count: Number(row.count) || 0,
        raw: row,
      }))
    : []

  return {
    widgetKind: 'line',
    providerCapabilities: {
      clickSelect: true,
      highlight: true,
    },
    fields: {
      x: 'year',
      series: 'origin',
      value: 'avgMpg',
      count: 'count',
    },
    rows: normalizedRows,
    palette,
    selectedX: Number.isFinite(viewState) ? Number(viewState) : (viewState?.analysisYear || 'All'),
    highlightPredicates: Array.isArray(viewState?.highlightPredicates || viewState?.predicates)
      ? (viewState.highlightPredicates || viewState.predicates)
      : [],
  }
}

export function buildHeatmapRenderModel(rows = [], originState = 'All', cylindersState = []) {
  const selectedOrigin = typeof originState === 'string' ? originState : (originState?.analysisOrigin || 'All')
  const selectedCylinders = Array.isArray(cylindersState)
    ? cylindersState
    : Array.isArray(cylindersState?.analysisCylinders)
      ? cylindersState.analysisCylinders
      : []

  const normalizedRows = Array.isArray(rows)
    ? rows
      .filter((row) => row && typeof row.origin === 'string' && row.cylinders != null && Number.isFinite(row.avgHorsepower))
      .map((row) => ({
        x: row.cylinders,
        y: row.origin,
        value: Number(row.avgHorsepower),
        count: Number(row.count) || 0,
        raw: row,
      }))
    : []

  return {
    widgetKind: 'heatmap',
    providerCapabilities: {
      clickSelect: true,
      highlight: true,
    },
    fields: {
      x: 'cylinders',
      y: 'origin',
      value: 'avgHorsepower',
      count: 'count',
    },
    rows: normalizedRows,
    selectedOrigin,
    selectedCylinders,
    highlightPredicates: Array.isArray(originState?.highlightPredicates)
      ? originState.highlightPredicates
      : Array.isArray(cylindersState?.highlightPredicates)
        ? cylindersState.highlightPredicates
        : [],
  }
}

export function buildParallelCoordinatesRenderModel(rows = [], viewState = {}) {
  const palette = {
    USA: '#2d5f98',
    Europe: '#7d95b3',
    Japan: '#7da685',
  }
  const visibleDimensions = Array.isArray(viewState?.visibleDimensionKeys) && viewState.visibleDimensionKeys.length > 0
    ? viewState.visibleDimensionKeys
    : ['horsepower', 'mpg', 'weight', 'acceleration']
  const normalizedRows = Array.isArray(rows)
    ? rows
      .filter((row) => row && row.id)
      .map((row) => ({
        id: row.id,
        label: row.name,
        category: row.origin,
        dimensions: Object.fromEntries(
          visibleDimensions.map((dimension) => [dimension, Number(row[dimension])]),
        ),
        raw: row,
      }))
    : []

  return {
    widgetKind: 'parallelCoordinates',
    providerCapabilities: {
      clickSelect: true,
      brush: true,
      highlight: true,
    },
    fields: {
      id: 'id',
      label: 'name',
      category: 'origin',
      dimensions: visibleDimensions,
    },
    rows: normalizedRows,
    palette,
    visibleDimensions,
    focusedRowId: typeof viewState?.focusedCarId === 'string' ? viewState.focusedCarId : null,
    highlightPredicates: Array.isArray(viewState?.highlightPredicates || viewState?.predicates)
      ? (viewState.highlightPredicates || viewState.predicates)
      : [],
  }
}

export function buildSankeyRenderModel(graph = { nodes: [], links: [] }, viewState = {}) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : []
  const links = Array.isArray(graph?.links) ? graph.links : []
  const palette = {
    origin: '#2d5f98',
    cylinders: '#7d95b3',
    year: '#7da685',
    aggregate: '#a8b8ca',
  }
  const columnGroups = [0, 1, 2].map((column) => nodes.filter((node) => node.column === column))
  const columnX = [48, 196, 344]
  const top = 18

  const layoutNodes = {}
  columnGroups.forEach((group, column) => {
    const step = group.length > 1 ? 108 / (group.length - 1) : 0
    group.forEach((node, index) => {
      layoutNodes[node.id] = {
        ...node,
        x: columnX[column],
        y: top + (index * step),
        width: 84,
        height: 22,
        color: palette[node.kind] || '#2d5f98',
      }
    })
  })

  const layoutLinks = links.map((link) => {
    const source = layoutNodes[link.source]
    const target = layoutNodes[link.target]
    return {
      ...link,
      sourceNode: source || null,
      targetNode: target || null,
    }
  })

  return {
    widgetKind: 'sankey',
    providerCapabilities: {
      clickSelect: true,
      highlight: true,
    },
    nodes: Object.values(layoutNodes),
    links: layoutLinks,
    highlightPredicates: Array.isArray(viewState?.highlightPredicates || viewState?.predicates)
      ? (viewState.highlightPredicates || viewState.predicates)
      : [],
    analyticalOverlay: viewState?.analyticalOverlay || null,
  }
}

export function buildScatterRenderModel(rows = [], viewState = {}) {
  const palette = {
    USA: '#2d5f98',
    Europe: '#7d95b3',
    Japan: '#7da685',
  }
  const normalizedRows = Array.isArray(rows)
    ? rows
      .filter((row) => row && Number.isFinite(row.horsepower) && Number.isFinite(row.mpg))
      .map((row) => ({
        id: row.id,
        label: row.name,
        category: row.origin,
        x: Number(row.horsepower),
        y: Number(row.mpg),
        size: Number(row.weight),
        raw: row,
      }))
    : []

  const fallbackXDomain = deriveNumericDomain(normalizedRows.map((row) => row.x), [40, 230])
  const fallbackYDomain = deriveNumericDomain(normalizedRows.map((row) => row.y), [8, 40])

  return {
    widgetKind: 'scatter',
    providerCapabilities: {
      brush: true,
      zoom: true,
      clickFocus: true,
    },
    fields: {
      id: 'id',
      label: 'name',
      category: 'origin',
      x: 'horsepower',
      y: 'mpg',
      size: 'weight',
    },
    rows: normalizedRows,
    palette,
    domains: {
      x: Array.isArray(viewState?.xDomain) ? viewState.xDomain : (Array.isArray(viewState?.activeRange) ? viewState.activeRange : fallbackXDomain),
      y: Array.isArray(viewState?.yDomain) ? viewState.yDomain : fallbackYDomain,
      size: deriveNumericDomain(normalizedRows.map((row) => row.size), [1500, 4500]),
    },
    highlightPredicates: Array.isArray(viewState?.highlightPredicates) ? viewState.highlightPredicates : [],
    viewport: {
      xDomain: Array.isArray(viewState?.xDomain) ? viewState.xDomain : null,
      yDomain: Array.isArray(viewState?.yDomain) ? viewState.yDomain : null,
    },
  }
}
