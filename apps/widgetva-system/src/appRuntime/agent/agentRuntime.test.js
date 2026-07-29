import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatAgentRuntimeError,
  runAgentSession,
  runAgentTurn,
  summarizeObservation,
} from './agentRuntime.js'
import { buildWidgetVAAgentKnowledge } from 'widgetva-kit'
import { buildImportedVisualizationCase } from '../imports/importedArtifactLoader.js'
import {
  createInitialSessionState,
  createFirstPartyRuntimeSessionFacade,
  disposeRuntimeSession,
  getRuntimeSession,
  readAgentMessages,
  readRuntimeTrace,
  registerWorkspaceCaseOverride,
} from '../contracts/runtimeBridge.js'

function registerImportedScatterCase(label = 'scatter') {
  const caseId = `imported-agent-scatter-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  registerWorkspaceCaseOverride(caseId, buildImportedVisualizationCase({
    caseId,
    widgetId: 'w_imported_scatter',
    scriptText: `({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "title": "Imported scatter fixture",
      "data": {
        "values": [
          { "xValue": 1, "yValue": 2, "group": "A" },
          { "xValue": 2, "yValue": 4, "group": "A" },
          { "xValue": 3, "yValue": 3, "group": "B" }
        ]
      },
      "mark": "point",
      "encoding": {
        "x": { "field": "xValue", "type": "quantitative" },
        "y": { "field": "yValue", "type": "quantitative" },
        "color": { "field": "group", "type": "nominal" }
      }
    })`,
  }))
  return caseId
}

test('formatAgentRuntimeError returns readable messages for Error instances', () => {
  assert.equal(formatAgentRuntimeError(new Error('OpenRouter quota exceeded.')), 'OpenRouter quota exceeded.')
})

test('formatAgentRuntimeError extracts string fields from structured payloads', () => {
  assert.equal(
    formatAgentRuntimeError({ error: 'Provider rejected the request.' }),
    'Provider rejected the request.',
  )
  assert.equal(
    formatAgentRuntimeError({ message: 'Model is unavailable right now.' }),
    'Model is unavailable right now.',
  )
  assert.equal(
    formatAgentRuntimeError({
      error: 'OpenRouter proxy could not reach the upstream chat endpoint.',
      detail: 'fetch failed',
    }),
    'OpenRouter proxy could not reach the upstream chat endpoint. Detail: fetch failed',
  )
})

test('formatAgentRuntimeError serializes unknown objects instead of returning object Object', () => {
  assert.equal(
    formatAgentRuntimeError({ provider: 'openrouter', status: 429 }),
    JSON.stringify({ provider: 'openrouter', status: 429 }),
  )
})

test('agent knowledge is built through the kit high-level API without per-widget system snapshots', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createInitialSessionState(registerImportedScatterCase('knowledge'))

  try {
    const knowledge = buildWidgetVAAgentKnowledge({ widgetKinds: ['scatter'] })
    assert.equal(Array.isArray(knowledge?.widgetFamilies), true)
    assert.equal(knowledge.widgetFamilies.some((family) => family?.kind === 'scatter'), true)
    assert.equal(knowledge.widgetFamilies.some((family) => family?.actions?.some((action) => action?.name === 'scatter.brushRegion')), true)
    assert.equal(knowledge.widgetFamilies.some((family) => (
      family?.perceptions?.some((query) => query?.name === 'perception.inspectViewConfig')
    )), true)
    assert.equal('widgets' in knowledge, false)
    assert.equal('catalogs' in knowledge, false)
    assert.equal('history' in knowledge, false)
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('agent knowledge is not cached on the app runtime session', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createInitialSessionState(registerImportedScatterCase('knowledge-cache'))

  try {
    const runtimeSession = getRuntimeSession(session.runtimeSessionKey)
    assert.equal('agentKnowledgeBase' in (runtimeSession || {}), false)
    const knowledge = buildWidgetVAAgentKnowledge({ widgetKinds: ['scatter'] })
    assert.equal(Array.isArray(knowledge?.widgetFamilies), true)
    assert.equal('agentKnowledgeBase' in (runtimeSession || {}), false)
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('summarizeObservation preserves provider-aware widget context for legacy prompt summaries', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createInitialSessionState(registerImportedScatterCase('summary'))

  try {
    const summary = summarizeObservation(session.runtimeSessionKey)
    assert.equal(summary?.caseTitle, 'Imported scatter fixture')
    assert.equal(Array.isArray(summary?.widgets), true)
    assert.equal(summary.widgets.length, 1)
    assert.equal(summary.widgets.every((widget) => typeof widget.provider === 'string' && widget.provider.length > 0), true)
    assert.equal(summary.widgets.every((widget) => Array.isArray(widget.recognizedKinds)), true)
    assert.equal('availableActions' in summary, false)
    assert.equal('availablePerceptions' in summary, false)
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('agent contract exposes kit-built observation with imported chart fields', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createInitialSessionState(registerImportedScatterCase('agent-observation'))

  try {
    const contract = createFirstPartyRuntimeSessionFacade(session.runtimeSessionKey).agentContract()
    assert.equal('readAgentObservation' in contract, false)
    const observation = await contract.readObservation({ query: 'What is the chart?' })
    const widget = observation?.state?.widgets?.[0] || null
    const fieldNames = (widget?.data?.fields || []).map((field) => field?.name)
    assert.deepEqual(fieldNames, ['xValue', 'yValue', 'group'])
    assert.equal(widget?.encodings?.x?.field, 'xValue')
    assert.equal(widget?.encodings?.y?.field, 'yValue')
    assert.equal(widget?.encodings?.color?.field, 'group')
    assert.equal(widget?.data?.visibleCount, 3)
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('runAgentTurn returns the formal observe plan act verify reason contract', async () => {
  const previousWindow = globalThis.window
  const previousFetch = globalThis.fetch
  globalThis.window = {}
  const session = createInitialSessionState(registerImportedScatterCase('turn'))

  try {
    const observation = summarizeObservation(session.runtimeSessionKey)
    const scatterWidgetRef = observation?.widgets?.find((widget) => widget?.widgetId === 'w_imported_scatter')?.ref || null
    assert.equal(typeof scatterWidgetRef, 'string')

    globalThis.fetch = async () => ({
      ok: true,
      async json() {
        return {
          choices: [{
            message: {
              content: JSON.stringify({
                assistantMessage: 'I will brush the scatterplot to focus the requested x/y window.',
                rationale: 'Brushing the scatterplot provides a visible local selection that can be verified immediately.',
                operation: {
                  kind: 'action',
                  name: 'scatter.brushRegion',
                  target: { widgetRef: scatterWidgetRef },
                  params: {
                    xField: 'xValue',
                    yField: 'yValue',
                    xRange: [1, 3],
                    yRange: [2, 4],
                  },
                },
              }),
            },
          }],
        }
      },
    })

    const result = await runAgentTurn(session.runtimeSessionKey, {
      objective: 'Focus the scatterplot on the middle x/y region.',
      model: 'test-model',
    })

    assert.equal(result && typeof result, 'object')
    assert.equal(result?.index, 0)
    for (const key of ['observe', 'plan', 'act', 'verify', 'reason']) {
      assert.equal(Object.prototype.hasOwnProperty.call(result, key), true)
    }
    assert.equal(result?.observe?.query, 'Focus the scatterplot on the middle x/y region.')
    assert.equal(typeof result?.observe?.view?.snapshot?.ref, 'string')
    assert.equal(result?.plan?.step?.name, 'scatter.brushRegion')
    assert.equal(result?.act?.kind, 'action')
    assert.equal(result?.act?.name, 'scatter.brushRegion')
    assert.equal(result?.act?.ok, true)
    assert.equal(Array.isArray(result?.act?.updatedRefs), true)
    assert.equal(result?.verify?.checks?.params?.ok, true)
    assert.equal(result?.verify?.checks?.visualChange?.ok, true)
    assert.equal(typeof result?.verify?.guidance, 'string')
    assert.equal(typeof result?.reason?.answer, 'string')
    assert.equal(readAgentMessages(session.runtimeSessionKey).length, 2)
    assert.equal(readRuntimeTrace(session.runtimeSessionKey).length, 1)
    assert.equal(readRuntimeTrace(session.runtimeSessionKey)[0]?.methodName, 'scatter.brushRegion')
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
    globalThis.fetch = previousFetch
  }
})

test('runAgentSession returns a compact multi-turn result and stops when a later perception turn answers the query', async () => {
  const previousWindow = globalThis.window
  const previousFetch = globalThis.fetch
  globalThis.window = {}
  const session = createInitialSessionState(registerImportedScatterCase('session'))

  try {
    const observation = summarizeObservation(session.runtimeSessionKey)
    const scatterWidgetRef = observation?.widgets?.find((widget) => widget?.widgetId === 'w_imported_scatter')?.ref || null

    let requestCount = 0
    const requestPayloads = []
    globalThis.fetch = async (_url, options = {}) => {
      const payload = JSON.parse(options?.body || '{}')
      requestPayloads.push(payload)
      const messages = Array.isArray(payload?.messages) ? payload.messages : []
      const systemPrompt = messages[0]?.content || ''
      const isReasonStage = typeof systemPrompt === 'string' && systemPrompt.includes('answer stage of a widget-based visual analytics agent')

      requestCount += 1

      return {
        ok: true,
        async json() {
          if (isReasonStage) {
            const reasonResponse = requestCount >= 4
              ? {
                answer: 'I computed the correlation inside the focused region and can now answer the query.',
                completion: {
                  status: 'answered',
                },
              }
              : {
                answer: 'I focused the scatterplot and still need one more evidence step.',
              }

            return {
              choices: [{
                message: {
                  content: JSON.stringify(reasonResponse),
                },
              }],
            }
          }

          const plannerResponse = requestCount <= 2
            ? {
              assistantMessage: 'I will brush the scatterplot to focus the target region.',
              rationale: 'The first turn should narrow the view before answering.',
              operation: {
                kind: 'action',
                name: 'scatter.brushRegion',
                target: { widgetRef: scatterWidgetRef },
                params: {
                  xField: 'xValue',
                  yField: 'yValue',
                  xRange: [1, 3],
                  yRange: [2, 4],
                },
              },
            }
            : {
              assistantMessage: 'I will compute the correlation inside the focused region.',
              rationale: 'After focusing, a perception turn can answer the query.',
              operation: {
                kind: 'perception',
                name: 'perception.computeCorrelation',
                target: { widgetRef: scatterWidgetRef },
                params: {
                  xField: 'xValue',
                  yField: 'yValue',
                },
              },
            }

          return {
            choices: [{
              message: {
                content: JSON.stringify(plannerResponse),
              },
            }],
          }
        },
      }
    }

    const result = await runAgentSession(session.runtimeSessionKey, {
      objective: 'Focus the scatterplot on the target region.',
      model: 'test-model',
      maxTurns: 3,
    })

    assert.equal(result?.ok, true)
    assert.equal(result?.stopReason, 'answered')
    assert.equal(Array.isArray(result?.turns), true)
    assert.equal(result.turns.length, 2)
    assert.equal(result.turns[0]?.act?.kind, 'action')
    assert.equal(result.turns[1]?.act?.kind, 'perception')
    assert.equal(result.turns[1]?.reason?.completion?.status, 'answered')
    assert.equal(typeof result?.answer, 'string')
    assert.equal(requestPayloads.length >= 4, true)
    for (const payload of requestPayloads) {
      assert.deepEqual(payload?.response_format, { type: 'json_object' })
    }
    assert.equal(readAgentMessages(session.runtimeSessionKey).length, 3)
    assert.equal(readRuntimeTrace(session.runtimeSessionKey).length, 2)
    assert.equal(readRuntimeTrace(session.runtimeSessionKey)[1]?.methodName, 'perception.computeCorrelation')
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
    globalThis.fetch = previousFetch
  }
})

test('runAgentSession can stream turns without recording the whole session again', async () => {
  const previousWindow = globalThis.window
  const previousFetch = globalThis.fetch
  globalThis.window = {}
  const session = createInitialSessionState(registerImportedScatterCase('streaming'))

  try {
    const observation = summarizeObservation(session.runtimeSessionKey)
    const scatterWidgetRef = observation?.widgets?.find((widget) => widget?.widgetId === 'w_imported_scatter')?.ref || null
    let requestCount = 0
    const streamedTurns = []

    globalThis.fetch = async (_url, options = {}) => {
      const payload = JSON.parse(options?.body || '{}')
      const messages = Array.isArray(payload?.messages) ? payload.messages : []
      const systemPrompt = messages[0]?.content || ''
      const isReasonStage = typeof systemPrompt === 'string' && systemPrompt.includes('answer stage of a widget-based visual analytics agent')
      requestCount += 1

      return {
        ok: true,
        async json() {
          if (isReasonStage) {
            return {
              choices: [{
                message: {
                  content: JSON.stringify({
                    answer: 'The streamed turn is complete.',
                    completion: { status: 'answered' },
                  }),
                },
              }],
            }
          }

          return {
            choices: [{
              message: {
                content: JSON.stringify({
                  assistantMessage: 'I will inspect the current scatterplot configuration.',
                  rationale: 'A perception turn is enough for this streaming smoke test.',
                  operation: {
                    kind: 'perception',
                    name: 'perception.inspectViewConfig',
                    target: { widgetRef: scatterWidgetRef },
                    params: {},
                  },
                }),
              },
            }],
          }
        },
      }
    }

    const result = await runAgentSession(session.runtimeSessionKey, {
      objective: 'Inspect the scatterplot configuration.',
      model: 'test-model',
      maxTurns: 2,
      recordTurns: false,
      onTurn: async ({ turn }) => {
        streamedTurns.push(turn)
        const runtime = createFirstPartyRuntimeSessionFacade(session.runtimeSessionKey)
        runtime.appendAgentMessage({ role: 'assistant', text: turn.reason.answer })
        runtime.appendTraceStep({
          actor: 'agent',
          kind: turn.act.kind,
          widgetTitle: 'Scatter',
          methodName: turn.act.name,
          summary: turn.reason.answer,
        })
      },
    })

    assert.equal(result?.stopReason, 'answered')
    assert.equal(streamedTurns.length, 1)
    assert.equal(requestCount, 3)
    assert.equal(readAgentMessages(session.runtimeSessionKey).length, 1)
    assert.equal(readRuntimeTrace(session.runtimeSessionKey).length, 1)
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
    globalThis.fetch = previousFetch
  }
})

test('runAgentTurn can analyze an imported single-widget workspace through the existing natural-language loop', async () => {
  const previousWindow = globalThis.window
  const previousFetch = globalThis.fetch
  globalThis.window = {}
  const importedCaseId = `imported-agent-line-${Date.now()}`
  registerWorkspaceCaseOverride(importedCaseId, buildImportedVisualizationCase({
    caseId: importedCaseId,
    scriptText: `({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "title": "Imported agent line",
      "data": {
        "values": [
          { "date": 2020, "value": 1 },
          { "date": 2021, "value": 3 },
          { "date": 2022, "value": 2 }
        ]
      },
      "mark": "line",
      "encoding": {
        "x": { "field": "date", "type": "quantitative" },
        "y": { "field": "value", "type": "quantitative" }
      }
    })`,
  }))
  const session = createInitialSessionState(importedCaseId)

  try {
    const observation = summarizeObservation(session.runtimeSessionKey)
    const widgetRef = observation?.widgets?.[0]?.ref || null
    assert.equal(typeof widgetRef, 'string')
    assert.equal(observation?.caseTitle, 'Imported agent line')
    assert.equal(observation?.widgets?.length, 1)
    assert.equal('availableActions' in observation, false)
    assert.equal('availablePerceptions' in observation, false)

    globalThis.fetch = async () => ({
      ok: true,
      async json() {
        return {
          choices: [{
            message: {
              content: JSON.stringify({
                assistantMessage: 'I will inspect the visible rows in the loaded line chart before answering.',
                rationale: 'A visible-row inspection is the smallest stable first step for a newly loaded single-widget chart.',
                operation: {
                  kind: 'perception',
                  name: 'perception.inspectVisibleRows',
                  target: { widgetRef },
                  params: { limit: 2 },
                },
              }),
            },
          }],
        }
      },
    })

    const result = await runAgentTurn(session.runtimeSessionKey, {
      objective: 'Inspect the loaded line chart and show me two visible rows.',
      model: 'test-model',
    })

    assert.equal(result?.observe?.query, 'Inspect the loaded line chart and show me two visible rows.')
    assert.equal(result?.plan?.step?.kind, 'perception')
    assert.equal(result?.plan?.step?.name, 'perception.inspectVisibleRows')
    assert.equal(result?.act?.kind, 'perception')
    assert.equal(result?.act?.name, 'perception.inspectVisibleRows')
    assert.equal(result?.act?.ok, true)
    assert.equal(typeof result?.act?.outputSummary, 'string')
    assert.equal(result.act.outputSummary.includes('visibleCount'), true)
    assert.equal(result?.verify?.ok, true)
    assert.equal(typeof result?.reason?.answer, 'string')
    assert.equal(readAgentMessages(session.runtimeSessionKey).length, 2)
    assert.equal(readRuntimeTrace(session.runtimeSessionKey).at(-1)?.methodName, 'perception.inspectVisibleRows')
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
    globalThis.fetch = previousFetch
  }
})
