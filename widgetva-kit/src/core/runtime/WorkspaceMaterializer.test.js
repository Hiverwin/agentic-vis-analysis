import test from 'node:test'
import assert from 'node:assert/strict'

import { makeCurrentSelectionDataRef, makeCurrentViewDataRef, makeWidgetRef } from '../protocol/refs.js'
import { materializeWorkspace } from './WorkspaceMaterializer.js'

test('materializeWorkspace exposes current_selection as a shared data handle and summarizeSelection target', () => {
  const currentSelectionDataRef = makeCurrentSelectionDataRef()
  const widgetId = 'session_test-session'
  const selectionRef = `wl://widgetva-app/workspace/main/widget/${widgetId}/selection/brush`
  const workspace = materializeWorkspace({
    appId: 'widgetva-app',
    workspaceId: 'main',
    sessionId: 'test-session',
    spec: {
      data: {
        values: [
          { Horsepower: 130, Origin: 'USA' },
          { Horsepower: 95, Origin: 'Japan' },
        ],
      },
      mark: 'point',
      encoding: {
        x: { field: 'Horsepower', type: 'quantitative' },
        y: { field: 'Horsepower', type: 'quantitative' },
        color: { field: 'Origin', type: 'nominal' },
      },
    },
    selection: {
      source_widget_id: widgetId,
      selection_id: 'brush',
      selection_type: 'point',
      predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
      summary: 'Origin: USA',
    },
  })

  const currentSelectionHandle = workspace.description.dataHandles.find((handle) => handle?.ref === currentSelectionDataRef)
  const summarizeSelectionDescriptor = workspace.description.perceptionQueries.find(
    (descriptor) => descriptor?.name === 'perception.summarizeSelection',
  )
  const brushActionDescriptor = workspace.description.actions.find(
    (descriptor) => descriptor?.name === 'scatter.brushRegion',
  )
  const clearSelectionDescriptor = workspace.description.actions.find(
    (descriptor) => descriptor?.name === 'widget.clearSelection',
  )
  const updateSelectionDescriptor = workspace.description.actions.find(
    (descriptor) => descriptor?.name === 'widget.updateSelection',
  )
  const focusWidgetDescriptor = workspace.description.actions.find(
    (descriptor) => descriptor?.name === 'workspace.focusWidget',
  )
  const addAnnotationDescriptor = workspace.description.actions.find(
    (descriptor) => descriptor?.name === 'workspace.addAnnotation',
  )
  const zoomDomainDescriptor = workspace.description.actions.find(
    (descriptor) => descriptor?.name === 'widget.zoomDomain',
  )

  assert.ok(currentSelectionHandle)
  assert.equal(currentSelectionHandle.scope, 'workspaceCurrent')
  assert.equal(currentSelectionHandle.sourceSelectionRef, selectionRef)
  assert.equal(currentSelectionHandle.supportedQueries?.includes('schema'), true)
  assert.equal(summarizeSelectionDescriptor?.targetRef, currentSelectionDataRef)
  assert.deepEqual(brushActionDescriptor?.supportedWidgetKinds, ['scatter'])
  assert.deepEqual(clearSelectionDescriptor?.affectedStatePaths, ['selections'])
  assert.deepEqual(updateSelectionDescriptor?.affectedStatePaths, ['selections'])
  assert.deepEqual(focusWidgetDescriptor?.affectedStatePaths, ['shared.focusedWidget'])
  assert.deepEqual(addAnnotationDescriptor?.affectedStatePaths, ['shared.annotations'])
  assert.deepEqual(zoomDomainDescriptor?.affectedStatePaths, ['view.xDomain', 'view.yDomain', 'view.zoom'])
  assert.deepEqual(clearSelectionDescriptor?.supportedWidgetKinds, ['scatter'])
  assert.equal(updateSelectionDescriptor?.paramsSchema?.properties?.field?.type, 'string')
  assert.equal(updateSelectionDescriptor?.paramsSchema?.properties?.values?.type, 'array')
  assert.equal(updateSelectionDescriptor?.paramsSchema?.properties?.keyField?.type, 'string')
  assert.equal(updateSelectionDescriptor?.paramsSchema?.properties?.keys?.type, 'array')
  assert.equal(workspace.description.runtimeTopology?.topology, 'T1')
  assert.equal(Array.isArray(workspace.description.widgetAdapters), true)
  assert.equal(workspace.description.widgetAdapters[0]?.provider, 'vega-lite')
  assert.equal(workspace.description.widgetAdapters[0]?.title, widgetId)
  assert.deepEqual(
    workspace.description.widgetAdapters[0]?.analyticRoles,
    ['correlate', 'cluster', 'outlier', 'distribution'],
  )
  assert.equal(
    workspace.description.widgetAdapters[0]?.primaryDataRef,
    'wl://widgetva-app/workspace/main/data/primary',
  )
  assert.equal(workspace.description.widgetAdapters[0]?.sourceKind, 'baseSpec')
  assert.equal(workspace.description.widgetAdapters[0]?.supportsSpecMutation, true)
  assert.equal(workspace.description.widgetAdapters[0]?.humanInteraction?.mode, 'brush2d')
  const widgetState = workspace.state.widgets[makeWidgetRef({ widgetId })]
  assert.equal(widgetState?.humanInteraction?.mode, 'brush2d')
  assert.equal(widgetState?.humanInteraction?.actionName, 'scatter.brushRegion')
  assert.deepEqual(
    workspace.description.transportHints?.recommendedTools,
    ['workspace_describe', 'view_read', 'action_run', 'perception_query', 'interaction_trace_read'],
  )
  assert.deepEqual(
    workspace.description.transportHints?.optionalTools,
    [
      'data_query',
      'workspace_plan',
      'agent_loop_describe',
      'trace_graph_read',
      'read_snapshot',
      'state_history_read',
      'branch_list',
      'workspace_snapshot_read',
      'verified_action_run',
      'jump_to_state',
      'branch_from_state',
      'link_propagation_evaluate',
      'response_recorder_describe',
      'agent_response_read',
      'agent_response_list',
      'agent_response_record',
    ],
  )
  assert.deepEqual(
    workspace.description.planning?.supportedTopologies,
    ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'],
  )
  assert.deepEqual(
    workspace.description.planning?.supportedRunModes,
    ['goal_oriented', 'open_ended', 'autonomous'],
  )
  assert.deepEqual(
    workspace.description.planning?.supportedComplexityBudgets,
    ['minimal', 'standard', 'extended'],
  )
  assert.deepEqual(
    workspace.description.planning?.supportedPlanSources,
    ['planner', 'runtime_default', 'workspace_spec'],
  )
  assert.deepEqual(
    workspace.description.planning?.supportedPlanningModes,
    ['topology_driven', 'minimal_default', 'explicit_spec'],
  )
  assert.equal(workspace.description.benchmarkSupport, undefined)
  const structuralKinds = workspace.description.links.map((link) => link.kind)
  assert.ok(structuralKinds.includes('usesData'))
  assert.ok(structuralKinds.includes('contains'))
  assert.ok(structuralKinds.includes('derivesFrom'))
})

