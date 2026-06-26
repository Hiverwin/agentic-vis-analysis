import { buildScatterRenderModel } from './renderModels.js'

function baseConfig() {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    autosize: { type: 'fit', contains: 'padding' },
    config: {
      background: null,
      axis: {
        labelColor: '#536982',
        titleColor: '#536982',
        gridColor: 'rgba(204, 214, 228, 0.6)',
        tickColor: 'rgba(170, 184, 203, 0.8)',
        domainColor: 'rgba(170, 184, 203, 0.8)',
        labelFontSize: 10,
        titleFontSize: 10,
        labelFont: 'Inter',
        titleFont: 'Inter',
      },
      legend: {
        labelColor: '#536982',
        titleColor: '#536982',
        labelFontSize: 10,
        titleFontSize: 10,
      },
      view: { stroke: null },
    },
  }
}

function buildPredicateTest(predicates = []) {
  if (!Array.isArray(predicates) || predicates.length === 0) return null
  const expressions = predicates.flatMap((predicate) => {
    if (!predicate?.field || !predicate?.op) return []
    if (predicate.op === 'equals') {
      return [`datum.${predicate.field} === ${JSON.stringify(predicate.value)}`]
    }
    if (predicate.op === 'between' && Array.isArray(predicate.value) && predicate.value.length === 2) {
      return [`datum.${predicate.field} >= ${predicate.value[0]} && datum.${predicate.field} <= ${predicate.value[1]}`]
    }
    return []
  })
  return expressions.length > 0 ? expressions.join(' && ') : null
}

function euclideanDistanceSquared(a, b) {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  return (dx * dx) + (dy * dy)
}

function assignPointsToCenters(points, centers) {
  return points.map((point) => {
    let bestIndex = 0
    let bestDistance = Number.POSITIVE_INFINITY
    centers.forEach((center, index) => {
      const distance = euclideanDistanceSquared(point, center)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = index
      }
    })
    return bestIndex
  })
}

function recomputeCenters(points, labels, clusterCount, previousCenters) {
  return Array.from({ length: clusterCount }, (_, clusterIndex) => {
    const clusterPoints = points.filter((_, pointIndex) => labels[pointIndex] === clusterIndex)
    if (!clusterPoints.length) return previousCenters[clusterIndex]
    const sums = clusterPoints.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0])
    return [sums[0] / clusterPoints.length, sums[1] / clusterPoints.length]
  })
}

function runKMeans(points, clusterCount, maxIterations = 25) {
  const safeClusterCount = Math.max(1, Math.min(clusterCount, points.length))
  let centers = points.slice(0, safeClusterCount).map((point) => [...point])
  let labels = assignPointsToCenters(points, centers)
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const nextCenters = recomputeCenters(points, labels, safeClusterCount, centers)
    const nextLabels = assignPointsToCenters(points, nextCenters)
    const unchanged = nextLabels.every((label, index) => label === labels[index])
    centers = nextCenters
    labels = nextLabels
    if (unchanged) break
  }
  return { labels, centers }
}

function withScatterRegressionOverlay(spec, method = 'linear') {
  const xField = spec?.encoding?.x?.field
  const yField = spec?.encoding?.y?.field
  const xType = spec?.encoding?.x?.type || 'quantitative'
  if (!xField || !yField) return spec
  const overlayTransform = {
    regression: yField,
    on: xField,
  }
  if (method === 'quad') {
    overlayTransform.method = 'poly'
    overlayTransform.order = 2
  } else if (method === 'cubic') {
    overlayTransform.method = 'poly'
    overlayTransform.order = 3
  } else {
    overlayTransform.method = method
  }
  const baseLayer = {
    ...(Array.isArray(spec?.params) && spec.params.length > 0 ? { params: spec.params } : {}),
    mark: spec.mark || 'point',
    encoding: spec.encoding || {},
  }
  const overlayLayer = {
    _widgetvaTag: 'scatter.showRegression',
    mark: { type: 'line', color: 'red', strokeWidth: 2.4 },
    transform: [overlayTransform],
    encoding: {
      x: { field: xField, type: xType },
      y: { field: yField, type: 'quantitative' },
    },
  }
  const nextSpec = { ...spec }
  delete nextSpec.mark
  delete nextSpec.encoding
  delete nextSpec.params
  return {
    ...nextSpec,
    layer: [baseLayer, overlayLayer],
  }
}

function withScatterClusters(spec, rows, nClusters = 2) {
  const xField = spec?.encoding?.x?.field
  const yField = spec?.encoding?.y?.field
  if (!xField || !yField || !Array.isArray(rows) || rows.length === 0) return spec
  const validRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => Number.isFinite(row?.[xField]) && Number.isFinite(row?.[yField]))
  if (validRows.length < Math.max(1, nClusters)) return spec
  const points = validRows.map(({ row }) => [row[xField], row[yField]])
  const { labels } = runKMeans(points, nClusters)
  const clusterField = `cluster_${nClusters}`
  const nextRows = rows.map((row) => ({ ...row }))
  validRows.forEach(({ index }, pointIndex) => {
    nextRows[index][clusterField] = labels[pointIndex]
  })
  return {
    ...spec,
    data: { values: nextRows },
    encoding: {
      ...spec.encoding,
      color: {
        field: clusterField,
        type: 'nominal',
      },
    },
    _scatter_cluster_state: {
      cluster_field: clusterField,
      n_clusters: nClusters,
    },
  }
}

