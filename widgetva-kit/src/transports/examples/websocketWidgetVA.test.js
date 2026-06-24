import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeWorkspaceFromWebSocket,
  readObservationFromWebSocket,
  readViewFromWebSocket,
  readLatestCoordinationResultFromWebSocket,
  runActionFromWebSocket,
  queryPerceptionFromWebSocket,
  queryDataFromWebSocket,
  readInteractionTraceFromWebSocket,
  runAgentLoopFromWebSocket,
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
  if (!message) throw new Error('No pending websocket message to respond to.')
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

async function respondAt(socket, index, result) {
  const message = socket.sent[index]
  if (!message) throw new Error(`No websocket message at index ${index}.`)
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

async function flushTasks() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

test('websocket example helpers dispatch core runtime aliases without leaking transport options', async () => {
  const socket = createMockSocket()

  const describePromise = describeWorkspaceFromWebSocket({ workspaceId: 'workspace_b', socket, timeoutMs: 50 })
  await Promise.resolve()
  assert.equal(socket.sent[0]?.alias, 'workspace_describe')
  assert.deepEqual(socket.sent[0]?.args?.[0], { workspaceId: 'workspace_b' })
  await respondLatest(socket, { workspaceId: 'workspace_b' })
  assert.deepEqual(await describePromise, { workspaceId: 'workspace_b' })

  const observationPromise = readObservationFromWebSocket({ refs: ['scatter'], socket, timeoutMs: 50 })
  await Promise.resolve()
  assert.equal(socket.sent[1]?.alias, 'observation_read')
  assert.deepEqual(socket.sent[1]?.args?.[0], { refs: ['scatter'] })
  await respondLatest(socket, { state: { stateId: 'main:s1' } })
  assert.deepEqual(await observationPromise, { state: { stateId: 'main:s1' } })

  const latestCoordinationPromise = readLatestCoordinationResultFromWebSocket({ socket, timeoutMs: 50 })
  await Promise.resolve()
  assert.equal(socket.sent[2]?.alias, 'latest_coordination_result_read')
  await respondLatest(socket, { verification: { status: 'verified' } })
  assert.deepEqual(await latestCoordinationPromise, { verification: { status: 'verified' } })

  const viewPromise = readViewFromWebSocket({ refs: ['scatter'], socket, timeoutMs: 50 })
  await Promise.resolve()
  assert.equal(socket.sent[3]?.alias, 'view_read')
  assert.deepEqual(socket.sent[3]?.args?.[0], { refs: ['scatter'] })
  await respondLatest(socket, { refs: ['scatter'] })
  assert.deepEqual(await viewPromise, { refs: ['scatter'] })

  const actionPromise = runActionFromWebSocket({ call: { name: 'scatter.brushRegion' }, socket, timeoutMs: 50 })
  await Promise.resolve()
  assert.equal(socket.sent[4]?.alias, 'action_run')
  assert.deepEqual(socket.sent[4]?.args?.[0], { name: 'scatter.brushRegion' })
  await respondLatest(socket, { ok: true })
  assert.deepEqual(await actionPromise, { ok: true })

  const perceptionPromise = queryPerceptionFromWebSocket({ name: 'perception.inspectSelection', socket, timeoutMs: 50 })
  await Promise.resolve()
  assert.equal(socket.sent[5]?.alias, 'perception_query')
  await respondLatest(socket, { ok: true })
  assert.deepEqual(await perceptionPromise, { ok: true })

  const dataPromise = queryDataFromWebSocket({ name: 'sampleRows', socket, timeoutMs: 50 })
  await Promise.resolve()
  assert.equal(socket.sent[6]?.alias, 'data_query')
  await respondLatest(socket, { rows: [] })
  assert.deepEqual(await dataPromise, { rows: [] })

  const tracePromise = readInteractionTraceFromWebSocket({ limit: 5, socket, timeoutMs: 50 })
  await Promise.resolve()
  assert.equal(socket.sent[7]?.alias, 'interaction_trace_read')
  await respondLatest(socket, [])
  assert.deepEqual(await tracePromise, [])
})

test('runAgentLoopFromWebSocket executes the formal agent loop through the websocket transport', async () => {
  const socket = createMockSocket()

  const resultPromise = runAgentLoopFromWebSocket({
    operation: {
      kind: 'action',
      name: 'scatter.brushRegion',
      queryScope: {
        widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
      },
      params: {
        xField: 'Horsepower',
        yField: 'Miles_per_Gallon',
        xRange: [80, 160],
        yRange: [18, 32],
      },
    },
    socket,
    timeoutMs: 50,
  })

  await Promise.resolve()
  assert.deepEqual(socket.sent.slice(0, 3).map((entry) => entry.alias), [
    'workspace_describe',
    'agent_loop_describe',
    'observation_read',
  ])
  await respondAt(socket, 0, { workspaceId: 'workspace_b', widgets: [] })
  await respondAt(socket, 1, { loopHints: { verifiedActionName: 'executeVerifiedAction' } })
  await respondAt(socket, 2, { state: { stateId: 'main:s1' } })
  await flushTasks()
  assert.equal(socket.sent[3]?.alias, 'action_usage_describe')
  await respondAt(socket, 3, { actions: [{ name: 'scatter.brushRegion' }] })
  await flushTasks()
  assert.equal(socket.sent[4]?.alias, 'verified_action_run')
  await respondAt(socket, 4, {
    ok: true,
    actionResult: {
      ok: true,
      stateId: 'main:s2',
      updatedRefs: ['wl://widgetva-app/workspace/main/widget/scatter'],
    },
    verification: {
      ok: true,
    },
  })
  await flushTasks()
  assert.equal(socket.sent[5]?.alias, 'latest_coordination_result_read')
  await respondAt(socket, 5, { verification: { status: 'verified' } })

  const result = await resultPromise
  assert.equal(result.result.actionResult.ok, true)
  assert.equal(result.verification.ok, true)
  assert.equal(result.latestCoordinationResult.verification.status, 'verified')
})