test('materializeWorkspace preserves structured point selection fields in shared and widget state', () => {
  const widgetId = 'session_structured-selection'
  const widgetRef = makeWidgetRef({ widgetId })
  const selectionRef = `wl://widgetva-app/workspace/main/widget/${widgetId}/selection/row_focus`

  const workspace = materializeWorkspace({
    appId: 'widgetva-app',
    workspaceId: 'main',
    sessionId: 'structured-selection',
    spec: {
      kind: 'table',
      data: {
        values: [
          { Name: 'ford pinto', Origin: 'USA' },
          { Name: 'civic', Origin: 'Japan' },
        ],
      },
    },
    selection: {
      source_widget_id: widgetId,
      selection_id: 'row_focus',
      selection_type: 'point',
      keyField: 'Name',
      keys: ['ford pinto'],
      predicates: [{ field: 'Name', op: 'equals', value: 'ford pinto' }],
      summary: 'Focused row: ford pinto',
    },
  })

  const sharedSelection = workspace.state.shared?.activeSelections?.[selectionRef]
  const widgetSelection = workspace.state.widgets?.[widgetRef]?.selections?.[selectionRef]

  assert.equal(sharedSelection?.keyField, 'Name')
  assert.deepEqual(sharedSelection?.keys, ['ford pinto'])
  assert.equal(widgetSelection?.keyField, 'Name')
  assert.deepEqual(widgetSelection?.keys, ['ford pinto'])
})