function withLineMovingAverageOverlay(spec, windowSize = 3) {
  const xField = spec?.encoding?.x?.field
  const yField = spec?.encoding?.y?.field
  const xType = spec?.encoding?.x?.type || 'ordinal'
  if (!xField || !yField) return spec
  const maField = `${yField}_ma`
  const baseLayer = {
    mark: spec.mark || 'line',
    encoding: spec.encoding || {},
  }
  const overlayLayer = {
    _widgetvaTag: 'line.showMovingAverage',
    mark: { type: 'line', color: 'orange', strokeWidth: 3, opacity: 0.8 },
    transform: [{
      window: [{ op: 'mean', field: yField, as: maField }],
      frame: [-(windowSize - 1), 0],
      sort: [{ field: xField, order: 'ascending' }],
      ...(spec?.encoding?.color?.field ? { groupby: [spec.encoding.color.field] } : {}),
    }],
    encoding: {
      x: { field: xField, type: xType },
      y: { field: maField, type: 'quantitative' },
      ...(spec?.encoding?.color ? { color: spec.encoding.color } : {}),
    },
  }
  const nextSpec = { ...spec }
  delete nextSpec.mark
  delete nextSpec.encoding
  return {
    ...nextSpec,
    layer: [baseLayer, overlayLayer],
  }
}

function withHeatmapClusterSort(spec, { clusterRows = true, clusterCols = true, method = 'sum' } = {}) {
  const colorField = spec?.encoding?.color?.field
  if (!colorField) return spec
  const nextEncoding = {
    ...(spec.encoding || {}),
  }
  if (clusterRows && nextEncoding.y) {
    nextEncoding.y = {
      ...nextEncoding.y,
      sort: { op: method, field: colorField, order: 'descending' },
    }
  }
  if (clusterCols && nextEncoding.x) {
    nextEncoding.x = {
      ...nextEncoding.x,
      sort: { op: method, field: colorField, order: 'descending' },
    }
  }
  return {
    ...spec,
    encoding: nextEncoding,
    _cluster_rows_cols_state: {
      cluster_rows: clusterRows,
      cluster_cols: clusterCols,
      method,
      color_field: colorField,
    },
  }
}

function withHeatmapRegionHighlight(spec, { xValues = [], yValues = [] } = {}) {
  const safeXValues = Array.isArray(xValues) ? xValues.filter((value) => value != null) : []
  const safeYValues = Array.isArray(yValues) ? yValues.filter((value) => value != null) : []
  if (safeXValues.length === 0 && safeYValues.length === 0) return spec

  const tests = []
  if (safeXValues.length > 0) {
    tests.push(`indexof(${JSON.stringify(safeXValues)}, datum["cylinders"]) >= 0`)
  }
  if (safeYValues.length > 0) {
    tests.push(`indexof(${JSON.stringify(safeYValues)}, datum["origin"]) >= 0`)
  }

  return {
    ...spec,
    encoding: {
      ...(spec.encoding || {}),
      opacity: {
        condition: {
          test: tests.join(' && '),
          value: 1,
        },
        value: 0.15,
      },
    },
  }
}

function withHeatmapValueHighlight(spec, { minValue = null, maxValue = null } = {}) {
  const checks = []
  if (Number.isFinite(minValue)) {
    checks.push(`datum["avgHorsepower"] >= ${Number(minValue)}`)
  }
  if (Number.isFinite(maxValue)) {
    checks.push(`datum["avgHorsepower"] <= ${Number(maxValue)}`)
  }
  if (checks.length === 0) return spec

  return {
    ...spec,
    encoding: {
      ...(spec.encoding || {}),
      opacity: {
        condition: {
          test: checks.join(' && '),
          value: 1,
        },
        value: 0.15,
      },
    },
  }
}

function withHeatmapTranspose(spec, { transposed = true } = {}) {
  if (transposed !== true) return spec
  const xEncoding = spec?.encoding?.x
  const yEncoding = spec?.encoding?.y
  if (!xEncoding || !yEncoding) return spec
  return {
    ...spec,
    encoding: {
      ...(spec.encoding || {}),
      x: { ...yEncoding },
      y: { ...xEncoding },
    },
    ...(spec.width != null && spec.height != null ? { width: spec.height, height: spec.width } : {}),
    _transpose_state: {
      ...(spec._transpose_state || { transposed: false }),
      transposed: true,
    },
  }
}

function withLineTrendHighlight(spec) {
  const xField = spec?.encoding?.x?.field
  const yField = spec?.encoding?.y?.field
  const xType = spec?.encoding?.x?.type || 'ordinal'
  const yType = spec?.encoding?.y?.type || 'quantitative'
  if (!xField || !yField) return spec
  const baseLayer = {
    mark: spec.mark || 'line',
    encoding: spec.encoding || {},
  }
  const overlayLayer = {
    _widgetvaTag: 'line.highlightTrend',
    mark: { type: 'line', color: '#d9485f', strokeWidth: 2.4, strokeDash: [5, 5] },
    transform: [{
      regression: yField,
      on: xField,
    }],
    encoding: {
      x: { field: xField, type: xType },
      y: { field: yField, type: yType },
    },
  }
  const nextSpec = { ...spec }
  delete nextSpec.mark
  delete nextSpec.encoding
  return {
    ...nextSpec,
    layer: [baseLayer, overlayLayer],
  }
}

