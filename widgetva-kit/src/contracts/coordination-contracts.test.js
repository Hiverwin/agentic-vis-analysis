import test from 'node:test'
import assert from 'node:assert/strict'

import {
  makeCoordinationRelation,
  makeCoordinationRelationMap,
} from './coordination-contracts.js'

test('makeCoordinationRelation normalizes the state-to-state relation shape', () => {
  assert.deepEqual(makeCoordinationRelation({
    id: 'rel_1',
    sourceStateRef: 'wl://demo/widget/bar/selection/region',
    targetStateRef: 'wl://demo/widget/scatter/transform/region-filter',
    transform: {
      kind: 'selectionToFilter',
    },
    activationPolicy: 'manual',
  }), {
    ref: 'rel_1',
    sourceStateRef: 'wl://demo/widget/bar/selection/region',
    targetStateRef: 'wl://demo/widget/scatter/transform/region-filter',
    relation: 'controls',
    transform: {
      kind: 'selectionToFilter',
    },
    activation: 'manual',
  })
})

test('makeCoordinationRelationMap accepts arrays and keyed objects', () => {
  const relation = {
    ref: 'rel_1',
    sourceStateRef: 'source',
    targetStateRef: 'target',
  }

  assert.deepEqual(Object.keys(makeCoordinationRelationMap([relation])), ['rel_1'])
  assert.deepEqual(Object.keys(makeCoordinationRelationMap({ rel_2: relation })), ['rel_2'])
})
