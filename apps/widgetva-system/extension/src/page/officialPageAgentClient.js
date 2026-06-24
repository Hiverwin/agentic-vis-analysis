import {
  WIDGETVA_AGENT_BRIDGE_REQUEST,
  WIDGETVA_AGENT_BRIDGE_RESPONSE,
  WIDGETVA_AGENT_BRIDGE_SOURCE_CONTENT,
  WIDGETVA_AGENT_BRIDGE_SOURCE_PAGE,
} from '../shared/officialPageAgentBridge.js'

export const DEFAULT_OFFICIAL_PAGE_AGENT_BRIDGE_TIMEOUT_MS = 15000
export const DEFAULT_OFFICIAL_PAGE_AGENT_CHAT_TIMEOUT_MS = 45000

function invokeBridge(root, method, params = null, { timeoutMs = DEFAULT_OFFICIAL_PAGE_AGENT_BRIDGE_TIMEOUT_MS } = {}) {
  const requestId = `widgetva_agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for WidgetVA official-page agent bridge: ${method} after ${timeoutMs}ms.`))
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
        reject(new Error(message?.error?.message || `WidgetVA official-page agent bridge failed: ${method}.`))
        return
      }
      resolve(message.result ?? null)
    }

    root.addEventListener('message', handleMessage)
    root.postMessage({
      source: WIDGETVA_AGENT_BRIDGE_SOURCE_PAGE,
      type: WIDGETVA_AGENT_BRIDGE_REQUEST,
      id: requestId,
      method,
      params,
    }, '*')
  })
}

export function configureOfficialPageAgent(root, params = {}) {
  return invokeBridge(root, 'configure', params)
}

export function readOfficialPageAgentConfig(root) {
  return invokeBridge(root, 'readConfig', null)
}

export async function completeOfficialPageAgentChat(root, request = {}) {
  const {
    timeoutMs = DEFAULT_OFFICIAL_PAGE_AGENT_CHAT_TIMEOUT_MS,
    ...chatRequest
  } = request || {}

  const result = await invokeBridge(root, 'chat', chatRequest, {
    timeoutMs,
  })
  return {
    model: result?.model || chatRequest?.model || null,
    raw: result?.raw || null,
    content: result?.content || '',
  }
}
