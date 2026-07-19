import {
  WIDGETVA_AGENT_BRIDGE_RUNTIME,
} from '../../shared/officialPageAgentBridge.js'
import {
  WIDGETVA_DOCK_BRIDGE_REQUEST,
  WIDGETVA_DOCK_BRIDGE_RESPONSE,
  WIDGETVA_DOCK_BRIDGE_SOURCE_CONTENT,
  WIDGETVA_DOCK_BRIDGE_SOURCE_PAGE,
} from '../../shared/officialPageDockBridge.js'

const DEFAULT_DOCK_TIMEOUT_MS = 30000
const DEFAULT_AGENT_TIMEOUT_MS = 300000

function createRequestId(prefix = 'dock') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function makeError(payload = {}, fallbackMessage = 'WidgetVA Dock request failed.') {
  const error = new Error(payload?.message || fallbackMessage)
  error.name = payload?.name || 'WidgetVADockError'
  return error
}

export function createOfficialPageDockClient(root = window) {
  return {
    request(method, params = {}, {
      timeoutMs = method === 'runSession' ? DEFAULT_AGENT_TIMEOUT_MS : DEFAULT_DOCK_TIMEOUT_MS,
      onProgress = null,
    } = {}) {
      const requestId = createRequestId('widgetva_dock')

      return new Promise((resolve, reject) => {
        let timeout = null
        const armTimeout = () => {
          clearTimeout(timeout)
          if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return
          timeout = setTimeout(() => {
            cleanup()
            reject(makeError({
              name: 'WidgetVADockTimeoutError',
              message: `Timed out waiting for WidgetVA Dock page bridge: ${method}.`,
            }))
          }, timeoutMs)
        }

        const cleanup = () => {
          clearTimeout(timeout)
          root.removeEventListener('message', handleMessage)
        }

        const handleMessage = (event) => {
          const message = event?.data
          if (
            event.source !== root
            || !message
            || message.source !== WIDGETVA_DOCK_BRIDGE_SOURCE_PAGE
            || message.type !== WIDGETVA_DOCK_BRIDGE_RESPONSE
            || message.id !== requestId
          ) {
            return
          }

          if (message.event && typeof onProgress === 'function') {
            armTimeout()
            onProgress(message.result ?? null)
            return
          }

          cleanup()
          if (message.ok === false) {
            reject(makeError(message.error, `WidgetVA Dock page bridge failed: ${method}.`))
            return
          }
          resolve(message.result ?? null)
        }

        root.addEventListener('message', handleMessage)
        armTimeout()
        try {
          root.postMessage({
            source: WIDGETVA_DOCK_BRIDGE_SOURCE_CONTENT,
            type: WIDGETVA_DOCK_BRIDGE_REQUEST,
            id: requestId,
            method,
            params,
          }, '*')
        } catch (error) {
          cleanup()
          reject(makeError(error, `Failed to post WidgetVA Dock page bridge request: ${method}.`))
        }
      })
    },

    readAgentConfig() {
      return requestAgentRuntime('readConfig')
    },

    configureAgent(params = {}) {
      return requestAgentRuntime('configure', params)
    },
  }
}

export function requestAgentRuntime(method, params = null) {
  return new Promise((resolve, reject) => {
    const runtime = globalThis.chrome?.runtime
    if (!runtime || typeof runtime.sendMessage !== 'function') {
      reject(makeError({
        message: 'WidgetVA extension runtime is unavailable.',
      }))
      return
    }

    runtime.sendMessage({
      type: WIDGETVA_AGENT_BRIDGE_RUNTIME,
      method,
      params,
    }, (response) => {
      if (runtime.lastError) {
        reject(makeError({
          message: runtime.lastError.message || 'WidgetVA extension runtime failed.',
        }))
        return
      }
      if (response?.ok !== true) {
        reject(makeError(response?.error, `WidgetVA agent runtime failed: ${method}.`))
        return
      }
      resolve(response.result ?? null)
    })
  })
}
