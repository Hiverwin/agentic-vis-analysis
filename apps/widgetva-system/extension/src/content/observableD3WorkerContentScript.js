import {
  readObservableD3BarRows,
  describeObservableD3Surface,
  findObservableD3PlotRegion,
  findObservableD3BarMarks,
  findObservableD3LinePaths,
  findObservableD3PointMarks,
  findPrimaryObservableD3Surface,
  readObservableD3LineRows,
  readObservableD3LineSeriesLabels,
  readObservableD3LineXAxisLabels,
  readObservableD3ScatterRows,
  summarizeObservableD3ScatterRows,
} from 'widgetva-kit/page-integrations'

const REQUEST_TYPE = 'widgetva:observable-d3-worker-request'
const RESPONSE_TYPE = 'widgetva:observable-d3-worker-response'
const SOURCE_TOP = 'widgetva-observable-d3-top'
const SOURCE_WORKER = 'widgetva-observable-d3-worker'
const WIDGETVA_BRUSH_OVERLAY_ATTR = 'data-widgetva-brush-overlay'
const WIDGETVA_SURFACE_PROBE_ATTR = 'data-widgetva-surface-probe'
const WIDGETVA_VIEWBOX_CACHE_ATTR = 'data-widgetva-original-viewbox'
const WIDGETVA_LINE_SLICE_ATTR = 'data-widgetva-line-slice-overlay'
const WIDGETVA_LINE_TREND_ATTR = 'data-widgetva-line-trend-overlay'
const WIDGETVA_LINE_MA_ATTR = 'data-widgetva-line-ma-overlay'
const WIDGETVA_LINE_DRILLDOWN_ATTR = 'data-widgetva-line-drilldown-overlay'
const WIDGETVA_SCATTER_REGRESSION_ATTR = 'data-widgetva-scatter-regression-overlay'
const originalMarkState = new WeakMap()
let currentViewport = null
let currentLineViewport = null

function readSurfaceAndMarks() {
  const surface = findPrimaryObservableD3Surface(window)
  const marks = findObservableD3PointMarks(window)
  return { surface, marks }
}

function readSurfaceAndBarMarks() {
  const surface = findPrimaryObservableD3Surface(window)
  const marks = findObservableD3BarMarks(window)
  return { surface, marks }
}

function readSurfaceAndLinePaths() {
  const surface = findPrimaryObservableD3Surface(window)
  const paths = findObservableD3LinePaths(window)
  return { surface, paths }
}

function readNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function readRectLike(node) {
  try {
    if (typeof node?.getBoundingClientRect === 'function') {
      const rect = node.getBoundingClientRect()
      return {
        left: readNumber(rect?.left) || 0,
        top: readNumber(rect?.top) || 0,
        width: readNumber(rect?.width) || 0,
        height: readNumber(rect?.height) || 0,
      }
    }
  } catch {}
  return { left: 0, top: 0, width: 0, height: 0 }
}

function removeBrushOverlay(surface) {
  surface?.querySelector?.(`[${WIDGETVA_BRUSH_OVERLAY_ATTR}="true"]`)?.remove?.()
}

function removeSurfaceProbe(surface) {
  const doc = surface?.ownerDocument || window.document
  doc?.querySelector?.(`[${WIDGETVA_SURFACE_PROBE_ATTR}="true"]`)?.remove?.()
}

function removeLineSliceOverlay(surface) {
  surface?.ownerDocument?.querySelector?.(`[${WIDGETVA_LINE_SLICE_ATTR}="true"]`)?.remove?.()
}

function removeLineTrendOverlay(surface) {
  surface?.querySelector?.(`[${WIDGETVA_LINE_TREND_ATTR}="true"]`)?.remove?.()
}

function removeLineMovingAverageOverlay(surface) {
  surface?.querySelector?.(`[${WIDGETVA_LINE_MA_ATTR}="true"]`)?.remove?.()
}

function removeLineDrilldownOverlay(surface) {
  surface?.ownerDocument?.querySelector?.(`[${WIDGETVA_LINE_DRILLDOWN_ATTR}="true"]`)?.remove?.()
}

function removeScatterRegressionOverlay(surface) {
  surface?.querySelector?.(`[${WIDGETVA_SCATTER_REGRESSION_ATTR}="true"]`)?.remove?.()
}

function renderSurfaceProbe(surface, plotRegion = null) {
  const targetRect = plotRegion?.screenRect || readRectLike(surface)
  if (!targetRect || targetRect.width <= 0 || targetRect.height <= 0) {
    return {
      ok: false,
      reason: 'Unable to resolve a visible Observable D3 plot region.',
    }
  }

  const doc = surface?.ownerDocument || window.document
  const existing = doc?.querySelector?.(`[${WIDGETVA_SURFACE_PROBE_ATTR}="true"]`)
  if (existing) {
    existing.remove?.()
  }

  const host = doc?.body || doc?.documentElement
  const overlay = doc?.createElement?.('div')
  const label = doc?.createElement?.('div')
  if (!host || !overlay || !label) {
    return {
      ok: false,
      reason: 'Unable to create probe overlay nodes.',
    }
  }

  overlay.setAttribute(WIDGETVA_SURFACE_PROBE_ATTR, 'true')
  overlay.style.position = 'fixed'
  overlay.style.left = `${targetRect.left}px`
  overlay.style.top = `${targetRect.top}px`
  overlay.style.width = `${targetRect.width}px`
  overlay.style.height = `${targetRect.height}px`
  overlay.style.border = '6px dashed #ef4444'
  overlay.style.boxSizing = 'border-box'
  overlay.style.pointerEvents = 'none'
  overlay.style.zIndex = '2147483647'

  label.style.position = 'absolute'
  label.style.left = '12px'
  label.style.top = '12px'
  label.style.padding = '8px 16px'
  label.style.borderRadius = '6px'
  label.style.background = '#ef4444'
  label.style.color = '#ffffff'
  label.style.fontSize = '20px'
  label.style.fontWeight = '700'
  label.style.lineHeight = '1'
  label.textContent = 'WidgetVA Probe'

  overlay.appendChild(label)
  host.appendChild(overlay)

  return {
    ok: true,
    surfaceRect: readRectLike(surface),
    plotRegion,
  }
}

