import test from 'node:test'
import assert from 'node:assert/strict'

import { createD3LineChartWrapper } from './lineChartWrapper.js'

function buildRows() {
  return [
    { date: '2024-01-01', series: 'Books', revenue: 10 },
    { date: '2024-01-02', series: 'Books', revenue: 12 },
    { date: '2024-01-01', series: 'Sports', revenue: 30 },
    { date: '2024-01-02', series: 'Sports', revenue: 28 },
  ]
}

test('createD3LineChartWrapper projects domain and focus state into rendered series metadata', () => {
  const renderCalls = []
  const wrapper = createD3LineChartWrapper({
    rows: buildRows(),
    render({ series, xDomain, focusedSeries }) {
      renderCalls.push({
        series: series.map((entry) => ({
          key: entry.key,
          pointCount: entry.values.length,
          dimmed: entry.dimmed,
          highlighted: entry.highlighted,
        })),
        xDomain,
        focusedSeries,
      })
    },
  })

  wrapper.renderFromState({
    view: {
      xDomain: ['2024-01-02', '2024-01-02'],
      focusedSeries: ['Sports'],
      highlight: {
        channels: ['strokeWidth'],
        entries: [{ source: 'encoding', channel: 'strokeWidth', scope: 'root' }],
      },
    },
    feedback: {
      highlightedKeys: ['Sports'],
    },
  })

  assert.equal(renderCalls.length, 1)
  assert.deepEqual(renderCalls[0].xDomain, ['2024-01-02', '2024-01-02'])
  assert.deepEqual(renderCalls[0].focusedSeries, ['Sports'])
  assert.deepEqual(renderCalls[0].series, [
    { key: 'Books', pointCount: 1, dimmed: true, highlighted: false },
    { key: 'Sports', pointCount: 1, dimmed: false, highlighted: true },
  ])
})

test('createD3LineChartWrapper exposes imperative setters that re-render from internal state', () => {
  const renderCalls = []
  const wrapper = createD3LineChartWrapper({
    rows: buildRows(),
    render({ series, xDomain, focusedSeries }) {
      renderCalls.push({
        series: series.map((entry) => ({
          key: entry.key,
          pointCount: entry.values.length,
          dimmed: entry.dimmed,
          highlighted: entry.highlighted,
        })),
        xDomain,
        focusedSeries,
      })
    },
  })

  wrapper.setDomain(['2024-01-01', '2024-01-01'], null)
  wrapper.setFocus({ focusedSeries: ['Books'] })
  wrapper.setHighlights(['Books'])

  const lastCall = renderCalls[renderCalls.length - 1]
  assert.deepEqual(lastCall.xDomain, ['2024-01-01', '2024-01-01'])
  assert.deepEqual(lastCall.focusedSeries, ['Books'])
  assert.deepEqual(lastCall.series, [
    { key: 'Books', pointCount: 1, dimmed: false, highlighted: true },
    { key: 'Sports', pointCount: 1, dimmed: true, highlighted: false },
  ])
})
