import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeObservableD3Surface,
  findObservableD3MarkContainer,
  findObservableD3PointMarks,
  findObservableD3PlotRegion,
  findPrimaryObservableD3Surface,
  inferObservableD3WidgetKindFromSurface,
  projectObservableD3ScatterSelection,
  readObservableD3ScatterMatrix,
  readObservableD3ScatterMatrixGroups,
  readObservableD3LineRows,
  readObservableD3ScatterRows,
  rowMatchesObservableD3ScatterSelection,
  summarizeObservableD3Surface,
  waitForObservableD3Surface,
} from './observableD3Surface.js'

function makeShapeNode(tagName, { width = 0, height = 0, counts = {} } = {}) {
  return {
    tagName: tagName.toUpperCase(),
    getBoundingClientRect() {
      return { width, height }
    },
    querySelectorAll(selector) {
      const mapping = {
        circle: counts.circle || 0,
        rect: counts.rect || 0,
        path: counts.path || 0,
        line: counts.line || 0,
        text: counts.text || 0,
      }
      if (selector === 'path') {
        return Array.from({ length: mapping.path || 0 }, (_, index) => makePointPath({
          left: index * 10,
          top: index * 10,
        }))
      }
      return Array.from({ length: mapping[selector] || 0 }, () => ({}))
    },
  }
}

function makePointPath({ left, top, width = 6, height = 6 }) {
  return {
    tagName: 'PATH',
    getBoundingClientRect() {
      return { left, top, width, height }
    },
  }
}

function makeNode(tagName, rect, parentNode = null) {
  return {
    tagName: tagName.toUpperCase(),
    parentNode,
    getBoundingClientRect() {
      return rect
    },
  }
}

function makeTextNode(text, rect) {
  return {
    tagName: 'TEXT',
    textContent: text,
    getBoundingClientRect() {
      return rect
    },
  }
}

function makeDoc({ svgs = [], canvases = [] } = {}) {
  return {
    querySelectorAll(selector) {
      if (selector === 'svg') return svgs
      if (selector === 'canvas') return canvases
      return []
    },
  }
}

test('findPrimaryObservableD3Surface picks the largest svg/canvas surface', () => {
  const smallSvg = makeShapeNode('svg', { width: 200, height: 100 })
  const largeSvg = makeShapeNode('svg', { width: 800, height: 600 })
  const canvas = makeShapeNode('canvas', { width: 300, height: 200 })

  const surface = findPrimaryObservableD3Surface({
    document: makeDoc({
      svgs: [smallSvg, largeSvg],
      canvases: [canvas],
    }),
  })

  assert.equal(surface, largeSvg)
})

test('summarizeObservableD3Surface counts svg primitives', () => {
  const summary = summarizeObservableD3Surface(
    makeShapeNode('svg', {
      width: 640,
      height: 480,
      counts: {
        circle: 24,
        rect: 2,
        path: 3,
        line: 6,
        text: 10,
      },
    }),
  )

  assert.deepEqual(summary, {
    tagName: 'svg',
    circleCount: 24,
    rectCount: 2,
    pathCount: 3,
    lineCount: 6,
    textCount: 10,
    width: 640,
    height: 480,
    area: 307200,
  })
})

test('inferObservableD3WidgetKindFromSurface uses notebook slug and surface heuristics', () => {
  assert.equal(
    inferObservableD3WidgetKindFromSurface({ tagName: 'svg', circleCount: 20 }, { slug: 'scatterplot' }),
    'scatter',
  )
  assert.equal(
    inferObservableD3WidgetKindFromSurface({ tagName: 'svg', rectCount: 14, circleCount: 0 }, null),
    'bar',
  )
  assert.equal(
    inferObservableD3WidgetKindFromSurface({ tagName: 'svg', pathCount: 4, rectCount: 1, circleCount: 0 }, null),
    'line',
  )
})

test('waitForObservableD3Surface resolves after a chart surface appears', async () => {
  const svgs = []
  const root = {
    document: makeDoc({ svgs }),
  }

  setTimeout(() => {
    svgs.push(makeShapeNode('svg', { width: 720, height: 480 }))
  }, 10)

  const surface = await waitForObservableD3Surface({
    root,
    timeoutMs: 500,
    pollMs: 5,
  })

  assert.equal(surface.tagName, 'SVG')
})

