import test from 'node:test'
import assert from 'node:assert/strict'

import {
  WIDGETVA_DOCK_BRIDGE_RESPONSE,
  WIDGETVA_DOCK_BRIDGE_SOURCE_CONTENT,
  WIDGETVA_DOCK_BRIDGE_SOURCE_PAGE,
} from '../../shared/officialPageDockBridge.js'
import { createOfficialPageDockClient } from './officialPageDockClient.js'

function createRoot() {
  const listeners = new Set()
  return {
    posted: [],
    addEventListener(type, listener) {
      if (type === 'message') listeners.add(listener)
    },
    removeEventListener(type, listener) {
      if (type === 'message') listeners.delete(listener)
    },
    postMessage(message) {
      this.posted.push(message)
    },
    emit(message) {
      for (const listener of Array.from(listeners)) {
        listener({ source: this, data: message })
      }
    },
  }
}

test('Dock client keeps a runSession request open across turn progress events', async () => {
  const root = createRoot()
  const client = createOfficialPageDockClient(root)
  const progress = []
  let resolved = false

  const request = client.request('runSession', { objective: 'Explain' }, {
    timeoutMs: 1000,
    onProgress(event) {
      progress.push(event)
    },
  }).then((result) => {
    resolved = true
    return result
  })

  const postedRequest = root.posted[0]
  assert.equal(postedRequest.source, WIDGETVA_DOCK_BRIDGE_SOURCE_CONTENT)

  root.emit({
    source: WIDGETVA_DOCK_BRIDGE_SOURCE_PAGE,
    type: WIDGETVA_DOCK_BRIDGE_RESPONSE,
    id: postedRequest.id,
    ok: true,
    event: 'turn',
    result: { progress: { index: 0 } },
  })

  await Promise.resolve()
  assert.equal(resolved, false)
  assert.deepEqual(progress, [{ progress: { index: 0 } }])

  root.emit({
    source: WIDGETVA_DOCK_BRIDGE_SOURCE_PAGE,
    type: WIDGETVA_DOCK_BRIDGE_RESPONSE,
    id: postedRequest.id,
    ok: true,
    result: { session: { answer: 'Done.' } },
  })

  assert.deepEqual(await request, { session: { answer: 'Done.' } })
  assert.equal(resolved, true)
})
