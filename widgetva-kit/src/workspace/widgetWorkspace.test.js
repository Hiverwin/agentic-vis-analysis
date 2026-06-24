import test from 'node:test'
import assert from 'node:assert/strict'

import { createWidgetVARuntime } from '../core.js'
import { deriveWorkspaceTopology } from '../core/runtime/deriveWorkspaceTopology.js'
import { createWidgetInstance } from '../widgets/widgetInstance.js'
import { createWidgetWorkspace, WidgetWorkspace, WIDGET_WORKSPACE_PUBLIC_METHODS } from './widgetWorkspace.js'

function buildBarSpec() {
  return {
    data: {
      values: [
        { category: 'a', value: 1 },
        { category: 'b', value: 3 },
      ],
    },
    mark: 'bar',
    encoding: {
      x: { field: 'category', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
    },
  }
}

function buildRuntime() {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const spec = buildBarSpec()
  const runtime = createWidgetVARuntime({
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'workspace-session',
      readBaselineSpec: () => spec,
      readCurrentSpec: () => spec,
      readWorkspaceSpec: () => null,
      readPlanningRequest: () => null,
      readRunMode: () => 'goal_oriented',
      readUserIntent: () => '',
      readCurrentSelection: () => null,
      readCurrentSelections: () => ({}),
      readFocusedWidgetRef: () => null,
      readViewportState: () => null,
      readComparisonTargets: () => [],
      readWorkspaceAnnotations: () => [],
    },
  })
  return {
    runtime,
    spec,
    cleanup() {
      globalThis.window = globalThis.window || {}
      runtime.dispose()
      globalThis.window = previousWindow
    },
  }
}

function buildWidget(runtime, spec, widgetRef, widgetId) {
  return createWidgetInstance({
    runtime,
    widgetRef,
    widgetId,
    spec,
    widgetAdapter: {
      provider: 'test',
      async applyState() {},
      bindHumanInteractions() {
        return () => {}
      },
    },
  })
}

function workspaceTopologyFromRuntime(runtime) {
  const description = runtime.store.readDescription()
  return deriveWorkspaceTopology({
    widgets: description?.widgets || [],
    links: description?.links || [],
  })
}

test('WidgetWorkspace.describeContract documents the stable workspace public methods', () => {
  const contract = WidgetWorkspace.describeContract()
  assert.deepEqual(contract.methods, WIDGET_WORKSPACE_PUBLIC_METHODS)
  assert.equal(typeof contract.constructorOptions.widgets, 'string')
  assert.equal(typeof contract.composition.links, 'string')
  assert.equal(typeof contract.composition.contractReads, 'string')
  assert.equal(typeof contract.coordinationState.selections.registry, 'string')
  assert.equal(typeof contract.coordinationState.selections.views.primary, 'string')
  assert.equal(typeof contract.coordinationState.selections.views.byWidget, 'string')
  assert.equal(typeof contract.coordinationState.links.definitions, 'string')
  assert.equal(typeof contract.coordinationState.links.topology, 'string')
  assert.equal(typeof contract.coordinationState.latestCoordinationResult, 'string')
})

test('WidgetWorkspace exposes coordination-state reads for focused widget, selections, and annotations', () => {
  const focusedWidget = {
    resolveWidgetRef() {
      return 'wl://widgetva-app/workspace/main/widget/bar_a'
    },
    resolveWidgetId() {
      return 'bar_a'
    },
    describe() {
      return {
        ref: 'wl://widgetva-app/workspace/main/widget/bar_a',
        widgetId: 'bar_a',
      }
    },
  }
  const runtime = {
    store: {
      currentBranchId: 'main',
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          widgets: [focusedWidget.describe()],
          links: [],
        }
      },
      readState() {
        return {
          stateId: 'main:s3',
          branchId: 'main',
          shared: {
            focusedWidget: 'wl://widgetva-app/workspace/main/widget/bar_a',
            selections: {
              registry: {
                bar_a: ['wl://widgetva-app/workspace/main/widget/bar_a/selection/current'],
              },
              views: {
                primary: { kind: 'brush', xRange: [1, 3] },
                byWidget: {
                  bar_a: { kind: 'point', values: ['a'] },
                },
              },
          },
          globalFilters: {
            value: { op: '>=', value: 10 },
          },
          viewport: {
            sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
            xDomain: [0, 10],
            yDomain: [5, 15],
            zoom: null,
          },
          comparisonTargets: ['wl://widgetva-app/workspace/main/widget/bar_b'],
        },
        annotations: [{ id: 'ann_1', label: 'Peak bucket' }],
        }
      },
      listLinks() {
        return []
      },
    },
  }
  const workspace = createWidgetWorkspace({
    runtime,
    widgets: [focusedWidget],
  })

  try {
    assert.deepEqual(workspace.readCoordinationState(), {
      stateId: 'main:s3',
      branchId: 'main',
      focusedWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
      selections: {
        registry: {
          bar_a: ['wl://widgetva-app/workspace/main/widget/bar_a/selection/current'],
        },
        views: {
          primary: {
            selectionRef: null,
            selectionId: null,
            sourceWidgetRef: null,
            sourceWidgetId: null,
            summary: '',
            predicates: [],
            selectionDataRef: null,
            scope: 'local',
            kind: 'brush',
            xRange: [1, 3],
          },
          byWidget: {
            bar_a: {
              selectionRef: null,
              selectionId: null,
              sourceWidgetRef: null,
              sourceWidgetId: null,
              summary: '',
              predicates: [],
              selectionDataRef: null,
              scope: 'local',
              kind: 'point',
              values: ['a'],
            },
          },
        },
      },
      focus: {
        widgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
        widgetId: null,
        source: 'workspace',
      },
      highlight: {
        entries: [],
        activeWidgetRefs: [],
      },
      globalFilters: {
        value: { op: '>=', value: 10 },
      },
      viewport: {
        sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
        xDomain: [0, 10],
        yDomain: [5, 15],
        zoom: null,
      },
      annotations: [{ id: 'ann_1', label: 'Peak bucket' }],
      links: {
        definitions: [],
        topology: {
          edgeCount: 0,
          linkDensity: 0,
          maxInDegree: 0,
          maxOutDegree: 0,
          rationale: ['A single widget is active in the current workspace.'],
          sourceWidgetCount: 0,
          targetWidgetCount: 0,
          topology: 'T1',
          topologyLabel: 'Single View',
          widgetCount: 1,
        },
      },
    })
    assert.equal(workspace.readFocusedWidget(), focusedWidget)
    assert.equal(workspace.readFocusedWidgetId(), 'bar_a')
    assert.deepEqual(workspace.readFocusState(), {
      widgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
      widgetId: 'bar_a',
      source: 'workspace',
    })
    assert.deepEqual(workspace.readSelectionState(), {
      registry: {
        bar_a: ['wl://widgetva-app/workspace/main/widget/bar_a/selection/current'],
      },
      views: {
        primary: {
          selectionRef: null,
          selectionId: null,
          sourceWidgetRef: null,
          sourceWidgetId: null,
          summary: '',
          predicates: [],
          selectionDataRef: null,
          scope: 'local',
          kind: 'brush',
          xRange: [1, 3],
        },
        byWidget: {
          bar_a: {
            selectionRef: null,
            selectionId: null,
            sourceWidgetRef: null,
            sourceWidgetId: null,
            summary: '',
            predicates: [],
            selectionDataRef: null,
            scope: 'local',
            kind: 'point',
            values: ['a'],
          },
        },
      },
    })
    assert.deepEqual(workspace.readAnnotations(), [{ id: 'ann_1', label: 'Peak bucket' }])
    assert.deepEqual(workspace.readGlobalFilters(), {
      value: { op: '>=', value: 10 },
    })
    assert.deepEqual(workspace.readHighlightState(), {
      entries: [],
      activeWidgetRefs: [],
    })
  } finally {
    workspace.dispose()
  }
})

