import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeBarWidgetContract,
  describeHeatmapWidgetContract,
  describeLineWidgetContract,
  describeParallelCoordinatesWidgetContract,
  describeSankeyWidgetContract,
  describeScatterWidgetContract,
} from '../../../../widgetva-kit/src/widgets.js'
import { WORKSPACE_CASES } from '../presets/workspaceCases.js'
import { createRuntimeSession } from './runtimeSessionFactory.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

const CONTRACTS_BY_KIND = {
  scatter: describeScatterWidgetContract(),
  bar: describeBarWidgetContract(),
  line: describeLineWidgetContract(),
  heatmap: describeHeatmapWidgetContract(),
  parallelCoordinates: describeParallelCoordinatesWidgetContract(),
  sankey: describeSankeyWidgetContract(),
}

test('createRuntimeSession builds a first-party runtime session with workspace and widget instances', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createRuntimeSession(WORKSPACE_CASES[0])
  try {
    assert.equal(typeof session.runtime?.executeAction, 'function')
    assert.equal(typeof session.workspace?.listWidgetDescriptions, 'function')
    assert.equal(Array.isArray(session.widgets), true)
    assert.equal(session.widgets.length, 6)
    assert.equal(Array.isArray(session.workspaceSpec?.widgets), true)
    assert.equal(Array.isArray(session.workspaceSpec?.links), true)
    assert.equal(session.activeWidgetId, session.workspaceSpec.widgets[0].widgetId)
    session.workspace.syncPrimarySelectionEntry({
      selectionRef: 'selection://widgetva-system/w_scatter_cars/brush',
      sourceWidgetId: 'w_scatter_cars',
      sourceWidgetRef: `wl://widgetva-app/workspace/${WORKSPACE_CASES[0].id}/widget/w_scatter_cars`,
      kind: 'brush',
      predicates: [
        { field: 'horsepower', op: 'between', value: [80, 140] },
        { field: 'mpg', op: 'between', value: [18, 30] },
      ],
      summary: 'Scatter brush',
    })
    session.workspace.setGlobalFilters({ origin: 'Japan' })
    session.workspace.setFocusedWidget('w_bar_origin')
    session.workspace.updateSharedCoordinationState((shared) => ({
      ...(shared || {}),
      viewport: {
        sourceWidgetRef: `wl://widgetva-app/workspace/${WORKSPACE_CASES[0].id}/widget/w_scatter_cars`,
        xDomain: [80, 140],
        yDomain: [18, 30],
      },
    }))

    assert.equal(typeof session.hostBridge?.readSelectionRegistry, 'function')
    assert.equal(Object.keys(session.hostBridge.readSelectionRegistry()).length, 1)
    assert.equal(session.hostBridge.readPrimarySelectionRef(), 'selection://widgetva-system/w_scatter_cars/brush')
    assert.equal(session.hostBridge.readCurrentSelection()?.kind, 'brush')
    assert.equal(session.hostBridge.readFocusedWidgetRef()?.includes('w_bar_origin'), true)
    assert.deepEqual(session.hostBridge.readSharedFilters(), { origin: 'Japan' })
    assert.deepEqual(session.hostBridge.readViewportState(), {
      sourceWidgetRef: `wl://widgetva-app/workspace/${WORKSPACE_CASES[0].id}/widget/w_scatter_cars`,
      xDomain: [80, 140],
      yDomain: [18, 30],
      zoom: null,
    })
  } finally {
    session.dispose?.()
    globalThis.window = previousWindow
  }
})

test('createRuntimeSession materializes addressable widget refs for all workspace widgets', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createRuntimeSession(WORKSPACE_CASES[0])

  try {
    const widgetDescriptions = session.workspace.listWidgetDescriptions()
    assert.equal(widgetDescriptions.length, 6)
    assert.equal(widgetDescriptions.every((entry) => typeof entry?.ref === 'string' && entry.ref.includes('/widget/')), true)

    for (const widget of session.widgets) {
      assert.equal(typeof widget.resolveWidgetRef(), 'string')
      assert.equal(widget.resolveWidgetRef().includes('/widget/'), true)
      assert.equal(typeof widget.describe()?.ref, 'string')
      assert.equal(widget.describe()?.widgetId, widget.resolveWidgetId())
    }
  } finally {
    session.dispose?.()
    globalThis.window = previousWindow
  }
})

