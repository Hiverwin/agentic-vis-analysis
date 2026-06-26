import test from 'node:test'
import assert from 'node:assert/strict'

import {
  installWidgetVAOnD3View,
  installWidgetVAOnEChartsView,
  installWidgetVAOnView,
  installWidgetVAOnVegaLiteView,
} from './installWidgetView.js'
import { createRendererAdapterRegistry } from '../core/rendering/RendererAdapterRegistry.js'

function createSignalTrackingView() {
  const signalCalls = []
  const signals = new Map()
  const view = {
    signal(name, value) {
      if (arguments.length === 1) {
        return signals.get(name)
      }
      signalCalls.push([name, value])
      signals.set(name, value)
      return view
    },
    async runAsync() {},
  }
  return { view, signals, signalCalls }
}

test('installWidgetVAOnView requires a render target and widgetAdapter', async () => {
  await assert.rejects(
    () => installWidgetVAOnView({ widgetAdapter: {} }),
    /requires either a view, surface, or container/,
  )
  await assert.rejects(
    () => installWidgetVAOnView({ view: { id: 'vega-view' } }),
    /requires a widgetAdapter or provider-backed adapterRegistry/,
  )
})

test('installWidgetVAOnView accepts container as a surface alias', async () => {
  let receivedSurface = null
  const adapter = {
    bindHumanInteractions() {
      return () => {}
    },
    async applyState(args) {
      receivedSurface = args.surface
    },
  }

  const container = { nodeName: 'DIV' }
  const installed = await installWidgetVAOnView({
    runtime: null,
    container,
    widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    widgetState: { widgetId: 'scatter_a' },
    spec: { mark: 'point' },
    widgetAdapter: adapter,
  })

  assert.equal(receivedSurface, container)
  installed.dispose()
})

test('installWidgetVAOnView binds interactions and applies initial state through the adapter', async () => {
  const calls = []
  let disposed = false
  const adapter = {
    bindHumanInteractions(args) {
      calls.push({ type: 'bind', args })
      return () => {
        disposed = true
      }
    },
    async applyState(args) {
      calls.push({ type: 'apply', args })
    },
  }

  const installed = await installWidgetVAOnView({
    runtime: null,
    view: { id: 'vega-view' },
    widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    widgetState: { widgetId: 'scatter_a', data: { visibleCount: 3 } },
    spec: { mark: 'point' },
    interactionConfig: { mode: 'brush2d' },
    selectionSourceWidgetId: 'scatter_a',
    onActionCall: () => {},
    onSelectionChange: () => {},
    widgetAdapter: adapter,
  })

  assert.equal(installed.adapter, adapter)
  assert.equal(calls[0]?.type, 'bind')
  assert.equal(calls[1]?.type, 'apply')
  await installed.apply({
    widgetState: { widgetId: 'scatter_a', data: { visibleCount: 1 } },
  })
  assert.equal(calls[2]?.type, 'apply')
  installed.dispose()
  assert.equal(disposed, true)
})

test('installWidgetVAOnVegaLiteView creates a default vega-lite adapter', async () => {
  const installed = await installWidgetVAOnVegaLiteView({
    runtime: null,
    view: { runAsync: async () => {} },
    widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    widgetState: { widgetId: 'scatter_a' },
    spec: { mark: 'point' },
  })

  assert.equal(installed.adapter?.provider, 'vega-lite')
  assert.equal(typeof installed.apply, 'function')
  assert.equal(typeof installed.dispose, 'function')
})

test('installWidgetVAOnVegaLiteView resolves scatter family state application when the adapter kind is scatter', async () => {
  const { view, signals, signalCalls } = createSignalTrackingView()

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_a'
  const installed = await installWidgetVAOnVegaLiteView({
    runtime: null,
    view,
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'scatter_a',
      kind: 'scatter',
      selections: {
        [`${widgetRef}/selection/brush`]: {
          kind: 'interval',
          domain: {
            xDomain: [10, 20],
            yDomain: [30, 40],
          },
          predicates: [
            { field: 'Horsepower', op: 'between', value: [10, 20] },
            { field: 'Miles_per_Gallon', op: 'between', value: [30, 40] },
          ],
          summary: 'Horsepower 10-20; MPG 30-40',
        },
      },
      data: {
        selectedCount: 5,
        visibleCount: 12,
      },
      view: {
        xDomain: [10, 20],
        yDomain: [30, 40],
      },
      feedback: {
        highlightedKeys: ['car_a'],
      },
    },
    spec: { mark: 'point' },
    adapterDefinition: { kind: 'scatter' },
  })

  assert.equal(installed.adapter?.provider, 'vega-lite')
  assert.deepEqual(signals.get('brush'), { x: [10, 20], y: [30, 40] })
  assert.deepEqual(signals.get('xDomain'), [10, 20])
  assert.deepEqual(signals.get('yDomain'), [30, 40])
  assert.equal(signals.get('widgetva_selectedCount'), 5)
  assert.equal(signals.get('widgetva_visibleCount'), 12)
  assert.deepEqual(signals.get('widgetva_highlightedKeys'), ['car_a'])
  assert.equal(signalCalls.some(([name]) => name === 'brush'), true)
  assert.equal(signalCalls.some(([name]) => name === 'widgetva_selection'), true)
})

