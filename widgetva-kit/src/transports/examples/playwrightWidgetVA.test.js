import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeWorkspaceFromPage,
  readViewFromPage,
  runActionOnPage,
  queryPerceptionOnPage,
  queryDataOnPage,
  readInteractionTraceFromPage,
  buildScatterBrushCall,
} from './playwrightWidgetVA.js'

function createMockPage(pagePort = {}) {
  return {
    evaluate(fn, arg) {
      const previousWindow = globalThis.window
      globalThis.window = { __widgetVA: pagePort }
      try {
        return Promise.resolve(fn(arg))
      } finally {
        globalThis.window = previousWindow
      }
    },
  }
}

test('playwright page helpers dispatch core page-port methods', async () => {
  const page = createMockPage({
    describeWorkspace(options = {}) {
      return { workspaceId: options.workspaceId || 'main' }
    },
    readView(options = {}) {
      return { refs: options.refs || [] }
    },
    executeAction(call) {
      return { ok: true, call }
    },
    queryPerception(call) {
      return { ok: true, call }
    },
    queryData(call) {
      return { ok: true, call }
    },
    getInteractionTrace(options = {}) {
      return [{ limit: options.limit || 0 }]
    },
  })

  assert.deepEqual(await describeWorkspaceFromPage(page, { workspaceId: 'workspace_b' }), {
    workspaceId: 'workspace_b',
  })
  assert.deepEqual(await readViewFromPage(page, { refs: ['scatter'] }), {
    refs: ['scatter'],
  })
  assert.deepEqual(await runActionOnPage(page, { name: 'scatter.brushRegion' }), {
    ok: true,
    call: { name: 'scatter.brushRegion' },
  })
  assert.deepEqual(await queryPerceptionOnPage(page, { name: 'perception.inspectSelection' }), {
    ok: true,
    call: { name: 'perception.inspectSelection' },
  })
  assert.deepEqual(await queryDataOnPage(page, { name: 'sampleRows' }), {
    ok: true,
    call: { name: 'sampleRows' },
  })
  assert.deepEqual(await readInteractionTraceFromPage(page, { limit: 5 }), [{ limit: 5 }])
})

test('buildScatterBrushCall builds the documented action payload', () => {
  assert.deepEqual(
    buildScatterBrushCall({
      callId: 'call_1',
      xField: 'Horsepower',
      yField: 'Miles_per_Gallon',
      xRange: [80, 120],
      yRange: [20, 35],
      targetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
    }),
    {
      callId: 'call_1',
      name: 'scatter.brushRegion',
      actor: 'agent',
      targetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
      params: {
        targetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
        xField: 'Horsepower',
        yField: 'Miles_per_Gallon',
        xRange: [80, 120],
        yRange: [20, 35],
      },
    },
  )
})
