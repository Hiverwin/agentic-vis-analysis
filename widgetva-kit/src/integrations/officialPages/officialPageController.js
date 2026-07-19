function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function attachRecoverableState(result, syncResult = null) {
  const recoverableState = isPlainObject(syncResult?.recoverableState)
    ? clone(syncResult.recoverableState)
    : null
  if (!recoverableState || !isPlainObject(result)) return result
  return {
    ...result,
    recoverableState,
    ...(isPlainObject(result.actionResult)
      ? {
          actionResult: {
            ...result.actionResult,
            recoverableState: clone(recoverableState),
          },
        }
      : {}),
  }
}

export function createPostActionSyncProxy(target, syncAfterAction) {
  if (!target || typeof target !== 'object') return target
  return new Proxy(target, {
    get(obj, prop, receiver) {
      if (prop === 'executeAction' || prop === 'executeVerifiedAction') {
        const original = Reflect.get(obj, prop, receiver)
        if (typeof original !== 'function') return original
        return async (...args) => {
          const result = await original.apply(obj, args)
          const syncResult = await syncAfterAction?.({
            method: prop,
            args,
            result,
          })
          return attachRecoverableState(result, syncResult)
        }
      }
      const value = Reflect.get(obj, prop, receiver)
      return typeof value === 'function' ? value.bind(obj) : value
    },
  })
}

export function readControllerRecoverableState(widget) {
  return clone(
    widget?.runtime?.readState?.()
      || widget?.runtime?.readRecoverableState?.()
      || widget?.readWorkspaceState?.()
      || null,
  )
}

export async function restoreControllerRecoverableState(widget, state, controllerLabel = 'Official-page controller') {
  const stateId = state?.stateId || null
  if (!stateId) {
    throw new Error(`${controllerLabel} cannot restore state without a stateId.`)
  }
  if (typeof widget?.replay === 'function') {
    await widget.replay(stateId)
    return
  }
  if (typeof widget?.runtime?.jumpToState === 'function') {
    await widget.runtime.jumpToState({ stateId })
    return
  }
  throw new Error(`${controllerLabel} does not expose a state-restore surface.`)
}