const VEGA_FAMILY_ROUTE_CASES = [
  {
    kind: 'bar',
    expectedActionName: 'bar.selectCategory',
    selection: {
      kind: 'point',
      summary: 'Origin: USA',
      predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
    },
  },
  {
    kind: 'line',
    expectedActionName: 'line.selectSeries',
    selection: {
      kind: 'point',
      summary: 'Series: revenue',
      predicates: [{ field: 'series', op: 'equals', value: 'revenue' }],
    },
  },
  {
    kind: 'heatmap',
    expectedActionName: 'heatmap.filterCells',
    selection: {
      kind: 'point',
      summary: 'Region: East, Quarter: Q1',
      predicates: [
        { field: 'region', op: 'equals', value: 'East' },
        { field: 'quarter', op: 'equals', value: 'Q1' },
      ],
    },
  },
  {
    kind: 'parallelCoordinates',
    expectedActionName: 'parallelCoordinates.brushAxes',
    selection: {
      kind: 'interval',
      summary: 'Horsepower 80-120; MPG 20-35',
      predicates: [
        { field: 'Horsepower', op: 'between', value: [80, 120] },
        { field: 'MPG', op: 'between', value: [20, 35] },
      ],
      domain: {
        xDomain: [80, 120],
        yDomain: [20, 35],
      },
    },
  },
  {
    kind: 'sankey',
    expectedActionName: 'sankey.focusFlow',
    selection: {
      kind: 'point',
      summary: 'Flow: A -> B',
      predicates: [{ field: 'flow', op: 'equals', value: 'A->B' }],
    },
  },
  {
    kind: 'map',
    expectedActionName: 'map.selectRegion',
    selection: {
      kind: 'point',
      summary: 'Region: APAC',
      predicates: [{ field: 'region', op: 'equals', value: 'APAC' }],
    },
  },
]

for (const { kind, expectedActionName, selection } of VEGA_FAMILY_ROUTE_CASES) {
  test(`installWidgetVAOnVegaLiteView resolves ${kind} through the family adapter and applies widget runtime signals`, async () => {
    const { view, signals, signalCalls } = createSignalTrackingView()
    const widgetRef = `wl://widgetva-app/workspace/main/widget/${kind}_a`
    const installed = await installWidgetVAOnVegaLiteView({
      runtime: null,
      view,
      widgetRef,
      widgetState: {
        ref: widgetRef,
        widgetId: `${kind}_a`,
        kind,
        selections: {
          [`${widgetRef}/selection/main`]: selection,
        },
        data: {
          selectedCount: 4,
          visibleCount: 9,
        },
        view: {
          xDomain: [1, 5],
          yDomain: [2, 8],
        },
        feedback: {
          highlightedKeys: [`${kind}:focus`],
        },
      },
      spec: { mark: 'point' },
      adapterDefinition: { kind },
    })

    assert.equal(installed.adapter?.provider, 'vega-lite')
    assert.equal(installed.adapter?.kind, kind)
    assert.equal(installed.adapter?.getHumanInteractionConfig?.()?.actionName, expectedActionName)
    assert.equal(signals.get('widgetva_selectedCount'), 4)
    assert.equal(signals.get('widgetva_visibleCount'), 9)
    assert.deepEqual(signals.get('widgetva_highlightedKeys'), [`${kind}:focus`])
    assert.equal(signals.get('widgetva_selectionSummary'), selection.summary)
    assert.equal(signalCalls.some(([name]) => name === 'widgetva_selection'), true)

    if (kind === 'parallelCoordinates') {
      assert.deepEqual(signals.get('brush'), { x: [80, 120], y: [20, 35] })
    }
  })
}

test('installWidgetVAOnView resolves a provider-backed adapter through a registry', async () => {
  let applied = false
  const registry = createRendererAdapterRegistry([
    {
      provider: 'custom',
      supportedWidgetKinds: ['scatter'],
      createAdapter() {
        return {
          provider: 'custom',
          bindHumanInteractions() {
            return () => {}
          },
          async applyState() {
            applied = true
          },
        }
      },
    },
  ])

  const installed = await installWidgetVAOnView({
    provider: 'custom',
    adapterRegistry: registry,
    container: { nodeName: 'DIV' },
    widgetRef: 'wl://widgetva-app/workspace/main/widget/custom_scatter',
    widgetState: { widgetId: 'custom_scatter' },
    spec: { mark: 'point' },
  })

  assert.equal(installed.adapter?.provider, 'custom')
  assert.equal(applied, true)
})

test('installWidgetVAOnVegaLiteView binds scatter interactions from the family adapter when interactionConfig is omitted', async () => {
  const signalListeners = new Map()
  const emittedCalls = []
  const view = {
    addSignalListener(name, handler) {
      signalListeners.set(name, handler)
    },
    removeSignalListener() {},
    addEventListener() {},
    removeEventListener() {},
    signal(name) {
      if (name === 'brush') {
        return {
          x: [15, 25],
          y: [30, 45],
        }
      }
      return null
    },
    data() {
      return [
        { Horsepower: 18, MPG: 32 },
        { Horsepower: 22, MPG: 40 },
      ]
    },
    async runAsync() {},
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_bind'
  const installed = await installWidgetVAOnVegaLiteView({
    runtime: null,
    view,
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'scatter_bind',
      kind: 'scatter',
    },
    spec: {
      data: {
        values: [
          { Horsepower: 18, MPG: 32 },
          { Horsepower: 22, MPG: 40 },
        ],
      },
      encoding: {
        x: { field: 'Horsepower' },
        y: { field: 'MPG' },
      },
    },
    adapterDefinition: { kind: 'scatter' },
    onActionCall(call) {
      emittedCalls.push(call)
    },
  })

  assert.equal(typeof signalListeners.get('brush'), 'function')
  signalListeners.get('brush')()

  assert.equal(emittedCalls.length, 1)
  assert.equal(emittedCalls[0]?.name, 'scatter.brushRegion')
  assert.equal(emittedCalls[0]?.targetRef, widgetRef)
  assert.deepEqual(emittedCalls[0]?.params?.xRange, [15, 25])
  assert.deepEqual(emittedCalls[0]?.params?.yRange, [30, 45])
  installed.dispose()
})

