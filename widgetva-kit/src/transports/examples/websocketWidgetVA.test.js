import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeWorkspaceFromWebSocket,
  readViewFromWebSocket,
  runActionFromWebSocket,
  queryPerceptionFromWebSocket,
  queryDataFromWebSocket,
  readInteractionTraceFromWebSocket,
} from './websocketWidgetVA.js'

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
      source: 'widgetva-websocket-page',
      type: 'widgetva:response',
      id: message.id,
      ok: true,
      result,
    }),
  })
}

test('websocket example helpers dispatch core runtime aliases without leaking transport options', async () => {
  const socket = createMockSocket()

  const describePromise = describeWorkspaceFromWebSocket({ workspaceId: 'workspace_b', socket, timeoutMs: 50 })
  await Promise.resolve()
  assert.equal(socket.sent[0]?.alias, 'workspace_describe')
  assert.deepEqual(socket.sent[0]?.args?.[0], { workspaceId: 'workspace_b' })
  await respondLatest(socket, { workspaceId: 'workspace_b' })
  assert.deepEqual(await describePromise, { workspaceId: 'workspace_b' })

  const viewPromise = readViewFromWebSocket({ refs: ['scatter'], socket, timeoutMs: 50 })
  await Promise.resolve()
  assert.equal(socket.sent[1]?.alias, 'view_read')
  assert.deepEqual(socket.sent[1]?.args?.[0], { refs: ['scatter'] })
  await respondLatest(socket, { refs: ['scatter'] })
  assert.deepEqual(await viewPromise, { refs: ['scatter'] })

  const actionPromise = runActionFromWebSocket({ call: { name: 'scatter.brushRegion' }, socket, timeoutMs: 50 })
  await Promise.resolve()
  assert.equal(socket.sent[2]?.alias, 'action_run')
  assert.deepEqual(socket.sent[2]?.args?.[0], { name: 'scatter.brushRegion' })
  await respondLatest(socket, { ok: true })
  assert.deepEqual(await actionPromise, { ok: true })

  const perceptionPromise = queryPerceptionFromWebSocket({ name: 'perception.inspectSelection', socket, timeoutMs: 50 })
  await Promise.resolve()
  assert.equal(socket.sent[3]?.alias, 'perception_query')
  await respondLatest(socket, { ok: true })
  assert.deepEqual(await perceptionPromise, { ok: true })

  const dataPromise = queryDataFromWebSocket({ name: 'sampleRows', socket, timeoutMs: 50 })
  await Promise.resolve()
  assert.equal(socket.sent[4]?.alias, 'data_query')
  await respondLatest(socket, { rows: [] })
  assert.deepEqual(await dataPromise, { rows: [] })

  const tracePromise = readInteractionTraceFromWebSocket({ limit: 5, socket, timeoutMs: 50 })
  await Promise.resolve()
  assert.equal(socket.sent[5]?.alias, 'interaction_trace_read')
  await respondLatest(socket, [])
  assert.deepEqual(await tracePromise, [])
})