test('materializeWorkspace preserves shared viewport state from the host/runtime input', () => {
  const workspace = materializeWorkspace({
    appId: 'widgetva-app',
    workspaceId: 'main',
    sessionId: 'viewport-session',
    spec: {
      data: {
        values: [
          { Horsepower: 130, MPG: 18 },
          { Horsepower: 95, MPG: 30 },
        ],
      },
      mark: 'point',
      encoding: {
        x: { field: 'Horsepower', type: 'quantitative' },
        y: { field: 'MPG', type: 'quantitative' },
      },
    },
    viewportState: {
      sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/session_viewport-session',
      xDomain: [80, 160],
      yDomain: [15, 35],
      zoom: {
        level: 2,
        center: [120, 25],
      },
    },
  })

  assert.deepEqual(workspace.state.shared?.viewport, {
    sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/session_viewport-session',
    xDomain: [80, 160],
    yDomain: [15, 35],
    zoom: {
      level: 2,
      center: [120, 25],
    },
  })
})

test('materializeWorkspace materializes shared focus and highlight slices as first-class coordination state', () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/session_focus-highlight'
  const workspace = materializeWorkspace({
    appId: 'widgetva-app',
    workspaceId: 'main',
    sessionId: 'focus-highlight',
    spec: {
      data: {
        values: [
          { Horsepower: 130, Origin: 'USA' },
          { Horsepower: 95, Origin: 'Japan' },
        ],
      },
      mark: 'point',
      encoding: {
        x: { field: 'Horsepower', type: 'quantitative' },
        y: { field: 'Horsepower', type: 'quantitative' },
        color: { field: 'Origin', type: 'nominal' },
      },
    },
    focusedWidgetRef: widgetRef,
    previousState: {
      widgets: {
        [widgetRef]: {
          ref: widgetRef,
          widgetId: 'session_focus-highlight',
          feedback: {
            highlightedKeys: ['USA'],
            inboundLinkIds: ['link://highlight'],
            highlightLinkIds: ['link://highlight'],
            linkedSourceRefs: ['wl://widgetva-app/workspace/main/widget/session_focus-highlight/selection/current'],
          },
        },
      },
      shared: {},
    },
  })

  assert.deepEqual(workspace.state.shared?.focus, {
    widgetRef,
    widgetId: 'session_focus-highlight',
    source: 'workspace',
  })
  assert.deepEqual(workspace.state.shared?.highlight, {
    entries: [{
      widgetRef,
      widgetId: 'session_focus-highlight',
      sourceWidgetRef: null,
      sourceWidgetId: null,
      selectionRef: null,
      summary: null,
      predicates: [],
      highlightedKeys: ['USA'],
      inboundLinkIds: ['link://highlight'],
      highlightLinkIds: ['link://highlight'],
      linkedSourceRefs: ['wl://widgetva-app/workspace/main/widget/session_focus-highlight/selection/current'],
    }],
    activeWidgetRefs: [widgetRef],
  })
})