function withBarTopNHighlight(spec, rows, n = 2, order = 'descending') {
  if (!Array.isArray(rows) || rows.length === 0) return spec
  const rankedOrigins = [...rows]
    .filter((row) => row && typeof row.origin === 'string' && Number.isFinite(row.avgHorsepower))
    .sort((left, right) => (
      order === 'ascending'
        ? left.avgHorsepower - right.avgHorsepower
        : right.avgHorsepower - left.avgHorsepower
    ))
    .slice(0, Math.max(1, n))
    .map((row) => row.origin)
  if (rankedOrigins.length === 0) return spec
  const rankedTest = rankedOrigins
    .map((origin) => `datum.origin === ${JSON.stringify(origin)}`)
    .join(' || ')
  return {
    ...spec,
    encoding: {
      ...(spec.encoding || {}),
      opacity: {
        condition: { test: rankedTest, value: 1 },
        value: 0.28,
      },
      stroke: {
        condition: { test: rankedTest, value: '#17395c' },
        value: '#ffffff',
      },
      strokeWidth: {
        condition: { test: rankedTest, value: 1.1 },
        value: 0.2,
      },
    },
    _bar_highlight_top_n_state: {
      origins: rankedOrigins,
      n: Math.max(1, n),
      order,
    },
  }
}

export function buildScatterVegaSpecFromRenderModel(renderModel, viewState = {}) {
  const colorScale = {
    domain: Object.keys(renderModel?.palette || {}),
    range: Object.values(renderModel?.palette || {}),
  }
  const xDomain = renderModel?.domains?.x || viewState.xDomain || viewState.activeRange || [40, 230]
  const yDomain = renderModel?.domains?.y || viewState.yDomain || null
  const highlightTest = buildPredicateTest(renderModel?.highlightPredicates || viewState.highlightPredicates)
  const baseSpec = {
    ...baseConfig(),
    width: 'container',
    height: 208,
    data: {
      values: (renderModel?.rows || []).map((row) => ({
        ...row.raw,
        horsepower: row.x,
        mpg: row.y,
        weight: row.size,
        origin: row.category,
        name: row.label,
      })),
    },
    params: [
      {
        name: 'hpViewport',
        select: {
          type: 'interval',
          encodings: ['x', 'y'],
          bind: 'scales',
          translate: '[mousedown[!event.shiftKey], window:mouseup] > window:mousemove!',
          zoom: 'wheel![!event.shiftKey]',
        },
      },
      {
        name: 'hpBrush',
        select: {
          type: 'interval',
          encodings: ['x', 'y'],
          translate: '[mousedown[event.shiftKey], window:mouseup] > window:mousemove!',
        },
      },
    ],
    mark: { type: 'circle', stroke: 'white', strokeWidth: 0.6 },
    encoding: {
      x: {
        field: 'horsepower',
        type: 'quantitative',
        title: 'Horsepower',
        scale: { domain: xDomain },
      },
      y: {
        field: 'mpg',
        type: 'quantitative',
        title: 'MPG',
        ...(Array.isArray(yDomain) ? { scale: { domain: yDomain } } : {}),
      },
      color: {
        condition: { param: 'hpBrush', field: 'origin', type: 'nominal', scale: colorScale, empty: true },
        value: '#c8d3e1',
      },
      opacity: {
        condition: highlightTest
          ? [
              { param: 'hpBrush', value: 0.92, empty: true },
              { test: highlightTest, value: 0.92 },
            ]
          : { param: 'hpBrush', value: 0.92, empty: true },
        value: 0.16,
      },
      size: {
        field: 'weight',
        type: 'quantitative',
        scale: { range: [24, 220] },
        legend: null,
      },
      tooltip: [
        { field: 'name', type: 'nominal', title: 'Model' },
        { field: 'origin', type: 'nominal', title: 'Origin' },
        { field: 'horsepower', type: 'quantitative', title: 'Horsepower' },
        { field: 'mpg', type: 'quantitative', title: 'MPG' },
        { field: 'weight', type: 'quantitative', title: 'Weight' },
      ],
    },
  }
  const overlay = viewState?.analyticalOverlay
  if (overlay?.kind === 'scatterClusters') {
    return withScatterClusters(baseSpec, renderModel?.rows?.map((row) => row.raw) || [], overlay.nClusters || 2)
  }
  if (overlay?.kind === 'scatterRegression') {
    return withScatterRegressionOverlay(baseSpec, overlay.method || 'linear')
  }
  return baseSpec
}

export function buildScatterSpec(rows, viewState = {}) {
  return buildScatterVegaSpecFromRenderModel(buildScatterRenderModel(rows, viewState), viewState)
}

