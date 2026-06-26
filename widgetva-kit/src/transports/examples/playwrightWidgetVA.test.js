import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeWorkspaceFromPage,
  readObservationFromPage,
  readViewFromPage,
  readLatestCoordinationResultFromPage,
  runActionOnPage,
  queryPerceptionOnPage,
  queryDataOnPage,
  readInteractionTraceFromPage,
  runAgentLoopOnPage,
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
    readObservation(options = {}) {
      return { kind: 'observation', options }
    },
    readLatestCoordinationResult() {
      return { verification: { status: 'verified' } }
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
  assert.deepEqual(await readObservationFromPage(page, { refs: ['scatter'] }), {
    kind: 'observation',
    options: { refs: ['scatter'] },
  })
  assert.deepEqual(await readViewFromPage(page, { refs: ['scatter'] }), {
    refs: ['scatter'],
  })
  assert.deepEqual(await readLatestCoordinationResultFromPage(page), {
    verification: { status: 'verified' },
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

test('runAgentLoopOnPage executes the formal page-port agent loop through page helpers', async () => {
  const page = createMockPage({
    describeWorkspace() {
      return {
        workspaceId: 'workspace_b',
        widgets: [
          {
            ref: 'wl://widgetva-app/workspace/main/widget/scatter',
            widgetId: 'scatter',
          },
        ],
      }
    },
    describeAgentLoop() {
      return {
        loopHints: {
          verifiedActionName: 'executeVerifiedAction',
        },
      }
    },
    readObservation() {
      return {
        state: {
          stateId: 'main:s1',
        },
      }
    },
    describeActionUsage() {
      return {
        actions: [
          {
            name: 'scatter.brushRegion',
          },
        ],
      }
    },
    executeVerifiedAction(call) {
      return {
        ok: true,
        callId: call.callId,
        actionName: call.name,
        actionResult: {
          ok: true,
          stateId: 'main:s2',
          updatedRefs: [call.queryScope.widgetRef],
        },
        verification: {
          ok: true,
        },
      }
    },
    readLatestCoordinationResult() {
      return {
        verification: {
          status: 'verified',
        },
      }
    },
  })

  const result = await runAgentLoopOnPage(page, {
    operation: {
      kind: 'action',
      name: 'scatter.brushRegion',
      queryScope: {
        widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
      },
      params: {
        xField: 'Horsepower',
        yField: 'Miles_per_Gallon',
        xRange: [80, 160],
        yRange: [18, 32],
      },
    },
  })

  assert.equal(result.result.actionResult.ok, true)
  assert.equal(result.verification.ok, true)
  assert.equal(result.latestCoordinationResult.verification.status, 'verified')
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