test('materializeWorkspace exposes current_view as a shared data handle and visible perception targets', () => {
  const currentViewDataRef = makeCurrentViewDataRef()
  const workspace = materializeWorkspace({
    appId: 'widgetva-app',
    workspaceId: 'main',
    sessionId: 'test-session',
    spec: {
      data: {
        values: [
          { Horsepower: 130, Origin: 'USA' },
          { Horsepower: 95, Origin: 'Japan' },
        ],
      },
      mark: 'point',
      encoding: {
        x: { field: 'Horsepower', type: 'quantitative' },
        y: { field: 'Horsepower', type: 'quantitative' },
        color: { field: 'Origin', type: 'nominal' },
      },
    },
  })

  const currentViewHandle = workspace.description.dataHandles.find((handle) => handle?.ref === currentViewDataRef)
  const inspectVisibleDescriptor = workspace.description.perceptionQueries.find(
    (descriptor) => descriptor?.name === 'perception.inspectVisibleRows',
  )
  const summarizeVisibleDescriptor = workspace.description.perceptionQueries.find(
    (descriptor) => descriptor?.name === 'perception.summarizeVisible',
  )

  assert.ok(currentViewHandle)
  assert.equal(currentViewHandle.scope, 'workspaceCurrentView')
  assert.equal(currentViewHandle.supportedQueries?.includes('schema'), true)
  assert.equal(inspectVisibleDescriptor?.targetRef, currentViewDataRef)
  assert.equal(summarizeVisibleDescriptor?.targetRef, currentViewDataRef)
  assert.equal(workspace.description.runtimeTopology?.topology, 'T1')
  assert.equal(workspace.description.benchmarkSupport, undefined)
  assert.equal(workspace.description.taskContext?.taskMode, 'goal_oriented')
  assert.equal(workspace.description.taskContext?.coordinationScope, 'single_widget')
  assert.equal(Array.isArray(workspace.description.taskContext?.targetWidgetRefs), true)
  assert.equal(workspace.description.taskContext?.targetWidgetRefs?.length, 1)
})

test('materializeWorkspace derives zoom center and level from numeric view domains', () => {
  const widgetRef = makeWidgetRef({ widgetId: 'session_zoom-metadata' })
  const workspace = materializeWorkspace({
    appId: 'widgetva-app',
    workspaceId: 'main',
    sessionId: 'zoom-metadata',
    spec: {
      data: {
        values: [
          { Horsepower: 90, Miles_per_Gallon: 32 },
          { Horsepower: 130, Miles_per_Gallon: 24 },
          { Horsepower: 160, Miles_per_Gallon: 18 },
        ],
      },
      mark: 'point',
      encoding: {
        x: { field: 'Horsepower', type: 'quantitative', scale: { domain: [100, 150] } },
        y: { field: 'Miles_per_Gallon', type: 'quantitative', scale: { domain: [20, 30] } },
      },
    },
  })

  const view = workspace.state.widgets?.[widgetRef]?.view
  assert.deepEqual(view?.zoom?.center, [125, 25])
  assert.equal(view?.zoom?.level, 1.4)
})

test('materializeWorkspace derives view.sort from encoding sort rules', () => {
  const widgetRef = makeWidgetRef({ widgetId: 'session_sort-metadata' })
  const workspace = materializeWorkspace({
    appId: 'widgetva-app',
    workspaceId: 'main',
    sessionId: 'sort-metadata',
    spec: {
      data: {
        values: [
          { Origin: 'USA', count: 2 },
          { Origin: 'Japan', count: 1 },
        ],
      },
      mark: 'bar',
      encoding: {
        x: { field: 'Origin', type: 'nominal', sort: { field: 'count', order: 'descending' } },
        y: { field: 'count', type: 'quantitative' },
      },
    },
  })

  const view = workspace.state.widgets?.[widgetRef]?.view
  assert.deepEqual(view?.sort, {
    field: 'count',
    order: 'descending',
  })
})

