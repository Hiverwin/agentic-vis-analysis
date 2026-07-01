import test from 'node:test'
import assert from 'node:assert/strict'

import {
  VEGA_EXAMPLES_BOOTSTRAP_ENTRY,
  VEGA_EXAMPLES_BOOTSTRAP_KEY,
  createOfficialVegaExamplesSessionId,
  ensureVegaExamplesPageBootstrap,
} from './vegaExamplesBootstrap.js'

function createRoot(url = 'https://vega.github.io/vega-lite/examples/scatter_plot.html') {
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
      if (message?.method === 'chat') {
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
                  model: 'test-model',
                  content: JSON.stringify({
                    assistantMessage: 'I will brush the visible scatter region.',
                    rationale: 'A visible brush is easy to verify.',
                    operation: {
                      kind: 'action',
                      name: 'scatter.brushRegion',
                      queryScope: {
                        widgetRef: 'scatter-ref',
                      },
                      params: {
                        xField: 'Horsepower',
                        yField: 'Miles_per_Gallon',
                        xRange: [80, 140],
                        yRange: [18, 30],
                      },
                    },
                  }),
                },
              },
            })
          })
        }
      }
      if (message?.method === 'configure') {
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
                  model: message.params?.model || 'test-model',
                  siteUrl: null,
                  appName: 'WidgetVA Official Page Integration',
                },
              },
            })
          })
        }
      }
      if (message?.method === 'readConfig') {
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
                  siteUrl: null,
                  appName: 'WidgetVA Official Page Integration',
                },
              },
            })
          })
        }
      }
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
  let runAgentLoopCalls = 0

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
      root.__widgetVA = {
        async describeWorkspace() {
          return {
            widgets: [{
              ref: 'scatter-ref',
              widgetId: 'scatter',
              kind: 'scatter',
            }],
          }
        },
        async describeAgentLoop() {
          return {
            loopHints: {
              verifiedActionName: 'executeVerifiedAction',
            },
          }
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
        async runAgentLoop(options = {}) {
          runAgentLoopCalls += 1
          return { ok: true, options }
        },
      }
    },
  })

  assert.equal(installed, 1)
  assert.equal(bootstrapped, 1)
  assert.equal(entry.status, 'ready')
  assert.equal(typeof entry.manager?.readActiveController, 'function')
  assert.equal(entry.manager.readActiveController(), entry.controller)
  assert.equal(entry.pagePort, root.__widgetVA)
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
  const naturalLanguageResult = await root.__widgetVAOfficialPageRunNaturalLanguageAgentLoop({
    objective: 'Brush the visible scatter region.',
    maxTurns: 1,
  })
  assert.equal(Array.isArray(naturalLanguageResult.turns), true)
  assert.equal(naturalLanguageResult.turns.length, 1)
  assert.equal(naturalLanguageResult.turns[0]?.plan?.step?.name, 'scatter.brushRegion')
  assert.equal(naturalLanguageResult.turns[0]?.act?.ok, true)
  assert.equal(naturalLanguageResult.turns[0]?.verify?.ok, true)
  assert.equal(runAgentLoopCalls, 1)

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
  root.__widgetVA = { describeWorkspace() {} }

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
  assert.equal(root.__widgetVAOfficialPageRunAgentLoop, undefined)
  assert.equal(root.__widgetVAOfficialPageRunNaturalLanguageAgentLoop, undefined)
  assert.equal(root.__widgetVA, undefined)
})

test('ensureVegaExamplesPageBootstrap clears the managed controller when the page becomes unsupported', async () => {
  const root = createRoot()
  let disposed = 0

  const readyEntry = await ensureVegaExamplesPageBootstrap({
    root,
    isSupportedPage: () => true,
    installCapture() {},
    async bootstrapPage() {
      root.__widgetVA = { describeWorkspace() {} }
      return {
        pagePort: root.__widgetVA,
        dispose() {
          disposed += 1
        },
      }
    },
  })

  assert.equal(readyEntry.status, 'ready')
  assert.ok(readyEntry.manager.readActiveController())

  root.location.href = 'https://example.com/not-supported.html'
  root.location.pathname = '/not-supported.html'

  const unsupportedEntry = await ensureVegaExamplesPageBootstrap({
    root,
    isSupportedPage: () => false,
    installCapture() {},
    async bootstrapPage() {
      throw new Error('bootstrap should not run for unsupported pages')
    },
  })

  assert.equal(unsupportedEntry.status, 'unsupported')
  assert.equal(disposed, 1)
  assert.equal(unsupportedEntry.manager.readActiveController(), null)
  assert.equal(unsupportedEntry.controller, null)
  assert.equal(unsupportedEntry.pagePort, null)
  assert.equal(root.__widgetVAOfficialPageRunAgentLoop, undefined)
  assert.equal(root.__widgetVAOfficialPageRunNaturalLanguageAgentLoop, undefined)
  assert.equal(root.__widgetVA, undefined)
})

test('ensureVegaExamplesPageBootstrap reboots when the official example URL changes', async () => {
  const root = createRoot('https://vega.github.io/vega-lite/examples/scatter_plot.html')
  let bootstrapped = 0
  let disposed = 0
  const jumpCalls = []

  await ensureVegaExamplesPageBootstrap({
    root,
    isSupportedPage: () => true,
    installCapture() {},
    async bootstrapPage({ sessionId }) {
      bootstrapped += 1
      assert.equal(sessionId, 'official-vega-lite-scatter_plot')
      root.__widgetVA = {
        describeWorkspace() {},
        async readState() {
          return { stateId: 'main:s1' }
        },
      }
      return {
        pagePort: root.__widgetVA,
        dispose() {
          disposed += 1
        },
      }
    },
  })

  root.location.href = 'https://vega.github.io/vega-lite/examples/point_2d.html'
  root.location.pathname = '/vega-lite/examples/point_2d.html'

  await ensureVegaExamplesPageBootstrap({
    root,
    isSupportedPage: () => true,
    installCapture() {},
    async bootstrapPage({ sessionId }) {
      bootstrapped += 1
      assert.equal(sessionId, 'official-vega-lite-point_2d')
      root.__widgetVA = {
        describeWorkspace() {},
        async jumpToState(options = {}) {
          jumpCalls.push(options)
          return { ok: true, stateId: options.stateId }
        },
      }
      return {
        pagePort: root.__widgetVA,
        dispose() {},
      }
    },
  })

  assert.equal(bootstrapped, 2)
  assert.equal(disposed, 1)
  assert.deepEqual(jumpCalls, [{ stateId: 'main:s1' }])
  assert.equal(root[VEGA_EXAMPLES_BOOTSTRAP_KEY][VEGA_EXAMPLES_BOOTSTRAP_ENTRY].pageUrl, root.location.href)
})
