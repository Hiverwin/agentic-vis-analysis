import test from 'node:test'
import assert from 'node:assert/strict'

import { createEChartsLineChartWrapper } from './lineChartWrapper.js'

function buildRows() {
  return [
    { date: '2024-01-01', series: 'Books', revenue: 10 },
    { date: '2024-01-02', series: 'Books', revenue: 12 },
    { date: '2024-01-01', series: 'Sports', revenue: 30 },
    { date: '2024-01-02', series: 'Sports', revenue: 28 },
  ]
}

test('createEChartsLineChartWrapper materializes option patches for focus, highlight, and viewport state', () => {
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

  const wrapper = createEChartsLineChartWrapper({
    chart,
    rows: buildRows(),
  })

  wrapper.renderFromState({
    view: {
      xDomain: ['2024-01-02', '2024-01-02'],
      focusedSeries: ['Sports'],
      highlight: {
        channels: ['lineStyle'],
        entries: [{ source: 'encoding', channel: 'lineStyle', scope: 'root' }],
      },
    },
    feedback: {
      highlightedKeys: ['Sports'],
    },
  })

  assert.equal(Array.isArray(receivedOption?.series), true)
  assert.deepEqual(receivedOption?.dataZoom, [
    {
      type: 'inside',
      xAxisIndex: 0,
      startValue: '2024-01-02',
      endValue: '2024-01-02',
    },
  ])
  assert.deepEqual(
    receivedOption?.series?.map((entry) => ({
      name: entry.name,
      opacity: entry.lineStyle?.opacity,
      width: entry.lineStyle?.width,
    })),
    [
      { name: 'Books', opacity: 0.2, width: 2 },
      { name: 'Sports', opacity: 1, width: 4 },
    ],
  )
  assert.deepEqual(dispatchCalls, [
    { type: 'downplay', seriesName: 'Books' },
    { type: 'downplay', seriesName: 'Sports' },
    { type: 'highlight', seriesName: 'Sports' },
  ])
})

test('createEChartsLineChartWrapper imperative setters keep the internal option state in sync', () => {
  let receivedOption = null
  const chart = {
    setOption(option) {
      receivedOption = option
    },
    dispatchAction() {},
  }

  const wrapper = createEChartsLineChartWrapper({
    chart,
    rows: buildRows(),
  })

  wrapper.setDomain(['2024-01-01', '2024-01-01'], null)
  wrapper.setFocus({ focusedSeries: ['Books'] })
  wrapper.setHighlights(['Books'])

  assert.deepEqual(receivedOption?.dataZoom, [
    {
      type: 'inside',
      xAxisIndex: 0,
      startValue: '2024-01-01',
      endValue: '2024-01-01',
    },
  ])
  assert.deepEqual(
    receivedOption?.series?.map((entry) => ({
      name: entry.name,
      opacity: entry.lineStyle?.opacity,
      width: entry.lineStyle?.width,
    })),
    [
      { name: 'Books', opacity: 1, width: 4 },
      { name: 'Sports', opacity: 0.2, width: 2 },
    ],
  )
})
