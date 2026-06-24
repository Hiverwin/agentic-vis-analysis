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
      const nextHandlers = (listeners.get(type) || []).filter((entry) => entry !== handler)
      listeners.set(type, nextHandlers)
    },
    send(payload) {
      sent.push(JSON.parse(payload))
    },
    emit(type, message) {
      for (const handler of listeners.get(type) || []) {
        handler(message)
      }
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

test('createWebSocketTransportClient dispatches documented core aliases', async () => {
  const socket = createMockSocket()
  const client = createWebSocketTransportClient({ socket, timeoutMs: 50 })

  const describePromise = client.describePagePort()
  await Promise.resolve()
  assert.equal(socket.sent[0]?.source, WIDGETVA_WEBSOCKET_REQUEST_SOURCE)
  assert.equal(socket.sent[0]?.type, WIDGETVA_WEBSOCKET_REQUEST_TYPE)
  assert.equal(socket.sent[0]?.alias, 'page_port_describe')
  await respondLatest(socket, { methods: ['describeWorkspace'] })
  assert.deepEqual(await describePromise, { methods: ['describeWorkspace'] })

  const actionPromise = client.runAction({ name: 'scatter.brushRegion' })
  await Promise.resolve()
  assert.equal(socket.sent[1]?.alias, 'action_run')
  await respondLatest(socket, { ok: true, stateId: 'main:s1' })
  assert.deepEqual(await actionPromise, { ok: true, stateId: 'main:s1' })

  const perceptionPromise = client.queryPerception({ name: 'perception.inspectSelection' })
  await Promise.resolve()
  assert.equal(socket.sent[2]?.alias, 'perception_query')
  await respondLatest(socket, { ok: true, result: {} })
  assert.deepEqual(await perceptionPromise, { ok: true, result: {} })

  const describeWidgetPromise = client.describeWidget({ widgetId: 'scatter_a' })
  await Promise.resolve()
  assert.equal(socket.sent[3]?.alias, 'workspace_describe')
  await respondLatest(socket, {
    widgets: [{ ref: 'wl://widgetva-app/workspace/main/widget/scatter_a', widgetId: 'scatter_a' }],
  })
  assert.deepEqual(await describeWidgetPromise, {
    ref: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    widgetId: 'scatter_a',
  })

  const readWidgetStatePromise = client.readWidgetState({ widgetId: 'scatter_a' })
  await Promise.resolve()
  assert.equal(socket.sent[4]?.alias, 'workspace_describe')
  await respondLatest(socket, {
    widgets: [{ ref: 'wl://widgetva-app/workspace/main/widget/scatter_a', widgetId: 'scatter_a' }],
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(socket.sent[5]?.alias, 'view_read')
  assert.deepEqual(socket.sent[5]?.args?.[0]?.refs, ['wl://widgetva-app/workspace/main/widget/scatter_a'])
  await respondLatest(socket, { stateId: 'main:s1', widgets: {} })
  assert.deepEqual(await readWidgetStatePromise, { stateId: 'main:s1', widgets: {} })

  const replayPromise = client.replayWorkspace('main:s2')
  await Promise.resolve()
  assert.equal(socket.sent[6]?.alias, 'jump_to_state')
  assert.deepEqual(socket.sent[6]?.args?.[0], { stateId: 'main:s2' })
  await respondLatest(socket, { ok: true, stateId: 'main:s2' })
  assert.deepEqual(await replayPromise, { ok: true, stateId: 'main:s2' })
})

test('createWebSocketTransportClient no longer exposes evaluation helpers', () => {
  const client = createWebSocketTransportClient({ socket: createMockSocket(), timeoutMs: 50 })

  assert.equal('describeEvaluationSurface' in client, false)
  assert.equal('evaluationActionVerification' in client, false)
  assert.equal('evaluationBenchmarkTask' in client, false)
})

test('createWebSocketTransportClient lists only installed page-port MCP tools', async () => {
  const socket = createMockSocket()
  const client = createWebSocketTransportClient({ socket, timeoutMs: 50 })

  const promise = client.listAvailableWidgetVAMcpTools()
  await Promise.resolve()
  assert.equal(socket.sent[0]?.alias, 'page_port_describe')
  await respondLatest(socket, {
    aliases: {
      page_port_describe: 'describePagePort',
      workspace_describe: 'describeWorkspace',
      view_read: 'readView',
    },
  })

  assert.deepEqual(
    (await promise).map((tool) => tool.name),
    ['page_port_describe', 'workspace_describe', 'view_read'],
  )
})