test('scatter keeps the same agent-facing action and perception contract across vega-lite, echarts, and d3 providers', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}

  const providerCases = [
    { provider: 'vega-lite', type: 'scatter-vega' },
    { provider: 'echarts', type: 'scatter-echarts' },
    { provider: 'd3', type: 'scatter-d3' },
  ]

  try {
    for (const providerCase of providerCases) {
      const caseDef = clone(WORKSPACE_CASES[0])
      caseDef.id = `cars-horsepower-${providerCase.provider}`
      caseDef.widgets = caseDef.widgets.map((widget) => (
        widget.id === 'w_scatter_cars'
          ? { ...widget, provider: providerCase.provider, type: providerCase.type }
          : widget
      ))

      const session = createRuntimeSession(caseDef)
      try {
        const scatterWidget = session.workspace.getWidget('w_scatter_cars')
        const workspaceDescription = session.runtime.describeWorkspace()
        const scatterAdapter = workspaceDescription?.widgetAdapters?.find((adapter) => adapter.widgetRef === scatterWidget.resolveWidgetRef())

        assert.equal(scatterAdapter?.provider, providerCase.provider)
        assert.deepEqual(
          scatterWidget.listActionNames(),
          ['scatter.brushRegion', 'scatter.zoomDomain', 'scatter.identifyClusters', 'scatter.showRegression'],
        )
        assert.deepEqual(
          scatterWidget.listPerceptionNames(),
          ['perception.computeCorrelation', 'perception.findOutliers', 'perception.findExtremes'],
        )

        const observation = scatterWidget.readObservation()
        assert.deepEqual(observation.actionNames, ['scatter.brushRegion', 'scatter.zoomDomain', 'scatter.identifyClusters', 'scatter.showRegression'])
        assert.deepEqual(observation.perceptionNames, ['perception.computeCorrelation', 'perception.findOutliers', 'perception.findExtremes'])

        const actionResult = await scatterWidget.executeAction({
          name: 'scatter.brushRegion',
          params: {
            xField: 'horsepower',
            yField: 'mpg',
            xRange: [80, 140],
            yRange: [18, 30],
          },
        })
        assert.equal(actionResult?.ok, true)
      } finally {
        session.dispose?.()
      }
    }
  } finally {
    globalThis.window = previousWindow
  }
})

test('all six widget families keep the same agent-facing action and perception contract across provider environments', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const providers = ['vega-lite', 'echarts', 'd3']

  try {
    for (const provider of providers) {
      const caseDef = clone(WORKSPACE_CASES[0])
      caseDef.id = `cars-horsepower-all-${provider}`
      caseDef.widgets = caseDef.widgets.map((widget) => ({
        ...widget,
        provider,
      }))

      const session = createRuntimeSession(caseDef)
      try {
        const widgetAdapters = session.runtime.describeWorkspace()?.widgetAdapters || []
        assert.equal(widgetAdapters.length, 6)
        assert.equal(widgetAdapters.every((adapter) => adapter.provider === provider), true)

        for (const widgetDef of caseDef.widgets) {
          const widget = session.workspace.getWidget(widgetDef.id)
          const expectedContract = CONTRACTS_BY_KIND[widgetDef.widgetKind]

          assert.deepEqual(widget.listActionNames(), expectedContract.actionNames)
          assert.deepEqual(widget.listPerceptionNames(), expectedContract.perceptionNames)

          const observation = widget.readObservation()
          assert.deepEqual(observation.actionNames, expectedContract.actionNames)
          assert.deepEqual(observation.perceptionNames, expectedContract.perceptionNames)
        }
      } finally {
        session.dispose?.()
      }
    }
  } finally {
    globalThis.window = previousWindow
  }
})
