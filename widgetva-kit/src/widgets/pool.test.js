import test from 'node:test'
import assert from 'node:assert/strict'

import {
  SUPPORTED_WIDGET_TYPES,
  WIDGET_POOL_CONSTRUCTOR_FIELDS,
  createBarWidget,
  createHeatmapWidget,
  createLineWidget,
  createParallelCoordinateWidget,
  createParallelCoordinatesWidget,
  createSankeyWidget,
  createScatterWidget,
} from './index.js'

test('widget pool exports the six supported first-class widget types', () => {
  assert.deepEqual(SUPPORTED_WIDGET_TYPES, [
    'bar',
    'line',
    'scatter',
    'parallelCoordinates',
    'sankey',
    'heatmap',
  ])
  assert.equal(typeof createBarWidget, 'function')
  assert.equal(typeof createLineWidget, 'function')
  assert.equal(typeof createScatterWidget, 'function')
  assert.equal(typeof createParallelCoordinatesWidget, 'function')
  assert.equal(typeof createParallelCoordinateWidget, 'function')
  assert.equal(typeof createSankeyWidget, 'function')
  assert.equal(typeof createHeatmapWidget, 'function')
  assert.ok(WIDGET_POOL_CONSTRUCTOR_FIELDS.includes('mountTarget'))
  assert.ok(WIDGET_POOL_CONSTRUCTOR_FIELDS.includes('container'))
})

test('createScatterWidget builds a standalone scatter widget instance from the widget pool', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const widget = createScatterWidget({
    sessionId: 'scatter-demo',
    spec: {
      mark: 'point',
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
      },
    },
    data: [
      { x: 1, y: 2 },
      { x: 2, y: 3 },
    ],
  })

  try {
    assert.equal(widget.describe()?.kind, 'scatter')
    assert.equal(widget.describe()?.widgetId, 'session_scatter-demo')
  } finally {
    widget.dispose()
    globalThis.window = previousWindow
  }
})

test('createParallelCoordinatesWidget preserves explicit kind-driven widget materialization through the widget pool', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const widget = createParallelCoordinatesWidget({
    sessionId: 'pc-demo',
    spec: {
      dimensions: ['a', 'b', 'c'],
      data: {
        values: [
          { a: 1, b: 2, c: 3 },
          { a: 2, b: 3, c: 4 },
        ],
      },
    },
  })

  try {
    assert.equal(widget.describe()?.kind, 'parallelCoordinates')
  } finally {
    widget.dispose()
    globalThis.window = previousWindow
  }
})

test('all six widget constructors accept the same normalized mount-target option shape', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const container = { nodeName: 'DIV' }
  const constructors = [
    ['bar', createBarWidget, { mark: 'bar', encoding: { x: { field: 'category', type: 'nominal' }, y: { field: 'value', type: 'quantitative' } } }],
    ['line', createLineWidget, { mark: 'line', encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' } } }],
    ['scatter', createScatterWidget, { mark: 'point', encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' } } }],
    ['parallelCoordinates', createParallelCoordinatesWidget, { dimensions: ['a', 'b'] }],
    ['sankey', createSankeyWidget, { nodes: [], links: [] }],
    ['heatmap', createHeatmapWidget, { mark: 'rect', encoding: { x: { field: 'x', type: 'nominal' }, y: { field: 'y', type: 'nominal' }, color: { field: 'value', type: 'quantitative' } } }],
  ]

  try {
    for (const [kind, createWidget, spec] of constructors) {
      const widget = createWidget({
        sessionId: `${kind}-demo`,
        spec,
        data: [],
        mountTarget: { container },
      })
      try {
        assert.equal(widget.mountOptions.container, container)
        assert.equal(widget.mountOptions.surface, container)
      } finally {
        widget.dispose()
      }
    }
  } finally {
    globalThis.window = previousWindow
  }
})