function renderBrushOverlay(surface, selection) {
  if (!surface || typeof surface?.tagName !== 'string' || surface.tagName.toLowerCase() !== 'svg') {
    return
  }

  const xDomain = Array.isArray(selection?.domain?.xDomain) ? selection.domain.xDomain : null
  const yDomain = Array.isArray(selection?.domain?.yDomain) ? selection.domain.yDomain : null
  if (!xDomain || !yDomain) {
    removeBrushOverlay(surface)
    return
  }

  const rect = readRectLike(surface)
  const x = Math.min(xDomain[0], xDomain[1]) - rect.left
  const y = Math.min(yDomain[0], yDomain[1]) - rect.top
  const width = Math.abs(xDomain[1] - xDomain[0])
  const height = Math.abs(yDomain[1] - yDomain[0])

  const doc = surface.ownerDocument || window.document
  const overlay = surface.querySelector?.(`[${WIDGETVA_BRUSH_OVERLAY_ATTR}="true"]`)
    || doc?.createElementNS?.('http://www.w3.org/2000/svg', 'rect')

  if (!overlay) {
    return
  }

  overlay.setAttribute(WIDGETVA_BRUSH_OVERLAY_ATTR, 'true')
  overlay.setAttribute('x', String(x))
  overlay.setAttribute('y', String(y))
  overlay.setAttribute('width', String(width))
  overlay.setAttribute('height', String(height))
  overlay.setAttribute('fill', 'rgba(250, 204, 21, 0.18)')
  overlay.setAttribute('stroke', '#dc2626')
  overlay.setAttribute('stroke-width', '2')
  overlay.setAttribute('stroke-dasharray', '6 4')
  overlay.setAttribute('pointer-events', 'none')

  if (!overlay.parentNode) {
    surface.appendChild(overlay)
  }
}

function clearMarkFeedback(mark) {
  const original = originalMarkState.get(mark) || {}

  if (original.opacity == null) mark.removeAttribute?.('opacity')
  else mark.setAttribute?.('opacity', original.opacity)

  if (original.stroke == null) mark.removeAttribute?.('stroke')
  else mark.setAttribute?.('stroke', original.stroke)

  if (original.strokeWidth == null) mark.removeAttribute?.('stroke-width')
  else mark.setAttribute?.('stroke-width', original.strokeWidth)

  if (original.fill == null) mark.removeAttribute?.('fill')
  else mark.setAttribute?.('fill', original.fill)

  if (original.fillOpacity == null) mark.removeAttribute?.('fill-opacity')
  else mark.setAttribute?.('fill-opacity', original.fillOpacity)

  if (original.radius == null) mark.removeAttribute?.('r')
  else mark.setAttribute?.('r', original.radius)

  mark.style.opacity = original.styleOpacity || ''
  mark.style.stroke = original.styleStroke || ''
  mark.style.strokeWidth = original.styleStrokeWidth || ''
  mark.style.fillOpacity = original.styleFillOpacity || ''
  mark.style.fill = original.styleFill || ''
  mark.style.filter = original.styleFilter || ''
}

function applyMarkFeedback(mark, selected) {
  if (!originalMarkState.has(mark)) {
    originalMarkState.set(mark, {
      opacity: mark.getAttribute?.('opacity') ?? null,
      stroke: mark.getAttribute?.('stroke') ?? null,
      strokeWidth: mark.getAttribute?.('stroke-width') ?? null,
      fill: mark.getAttribute?.('fill') ?? null,
      fillOpacity: mark.getAttribute?.('fill-opacity') ?? null,
      radius: mark.getAttribute?.('r') ?? null,
      styleOpacity: mark.style.opacity || '',
      styleStroke: mark.style.stroke || '',
      styleStrokeWidth: mark.style.strokeWidth || '',
      styleFillOpacity: mark.style.fillOpacity || '',
      styleFill: mark.style.fill || '',
      styleFilter: mark.style.filter || '',
    })
  }

  mark.setAttribute?.('opacity', selected ? '1' : '0.04')
  mark.setAttribute?.('fill-opacity', selected ? '1' : '0.18')
  mark.setAttribute?.('fill', selected ? '#dc2626' : '#94a3b8')
  mark.setAttribute?.('stroke', selected ? '#111827' : '#cbd5e1')
  mark.setAttribute?.('stroke-width', selected ? '2.5' : '0.5')

  if (typeof mark.tagName === 'string' && mark.tagName.toLowerCase() === 'circle') {
    const original = originalMarkState.get(mark)
    const baseRadius = Number(original?.radius)
    if (Number.isFinite(baseRadius) && baseRadius > 0) {
      mark.setAttribute?.('r', selected ? String(baseRadius + 2) : String(Math.max(baseRadius - 0.5, 1)))
    }
  }

  mark.style.opacity = selected ? '1' : '0.04'
  mark.style.fillOpacity = selected ? '1' : '0.18'
  mark.style.fill = selected ? '#dc2626' : '#94a3b8'
  mark.style.stroke = selected ? '#111827' : '#cbd5e1'
  mark.style.strokeWidth = selected ? '2.5px' : '0.5px'
  mark.style.filter = selected ? 'drop-shadow(0 0 8px rgba(220, 38, 38, 0.75))' : ''
}