test('installWidgetVAOnVegaLiteView binds bar interactions from the family adapter when interactionConfig is omitted', async () => {
  const eventListeners = new Map()
  const emittedCalls = []
  const view = {
    addSignalListener() {},
    removeSignalListener() {},
    addEventListener(name, handler) {
      eventListeners.set(name, handler)
    },
    removeEventListener() {},
    signal() {
      return null
    },
    data() {
      return [
        { Origin: 'USA' },
        { Origin: 'Europe' },
      ]
    },
    async runAsync() {},
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_bind'
  const installed = await installWidgetVAOnVegaLiteView({
    runtime: null,
    view,
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'bar_bind',
      kind: 'bar',
    },
    spec: {
      data: {
        values: [
          { Origin: 'USA' },
          { Origin: 'Europe' },
        ],
      },
      encoding: {
        color: { field: 'Origin' },
      },
    },
    adapterDefinition: { kind: 'bar' },
    onActionCall(call) {
      emittedCalls.push(call)
    },
  })

  assert.equal(typeof eventListeners.get('click'), 'function')
  eventListeners.get('click')(null, { datum: { Origin: 'USA' } })

  assert.equal(emittedCalls.length, 1)
  assert.equal(emittedCalls[0]?.name, 'bar.selectCategory')
  assert.equal(emittedCalls[0]?.targetRef, widgetRef)
  assert.deepEqual(emittedCalls[0]?.params?.values, ['USA'])
  installed.dispose()
})

test('installWidgetVAOnVegaLiteView binds heatmap interactions from the family adapter when interactionConfig is omitted', async () => {
  const eventListeners = new Map()
  const emittedCalls = []
  const view = {
    addSignalListener() {},
    removeSignalListener() {},
    addEventListener(name, handler) {
      eventListeners.set(name, handler)
    },
    removeEventListener() {},
    signal() {
      return null
    },
    data() {
      return [
        { region: 'East', quarter: 'Q1' },
        { region: 'West', quarter: 'Q2' },
      ]
    },
    async runAsync() {},
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/heatmap_bind'
  const installed = await installWidgetVAOnVegaLiteView({
    runtime: null,
    view,
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'heatmap_bind',
      kind: 'heatmap',
    },
    spec: {
      data: {
        values: [
          { region: 'East', quarter: 'Q1' },
          { region: 'West', quarter: 'Q2' },
        ],
      },
      encoding: {
        x: { field: 'quarter' },
        y: { field: 'region' },
      },
    },
    adapterDefinition: { kind: 'heatmap' },
    onActionCall(call) {
      emittedCalls.push(call)
    },
  })

  assert.equal(typeof eventListeners.get('click'), 'function')
  eventListeners.get('click')(null, { datum: { region: 'East', quarter: 'Q1' } })

  assert.equal(emittedCalls.length, 1)
  assert.equal(emittedCalls[0]?.name, 'heatmap.filterCells')
  assert.equal(emittedCalls[0]?.targetRef, widgetRef)
  assert.equal(emittedCalls[0]?.params?.xField, 'quarter')
  assert.equal(emittedCalls[0]?.params?.yField, 'region')
  assert.equal(emittedCalls[0]?.params?.xValue, 'Q1')
  assert.equal(emittedCalls[0]?.params?.yValue, 'East')
  installed.dispose()
})

test('installWidgetVAOnVegaLiteView binds parallel-coordinates interactions from the family adapter when interactionConfig is omitted', async () => {
  const signalListeners = new Map()
  const emittedCalls = []
  const view = {
    addSignalListener(name, handler) {
      signalListeners.set(name, handler)
    },
    removeSignalListener() {},
    addEventListener() {},
    removeEventListener() {},
    signal() {
      return null
    },
    data() {
      return [
        { Horsepower: 90, MPG: 30 },
        { Horsepower: 140, MPG: 20 },
      ]
    },
    async runAsync() {},
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/parallel_bind'
  const installed = await installWidgetVAOnVegaLiteView({
    runtime: null,
    view,
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'parallel_bind',
      kind: 'parallelCoordinates',
    },
    spec: {
      data: {
        values: [
          { Horsepower: 90, MPG: 30 },
          { Horsepower: 140, MPG: 20 },
        ],
      },
      encoding: {},
    },
    adapterDefinition: { kind: 'parallelCoordinates' },
    onActionCall(call) {
      emittedCalls.push(call)
    },
  })

  assert.equal(typeof signalListeners.get('widgetva_multiBrush'), 'function')
  signalListeners.get('widgetva_multiBrush')([
    { field: 'Horsepower', range: [80, 120] },
    { field: 'MPG', range: [25, 35] },
  ])

  assert.equal(emittedCalls.length, 1)
  assert.equal(emittedCalls[0]?.name, 'parallelCoordinates.brushAxes')
  assert.equal(emittedCalls[0]?.targetRef, widgetRef)
  assert.deepEqual(emittedCalls[0]?.params?.rules, [
    { field: 'Horsepower', range: [80, 120] },
    { field: 'MPG', range: [25, 35] },
  ])
  installed.dispose()
})

