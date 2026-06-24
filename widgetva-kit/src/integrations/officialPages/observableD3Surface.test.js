import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeObservableD3Surface,
  findObservableD3PointMarks,
  findPrimaryObservableD3Surface,
  inferObservableD3WidgetKindFromSurface,
  readObservableD3ScatterRows,
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