function applyLinePathFocusFeedback(path, focused, dimOpacity = 0.08) {
  if (!originalMarkState.has(path)) {
    originalMarkState.set(path, {
      opacity: path.getAttribute?.('opacity') ?? null,
      stroke: path.getAttribute?.('stroke') ?? null,
      strokeWidth: path.getAttribute?.('stroke-width') ?? null,
      fill: path.getAttribute?.('fill') ?? null,
      fillOpacity: path.getAttribute?.('fill-opacity') ?? null,
      radius: path.getAttribute?.('r') ?? null,
      styleOpacity: path.style.opacity || '',
      styleStroke: path.style.stroke || '',
      styleStrokeWidth: path.style.strokeWidth || '',
      styleFillOpacity: path.style.fillOpacity || '',
      styleFill: path.style.fill || '',
      styleFilter: path.style.filter || '',
    })
  }

  if (focused) {
    path.setAttribute?.('opacity', '1')
    path.setAttribute?.('stroke-width', '3')
    path.style.opacity = '1'
    path.style.strokeWidth = '3px'
    path.style.filter = 'drop-shadow(0 0 6px rgba(220, 38, 38, 0.45))'
    return
  }

  path.setAttribute?.('opacity', String(dimOpacity))
  path.setAttribute?.('stroke-width', '1')
  path.style.opacity = String(dimOpacity)
  path.style.strokeWidth = '1px'
  path.style.filter = ''
}

function computeLinearRegression(points = []) {
  const safePoints = points.filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))
  if (safePoints.length < 2) return null
  const count = safePoints.length
  const sumX = safePoints.reduce((sum, point) => sum + point.x, 0)
  const sumY = safePoints.reduce((sum, point) => sum + point.y, 0)
  const sumXY = safePoints.reduce((sum, point) => sum + (point.x * point.y), 0)
  const sumXX = safePoints.reduce((sum, point) => sum + (point.x * point.x), 0)
  const denominator = (count * sumXX) - (sumX * sumX)
  if (denominator === 0) return null
  const slope = ((count * sumXY) - (sumX * sumY)) / denominator
  const intercept = (sumY - (slope * sumX)) / count
  return { slope, intercept }
}

function createSvgLineNode(surface) {
  return surface?.ownerDocument?.createElementNS?.('http://www.w3.org/2000/svg', 'line') || null
}

function createSvgGroupNode(surface) {
  return surface?.ownerDocument?.createElementNS?.('http://www.w3.org/2000/svg', 'g') || null
}

function renderScatterRegressionOverlay(surface, points = []) {
  removeScatterRegressionOverlay(surface)
  if (!surface || typeof surface?.tagName !== 'string' || surface.tagName.toLowerCase() !== 'svg') return { applied: false }
  const regression = computeLinearRegression(points)
  if (!regression) return { applied: false }

  const xs = points.map((point) => point.x)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMin = (regression.slope * xMin) + regression.intercept
  const yMax = (regression.slope * xMax) + regression.intercept
  const line = createSvgLineNode(surface)
  if (!line) return { applied: false }
  line.setAttribute(WIDGETVA_SCATTER_REGRESSION_ATTR, 'true')
  line.setAttribute('x1', String(xMin))
  line.setAttribute('y1', String(yMin))
  line.setAttribute('x2', String(xMax))
  line.setAttribute('y2', String(yMax))
  line.setAttribute('stroke', '#dc2626')
  line.setAttribute('stroke-width', '2.5')
  line.setAttribute('stroke-dasharray', '8 5')
  line.setAttribute('pointer-events', 'none')
  surface.appendChild(line)
  return {
    applied: true,
    line: { x1: xMin, y1: yMin, x2: xMax, y2: yMax },
  }
}

function renderLineTrendOverlay(surface, trend = null) {
  removeLineTrendOverlay(surface)
  if (!surface || typeof surface?.tagName !== 'string' || surface.tagName.toLowerCase() !== 'svg' || !trend) return { applied: false }
  const plotRegion = findObservableD3PlotRegion(window)
  const localRect = plotRegion?.localRect
  if (!localRect) return { applied: false }

  const line = createSvgLineNode(surface)
  if (!line) return { applied: false }
  const trendType = typeof trend?.trendType === 'string' ? trend.trendType.toLowerCase() : 'regression'
  const rising = trendType !== 'decreasing'
  const x1 = localRect.left
  const x2 = localRect.left + localRect.width
  const y1 = rising ? (localRect.top + localRect.height) : localRect.top
  const y2 = rising ? localRect.top : (localRect.top + localRect.height)
  line.setAttribute(WIDGETVA_LINE_TREND_ATTR, 'true')
  line.setAttribute('x1', String(x1))
  line.setAttribute('y1', String(y1))
  line.setAttribute('x2', String(x2))
  line.setAttribute('y2', String(y2))
  line.setAttribute('stroke', '#dc2626')
  line.setAttribute('stroke-width', '2.5')
  line.setAttribute('stroke-dasharray', '8 5')
  line.setAttribute('pointer-events', 'none')
  surface.appendChild(line)
  return {
    applied: true,
    trendType,
  }
}