export function buildScatterEChartsOptionFromRenderModel(renderModel) {
  const palette = renderModel?.palette || {}
  const hasBrushContext = Array.isArray(renderModel?.highlightPredicates) && renderModel.highlightPredicates.length > 0
  return {
    animation: false,
    backgroundColor: 'transparent',
    grid: {
      left: 34,
      right: 10,
      top: 10,
      bottom: 24,
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      min: renderModel?.domains?.x?.[0],
      max: renderModel?.domains?.x?.[1],
      axisLine: { lineStyle: { color: 'rgba(170, 184, 203, 0.8)' } },
      axisLabel: { color: '#536982', fontSize: 9 },
      splitLine: { lineStyle: { color: 'rgba(204, 214, 228, 0.6)' } },
    },
    yAxis: {
      type: 'value',
      min: renderModel?.domains?.y?.[0],
      max: renderModel?.domains?.y?.[1],
      axisLine: { show: false },
      axisLabel: { color: '#536982', fontSize: 9 },
      splitLine: { lineStyle: { color: 'rgba(204, 214, 228, 0.6)' } },
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(244, 248, 252, 0.96)',
      borderColor: 'rgba(184, 198, 215, 0.9)',
      borderWidth: 1,
      textStyle: {
        color: '#24384d',
        fontSize: 11,
      },
      formatter(params) {
        const datum = params?.data || {}
        return [
          `<strong>${datum.label || ''}</strong>`,
          `Origin: ${datum.category || ''}`,
          `Horsepower: ${datum.value?.[0] ?? 'n/a'}`,
          `MPG: ${datum.value?.[1] ?? 'n/a'}`,
          `Weight: ${datum.size ?? 'n/a'}`,
        ].join('<br/>')
      },
    },
    series: [
      {
        type: 'scatter',
        symbolSize(value, params) {
          const size = Number(params?.data?.size) || 0
          const [minSize, maxSize] = renderModel?.domains?.size || [0, 1]
          if (!Number.isFinite(size) || maxSize <= minSize) return 10
          return 8 + (((size - minSize) / (maxSize - minSize)) * 16)
        },
        data: (renderModel?.rows || []).map((row) => ({
          id: row.id,
          label: row.label,
          category: row.category,
          size: row.size,
          raw: row.raw,
          value: [row.x, row.y],
          itemStyle: {
            color: palette[row.category] || '#2d5f98',
            opacity: hasBrushContext ? 0.88 : 0.76,
          },
        })),
      },
    ],
  }
}

export function buildBarOriginSpec(rows, activeOrigin) {
  const highlightTest = buildPredicateTest(activeOrigin?.highlightPredicates || activeOrigin?.predicates || null)
  const selectedOrigin = typeof activeOrigin === 'string' ? activeOrigin : (activeOrigin?.analysisOrigin || 'All')
  const baseSpec = {
    ...baseConfig(),
    width: 'container',
    height: 196,
    data: { values: rows },
    mark: { type: 'bar', cornerRadiusTopLeft: 3, cornerRadiusTopRight: 3 },
    encoding: {
      x: { field: 'origin', type: 'nominal', title: null, sort: '-y' },
      y: { field: 'avgHorsepower', type: 'quantitative', title: 'Avg horsepower' },
      color: {
        condition: selectedOrigin && selectedOrigin !== 'All'
          ? { test: `datum.origin === '${selectedOrigin}'`, value: '#2d5f98' }
          : undefined,
        field: 'origin',
        type: 'nominal',
        scale: {
          domain: ['USA', 'Europe', 'Japan'],
          range: ['#2d5f98', '#7d95b3', '#7da685'],
        },
        legend: null,
      },
      opacity: highlightTest
        ? {
            condition: { test: highlightTest, value: 1 },
            value: 0.34,
          }
        : undefined,
      tooltip: [
        { field: 'origin', type: 'nominal', title: 'Origin' },
        { field: 'avgHorsepower', type: 'quantitative', title: 'Avg horsepower' },
        { field: 'count', type: 'quantitative', title: 'Cars' },
      ],
    },
  }
  const overlay = activeOrigin?.analyticalOverlay
  if (overlay?.kind === 'barHighlightTopN') {
    return withBarTopNHighlight(baseSpec, rows, overlay.n || 2, overlay.order || 'descending')
  }
  return baseSpec
}

export function buildBarOriginEChartsOption(rows, activeOrigin) {
  const highlightPredicates = activeOrigin?.highlightPredicates || activeOrigin?.predicates || []
  const selectedOrigin = typeof activeOrigin === 'string' ? activeOrigin : (activeOrigin?.analysisOrigin || 'All')
  const highlightedOrigins = Array.isArray(highlightPredicates)
    ? [...new Set(highlightPredicates
      .filter((predicate) => predicate?.field === 'origin' && predicate?.op === 'equals' && typeof predicate?.value === 'string')
      .map((predicate) => predicate.value))]
    : []

  const colorByOrigin = {
    USA: '#2d5f98',
    Europe: '#7d95b3',
    Japan: '#7da685',
  }

  return {
    animation: false,
    backgroundColor: 'transparent',
    grid: {
      left: 34,
      right: 10,
      top: 10,
      bottom: 24,
      containLabel: true,
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(244, 248, 252, 0.96)',
      borderColor: 'rgba(184, 198, 215, 0.9)',
      borderWidth: 1,
      textStyle: {
        color: '#24384d',
        fontSize: 11,
      },
      formatter(params) {
        const datum = params?.data || {}
        return [
          `<strong>${datum.origin || params?.name || ''}</strong>`,
          `Avg horsepower: ${datum.avgHorsepower ?? 'n/a'}`,
          `Cars: ${datum.count ?? 'n/a'}`,
        ].join('<br/>')
      },
    },
    xAxis: {
      type: 'category',
      data: rows.map((row) => row.origin),
      axisLine: { lineStyle: { color: 'rgba(170, 184, 203, 0.8)' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#536982',
        fontSize: 9,
      },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#536982',
        fontSize: 9,
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(204, 214, 228, 0.6)',
        },
      },
    },
    series: [
      {
        type: 'bar',
        barWidth: '46%',
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 0,
          },
        },
        data: rows.map((row) => {
          const isSelected = selectedOrigin !== 'All' && row.origin === selectedOrigin
          const isHighlighted = highlightedOrigins.length === 0 || highlightedOrigins.includes(row.origin)
          return {
            ...row,
            value: row.avgHorsepower,
            itemStyle: {
              color: colorByOrigin[row.origin] || '#2d5f98',
              opacity: isSelected ? 1 : (isHighlighted ? 0.92 : 0.34),
            },
          }
        }),
      },
    ],
  }
}

