import test from 'node:test'
import assert from 'node:assert/strict'

import { mapSelectionToTargetSelection, rowMatchesPredicate } from './selectionHelpers.js'

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

test('mapSelectionToTargetSelection drops predicates outside the declared relation mapping', () => {
  const mapped = mapSelectionToTargetSelection(
    {
      fields: ['Origin', 'Horsepower'],
      value: {
        Origin: ['USA'],
        Horsepower: [100, 200],
      },
      predicates: [
        { field: 'Origin', op: 'in', value: ['USA'] },
        { field: 'Horsepower', op: 'between', value: [100, 200] },
      ],
    },
    [
      { sourceField: 'Origin', targetField: 'Region' },
    ],
  )

  assert.deepEqual(mapped?.fields, ['Region'])
  assert.deepEqual(mapped?.value, {
    Region: ['USA'],
  })
  assert.deepEqual(mapped?.predicates, [
    { field: 'Region', op: 'in', value: ['USA'] },
  ])
})

test('mapSelectionToTargetSelection returns null when no predicates can be mapped', () => {
  const mapped = mapSelectionToTargetSelection(
    {
      predicates: [
        { field: 'Horsepower', op: 'between', value: [100, 200] },
      ],
    },
    [
      { sourceField: 'Origin', targetField: 'Region' },
    ],
  )

  assert.equal(mapped, null)
})

test('rowMatchesPredicate treats temporal strings, timestamps, and Date objects as comparable between-values', () => {
  const row = {
    dateAsString: '2012-04-08',
    dateAsDate: new Date('2012-04-08T00:00:00.000Z'),
    dateAsTimestamp: Date.parse('2012-04-08T00:00:00.000Z'),
  }

  assert.equal(
    rowMatchesPredicate(row, {
      field: 'dateAsString',
      op: 'between',
      value: ['2012-03-01', '2012-04-30'],
    }),
    true,
  )
  assert.equal(
    rowMatchesPredicate(row, {
      field: 'dateAsDate',
      op: 'between',
      value: ['2012-03-01', '2012-04-30'],
    }),
    true,
  )
  assert.equal(
    rowMatchesPredicate(row, {
      field: 'dateAsTimestamp',
      op: 'between',
      value: ['2012-03-01', '2012-04-30'],
    }),
    true,
  )
})

test('rowMatchesPredicate treats temporal equality and in-predicates consistently across string and Date encodings', () => {
  const row = {
    dateAsDate: new Date('2012-04-08T00:00:00.000Z'),
  }

  assert.equal(
    rowMatchesPredicate(row, {
      field: 'dateAsDate',
      op: 'eq',
      value: '2012-04-08T00:00:00.000Z',
    }),
    true,
  )
  assert.equal(
    rowMatchesPredicate(row, {
      field: 'dateAsDate',
      op: 'in',
      value: ['2012-04-01T00:00:00.000Z', '2012-04-08T00:00:00.000Z'],
    }),
    true,
  )
})