function renderLineMovingAverageOverlay(surface, paths = []) {
  removeLineMovingAverageOverlay(surface)
  if (!surface || typeof surface?.tagName !== 'string' || surface.tagName.toLowerCase() !== 'svg' || paths.length === 0) return { applied: false }
  const overlayGroup = createSvgGroupNode(surface)
  if (!overlayGroup) return { applied: false }
  overlayGroup.setAttribute(WIDGETVA_LINE_MA_ATTR, 'true')
  overlayGroup.setAttribute('pointer-events', 'none')

  paths.forEach((path) => {
    const clone = path.cloneNode?.(true)
    if (!clone) return
    clone.removeAttribute?.('data-testid')
    clone.setAttribute('stroke', '#f59e0b')
    clone.setAttribute('stroke-width', '3')
    clone.setAttribute('opacity', '0.85')
    clone.setAttribute('fill', 'none')
    clone.style.stroke = '#f59e0b'
    clone.style.strokeWidth = '3px'
    clone.style.opacity = '0.85'
    clone.style.filter = 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.35))'
    overlayGroup.appendChild(clone)
  })

  surface.appendChild(overlayGroup)
  return {
    applied: true,
    overlayCount: paths.length,
  }
}

function inferDrilldownValues(drilldown = null, axisLabels = []) {
  if (!drilldown || !Array.isArray(axisLabels) || axisLabels.length === 0) return []
  const level = typeof drilldown.level === 'string' ? drilldown.level.toLowerCase() : ''
  const value = Number.isFinite(drilldown.value) ? Number(drilldown.value) : null
  const yearValue = Number.isFinite(drilldown?.parent?.year) ? Number(drilldown.parent.year) : null
  if (level === 'year' && value != null) {
    return axisLabels.filter((label) => String(label).includes(String(value)))
  }
  if (level === 'month' && value != null) {
    const monthToken = String(value).padStart(2, '0')
    return axisLabels.filter((label) => {
      const text = String(label)
      return (yearValue == null || text.includes(String(yearValue))) && (text.includes(`-${monthToken}`) || text.includes(`/${monthToken}`))
    })
  }
  return []
}

function renderLineDrilldownOverlay(surface, drilldown = null) {
  removeLineDrilldownOverlay(surface)
  if (!surface || !drilldown) return { applied: false }

  const values = inferDrilldownValues(drilldown, readObservableD3LineXAxisLabels(window))
  if (values.length > 0) {
    renderLineSliceOverlay(surface, values)
  }

  const plotRegion = findObservableD3PlotRegion(window)
  const targetRect = plotRegion?.screenRect || readRectLike(surface)
  const doc = surface.ownerDocument || window.document
  const host = doc?.body || doc?.documentElement
  const overlay = doc?.createElement?.('div')
  if (!host || !overlay) return { applied: false }
  overlay.setAttribute(WIDGETVA_LINE_DRILLDOWN_ATTR, 'true')
  overlay.style.position = 'fixed'
  overlay.style.left = `${targetRect.left + 12}px`
  overlay.style.top = `${targetRect.top + 12}px`
  overlay.style.padding = '8px 12px'
  overlay.style.borderRadius = '999px'
  overlay.style.background = 'rgba(17, 24, 39, 0.92)'
  overlay.style.color = '#ffffff'
  overlay.style.fontSize = '12px'
  overlay.style.fontWeight = '600'
  overlay.style.letterSpacing = '0.02em'
  overlay.style.pointerEvents = 'none'
  overlay.style.zIndex = '2147483646'
  const levelLabel = typeof drilldown.level === 'string' ? drilldown.level : 'drilldown'
  const valueLabel = Number.isFinite(drilldown.value) ? ` ${drilldown.value}` : ''
  overlay.textContent = `WidgetVA drilldown: ${levelLabel}${valueLabel}`
  host.appendChild(overlay)
  return {
    applied: true,
    highlightedValues: values,
  }
}

function runKMeans(points, clusterCount) {
  const normalized = points.filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))
  const safeClusterCount = Math.max(1, Math.min(clusterCount, normalized.length))
  if (normalized.length === 0) return { labels: [], centers: [] }
  let centers = normalized.slice(0, safeClusterCount).map((point) => ({ x: point.x, y: point.y }))
  let labels = normalized.map(() => 0)

  for (let iteration = 0; iteration < 12; iteration += 1) {
    labels = normalized.map((point) => {
      let bestIndex = 0
      let bestDistance = Number.POSITIVE_INFINITY
      centers.forEach((center, index) => {
        const dx = point.x - center.x
        const dy = point.y - center.y
        const distance = (dx * dx) + (dy * dy)
        if (distance < bestDistance) {
          bestDistance = distance
          bestIndex = index
        }
      })
      return bestIndex
    })

    centers = centers.map((center, clusterIndex) => {
      const clusterPoints = normalized.filter((_, pointIndex) => labels[pointIndex] === clusterIndex)
      if (clusterPoints.length === 0) return center
      const sum = clusterPoints.reduce((acc, point) => ({
        x: acc.x + point.x,
        y: acc.y + point.y,
      }), { x: 0, y: 0 })
      return {
        x: sum.x / clusterPoints.length,
        y: sum.y / clusterPoints.length,
      }
    })
  }

  return { labels, centers }
}

