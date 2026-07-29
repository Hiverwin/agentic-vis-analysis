import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildFirstPartyControlState,
  buildFirstPartyRangeDomains,
  buildFirstPartyWorkspaceControlStateAdapter,
  deriveFirstPartyCoordinationControlState,
  deriveFirstPartyControlFilterPatch,
  deriveFirstPartyControlProjection,
  deriveFirstPartyGlobalFiltersFromControlState,
  deriveFirstPartyGlobalFiltersFromSelection,
} from './workspaceControlStateAdapter.js'

test('buildFirstPartyControlState returns host-owned generic control state', () => {
  assert.deepEqual(buildFirstPartyControlState({
    controlState: {
      category: 'A',
      range: [0, 10],
    },
  }), {
    category: 'A',
    range: [0, 10],
  })
})

test('buildFirstPartyRangeDomains returns host-owned generic range domains', () => {
  assert.deepEqual(buildFirstPartyRangeDomains({
    controlRangeDomains: {
      range: [0, 100],
    },
  }), {
    range: [0, 100],
  })
})

test('deriveFirstPartyCoordinationControlState keeps only generic focus metadata', () => {
  assert.deepEqual(deriveFirstPartyCoordinationControlState({
    globalFilters: {
      category: 'A',
    },
    focusedWidgetId: 'w_imported_primary',
  }), {
    filters: {},
    focus: {},
    focusedWidgetId: 'w_imported_primary',
  })
})

test('deriveFirstPartyControlProjection converts coordination state into generic app controls', () => {
  assert.deepEqual(deriveFirstPartyControlProjection({
    filters: {
      category: 'A',
    },
    focusedWidgetId: 'w_imported_primary',
  }), {
    controlState: {
      category: 'A',
    },
    selectedWidgetId: 'w_imported_primary',
  })
})

test('deriveFirstPartyControlFilterPatch no longer maps canonical filters into demo-specific controls', () => {
  assert.deepEqual(deriveFirstPartyControlFilterPatch({
    category: 'A',
  }), {})
})

test('deriveFirstPartyGlobalFiltersFromControlState forwards generic host controls', () => {
  assert.deepEqual(deriveFirstPartyGlobalFiltersFromControlState({
    category: 'A',
    range: [0, 10],
  }), {
    category: 'A',
    range: [0, 10],
  })
})

test('deriveFirstPartyGlobalFiltersFromSelection preserves generic selection predicates', () => {
  assert.deepEqual(deriveFirstPartyGlobalFiltersFromSelection({
    predicates: [
      { field: 'category', op: 'equals', value: 'A' },
      { field: 'value', op: 'between', value: [0, 10] },
    ],
  }), {
    predicates: [
      { field: 'category', op: 'equals', value: 'A' },
      { field: 'value', op: 'between', value: [0, 10] },
    ],
  })
})

test('buildFirstPartyWorkspaceControlStateAdapter exposes the full adapter contract used by runtime sessions', () => {
  const adapter = buildFirstPartyWorkspaceControlStateAdapter()

  assert.equal(typeof adapter.deriveCoordinationControlState, 'function')
  assert.equal(typeof adapter.deriveControlProjection, 'function')
  assert.equal(typeof adapter.deriveGlobalFiltersFromControlState, 'function')
  assert.equal(typeof adapter.deriveGlobalFiltersFromSelection, 'function')
})