test('installWidgetVAOnD3View resolves scatter through the family adapter, applies state, and binds default brush interactions', async () => {
  let brushedSelection = null
  let appliedDomain = null
  let focusedState = null
  let highlightState = null
  let aggregateState = null
  let addRemoveState = null
  let annotateState = null
  let drillDownState = null
  let navigateState = null
  let reencodeState = null
  let sortState = null
  let registeredBrushHandler = null
  const emittedCalls = []
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/d3_scatter_bind'

  const installed = await installWidgetVAOnD3View({
    runtime: null,
    view: {
      setBrush(selection) {
        brushedSelection = selection
      },
      setDomain(xDomain, yDomain) {
        appliedDomain = { xDomain, yDomain }
      },
      setFocus(focus) {
        focusedState = focus
      },
      setHighlightState(highlight) {
        highlightState = highlight
      },
      setAggregateState(aggregate) {
        aggregateState = aggregate
      },
      setAddRemoveState(addRemove) {
        addRemoveState = addRemove
      },
      setAnnotateState(annotate) {
        annotateState = annotate
      },
      setDrillDownState(drillDown) {
        drillDownState = drillDown
      },
      setNavigateState(navigate) {
        navigateState = navigate
      },
      setReencodeState(reencode) {
        reencodeState = reencode
      },
      setSort(sort) {
        sortState = sort
      },
      onBrush(handler) {
        registeredBrushHandler = handler
        return () => {
          registeredBrushHandler = null
        }
      },
    },
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'd3_scatter_bind',
      kind: 'scatter',
      selections: {
        [`${widgetRef}/selection/brush`]: {
          kind: 'interval',
          fields: ['Horsepower', 'MPG'],
          value: {
            Horsepower: [80, 120],
            MPG: [20, 35],
          },
          domain: {
            xDomain: [80, 120],
            yDomain: [20, 35],
          },
          summary: 'Horsepower 80-120; MPG 20-35',
        },
      },
      view: {
        xDomain: [80, 120],
        yDomain: [20, 35],
        focusedSeries: ['revenue'],
        highlight: {
          channels: ['opacity'],
          entries: [
            {
              source: 'encoding',
              channel: 'opacity',
              scope: 'root',
            },
          ],
        },
        aggregate: {
          mode: 'resample',
          axis: 'x',
          granularity: 'month',
          agg: 'sum',
          timeField: 'date',
          valueField: 'sales',
        },
        addRemove: {
          mode: 'categoryVisibility',
          operation: 'remove',
          field: 'Origin',
          visibleValues: ['Japan', 'USA'],
        },
        annotate: {
          mode: 'regressionOverlay',
          sourceAction: 'scatter.showRegression',
        },
        drillDown: {
          axis: 'x',
          active: true,
          level: 'month',
          parent: { year: 2024 },
          targetField: 'date',
        },
        sort: {
          channel: 'x',
          field: 'Origin',
          mode: 'explicitOrder',
          values: ['Japan', 'USA'],
        },
        navigate: {
          mode: 'resetDrilldown',
          sourceAction: 'line.resetDrilldownXAxis',
        },
        reencode: {
          mode: 'transpose',
          transposed: true,
        },
      },
    },
    spec: { mark: 'point' },
    adapterDefinition: { kind: 'scatter' },
    onActionCall(call) {
      emittedCalls.push(call)
    },
  })

  assert.equal(installed.adapter?.provider, 'd3')
  assert.equal(installed.adapter?.kind, 'scatter')
  assert.deepEqual(brushedSelection?.domain, {
    xDomain: [80, 120],
    yDomain: [20, 35],
  })
  assert.deepEqual(appliedDomain, {
    xDomain: [80, 120],
    yDomain: [20, 35],
  })
  assert.deepEqual(focusedState, {
    focusedSeries: ['revenue'],
  })
  assert.deepEqual(highlightState, {
    channels: ['opacity'],
    entries: [
      {
        source: 'encoding',
        channel: 'opacity',
        scope: 'root',
      },
    ],
  })
  assert.deepEqual(aggregateState, {
    mode: 'resample',
    axis: 'x',
    granularity: 'month',
    agg: 'sum',
    timeField: 'date',
    valueField: 'sales',
  })
  assert.deepEqual(addRemoveState, {
    mode: 'categoryVisibility',
    operation: 'remove',
    field: 'Origin',
    visibleValues: ['Japan', 'USA'],
  })
  assert.deepEqual(annotateState, {
    mode: 'regressionOverlay',
    sourceAction: 'scatter.showRegression',
  })
  assert.deepEqual(drillDownState, {
    axis: 'x',
    active: true,
    level: 'month',
    parent: { year: 2024 },
    targetField: 'date',
  })
  assert.deepEqual(navigateState, {
    mode: 'resetDrilldown',
    sourceAction: 'line.resetDrilldownXAxis',
  })
  assert.deepEqual(reencodeState, {
    mode: 'transpose',
    transposed: true,
  })
  assert.deepEqual(sortState, {
    channel: 'x',
    field: 'Origin',
    mode: 'explicitOrder',
    values: ['Japan', 'USA'],
  })
  assert.equal(typeof registeredBrushHandler, 'function')

  registeredBrushHandler({
    kind: 'interval',
    fields: ['Horsepower', 'MPG'],
    value: {
      Horsepower: [90, 110],
      MPG: [24, 30],
    },
  })

  assert.equal(emittedCalls.length, 1)
  assert.equal(emittedCalls[0]?.name, 'scatter.brushRegion')
  assert.equal(emittedCalls[0]?.targetRef, widgetRef)
  assert.deepEqual(emittedCalls[0]?.params?.xRange, [90, 110])
  assert.deepEqual(emittedCalls[0]?.params?.yRange, [24, 30])
  installed.dispose()
})

test('installWidgetVAOnD3View applies line focus through imperative host hooks when the bound wrapper exposes setFocus', async () => {
  let selectedSelection = null
  let highlightedKeys = null
  let focusedState = null
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/d3_line_focus'

  const installed = await installWidgetVAOnD3View({
    runtime: null,
    view: {
      setSelection(selection) {
        selectedSelection = selection
      },
      setHighlights(keys) {
        highlightedKeys = keys
      },
      setFocus(focus) {
        focusedState = focus
      },
    },
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'd3_line_focus',
      kind: 'line',
      selections: {
        [`${widgetRef}/selection/main`]: {
          kind: 'point',
          field: 'series',
          values: ['revenue'],
          summary: 'Series: revenue',
        },
      },
      view: {
        focusedSeries: ['revenue'],
      },
      feedback: {
        highlightedKeys: ['series:revenue'],
      },
    },
    spec: { mark: 'line' },
    adapterDefinition: { kind: 'line' },
  })

  assert.deepEqual(selectedSelection, {
    kind: 'point',
    field: 'series',
    values: ['revenue'],
    summary: 'Series: revenue',
  })
  assert.deepEqual(highlightedKeys, ['series:revenue'])
  assert.deepEqual(focusedState, {
    focusedSeries: ['revenue'],
  })
  installed.dispose()
})

