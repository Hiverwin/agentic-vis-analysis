import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createOfficialPageAgentBridgeMessageHandler,
} from './installOfficialPageAgentBridge.js'
import {
  WIDGETVA_AGENT_BRIDGE_REQUEST,
  WIDGETVA_AGENT_BRIDGE_SOURCE_CONTENT,
  WIDGETVA_AGENT_BRIDGE_SOURCE_PAGE,
} from '../shared/officialPageAgentBridge.js'

function createRoot() {
  const posted = []
  return {
    posted,
    postMessage(message) {
      posted.push(message)
    },
  }
}

test('official page agent bridge handler forwards successful runtime responses back to the page', async () => {
  const root = createRoot()
  const originalChrome = globalThis.chrome

  globalThis.chrome = {
    runtime: {
      lastError: null,
      sendMessage(message, callback) {
        assert.equal(message.method, 'chat')
        callback({
          ok: true,
          result: { content: 'ok' },
        })
      },
    },
  }

  try {
    const handler = createOfficialPageAgentBridgeMessageHandler(root)
    handler({
      source: root,
      data: {
        source: WIDGETVA_AGENT_BRIDGE_SOURCE_PAGE,
        type: WIDGETVA_AGENT_BRIDGE_REQUEST,
        id: 'req_1',
        method: 'chat',
        params: { prompt: 'hello' },
      },
    })

    assert.deepEqual(root.posted[0], {
      source: WIDGETVA_AGENT_BRIDGE_SOURCE_CONTENT,
      type: 'widgetva:official-page-agent-response',
      id: 'req_1',
      ok: true,
      result: { content: 'ok' },
    })
  } finally {
    globalThis.chrome = originalChrome
  }
})

test('official page agent bridge handler returns a structured error when runtime sendMessage throws synchronously', async () => {
  const root = createRoot()
  const originalChrome = globalThis.chrome

  globalThis.chrome = {
    runtime: {
      sendMessage() {
        throw new Error('Extension context invalidated.')
      },
    },
  }

  try {
    const handler = createOfficialPageAgentBridgeMessageHandler(root)
    handler({
      source: root,
      data: {
        source: WIDGETVA_AGENT_BRIDGE_SOURCE_PAGE,
        type: WIDGETVA_AGENT_BRIDGE_REQUEST,
        id: 'req_2',
        method: 'chat',
        params: { prompt: 'hello' },
      },
    })

    assert.deepEqual(root.posted[0], {
      source: WIDGETVA_AGENT_BRIDGE_SOURCE_CONTENT,
      type: 'widgetva:official-page-agent-response',
      id: 'req_2',
      ok: false,
      error: {
        name: 'Error',
        message: 'Extension context invalidated.',
      },
    })
  } finally {
    globalThis.chrome = originalChrome
  }
})