export function buildLineEChartsOptionFromRenderModel(renderModel, viewState = {}) {
  const palette = renderModel?.palette || {}
  const selectedYear = Number.isFinite(viewState) ? Number(viewState) : (viewState?.analysisYear || 'All')
  const rows = Array.isArray(renderModel?.rows) ? renderModel.rows : []
  const xValues = [...new Set(rows.map((row) => row.x))].sort((a, b) => Number(a) - Number(b))
  const seriesMap = rows.reduce((acc, row) => {
    if (!acc.has(row.series)) acc.set(row.series, [])
    acc.get(row.series).push(row)
    return acc
  }, new Map())

  return {
    animation: false,
    backgroundColor: 'transparent',
    grid: {
      left: 34,
      right: 10,
      top: 10,
      bottom: 24,
      containLabel: true,
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(244, 248, 252, 0.96)',
      borderColor: 'rgba(184, 198, 215, 0.9)',
      borderWidth: 1,
      textStyle: {
        color: '#24384d',
        fontSize: 11,
      },
      formatter(params) {
        const datum = params?.data || {}
        return [
          `<strong>${datum.series || params?.seriesName || ''}</strong>`,
          `Year: ${datum.year ?? params?.name ?? 'n/a'}`,
          `Avg MPG: ${datum.value ?? 'n/a'}`,
          `Cars: ${datum.count ?? 'n/a'}`,
        ].join('<br/>')
      },
    },
    legend: {
      show: false,
    },
    xAxis: {
      type: 'category',
      data: xValues,
      axisLine: { lineStyle: { color: 'rgba(170, 184, 203, 0.8)' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#536982',
        fontSize: 9,
      },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#536982',
        fontSize: 9,
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(204, 214, 228, 0.6)',
        },
      },
      ...(Array.isArray(viewState?.yDomain) ? { min: viewState.yDomain[0], max: viewState.yDomain[1] } : {}),
    },
    series: [...seriesMap.entries()].map(([series, seriesRows]) => ({
      name: series,
      type: 'line',
      smooth: false,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: {
        color: palette[series] || '#2d5f98',
        width: 2.2,
      },
      itemStyle: {
        color: palette[series] || '#2d5f98',
      },
      data: [...seriesRows]
        .sort((left, right) => Number(left.x) - Number(right.x))
        .map((row) => ({
          year: row.x,
          series: row.series,
          count: row.count,
          value: row.value,
          itemStyle: {
            opacity: selectedYear === 'All' || selectedYear === row.x ? 0.96 : 0.34,
          },
        })),
    })),
  }
}

export function buildHeatmapEChartsOptionFromRenderModel(renderModel, activeOrigin = {}, activeCylinders = {}) {
  const rows = Array.isArray(renderModel?.rows) ? renderModel.rows : []
  const selectedOrigin = typeof activeOrigin === 'string' ? activeOrigin : (activeOrigin?.analysisOrigin || 'All')
  const selectedCylinders = Array.isArray(activeCylinders)
    ? activeCylinders
    : Array.isArray(activeCylinders?.analysisCylinders)
      ? activeCylinders.analysisCylinders
      : []
  const xValues = [...new Set(rows.map((row) => row.x))].sort((a, b) => Number(a) - Number(b))
  const yValues = [...new Set(rows.map((row) => row.y))]
  const values = rows.map((row) => Number(row.value) || 0)
  const minValue = Math.min(...values, 0)
  const maxValue = Math.max(...values, 1)

  return {
    animation: false,
    backgroundColor: 'transparent',
    grid: {
      left: 42,
      right: 10,
      top: 10,
      bottom: 20,
      containLabel: true,
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(244, 248, 252, 0.96)',
      borderColor: 'rgba(184, 198, 215, 0.9)',
      borderWidth: 1,
      textStyle: {
        color: '#24384d',
        fontSize: 11,
      },
      formatter(params) {
        const datum = params?.data || []
        return [
          `<strong>${datum[3] ?? ''}</strong>`,
          `Origin: ${datum[4] ?? 'n/a'}`,
          `Cylinders: ${datum[3] ?? 'n/a'}`,
          `Avg horsepower: ${datum[2] ?? 'n/a'}`,
          `Cars: ${datum[5] ?? 'n/a'}`,
        ].join('<br/>')
      },
    },
    xAxis: {
      type: 'category',
      data: xValues,
      axisLine: { lineStyle: { color: 'rgba(170, 184, 203, 0.8)' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#536982',
        fontSize: 9,
      },
    },
    yAxis: {
      type: 'category',
      data: yValues,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#536982',
        fontSize: 9,
      },
    },
    visualMap: {
      min: minValue,
      max: maxValue,
      show: false,
      calculable: false,
      inRange: {
        color: ['#e5edf7', '#2d5f98'],
      },
    },
    series: [
      {
        type: 'heatmap',
        itemStyle: {
          borderRadius: 4,
          borderColor: 'rgba(248, 251, 255, 0.75)',
          borderWidth: 1,
        },
        data: rows.map((row) => ({
          value: [xValues.indexOf(row.x), yValues.indexOf(row.y), row.value, row.x, row.y, row.count],
          itemStyle: {
            opacity: (selectedOrigin === 'All' || selectedOrigin === row.y) && (selectedCylinders.length === 0 || selectedCylinders.includes(row.x))
              ? 0.96
              : 0.38,
          },
        })),
      },
    ],
  }
}

