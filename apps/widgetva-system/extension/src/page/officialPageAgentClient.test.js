import test from 'node:test'
import assert from 'node:assert/strict'

import {
  completeOfficialPageAgentChat,
  configureOfficialPageAgent,
} from './officialPageAgentClient.js'

function createRoot() {
  const listeners = new Set()
  return {
    addEventListener(type, listener) {
      if (type === 'message') listeners.add(listener)
    },
    removeEventListener(type, listener) {
      if (type === 'message') listeners.delete(listener)
    },
    postMessage(message) {
      if (message.method === 'configure') {
        for (const listener of listeners) {
          queueMicrotask(() => {
            listener({
              source: this,
              data: {
                source: 'widgetva-official-page-agent-content',
                type: 'widgetva:official-page-agent-response',
                id: message.id,
                ok: true,
                result: {
                  apiKeyConfigured: true,
                  model: 'test-model',
                },
              },
            })
          })
        }
      }
      if (message.method === 'chat') {
        for (const listener of listeners) {
          queueMicrotask(() => {
            listener({
              source: this,
              data: {
                source: 'widgetva-official-page-agent-content',
                type: 'widgetva:official-page-agent-response',
                id: message.id,
                ok: false,
                error: {
                  name: 'Error',
                  message: 'Extension context invalidated.',
                },
              },
            })
          })
        }
      }
    },
  }
}

test('configureOfficialPageAgent resolves successful bridge responses', async () => {
  const root = createRoot()
  const result = await configureOfficialPageAgent(root, { apiKey: 'test-key' })

  assert.deepEqual(result, {
    apiKeyConfigured: true,
    model: 'test-model',
  })
})

test('configureOfficialPageAgent retries once after a transient bridge response failure', async () => {
  const listeners = new Set()
  let configureRequests = 0
  const root = {
    addEventListener(type, listener) {
      if (type === 'message') listeners.add(listener)
    },
    removeEventListener(type, listener) {
      if (type === 'message') listeners.delete(listener)
    },
    postMessage(message) {
      if (message.method !== 'configure') return
      configureRequests += 1
      for (const listener of listeners) {
        queueMicrotask(() => {
          listener({
            source: this,
            data: configureRequests === 1
              ? {
                  source: 'widgetva-official-page-agent-content',
                  type: 'widgetva:official-page-agent-response',
                  id: message.id,
                  ok: false,
                  error: {
                    name: 'Error',
                    message: 'Extension context invalidated.',
                  },
                }
              : {
                  source: 'widgetva-official-page-agent-content',
                  type: 'widgetva:official-page-agent-response',
                  id: message.id,
                  ok: true,
                  result: {
                    apiKeyConfigured: true,
                    model: 'test-model',
                  },
                },
          })
        })
      }
    },
  }

  const result = await configureOfficialPageAgent(root, { apiKey: 'test-key' }, { retryDelayMs: 0 })

  assert.equal(configureRequests, 2)
  assert.deepEqual(result, {
    apiKeyConfigured: true,
    model: 'test-model',
  })
})

test('completeOfficialPageAgentChat surfaces bridge response errors as typed bridge errors', async () => {
  const root = createRoot()

  await assert.rejects(
    completeOfficialPageAgentChat(root, {
      messages: [{ role: 'user', content: 'hello' }],
      timeoutMs: 50,
    }),
    (error) => {
      assert.equal(error?.name, 'WidgetVAOfficialPageBridgeError')
      assert.equal(error?.code, 'bridge_response_error')
      assert.equal(error?.bridgeMethod, 'chat')
      assert.match(error?.message || '', /Extension context invalidated\./)
      return true
    },
  )
})

test('completeOfficialPageAgentChat surfaces request posting failures as typed bridge errors', async () => {
  const root = {
    addEventListener() {},
    removeEventListener() {},
    postMessage() {
      throw new Error('The target page context is unavailable.')
    },
  }

  await assert.rejects(
    completeOfficialPageAgentChat(root, {
      messages: [{ role: 'user', content: 'hello' }],
      timeoutMs: 50,
    }),
    (error) => {
      assert.equal(error?.name, 'WidgetVAOfficialPageBridgeError')
      assert.equal(error?.code, 'bridge_post_error')
      assert.equal(error?.bridgeMethod, 'chat')
      assert.match(error?.message || '', /The target page context is unavailable\./)
      return true
    },
  )
})

test('completeOfficialPageAgentChat surfaces timeout failures as typed bridge errors', async () => {
  const root = {
    addEventListener() {},
    removeEventListener() {},
    postMessage() {},
  }

  await assert.rejects(
    completeOfficialPageAgentChat(root, {
      messages: [{ role: 'user', content: 'hello' }],
      timeoutMs: 1,
    }),
    (error) => {
      assert.equal(error?.name, 'WidgetVAOfficialPageBridgeError')
      assert.equal(error?.code, 'bridge_timeout')
      assert.equal(error?.bridgeMethod, 'chat')
      assert.match(error?.message || '', /Timed out waiting for WidgetVA official-page agent bridge: chat/)
      return true
    },
  )
})

test('completeOfficialPageAgentChat retries once after a transient bridge response failure', async () => {
  const listeners = new Set()
  let chatRequests = 0
  const root = {
    addEventListener(type, listener) {
      if (type === 'message') listeners.add(listener)
    },
    removeEventListener(type, listener) {
      if (type === 'message') listeners.delete(listener)
    },
    postMessage(message) {
      if (message.method !== 'chat') return
      chatRequests += 1
      for (const listener of listeners) {
        queueMicrotask(() => {
          listener({
            source: this,
            data: chatRequests === 1
              ? {
                  source: 'widgetva-official-page-agent-content',
                  type: 'widgetva:official-page-agent-response',
                  id: message.id,
                  ok: false,
                  error: {
                    name: 'Error',
                    message: 'Extension context invalidated.',
                  },
                }
              : {
                  source: 'widgetva-official-page-agent-content',
                  type: 'widgetva:official-page-agent-response',
                  id: message.id,
                  ok: true,
                  result: {
                    model: 'test-model',
                    content: 'Recovered.',
                  },
                },
          })
        })
      }
    },
  }

  const result = await completeOfficialPageAgentChat(root, {
    messages: [{ role: 'user', content: 'hello' }],
    timeoutMs: 50,
    retryDelayMs: 0,
  })

  assert.equal(chatRequests, 2)
  assert.deepEqual(result, {
    model: 'test-model',
    raw: null,
    content: 'Recovered.',
  })
})