test('installWidgetVAOnD3View binds bar interactions from the family adapter when interactionConfig is omitted', async () => {
  let selectedCategory = null
  let highlightedKeys = null
  let registeredCategoryHandler = null
  const emittedCalls = []
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/d3_bar_bind'

  const installed = await installWidgetVAOnD3View({
    runtime: null,
    view: {
      setSelection(selection) {
        selectedCategory = selection
      },
      setHighlights(keys) {
        highlightedKeys = keys
      },
      onCategoryClick(handler) {
        registeredCategoryHandler = handler
        return () => {
          registeredCategoryHandler = null
        }
      },
    },
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'd3_bar_bind',
      kind: 'bar',
      selections: {
        [`${widgetRef}/selection/main`]: {
          kind: 'point',
          field: 'Origin',
          values: ['USA'],
          predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
          summary: 'Origin: USA',
        },
      },
      feedback: {
        highlightedKeys: ['Origin:USA'],
      },
    },
    spec: {
      encoding: {
        color: { field: 'Origin' },
      },
    },
    adapterDefinition: { kind: 'bar' },
    onActionCall(call) {
      emittedCalls.push(call)
    },
  })

  assert.equal(installed.adapter?.provider, 'd3')
  assert.equal(installed.adapter?.kind, 'bar')
  assert.equal(selectedCategory?.summary, 'Origin: USA')
  assert.deepEqual(highlightedKeys, ['Origin:USA'])
  assert.equal(typeof registeredCategoryHandler, 'function')

  registeredCategoryHandler({
    field: 'Origin',
    values: ['Europe'],
  })

  assert.equal(emittedCalls.length, 1)
  assert.equal(emittedCalls[0]?.name, 'bar.selectCategory')
  assert.equal(emittedCalls[0]?.targetRef, widgetRef)
  assert.equal(emittedCalls[0]?.params?.field, 'Origin')
  assert.deepEqual(emittedCalls[0]?.params?.values, ['Europe'])
  installed.dispose()
})

test('installWidgetVAOnD3View binds heatmap interactions from the family adapter when interactionConfig is omitted', async () => {
  let registeredCellHandler = null
  const emittedCalls = []
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/d3_heatmap_bind'

  const installed = await installWidgetVAOnD3View({
    runtime: null,
    view: {
      onCellClick(handler) {
        registeredCellHandler = handler
        return () => {
          registeredCellHandler = null
        }
      },
    },
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'd3_heatmap_bind',
      kind: 'heatmap',
    },
    spec: {
      encoding: {
        x: { field: 'quarter' },
        y: { field: 'region' },
      },
    },
    adapterDefinition: { kind: 'heatmap' },
    onActionCall(call) {
      emittedCalls.push(call)
    },
  })

  assert.equal(typeof registeredCellHandler, 'function')
  registeredCellHandler({
    xField: 'quarter',
    yField: 'region',
    xValue: 'Q1',
    yValue: 'East',
  })

  assert.equal(emittedCalls.length, 1)
  assert.equal(emittedCalls[0]?.name, 'heatmap.filterCells')
  assert.equal(emittedCalls[0]?.targetRef, widgetRef)
  assert.equal(emittedCalls[0]?.params?.xField, 'quarter')
  assert.equal(emittedCalls[0]?.params?.yField, 'region')
  assert.equal(emittedCalls[0]?.params?.xValue, 'Q1')
  assert.equal(emittedCalls[0]?.params?.yValue, 'East')
  installed.dispose()
})

test('installWidgetVAOnD3View binds table interactions from the family adapter when interactionConfig is omitted', async () => {
  let registeredRowHandler = null
  const emittedCalls = []
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/d3_table_bind'

  const installed = await installWidgetVAOnD3View({
    runtime: null,
    view: {
      onRowClick(handler) {
        registeredRowHandler = handler
        return () => {
          registeredRowHandler = null
        }
      },
    },
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'd3_table_bind',
      kind: 'table',
    },
    spec: {},
    adapterDefinition: { kind: 'table' },
    onActionCall(call) {
      emittedCalls.push(call)
    },
  })

  assert.equal(typeof registeredRowHandler, 'function')
  registeredRowHandler({
    keyField: 'Name',
    keys: ['ford pinto'],
  })

  assert.equal(emittedCalls.length, 1)
  assert.equal(emittedCalls[0]?.name, 'table.focusRows')
  assert.equal(emittedCalls[0]?.targetRef, widgetRef)
  assert.equal(emittedCalls[0]?.params?.keyField, 'Name')
  assert.deepEqual(emittedCalls[0]?.params?.keys, ['ford pinto'])
  installed.dispose()
})

test('installWidgetVAOnEChartsView resolves line through the family adapter and applies runtime state via setOption', async () => {
  let receivedOption = null
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/echarts_line_bind'

  const installed = await installWidgetVAOnEChartsView({
    runtime: null,
    view: {
      setOption(option) {
        receivedOption = option
      },
      on() {},
      off() {},
    },
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'echarts_line_bind',
      kind: 'line',
      view: {
        xDomain: [10, 20],
        yDomain: [30, 40],
      },
      data: {
        selectedCount: 2,
        visibleCount: 7,
      },
      feedback: {
        highlightedKeys: ['series:revenue'],
      },
    },
    spec: { mark: 'line' },
    adapterDefinition: { kind: 'line' },
  })

  assert.equal(installed.adapter?.provider, 'echarts')
  assert.equal(installed.adapter?.kind, 'line')
  assert.deepEqual(receivedOption?.xAxis, { min: 10, max: 20 })
  assert.deepEqual(receivedOption?.yAxis, { min: 30, max: 40 })
  assert.equal(receivedOption?.widgetva?.selectedCount, 2)
  assert.equal(receivedOption?.widgetva?.visibleCount, 7)
  assert.deepEqual(receivedOption?.widgetva?.highlightedKeys, ['series:revenue'])
  installed.dispose()
})

