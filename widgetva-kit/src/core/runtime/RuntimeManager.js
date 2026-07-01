function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

async function defaultReadRecoverableState(controller = null) {
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

export function createRuntimeManager({
  readRecoverableState = defaultReadRecoverableState,
} = {}) {
  let activeController = null
  let recoverableState = null
  let replacementCount = 0

  async function captureRecoverableState(controller = activeController) {
    const nextState = await readRecoverableState(controller)
    if (nextState != null) {
      recoverableState = clone(nextState)
    }
    return clone(recoverableState)
  }

  async function attachController(controller) {
    activeController = controller || null
    return activeController
  }

  function seedRecoverableState(state) {
    recoverableState = clone(state)
    return clone(recoverableState)
  }

  async function replaceController(nextController, {
    capturePreviousState = true,
    captureNextState = false,
    disposePrevious = true,
  } = {}) {
    const previousController = activeController
    if (capturePreviousState && previousController) {
      await captureRecoverableState(previousController)
    }

    activeController = nextController || null
    replacementCount += 1

    if (captureNextState && activeController) {
      await captureRecoverableState(activeController)
    }

    if (disposePrevious && previousController && typeof previousController.dispose === 'function') {
      previousController.dispose()
    }

    return {
      previousController,
      activeController,
      recoverableState: clone(recoverableState),
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

    return result
  }

  function canContinueRequest({
    requirePagePort = false,
  } = {}) {
    if (!activeController) {
      return false
    }

    if (!requirePagePort) {
      return true
    }

    return Boolean(activeController?.pagePort)
  }

  async function runWithActiveController(handler) {
    if (typeof handler !== 'function') {
      throw new Error('RuntimeManager.runWithActiveController requires a handler function.')
    }
    if (!activeController) {
      throw new Error('RuntimeManager does not have an active controller.')
    }
    return handler(activeController)
  }

  function describeRuntimeManager() {
    return {
      hasActiveController: Boolean(activeController),
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
    readActiveController() {
      return activeController
    },
    readRecoverableState() {
      return clone(recoverableState)
    },
    seedRecoverableState,
    describeRuntimeManager,
    canContinueRequest,
  }
}
