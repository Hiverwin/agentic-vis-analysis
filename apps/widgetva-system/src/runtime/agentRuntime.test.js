import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildAgentSessionKnowledge,
  formatAgentRuntimeError,
  runAgentSession,
  runAgentTurn,
  summarizeObservation,
} from './agentRuntime.js'
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

test('buildAgentSessionKnowledge separates stable widget catalogs from per-turn observation', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createInitialSessionState('cars-horsepower')

  try {
    const knowledge = buildAgentSessionKnowledge(session.runtimeSessionKey)
    assert.equal(knowledge?.workspace?.caseId, 'cars-horsepower')
    assert.equal(Array.isArray(knowledge?.widgets), true)
    assert.equal(knowledge.widgets.length, 6)
    assert.equal(Array.isArray(knowledge?.catalogs?.actionsByWidgetRef?.['wl://widgetva-app/workspace/cars-horsepower/widget/w_scatter_cars']), true)
    assert.equal(typeof knowledge?.history?.turns?.length, 'number')
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('summarizeObservation preserves provider-aware widget context for legacy prompt summaries', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createInitialSessionState('cars-horsepower')

  try {
    const summary = summarizeObservation(session.runtimeSessionKey)
    assert.equal(summary?.caseTitle, 'Cars Horsepower Study')
    assert.equal(Array.isArray(summary?.widgets), true)
    assert.equal(summary.widgets.length, 6)
    assert.equal(summary.widgets.every((widget) => typeof widget.provider === 'string' && widget.provider.length > 0), true)
    assert.equal(Array.isArray(summary.availableActions), true)
    assert.equal(Array.isArray(summary.availablePerceptions), true)
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('runAgentTurn returns the formal observe plan act verify reason contract', async () => {
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

    const result = await runAgentTurn(session.runtimeSessionKey, {
      objective: 'Focus the scatterplot on the mid-horsepower, mid-mpg region.',
      model: 'test-model',
    })

    assert.equal(result && typeof result, 'object')
    assert.deepEqual(Object.keys(result), ['observe', 'plan', 'act', 'verify', 'reason'])
    assert.equal(result?.observe?.query, 'Focus the scatterplot on the mid-horsepower, mid-mpg region.')
    assert.equal(typeof result?.observe?.view?.snapshot?.ref, 'string')
    assert.equal(result?.plan?.step?.name, 'scatter.brushRegion')
    assert.equal(result?.act?.kind, 'action')
    assert.equal(result?.act?.name, 'scatter.brushRegion')
    assert.equal(result?.act?.ok, true)
    assert.equal(Array.isArray(result?.act?.updatedRefs), true)
    assert.equal(result?.verify?.checks?.params?.status, 'pass')
    assert.equal(result?.verify?.checks?.visualChange?.status, 'pass')
    assert.equal(result?.verify?.nextStepHint?.kind, 'answer')
    assert.equal(typeof result?.reason?.answer, 'string')
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
    globalThis.fetch = previousFetch
  }
})

test('runAgentSession returns a compact multi-turn result and stops when verification says answer', async () => {
  const previousWindow = globalThis.window
  const previousFetch = globalThis.fetch
  globalThis.window = {}
  const session = createInitialSessionState('cars-horsepower')

  try {
    const observation = summarizeObservation(session.runtimeSessionKey)
    const scatterWidgetRef = observation?.widgets?.find((widget) => widget?.widgetId === 'w_scatter_cars')?.ref || null

    globalThis.fetch = async () => ({
      ok: true,
      async json() {
        return {
          choices: [{
            message: {
              content: JSON.stringify({
                assistantMessage: 'I will brush the scatterplot to focus the target region.',
                rationale: 'One verified brush is enough for this query.',
                operation: {
                  kind: 'action',
                  name: 'scatter.brushRegion',
                  queryScope: { widgetRef: scatterWidgetRef },
                  params: {
                    xField: 'horsepower',
                    yField: 'mpg',
                    xRange: [90, 150],
                    yRange: [18, 30],
                  },
                },
              }),
            },
          }],
        }
      },
    })

    const result = await runAgentSession(session.runtimeSessionKey, {
      objective: 'Focus the scatterplot on the target region.',
      model: 'test-model',
      maxTurns: 3,
    })

    assert.equal(result?.ok, true)
    assert.equal(result?.stopReason, 'answered')
    assert.equal(Array.isArray(result?.turns), true)
    assert.equal(result.turns.length, 1)
    assert.equal(typeof result?.answer, 'string')
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
    globalThis.fetch = previousFetch
  }
})