test('describeObservableD3Surface summarizes the visible worker-frame chart surface', () => {
  const root = {
    document: makeDoc({
      svgs: [
        makeShapeNode('svg', {
          width: 720,
          height: 480,
          counts: {
            circle: 18,
            rect: 1,
            path: 2,
            line: 4,
          },
        }),
      ],
    }),
  }

  assert.deepEqual(
    describeObservableD3Surface(root, {
      notebook: { slug: 'scatterplot' },
    }),
    {
      surfaceTag: 'svg',
      summary: {
        tagName: 'svg',
        circleCount: 18,
        rectCount: 1,
        pathCount: 2,
        lineCount: 4,
        textCount: 0,
        width: 720,
        height: 480,
        area: 345600,
      },
      plotRegion: {
        source: 'surface',
        targetTag: 'svg',
        markCount: 18,
        screenRect: {
          left: 0,
          top: 0,
          width: 720,
          height: 480,
        },
        localRect: {
          left: 0,
          top: 0,
          width: 720,
          height: 480,
        },
        surfaceRect: {
          left: 0,
          top: 0,
          width: 720,
          height: 480,
        },
      },
      inferredKind: 'scatter',
    },
  )
})

test('findObservableD3PointMarks falls back to small path marks when the scatterplot has no circles', () => {
  const pointA = makePointPath({ left: 10, top: 20 })
  const pointB = makePointPath({ left: 30, top: 40 })
  const largePath = makePointPath({ left: 0, top: 0, width: 200, height: 10 })
  const svg = {
    tagName: 'SVG',
    getBoundingClientRect() {
      return { width: 640, height: 480 }
    },
    querySelectorAll(selector) {
      if (selector === 'circle') return []
      if (selector === 'path') return [pointA, pointB, largePath]
      return []
    },
  }

  const root = {
    document: makeDoc({
      svgs: [svg],
    }),
  }

  assert.deepEqual(findObservableD3PointMarks(root), [pointA, pointB])
  assert.deepEqual(readObservableD3ScatterRows(root), [
    { id: 'pt_1', __screenX: 13, __screenY: 23 },
    { id: 'pt_2', __screenX: 33, __screenY: 43 },
  ])
})

test('readObservableD3LineRows preserves semantic point data from bound line-path arrays', () => {
  const linePoints = [
    { date: '2024-01-01', close: 101, volume: 10 },
    { date: '2024-02-01', close: 108, volume: 14 },
  ]
  const linePath = makePointPath({ left: 20, top: 30, width: 200, height: 80 })
  linePath.__data__ = Object.assign(linePoints, { key: 'AAPL' })

  const svg = {
    tagName: 'SVG',
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 640, height: 480 }
    },
    querySelectorAll(selector) {
      if (selector === 'circle') return []
      if (selector === 'path') return [linePath]
      return []
    },
  }

  const root = {
    document: makeDoc({
      svgs: [svg],
    }),
  }

  assert.deepEqual(readObservableD3LineRows(root), [
    {
      id: 'line_1_1',
      series: 'AAPL',
      __seriesIndex: 1,
      date: '2024-01-01',
      close: 101,
      volume: 10,
      xValue: '2024-01-01',
    },
    {
      id: 'line_1_2',
      series: 'AAPL',
      __seriesIndex: 1,
      date: '2024-02-01',
      close: 108,
      volume: 14,
      xValue: '2024-02-01',
    },
  ])
})

test('readObservableD3ScatterRows preserves primitive semantic fields from mark-bound data', () => {
  const circleA = {
    tagName: 'CIRCLE',
    __data__: { mpg: 32, hp: 90, origin: 'Japan', ignored: { nested: true } },
    getAttribute(name) {
      if (name === 'cx') return '10'
      if (name === 'cy') return '20'
      return null
    },
  }
  const circleB = {
    tagName: 'CIRCLE',
    __data__: { mpg: 24, hp: 130, origin: 'USA' },
    getAttribute(name) {
      if (name === 'cx') return '30'
      if (name === 'cy') return '40'
      return null
    },
  }
  const svg = {
    tagName: 'SVG',
    getBoundingClientRect() {
      return { width: 640, height: 480 }
    },
    querySelectorAll(selector) {
      if (selector === 'circle') return [circleA, circleB]
      if (selector === 'path') return []
      return []
    },
  }

  const root = {
    document: makeDoc({
      svgs: [svg],
    }),
  }

  assert.deepEqual(readObservableD3ScatterRows(root), [
    { id: 'pt_1', __screenX: 10, __screenY: 20, mpg: 32, hp: 90, origin: 'Japan' },
    { id: 'pt_2', __screenX: 30, __screenY: 40, mpg: 24, hp: 130, origin: 'USA' },
  ])
})

