import {
  WIDGETVA_WEBSOCKET_REQUEST_SOURCE,
  WIDGETVA_WEBSOCKET_REQUEST_TYPE,
  WIDGETVA_WEBSOCKET_RESPONSE_SOURCE,
  WIDGETVA_WEBSOCKET_RESPONSE_TYPE,
} from './webSocketBridge.js'
import { createPagePortClient } from './pagePortClient.js'

function randomId() {
  return `widgetva_ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
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

function createReadyPromise(socket) {
  if (socket.readyState === socket.OPEN) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const handleOpen = () => {
      cleanup()
      resolve()
    }
    const handleError = () => {
      cleanup()
      reject(new Error('WidgetVA WebSocket transport failed to connect.'))
    }
    const cleanup = () => {
      socket.removeEventListener('open', handleOpen)
      socket.removeEventListener('error', handleError)
    }
    socket.addEventListener('open', handleOpen)
    socket.addEventListener('error', handleError)
  })
}

export function createWebSocketTransportClient({
  socket = null,
  url = '',
  protocols = undefined,
  WebSocketImpl = globalThis.WebSocket,
  timeoutMs = 5000,
} = {}) {
  const activeSocket = socket || (url ? new WebSocketImpl(url, protocols) : null)
  if (!activeSocket) {
    throw new Error('createWebSocketTransportClient requires an existing socket or a WebSocket URL.')
  }

  const ready = createReadyPromise(activeSocket)
  const pending = new Map()

  const handleMessage = (event) => {
    const message = parseMessageEvent(event)
    if (
      !message ||
      typeof message !== 'object' ||
      message.source !== WIDGETVA_WEBSOCKET_RESPONSE_SOURCE ||
      message.type !== WIDGETVA_WEBSOCKET_RESPONSE_TYPE ||
      typeof message.id !== 'string'
    ) {
      return
    }

    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id)
    clearTimeout(entry.timer)
    if (message.ok) {
      entry.resolve(message.result)
      return
    }
    entry.reject(new Error(message?.error?.message || 'WidgetVA WebSocket request failed.'))
  }

  activeSocket.addEventListener('message', handleMessage)

  const invoke = async (alias, args = []) => {
    await ready
    return new Promise((resolve, reject) => {
      const id = randomId()
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`Timed out waiting for WidgetVA WebSocket response: ${alias}`))
      }, timeoutMs)
      pending.set(id, { resolve, reject, timer })
      activeSocket.send(JSON.stringify({
        source: WIDGETVA_WEBSOCKET_REQUEST_SOURCE,
        type: WIDGETVA_WEBSOCKET_REQUEST_TYPE,
        id,
        alias,
        args: Array.isArray(args) ? args : [args],
      }))
    })
  }

  return createPagePortClient({
    socket: activeSocket,
    ready,
    invoke,
    close() {
      activeSocket.removeEventListener('message', handleMessage)
      activeSocket.close()
    },
  })
}
