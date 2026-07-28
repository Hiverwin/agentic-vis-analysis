import test from 'node:test'
import assert from 'node:assert/strict'

import {
  makeActionDescriptor,
  makeFilterEffect,
  makeSelectionEffect,
} from './action-contracts.js'

test('makeActionDescriptor injects queryScope and stable action defaults', () => {
  const descriptor = makeActionDescriptor({
    name: 'bar.selectCategory',
    title: 'Select category',
    description: 'Select bar categories.',
    category: 'selection',
    paramsSchema: {
      type: 'object',
      properties: {
        field: { type: 'string' },
        values: { type: 'array', items: { type: 'string' } },
      },
      required: ['field', 'values'],
    },
  })

  assert.equal(descriptor.scope, 'local')
  assert.equal(descriptor.supportedWidgetKinds, null)
  assert.deepEqual(descriptor.affectedRefs, [])
  assert.deepEqual(descriptor.affectedStatePaths, [])
  assert.deepEqual(descriptor.effects, [])
  assert.equal(descriptor.reversible, false)
  assert.deepEqual(descriptor.preconditions, [])
  assert.deepEqual(descriptor.postconditions, [])
  assert.deepEqual(descriptor.examples, [])
  assert.equal('primitive' in descriptor, false)
  assert.equal(descriptor.paramsSchema.properties.field.type, 'string')
  assert.equal(descriptor.paramsSchema.properties.queryScope.type, 'object')
  assert.equal(descriptor.paramsSchema.properties.queryScope.properties.widgetRef, undefined)
  assert.deepEqual(descriptor.paramsSchema.required, ['field', 'values'])
})

test('action effect helpers build schema-compatible effect descriptors', () => {
  assert.deepEqual(
    makeSelectionEffect('widget-a', 'Selects values.'),
    {
      kind: 'updatesSelection',
      ref: 'widget-a',
      description: 'Selects values.',
    },
  )
  assert.deepEqual(
    makeFilterEffect('widget-b', 'Filters linked widgets.'),
    {
      kind: 'filtersWidget',
      ref: 'widget-b',
      description: 'Filters linked widgets.',
    },
  )
})