export function buildParallelCoordinatesSpec(renderModel) {
  const dimensions = Array.isArray(renderModel?.visibleDimensions) && renderModel.visibleDimensions.length > 0
    ? renderModel.visibleDimensions
    : ['horsepower', 'mpg', 'weight', 'acceleration']
  const highlightTest = buildPredicateTest(renderModel?.highlightPredicates || null)
  return {
    ...baseConfig(),
    width: 'container',
    height: 196,
    data: {
      values: (renderModel?.rows || []).map((row) => ({
        id: row.id,
        name: row.label,
        origin: row.category,
        ...row.dimensions,
      })),
    },
    transform: [
      {
        fold: dimensions,
        as: ['dimension', 'value'],
      },
    ],
    mark: { type: 'line', strokeWidth: 1.6 },
    encoding: {
      x: {
        field: 'dimension',
        type: 'nominal',
        sort: dimensions,
        scale: {
          domain: dimensions,
        },
        title: null,
      },
      y: {
        field: 'value',
        type: 'quantitative',
        title: null,
      },
      detail: {
        field: 'id',
        type: 'nominal',
      },
      color: {
        field: 'origin',
        type: 'nominal',
        scale: {
          domain: ['USA', 'Europe', 'Japan'],
          range: ['#2d5f98', '#7d95b3', '#7da685'],
        },
        legend: null,
      },
      opacity: renderModel?.focusedRowId
        ? {
            condition: { test: `datum.id === ${JSON.stringify(renderModel.focusedRowId)}`, value: 1 },
            value: 0.22,
          }
        : highlightTest
          ? {
              condition: { test: highlightTest, value: 0.92 },
              value: 0.24,
            }
          : {
              value: 0.56,
            },
      tooltip: [
        { field: 'name', type: 'nominal', title: 'Model' },
        { field: 'origin', type: 'nominal', title: 'Origin' },
      ],
    },
  }
}

export function buildParallelCoordinatesEChartsOption(renderModel) {
  const dimensions = Array.isArray(renderModel?.visibleDimensions) && renderModel.visibleDimensions.length > 0
    ? renderModel.visibleDimensions
    : ['horsepower', 'mpg', 'weight', 'acceleration']
  const rows = Array.isArray(renderModel?.rows) ? renderModel.rows : []
  const axisDefs = dimensions.map((dimension, index) => {
    const values = rows.map((row) => Number(row.dimensions?.[dimension])).filter((value) => Number.isFinite(value))
    return {
      dim: index,
      name: dimension,
      min: values.length > 0 ? Math.min(...values) : 0,
      max: values.length > 0 ? Math.max(...values) : 1,
      nameLocation: 'end',
      nameGap: 14,
      nameTextStyle: {
        color: '#536982',
        fontSize: 8,
        align: 'center',
      },
      axisLabel: {
        color: '#536982',
        fontSize: 8,
        margin: 6,
        formatter(value) {
          const numericValue = Number(value)
          if (!Number.isFinite(numericValue)) return value
          if (Math.abs(numericValue) >= 1000) return numericValue.toLocaleString()
          return `${Math.round(numericValue * 10) / 10}`
        },
      },
    }
  })

  return {
    animation: false,
    backgroundColor: 'transparent',
    parallel: {
      left: 24,
      right: 24,
      top: 24,
      bottom: 10,
      parallelAxisDefault: {
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(170, 184, 203, 0.8)' } },
        splitLine: { show: false },
        axisTick: { show: false },
        areaSelectStyle: {
          width: 10,
          opacity: 0.08,
        },
      },
    },
    parallelAxis: axisDefs,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(244, 248, 252, 0.96)',
      borderColor: 'rgba(184, 198, 215, 0.9)',
      borderWidth: 1,
      textStyle: {
        color: '#24384d',
        fontSize: 11,
      },
      formatter(params) {
        const datum = params?.data || {}
        return [
          `<strong>${datum.label || ''}</strong>`,
          `Origin: ${datum.category || ''}`,
          ...dimensions.map((dimension, index) => `${dimension}: ${datum.value?.[index] ?? 'n/a'}`),
        ].join('<br/>')
      },
    },
    series: [
      {
        type: 'parallel',
        smooth: false,
        lineStyle: {
          width: 1.5,
          opacity: 0.62,
        },
        emphasis: {
          lineStyle: {
            width: 2.4,
            opacity: 0.92,
          },
        },
        data: rows.map((row) => ({
          id: row.id,
          label: row.label,
          category: row.category,
          raw: row.raw,
          value: dimensions.map((dimension) => Number(row.dimensions?.[dimension])),
          lineStyle: {
            color: renderModel?.palette?.[row.category] || '#2d5f98',
            opacity: renderModel?.focusedRowId
              ? (renderModel.focusedRowId === row.id ? 0.96 : 0.18)
              : 0.62,
          },
        })),
      },
    ],
  }
}

