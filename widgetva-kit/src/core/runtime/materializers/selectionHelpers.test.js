import test from 'node:test'
import assert from 'node:assert/strict'

import { mapSelectionToTargetSelection } from './selectionHelpers.js'

test('mapSelectionToTargetSelection remaps structured selection fields alongside predicates', () => {
  const mapped = mapSelectionToTargetSelection(
    {
      kind: 'point',
      keyField: 'Origin',
      keys: ['USA'],
      field: 'Origin',
      values: ['USA'],
      fields: ['Origin', 'Horsepower'],
      value: {
        Origin: ['USA'],
        Horsepower: [100, 200],
      },
      predicates: [
        { field: 'Origin', op: 'in', value: ['USA'] },
        { field: 'Horsepower', op: 'between', value: [100, 200] },
      ],
      summary: 'Origin: USA',
    },
    [
      { sourceField: 'Origin', targetField: 'Region' },
      { sourceField: 'Horsepower', targetField: 'Power' },
    ],
  )

  assert.equal(mapped?.keyField, 'Region')
  assert.equal(mapped?.field, 'Region')
  assert.deepEqual(mapped?.fields, ['Region', 'Power'])
  assert.deepEqual(mapped?.value, {
    Region: ['USA'],
    Power: [100, 200],
  })
  assert.deepEqual(mapped?.predicates, [
    { field: 'Region', op: 'in', value: ['USA'] },
    { field: 'Power', op: 'between', value: [100, 200] },
  ])
})
