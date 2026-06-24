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

function unionRects(rects = []) {
  const normalized = rects.filter((rect) => rect && rect.width > 0 && rect.height > 0)
  if (normalized.length === 0) return null
  const left = Math.min(...normalized.map((rect) => rect.left))
  const top = Math.min(...normalized.map((rect) => rect.top))
  const right = Math.max(...normalized.map((rect) => rect.left + rect.width))
  const bottom = Math.max(...normalized.map((rect) => rect.top + rect.height))
  return {
    left,
    top,
    width: Math.max(right - left, 0),
    height: Math.max(bottom - top, 0),
  }
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

function isLineLikePath(path) {
  if (!path) return false
  if (isPointLikePath(path)) return false
  const rect = readBoundingBoxLike(path)
  if (rect.width <= 0 || rect.height <= 0) return false
  return rect.width >= 20 || rect.height >= 20
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

export function findObservableD3LinePaths(root = globalThis.window) {
  const surface = findPrimaryObservableD3Surface(root)
  if (!surface?.querySelectorAll) return []
  return [...surface.querySelectorAll('path')].filter((path) => isLineLikePath(path))
}

function isBarLikeRect(rect) {
  if (!rect) return false
  if (rect.width <= 0 || rect.height <= 0) return false
  if (rect.width < 2 && rect.height < 2) return false
  if (rect.width > 2000 || rect.height > 2000) return false
  return true
}

export function findObservableD3BarMarks(root = globalThis.window) {
  const surface = findPrimaryObservableD3Surface(root)
  if (!surface?.querySelectorAll) return []
  return [...surface.querySelectorAll('rect')].filter((rect) => isBarLikeRect(readBoundingBoxLike(rect)))
}

function readAncestorChain(node, stopNode) {
  const chain = []
  let current = node
  while (current) {
    chain.push(current)
    if (current === stopNode) break
    current = current.parentNode || null
  }
  return chain
}

export function findObservableD3MarkContainer(root = globalThis.window) {
  const surface = findPrimaryObservableD3Surface(root)
  const marks = findObservableD3PointMarks(root)
  if (!surface || marks.length === 0) return null

  const firstChain = readAncestorChain(marks[0], surface)
  if (firstChain.length === 0) return null

  let deepestCommon = surface
  for (const candidate of firstChain) {
    const presentInAll = marks.every((mark) => readAncestorChain(mark, surface).includes(candidate))
    if (presentInAll) {
      deepestCommon = candidate
      break
    }
  }

  return deepestCommon === surface ? null : deepestCommon
}

function readLocalRectWithinSurface(surfaceRect, rect) {
  if (!surfaceRect || !rect) return null
  return {
    left: rect.left - surfaceRect.left,
    top: rect.top - surfaceRect.top,
    width: rect.width,
    height: rect.height,
  }
}

export function findObservableD3PlotRegion(root = globalThis.window) {
  const surface = findPrimaryObservableD3Surface(root)
  if (!surface) return null

  const surfaceRect = readBoundingBoxLike(surface)
  const marks = findObservableD3PointMarks(root)
  const markContainer = findObservableD3MarkContainer(root)

  if (markContainer) {
    const containerRect = readBoundingBoxLike(markContainer)
    return {
      source: 'mark-container',
      targetTag: typeof markContainer.tagName === 'string' ? markContainer.tagName.toLowerCase() : null,
      markCount: marks.length,
      screenRect: containerRect,
      localRect: readLocalRectWithinSurface(surfaceRect, containerRect),
      surfaceRect,
    }
  }

  if (marks.length > 0) {
    const markRects = marks.map((mark) => readBoundingBoxLike(mark))
    const marksUnionRect = unionRects(markRects)
    if (marksUnionRect) {
      return {
        source: 'mark-bounds',
        targetTag: 'marks-union',
        markCount: marks.length,
        screenRect: marksUnionRect,
        localRect: readLocalRectWithinSurface(surfaceRect, marksUnionRect),
        surfaceRect,
      }
    }
  }

  return {
    source: 'surface',
    targetTag: typeof surface.tagName === 'string' ? surface.tagName.toLowerCase() : null,
    markCount: marks.length,
    screenRect: surfaceRect,
    localRect: {
      left: 0,
      top: 0,
      width: surfaceRect.width,
      height: surfaceRect.height,
    },
    surfaceRect,
  }
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

function readTextNodes(surface) {
  if (!surface?.querySelectorAll) return []
  return [...surface.querySelectorAll('text')]
    .map((node) => {
      const text = typeof node?.textContent === 'string' ? node.textContent.trim() : ''
      if (!text) return null
      return {
        node,
        text,
        rect: readBoundingBoxLike(node),
      }
    })
    .filter(Boolean)
}

function isNumericOrDateLikeText(text) {
  if (typeof text !== 'string' || text.length === 0) return false
  return /^-?\d+([.,]\d+)?$/.test(text)
    || /^\d{4}([/-]\d{1,2}([/-]\d{1,2})?)?$/.test(text)
    || /^[A-Z][a-z]{2,8}\s+\d{4}$/.test(text)
}

function inferBarOrientation(barRects = []) {
  if (!Array.isArray(barRects) || barRects.length === 0) return 'vertical'
  const avgWidth = barRects.reduce((sum, rect) => sum + rect.width, 0) / barRects.length
  const avgHeight = barRects.reduce((sum, rect) => sum + rect.height, 0) / barRects.length
  return avgHeight >= avgWidth ? 'vertical' : 'horizontal'
}

function pickBarCategoryLabel({ rect, labels, orientation, plotRegion }) {
  if (!Array.isArray(labels) || labels.length === 0) return null
  const centerX = rect.left + (rect.width / 2)
  const centerY = rect.top + (rect.height / 2)
  const plotBottom = plotRegion?.screenRect?.top + plotRegion?.screenRect?.height
  const plotLeft = plotRegion?.screenRect?.left

  const scored = labels.map((label) => {
    const labelCenterX = label.rect.left + (label.rect.width / 2)
    const labelCenterY = label.rect.top + (label.rect.height / 2)
    let penalty = 0
    if (orientation === 'vertical') {
      penalty += Math.abs(labelCenterX - centerX)
      if (Number.isFinite(plotBottom) && labelCenterY < plotBottom - 8) penalty += 2000
    } else {
      penalty += Math.abs(labelCenterY - centerY)
      if (Number.isFinite(plotLeft) && labelCenterX > plotLeft + 8) penalty += 2000
    }
    return { label, penalty }
  })

  scored.sort((left, right) => left.penalty - right.penalty)
  return scored[0]?.label?.text || null
}

export function readObservableD3BarRows(root = globalThis.window) {
  const surface = findPrimaryObservableD3Surface(root)
  const marks = findObservableD3BarMarks(root)
  const plotRegion = findObservableD3PlotRegion(root)
  const labels = readTextNodes(surface)
  const rects = marks.map((mark) => readBoundingBoxLike(mark))
  const orientation = inferBarOrientation(rects)

  return marks
    .map((mark, index) => {
      const rect = readBoundingBoxLike(mark)
      const category = pickBarCategoryLabel({
        rect,
        labels,
        orientation,
        plotRegion,
      }) || `Category ${index + 1}`
      return {
        id: `bar_${index + 1}`,
        category,
        __screenX: rect.left + (rect.width / 2),
        __screenY: rect.top + (rect.height / 2),
        __barLeft: rect.left,
        __barTop: rect.top,
        __barWidth: rect.width,
        __barHeight: rect.height,
      }
    })
    .filter(Boolean)
}

export function readObservableD3LineSeriesLabels(root = globalThis.window) {
  const surface = findPrimaryObservableD3Surface(root)
  const plotRegion = findObservableD3PlotRegion(root)
  const labels = readTextNodes(surface)
  const plotRight = plotRegion?.screenRect?.left + plotRegion?.screenRect?.width
  const plotTop = plotRegion?.screenRect?.top || 0
  const plotBottom = plotTop + (plotRegion?.screenRect?.height || 0)

  return labels
    .filter((label) => {
      if (isNumericOrDateLikeText(label.text)) return false
      const centerY = label.rect.top + (label.rect.height / 2)
      return centerY >= plotTop && centerY <= plotBottom && label.rect.left >= (plotRight - 40)
    })
    .map((label) => label.text)
}

export function readObservableD3LineXAxisLabels(root = globalThis.window) {
  const surface = findPrimaryObservableD3Surface(root)
  const plotRegion = findObservableD3PlotRegion(root)
  const labels = readTextNodes(surface)
  const plotLeft = plotRegion?.screenRect?.left || 0
  const plotRight = plotLeft + (plotRegion?.screenRect?.width || 0)
  const plotBottom = plotRegion?.screenRect?.top + (plotRegion?.screenRect?.height || 0)

  return labels
    .filter((label) => {
      const centerX = label.rect.left + (label.rect.width / 2)
      const centerY = label.rect.top + (label.rect.height / 2)
      if (centerX < plotLeft || centerX > plotRight) return false
      if (centerY < plotBottom - 8) return false
      return isNumericOrDateLikeText(label.text)
    })
    .map((label) => label.text)
}

export function readObservableD3LineRows(root = globalThis.window) {
  const series = readObservableD3LineSeriesLabels(root)
  const xValues = readObservableD3LineXAxisLabels(root)
  const seriesValues = series.length > 0 ? series : ['Series 1']
  const domainValues = xValues.length > 0 ? xValues : ['Point 1']

  return seriesValues.flatMap((seriesName, seriesIndex) =>
    domainValues.map((xValue, pointIndex) => ({
      id: `line_${seriesIndex + 1}_${pointIndex + 1}`,
      series: seriesName,
      xValue,
      __seriesIndex: seriesIndex + 1,
    })))
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
  const plotRegion = findObservableD3PlotRegion(normalizedRoot)

  return {
    surfaceTag: summary?.tagName || null,
    summary,
    plotRegion,
    inferredKind: inferObservableD3WidgetKindFromSurface(summary || {}, notebook),
  }
}
