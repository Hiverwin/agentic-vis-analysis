import test from 'node:test'
import assert from 'node:assert/strict'

import { createWidgetVARuntime } from '../core.js'
import { SINGLE_WIDGET_AGENT_CONTRACT_VERSION } from '../widgets/agentContract.js'
import { CustomWidgetAdapter } from './CustomWidgetAdapter.js'
import { D3WidgetAdapter } from './D3WidgetAdapter.js'
import { EChartsWidgetAdapter } from './EChartsWidgetAdapter.js'
import { VegaLiteWidgetAdapter } from './VegaLiteWidgetAdapter.js'

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

function createRuntimeWithScatterSpec() {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const spec = buildScatterSpec()
  const runtime = createWidgetVARuntime({
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'test-session',
      readBaselineSpec: () => spec,
      readCurrentSpec: () => spec,
      readWorkspaceSpec: () => null,
      readPlanningRequest: () => null,
      readRunMode: () => 'goal_oriented',
      readUserIntent: () => '',
      readCurrentSelection: () => null,
      readCurrentSelections: () => ({}),
      readFocusedWidgetRef: () => null,
      readComparisonTargets: () => [],
      readWorkspaceAnnotations: () => [],
    },
  })

  return {
    runtime,
    restore() {
      runtime.dispose()
      globalThis.window = previousWindow
    },
  }
}

test('VegaLiteWidgetAdapter exposes a named provider runtime object and applies direct WidgetState via its bound view', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_provider'
  const dataRef = 'wl://demo/workspace/main/data/cars'
  let runCount = 0
  const adapter = new VegaLiteWidgetAdapter({
    widgetRef,
    dataRef,
    view: {
      async runAsync() {
        runCount += 1
      },
    },
    definition: {
      kind: 'scatter',
      buildActionDescriptors({ widgetRef: targetWidgetRef }) {
        return [{ name: 'widget.changeEncoding', targetRef: targetWidgetRef }]
      },
      buildPerceptionDescriptors({ dataRef: targetDataRef }) {
        return [{ name: 'perception.inspectVisibleRows', targetRef: targetDataRef }]
      },
    },
    getDescription() {
      return { ref: widgetRef, title: 'Scatter Provider' }
    },
    getState() {
      return { ref: widgetRef, widgetId: 'scatter_provider', kind: 'scatter' }
    },
  })

  const actionDescriptors = adapter.buildActionDescriptors({
    widgetRef,
    selectionRef: `${widgetRef}/selection/brush`,
  })
  const perceptionDescriptors = adapter.buildPerceptionDescriptors({ dataRef })

  await adapter.applyState({
    ref: widgetRef,
    widgetId: 'scatter_provider',
    kind: 'scatter',
    view: {
      zoom: 2,
    },
  })

  assert.equal(adapter.widgetRef, widgetRef)
  assert.equal(adapter.dataRef, dataRef)
  assert.equal(adapter.kind, 'scatter')
  assert.equal(adapter.provider, 'vega-lite')
  assert.deepEqual(adapter.describeCapabilities()?.providerCapabilities?.supportedWidgetKinds, ['scatter'])
  assert.equal(adapter.getDescription()?.title, 'Scatter Provider')
  assert.equal(adapter.providerCapabilities?.supportsSignalPatching, true)
  assert.equal(adapter.providerCapabilities?.supportsRendererMount, true)
  assert.equal(typeof adapter.buildActionDescriptors, 'function')
  assert.equal(typeof adapter.buildPerceptionDescriptors, 'function')
  assert.deepEqual(actionDescriptors, [{ name: 'widget.changeEncoding', targetRef: widgetRef }])
  assert.deepEqual(perceptionDescriptors, [{ name: 'perception.inspectVisibleRows', targetRef: dataRef }])
  assert.equal(typeof adapter.registerActions, 'function')
  assert.equal(typeof adapter.registerPerceptionQueries, 'function')
  assert.equal(typeof adapter.bindHumanInteractions, 'function')
  assert.equal(typeof adapter.applyState, 'function')
  assert.equal(typeof adapter.mount, 'function')
  assert.equal(typeof adapter.update, 'function')
  assert.equal(typeof adapter.dispose, 'function')
  assert.equal(typeof adapter.readSelection, 'function')
  assert.equal(typeof adapter.readViewport, 'function')
  assert.equal(runCount, 1)
})