function pointInsideInterval(point, selection) {
  const xDomain = Array.isArray(selection?.domain?.xDomain) ? selection.domain.xDomain : null
  const yDomain = Array.isArray(selection?.domain?.yDomain) ? selection.domain.yDomain : null
  if (!xDomain || !yDomain) return true
  return (
    point.__screenX >= xDomain[0]
    && point.__screenX <= xDomain[1]
    && point.__screenY >= yDomain[0]
    && point.__screenY <= yDomain[1]
  )
}

function applyScatterSelection(selection = null) {
  const { surface, marks } = readSurfaceAndMarks()
  const rows = readObservableD3ScatterRows(window)
  if (!selection) {
    removeBrushOverlay(surface)
  } else {
    renderBrushOverlay(surface, selection)
  }
  let selectedCount = 0
  marks.forEach((circle, index) => {
    const row = rows[index] || null
    const selected = row && pointInsideInterval(row, selection)
    if (!selection) {
      clearMarkFeedback(circle)
      return
    }
    if (selected) selectedCount += 1
    applyMarkFeedback(circle, selected)
  })

  return {
    selectedCount,
    totalCount: rows.length,
  }
}

function applyBarSelection(selection = null) {
  const { marks } = readSurfaceAndBarMarks()
  const rows = readObservableD3BarRows(window)
  const values = Array.isArray(selection?.values) ? selection.values : []
  const selectedSet = new Set(values)
  let selectedCount = 0

  marks.forEach((mark, index) => {
    const row = rows[index] || null
    if (!selection) {
      clearMarkFeedback(mark)
      mark.style.display = ''
      return
    }
    const selected = !!row && selectedSet.has(row.category)
    if (selected) selectedCount += 1
    applyMarkFeedback(mark, selected)
    mark.style.display = ''
  })

  return {
    selectedCount,
    totalCount: rows.length,
  }
}

function applyBarFilter(filter = null) {
  const { marks } = readSurfaceAndBarMarks()
  const rows = readObservableD3BarRows(window)
  const values = Array.isArray(filter?.categories) ? filter.categories : []
  const visibleSet = new Set(values)
  let visibleCount = 0

  marks.forEach((mark, index) => {
    const row = rows[index] || null
    if (!filter) {
      mark.style.display = ''
      clearMarkFeedback(mark)
      return
    }
    const visible = !!row && visibleSet.has(row.category)
    if (visible) visibleCount += 1
    mark.style.display = visible ? '' : 'none'
    if (visible) {
      clearMarkFeedback(mark)
    }
  })

  return {
    visibleCount,
    totalCount: rows.length,
  }
}

function applyBarSort(sort = null) {
  const { surface, marks } = readSurfaceAndBarMarks()
  const rows = readObservableD3BarRows(window)
  const values = Array.isArray(sort?.values) ? sort.values : []
  if (!surface || !Array.isArray(values) || values.length === 0) {
    return {
      applied: false,
      order: [],
    }
  }

  const rank = new Map(values.map((value, index) => [String(value), index]))
  const markRows = marks
    .map((mark, index) => ({ mark, row: rows[index] || null }))
    .filter((entry) => entry.row)

  markRows.sort((left, right) => {
    const leftRank = rank.get(String(left.row.category))
    const rightRank = rank.get(String(right.row.category))
    if (leftRank == null && rightRank == null) return 0
    if (leftRank == null) return 1
    if (rightRank == null) return -1
    return leftRank - rightRank
  })

  markRows.forEach(({ mark }) => {
    mark.parentNode?.appendChild?.(mark)
  })

  return {
    applied: true,
    order: values,
  }
}

function readLineTextNodes(surface) {
  return [...surface?.querySelectorAll?.('text') || []]
    .map((node) => {
      const text = typeof node?.textContent === 'string' ? node.textContent.trim() : ''
      if (!text) return null
      return {
        node,
        text,
        rect: readRectLike(node),
      }
    })
    .filter(Boolean)
}

function readLineSeriesLabelEntries(surface) {
  const labels = new Set(readObservableD3LineSeriesLabels(window))
  return readLineTextNodes(surface).filter((entry) => labels.has(entry.text))
}

function readLineXAxisLabelEntries(surface) {
  const labels = new Set(readObservableD3LineXAxisLabels(window))
  return readLineTextNodes(surface).filter((entry) => labels.has(entry.text))
}

function parseComparableAxisValue(value) {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = String(value).trim()
  if (!text) return null
  const asNumber = Number(text)
  if (Number.isFinite(asNumber)) return asNumber
  const asDate = Date.parse(text)
  if (Number.isFinite(asDate)) return asDate
  return text
}

function compareComparableAxisValue(left, right) {
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right))
}

function mapLinePathsToSeries(surface, paths) {
  const seriesLabels = readLineSeriesLabelEntries(surface)
  if (seriesLabels.length === 0) return paths.map((path) => ({ path, series: null }))
  return paths.map((path) => {
    const rect = readRectLike(path)
    const centerY = rect.top + (rect.height / 2)
    const bestLabel = seriesLabels
      .map((entry) => ({
        text: entry.text,
        distance: Math.abs((entry.rect.top + (entry.rect.height / 2)) - centerY),
      }))
      .sort((left, right) => left.distance - right.distance)[0]
    return {
      path,
      series: bestLabel?.text || null,
    }
  })
}

