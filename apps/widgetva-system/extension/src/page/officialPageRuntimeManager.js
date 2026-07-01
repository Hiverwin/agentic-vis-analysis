import { createRuntimeManager } from '../../../../../widgetva-kit/src/coreRuntime.js'

export function ensureOfficialPageRuntimeManager(entry) {
  if (!entry || typeof entry !== 'object') {
    throw new Error('ensureOfficialPageRuntimeManager requires a bootstrap entry object.')
  }

  if (!entry.manager || typeof entry.manager !== 'object') {
    entry.manager = createRuntimeManager()
  }

  return entry.manager
}

export function readManagedController(entry) {
  return entry?.manager?.readActiveController?.() ?? null
}

export function canContinueOfficialPageRequest(entry) {
  const manager = entry?.manager
  if (!manager || typeof manager.canContinueRequest !== 'function') {
    return Boolean(readManagedController(entry))
  }

  return manager.canContinueRequest({ requirePagePort: true })
}

export async function attachOfficialPageController(entry, controller, {
  restoreRecoverableState = true,
} = {}) {
  const manager = ensureOfficialPageRuntimeManager(entry)
  const previousController = readManagedController(entry)
  let replacementResult = null

  if (previousController) {
    replacementResult = await manager.replaceController(controller)
  } else {
    await manager.attachController(controller)
    await manager.captureRecoverableState(controller)
    replacementResult = {
      previousController: null,
      activeController: controller,
      recoverableState: manager.readRecoverableState(),
      replacementCount: manager.describeRuntimeManager?.()?.replacementCount ?? 0,
    }
  }

  let restoreResult = { restored: false, reason: 'not-requested' }
  if (restoreRecoverableState && previousController) {
    restoreResult = await tryRestoreOfficialPageRecoverableState(
      controller,
      manager.readRecoverableState(),
    )
  }

  return {
    ...replacementResult,
    restoreResult,
  }
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

export async function runOfficialPageWithManager(entry, handler) {
  const manager = ensureOfficialPageRuntimeManager(entry)
  return manager.runWithActiveController(handler)
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