test('EChartsWidgetAdapter preserves provider-specific option merge behavior for direct WidgetState callers', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/line_provider'
  let receivedOption = null
  let receivedArgs = null
  const adapter = new EChartsWidgetAdapter({
    widgetRef,
    view: {
      setOption(option) {
        receivedOption = option
      },
    },
    definition: {
      kind: 'line',
      buildOptionFromState(args) {
        receivedArgs = args
        return {
          series: [{ data: args?.state?.data?.points || [] }],
        }
      },
    },
    getDescription() {
      return { ref: widgetRef, title: 'Line Provider' }
    },
    getState() {
      return { ref: widgetRef, widgetId: 'line_provider', kind: 'line' }
    },
  })

  await adapter.applyState({
    ref: widgetRef,
    widgetId: 'line_provider',
    kind: 'line',
    data: {
      points: [1, 2, 3],
    },
  })

  assert.equal(adapter.provider, 'echarts')
  assert.equal(adapter.providerCapabilities?.supportsOptionMerging, true)
  assert.equal(adapter.providerCapabilities?.supportsRendererUpdate, true)
  assert.equal(receivedArgs?.state?.widgetId, 'line_provider')
  assert.deepEqual(receivedOption, {
    series: [{ data: [1, 2, 3] }],
  })
})

test('EChartsWidgetAdapter reads selection and viewport back from the bound chart option state', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/echarts_readback'
  let currentOption = {
    xAxis: [{ type: 'value' }],
    yAxis: [{ type: 'value' }],
    dataZoom: [{ type: 'inside', xAxisIndex: 0 }, { type: 'inside', yAxisIndex: 0 }],
  }
  const adapter = new EChartsWidgetAdapter({
    widgetRef,
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
    },
    definition: {
      kind: 'line',
      buildOptionFromState(args) {
        return {
          widgetva: {
            selection: args?.state?.selections?.[`${widgetRef}/selection/main`] || null,
          },
          xAxis: [{ min: 100, max: 150 }],
          yAxis: [{ min: 30, max: 40 }],
          dataZoom: [
            { xAxisIndex: 0, startValue: 100, endValue: 150 },
            { yAxisIndex: 0, startValue: 30, endValue: 40 },
          ],
        }
      },
    },
    getDescription() {
      return { ref: widgetRef, title: 'Line Readback' }
    },
    getState() {
      return { ref: widgetRef, widgetId: 'echarts_readback', kind: 'line' }
    },
  })

  await adapter.applyState({
    ref: widgetRef,
    widgetId: 'echarts_readback',
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
  })

  assert.equal(adapter.providerCapabilities?.supportsSelectionReadback, true)
  assert.equal(adapter.providerCapabilities?.supportsViewportReadback, true)
  assert.deepEqual(adapter.readSelection(), {
    kind: 'point',
    field: 'series',
    values: ['revenue'],
    summary: 'Series: revenue',
  })
  assert.deepEqual(adapter.readViewport(), {
    xDomain: [100, 150],
    yDomain: [30, 40],
  })
})