function renderLineSliceOverlay(surface, values = []) {
  removeLineSliceOverlay(surface)
  const requested = new Set(Array.isArray(values) ? values : [])
  if (!surface || requested.size === 0) return

  const plotRegion = findObservableD3PlotRegion(window)
  const xLabels = readLineXAxisLabelEntries(surface).filter((entry) => requested.has(entry.text))
  if (xLabels.length === 0) return

  const doc = surface.ownerDocument || window.document
  const host = doc?.body || doc?.documentElement
  const overlay = doc?.createElement?.('div')
  if (!host || !overlay) return
  overlay.setAttribute(WIDGETVA_LINE_SLICE_ATTR, 'true')
  overlay.style.position = 'fixed'
  overlay.style.pointerEvents = 'none'
  overlay.style.zIndex = '2147483646'

  xLabels.forEach((entry) => {
    const bar = doc.createElement('div')
    const centerX = entry.rect.left + (entry.rect.width / 2)
    bar.style.position = 'absolute'
    bar.style.left = `${centerX - 2}px`
    bar.style.top = `${plotRegion?.screenRect?.top || entry.rect.top}px`
    bar.style.width = '4px'
    bar.style.height = `${plotRegion?.screenRect?.height || 160}px`
    bar.style.background = 'rgba(220, 38, 38, 0.65)'
    bar.style.boxShadow = '0 0 8px rgba(220, 38, 38, 0.5)'
    overlay.appendChild(bar)
  })

  host.appendChild(overlay)
}

function applyLineSelection(selection = null) {
  const { surface, paths } = readSurfaceAndLinePaths()
  const rows = readObservableD3LineRows(window)
  removeLineSliceOverlay(surface)

  if (!selection) {
    mapLinePathsToSeries(surface, paths).forEach(({ path }) => clearMarkFeedback(path))
    return {
      selectedCount: 0,
      totalCount: rows.length,
    }
  }

  const field = typeof selection?.field === 'string' ? selection.field : null
  const values = Array.isArray(selection?.values) ? selection.values : []
  const selectedSet = new Set(values)
  const matchedRows = rows.filter((row) => field && selectedSet.has(row?.[field]))

  if (field === 'series') {
    mapLinePathsToSeries(surface, paths).forEach(({ path, series }) => {
      applyMarkFeedback(path, series != null && selectedSet.has(series))
    })
  } else if (field === 'xValue') {
    renderLineSliceOverlay(surface, values)
  }

  return {
    selectedCount: matchedRows.length,
    totalCount: rows.length,
  }
}

function applyLineFocus(focus = null) {
  const { surface, paths } = readSurfaceAndLinePaths()
  const mappings = mapLinePathsToSeries(surface, paths)
  if (!focus) {
    mappings.forEach(({ path }) => clearMarkFeedback(path))
    return {
      focusedCount: 0,
      totalCount: mappings.length,
    }
  }

  const lines = Array.isArray(focus?.lines) ? focus.lines : []
  const dimOpacity = Number.isFinite(focus?.dimOpacity) ? Number(focus.dimOpacity) : 0.08
  const lineSet = new Set(lines)
  let focusedCount = 0
  mappings.forEach(({ path, series }) => {
    const focused = series != null && lineSet.has(series)
    if (focused) focusedCount += 1
    applyLinePathFocusFeedback(path, focused, dimOpacity)
  })

  return {
    focusedCount,
    totalCount: mappings.length,
  }
}

function applyLineTrend(trend = null) {
  const { surface } = readSurfaceAndLinePaths()
  return renderLineTrendOverlay(surface, trend)
}

function applyLineMovingAverage(movingAverage = null) {
  const { surface, paths } = readSurfaceAndLinePaths()
  if (!movingAverage) {
    removeLineMovingAverageOverlay(surface)
    return { applied: false }
  }
  return renderLineMovingAverageOverlay(surface, paths)
}

function applyLineDrilldown(drilldown = null) {
  const { surface } = readSurfaceAndLinePaths()
  if (!drilldown) {
    removeLineDrilldownOverlay(surface)
    removeLineSliceOverlay(surface)
    return { applied: false }
  }
  return renderLineDrilldownOverlay(surface, drilldown)
}

function applyScatterClusters(cluster = null) {
  const { marks } = readSurfaceAndMarks()
  const rows = readObservableD3ScatterRows(window)
  if (!cluster) {
    marks.forEach((mark) => clearMarkFeedback(mark))
    return {
      applied: false,
      clusterCount: 0,
    }
  }

  const nClusters = Number.isFinite(cluster?.nClusters) ? Number(cluster.nClusters) : 3
  const palette = ['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2']
  const points = rows.map((row) => ({ x: row.__screenX, y: row.__screenY }))
  const { labels } = runKMeans(points, nClusters)

  marks.forEach((mark, index) => {
    if (!originalMarkState.has(mark)) {
      originalMarkState.set(mark, {
        opacity: mark.getAttribute?.('opacity') ?? null,
        stroke: mark.getAttribute?.('stroke') ?? null,
        strokeWidth: mark.getAttribute?.('stroke-width') ?? null,
        fill: mark.getAttribute?.('fill') ?? null,
        fillOpacity: mark.getAttribute?.('fill-opacity') ?? null,
        radius: mark.getAttribute?.('r') ?? null,
        styleOpacity: mark.style.opacity || '',
        styleStroke: mark.style.stroke || '',
        styleStrokeWidth: mark.style.strokeWidth || '',
        styleFillOpacity: mark.style.fillOpacity || '',
        styleFill: mark.style.fill || '',
        styleFilter: mark.style.filter || '',
      })
    }
    const clusterId = labels[index] ?? 0
    const color = palette[clusterId % palette.length]
    mark.setAttribute?.('opacity', '0.9')
    mark.setAttribute?.('fill-opacity', '0.95')
    mark.setAttribute?.('fill', color)
    mark.setAttribute?.('stroke', '#111827')
    mark.setAttribute?.('stroke-width', '1')
    mark.style.opacity = '0.9'
    mark.style.fillOpacity = '0.95'
    mark.style.fill = color
    mark.style.stroke = '#111827'
    mark.style.strokeWidth = '1px'
    mark.style.filter = ''
  })

  return {
    applied: true,
    clusterCount: nClusters,
  }
}