export function buildSankeyVegaSpec(renderModel) {
  const nodes = Array.isArray(renderModel?.nodes) ? renderModel.nodes : []
  const links = Array.isArray(renderModel?.links) ? renderModel.links : []
  return {
    $schema: 'https://vega.github.io/schema/vega/v5.json',
    width: 440,
    height: 176,
    padding: 0,
    background: null,
    data: [
      {
        name: 'nodes',
        values: nodes,
      },
      {
        name: 'links',
        values: links
          .filter((link) => link.sourceNode && link.targetNode)
          .map((link) => ({
            ...link,
            path: `M ${link.sourceNode.x + link.sourceNode.width} ${link.sourceNode.y + (link.sourceNode.height / 2)} C ${link.sourceNode.x + link.sourceNode.width + 38} ${link.sourceNode.y + (link.sourceNode.height / 2)}, ${link.targetNode.x - 38} ${link.targetNode.y + (link.targetNode.height / 2)}, ${link.targetNode.x} ${link.targetNode.y + (link.targetNode.height / 2)}`,
          })),
      },
    ],
    marks: [
      {
        type: 'path',
        from: { data: 'links' },
        encode: {
          update: {
            path: { field: 'path' },
            stroke: { value: '#94aac2' },
            strokeOpacity: { value: 0.55 },
            strokeWidth: { signal: 'max(2, datum.count * 1.2)' },
            fill: { value: null },
          },
        },
      },
      {
        type: 'rect',
        from: { data: 'nodes' },
        encode: {
          enter: {
            x: { field: 'x' },
            y: { field: 'y' },
            width: { field: 'width' },
            height: { field: 'height' },
            cornerRadius: { value: 6 },
          },
          update: {
            fill: { field: 'color' },
            fillOpacity: { value: 0.86 },
            stroke: { value: '#f8fbff' },
            strokeWidth: { value: 0.9 },
          },
        },
      },
      {
        type: 'text',
        from: { data: 'nodes' },
        encode: {
          update: {
            x: { signal: 'datum.x + 8' },
            y: { signal: 'datum.y + 14' },
            text: { field: 'label' },
            fontSize: { value: 10 },
            fill: { value: '#24384d' },
          },
        },
      },
    ],
  }
}

export function buildSankeyEChartsOption(renderModel) {
  const nodes = Array.isArray(renderModel?.nodes) ? renderModel.nodes : []
  const links = Array.isArray(renderModel?.links) ? renderModel.links : []
  return {
    animation: false,
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(244, 248, 252, 0.96)',
      borderColor: 'rgba(184, 198, 215, 0.9)',
      borderWidth: 1,
      textStyle: {
        color: '#24384d',
        fontSize: 11,
      },
    },
    series: [
      {
        type: 'sankey',
        left: 20,
        top: 18,
        right: 18,
        bottom: 18,
        nodeWidth: 16,
        nodeGap: 14,
        draggable: false,
        emphasis: {
          focus: 'adjacency',
        },
        lineStyle: {
          color: 'source',
          opacity: 0.45,
          curveness: 0.5,
        },
        label: {
          color: '#24384d',
          fontSize: 10,
        },
        data: nodes.map((node) => ({
          ...node,
          name: node.id,
          itemStyle: {
            color: node.color,
          },
        })),
        links: links.map((link) => ({
          source: link.source,
          target: link.target,
          value: link.count,
        })),
      },
    ],
  }
}

