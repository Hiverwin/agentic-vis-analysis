import test from 'node:test'
import assert from 'node:assert/strict'
import { cloneJsonValue } from './clone.js'

test('cloneJsonValue copies JSON-compatible values without sharing nested state', () => {
  const source = { nested: { values: [1, 2] } }
  const copy = cloneJsonValue(source)

  assert.deepEqual(copy, source)
  assert.notStrictEqual(copy, source)
  assert.notStrictEqual(copy.nested, source.nested)
  assert.notStrictEqual(copy.nested.values, source.nested.values)
})

test('cloneJsonValue preserves nullish values', () => {
  assert.equal(cloneJsonValue(null), null)
  assert.equal(cloneJsonValue(undefined), undefined)
})
