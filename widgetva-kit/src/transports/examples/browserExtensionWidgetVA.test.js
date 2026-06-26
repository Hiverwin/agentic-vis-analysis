import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeWorkspaceFromExtension,
  readObservationFromExtension,
  readViewFromExtension,
  readLatestCoordinationResultFromExtension,
  runActionFromExtension,
  queryPerceptionFromExtension,
  queryDataFromExtension,
  readInteractionTraceFromExtension,
  runAgentLoopFromExtension,
} from './browserExtensionWidgetVA.js'

function createMockWindow() {
  const listeners = new Map()
  const postedMessages = []
  return {
    postedMessages,
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, [])
      listeners.get(type).push(handler)
    },
    removeEventListener(type, handler) {
      const nextHandlers = (listeners.get(type) || []).filter((entry) => entry !== handler)
      listeners.set(type, nextHandlers)
    },
    postMessage(message) {
      postedMessages.push(message)
    },
    emit(type, data) {
      for (const handler of listeners.get(type) || []) {
        handler({ data })
      }
    },
  }
}

async function respondLatest(windowRef, result) {
  const message = windowRef.postedMessages[windowRef.postedMessages.length - 1]
  if (!message) throw new Error('No pending browser-extension message to respond to.')
  windowRef.emit('message', {
    source: 'widgetva-page',
    type: 'widgetva:response',
    id: message.id,
    ok: true,
    result,
  })
}

async function respondAt(windowRef, index, result) {
  const message = windowRef.postedMessages[index]
  if (!message) throw new Error(`No browser-extension message at index ${index}.`)
  windowRef.emit('message', {
    source: 'widgetva-page',
    type: 'widgetva:response',
    id: message.id,
    ok: true,
    result,
  })
}

async function flushTasks() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

test('browser-extension example helpers dispatch core runtime aliases without leaking transport options', async () => {
  const mockWindow = createMockWindow()
  const clientOptions = { targetWindow: mockWindow, responseWindow: mockWindow, timeoutMs: 50 }

  const describePromise = describeWorkspaceFromExtension({ workspaceId: 'workspace_b' }, clientOptions)
  assert.equal(mockWindow.postedMessages[0]?.alias, 'workspace_describe')
  assert.deepEqual(mockWindow.postedMessages[0]?.args?.[0], { workspaceId: 'workspace_b' })
  await respondLatest(mockWindow, { workspaceId: 'workspace_b' })
  assert.deepEqual(await describePromise, { workspaceId: 'workspace_b' })

  const observationPromise = readObservationFromExtension({ refs: ['scatter'] }, clientOptions)
  assert.equal(mockWindow.postedMessages[1]?.alias, 'observation_read')
  await respondLatest(mockWindow, { state: { stateId: 'main:s1' } })
  assert.deepEqual(await observationPromise, { state: { stateId: 'main:s1' } })

  const latestCoordinationPromise = readLatestCoordinationResultFromExtension({}, clientOptions)
  assert.equal(mockWindow.postedMessages[2]?.alias, 'latest_coordination_result_read')
  await respondLatest(mockWindow, { verification: { status: 'verified' } })
  assert.deepEqual(await latestCoordinationPromise, { verification: { status: 'verified' } })

  const viewPromise = readViewFromExtension({ refs: ['scatter'] }, clientOptions)
  assert.equal(mockWindow.postedMessages[3]?.alias, 'view_read')
  await respondLatest(mockWindow, { refs: ['scatter'] })
  assert.deepEqual(await viewPromise, { refs: ['scatter'] })

  const actionPromise = runActionFromExtension({ call: { name: 'scatter.brushRegion' } }, clientOptions)
  assert.equal(mockWindow.postedMessages[4]?.alias, 'action_run')
  assert.deepEqual(mockWindow.postedMessages[4]?.args?.[0], { name: 'scatter.brushRegion' })
  await respondLatest(mockWindow, { ok: true })
  assert.deepEqual(await actionPromise, { ok: true })

  const perceptionPromise = queryPerceptionFromExtension({ name: 'perception.inspectSelection' }, clientOptions)
  assert.equal(mockWindow.postedMessages[5]?.alias, 'perception_query')
  await respondLatest(mockWindow, { ok: true })
  assert.deepEqual(await perceptionPromise, { ok: true })

  const dataPromise = queryDataFromExtension({ name: 'sampleRows' }, clientOptions)
  assert.equal(mockWindow.postedMessages[6]?.alias, 'data_query')
  await respondLatest(mockWindow, { rows: [] })
  assert.deepEqual(await dataPromise, { rows: [] })

  const tracePromise = readInteractionTraceFromExtension({ limit: 5 }, clientOptions)
  assert.equal(mockWindow.postedMessages[7]?.alias, 'interaction_trace_read')
  await respondLatest(mockWindow, [])
  assert.deepEqual(await tracePromise, [])
})

test('runAgentLoopFromExtension executes the formal agent loop through the browser-extension transport', async () => {
  const mockWindow = createMockWindow()
  const clientOptions = { targetWindow: mockWindow, responseWindow: mockWindow, timeoutMs: 50 }

  const resultPromise = runAgentLoopFromExtension({
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
  }, clientOptions)

  assert.deepEqual(mockWindow.postedMessages.slice(0, 3).map((entry) => entry.alias), [
    'workspace_describe',
    'agent_loop_describe',
    'observation_read',
  ])
  await respondAt(mockWindow, 0, { workspaceId: 'workspace_b', widgets: [] })
  await respondAt(mockWindow, 1, { loopHints: { verifiedActionName: 'executeVerifiedAction' } })
  await respondAt(mockWindow, 2, { state: { stateId: 'main:s1' } })
  await flushTasks()
  assert.equal(mockWindow.postedMessages[3]?.alias, 'action_usage_describe')
  await respondAt(mockWindow, 3, { actions: [{ name: 'scatter.brushRegion' }] })
  await flushTasks()
  assert.equal(mockWindow.postedMessages[4]?.alias, 'verified_action_run')
  await respondAt(mockWindow, 4, {
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
  assert.equal(mockWindow.postedMessages[5]?.alias, 'latest_coordination_result_read')
  await respondAt(mockWindow, 5, { verification: { status: 'verified' } })

  const result = await resultPromise
  assert.equal(result.result.actionResult.ok, true)
  assert.equal(result.verification.ok, true)
  assert.equal(result.latestCoordinationResult.verification.status, 'verified')
})
