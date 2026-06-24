import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createPlaywrightTransportClient,
  createWebSocketTransportClient,
  createBrowserExtensionTransportClient,
} from './publicTransportClients.js'

function createMockPage() {
  return {
    async evaluate() {
      return null
    },
  }
}

class FakeSocket {
  static OPEN = 1

  constructor() {
    this.readyState = FakeSocket.OPEN
    this.listeners = new Map()
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener)
  }

  removeEventListener(type) {
    this.listeners.delete(type)
  }

  close() {}
  send() {}
}

test('createPlaywrightTransportClient exposes only widget/workspace-first public methods', () => {
  const client = createPlaywrightTransportClient(createMockPage())
  assert.equal(typeof client.describeWorkspace, 'function')
  assert.equal(typeof client.describeWidget, 'function')
  assert.equal(typeof client.readWorkspaceState, 'function')
  assert.equal(typeof client.executeWidgetAction, 'function')
  assert.equal(typeof client.queryWorkspacePerception, 'function')
  assert.equal(typeof client.replayWorkspace, 'function')
  assert.equal('runAction' in client, false)
  assert.equal('readView' in client, false)
  assert.equal('queryPerception' in client, false)
  assert.equal('describeRuntimeCore' in client, false)
})

test('createWebSocketTransportClient preserves lifecycle while hiding runtime-first aliases', () => {
  const client = createWebSocketTransportClient({ socket: new FakeSocket() })
  assert.equal(typeof client.close, 'function')
  assert.ok(client.ready instanceof Promise)
  assert.equal(typeof client.describeWorkspace, 'function')
  assert.equal(typeof client.readWidgetTrace, 'function')
  assert.equal(typeof client.executeWorkspaceAction, 'function')
  assert.equal('invoke' in client, false)
  assert.equal('runAction' in client, false)
  assert.equal('describeRuntimeStore' in client, false)
})

test('createBrowserExtensionTransportClient hides runtime-first aliases', () => {
  const targetWindow = { postMessage() {} }
  const responseWindow = { addEventListener() {}, removeEventListener() {} }
  const client = createBrowserExtensionTransportClient({ targetWindow, responseWindow })
  assert.equal(typeof client.describeWorkspace, 'function')
  assert.equal(typeof client.readWorkspaceState, 'function')
  assert.equal(typeof client.queryWidgetPerception, 'function')
  assert.equal('runAction' in client, false)
  assert.equal('queryPerception' in client, false)
  assert.equal('describeRuntimeCore' in client, false)
})
