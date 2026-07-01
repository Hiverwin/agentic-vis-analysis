import test from 'node:test'
import assert from 'node:assert/strict'

import { createWidgetVARuntime } from './createWidgetRuntime.js'

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

test('createWidgetVARuntime exposes the minimal multi-turn agent-facing contract', async () => {
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
      readWorkspaceAnnotations: () => [],
    },
  })

  runtime.perceptionQueryRegistry.register(
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
    assert.equal(typeof runtime.queryPerception, 'function')
    assert.equal(typeof runtime.runDataQuery, 'function')
    assert.equal(typeof runtime.readTrace, 'function')
    assert.equal(typeof runtime.readObservation, 'function')
    assert.equal(typeof runtime.readCoordinationState, 'function')
    assert.equal(typeof runtime.readPropagationSummary, 'function')
    assert.equal(typeof runtime.readLatestCoordinationResult, 'function')
    assert.equal(typeof runtime.listAvailableActions, 'function')
    assert.equal(typeof runtime.listAvailablePerceptions, 'function')
    assert.equal(typeof runtime.runtimeManager?.describeRuntimeManager, 'function')
    assert.equal(typeof runtime.describeRuntimeManager, 'function')
    assert.equal(typeof runtime.readRecoverableState, 'function')
    assert.equal(typeof runtime.runAgentTurn, 'function')
    assert.equal(typeof runtime.runAgentSession, 'function')
    assert.equal(description.workspaceId, 'runtime-contract-session')
    assert.equal(initialState.stateId, view.stateId)
    assert.equal(runtime.readRecoverableState()?.stateId, initialState.stateId)

    const coordinationState = runtime.readCoordinationState()
    const observation = runtime.readObservation()
    const propagationSummary = runtime.readPropagationSummary()
    const latestCoordinationResult = runtime.readLatestCoordinationResult()
    const availableActions = runtime.listAvailableActions()
    const availableActionNames = availableActions.map((entry) => entry?.name)
    const availablePerceptionNames = runtime.listAvailablePerceptions().map((entry) => entry?.name)
    const brushDescriptor = description.actions.find((entry) => entry?.name === 'scatter.brushRegion') || null

    assert.equal(typeof coordinationState?.focusedWidgetRef, 'string')
    assert.equal(observation?.workspace?.workspaceId, 'runtime-contract-session')
    assert.equal(observation?.state?.stateId, initialState.stateId)
    assert.equal(typeof observation?.sharedAnalyticalState, 'object')
    assert.equal(Array.isArray(observation?.sharedAnalyticalState?.annotations), true)
    assert.equal(typeof observation?.sharedAnalyticalState?.viewStatesByWidget, 'object')
    assert.equal(Array.isArray(observation?.sharedAnalyticalState?.sharedViewContext?.activeWidgetRefs), true)
    assert.equal(Array.isArray(observation?.sharedAnalyticalState?.sharedTransformationContext?.activeWidgetRefs), true)
    assert.equal(Array.isArray(observation?.sharedAnalyticalState?.activeAnalyticalContext?.activeContextKinds), true)
    assert.equal('availableActions' in observation, false)
    assert.equal('availablePerceptions' in observation, false)
    assert.equal(Array.isArray(propagationSummary?.candidateSourceRefs), true)
    assert.equal(latestCoordinationResult, null)
    assert.equal(observation?.latestCoordinationResult, null)
    assert.equal(availableActionNames.includes('workspace.focusWidget'), true)
    assert.equal(Array.isArray(availablePerceptionNames), true)
    assert.equal(brushDescriptor?.analyticalPlacement, 'workspace-shared-state')
    assert.equal(brushDescriptor?.sharedAnalyticalSurface, 'sharedSemanticFocus')
    assert.equal(
      availableActions.find((entry) => entry?.name === 'scatter.brushRegion')?.analyticalPlacement,
      'workspace-shared-state',
    )

    const turn = await runtime.runAgentTurn({
      operation: {
        kind: 'perception',
        name: 'perception.inspectFocusedWidget',
        queryScope: { widgetRef },
        params: {},
      },
    })
    assert.equal(turn.act.kind, 'perception')
    assert.equal(turn.verify.ok, true)

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
