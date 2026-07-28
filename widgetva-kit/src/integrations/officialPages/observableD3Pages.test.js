import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeObservableD3PageShape,
  findObservableWorkerFrame,
  inferObservableD3ScatterSemanticHints,
  isObservableD3NotebookPage,
  isObservableWorkerFrameUrl,
  parseObservableNotebookIdentity,
  waitForObservableWorkerFrame,
} from './observableD3Pages.js'

function makeIframe(src, { width = 0, height = 0 } = {}) {
  return {
    src,
    getAttribute(name) {
      return name === 'src' ? src : null
    },
    getBoundingClientRect() {
      return { width, height }
    },
  }
}

function makeRoot({ href, bodyText = '', iframes = [] } = {}) {
  return {
    location: { href },
    document: {
      body: {
        innerText: bodyText,
      },
      querySelectorAll(selector) {
        if (selector === 'iframe') return iframes
        return []
      },
    },
  }
}

test('isObservableD3NotebookPage recognizes official Observable D3 notebook urls', () => {
  assert.equal(isObservableD3NotebookPage('https://observablehq.com/@d3/scatterplot'), true)
  assert.equal(isObservableD3NotebookPage('https://observablehq.com/@d3/bar-chart/2'), true)
  assert.equal(isObservableD3NotebookPage('https://observablehq.com/@ytchen/penguin-scatter-bar'), true)
  assert.equal(isObservableD3NotebookPage('https://vega.github.io/vega-lite/examples/point_2d.html'), false)
})

test('isObservableWorkerFrameUrl recognizes Observable worker iframe urls', () => {
  assert.equal(isObservableWorkerFrameUrl('https://d3.static.observableusercontent.com/next/worker-CMofg8OD.html'), true)
  assert.equal(isObservableWorkerFrameUrl('https://static.observableusercontent.com/embed.js'), false)
})

test('parseObservableNotebookIdentity extracts owner slug and version', () => {
  assert.deepEqual(
    parseObservableNotebookIdentity('https://observablehq.com/@d3/index-chart/2'),
    {
      owner: '@d3',
      slug: 'index-chart',
      version: '2',
      path: '/@d3/index-chart/2',
      url: 'https://observablehq.com/@d3/index-chart/2',
    },
  )
  assert.deepEqual(
    parseObservableNotebookIdentity('https://observablehq.com/@ytchen/penguin-scatter-bar'),
    {
      owner: '@ytchen',
      slug: 'penguin-scatter-bar',
      version: null,
      path: '/@ytchen/penguin-scatter-bar',
      url: 'https://observablehq.com/@ytchen/penguin-scatter-bar',
    },
  )
})

test('findObservableWorkerFrame returns the largest visible worker iframe when multiple are present', () => {
  const workerFrame = makeIframe('https://d3.static.observableusercontent.com/next/worker-CMofg8OD.html', {
    width: 900,
    height: 600,
  })
  const smallWorkerFrame = makeIframe('https://d3.static.observableusercontent.com/next/worker-small.html', {
    width: 120,
    height: 40,
  })
  const root = makeRoot({
    href: 'https://observablehq.com/@d3/scatterplot',
    iframes: [
      makeIframe('https://example.com/other-frame'),
      smallWorkerFrame,
      workerFrame,
    ],
  })

  assert.equal(findObservableWorkerFrame(root), workerFrame)
})

test('waitForObservableWorkerFrame resolves after the worker iframe appears', async () => {
  const iframes = []
  const root = makeRoot({
    href: 'https://observablehq.com/@d3/scatterplot',
    iframes,
  })

  setTimeout(() => {
    iframes.push(makeIframe('https://d3.static.observableusercontent.com/next/worker-CMofg8OD.html', {
      width: 900,
      height: 600,
    }))
  }, 10)

  const frame = await waitForObservableWorkerFrame({
    root,
    timeoutMs: 500,
    pollMs: 5,
  })

  assert.equal(frame.getAttribute('src'), 'https://d3.static.observableusercontent.com/next/worker-CMofg8OD.html')
})

test('describeObservableD3PageShape summarizes the currently observed Observable notebook shell', () => {
  const root = makeRoot({
    href: 'https://observablehq.com/@d3/scatterplot',
    bodyText: 'D3\nchart = Scatterplot(cars, { x: d => d.mpg, y: d => d.hp })',
    iframes: [
      makeIframe('https://d3.static.observableusercontent.com/next/worker-CMofg8OD.html', {
        width: 900,
        height: 600,
      }),
    ],
  })

  assert.deepEqual(describeObservableD3PageShape(root), {
    provider: 'd3',
    source: 'observablehq',
    pageUrl: 'https://observablehq.com/@d3/scatterplot',
    notebook: {
      owner: '@d3',
      slug: 'scatterplot',
      version: null,
      path: '/@d3/scatterplot',
      url: 'https://observablehq.com/@d3/scatterplot',
    },
    iframeCount: 1,
    workerFrame: {
      src: 'https://d3.static.observableusercontent.com/next/worker-CMofg8OD.html',
    },
    bodyTextPreview: 'D3\nchart = Scatterplot(cars, { x: d => d.mpg, y: d => d.hp })',
    bodyTextHint: 'D3\nchart = Scatterplot(cars, { x: d => d.mpg, y: d => d.hp })',
  })
})

test('inferObservableD3ScatterSemanticHints extracts field accessors from notebook text', () => {
  assert.deepEqual(
    inferObservableD3ScatterSemanticHints({
      bodyTextHint: 'D3\nchart = Scatterplot(cars, { x: d => d.Miles_per_Gallon, y: d => d.Horsepower })',
    }),
    {
      xField: 'Miles_per_Gallon',
      yField: 'Horsepower',
      matrixFields: [],
    },
  )
})

test('inferObservableD3ScatterSemanticHints extracts scatterplot matrix columns from notebook text', () => {
  assert.deepEqual(
    inferObservableD3ScatterSemanticHints({
      bodyTextHint: 'columns = ["economy (mpg)", "power (hp)", "weight (lb)", "displacement (cc)"]',
    }),
    {
      xField: null,
      yField: null,
      matrixFields: ['economy (mpg)', 'power (hp)', 'weight (lb)', 'displacement (cc)'],
    },
  )
})