test('WidgetWorkspace.readHighlightState derives cross-widget highlight summaries from widget feedback', () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/table_b'
  const runtime = {
    store: {
      currentBranchId: 'main',
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          widgets: [{ ref: widgetRef, widgetId: 'table_b', kind: 'table' }],
          links: [],
        }
      },
      readState() {
        return {
          stateId: 'main:s5',
          widgets: {
            [widgetRef]: {
              ref: widgetRef,
              widgetId: 'table_b',
              kind: 'table',
              feedback: {
                highlightedKeys: ['USA'],
                inboundLinkIds: ['summary_highlights_table'],
                highlightLinkIds: ['summary_highlights_table'],
                linkedSourceRefs: ['wl://widgetva-app/workspace/main/widget/bar_a/selection/current'],
              },
            },
          },
          shared: {},
        }
      },
      listLinks() {
        return []
      },
    },
  }
  const widget = {
    resolveWidgetRef() {
      return widgetRef
    },
    resolveWidgetId() {
      return 'table_b'
    },
    describe() {
      return { ref: widgetRef, widgetId: 'table_b', kind: 'table' }
    },
  }
  const workspace = createWidgetWorkspace({
    runtime,
    widgets: [widget],
  })

  try {
    assert.deepEqual(workspace.readHighlightState(), {
      entries: [{
        widgetRef,
        widgetId: 'table_b',
        sourceWidgetRef: null,
        sourceWidgetId: null,
        selectionRef: null,
        summary: null,
        predicates: [],
        highlightedKeys: ['USA'],
        inboundLinkIds: ['summary_highlights_table'],
        highlightLinkIds: ['summary_highlights_table'],
        linkedSourceRefs: ['wl://widgetva-app/workspace/main/widget/bar_a/selection/current'],
      }],
      activeWidgetRefs: [widgetRef],
    })
  } finally {
    workspace.dispose()
  }
})

test('WidgetWorkspace manages workspaceShared coordination writes without taking ownership of widget-local state', () => {
  const widgetA = {
    resolveWidgetRef() {
      return 'wl://widgetva-app/workspace/main/widget/bar_a'
    },
    resolveWidgetId() {
      return 'bar_a'
    },
    describe() {
      return {
        ref: 'wl://widgetva-app/workspace/main/widget/bar_a',
        widgetId: 'bar_a',
      }
    },
  }
  const widgetB = {
    resolveWidgetRef() {
      return 'wl://widgetva-app/workspace/main/widget/bar_b'
    },
    resolveWidgetId() {
      return 'bar_b'
    },
    describe() {
      return {
        ref: 'wl://widgetva-app/workspace/main/widget/bar_b',
        widgetId: 'bar_b',
      }
    },
  }

  const state = {
    stateId: 'main:s1',
    widgets: {
      [widgetA.resolveWidgetRef()]: {
        ref: widgetA.resolveWidgetRef(),
        widgetId: 'bar_a',
        kind: 'bar',
        view: { localTransform: 'keep-me' },
      },
      [widgetB.resolveWidgetRef()]: {
        ref: widgetB.resolveWidgetRef(),
        widgetId: 'bar_b',
        kind: 'bar',
        view: { localTransform: 'keep-me-too' },
      },
    },
    shared: {
      selections: {
        registry: {},
        views: {
          primary: null,
          byWidget: {},
        },
      },
      globalFilters: {},
      focusedWidget: null,
      comparisonTargets: [],
      annotations: [],
    },
  }

  const runtime = {
    store: {
      currentBranchId: 'main',
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          widgets: [widgetA.describe(), widgetB.describe()],
          links: [],
        }
      },
      readState() {
        return state
      },
      commitState(nextState) {
        state.stateId = nextState.stateId
        state.createdAt = nextState.createdAt
        state.widgets = nextState.widgets
        state.shared = nextState.shared
        return nextState
      },
      listLinks() {
        return []
      },
    },
  }

  const workspace = createWidgetWorkspace({
    runtime,
    widgets: [widgetA, widgetB],
  })

  try {
    workspace.setFocusedWidget('bar_b')
    workspace.setSelectionPrimary({ kind: 'brush', xRange: [10, 20] })
    workspace.setSelectionViewsByWidget({
      bar_a: { kind: 'point', values: ['a'] },
    })
    workspace.setSelectionRegistry({
      'wl://widgetva-app/workspace/main/widget/bar_a/selection/current': {
        kind: 'point',
        values: ['a'],
      },
    })
    workspace.setGlobalFilters({
      value: { op: '>=', value: 20 },
    })
    workspace.addAnnotation({ id: 'ann_2', label: 'Focus region' })
    workspace.setAnnotations([{ id: 'ann_3', label: 'Pinned note' }])

    assert.equal(workspace.readCoordinationState().focusedWidgetRef, widgetB.resolveWidgetRef())
    assert.deepEqual(workspace.readSelectionState(), {
      registry: {
        'wl://widgetva-app/workspace/main/widget/bar_a/selection/current': {
          kind: 'point',
          values: ['a'],
        },
      },
      views: {
        primary: {
          selectionRef: null,
          selectionId: null,
          sourceWidgetRef: null,
          sourceWidgetId: null,
          summary: '',
          predicates: [],
          selectionDataRef: null,
          scope: 'local',
          kind: 'brush',
          xRange: [10, 20],
        },
        byWidget: {
          bar_a: {
            selectionRef: null,
            selectionId: null,
            sourceWidgetRef: null,
            sourceWidgetId: null,
            summary: '',
            predicates: [],
            selectionDataRef: null,
            scope: 'local',
            kind: 'point',
            values: ['a'],
          },
        },
      },
    })
    assert.deepEqual(state.shared.selections, {
      registry: {
        'wl://widgetva-app/workspace/main/widget/bar_a/selection/current': {
          kind: 'point',
          values: ['a'],
        },
      },
      views: {
        primary: {
          selectionRef: null,
          selectionId: null,
          sourceWidgetRef: null,
          sourceWidgetId: null,
          summary: '',
          predicates: [],
          selectionDataRef: null,
          scope: 'local',
          kind: 'brush',
          xRange: [10, 20],
        },
        byWidget: {
          bar_a: {
            selectionRef: null,
            selectionId: null,
            sourceWidgetRef: null,
            sourceWidgetId: null,
            summary: '',
            predicates: [],
            selectionDataRef: null,
            scope: 'local',
            kind: 'point',
            values: ['a'],
          },
        },
      },
    })
    assert.deepEqual(workspace.readGlobalFilters(), {
      value: { op: '>=', value: 20 },
    })
    assert.deepEqual(workspace.readAnnotations(), [{ id: 'ann_3', label: 'Pinned note' }])
    assert.equal(state.widgets[widgetA.resolveWidgetRef()].view.localTransform, 'keep-me')
    assert.equal(state.widgets[widgetB.resolveWidgetRef()].view.localTransform, 'keep-me-too')

    workspace.clearAnnotations()
    workspace.clearGlobalFilters()
    workspace.clearSelectionState()

    assert.deepEqual(workspace.readAnnotations(), [])
    assert.deepEqual(workspace.readGlobalFilters(), {})
    assert.deepEqual(workspace.readSelectionState(), {
      registry: {},
      views: {
        primary: null,
        byWidget: {},
      },
    })
    assert.deepEqual(state.shared.selections, {
      registry: {},
      views: {
        primary: null,
        byWidget: {},
      },
    })
  } finally {
    workspace.dispose()
  }
})

