import {
  describeObservableD3Surface,
  findObservableD3PointMarks,
  findPrimaryObservableD3Surface,
  readObservableD3ScatterRows,
  summarizeObservableD3ScatterRows,
} from 'widgetva-kit/page-integrations'

const REQUEST_TYPE = 'widgetva:observable-d3-worker-request'
const RESPONSE_TYPE = 'widgetva:observable-d3-worker-response'
const SOURCE_TOP = 'widgetva-observable-d3-top'
const SOURCE_WORKER = 'widgetva-observable-d3-worker'
const WIDGETVA_BRUSH_OVERLAY_ATTR = 'data-widgetva-brush-overlay'
const WIDGETVA_SURFACE_PROBE_ATTR = 'data-widgetva-surface-probe'
const originalMarkState = new WeakMap()

function readSurfaceAndMarks() {
  const surface = findPrimaryObservableD3Surface(window)
  const marks = findObservableD3PointMarks(window)
  return { surface, marks }
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
  surface?.querySelector?.(`[${WIDGETVA_SURFACE_PROBE_ATTR}="true"]`)?.remove?.()
}

function renderSurfaceProbe(surface) {
  if (!surface || typeof surface?.tagName !== 'string' || surface.tagName.toLowerCase() !== 'svg') {
    return {
      ok: false,
      reason: 'Surface probe currently supports svg surfaces only.',
    }
  }

  const doc = surface.ownerDocument || window.document
  const existing = surface.querySelector?.(`[${WIDGETVA_SURFACE_PROBE_ATTR}="true"]`)
  if (existing) {
    existing.remove?.()
  }

  const rect = readRectLike(surface)
  const group = doc?.createElementNS?.('http://www.w3.org/2000/svg', 'g')
  const border = doc?.createElementNS?.('http://www.w3.org/2000/svg', 'rect')
  const labelBg = doc?.createElementNS?.('http://www.w3.org/2000/svg', 'rect')
  const label = doc?.createElementNS?.('http://www.w3.org/2000/svg', 'text')
  if (!group || !border || !labelBg || !label) {
    return {
      ok: false,
      reason: 'Unable to create svg probe nodes.',
    }
  }

  group.setAttribute(WIDGETVA_SURFACE_PROBE_ATTR, 'true')
  group.setAttribute('pointer-events', 'none')

  border.setAttribute('x', '0')
  border.setAttribute('y', '0')
  border.setAttribute('width', String(rect.width))
  border.setAttribute('height', String(rect.height))
  border.setAttribute('fill', 'none')
  border.setAttribute('stroke', '#ef4444')
  border.setAttribute('stroke-width', '6')
  border.setAttribute('stroke-dasharray', '18 10')

  labelBg.setAttribute('x', '12')
  labelBg.setAttribute('y', '12')
  labelBg.setAttribute('width', '170')
  labelBg.setAttribute('height', '34')
  labelBg.setAttribute('fill', '#ef4444')
  labelBg.setAttribute('rx', '6')

  label.setAttribute('x', '24')
  label.setAttribute('y', '35')
  label.setAttribute('fill', '#ffffff')
  label.setAttribute('font-size', '20')
  label.setAttribute('font-weight', '700')
  label.textContent = 'WidgetVA Probe'

  group.appendChild(border)
  group.appendChild(labelBg)
  group.appendChild(label)
  surface.appendChild(group)

  return {
    ok: true,
    surfaceRect: rect,
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

function readDebugSnapshot() {
  const { surface, marks } = readSurfaceAndMarks()
  const rows = readObservableD3ScatterRows(window)
  return {
    route: 'worker',
    surface: describeObservableD3Surface(window),
    surfaceRect: readRectLike(surface),
    markCount: marks.length,
    rowSummary: summarizeObservableD3ScatterRows(rows),
  }
}

function renderDebugProbe() {
  const { surface } = readSurfaceAndMarks()
  return renderSurfaceProbe(surface)
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
      result = describeObservableD3Surface(window)
    } else if (message.method === 'readScatterRows') {
      result = {
        rows: readObservableD3ScatterRows(window),
      }
    } else if (message.method === 'applyScatterSelection') {
      result = applyScatterSelection(message.params?.selection || null)
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