test('EChartsWidgetAdapter applies selection, highlight, and viewport through imperative host hooks even when setOption is unavailable', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/echarts_imperative_hooks'
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
  let appliedViewport = null
  const adapter = new EChartsWidgetAdapter({
    widgetRef,
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
      setViewport(viewport) {
        appliedViewport = viewport
      },
    },
    definition: {
      kind: 'scatter',
      buildOptionFromState() {
        throw new Error('buildOptionFromState should not be required when imperative hooks are available without setOption.')
      },
    },
    getDescription() {
      return { ref: widgetRef, title: 'Scatter Hooks' }
    },
    getState() {
      return { ref: widgetRef, widgetId: 'echarts_imperative_hooks', kind: 'scatter' }
    },
  })

  await adapter.applyState({
    ref: widgetRef,
    widgetId: 'echarts_imperative_hooks',
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
      [`${widgetRef}/selection/focus`]: {
        kind: 'point',
        field: 'series',
        values: ['revenue'],
        summary: 'Series: revenue',
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
        agg: 'mean',
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
        sourceAction: 'line.highlightTrend',
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
    feedback: {
      highlightedKeys: ['series:revenue'],
    },
  })

  assert.deepEqual(brushedSelection?.domain, {
    xDomain: [80, 120],
    yDomain: [20, 35],
  })
  assert.deepEqual(selectedSelection, {
    kind: 'point',
    field: 'series',
    values: ['revenue'],
    summary: 'Series: revenue',
  })
  assert.deepEqual(highlightedKeys, ['series:revenue'])
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
    agg: 'mean',
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
    sourceAction: 'line.highlightTrend',
  })
  assert.deepEqual(drillDownState, {
    axis: 'x',
    active: true,
    level: 'month',
    parent: { year: 2024 },
    targetField: 'date',
  })
  assert.deepEqual(focusedState, {
    focusedSeries: ['revenue'],
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
  assert.deepEqual(appliedViewport, {
    xDomain: [80, 120],
    yDomain: [20, 35],
  })
})

test('EChartsWidgetAdapter dispatches native ECharts actions for legend selection, highlight, and dataZoom when bound to an ECharts-like chart', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/echarts_native_actions'
  let currentOption = {
    legend: { data: ['revenue', 'cost'] },
    series: [{ name: 'revenue' }, { name: 'cost' }],
    dataZoom: [{ xAxisIndex: 0 }, { yAxisIndex: 0 }],
  }
  const dispatchedActions = []
  const adapter = new EChartsWidgetAdapter({
    widgetRef,
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
    },
    definition: {
      kind: 'line',
      buildOptionFromState(args) {
        return {
          widgetva: {
            selection: args?.state?.selections?.[`${widgetRef}/selection/main`] || null,
            highlightedKeys: args?.state?.feedback?.highlightedKeys || [],
          },
          xAxis: [{ min: 100, max: 150 }],
          yAxis: [{ min: 30, max: 40 }],
          dataZoom: [
            { xAxisIndex: 0, startValue: 100, endValue: 150 },
            { yAxisIndex: 0, startValue: 30, endValue: 40 },
          ],
        }
      },
    },
    getDescription() {
      return { ref: widgetRef, title: 'Line Native Actions' }
    },
    getState() {
      return { ref: widgetRef, widgetId: 'echarts_native_actions', kind: 'line' }
    },
  })

  await adapter.applyState({
    ref: widgetRef,
    widgetId: 'echarts_native_actions',
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
})

test('EChartsWidgetAdapter dispatches item-level native highlight actions when selection values map to data item names instead of series names', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/echarts_native_item_actions'
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
  const adapter = new EChartsWidgetAdapter({
    widgetRef,
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
    },
    definition: {
      kind: 'map',
      buildOptionFromState(args) {
        return {
          widgetva: {
            selection: args?.state?.selections?.[`${widgetRef}/selection/main`] || null,
          },
        }
      },
    },
    getDescription() {
      return { ref: widgetRef, title: 'Map Native Item Actions' }
    },
    getState() {
      return { ref: widgetRef, widgetId: 'echarts_native_item_actions', kind: 'map' }
    },
  })

  await adapter.applyState({
    ref: widgetRef,
    widgetId: 'echarts_native_item_actions',
    kind: 'map',
    selections: {
      [`${widgetRef}/selection/main`]: {
        kind: 'point',
        field: 'region',
        values: ['APAC'],
        summary: 'Region: APAC',
      },
    },
  })

  assert.deepEqual(dispatchedActions, [
    { type: 'downplay', seriesIndex: 0, dataIndex: 0 },
    { type: 'downplay', seriesIndex: 0, dataIndex: 1 },
    { type: 'highlight', seriesIndex: 0, dataIndex: 0 },
  ])
})

