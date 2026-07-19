function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

async function readOfficialPageRecoverableState(controller = null) {
  if (!controller || typeof controller !== 'object') {
    return null
  }

  if (typeof controller.readRecoverableState === 'function') {
    return controller.readRecoverableState()
  }

  if (typeof controller.readState === 'function') {
    return controller.readState()
  }

  if (typeof controller?.pagePort?.readState === 'function') {
    return controller.pagePort.readState()
  }

  if (typeof controller?.runtime?.readState === 'function') {
    return controller.runtime.readState()
  }

  return null
}

function resolveOfficialPageRuntime(controller = null, binding = null) {
  return controller?.runtime
    || controller?.widget?.runtime
    || binding?.runtime
    || controller?.pagePort?.runtime
    || null
}

function createOfficialPageControllerManager({
  readRecoverableState = readOfficialPageRecoverableState,
  restoreRecoverableState = tryRestoreOfficialPageRecoverableState,
} = {}) {
  let activeRuntime = null
  let activeController = null
  let activeBinding = null
  let attachmentMetadata = null
  let recoverableState = null
  let replacementCount = 0

  async function captureRecoverableState(controller = activeController) {
    const nextState = await readRecoverableState(controller)
    if (nextState != null) {
      recoverableState = clone(nextState)
    }
    return clone(recoverableState)
  }

  async function attachController(controller, {
    runtime = null,
    binding = null,
    metadata = null,
  } = {}) {
    activeController = controller || null
    activeBinding = binding || controller?.pagePort || null
    activeRuntime = runtime || resolveOfficialPageRuntime(activeController, activeBinding)
    attachmentMetadata = metadata ? clone(metadata) : null
    return activeController
  }

  async function replaceController(nextController, {
    runtime = null,
    binding = null,
    metadata = null,
    capturePreviousState = true,
    captureNextState = false,
    restorePreviousState = false,
    disposePrevious = true,
  } = {}) {
    const previousRuntime = activeRuntime
    const previousController = activeController
    const previousBinding = activeBinding
    const previousMetadata = clone(attachmentMetadata)

    if (capturePreviousState && previousController) {
      await captureRecoverableState(previousController)
    }

    activeController = nextController || null
    activeBinding = binding || nextController?.pagePort || null
    activeRuntime = runtime || resolveOfficialPageRuntime(activeController, activeBinding)
    attachmentMetadata = metadata ? clone(metadata) : null
    replacementCount += 1

    if (captureNextState && activeController) {
      await captureRecoverableState(activeController)
    }

    let restoreResult = {
      restored: false,
      reason: restorePreviousState ? 'missing-controller-or-state' : 'not-requested',
    }
    if (restorePreviousState && activeController && recoverableState != null) {
      restoreResult = await restoreRecoverableState(activeController, clone(recoverableState))
    }

    if (disposePrevious && previousController && typeof previousController.dispose === 'function') {
      previousController.dispose()
    }

    return {
      previousRuntime,
      previousController,
      previousBinding,
      previousMetadata,
      activeRuntime,
      activeController,
      activeBinding,
      attachmentMetadata: clone(attachmentMetadata),
      recoverableState: clone(recoverableState),
      restoreResult,
      replacementCount,
    }
  }

  async function clearController({
    capturePreviousState = true,
    disposePrevious = true,
    preserveRecoverableState = true,
  } = {}) {
    const result = await replaceController(null, {
      capturePreviousState,
      captureNextState: false,
      disposePrevious,
    })

    if (!preserveRecoverableState) {
      recoverableState = null
    }
    activeBinding = null
    attachmentMetadata = null

    return result
  }

  function canContinueRequest({ requirePagePort = false } = {}) {
    if (!activeController) {
      return false
    }
    return !requirePagePort || Boolean(activeBinding || activeController?.pagePort)
  }

  async function runWithActiveController(handler) {
    if (typeof handler !== 'function') {
      throw new Error('WidgetVA official page runtime manager requires a handler function.')
    }
    if (!activeController) {
      throw new Error('WidgetVA official page runtime manager does not have an active controller.')
    }
    return handler(activeController)
  }

  function describeRuntimeManager() {
    return {
      hasActiveRuntime: Boolean(activeRuntime),
      hasActiveController: Boolean(activeController),
      hasActiveBinding: Boolean(activeBinding),
      recoverableStateId: recoverableState?.stateId || null,
      replacementCount,
    }
  }

  return {
    attachController,
    replaceController,
    clearController,
    captureRecoverableState,
    runWithActiveController,
    readActiveRuntime: () => activeRuntime,
    readActiveController: () => activeController,
    readActiveBinding: () => activeBinding,
    readAttachmentMetadata: () => clone(attachmentMetadata),
    readRecoverableState: () => clone(recoverableState),
    describeRuntimeManager,
    canContinueRequest,
  }
}

export function ensureOfficialPageRuntimeManager(entry) {
  if (!entry || typeof entry !== 'object') {
    throw new Error('ensureOfficialPageRuntimeManager requires a bootstrap entry object.')
  }

  if (!entry.manager || typeof entry.manager !== 'object') {
    entry.manager = createOfficialPageControllerManager()
  }

  return entry.manager
}

