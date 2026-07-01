import { installWidgetVAPagePort } from '../runtime/installPagePort.js'

function resolveWindowObject(windowObject) {
  if (windowObject && typeof windowObject === 'object') return windowObject
  if (typeof globalThis.window === 'object' && globalThis.window) return globalThis.window
  throw new Error('WidgetVA manual page-port example requires a window-like object.')
}

function ensureObject(value, label) {
  if (!value || typeof value !== 'object') {
    throw new Error(`WidgetVA manual page-port example requires ${label}.`)
  }
  return value
}

export function installWidgetVAManualPagePortExample({
  windowObject = null,
  store,
  actionExecutor,
  perceptionQueryRegistry,
  actionContext = null,
  readLatestCoordinationResult = null,
  queryData = null,
  dataQueryExecutor = null,
  linkEngine = null,
  traceRecorder = null,
  responseRecorder = null,
  agentLoopRuntime = null,
} = {}) {
  const resolvedWindow = resolveWindowObject(windowObject)

  ensureObject(store, 'a runtime store')
  ensureObject(actionExecutor, 'an action executor')
  ensureObject(perceptionQueryRegistry, 'a perception query registry')

  const previousWindow = globalThis.window
  globalThis.window = resolvedWindow

  let uninstall = null
  try {
    uninstall = installWidgetVAPagePort({
      store,
      actionExecutor,
      perceptionQueryRegistry,
      actionContext,
      readLatestCoordinationResult,
      queryData,
      dataQueryExecutor,
      linkEngine,
      traceRecorder,
      responseRecorder,
      agentLoopRuntime,
    })
  } finally {
    globalThis.window = previousWindow
  }

  return {
    windowObject: resolvedWindow,
    port: resolvedWindow.__widgetVA || null,
    uninstall() {
      const previousWindowOnUnmount = globalThis.window
      globalThis.window = resolvedWindow
      try {
        uninstall?.()
      } finally {
        globalThis.window = previousWindowOnUnmount
      }
      if (resolvedWindow && typeof resolvedWindow === 'object') {
        delete resolvedWindow.__widgetVA
      }
    },
  }
}
