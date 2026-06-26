import test from 'node:test'
import assert from 'node:assert/strict'

import { ActionExecutor } from './ActionExecutor.js'
import { installWidgetVAPagePort } from './installPagePort.js'
import { buildBarActionDescriptors, registerBarActions } from '../../widgets/bar/actions.js'
import { buildScatterActionDescriptors, registerScatterActions } from '../../widgets/scatter/actions.js'
import { buildLineActionDescriptors, registerLineActions } from '../../widgets/line/actions.js'
import { buildHeatmapActionDescriptors, registerHeatmapActions } from '../../widgets/heatmap/actions.js'

function createUsageStore({
  widgetRef,
  widgetId,
  kind,
  title,
  currentDataRef,
  runtimeRows,
  actions,
}) {
  const widgetRecord = {
    ref: widgetRef,
    widgetId,
    kind,
    title,
    selections: {},
    view: {},
    data: {
      currentDataRef,
    },
  }

  return {
    widgets: {
      [widgetRef]: widgetRecord,
    },
    runtimeData: {
      [currentDataRef]: {
        rows: runtimeRows,
      },
    },
    readDescription() {
      return {
        appId: 'widgetva-app',
        workspaceId: 'main',
        generatedAt: '2026-06-24T00:00:00.000Z',
        widgets: [widgetRecord],
        dataHandles: [],
        links: [],
        actions,
        perceptionQueries: [],
      }
    },
    listActions() {
      return actions
    },
    listWidgetDescriptions() {
      return [widgetRecord]
    },
    getResolvedWidgetForTarget(ref) {
      return ref === widgetRef ? widgetRecord : null
    },
    getResolvedWidget(ref) {
      return this.getResolvedWidgetForTarget(ref)
    },
    getWidgetDescription(ref) {
      return this.getResolvedWidgetForTarget(ref)
    },
    getWidgetState(ref) {
      return ref === widgetRef ? widgetRecord : null
    },
    readState() {
      return {
        stateId: 'main:s1',
        widgets: {
          [widgetRef]: widgetRecord,
        },
        shared: {
          activeSelections: {},
          globalFilters: {},
          focusedWidget: widgetRef,
        },
      }
    },
    buildStatePatch(refs) {
      return { refs }
    },
  }
}

test('ActionExecutor.describeActionUsage explains auto-resolved bar parameters and user-required inputs', () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_usage'
  const actions = buildBarActionDescriptors({ widgetRef })
  const state = {
    currentSpec: {
      data: {
        values: [
          { category: 'A', value: 10 },
          { category: 'B', value: 20 },
        ],
      },
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }
  const store = createUsageStore({
    widgetRef,
    widgetId: 'bar_usage',
    kind: 'bar',
    title: 'Bar Usage',
    currentDataRef: 'data://bar/usage',
    runtimeRows: [
      { category: 'A', value: 10 },
      { category: 'B', value: 20 },
    ],
    actions,
  })
  const executor = new ActionExecutor({
    store,
    getAppState: () => state,
  })
  registerBarActions(executor)

  const usage = executor.describeActionUsage({
    targetRef: widgetRef,
    actionName: 'bar.highlightTopN',
  })

  assert.equal(usage.targetRef, widgetRef)
  assert.equal(usage.fieldRoles.resolved.categoryField, 'category')
  assert.equal(usage.fieldRoles.resolved.measureField, 'value')
  assert.equal(usage.actions.length, 1)
  assert.deepEqual(usage.actions[0].requiredParams, ['n'])
  assert.deepEqual(usage.actions[0].suggestedParams, {
    categoryField: 'category',
    measureField: 'value',
    order: 'descending',
  })
  assert.equal(usage.actions[0].paramRoles.n, 'intent')
  assert.equal(usage.actions[0].paramRoles.categoryField, 'structural')
})

