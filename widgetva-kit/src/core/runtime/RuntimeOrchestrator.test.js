import test from 'node:test'
import assert from 'node:assert/strict'

import { createWidgetVARuntime } from './RuntimeOrchestrator.js'

function buildScatterSpec() {
  return {
    data: {
      values: [
        { x: 1, y: 2, category: 'a' },
        { x: 2, y: 3, category: 'b' },
      ],
    },
    mark: 'point',
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      color: { field: 'category', type: 'nominal' },
    },
  }
}

test('createWidgetVARuntime exposes the runtime execution contract without agent loop methods', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const spec = buildScatterSpec()
  const dataQueryCalls = []

  const runtime = createWidgetVARuntime({
    dataQueryEngine: {
      listSupportedQueryKinds() {
        return ['summary']
      },
      query(dataRef, query) {
        dataQueryCalls.push({ dataRef, query })
        return {
          rows: [{ count: 2 }],
        }
      },
    },
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'runtime-contract-session',
      readBaselineSpec: () => spec,
      readCurrentSpec: () => spec,
      readWorkspaceSpec: () => null,
      readPlanningRequest: () => null,
      readRunMode: () => 'goal_oriented',
      readUserIntent: () => '',
      readCurrentSelection: () => null,
      readCurrentSelections: () => ({}),
      readFocusedWidgetRef: () => null,
    },
  })

  runtime.perceptionExecutor.register(
    {
      name: 'perception.inspectFocusedWidget',
      category: 'inspect',
      sideEffectFree: true,
      paramsSchema: { type: 'object', properties: {} },
    },
    async (_params, ctx) => ({
      result: {
        widgetRef: ctx.readFocusedWidgetRef() || null,
      },
    }),
  )

  try {
    const description = runtime.describeWorkspace()
    const initialState = runtime.readState()
    const view = runtime.readView()
    const widgetRef = description.widgets[0]?.ref

    assert.equal(typeof runtime.executeAction, 'function')
    assert.equal(typeof runtime.executeVerifiedAction, 'function')
    assert.equal(typeof runtime.describeWorkspace, 'function')
    assert.equal(typeof runtime.readState, 'function')
    assert.equal(typeof runtime.readView, 'function')
    assert.equal(typeof runtime.readWidgetRenderPayload, 'function')
    assert.equal(typeof runtime.queryPerception, 'function')
    assert.equal(typeof runtime.registerWidgetFamily, 'function')
    assert.equal(typeof runtime.runDataQuery, 'function')
    assert.equal(typeof runtime.queryData, 'function')
    assert.equal(typeof runtime.readTrace, 'function')
    assert.equal('readObservation' in runtime, false)
    assert.equal('readAgentObservation' in runtime, false)
    assert.equal('readCoordinationState' in runtime, false)
    assert.equal('readPropagationSummary' in runtime, false)
    assert.equal('readLatestCoordinationResult' in runtime, false)
    assert.equal('listAvailableActions' in runtime, false)
    assert.equal('listAvailablePerceptions' in runtime, false)
    assert.equal(typeof runtime.runtimeManager?.describeRuntimeManager, 'function')
    assert.equal(typeof runtime.describeRuntimeManager, 'function')
    assert.equal(typeof runtime.readRecoverableState, 'function')
    assert.equal('agentLoopRuntime' in runtime, false)
    assert.equal('runAgentTurn' in runtime, false)
    assert.equal('runAgentSession' in runtime, false)
    assert.equal(runtime.runtimeManager?.readActiveRuntime?.(), runtime)
    assert.equal(description.workspaceId, 'runtime-contract-session')
    assert.equal(initialState.stateId, view.stateId)
    assert.equal(runtime.readRecoverableState()?.stateId, initialState.stateId)

    const actionDescriptors = Array.isArray(description.actions) ? description.actions : []
    const actionDescriptorNames = actionDescriptors.map((entry) => entry?.name)
    const perceptionDescriptorNames = (Array.isArray(description.perceptionQueries) ? description.perceptionQueries : [])
      .map((entry) => entry?.name)
    const brushDescriptor = description.actions.find((entry) => entry?.name === 'scatter.brushRegion') || null

    assert.equal(actionDescriptorNames.includes('workspace.focusWidget'), true)
    assert.equal(Array.isArray(perceptionDescriptorNames), true)
    assert.equal('analyticalPlacement' in brushDescriptor, false)
    assert.equal('sharedAnalyticalSurface' in brushDescriptor, false)

    const actionResult = await runtime.executeAction({
      callId: 'focus_runtime_widget',
      actor: 'agent',
      name: 'workspace.focusWidget',
      params: {
        targetRef: widgetRef,
      },
    })
    assert.equal(actionResult?.ok, true)
    assert.equal(runtime.readRecoverableState()?.stateId, runtime.readState()?.stateId)

    const verifiedActionResult = await runtime.executeVerifiedAction({
      callId: 'verified_focus_runtime_widget',
      actor: 'agent',
      name: 'workspace.focusWidget',
      params: {
        targetRef: widgetRef,
      },
    })
    assert.equal(verifiedActionResult?.ok, true)
    assert.equal(verifiedActionResult?.actionResult?.ok, true)
    assert.equal(verifiedActionResult?.verification?.ok, true)

    const perceptionResult = await runtime.queryPerception({
      callId: 'inspect_runtime_focus',
      actor: 'agent',
      name: 'perception.inspectFocusedWidget',
      params: {},
    })
    assert.equal(perceptionResult?.ok, true)
    assert.deepEqual(perceptionResult?.result, {
      widgetRef,
    })

    const dataRef = description.dataHandles[0]?.ref
    const dataResult = await runtime.runDataQuery({
      callId: 'runtime_data_query',
      actor: 'agent',
      dataRef,
      query: {
        kind: 'summary',
        spec: {},
      },
    })
    assert.equal(dataResult?.ok, true)
    assert.deepEqual(dataQueryCalls[0], {
      dataRef,
      query: {
        kind: 'summary',
        spec: {},
      },
    })

    const updatedState = runtime.readState()
    const trace = runtime.readTrace({ limit: 10 })
    assert.equal(updatedState?.shared?.focusedWidget, widgetRef)
    assert.equal(Array.isArray(trace), true)
    assert.equal(trace.some((entry) => entry?.eventKind === 'action'), true)

    const replayResult = await runtime.replay(initialState.stateId)
    assert.equal(replayResult?.ok, true)
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})