test('readObservableD3ScatterRows prefers nested semantic payloads when top-level mark data is geometry-oriented', () => {
  const circleA = {
    tagName: 'CIRCLE',
    __data__: {
      x: 120.5,
      y: 240.25,
      index: 0,
      data: { mpg: 32, hp: 90, origin: 'Japan' },
    },
    getAttribute(name) {
      if (name === 'cx') return '10'
      if (name === 'cy') return '20'
      return null
    },
  }
  const circleB = {
    tagName: 'CIRCLE',
    __data__: {
      x: 180.5,
      y: 140.25,
      index: 1,
      data: { mpg: 24, hp: 130, origin: 'USA' },
    },
    getAttribute(name) {
      if (name === 'cx') return '30'
      if (name === 'cy') return '40'
      return null
    },
  }
  const svg = {
    tagName: 'SVG',
    getBoundingClientRect() {
      return { width: 640, height: 480 }
    },
    querySelectorAll(selector) {
      if (selector === 'circle') return [circleA, circleB]
      if (selector === 'path') return []
      return []
    },
  }

  const root = {
    document: makeDoc({
      svgs: [svg],
    }),
  }

  assert.deepEqual(readObservableD3ScatterRows(root), [
    { id: 'pt_1', __screenX: 10, __screenY: 20, x: 120.5, y: 240.25, index: 0, mpg: 32, hp: 90, origin: 'Japan' },
    { id: 'pt_2', __screenX: 30, __screenY: 40, x: 180.5, y: 140.25, index: 1, mpg: 24, hp: 130, origin: 'USA' },
  ])
})

test('readObservableD3ScatterRows can infer semantic scatter fields from axis ticks and notebook hints', () => {
  const surface = makeNode('svg', { left: 0, top: 0, width: 640, height: 480 })
  const plotLayer = makeNode('g', { left: 100, top: 100, width: 220, height: 220 }, surface)
  const circleA = {
    tagName: 'CIRCLE',
    parentNode: plotLayer,
    getBoundingClientRect() {
      return { left: 118, top: 162, width: 8, height: 8 }
    },
    getAttribute(name) {
      if (name === 'cx') return '122'
      if (name === 'cy') return '166'
      return null
    },
  }
  const circleB = {
    tagName: 'CIRCLE',
    parentNode: plotLayer,
    getBoundingClientRect() {
      return { left: 206, top: 250, width: 8, height: 8 }
    },
    getAttribute(name) {
      if (name === 'cx') return '210'
      if (name === 'cy') return '254'
      return null
    },
  }
  const textNodes = [
    makeTextNode('12', { left: 95, top: 324, width: 10, height: 10 }),
    makeTextNode('32', { left: 315, top: 324, width: 10, height: 10 }),
    makeTextNode('60', { left: 78, top: 314, width: 16, height: 10 }),
    makeTextNode('340', { left: 72, top: 94, width: 22, height: 10 }),
  ]
  surface.querySelectorAll = (selector) => {
    if (selector === 'circle') return [circleA, circleB]
    if (selector === 'path') return []
    if (selector === 'text') return textNodes
    return []
  }

  const root = {
    document: makeDoc({
      svgs: [surface],
    }),
  }

  const rows = readObservableD3ScatterRows(root, {
    semanticHints: {
      xField: 'Miles_per_Gallon',
      yField: 'Horsepower',
    },
  })

  assert.equal(rows.length, 2)
  assert.equal(rows[0]?.__screenX, 122)
  assert.equal(rows[0]?.__screenY, 166)
  assert.ok(Math.abs(rows[0]?.Miles_per_Gallon - 14) < 0.001)
  assert.ok(Math.abs(rows[0]?.Horsepower - 244.4522) < 0.01)
  assert.equal(rows[1]?.__screenX, 210)
  assert.equal(rows[1]?.__screenY, 254)
  assert.ok(Math.abs(rows[1]?.Miles_per_Gallon - 22) < 0.001)
  assert.ok(Math.abs(rows[1]?.Horsepower - 118.9566) < 0.01)
})

test('projectObservableD3ScatterSelection maps semantic domains onto screen-space brush bounds', () => {
  const rows = [
    { id: 'pt_1', mpg: 32, hp: 90, __screenX: 10, __screenY: 20 },
    { id: 'pt_2', mpg: 28, hp: 110, __screenX: 30, __screenY: 40 },
    { id: 'pt_3', mpg: 22, hp: 140, __screenX: 60, __screenY: 80 },
  ]

  const selection = {
    fields: ['mpg', 'hp'],
    domain: {
      xDomain: [24, 30],
      yDomain: [100, 130],
    },
  }

  assert.equal(rowMatchesObservableD3ScatterSelection(rows[1], selection, rows), true)
  assert.equal(rowMatchesObservableD3ScatterSelection(rows[0], selection, rows), false)
  assert.deepEqual(projectObservableD3ScatterSelection(selection, rows), {
    fields: ['__screenX', '__screenY'],
    domain: {
      xDomain: [30, 30],
      yDomain: [40, 40],
    },
    matchedRows: [rows[1]],
  })
})