test('EChartsWidgetAdapter dispatches item-level native highlight actions when selection fields and highlight keys match datum fields instead of datum names', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/echarts_native_field_item_actions'
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
  const adapter = new EChartsWidgetAdapter({
    widgetRef,
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
    },
    definition: {
      kind: 'map',
      buildOptionFromState(args) {
        return {
          widgetva: {
            selection: args?.state?.selections?.[`${widgetRef}/selection/main`] || null,
            highlightedKeys: args?.state?.feedback?.highlightedKeys || [],
          },
        }
      },
    },
    getDescription() {
      return { ref: widgetRef, title: 'Map Native Field Actions' }
    },
    getState() {
      return { ref: widgetRef, widgetId: 'echarts_native_field_item_actions', kind: 'map' }
    },
  })

  await adapter.applyState({
    ref: widgetRef,
    widgetId: 'echarts_native_field_item_actions',
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
  })

  assert.deepEqual(dispatchedActions, [
    { type: 'downplay', seriesIndex: 0, dataIndex: 0 },
    { type: 'downplay', seriesIndex: 0, dataIndex: 1 },
    { type: 'highlight', seriesIndex: 0, dataIndex: 0 },
  ])
})

test('D3WidgetAdapter preserves imperative render behavior for direct WidgetState callers', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/d3_provider'
  let receivedArgs = null
  const adapter = new D3WidgetAdapter({
    widgetRef,
    view: { nodeName: 'SVG' },
    definition: {
      kind: 'scatter',
      async renderFromState(args) {
        receivedArgs = args
      },
    },
    getDescription() {
      return { ref: widgetRef }
    },
    getState() {
      return { ref: widgetRef, widgetId: 'd3_provider', kind: 'scatter' }
    },
  })

  await adapter.applyState({
    ref: widgetRef,
    widgetId: 'd3_provider',
    kind: 'scatter',
  })

  assert.equal(adapter.provider, 'd3')
  assert.equal(adapter.providerCapabilities?.supportsImperativeRender, true)
  assert.equal(adapter.providerCapabilities?.supportsInteractionEvents, true)
  assert.equal(receivedArgs?.state?.widgetId, 'd3_provider')
  assert.equal(receivedArgs?.view?.nodeName, 'SVG')
})