test('installWidgetVAOnEChartsView applies family state through imperative host hooks when the bound wrapper exposes them', async () => {
  let brushedSelection = null
  let selectedSelection = null
  let highlightedKeys = null
  let highlightState = null
  let aggregateState = null
  let addRemoveState = null
  let annotateState = null
  let drillDownState = null
  let focusedState = null
  let navigateState = null
  let reencodeState = null
  let sortState = null
  let appliedDomain = null
  let receivedOption = null
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/echarts_scatter_imperative'

  const installed = await installWidgetVAOnEChartsView({
    runtime: null,
    view: {
      setBrush(selection) {
        brushedSelection = selection
      },
      setSelection(selection) {
        selectedSelection = selection
      },
      setHighlights(keys) {
        highlightedKeys = keys
      },
      setHighlightState(highlight) {
        highlightState = highlight
      },
      setAggregateState(aggregate) {
        aggregateState = aggregate
      },
      setAddRemoveState(addRemove) {
        addRemoveState = addRemove
      },
      setAnnotateState(annotate) {
        annotateState = annotate
      },
      setDrillDownState(drillDown) {
        drillDownState = drillDown
      },
      setFocus(focus) {
        focusedState = focus
      },
      setNavigateState(navigate) {
        navigateState = navigate
      },
      setReencodeState(reencode) {
        reencodeState = reencode
      },
      setSort(sort) {
        sortState = sort
      },
      setDomain(xDomain, yDomain) {
        appliedDomain = { xDomain, yDomain }
      },
      setOption(option) {
        receivedOption = option
      },
      on() {},
      off() {},
    },
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'echarts_scatter_imperative',
      kind: 'scatter',
      selections: {
        [`${widgetRef}/selection/brush`]: {
          kind: 'interval',
          fields: ['Horsepower', 'MPG'],
          value: {
            Horsepower: [80, 120],
            MPG: [20, 35],
          },
          domain: {
            xDomain: [80, 120],
            yDomain: [20, 35],
          },
          summary: 'Horsepower 80-120; MPG 20-35',
        },
      },
      view: {
        xDomain: [80, 120],
        yDomain: [20, 35],
        focusedSeries: ['revenue'],
        highlight: {
          channels: ['opacity'],
          entries: [
            {
              source: 'encoding',
              channel: 'opacity',
              scope: 'root',
            },
          ],
        },
        aggregate: {
          mode: 'clusterRowsCols',
          clusterRows: true,
          clusterCols: true,
          method: 'ward',
          colorField: 'Horsepower',
        },
        addRemove: {
          mode: 'itemVisibility',
          operation: 'add',
          xField: 'Origin',
          subField: 'Cylinders',
          visibleItems: [['Japan', '4']],
        },
        annotate: {
          mode: 'marginalBars',
          op: 'sum',
          showTop: true,
          showRight: false,
          valueField: 'Horsepower',
        },
        drillDown: {
          axis: 'x',
          active: true,
          level: 'date',
          parent: { year: 2024, month: 2 },
          targetField: 'day',
        },
        sort: {
          channel: 'x',
          field: 'Origin',
          mode: 'explicitOrder',
          values: ['Japan', 'USA'],
        },
        navigate: {
          mode: 'resetDrilldown',
          sourceAction: 'heatmap.resetDrilldown',
        },
        reencode: {
          mode: 'colorScale',
          channel: 'color',
          scheme: 'reds',
        },
      },
      feedback: {
        highlightedKeys: ['car:ford-pinto'],
      },
    },
    spec: { mark: 'point' },
    adapterDefinition: { kind: 'scatter' },
  })

  assert.deepEqual(brushedSelection?.domain, {
    xDomain: [80, 120],
    yDomain: [20, 35],
  })
  assert.equal(selectedSelection?.summary, 'Horsepower 80-120; MPG 20-35')
  assert.deepEqual(highlightedKeys, ['car:ford-pinto'])
  assert.deepEqual(highlightState, {
    channels: ['opacity'],
    entries: [
      {
        source: 'encoding',
        channel: 'opacity',
        scope: 'root',
      },
    ],
  })
  assert.deepEqual(aggregateState, {
    mode: 'clusterRowsCols',
    clusterRows: true,
    clusterCols: true,
    method: 'ward',
    colorField: 'Horsepower',
  })
  assert.deepEqual(addRemoveState, {
    mode: 'itemVisibility',
    operation: 'add',
    xField: 'Origin',
    subField: 'Cylinders',
    visibleItems: [['Japan', '4']],
  })
  assert.deepEqual(annotateState, {
    mode: 'marginalBars',
    op: 'sum',
    showTop: true,
    showRight: false,
    valueField: 'Horsepower',
  })
  assert.deepEqual(drillDownState, {
    axis: 'x',
    active: true,
    level: 'date',
    parent: { year: 2024, month: 2 },
    targetField: 'day',
  })
  assert.deepEqual(focusedState, {
    focusedSeries: ['revenue'],
  })
  assert.deepEqual(navigateState, {
    mode: 'resetDrilldown',
    sourceAction: 'heatmap.resetDrilldown',
  })
  assert.deepEqual(reencodeState, {
    mode: 'colorScale',
    channel: 'color',
    scheme: 'reds',
  })
  assert.deepEqual(sortState, {
    channel: 'x',
    field: 'Origin',
    mode: 'explicitOrder',
    values: ['Japan', 'USA'],
  })
  assert.deepEqual(appliedDomain, {
    xDomain: [80, 120],
    yDomain: [20, 35],
  })
  assert.deepEqual(receivedOption?.widgetva?.highlightedKeys, ['car:ford-pinto'])
  installed.dispose()
})

test('installWidgetVAOnEChartsView dispatches native ECharts actions when the bound chart instance exposes dispatchAction', async () => {
  let currentOption = {
    legend: { data: ['revenue', 'cost'] },
    series: [{ name: 'revenue' }, { name: 'cost' }],
    dataZoom: [{ xAxisIndex: 0 }, { yAxisIndex: 0 }],
  }
  const dispatchedActions = []
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/echarts_line_native_actions'

  const installed = await installWidgetVAOnEChartsView({
    runtime: null,
    view: {
      getOption() {
        return currentOption
      },
      setOption(option) {
        currentOption = {
          ...currentOption,
          ...option,
        }
      },
      dispatchAction(action) {
        dispatchedActions.push(action)
      },
      on() {},
      off() {},
    },
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'echarts_line_native_actions',
      kind: 'line',
      selections: {
        [`${widgetRef}/selection/main`]: {
          kind: 'point',
          field: 'series',
          values: ['revenue'],
          summary: 'Series: revenue',
        },
      },
      view: {
        xDomain: [100, 150],
        yDomain: [30, 40],
      },
      feedback: {
        highlightedKeys: ['revenue'],
      },
    },
    spec: { mark: 'line' },
    adapterDefinition: { kind: 'line' },
  })

  assert.deepEqual(dispatchedActions, [
    { type: 'legendSelect', name: 'revenue' },
    { type: 'legendUnSelect', name: 'cost' },
    { type: 'downplay', seriesName: 'revenue' },
    { type: 'downplay', seriesName: 'cost' },
    { type: 'highlight', seriesName: 'revenue' },
    { type: 'dataZoom', dataZoomIndex: 0, xAxisIndex: 0, startValue: 100, endValue: 150 },
    { type: 'dataZoom', dataZoomIndex: 1, yAxisIndex: 0, startValue: 30, endValue: 40 },
  ])
  installed.dispose()
})

