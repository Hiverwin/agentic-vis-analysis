import test from 'node:test'
import assert from 'node:assert/strict'

import {
  OBSERVABLE_D3_BOOTSTRAP_ENTRY,
  OBSERVABLE_D3_BOOTSTRAP_KEY,
  ensureObservableD3PageBootstrap,
} from './observableD3Bootstrap.js'

function createRoot(url = 'https://observablehq.com/@d3/scatterplot') {
  return {
    location: {
      href: url,
      pathname: new URL(url).pathname,
    },
  }
}

test('ensureObservableD3PageBootstrap marks unsupported pages without attempting bootstrap work', async () => {
  let described = 0
  let waitedForFrame = 0
  let bootstrapped = 0

  const entry = await ensureObservableD3PageBootstrap({
    root: createRoot('https://example.com/not-supported'),
    isSupportedPage: () => false,
    describePage() {
      described += 1
      return {}
    },
    async waitForWorkerFrame() {
      waitedForFrame += 1
      return null
    },
    async bootstrapPage() {
      bootstrapped += 1
      return null
    },
  })

  assert.equal(described, 0)
  assert.equal(waitedForFrame, 0)
  assert.equal(bootstrapped, 0)
  assert.equal(entry.status, 'unsupported')
})

test('ensureObservableD3PageBootstrap records page shape, worker frame, and controller surface once ready', async () => {
  const root = createRoot()
  let described = 0
  let waitedForFrame = 0
  let bootstrapped = 0

  const workerFrame = {
    src: 'https://d3.static.observableusercontent.com/next/worker-test.html',
    getAttribute(name) {
      return name === 'src' ? this.src : null
    },
  }

  const entry = await ensureObservableD3PageBootstrap({
    root,
    isSupportedPage: () => true,
    describePage(receivedRoot) {
      described += 1
      assert.equal(receivedRoot, root)
      return {
        provider: 'd3',
        notebook: { slug: 'scatterplot' },
      }
    },
    async waitForWorkerFrame({ root: receivedRoot }) {
      waitedForFrame += 1
      assert.equal(receivedRoot, root)
      return workerFrame
    },
    async bootstrapPage({ root: receivedRoot, sessionId, enableExtensionBridge }) {
      bootstrapped += 1
      assert.equal(receivedRoot, root)
      assert.equal(sessionId, 'official-observable-d3-scatterplot')
      assert.equal(enableExtensionBridge, true)
      root.__widgetVA = { describeWorkspace() {} }
      return {
        pagePort: root.__widgetVA,
        surface: {
          surfaceTag: 'svg',
          inferredKind: 'scatter',
        },
      }
    },
  })

  assert.equal(described, 1)
  assert.equal(waitedForFrame, 1)
  assert.equal(bootstrapped, 1)
  assert.equal(entry.status, 'ready')
  assert.equal(entry.workerFrame?.src, workerFrame.src)
  assert.deepEqual(entry.surface, {
    surfaceTag: 'svg',
    inferredKind: 'scatter',
  })

  const again = await ensureObservableD3PageBootstrap({
    root,
    isSupportedPage: () => true,
    describePage() {
      described += 1
      return {}
    },
    async waitForWorkerFrame() {
      waitedForFrame += 1
      return workerFrame
    },
    async bootstrapPage() {
      bootstrapped += 1
      return null
    },
  })

  assert.equal(described, 1)
  assert.equal(waitedForFrame, 1)
  assert.equal(bootstrapped, 1)
  assert.equal(again, entry)
})

test('ensureObservableD3PageBootstrap records bootstrap failures on the shared page state', async () => {
  const root = createRoot()

  await assert.rejects(
    ensureObservableD3PageBootstrap({
      root,
      isSupportedPage: () => true,
      describePage() {
        return {
          provider: 'd3',
          notebook: { slug: 'scatterplot' },
        }
      },
      async waitForWorkerFrame() {
        throw new Error('worker frame timed out')
      },
      async bootstrapPage() {
        return null
      },
    }),
    /worker frame timed out/,
  )

  const entry = root[OBSERVABLE_D3_BOOTSTRAP_KEY][OBSERVABLE_D3_BOOTSTRAP_ENTRY]
  assert.equal(entry.status, 'error')
  assert.equal(entry.error?.message, 'worker frame timed out')
})