test('WidgetWorkspace exposes neutral default control-state and binding surfaces without a first-party adapter', () => {
  const { runtime, spec, cleanup } = buildRuntime()
  const widget = buildWidget(runtime, spec, 'wl://widgetva-app/workspace/main/widget/bar_a', 'bar_a')
  const workspace = createWidgetWorkspace({
    runtime,
    widgets: [widget],
  })

  try {
    workspace.setFocusedWidget('bar_a')
    workspace.setGlobalFilters({
      origin: 'USA',
      year: 1971,
      cylinders: [4],
      horsepowerRange: [60, 180],
    })
    workspace.upsertSelectionEntry({
      selectionRef: 'selection://widgetva-system/bar_a/focus',
      selectionId: 'focus',
      sourceWidgetId: 'bar_a',
      sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
      kind: 'point',
      summary: 'Car: toyota-corona',
      predicates: [{ field: 'id', op: 'equals', value: 'toyota-corona' }],
    }, {
      makePrimary: true,
      updateByWidget: true,
      focusSourceWidget: true,
    })

    assert.deepEqual(workspace.readCoordinationControlState({
      rangeDomains: {
        horsepower: [40, 230],
      },
    }), {
      globalFilters: {
        origin: 'USA',
        year: 1971,
        cylinders: [4],
        horsepowerRange: [60, 180],
      },
      primarySelection: {
        selectionRef: 'selection://widgetva-system/bar_a/focus',
        selectionId: 'focus',
        sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
        sourceWidgetId: 'bar_a',
        summary: 'Car: toyota-corona',
        predicates: [{ field: 'id', op: 'equals', value: 'toyota-corona' }],
        selectionDataRef: null,
        scope: 'local',
        kind: 'point',
      },
      focusedWidgetId: 'bar_a',
    })

    assert.deepEqual(workspace.readInteractionBindings({
      rangeDomains: {
        horsepower: [40, 230],
      },
      fallbackSelectedWidgetId: 'fallback_widget',
    }), {
      focusedWidgetId: 'bar_a',
      globalFilters: {
        origin: 'USA',
        year: 1971,
        cylinders: [4],
        horsepowerRange: [60, 180],
      },
      primarySelection: {
        selectionRef: 'selection://widgetva-system/bar_a/focus',
        selectionId: 'focus',
        sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
        sourceWidgetId: 'bar_a',
        summary: 'Car: toyota-corona',
        predicates: [{ field: 'id', op: 'equals', value: 'toyota-corona' }],
        selectionDataRef: null,
        scope: 'local',
        kind: 'point',
      },
    })

    assert.deepEqual(workspace.buildGlobalFiltersFromControlState({
      globalFilters: {
        origin: 'Japan',
        year: 1972,
        cylinders: [6],
        horsepowerRange: [70, 150],
      },
    }, {
      rangeDomains: {
        horsepower: [40, 230],
      },
    }), {
      origin: 'Japan',
      year: 1972,
      cylinders: [6],
      horsepowerRange: [70, 150],
    })

    assert.deepEqual(workspace.syncGlobalFiltersFromControlState({
      globalFilters: {
        origin: 'Europe',
        year: 1973,
        cylinders: [8],
        horsepowerRange: [90, 160],
      },
    }, {
      rangeDomains: {
        horsepower: [40, 230],
      },
    }), {
      origin: 'Europe',
      year: 1973,
      cylinders: [8],
      horsepowerRange: [90, 160],
    })
    assert.deepEqual(workspace.readGlobalFilters(), {
      origin: 'Europe',
      year: 1973,
      cylinders: [8],
      horsepowerRange: [90, 160],
    })
  } finally {
    cleanup()
  }
})

test('WidgetWorkspace exposes an ephemeral latest coordination result read/write surface outside shared state', () => {
  const widget = {
    resolveWidgetRef() {
      return 'wl://widgetva-app/workspace/main/widget/bar_a'
    },
    resolveWidgetId() {
      return 'bar_a'
    },
    describe() {
      return {
        ref: 'wl://widgetva-app/workspace/main/widget/bar_a',
        widgetId: 'bar_a',
        kind: 'bar',
      }
    },
  }

  const state = {
    stateId: 'main:s1',
    widgets: {},
    shared: {
      selections: {
        registry: {},
        views: {
          primary: null,
          byWidget: {},
        },
      },
      globalFilters: {},
      focusedWidget: null,
      comparisonTargets: [],
      annotations: [],
    },
  }

  const runtime = {
    store: {
      currentBranchId: 'main',
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          widgets: [widget.describe()],
          links: [],
        }
      },
      readState() {
        return state
      },
      commitState(nextState) {
        state.stateId = nextState.stateId
        state.widgets = nextState.widgets
        state.shared = nextState.shared
        return nextState
      },
      listLinks() {
        return []
      },
    },
  }

  const workspace = createWidgetWorkspace({
    runtime,
    widgets: [widget],
  })

  try {
    const result = {
      changed: true,
      verification: {
        status: 'verified',
        total: 1,
        succeeded: 1,
        failed: 0,
        summary: 'Verified 1/1 target checks.',
      },
      verificationSteps: [{ stepId: 'verify_bar', targetWidgetId: 'bar_a' }],
    }
    const stored = workspace.setLatestCoordinationResult(result)
    assert.deepEqual(stored, result)
    result.verification.status = 'failed'
    assert.equal(workspace.readLatestCoordinationResult().verification.status, 'verified')
    assert.equal(workspace.readObservation().latestCoordinationResult?.verification?.status, 'verified')
    assert.deepEqual(workspace.readCoordinationState().selections, {
      registry: {},
      views: {
        primary: null,
        byWidget: {},
      },
    })
    assert.equal(state.shared.latestCoordinationResult, undefined)
    workspace.clearLatestCoordinationResult()
    assert.equal(workspace.readLatestCoordinationResult(), null)
    workspace.setLatestCoordinationResult(result)
    assert.deepEqual(workspace.resetEphemeralCoordinationState(), { latestCoordinationResult: null })
    assert.equal(workspace.readLatestCoordinationResult(), null)
  } finally {
    workspace.dispose()
  }
})

