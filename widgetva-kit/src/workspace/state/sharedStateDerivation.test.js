import test from 'node:test'
import assert from 'node:assert/strict'

import {
  deriveHighlightStateFromSelection,
  deriveHighlightedRows,
  deriveGlobalFiltersFromSelection,
  deriveGlobalFiltersFromState,
  deriveHighlightPredicatesFromState,
  deriveHighlightSummaryFromState,
  deriveSelectionFilteredRows,
  filterRowsByPredicates,
  rowMatchesPredicate,
} from './sharedStateDerivation.js'

test('deriveHighlightPredicatesFromState and deriveHighlightSummaryFromState read shared highlight semantics', () => {
  const highlightState = {
    entries: [
      {
        summary: 'Origin: Europe',
        predicates: [{ field: 'origin', op: 'equals', value: 'Europe' }],
      },
      {
        summary: '',
        predicates: [{ field: 'cylinders', op: 'equals', value: 4 }],
      },
    ],
  }

  assert.deepEqual(deriveHighlightPredicatesFromState(highlightState), [
    { field: 'origin', op: 'equals', value: 'Europe' },
    { field: 'cylinders', op: 'equals', value: 4 },
  ])
  assert.equal(deriveHighlightSummaryFromState(highlightState), 'Origin: Europe')
})

test('deriveGlobalFiltersFromState reads linked filter predicates from top-level sourceSelectionRef in TransformState', () => {
  const selectionRef = 'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush'
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_b'

  const globalFilters = deriveGlobalFiltersFromState({
    widgets: {
      [widgetRef]: {
        transforms: [
          {
            kind: 'filter',
            sourceSelectionRef: selectionRef,
            spec: {
              linkRef: 'wl://widgetva-app/workspace/main/link/scatter_filters_bar',
            },
          },
        ],
      },
    },
    shared: {
      activeSelections: {
        [selectionRef]: {
          predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
        },
      },
    },
  })

  assert.deepEqual(globalFilters[widgetRef], [
    { field: 'Origin', op: 'equals', value: 'USA' },
  ])
})

test('deriveGlobalFiltersFromSelection converts supported selection predicates into canonical global filter patches', () => {
  const globalFilterPatch = deriveGlobalFiltersFromSelection({
    predicates: [
      { field: 'origin', op: 'equals', value: 'USA' },
      { field: 'cylinders', op: 'equals', value: 8 },
      { field: 'horsepower', op: 'between', value: [40, 260] },
    ],
  }, {
    rangeDomains: {
      horsepower: [60, 220],
    },
  })

  assert.deepEqual(globalFilterPatch, {
    origin: 'USA',
    cylinders: [8],
    horsepowerRange: [60, 220],
  })
})

test('deriveGlobalFiltersFromSelection returns null when the selection cannot be promoted into canonical filters', () => {
  assert.equal(deriveGlobalFiltersFromSelection({
    predicates: [
      { field: 'id', op: 'equals', value: 'toyota-corona-mark-ii' },
    ],
  }), null)

  assert.equal(deriveGlobalFiltersFromSelection({
    predicates: [
      { field: 'origin', op: 'in', value: ['USA', 'Japan'] },
    ],
  }), null)
})

test('rowMatchesPredicate supports equals, in, notIn, and between predicates', () => {
  const row = {
    origin: 'Japan',
    cylinders: 4,
    horsepower: 92,
  }

  assert.equal(rowMatchesPredicate(row, { field: 'origin', op: 'equals', value: 'Japan' }), true)
  assert.equal(rowMatchesPredicate(row, { field: 'origin', op: 'in', value: ['USA', 'Japan'] }), true)
  assert.equal(rowMatchesPredicate(row, { field: 'origin', op: 'notIn', value: ['USA', 'Europe'] }), true)
  assert.equal(rowMatchesPredicate(row, { field: 'horsepower', op: 'between', value: [80, 100] }), true)
  assert.equal(rowMatchesPredicate(row, { field: 'cylinders', op: 'equals', value: 6 }), false)
  assert.equal(rowMatchesPredicate(row, { field: 'origin', op: 'notIn', value: ['Japan'] }), false)
})

