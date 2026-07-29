import test from 'node:test'
import assert from 'node:assert/strict'

import { installObservableD3EarlyCapture } from './observableD3EarlyCapture.js'

function createLinearScale(domain, range) {
  const scale = (value) => {
    const ratio = (value - domain[0]) / (domain[1] - domain[0])
    return range[0] + (ratio * (range[1] - range[0]))
  }
  scale.domain = () => domain.slice()
  return scale
}

function createFakeD3() {
  const brushMoveCalls = []

  function Selection(nodes = []) {
    this._groups = [nodes]
  }

  Selection.prototype.call = function call(callback) {
    const args = Array.prototype.slice.call(arguments, 1)
    callback(this, ...args)
    return this
  }

  function select(node) {
    return new Selection([node])
  }

  function brush(selection) {
    return selection
  }

  brush.move = (selection, pixelSelection) => {
    brushMoveCalls.push({
      nodes: selection._groups.flat(),
      pixelSelection,
    })
    return selection
  }

  return {
    d3: {
      selection: Selection,
      select,
    },
    brush,
    brushMoveCalls,
    createSelection(nodes) {
      return new Selection(nodes)
    },
  }
}

test('Observable D3 early capture installs a native API even before d3 is assigned', () => {
  const root = {}

  const api = installObservableD3EarlyCapture(root)

  assert.equal(api, root.__widgetVAObservableD3Native)
  assert.equal(api.isInstalled, true)
  assert.deepEqual(api.readCaptureSnapshot(), { brushBindings: [] })
})

test('Observable D3 early capture preserves an existing page native helper', () => {
  const existingApi = {
    readCaptureSnapshot() {
      return {
        brushBindings: [{
          bindingId: 'page_helper_brush',
          targetRef: 'page_target',
        }],
      }
    },
  }
  const root = {
    __widgetVAObservableD3Native: existingApi,
  }

  const api = installObservableD3EarlyCapture(root)

  assert.equal(api, existingApi)
  assert.equal(root.__widgetVAObservableD3Native, existingApi)
  assert.deepEqual(api.readCaptureSnapshot(), {
    brushBindings: [{
      bindingId: 'page_helper_brush',
      targetRef: 'page_target',
    }],
  })
})

test('Observable D3 early capture records brush bindings from d3 selection.call', () => {
  const root = {}
  const api = installObservableD3EarlyCapture(root)
  const fake = createFakeD3()
  const cellNode = {
    __data__: [0, 1],
  }
  const xScale = createLinearScale([10, 50], [0, 400])
  const yScale = createLinearScale([0, 200], [300, 0])

  root.d3 = fake.d3
  fake.createSelection([cellNode]).call(fake.brush, {}, {}, {
    columns: ['mpg', 'horsepower'],
    x: [xScale],
    y: [null, yScale],
  })

  assert.deepEqual(api.readCaptureSnapshot(), {
    brushBindings: [{
      bindingId: 'observable_d3_brush_1',
      targetRef: 'wl://observable-d3/scatter-matrix/cell/mpg-horsepower',
      kind: 'scatter',
      interaction: 'brush',
      fields: {
        x: 'mpg',
        y: 'horsepower',
      },
      domain: {
        x: [10, 50],
        y: [0, 200],
      },
    }],
  })
})

test('Observable D3 early capture applies and clears a captured brush through native brush.move', () => {
  const root = {}
  const api = installObservableD3EarlyCapture(root)
  const fake = createFakeD3()
  const cellNode = {
    __data__: [0, 1],
  }
  const xScale = createLinearScale([10, 50], [0, 400])
  const yScale = createLinearScale([0, 200], [300, 0])

  root.d3 = fake.d3
  fake.createSelection([cellNode]).call(fake.brush, {}, {}, {
    columns: ['mpg', 'horsepower'],
    x: [xScale],
    y: [null, yScale],
  })

  const applyResult = api.applyBrushRegion({
    bindingId: 'observable_d3_brush_1',
    xDomain: [20, 30],
    yDomain: [50, 150],
  })
  assert.deepEqual(applyResult, {
    ok: true,
    bindingId: 'observable_d3_brush_1',
    targetRef: 'wl://observable-d3/scatter-matrix/cell/mpg-horsepower',
    pixelSelection: [
      [100, 75],
      [200, 225],
    ],
  })
  assert.equal(fake.brushMoveCalls.length, 1)
  assert.deepEqual(fake.brushMoveCalls[0], {
    nodes: [cellNode],
    pixelSelection: [
      [100, 75],
      [200, 225],
    ],
  })

  const clearResult = api.clearBrush({
    bindingId: 'observable_d3_brush_1',
  })
  assert.deepEqual(clearResult, {
    ok: true,
    bindingId: 'observable_d3_brush_1',
    targetRef: 'wl://observable-d3/scatter-matrix/cell/mpg-horsepower',
    cleared: true,
  })
  assert.equal(fake.brushMoveCalls.length, 2)
  assert.deepEqual(fake.brushMoveCalls[1], {
    nodes: [cellNode],
    pixelSelection: null,
  })
})
