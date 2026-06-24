import test from 'node:test'
import assert from 'node:assert/strict'

import {
  appendAgentMessage,
  appendRuntimeTraceStep,
  buildSelectionOperationResult,
  createAgentRuntimeContract,
  buildWorkspaceGlobalFilters,
  createWorkspaceViewModel,
  createInitialSessionState,
  disposeRuntimeSession,
  executeWorkspaceAction,
  getRuntimeSession,
  jumpWorkspaceToState,
  listRuntimeAvailableActions,
  listRuntimeAvailablePerceptions,
  promotePrimarySelectionToGlobalFilters,
  promotePrimarySelectionToHighlight,
  queryRuntimePerception,
  readLatestCoordinationResult,
  readFocusedWidgetId,
  readRuntimeObservation,
  readRuntimeWorkspaceDescription,
  readWorkspaceInteractionBindings,
  readWorkspaceStateHistory,
  readWorkspaceCoordinationState,
  readSelectionPropagationSummary,
  registerWorkspaceProviderEnvironment,
  replayRuntimeState,
  setFocusedWidgetId,
  syncScatterBrushSelection,
  syncScatterViewport,
  syncWorkspacePrimarySelection,
  syncWorkspaceGlobalFilters,
  readAgentMessages,
  readRuntimeTrace,
} from './runtimeBridge.js'
import { buildHeatmapSpec, buildLineSpec } from '../workspace/widgetSpecs.js'

function createFreshBaseSession() {
  disposeRuntimeSession('cars-horsepower')
  registerWorkspaceProviderEnvironment('cars-horsepower', 'mixed')
  return createInitialSessionState('cars-horsepower')
}

test('buildSelectionOperationResult falls back to the kit-owned empty coordination result contract when no session exists', () => {
  disposeRuntimeSession('missing-session')
  assert.deepEqual(buildSelectionOperationResult('missing-session', { changed: false }), {
    changed: false,
    coordinationState: null,
    propagationSummary: {
      active: false,
      sourceWidgetId: null,
      sourceSelectionRef: null,
      selectionRef: null,
      selectionSummary: null,
      targetWidgetIds: [],
      linkCount: 0,
      links: [],
      activatedLinks: [],
      affectedTargets: [],
      skippedTargets: [],
      verificationGuidance: [],
      verificationSteps: [],
      topology: null,
    },
    verificationSteps: [],
    verificationResults: [],
    verification: null,
  })
})

test('readSelectionPropagationSummary falls back to the kit-owned empty propagation summary contract when no session exists', () => {
  disposeRuntimeSession('missing-session')
  assert.deepEqual(readSelectionPropagationSummary('missing-session'), {
    active: false,
    sourceWidgetId: null,
    sourceSelectionRef: null,
    selectionRef: null,
    selectionSummary: null,
    targetWidgetIds: [],
    linkCount: 0,
    links: [],
    activatedLinks: [],
    affectedTargets: [],
    skippedTargets: [],
    verificationGuidance: [],
    verificationSteps: [],
    topology: null,
  })
})