test('readObservableD3ScatterMatrix groups point marks into targetable scatter cells', () => {
  const surface = makeNode('svg', { left: 0, top: 0, width: 640, height: 480 })
  const mpgHpCell = makeNode('g', { left: 40, top: 40, width: 160, height: 160 }, surface)
  const weightMpgCell = makeNode('g', { left: 220, top: 40, width: 160, height: 160 }, surface)

  const makeCircle = (parentNode, cx, cy, data) => ({
    tagName: 'CIRCLE',
    parentNode,
    __data__: data,
    getAttribute(name) {
      if (name === 'cx') return String(cx)
      if (name === 'cy') return String(cy)
      return null
    },
  })

  const circles = [
    makeCircle(mpgHpCell, 10, 30, { mpg: 20, hp: 90, weight: 2200 }),
    makeCircle(mpgHpCell, 50, 70, { mpg: 30, hp: 130, weight: 2600 }),
    makeCircle(mpgHpCell, 90, 110, { mpg: 40, hp: 170, weight: 3000 }),
    makeCircle(weightMpgCell, 12, 100, { mpg: 40, hp: 90, weight: 2200 }),
    makeCircle(weightMpgCell, 72, 20, { mpg: 20, hp: 170, weight: 2600 }),
    makeCircle(weightMpgCell, 132, 60, { mpg: 30, hp: 130, weight: 3000 }),
  ]

  surface.querySelectorAll = (selector) => {
    if (selector === 'circle') return circles
    if (selector === 'path') return []
    return []
  }

  const matrix = readObservableD3ScatterMatrix({
    document: makeDoc({ svgs: [surface] }),
  })

  assert.equal(matrix.kind, 'scatterMatrix')
  assert.equal(matrix.cells.length, 2)
  assert.deepEqual(
    matrix.cells.map((cell) => ({
      ref: cell.ref,
      xField: cell.xField,
      yField: cell.yField,
      bounds: cell.bounds,
      rowCount: cell.rowCount,
    })),
    [
      {
        ref: 'wl://observable-d3/scatter-matrix/cell/mpg-hp',
        xField: 'mpg',
        yField: 'hp',
        bounds: { left: 40, top: 40, width: 160, height: 160 },
        rowCount: 3,
      },
      {
        ref: 'wl://observable-d3/scatter-matrix/cell/weight-mpg',
        xField: 'weight',
        yField: 'mpg',
        bounds: { left: 220, top: 40, width: 160, height: 160 },
        rowCount: 3,
      },
    ],
  )
  assert.equal(matrix.rowCount, 3)
})

