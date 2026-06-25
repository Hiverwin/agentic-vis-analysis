import test from 'node:test'
import assert from 'node:assert/strict'

import { createD3ScatterChartWrapper } from './scatterChartWrapper.js'

function buildRows() {
  return [
    { x: 1, y: 2, id: 'a', category: 'Books' },
    { x: 2, y: 4, id: 'b', category: 'Books' },
    { x: 3, y: 6, id: 'c', category: 'Sports' },
    { x: 4, y: 8, id: 'd', category: 'Sports' },
  ]
}

test('createD3ScatterChartWrapper projects brush, domain, and highlight state into rendered points', () => {
  const renderCalls = []
  const wrapper = createD3ScatterChartWrapper({
    rows: buildRows(),
    render(payload) {
      renderCalls.push(payload)
    },
  })

  wrapper.renderFromState({
    selections: {
      'selection://scatter/brush': {
        kind: 'interval',
        domain: {
          xDomain: [2, 3],
          yDomain: [4, 6],
        },
      },
    },
    view: {
      xDomain: [2, 4],
      yDomain: [4, 8],
    },
    feedback: {
      highlightedKeys: ['c'],
    },
  })

  const lastCall = renderCalls[renderCalls.length - 1]
  assert.deepEqual(lastCall.xDomain, [2, 4])
  assert.deepEqual(lastCall.yDomain, [4, 8])
  assert.deepEqual(lastCall.brush, {
    kind: 'interval',
    domain: {
      xDomain: [2, 3],
      yDomain: [4, 6],
    },
  })
  assert.deepEqual(
    lastCall.points.map((point) => ({
      id: point.id,
      visible: point.visible,
      selected: point.selected,
      highlighted: point.highlighted,
    })),
    [
      { id: 'a', visible: false, selected: false, highlighted: false },
      { id: 'b', visible: true, selected: true, highlighted: false },
      { id: 'c', visible: true, selected: true, highlighted: true },
      { id: 'd', visible: true, selected: false, highlighted: false },
    ],
  )
})

test('createD3ScatterChartWrapper imperative setters keep internal brush and domain state in sync', () => {
  const renderCalls = []
  const wrapper = createD3ScatterChartWrapper({
    rows: buildRows(),
    render(payload) {
      renderCalls.push(payload)
    },
  })

  wrapper.setDomain([1, 3], [2, 6])
  wrapper.setBrush({
    kind: 'interval',
    domain: {
      xDomain: [1, 2],
      yDomain: [2, 4],
    },
  })
  wrapper.setHighlights(['b'])

  const lastCall = renderCalls[renderCalls.length - 1]
  assert.deepEqual(lastCall.xDomain, [1, 3])
  assert.deepEqual(lastCall.yDomain, [2, 6])
  assert.deepEqual(
    lastCall.points.map((point) => ({
      id: point.id,
      visible: point.visible,
      selected: point.selected,
      highlighted: point.highlighted,
    })),
    [
      { id: 'a', visible: true, selected: true, highlighted: false },
      { id: 'b', visible: true, selected: true, highlighted: true },
      { id: 'c', visible: true, selected: false, highlighted: false },
      { id: 'd', visible: false, selected: false, highlighted: false },
    ],
  )
})
