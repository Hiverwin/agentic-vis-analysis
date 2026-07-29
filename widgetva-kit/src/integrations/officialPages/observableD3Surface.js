import { cloneJsonValue as clone } from '../../shared/clone.js'
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

function isPrimitiveSemanticValue(value) {
  return value == null || ['string', 'number', 'boolean'].includes(typeof value)
}

function extractPrimitiveSemanticFields(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, entryValue]) => {
        if (typeof key !== 'string' || key.length === 0) return false
        if (key.startsWith('__')) return false
        return isPrimitiveSemanticValue(entryValue)
      }),
  )
}

function isGeometryLikeFieldName(fieldName = '') {
  return [
    'x',
    'y',
    'z',
    'cx',
    'cy',
    'r',
    'index',
    'i',
  ].includes(String(fieldName).trim())
}

function scoreSemanticFieldSet(fields = {}) {
  return Object.entries(fields).reduce((score, [fieldName, value]) => {
    if (isGeometryLikeFieldName(fieldName)) {
      return score
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return score + 3
    }
    if (typeof value === 'string' && value.length > 0) {
      return score + 2
    }
    if (typeof value === 'boolean') {
      return score + 1
    }
    return score
  }, 0)
}

function readSemanticDatumFields(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const topLevelFields = extractPrimitiveSemanticFields(value)
  const nestedCandidates = ['data', 'datum', 'row', 'source', 'item', 'value']
    .map((key) => extractPrimitiveSemanticFields(value?.[key]))
    .filter((fields) => Object.keys(fields).length > 0)

  const bestNestedFields = nestedCandidates.sort((left, right) => {
    const scoreDelta = scoreSemanticFieldSet(right) - scoreSemanticFieldSet(left)
    if (scoreDelta !== 0) return scoreDelta
    return Object.keys(right).length - Object.keys(left).length
  })[0] || {}

  const shouldPreferNested = scoreSemanticFieldSet(bestNestedFields) > scoreSemanticFieldSet(topLevelFields)
    || (
      scoreSemanticFieldSet(bestNestedFields) === scoreSemanticFieldSet(topLevelFields)
      && Object.keys(bestNestedFields).length > Object.keys(topLevelFields).length
    )

  return shouldPreferNested
    ? { ...topLevelFields, ...bestNestedFields }
    : topLevelFields
}

function extractScatterDatumFields(mark) {
  const datum = mark?.__data__
  return readSemanticDatumFields(datum)
}