test('createWidgetVARuntime exposes provider render payloads from canonical runtime state', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const spec = buildScatterSpec()

  const runtime = createWidgetVARuntime({
    registerDefaultWidgetFamilies: true,
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'runtime-render-payload-session',
      readBaselineSpec: () => spec,
      readCurrentSpec: () => spec,
      readWorkspaceSpec: () => null,
      readPlanningRequest: () => null,
      readRunMode: () => 'goal_oriented',
      readUserIntent: () => '',
      readCurrentSelection: () => null,
      readCurrentSelections: () => ({}),
      readFocusedWidgetRef: () => null,
    },
  })

  try {
    const widget = runtime.describeWorkspace().widgets[0]
    const actionResult = await runtime.executeAction({
      callId: 'filter_runtime_render_payload',
      actor: 'agent',
      name: 'scatter.filterCategorical',
      target: { widgetRef: widget.ref },
      params: {
        field: 'category',
        categoriesToRemove: ['b'],
      },
    })
    const payload = runtime.readWidgetRenderPayload(widget.widgetId)

    assert.equal(actionResult.ok, true)
    assert.equal(payload.provider, 'vega-lite')
    assert.deepEqual(payload.providerSpec.spec.transform, [{
      filter: { not: { field: 'category', oneOf: ['b'] } },
      _widgetvaTag: 'scatter.filterCategorical',
    }])
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})

test('createWidgetVARuntime registers external widget family actions and perceptions without exposing executor construction', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const spec = buildScatterSpec()

  const runtime = createWidgetVARuntime({
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'extension-family-session',
      readBaselineSpec: () => spec,
      readCurrentSpec: () => spec,
      readWorkspaceSpec: () => null,
      readPlanningRequest: () => null,
      readRunMode: () => 'goal_oriented',
      readUserIntent: () => '',
      readCurrentSelection: () => null,
      readCurrentSelections: () => ({}),
      readFocusedWidgetRef: () => null,
    },
    widgetFamilies: [
      {
        kind: 'scatter',
        actions: [
          {
            descriptor: {
              name: 'scatter.markReviewed',
              title: 'Mark scatter reviewed',
              primitive: 'annotate',
              category: 'annotation',
              supportedWidgetKinds: ['scatter'],
              affectedStatePaths: ['feedback.reviewed'],
              paramsSchema: {
                type: 'object',
                properties: {
                  note: { type: 'string' },
                },
              },
            },
            handler: async (params, ctx) => {
              const targetWidget = ctx.targetWidget({ kind: 'scatter' })
              return {
                patch: {
                  [targetWidget.ref]: {
                    feedback: {
                      reviewed: true,
                      reviewNote: params.note || '',
                    },
                  },
                },
                affectedRefs: [targetWidget.ref],
              }
            },
          },
        ],
        perceptions: [
          {
            descriptor: {
              name: 'scatter.inspectReview',
              title: 'Inspect scatter review',
              category: 'inspect',
              supportedWidgetKinds: ['scatter'],
              sideEffectFree: true,
            },
            handler: async (_params, ctx) => {
              const targetWidget = ctx.requireTargetWidget({ kind: 'scatter' })
              return {
                result: {
                  reviewed: targetWidget.feedback?.reviewed === true,
                  note: targetWidget.feedback?.reviewNote || '',
                },
              }
            },
          },
        ],
      },
    ],
  })

  try {
    const widgetRef = runtime.describeWorkspace().widgets[0]?.ref
    const description = runtime.describeWorkspace()
    assert.equal(description.actions.some((action) => action?.name === 'scatter.markReviewed'), true)
    assert.equal(description.perceptionQueries.some((query) => query?.name === 'scatter.inspectReview'), true)

    const actionResult = await runtime.executeAction({
      callId: 'mark_reviewed',
      actor: 'agent',
      name: 'scatter.markReviewed',
      target: { widgetRef },
      params: { note: 'looks good' },
    })
    assert.equal(actionResult.ok, true)
    assert.equal(runtime.readState().widgets[widgetRef].feedback.reviewed, true)

    const perceptionResult = await runtime.queryPerception({
      callId: 'inspect_review',
      actor: 'agent',
      name: 'scatter.inspectReview',
      target: { widgetRef },
      params: {},
    })
    assert.equal(perceptionResult.ok, true)
    assert.deepEqual(perceptionResult.result, {
      reviewed: true,
      note: 'looks good',
    })
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})
