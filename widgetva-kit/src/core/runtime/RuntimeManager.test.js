import test from 'node:test'
import assert from 'node:assert/strict'

import { createRuntimeManager } from './RuntimeManager.js'

test('RuntimeManager attaches an active controller and reads recoverable state from controller.pagePort', async () => {
  const manager = createRuntimeManager()
  const controller = {
    pagePort: {
      async readState() {
        return {
          stateId: 'main:s2',
          widgets: {
            scatter: {
              ref: 'scatter',
            },
          },
        }
      },
    },
  }

  await manager.attachController(controller)
  const snapshot = await manager.captureRecoverableState()

  assert.equal(manager.readActiveController(), controller)
  assert.equal(snapshot?.stateId, 'main:s2')
  assert.equal(manager.readRecoverableState()?.stateId, 'main:s2')
})

test('RuntimeManager replaces the active controller, captures recoverable state, and disposes the previous controller', async () => {
  const events = []
  const manager = createRuntimeManager()
  const previousController = {
    pagePort: {
      async readState() {
        events.push('readPreviousState')
        return { stateId: 'main:s9' }
      },
    },
    dispose() {
      events.push('disposePrevious')
    },
  }
  const nextController = {
    pagePort: {
      async readState() {
        return { stateId: 'main:s10' }
      },
    },
  }

  await manager.attachController(previousController)
  const result = await manager.replaceController(nextController)

  assert.equal(result.previousController, previousController)
  assert.equal(result.activeController, nextController)
  assert.equal(result.recoverableState?.stateId, 'main:s9')
  assert.equal(manager.readActiveController(), nextController)
  assert.equal(manager.readRecoverableState()?.stateId, 'main:s9')
  assert.deepEqual(events, ['readPreviousState', 'disposePrevious'])
})

test('RuntimeManager keeps the last recoverable state even when the next controller cannot yet produce one', async () => {
  const manager = createRuntimeManager()
  const previousController = {
    pagePort: {
      async readState() {
        return { stateId: 'main:s4' }
      },
    },
  }
  const nextController = {
    pagePort: {
      async readState() {
        return null
      },
    },
  }

  await manager.attachController(previousController)
  await manager.captureRecoverableState()
  await manager.replaceController(nextController, { captureNextState: true })

  assert.equal(manager.readActiveController(), nextController)
  assert.equal(manager.readRecoverableState()?.stateId, 'main:s4')
})

test('RuntimeManager.runWithActiveController enforces a single active-controller entry point', async () => {
  const manager = createRuntimeManager()

  await assert.rejects(
    () => manager.runWithActiveController(async () => 'unreachable'),
    /RuntimeManager does not have an active controller\./,
  )

  const controller = { label: 'controller_a' }
  await manager.attachController(controller)
  const result = await manager.runWithActiveController(async (activeController) => activeController.label)

  assert.equal(result, 'controller_a')
})

test('RuntimeManager.clearController clears the active controller but preserves the captured recoverable state', async () => {
  const events = []
  const manager = createRuntimeManager()
  const controller = {
    pagePort: {
      async readState() {
        return { stateId: 'main:s7' }
      },
    },
    dispose() {
      events.push('dispose')
    },
  }

  await manager.attachController(controller)
  await manager.clearController()

  assert.equal(manager.readActiveController(), null)
  assert.equal(manager.readRecoverableState()?.stateId, 'main:s7')
  assert.deepEqual(events, ['dispose'])
})

test('RuntimeManager.clearController can discard recoverable state when preserveRecoverableState is false', async () => {
  const manager = createRuntimeManager()
  const controller = {
    pagePort: {
      async readState() {
        return { stateId: 'main:s8' }
      },
    },
    dispose() {},
  }

  await manager.attachController(controller)
  await manager.captureRecoverableState()
  await manager.clearController({
    preserveRecoverableState: false,
    capturePreviousState: false,
  })

  assert.equal(manager.readActiveController(), null)
  assert.equal(manager.readRecoverableState(), null)
})

test('RuntimeManager.canContinueRequest enforces the active controller and optional pagePort requirement', async () => {
  const manager = createRuntimeManager()

  assert.equal(manager.canContinueRequest(), false)

  await manager.attachController({ runAgentLoop() {} })
  assert.equal(manager.canContinueRequest(), true)
  assert.equal(manager.canContinueRequest({ requirePagePort: true }), false)

  await manager.replaceController({
    pagePort: {},
    runAgentLoop() {},
  })
  assert.equal(manager.canContinueRequest({ requirePagePort: true }), true)
})