function hasSemanticScatterFields(fields = {}) {
  return Object.keys(fields).some((fieldName) => (
    fieldName !== 'id'
    && !fieldName.startsWith('__')
    && !isGeometryLikeFieldName(fieldName)
  ))
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
  if (typeof path.closest === 'function' && path.closest('[data-widgetva-line-selection-overlay="true"], [data-widgetva-line-ma-overlay="true"], [data-widgetva-line-trend-overlay="true"], [data-widgetva-line-drilldown-overlay="true"]')) return false
  const d = typeof path.getAttribute === 'function' ? path.getAttribute('d') : ''
  if (typeof d === 'string' && /z\s*$/i.test(d.trim())) return false
  const fill = typeof path.getAttribute === 'function' ? path.getAttribute('fill') : null
  if (typeof fill === 'string' && fill.trim() && !['none', 'transparent'].includes(fill.trim().toLowerCase())) return false
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

function normalizeAxisTitleText(text = '') {
  return String(text)
    .replace(/[←↑→↓]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function readScatterAxisTitle(labels = [], plotRegion = null, axis = 'x') {
  const plotLeft = plotRegion?.screenRect?.left || 0
  const plotTop = plotRegion?.screenRect?.top || 0
  const plotWidth = plotRegion?.screenRect?.width || 0
  const plotHeight = plotRegion?.screenRect?.height || 0
  const plotRight = plotLeft + plotWidth
  const plotBottom = plotTop + plotHeight

  const candidates = labels
    .filter((label) => !isNumericOrDateLikeText(label.text))
    .map((label) => {
      const centerX = label.rect.left + (label.rect.width / 2)
      const centerY = label.rect.top + (label.rect.height / 2)
      if (axis === 'x') {
        if (centerX < plotLeft || centerX > plotRight) return null
        if (centerY < plotBottom) return null
        return { label, penalty: Math.abs(centerX - (plotLeft + (plotWidth / 2))) }
      }
      if (centerY < plotTop || centerY > plotBottom) return null
      if (centerX > plotLeft) return null
      return { label, penalty: Math.abs(centerY - (plotTop + (plotHeight / 2))) }
    })
    .filter(Boolean)
    .sort((left, right) => left.penalty - right.penalty)

  return normalizeAxisTitleText(candidates[0]?.label?.text || '')
}

function readScatterAxisTickEntries(labels = [], plotRegion = null, axis = 'x') {
  const plotLeft = plotRegion?.screenRect?.left || 0
  const plotTop = plotRegion?.screenRect?.top || 0
  const plotWidth = plotRegion?.screenRect?.width || 0
  const plotHeight = plotRegion?.screenRect?.height || 0
  const plotRight = plotLeft + plotWidth
  const plotBottom = plotTop + plotHeight
  const axisTolerance = 18

  return labels
    .filter((label) => isNumericOrDateLikeText(label.text))
    .map((label) => {
      const value = readNumber(label.text.replace(/,/g, ''))
      if (value == null) return null
      const centerX = label.rect.left + (label.rect.width / 2)
      const centerY = label.rect.top + (label.rect.height / 2)
      if (axis === 'x') {
        if (centerX < plotLeft || centerX > plotRight) return null
        if (centerY < plotBottom - 10) return null
        return { value, position: centerX }
      }
      if (centerY < plotTop - axisTolerance || centerY > plotBottom + axisTolerance) return null
      if (centerX > plotLeft + 8) return null
      return { value, position: centerY }
    })
    .filter(Boolean)
}

function inferLinearAxisProjection(ticks = []) {
  const sorted = (Array.isArray(ticks) ? ticks : [])
    .filter((tick) => Number.isFinite(tick?.value) && Number.isFinite(tick?.position))
    .sort((left, right) => left.position - right.position)
  if (sorted.length < 2) return null
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (first.position === last.position) return null
  const slope = (last.value - first.value) / (last.position - first.position)
  const intercept = first.value - (slope * first.position)
  return {
    slope,
    intercept,
    project(position) {
      return (slope * position) + intercept
    },
  }
}

function inferScatterSemanticFallback({ root, rows, semanticHints = {} }) {
  const normalizedRows = Array.isArray(rows) ? rows : []
  if (normalizedRows.length === 0) return normalizedRows
  if (normalizedRows.some((row) => hasSemanticScatterFields(row))) return normalizedRows

  const surface = findPrimaryObservableD3Surface(root)
  const plotRegion = findObservableD3PlotRegion(root)
  const labels = readTextNodes(surface)
  const xTicks = readScatterAxisTickEntries(labels, plotRegion, 'x')
  const yTicks = readScatterAxisTickEntries(labels, plotRegion, 'y')
  const xProjection = inferLinearAxisProjection(xTicks)
  const yProjection = inferLinearAxisProjection(yTicks)

  const xField = semanticHints?.xField || readScatterAxisTitle(labels, plotRegion, 'x') || null
  const yField = semanticHints?.yField || readScatterAxisTitle(labels, plotRegion, 'y') || null
  if (!xProjection || !yProjection || !xField || !yField) {
    return normalizedRows
  }

  return normalizedRows.map((row) => ({
    ...row,
    [xField]: xProjection.project(row.__screenX),
    [yField]: yProjection.project(row.__screenY),
  }))
}

export function readObservableD3ScatterRows(root = globalThis.window, options = {}) {
  const marks = findObservableD3PointMarks(root)
  const rows = marks
    .map((mark, index) => {
      const tagName = typeof mark?.tagName === 'string' ? mark.tagName.toLowerCase() : ''
      const center = tagName === 'circle' ? readCircleCenter(mark) : readPathCenter(mark)
      if (!center) return null
      return {
        id: `pt_${index + 1}`,
        __screenX: center.cx,
        __screenY: center.cy,
        ...extractScatterDatumFields(mark),
      }
    })
    .filter(Boolean)
  return inferScatterSemanticFallback({
    root,
    rows,
    semanticHints: options?.semanticHints || {},
  })
}

function normalizeRefToken(value, fallback = 'field') {
  const token = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return token || fallback
}

function makeObservableD3ScatterMatrixCellRef({ xField = null, yField = null, index = 0 } = {}) {
  const xToken = normalizeRefToken(xField, `x-${index + 1}`)
  const yToken = normalizeRefToken(yField, `y-${index + 1}`)
  return `wl://observable-d3/scatter-matrix/cell/${xToken}-${yToken}`
}

function normalizeMatrixFields(fields = []) {
  return (Array.isArray(fields) ? fields : [])
    .map((field) => (typeof field === 'string' ? field.trim() : ''))
    .filter((field, index, values) => field.length > 0 && values.indexOf(field) === index)
}

function readMatrixFieldsFromLabels(surface) {
  return readTextNodes(surface)
    .map((label) => normalizeAxisTitleText(label.text))
    .filter((text) => (
      text.length > 0
      && text.length <= 40
      && !isNumericOrDateLikeText(text)
      && !/^d3$/i.test(text)
      && !/^chart$/i.test(text)
    ))
    .filter((text, index, values) => values.indexOf(text) === index)
}

function findMatrixBandIndex(value, bands = []) {
  if (!Number.isFinite(value) || bands.length === 0) return -1
  let bestIndex = 0
  let bestDistance = Math.abs(value - bands[0])
  bands.forEach((band, index) => {
    const distance = Math.abs(value - band)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  })
  return bestIndex
}

function readMatrixGridBindings(groups = [], semanticHints = {}, surface = null) {
  const matrixFields = normalizeMatrixFields(semanticHints?.matrixFields)
  const labelFields = matrixFields.length >= 2 ? matrixFields : readMatrixFieldsFromLabels(surface)
  const fields = labelFields.length >= 2 ? labelFields : matrixFields
  if (fields.length < 2 || groups.length === 0) return new Map()

  const rects = groups.map((group) => readBoundingBoxLike(group.container))
  const columns = Array.from(new Set(rects.map((rect) => Math.round(rect.left)))).sort((left, right) => left - right)
  const rows = Array.from(new Set(rects.map((rect) => Math.round(rect.top)))).sort((left, right) => left - right)
  const bindings = new Map()

  groups.forEach((group, index) => {
    const rect = rects[index]
    const columnIndex = findMatrixBandIndex(Math.round(rect.left), columns)
    const rowIndex = findMatrixBandIndex(Math.round(rect.top), rows)
    if (columnIndex < 0 || rowIndex < 0) return

    const fullGrid = fields.length === columns.length && fields.length === rows.length
    const lowerTriangle = fields.length === columns.length + 1 && fields.length === rows.length + 1
    const xField = fields[columnIndex] || null
    const yField = lowerTriangle
      ? fields[rowIndex + 1] || null
      : fullGrid
        ? fields[rowIndex] || null
        : fields[rowIndex] || null

    if (xField && yField) {
      bindings.set(group, { xField, yField })
    }
  })

  return bindings
}

function readDefaultMatrixFieldDomain(fieldName = null) {
  const field = String(fieldName || '').toLowerCase()
  if (field.includes('mpg') || field.includes('economy') || field.includes('fuel')) return [10, 50]
  if (field.includes('horsepower') || field.includes('power') || field.includes('hp')) return [40, 250]
  if (field.includes('weight')) return [1500, 5500]
  if (field.includes('displacement') || field.includes('engine') || field.includes('cc')) return [50, 500]
  if (field.includes('cylinder')) return [3, 8]
  if (field.includes('0-60') || field.includes('acceleration')) return [8, 25]
  if (field === 'year' || field.endsWith(' year')) return [1970, 1983]
  return null
}

function projectScreenValueToDomain(position, bounds = null, axis = 'x', domain = null) {
  if (!Number.isFinite(position) || !bounds || !Array.isArray(domain) || domain.length < 2) return null
  const span = axis === 'x' ? bounds.width : bounds.height
  const origin = axis === 'x' ? bounds.left : bounds.top
  if (!Number.isFinite(span) || span <= 0 || !Number.isFinite(origin)) return null
  const ratio = Math.max(0, Math.min(1, (position - origin) / span))
  if (axis === 'y') {
    return domain[1] - (ratio * (domain[1] - domain[0]))
  }
  return domain[0] + (ratio * (domain[1] - domain[0]))
}

function enrichMatrixRowsWithProjectedFields(rows = [], {
  xField = null,
  yField = null,
  bounds = null,
} = {}) {
  const xDomain = readDefaultMatrixFieldDomain(xField)
  const yDomain = readDefaultMatrixFieldDomain(yField)
  if (!xField || !yField || !xDomain || !yDomain) return rows
  return rows.map((row) => {
    const next = { ...row }
    if (!Number.isFinite(next[xField])) {
      const xValue = projectScreenValueToDomain(next.__screenX, bounds, 'x', xDomain)
      if (xValue != null) next[xField] = xValue
    }
    if (!Number.isFinite(next[yField])) {
      const yValue = projectScreenValueToDomain(next.__screenY, bounds, 'y', yDomain)
      if (yValue != null) next[yField] = yValue
    }
    return next
  })
}

function findScatterMatrixCellContainer(mark, surface) {
  const chain = readAncestorChain(mark, surface)
    .filter((node) => node && node !== mark && node !== surface)
  for (const candidate of chain) {
    const rect = readBoundingBoxLike(candidate)
    if (rect.width >= 24 && rect.height >= 24) {
      return candidate
    }
  }
  return null
}

function readScatterRowFromMark(mark, index) {
  const tagName = typeof mark?.tagName === 'string' ? mark.tagName.toLowerCase() : ''
  const center = tagName === 'circle' ? readCircleCenter(mark) : readPathCenter(mark)
  if (!center) return null
  return {
    id: `pt_${index + 1}`,
    __screenX: center.cx,
    __screenY: center.cy,
    ...extractScatterDatumFields(mark),
  }
}

export function readObservableD3ScatterMatrixGroups(root = globalThis.window, options = {}) {
  const surface = findPrimaryObservableD3Surface(root)
  if (!surface) {
    return []
  }

  const marks = findObservableD3PointMarks(root)
  const groups = []
  const groupsByContainer = new Map()
  marks.forEach((mark, markIndex) => {
    const container = findScatterMatrixCellContainer(mark, surface)
    if (!container) return
    const row = readScatterRowFromMark(mark, markIndex)
    if (!row) return
    if (!groupsByContainer.has(container)) {
      const group = {
        container,
        marks: [],
        rows: [],
      }
      groupsByContainer.set(container, group)
      groups.push(group)
    }
    const group = groupsByContainer.get(container)
    group.marks.push(mark)
    group.rows.push(row)
  })

  const minCells = Number.isFinite(options?.minCells) ? Math.max(1, Number(options.minCells)) : 2
  const minRowsPerCell = Number.isFinite(options?.minRowsPerCell) ? Math.max(1, Number(options.minRowsPerCell)) : 2
  const gridBindings = readMatrixGridBindings(groups, options?.semanticHints || {}, surface)
  const cells = groups
    .filter((group) => group.rows.length >= minRowsPerCell)
    .map((group, index) => {
      const inferredRows = inferScatterSemanticFallback({
        root,
        rows: group.rows,
        semanticHints: options?.semanticHints || {},
      })
      const bindings = inferObservableD3ScatterFieldBindings(inferredRows)
      const gridBinding = gridBindings.get(group) || null
      const xField = bindings?.xField || gridBinding?.xField || null
      const yField = bindings?.yField || gridBinding?.yField || null
      const bounds = readBoundingBoxLike(group.container)
      const rows = enrichMatrixRowsWithProjectedFields(inferredRows, {
        xField,
        yField,
        bounds,
      })
      return {
        ref: makeObservableD3ScatterMatrixCellRef({ xField, yField, index }),
        xField,
        yField,
        bounds,
        rowCount: rows.length,
        container: group.container,
        marks: rows.map((row, rowIndex) => ({
          row,
          mark: group.marks?.[rowIndex] || null,
        })),
        rows,
      }
    })

  const hasMatrixShape = cells.length >= minCells
  return hasMatrixShape ? cells : []
}

export function readObservableD3ScatterMatrix(root = globalThis.window, options = {}) {
  const cells = readObservableD3ScatterMatrixGroups(root, options)
  const rowKeys = new Set()
  const rows = []
  for (const cell of cells) {
    for (const row of Array.isArray(cell?.rows) ? cell.rows : []) {
      const semanticEntries = Object.entries(row || {})
        .filter(([key]) => key !== 'id' && !key.startsWith('__screen'))
        .sort(([left], [right]) => left.localeCompare(right))
      const key = semanticEntries.length > 0
        ? JSON.stringify(semanticEntries)
        : JSON.stringify(Object.entries(row || {}).sort(([left], [right]) => left.localeCompare(right)))
      if (rowKeys.has(key)) continue
      rowKeys.add(key)
      rows.push(clone(row))
    }
  }
  return {
    kind: 'scatterMatrix',
    cells: cells.map(({ container: _container, marks: _marks, ...cell }) => cell),
    rows,
    rowCount: cells.length > 0 ? Math.max(...cells.map((cell) => cell.rowCount), 0) : rows.length,
  }
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function collectScatterNumericFieldValues(rows = [], fieldName = '') {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => row?.[fieldName])
    .filter(isFiniteNumber)
}

function computePearsonCorrelation(left = [], right = []) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || left.length < 2) {
    return null
  }

  const count = left.length
  const leftMean = left.reduce((sum, value) => sum + value, 0) / count
  const rightMean = right.reduce((sum, value) => sum + value, 0) / count

  let numerator = 0
  let leftVariance = 0
  let rightVariance = 0
  for (let index = 0; index < count; index += 1) {
    const leftDelta = left[index] - leftMean
    const rightDelta = right[index] - rightMean
    numerator += leftDelta * rightDelta
    leftVariance += leftDelta * leftDelta
    rightVariance += rightDelta * rightDelta
  }

  if (leftVariance === 0 || rightVariance === 0) return null
  return numerator / Math.sqrt(leftVariance * rightVariance)
}

function rankScatterFieldCorrelation(rows = [], screenField = '__screenX') {
  const normalizedRows = Array.isArray(rows) ? rows : []
  if (normalizedRows.length < 2) return []

  const candidateFields = Object.keys(normalizedRows[0] || {})
    .filter((fieldName) => fieldName !== 'id' && !fieldName.startsWith('__'))
    .filter((fieldName) => collectScatterNumericFieldValues(normalizedRows, fieldName).length >= 2)

  return candidateFields
    .map((fieldName) => {
      const pairs = normalizedRows
        .map((row) => {
          const semanticValue = row?.[fieldName]
          const screenValue = row?.[screenField]
          return isFiniteNumber(semanticValue) && isFiniteNumber(screenValue)
            ? [semanticValue, screenValue]
            : null
        })
        .filter(Boolean)
      if (pairs.length < 2) return null

      const semanticValues = pairs.map(([semanticValue]) => semanticValue)
      const screenValues = pairs.map(([, screenValue]) => screenValue)
      const correlation = computePearsonCorrelation(semanticValues, screenValues)
      if (correlation == null) return null

      return {
        field: fieldName,
        score: Math.abs(correlation),
        correlation,
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)
}

export function inferObservableD3ScatterFieldBindings(rows = []) {
  const xCandidates = rankScatterFieldCorrelation(rows, '__screenX')
  const yCandidates = rankScatterFieldCorrelation(rows, '__screenY')

  const xField = xCandidates[0]?.field || null
  let yField = yCandidates[0]?.field || null

  if (xField && yField === xField) {
    yField = yCandidates.find((candidate) => candidate.field !== xField)?.field || yField
  }

  return {
    xField,
    yField,
  }
}

function normalizeScatterSelectionFields(selection = {}, rows = []) {
  const explicitFields = Array.isArray(selection?.fields)
    ? selection.fields.filter((fieldName) => typeof fieldName === 'string' && fieldName.length > 0)
    : []
  if (explicitFields.length >= 2) {
    return {
      xField: explicitFields[0],
      yField: explicitFields[1],
    }
  }

  const fieldBindings = inferObservableD3ScatterFieldBindings(rows)
  return {
    xField: fieldBindings.xField || '__screenX',
    yField: fieldBindings.yField || '__screenY',
  }
}

function normalizeScatterDomain(selection = {}) {
  const xDomain = Array.isArray(selection?.domain?.xDomain) ? selection.domain.xDomain : null
  const yDomain = Array.isArray(selection?.domain?.yDomain) ? selection.domain.yDomain : null
  if (!xDomain || !yDomain || xDomain.length < 2 || yDomain.length < 2) return null
  return {
    xDomain: xDomain.slice(0, 2),
    yDomain: yDomain.slice(0, 2),
  }
}

function valueWithinDomain(value, domain = []) {
  if (value == null || domain.length < 2) return false
  const low = Math.min(domain[0], domain[1])
  const high = Math.max(domain[0], domain[1])
  return value >= low && value <= high
}

export function rowMatchesObservableD3ScatterSelection(row = {}, selection = {}, rows = []) {
  const domain = normalizeScatterDomain(selection)
  if (!domain) return false

  const { xField, yField } = normalizeScatterSelectionFields(selection, rows)
  return (
    valueWithinDomain(row?.[xField], domain.xDomain)
    && valueWithinDomain(row?.[yField], domain.yDomain)
  )
}

export function projectObservableD3ScatterSelection(selection = {}, rows = []) {
  const domain = normalizeScatterDomain(selection)
  if (!domain) return null

  const normalizedRows = Array.isArray(rows) ? rows : []
  const { xField, yField } = normalizeScatterSelectionFields(selection, normalizedRows)
  if (xField === '__screenX' && yField === '__screenY') {
    return {
      fields: ['__screenX', '__screenY'],
      domain: {
        xDomain: domain.xDomain.slice(0, 2),
        yDomain: domain.yDomain.slice(0, 2),
      },
      matchedRows: normalizedRows.filter((row) => rowMatchesObservableD3ScatterSelection(row, selection, normalizedRows)),
    }
  }

  const matchedRows = normalizedRows.filter((row) => rowMatchesObservableD3ScatterSelection(row, selection, normalizedRows))
  if (matchedRows.length === 0) {
    return {
      fields: ['__screenX', '__screenY'],
      domain: null,
      matchedRows: [],
    }
  }

  const projectedXs = matchedRows.map((row) => row?.__screenX).filter(isFiniteNumber)
  const projectedYs = matchedRows.map((row) => row?.__screenY).filter(isFiniteNumber)
  if (projectedXs.length === 0 || projectedYs.length === 0) {
    return {
      fields: ['__screenX', '__screenY'],
      domain: null,
      matchedRows: [],
    }
  }

  return {
    fields: ['__screenX', '__screenY'],
    domain: {
      xDomain: [Math.min(...projectedXs), Math.max(...projectedXs)],
      yDomain: [Math.min(...projectedYs), Math.max(...projectedYs)],
    },
    matchedRows,
  }
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

function readObservableD3LineSeriesValue(path, pathIndex = 0) {
  const datum = path?.__data__
  if (!datum || typeof datum !== 'object') return `Series ${pathIndex + 1}`

  const directCandidates = [
    datum.key,
    datum.series,
    datum.Series,
    datum.symbol,
    datum.Symbol,
    datum.name,
    datum.id,
  ]
  for (const candidate of directCandidates) {
    if (candidate == null) continue
    const text = String(candidate).trim()
    if (text) return text
  }

  const points = Array.isArray(datum)
    ? datum
    : Array.isArray(datum?.values)
      ? datum.values
      : Array.isArray(datum?.data)
        ? datum.data
        : []
  const firstPoint = points[0]
  const nestedCandidates = [
    firstPoint?.series,
    firstPoint?.Series,
    firstPoint?.symbol,
    firstPoint?.Symbol,
    firstPoint?.name,
    firstPoint?.id,
  ]
  for (const candidate of nestedCandidates) {
    if (candidate == null) continue
    const text = String(candidate).trim()
    if (text) return text
  }

  return `Series ${pathIndex + 1}`
}

function isDateLikeLineValue(value) {
  if (value == null || value === '') return false
  if (value instanceof Date && Number.isFinite(value.getTime())) return true
  if (typeof value === 'number') return false
  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed)
}

export function inferObservableD3LineBindings(rows = []) {
  const normalizedRows = Array.isArray(rows) ? rows : []
  const fieldNames = [...new Set(
    normalizedRows.flatMap((row) => Object.keys(row || {})),
  )].filter((fieldName) => (
    typeof fieldName === 'string'
    && fieldName !== 'id'
    && fieldName !== 'series'
    && fieldName !== 'xValue'
    && !fieldName.startsWith('__')
  ))

  const summarizeField = (fieldName) => {
    const values = normalizedRows
      .map((row) => row?.[fieldName])
      .filter((value) => value != null && value !== '')
    const numericValues = values
      .map((value) => (typeof value === 'number' ? value : Number(value)))
      .filter((value) => Number.isFinite(value))
    const distinctValues = new Set(values.map((value) => String(value)))
    const lowerName = fieldName.toLowerCase()
    const dateLikeCount = values.filter((value) => isDateLikeLineValue(value)).length
    return {
      fieldName,
      values,
      numericValues,
      distinctCount: distinctValues.size,
      allNumeric: values.length > 0 && numericValues.length === values.length,
      dateLikeCount,
      isTemporalName: /(date|time|year|month|day|week|quarter)/.test(lowerName),
      isSeriesLikeName: /(series|group|symbol|category|name|label)/.test(lowerName),
      isValueLikeName: /(value|count|amount|price|rate|total|close|open|high|low|volume|index)/.test(lowerName),
    }
  }

  const fieldStats = fieldNames.map(summarizeField)
  const xField = fieldStats
    .map((stats) => ({
      ...stats,
      score: (
        (stats.dateLikeCount > 0 ? 8 : 0)
        + (stats.isTemporalName ? 6 : 0)
        + (stats.distinctCount > 1 ? 2 : 0)
        + (!stats.isSeriesLikeName ? 1 : 0)
      ),
    }))
    .sort((left, right) => right.score - left.score)[0]?.fieldName
    || null

  const yField = fieldStats
    .filter((stats) => stats.fieldName !== xField)
    .filter((stats) => stats.numericValues.length > 0)
    .map((stats) => ({
      ...stats,
      score: (
        (stats.allNumeric ? 8 : 0)
        + (stats.isValueLikeName ? 5 : 0)
        + (stats.distinctCount > 1 ? 2 : 0)
      ),
    }))
    .sort((left, right) => right.score - left.score)[0]?.fieldName
    || null

  const xStats = fieldStats.find((stats) => stats.fieldName === xField) || null
  const xType = xStats?.dateLikeCount > 0 || xStats?.isTemporalName
    ? 'temporal'
    : xStats?.allNumeric
      ? 'quantitative'
      : 'nominal'

  return {
    xField,
    yField,
    xType,
  }
}

export function readObservableD3LineRows(root = globalThis.window) {
  const paths = findObservableD3LinePaths(root)
  const semanticRows = paths.flatMap((path, pathIndex) => {
    const datum = path?.__data__
    const points = Array.isArray(datum)
      ? datum
      : Array.isArray(datum?.values)
        ? datum.values
        : Array.isArray(datum?.data)
          ? datum.data
          : []
    if (points.length === 0) return []

    const series = readObservableD3LineSeriesValue(path, pathIndex)
    return points.map((point, pointIndex) => {
      const fields = readSemanticDatumFields(point)
      return {
        id: `line_${pathIndex + 1}_${pointIndex + 1}`,
        series,
        __seriesIndex: pathIndex + 1,
        ...fields,
      }
    })
  })

  if (semanticRows.length > 0) {
    const bindings = inferObservableD3LineBindings(semanticRows)
    return semanticRows.map((row) => ({
      ...row,
      xValue: bindings.xField && row?.[bindings.xField] != null
        ? String(row[bindings.xField])
        : row?.xValue != null
          ? String(row.xValue)
          : null,
    }))
  }

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
  const fieldBindings = inferObservableD3ScatterFieldBindings(normalizedRows)

  return {
    count: normalizedRows.length,
    xMin: xs.length ? Math.min(...xs) : null,
    xMax: xs.length ? Math.max(...xs) : null,
    yMin: ys.length ? Math.min(...ys) : null,
    yMax: ys.length ? Math.max(...ys) : null,
    semanticFields: Object.keys(normalizedRows[0] || {}).filter((fieldName) => fieldName !== 'id' && !fieldName.startsWith('__')),
    fieldBindings,
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
