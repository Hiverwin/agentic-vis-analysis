import test from 'node:test'
import assert from 'node:assert/strict'

import {
  OFFICIAL_PAGE_BOOTSTRAP_KEY,
  OFFICIAL_VEGA_LITE_PAGE_BOOTSTRAP_ENTRY,
  createOfficialVegaLitePageSessionId,
  ensureOfficialVegaLitePageBootstrap,
} from './officialVegaLitePageBootstrap.js'

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
                      target: {
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

test('createOfficialVegaLitePageSessionId derives the example slug from the official page URL', () => {
  const root = createRoot('https://vega.github.io/vega-lite/examples/point_2d.html')
  assert.equal(createOfficialVegaLitePageSessionId(root), 'official-vega-lite-point_2d')
})

test('ensureOfficialVegaLitePageBootstrap marks unsupported pages without attempting bootstrap', async () => {
  let installed = 0
  let bootstrapped = 0

  const entry = await ensureOfficialVegaLitePageBootstrap({
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

test('ensureOfficialVegaLitePageBootstrap installs capture, bootstraps once, and records the page port', async () => {
  const root = createRoot()
  let installed = 0
  let bootstrapped = 0
  let runAgentLoopCalls = 0
  const receivedPollMs = []

  const entry = await ensureOfficialVegaLitePageBootstrap({
    root,
    isSupportedPage: () => true,
    pollMs: 7,
    installCapture(receivedRoot) {
      installed += 1
      assert.equal(receivedRoot, root)
    },
    async bootstrapPage({ sessionId, enableExtensionBridge, pollMs }) {
      bootstrapped += 1
      receivedPollMs.push(pollMs)
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
              updatedRefs: [call.target?.widgetRef || call.queryScope?.widgetRef].filter(Boolean),
            },
            verification: {
              ok: true,
              summary: 'Verified.',
            },
          }
        },
        async executeAction(call) {
          return {
            ok: true,
            echoedQueryScope: call.queryScope || null,
          }
        },
        async queryPerception(call) {
          return {
            ok: true,
            queryName: call.name,
            params: call.params || {},
            queryScope: call.queryScope || null,
            summary: `${call.name} ok`,
          }
        },
        async runDataQuery(call) {
          return {
            ok: true,
            queryName: call.name,
            params: call.params || {},
            queryScope: call.queryScope || null,
            rowCount: 12,
          }
        },
        async readLatestCoordinationResult() {
          return {
            sourceRef: 'scatter-ref',
            targetRefs: ['scatter-ref'],
            effects: ['selection'],
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
  assert.deepEqual(receivedPollMs, [7])
  assert.equal(entry.status, 'ready')
  assert.equal(typeof entry.manager?.readActiveController, 'function')
  assert.equal(entry.controller, entry.manager.readActiveController())
  assert.equal(entry.pagePort, entry.manager.readActiveBinding())
  assert.equal(entry.manager.readActiveBinding(), root.__widgetVA)
  assert.equal(typeof root.__widgetVAOfficialVegaLitePage, 'object')
  const stablePage = root.__widgetVAOfficialVegaLitePage
  assert.equal(entry.api, stablePage)
  assert.equal(stablePage.readEntry(), entry)
  assert.equal(stablePage.readController(), entry.controller)
  assert.deepEqual(await stablePage.readWorkspace(), {
    widgets: [{
      ref: 'scatter-ref',
      widgetId: 'scatter',
      kind: 'scatter',
    }],
  })
  assert.deepEqual(await stablePage.readWidget(), {
    ref: 'scatter-ref',
    widgetId: 'scatter',
    kind: 'scatter',
  })
  assert.equal(await stablePage.readWidgetRef(), 'scatter-ref')
  assert.deepEqual(await stablePage.readObservation(), {
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
  })
  assert.deepEqual(await stablePage.readSelections(), {
    primary: null,
  })
  assert.equal(typeof entry.runAgentLoop, 'function')
  assert.equal(typeof entry.runNaturalLanguageAgentTurn, 'function')
  assert.equal(typeof entry.runNaturalLanguageAgentLoop, 'function')
  assert.equal(typeof entry.configureAgent, 'function')
  assert.equal(typeof entry.readAgentConfig, 'function')
  assert.equal(typeof entry.request, 'function')
  assert.equal(typeof stablePage.runNaturalLanguageAgentLoop, 'function')
  assert.equal(typeof stablePage.setPointParam, 'function')
  assert.equal(typeof stablePage.setIntervalParam, 'function')
  assert.equal(root.__widgetVAOfficialPage, undefined)
  assert.equal(root.__widgetVAOfficialPageController, undefined)
  assert.equal(root.__widgetVAOfficialPageEntry, undefined)
  assert.equal(root.__widgetVAOfficialPageReadEntry, undefined)
  assert.equal(root.__widgetVAOfficialPageReadController, undefined)
  assert.equal(root.__widgetVAOfficialPageRequest, undefined)
  assert.equal(root.__widgetVAOfficialPageRunAgentLoop, undefined)
  assert.equal(root.__widgetVAOfficialPageRunNaturalLanguageAgentTurn, undefined)
  assert.equal(root.__widgetVAOfficialPageRunNaturalLanguageAgentLoop, undefined)
  assert.deepEqual(await stablePage.executeAction({
    callId: 'page_helper_execute_action',
    name: 'scatter.brushRegion',
  }), {
    ok: true,
    echoedQueryScope: {
      widgetRef: 'scatter-ref',
    },
  })
  const verifiedAction = await stablePage.executeVerifiedAction({
    callId: 'page_helper_execute_verified',
    name: 'scatter.brushRegion',
  })
  assert.equal(verifiedAction?.actionResult?.ok, true)
  assert.deepEqual(verifiedAction?.actionResult?.updatedRefs, ['scatter-ref'])
  assert.deepEqual(await stablePage.queryPerception(
    'perception.inspectVisibleRows',
    {
      limit: 5,
    },
    {
      callId: 'page_helper_query_perception',
    },
  ), {
    ok: true,
    queryName: 'perception.inspectVisibleRows',
    params: {
      limit: 5,
    },
    queryScope: {
      widgetRef: 'scatter-ref',
    },
    summary: 'perception.inspectVisibleRows ok',
  })
  assert.deepEqual(await stablePage.runDataQuery(
    'data.visible.sampleRows',
    {
      limit: 3,
    },
    {
      callId: 'page_helper_run_data_query',
    },
  ), {
    ok: true,
    queryName: 'data.visible.sampleRows',
    params: {
      limit: 3,
    },
    queryScope: {
      widgetRef: 'scatter-ref',
    },
    rowCount: 12,
  })
  assert.deepEqual(await stablePage.readLatestCoordinationResult(), {
    sourceRef: 'scatter-ref',
    targetRefs: ['scatter-ref'],
    effects: ['selection'],
  })
  assert.deepEqual(await stablePage.runAction(
    'scatter.brushRegion',
    {
      xField: 'Horsepower',
      xRange: [80, 140],
    },
    {
      callId: 'page_helper_run_action',
    },
  ), {
    ok: true,
    echoedQueryScope: {
      widgetRef: 'scatter-ref',
    },
  })
  const verifiedRunAction = await stablePage.runVerifiedAction(
    'scatter.brushRegion',
    {
      xField: 'Horsepower',
      xRange: [80, 140],
    },
    {
      callId: 'page_helper_run_verified_action',
    },
  )
  assert.equal(verifiedRunAction?.actionResult?.ok, true)
  assert.deepEqual(verifiedRunAction?.actionResult?.updatedRefs, ['scatter-ref'])
  const helperNaturalLanguageTurn = await stablePage.runObjective('Brush the visible scatter region.')
  assert.equal(helperNaturalLanguageTurn.plan?.step?.name, 'scatter.brushRegion')
  assert.equal(helperNaturalLanguageTurn.act?.ok, true)
  const helperNaturalLanguageLoop = await stablePage.runObjectiveLoop({
    objective: 'Brush the visible scatter region.',
    maxTurns: 1,
  })
  assert.equal(Array.isArray(helperNaturalLanguageLoop.turns), true)
  assert.equal(helperNaturalLanguageLoop.turns[0]?.plan?.step?.name, 'scatter.brushRegion')
  const helperPointParam = await stablePage.setPointParam({
    callId: 'page_helper_point_param',
    paramName: 'click',
    field: 'weather',
    values: ['sun'],
  })
  assert.equal(helperPointParam?.actionResult?.ok, true)
  assert.deepEqual(helperPointParam?.actionResult?.updatedRefs, ['scatter-ref'])
  const stableHelperPointParam = await stablePage.setPointParam({
    callId: 'stable_page_helper_point_param',
    paramName: 'click',
    field: 'weather',
    values: ['fog'],
  })
  assert.equal(stableHelperPointParam?.actionResult?.ok, true)
  assert.deepEqual(stableHelperPointParam?.actionResult?.updatedRefs, ['scatter-ref'])
  const helperIntervalParam = await stablePage.setIntervalParam({
    callId: 'page_helper_interval_param',
    paramName: 'brush',
    xField: 'date',
    xRange: ['2012-03-01', '2012-05-31'],
  })
  assert.equal(helperIntervalParam?.actionResult?.ok, true)
  assert.deepEqual(helperIntervalParam?.actionResult?.updatedRefs, ['scatter-ref'])
  const helperClearParam = await stablePage.clearParam({
    callId: 'page_helper_clear_param',
    paramName: 'brush',
  })
  assert.equal(helperClearParam?.actionResult?.ok, true)
  assert.deepEqual(helperClearParam?.actionResult?.updatedRefs, ['scatter-ref'])
  const helperClearSelection = await stablePage.clearSelection({
    callId: 'page_helper_clear_selection',
  })
  assert.equal(helperClearSelection?.actionResult?.ok, true)
  assert.deepEqual(helperClearSelection?.actionResult?.updatedRefs, ['scatter-ref'])
  assert.deepEqual(await stablePage.inspectVisibleRows(
    { limit: 2 },
    { callId: 'page_helper_inspect_visible_rows' },
  ), {
    ok: true,
    queryName: 'perception.inspectVisibleRows',
    params: {
      limit: 2,
    },
    queryScope: {
      widgetRef: 'scatter-ref',
    },
    summary: 'perception.inspectVisibleRows ok',
  })
  assert.deepEqual(await stablePage.summarizeVisible(
    { maxGroups: 3 },
    { callId: 'page_helper_summarize_visible' },
  ), {
    ok: true,
    queryName: 'perception.summarizeVisible',
    params: {
      maxGroups: 3,
    },
    queryScope: {
      widgetRef: 'scatter-ref',
    },
    summary: 'perception.summarizeVisible ok',
  })
  assert.deepEqual(await stablePage.inspectSelection(
    {},
    { callId: 'page_helper_inspect_selection' },
  ), {
    ok: true,
    queryName: 'perception.inspectSelection',
    params: {},
    queryScope: {
      widgetRef: 'scatter-ref',
    },
    summary: 'perception.inspectSelection ok',
  })
  assert.deepEqual(await stablePage.summarizeSelection(
    {},
    { callId: 'page_helper_summarize_selection' },
  ), {
    ok: true,
    queryName: 'perception.summarizeSelection',
    params: {},
    queryScope: {
      widgetRef: 'scatter-ref',
    },
    summary: 'perception.summarizeSelection ok',
  })
  assert.deepEqual(await stablePage.runAgentLoop({ objective: 'test' }), {
    ok: true,
    options: { objective: 'test' },
  })
  assert.deepEqual(await stablePage.configureAgent({ apiKey: 'test-key', model: 'test-model' }), {
    apiKeyConfigured: true,
    model: 'test-model',
    siteUrl: null,
    appName: 'WidgetVA Official Page Integration',
  })
  assert.deepEqual(await stablePage.readAgentConfig(), {
    apiKeyConfigured: true,
    model: 'test-model',
    siteUrl: null,
    appName: 'WidgetVA Official Page Integration',
  })
  const naturalLanguageTurn = await stablePage.runNaturalLanguageAgentTurn('Brush the visible scatter region.')
  assert.equal(naturalLanguageTurn.plan?.step?.name, 'scatter.brushRegion')
  assert.equal(naturalLanguageTurn.act?.ok, true)
  assert.equal(naturalLanguageTurn.verify?.ok, true)
  const naturalLanguageResult = await stablePage.runNaturalLanguageAgentLoop({
    objective: 'Brush the visible scatter region.',
    maxTurns: 1,
  })
  assert.equal(Array.isArray(naturalLanguageResult.turns), true)
  assert.equal(naturalLanguageResult.turns.length, 1)
  assert.equal(naturalLanguageResult.turns[0]?.plan?.step?.name, 'scatter.brushRegion')
  assert.equal(naturalLanguageResult.turns[0]?.act?.ok, true)
  assert.equal(naturalLanguageResult.turns[0]?.verify?.ok, true)
  const requestResult = await stablePage.request({
    mode: 'runNaturalLanguageLoop',
    options: {
      objective: 'Brush the visible scatter region.',
      maxTurns: 1,
    },
  })
  assert.equal(Array.isArray(requestResult.turns), true)
  assert.equal(requestResult.turns[0]?.plan?.step?.name, 'scatter.brushRegion')
  assert.equal(runAgentLoopCalls, 1)

  const again = await ensureOfficialVegaLitePageBootstrap({
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

  assert.equal(installed, 1)
  assert.equal(bootstrapped, 1)
  assert.equal(again, entry)
})

test('ensureOfficialVegaLitePageBootstrap runs natural-language custom multi-view requests through recognized bar capabilities', async () => {
  const listeners = new Set()
  const executedCalls = []
  const root = {
    location: {
      href: 'https://vega.github.io/vega-lite/examples/interactive_seattle_weather.html',
      pathname: '/vega-lite/examples/interactive_seattle_weather.html',
    },
    addEventListener(type, listener) {
      if (type === 'message') listeners.add(listener)
    },
    removeEventListener(type, listener) {
      if (type === 'message') listeners.delete(listener)
    },
    postMessage(message) {
      if (message?.method !== 'chat') return
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
                  assistantMessage: 'I will keep only the sunny days by selecting the sun bar.',
                  rationale: 'The custom multi-view exposes recognized bar semantics, so category selection is the clearest filter action.',
                  operation: {
                    kind: 'action',
                    name: 'bar.selectCategory',
                    target: {
                      widgetRef: 'custom-weather-ref',
                    },
                    params: {
                      field: 'weather',
                      values: ['sun'],
                    },
                  },
                }),
              },
            },
          })
        })
      }
    },
  }

  await ensureOfficialVegaLitePageBootstrap({
    root,
    isSupportedPage: () => true,
    installCapture() {},
    async bootstrapPage() {
      root.__widgetVA = {
        async describeWorkspace() {
          return {
            widgets: [{
              ref: 'custom-weather-ref',
              widgetId: 'session_interactive_seattle_weather',
              kind: 'custom',
              recognizedKinds: ['scatter', 'bar'],
              title: 'Seattle Weather, 2012-2015',
            }],
            actions: [
              { name: 'scatter.zoomDomain', targetRef: 'custom-weather-ref' },
              { name: 'bar.selectCategory', targetRef: 'custom-weather-ref' },
            ],
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
              focusedWidgetRef: 'custom-weather-ref',
              filters: {},
              viewport: null,
              selections: { primary: null },
              highlight: { activeWidgetRefs: [] },
              comparisonTargets: [],
              annotations: [],
            },
          }
        },
        async describeActionUsage(call) {
          return {
            actions: [{ name: call?.name || 'bar.selectCategory' }],
          }
        },
        async executeVerifiedAction(call) {
          executedCalls.push(call)
          return {
            actionResult: {
              ok: true,
              stateId: 'main:s2',
              updatedRefs: [call.target?.widgetRef || call.queryScope?.widgetRef].filter(Boolean),
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
      }
    },
  })

  const result = await root.__widgetVAOfficialVegaLitePage.runNaturalLanguageAgentTurn({
    objective: 'Only keep the sunny days in this multi-view weather chart.',
  })

  assert.equal(result?.plan?.step?.name, 'bar.selectCategory')
  assert.equal(result?.act?.ok, true)
  assert.equal(result?.verify?.ok, true)
  assert.equal(executedCalls.length, 1)
  assert.equal(executedCalls[0]?.name, 'bar.selectCategory')
  assert.deepEqual(executedCalls[0]?.params?.values, ['sun'])
})

test('ensureOfficialVegaLitePageBootstrap keeps the official natural-language loop running until a later perception turn answers', async () => {
  const root = createRoot('https://vega.github.io/vega-lite/examples/point_2d.html')
  let plannerCalls = 0

  root.postMessage = function postMessage(message) {
    this.postedMessages.push(message)

    if (message?.method === 'chat') {
      const rawMessages = Array.isArray(message.params?.messages) ? message.params.messages : []
      const systemPrompt = rawMessages[0]?.content || ''
      const isReasonStage = typeof systemPrompt === 'string'
        && systemPrompt.includes('answer stage of a widget-based visual analytics agent')

      const result = isReasonStage
        ? (
            plannerCalls >= 2
              ? {
                  model: 'test-model',
                  content: JSON.stringify({
                    answer: 'The focused region shows the correlation evidence needed to answer the query.',
                    completion: {
                      status: 'answered',
                    },
                  }),
                }
              : {
                  model: 'test-model',
                  content: JSON.stringify({
                    answer: 'The local region is focused; I still need one read step before answering.',
                  }),
                }
          )
        : (
            plannerCalls += 1,
            plannerCalls === 1
              ? {
                  model: 'test-model',
                  content: JSON.stringify({
                    assistantMessage: 'I will brush the local region first.',
                    rationale: 'A state-changing focus step should precede the evidence read.',
                    operation: {
                      kind: 'action',
                      name: 'scatter.brushRegion',
                      target: {
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
                }
              : {
                  model: 'test-model',
                  content: JSON.stringify({
                    assistantMessage: 'I will compute the correlation inside the focused region.',
                    rationale: 'Now that the region is focused, a perception step can answer the query.',
                    operation: {
                      kind: 'perception',
                      name: 'perception.computeCorrelation',
                      target: {
                        widgetRef: 'scatter-ref',
                      },
                      params: {
                        xField: 'Horsepower',
                        yField: 'Miles_per_Gallon',
                      },
                    },
                  }),
                }
          )

      for (const listener of this.__widgetVATestListeners || []) {
        queueMicrotask(() => {
          listener({
            source: this,
            data: {
              source: 'widgetva-official-page-agent-content',
              type: 'widgetva:official-page-agent-response',
              id: message.id,
              ok: true,
              result,
            },
          })
        })
      }
      return
    }

    if (message?.method === 'configure' || message?.method === 'readConfig') {
      const result = {
        apiKeyConfigured: true,
        model: message.params?.model || 'test-model',
        siteUrl: null,
        appName: 'WidgetVA Official Page Integration',
      }

      for (const listener of this.__widgetVATestListeners || []) {
        queueMicrotask(() => {
          listener({
            source: this,
            data: {
              source: 'widgetva-official-page-agent-content',
              type: 'widgetva:official-page-agent-response',
              id: message.id,
              ok: true,
              result,
            },
          })
        })
      }
    }
  }

  const listeners = new Set()
  root.addEventListener = function addEventListener(type, listener) {
    if (type !== 'message') return
    listeners.add(listener)
    this.__widgetVATestListeners = listeners
  }
  root.removeEventListener = function removeEventListener(type, listener) {
    if (type !== 'message') return
    listeners.delete(listener)
    this.__widgetVATestListeners = listeners
  }

  await ensureOfficialVegaLitePageBootstrap({
    root,
    isSupportedPage: () => true,
    installCapture() {},
    async bootstrapPage() {
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
            workspace: {
              workspaceId: 'official-vega-lite-point_2d',
            },
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
              updatedRefs: [call.target?.widgetRef || call.queryScope?.widgetRef].filter(Boolean),
            },
            verification: {
              ok: true,
              summary: 'Verified the focused region.',
            },
          }
        },
        async queryPerception(call) {
          return {
            ok: true,
            queryName: call.name,
            summary: 'Correlation inside the focused region is -0.72.',
          }
        },
      }

      return {
        pagePort: root.__widgetVA,
        async runAgentLoop(options = {}) {
          return { ok: true, options }
        },
      }
    },
  })

  const result = await root.__widgetVAOfficialVegaLitePage.runNaturalLanguageAgentLoop({
    objective: 'Find a local pattern, verify it, then answer.',
    maxTurns: 3,
  })

  assert.equal(result?.ok, true)
  assert.equal(result?.stopReason, 'answered')
  assert.equal(Array.isArray(result?.turns), true)
  assert.equal(result.turns.length, 2)
  assert.equal(result.turns[0]?.plan?.step?.name, 'scatter.brushRegion')
  assert.equal(result.turns[1]?.plan?.step?.name, 'perception.computeCorrelation')
  assert.equal(result.turns[1]?.reason?.completion?.status, 'answered')
})

test('ensureOfficialVegaLitePageBootstrap force-reattaches and retries the natural-language request after a recoverable bridge failure', async () => {
  const listeners = new Set()
  let chatAttempts = 0
  const forceReattachCalls = []
  const root = {
    location: {
      href: 'https://vega.github.io/vega-lite/examples/scatter_plot.html',
      pathname: '/vega-lite/examples/scatter_plot.html',
    },
    addEventListener(type, listener) {
      if (type === 'message') listeners.add(listener)
    },
    removeEventListener(type, listener) {
      if (type === 'message') listeners.delete(listener)
    },
    postMessage(message) {
      if (message?.method !== 'chat') return
      chatAttempts += 1
      for (const listener of listeners) {
        queueMicrotask(() => {
          listener({
            source: this,
            data: chatAttempts <= 2
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
                    content: JSON.stringify({
                      assistantMessage: 'I will brush the visible scatter region.',
                      rationale: 'Retrying after reattachment should still complete the action.',
                      operation: {
                        kind: 'action',
                        name: 'scatter.brushRegion',
                        target: {
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
    },
  }

  let bootstrapped = 0
  let disposed = 0

  await ensureOfficialVegaLitePageBootstrap({
    root,
    isSupportedPage: () => true,
    installCapture() {},
    async bootstrapPage({ forceReattach = false } = {}) {
      forceReattachCalls.push(forceReattach)
      bootstrapped += 1
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
              stateId: `main:s${bootstrapped}`,
            },
            sharedAnalyticalState: {
              focusedWidgetRef: 'scatter-ref',
              filters: {},
              viewport: null,
              selections: { primary: null },
              highlight: { activeWidgetRefs: [] },
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
              stateId: `main:s${bootstrapped + 1}`,
              updatedRefs: [call.target?.widgetRef || call.queryScope?.widgetRef].filter(Boolean),
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
          return { ok: true, options }
        },
        dispose() {
          disposed += 1
        },
      }
    },
  })

  const result = await root.__widgetVAOfficialVegaLitePage.runNaturalLanguageAgentTurn({
    objective: 'Brush the visible scatter region.',
  })

  assert.equal(result?.act?.ok, true)
  assert.equal(result?.verify?.ok, true)
  assert.equal(chatAttempts, 4)
  assert.equal(bootstrapped, 2)
  assert.equal(disposed, 1)
  assert.deepEqual(forceReattachCalls, [false, true])
})

test('ensureOfficialVegaLitePageBootstrap force-reattaches and retries the natural-language request after a recoverable runtime/pagePort failure', async () => {
  const listeners = new Set()
  let chatAttempts = 0
  let bootstrapped = 0
  let disposed = 0
  const forceReattachCalls = []
  const root = {
    location: {
      href: 'https://vega.github.io/vega-lite/examples/scatter_plot.html',
      pathname: '/vega-lite/examples/scatter_plot.html',
    },
    addEventListener(type, listener) {
      if (type === 'message') listeners.add(listener)
    },
    removeEventListener(type, listener) {
      if (type === 'message') listeners.delete(listener)
    },
    postMessage(message) {
      if (message?.method !== 'chat') return
      chatAttempts += 1
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
                  rationale: 'The request should survive runtime replacement and continue on the reattached controller.',
                  operation: {
                    kind: 'action',
                    name: 'scatter.brushRegion',
                    target: {
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
    },
  }

  await ensureOfficialVegaLitePageBootstrap({
    root,
    isSupportedPage: () => true,
    installCapture() {},
    async bootstrapPage({ forceReattach = false } = {}) {
      forceReattachCalls.push(forceReattach)
      bootstrapped += 1
      root.__widgetVA = {
        async describeWorkspace() {
          if (bootstrapped === 1) {
            throw new Error('WidgetVA official page runtime is not ready.')
          }
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
              stateId: `main:s${bootstrapped}`,
            },
            sharedAnalyticalState: {
              focusedWidgetRef: 'scatter-ref',
              filters: {},
              viewport: null,
              selections: { primary: null },
              highlight: { activeWidgetRefs: [] },
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
              stateId: `main:s${bootstrapped + 1}`,
              updatedRefs: [call.target?.widgetRef || call.queryScope?.widgetRef].filter(Boolean),
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
          return { ok: true, options }
        },
        dispose() {
          disposed += 1
        },
      }
    },
  })

  const result = await root.__widgetVAOfficialVegaLitePage.runNaturalLanguageAgentTurn({
    objective: 'Brush the visible scatter region.',
  })

  assert.equal(result?.act?.ok, true)
  assert.equal(result?.verify?.ok, true)
  assert.equal(chatAttempts, 2)
  assert.equal(bootstrapped, 2)
  assert.equal(disposed, 1)
  assert.deepEqual(forceReattachCalls, [false, true])
})

test('ensureOfficialVegaLitePageBootstrap records bootstrap failures on the shared page state', async () => {
  const root = createRoot()
  root.__widgetVA = { describeWorkspace() {} }

  await assert.rejects(
    ensureOfficialVegaLitePageBootstrap({
      root,
      isSupportedPage: () => true,
      installCapture() {},
      async bootstrapPage() {
        throw new Error('capture timed out')
      },
    }),
    /capture timed out/,
  )

  const entry = root[OFFICIAL_PAGE_BOOTSTRAP_KEY][OFFICIAL_VEGA_LITE_PAGE_BOOTSTRAP_ENTRY]
  assert.equal(entry.status, 'error')
  assert.equal(entry.error?.message, 'capture timed out')
  assert.equal(entry.api, null)
  assert.equal(root.__widgetVAOfficialPage, undefined)
  assert.equal(root.__widgetVAOfficialPageRunAgentLoop, undefined)
  assert.equal(root.__widgetVAOfficialPageRunNaturalLanguageAgentLoop, undefined)
  assert.equal(root.__widgetVAOfficialPageRequest, undefined)
  assert.equal(root.__widgetVAOfficialVegaLitePage, undefined)
  assert.equal(root.__widgetVA, undefined)
})

test('ensureOfficialVegaLitePageBootstrap clears the managed controller when the page becomes unsupported', async () => {
  const root = createRoot()
  let disposed = 0

  const readyEntry = await ensureOfficialVegaLitePageBootstrap({
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

  const unsupportedEntry = await ensureOfficialVegaLitePageBootstrap({
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
  assert.equal(unsupportedEntry.api, null)
  assert.equal(root.__widgetVAOfficialPage, undefined)
  assert.equal(root.__widgetVAOfficialPageRunAgentLoop, undefined)
  assert.equal(root.__widgetVAOfficialPageRunNaturalLanguageAgentLoop, undefined)
  assert.equal(root.__widgetVAOfficialPageRequest, undefined)
  assert.equal(root.__widgetVAOfficialVegaLitePage, undefined)
  assert.equal(root.__widgetVA, undefined)
})

test('ensureOfficialVegaLitePageBootstrap reboots when the official example URL changes', async () => {
  const root = createRoot('https://vega.github.io/vega-lite/examples/scatter_plot.html')
  let bootstrapped = 0
  let disposed = 0
  const jumpCalls = []

  await ensureOfficialVegaLitePageBootstrap({
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

  await ensureOfficialVegaLitePageBootstrap({
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
  assert.equal(root[OFFICIAL_PAGE_BOOTSTRAP_KEY][OFFICIAL_VEGA_LITE_PAGE_BOOTSTRAP_ENTRY].pageUrl, root.location.href)
})
