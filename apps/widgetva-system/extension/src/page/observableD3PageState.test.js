import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ensureObservableD3PageBootstrapEntry,
  markObservableD3BootstrapBooting,
  recordObservableD3BootstrapError,
} from './observableD3PageState.js'

function createRoot() {
  return {}
}

test('markObservableD3BootstrapBooting preserves existing manager-owned fields on the bootstrap entry', () => {
  const root = createRoot()
  const entry = ensureObservableD3PageBootstrapEntry(root)
  entry.manager = { kind: 'runtime-manager' }
  entry.controller = { kind: 'controller' }
  entry.customField = 'keep-me'

  const updated = markObservableD3BootstrapBooting(root)

  assert.equal(updated, entry)
  assert.equal(updated.status, 'booting')
  assert.deepEqual(updated.manager, { kind: 'runtime-manager' })
  assert.deepEqual(updated.controller, { kind: 'controller' })
  assert.equal(updated.customField, 'keep-me')
})

test('recordObservableD3BootstrapError records error details without replacing the bootstrap entry object', () => {
  const root = createRoot()
  const entry = ensureObservableD3PageBootstrapEntry(root)
  entry.manager = { kind: 'runtime-manager' }
  const error = new Error('worker frame timed out')
  error.code = 'bridge_timeout'

  const updated = recordObservableD3BootstrapError(root, error)

  assert.equal(updated, entry)
  assert.equal(updated.status, 'error')
  assert.equal(updated.error?.message, 'worker frame timed out')
  assert.equal(updated.error?.code, 'bridge_timeout')
  assert.deepEqual(updated.manager, { kind: 'runtime-manager' })
})
