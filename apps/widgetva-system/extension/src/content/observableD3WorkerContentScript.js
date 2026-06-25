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
const WIDGETVA_LINE_SELECTION_ATTR = 'data-widgetva-line-selection-overlay'
const WIDGETVA_LINE_TREND_ATTR = 'data-widgetva-line-trend-overlay'
const WIDGETVA_LINE_MA_ATTR = 'data-widgetva-line-ma-overlay'
const WIDGETVA_LINE_DRILLDOWN_ATTR = 'data-widgetva-line-drilldown-overlay'
const WIDGETVA_SCATTER_REGRESSION_ATTR = 'data-widgetva-scatter-regression-overlay'
const WIDGETVA_ZOOM_OVERLAY_ATTR = 'data-widgetva-zoom-overlay'
const originalMarkState = new WeakMap()
const originalSurfaceState = new WeakMap()
let currentViewport = null
let currentLineViewport = null
let lastBarSelection = null
let lastLineOverlayResult = null
let lastLineViewportResult = null
let lastLineAnnotationResult = null
let lineScreenOverlayLifecycle = null

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

function markUsesSvgLocalCoordinates(mark) {
  if (typeof mark?.tagName !== 'string' || mark.tagName.toLowerCase() !== 'circle') {
    return false
  }

  const attrCx = readNumber(mark.getAttribute?.('cx'))
  const attrCy = readNumber(mark.getAttribute?.('cy'))
  if (attrCx != null && attrCy != null) return true

  const baseCx = readNumber(mark.cx?.baseVal?.value)
  const baseCy = readNumber(mark.cy?.baseVal?.value)
  return baseCx != null && baseCy != null
}

function inferScatterCoordinateSpace(marks = []) {
  return marks.some((mark) => markUsesSvgLocalCoordinates(mark))
    ? 'svg-local'
    : 'viewport'
}

function viewportPointToSvg(surface, x, y) {
  if (
    surface
    && typeof surface.createSVGPoint === 'function'
    && typeof surface.getScreenCTM === 'function'
  ) {
    try {
      const matrix = surface.getScreenCTM()
      const inverse = matrix?.inverse?.()
      if (inverse) {
        const point = surface.createSVGPoint()
        point.x = x
        point.y = y
        const transformed = point.matrixTransform(inverse)
        return { x: transformed.x, y: transformed.y }
      }
    } catch {}
  }

  const rect = readRectLike(surface)
  return {
    x: x - rect.left,
    y: y - rect.top,
  }
}

function removeBrushOverlay(surface) {
  surface?.querySelector?.(`[${WIDGETVA_BRUSH_OVERLAY_ATTR}="true"]`)?.remove?.()
}

function removeSurfaceProbe(surface) {
  const doc = surface?.ownerDocument || window.document
  doc?.querySelector?.(`[${WIDGETVA_SURFACE_PROBE_ATTR}="true"]`)?.remove?.()
}

function removeZoomOverlay(surface) {
  surface?.querySelector?.(`[${WIDGETVA_ZOOM_OVERLAY_ATTR}="true"]`)?.remove?.()
}

function removeLineSliceOverlay(surface) {
  surface?.ownerDocument?.querySelector?.(`[${WIDGETVA_LINE_SLICE_ATTR}="true"]`)?.remove?.()
}

