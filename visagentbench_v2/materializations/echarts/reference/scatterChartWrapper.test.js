import test from 'node:test'
import assert from 'node:assert/strict'

import { createEChartsScatterChartWrapper } from './scatterChartWrapper.js'

function buildRows() {
  return [
    { x: 1, y: 2, id: 'a', category: 'Books' },
    { x: 2, y: 4, id: 'b', category: 'Books' },
    { x: 3, y: 6, id: 'c', category: 'Sports' },
    { x: 4, y: 8, id: 'd', category: 'Sports' },
  ]
}

test('createEChartsScatterChartWrapper materializes scatter option patches for brush, domain, and highlight state', () => {
  let receivedOption = null
  const dispatchCalls = []
  const chart = {
    setOption(option) {
      receivedOption = option
    },
    dispatchAction(action) {
      dispatchCalls.push(action)
    },
  }

  const wrapper = createEChartsScatterChartWrapper({
    chart,
    rows: buildRows(),
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

  assert.deepEqual(receivedOption?.xAxis, { type: 'value', min: 2, max: 4 })
  assert.deepEqual(receivedOption?.yAxis, { type: 'value', min: 4, max: 8 })
  assert.deepEqual(
    receivedOption?.series?.[0]?.data?.map((entry) => ({
      id: entry.id,
      opacity: entry.itemStyle?.opacity,
      symbolSize: entry.symbolSize,
    })),
    [
      { id: 'a', opacity: 0.15, symbolSize: 8 },
      { id: 'b', opacity: 0.9, symbolSize: 12 },
      { id: 'c', opacity: 1, symbolSize: 14 },
      { id: 'd', opacity: 0.55, symbolSize: 8 },
    ],
  )
  assert.deepEqual(dispatchCalls, [
    { type: 'brush', areas: [{ brushType: 'rect', coordRange: [[2, 3], [4, 6]] }] },
    { type: 'downplay', seriesIndex: 0 },
    { type: 'highlight', seriesIndex: 0, dataIndex: 2 },
  ])
})

test('createEChartsScatterChartWrapper imperative setters keep internal scatter state synchronized', () => {
  let receivedOption = null
  const chart = {
    setOption(option) {
      receivedOption = option
    },
    dispatchAction() {},
  }

  const wrapper = createEChartsScatterChartWrapper({
    chart,
    rows: buildRows(),
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

  assert.deepEqual(receivedOption?.xAxis, { type: 'value', min: 1, max: 3 })
  assert.deepEqual(receivedOption?.yAxis, { type: 'value', min: 2, max: 6 })
  assert.deepEqual(
    receivedOption?.series?.[0]?.data?.map((entry) => ({
      id: entry.id,
      opacity: entry.itemStyle?.opacity,
      symbolSize: entry.symbolSize,
    })),
    [
      { id: 'a', opacity: 0.9, symbolSize: 12 },
      { id: 'b', opacity: 1, symbolSize: 14 },
      { id: 'c', opacity: 0.55, symbolSize: 8 },
      { id: 'd', opacity: 0.15, symbolSize: 8 },
    ],
  )
})
