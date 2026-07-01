import test from 'node:test'
import assert from 'node:assert/strict'

import {
  OBSERVABLE_D3_BOOTSTRAP_ENTRY,
  OBSERVABLE_D3_BOOTSTRAP_KEY,
  ensureObservableD3PageBootstrap,
} from './observableD3Bootstrap.js'

function createRoot(url = 'https://observablehq.com/@d3/scatterplot') {
  const listeners = new Set()
  const postedMessages = []
  return {
    postedMessages,
    location: {
      href: url,
      pathname: new URL(url).pathname,
    },
    addEventListener(type, listener) {
      if (type === 'message') listeners.add(listener)
    },
    removeEventListener(type, listener) {
      if (type === 'message') listeners.delete(listener)
    },
    postMessage(message) {
      postedMessages.push(message)
      const makeResponse = (result) => ({
        source: 'widgetva-official-page-agent-content',
        type: 'widgetva:official-page-agent-response',
        id: message.id,
        ok: true,
        result,
      })

      if (message?.method === 'chat') {
        for (const listener of listeners) {
          queueMicrotask(() => listener({
            source: this,
            data: makeResponse({
              model: 'test-model',
              content: JSON.stringify({
                assistantMessage: 'I will brush the visible scatter region.',
                rationale: 'A visible brush is easy to verify.',
                operation: {
                  kind: 'action',
                  name: 'scatter.brushRegion',
                  queryScope: { widgetRef: 'scatter-ref' },
                  params: {
                    xField: 'Horsepower',
                    yField: 'Miles_per_Gallon',
                    xRange: [80, 140],
                    yRange: [18, 30],
                  },
                },
              }),
            }),
          }))
        }
      }

      if (message?.method === 'configure') {
        for (const listener of listeners) {
          queueMicrotask(() => listener({
            source: this,
            data: makeResponse({
              apiKeyConfigured: true,
              model: message.params?.model || 'test-model',
              siteUrl: null,
              appName: 'WidgetVA Official Page Integration',
            }),
          }))
        }
      }

      if (message?.method === 'readConfig') {
        for (const listener of listeners) {
          queueMicrotask(() => listener({
            source: this,
            data: makeResponse({
              apiKeyConfigured: true,
              model: 'test-model',
              siteUrl: null,
              appName: 'WidgetVA Official Page Integration',
            }),
          }))
        }
      }
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
  let runAgentLoopCalls = 0

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
      root.__widgetVA = {
        async describeWorkspace() {
          return { widgets: [{ ref: 'scatter-ref', widgetId: 'scatter' }] }
        },
        async describeAgentLoop() {
          return { loopHints: { verifiedActionName: 'executeVerifiedAction' } }
        },
        async readObservation() {
          return {
            state: {
              stateId: 'main:s1',
            },
            sharedAnalyticalState: {
              focusedWidgetRef: 'scatter-ref',
              filters: {},
              viewport: null,
              selections: {
                primary: null,
              },
              highlight: {
                activeWidgetRefs: [],
              },
              comparisonTargets: [],
              annotations: [],
            },
          }
        },
        async describeActionUsage() {
          return {
            actions: [{ name: 'scatter.brushRegion' }],
          }
        },
        async executeVerifiedAction(call) {
          return {
            actionResult: {
              ok: true,
              stateId: 'main:s2',
              updatedRefs: [call.queryScope?.widgetRef].filter(Boolean),
            },
            verification: {
              ok: true,
              summary: 'Verified.',
            },
          }
        },
      }
      return {
        pagePort: root.__widgetVA,
        surface: {
          surfaceTag: 'svg',
          inferredKind: 'scatter',
        },
        async runAgentLoop(options = {}) {
          runAgentLoopCalls += 1
          return { ok: true, options }
        },
      }
    },
  })

  assert.equal(described, 1)
  assert.equal(waitedForFrame, 1)
  assert.equal(bootstrapped, 1)
  assert.equal(entry.status, 'ready')
  assert.equal(typeof entry.manager?.readActiveController, 'function')
  assert.equal(entry.manager.readActiveController(), entry.controller)
  assert.equal(entry.workerFrame?.src, workerFrame.src)
  assert.deepEqual(entry.surface, {
    surfaceTag: 'svg',
    inferredKind: 'scatter',
  })
  assert.equal(typeof entry.runAgentLoop, 'function')
  assert.equal(typeof entry.runNaturalLanguageAgentTurn, 'function')
  assert.equal(typeof entry.runNaturalLanguageAgentLoop, 'function')
  assert.equal(typeof entry.configureAgent, 'function')
  assert.equal(typeof entry.readAgentConfig, 'function')
  assert.equal(typeof root.__widgetVAOfficialPageRunAgentLoop, 'function')
  assert.equal(typeof root.__widgetVAOfficialPageRunNaturalLanguageAgentTurn, 'function')
  assert.equal(typeof root.__widgetVAOfficialPageRunNaturalLanguageAgentLoop, 'function')
  assert.equal(typeof root.__widgetVAOfficialPageConfigureAgent, 'function')
  assert.equal(typeof root.__widgetVAOfficialPageReadAgentConfig, 'function')
  assert.deepEqual(await root.__widgetVAOfficialPageRunAgentLoop({ objective: 'test' }), {
    ok: true,
    options: { objective: 'test' },
  })
  assert.deepEqual(await root.__widgetVAOfficialPageConfigureAgent({ apiKey: 'test-key', model: 'test-model' }), {
    apiKeyConfigured: true,
    model: 'test-model',
    siteUrl: null,
    appName: 'WidgetVA Official Page Integration',
  })
  assert.deepEqual(await root.__widgetVAOfficialPageReadAgentConfig(), {
    apiKeyConfigured: true,
    model: 'test-model',
    siteUrl: null,
    appName: 'WidgetVA Official Page Integration',
  })
  const naturalLanguageTurn = await root.__widgetVAOfficialPageRunNaturalLanguageAgentTurn('Brush the visible scatter region.')
  assert.equal(naturalLanguageTurn.plan?.step?.name, 'scatter.brushRegion')
  assert.equal(naturalLanguageTurn.act?.ok, true)
  assert.equal(naturalLanguageTurn.verify?.ok, true)
  assert.equal(runAgentLoopCalls, 1)

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
  root.__widgetVA = { describeWorkspace() {} }
  root.__widgetVAObservableD3Debug = () => ({ stale: true })
  root.__widgetVAObservableD3PreviewBrush = () => ({ stale: true })
  root.__widgetVAObservableD3Probe = () => ({ stale: true })

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
  assert.equal(root.__widgetVAOfficialPageRunAgentLoop, undefined)
  assert.equal(root.__widgetVAOfficialPageRunNaturalLanguageAgentLoop, undefined)
  assert.equal(root.__widgetVAObservableD3Debug, undefined)
  assert.equal(root.__widgetVAObservableD3PreviewBrush, undefined)
  assert.equal(root.__widgetVAObservableD3Probe, undefined)
  assert.equal(root.__widgetVA, undefined)
})

