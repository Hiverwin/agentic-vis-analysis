import test from 'node:test'
import assert from 'node:assert/strict'
import {
  describeBarWidgetContract,
  describeHeatmapWidgetContract,
  describeLineWidgetContract,
  describeParallelCoordinatesWidgetContract,
  describeSankeyWidgetContract,
  describeScatterWidgetContract,
} from '../../../../widgetva-kit/src/index.js'

const CONTRACTS_BY_KIND = {
  scatter: describeScatterWidgetContract(),
  bar: describeBarWidgetContract(),
  line: describeLineWidgetContract(),
  heatmap: describeHeatmapWidgetContract(),
  parallelCoordinates: describeParallelCoordinatesWidgetContract(),
  sankey: describeSankeyWidgetContract(),
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

async function setupIsolatedAppStoreSession(label = 'default') {
  globalThis.window = globalThis.window || {}
  globalThis.document = globalThis.document || {}

  const [{ useAppStore }, runtimeBridge] = await Promise.all([
    import('./appStore.js'),
    import('../runtime/runtimeBridge.js'),
  ])

  const store = useAppStore
  const baseCaseId = 'cars-horsepower'
  const baseCase = runtimeBridge.getWorkspaceCase(baseCaseId)
  const isolatedCaseId = `${baseCaseId}-${label}-${Date.now()}`

  runtimeBridge.registerWorkspaceCaseOverride(isolatedCaseId, {
    ...JSON.parse(JSON.stringify(baseCase)),
    id: isolatedCaseId,
  })
  store.getState().setActiveCase(isolatedCaseId)

  return {
    store,
    runtimeBridge,
    sessionKey: isolatedCaseId,
    cleanup() {
      runtimeBridge.disposeRuntimeSession(isolatedCaseId)
    },
  }
}

test('direct selection actions update coordination state through appStore', async () => {
  const { store, runtimeBridge, sessionKey, cleanup } = await setupIsolatedAppStoreSession('selection')

  try {
    store.getState().clearSelection()
    await tick()

    const beforeVersion = store.getState().coordinationVersion
    store.getState().selectOrigin('USA')
    await tick()

    const primarySelection = runtimeBridge.readWorkspaceCoordinationState(sessionKey)?.selections?.views?.primary || null

    assert.equal(primarySelection?.sourceWidgetId, 'w_bar_origin')
    assert.equal(store.getState().coordinationVersion, beforeVersion + 1)
  } finally {
    cleanup()
  }
})

test('setWorkspaceProviderEnvironment rebuilds the active workspace under one provider environment', async () => {
  const { store, runtimeBridge, sessionKey, cleanup } = await setupIsolatedAppStoreSession('provider-environment')

  try {
    store.getState().setWorkspaceProviderEnvironment('echarts')
    await tick()

    const description = runtimeBridge.readRuntimeWorkspaceDescription(sessionKey)
    const adapters = description?.widgetAdapters || []
    assert.equal(store.getState().workspaceProviderEnvironment, 'echarts')
    assert.equal(adapters.length, 6)
    assert.equal(adapters.every((adapter) => adapter.provider === 'echarts'), true)
  } finally {
    cleanup()
  }
})

test('appStore initializes isolated workspace sessions under one shared provider environment by default', async () => {
  const { store, runtimeBridge, sessionKey, cleanup } = await setupIsolatedAppStoreSession('default-provider-environment')

  try {
    const description = runtimeBridge.readRuntimeWorkspaceDescription(sessionKey)
    const adapters = description?.widgetAdapters || []
    assert.equal(store.getState().workspaceProviderEnvironment, 'vega-lite')
    assert.equal(adapters.length, 6)
    assert.equal(adapters.every((adapter) => adapter.provider === 'vega-lite'), true)
  } finally {
    cleanup()
  }
})

test('appStore exposes the active agent runtime contract and keeps it stable across provider-environment switches', async () => {
  const { store, cleanup } = await setupIsolatedAppStoreSession('agent-runtime-contract')

  try {
    let contract = store.getState().getActiveAgentRuntimeContract()
    assert.equal(typeof contract?.describeWorkspace, 'function')
    assert.equal(typeof contract?.readObservation, 'function')
    assert.equal(typeof contract?.executeAction, 'function')
    assert.equal(typeof contract?.queryPerception, 'function')
    assert.equal(typeof contract?.runDataQuery, 'function')
    assert.equal(typeof contract?.replay, 'function')

    let description = contract.describeWorkspace()
    let scatterWidgetRef = description?.widgets?.find((widget) => widget?.widgetId === 'w_scatter_cars')?.ref || null
    assert.equal(description?.widgetAdapters?.length, 6)
    assert.equal(typeof scatterWidgetRef, 'string')

    let actionResult = await contract.executeAction({
      callId: 'app_store_contract_scatter_brush_mixed',
      actor: 'agent',
      name: 'scatter.brushRegion',
      queryScope: { widgetRef: scatterWidgetRef },
      params: {
        xField: 'horsepower',
        yField: 'mpg',
        xRange: [80, 140],
        yRange: [18, 30],
      },
    })
    assert.equal(actionResult?.ok, true)
    assert.equal(contract.readCoordinationState()?.selections?.views?.primary?.sourceWidgetId, 'w_scatter_cars')

    store.getState().setWorkspaceProviderEnvironment('d3')
    await tick()

    contract = store.getState().getActiveAgentRuntimeContract()
    description = contract.describeWorkspace()
    scatterWidgetRef = description?.widgets?.find((widget) => widget?.widgetId === 'w_scatter_cars')?.ref || null
    assert.equal(description?.widgetAdapters?.every((adapter) => adapter.provider === 'd3'), true)
    assert.equal(contract.listAvailableDataQueries().some((entry) => entry?.queryKind === 'summary'), true)

    const perceptionResult = await contract.queryPerception({
      callId: 'app_store_contract_scatter_perception_d3',
      actor: 'agent',
      name: 'perception.computeCorrelation',
      queryScope: { widgetRef: scatterWidgetRef },
      params: {
        xField: 'horsepower',
        yField: 'mpg',
      },
    })
    assert.equal(perceptionResult?.ok, true)
  } finally {
    cleanup()
  }
})

test('appStore exposes the same agent-facing contract for all six widget families across workspace provider environments', async () => {
  const { store, cleanup } = await setupIsolatedAppStoreSession('all-widget-contracts')
  const providerEnvironments = ['vega-lite', 'echarts', 'd3']

  try {
    for (const providerEnvironment of providerEnvironments) {
      store.getState().setWorkspaceProviderEnvironment(providerEnvironment)
      await tick()

      const contract = store.getState().getActiveAgentRuntimeContract()
      const description = contract.describeWorkspace()
      const availableActions = contract.listAvailableActions()
      const availablePerceptions = contract.listAvailablePerceptions()

      assert.equal(description?.widgetAdapters?.length, 6)
      assert.equal(description?.widgetAdapters?.every((adapter) => adapter.provider === providerEnvironment), true)

      for (const widget of description?.widgets || []) {
        const expectedContract = CONTRACTS_BY_KIND[widget.kind]
        const widgetPerceptionNames = widget.perceptionNames || widget.perceptionQueryNames || []
        assert.ok(expectedContract, `missing expected contract for widget kind ${widget.kind}`)
        assert.equal(
          expectedContract.actionNames.every((name) => widget.actionNames.includes(name)),
          true,
        )
        assert.equal(
          expectedContract.perceptionNames.every((name) => widgetPerceptionNames.includes(name)),
          true,
        )
        assert.equal(
          expectedContract.actionNames.every((name) => availableActions.some((entry) => entry?.name === name)),
          true,
        )
        assert.equal(
          expectedContract.perceptionNames.every((name) => availablePerceptions.some((entry) => entry?.name === name)),
          true,
        )
      }
    }
  } finally {
    cleanup()
  }
})

test('toggleTraceSegmentCollapsed manages collapsed segment ids as UI-only trace state', async () => {
  const { store, cleanup } = await setupIsolatedAppStoreSession('trace-segment-collapse')

  try {
    assert.deepEqual(store.getState().collapsedTraceSegmentIds, [])

    store.getState().toggleTraceSegmentCollapsed('segment_2')
    assert.deepEqual(store.getState().collapsedTraceSegmentIds, ['segment_2'])

    store.getState().toggleTraceSegmentCollapsed('segment_4')
    assert.deepEqual(store.getState().collapsedTraceSegmentIds, ['segment_2', 'segment_4'])

    store.getState().toggleTraceSegmentCollapsed('segment_2')
    assert.deepEqual(store.getState().collapsedTraceSegmentIds, ['segment_4'])

    store.getState().clearCollapsedTraceSegments()
    assert.deepEqual(store.getState().collapsedTraceSegmentIds, [])
  } finally {
    cleanup()
  }
})

test('selectTraceStep replays the workspace state referenced by the selected trace step', async () => {
  const { store, runtimeBridge, sessionKey, cleanup } = await setupIsolatedAppStoreSession('trace-replay')

  try {
    store.getState().resetWorkspaceView()
    await tick()

    store.getState().clearSelection()
    await tick()
    store.getState().selectOrigin('USA')
    await tick()

    const tracedStep = store.getState().trace.at(-1) || null
    assert.equal(typeof tracedStep?.resultStateId, 'string')
    assert.equal(tracedStep?.widgetId, 'w_bar_origin')

    await store.getState().restoreEarliestWorkspaceState()
    assert.equal(runtimeBridge.readWorkspaceCoordinationState(sessionKey)?.selections?.views?.primary, null)

    store.getState().setSelectedWidgetId('w_parallel_cars')
    await tick()
    assert.equal(store.getState().selectedWidgetId, 'w_parallel_cars')

    await store.getState().selectTraceStep(tracedStep.id)

    const restoredPrimarySelection = runtimeBridge.readWorkspaceCoordinationState(sessionKey)?.selections?.views?.primary || null
    const replayContext = store.getState().activeReplayContext
    assert.equal(store.getState().selectedTraceStepId, tracedStep.id)
    assert.equal(replayContext?.source, 'trace_step')
    assert.equal(replayContext?.selectedTraceStepId, tracedStep.id)
    assert.equal(replayContext?.stateId, tracedStep.resultStateId)
    assert.equal(replayContext?.branchId, tracedStep.branchId)
    assert.equal(replayContext?.restoredWidgetId, 'w_bar_origin')
    assert.equal(store.getState().selectedWidgetId, 'w_bar_origin')
    assert.equal(restoredPrimarySelection?.sourceWidgetId, 'w_bar_origin')
    assert.equal(restoredPrimarySelection?.values?.includes('USA'), true)
  } finally {
    cleanup()
  }
})

test('addFinding captures selected trace provenance metadata', async () => {
  const { store, cleanup } = await setupIsolatedAppStoreSession('finding-provenance')

  try {
    store.getState().clearSelection()
    await tick()
    store.getState().selectOrigin('USA')
    await tick()

    const initialTracedStep = store.getState().trace.at(-1) || null
    await store.getState().restoreEarliestWorkspaceState()
    await store.getState().selectTraceStep(initialTracedStep?.id)
    await tick()

    const selectedTraceStep = store.getState().trace.find((step) => step?.id === store.getState().selectedTraceStepId) || null
    assert.equal(typeof selectedTraceStep?.id, 'string')
    assert.equal(typeof selectedTraceStep?.resultStateId, 'string')

    store.getState().addFinding('USA cluster looks analytically stable')

    const finding = store.getState().findings[0] || null
    assert.equal(finding?.title, 'USA cluster looks analytically stable')
    assert.equal(finding?.provenance, 'manual_trace')
    assert.equal(finding?.traceStepId, selectedTraceStep.id)
    assert.equal(finding?.stateId, selectedTraceStep.resultStateId)
    assert.equal(finding?.branchId, selectedTraceStep.branchId)
    assert.equal(finding?.branchNarrative, null)
    assert.equal(finding?.pathContext?.pathLabel, 'Main')
    assert.equal(finding?.pathContext?.segmentCount, 1)
    assert.equal(finding?.pathContext?.stepCount, 1)
  } finally {
    cleanup()
  }
})

test('addFinding stores branch narrative snapshots when the selected context belongs to a forked branch', async () => {
  const { store, cleanup } = await setupIsolatedAppStoreSession('finding-branch-narrative')

  try {
    store.getState().clearSelection()
    await tick()
    store.getState().selectOrigin('USA')
    await tick()

    await store.getState().restoreEarliestWorkspaceState()
    await tick()

    store.getState().selectYear(1970)
    await tick()

    const selectedTraceStep = store.getState().trace.at(-1) || null
    assert.equal(selectedTraceStep?.branchId !== 'main', true)

    store.getState().addFinding('Forked branch confirms the USA view')

    const finding = store.getState().findings[0] || null
    assert.equal(finding?.branchId, selectedTraceStep?.branchId)
    assert.equal(typeof finding?.branchNarrative?.branchLabel, 'string')
    assert.equal(typeof finding?.branchNarrative?.forkDescription, 'string')
    assert.equal(typeof finding?.branchNarrative?.entryStepLabel, 'string')
    assert.equal(finding?.pathContext?.pathLabel, 'Branch 1')
    assert.equal(finding?.pathContext?.segmentCount, 2)
    assert.equal(finding?.pathContext?.stepCount, 2)
  } finally {
    cleanup()
  }
})

test('focusFinding replays the trace/state provenance referenced by a saved finding', async () => {
  const { store, runtimeBridge, sessionKey, cleanup } = await setupIsolatedAppStoreSession('finding-focus')

  try {
    store.getState().clearSelection()
    await tick()
    store.getState().selectOrigin('USA')
    await tick()

    const selectedTraceStep = store.getState().trace.at(-1) || null
    store.getState().addFinding('Return to the USA branch anchor')

    const finding = store.getState().findings[0] || null
    assert.equal(finding?.traceStepId, selectedTraceStep?.id)

    await store.getState().restoreEarliestWorkspaceState()
    assert.equal(runtimeBridge.readWorkspaceCoordinationState(sessionKey)?.selections?.views?.primary, null)

    await store.getState().focusFinding(finding.id)

    const restoredPrimarySelection = runtimeBridge.readWorkspaceCoordinationState(sessionKey)?.selections?.views?.primary || null
    const replayContext = store.getState().activeReplayContext
    assert.equal(store.getState().selectedTraceStepId, selectedTraceStep?.id)
    assert.equal(replayContext?.source, 'trace_step')
    assert.equal(replayContext?.selectedTraceStepId, selectedTraceStep?.id)
    assert.equal(restoredPrimarySelection?.sourceWidgetId, 'w_bar_origin')
    assert.equal(restoredPrimarySelection?.values?.includes('USA'), true)
  } finally {
    cleanup()
  }
})

test('focusFindingProvenance can jump to branch entry and fork origin for a saved branch finding', async () => {
  const { store, cleanup } = await setupIsolatedAppStoreSession('finding-provenance-targets')

  try {
    store.getState().clearSelection()
    await tick()
    store.getState().selectOrigin('USA')
    await tick()

    await store.getState().restoreEarliestWorkspaceState()
    await tick()

    store.getState().selectYear(1970)
    await tick()

    store.getState().addFinding('Forked branch confirms the USA view')
    const finding = store.getState().findings[0] || null

    assert.equal(typeof finding?.branchNarrative?.originStepId, 'string')
    assert.equal(typeof finding?.branchNarrative?.entryStepId, 'string')

    await store.getState().focusFindingProvenance(finding.id, 'origin')
    assert.equal(store.getState().selectedTraceStepId, finding?.branchNarrative?.originStepId)
    assert.equal(store.getState().traceNavigationTarget?.stepId, finding?.branchNarrative?.originStepId)
    assert.equal(store.getState().traceNavigationTarget?.kind, 'origin')

    await store.getState().focusFindingProvenance(finding.id, 'entry')
    assert.equal(store.getState().selectedTraceStepId, finding?.branchNarrative?.entryStepId)
    assert.equal(store.getState().traceNavigationTarget?.stepId, finding?.branchNarrative?.entryStepId)
    assert.equal(store.getState().traceNavigationTarget?.kind, 'entry')
  } finally {
    cleanup()
  }
})

test('restoreEarliestWorkspaceState records a unified history replay context', async () => {
  const { store, runtimeBridge, sessionKey, cleanup } = await setupIsolatedAppStoreSession('history-replay-context')

  try {
    store.getState().clearSelection()
    await tick()
    store.getState().selectOrigin('USA')
    await tick()

    const currentStateId = runtimeBridge.readWorkspaceCoordinationState(sessionKey)?.stateId || null
    assert.equal(typeof currentStateId, 'string')

    await store.getState().restoreEarliestWorkspaceState()

    const replayContext = store.getState().activeReplayContext
    const restoredStateId = runtimeBridge.readWorkspaceCoordinationState(sessionKey)?.stateId || null

    assert.equal(replayContext?.source, 'history_restore')
    assert.equal(replayContext?.stateId, restoredStateId)
    assert.equal(replayContext?.sourceStateId, currentStateId)
    assert.equal(replayContext?.widgetId, 'workspace')
    assert.equal(replayContext?.transitionType, 'branch')
  } finally {
    cleanup()
  }
})
