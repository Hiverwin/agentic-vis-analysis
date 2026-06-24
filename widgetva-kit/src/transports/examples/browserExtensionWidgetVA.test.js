import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeWorkspaceFromExtension,
  readViewFromExtension,
  runActionFromExtension,
  queryPerceptionFromExtension,
  queryDataFromExtension,
  readInteractionTraceFromExtension,
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
  windowRef.emit('message', {
    source: 'widgetva-extension-page',
    type: 'widgetva:response',
    id: message.id,
    ok: true,
    result,
  })
}

test('browser-extension example helpers dispatch core runtime aliases without leaking transport options', async () => {
  const mockWindow = createMockWindow()
  const clientOptions = { targetWindow: mockWindow, responseWindow: mockWindow, timeoutMs: 50 }

  const describePromise = describeWorkspaceFromExtension({ workspaceId: 'workspace_b' }, clientOptions)
  assert.equal(mockWindow.postedMessages[0]?.alias, 'workspace_describe')
  assert.deepEqual(mockWindow.postedMessages[0]?.args?.[0], { workspaceId: 'workspace_b' })
  await respondLatest(mockWindow, { workspaceId: 'workspace_b' })
  assert.deepEqual(await describePromise, { workspaceId: 'workspace_b' })

  const viewPromise = readViewFromExtension({ refs: ['scatter'] }, clientOptions)
  assert.equal(mockWindow.postedMessages[1]?.alias, 'view_read')
  await respondLatest(mockWindow, { refs: ['scatter'] })
  assert.deepEqual(await viewPromise, { refs: ['scatter'] })

  const actionPromise = runActionFromExtension({ call: { name: 'scatter.brushRegion' } }, clientOptions)
  assert.equal(mockWindow.postedMessages[2]?.alias, 'action_run')
  assert.deepEqual(mockWindow.postedMessages[2]?.args?.[0], { name: 'scatter.brushRegion' })
  await respondLatest(mockWindow, { ok: true })
  assert.deepEqual(await actionPromise, { ok: true })

  const perceptionPromise = queryPerceptionFromExtension({ name: 'perception.inspectSelection' }, clientOptions)
  assert.equal(mockWindow.postedMessages[3]?.alias, 'perception_query')
  await respondLatest(mockWindow, { ok: true })
  assert.deepEqual(await perceptionPromise, { ok: true })

  const dataPromise = queryDataFromExtension({ name: 'sampleRows' }, clientOptions)
  assert.equal(mockWindow.postedMessages[4]?.alias, 'data_query')
  await respondLatest(mockWindow, { rows: [] })
  assert.deepEqual(await dataPromise, { rows: [] })

  const tracePromise = readInteractionTraceFromExtension({ limit: 5 }, clientOptions)
  assert.equal(mockWindow.postedMessages[5]?.alias, 'interaction_trace_read')
  await respondLatest(mockWindow, [])
  assert.deepEqual(await tracePromise, [])
})
