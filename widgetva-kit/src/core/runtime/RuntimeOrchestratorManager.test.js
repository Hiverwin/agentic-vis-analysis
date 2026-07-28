import test from 'node:test'
import assert from 'node:assert/strict'

import { createWidgetVARuntime } from './RuntimeOrchestrator.js'

function createManagedRuntime(options = {}) {
  globalThis.window = {}
  return createWidgetVARuntime(options)
}

test('RuntimeOrchestrator exposes a controller manager for recoverable state', async () => {
  const runtime = createManagedRuntime()
  const manager = runtime.runtimeManager

  assert.equal(manager.readActiveRuntime(), runtime)
  assert.equal(manager.readActiveController()?.runtime, runtime)
  assert.equal(manager.readRecoverableState()?.stateId, runtime.readState()?.stateId)
  assert.equal(runtime.describeRuntimeManager().hasActiveRuntime, true)
  assert.equal(runtime.describeRuntimeManager().hasActiveController, true)
})

test('RuntimeOrchestrator controller manager replaces controllers and preserves recoverable state', async () => {
  const runtime = createManagedRuntime()
  const manager = runtime.runtimeManager
  const events = []
  const previousRuntime = { kind: 'runtime_previous' }
  const previousController = {
    runtime: previousRuntime,
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
  const nextRuntime = { kind: 'runtime_next' }
  const nextController = {
    runtime: nextRuntime,
    pagePort: {
      async readState() {
        return { stateId: 'main:s10' }
      },
    },
  }

  await manager.attachController(previousController)
  const result = await manager.replaceController(nextController, {
    metadata: { provider: 'observable-d3' },
  })

  assert.equal(result.previousRuntime, previousRuntime)
  assert.equal(result.previousController, previousController)
  assert.equal(result.previousBinding, previousController.pagePort)
  assert.equal(result.activeRuntime, nextRuntime)
  assert.equal(result.activeController, nextController)
  assert.equal(result.activeBinding, nextController.pagePort)
  assert.equal(result.attachmentMetadata?.provider, 'observable-d3')
  assert.equal(result.recoverableState?.stateId, 'main:s9')
  assert.equal(manager.readActiveRuntime(), nextRuntime)
  assert.equal(manager.readActiveController(), nextController)
  assert.equal(manager.readRecoverableState()?.stateId, 'main:s9')
  assert.deepEqual(events, ['readPreviousState', 'disposePrevious'])
})

test('RuntimeOrchestrator controller manager keeps last recoverable state when next controller has none', async () => {
  const runtime = createManagedRuntime()
  const manager = runtime.runtimeManager
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

test('RuntimeOrchestrator controller manager clears controllers and can discard recoverable state', async () => {
  const runtime = createManagedRuntime()
  const manager = runtime.runtimeManager
  const events = []
  const controller = {
    runtime: { kind: 'runtime_clear' },
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

  assert.equal(manager.readActiveRuntime(), null)
  assert.equal(manager.readActiveController(), null)
  assert.equal(manager.readActiveBinding(), null)
  assert.equal(manager.readAttachmentMetadata(), null)
  assert.equal(manager.readRecoverableState()?.stateId, 'main:s7')
  assert.deepEqual(events, ['dispose'])

  await manager.attachController(controller)
  await manager.captureRecoverableState()
  await manager.clearController({
    preserveRecoverableState: false,
    capturePreviousState: false,
  })

  assert.equal(manager.readActiveController(), null)
  assert.equal(manager.readRecoverableState(), null)
})

test('RuntimeOrchestrator controller manager enforces active controller continuation rules', async () => {
  const runtime = createManagedRuntime()
  const manager = runtime.runtimeManager

  await manager.clearController({ capturePreviousState: false, disposePrevious: false })
  assert.equal(manager.canContinueRequest(), false)

  await manager.attachController({ runAgentLoop() {} })
  assert.equal(manager.canContinueRequest(), true)
  assert.equal(manager.canContinueRequest({ requirePagePort: true }), false)

  await manager.replaceController({
    runtime: { kind: 'runtime_binding' },
    runAgentLoop() {},
  }, {
    binding: {},
  })
  assert.equal(manager.canContinueRequest({ requirePagePort: true }), true)
})

test('RuntimeOrchestrator controller manager infers active runtime from widget runtime', async () => {
  const runtime = createManagedRuntime()
  const manager = runtime.runtimeManager
  const widgetRuntime = { kind: 'widget_runtime' }

  await manager.attachController({
    widget: {
      runtime: widgetRuntime,
    },
    pagePort: {},
  })

  assert.equal(manager.readActiveRuntime(), widgetRuntime)
  assert.equal(manager.describeRuntimeManager().hasActiveRuntime, true)
})
