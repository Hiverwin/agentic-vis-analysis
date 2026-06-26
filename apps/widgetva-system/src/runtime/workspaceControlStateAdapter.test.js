import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildFirstPartyControlState,
  buildFirstPartyRangeDomains,
  buildFirstPartyWorkspaceControlStateAdapter,
  deriveFirstPartyCoordinationControlState,
  deriveFirstPartyGlobalFiltersFromControlState,
  deriveFirstPartyGlobalFiltersFromSelection,
  deriveFirstPartyInteractionBindings,
  deriveFirstPartyInteractionFilterPatch,
} from './workspaceControlStateAdapter.js'

test('buildFirstPartyControlState maps app analysis fields into canonical control-state shape', () => {
  assert.deepEqual(buildFirstPartyControlState({
    analysisOrigin: 'Japan',
    analysisYear: 1971,
    analysisCylinders: [4, 6],
    horsepowerMin: 80,
    horsepowerMax: 160,
  }), {
    origin: 'Japan',
    year: 1971,
    cylinders: [4, 6],
    horsepowerRange: [80, 160],
  })
})

test('buildFirstPartyRangeDomains derives dataset-backed numeric range domains', () => {
  assert.deepEqual(buildFirstPartyRangeDomains({
    dataset: {
      horsepowerDomain: [40, 220],
    },
  }), {
    horsepower: [40, 220],
  })
})

test('deriveFirstPartyCoordinationControlState normalizes cars control state from canonical coordination inputs', () => {
  assert.deepEqual(deriveFirstPartyCoordinationControlState({
    globalFilters: {
      origin: 'USA',
      year: 1971,
      cylinders: ['8', 4, 'bad'],
      horsepowerRange: [40, 260],
    },
    primarySelection: {
      predicates: [{ field: 'id', op: 'equals', value: 'ford-maverick' }],
    },
    focusedWidgetId: 'w_parallel_cars',
    rangeDomains: {
      horsepower: [60, 220],
    },
  }), {
    filters: {
      origin: 'USA',
      year: 1971,
      cylinders: [4, 8],
      horsepowerRange: [60, 220],
    },
    focus: {
      focusedRecordId: 'ford-maverick',
    },
    focusedWidgetId: 'w_parallel_cars',
  })
})

test('deriveFirstPartyInteractionBindings converts normalized coordination control state into app bindings', () => {
  assert.deepEqual(deriveFirstPartyInteractionBindings({
    filters: {
      origin: 'USA',
      year: 1971,
      cylinders: [4, 8],
      horsepowerRange: [60, 220],
    },
    focus: {
      focusedRecordId: 'ford-maverick',
    },
    focusedWidgetId: 'w_parallel_cars',
  }), {
    analysisOrigin: 'USA',
    analysisYear: 1971,
    analysisCylinders: [4, 8],
    horsepowerMin: 60,
    horsepowerMax: 220,
    focusedCarId: 'ford-maverick',
    selectedWidgetId: 'w_parallel_cars',
  })
})

test('deriveFirstPartyInteractionFilterPatch converts canonical filter patches into app filter-state patches', () => {
  assert.deepEqual(deriveFirstPartyInteractionFilterPatch({
    origin: 'USA',
    year: 1971,
    cylinders: [8],
    horsepowerRange: [80, 160],
  }), {
    analysisOrigin: 'USA',
    analysisYear: 1971,
    analysisCylinders: [8],
    horsepowerMin: 80,
    horsepowerMax: 160,
  })
})

test('deriveFirstPartyGlobalFiltersFromControlState normalizes app-like control values into canonical global filters', () => {
  assert.deepEqual(deriveFirstPartyGlobalFiltersFromControlState({
    origin: 'USA',
    year: 1971,
    cylinders: ['8', 4, 'bad'],
    horsepowerRange: [80, 160],
  }, {
    rangeDomains: {
      horsepower: [60, 220],
    },
  }), {
    origin: 'USA',
    year: 1971,
    cylinders: [4, 8],
    horsepowerRange: [80, 160],
  })
})

test('deriveFirstPartyGlobalFiltersFromSelection promotes supported selection predicates into canonical filters', () => {
  assert.deepEqual(deriveFirstPartyGlobalFiltersFromSelection({
    predicates: [
      { field: 'origin', op: 'equals', value: 'USA' },
      { field: 'cylinders', op: 'equals', value: 8 },
      { field: 'horsepower', op: 'between', value: [40, 260] },
    ],
  }, {
    rangeDomains: {
      horsepower: [60, 220],
    },
  }), {
    origin: 'USA',
    cylinders: [8],
    horsepowerRange: [60, 220],
  })
})

test('deriveFirstPartyGlobalFiltersFromSelection also promotes singleton in-predicates into canonical filters', () => {
  assert.deepEqual(deriveFirstPartyGlobalFiltersFromSelection({
    predicates: [
      { field: 'origin', op: 'in', value: ['USA'] },
      { field: 'year', op: 'in', value: [1972] },
      { field: 'cylinders', op: 'in', value: [8] },
    ],
  }), {
    origin: 'USA',
    year: 1972,
    cylinders: [8],
  })
})

test('buildFirstPartyWorkspaceControlStateAdapter exposes the full adapter contract used by runtime sessions', () => {
  const adapter = buildFirstPartyWorkspaceControlStateAdapter()

  assert.equal(typeof adapter.deriveCoordinationControlState, 'function')
  assert.equal(typeof adapter.deriveInteractionBindings, 'function')
  assert.equal(typeof adapter.deriveGlobalFiltersFromControlState, 'function')
  assert.equal(typeof adapter.deriveGlobalFiltersFromSelection, 'function')
})