function applyScatterRegression(regression = null) {
  const { surface } = readSurfaceAndMarks()
  if (!regression) {
    removeScatterRegressionOverlay(surface)
    return { applied: false }
  }
  const rows = readObservableD3ScatterRows(window)
  const points = rows.map((row) => ({ x: row.__screenX, y: row.__screenY }))
  return renderScatterRegressionOverlay(surface, points)
}

function applyScatterViewport(viewport = null) {
  const { surface } = readSurfaceAndMarks()
  if (!surface || typeof surface?.tagName !== 'string' || surface.tagName.toLowerCase() !== 'svg') {
    currentViewport = viewport && typeof viewport === 'object' ? viewport : null
    return {
      viewport: currentViewport,
      applied: false,
      reason: 'Observable D3 viewport zoom currently requires an SVG surface.',
    }
  }

  const xDomain = Array.isArray(viewport?.xDomain) ? viewport.xDomain : null
  const yDomain = Array.isArray(viewport?.yDomain) ? viewport.yDomain : null
  if (!xDomain && !yDomain) {
    const originalViewBox = surface.getAttribute(WIDGETVA_VIEWBOX_CACHE_ATTR)
    if (originalViewBox != null && originalViewBox !== '') {
      surface.setAttribute('viewBox', originalViewBox)
    } else {
      surface.removeAttribute('viewBox')
    }
    currentViewport = null
    return {
      viewport: null,
      applied: true,
    }
  }

  if (!surface.hasAttribute(WIDGETVA_VIEWBOX_CACHE_ATTR)) {
    const initialViewBox = surface.getAttribute('viewBox')
    surface.setAttribute(WIDGETVA_VIEWBOX_CACHE_ATTR, initialViewBox == null ? '' : initialViewBox)
  }

  const surfaceRect = readRectLike(surface)
  const localLeft = xDomain ? Math.min(...xDomain) - surfaceRect.left : 0
  const localTop = yDomain ? Math.min(...yDomain) - surfaceRect.top : 0
  const localRight = xDomain ? Math.max(...xDomain) - surfaceRect.left : surfaceRect.width
  const localBottom = yDomain ? Math.max(...yDomain) - surfaceRect.top : surfaceRect.height
  const localWidth = Math.max(localRight - localLeft, 1)
  const localHeight = Math.max(localBottom - localTop, 1)

  surface.setAttribute('viewBox', `${localLeft} ${localTop} ${localWidth} ${localHeight}`)
  currentViewport = {
    ...(xDomain ? { xDomain: [...xDomain] } : {}),
    ...(yDomain ? { yDomain: [...yDomain] } : {}),
  }

  return {
    viewport: currentViewport,
    applied: true,
    viewBox: [localLeft, localTop, localWidth, localHeight],
  }
}

function applyLineViewport(viewport = null) {
  const { surface } = readSurfaceAndLinePaths()
  if (!surface || typeof surface?.tagName !== 'string' || surface.tagName.toLowerCase() !== 'svg') {
    currentLineViewport = viewport && typeof viewport === 'object' ? viewport : null
    return {
      viewport: currentLineViewport,
      applied: false,
      reason: 'Observable D3 line viewport zoom currently requires an SVG surface.',
    }
  }

  const xDomain = Array.isArray(viewport?.xDomain) ? viewport.xDomain : null
  if (!xDomain) {
    const originalViewBox = surface.getAttribute(WIDGETVA_VIEWBOX_CACHE_ATTR)
    if (originalViewBox != null && originalViewBox !== '') {
      surface.setAttribute('viewBox', originalViewBox)
    } else {
      surface.removeAttribute('viewBox')
    }
    currentLineViewport = null
    return {
      viewport: null,
      applied: true,
    }
  }

  const parsedStart = parseComparableAxisValue(xDomain[0])
  const parsedEnd = parseComparableAxisValue(xDomain[1])
  if (parsedStart == null || parsedEnd == null) {
    currentLineViewport = { xDomain: [...xDomain] }
    return {
      viewport: currentLineViewport,
      applied: false,
      reason: 'Line x-domain values could not be parsed.',
    }
  }

  const low = compareComparableAxisValue(parsedStart, parsedEnd) <= 0 ? parsedStart : parsedEnd
  const high = compareComparableAxisValue(parsedStart, parsedEnd) <= 0 ? parsedEnd : parsedStart
  const plotRegion = findObservableD3PlotRegion(window)
  const labelEntries = readLineXAxisLabelEntries(surface)
    .map((entry) => ({
      ...entry,
      comparable: parseComparableAxisValue(entry.text),
    }))
    .filter((entry) => entry.comparable != null)
    .filter((entry) => compareComparableAxisValue(entry.comparable, low) >= 0 && compareComparableAxisValue(entry.comparable, high) <= 0)

  if (!surface.hasAttribute(WIDGETVA_VIEWBOX_CACHE_ATTR)) {
    const initialViewBox = surface.getAttribute('viewBox')
    surface.setAttribute(WIDGETVA_VIEWBOX_CACHE_ATTR, initialViewBox == null ? '' : initialViewBox)
  }

  if (labelEntries.length === 0) {
    currentLineViewport = { xDomain: [...xDomain] }
    return {
      viewport: currentLineViewport,
      applied: false,
      reason: 'No visible x-axis labels matched the requested line x-domain.',
    }
  }

  const surfaceRect = readRectLike(surface)
  const plotLocal = plotRegion?.localRect || { left: 0, top: 0, width: surfaceRect.width, height: surfaceRect.height }
  const centers = labelEntries.map((entry) => entry.rect.left + (entry.rect.width / 2))
  const leftPx = Math.min(...centers)
  const rightPx = Math.max(...centers)
  const left = Math.max(leftPx - surfaceRect.left - 24, plotLocal.left)
  const right = Math.min(rightPx - surfaceRect.left + 24, plotLocal.left + plotLocal.width)
  const width = Math.max(right - left, 1)
  const top = plotLocal.top
  const height = Math.max(plotLocal.height, 1)

  surface.setAttribute('viewBox', `${left} ${top} ${width} ${height}`)
  currentLineViewport = { xDomain: [...xDomain] }
  return {
    viewport: currentLineViewport,
    applied: true,
    matchedLabels: labelEntries.map((entry) => entry.text),
    viewBox: [left, top, width, height],
  }
}

