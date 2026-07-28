import test from 'node:test'
import assert from 'node:assert/strict'

import { readStateByRef } from './workspaceStoreReaders.js'
import { patchStateByRef } from './workspaceStoreMutators.js'

const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
const transformRef = `${widgetRef}/transform/region-filter`
const selectionRef = `${widgetRef}/selection/region`

function makeState() {
  return {
    stateId: 'main:s1',
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        encodings: {
          x: { field: 'marketing_spend' },
        },
        view: {
          xDomain: [0, 5000],
          zoom: {
            sourceAction: 'scatter.zoomDomain',
          },
        },
        transforms: [
          {
            ref: transformRef,
            kind: 'filter',
            predicate: { field: 'region', op: 'in', value: ['Central'] },
          },
        ],
        selections: {
          [selectionRef]: {
            ref: selectionRef,
            field: 'region',
            values: ['Central'],
          },
        },
      },
    },
  }
}

test('readStateByRef reads canonical widget substates by stable refs', () => {
  const state = makeState()

  assert.deepEqual(readStateByRef(state, `${widgetRef}/view/zoom`), {
    sourceAction: 'scatter.zoomDomain',
    xDomain: [0, 5000],
  })
  assert.equal(readStateByRef(state, transformRef)?.predicate?.value[0], 'Central')
  assert.equal(readStateByRef(state, selectionRef)?.values[0], 'Central')
  assert.equal(readStateByRef(state, `${widgetRef}/encoding/x`)?.field, 'marketing_spend')
})

test('patchStateByRef replaces addressable transform array items without map conversion', () => {
  const state = makeState()
  const nextState = patchStateByRef(state, transformRef, {
    kind: 'filter',
    predicate: { field: 'region', op: 'in', value: ['Downtown'] },
  })

  assert.equal(Array.isArray(nextState.widgets[widgetRef].transforms), true)
  assert.equal(nextState.widgets[widgetRef].transforms.length, 1)
  assert.deepEqual(readStateByRef(nextState, transformRef)?.predicate, {
    field: 'region',
    op: 'in',
    value: ['Downtown'],
  })
})

test('patchStateByRef patches selection, view, and encoding refs', () => {
  const state = makeState()
  const withSelection = patchStateByRef(state, selectionRef, { values: ['Downtown'] })
  const withView = patchStateByRef(withSelection, `${widgetRef}/view/zoom`, { yDomain: [6000, 12000] })
  const withEncoding = patchStateByRef(withView, `${widgetRef}/encoding/x`, { title: 'Marketing spend' })

  assert.deepEqual(readStateByRef(withEncoding, selectionRef)?.values, ['Downtown'])
  assert.deepEqual(readStateByRef(withEncoding, `${widgetRef}/view/zoom`)?.yDomain, [6000, 12000])
  assert.equal(readStateByRef(withEncoding, `${widgetRef}/encoding/x`)?.title, 'Marketing spend')
})
