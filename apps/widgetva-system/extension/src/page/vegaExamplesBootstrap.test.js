import test from 'node:test'
import assert from 'node:assert/strict'

import {
  VEGA_EXAMPLES_BOOTSTRAP_ENTRY,
  VEGA_EXAMPLES_BOOTSTRAP_KEY,
  createOfficialVegaExamplesSessionId,
  ensureVegaExamplesPageBootstrap,
} from './vegaExamplesBootstrap.js'

function createRoot(url = 'https://vega.github.io/vega-lite/examples/scatter_plot.html') {
  return {
    location: {
      href: url,
      pathname: new URL(url).pathname,
    },
  }
}

test('createOfficialVegaExamplesSessionId derives the example slug from the official page URL', () => {
  const root = createRoot('https://vega.github.io/vega-lite/examples/point_2d.html')
  assert.equal(createOfficialVegaExamplesSessionId(root), 'official-vega-lite-point_2d')
})

test('ensureVegaExamplesPageBootstrap marks unsupported pages without attempting bootstrap', async () => {
  let installed = 0
  let bootstrapped = 0

  const entry = await ensureVegaExamplesPageBootstrap({
    root: createRoot('https://example.com/not-supported.html'),
    isSupportedPage: () => false,
    installCapture() {
      installed += 1
    },
    async bootstrapPage() {
      bootstrapped += 1
      return {}
    },
  })

  assert.equal(installed, 0)
  assert.equal(bootstrapped, 0)
  assert.equal(entry.status, 'unsupported')
})

test('ensureVegaExamplesPageBootstrap installs capture, bootstraps once, and records the page port', async () => {
  const root = createRoot()
  let installed = 0
  let bootstrapped = 0

  const entry = await ensureVegaExamplesPageBootstrap({
    root,
    isSupportedPage: () => true,
    installCapture(receivedRoot) {
      installed += 1
      assert.equal(receivedRoot, root)
    },
    async bootstrapPage({ sessionId, enableExtensionBridge }) {
      bootstrapped += 1
      assert.equal(sessionId, 'official-vega-lite-scatter_plot')
      assert.equal(enableExtensionBridge, true)
      root.__widgetVA = { describeWorkspace() {} }
      return { pagePort: root.__widgetVA }
    },
  })

  assert.equal(installed, 1)
  assert.equal(bootstrapped, 1)
  assert.equal(entry.status, 'ready')
  assert.equal(entry.pagePort, root.__widgetVA)

  const again = await ensureVegaExamplesPageBootstrap({
    root,
    isSupportedPage: () => true,
    installCapture() {
      installed += 1
    },
    async bootstrapPage() {
      bootstrapped += 1
      return {}
    },
  })

  assert.equal(installed, 2)
  assert.equal(bootstrapped, 1)
  assert.equal(again, entry)
})

test('ensureVegaExamplesPageBootstrap records bootstrap failures on the shared page state', async () => {
  const root = createRoot()

  await assert.rejects(
    ensureVegaExamplesPageBootstrap({
      root,
      isSupportedPage: () => true,
      installCapture() {},
      async bootstrapPage() {
        throw new Error('capture timed out')
      },
    }),
    /capture timed out/,
  )

  const entry = root[VEGA_EXAMPLES_BOOTSTRAP_KEY][VEGA_EXAMPLES_BOOTSTRAP_ENTRY]
  assert.equal(entry.status, 'error')
  assert.equal(entry.error?.message, 'capture timed out')
})