function readDebugSnapshot() {
  const { surface, marks } = readSurfaceAndMarks()
  const rows = readObservableD3ScatterRows(window)
  return {
    route: 'worker',
    surface: describeObservableD3Surface(window),
    plotRegion: findObservableD3PlotRegion(window),
    surfaceRect: readRectLike(surface),
    markCount: marks.length,
    rowSummary: summarizeObservableD3ScatterRows(rows),
    viewport: currentViewport,
    barRows: readObservableD3BarRows(window),
    lineRows: readObservableD3LineRows(window),
  }
}

function renderDebugProbe() {
  const { surface } = readSurfaceAndMarks()
  return renderSurfaceProbe(surface, findObservableD3PlotRegion(window))
}

function buildOkResult(id, result) {
  return {
    source: SOURCE_WORKER,
    type: RESPONSE_TYPE,
    id,
    ok: true,
    result,
  }
}

function buildErrorResult(id, error) {
  return {
    source: SOURCE_WORKER,
    type: RESPONSE_TYPE,
    id,
    ok: false,
    error: {
      name: error?.name || 'Error',
      message: error?.message || String(error),
    },
  }
}

window.addEventListener('message', (event) => {
  const message = event?.data
  if (!message || message.source !== SOURCE_TOP || message.type !== REQUEST_TYPE || typeof message.id !== 'string') {
    return
  }

  event.stopImmediatePropagation?.()
  event.stopPropagation?.()

  try {
    let result = null
    if (message.method === 'describeSurface') {
      result = describeObservableD3Surface(window, {
        notebook: message.params?.notebook || null,
      })
    } else if (message.method === 'readScatterRows') {
      result = {
        rows: readObservableD3ScatterRows(window),
      }
    } else if (message.method === 'readBarRows') {
      result = {
        rows: readObservableD3BarRows(window),
      }
    } else if (message.method === 'readLineRows') {
      result = {
        rows: readObservableD3LineRows(window),
      }
    } else if (message.method === 'applyScatterSelection') {
      result = applyScatterSelection(message.params?.selection || null)
    } else if (message.method === 'applyBarSelection') {
      result = applyBarSelection(message.params?.selection || null)
    } else if (message.method === 'applyBarFilter') {
      result = applyBarFilter(message.params?.filter || null)
    } else if (message.method === 'applyBarSort') {
      result = applyBarSort(message.params?.sort || null)
    } else if (message.method === 'applyLineSelection') {
      result = applyLineSelection(message.params?.selection || null)
    } else if (message.method === 'applyLineFocus') {
      result = applyLineFocus(message.params?.focus || null)
    } else if (message.method === 'applyLineTrend') {
      result = applyLineTrend(message.params?.trend || null)
    } else if (message.method === 'applyLineMovingAverage') {
      result = applyLineMovingAverage(message.params?.movingAverage || null)
    } else if (message.method === 'applyLineDrilldown') {
      result = applyLineDrilldown(message.params?.drilldown || null)
    } else if (message.method === 'applyLineViewport') {
      result = applyLineViewport(message.params?.viewport || null)
    } else if (message.method === 'applyScatterClusters') {
      result = applyScatterClusters(message.params?.cluster || null)
    } else if (message.method === 'applyScatterRegression') {
      result = applyScatterRegression(message.params?.regression || null)
    } else if (message.method === 'applyScatterViewport') {
      result = applyScatterViewport(message.params?.viewport || null)
    } else if (message.method === 'readDebugSnapshot') {
      result = readDebugSnapshot()
    } else if (message.method === 'renderDebugProbe') {
      result = renderDebugProbe()
    } else {
      throw new Error(`Unsupported Observable D3 worker method: ${message.method || 'missing'}.`)
    }

    event.source?.postMessage(buildOkResult(message.id, result), '*')
  } catch (error) {
    event.source?.postMessage(buildErrorResult(message.id, error), '*')
  }
}, true)
