import {
  WIDGETVA_AGENT_BRIDGE_REQUEST,
  WIDGETVA_AGENT_BRIDGE_RESPONSE,
  WIDGETVA_AGENT_BRIDGE_SOURCE_CONTENT,
  WIDGETVA_AGENT_BRIDGE_SOURCE_PAGE,
} from '../shared/officialPageAgentBridge.js'

export const DEFAULT_OFFICIAL_PAGE_AGENT_BRIDGE_TIMEOUT_MS = 15000
export const DEFAULT_OFFICIAL_PAGE_AGENT_CHAT_TIMEOUT_MS = 45000
export const DEFAULT_OFFICIAL_PAGE_AGENT_BRIDGE_RETRY_DELAY_MS = 150

function createOfficialPageBridgeError({
  code,
  method,
  message,
} = {}) {
  const error = new Error(message || `WidgetVA official-page bridge failed: ${method || 'unknown'}.`)
  error.name = 'WidgetVAOfficialPageBridgeError'
  error.code = code || 'bridge_error'
  error.bridgeMethod = method || null
  return error
}

function shouldRetryOfficialPageBridgeError(error) {
  return error?.name === 'WidgetVAOfficialPageBridgeError'
    && (error?.code === 'bridge_timeout'
      || error?.code === 'bridge_post_error'
      || error?.code === 'bridge_response_error')
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function invokeBridgeOnce(root, method, params = null, { timeoutMs = DEFAULT_OFFICIAL_PAGE_AGENT_BRIDGE_TIMEOUT_MS } = {}) {
  const requestId = `widgetva_agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(createOfficialPageBridgeError({
        code: 'bridge_timeout',
        method,
        message: `Timed out waiting for WidgetVA official-page agent bridge: ${method} after ${timeoutMs}ms.`,
      }))
    }, timeoutMs)

    const cleanup = () => {
      clearTimeout(timeout)
      root.removeEventListener('message', handleMessage)
    }

    const handleMessage = (event) => {
      const message = event?.data
      if (
        event.source !== root
        || !message
        || message.source !== WIDGETVA_AGENT_BRIDGE_SOURCE_CONTENT
        || message.type !== WIDGETVA_AGENT_BRIDGE_RESPONSE
        || message.id !== requestId
      ) {
        return
      }

      cleanup()
      if (message.ok === false) {
        reject(createOfficialPageBridgeError({
          code: 'bridge_response_error',
          method,
          message: message?.error?.message || `WidgetVA official-page agent bridge failed: ${method}.`,
        }))
        return
      }
      resolve(message.result ?? null)
    }

    root.addEventListener('message', handleMessage)
    try {
      root.postMessage({
        source: WIDGETVA_AGENT_BRIDGE_SOURCE_PAGE,
        type: WIDGETVA_AGENT_BRIDGE_REQUEST,
        id: requestId,
        method,
        params,
      }, '*')
    } catch (error) {
      cleanup()
      reject(createOfficialPageBridgeError({
        code: 'bridge_post_error',
        method,
        message: error?.message || `Failed to post WidgetVA official-page bridge request: ${method}.`,
      }))
    }
  })
}

async function invokeBridge(root, method, params = null, {
  timeoutMs = DEFAULT_OFFICIAL_PAGE_AGENT_BRIDGE_TIMEOUT_MS,
  retryCount = 0,
  retryDelayMs = DEFAULT_OFFICIAL_PAGE_AGENT_BRIDGE_RETRY_DELAY_MS,
} = {}) {
  let attempt = 0

  while (true) {
    try {
      return await invokeBridgeOnce(root, method, params, { timeoutMs })
    } catch (error) {
      if (attempt >= retryCount || !shouldRetryOfficialPageBridgeError(error)) {
        throw error
      }
      attempt += 1
      await wait(retryDelayMs)
    }
  }
}

export function configureOfficialPageAgent(root, params = {}, options = {}) {
  return invokeBridge(root, 'configure', params, {
    retryCount: 1,
    retryDelayMs: DEFAULT_OFFICIAL_PAGE_AGENT_BRIDGE_RETRY_DELAY_MS,
    ...options,
  })
}

export function readOfficialPageAgentConfig(root, options = {}) {
  return invokeBridge(root, 'readConfig', null, {
    retryCount: 1,
    retryDelayMs: DEFAULT_OFFICIAL_PAGE_AGENT_BRIDGE_RETRY_DELAY_MS,
    ...options,
  })
}

export async function completeOfficialPageAgentChat(root, request = {}) {
  const {
    timeoutMs = DEFAULT_OFFICIAL_PAGE_AGENT_CHAT_TIMEOUT_MS,
    retryCount = 1,
    retryDelayMs = DEFAULT_OFFICIAL_PAGE_AGENT_BRIDGE_RETRY_DELAY_MS,
    ...chatRequest
  } = request || {}

  const result = await invokeBridge(root, 'chat', chatRequest, {
    timeoutMs,
    retryCount,
    retryDelayMs,
  })
  return {
    model: result?.model || chatRequest?.model || null,
    raw: result?.raw || null,
    content: result?.content || '',
  }
}