test('WidgetWorkspace.readComputedCoordinationResult computes propagation and verification from current runtime state', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = buildRuntime()

  try {
    const widgetA = buildWidget(
      session.runtime,
      session.spec,
      'wl://widgetva-app/workspace/main/widget/bar_a',
      'bar_a',
    )
    const widgetB = buildWidget(
      session.runtime,
      session.spec,
      'wl://widgetva-app/workspace/main/widget/scatter_b',
      'scatter_b',
    )

    session.runtime.workspace = createWidgetWorkspace({
      runtime: session.runtime,
      widgets: [widgetA, widgetB],
    })

    session.runtime.workspace.registerLink({
      linkId: 'bar_to_scatter',
      sourceWidgetId: 'bar_a',
      targetWidgetId: 'scatter_b',
      primitive: 'filter',
      effect: 'applyFilter',
      activationPolicy: 'automatic',
      effectConstraint: 'highlightOnly',
    })
    session.runtime.workspace.upsertSelectionEntry({
      selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
      selectionId: 'current',
      sourceWidgetId: 'bar_a',
      kind: 'point',
      summary: 'Category: a',
      predicates: [{ field: 'category', op: 'equals', value: 'a' }],
    })

    const result = session.runtime.workspace.readComputedCoordinationResult()
    assert.equal(result.propagationSummary.sourceWidgetId, 'bar_a')
    assert.equal(Array.isArray(result.propagationSummary.activatedLinks), true)
    assert.equal(Array.isArray(result.verificationSteps), true)
    assert.equal(Array.isArray(result.verificationResults), true)
    assert.equal(typeof result.verification?.status, 'string')
    const operationResult = session.runtime.workspace.buildCoordinationOperationResult({ changed: true })
    assert.equal(operationResult.changed, true)
    assert.equal(operationResult.coordinationState.selections.views.primary?.sourceWidgetId, 'bar_a')
    assert.deepEqual(operationResult.propagationSummary, result.propagationSummary)
    assert.deepEqual(operationResult.verificationSteps, result.verificationSteps)
    assert.deepEqual(operationResult.verificationResults, result.verificationResults)
    assert.deepEqual(operationResult.verification, result.verification)
    const committedResult = session.runtime.workspace.commitCoordinationOperationResult({ changed: true })
    assert.deepEqual(committedResult, operationResult)
    assert.deepEqual(session.runtime.workspace.readLatestCoordinationResult(), operationResult)
  } finally {
    session.cleanup()
    globalThis.window = previousWindow
  }
})

test('WidgetWorkspace.readComputedPropagationSummary returns a stable empty propagation shape when no propagation is active', () => {
  const { runtime, spec, cleanup } = buildRuntime()
  const widget = buildWidget(runtime, spec, 'wl://widgetva-app/workspace/main/widget/bar_a', 'bar_a')
  const workspace = createWidgetWorkspace({
    runtime,
    widgets: [widget],
  })

  try {
    const summary = workspace.readComputedPropagationSummary()
    assert.equal(typeof summary.active, 'boolean')
    assert.equal(summary.sourceWidgetId, null)
    assert.equal(Array.isArray(summary.targetWidgetIds), true)
    assert.equal(summary.linkCount, 0)
    assert.equal(Array.isArray(summary.links), true)
    assert.equal(Array.isArray(summary.activatedLinks), true)
    assert.equal(Array.isArray(summary.affectedTargets), true)
    assert.equal(Array.isArray(summary.skippedTargets), true)
    assert.equal(Array.isArray(summary.verificationGuidance), true)
    assert.equal(Array.isArray(summary.verificationSteps), true)
    assert.equal(typeof summary.topology, 'object')
  } finally {
    cleanup()
  }
})

test('WidgetWorkspace.commitCoordinationOperationResult stores and returns the computed coordination result payload', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = buildRuntime()

  try {
    const widget = buildWidget(
      session.runtime,
      session.spec,
      'wl://widgetva-app/workspace/main/widget/bar_a',
      'bar_a',
    )

    session.runtime.workspace = createWidgetWorkspace({
      runtime: session.runtime,
      widgets: [widget],
    })

    session.runtime.workspace.upsertSelectionEntry({
      selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
      selectionId: 'current',
      sourceWidgetId: 'bar_a',
      kind: 'point',
      summary: 'Category: a',
      predicates: [{ field: 'category', op: 'equals', value: 'a' }],
    })

    const committed = session.runtime.workspace.commitCoordinationOperationResult({ changed: true })
    assert.equal(committed.changed, true)
    assert.equal(committed.coordinationState.selections.views.primary?.sourceWidgetId, 'bar_a')
    assert.deepEqual(session.runtime.workspace.readLatestCoordinationResult(), committed)
  } finally {
    session.cleanup()
    globalThis.window = previousWindow
  }
})

test('WidgetWorkspace.setSelectionPrimary resolves registry-backed primary views', () => {
  const widget = {
    resolveWidgetRef() {
      return 'wl://widgetva-app/workspace/main/widget/bar_a'
    },
    resolveWidgetId() {
      return 'bar_a'
    },
    describe() {
      return {
        ref: 'wl://widgetva-app/workspace/main/widget/bar_a',
        widgetId: 'bar_a',
        kind: 'bar',
      }
    },
  }
  let state = {
    stateId: 'main:s1',
    shared: {
      selections: {
        registry: {
          'wl://widgetva-app/workspace/main/widget/bar_a/selection/current': {
            selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
            selectionId: 'current',
            sourceWidgetRef: widget.resolveWidgetRef(),
            sourceWidgetId: 'bar_a',
            scope: 'linked',
            kind: 'point',
            summary: 'Origin: USA',
            predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
          },
        },
        views: {
          primary: null,
          byWidget: {},
        },
      },
    },
  }
  const workspace = createWidgetWorkspace({
    widgets: [widget],
    runtime: {
      store: {
        currentBranchId: 'main',
        readDescription() {
          return {
            appId: 'widgetva-app',
            workspaceId: 'main',
            widgets: [widget.describe()],
            links: [],
          }
        },
        readState() {
          return state
        },
        commitState(nextState) {
          state = nextState
          return nextState
        },
        listLinks() {
          return []
        },
      },
    },
  })

  workspace.setSelectionPrimary({
    selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
  })

  assert.deepEqual(workspace.readSelectionState().views.primary, {
    selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
    selectionId: 'current',
    sourceWidgetRef: widget.resolveWidgetRef(),
    sourceWidgetId: 'bar_a',
    summary: 'Origin: USA',
    predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
    selectionDataRef: null,
    scope: 'linked',
    kind: 'point',
  })
})