test('ensureObservableD3PageBootstrap reboots when the Observable notebook url changes', async () => {
  const root = createRoot('https://observablehq.com/@d3/scatterplot')
  let disposedFirstController = 0
  let bootstrapped = 0
  const jumpCalls = []

  const firstWorkerFrame = {
    src: 'https://d3.static.observableusercontent.com/next/worker-first.html',
    getAttribute(name) {
      return name === 'src' ? this.src : null
    },
  }

  const secondWorkerFrame = {
    src: 'https://d3.static.observableusercontent.com/next/worker-second.html',
    getAttribute(name) {
      return name === 'src' ? this.src : null
    },
  }

  const firstEntry = await ensureObservableD3PageBootstrap({
    root,
    isSupportedPage: () => true,
    describePage() {
      return {
        provider: 'd3',
        notebook: { slug: 'scatterplot' },
      }
    },
    async waitForWorkerFrame() {
      return firstWorkerFrame
    },
    async bootstrapPage() {
      bootstrapped += 1
      root.__widgetVA = {
        describeWorkspace() {},
        async readState() {
          return { stateId: 'main:s1' }
        },
      }
      return {
        pagePort: root.__widgetVA,
        surface: { surfaceTag: 'svg', inferredKind: 'scatter' },
        readDebugSnapshot() {
          return { slug: 'scatterplot' }
        },
        dispose() {
          disposedFirstController += 1
        },
      }
    },
  })

  assert.equal(firstEntry.status, 'ready')
  assert.equal(bootstrapped, 1)

  root.location.href = 'https://observablehq.com/@d3/delaunay-find-and-zoom'
  root.location.pathname = '/@d3/delaunay-find-and-zoom'

  const secondEntry = await ensureObservableD3PageBootstrap({
    root,
    isSupportedPage: () => true,
    describePage() {
      return {
        provider: 'd3',
        notebook: { slug: 'delaunay-find-and-zoom' },
      }
    },
    async waitForWorkerFrame() {
      return secondWorkerFrame
    },
    async bootstrapPage() {
      bootstrapped += 1
      root.__widgetVA = {
        describeWorkspace() {},
        async jumpToState(options = {}) {
          jumpCalls.push(options)
          return { ok: true, stateId: options.stateId }
        },
      }
      return {
        pagePort: root.__widgetVA,
        surface: { surfaceTag: 'svg', inferredKind: 'scatter' },
        readDebugSnapshot() {
          return { slug: 'delaunay-find-and-zoom' }
        },
        dispose() {},
      }
    },
  })

  assert.equal(bootstrapped, 2)
  assert.equal(disposedFirstController, 1)
  assert.deepEqual(jumpCalls, [{ stateId: 'main:s1' }])
  assert.equal(secondEntry.pageUrl, 'https://observablehq.com/@d3/delaunay-find-and-zoom')
  assert.equal(secondEntry.workerFrame?.src, secondWorkerFrame.src)
  assert.deepEqual(await root.__widgetVAObservableD3Debug(), { slug: 'delaunay-find-and-zoom' })
  assert.equal(typeof root.__widgetVAOfficialPageRunAgentLoop, 'function')
})

