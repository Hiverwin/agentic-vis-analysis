import test from 'node:test'
import assert from 'node:assert/strict'

import {
  deriveCarsActiveFilters,
  deriveCarsContextualRows,
  deriveCarsHorsepowerFilteredRows,
  deriveFocusedCar,
} from './viewModelDerivation.js'

test('deriveCarsContextualRows filters rows by first-party categorical controls', () => {
  const rows = [
    { id: 'a', origin: 'USA', year: 1971, cylinders: 8, horsepower: 130 },
    { id: 'b', origin: 'Japan', year: 1971, cylinders: 4, horsepower: 92 },
    { id: 'c', origin: 'Japan', year: 1972, cylinders: 4, horsepower: 97 },
  ]

  assert.deepEqual(
    deriveCarsContextualRows(rows, {
      analysisOrigin: 'Japan',
      analysisYear: 1971,
      analysisCylinders: [4],
    }).map((row) => row.id),
    ['b'],
  )
})

test('deriveCarsHorsepowerFilteredRows clamps rows by first-party horsepower controls', () => {
  const rows = [
    { id: 'a', horsepower: 68 },
    { id: 'b', horsepower: 92 },
    { id: 'c', horsepower: 130 },
  ]

  assert.deepEqual(
    deriveCarsHorsepowerFilteredRows(rows, {
      horsepowerMin: 80,
      horsepowerMax: 120,
    }).map((row) => row.id),
    ['b'],
  )
})

test('deriveFocusedCar prefers the focused id and falls back to the first visible row', () => {
  const rows = [
    { id: 'a' },
    { id: 'b' },
  ]

  assert.deepEqual(deriveFocusedCar(rows, 'b'), { id: 'b' })
  assert.deepEqual(deriveFocusedCar(rows, 'missing'), { id: 'a' })
  assert.equal(deriveFocusedCar([], 'b'), null)
})

test('deriveCarsActiveFilters builds compact first-party filter labels', () => {
  assert.deepEqual(
    deriveCarsActiveFilters({
      analysisOrigin: 'Japan',
      analysisYear: 1971,
      analysisCylinders: [4, 6],
      horsepowerMin: 80,
      horsepowerMax: 160,
      horsepowerDomain: [40, 220],
      primarySelectionSummary: 'Origin: Japan',
      highlightSummary: '4 cars highlighted',
    }),
    [
      'origin: Japan',
      'year: 1971',
      'cylinders: 4, 6',
      'horsepower: 80-160',
      'selection: Origin: Japan',
      'highlight: 4 cars highlighted',
    ],
  )
})
