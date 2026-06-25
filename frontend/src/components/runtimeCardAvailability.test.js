import test from 'node:test'
import assert from 'node:assert/strict'

import { canInspectRuntime } from './runtimeCardAvailability.js'

test('canInspectRuntime depends on runtime presence rather than an external spec prop', () => {
  assert.equal(canInspectRuntime(null), false)
  assert.equal(canInspectRuntime(undefined), false)
  assert.equal(canInspectRuntime({ store: {} }), true)
})
