import test from 'node:test'
import assert from 'node:assert/strict'

import { formatAgentRuntimeError, runOpenRouterAgentStep, summarizeObservation } from './agentRuntime.js'
import { createInitialSessionState, disposeRuntimeSession } from './runtimeBridge.js'

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
})

test('formatAgentRuntimeError serializes unknown objects instead of returning object Object', () => {
  assert.equal(
    formatAgentRuntimeError({ provider: 'openrouter', status: 429 }),
    JSON.stringify({ provider: 'openrouter', status: 429 }),
  )
})

test('summarizeObservation preserves provider-aware widget context for agent prompts', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createInitialSessionState('cars-horsepower')

  try {
    const summary = summarizeObservation(session.runtimeSessionKey)
    assert.equal(summary?.caseTitle, 'Cars Horsepower Study')
    assert.equal(Array.isArray(summary?.widgets), true)
    assert.equal(summary.widgets.length, 6)
    assert.equal(summary.widgets.every((widget) => typeof widget.provider === 'string' && widget.provider.length > 0), true)
    const scatter = summary.widgets.find((widget) => widget.widgetId === 'w_scatter_cars')
    const bar = summary.widgets.find((widget) => widget.widgetId === 'w_bar_origin')
    const parallel = summary.widgets.find((widget) => widget.widgetId === 'w_parallel_cars')
    assert.equal(scatter?.provider, 'vega-lite')
    assert.equal(bar?.provider, 'echarts')
    assert.equal(parallel?.provider, 'd3')
    assert.equal(Array.isArray(summary.availableActions), true)
    assert.equal(Array.isArray(summary.availablePerceptions), true)
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('summarizeObservation exposes a focused widget ref that can support safe agent fallbacks', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createInitialSessionState('cars-horsepower')

  try {
    const summary = summarizeObservation(session.runtimeSessionKey)
    assert.equal(typeof summary?.focusedWidgetRef, 'string')
    assert.equal(summary.focusedWidgetRef.length > 0, true)
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('runOpenRouterAgentStep returns explicit observe plan verify reason payloads for a verified widget action', async () => {
  const previousWindow = globalThis.window
  const previousFetch = globalThis.fetch
  globalThis.window = {}
  const session = createInitialSessionState('cars-horsepower')

  try {
    const observation = summarizeObservation(session.runtimeSessionKey)
    const scatterWidgetRef = observation?.widgets?.find((widget) => widget?.widgetId === 'w_scatter_cars')?.ref || null
    assert.equal(typeof scatterWidgetRef, 'string')

    globalThis.fetch = async () => ({
      ok: true,
      async json() {
        return {
          choices: [{
            message: {
              content: JSON.stringify({
                assistantMessage: 'I will brush the scatterplot to focus the horsepower and mpg window relevant to the question.',
                rationale: 'Brushing the scatterplot provides a visible local selection that can be verified immediately.',
                operation: {
                  kind: 'action',
                  name: 'scatter.brushRegion',
                  queryScope: { widgetRef: scatterWidgetRef },
                  params: {
                    xField: 'horsepower',
                    yField: 'mpg',
                    xRange: [80, 140],
                    yRange: [18, 30],
                  },
                },
              }),
            },
          }],
        }
      },
    })

    const result = await runOpenRouterAgentStep(session.runtimeSessionKey, {
      objective: 'Focus the scatterplot on the mid-horsepower, mid-mpg region.',
      model: 'test-model',
    })

    assert.equal(result?.model, 'test-model')
    assert.equal(typeof result?.observe?.observation?.caseTitle, 'string')
    assert.equal(result?.observe?.loopContext?.loopHints?.verifiedActionName, 'executeVerifiedAction')
    assert.equal(result?.plan?.operation?.name, 'scatter.brushRegion')
    assert.equal(result?.plan?.actionUsage?.actions?.[0]?.name || result?.plan?.actionUsage?.recommendedCall?.name, 'scatter.brushRegion')
    assert.equal(result?.result?.actionResult?.ok, true)
    assert.equal(result?.verificationResult?.ok, true)
    assert.equal(typeof result?.reason?.answer, 'string')
    assert.equal(result?.reason?.success, true)
    assert.equal(result?.reason?.verificationPassed, true)
    assert.equal(Array.isArray(result?.trace), true)
    assert.equal(result.trace.length > 0, true)
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
    globalThis.fetch = previousFetch
  }
})