test('D3WidgetAdapter applies generic host state through imperative wrapper hooks even when no custom renderFromState is provided', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/d3_imperative_hooks'
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
  let appliedViewport = null
  const surface = { dataset: {} }
  const adapter = new D3WidgetAdapter({
    widgetRef,
    surface,
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
      setViewport(viewport) {
        appliedViewport = viewport
      },
    },
    definition: {
      kind: 'scatter',
    },
    getDescription() {
      return { ref: widgetRef }
    },
    getState() {
      return { ref: widgetRef, widgetId: 'd3_imperative_hooks', kind: 'scatter' }
    },
  })

  await adapter.applyState({
    ref: widgetRef,
    widgetId: 'd3_imperative_hooks',
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
      [`${widgetRef}/selection/focus`]: {
        kind: 'point',
        field: 'series',
        values: ['revenue'],
        summary: 'Series: revenue',
      },
    },
    view: {
      xDomain: [80, 120],
      yDomain: [20, 35],
      focusedSeries: ['revenue'],
      highlight: {
        channels: ['strokeWidth'],
        entries: [
          {
            source: 'encoding',
            channel: 'strokeWidth',
            scope: 'root',
          },
        ],
      },
      aggregate: {
        mode: 'clusterRowsCols',
        clusterRows: true,
        clusterCols: false,
        method: 'average',
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
        mode: 'clusterAnnotation',
        method: 'kmeans',
        clusterField: 'cluster_id',
        nClusters: 3,
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
        scheme: 'blues',
      },
    },
    data: {
      selectedCount: 3,
      visibleCount: 12,
    },
    feedback: {
      highlightedKeys: ['series:revenue'],
    },
  })

  assert.deepEqual(brushedSelection?.domain, {
    xDomain: [80, 120],
    yDomain: [20, 35],
  })
  assert.deepEqual(selectedSelection, {
    kind: 'point',
    field: 'series',
    values: ['revenue'],
    summary: 'Series: revenue',
  })
  assert.deepEqual(highlightedKeys, ['series:revenue'])
  assert.deepEqual(highlightState, {
    channels: ['strokeWidth'],
    entries: [
      {
        source: 'encoding',
        channel: 'strokeWidth',
        scope: 'root',
      },
    ],
  })
  assert.deepEqual(aggregateState, {
    mode: 'clusterRowsCols',
    clusterRows: true,
    clusterCols: false,
    method: 'average',
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
    mode: 'clusterAnnotation',
    method: 'kmeans',
    clusterField: 'cluster_id',
    nClusters: 3,
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
    scheme: 'blues',
  })
  assert.deepEqual(sortState, {
    channel: 'x',
    field: 'Origin',
    mode: 'explicitOrder',
    values: ['Japan', 'USA'],
  })
  assert.deepEqual(appliedViewport, {
    xDomain: [80, 120],
    yDomain: [20, 35],
  })
  assert.equal(surface.dataset.widgetvaSelectedCount, '3')
  assert.equal(surface.dataset.widgetvaVisibleCount, '12')
  assert.equal(surface.dataset.widgetvaSelectionSummary, 'Series: revenue')
})

test('D3WidgetAdapter reads selection and viewport back from the bound chart state when the view does not expose getters', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/d3_readback'
  const view = { nodeName: 'SVG' }
  const adapter = new D3WidgetAdapter({
    widgetRef,
    view,
    definition: {
      kind: 'scatter',
      async renderFromState() {},
    },
    getDescription() {
      return { ref: widgetRef }
    },
    getState() {
      return { ref: widgetRef, widgetId: 'd3_readback', kind: 'scatter' }
    },
  })

  await adapter.applyState({
    ref: widgetRef,
    widgetId: 'd3_readback',
    kind: 'scatter',
    selections: {
      [`${widgetRef}/selection/brush`]: {
        kind: 'interval',
        fields: ['Horsepower', 'MPG'],
        value: {
          Horsepower: [80, 120],
          MPG: [20, 35],
        },
        summary: 'Horsepower 80-120; MPG 20-35',
      },
    },
    view: {
      xDomain: [80, 120],
      yDomain: [20, 35],
    },
  })

  assert.equal(adapter.providerCapabilities?.supportsSelectionReadback, true)
  assert.equal(adapter.providerCapabilities?.supportsViewportReadback, true)
  assert.deepEqual(adapter.readSelection(), {
    kind: 'interval',
    fields: ['Horsepower', 'MPG'],
    value: {
      Horsepower: [80, 120],
      MPG: [20, 35],
    },
    summary: 'Horsepower 80-120; MPG 20-35',
  })
  assert.deepEqual(adapter.readViewport(), {
    xDomain: [80, 120],
    yDomain: [20, 35],
  })
})