test('ensureObservableD3PageBootstrap clears the managed controller when the page becomes unsupported', async () => {
  const root = createRoot('https://observablehq.com/@d3/scatterplot')
  let disposed = 0

  const readyEntry = await ensureObservableD3PageBootstrap({
    root,
    isSupportedPage: () => true,
    describePage() {
      return {
        provider: 'd3',
        notebook: { slug: 'scatterplot' },
      }
    },
    async waitForWorkerFrame() {
      return {
        src: 'https://d3.static.observableusercontent.com/next/worker-first.html',
        getAttribute(name) {
          return name === 'src' ? this.src : null
        },
      }
    },
    async bootstrapPage() {
      root.__widgetVA = { describeWorkspace() {} }
      return {
        pagePort: root.__widgetVA,
        surface: { surfaceTag: 'svg', inferredKind: 'scatter' },
        dispose() {
          disposed += 1
        },
      }
    },
  })

  assert.equal(readyEntry.status, 'ready')
  assert.ok(readyEntry.manager.readActiveController())

  root.location.href = 'https://example.com/not-supported'
  root.location.pathname = '/not-supported'

  const unsupportedEntry = await ensureObservableD3PageBootstrap({
    root,
    isSupportedPage: () => false,
    describePage() {
      throw new Error('describePage should not run for unsupported pages')
    },
    async waitForWorkerFrame() {
      throw new Error('waitForWorkerFrame should not run for unsupported pages')
    },
    async bootstrapPage() {
      throw new Error('bootstrapPage should not run for unsupported pages')
    },
  })

  assert.equal(unsupportedEntry.status, 'unsupported')
  assert.equal(disposed, 1)
  assert.equal(unsupportedEntry.manager.readActiveController(), null)
  assert.equal(unsupportedEntry.controller, null)
  assert.equal(unsupportedEntry.pagePort, null)
  assert.equal(unsupportedEntry.workerFrame, null)
  assert.equal(unsupportedEntry.surface, null)
  assert.equal(root.__widgetVAOfficialPageRunAgentLoop, undefined)
  assert.equal(root.__widgetVAOfficialPageRunNaturalLanguageAgentLoop, undefined)
  assert.equal(root.__widgetVA, undefined)
})
