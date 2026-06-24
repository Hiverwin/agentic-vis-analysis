function normalizeRoot(root) {
  if (!root || typeof root !== 'object') {
    throw new Error('A browser-like root object is required.')
  }
  return root
}

function readDocument(root) {
  if (root?.document) return root.document
  if (typeof root?.querySelectorAll === 'function') return root
  return null
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function readNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function readElements(doc, selector) {
  if (!doc?.querySelectorAll) return []
  return [...doc.querySelectorAll(selector)]
}

function readBoundingBoxLike(node) {
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

function computeArea(node) {
  const rect = readBoundingBoxLike(node)
  return rect.width * rect.height
}

function pickLargestNode(nodes = []) {
  return asArray(nodes).reduce((best, node) => {
    if (!best) return node
    return computeArea(node) > computeArea(best) ? node : best
  }, null)
}

function summarizeSvgNode(svg) {
  if (!svg?.querySelectorAll) {
    return {
      tagName: 'svg',
      circleCount: 0,
      rectCount: 0,
      pathCount: 0,
      lineCount: 0,
      textCount: 0,
    }
  }

  return {
    tagName: 'svg',
    circleCount: svg.querySelectorAll('circle').length,
    rectCount: svg.querySelectorAll('rect').length,
    pathCount: svg.querySelectorAll('path').length,
    lineCount: svg.querySelectorAll('line').length,
    textCount: svg.querySelectorAll('text').length,
  }
}

export function findPrimaryObservableD3Surface(root = globalThis.window) {
  const doc = readDocument(normalizeRoot(root))
  const svgs = readElements(doc, 'svg')
  const canvases = readElements(doc, 'canvas')
  const primarySvg = pickLargestNode(svgs)
  const primaryCanvas = pickLargestNode(canvases)

  if (!primarySvg && !primaryCanvas) return null
  if (!primaryCanvas) return primarySvg
  if (!primarySvg) return primaryCanvas

  return computeArea(primarySvg) >= computeArea(primaryCanvas) ? primarySvg : primaryCanvas
}

export function summarizeObservableD3Surface(surface) {
  if (!surface || typeof surface !== 'object') return null

  const tagName = typeof surface.tagName === 'string' ? surface.tagName.toLowerCase() : null
  const rect = readBoundingBoxLike(surface)

  if (tagName === 'svg') {
    return {
      ...summarizeSvgNode(surface),
      width: rect.width,
      height: rect.height,
      area: rect.width * rect.height,
    }
  }

  if (tagName === 'canvas') {
    return {
      tagName: 'canvas',
      width: rect.width,
      height: rect.height,
      area: rect.width * rect.height,
    }
  }

  return {
    tagName,
    width: rect.width,
    height: rect.height,
    area: rect.width * rect.height,
  }
}

function readCircleValue(circle, name) {
  const attrValue = circle?.getAttribute?.(name)
  if (attrValue != null && attrValue !== '') {
    const numeric = readNumber(attrValue)
    if (numeric != null) return numeric
  }

  const animatedValue = circle?.[name]?.baseVal?.value
  if (animatedValue != null) {
    const numeric = readNumber(animatedValue)
    if (numeric != null) return numeric
  }

  return null
}

function readCircleCenter(circle) {
  const cx = readCircleValue(circle, 'cx')
  const cy = readCircleValue(circle, 'cy')
  if (cx != null && cy != null) {
    return { cx, cy }
  }

  const rect = readBoundingBoxLike(circle)
  if (rect.width > 0 && rect.height > 0) {
    return {
      cx: rect.left + (rect.width / 2),
      cy: rect.top + (rect.height / 2),
    }
  }

  return null
}

function isPointLikePath(path) {
  const rect = readBoundingBoxLike(path)
  if (rect.width <= 0 || rect.height <= 0) return false
  if (rect.width > 24 || rect.height > 24) return false
  if ((rect.width * rect.height) > 576) return false
  return true
}

function readPathCenter(path) {
  if (!isPointLikePath(path)) return null
  const rect = readBoundingBoxLike(path)
  return {
    cx: rect.left + (rect.width / 2),
    cy: rect.top + (rect.height / 2),
  }
}

export function findObservableD3PointMarks(root = globalThis.window) {
  const surface = findPrimaryObservableD3Surface(root)
  if (!surface?.querySelectorAll) return []

  const circles = [...surface.querySelectorAll('circle')]
  const paths = [...surface.querySelectorAll('path')].filter((path) => isPointLikePath(path))

  if (circles.length > 0) {
    return circles
  }

  return paths
}

export function readObservableD3ScatterRows(root = globalThis.window) {
  const marks = findObservableD3PointMarks(root)
  return marks
    .map((mark, index) => {
      const tagName = typeof mark?.tagName === 'string' ? mark.tagName.toLowerCase() : ''
      const center = tagName === 'circle' ? readCircleCenter(mark) : readPathCenter(mark)
      if (!center) return null
      return {
        id: `pt_${index + 1}`,
        __screenX: center.cx,
        __screenY: center.cy,
      }
    })
    .filter(Boolean)
}

export function summarizeObservableD3ScatterRows(rows = []) {
  const normalizedRows = Array.isArray(rows) ? rows : []
  if (normalizedRows.length === 0) {
    return {
      count: 0,
      xMin: null,
      xMax: null,
      yMin: null,
      yMax: null,
      sample: [],
    }
  }

  const xs = normalizedRows.map((row) => row.__screenX).filter(Number.isFinite)
  const ys = normalizedRows.map((row) => row.__screenY).filter(Number.isFinite)

  return {
    count: normalizedRows.length,
    xMin: xs.length ? Math.min(...xs) : null,
    xMax: xs.length ? Math.max(...xs) : null,
    yMin: ys.length ? Math.min(...ys) : null,
    yMax: ys.length ? Math.max(...ys) : null,
    sample: normalizedRows.slice(0, 5),
  }
}

export function inferObservableD3WidgetKindFromSurface(summary = {}, notebook = null) {
  const slug = notebook?.slug || ''
  if (summary?.tagName === 'canvas') return 'custom'
  if (summary?.rectCount >= 8 && summary.rectCount > (summary.circleCount || 0)) return 'bar'
  if (summary?.circleCount >= 8 && summary.circleCount >= (summary.rectCount || 0)) return 'scatter'
  if ((summary?.pathCount || 0) >= 2 && (summary?.circleCount || 0) < 8 && (summary?.rectCount || 0) < 8) return 'line'
  if (slug.includes('scatter')) return 'scatter'
  if (slug.includes('bar')) return 'bar'
  if (slug.includes('line') || slug.includes('index-chart')) return 'line'
  return 'custom'
}

export async function waitForObservableD3Surface({
  root = globalThis.window,
  timeoutMs = 5000,
  pollMs = 25,
} = {}) {
  const normalizedRoot = normalizeRoot(root)
  const startedAt = Date.now()

  while ((Date.now() - startedAt) <= timeoutMs) {
    const surface = findPrimaryObservableD3Surface(normalizedRoot)
    if (surface) return surface
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }

  throw new Error(`Timed out waiting for an Observable D3 chart surface after ${timeoutMs}ms.`)
}

export function describeObservableD3Surface(root = globalThis.window, { notebook = null } = {}) {
  const normalizedRoot = normalizeRoot(root)
  const surface = findPrimaryObservableD3Surface(normalizedRoot)
  const summary = summarizeObservableD3Surface(surface)

  return {
    surfaceTag: summary?.tagName || null,
    summary,
    inferredKind: inferObservableD3WidgetKindFromSurface(summary || {}, notebook),
  }
}
