import test from 'node:test'
import assert from 'node:assert/strict'

import { executeVegaLiteLineFilterLines } from './lineSpecActions.js'

test('executeVegaLiteLineFilterLines writes explicit semantic filter state', () => {
  const nextSpec = executeVegaLiteLineFilterLines({
    mark: 'line',
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'price', type: 'quantitative' },
      color: { field: 'company', type: 'nominal' },
    },
    data: {
      values: [
        { date: '2024-01-01', price: 10, company: 'A' },
        { date: '2024-01-02', price: 12, company: 'B' },
      ],
    },
  }, {
    linesToRemove: ['B'],
  })

  assert.deepEqual(nextSpec._line_filter_state, {
    lineField: 'company',
    linesToRemove: ['B'],
  })
})