test('ActionExecutor.describeActionUsage explains scatter brush fields and required ranges', () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_usage'
  const actions = buildScatterActionDescriptors({ widgetRef })
  const state = {
    currentSpec: {
      data: {
        url: 'https://example.com/scatter.json',
      },
      mark: 'point',
      encoding: {
        x: { field: 'horsepower', type: 'quantitative' },
        y: { field: 'mpg', type: 'quantitative' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }
  const store = createUsageStore({
    widgetRef,
    widgetId: 'scatter_usage',
    kind: 'scatter',
    title: 'Scatter Usage',
    currentDataRef: 'data://scatter/usage',
    runtimeRows: [
      { horsepower: 90, mpg: 31 },
      { horsepower: 160, mpg: 19 },
    ],
    actions,
  })
  const executor = new ActionExecutor({
    store,
    getAppState: () => state,
  })
  registerScatterActions(executor)

  const usage = executor.describeActionUsage({
    targetRef: widgetRef,
    actionName: 'scatter.brushRegion',
    includeExamples: false,
    includeSchemas: false,
  })

  assert.equal(usage.specContext.dataSourceKind, 'url')
  assert.equal(usage.fieldRoles.resolved.xField, 'horsepower')
  assert.equal(usage.fieldRoles.resolved.yField, 'mpg')
  assert.deepEqual(usage.actions[0].requiredParams, ['xField', 'yField', 'xRange', 'yRange'])
  assert.deepEqual(usage.actions[0].suggestedParams, {
    xField: 'horsepower',
    yField: 'mpg',
  })
  assert.equal(usage.actions[0].paramRoles.xField, 'structural')
  assert.equal(usage.actions[0].paramRoles.xRange, 'intent')
  assert.equal('examples' in usage.actions[0], false)
  assert.equal('paramsSchema' in usage.actions[0], false)
})

test('ActionExecutor.describeActionUsage explains scatter zoom intent and continuous-axis constraints', () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_zoom_usage'
  const actions = buildScatterActionDescriptors({ widgetRef })
  const state = {
    currentSpec: {
      data: {
        values: [
          { horsepower: 90, mpg: 31 },
          { horsepower: 160, mpg: 19 },
        ],
      },
      mark: 'point',
      encoding: {
        x: { field: 'horsepower', type: 'quantitative' },
        y: { field: 'mpg', type: 'quantitative' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }
  const store = createUsageStore({
    widgetRef,
    widgetId: 'scatter_zoom_usage',
    kind: 'scatter',
    title: 'Scatter Zoom Usage',
    currentDataRef: 'data://scatter/zoom-usage',
    runtimeRows: state.currentSpec.data.values,
    actions,
  })
  const executor = new ActionExecutor({
    store,
    getAppState: () => state,
  })
  registerScatterActions(executor)

  const usage = executor.describeActionUsage({
    targetRef: widgetRef,
    actionName: 'scatter.zoomDomain',
    includeExamples: false,
    includeSchemas: false,
  })

  assert.deepEqual(usage.actions[0].requiredParams, [])
  assert.equal(usage.actions[0].paramRoles.xDomain, 'intent')
  assert.equal(usage.actions[0].paramRoles.yDomain, 'intent')
  assert.equal(usage.actions[0].diagnostics.some((message) => message.includes('xDomain or yDomain')), true)
})

test('ActionExecutor.describeActionUsage explains bar categorical selection field resolution', () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_select_usage'
  const actions = buildBarActionDescriptors({ widgetRef })
  const state = {
    currentSpec: {
      data: {
        values: [
          { category: 'A', value: 10 },
          { category: 'B', value: 20 },
        ],
      },
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }
  const store = createUsageStore({
    widgetRef,
    widgetId: 'bar_select_usage',
    kind: 'bar',
    title: 'Bar Select Usage',
    currentDataRef: 'data://bar/select-usage',
    runtimeRows: state.currentSpec.data.values,
    actions,
  })
  const executor = new ActionExecutor({
    store,
    getAppState: () => state,
  })
  registerBarActions(executor)

  const usage = executor.describeActionUsage({
    targetRef: widgetRef,
    actionName: 'bar.selectCategory',
    includeExamples: false,
    includeSchemas: false,
  })

  assert.deepEqual(usage.actions[0].requiredParams, ['field', 'values'])
  assert.deepEqual(usage.actions[0].suggestedParams, {
    field: 'category',
  })
  assert.equal(usage.actions[0].paramRoles.field, 'structural')
  assert.equal(usage.actions[0].paramRoles.values, 'intent')
})

test('ActionExecutor.describeActionUsage explains line grouping-field resolution and defaults', () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/line_usage'
  const actions = buildLineActionDescriptors({ widgetRef })
  const state = {
    currentSpec: {
      data: {
        values: [
          { date: '2024-01-01', sales: 10, series: 'A' },
          { date: '2024-01-02', sales: 12, series: 'B' },
        ],
      },
      mark: 'line',
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'sales', type: 'quantitative' },
        color: { field: 'series', type: 'nominal' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }
  const store = createUsageStore({
    widgetRef,
    widgetId: 'line_usage',
    kind: 'line',
    title: 'Line Usage',
    currentDataRef: 'data://line/usage',
    runtimeRows: state.currentSpec.data.values,
    actions,
  })
  const executor = new ActionExecutor({
    store,
    getAppState: () => state,
  })
  registerLineActions(executor)

  const usage = executor.describeActionUsage({
    targetRef: widgetRef,
    actionName: 'line.focusLines',
    includeExamples: false,
    includeSchemas: false,
  })

  assert.deepEqual(usage.actions[0].suggestedParams, {
    lineField: 'series',
    dimOpacity: 0.08,
  })
  assert.deepEqual(usage.actions[0].requiredParams, ['lines'])
  assert.equal(usage.actions[0].paramRoles.lineField, 'structural')
})

test('ActionExecutor.describeActionUsage explains heatmap cell field resolution', () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/heatmap_usage'
  const actions = buildHeatmapActionDescriptors({ widgetRef })
  const state = {
    currentSpec: {
      data: {
        values: [
          { row: 'A', col: 'Q1', value: 10 },
          { row: 'B', col: 'Q2', value: 20 },
        ],
      },
      mark: 'rect',
      encoding: {
        x: { field: 'col', type: 'nominal' },
        y: { field: 'row', type: 'nominal' },
        color: { field: 'value', type: 'quantitative' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }
  const store = createUsageStore({
    widgetRef,
    widgetId: 'heatmap_usage',
    kind: 'heatmap',
    title: 'Heatmap Usage',
    currentDataRef: 'data://heatmap/usage',
    runtimeRows: state.currentSpec.data.values,
    actions,
  })
  const executor = new ActionExecutor({
    store,
    getAppState: () => state,
  })
  registerHeatmapActions(executor)

  const usage = executor.describeActionUsage({
    targetRef: widgetRef,
    actionName: 'heatmap.selectCell',
    includeExamples: false,
    includeSchemas: false,
  })

  assert.deepEqual(usage.actions[0].suggestedParams, {
    xField: 'col',
    yField: 'row',
  })
  assert.deepEqual(usage.actions[0].requiredParams, ['xField', 'yField', 'xValue', 'yValue'])
  assert.equal(usage.actions[0].paramRoles.xField, 'structural')
})

test('ActionExecutor.run requires explicit structural params for bar.sortBars while preserving usage guidance', async () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_sort_usage'
  const actions = buildBarActionDescriptors({ widgetRef })
  const state = {
    currentSpec: {
      data: {
        values: [
          { category: 'A', value: 10 },
          { category: 'B', value: 20 },
          { category: 'C', value: 15 },
        ],
      },
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }
  const store = createUsageStore({
    widgetRef,
    widgetId: 'bar_sort_usage',
    kind: 'bar',
    title: 'Bar Sort Usage',
    currentDataRef: 'data://bar/sort-usage',
    runtimeRows: state.currentSpec.data.values,
    actions,
  })
  const executor = new ActionExecutor({
    store,
    getAppState: () => state,
  })
  registerBarActions(executor)

  const result = await executor.run({
    callId: 'bar_sort_usage_001',
    name: 'bar.sortBars',
    targetRef: widgetRef,
    params: {
      order: 'descending',
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'INVALID_PARAMS')
  assert.equal(result.recoveryHints.some((hint) => hint.includes('describeActionUsage')), true)
})

test('ActionExecutor.run requires explicit structural params for scatter.brushRegion', async () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_brush_usage'
  const actions = buildScatterActionDescriptors({ widgetRef })
  const runtimeRows = [
    { horsepower: 90, mpg: 31 },
    { horsepower: 95, mpg: 30 },
    { horsepower: 160, mpg: 19 },
  ]
  const state = {
    currentSpec: {
      data: {
        url: 'https://example.com/scatter.json',
      },
      mark: 'point',
      encoding: {
        x: { field: 'horsepower', type: 'quantitative' },
        y: { field: 'mpg', type: 'quantitative' },
      },
    },
    currentSelection: null,
    setCurrentSelection(selection) {
      this.currentSelection = selection
    },
  }
  const store = createUsageStore({
    widgetRef,
    widgetId: 'scatter_brush_usage',
    kind: 'scatter',
    title: 'Scatter Brush Usage',
    currentDataRef: 'data://scatter/brush-usage',
    runtimeRows,
    actions,
  })
  const executor = new ActionExecutor({
    store,
    getAppState: () => state,
  })
  registerScatterActions(executor)

  const result = await executor.run({
    callId: 'scatter_brush_usage_001',
    name: 'scatter.brushRegion',
    targetRef: widgetRef,
    params: {
      xRange: [80, 100],
      yRange: [25, 35],
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'INVALID_PARAMS')
  assert.equal(state.currentSelection, null)
})

test('ActionExecutor.run requires explicit structural params for bar.selectCategory', async () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_select_usage_run'
  const actions = buildBarActionDescriptors({ widgetRef })
  const runtimeRows = [
    { category: 'A', value: 10 },
    { category: 'B', value: 20 },
    { category: 'C', value: 15 },
  ]
  const state = {
    currentSpec: {
      data: {
        values: runtimeRows,
      },
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
    },
    currentSelection: null,
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
    setCurrentSelection(selection) {
      this.currentSelection = selection
    },
  }
  const store = createUsageStore({
    widgetRef,
    widgetId: 'bar_select_usage_run',
    kind: 'bar',
    title: 'Bar Select Usage Run',
    currentDataRef: 'data://bar/select-usage-run',
    runtimeRows,
    actions,
  })
  const executor = new ActionExecutor({
    store,
    getAppState: () => state,
  })
  registerBarActions(executor)

  const result = await executor.run({
    callId: 'bar_select_usage_run_001',
    name: 'bar.selectCategory',
    targetRef: widgetRef,
    params: {
      values: ['B', 'C'],
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'INVALID_PARAMS')
  assert.equal(state.currentSelection, null)
})

test('ActionExecutor.run requires explicit structural params for line.selectSeries', async () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/line_select_usage_run'
  const actions = buildLineActionDescriptors({ widgetRef })
  const runtimeRows = [
    { date: '2024-01-01', sales: 10, series: 'A' },
    { date: '2024-01-01', sales: 12, series: 'B' },
  ]
  const state = {
    currentSpec: {
      data: {
        values: runtimeRows,
      },
      mark: 'line',
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'sales', type: 'quantitative' },
        color: { field: 'series', type: 'nominal' },
      },
    },
    currentSelection: null,
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
    setCurrentSelection(selection) {
      this.currentSelection = selection
    },
  }
  const store = createUsageStore({
    widgetRef,
    widgetId: 'line_select_usage_run',
    kind: 'line',
    title: 'Line Select Usage Run',
    currentDataRef: 'data://line/select-usage-run',
    runtimeRows,
    actions,
  })
  const executor = new ActionExecutor({
    store,
    getAppState: () => state,
  })
  registerLineActions(executor)

  const result = await executor.run({
    callId: 'line_select_usage_run_001',
    name: 'line.selectSeries',
    targetRef: widgetRef,
    params: {
      values: ['A'],
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'INVALID_PARAMS')
  assert.equal(state.currentSelection, null)
})

test('ActionExecutor.run requires explicit structural params for heatmap.selectCell', async () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/heatmap_select_usage_run'
  const actions = buildHeatmapActionDescriptors({ widgetRef })
  const runtimeRows = [
    { row: 'A', col: 'Q1', value: 10 },
    { row: 'B', col: 'Q2', value: 20 },
  ]
  const state = {
    currentSpec: {
      data: {
        values: runtimeRows,
      },
      mark: 'rect',
      encoding: {
        x: { field: 'col', type: 'nominal' },
        y: { field: 'row', type: 'nominal' },
        color: { field: 'value', type: 'quantitative' },
      },
    },
    currentSelection: null,
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
    setCurrentSelection(selection) {
      this.currentSelection = selection
    },
  }
  const store = createUsageStore({
    widgetRef,
    widgetId: 'heatmap_select_usage_run',
    kind: 'heatmap',
    title: 'Heatmap Select Usage Run',
    currentDataRef: 'data://heatmap/select-usage-run',
    runtimeRows,
    actions,
  })
  const executor = new ActionExecutor({
    store,
    getAppState: () => state,
  })
  registerHeatmapActions(executor)

  const result = await executor.run({
    callId: 'heatmap_select_usage_run_001',
    name: 'heatmap.selectCell',
    targetRef: widgetRef,
    params: {
      xValue: 'Q1',
      yValue: 'A',
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'INVALID_PARAMS')
  assert.equal(state.currentSelection, null)
})

test('ActionExecutor.run returns guided INVALID_PARAMS details when intent params are still missing', async () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_brush_usage_error'
  const actions = buildScatterActionDescriptors({ widgetRef })
  const store = createUsageStore({
    widgetRef,
    widgetId: 'scatter_brush_usage_error',
    kind: 'scatter',
    title: 'Scatter Brush Usage Error',
    currentDataRef: 'data://scatter/brush-usage-error',
    runtimeRows: [
      { horsepower: 90, mpg: 31 },
      { horsepower: 160, mpg: 19 },
    ],
    actions,
  })
  const executor = new ActionExecutor({
    store,
    getAppState: () => ({
      currentSpec: {
        data: { url: 'https://example.com/scatter.json' },
        mark: 'point',
        encoding: {
          x: { field: 'horsepower', type: 'quantitative' },
          y: { field: 'mpg', type: 'quantitative' },
        },
      },
    }),
  })
  registerScatterActions(executor)

  const result = await executor.run({
    callId: 'scatter_brush_usage_error_001',
    name: 'scatter.brushRegion',
    targetRef: widgetRef,
    params: {},
  })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'INVALID_PARAMS')
  assert.deepEqual(result.error.details.requiredParams, ['xField', 'yField', 'xRange', 'yRange'])
  assert.equal(Array.isArray(result.recoveryHints), true)
  assert.equal(result.recoveryHints.some((hint) => hint.includes('describeActionUsage')), true)
})

test('installWidgetVAPagePort exposes describeActionUsage as a public page-port method', async () => {
  globalThis.window = {}

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_usage_port'
  const actions = buildBarActionDescriptors({ widgetRef })
  const store = createUsageStore({
    widgetRef,
    widgetId: 'bar_usage_port',
    kind: 'bar',
    title: 'Bar Usage Port',
    currentDataRef: 'data://bar/usage-port',
    runtimeRows: [
      { category: 'A', value: 10 },
      { category: 'B', value: 20 },
    ],
    actions,
  })
  const executor = new ActionExecutor({
    store,
    getAppState: () => ({
      currentSpec: {
        data: {
          values: [
            { category: 'A', value: 10 },
            { category: 'B', value: 20 },
          ],
        },
        mark: 'bar',
        encoding: {
          x: { field: 'category', type: 'nominal' },
          y: { field: 'value', type: 'quantitative' },
        },
      },
      setCurrentSpec() {},
    }),
  })
  registerBarActions(executor)

  installWidgetVAPagePort({
    store,
    actionExecutor: executor,
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
  })

  const describedPort = await globalThis.window.__widgetVA.describePagePort()
  const usage = await globalThis.window.__widgetVA.describeActionUsage({
    targetRef: widgetRef,
    actionName: 'bar.sortBars',
  })

  assert.equal(describedPort.methods.includes('describeActionUsage'), true)
  assert.equal(describedPort.aliases.action_usage_describe, 'describeActionUsage')
  assert.equal(usage.actions[0].name, 'bar.sortBars')
  assert.equal(usage.actions[0].suggestedParams.channel, 'x')

  delete globalThis.window
})
