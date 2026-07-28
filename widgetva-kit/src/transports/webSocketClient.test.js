import test from 'node:test'
import assert from 'node:assert/strict'

import {
  WIDGETVA_WEBSOCKET_REQUEST_SOURCE,
  WIDGETVA_WEBSOCKET_REQUEST_TYPE,
  WIDGETVA_WEBSOCKET_RESPONSE_SOURCE,
  WIDGETVA_WEBSOCKET_RESPONSE_TYPE,
} from './webSocketBridge.js'
import { createWebSocketTransportClient } from './webSocketClient.js'

function createMockSocket() {
  const listeners = new Map()
  const sent = []
  return {
    OPEN: 1,
    readyState: 1,
    sent,
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, [])
      listeners.get(type).push(handler)
    },
    removeEventListener(type, handler) {
      listeners.set(type, (listeners.get(type) || []).filter((entry) => entry !== handler))
    },
    send(payload) {
      sent.push(JSON.parse(payload))
    },
    emit(type, message) {
      for (const handler of listeners.get(type) || []) handler(message)
    },
    close() {},
  }
}

async function respondLatest(socket, result) {
  const message = socket.sent[socket.sent.length - 1]
  socket.emit('message', {
    data: JSON.stringify({
      source: WIDGETVA_WEBSOCKET_RESPONSE_SOURCE,
      type: WIDGETVA_WEBSOCKET_RESPONSE_TYPE,
      id: message.id,
      ok: true,
      result,
    }),
  })
}

test('createWebSocketTransportClient dispatches stable page-port aliases only', async () => {
  const socket = createMockSocket()
  const client = createWebSocketTransportClient({ socket, timeoutMs: 50 })

  const describePromise = client.describePagePort()
  await Promise.resolve()
  assert.equal(socket.sent[0]?.source, WIDGETVA_WEBSOCKET_REQUEST_SOURCE)
  assert.equal(socket.sent[0]?.type, WIDGETVA_WEBSOCKET_REQUEST_TYPE)
  assert.equal(socket.sent[0]?.alias, 'page_port_describe')
  await respondLatest(socket, { methods: ['describeWorkspace'] })
  assert.deepEqual(await describePromise, { methods: ['describeWorkspace'] })

  const workspacePromise = client.describeWorkspace({ workspaceId: 'workspace_b' })
  await Promise.resolve()
  assert.equal(socket.sent[1]?.alias, 'workspace_describe')
  await respondLatest(socket, { workspaceId: 'workspace_b' })
  assert.deepEqual(await workspacePromise, { workspaceId: 'workspace_b' })

  const actionPromise = client.runAction({ name: 'scatter.brushRegion' })
  await Promise.resolve()
  assert.equal(socket.sent[2]?.alias, 'action_run')
  await respondLatest(socket, { ok: true, stateId: 'main:s1' })
  assert.deepEqual(await actionPromise, { ok: true, stateId: 'main:s1' })

  const replayPromise = client.replay({ stateId: 'main:s2' })
  await Promise.resolve()
  assert.equal(socket.sent[3]?.alias, 'workspace_replay')
  assert.deepEqual(socket.sent[3]?.args?.[0], { stateId: 'main:s2' })
  await respondLatest(socket, { ok: true, stateId: 'main:s2' })
  assert.deepEqual(await replayPromise, { ok: true, stateId: 'main:s2' })

  for (const removedName of [
    'describeWidget',
    'readWidgetState',
    'executeWidgetAction',
    'queryWidgetPerception',
    'readWidgetTrace',
    'replayWorkspace',
    'replayWidget',
    'listAvailableWidgetVAMcpTools',
    'describeEvaluationSurface',
  ]) {
    assert.equal(removedName in client, false)
  }
})