test('filterRowsByPredicates returns rows matching all predicates', () => {
  const rows = [
    { id: 1, origin: 'USA', horsepower: 130 },
    { id: 2, origin: 'Japan', horsepower: 92 },
    { id: 3, origin: 'Japan', horsepower: 68 },
  ]

  const filteredRows = filterRowsByPredicates(rows, [
    { field: 'origin', op: 'equals', value: 'Japan' },
    { field: 'horsepower', op: 'between', value: [80, 100] },
  ])

  assert.deepEqual(filteredRows, [
    { id: 2, origin: 'Japan', horsepower: 92 },
  ])
})

test('deriveSelectionFilteredRows applies primary selection predicates', () => {
  const rows = [
    { id: 1, origin: 'USA', year: 1970 },
    { id: 2, origin: 'Japan', year: 1970 },
    { id: 3, origin: 'Japan', year: 1971 },
  ]

  const filteredRows = deriveSelectionFilteredRows(rows, {
    predicates: [
      { field: 'origin', op: 'equals', value: 'Japan' },
      { field: 'year', op: 'equals', value: 1970 },
    ],
  })

  assert.deepEqual(filteredRows, [
    { id: 2, origin: 'Japan', year: 1970 },
  ])
})

test('deriveHighlightedRows applies workspace highlight predicates', () => {
  const rows = [
    { id: 1, origin: 'Europe', cylinders: 4 },
    { id: 2, origin: 'Japan', cylinders: 4 },
    { id: 3, origin: 'Japan', cylinders: 6 },
  ]

  const highlightedRows = deriveHighlightedRows(rows, {
    entries: [
      {
        predicates: [
          { field: 'origin', op: 'equals', value: 'Japan' },
          { field: 'cylinders', op: 'equals', value: 4 },
        ],
      },
    ],
  })

  assert.deepEqual(highlightedRows, [
    { id: 2, origin: 'Japan', cylinders: 4 },
  ])
})

test('deriveHighlightStateFromSelection creates workspace highlight entries for all widgets from a primary selection', () => {
  const widgets = [
    {
      resolveWidgetRef() {
        return 'wl://widgetva-app/workspace/main/widget/bar_a'
      },
      resolveWidgetId() {
        return 'bar_a'
      },
      describe() {
        return {
          ref: 'wl://widgetva-app/workspace/main/widget/bar_a',
          widgetId: 'bar_a',
        }
      },
    },
    {
      resolveWidgetRef() {
        return 'wl://widgetva-app/workspace/main/widget/scatter_b'
      },
      resolveWidgetId() {
        return 'scatter_b'
      },
      describe() {
        return {
          ref: 'wl://widgetva-app/workspace/main/widget/scatter_b',
          widgetId: 'scatter_b',
        }
      },
    },
  ]

  const highlightState = deriveHighlightStateFromSelection({
    selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
    sourceWidgetId: 'bar_a',
    summary: 'Origin: USA',
    predicates: [{ field: 'origin', op: 'equals', value: 'USA' }],
  }, widgets)

  assert.deepEqual(highlightState.activeWidgetRefs, [
    'wl://widgetva-app/workspace/main/widget/bar_a',
    'wl://widgetva-app/workspace/main/widget/scatter_b',
  ])
  assert.equal(highlightState.entries.length, 2)
  assert.equal(highlightState.entries[0].sourceWidgetRef, 'wl://widgetva-app/workspace/main/widget/bar_a')
  assert.deepEqual(highlightState.entries[0].highlightedKeys, ['USA'])
  assert.deepEqual(highlightState.entries[1].linkedSourceRefs, [
    'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
  ])
})