test('materializeWorkspace preserves the full planner result in workspace description planning metadata', () => {
  const workspace = materializeWorkspace({
    appId: 'widgetva-app',
    workspaceId: 'main',
    sessionId: 'planned-workspace',
    spec: {
      data: {
        values: [
          { Horsepower: 130, Origin: 'USA' },
          { Horsepower: 95, Origin: 'Japan' },
        ],
      },
      mark: 'point',
      encoding: {
        x: { field: 'Horsepower', type: 'quantitative' },
        y: { field: 'Horsepower', type: 'quantitative' },
        color: { field: 'Origin', type: 'nominal' },
      },
    },
    planningRequest: {
      task: {
        taskFamily: 'correlation',
        coordinationScope: 'multi_widget',
        evidenceType: 'cross_widget',
        interactionHorizon: 'multi_step',
      },
      runMode: 'goal_oriented',
      complexityBudget: 'standard',
    },
  })

  const planner = workspace.description.planning?.planner

  assert.equal(workspace.description.planning?.materializedFromPlanner, true)
  assert.equal(workspace.description.planning?.workspaceSpecStatus, 'planned')
  assert.equal(workspace.description.taskContext?.coordinationScope, 'multi_widget')
  assert.equal(workspace.description.taskContext?.interactionHorizon, 'multi_step')
  assert.equal(workspace.description.taskContext?.evidenceType, 'cross_widget')
  assert.equal(planner?.topology, 'T3')
  assert.equal(planner?.planningMode, 'topology_driven')
  assert.equal(planner?.source, 'planner')
  assert.equal(planner?.title, 'Scatter Detail Workspace')
  assert.equal(planner?.primaryWidgetId, 'session_planned-workspace')
  assert.equal(Array.isArray(planner?.widgets), true)
  assert.equal(planner?.widgets?.length, 2)
  assert.equal(planner?.widgets?.[0]?.widgetId, 'session_planned-workspace')
  assert.equal(planner?.widgets?.[1]?.widgetId, 'session_planned-workspace_detail')
  assert.equal(Array.isArray(planner?.links), true)
  assert.equal(planner?.links?.length, 2)
  assert.equal(planner?.links?.[0]?.sourceWidgetId, 'session_planned-workspace')
  assert.equal(planner?.links?.[0]?.targetWidgetId, 'session_planned-workspace_detail')
  assert.equal(workspace.description.runtimeTopology?.topology, 'T3')
  assert.equal(Array.isArray(planner?.rationale), true)
  assert.ok(planner?.rationale?.length > 0)
  assert.equal(workspace.description.planning?.planningRequest?.runMode, 'goal_oriented')
  assert.equal(workspace.description.planning?.planningRequest?.complexityBudget, 'standard')
})

test('materializeWorkspace derives globalFilters from initial linked filter selections', () => {
  const sourceWidgetId = 'scatter_source'
  const targetWidgetId = 'bar_target'
  const targetWidgetRef = makeWidgetRef({ widgetId: targetWidgetId })

  const workspace = materializeWorkspace({
    appId: 'widgetva-app',
    workspaceId: 'main',
    sessionId: 'linked-filters',
    spec: {
      data: {
        values: [
          { Origin: 'USA', Horsepower: 130 },
          { Origin: 'Japan', Horsepower: 95 },
        ],
      },
      mark: 'point',
      encoding: {
        x: { field: 'Horsepower', type: 'quantitative' },
        y: { field: 'Horsepower', type: 'quantitative' },
        color: { field: 'Origin', type: 'nominal' },
      },
    },
    workspaceSpec: {
      topology: 'T2',
      widgets: [
        {
          widgetId: sourceWidgetId,
          role: 'primary',
          source: { kind: 'baseSpec' },
        },
        {
          widgetId: targetWidgetId,
          role: 'secondary',
          source: { kind: 'baseSpec' },
        },
      ],
      links: [
        {
          linkId: 'link_filter',
          sourceWidgetId,
          targetWidgetId,
          primitive: 'filter',
        },
      ],
    },
    selection: {
      source_widget_id: sourceWidgetId,
      selection_id: 'brush',
      selection_type: 'point',
      predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
      summary: 'Origin: USA',
    },
  })

  assert.deepEqual(
    workspace.state.shared?.globalFilters?.[targetWidgetRef],
    [{ field: 'Origin', op: 'equals', value: 'USA' }],
  )
  const targetState = workspace.state.widgets?.[targetWidgetRef]
  assert.equal(targetState?.transforms?.[0]?.kind, 'filter')
  assert.equal(targetState?.transforms?.[0]?.sourceWidgetId, sourceWidgetId)
  assert.equal(targetState?.transforms?.[0]?.linkId, 'link_filter')
  assert.equal(workspace.description.runtimeTopology?.topology, 'T2')
  assert.equal(workspace.description.benchmarkSupport, undefined)
  assert.deepEqual(workspace.description.planning?.requestedWorkspaceSpec, {
    topology: 'T2',
    widgetCount: 2,
    linkCount: 1,
  })
})

