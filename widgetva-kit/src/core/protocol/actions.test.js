import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeActionCallSchema,
  describeActionDescriptorSchema,
  makeActionDescriptor,
} from './actions.js'

test('makeActionDescriptor defaults supportedWidgetKinds to null', () => {
  const descriptor = makeActionDescriptor({
    name: 'widget.testAction',
    title: 'Test action',
    description: 'Test descriptor.',
    primitive: 'select',
    category: 'selection',
  })

  assert.equal(descriptor.supportedWidgetKinds, null)
})

test('describeActionDescriptorSchema admits supportedWidgetKinds', () => {
  const schema = describeActionDescriptorSchema()

  assert.equal(schema.properties?.supportedWidgetKinds?.anyOf?.[0]?.type, 'null')
  assert.equal(schema.properties?.supportedWidgetKinds?.anyOf?.[1]?.items?.type, 'string')
})

test('action descriptors and calls admit queryScope as a first-class target input', () => {
  const descriptor = makeActionDescriptor({
    name: 'widget.testAction',
    title: 'Test action',
    description: 'Test descriptor.',
    primitive: 'select',
    category: 'selection',
    paramsSchema: {
      type: 'object',
      properties: {
        field: { type: 'string' },
      },
    },
  })
  const callSchema = describeActionCallSchema()

  assert.equal(descriptor.paramsSchema?.properties?.queryScope?.type, 'object')
  assert.equal(callSchema.properties?.queryScope?.type, 'object')
  assert.equal(callSchema.properties?.targetRef, undefined)
})