test('WidgetWorkspace.upsertSelectionEntry updates registry, byWidget, primary view, and focused widget together', () => {
  const widget = {
    resolveWidgetRef() {
      return 'wl://widgetva-app/workspace/main/widget/bar_a'
    },
    resolveWidgetId() {
      return 'bar_a'
    },
    describe() {
      return {
        ref: 'wl://widgetva-app/workspace/main/widget/bar_a',
        widgetId: 'bar_a',
        kind: 'bar',
      }
    },
  }
  let state = {
    stateId: 'main:s1',
    shared: {
      focusedWidget: null,
      selections: {
        registry: {},
        views: {
          primary: null,
          byWidget: {},
        },
      },
    },
  }
  const workspace = createWidgetWorkspace({
    widgets: [widget],
    runtime: {
      store: {
        currentBranchId: 'main',
        readDescription() {
          return {
            appId: 'widgetva-app',
            workspaceId: 'main',
            widgets: [widget.describe()],
            links: [],
          }
        },
        readState() {
          return state
        },
        commitState(nextState) {
          state = nextState
          return nextState
        },
        listLinks() {
          return []
        },
      },
    },
  })

  const transition = workspace.upsertSelectionEntry({
    selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
    selectionId: 'current',
    sourceWidgetId: 'bar_a',
    kind: 'point',
    summary: 'Origin: USA',
    predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
  })

  assert.equal(transition.changed, true)
  assert.equal(transition.selectionRef, 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current')
  assert.equal(transition.nextFocusedWidgetRef, widget.resolveWidgetRef())
  assert.equal(workspace.readCoordinationState().focusedWidgetRef, widget.resolveWidgetRef())
  assert.deepEqual(workspace.readSelectionState().views.byWidget, {
    bar_a: {
      selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
      selectionId: 'current',
      sourceWidgetRef: widget.resolveWidgetRef(),
      sourceWidgetId: 'bar_a',
      summary: 'Origin: USA',
      predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
      selectionDataRef: null,
      scope: 'local',
      kind: 'point',
    },
  })
  assert.deepEqual(workspace.readSelectionState().views.primary, {
    selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
    selectionId: 'current',
    sourceWidgetRef: widget.resolveWidgetRef(),
    sourceWidgetId: 'bar_a',
    summary: 'Origin: USA',
    predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
    selectionDataRef: null,
    scope: 'local',
    kind: 'point',
  })
})

test('WidgetWorkspace.syncPrimarySelectionEntry atomically clears or commits a primary selection result bundle', () => {
  const { runtime, spec, cleanup } = buildRuntime()
  const widget = buildWidget(runtime, spec, 'wl://widgetva-app/workspace/main/widget/bar_a', 'bar_a')
  const workspace = createWidgetWorkspace({
    runtime,
    widgets: [widget],
  })

  try {
    const applied = workspace.syncPrimarySelectionEntry({
      selectionRef: 'selection://widgetva-system/bar_a/current',
      selectionId: 'current',
      sourceWidgetId: 'bar_a',
      sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
      kind: 'point',
      summary: 'Category: a',
      predicates: [{ field: 'category', op: 'equals', value: 'a' }],
    }, {
      makePrimary: true,
      updateByWidget: true,
      focusSourceWidget: true,
    })
    assert.equal(applied.changed, true)
    assert.equal(applied.coordinationState.selections.views.primary?.selectionRef, 'selection://widgetva-system/bar_a/current')
    assert.equal(workspace.readLatestCoordinationResult()?.coordinationState?.selections?.views?.primary?.selectionRef, 'selection://widgetva-system/bar_a/current')

    const cleared = workspace.syncPrimarySelectionEntry(null)
    assert.equal(cleared.changed, true)
    assert.equal(cleared.coordinationState.selections.views.primary, null)
    assert.deepEqual(cleared.coordinationState.selections.registry, {})
  } finally {
    cleanup()
  }
})

test('WidgetWorkspace.promotePrimarySelectionToGlobalFilters merges canonical filter patches and clears selection', () => {
  const widget = {
    resolveWidgetRef() {
      return 'wl://widgetva-app/workspace/main/widget/bar_a'
    },
    resolveWidgetId() {
      return 'bar_a'
    },
    describe() {
      return {
        ref: 'wl://widgetva-app/workspace/main/widget/bar_a',
        widgetId: 'bar_a',
        kind: 'bar',
      }
    },
  }
  let state = {
    stateId: 'main:s1',
    shared: {
      focusedWidget: null,
      globalFilters: {},
      selections: {
        registry: {
          'wl://widgetva-app/workspace/main/widget/bar_a/selection/current': {
            selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
            selectionId: 'current',
            sourceWidgetRef: widget.resolveWidgetRef(),
            sourceWidgetId: 'bar_a',
            scope: 'linked',
            kind: 'point',
            summary: 'Origin: USA / 8 cyl',
            predicates: [
              { field: 'origin', op: 'equals', value: 'USA' },
              { field: 'cylinders', op: 'equals', value: 8 },
            ],
          },
        },
        views: {
          primary: {
            selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
            selectionId: 'current',
            sourceWidgetRef: widget.resolveWidgetRef(),
            sourceWidgetId: 'bar_a',
            scope: 'linked',
            kind: 'point',
            summary: 'Origin: USA / 8 cyl',
            predicates: [
              { field: 'origin', op: 'equals', value: 'USA' },
              { field: 'cylinders', op: 'equals', value: 8 },
            ],
          },
          byWidget: {
            bar_a: {
              selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
            },
          },
        },
      },
    },
  }
  const workspace = createWidgetWorkspace({
    widgets: [widget],
    runtime: {
      store: {
        currentBranchId: 'main',
        readDescription() {
          return {
            appId: 'widgetva-app',
            workspaceId: 'main',
            widgets: [widget.describe()],
            links: [],
          }
        },
        readState() {
          return state
        },
        commitState(nextState) {
          state = nextState
          return nextState
        },
        listLinks() {
          return []
        },
      },
    },
  })

  const result = workspace.promotePrimarySelectionToGlobalFilters({
    rangeDomains: { horsepower: [60, 220] },
    baseGlobalFilters: { year: 1971 },
  })

  assert.equal(result.changed, true)
  assert.deepEqual(result.globalFilterPatch, {
    origin: 'USA',
    cylinders: [8],
  })
  assert.deepEqual(workspace.readGlobalFilters(), {
    year: 1971,
    origin: 'USA',
    cylinders: [8],
  })
  assert.deepEqual(workspace.readSelectionState(), {
    registry: {},
    views: {
      primary: null,
      byWidget: {},
    },
  })
  assert.equal(workspace.readCoordinationState().focusedWidgetRef, widget.resolveWidgetRef())
})

test('WidgetWorkspace.commitPrimarySelectionToGlobalFilters returns canonical promotion data plus committed coordination result', () => {
  const { runtime, spec, cleanup } = buildRuntime()
  const widget = buildWidget(runtime, spec, 'wl://widgetva-app/workspace/main/widget/bar_a', 'bar_a')
  const workspace = createWidgetWorkspace({
    runtime,
    widgets: [widget],
  })

  try {
    workspace.upsertSelectionEntry({
      selectionRef: 'selection://widgetva-system/bar_a/current',
      selectionId: 'current',
      sourceWidgetId: 'bar_a',
      sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
      kind: 'point',
      summary: 'Origin: Japan',
      predicates: [{ field: 'origin', op: 'equals', value: 'Japan' }],
    }, {
      makePrimary: true,
      updateByWidget: true,
      focusSourceWidget: true,
    })

    const result = workspace.commitPrimarySelectionToGlobalFilters({
      clearSelection: true,
      focusSourceWidget: true,
    })

    assert.equal(result.changed, true)
    assert.equal(result.selectionRef, 'selection://widgetva-system/bar_a/current')
    assert.deepEqual(result.globalFilterPatch, { origin: 'Japan' })
    assert.deepEqual(result.nextGlobalFilters, { origin: 'Japan' })
    assert.deepEqual(result.coordinationState.globalFilters, { origin: 'Japan' })
    assert.equal(result.coordinationState.selections.views.primary, null)
  } finally {
    cleanup()
  }
})

test('WidgetWorkspace.promotePrimarySelectionToHighlight creates shared highlight state and clears selection', () => {
  const widgetA = {
    resolveWidgetRef() {
      return 'wl://widgetva-app/workspace/main/widget/bar_a'
    },
    resolveWidgetId() {
      return 'bar_a'
    },
    describe() {
      return {
        ref: 'wl://widgetva-app/workspace/main/widget/bar_a',
        widgetId: 'bar_a',
        kind: 'bar',
      }
    },
  }
  const widgetB = {
    resolveWidgetRef() {
      return 'wl://widgetva-app/workspace/main/widget/scatter_b'
    },
    resolveWidgetId() {
      return 'scatter_b'
    },
    describe() {
      return {
        ref: 'wl://widgetva-app/workspace/main/widget/scatter_b',
        widgetId: 'scatter_b',
        kind: 'scatter',
      }
    },
  }
  let state = {
    stateId: 'main:s1',
    shared: {
      focusedWidget: null,
      selections: {
        registry: {
          'wl://widgetva-app/workspace/main/widget/bar_a/selection/current': {
            selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
            selectionId: 'current',
            sourceWidgetRef: widgetA.resolveWidgetRef(),
            sourceWidgetId: 'bar_a',
            scope: 'linked',
            kind: 'point',
            summary: 'Origin: USA',
            predicates: [{ field: 'origin', op: 'equals', value: 'USA' }],
          },
        },
        views: {
          primary: {
            selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
            selectionId: 'current',
            sourceWidgetRef: widgetA.resolveWidgetRef(),
            sourceWidgetId: 'bar_a',
            scope: 'linked',
            kind: 'point',
            summary: 'Origin: USA',
            predicates: [{ field: 'origin', op: 'equals', value: 'USA' }],
          },
          byWidget: {
            bar_a: {
              selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
            },
          },
        },
      },
    },
  }
  const workspace = createWidgetWorkspace({
    widgets: [widgetA, widgetB],
    runtime: {
      store: {
        currentBranchId: 'main',
        readDescription() {
          return {
            appId: 'widgetva-app',
            workspaceId: 'main',
            widgets: [widgetA.describe(), widgetB.describe()],
            links: [],
          }
        },
        readState() {
          return state
        },
        commitState(nextState) {
          state = nextState
          return nextState
        },
        listLinks() {
          return []
        },
      },
    },
  })

  const result = workspace.promotePrimarySelectionToHighlight()

  assert.equal(result.changed, true)
  assert.equal(workspace.readHighlightState().entries.length, 2)
  assert.deepEqual(workspace.readHighlightState().entries[0].highlightedKeys, ['USA'])
  assert.deepEqual(workspace.readSelectionState(), {
    registry: {},
    views: {
      primary: null,
      byWidget: {},
    },
  })
  assert.equal(workspace.readCoordinationState().focusedWidgetRef, widgetA.resolveWidgetRef())
})

test('WidgetWorkspace.commitPrimarySelectionToHighlight returns canonical highlight data plus committed coordination result', () => {
  const { runtime, spec, cleanup } = buildRuntime()
  const widget = buildWidget(runtime, spec, 'wl://widgetva-app/workspace/main/widget/bar_a', 'bar_a')
  const workspace = createWidgetWorkspace({
    runtime,
    widgets: [widget],
  })

  try {
    workspace.upsertSelectionEntry({
      selectionRef: 'selection://widgetva-system/bar_a/current',
      selectionId: 'current',
      sourceWidgetId: 'bar_a',
      sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
      kind: 'point',
      summary: 'Category: a',
      predicates: [{ field: 'category', op: 'equals', value: 'a' }],
    }, {
      makePrimary: true,
      updateByWidget: true,
      focusSourceWidget: true,
    })

    const result = workspace.commitPrimarySelectionToHighlight({
      clearSelection: true,
      focusSourceWidget: true,
    })

    assert.equal(result.changed, true)
    assert.equal(result.selectionRef, 'selection://widgetva-system/bar_a/current')
    assert.equal(Array.isArray(result.highlightState?.entries), true)
    assert.equal(result.coordinationState.selections.views.primary, null)
    assert.equal(Array.isArray(result.coordinationState.highlight.entries), true)
  } finally {
    cleanup()
  }
})

test('WidgetWorkspace clear helpers report whether a shared-state transition actually happened', () => {
  const widget = {
    resolveWidgetRef() {
      return 'wl://widgetva-app/workspace/main/widget/bar_a'
    },
    resolveWidgetId() {
      return 'bar_a'
    },
    describe() {
      return {
        ref: 'wl://widgetva-app/workspace/main/widget/bar_a',
        widgetId: 'bar_a',
        kind: 'bar',
      }
    },
  }
  let state = {
    stateId: 'main:s1',
    shared: {
      focusedWidget: null,
      highlight: {
        entries: [],
        activeWidgetRefs: [],
      },
      selections: {
        registry: {},
        views: {
          primary: null,
          byWidget: {},
        },
      },
    },
  }
  const workspace = createWidgetWorkspace({
    widgets: [widget],
    runtime: {
      store: {
        currentBranchId: 'main',
        readDescription() {
          return {
            appId: 'widgetva-app',
            workspaceId: 'main',
            widgets: [widget.describe()],
            links: [],
          }
        },
        readState() {
          return state
        },
        commitState(nextState) {
          state = nextState
          return nextState
        },
        listLinks() {
          return []
        },
      },
    },
  })

  assert.equal(workspace.clearSelectionState().changed, false)
  assert.equal(workspace.clearHighlightState().changed, false)

  workspace.upsertSelectionEntry({
    selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
    selectionId: 'current',
    sourceWidgetId: 'bar_a',
    kind: 'point',
    summary: 'Origin: USA',
    predicates: [{ field: 'origin', op: 'equals', value: 'USA' }],
  })
  workspace.setHighlightState({
    entries: [{
      widgetRef: widget.resolveWidgetRef(),
      widgetId: 'bar_a',
      sourceWidgetRef: widget.resolveWidgetRef(),
      sourceWidgetId: 'bar_a',
      selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
      summary: 'Origin: USA',
      predicates: [{ field: 'origin', op: 'equals', value: 'USA' }],
      highlightedKeys: ['USA'],
      linkedSourceRefs: ['wl://widgetva-app/workspace/main/widget/bar_a/selection/current'],
    }],
    activeWidgetRefs: [widget.resolveWidgetRef()],
  })

  const clearSelectionResult = workspace.clearSelectionState()
  const clearHighlightResult = workspace.clearHighlightState()
  assert.equal(clearSelectionResult.changed, true)
  assert.equal(clearHighlightResult.changed, true)
  assert.equal(clearSelectionResult.nextSelectionState?.views?.primary, null)
  assert.equal(Array.isArray(clearHighlightResult.nextHighlightState?.entries), true)
  assert.equal(clearHighlightResult.nextHighlightState?.entries?.length, 0)
})

test('WidgetWorkspace.commitClearHighlightState commits the coordination result for highlight clearing', () => {
  const { runtime, spec, cleanup } = buildRuntime()
  const widget = buildWidget(runtime, spec, 'wl://widgetva-app/workspace/main/widget/bar_a', 'bar_a')
  const workspace = createWidgetWorkspace({
    runtime,
    widgets: [widget],
  })

  try {
    workspace.setHighlightState({
      entries: [{
        widgetRef: widget.resolveWidgetRef(),
        widgetId: 'bar_a',
        sourceWidgetRef: widget.resolveWidgetRef(),
        sourceWidgetId: 'bar_a',
        selectionRef: 'selection://widgetva-system/bar_a/current',
        summary: 'Origin: USA',
        predicates: [{ field: 'origin', op: 'equals', value: 'USA' }],
        highlightedKeys: ['USA'],
        linkedSourceRefs: ['selection://widgetva-system/bar_a/current'],
      }],
      activeWidgetRefs: [widget.resolveWidgetRef()],
    })

    const result = workspace.commitClearHighlightState()

    assert.equal(result.changed, true)
    assert.equal(Array.isArray(result.coordinationState.highlight.entries), true)
    assert.equal(result.coordinationState.highlight.entries.length, 0)
    assert.deepEqual(workspace.readLatestCoordinationResult(), result)
  } finally {
    cleanup()
  }
})

test('WidgetWorkspace exposes history, branch, trace-graph, and agent-response reads from the shared runtime store', () => {
  const focusedWidget = {
    resolveWidgetRef() {
      return 'wl://widgetva-app/workspace/main/widget/bar_a'
    },
    resolveWidgetId() {
      return 'bar_a'
    },
    describe() {
      return {
        ref: 'wl://widgetva-app/workspace/main/widget/bar_a',
        widgetId: 'bar_a',
      }
    },
  }
  const runtime = {
    store: {
      workspaceId: 'main',
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          widgets: [focusedWidget.describe()],
          links: [],
        }
      },
      readState() {
        return {
          stateId: 'main:s2',
          shared: {},
        }
      },
      listLinks() {
        return []
      },
      listStateSnapshots({ limit = 50 } = {}) {
        return [{ stateId: 'main:s1' }, { stateId: 'main:s2' }].slice(-limit)
      },
      listBranches() {
        return [{ branchId: 'main', label: 'Main' }]
      },
      readCurrentSnapshotMeta() {
        return { stateId: 'main:s2', branchId: 'main' }
      },
      buildTraceGraph() {
        return {
          nodes: [{ id: 'main:s1' }, { id: 'main:s2' }],
          edges: [{ source: 'main:s1', target: 'main:s2' }],
        }
      },
      readLatestResponse(options = {}) {
        return {
          responseId: 'response_2',
          workspaceId: options.workspaceId || null,
        }
      },
      listResponses(limit = 20, options = {}) {
        return [{ responseId: 'response_2', workspaceId: options.workspaceId || null }].slice(0, limit)
      },
    },
  }
  const workspace = createWidgetWorkspace({
    runtime,
    widgets: [focusedWidget],
  })

  try {
    assert.deepEqual(workspace.readStateHistory({ limit: 1 }), [{ stateId: 'main:s2' }])
    assert.deepEqual(workspace.listBranches(), [{ branchId: 'main', label: 'Main' }])
    assert.deepEqual(workspace.readCurrentSnapshotMeta(), { stateId: 'main:s2', branchId: 'main' })
    assert.deepEqual(workspace.readTraceGraph(), {
      nodes: [{ id: 'main:s1' }, { id: 'main:s2' }],
      edges: [{ source: 'main:s1', target: 'main:s2' }],
    })
    assert.deepEqual(workspace.readLatestAgentResponse(), {
      responseId: 'response_2',
      workspaceId: 'main',
    })
    assert.deepEqual(workspace.listAgentResponses({ limit: 1 }), [
      { responseId: 'response_2', workspaceId: 'main' },
    ])
  } finally {
    workspace.dispose()
  }
})