test('VegaLiteWidgetAdapter exposes the single-widget agent contract over the provider wrapper', () => {
  const { runtime, restore } = createRuntimeWithScatterSpec()
  const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
  const dataRef = runtime.describeWorkspace().dataHandles[0]?.ref || null
  const adapter = new VegaLiteWidgetAdapter({
    definition: { kind: 'scatter' },
    runtime,
    widgetRef,
    dataRef,
    view: {
      async runAsync() {},
    },
    getDescription() {
      return runtime.store.getWidgetDescription(widgetRef)
    },
    getState() {
      return runtime.store.getWidgetState(widgetRef)
    },
  })

  try {
    const observation = adapter.readObservation()
    const verificationState = adapter.readVerificationState()
    const contract = adapter.describeAgentContract()

    assert.equal(observation?.widgetRef, widgetRef)
    assert.equal(observation?.actionNames.includes('scatter.brushRegion'), true)
    assert.equal(observation?.perceptionNames.includes('perception.findExtremes'), true)
    assert.equal(verificationState?.contract?.preferredReadMethod, 'readVerificationState')
    assert.equal(contract?.version, SINGLE_WIDGET_AGENT_CONTRACT_VERSION)
    assert.equal(contract?.widget?.ref, widgetRef)
    assert.equal(contract?.act?.actionMethodName, 'executeAction')
    assert.equal(contract?.act?.verifiedActionMethodName, 'executeVerifiedAction')
    assert.equal(contract?.catalog?.availableActionNames.includes('scatter.brushRegion'), true)
    assert.equal(contract?.catalog?.availablePerceptionNames.includes('perception.findOutliers'), true)
  } finally {
    restore()
  }
})

test('VegaLiteWidgetAdapter executes verified actions through the shared runtime and scopes them to its widget', async () => {
  const { runtime, restore } = createRuntimeWithScatterSpec()
  const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
  const observedCalls = []
  runtime.actionExecutor.register(
    { name: 'widget.testSelect' },
    async (call, ctx) => {
      observedCalls.push(call)
      return {
        nextState: {
          ...ctx.readCurrentState(),
          shared: {
            ...(ctx.readCurrentState()?.shared || {}),
            testSelection: call?.params?.selection || null,
          },
        },
        result: { selection: call?.params?.selection || null },
      }
    },
  )

  const adapter = new VegaLiteWidgetAdapter({
    definition: { kind: 'scatter' },
    runtime,
    widgetRef,
    view: {
      async runAsync() {},
    },
    getDescription() {
      return runtime.store.getWidgetDescription(widgetRef)
    },
    getState() {
      return runtime.store.getWidgetState(widgetRef)
    },
  })

  try {
    const result = await adapter.executeVerifiedAction({
      name: 'widget.testSelect',
      params: { selection: ['a'] },
    })

    assert.equal(observedCalls.length, 1)
    assert.equal(observedCalls[0]?.queryScope?.widgetRef, widgetRef)
    assert.equal(result?.ok, true)
    assert.equal(result?.actionResult?.ok, true)
    assert.equal(result?.actionResult?.actionName, 'widget.testSelect')
    assert.deepEqual(result?.actionResult?.result?.selection, ['a'])
    assert.equal(result?.verification?.ok, true)
    assert.equal(result?.verification?.result?.matchedActionName, 'widget.testSelect')
  } finally {
    restore()
  }
})

test('CustomWidgetAdapter exposes a named provider runtime object for manual assembly', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/custom_provider'
  let receivedArgs = null
  const adapter = new CustomWidgetAdapter({
    widgetRef,
    surface: { nodeName: 'DIV' },
    definition: {
      kind: 'custom',
      async applyState(args) {
        receivedArgs = args
      },
    },
    getDescription() {
      return { ref: widgetRef, title: 'Custom Provider' }
    },
    getState() {
      return { ref: widgetRef, widgetId: 'custom_provider', kind: 'custom' }
    },
  })

  await adapter.applyState({
    ref: widgetRef,
    widgetId: 'custom_provider',
    kind: 'custom',
  })

  assert.equal(adapter.provider, 'custom')
  assert.equal(adapter.kind, 'custom')
  assert.equal(adapter.getDescription()?.title, 'Custom Provider')
  assert.equal(receivedArgs?.state?.widgetId, 'custom_provider')
  assert.equal(receivedArgs?.surface?.nodeName, 'DIV')
})