export function buildLineSpec(rows, activeYear) {
  const highlightTest = buildPredicateTest(activeYear?.highlightPredicates || activeYear?.predicates || null)
  const selectedYear = Number.isFinite(activeYear) ? activeYear : (activeYear?.analysisYear || 'All')
  const overlay = activeYear?.analyticalOverlay
  if (overlay?.kind === 'lineDrillDownRecords') {
    return {
      ...baseConfig(),
      width: 'container',
      height: 196,
      data: { values: rows },
      mark: { type: 'line', point: { filled: true, size: 34 }, strokeWidth: 2 },
      encoding: {
        x: { field: overlay.xField || 'name', type: 'nominal', title: 'Model', sort: null },
        y: { field: overlay.yField || 'mpg', type: 'quantitative', title: 'MPG' },
        color: {
          field: 'origin',
          type: 'nominal',
          scale: {
            domain: ['USA', 'Europe', 'Japan'],
            range: ['#2d5f98', '#7d95b3', '#7da685'],
          },
          legend: null,
        },
        opacity: highlightTest
          ? {
              condition: { test: highlightTest, value: 1 },
              value: 0.28,
            }
          : undefined,
        tooltip: [
          { field: 'name', type: 'nominal', title: 'Model' },
          { field: 'origin', type: 'nominal', title: 'Origin' },
          { field: 'year', type: 'ordinal', title: 'Year' },
          { field: overlay.yField || 'mpg', type: 'quantitative', title: 'MPG' },
        ],
      },
      _line_drilldown_state: {
        variant: 'recordsByModel',
      },
    }
  }
  const baseSpec = {
    ...baseConfig(),
    width: 'container',
    height: 196,
    data: { values: rows },
    mark: { type: 'line', point: { filled: true, size: 38 }, strokeWidth: 2.2 },
    encoding: {
      x: { field: 'year', type: 'ordinal', title: 'Model year' },
      y: { field: 'avgMpg', type: 'quantitative', title: 'Avg MPG' },
      color: {
        condition: selectedYear && selectedYear !== 'All'
          ? {
              test: `datum.year === ${selectedYear}`,
              field: 'origin',
              type: 'nominal',
              scale: {
                domain: ['USA', 'Europe', 'Japan'],
                range: ['#2d5f98', '#7d95b3', '#7da685'],
              },
            }
          : undefined,
        field: 'origin',
        type: 'nominal',
        scale: {
          domain: ['USA', 'Europe', 'Japan'],
          range: ['#2d5f98', '#7d95b3', '#7da685'],
        },
        legend: null,
      },
      opacity: highlightTest
        ? {
            condition: { test: highlightTest, value: 1 },
            value: 0.28,
          }
        : undefined,
      tooltip: [
        { field: 'year', type: 'ordinal', title: 'Year' },
        { field: 'origin', type: 'nominal', title: 'Origin' },
        { field: 'avgMpg', type: 'quantitative', title: 'Avg MPG' },
        { field: 'count', type: 'quantitative', title: 'Cars' },
      ],
    },
  }
  if (Array.isArray(activeYear?.yDomain)) {
    baseSpec.encoding.y = {
      ...baseSpec.encoding.y,
      scale: { domain: activeYear.yDomain },
    }
  }
  if (overlay?.kind === 'lineMovingAverage') {
    return withLineMovingAverageOverlay(baseSpec, overlay.windowSize || 3)
  }
  if (overlay?.kind === 'lineTrendHighlight') {
    return withLineTrendHighlight(baseSpec)
  }
  return baseSpec
}

export function buildHeatmapSpec(rows, activeOrigin, activeCylinders) {
  const highlightPredicates = Array.isArray(activeOrigin?.highlightPredicates)
    ? activeOrigin.highlightPredicates
    : Array.isArray(activeCylinders?.highlightPredicates)
      ? activeCylinders.highlightPredicates
      : null
  const highlightTest = buildPredicateTest(highlightPredicates)
  const selectedOrigin = typeof activeOrigin === 'string' ? activeOrigin : (activeOrigin?.analysisOrigin || 'All')
  const selectedCylinders = Array.isArray(activeCylinders)
    ? activeCylinders
    : Array.isArray(activeCylinders?.analysisCylinders)
      ? activeCylinders.analysisCylinders
      : []
  const cylinderTest = selectedCylinders?.length ? selectedCylinders.join(' || datum.cylinders === ') : null
  const baseSpec = {
    ...baseConfig(),
    width: 'container',
    height: 196,
    data: { values: rows },
    mark: { type: 'rect', cornerRadius: 4 },
    encoding: {
      x: { field: 'cylinders', type: 'ordinal', title: 'Cylinders' },
      y: { field: 'origin', type: 'nominal', title: null },
      color: {
        field: 'avgHorsepower',
        type: 'quantitative',
        scale: { range: ['#e5edf7', '#2d5f98'] },
        legend: null,
      },
      opacity: {
        condition: selectedOrigin !== 'All' || selectedCylinders?.length
          ? {
              test: `${selectedOrigin !== 'All' ? `datum.origin === '${selectedOrigin}'` : 'true'}${cylinderTest ? ` && (datum.cylinders === ${cylinderTest})` : ''}`,
              value: 1,
            }
          : highlightTest
            ? {
                test: highlightTest,
                value: 1,
              }
          : undefined,
        value: 0.42,
      },
      tooltip: [
        { field: 'origin', type: 'nominal', title: 'Origin' },
        { field: 'cylinders', type: 'ordinal', title: 'Cylinders' },
        { field: 'avgHorsepower', type: 'quantitative', title: 'Avg horsepower' },
        { field: 'count', type: 'quantitative', title: 'Cars' },
      ],
    },
  }
  const overlay = activeOrigin?.analyticalOverlay || activeCylinders?.analyticalOverlay
  if (overlay?.kind === 'heatmapHighlightRegion') {
    return withHeatmapRegionHighlight(baseSpec, overlay)
  }
  if (overlay?.kind === 'heatmapHighlightByValue') {
    return withHeatmapValueHighlight(baseSpec, overlay)
  }
  if (overlay?.kind === 'heatmapCluster') {
    return withHeatmapClusterSort(baseSpec, overlay)
  }
  if (overlay?.kind === 'heatmapTranspose') {
    return withHeatmapTranspose(baseSpec, overlay)
  }
  return baseSpec
}