test('createWidgetWorkspace composes widget instances over a shared runtime and exposes composition helpers', async () => {
  const { runtime, spec, cleanup } = buildRuntime()
  const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
  const widget = buildWidget(runtime, spec, widgetRef, 'session_bar-demo')
  const workspace = createWidgetWorkspace({ widgets: [widget] })

  try {
    assert.equal(workspace.listWidgets().length, 1)
    assert.equal(workspace.getWidget(widgetRef), widget)
    assert.equal(workspace.describe()?.workspaceId, runtime.store.readDescription()?.workspaceId)
    assert.equal(workspace.readState()?.stateId, runtime.store.readState()?.stateId)
    assert.equal(workspace.readWidgetState(widgetRef)?.ref, widgetRef)
    assert.equal(Array.isArray(workspace.listWidgetDescriptions()), true)
    assert.equal(workspace.listWidgetDescriptions().some((entry) => entry?.ref === widgetRef), true)
    assert.equal(workspace.listActionNames().includes('widget.changeEncoding'), true)
    assert.equal(workspace.listActionNames().includes('workspace.jumpToState'), true)
    assert.equal(workspace.listPerceptionNames().includes('perception.findExtremes'), true)
    assert.equal(workspace.listActionDescriptors().some((entry) => entry?.name === 'widget.changeEncoding'), true)
    assert.equal(workspace.listPerceptionDescriptors().some((entry) => entry?.name === 'perception.findExtremes'), true)
    assert.equal(Array.isArray(workspace.getTrace({ limit: 5 })), true)
    assert.equal(workspace.describeComposition().widgetRefs.includes(widgetRef), true)
    assert.equal(workspace.readLinkTopology().topology, 'T1')
  } finally {
    workspace.dispose()
    cleanup()
  }
})

