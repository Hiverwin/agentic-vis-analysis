import test from 'node:test'
import assert from 'node:assert/strict'

import {
  WIDGETVA_EXTENSION_REQUEST_SOURCE,
  WIDGETVA_EXTENSION_REQUEST_TYPE,
  WIDGETVA_EXTENSION_RESPONSE_SOURCE,
  WIDGETVA_EXTENSION_RESPONSE_TYPE,
} from './browserExtensionBridge.js'
import { createBrowserExtensionTransportClient } from './browserExtensionClient.js'

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
      listeners.set(type, (listeners.get(type) || []).filter((entry) => entry !== handler))
    },
    postMessage(message) {
      postedMessages.push(message)
    },
    emit(type, data) {
      for (const handler of listeners.get(type) || []) handler({ data })
    },
  }
}

async function respondLatest(windowRef, result) {
  const message = windowRef.postedMessages[windowRef.postedMessages.length - 1]
  windowRef.emit('message', {
    source: WIDGETVA_EXTENSION_RESPONSE_SOURCE,
    type: WIDGETVA_EXTENSION_RESPONSE_TYPE,
    id: message.id,
    ok: true,
    result,
  })
}

test('createBrowserExtensionTransportClient dispatches stable page-port aliases only', async () => {
  const mockWindow = createMockWindow()
  const client = createBrowserExtensionTransportClient({
    targetWindow: mockWindow,
    responseWindow: mockWindow,
    timeoutMs: 50,
  })

  const describePromise = client.describePagePort()
  assert.equal(mockWindow.postedMessages[0]?.source, WIDGETVA_EXTENSION_REQUEST_SOURCE)
  assert.equal(mockWindow.postedMessages[0]?.type, WIDGETVA_EXTENSION_REQUEST_TYPE)
  assert.equal(mockWindow.postedMessages[0]?.alias, 'page_port_describe')
  await respondLatest(mockWindow, { methods: ['describeWorkspace'] })
  assert.deepEqual(await describePromise, { methods: ['describeWorkspace'] })

  const workspacePromise = client.describeWorkspace({ workspaceId: 'workspace_b' })
  assert.equal(mockWindow.postedMessages[1]?.alias, 'workspace_describe')
  await respondLatest(mockWindow, { workspaceId: 'workspace_b' })
  assert.deepEqual(await workspacePromise, { workspaceId: 'workspace_b' })

  const actionPromise = client.runAction({ name: 'scatter.brushRegion' })
  assert.equal(mockWindow.postedMessages[2]?.alias, 'action_run')
  await respondLatest(mockWindow, { ok: true, stateId: 'main:s1' })
  assert.deepEqual(await actionPromise, { ok: true, stateId: 'main:s1' })

  const replayPromise = client.replay({ stateId: 'main:s2' })
  assert.equal(mockWindow.postedMessages[3]?.alias, 'workspace_replay')
  assert.deepEqual(mockWindow.postedMessages[3]?.args?.[0], { stateId: 'main:s2' })
  await respondLatest(mockWindow, { ok: true, stateId: 'main:s2' })
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