test('installWidgetVAOnEChartsView dispatches item-level native actions for map-like selections when values match data item names', async () => {
  let currentOption = {
    series: [
      {
        name: 'regions',
        data: [
          { name: 'APAC', value: 10 },
          { name: 'EMEA', value: 12 },
        ],
      },
    ],
  }
  const dispatchedActions = []
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/echarts_map_native_items'

  const installed = await installWidgetVAOnEChartsView({
    runtime: null,
    view: {
      getOption() {
        return currentOption
      },
      setOption(option) {
        currentOption = {
          ...currentOption,
          ...option,
        }
      },
      dispatchAction(action) {
        dispatchedActions.push(action)
      },
      on() {},
      off() {},
    },
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'echarts_map_native_items',
      kind: 'map',
      selections: {
        [`${widgetRef}/selection/main`]: {
          kind: 'point',
          field: 'region',
          values: ['APAC'],
          summary: 'Region: APAC',
        },
      },
    },
    spec: {
      encoding: {
        color: { field: 'region' },
      },
    },
    adapterDefinition: { kind: 'map' },
  })

  assert.deepEqual(dispatchedActions, [
    { type: 'downplay', seriesIndex: 0, dataIndex: 0 },
    { type: 'downplay', seriesIndex: 0, dataIndex: 1 },
    { type: 'highlight', seriesIndex: 0, dataIndex: 0 },
  ])
  installed.dispose()
})

test('installWidgetVAOnEChartsView dispatches item-level native actions when map-like selections and highlight keys match datum fields', async () => {
  let currentOption = {
    series: [
      {
        name: 'regions',
        data: [
          { region: 'APAC', value: 10 },
          { region: 'EMEA', value: 12 },
        ],
      },
    ],
  }
  const dispatchedActions = []
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/echarts_map_native_field_items'

  const installed = await installWidgetVAOnEChartsView({
    runtime: null,
    view: {
      getOption() {
        return currentOption
      },
      setOption(option) {
        currentOption = {
          ...currentOption,
          ...option,
        }
      },
      dispatchAction(action) {
        dispatchedActions.push(action)
      },
      on() {},
      off() {},
    },
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'echarts_map_native_field_items',
      kind: 'map',
      selections: {
        [`${widgetRef}/selection/main`]: {
          kind: 'point',
          field: 'region',
          values: ['APAC'],
          summary: 'Region: APAC',
        },
      },
      feedback: {
        highlightedKeys: ['region:APAC'],
      },
    },
    spec: {
      encoding: {
        color: { field: 'region' },
      },
    },
    adapterDefinition: { kind: 'map' },
  })

  assert.deepEqual(dispatchedActions, [
    { type: 'downplay', seriesIndex: 0, dataIndex: 0 },
    { type: 'downplay', seriesIndex: 0, dataIndex: 1 },
    { type: 'highlight', seriesIndex: 0, dataIndex: 0 },
  ])
  installed.dispose()
})

test('installWidgetVAOnEChartsView preserves array-shaped axes and emits dataZoom patches when the bound chart already uses them', async () => {
  let receivedOption = null
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/echarts_line_array_axes'

  const installed = await installWidgetVAOnEChartsView({
    runtime: null,
    view: {
      getOption() {
        return {
          xAxis: [{ type: 'value' }],
          yAxis: [{ type: 'value' }],
          dataZoom: [{ type: 'inside', xAxisIndex: 0 }, { type: 'inside', yAxisIndex: 0 }],
        }
      },
      setOption(option) {
        receivedOption = option
      },
      on() {},
      off() {},
    },
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'echarts_line_array_axes',
      kind: 'line',
      view: {
        xDomain: [100, 150],
        yDomain: [30, 40],
      },
    },
    spec: { mark: 'line' },
    adapterDefinition: { kind: 'line' },
  })

  assert.deepEqual(receivedOption?.xAxis, [{ min: 100, max: 150 }])
  assert.deepEqual(receivedOption?.yAxis, [{ min: 30, max: 40 }])
  assert.deepEqual(receivedOption?.dataZoom, [
    { xAxisIndex: 0, startValue: 100, endValue: 150 },
    { yAxisIndex: 0, startValue: 30, endValue: 40 },
  ])
  installed.dispose()
})

test('installWidgetVAOnEChartsView binds bar interactions from the family adapter when interactionConfig is omitted', async () => {
  const eventHandlers = new Map()
  const emittedCalls = []
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/echarts_bar_bind'

  const installed = await installWidgetVAOnEChartsView({
    runtime: null,
    view: {
      setOption() {},
      on(name, handler) {
        eventHandlers.set(name, handler)
      },
      off(name) {
        eventHandlers.delete(name)
      },
    },
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'echarts_bar_bind',
      kind: 'bar',
    },
    spec: {
      encoding: {
        color: { field: 'Origin' },
      },
    },
    adapterDefinition: { kind: 'bar' },
    onActionCall(call) {
      emittedCalls.push(call)
    },
  })

  assert.equal(typeof eventHandlers.get('click'), 'function')
  eventHandlers.get('click')({
    name: 'USA',
    data: { Origin: 'USA' },
  })

  assert.equal(emittedCalls.length, 1)
  assert.equal(emittedCalls[0]?.name, 'bar.selectCategory')
  assert.equal(emittedCalls[0]?.targetRef, widgetRef)
  assert.equal(emittedCalls[0]?.params?.field, 'Origin')
  assert.deepEqual(emittedCalls[0]?.params?.values, ['USA'])
  installed.dispose()
})