test('app runtime bridge exposes the agent-facing observation, action, perception, and replay surfaces', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createFreshBaseSession()

  try {
    const description = readRuntimeWorkspaceDescription(session.runtimeSessionKey)
    assert.equal(Array.isArray(description?.widgets), true)
    assert.equal(Array.isArray(description?.widgetAdapters), true)
    assert.equal(description.widgetAdapters.length, 6)

    const observation = readRuntimeObservation(session.runtimeSessionKey)
    assert.equal(typeof observation?.workspace?.workspaceId, 'string')
    assert.equal(Array.isArray(observation?.availableActions), true)
    assert.equal(Array.isArray(observation?.availablePerceptions), true)

    const actionNames = listRuntimeAvailableActions(session.runtimeSessionKey).map((entry) => entry?.name)
    const perceptionNames = listRuntimeAvailablePerceptions(session.runtimeSessionKey).map((entry) => entry?.name)
    assert.equal(actionNames.includes('scatter.brushRegion'), true)
    assert.equal(actionNames.includes('bar.selectCategory'), true)
    assert.equal(perceptionNames.includes('perception.computeCorrelation'), true)
    assert.equal(perceptionNames.includes('perception.findExtremes'), true)

    const perceptionResult = await queryRuntimePerception(session.runtimeSessionKey, {
      name: 'perception.computeCorrelation',
      queryScope: {
        widgetRef: 'wl://widgetva-app/workspace/cars-horsepower/widget/w_scatter_cars',
      },
      params: {
        xField: 'horsepower',
        yField: 'mpg',
      },
    })
    assert.equal(perceptionResult?.ok, true)

    const currentStateId = readWorkspaceCoordinationState(session.runtimeSessionKey)?.stateId
    const replayResult = await replayRuntimeState(session.runtimeSessionKey, currentStateId)
    assert.equal(replayResult?.ok, true)
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('createAgentRuntimeContract keeps one agent-facing interaction surface across vega-lite, echarts, and d3 workspace environments', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const providerEnvironments = ['vega-lite', 'echarts', 'd3']

  try {
    for (const providerEnvironment of providerEnvironments) {
      disposeRuntimeSession('cars-horsepower')
      registerWorkspaceProviderEnvironment('cars-horsepower', providerEnvironment)
      const session = createInitialSessionState('cars-horsepower')
      const contract = createAgentRuntimeContract(session.runtimeSessionKey)

      try {
        assert.equal(typeof contract.describeWorkspace, 'function')
        assert.equal(typeof contract.readObservation, 'function')
        assert.equal(typeof contract.readCoordinationState, 'function')
        assert.equal(typeof contract.readPropagationSummary, 'function')
        assert.equal(typeof contract.listAvailableActions, 'function')
        assert.equal(typeof contract.listAvailablePerceptions, 'function')
        assert.equal(typeof contract.listAvailableDataQueries, 'function')
        assert.equal(typeof contract.executeAction, 'function')
        assert.equal(typeof contract.queryPerception, 'function')
        assert.equal(typeof contract.runDataQuery, 'function')
        assert.equal(typeof contract.readTrace, 'function')
        assert.equal(typeof contract.replay, 'function')

        const description = contract.describeWorkspace()
        const observation = contract.readObservation()
        const availableActions = contract.listAvailableActions()
        const availablePerceptions = contract.listAvailablePerceptions()
        const availableDataQueries = contract.listAvailableDataQueries()
        const scatterWidgetRef = description?.widgets?.find((widget) => widget?.widgetId === 'w_scatter_cars')?.ref || null

        assert.equal(description?.widgets?.length, 6)
        assert.equal(description?.widgetAdapters?.length, 6)
        assert.equal(description?.widgetAdapters?.every((adapter) => adapter.provider === providerEnvironment), true)
        assert.equal(observation?.workspace?.workspaceId, session.runtimeSessionKey)
        assert.equal(Array.isArray(observation?.availableActions), true)
        assert.equal(Array.isArray(observation?.availablePerceptions), true)
        assert.equal(availableActions.some((entry) => entry?.name === 'scatter.brushRegion'), true)
        assert.equal(availablePerceptions.some((entry) => entry?.name === 'perception.computeCorrelation'), true)
        assert.equal(availableDataQueries.some((entry) => entry?.queryKind === 'summary'), true)
        assert.equal(typeof scatterWidgetRef, 'string')

        const actionResult = await contract.executeAction({
          callId: `contract_action_${providerEnvironment}`,
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

        const coordinationState = contract.readCoordinationState()
        const propagationSummary = contract.readPropagationSummary()
        assert.equal(coordinationState?.selections?.views?.primary?.sourceWidgetId, 'w_scatter_cars')
        assert.equal(propagationSummary?.sourceWidgetId, 'w_scatter_cars')
        assert.equal(Array.isArray(propagationSummary?.targetWidgetIds), true)

        const perceptionResult = await contract.queryPerception({
          callId: `contract_perception_${providerEnvironment}`,
          actor: 'agent',
          name: 'perception.computeCorrelation',
          queryScope: { widgetRef: scatterWidgetRef },
          params: {
            xField: 'horsepower',
            yField: 'mpg',
          },
        })
        assert.equal(perceptionResult?.ok, true)

        const summaryQuery = availableDataQueries.find((entry) => entry?.queryKind === 'summary')
        const dataResult = await contract.runDataQuery({
          callId: `contract_data_${providerEnvironment}`,
          actor: 'agent',
          dataRef: summaryQuery?.dataRef,
          query: {
            kind: summaryQuery?.queryKind,
            spec: {},
          },
        })
        assert.equal(dataResult?.ok, true)

        const trace = contract.readTrace({ limit: 10 })
        assert.equal(Array.isArray(trace), true)
        assert.equal(trace.some((entry) => entry?.eventKind === 'action'), true)

        const replayResult = await contract.replay(contract.readCoordinationState()?.stateId)
        assert.equal(replayResult?.ok, true)
      } finally {
        disposeRuntimeSession(session.runtimeSessionKey)
      }
    }
  } finally {
    registerWorkspaceProviderEnvironment('cars-horsepower', 'mixed')
    globalThis.window = previousWindow
  }
})

test('createAgentRuntimeContract normalizes bar category aliases from agent plans into canonical selection params', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}

  try {
    const session = createFreshBaseSession()
    const contract = createAgentRuntimeContract(session.runtimeSessionKey)
    const description = contract.describeWorkspace()
    const barWidgetRef = description?.widgets?.find((widget) => widget?.widgetId === 'w_bar_origin')?.ref || null

    const result = await contract.executeAction({
      callId: 'contract_bar_alias',
      actor: 'agent',
      name: 'bar.selectCategory',
      queryScope: { widgetRef: barWidgetRef },
      params: {
        categories: ['USA'],
      },
    })

    assert.equal(result?.ok, true)
    const primarySelection = contract.readCoordinationState()?.selections?.views?.primary || null
    assert.equal(primarySelection?.sourceWidgetId, 'w_bar_origin')
    assert.deepEqual(primarySelection?.predicates, [{ field: 'origin', op: 'in', value: ['USA'] }])
  } finally {
    disposeRuntimeSession('cars-horsepower')
    globalThis.window = previousWindow
  }
})

test('createInitialSessionState attaches a real widgetva-kit runtime session and workspace spec', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createFreshBaseSession()

  try {
    const runtimeSession = getRuntimeSession(session.runtimeSessionKey)
    assert.equal(typeof runtimeSession?.runtime?.executeAction, 'function')
    assert.equal(typeof runtimeSession?.workspace?.listWidgetDescriptions, 'function')
    assert.equal(runtimeSession.widgets.length, 6)
    assert.equal(Array.isArray(session.currentWorkspaceSpec?.widgets), true)
    assert.equal(Array.isArray(session.currentWorkspaceSpec?.links), true)
    assert.equal(session.currentWorkspaceSpec.widgets.length, 6)
    assert.equal(session.currentWorkspaceSpec.links.length, 37)
    assert.equal(session.currentWorkspaceSpec.links.every((link) => link.activationPolicy === 'automatic'), true)
    assert.equal(session.currentWorkspaceSpec.links.every((link) => link.effectConstraint == null), true)
    const advancedLink = session.currentWorkspaceSpec.links.find((link) => link.sourceWidgetId === 'w_line_year' && link.targetWidgetId === 'w_heatmap_origin_cyl' && link.primitive === 'reencode')
    assert.equal(advancedLink?.effect, 'transformView')
    assert.equal(advancedLink?.responseSpec?.kind, 'reencode')
    const reorderLink = session.currentWorkspaceSpec.links.find((link) => link.sourceWidgetId === 'w_heatmap_origin_cyl' && link.targetWidgetId === 'w_sankey_cars' && link.responseSpec?.params?.variant === 'reorderLayer')
    assert.equal(reorderLink?.effect, 'transformView')
    const domainLink = session.currentWorkspaceSpec.links.find((link) => link.sourceWidgetId === 'w_scatter_cars' && link.targetWidgetId === 'w_line_year' && link.primitive === 'syncDomain')
    assert.equal(domainLink?.effect, 'syncDomain')
    const drillDownLink = session.currentWorkspaceSpec.links.find((link) => link.sourceWidgetId === 'w_bar_origin' && link.targetWidgetId === 'w_line_year' && link.primitive === 'drillDown')
    assert.equal(drillDownLink?.effect, 'transformView')
    assert.equal(drillDownLink?.responseSpec?.kind, 'drillDown')
    const structureLink = session.currentWorkspaceSpec.links.find((link) => link.sourceWidgetId === 'w_line_year' && link.targetWidgetId === 'w_sankey_cars' && link.primitive === 'structure')
    assert.equal(structureLink?.effect, 'transformStructure')
    assert.equal(structureLink?.responseSpec?.kind, 'collapse')
    const expandLink = session.currentWorkspaceSpec.links.find((link) => link.sourceWidgetId === 'w_scatter_cars' && link.targetWidgetId === 'w_sankey_cars' && link.responseSpec?.kind === 'expand')
    assert.equal(expandLink?.effect, 'transformStructure')
    assert.equal(expandLink?.responseSpec?.params?.variant, 'expandNode')
    assert.equal(runtimeSession.workspace.listWidgetDescriptions().length, 6)
    assert.equal(readFocusedWidgetId(session.runtimeSessionKey), 'w_scatter_cars')
    assert.equal(setFocusedWidgetId(session.runtimeSessionKey, 'w_bar_origin'), 'w_bar_origin')
    assert.equal(readFocusedWidgetId(session.runtimeSessionKey), 'w_bar_origin')
    assert.deepEqual(readWorkspaceCoordinationState(session.runtimeSessionKey)?.globalFilters || {}, {})
    const nextGlobalFilters = buildWorkspaceGlobalFilters({
      ...session,
      analysisOrigin: 'USA',
      analysisYear: 1971,
      analysisCylinders: [4],
      horsepowerMin: 60,
      horsepowerMax: 180,
    })
    assert.deepEqual(syncWorkspaceGlobalFilters(session.runtimeSessionKey, {
      ...session,
      analysisOrigin: 'USA',
      analysisYear: 1971,
      analysisCylinders: [4],
      horsepowerMin: 60,
      horsepowerMax: 180,
    }), nextGlobalFilters)
    assert.deepEqual(readWorkspaceCoordinationState(session.runtimeSessionKey)?.globalFilters || {}, nextGlobalFilters)
    assert.equal(syncScatterBrushSelection(session.runtimeSessionKey, {
      horsepower: [80, 140],
      mpg: [18, 30],
    }), true)
    assert.equal(syncScatterViewport(session.runtimeSessionKey, {
      xDomain: [80, 140],
      yDomain: [18, 30],
    }), true)
    assert.deepEqual(readWorkspaceCoordinationState(session.runtimeSessionKey)?.viewport, {
      sourceWidgetRef: `wl://widgetva-app/workspace/${session.runtimeSessionKey}/widget/w_scatter_cars`,
      xDomain: [80, 140],
      yDomain: [18, 30],
      zoom: null,
    })
    assert.equal(readWorkspaceCoordinationState(session.runtimeSessionKey)?.focusedWidgetRef?.includes('/widget/w_scatter_cars'), true)
    assert.equal(Object.keys(readWorkspaceCoordinationState(session.runtimeSessionKey)?.selections?.registry || {}).length, 1)
    assert.equal(readWorkspaceCoordinationState(session.runtimeSessionKey)?.selections?.views?.primary?.kind, 'brush')
    const filteredViewModel = createWorkspaceViewModel({
      ...session,
      coordinationState: readWorkspaceCoordinationState(session.runtimeSessionKey),
    })
    assert.equal(filteredViewModel.filteredRows.length < session.dataset.rowsData.length, true)
    assert.equal(syncScatterBrushSelection(session.runtimeSessionKey, null), true)
    assert.equal(syncScatterViewport(session.runtimeSessionKey, null), true)
    assert.equal(readWorkspaceCoordinationState(session.runtimeSessionKey)?.viewport, null)
    assert.deepEqual(readWorkspaceCoordinationState(session.runtimeSessionKey)?.selections, {
      registry: {},
      views: {
        primary: null,
        byWidget: {},
      },
    })
    assert.equal(syncWorkspacePrimarySelection(session.runtimeSessionKey, {
      sourceWidgetId: 'w_bar_origin',
      selectionId: 'origin',
      kind: 'point',
      summary: 'Origin: Japan',
      predicates: [{ field: 'origin', op: 'equals', value: 'Japan' }],
      values: ['Japan'],
    }), true)
    assert.equal(readWorkspaceCoordinationState(session.runtimeSessionKey)?.selections?.views?.primary?.sourceWidgetId, 'w_bar_origin')
    const originFilteredViewModel = createWorkspaceViewModel({
      ...session,
      coordinationState: readWorkspaceCoordinationState(session.runtimeSessionKey),
    })
    assert.equal(originFilteredViewModel.filteredRows.every((row) => row.origin === 'Japan'), true)
    assert.equal(originFilteredViewModel.widgetMap.w_bar_origin.derivedData.length > 1, true)
    assert.equal(originFilteredViewModel.widgetMap.w_bar_origin.viewState.analysisOrigin, 'Japan')
    const originPropagationSummary = readSelectionPropagationSummary(session.runtimeSessionKey)
    assert.equal(originPropagationSummary.active, true)
    assert.equal(originPropagationSummary.sourceWidgetId, 'w_bar_origin')
    assert.equal(typeof originPropagationSummary.sourceSelectionRef, 'string')
    assert.equal(originPropagationSummary.targetWidgetIds.includes('w_scatter_cars'), true)
    assert.equal(originPropagationSummary.links.every((link) => link.effect === 'applyFilter'), true)
    assert.equal(originPropagationSummary.links.every((link) => link.appliedEffect === 'applyFilter'), true)
    assert.equal(originPropagationSummary.links.every((link) => link.activationPolicy === 'automatic'), true)
    assert.equal(originPropagationSummary.links.every((link) => link.effectConstraint === null), true)
    assert.equal(originPropagationSummary.activatedLinks.length, originPropagationSummary.linkCount)
    assert.equal(originPropagationSummary.affectedTargets.length, originPropagationSummary.linkCount)
    assert.equal(originPropagationSummary.affectedTargets.every((target) => target.effect === 'applyFilter'), true)
    assert.equal(originPropagationSummary.affectedTargets.every((target) => target.activationPolicy === 'automatic'), true)
    assert.equal(originPropagationSummary.affectedTargets.every((target) => target.effectConstraint === null), true)
    assert.equal(originPropagationSummary.affectedTargets.every((target) => target.verification?.preferredReadMethod === 'readVerificationState'), true)
    assert.equal(originPropagationSummary.affectedTargets.every((target) => target.verificationGuidance?.verificationType === 'filter'), true)
    assert.equal(originPropagationSummary.affectedTargets.every((target) => target.verificationGuidance?.effectChecks.includes('data.visibleCount')), true)
    assert.equal(originPropagationSummary.verificationGuidance.every((entry) => entry.preferredReadMethod === 'readVerificationState'), true)
    assert.equal(originPropagationSummary.verificationSteps.length, originPropagationSummary.linkCount)
    assert.equal(originPropagationSummary.verificationSteps.every((step) => step.readMethod === 'readVerificationState'), true)
    assert.equal(originPropagationSummary.verificationSteps.every((step) => step.checks.includes('data.visibleCount')), true)
    const operationResult = buildSelectionOperationResult(session.runtimeSessionKey, { changed: true })
    assert.equal(operationResult.verificationResults.length, originPropagationSummary.linkCount)
    assert.equal(operationResult.verificationResults.every((entry) => entry.readMethod === 'readVerificationState'), true)
    assert.equal(operationResult.verificationResults.every((entry) => Object.hasOwn(entry.checks, 'data.visibleCount')), true)
    assert.equal(operationResult.verification.status, 'verified')
    assert.equal(operationResult.verification.failed, 0)
    const latestCoordinationResult = readLatestCoordinationResult(session.runtimeSessionKey)
    assert.equal(latestCoordinationResult.verification.status, 'verified')
    assert.equal(latestCoordinationResult.propagationSummary.sourceWidgetId, 'w_bar_origin')
    assert.equal(latestCoordinationResult.verificationResults.length, originPropagationSummary.linkCount)
    assert.equal(syncWorkspacePrimarySelection(session.runtimeSessionKey, {
      sourceWidgetId: 'w_bar_origin',
      selectionId: 'origin',
      kind: 'point',
      summary: 'Origin: Europe',
      predicates: [{ field: 'origin', op: 'in', value: ['Europe'] }],
      values: ['Europe'],
    }), true)
    const sourceFeedbackViewModel = createWorkspaceViewModel({
      ...session,
      coordinationState: readWorkspaceCoordinationState(session.runtimeSessionKey),
    })
    assert.equal(sourceFeedbackViewModel.widgetMap.w_bar_origin.viewState.analysisOrigin, 'Europe')
    assert.equal(syncWorkspacePrimarySelection(session.runtimeSessionKey, {
      sourceWidgetId: 'w_parallel_cars',
      selectionId: 'toyota-corona-mark-ii',
      kind: 'point',
      summary: 'Car: Toyota Corona Mark II',
      predicates: [{ field: 'id', op: 'equals', value: 'toyota-corona-mark-ii' }],
      values: ['toyota-corona-mark-ii'],
    }), true)
    const parallelFilteredViewModel = createWorkspaceViewModel({
      ...session,
      coordinationState: readWorkspaceCoordinationState(session.runtimeSessionKey),
    })
    assert.equal(parallelFilteredViewModel.filteredRows.length, 1)
    assert.equal(parallelFilteredViewModel.filteredRows[0].id, 'toyota-corona-mark-ii')
    assert.equal(parallelFilteredViewModel.widgetMap.w_scatter_cars.derivedData.length, 1)
    assert.equal(parallelFilteredViewModel.widgetMap.w_scatter_cars.derivedData[0].id, 'toyota-corona-mark-ii')
    assert.equal(syncWorkspacePrimarySelection(session.runtimeSessionKey, {
      sourceWidgetId: 'w_sankey_cars',
      selectionId: 'cylinders:4',
      kind: 'point',
      summary: 'Sankey cylinders: 4',
      predicates: [{ field: 'cylinders', op: 'equals', value: 4 }],
      values: [4],
    }), true)
    const sankeyFilteredViewModel = createWorkspaceViewModel({
      ...session,
      coordinationState: readWorkspaceCoordinationState(session.runtimeSessionKey),
    })
    assert.equal(sankeyFilteredViewModel.filteredRows.every((row) => row.cylinders === 4), true)
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('createWorkspaceViewModel respects propagation policy overrides without forcing filter behavior', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const baseState = createFreshBaseSession()
  try {
    const state = {
      ...baseState,
      coordinationState: {
        selections: {
          registry: {
            'selection://widgetva-system/w_heatmap_origin_cyl/cell': {
              selectionRef: 'selection://widgetva-system/w_heatmap_origin_cyl/cell',
              sourceWidgetId: 'w_heatmap_origin_cyl',
              predicates: [
                { field: 'origin', op: 'equals', value: 'Japan' },
                { field: 'cylinders', op: 'equals', value: 4 },
              ],
              summary: 'Japan / 4 cyl',
            },
            'selection://widgetva-system/w_parallel_cars/focus': {
              selectionRef: 'selection://widgetva-system/w_parallel_cars/focus',
              sourceWidgetId: 'w_sankey_cars',
              predicates: [
                { field: 'id', op: 'equals', value: 'toyota-corona-mark-ii' },
              ],
              summary: 'Car: Toyota Corona Mark II',
            },
          },
          views: {
            primary: {
              selectionRef: 'selection://widgetva-system/w_heatmap_origin_cyl/cell',
              sourceWidgetId: 'w_heatmap_origin_cyl',
              predicates: [
                { field: 'origin', op: 'equals', value: 'Japan' },
                { field: 'cylinders', op: 'equals', value: 4 },
              ],
              summary: 'Japan / 4 cyl',
            },
            byWidget: {
              w_heatmap_origin_cyl: {
                selectionRef: 'selection://widgetva-system/w_heatmap_origin_cyl/cell',
              },
            },
          },
        },
        links: {
          definitions: [
            {
              sourceWidgetId: 'w_heatmap_origin_cyl',
              targetWidgetId: 'w_bar_origin',
              primitive: 'filter',
              effect: 'applyFilter',
              activationPolicy: 'automatic',
              effectConstraint: 'highlightOnly',
            },
          ],
          topology: {},
        },
      },
    }
    const highlightedViewModel = createWorkspaceViewModel(state)
    assert.equal(highlightedViewModel.widgetMap.w_bar_origin.viewState.analysisOrigin, 'Japan')
    assert.equal(highlightedViewModel.widgetMap.w_bar_origin.derivedData.length > 1, true)
    assert.equal(highlightedViewModel.filteredRows.length < baseState.dataset.rowsData.length, true)

    const focusState = {
      ...baseState,
      coordinationState: {
        selections: {
          registry: {
            'selection://widgetva-system/w_parallel_cars/focus': {
              selectionRef: 'selection://widgetva-system/w_parallel_cars/focus',
              sourceWidgetId: 'w_parallel_cars',
              predicates: [
                { field: 'id', op: 'equals', value: 'toyota-corona-mark-ii' },
              ],
              summary: 'Car: Toyota Corona Mark II',
            },
          },
          views: {
            primary: {
              selectionRef: 'selection://widgetva-system/w_parallel_cars/focus',
              sourceWidgetId: 'w_sankey_cars',
              predicates: [
                { field: 'id', op: 'equals', value: 'toyota-corona-mark-ii' },
              ],
              summary: 'Car: Toyota Corona Mark II',
            },
            byWidget: {
              w_sankey_cars: {
                selectionRef: 'selection://widgetva-system/w_parallel_cars/focus',
              },
            },
          },
        },
        links: {
          definitions: [
            {
              sourceWidgetId: 'w_sankey_cars',
              targetWidgetId: 'w_parallel_cars',
              primitive: 'filter',
              effect: 'applyFilter',
              activationPolicy: 'automatic',
              effectConstraint: 'focusOnly',
            },
          ],
          topology: {},
        },
      },
    }
    const focusedViewModel = createWorkspaceViewModel(focusState)
    assert.equal(focusedViewModel.widgetMap.w_parallel_cars.viewState.focusedCarId, 'toyota-corona-mark-ii')
    assert.equal(focusedViewModel.widgetMap.w_parallel_cars.derivedData.length > 1, true)
  } finally {
    disposeRuntimeSession(baseState.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('readSelectionPropagationSummary distinguishes declared effects from policy-constrained applied effects', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createFreshBaseSession()
  try {
    const runtimeSession = getRuntimeSession(session.runtimeSessionKey)
    const links = runtimeSession.workspace.listLinks()
    for (const link of links) {
      runtimeSession.workspace.removeLink(link.ref)
    }
    runtimeSession.workspace.registerLink({
      linkId: 'bar_to_scatter_highlight_only',
      sourceWidgetId: 'w_bar_origin',
      targetWidgetId: 'w_scatter_cars',
      primitive: 'filter',
      effect: 'applyFilter',
      activationPolicy: 'automatic',
      effectConstraint: 'highlightOnly',
    })
    assert.equal(syncWorkspacePrimarySelection(session.runtimeSessionKey, {
      sourceWidgetId: 'w_bar_origin',
      selectionId: 'origin',
      kind: 'point',
      summary: 'Origin: Europe',
      predicates: [{ field: 'origin', op: 'equals', value: 'Europe' }],
      values: ['Europe'],
    }), true)
    const summary = readSelectionPropagationSummary(session.runtimeSessionKey)
    assert.equal(summary.linkCount, 1)
    assert.equal(summary.activatedLinks[0]?.effect, 'applyFilter')
    assert.equal(summary.activatedLinks[0]?.appliedEffect, 'applyHighlight')
    assert.equal(summary.activatedLinks[0]?.activationPolicy, 'automatic')
    assert.equal(summary.activatedLinks[0]?.effectConstraint, 'highlightOnly')
    assert.equal(summary.affectedTargets[0]?.effect, 'applyHighlight')
    assert.equal(summary.affectedTargets[0]?.declaredEffect, 'applyFilter')
    assert.equal(summary.affectedTargets[0]?.activationPolicy, 'automatic')
    assert.equal(summary.affectedTargets[0]?.effectConstraint, 'highlightOnly')
    assert.equal(summary.affectedTargets[0]?.verification?.preferredReadMethod, 'readVerificationState')
    assert.equal(summary.affectedTargets[0]?.verificationGuidance?.verificationType, 'highlight')
    assert.equal(summary.affectedTargets[0]?.verificationGuidance?.effectChecks.includes('feedback.highlightKeyCount'), true)
    assert.equal(summary.verificationGuidance[0]?.verificationType, 'highlight')
    assert.equal(summary.verificationSteps[0]?.verificationType, 'highlight')
    assert.equal(summary.verificationSteps[0]?.instruction.includes('readVerificationState'), true)
    const operationResult = buildSelectionOperationResult(session.runtimeSessionKey, { changed: true })
    assert.equal(operationResult.verificationResults[0]?.verificationType, 'highlight')
    assert.equal(Object.hasOwn(operationResult.verificationResults[0]?.checks, 'feedback.highlightKeyCount'), true)
    assert.equal(operationResult.verification.status, 'verified')
    const latestCoordinationResult = readLatestCoordinationResult(session.runtimeSessionKey)
    assert.equal(latestCoordinationResult.verification.status, 'verified')
    assert.equal(latestCoordinationResult.propagationSummary.affectedTargets[0]?.effectConstraint, 'highlightOnly')
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('readSelectionPropagationSummary exposes canonical skipped-target reasons to the app layer', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createFreshBaseSession()
  try {
    const runtimeSession = getRuntimeSession(session.runtimeSessionKey)
    const links = runtimeSession.workspace.listLinks()
    for (const link of links) {
      runtimeSession.workspace.removeLink(link.ref)
    }
    runtimeSession.workspace.registerLink({
      linkId: 'bar_to_scatter_manual',
      sourceWidgetId: 'w_bar_origin',
      targetWidgetId: 'w_scatter_cars',
      primitive: 'filter',
      effect: 'applyFilter',
      activationPolicy: 'manual',
      effectConstraint: null,
    })
    assert.equal(syncWorkspacePrimarySelection(session.runtimeSessionKey, {
      sourceWidgetId: 'w_bar_origin',
      selectionId: 'origin',
      kind: 'point',
      summary: 'Origin: Europe',
      predicates: [{ field: 'origin', op: 'equals', value: 'Europe' }],
      values: ['Europe'],
    }), true)

    const summary = readSelectionPropagationSummary(session.runtimeSessionKey)
    assert.equal(summary.skippedTargets.length > 0, true)
    assert.equal(summary.skippedTargets[0]?.reason, 'manualLink')
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('appendRuntimeTraceStep and appendAgentMessage write normalized session history', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createFreshBaseSession()

  try {
    const traceStep = appendRuntimeTraceStep(session.runtimeSessionKey, {
      actor: 'agent',
      kind: 'perception',
      widgetTitle: 'Average Horsepower by Origin',
      summary: 'Verified the current origin aggregate.',
      stateDelta: { evidence: true },
    })
    const agentMessage = appendAgentMessage(session.runtimeSessionKey, {
      role: 'assistant',
      text: 'I verified the current origin aggregate before recommending a next action.',
    })

    assert.equal(typeof traceStep?.id, 'string')
    assert.equal(traceStep?.actor, 'agent')
    assert.equal(traceStep?.kind, 'perception')
    assert.equal(traceStep?.status, 'ok')
    assert.equal(traceStep?.stateDelta?.evidence, true)
    assert.equal(traceStep?.stateDelta?.selection, false)
    assert.equal(readRuntimeTrace(session.runtimeSessionKey).at(-1)?.id, traceStep?.id)

    assert.equal(typeof agentMessage?.id, 'string')
    assert.equal(agentMessage?.role, 'assistant')
    assert.equal(agentMessage?.text.includes('origin aggregate'), true)
    assert.equal(readAgentMessages(session.runtimeSessionKey).at(-1)?.id, agentMessage?.id)
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('appendRuntimeTraceStep preserves lineage fields and keeps replay-derived branch context stable', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createFreshBaseSession()

  try {
    const initialStateId = readWorkspaceCoordinationState(session.runtimeSessionKey)?.stateId
    assert.equal(typeof initialStateId, 'string')

    const firstActionResult = await executeWorkspaceAction(session.runtimeSessionKey, {
      widgetId: 'w_bar_origin',
      name: 'bar.selectCategory',
      params: {
        field: 'origin',
        values: ['USA'],
      },
    })
    const firstActionStep = appendRuntimeTraceStep(session.runtimeSessionKey, {
      actor: 'human',
      kind: 'action',
      widgetTitle: 'Average Horsepower by Origin',
      summary: 'Selected USA in origin chart.',
      sourceStateId: initialStateId,
      resultStateId: firstActionResult?.stateId || null,
    })

    assert.equal(firstActionStep?.transitionType, 'continuation')
    assert.equal(firstActionStep?.sourceStateId, initialStateId)
    assert.equal(firstActionStep?.resultStateId, firstActionResult?.stateId || null)
    assert.equal(typeof firstActionStep?.branchId, 'string')
    assert.equal(firstActionStep?.branchId.length > 0, true)

    await jumpWorkspaceToState(session.runtimeSessionKey, initialStateId)
    const replayStep = appendRuntimeTraceStep(session.runtimeSessionKey, {
      actor: 'human',
      kind: 'replay',
      widgetTitle: 'Workspace',
      summary: 'Returned to the initial workspace state.',
      sourceStateId: firstActionResult?.stateId || null,
      resultStateId: initialStateId,
      stateDelta: { branch: true, viewport: true },
    })

    assert.equal(replayStep?.transitionType, 'branch')
    assert.equal(replayStep?.branchFromStateId, initialStateId)
    assert.equal(typeof replayStep?.branchId, 'string')
    assert.equal(replayStep?.branchId.startsWith('trace_branch_'), true)

    const secondActionResult = await executeWorkspaceAction(session.runtimeSessionKey, {
      widgetId: 'w_line_year',
      name: 'line.selectXValue',
      params: {
        field: 'year',
        value: 1971,
      },
    })
    const branchStep = appendRuntimeTraceStep(session.runtimeSessionKey, {
      actor: 'agent',
      kind: 'action',
      widgetTitle: 'MPG Trend by Model Year',
      summary: 'Followed an alternate path from the restored state.',
      sourceStateId: initialStateId,
      resultStateId: secondActionResult?.stateId || null,
    })

    assert.equal(branchStep?.transitionType, 'branch')
    assert.equal(branchStep?.branchFromStateId, initialStateId)
    assert.equal(branchStep?.branchId, replayStep?.branchId)
    assert.equal(branchStep?.parentStepId, replayStep?.id)
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('workspace history helpers restore app-facing interaction bindings through jumpToState', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createFreshBaseSession()

  try {
    syncWorkspaceGlobalFilters(session.runtimeSessionKey, {
      ...session,
      analysisOrigin: 'USA',
      analysisYear: 1971,
      analysisCylinders: [8],
      horsepowerMin: 80,
      horsepowerMax: 160,
    })
    syncWorkspacePrimarySelection(session.runtimeSessionKey, {
      sourceWidgetId: 'w_parallel_cars',
      selectionId: 'ford-maverick',
      kind: 'point',
      summary: 'Car: Ford Maverick',
      predicates: [{ field: 'id', op: 'equals', value: 'ford-maverick' }],
      values: ['ford-maverick'],
    })

    const beforeRestore = readWorkspaceInteractionBindings(session.runtimeSessionKey, {
      dataset: session.dataset,
      fallbackSelectedWidgetId: 'w_scatter_cars',
    })
    assert.equal(beforeRestore.analysisOrigin, 'USA')
    assert.equal(beforeRestore.analysisYear, 1971)
    assert.deepEqual(beforeRestore.analysisCylinders, [8])
    assert.equal(beforeRestore.focusedCarId, 'ford-maverick')

    const history = readWorkspaceStateHistory(session.runtimeSessionKey, { limit: 50 })
    assert.equal(history.length > 1, true)

    const earliestStateId = history[0]?.stateId
    assert.equal(typeof earliestStateId, 'string')
    await jumpWorkspaceToState(session.runtimeSessionKey, earliestStateId)

    const restoredBindings = readWorkspaceInteractionBindings(session.runtimeSessionKey, {
      dataset: session.dataset,
      fallbackSelectedWidgetId: 'w_scatter_cars',
    })
    assert.equal(restoredBindings.analysisOrigin, 'All')
    assert.equal(restoredBindings.analysisYear, 'All')
    assert.deepEqual(restoredBindings.analysisCylinders, [])
    assert.equal(restoredBindings.focusedCarId, null)
    assert.equal(typeof restoredBindings.selectedWidgetId, 'string')
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('promotePrimarySelectionToGlobalFilters commits supported selections into canonical workspace filters', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createFreshBaseSession()

  try {
    assert.equal(syncWorkspacePrimarySelection(session.runtimeSessionKey, {
      sourceWidgetId: 'w_heatmap_origin_cyl',
      selectionId: 'cell',
      kind: 'point',
      summary: 'Origin USA · 8 cyl',
      predicates: [
        { field: 'origin', op: 'equals', value: 'USA' },
        { field: 'cylinders', op: 'equals', value: 8 },
      ],
      values: ['USA', 8],
    }), true)
    const result = promotePrimarySelectionToGlobalFilters(session.runtimeSessionKey, session)
    assert.equal(result.changed, true)
    assert.deepEqual(result.nextFilterState, {
      analysisOrigin: 'USA',
      analysisCylinders: [8],
    })
    const coordinationState = readWorkspaceCoordinationState(session.runtimeSessionKey)
    assert.deepEqual(coordinationState?.globalFilters, {
      origin: 'USA',
      cylinders: [8],
    })
    assert.equal(coordinationState?.selections?.views?.primary, null)
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('promotePrimarySelectionToHighlight commits shared highlight state and clears primary selection', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createFreshBaseSession()

  try {
    assert.equal(syncWorkspacePrimarySelection(session.runtimeSessionKey, {
      sourceWidgetId: 'w_bar_origin',
      selectionId: 'origin',
      kind: 'point',
      summary: 'Origin: Europe',
      predicates: [{ field: 'origin', op: 'equals', value: 'Europe' }],
      values: ['Europe'],
    }), true)

    const result = promotePrimarySelectionToHighlight(session.runtimeSessionKey)
    assert.equal(result.changed, true)

    const coordinationState = readWorkspaceCoordinationState(session.runtimeSessionKey)
    assert.equal(Array.isArray(coordinationState?.highlight?.entries), true)
    assert.equal(coordinationState?.highlight?.entries?.length > 0, true)
    assert.equal(coordinationState?.highlight?.entries?.[0]?.summary, 'Origin: Europe')
    assert.equal(coordinationState?.highlight?.entries?.[0]?.sourceWidgetId, 'w_bar_origin')
    assert.equal(coordinationState?.highlight?.entries?.[0]?.highlightedKeys?.includes('Europe'), true)
    assert.equal(coordinationState?.selections?.views?.primary, null)

    const latestCoordinationResult = readLatestCoordinationResult(session.runtimeSessionKey)
    assert.equal(latestCoordinationResult?.changed, true)
    assert.equal(latestCoordinationResult?.verification?.status, 'not_applicable')
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('executeWorkspaceAction mutates runtime-owned widget state for exposed analytical controls', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createFreshBaseSession()
  const runtimeSession = getRuntimeSession(session.runtimeSessionKey)

  try {
    const checks = [
      ['w_scatter_cars', 'scatter.showRegression', { method: 'linear' }],
      ['w_bar_origin', 'bar.highlightTopN', { n: 2, order: 'descending' }],
      ['w_line_year', 'line.highlightTrend', { trendType: 'regression' }],
      ['w_line_year', 'line.showMovingAverage', { windowSize: 3 }],
      ['w_heatmap_origin_cyl', 'heatmap.clusterRowsCols', { clusterRows: true, clusterCols: true, method: 'mean' }],
      ['w_parallel_cars', 'parallelCoordinates.hideDimensions', { dimensions: ['weight', 'acceleration'], mode: 'hide' }],
      ['w_sankey_cars', 'sankey.traceNode', { nodeName: 'origin:USA' }],
      ['w_sankey_cars', 'sankey.autoCollapseByRank', { topN: 2 }],
    ]

    for (const [widgetId, actionName, params] of checks) {
      const widget = runtimeSession.workspace.getWidget(widgetId)
      const before = JSON.stringify(widget.readState())
      const result = await executeWorkspaceAction(session.runtimeSessionKey, {
        widgetId,
        name: actionName,
        params,
      })
      const after = JSON.stringify(widget.readState())
      assert.equal(result?.ok, true, `${actionName} should succeed`)
      assert.equal(before !== after, true, `${actionName} should mutate runtime-owned widget state`)
    }
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('canonical widget selection actions drive first-party linked filtering for in/between predicates', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createFreshBaseSession()

  try {
    await executeWorkspaceAction(session.runtimeSessionKey, {
      widgetId: 'w_bar_origin',
      name: 'bar.selectCategory',
      params: {
        field: 'origin',
        values: ['Japan'],
      },
    })
    let viewModel = createWorkspaceViewModel({
      ...session,
      coordinationState: readWorkspaceCoordinationState(session.runtimeSessionKey),
    })
    assert.equal(viewModel.filteredRows.every((row) => row.origin === 'Japan'), true)

    await executeWorkspaceAction(session.runtimeSessionKey, {
      widgetId: 'w_scatter_cars',
      name: 'scatter.brushRegion',
      params: {
        xField: 'horsepower',
        yField: 'mpg',
        xRange: [80, 140],
        yRange: [18, 30],
      },
    })
    viewModel = createWorkspaceViewModel({
      ...session,
      coordinationState: readWorkspaceCoordinationState(session.runtimeSessionKey),
    })
    assert.equal(
      viewModel.filteredRows.every((row) => (
        row.horsepower >= 80
        && row.horsepower <= 140
        && row.mpg >= 18
        && row.mpg <= 30
      )),
      true,
    )

    await executeWorkspaceAction(session.runtimeSessionKey, {
      widgetId: 'w_line_year',
      name: 'line.selectXValue',
      params: {
        field: 'year',
        value: 1971,
      },
    })
    viewModel = createWorkspaceViewModel({
      ...session,
      coordinationState: readWorkspaceCoordinationState(session.runtimeSessionKey),
    })
    assert.equal(viewModel.filteredRows.every((row) => row.year === 1971), true)

    await executeWorkspaceAction(session.runtimeSessionKey, {
      widgetId: 'w_parallel_cars',
      name: 'parallelCoordinates.selectRecord',
      params: {
        field: 'id',
        recordId: 'toyota-corolla-1200',
      },
    })
    viewModel = createWorkspaceViewModel({
      ...session,
      coordinationState: readWorkspaceCoordinationState(session.runtimeSessionKey),
    })
    assert.equal(viewModel.filteredRows.length, 1)
    assert.equal(viewModel.filteredRows[0].id, 'toyota-corolla-1200')

    await executeWorkspaceAction(session.runtimeSessionKey, {
      widgetId: 'w_sankey_cars',
      name: 'sankey.focusFlow',
      params: {
        field: 'origin',
        values: ['Europe'],
      },
    })
    viewModel = createWorkspaceViewModel({
      ...session,
      coordinationState: readWorkspaceCoordinationState(session.runtimeSessionKey),
    })
    assert.equal(viewModel.filteredRows.every((row) => row.origin === 'Europe'), true)
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('line-linked selections surface the first-party advanced reencode response on the heatmap view model', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createFreshBaseSession()

  try {
    assert.equal(syncWorkspacePrimarySelection(session.runtimeSessionKey, {
      sourceWidgetId: 'w_line_year',
      selectionId: 'year',
      kind: 'point',
      summary: 'Year: 1971',
      predicates: [{ field: 'year', op: 'equals', value: 1971 }],
      values: [1971],
    }), true)
    const viewModel = createWorkspaceViewModel({
      ...session,
      coordinationState: readWorkspaceCoordinationState(session.runtimeSessionKey),
    })
    assert.equal(viewModel.filteredRows.every((row) => row.year === 1971), true)
    assert.equal(viewModel.widgetMap.w_heatmap_origin_cyl.viewState.analyticalOverlay?.kind, 'heatmapTranspose')
    const transposedSpec = buildHeatmapSpec(
      viewModel.widgetMap.w_heatmap_origin_cyl.derivedData,
      viewModel.widgetMap.w_heatmap_origin_cyl.viewState,
      viewModel.widgetMap.w_heatmap_origin_cyl.viewState,
    )
    assert.equal(transposedSpec.encoding.x.field, 'origin')
    assert.equal(transposedSpec.encoding.y.field, 'cylinders')
    assert.equal(transposedSpec._transpose_state?.transposed, true)
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('bar-linked selections surface the first-party aggregate response on the sankey view model', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createFreshBaseSession()

  try {
    assert.equal(syncWorkspacePrimarySelection(session.runtimeSessionKey, {
      sourceWidgetId: 'w_bar_origin',
      selectionId: 'origin',
      kind: 'point',
      summary: 'Origin: Japan',
      predicates: [{ field: 'origin', op: 'equals', value: 'Japan' }],
      values: ['Japan'],
    }), true)
    const viewModel = createWorkspaceViewModel({
      ...session,
      coordinationState: readWorkspaceCoordinationState(session.runtimeSessionKey),
    })
    assert.equal(viewModel.filteredRows.every((row) => row.origin === 'Japan'), true)
    assert.equal(viewModel.widgetMap.w_sankey_cars.viewState.analyticalOverlay?.kind, 'sankeyAutoCollapse')
    assert.equal(viewModel.widgetMap.w_sankey_cars.viewState.analyticalOverlay?.topN, 2)
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('bar-linked selections surface the first-party drilldown response on the line view model', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createFreshBaseSession()

  try {
    assert.equal(syncWorkspacePrimarySelection(session.runtimeSessionKey, {
      sourceWidgetId: 'w_bar_origin',
      selectionId: 'origin',
      kind: 'point',
      summary: 'Origin: Japan',
      predicates: [{ field: 'origin', op: 'equals', value: 'Japan' }],
      values: ['Japan'],
    }), true)
    const viewModel = createWorkspaceViewModel({
      ...session,
      coordinationState: readWorkspaceCoordinationState(session.runtimeSessionKey),
    })
    assert.equal(viewModel.filteredRows.every((row) => row.origin === 'Japan'), true)
    assert.equal(viewModel.widgetMap.w_line_year.viewState.analyticalOverlay?.kind, 'lineDrillDownRecords')
    assert.equal(viewModel.widgetMap.w_line_year.derivedData.length > 1, true)
    assert.equal(viewModel.widgetMap.w_line_year.derivedData.every((row) => row.origin === 'Japan'), true)
    const detailSpec = buildLineSpec(
      viewModel.widgetMap.w_line_year.derivedData,
      viewModel.widgetMap.w_line_year.viewState,
    )
    assert.equal(detailSpec.encoding.x.field, 'name')
    assert.equal(detailSpec.encoding.y.field, 'mpg')
    assert.equal(detailSpec._line_drilldown_state?.variant, 'recordsByModel')
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('line-linked selections surface the first-party structure collapse response on the sankey view model', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createFreshBaseSession()

  try {
    assert.equal(syncWorkspacePrimarySelection(session.runtimeSessionKey, {
      sourceWidgetId: 'w_line_year',
      selectionId: 'year',
      kind: 'point',
      summary: 'Year: 1971',
      predicates: [{ field: 'year', op: 'equals', value: 1971 }],
      values: [1971],
    }), true)
    const viewModel = createWorkspaceViewModel({
      ...session,
      coordinationState: readWorkspaceCoordinationState(session.runtimeSessionKey),
    })
    assert.equal(viewModel.filteredRows.every((row) => row.year === 1971), true)
    assert.equal(viewModel.widgetMap.w_sankey_cars.viewState.analyticalOverlay?.kind, 'sankeyCollapseNodes')
    assert.deepEqual(viewModel.widgetMap.w_sankey_cars.viewState.analyticalOverlay?.nodes, ['origin:Japan', 'origin:Europe'])
    assert.equal(viewModel.widgetMap.w_sankey_cars.derivedData.nodes.some((node) => node.id === 'origin:other'), true)
    assert.equal(viewModel.widgetMap.w_sankey_cars.derivedData.nodes.some((node) => node.id === 'origin:Japan'), false)
    assert.equal(viewModel.widgetMap.w_sankey_cars.derivedData.nodes.some((node) => node.id === 'origin:Europe'), false)
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('scatter-linked selections surface the first-party structure expand response on the sankey view model', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createFreshBaseSession()

  try {
    const rows = session.dataset.rowsData || []
    const horsepowerValues = rows.map((row) => row.horsepower).filter(Number.isFinite)
    const mpgValues = rows.map((row) => row.mpg).filter(Number.isFinite)
    assert.equal(syncScatterBrushSelection(session.runtimeSessionKey, {
      horsepower: [Math.min(...horsepowerValues), Math.max(...horsepowerValues)],
      mpg: [Math.min(...mpgValues), Math.max(...mpgValues)],
    }), true)
    const viewModel = createWorkspaceViewModel({
      ...session,
      coordinationState: readWorkspaceCoordinationState(session.runtimeSessionKey),
    })
    assert.equal(viewModel.widgetMap.w_sankey_cars.viewState.analyticalOverlay?.kind, 'sankeyAutoCollapse')
    assert.deepEqual(viewModel.widgetMap.w_sankey_cars.viewState.analyticalOverlay?.expandedAggregateIds, ['collapsed:0:other'])
    assert.equal(viewModel.widgetMap.w_sankey_cars.derivedData.nodes.some((node) => node.id === 'origin:Europe'), true)
    assert.equal(viewModel.widgetMap.w_sankey_cars.derivedData.nodes.some((node) => node.id === 'collapsed:0:other'), false)
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('heatmap-linked selections surface the first-party reorder response on the sankey view model', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createFreshBaseSession()

  try {
    assert.equal(syncWorkspacePrimarySelection(session.runtimeSessionKey, {
      sourceWidgetId: 'w_heatmap_origin_cyl',
      selectionId: 'cell',
      kind: 'point',
      summary: 'Origin Japan · 4 cyl',
      predicates: [
        { field: 'origin', op: 'equals', value: 'Japan' },
        { field: 'cylinders', op: 'equals', value: 4 },
      ],
      values: ['Japan', 4],
    }), true)
    const viewModel = createWorkspaceViewModel({
      ...session,
      coordinationState: readWorkspaceCoordinationState(session.runtimeSessionKey),
    })
    assert.equal(viewModel.widgetMap.w_sankey_cars.viewState.analyticalOverlay?.kind, 'sankeyReorderLayer')
    assert.equal(viewModel.widgetMap.w_sankey_cars.viewState.analyticalOverlay?.depth, 0)
    assert.equal(viewModel.widgetMap.w_sankey_cars.viewState.analyticalOverlay?.order?.[0], 'origin:Japan')
    assert.equal(viewModel.widgetMap.w_sankey_cars.derivedData.nodes.find((node) => node.column === 0)?.id, 'origin:Japan')
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('scatter viewport coordination surfaces the first-party syncDomain response on the line view model', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createFreshBaseSession()

  try {
    assert.equal(syncScatterBrushSelection(session.runtimeSessionKey, {
      horsepower: [80, 140],
      mpg: [18, 30],
    }), true)
    const viewModel = createWorkspaceViewModel({
      ...session,
      coordinationState: readWorkspaceCoordinationState(session.runtimeSessionKey),
    })
    assert.deepEqual(viewModel.widgetMap.w_line_year.viewState.yDomain, [18, 30])
    const syncedSpec = buildLineSpec(
      viewModel.widgetMap.w_line_year.derivedData,
      viewModel.widgetMap.w_line_year.viewState,
    )
    assert.deepEqual(syncedSpec.encoding.y.scale?.domain, [18, 30])
  } finally {
    disposeRuntimeSession(session.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})

test('createWorkspaceViewModel projects live provider payloads for a whole-provider environment workspace', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const baseSession = createFreshBaseSession()

  try {
    registerWorkspaceProviderEnvironment(baseSession.runtimeSessionKey, 'echarts')
    const session = createInitialSessionState(baseSession.runtimeSessionKey)

    assert.equal(syncWorkspacePrimarySelection(session.runtimeSessionKey, {
      sourceWidgetId: 'w_bar_origin',
      selectionId: 'origin',
      kind: 'point',
      summary: 'Origin: Japan',
      predicates: [{ field: 'origin', op: 'equals', value: 'Japan' }],
      values: ['Japan'],
    }), true)

    const viewModel = createWorkspaceViewModel({
      ...session,
      coordinationState: readWorkspaceCoordinationState(session.runtimeSessionKey),
    })

    const widgets = Object.values(viewModel.widgetMap || {})
    assert.equal(widgets.length, 6)
    assert.equal(widgets.every((widget) => widget.providerSpec?.provider === 'echarts'), true)
    assert.equal(viewModel.widgetMap.w_scatter_cars.providerSpec?.optionType, 'scatter')
    assert.equal(viewModel.widgetMap.w_bar_origin.providerSpec?.optionType, 'bar')
    assert.equal(viewModel.widgetMap.w_line_year.providerSpec?.optionType, 'line')
    assert.equal(viewModel.widgetMap.w_heatmap_origin_cyl.providerSpec?.optionType, 'heatmap')
    assert.equal(viewModel.widgetMap.w_parallel_cars.providerSpec?.optionType, 'parallelCoordinates')
    assert.equal(viewModel.widgetMap.w_sankey_cars.providerSpec?.optionType, 'sankey')
    assert.equal(Array.isArray(viewModel.widgetMap.w_bar_origin.providerSpec?.option?.series?.[0]?.data), true)
    assert.equal(Array.isArray(viewModel.widgetMap.w_sankey_cars.providerSpec?.option?.series?.[0]?.links), true)
  } finally {
    disposeRuntimeSession(baseSession.runtimeSessionKey)
    globalThis.window = previousWindow
  }
})
