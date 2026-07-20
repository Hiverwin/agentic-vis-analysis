import { createOpenAICompatibleAgentService } from './openRouterAgentService.js'
import { WIDGETVA_AGENT_BRIDGE_RUNTIME } from '../shared/officialPageAgentBridge.js'

const agentService = createOpenAICompatibleAgentService({
  storage: chrome.storage.local,
  fetchImpl: globalThis.fetch.bind(globalThis),
})

function summarizeError(error) {
  return {
    name: error?.name || 'Error',
    message: error?.message || String(error || 'Unknown WidgetVA agent bridge error.'),
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== WIDGETVA_AGENT_BRIDGE_RUNTIME) {
    return false
  }

  const method = message.method
  if (method !== 'configure' && method !== 'readConfig' && method !== 'chat') {
    sendResponse({
      ok: false,
      error: {
        name: 'Error',
        message: `Unsupported WidgetVA agent runtime method: ${String(method)}.`,
      },
    })
    return false
  }

  Promise.resolve()
    .then(async () => {
      if (method === 'configure') {
        return agentService.configure(message.params || {})
      }
      if (method === 'readConfig') {
        return agentService.readConfig()
      }
      return agentService.chat(message.params || {})
    })
    .then((result) => {
      sendResponse({
        ok: true,
        result,
      })
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        error: summarizeError(error),
      })
    })

  return true
})
