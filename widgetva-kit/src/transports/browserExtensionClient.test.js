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
    source: WIDGETVA_EXTENSION_RESPONSE_SOURCE,
    type: WIDGETVA_EXTENSION_RESPONSE_TYPE,
    id: message.id,
    ok: true,
    result,
  })
}

test('createBrowserExtensionTransportClient dispatches documented core aliases', async () => {
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

  const actionPromise = client.runAction({ name: 'scatter.brushRegion' })
  assert.equal(mockWindow.postedMessages[1]?.alias, 'action_run')
  await respondLatest(mockWindow, { ok: true, stateId: 'main:s1' })
  assert.deepEqual(await actionPromise, { ok: true, stateId: 'main:s1' })

  const perceptionPromise = client.queryPerception({ name: 'perception.inspectSelection' })
  assert.equal(mockWindow.postedMessages[2]?.alias, 'perception_query')
  await respondLatest(mockWindow, { ok: true, result: {} })
  assert.deepEqual(await perceptionPromise, { ok: true, result: {} })

  const describeWidgetPromise = client.describeWidget({ widgetId: 'scatter_a' })
  assert.equal(mockWindow.postedMessages[3]?.alias, 'workspace_describe')
  await respondLatest(mockWindow, {
    widgets: [{ ref: 'wl://widgetva-app/workspace/main/widget/scatter_a', widgetId: 'scatter_a' }],
  })
  assert.deepEqual(await describeWidgetPromise, {
    ref: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    widgetId: 'scatter_a',
  })

  const readWidgetStatePromise = client.readWidgetState({ widgetId: 'scatter_a' })
  assert.equal(mockWindow.postedMessages[4]?.alias, 'workspace_describe')
  await respondLatest(mockWindow, {
    widgets: [{ ref: 'wl://widgetva-app/workspace/main/widget/scatter_a', widgetId: 'scatter_a' }],
  })
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(mockWindow.postedMessages[5]?.alias, 'view_read')
  assert.deepEqual(
    mockWindow.postedMessages[5]?.args?.[0]?.refs,
    ['wl://widgetva-app/workspace/main/widget/scatter_a'],
  )
  await respondLatest(mockWindow, { stateId: 'main:s1', widgets: {} })
  assert.deepEqual(await readWidgetStatePromise, { stateId: 'main:s1', widgets: {} })

  const replayPromise = client.replayWorkspace('main:s2')
  assert.equal(mockWindow.postedMessages[6]?.alias, 'jump_to_state')
  assert.deepEqual(mockWindow.postedMessages[6]?.args?.[0], { stateId: 'main:s2' })
  await respondLatest(mockWindow, { ok: true, stateId: 'main:s2' })
  assert.deepEqual(await replayPromise, { ok: true, stateId: 'main:s2' })
})

test('createBrowserExtensionTransportClient no longer exposes evaluation helpers', () => {
  const mockWindow = createMockWindow()
  const client = createBrowserExtensionTransportClient({
    targetWindow: mockWindow,
    responseWindow: mockWindow,
    timeoutMs: 50,
  })

  assert.equal('describeEvaluationSurface' in client, false)
  assert.equal('evaluationActionVerification' in client, false)
  assert.equal('evaluationBenchmarkTask' in client, false)
})

test('createBrowserExtensionTransportClient lists only installed page-port MCP tools', async () => {
  const mockWindow = createMockWindow()
  const client = createBrowserExtensionTransportClient({
    targetWindow: mockWindow,
    responseWindow: mockWindow,
    timeoutMs: 50,
  })

  const promise = client.listAvailableWidgetVAMcpTools()
  assert.equal(mockWindow.postedMessages[0]?.alias, 'page_port_describe')
  await respondLatest(mockWindow, {
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