export function readManagedController(entry) {
  return entry?.manager?.readActiveController?.() ?? null
}

export function readManagedRuntime(entry) {
  return entry?.manager?.readActiveRuntime?.() ?? null
}

export function readManagedBinding(entry) {
  return entry?.manager?.readActiveBinding?.() ?? null
}

export function createManagedPagePort(entry) {
  return new Proxy({}, {
    get(_target, property) {
      const resolveBinding = () => readManagedBinding(entry) || readManagedController(entry)?.pagePort || null
      const binding = resolveBinding()
      const value = binding?.[property]

      if (typeof value !== 'function') {
        return value
      }

      return (...args) => {
        const currentBinding = resolveBinding()
        const currentValue = currentBinding?.[property]
        if (typeof currentValue !== 'function') {
          throw new Error(`WidgetVA official page runtime does not expose pagePort.${String(property)}().`)
        }
        return currentValue.apply(currentBinding, args)
      }
    },
  })
}

export function canContinueOfficialPageRequest(entry) {
  const manager = entry?.manager
  if (!manager || typeof manager.canContinueRequest !== 'function') {
    return Boolean(readManagedController(entry))
  }

  return manager.canContinueRequest({ requirePagePort: true })
}

function isRecoverableOfficialPageRuntimeError(error) {
  const message = error?.message || ''
  return message.includes('WidgetVA official page runtime is not ready.')
    || message.includes('WidgetVA official page runtime does not expose pagePort.')
    || message.includes('RuntimeManager does not have an active controller.')
}

async function ensureOfficialPageRequestReady(entry, rebootstrap = null, { forceReattach = false } = {}) {
  if (typeof rebootstrap === 'function') {
    await rebootstrap({ forceReattach })
  }

  if (!canContinueOfficialPageRequest(entry)) {
    throw new Error('WidgetVA official page runtime is not ready.')
  }
}

export async function attachOfficialPageController(entry, controller, {
  restoreRecoverableState = true,
  runtime = null,
  binding = null,
  metadata = null,
} = {}) {
  const manager = ensureOfficialPageRuntimeManager(entry)
  const hasManagedController = Boolean(readManagedController(entry))
  const hasRecoverableState = manager.readRecoverableState() != null
  return manager.replaceController(controller, {
    runtime,
    binding,
    metadata,
    captureNextState: !hasManagedController && !hasRecoverableState,
    restorePreviousState: restoreRecoverableState,
  })
}

export async function clearOfficialPageRuntime(entry, {
  disposePrevious = true,
  capturePreviousState = false,
  preserveRecoverableState = false,
} = {}) {
  const manager = ensureOfficialPageRuntimeManager(entry)
  return manager.clearController({
    disposePrevious,
    capturePreviousState,
    preserveRecoverableState,
  })
}

export async function runOfficialPageWithManager(entry, handler, {
  rebootstrap = null,
  retryRecoverableBridgeError = false,
  isRecoverableBridgeError = null,
} = {}) {
  const manager = ensureOfficialPageRuntimeManager(entry)

  await ensureOfficialPageRequestReady(entry, rebootstrap)

  const run = () => manager.runWithActiveController(handler)

  try {
    return await run()
  } catch (error) {
    const recoverableBridgeError = retryRecoverableBridgeError
      && typeof isRecoverableBridgeError === 'function'
      && isRecoverableBridgeError(error)
    const recoverableRuntimeError = isRecoverableOfficialPageRuntimeError(error)

    if (!recoverableBridgeError && !recoverableRuntimeError) {
      throw error
    }

    await ensureOfficialPageRequestReady(entry, rebootstrap, { forceReattach: true })
    return run()
  }
}

export async function tryRestoreOfficialPageRecoverableState(controller, recoverableState) {
  if (!controller || !recoverableState) {
    return { restored: false, reason: 'missing-controller-or-state' }
  }

  if (typeof controller.restoreRecoverableState === 'function') {
    try {
      await controller.restoreRecoverableState(recoverableState)
      return { restored: true, method: 'restoreRecoverableState' }
    } catch (error) {
      return {
        restored: false,
        method: 'restoreRecoverableState',
        error: summarizeManagedRuntimeError(error),
      }
    }
  }

  const stateId = recoverableState?.stateId || recoverableState?.shared?.stateId || null
  const pagePort = controller.pagePort || null

  if (stateId && typeof pagePort?.jumpToState === 'function') {
    try {
      await pagePort.jumpToState({ stateId })
      return { restored: true, method: 'jumpToState', stateId }
    } catch (error) {
      return {
        restored: false,
        method: 'jumpToState',
        stateId,
        error: summarizeManagedRuntimeError(error),
      }
    }
  }

  return { restored: false, reason: 'no-restore-surface' }
}

export function summarizeManagedRuntimeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
    }
  }

  return {
    name: 'Error',
    message: String(error || 'Unknown WidgetVA official page runtime error.'),
  }
}