function removeLineSelectionOverlay(surface) {
  const doc = surface?.ownerDocument || window.document
  if (lineScreenOverlayLifecycle) {
    try {
      lineScreenOverlayLifecycle.observer?.disconnect?.()
    } catch {}
    lineScreenOverlayLifecycle.listeners?.forEach(({ target, type, handler, options }) => {
      try {
        target?.removeEventListener?.(type, handler, options)
      } catch {}
    })
    lineScreenOverlayLifecycle = null
  }
  doc?.querySelectorAll?.(`[${WIDGETVA_LINE_SELECTION_ATTR}="true"]`)?.forEach((node) => node.remove?.())
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

function readSvgBox(surface) {
  const viewBox = surface?.getAttribute?.('viewBox')
  if (typeof viewBox === 'string' && viewBox.trim().length > 0) {
    const [x, y, width, height] = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(readNumber)
    if ([x, y, width, height].every((value) => value != null) && width > 0 && height > 0) {
      return { x, y, width, height }
    }
  }

  const attrWidth = readNumber(surface?.getAttribute?.('width'))
  const attrHeight = readNumber(surface?.getAttribute?.('height'))
  if (attrWidth != null && attrHeight != null && attrWidth > 0 && attrHeight > 0) {
    return { x: 0, y: 0, width: attrWidth, height: attrHeight }
  }

  const rect = readRectLike(surface)
  return { x: 0, y: 0, width: rect.width, height: rect.height }
}

function rememberSurfaceState(surface) {
  if (!surface || originalSurfaceState.has(surface)) return
  originalSurfaceState.set(surface, {
    viewBox: surface.getAttribute?.('viewBox') ?? null,
    preserveAspectRatio: surface.getAttribute?.('preserveAspectRatio') ?? null,
  })
}

function restoreSurfaceState(surface) {
  if (!surface) return
  const original = originalSurfaceState.get(surface) || {}
  if (original.viewBox == null) surface.removeAttribute?.('viewBox')
  else surface.setAttribute?.('viewBox', original.viewBox)
  if (original.preserveAspectRatio == null) surface.removeAttribute?.('preserveAspectRatio')
  else surface.setAttribute?.('preserveAspectRatio', original.preserveAspectRatio)
  removeZoomOverlay(surface)
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

function renderBrushOverlay(surface, selection, { coordinateSpace = 'viewport' } = {}) {
  if (!surface || typeof surface?.tagName !== 'string' || surface.tagName.toLowerCase() !== 'svg') {
    return
  }

  const xDomain = Array.isArray(selection?.domain?.xDomain) ? selection.domain.xDomain : null
  const yDomain = Array.isArray(selection?.domain?.yDomain) ? selection.domain.yDomain : null
  if (!xDomain || !yDomain) {
    removeBrushOverlay(surface)
    return
  }

  const firstCorner = coordinateSpace === 'svg-local'
    ? { x: xDomain[0], y: yDomain[0] }
    : viewportPointToSvg(surface, xDomain[0], yDomain[0])
  const secondCorner = coordinateSpace === 'svg-local'
    ? { x: xDomain[1], y: yDomain[1] }
    : viewportPointToSvg(surface, xDomain[1], yDomain[1])
  const x = Math.min(firstCorner.x, secondCorner.x)
  const y = Math.min(firstCorner.y, secondCorner.y)
  const width = Math.abs(secondCorner.x - firstCorner.x)
  const height = Math.abs(secondCorner.y - firstCorner.y)

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
  if (!originalMarkState.has(mark)) return
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

  path.setAttribute?.('fill', 'none')
  path.style.fill = 'none'

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

function applyLinePathSelectionFeedback(path, selected) {
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

  path.setAttribute?.('fill', 'none')
  path.removeAttribute?.('fill-opacity')
  path.setAttribute?.('opacity', selected ? '1' : '0.12')
  path.setAttribute?.('stroke', selected ? '#dc2626' : '#cbd5e1')
  path.setAttribute?.('stroke-width', selected ? '3' : '1')
  path.style.fill = 'none'
  path.style.fillOpacity = ''
  path.style.opacity = selected ? '1' : '0.12'
  path.style.stroke = selected ? '#dc2626' : '#cbd5e1'
  path.style.strokeWidth = selected ? '3px' : '1px'
  path.style.filter = selected ? 'drop-shadow(0 0 6px rgba(220, 38, 38, 0.45))' : ''
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

function clonePathForLineOverlay(path, {
  stroke = '#dc2626',
  strokeWidth = '3',
  opacity = '0.95',
  dasharray = null,
} = {}) {
  const clone = path?.cloneNode?.(true)
  if (!clone) return null
  clone.removeAttribute?.('id')
  clone.removeAttribute?.('class')
  clone.removeAttribute?.('data-testid')
  clone.removeAttribute?.('style')
  clone.setAttribute('fill', 'none')
  clone.setAttribute('stroke', stroke)
  clone.setAttribute('stroke-width', strokeWidth)
  clone.setAttribute('opacity', opacity)
  clone.setAttribute('pointer-events', 'none')
  clone.setAttribute('vector-effect', 'non-scaling-stroke')
  if (dasharray) clone.setAttribute('stroke-dasharray', dasharray)
  clone.style.fill = 'none'
  clone.style.stroke = stroke
  clone.style.strokeWidth = `${strokeWidth}px`
  clone.style.opacity = opacity
  clone.style.pointerEvents = 'none'
  return clone
}

function renderLinePathOverlay(surface, entries = [], {
  attrName = WIDGETVA_LINE_SELECTION_ATTR,
  stroke = '#dc2626',
  strokeWidth = '3',
  opacity = '0.95',
  dasharray = null,
  dimOriginal = false,
} = {}) {
  surface?.querySelector?.(`[${attrName}="true"]`)?.remove?.()
  if (!surface || typeof surface?.tagName !== 'string' || surface.tagName.toLowerCase() !== 'svg') {
    return { applied: false, overlayCount: 0 }
  }
  const normalizedEntries = Array.isArray(entries) ? entries.filter((entry) => entry?.path) : []
  if (normalizedEntries.length === 0) {
    return { applied: false, overlayCount: 0 }
  }

  const overlayGroup = createSvgGroupNode(surface)
  if (!overlayGroup) return { applied: false, overlayCount: 0 }
  overlayGroup.setAttribute(attrName, 'true')
  overlayGroup.setAttribute('pointer-events', 'none')

  if (dimOriginal) {
    const plotRegion = findObservableD3PlotRegion(window)
    const localRect = plotRegion?.localRect || {
      left: 0,
      top: 0,
      width: readSvgBox(surface).width,
      height: readSvgBox(surface).height,
    }
    const veil = surface.ownerDocument?.createElementNS?.('http://www.w3.org/2000/svg', 'rect')
    if (veil) {
      veil.setAttribute('x', String(localRect.left))
      veil.setAttribute('y', String(localRect.top))
      veil.setAttribute('width', String(localRect.width))
      veil.setAttribute('height', String(localRect.height))
      veil.setAttribute('fill', 'rgba(255, 255, 255, 0.68)')
      veil.setAttribute('pointer-events', 'none')
      overlayGroup.appendChild(veil)
    }
  }

  normalizedEntries.forEach(({ path }) => {
    const clone = clonePathForLineOverlay(path, {
      stroke,
      strokeWidth,
      opacity,
      dasharray,
    })
    if (clone) overlayGroup.appendChild(clone)
  })

  surface.appendChild(overlayGroup)
  return {
    applied: true,
    overlayCount: normalizedEntries.length,
  }
}

function sampleLinePathScreenPoints(path, sampleCount = 96) {
  if (!path || typeof path.getTotalLength !== 'function' || typeof path.getPointAtLength !== 'function') {
    return []
  }
  let matrix = null
  try {
    matrix = typeof path.getScreenCTM === 'function' ? path.getScreenCTM() : null
  } catch {}
  if (!matrix) return []

  let totalLength = 0
  try {
    totalLength = path.getTotalLength()
  } catch {
    return []
  }
  if (!Number.isFinite(totalLength) || totalLength <= 0) return []

  const ownerSvg = path.ownerSVGElement
  const createPoint = ownerSvg && typeof ownerSvg.createSVGPoint === 'function'
    ? () => ownerSvg.createSVGPoint()
    : null
  if (!createPoint) return []

  const steps = Math.max(2, sampleCount)
  const points = []
  for (let index = 0; index < steps; index += 1) {
    const distance = (totalLength * index) / (steps - 1)
    let localPoint = null
    try {
      localPoint = path.getPointAtLength(distance)
    } catch {
      continue
    }
    const svgPoint = createPoint()
    svgPoint.x = localPoint.x
    svgPoint.y = localPoint.y
    const screenPoint = svgPoint.matrixTransform(matrix)
    points.push({
      x: screenPoint.x,
      y: screenPoint.y,
    })
  }
  return points
}

function sampleLinePathLocalPoints(path, sampleCount = 180) {
  if (!path || typeof path.getTotalLength !== 'function' || typeof path.getPointAtLength !== 'function') {
    return []
  }

  let totalLength = 0
  try {
    totalLength = path.getTotalLength()
  } catch {
    return []
  }
  if (!Number.isFinite(totalLength) || totalLength <= 0) return []

  const steps = Math.max(8, sampleCount)
  const points = []
  for (let index = 0; index < steps; index += 1) {
    const distance = (totalLength * index) / (steps - 1)
    try {
      const point = path.getPointAtLength(distance)
      const x = readNumber(point?.x)
      const y = readNumber(point?.y)
      if (x != null && y != null) {
        points.push({ x, y })
      }
    } catch {}
  }
  return points
}

function smoothLinePathPoints(points = [], windowSize = 9) {
  const safePoints = Array.isArray(points)
    ? points.filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))
    : []
  if (safePoints.length < 3) return safePoints

  const width = Math.max(3, Math.min(safePoints.length, Math.round(windowSize)))
  const radius = Math.floor(width / 2)
  return safePoints.map((point, index) => {
    const from = Math.max(0, index - radius)
    const to = Math.min(safePoints.length - 1, index + radius)
    const slice = safePoints.slice(from, to + 1)
    const y = slice.reduce((sum, item) => sum + item.y, 0) / slice.length
    return {
      x: point.x,
      y,
    }
  })
}

function updateLineScreenOverlay(lifecycle) {
  if (!lifecycle?.overlay || !Array.isArray(lifecycle.entries)) return
  const doc = lifecycle.doc || window.document
  const width = window.innerWidth || doc.documentElement?.clientWidth || 1200
  const height = window.innerHeight || doc.documentElement?.clientHeight || 800
  lifecycle.overlay.setAttribute('width', String(width))
  lifecycle.overlay.setAttribute('height', String(height))
  lifecycle.overlay.setAttribute('viewBox', `0 0 ${width} ${height}`)

  if (lifecycle.veil) {
    const plotRegion = findObservableD3PlotRegion(window)
    const rect = plotRegion?.screenRect || readRectLike(lifecycle.surface)
    lifecycle.veil.setAttribute('x', String(rect.left))
    lifecycle.veil.setAttribute('y', String(rect.top))
    lifecycle.veil.setAttribute('width', String(rect.width))
    lifecycle.veil.setAttribute('height', String(rect.height))
  }

  let overlayCount = 0
  lifecycle.entries.forEach(({ path, polyline }) => {
    if (!path?.isConnected || !polyline) {
      if (polyline) polyline.style.display = 'none'
      return
    }
    const points = sampleLinePathScreenPoints(path)
    if (points.length < 2) {
      polyline.style.display = 'none'
      return
    }
    polyline.style.display = ''
    polyline.setAttribute('points', points.map((point) => `${point.x},${point.y}`).join(' '))
    overlayCount += 1
  })

  lifecycle.overlayCount = overlayCount
  if (lastLineOverlayResult && lifecycle === lineScreenOverlayLifecycle) {
    lastLineOverlayResult = {
      ...lastLineOverlayResult,
      applied: overlayCount > 0,
      overlayCount,
      dynamic: true,
    }
  }
}

function scheduleLineScreenOverlayUpdate(lifecycle = lineScreenOverlayLifecycle) {
  if (!lifecycle || lifecycle.rafId != null) return
  lifecycle.rafId = window.requestAnimationFrame?.(() => {
    lifecycle.rafId = null
    updateLineScreenOverlay(lifecycle)
  })
}

function renderLineScreenPathOverlay(surface, entries = [], {
  attrName = WIDGETVA_LINE_SELECTION_ATTR,
  stroke = '#dc2626',
  strokeWidth = '4',
  opacity = '0.98',
  dimOriginal = false,
} = {}) {
  const doc = surface?.ownerDocument || window.document
  removeLineSelectionOverlay(surface)
  const host = doc?.body || doc?.documentElement
  const normalizedEntries = Array.isArray(entries) ? entries.filter((entry) => entry?.path) : []
  if (!host || normalizedEntries.length === 0) {
    return { applied: false, overlayCount: 0 }
  }

  const overlay = doc.createElementNS?.('http://www.w3.org/2000/svg', 'svg')
  if (!overlay) return { applied: false, overlayCount: 0 }
  overlay.setAttribute(attrName, 'true')
  overlay.setAttribute('width', String(window.innerWidth || doc.documentElement?.clientWidth || 1200))
  overlay.setAttribute('height', String(window.innerHeight || doc.documentElement?.clientHeight || 800))
  overlay.setAttribute('viewBox', `0 0 ${window.innerWidth || doc.documentElement?.clientWidth || 1200} ${window.innerHeight || doc.documentElement?.clientHeight || 800}`)
  overlay.style.position = 'fixed'
  overlay.style.left = '0'
  overlay.style.top = '0'
  overlay.style.width = '100vw'
  overlay.style.height = '100vh'
  overlay.style.pointerEvents = 'none'
  overlay.style.zIndex = '2147483646'
  overlay.style.overflow = 'visible'

  let veil = null
  if (dimOriginal) {
    const plotRegion = findObservableD3PlotRegion(window)
    const rect = plotRegion?.screenRect || readRectLike(surface)
    veil = doc.createElementNS('http://www.w3.org/2000/svg', 'rect')
    veil.setAttribute('x', String(rect.left))
    veil.setAttribute('y', String(rect.top))
    veil.setAttribute('width', String(rect.width))
    veil.setAttribute('height', String(rect.height))
    veil.setAttribute('fill', 'rgba(255, 255, 255, 0.45)')
    overlay.appendChild(veil)
  }

  const overlayEntries = []
  normalizedEntries.forEach(({ path, series }) => {
    const polyline = doc.createElementNS('http://www.w3.org/2000/svg', 'polyline')
    polyline.setAttribute('fill', 'none')
    polyline.setAttribute('stroke', stroke)
    polyline.setAttribute('stroke-width', strokeWidth)
    polyline.setAttribute('stroke-linejoin', 'round')
    polyline.setAttribute('stroke-linecap', 'round')
    polyline.setAttribute('opacity', opacity)
    polyline.setAttribute('vector-effect', 'non-scaling-stroke')
    polyline.style.filter = 'drop-shadow(0 0 5px rgba(220, 38, 38, 0.65))'
    overlay.appendChild(polyline)
    overlayEntries.push({ path, series, polyline })
  })

  host.appendChild(overlay)
  const lifecycle = {
    attrName,
    doc,
    surface,
    overlay,
    veil,
    entries: overlayEntries,
    overlayCount: 0,
    rafId: null,
    listeners: [],
    observer: null,
  }
  const schedule = () => scheduleLineScreenOverlayUpdate(lifecycle)
  const listenerOptions = { passive: true }
  ;[
    { target: window, type: 'mousemove' },
    { target: window, type: 'scroll' },
    { target: window, type: 'resize' },
    { target: doc, type: 'mousemove' },
    { target: doc, type: 'scroll' },
  ].forEach(({ target, type }) => {
    target?.addEventListener?.(type, schedule, listenerOptions)
    lifecycle.listeners.push({ target, type, handler: schedule, options: listenerOptions })
  })
  if (typeof MutationObserver === 'function' && surface) {
    lifecycle.observer = new MutationObserver(schedule)
    try {
      lifecycle.observer.observe(surface, {
        attributes: true,
        subtree: true,
        attributeFilter: ['d', 'transform', 'style', 'display', 'opacity'],
      })
    } catch {}
  }
  lineScreenOverlayLifecycle = lifecycle
  updateLineScreenOverlay(lifecycle)

  if (lifecycle.overlayCount === 0) {
    removeLineSelectionOverlay(surface)
    return { applied: false, overlayCount: 0, dynamic: true }
  }
  return {
    applied: true,
    overlayCount: lifecycle.overlayCount,
    dynamic: true,
  }
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

function renderLineMovingAverageOverlay(surface, paths = [], movingAverage = null) {
  removeLineMovingAverageOverlay(surface)
  if (!surface || typeof surface?.tagName !== 'string' || surface.tagName.toLowerCase() !== 'svg' || paths.length === 0) return { applied: false }
  const overlayGroup = createSvgGroupNode(surface)
  if (!overlayGroup) return { applied: false }
  overlayGroup.setAttribute(WIDGETVA_LINE_MA_ATTR, 'true')
  overlayGroup.setAttribute('pointer-events', 'none')

  const requestedWindow = Number(movingAverage?.windowSize)
  const effectiveWindow = Number.isFinite(requestedWindow) && requestedWindow > 0
    ? Math.max(7, Math.round(requestedWindow) * 7)
    : 21
  let overlayCount = 0
  paths.forEach((path) => {
    const points = smoothLinePathPoints(sampleLinePathLocalPoints(path), effectiveWindow)
    if (points.length < 2) return
    const polyline = surface.ownerDocument?.createElementNS?.('http://www.w3.org/2000/svg', 'polyline')
    if (!polyline) return
    polyline.setAttribute('points', points.map((point) => `${point.x},${point.y}`).join(' '))
    polyline.setAttribute('stroke', '#f59e0b')
    polyline.setAttribute('stroke-width', '3.25')
    polyline.setAttribute('opacity', '0.78')
    polyline.setAttribute('fill', 'none')
    polyline.setAttribute('stroke-dasharray', '10 5')
    polyline.setAttribute('stroke-linejoin', 'round')
    polyline.setAttribute('stroke-linecap', 'round')
    polyline.setAttribute('vector-effect', 'non-scaling-stroke')
    polyline.style.stroke = '#f59e0b'
    polyline.style.strokeWidth = '3.25px'
    polyline.style.opacity = '0.78'
    polyline.style.filter = 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.42))'
    overlayGroup.appendChild(polyline)
    overlayCount += 1
  })

  if (overlayCount === 0) return { applied: false, overlayCount: 0 }
  surface.appendChild(overlayGroup)
  return {
    applied: true,
    overlayCount,
    smoothingWindow: effectiveWindow,
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

  const inferredValues = inferDrilldownValues(drilldown, readObservableD3LineXAxisLabels(window))
  const fallbackValues = Number.isFinite(drilldown.value) ? [String(drilldown.value)] : []
  const values = inferredValues.length > 0 ? inferredValues : fallbackValues
  const sliceResult = values.length > 0 ? renderLineSliceOverlay(surface, values) : null

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
    slice: sliceResult,
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
  const coordinateSpace = inferScatterCoordinateSpace(marks)
  if (!selection) {
    removeBrushOverlay(surface)
  } else {
    renderBrushOverlay(surface, selection, { coordinateSpace })
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
  const values = Array.isArray(selection?.values)
    ? selection.values
    : Array.isArray(selection?.categories)
      ? selection.categories
      : []
  const normalizedSelection = values.length > 0
    ? {
        field: typeof selection?.field === 'string' ? selection.field : 'category',
        values: values.map((value) => String(value)),
      }
    : null
  const selectedSet = new Set(normalizedSelection?.values || [])
  let selectedCount = 0

  lastBarSelection = normalizedSelection

  marks.forEach((mark, index) => {
    const row = rows[index] || null
    if (!normalizedSelection) {
      clearMarkFeedback(mark)
      mark.style.display = ''
      return
    }
    const selected = !!row && selectedSet.has(String(row.category))
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
  const selectedSet = new Set(lastBarSelection?.values || [])
  let visibleCount = 0
  let selectedCount = 0

  marks.forEach((mark, index) => {
    const row = rows[index] || null
    if (!filter) {
      mark.style.display = ''
      if (lastBarSelection) {
        const selected = !!row && selectedSet.has(String(row.category))
        if (selected) selectedCount += 1
        applyMarkFeedback(mark, selected)
      } else {
        clearMarkFeedback(mark)
      }
      return
    }
    const visible = !!row && visibleSet.has(row.category)
    if (visible) visibleCount += 1
    mark.style.display = visible ? '' : 'none'
    if (visible) {
      if (lastBarSelection) {
        const selected = selectedSet.has(String(row.category))
        if (selected) selectedCount += 1
        applyMarkFeedback(mark, selected)
      } else {
        clearMarkFeedback(mark)
      }
    }
  })

  return {
    visibleCount,
    selectedCount,
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

function readYearLikeValue(value) {
  if (value == null) return null
  const text = String(value).trim()
  if (!text) return null
  const directYear = Number(text)
  if (Number.isFinite(directYear) && directYear >= 1900 && directYear <= 2100) return directYear
  const parsed = Date.parse(text)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).getFullYear()
}

function inferLineSliceXFromValue({ value, surface, plotRegion, xLabels = [] }) {
  const requestedYear = readYearLikeValue(value)
  if (!Number.isFinite(requestedYear)) return null
  const plotRect = plotRegion?.screenRect || readRectLike(surface)
  if (!Number.isFinite(plotRect.left) || !Number.isFinite(plotRect.width) || plotRect.width <= 0) return null

  const years = xLabels
    .map((entry) => readYearLikeValue(entry.text))
    .filter((year) => Number.isFinite(year))
  const minYear = years.length > 0 ? Math.min(...years) : 2013
  const maxYear = years.length > 0 ? Math.max(...years) : 2018
  if (maxYear <= minYear) return null

  const clampedYear = Math.max(minYear, Math.min(maxYear, requestedYear))
  const fraction = (clampedYear - minYear) / (maxYear - minYear)
  return plotRect.left + (plotRect.width * fraction)
}

function inferLineViewportBoundsFromYears({ xDomain, surface, plotRegion, xLabels = [] }) {
  if (!Array.isArray(xDomain) || xDomain.length < 2) return null
  const startYear = readYearLikeValue(xDomain[0])
  const endYear = readYearLikeValue(xDomain[1])
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return null

  const years = xLabels
    .map((entry) => readYearLikeValue(entry.text))
    .filter((year) => Number.isFinite(year))
  const minYear = years.length > 0 ? Math.min(...years) : 2013
  const maxYear = years.length > 0 ? Math.max(...years) : 2018
  if (maxYear <= minYear) return null

  const plotRect = plotRegion?.screenRect || readRectLike(surface)
  if (!Number.isFinite(plotRect.left) || !Number.isFinite(plotRect.width) || plotRect.width <= 0) return null

  const lowYear = Math.max(minYear, Math.min(maxYear, Math.min(startYear, endYear)))
  const highYear = Math.max(minYear, Math.min(maxYear, Math.max(startYear, endYear)))
  const lowFraction = (lowYear - minYear) / (maxYear - minYear)
  const highFraction = (highYear - minYear) / (maxYear - minYear)
  return {
    leftPx: plotRect.left + (plotRect.width * lowFraction),
    rightPx: plotRect.left + (plotRect.width * highFraction),
    minYear,
    maxYear,
    lowYear,
    highYear,
  }
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

function readLinePathSeriesFromDatum(path) {
  const datum = path?.__data__
  if (!datum || typeof datum !== 'object') return null
  const candidates = [
    datum.key,
    datum.series,
    datum.Series,
    datum.symbol,
    datum.Symbol,
    datum.name,
    datum.id,
  ]
  for (const candidate of candidates) {
    if (candidate == null) continue
    const value = String(candidate).trim()
    if (value) return value
  }
  if (Array.isArray(datum) && datum.length > 0) {
    const first = datum[0]
    const nested = first && typeof first === 'object'
      ? (first.series || first.Series || first.symbol || first.Symbol || first.name)
      : null
    if (nested != null && String(nested).trim()) return String(nested).trim()
  }
  return null
}

function normalizeSvgColor(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function readLinePathStroke(path) {
  return normalizeSvgColor(path?.getAttribute?.('stroke') || path?.style?.stroke || '')
}

function normalizeLineSeriesValue(value) {
  const token = String(value ?? '').trim()
  if (!token) return ''
  const upper = token.toUpperCase()
  const aliases = new Map([
    ['A', 'AAPL'],
    ['APPLE', 'AAPL'],
    ['AAPL', 'AAPL'],
    ['AMAZON', 'AMZN'],
    ['AMZN', 'AMZN'],
    ['GOOGLE', 'GOOG'],
    ['GOOG', 'GOOG'],
    ['MICROSOFT', 'MSFT'],
    ['MSFT', 'MSFT'],
    ['IBM', 'IBM'],
  ])
  return aliases.get(upper) || upper
}

function lineSeriesMatches(series, selectedSet) {
  if (series == null || !selectedSet || selectedSet.size === 0) return false
  return selectedSet.has(normalizeLineSeriesValue(series))
}

function readIndexChartSeriesFromStroke(path) {
  const stroke = readLinePathStroke(path)
  const seriesByStroke = new Map([
    ['#2ca02c', 'AMZN'],
    ['#d62728', 'GOOG'],
    ['#9467bd', 'IBM'],
    ['#8c564b', 'MSFT'],
    ['#ff7f0e', 'AAPL'],
  ])
  return seriesByStroke.get(stroke) || null
}

function readLinePathEndpoint(path) {
  if (!path || typeof path.getTotalLength !== 'function' || typeof path.getPointAtLength !== 'function') {
    const rect = readRectLike(path)
    return {
      x: rect.left + rect.width,
      y: rect.top + (rect.height / 2),
    }
  }
  try {
    const point = path.getPointAtLength(path.getTotalLength())
    return {
      x: Number(point?.x) || 0,
      y: Number(point?.y) || 0,
    }
  } catch {
    const rect = readRectLike(path)
    return {
      x: rect.left + rect.width,
      y: rect.top + (rect.height / 2),
    }
  }
}

function fallbackLineEntriesByKnownIndexSeries(paths, selectedSet) {
  const requested = [...selectedSet].map((value) => normalizeLineSeriesValue(value))
  const rankBySeries = new Map([
    ['AMZN', 0],
    ['MSFT', 1],
    ['GOOG', 2],
    ['AAPL', 3],
    ['IBM', Number.POSITIVE_INFINITY],
  ])
  if (!requested.some((series) => rankBySeries.has(series))) return []
  const rankedPaths = paths
    .map((path) => ({
      path,
      endpoint: readLinePathEndpoint(path),
    }))
    .sort((left, right) => left.endpoint.y - right.endpoint.y)

  return requested
    .map((series) => {
      const rank = rankBySeries.get(series)
      if (rank == null) return null
      const index = rank === Number.POSITIVE_INFINITY ? rankedPaths.length - 1 : rank
      const entry = rankedPaths[index]
      return entry ? { path: entry.path, series } : null
    })
    .filter(Boolean)
}

function mapLinePathsToSeries(surface, paths) {
  const strokeMappings = paths.map((path) => ({
    path,
    series: readIndexChartSeriesFromStroke(path),
  }))
  if (strokeMappings.some((entry) => entry.series != null)) {
    return strokeMappings
  }

  const seriesLabels = readLineSeriesLabelEntries(surface)
  const datumMappings = paths.map((path) => ({
    path,
    series: readLinePathSeriesFromDatum(path),
  }))
  if (datumMappings.some((entry) => entry.series != null)) {
    return datumMappings
  }
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
  if (!surface || requested.size === 0) return { applied: false, overlayCount: 0 }

  const plotRegion = findObservableD3PlotRegion(window)
  const allXLabels = readLineXAxisLabelEntries(surface)
  const matchedXLabels = allXLabels.filter((entry) => requested.has(entry.text))
  const inferredXs = matchedXLabels.length > 0
    ? []
    : [...requested]
        .map((value) => inferLineSliceXFromValue({
          value,
          surface,
          plotRegion,
          xLabels: allXLabels,
        }))
        .filter((x) => Number.isFinite(x))
  if (matchedXLabels.length === 0 && inferredXs.length === 0) {
    return { applied: false, overlayCount: 0, requestedValues: [...requested].map((value) => String(value)) }
  }

  const doc = surface.ownerDocument || window.document
  const host = doc?.body || doc?.documentElement
  const overlay = doc?.createElement?.('div')
  if (!host || !overlay) return { applied: false, overlayCount: 0 }
  overlay.setAttribute(WIDGETVA_LINE_SLICE_ATTR, 'true')
  overlay.style.position = 'fixed'
  overlay.style.left = '0'
  overlay.style.top = '0'
  overlay.style.width = '100vw'
  overlay.style.height = '100vh'
  overlay.style.pointerEvents = 'none'
  overlay.style.zIndex = '2147483646'

  const sliceXs = [
    ...matchedXLabels.map((entry) => entry.rect.left + (entry.rect.width / 2)),
    ...inferredXs,
  ].filter((x, index, xs) => xs.findIndex((other) => Math.abs(other - x) < 2) === index)

  sliceXs.forEach((centerX) => {
    const bar = doc.createElement('div')
    bar.style.position = 'absolute'
    bar.style.left = `${centerX - 2}px`
    bar.style.top = `${plotRegion?.screenRect?.top || readRectLike(surface).top}px`
    bar.style.width = '6px'
    bar.style.height = `${plotRegion?.screenRect?.height || 160}px`
    bar.style.background = 'rgba(220, 38, 38, 0.9)'
    bar.style.borderLeft = '1px solid rgba(127, 29, 29, 0.85)'
    bar.style.borderRight = '1px solid rgba(127, 29, 29, 0.85)'
    bar.style.boxShadow = '0 0 12px rgba(220, 38, 38, 0.7)'
    overlay.appendChild(bar)
  })

  host.appendChild(overlay)
  return {
    applied: sliceXs.length > 0,
    overlayCount: sliceXs.length,
    requestedValues: [...requested].map((value) => String(value)),
    matchedLabels: matchedXLabels.map((entry) => entry.text),
    inferredXs,
  }
}

function applyLineSelection(selection = null) {
  const { surface, paths } = readSurfaceAndLinePaths()
  const rows = readObservableD3LineRows(window)
  removeLineSliceOverlay(surface)
  removeLineSelectionOverlay(surface)
  paths.forEach((path) => clearMarkFeedback(path))
  lastLineOverlayResult = null

  if (!selection) {
    lastLineOverlayResult = {
      applied: false,
      overlayCount: 0,
      reason: 'selection-cleared',
    }
    return {
      selectedCount: 0,
      totalCount: rows.length,
      overlay: lastLineOverlayResult,
    }
  }

  const field = typeof selection?.field === 'string' ? selection.field : null
  const values = Array.isArray(selection?.values) ? selection.values : []
  const selectedSet = new Set(values.map((value) => normalizeLineSeriesValue(value)).filter(Boolean))
  const matchedRows = rows.filter((row) => field && selectedSet.has(String(row?.[field]).trim()))

  if (field === 'series') {
    const mappings = mapLinePathsToSeries(surface, paths)
    let selectedEntries = mappings
      .filter(({ series }) => lineSeriesMatches(series, selectedSet))
    if (selectedEntries.length === 0) {
      selectedEntries = fallbackLineEntriesByKnownIndexSeries(paths, selectedSet)
    }
    const selectedPaths = new Set(selectedEntries.map((entry) => entry.path))
    mappings.forEach(({ path }) => {
      applyLinePathSelectionFeedback(path, selectedPaths.has(path))
    })
    lastLineOverlayResult = renderLineScreenPathOverlay(surface, selectedEntries, {
      attrName: WIDGETVA_LINE_SELECTION_ATTR,
      stroke: '#dc2626',
      strokeWidth: '4',
      opacity: '0.96',
      dimOriginal: selectedEntries.length > 0,
    })
    lastLineOverlayResult = {
      ...lastLineOverlayResult,
      field,
      requestedValues: values.map((value) => String(value)),
      matchedSeries: selectedEntries.map((entry) => entry.series).filter((series) => series != null),
    }
  } else if (field === 'xValue') {
    const sliceResult = renderLineSliceOverlay(surface, values)
    lastLineOverlayResult = {
      ...(sliceResult || {}),
      field,
      requestedValues: values.map((value) => String(value)),
      kind: 'slice',
    }
  } else {
    lastLineOverlayResult = {
      applied: false,
      overlayCount: 0,
      field,
      requestedValues: values.map((value) => String(value)),
      reason: 'unsupported-selection-field',
    }
  }

  return {
    selectedCount: matchedRows.length,
    totalCount: rows.length,
    overlay: lastLineOverlayResult,
  }
}

function applyLineFocus(focus = null) {
  const { surface, paths } = readSurfaceAndLinePaths()
  const mappings = mapLinePathsToSeries(surface, paths)
  removeLineSelectionOverlay(surface)
  paths.forEach((path) => clearMarkFeedback(path))
  lastLineOverlayResult = null
  if (!focus) {
    lastLineOverlayResult = {
      applied: false,
      overlayCount: 0,
      reason: 'focus-cleared',
    }
    return {
      focusedCount: 0,
      totalCount: mappings.length,
      overlay: lastLineOverlayResult,
    }
  }

  const lines = Array.isArray(focus?.lines) ? focus.lines : []
  const lineSet = new Set(lines.map((line) => normalizeLineSeriesValue(line)).filter(Boolean))
  let focusedEntries = mappings.filter(({ series }) => lineSeriesMatches(series, lineSet))
  if (focusedEntries.length === 0) {
    focusedEntries = fallbackLineEntriesByKnownIndexSeries(paths, lineSet)
  }
  const focusedPaths = new Set(focusedEntries.map((entry) => entry.path))
  const dimOpacity = Number.isFinite(focus?.dimOpacity) ? Number(focus.dimOpacity) : 0.08
  mappings.forEach(({ path }) => {
    applyLinePathFocusFeedback(path, focusedPaths.has(path), dimOpacity)
  })
  lastLineOverlayResult = renderLineScreenPathOverlay(surface, focusedEntries, {
    attrName: WIDGETVA_LINE_SELECTION_ATTR,
    stroke: '#dc2626',
    strokeWidth: '4',
    opacity: '0.96',
    dimOriginal: focusedEntries.length > 0,
  })
  lastLineOverlayResult = {
    ...lastLineOverlayResult,
    field: focus?.lineField || 'series',
    requestedValues: lines.map((line) => String(line)),
    matchedSeries: focusedEntries.map((entry) => entry.series).filter((series) => series != null),
  }

  return {
    focusedCount: focusedEntries.length,
    totalCount: mappings.length,
    overlay: lastLineOverlayResult,
  }
}

function applyLineTrend(trend = null) {
  const { surface } = readSurfaceAndLinePaths()
  lastLineAnnotationResult = {
    kind: 'trend',
    ...renderLineTrendOverlay(surface, trend),
  }
  return lastLineAnnotationResult
}

function applyLineMovingAverage(movingAverage = null) {
  const { surface, paths } = readSurfaceAndLinePaths()
  if (!movingAverage) {
    removeLineMovingAverageOverlay(surface)
    lastLineAnnotationResult = { kind: 'movingAverage', applied: false, reset: true }
    return lastLineAnnotationResult
  }
  lastLineAnnotationResult = {
    kind: 'movingAverage',
    windowSize: movingAverage?.windowSize,
    ...renderLineMovingAverageOverlay(surface, paths, movingAverage),
  }
  return lastLineAnnotationResult
}

function applyLineDrilldown(drilldown = null) {
  const { surface } = readSurfaceAndLinePaths()
  if (!drilldown) {
    removeLineDrilldownOverlay(surface)
    removeLineSliceOverlay(surface)
    lastLineAnnotationResult = { kind: 'drilldown', applied: false, reset: true }
    return lastLineAnnotationResult
  }
  lastLineAnnotationResult = {
    kind: 'drilldown',
    ...renderLineDrilldownOverlay(surface, drilldown),
  }
  return lastLineAnnotationResult
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
    mark.setAttribute?.('opacity', '1')
    mark.setAttribute?.('fill-opacity', '0.95')
    mark.setAttribute?.('fill', color)
    mark.setAttribute?.('stroke', '#111827')
    mark.setAttribute?.('stroke-width', '1.8')
    if (typeof mark?.tagName === 'string' && mark.tagName.toLowerCase() === 'circle') {
      const currentRadius = readNumber(mark.getAttribute?.('r')) || readNumber(mark.r?.baseVal?.value) || 3
      mark.setAttribute?.('r', String(Math.max(currentRadius, 4.5)))
    }
    mark.style.opacity = '1'
    mark.style.fillOpacity = '0.95'
    mark.style.fill = color
    mark.style.stroke = '#111827'
    mark.style.strokeWidth = '1.8px'
    mark.style.filter = 'drop-shadow(0 0 4px rgba(15, 23, 42, 0.24))'
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

function normalizeViewport(viewport) {
  if (!viewport || typeof viewport !== 'object' || Array.isArray(viewport)) return null
  const xDomain = Array.isArray(viewport.xDomain) && viewport.xDomain.length >= 2
    ? viewport.xDomain.slice(0, 2).map(readNumber)
    : null
  const yDomain = Array.isArray(viewport.yDomain) && viewport.yDomain.length >= 2
    ? viewport.yDomain.slice(0, 2).map(readNumber)
    : null
  return {
    ...(xDomain?.every((value) => value != null) ? { xDomain } : {}),
    ...(yDomain?.every((value) => value != null) ? { yDomain } : {}),
  }
}

function renderZoomOverlay(surface, box) {
  const doc = surface?.ownerDocument || window.document
  const group = surface?.querySelector?.(`[${WIDGETVA_ZOOM_OVERLAY_ATTR}="true"]`)
    || doc?.createElementNS?.('http://www.w3.org/2000/svg', 'g')
  const border = group?.querySelector?.('rect')
    || doc?.createElementNS?.('http://www.w3.org/2000/svg', 'rect')
  if (!group || !border) return

  group.setAttribute(WIDGETVA_ZOOM_OVERLAY_ATTR, 'true')
  group.setAttribute('pointer-events', 'none')
  border.setAttribute('x', String(box.x))
  border.setAttribute('y', String(box.y))
  border.setAttribute('width', String(box.width))
  border.setAttribute('height', String(box.height))
  border.setAttribute('fill', 'none')
  border.setAttribute('stroke', '#2563eb')
  border.setAttribute('stroke-width', '2')
  border.setAttribute('stroke-dasharray', '7 5')
  border.setAttribute('vector-effect', 'non-scaling-stroke')

  if (!border.parentNode) group.appendChild(border)
  if (!group.parentNode) surface.appendChild(group)
}

function applyScatterViewport(viewport = null) {
  const { surface, marks } = readSurfaceAndMarks()
  if (!surface || typeof surface?.tagName !== 'string' || surface.tagName.toLowerCase() !== 'svg') {
    return {
      applied: false,
      reason: 'Scatter viewport currently supports svg surfaces only.',
    }
  }

  const normalized = normalizeViewport(viewport)
  if (!normalized || (!normalized.xDomain && !normalized.yDomain)) {
    restoreSurfaceState(surface)
    currentViewport = null
    return {
      applied: true,
      reset: true,
    }
  }

  rememberSurfaceState(surface)
  const originalBox = readSvgBox(surface)
  const coordinateSpace = inferScatterCoordinateSpace(marks)
  const xDomain = normalized.xDomain || [originalBox.x, originalBox.x + originalBox.width]
  const yDomain = normalized.yDomain || [originalBox.y, originalBox.y + originalBox.height]
  const firstCorner = coordinateSpace === 'svg-local'
    ? { x: xDomain[0], y: yDomain[0] }
    : viewportPointToSvg(surface, xDomain[0], yDomain[0])
  const secondCorner = coordinateSpace === 'svg-local'
    ? { x: xDomain[1], y: yDomain[1] }
    : viewportPointToSvg(surface, xDomain[1], yDomain[1])
  const rawX = Math.min(firstCorner.x, secondCorner.x)
  const rawY = Math.min(firstCorner.y, secondCorner.y)
  const rawWidth = Math.abs(secondCorner.x - firstCorner.x)
  const rawHeight = Math.abs(secondCorner.y - firstCorner.y)
  const padX = Math.max(rawWidth * 0.08, 8)
  const padY = Math.max(rawHeight * 0.08, 8)
  const nextBox = {
    x: rawX - padX,
    y: rawY - padY,
    width: Math.max(rawWidth + (padX * 2), 1),
    height: Math.max(rawHeight + (padY * 2), 1),
  }

  surface.setAttribute('viewBox', `${nextBox.x} ${nextBox.y} ${nextBox.width} ${nextBox.height}`)
  surface.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  renderZoomOverlay(surface, nextBox)
  currentViewport = normalized

  return {
    applied: true,
    viewport: normalized,
    viewBox: nextBox,
    coordinateSpace,
  }
}

function applyLineViewport(viewport = null) {
  const { surface } = readSurfaceAndLinePaths()
  if (!surface || typeof surface?.tagName !== 'string' || surface.tagName.toLowerCase() !== 'svg') {
    currentLineViewport = viewport && typeof viewport === 'object' ? viewport : null
    lastLineViewportResult = {
      viewport: currentLineViewport,
      applied: false,
      reason: 'Observable D3 line viewport zoom currently requires an SVG surface.',
    }
    return lastLineViewportResult
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
    lastLineViewportResult = {
      viewport: null,
      applied: true,
      reset: true,
    }
    return lastLineViewportResult
  }

  const parsedStart = parseComparableAxisValue(xDomain[0])
  const parsedEnd = parseComparableAxisValue(xDomain[1])
  if (parsedStart == null || parsedEnd == null) {
    currentLineViewport = { xDomain: [...xDomain] }
    lastLineViewportResult = {
      viewport: currentLineViewport,
      applied: false,
      reason: 'Line x-domain values could not be parsed.',
    }
    return lastLineViewportResult
  }

  const low = compareComparableAxisValue(parsedStart, parsedEnd) <= 0 ? parsedStart : parsedEnd
  const high = compareComparableAxisValue(parsedStart, parsedEnd) <= 0 ? parsedEnd : parsedStart
  const plotRegion = findObservableD3PlotRegion(window)
  const xLabelEntries = readLineXAxisLabelEntries(surface)
  const labelEntries = xLabelEntries
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

  const inferredBounds = labelEntries.length === 0
    ? inferLineViewportBoundsFromYears({
        xDomain,
        surface,
        plotRegion,
        xLabels: xLabelEntries,
      })
    : null

  if (labelEntries.length === 0 && !inferredBounds) {
    currentLineViewport = { xDomain: [...xDomain] }
    lastLineViewportResult = {
      viewport: currentLineViewport,
      applied: false,
      reason: 'No visible x-axis labels matched the requested line x-domain.',
      matchedLabels: [],
      availableLabels: xLabelEntries.map((entry) => entry.text),
    }
    return lastLineViewportResult
  }

  const surfaceRect = readRectLike(surface)
  const plotLocal = plotRegion?.localRect || { left: 0, top: 0, width: surfaceRect.width, height: surfaceRect.height }
  const centers = labelEntries.map((entry) => entry.rect.left + (entry.rect.width / 2))
  const leftPx = inferredBounds ? inferredBounds.leftPx : Math.min(...centers)
  const rightPx = inferredBounds ? inferredBounds.rightPx : Math.max(...centers)
  const left = Math.max(leftPx - surfaceRect.left - 24, plotLocal.left)
  const right = Math.min(rightPx - surfaceRect.left + 24, plotLocal.left + plotLocal.width)
  const width = Math.max(right - left, 1)
  const top = plotLocal.top
  const height = Math.max(plotLocal.height, 1)

  surface.setAttribute('viewBox', `${left} ${top} ${width} ${height}`)
  surface.setAttribute('preserveAspectRatio', 'none')
  currentLineViewport = { xDomain: [...xDomain] }
  lastLineViewportResult = {
    viewport: currentLineViewport,
    applied: true,
    matchedLabels: labelEntries.map((entry) => entry.text),
    availableLabels: xLabelEntries.map((entry) => entry.text),
    inferredBounds,
    viewBox: [left, top, width, height],
    surfaceRect,
    plotLocal,
  }
  return lastLineViewportResult
}

function readDebugSnapshot() {
  const { surface, marks } = readSurfaceAndMarks()
  const lineSurfaceAndPaths = readSurfaceAndLinePaths()
  const rows = readObservableD3ScatterRows(window)
  return {
    route: 'worker',
    surface: describeObservableD3Surface(window),
    plotRegion: findObservableD3PlotRegion(window),
    surfaceRect: readRectLike(surface),
    markCount: marks.length,
    rowSummary: summarizeObservableD3ScatterRows(rows),
    viewport: currentViewport,
    barSelection: lastBarSelection,
    barRows: readObservableD3BarRows(window),
    lineOverlay: lastLineOverlayResult,
    lineViewport: currentLineViewport,
    lineViewportResult: lastLineViewportResult,
    lineAnnotation: lastLineAnnotationResult,
    lineSurfaceRect: readRectLike(lineSurfaceAndPaths.surface),
    lineSurfaceViewBox: lineSurfaceAndPaths.surface?.getAttribute?.('viewBox') || null,
    lineSurfaceOriginalViewBox: lineSurfaceAndPaths.surface?.getAttribute?.(WIDGETVA_VIEWBOX_CACHE_ATTR) || null,
    lineRows: readObservableD3LineRows(window),
    linePathSeries: mapLinePathsToSeries(lineSurfaceAndPaths.surface, lineSurfaceAndPaths.paths)
      .map(({ path, series }) => ({
        series,
        endpoint: readLinePathEndpoint(path),
        stroke: path?.getAttribute?.('stroke') || path?.style?.stroke || null,
      })),
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