test('installWidgetVAOnEChartsView binds scatter brush interactions from the family adapter when interactionConfig is omitted', async () => {
  const eventHandlers = new Map()
  const emittedCalls = []
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/echarts_scatter_bind'

  const installed = await installWidgetVAOnEChartsView({
    runtime: null,
    view: {
      setOption() {},
      on(name, handler) {
        eventHandlers.set(name, handler)
      },
      off(name) {
        eventHandlers.delete(name)
      },
    },
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'echarts_scatter_bind',
      kind: 'scatter',
    },
    spec: { mark: 'point' },
    adapterDefinition: { kind: 'scatter' },
    onActionCall(call) {
      emittedCalls.push(call)
    },
  })

  assert.equal(typeof eventHandlers.get('brushselected'), 'function')
  eventHandlers.get('brushselected')({
    widgetvaSelection: {
      fields: ['Horsepower', 'MPG'],
      value: {
        Horsepower: [80, 120],
        MPG: [20, 35],
      },
    },
  })

  assert.equal(emittedCalls.length, 1)
  assert.equal(emittedCalls[0]?.name, 'scatter.brushRegion')
  assert.equal(emittedCalls[0]?.targetRef, widgetRef)
  assert.deepEqual(emittedCalls[0]?.params?.xRange, [80, 120])
  assert.deepEqual(emittedCalls[0]?.params?.yRange, [20, 35])
  installed.dispose()
})

test('installWidgetVAOnEChartsView binds parallel-coordinates multi-brush interactions from the family adapter when interactionConfig is omitted', async () => {
  const eventHandlers = new Map()
  const emittedCalls = []
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/echarts_parallel_bind'

  const installed = await installWidgetVAOnEChartsView({
    runtime: null,
    view: {
      setOption() {},
      on(name, handler) {
        eventHandlers.set(name, handler)
      },
      off(name) {
        eventHandlers.delete(name)
      },
    },
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'echarts_parallel_bind',
      kind: 'parallelCoordinates',
    },
    spec: {},
    adapterDefinition: { kind: 'parallelCoordinates' },
    onActionCall(call) {
      emittedCalls.push(call)
    },
  })

  assert.equal(typeof eventHandlers.get('axisareaselected'), 'function')
  eventHandlers.get('axisareaselected')({
    rules: [
      { field: 'Horsepower', range: [80, 120] },
      { field: 'MPG', range: [20, 35] },
    ],
  })

  assert.equal(emittedCalls.length, 1)
  assert.equal(emittedCalls[0]?.name, 'parallelCoordinates.brushAxes')
  assert.equal(emittedCalls[0]?.targetRef, widgetRef)
  assert.deepEqual(emittedCalls[0]?.params?.rules, [
    { field: 'Horsepower', range: [80, 120] },
    { field: 'MPG', range: [20, 35] },
  ])
  installed.dispose()
})

test('installWidgetVAOnEChartsView binds heatmap interactions from the family adapter when interactionConfig is omitted', async () => {
  const eventHandlers = new Map()
  const emittedCalls = []
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/echarts_heatmap_bind'

  const installed = await installWidgetVAOnEChartsView({
    runtime: null,
    view: {
      setOption() {},
      on(name, handler) {
        eventHandlers.set(name, handler)
      },
      off(name) {
        eventHandlers.delete(name)
      },
    },
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'echarts_heatmap_bind',
      kind: 'heatmap',
    },
    spec: {
      encoding: {
        x: { field: 'quarter' },
        y: { field: 'region' },
      },
    },
    adapterDefinition: { kind: 'heatmap' },
    onActionCall(call) {
      emittedCalls.push(call)
    },
  })

  assert.equal(typeof eventHandlers.get('click'), 'function')
  eventHandlers.get('click')({
    data: { quarter: 'Q1', region: 'East' },
  })

  assert.equal(emittedCalls.length, 1)
  assert.equal(emittedCalls[0]?.name, 'heatmap.filterCells')
  assert.equal(emittedCalls[0]?.targetRef, widgetRef)
  assert.equal(emittedCalls[0]?.params?.xField, 'quarter')
  assert.equal(emittedCalls[0]?.params?.yField, 'region')
  assert.equal(emittedCalls[0]?.params?.xValue, 'Q1')
  assert.equal(emittedCalls[0]?.params?.yValue, 'East')
  installed.dispose()
})

test('installWidgetVAOnEChartsView binds table interactions from the family adapter when interactionConfig is omitted', async () => {
  const eventHandlers = new Map()
  const emittedCalls = []
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/echarts_table_bind'

  const installed = await installWidgetVAOnEChartsView({
    runtime: null,
    view: {
      setOption() {},
      on(name, handler) {
        eventHandlers.set(name, handler)
      },
      off(name) {
        eventHandlers.delete(name)
      },
    },
    widgetRef,
    widgetState: {
      ref: widgetRef,
      widgetId: 'echarts_table_bind',
      kind: 'table',
    },
    spec: {},
    adapterDefinition: { kind: 'table' },
    onActionCall(call) {
      emittedCalls.push(call)
    },
  })

  assert.equal(typeof eventHandlers.get('click'), 'function')
  eventHandlers.get('click')({
    data: { Name: 'ford pinto', MPG: 25 },
  })

  assert.equal(emittedCalls.length, 1)
  assert.equal(emittedCalls[0]?.name, 'table.focusRows')
  assert.equal(emittedCalls[0]?.targetRef, widgetRef)
  assert.equal(emittedCalls[0]?.params?.keyField, 'Name')
  assert.deepEqual(emittedCalls[0]?.params?.keys, ['ford pinto'])
  installed.dispose()
})
