import { TRANSPORT_PAGE_PORT_ALIASES, invokePagePortAlias } from './pagePortBridge.js'

export const WIDGETVA_WEBSOCKET_REQUEST_TYPE = 'widgetva:request'
export const WIDGETVA_WEBSOCKET_RESPONSE_TYPE = 'widgetva:response'
export const WIDGETVA_WEBSOCKET_REQUEST_SOURCE = 'widgetva-websocket-client'
export const WIDGETVA_WEBSOCKET_RESPONSE_SOURCE = 'widgetva-websocket-page'

function buildErrorPayload(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    }
  }
  return {
    name: 'Error',
    message: String(error || 'Unknown WidgetVA WebSocket bridge error'),
  }
}

function parseMessageEvent(event) {
  const payload = event?.data
  if (typeof payload !== 'string') return null
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

function sendJson(socket, payload) {
  if (!socket || socket.readyState !== socket.OPEN) {
    throw new Error('WidgetVA WebSocket bridge is not connected.')
  }
  socket.send(JSON.stringify(payload))
}

export function isWidgetVAWebSocketRequest(message) {
  return (
    message &&
    typeof message === 'object' &&
    message.source === WIDGETVA_WEBSOCKET_REQUEST_SOURCE &&
    message.type === WIDGETVA_WEBSOCKET_REQUEST_TYPE &&
    typeof message.id === 'string' &&
    typeof message.alias === 'string'
  )
}

export function installWebSocketBridge({
  socket = null,
  url = '',
  protocols = undefined,
  root = window,
  WebSocketImpl = root?.WebSocket || globalThis.WebSocket,
  allowedAliases = [...TRANSPORT_PAGE_PORT_ALIASES],
} = {}) {
  const activeSocket = socket || (url ? new WebSocketImpl(url, protocols) : null)
  if (!activeSocket) {
    throw new Error('installWebSocketBridge requires an existing socket or a WebSocket URL.')
  }
  const allowedAliasSet = new Set(
    Array.isArray(allowedAliases)
      ? allowedAliases
      : [...TRANSPORT_PAGE_PORT_ALIASES],
  )

  const handleMessage = async (event) => {
    const message = parseMessageEvent(event)
    if (!isWidgetVAWebSocketRequest(message)) return

    if (!allowedAliasSet.has(message.alias)) {
      sendJson(activeSocket, {
        source: WIDGETVA_WEBSOCKET_RESPONSE_SOURCE,
        type: WIDGETVA_WEBSOCKET_RESPONSE_TYPE,
        id: message.id,
        ok: false,
        error: {
          name: 'UnsupportedAliasError',
          message: `Unsupported WidgetVA transport alias: ${message.alias}`,
        },
      })
      return
    }

    try {
      const result = await invokePagePortAlias(message.alias, Array.isArray(message.args) ? message.args : [], root)
      sendJson(activeSocket, {
        source: WIDGETVA_WEBSOCKET_RESPONSE_SOURCE,
        type: WIDGETVA_WEBSOCKET_RESPONSE_TYPE,
        id: message.id,
        ok: true,
        result,
      })
    } catch (error) {
      sendJson(activeSocket, {
        source: WIDGETVA_WEBSOCKET_RESPONSE_SOURCE,
        type: WIDGETVA_WEBSOCKET_RESPONSE_TYPE,
        id: message.id,
        ok: false,
        error: buildErrorPayload(error),
      })
    }
  }

  activeSocket.addEventListener('message', handleMessage)

  return {
    socket: activeSocket,
    dispose() {
      activeSocket.removeEventListener('message', handleMessage)
    },
  }
}
