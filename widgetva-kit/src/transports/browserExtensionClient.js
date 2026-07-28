import {
  WIDGETVA_EXTENSION_REQUEST_SOURCE,
  WIDGETVA_EXTENSION_REQUEST_TYPE,
  WIDGETVA_EXTENSION_RESPONSE_SOURCE,
  WIDGETVA_EXTENSION_RESPONSE_TYPE,
} from './browserExtensionBridge.js'
import { createPagePortClient } from './pagePortClient.js'

function randomId() {
  return `widgetva_ext_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function createBrowserExtensionTransportClient({
  targetWindow = window,
  responseWindow = window,
  targetOrigin = '*',
  timeoutMs = 5000,
} = {}) {
  const invoke = (alias, args = []) =>
    new Promise((resolve, reject) => {
      const id = randomId()
      const timer = setTimeout(() => {
        responseWindow.removeEventListener('message', handleMessage)
        reject(new Error(`Timed out waiting for WidgetVA browser-extension response: ${alias}`))
      }, timeoutMs)

      const handleMessage = (event) => {
        const message = event?.data
        if (
          !message ||
          typeof message !== 'object' ||
          message.source !== WIDGETVA_EXTENSION_RESPONSE_SOURCE ||
          message.type !== WIDGETVA_EXTENSION_RESPONSE_TYPE ||
          message.id !== id
        ) {
          return
        }

        clearTimeout(timer)
        responseWindow.removeEventListener('message', handleMessage)
        if (message.ok) {
          resolve(message.result)
          return
        }
        reject(new Error(message?.error?.message || `WidgetVA browser-extension request failed: ${alias}`))
      }

      responseWindow.addEventListener('message', handleMessage)
      targetWindow.postMessage(
        {
          source: WIDGETVA_EXTENSION_REQUEST_SOURCE,
          type: WIDGETVA_EXTENSION_REQUEST_TYPE,
          id,
          alias,
          args: Array.isArray(args) ? args : [args],
        },
        targetOrigin,
      )
    })

  return createPagePortClient({
    invoke,
  })
}
