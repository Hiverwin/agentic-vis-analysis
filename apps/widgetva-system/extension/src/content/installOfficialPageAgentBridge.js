import {
  WIDGETVA_AGENT_BRIDGE_REQUEST,
  WIDGETVA_AGENT_BRIDGE_RESPONSE,
  WIDGETVA_AGENT_BRIDGE_RUNTIME,
  WIDGETVA_AGENT_BRIDGE_SOURCE_CONTENT,
  WIDGETVA_AGENT_BRIDGE_SOURCE_PAGE,
} from '../shared/officialPageAgentBridge.js'

let installed = false

function postResponse(root, payload) {
  root.postMessage({
    source: WIDGETVA_AGENT_BRIDGE_SOURCE_CONTENT,
    type: WIDGETVA_AGENT_BRIDGE_RESPONSE,
    ...payload,
  }, '*')
}

export function installOfficialPageAgentBridge(root = window) {
  if (installed || !root) return
  installed = true

  root.addEventListener('message', (event) => {
    if (event.source !== root) return
    const message = event.data
    if (!message || message.source !== WIDGETVA_AGENT_BRIDGE_SOURCE_PAGE || message.type !== WIDGETVA_AGENT_BRIDGE_REQUEST) {
      return
    }

    chrome.runtime.sendMessage({
      type: WIDGETVA_AGENT_BRIDGE_RUNTIME,
      method: message.method,
      params: message.params || null,
    }, (response) => {
      if (chrome.runtime.lastError) {
        postResponse(root, {
          id: message.id,
          ok: false,
          error: {
            name: 'Error',
            message: chrome.runtime.lastError.message || 'WidgetVA extension bridge failed.',
          },
        })
        return
      }

      postResponse(root, {
        id: message.id,
        ok: response?.ok === true,
        ...(response?.ok === true
          ? { result: response?.result ?? null }
          : {
              error: response?.error || {
                name: 'Error',
                message: 'WidgetVA extension bridge failed.',
              },
            }),
      })
    })
  })
}