test('WidgetWorkspace can register and remove widgets while enforcing a shared runtime', async () => {
  const first = buildRuntime()
  const second = buildRuntime()
  const firstWidgetRef = first.runtime.store.listWidgetDescriptions()[0]?.ref
  const secondWidgetRef = second.runtime.store.listWidgetDescriptions()[0]?.ref
  const firstWidget = buildWidget(first.runtime, first.spec, firstWidgetRef, 'session_bar-demo')
  const secondWidget = buildWidget(second.runtime, second.spec, secondWidgetRef, 'session_bar-demo')
  const workspace = createWidgetWorkspace({ widgets: [firstWidget] })

  try {
    const duplicate = workspace.registerWidget(firstWidget)
    assert.equal(duplicate, firstWidget)
    assert.equal(workspace.listWidgets().length, 1)

    assert.throws(
      () => workspace.registerWidget(secondWidget),
      /share the same runtime/i,
    )

    assert.equal(workspace.removeWidget(firstWidgetRef), firstWidget)
    assert.equal(workspace.listWidgets().length, 0)
  } finally {
    workspace.dispose()
    first.cleanup()
    second.cleanup()
  }
})

test('WidgetWorkspace registers links, exposes topology, and can remove them', async () => {
  const { runtime, spec, cleanup } = buildRuntime()
  const barRef = runtime.store.listWidgetDescriptions()[0]?.ref
  const scatterRef = 'wl://widgetva-app/workspace/main/widget/scatter_secondary'
  const initialLinkCount = runtime.store.listLinks().length

  runtime.store.registerWidget(
    {
      ref: scatterRef,
      widgetId: 'scatter_secondary',
      kind: 'scatter',
      title: 'Scatter Secondary',
      actionNames: ['scatter.brushRegion'],
      perceptionQueryNames: ['perception.findExtremes'],
      humanInteraction: { mode: 'brush2d', actionName: 'scatter.brushRegion', supportsDirectManipulation: true },
    },
    {
      ref: scatterRef,
      widgetId: 'scatter_secondary',
      kind: 'scatter',
      data: { sourceDataRef: 'wl://widgetva-app/workspace/main/data/scatter_secondary', currentDataRef: 'wl://widgetva-app/workspace/main/data/scatter_secondary' },
      selections: {},
      view: {},
    },
  )

  const initialTopology = workspaceTopologyFromRuntime(runtime)

  const barWidget = buildWidget(runtime, spec, barRef, 'session_bar-demo')
  const scatterWidget = buildWidget(runtime, spec, scatterRef, 'scatter_secondary')
  const workspace = createWidgetWorkspace({ widgets: [barWidget, scatterWidget] })

  try {
    const link = workspace.registerLink({
      kind: 'filter',
      primitive: 'filter',
      from: scatterRef,
      to: barRef,
      sourceWidgetId: 'scatter_secondary',
      targetWidgetId: 'session_bar-demo',
      description: 'Scatter filters bar',
    })

    assert.equal(workspace.listLinks().length, initialLinkCount + 1)
    assert.equal(workspace.getLink(link.ref)?.ref, link.ref)
    assert.equal(Object.hasOwn(workspace.getLink(link.ref) || {}, 'propagationPolicy'), false)
    assert.equal(Object.hasOwn(workspace.getLink(link.ref) || {}, 'trigger'), false)
    assert.equal(Object.hasOwn(workspace.getLink(link.ref) || {}, 'automatic'), false)
    assert.equal(workspace.describeComposition().links.some((entry) => entry?.ref === link.ref), true)
    assert.equal(workspace.readLinkTopology().topology, 'T2')
    assert.equal(
      workspace.readState()?.shared?.links?.definitions?.some((entry) => entry?.ref === link.ref),
      true,
    )

    const removed = workspace.removeLink(link.ref)
    assert.equal(removed?.ref, link.ref)
    assert.equal(workspace.listLinks().length, initialLinkCount)
    assert.equal(workspace.readLinkTopology().edgeCount, initialTopology.edgeCount)
    assert.equal(workspace.readLinkTopology().topology, initialTopology.topology)
    assert.deepEqual(workspace.readState()?.shared?.links?.definitions || [], [])
  } finally {
    workspace.dispose()
    cleanup()
  }
})