test('materializeWorkspace preserves explicit manual link semantics from automatic false', () => {
  const sourceWidgetId = 'scatter_source'
  const targetWidgetId = 'bar_target'

  const workspace = materializeWorkspace({
    appId: 'widgetva-app',
    workspaceId: 'main',
    sessionId: 'manual-link',
    spec: {
      data: {
        values: [
          { Origin: 'USA', Horsepower: 130 },
          { Origin: 'Japan', Horsepower: 95 },
        ],
      },
      mark: 'point',
      encoding: {
        x: { field: 'Horsepower', type: 'quantitative' },
        y: { field: 'Horsepower', type: 'quantitative' },
      },
    },
    workspaceSpec: {
      topology: 'T2',
      widgets: [
        { widgetId: sourceWidgetId, role: 'primary', source: { kind: 'baseSpec' } },
        { widgetId: targetWidgetId, role: 'secondary', source: { kind: 'baseSpec' } },
      ],
      links: [
        {
          linkId: 'link_filter_manual',
          sourceWidgetId,
          targetWidgetId,
          primitive: 'filter',
          activationPolicy: 'manual',
        },
      ],
    },
  })

  const link = workspace.description.links.find((entry) => entry?.ref?.endsWith('/link/link_filter_manual'))
  assert.equal(link?.activationPolicy, 'manual')
  assert.equal(link?.effectConstraint ?? null, null)
  assert.equal(Object.hasOwn(link || {}, 'automatic'), false)
  assert.equal(Object.hasOwn(link || {}, 'propagationPolicy'), false)
})

test('materializeWorkspace does not infer sharedSelection capability from highlight-only coordination', () => {
  const sourceWidgetId = 'scatter_source'
  const targetWidgetId = 'table_target'

  const workspace = materializeWorkspace({
    appId: 'widgetva-app',
    workspaceId: 'main',
    sessionId: 'highlight-coordination',
    spec: {
      data: {
        values: [
          { Origin: 'USA', Horsepower: 130 },
          { Origin: 'Japan', Horsepower: 95 },
        ],
      },
      mark: 'point',
      encoding: {
        x: { field: 'Horsepower', type: 'quantitative' },
        y: { field: 'Horsepower', type: 'quantitative' },
        color: { field: 'Origin', type: 'nominal' },
      },
    },
    workspaceSpec: {
      topology: 'T2',
      widgets: [
        {
          widgetId: sourceWidgetId,
          role: 'primary',
          source: { kind: 'baseSpec' },
        },
        {
          widgetId: targetWidgetId,
          role: 'secondary',
          source: { kind: 'baseSpec' },
        },
      ],
      links: [
        {
          linkId: 'link_highlight',
          sourceWidgetId,
          targetWidgetId,
          primitive: 'highlight',
        },
      ],
    },
  })

  assert.equal(workspace.description.workspaceCapabilities?.includes('multiWidgetCoordination'), true)
  assert.equal(workspace.description.workspaceCapabilities?.includes('sharedSelection'), false)
  assert.equal(workspace.description.benchmarkSupport, undefined)
})
