import test from 'node:test'
import assert from 'node:assert/strict'

import {
  attachOfficialPageController,
  canContinueOfficialPageRequest,
  clearOfficialPageRuntime,
  ensureOfficialPageRuntimeManager,
  readManagedController,
  runOfficialPageWithManager,
  tryRestoreOfficialPageRecoverableState,
} from './officialPageRuntimeManager.js'

test('ensureOfficialPageRuntimeManager creates a reusable manager on the bootstrap entry', () => {
  const entry = {}
  const manager = ensureOfficialPageRuntimeManager(entry)

  assert.equal(typeof manager.attachController, 'function')
  assert.equal(ensureOfficialPageRuntimeManager(entry), manager)
})

test('attachOfficialPageController replaces controllers and restores recoverable state through pagePort.jumpToState', async () => {
  const entry = {}
  const jumpCalls = []

  await attachOfficialPageController(entry, {
    pagePort: {
      async readState() {
        return { stateId: 'main:s1' }
      },
    },
  })

  await attachOfficialPageController(entry, {
    pagePort: {
      async jumpToState(options = {}) {
        jumpCalls.push(options)
        return { ok: true, stateId: options.stateId }
      },
    },
  })

  assert.equal(typeof readManagedController(entry)?.pagePort?.jumpToState, 'function')
  assert.deepEqual(jumpCalls, [{ stateId: 'main:s1' }])
  assert.equal(entry.manager.readRecoverableState()?.stateId, 'main:s1')
})

test('clearOfficialPageRuntime can discard recoverable state for page navigation resets', async () => {
  const entry = {}

  await attachOfficialPageController(entry, {
    pagePort: {
      async readState() {
        return { stateId: 'main:s9' }
      },
    },
  })

  await clearOfficialPageRuntime(entry, {
    capturePreviousState: false,
    preserveRecoverableState: false,
  })

  assert.equal(readManagedController(entry), null)
  assert.equal(entry.manager.readRecoverableState(), null)
})

test('runOfficialPageWithManager routes agent execution through the active controller', async () => {
  const entry = {}
  await attachOfficialPageController(entry, {
    pagePort: { kind: 'page-port' },
    async runAgentLoop(options = {}) {
      return { ok: true, options }
    },
  })

  const result = await runOfficialPageWithManager(entry, (controller) => controller.runAgentLoop({ objective: 'test' }))
  assert.deepEqual(result, { ok: true, options: { objective: 'test' } })
})

test('canContinueOfficialPageRequest requires an active controller with a pagePort', async () => {
  const entry = {}
  assert.equal(canContinueOfficialPageRequest(entry), false)

  await attachOfficialPageController(entry, {
    runAgentLoop() {},
  })
  assert.equal(canContinueOfficialPageRequest(entry), false)

  await attachOfficialPageController(entry, {
    pagePort: {},
    runAgentLoop() {},
  })
  assert.equal(canContinueOfficialPageRequest(entry), true)
})

test('tryRestoreOfficialPageRecoverableState prefers controller.restoreRecoverableState when available', async () => {
  let restored = null
  const result = await tryRestoreOfficialPageRecoverableState({
    async restoreRecoverableState(state) {
      restored = state
    },
  }, { stateId: 'main:s3' })

  assert.equal(result.restored, true)
  assert.equal(result.method, 'restoreRecoverableState')
  assert.deepEqual(restored, { stateId: 'main:s3' })
})