test('readObservableD3ScatterMatrix recovers matrix fields from labels when marks only expose screen coordinates', () => {
  const surface = makeNode('svg', { left: 0, top: 0, width: 640, height: 480 })
  const mpgPowerCell = makeNode('g', { left: 40, top: 40, width: 160, height: 160 }, surface)
  const powerPowerCell = makeNode('g', { left: 220, top: 40, width: 160, height: 160 }, surface)
  const mpgWeightCell = makeNode('g', { left: 40, top: 220, width: 160, height: 160 }, surface)
  const powerWeightCell = makeNode('g', { left: 220, top: 220, width: 160, height: 160 }, surface)

  const makeCircle = (parentNode, cx, cy) => ({
    tagName: 'CIRCLE',
    parentNode,
    getAttribute(name) {
      if (name === 'cx') return String(cx)
      if (name === 'cy') return String(cy)
      return null
    },
  })

  const circles = [
    makeCircle(mpgPowerCell, 10, 30),
    makeCircle(mpgPowerCell, 50, 70),
    makeCircle(powerPowerCell, 12, 100),
    makeCircle(powerPowerCell, 72, 20),
    makeCircle(mpgWeightCell, 12, 100),
    makeCircle(mpgWeightCell, 72, 20),
    makeCircle(powerWeightCell, 20, 80),
    makeCircle(powerWeightCell, 82, 24),
  ]
  const textNodes = [
    makeTextNode('economy (mpg)', { left: 40, top: 10, width: 100, height: 18 }),
    makeTextNode('power (hp)', { left: 40, top: 210, width: 80, height: 18 }),
    makeTextNode('weight (lb)', { left: 220, top: 210, width: 90, height: 18 }),
  ]

  surface.querySelectorAll = (selector) => {
    if (selector === 'circle') return circles
    if (selector === 'path') return []
    if (selector === 'text') return textNodes
    return []
  }

  const matrix = readObservableD3ScatterMatrix({
    document: makeDoc({ svgs: [surface] }),
  }, {
    semanticHints: {
      matrixFields: ['economy (mpg)', 'power (hp)', 'weight (lb)'],
    },
  })

  assert.deepEqual(
    matrix.cells.map((cell) => [cell.xField, cell.yField]),
    [
      ['economy (mpg)', 'power (hp)'],
      ['power (hp)', 'power (hp)'],
      ['economy (mpg)', 'weight (lb)'],
      ['power (hp)', 'weight (lb)'],
    ],
  )
  assert.equal(Number.isFinite(matrix.cells[0].rows[0]['economy (mpg)']), true)
  assert.equal(Number.isFinite(matrix.cells[0].rows[0]['power (hp)']), true)
  assert.notEqual(matrix.cells[0].rows[0]['economy (mpg)'], matrix.cells[0].rows[1]['economy (mpg)'])

  const groups = readObservableD3ScatterMatrixGroups({
    document: makeDoc({ svgs: [surface] }),
  }, {
    semanticHints: {
      matrixFields: ['economy (mpg)', 'power (hp)', 'weight (lb)'],
    },
  })
  assert.equal(Number.isFinite(groups[0].marks[0].row['economy (mpg)']), true)
  assert.equal(Number.isFinite(groups[0].marks[0].row['power (hp)']), true)
})

test('findObservableD3MarkContainer returns the deepest shared mark ancestor below the surface', () => {
  const surface = makeNode('svg', { left: 10, top: 20, width: 600, height: 400 })
  const markLayer = makeNode('g', { left: 110, top: 120, width: 220, height: 160 }, surface)
  const pointA = makeNode('circle', { left: 120, top: 130, width: 8, height: 8 }, markLayer)
  const pointB = makeNode('circle', { left: 300, top: 240, width: 8, height: 8 }, markLayer)
  surface.querySelectorAll = (selector) => {
    if (selector === 'circle') return [pointA, pointB]
    if (selector === 'path') return []
    return []
  }

  const root = {
    document: makeDoc({
      svgs: [surface],
    }),
  }

  assert.equal(findObservableD3MarkContainer(root), markLayer)
})

test('findObservableD3PlotRegion prefers the shared mark container when available', () => {
  const surface = makeNode('svg', { left: 10, top: 20, width: 600, height: 400 })
  const markLayer = makeNode('g', { left: 110, top: 120, width: 220, height: 160 }, surface)
  const pointA = makeNode('circle', { left: 120, top: 130, width: 8, height: 8 }, markLayer)
  const pointB = makeNode('circle', { left: 300, top: 240, width: 8, height: 8 }, markLayer)
  surface.querySelectorAll = (selector) => {
    if (selector === 'circle') return [pointA, pointB]
    if (selector === 'path') return []
    return []
  }

  const root = {
    document: makeDoc({
      svgs: [surface],
    }),
  }

  assert.deepEqual(findObservableD3PlotRegion(root), {
    source: 'mark-container',
    targetTag: 'g',
    markCount: 2,
    screenRect: { left: 110, top: 120, width: 220, height: 160 },
    localRect: { left: 100, top: 100, width: 220, height: 160 },
    surfaceRect: { left: 10, top: 20, width: 600, height: 400 },
  })
})

test('findObservableD3PlotRegion falls back to unioned mark bounds when marks have no shared container below the surface', () => {
  const surface = makeNode('svg', { left: 10, top: 20, width: 600, height: 400 })
  const pointA = makeNode('circle', { left: 120, top: 130, width: 8, height: 8 }, surface)
  const pointB = makeNode('circle', { left: 300, top: 240, width: 10, height: 12 }, surface)
  surface.querySelectorAll = (selector) => {
    if (selector === 'circle') return [pointA, pointB]
    if (selector === 'path') return []
    return []
  }

  const root = {
    document: makeDoc({
      svgs: [surface],
    }),
  }

  assert.deepEqual(findObservableD3PlotRegion(root), {
    source: 'mark-bounds',
    targetTag: 'marks-union',
    markCount: 2,
    screenRect: { left: 120, top: 130, width: 190, height: 122 },
    localRect: { left: 110, top: 110, width: 190, height: 122 },
    surfaceRect: { left: 10, top: 20, width: 600, height: 400 },
  })
})
