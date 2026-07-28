import test from 'node:test'
import assert from 'node:assert/strict'

import { makePerceptionDescriptor } from './perception-contracts.js'

test('makePerceptionDescriptor injects queryScope and stable perception defaults', () => {
  const descriptor = makePerceptionDescriptor({
    name: 'perception.inspectVisibleRows',
    category: 'inspect',
    paramsSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1 },
      },
      required: ['limit'],
    },
  })

  assert.equal(descriptor.targetRef, null)
  assert.equal('primitive' in descriptor, false)
  assert.equal(descriptor.sideEffectFree, true)
  assert.deepEqual(descriptor.evidenceKinds, [])
  assert.deepEqual(descriptor.verificationTargets, [])
  assert.deepEqual(descriptor.examples, [])
  assert.equal(descriptor.paramsSchema.properties.limit.type, 'integer')
  assert.equal(descriptor.paramsSchema.properties.queryScope.type, 'object')
  assert.equal(descriptor.paramsSchema.properties.queryScope.properties.widgetRef, undefined)
  assert.deepEqual(descriptor.paramsSchema.required, ['limit'])
  assert.equal(descriptor.returnsSchema.type, 'object')
})

test('makePerceptionDescriptor uses verify-action params contract by query name', () => {
  const descriptor = makePerceptionDescriptor({
    name: 'perception.verifyActionEffect',
    category: 'verify',
  })

  assert.equal(descriptor.paramsSchema.properties.actionName.type, 'string')
  assert.equal('primitive' in descriptor, false)
  assert.equal(descriptor.paramsSchema.properties.queryScope.type, 'object')
  assert.equal(descriptor.paramsSchema.properties.queryScope.properties.widgetRef, undefined)
  assert.equal(descriptor.returnsSchema.type, 'object')
})