test('WidgetWorkspace delegates workspace-level action, perception, and replay through the shared runtime', async () => {
  const stateIds = []
  const runtime = {
    store: {
      readDescription() {
        return { appId: 'widgetva-app', workspaceId: 'main', widgets: [], links: [] }
      },
      readState() {
        return { stateId: 'main:s1', widgets: {}, shared: {} }
      },
      listLinks() {
        return []
      },
    },
    async executeAction(call) {
      stateIds.push(call)
      return { ok: true, actionName: call.name, stateId: 'main:s2' }
    },
    async queryPerception(call) {
      return { ok: true, queryName: call.name, callId: call.callId }
    },
    async runDataQuery(call) {
      return { ok: true, queryName: call.query?.kind, callId: call.callId }
    },
  }
  const workspace = createWidgetWorkspace({ runtime })

  try {
    const description = workspace.describeWorkspace()
    const view = workspace.readView()
    const actionResult = await workspace.executeAction({ name: 'workspace.focusWidget', params: { targetRef: 'x' } })
    const perceptionResult = await workspace.queryPerception({ name: 'perception.findExtremes', params: { field: 'value' } })
    const dataResult = await workspace.runDataQuery({
      dataRef: 'wl://widgetva-app/workspace/main/data/current_view',
      query: { kind: 'summary', spec: {} },
    })
    const trace = workspace.readTrace({ limit: 5 })
    const jumpResult = await workspace.jumpToState({ stateId: 'main:s1' })
    workspace.setLatestCoordinationResult({ changed: true })
    const clearedJumpResult = await workspace.jumpToStateAndClearLatestCoordinationResult({ stateId: 'main:s1' })
    const branchResult = await workspace.branchFromState({ stateId: 'main:s1', branchLabel: 'alt path' })
    const replayResult = await workspace.replay('main:s1')

    assert.equal(description.workspaceId, 'main')
    assert.equal(view.stateId, 'main:s1')
    assert.equal(actionResult.ok, true)
    assert.equal(perceptionResult.ok, true)
    assert.equal(dataResult.ok, true)
    assert.deepEqual(trace, [])
    assert.equal(jumpResult.ok, true)
    assert.equal(clearedJumpResult.ok, true)
    assert.equal(branchResult.ok, true)
    assert.equal(replayResult.ok, true)
    assert.equal(workspace.readLatestCoordinationResult(), null)
    assert.equal(stateIds[0]?.actor, 'agent')
    assert.equal(stateIds[1]?.name, 'workspace.jumpToState')
    assert.equal(stateIds[1]?.params?.stateId, 'main:s1')
    assert.equal(stateIds[2]?.name, 'workspace.jumpToState')
    assert.equal(stateIds[2]?.params?.stateId, 'main:s1')
    assert.equal(stateIds[3]?.name, 'workspace.branchFromState')
    assert.equal(stateIds[3]?.params?.branchLabel, 'alt path')
    assert.equal(stateIds[4]?.name, 'workspace.jumpToState')
    assert.equal(stateIds[4]?.params?.stateId, 'main:s1')
  } finally {
    workspace.dispose()
  }
})

test('WidgetWorkspace.executeActionAndCommitCoordination commits workspace-owned coordination results after successful actions', async () => {
  const actionCalls = []
  const runtime = {
    executeAction: async (call) => {
      actionCalls.push(call)
      return { ok: true, callId: call.callId, actionName: call.name || null }
    },
    store: {
      currentBranchId: 'main',
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          widgets: [],
          links: [],
        }
      },
      readState() {
        return {
          stateId: 'main:s1',
          branchId: 'main',
          shared: {
            selections: {
              registry: {},
              views: {
                primary: null,
                byWidget: {},
              },
            },
          },
          widgets: {},
        }
      },
      listLinks() {
        return []
      },
    },
  }

  const workspace = createWidgetWorkspace({ runtime, widgets: [] })
  const result = await workspace.executeActionAndCommitCoordination({
    name: 'workspace.testAction',
    params: { value: 1 },
  })

  assert.equal(actionCalls.length, 1)
  assert.equal(result.ok, true)
  assert.equal(result.coordinationResult?.changed, true)
  assert.deepEqual(workspace.readLatestCoordinationResult(), result.coordinationResult)
})
