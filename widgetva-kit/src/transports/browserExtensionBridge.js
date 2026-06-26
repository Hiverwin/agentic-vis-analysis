import { TRANSPORT_PAGE_PORT_ALIASES, invokePagePortAlias } from './pagePortBridge.js'

export const WIDGETVA_EXTENSION_REQUEST_TYPE = 'widgetva:request'
export const WIDGETVA_EXTENSION_RESPONSE_TYPE = 'widgetva:response'
export const WIDGETVA_EXTENSION_REQUEST_SOURCE = 'widgetva-extension'
export const WIDGETVA_EXTENSION_RESPONSE_SOURCE = 'widgetva-page'

function buildErrorPayload(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    }
  }
  return {
    name: 'Error',
    message: String(error || 'Unknown WidgetVA bridge error'),
  }
}

export function isWidgetVABridgeRequest(message) {
  return (
    message &&
    typeof message === 'object' &&
    message.source === WIDGETVA_EXTENSION_REQUEST_SOURCE &&
    message.type === WIDGETVA_EXTENSION_REQUEST_TYPE &&
    typeof message.id === 'string' &&
    typeof message.alias === 'string'
  )
}

export function installBrowserExtensionBridge({
  root = window,
  targetOrigin = '*',
  allowedAliases = [...TRANSPORT_PAGE_PORT_ALIASES],
} = {}) {
  const allowedAliasSet = new Set(
    Array.isArray(allowedAliases)
      ? allowedAliases
      : [...TRANSPORT_PAGE_PORT_ALIASES],
  )

  const handleMessage = async (event) => {
    const message = event?.data
    if (!isWidgetVABridgeRequest(message)) return
    if (!allowedAliasSet.has(message.alias)) {
      event.source?.postMessage(
        {
          source: WIDGETVA_EXTENSION_RESPONSE_SOURCE,
          type: WIDGETVA_EXTENSION_RESPONSE_TYPE,
          id: message.id,
          ok: false,
          error: {
            name: 'UnsupportedAliasError',
            message: `Unsupported WidgetVA transport alias: ${message.alias}`,
          },
        },
        targetOrigin,
      )
      return
    }

    try {
      const result = await invokePagePortAlias(message.alias, Array.isArray(message.args) ? message.args : [], root)
      event.source?.postMessage(
        {
          source: WIDGETVA_EXTENSION_RESPONSE_SOURCE,
          type: WIDGETVA_EXTENSION_RESPONSE_TYPE,
          id: message.id,
          ok: true,
          result,
        },
        targetOrigin,
      )
    } catch (error) {
      event.source?.postMessage(
        {
          source: WIDGETVA_EXTENSION_RESPONSE_SOURCE,
          type: WIDGETVA_EXTENSION_RESPONSE_TYPE,
          id: message.id,
          ok: false,
          error: buildErrorPayload(error),
        },
        targetOrigin,
      )
    }
  }

  root.addEventListener('message', handleMessage)
  return () => root.removeEventListener('message', handleMessage)
}
