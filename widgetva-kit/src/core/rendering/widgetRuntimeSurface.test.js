import test from 'node:test'
import assert from 'node:assert/strict'

import { createWidgetVARuntime } from '../index.js'
import { createVegaLiteWidgetAdapter } from '../../adapters/vegaLite/VegaLiteWidgetAdapter.js'
import { createWidgetInstance } from './widgetRuntimeSurface.js'
import { createD3LineChartWrapper } from '../../../../visagentbench_v2/materializations/d3/reference/lineChartWrapper.js'
import { createD3ScatterChartWrapper } from '../../../../visagentbench_v2/materializations/d3/reference/scatterChartWrapper.js'
import { createEChartsLineChartWrapper } from '../../../../visagentbench_v2/materializations/echarts/reference/lineChartWrapper.js'
import { createEChartsScatterChartWrapper } from '../../../../visagentbench_v2/materializations/echarts/reference/scatterChartWrapper.js'

function actionNamesFor(widget) {
  return (widget.runtime?.describeWorkspace?.()?.actions || []).map((descriptor) => descriptor?.name)
}

function perceptionNamesFor(widget) {
  return (widget.runtime?.describeWorkspace?.()?.perceptionQueries || []).map((descriptor) => descriptor?.name)
}

function getWidgetAdapter(kind) {
  return createVegaLiteWidgetAdapter({ kind })
}

function buildScatterSpec(rows = [
  { x: 1, y: 2, category: 'a' },
  { x: 2, y: 3, category: 'b' },
]) {
  return {
    data: {
      values: rows,
    },
    mark: 'point',
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      color: { field: 'category', type: 'nominal' },
    },
  }
}

function buildLineSpec(rows = [
  { date: '2024-01-01', series: 'A', revenue: 10 },
  { date: '2024-01-02', series: 'A', revenue: 20 },
  { date: '2024-01-01', series: 'B', revenue: 15 },
  { date: '2024-01-02', series: 'B', revenue: 18 },
]) {
  return {
    data: {
      values: rows,
    },
    mark: 'line',
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'revenue', type: 'quantitative' },
      color: { field: 'series', type: 'nominal' },
    },
  }
}

function buildBarSpec(rows = [
  { category: 'A', value: 10 },
  { category: 'B', value: 20 },
]) {
  return {
    data: {
      values: rows,
    },
    mark: 'bar',
    encoding: {
      x: { field: 'category', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
    },
  }
}

function createRuntimeWithScatterSpec() {
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
    },
  })

  return {
    runtime,
    dataQueryCalls,
    restore() {
      runtime.dispose()
      globalThis.window = previousWindow
    },
  }
}

function createRuntimeWithSpecAndAdapters({ spec } = {}) {
  const previousWindow = globalThis.window
  globalThis.window = {}
  let currentSpec = JSON.parse(JSON.stringify(spec))
  const runtime = createWidgetVARuntime({
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'test-session',
      readBaselineSpec: () => spec,
      readCurrentSpec: () => currentSpec,
      writeCurrentSpec(nextSpec) {
        currentSpec = JSON.parse(JSON.stringify(nextSpec))
      },
      readWorkspaceSpec: () => null,
      readPlanningRequest: () => null,
      readRunMode: () => 'goal_oriented',
      readUserIntent: () => '',
      readCurrentSelection: () => null,
      readCurrentSelections: () => ({}),
      readFocusedWidgetRef: () => null,
      readComparisonTargets: () => [],
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

async function flushAsyncWork() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

test('createWidgetInstance exposes the widget-first public contract over an existing runtime', async () => {
  const { runtime, dataQueryCalls, restore } = createRuntimeWithScatterSpec()
  const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
  const widgetState = runtime.store.getWidgetState(widgetRef)

  let bindCalls = 0
  let applyCalls = 0
  const widget = createWidgetInstance({
    runtime,
    widgetRef,
    spec: buildScatterSpec(),
    widgetState,
    widgetAdapter: {
      provider: 'test',
      async applyState() {
        applyCalls += 1
      },
      bindHumanInteractions() {
        bindCalls += 1
        return () => {}
      },
    },
  })

  runtime.actionExecutor.register(
    { name: 'widget.testSelect' },
    async (params, ctx) => ({
      patch: {
        [ctx.targetWidget().ref]: {
          feedback: {
            testSelection: params?.selection || null,
          },
        },
      },
      result: { selection: params?.selection || null },
    }),
  )

  try {
    const initialStateId = widget.readWorkspaceState()?.stateId
    await widget.mount({ view: { addSignalListener() {}, removeSignalListener() {}, data() { return [] } } })

    assert.equal(widget.isMounted(), true)
    assert.equal(bindCalls, 1)
    assert.equal(applyCalls, 1)
    assert.equal(widget.describe()?.ref, widgetRef)
    const actionNames = actionNamesFor(widget)
    const perceptionNames = perceptionNamesFor(widget)

    assert.equal(actionNames.includes('scatter.brushRegion'), true)
    assert.equal(actionNames.includes('scatter.zoomDomain'), true)
    assert.equal(actionNames.includes('widget.changeEncoding'), true)
    assert.equal(actionNames.includes('workspace.jumpToState'), true)
    assert.equal(perceptionNames.includes('perception.computeCorrelation'), true)
    assert.equal(perceptionNames.includes('perception.findOutliers'), true)
    assert.equal(perceptionNames.includes('perception.findExtremes'), true)
    assert.equal(widget.readState()?.ref, widgetRef)
    assert.equal('buildActionDescriptors' in widget, false)
    assert.equal('listPerceptionDescriptors' in widget, false)
    assert.equal('listPerceptionNames' in widget, false)
    assert.equal('readObservation' in widget, false)
    assert.equal('readCoordinationState' in widget, false)
    assert.equal('readPropagationSummary' in widget, false)
    assert.equal('readVerificationState' in widget, false)
    assert.equal('describeAgentContract' in widget, false)

    const actionResult = await widget.executeAction({
      name: 'widget.testSelect',
      params: { selection: ['a'] },
    })
    assert.equal(actionResult?.ok, true)

    const perceptionResult = await widget.queryPerception({
      name: 'perception.inspectViewConfig',
      params: {},
    })
    assert.equal(perceptionResult?.ok, true)
    assert.equal(typeof perceptionResult?.result, 'object')

    const trace = widget.readTrace({ limit: 10 })
    assert.equal(Array.isArray(trace), true)
    assert.equal(trace.some((entry) => entry?.eventKind === 'action'), true)

    const replayResult = await widget.replay(initialStateId)
    assert.equal(replayResult?.ok, true)
  } finally {
    widget.dispose()
    restore()
  }
})

test('createWidgetInstance narrows bar actions to the current simple-bar materialization', () => {
  const { runtime, restore } = createRuntimeWithSpecAndAdapters({
    spec: buildBarSpec(),
  })

  try {
    const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
    const widgetState = runtime.store.getWidgetState(widgetRef)
    const widget = createWidgetInstance({
      runtime,
      widgetRef,
      widgetState,
      spec: buildBarSpec(),
      widgetAdapter: getWidgetAdapter('bar'),
    })

    const actionNames = actionNamesFor(widget)
    assert.equal(actionNames.includes('bar.selectCategory'), true)
    assert.equal(actionNames.includes('bar.addBarItems'), false)
    assert.equal(actionNames.includes('bar.removeBarItems'), false)
    assert.equal(actionNames.includes('bar.filterSubcategories'), false)
    assert.equal(actionNames.includes('bar.expandStack'), false)
    assert.equal(actionNames.includes('bar.toggleStackMode'), false)
  } finally {
    restore()
  }
})

test('createWidgetInstance narrows category-driven bar actions away from binned bar materializations', () => {
  const spec = {
    kind: 'parallelCoordinates',
    data: {
      values: [
        { value: 1 },
        { value: 2 },
        { value: 2.5 },
        { value: 3 },
      ],
    },
    mark: 'bar',
    encoding: {
      x: { field: 'value', type: 'quantitative', bin: true },
      y: { aggregate: 'count', type: 'quantitative' },
    },
  }
  const { runtime, restore } = createRuntimeWithSpecAndAdapters({ spec })

  try {
    const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
    const widgetState = runtime.store.getWidgetState(widgetRef)
    const widget = createWidgetInstance({
      runtime,
      widgetRef,
      widgetState,
      spec,
      widgetAdapter: getWidgetAdapter('bar'),
    })

    const actionNames = actionNamesFor(widget)
    assert.equal(actionNames.includes('bar.selectCategory'), false)
    assert.equal(actionNames.includes('bar.sortBars'), false)
    assert.equal(actionNames.includes('bar.highlightTopN'), false)
    assert.equal(actionNames.includes('bar.filterCategories'), false)
    assert.equal(actionNames.includes('bar.addBars'), false)
    assert.equal(actionNames.includes('bar.removeBars'), false)
    assert.equal(actionNames.includes('bar.addBarItems'), false)
    assert.equal(actionNames.includes('bar.removeBarItems'), false)
    assert.equal(actionNames.includes('bar.filterSubcategories'), false)
    assert.equal(actionNames.includes('bar.expandStack'), false)
    assert.equal(actionNames.includes('bar.toggleStackMode'), false)
  } finally {
    restore()
  }
})

test('createWidgetInstance narrows line actions to the current non-temporal line materialization', () => {
  const spec = {
    data: {
      values: [
        { xValue: '2000', series: 'A', value: 10 },
        { xValue: '2001', series: 'A', value: 20 },
      ],
    },
    mark: 'line',
    encoding: {
      x: { field: 'xValue', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'series', type: 'nominal' },
    },
  }
  const { runtime, restore } = createRuntimeWithSpecAndAdapters({ spec })

  try {
    const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
    const widgetState = runtime.store.getWidgetState(widgetRef)
    const widget = createWidgetInstance({
      runtime,
      widgetRef,
      widgetState,
      spec,
      widgetAdapter: getWidgetAdapter('line'),
    })

    const actionNames = actionNamesFor(widget)
    assert.equal(actionNames.includes('line.selectSeries'), true)
    assert.equal(actionNames.includes('line.resampleXAxis'), false)
    assert.equal(actionNames.includes('line.resetResampleXAxis'), false)
  } finally {
    restore()
  }
})

test('createWidgetInstance narrows heatmap drill-down actions to the current non-temporal heatmap materialization', () => {
  const spec = {
    data: {
      values: [
        { day: 'Mon', hour: '9', value: 3 },
        { day: 'Tue', hour: '10', value: 5 },
      ],
    },
    mark: 'rect',
    encoding: {
      x: { field: 'day', type: 'ordinal' },
      y: { field: 'hour', type: 'ordinal' },
      color: { field: 'value', type: 'quantitative' },
    },
  }
  const { runtime, restore } = createRuntimeWithSpecAndAdapters({ spec })

  try {
    const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
    const widgetState = runtime.store.getWidgetState(widgetRef)
    const widget = createWidgetInstance({
      runtime,
      widgetRef,
      widgetState,
      spec,
      widgetAdapter: getWidgetAdapter('heatmap'),
    })

    const actionNames = actionNamesFor(widget)
    assert.equal(actionNames.includes('heatmap.selectCell'), true)
    assert.equal(actionNames.includes('heatmap.adjustColorScale'), true)
    assert.equal(actionNames.includes('heatmap.drilldownAxis'), false)
    assert.equal(actionNames.includes('heatmap.resetDrilldown'), false)
  } finally {
    restore()
  }
})

test('createWidgetInstance narrows heatmap actions to the current axis/color materialization', () => {
  const spec = {
    data: {
      values: [
        { day: 'Mon', hour: '9' },
        { day: 'Tue', hour: '10' },
      ],
    },
    mark: 'rect',
    encoding: {
      x: { field: 'day', type: 'ordinal' },
      y: { field: 'hour', type: 'ordinal' },
    },
  }
  const { runtime, restore } = createRuntimeWithSpecAndAdapters({ spec })

  try {
    const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
    const widgetState = runtime.store.getWidgetState(widgetRef)
    const widget = createWidgetInstance({
      runtime,
      widgetRef,
      widgetState,
      spec,
      widgetAdapter: getWidgetAdapter('heatmap'),
    })

    const actionNames = actionNamesFor(widget)
    assert.equal(actionNames.includes('heatmap.selectCell'), true)
    assert.equal(actionNames.includes('heatmap.filterCellsByRegion'), true)
    assert.equal(actionNames.includes('heatmap.transpose'), true)
    assert.equal(actionNames.includes('heatmap.adjustColorScale'), false)
    assert.equal(actionNames.includes('heatmap.thresholdMask'), false)
    assert.equal(actionNames.includes('heatmap.highlightRegionByValue'), false)
    assert.equal(actionNames.includes('heatmap.addMarginalBars'), false)
    assert.equal(actionNames.includes('heatmap.clusterRowsCols'), false)
  } finally {
    restore()
  }
})

test('createWidgetInstance narrows numeric-only scatter actions to the current non-quantitative scatter materialization', () => {
  const spec = {
    data: {
      values: [
        { category: 'A', value: 10 },
        { category: 'B', value: 20 },
      ],
    },
    mark: 'point',
    encoding: {
      x: { field: 'category', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
    },
  }
  const { runtime, restore } = createRuntimeWithSpecAndAdapters({ spec })

  try {
    const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
    const widgetState = runtime.store.getWidgetState(widgetRef)
    const widget = createWidgetInstance({
      runtime,
      widgetRef,
      widgetState,
      spec,
      widgetAdapter: getWidgetAdapter('scatter'),
    })

    const actionNames = actionNamesFor(widget)
    assert.equal(actionNames.includes('scatter.zoomDomain'), true)
    assert.equal(actionNames.includes('scatter.brushRegion'), false)
    assert.equal(actionNames.includes('scatter.identifyClusters'), false)
    assert.equal(actionNames.includes('scatter.showRegression'), false)
  } finally {
    restore()
  }
})

test('createWidgetInstance narrows sankey actions to the current structural materialization', () => {
  const spec = {
    $schema: 'https://vega.github.io/schema/vega/v5.json',
    kind: 'sankey',
    data: [
      { name: 'links', values: [{ source: 'A', target: 'B', value: 5 }] },
    ],
    marks: [
      {
        name: 'nodes',
        type: 'rect',
      },
    ],
  }
  const { runtime, restore } = createRuntimeWithSpecAndAdapters({ spec })

  try {
    const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
    const widgetState = runtime.store.getWidgetState(widgetRef)
    const widget = createWidgetInstance({
      runtime,
      widgetRef,
      widgetState,
      spec,
      widgetAdapter: getWidgetAdapter('sankey'),
    })

    const actionNames = actionNamesFor(widget)
    assert.equal(actionNames.includes('sankey.focusFlow'), true)
    assert.equal(actionNames.some((name) => name.startsWith('sankey.')), true)
  } finally {
    restore()
  }
})

test('createWidgetInstance narrows fold-dependent parallel-coordinates reencode actions away from materializations with no dimension list', () => {
  const spec = {
    kind: 'parallelCoordinates',
    data: {
      values: [
        { id: 'a', Origin: 'USA', Horsepower: 100 },
        { id: 'b', Origin: 'Japan', Horsepower: 90 },
      ],
    },
    mark: 'line',
    encoding: {
      detail: { field: 'id', type: 'nominal' },
      color: { field: 'Origin', type: 'nominal' },
    },
  }
  const { runtime, restore } = createRuntimeWithSpecAndAdapters({ spec })

  try {
    const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
    const widgetState = runtime.store.getWidgetState(widgetRef)
    const widget = createWidgetInstance({
      runtime,
      widgetRef,
      widgetState,
      spec,
      widgetAdapter: getWidgetAdapter('parallelCoordinates'),
    })

    const actionNames = actionNamesFor(widget)
    assert.equal(actionNames.includes('parallelCoordinates.brushAxes'), false)
    assert.equal(actionNames.includes('parallelCoordinates.selectRecord'), true)
    assert.equal(actionNames.includes('parallelCoordinates.filterDimension'), true)
    assert.equal(actionNames.includes('parallelCoordinates.filterByCategory'), true)
    assert.equal(actionNames.includes('parallelCoordinates.highlightCategory'), true)
    assert.equal(actionNames.includes('parallelCoordinates.reorderDimensions'), false)
    assert.equal(actionNames.includes('parallelCoordinates.hideDimensions'), false)
    assert.equal(actionNames.includes('parallelCoordinates.resetHiddenDimensions'), false)
  } finally {
    restore()
  }
})

test('WidgetInstance normalizes action targeting into target instead of queryScope', async () => {
  const { runtime, restore } = createRuntimeWithScatterSpec()
  const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
  const widgetState = runtime.store.getWidgetState(widgetRef)
  const widget = createWidgetInstance({
    runtime,
    widgetRef,
    spec: buildScatterSpec(),
    widgetState,
    widgetAdapter: {
      provider: 'test',
      async applyState() {},
      bindHumanInteractions() {
        return () => {}
      },
    },
  })

  runtime.actionExecutor.register(
    { name: 'widget.inspectScopedCall' },
    async (params, ctx) => ({
      result: {
        queryScope: ctx.call?.queryScope || null,
        target: ctx.call?.target || null,
        targetRef: ctx.call?.targetRef || null,
      },
    }),
  )

  try {
    const result = await widget.executeAction({
      name: 'widget.inspectScopedCall',
      targetRef: 'wl://legacy/should_be_ignored',
      params: {},
    })

    assert.equal(result?.ok, true)
    assert.equal(result?.result?.queryScope, null)
    assert.deepEqual(result?.result?.target, { widgetRef })
    assert.equal(result?.result?.targetRef, widgetRef)
  } finally {
    widget.dispose()
    restore()
  }
})

test('WidgetInstance.executeVerifiedAction delegates through the single-widget verified-action surface', async () => {
  const { runtime, restore } = createRuntimeWithScatterSpec()
  const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
  const widgetState = runtime.store.getWidgetState(widgetRef)
  const widget = createWidgetInstance({
    runtime,
    widgetRef,
    spec: buildScatterSpec(),
    widgetState,
    widgetAdapter: {
      provider: 'test',
      async applyState() {},
      bindHumanInteractions() {
        return () => {}
      },
    },
  })

  runtime.actionExecutor.register(
    { name: 'widget.testSelect' },
    async (params, ctx) => ({
      patch: {
        [ctx.targetWidget().ref]: {
          feedback: {
            testSelection: params?.selection || null,
          },
        },
      },
      result: { selection: params?.selection || null },
    }),
  )

  try {
    const result = await widget.executeVerifiedAction({
      name: 'widget.testSelect',
      params: {
        selection: ['a'],
      },
    })

    assert.equal(result?.ok, true)
    assert.equal(result?.actionResult?.ok, true)
    assert.equal(result?.actionResult?.actionName, 'widget.testSelect')
    assert.equal(result?.verification?.ok, true)
    assert.equal(result?.verification?.result?.verified, true)
    assert.equal(result?.verification?.result?.matchedActionName, 'widget.testSelect')
    assert.equal(typeof result?.beforeStateId, 'string')
    assert.equal(typeof result?.afterView?.stateId, 'string')
  } finally {
    widget.dispose()
    restore()
  }
})

test('WidgetInstance delegates calls only through runtime public methods, not executor internals', async () => {
  const touched = []
  const widget = createWidgetInstance({
    runtime: {
      actionExecutor: {
        run() {
          touched.push('actionExecutor')
          return { ok: true }
        },
      },
      perceptionExecutor: {
        query() {
          touched.push('perceptionExecutor.query')
          return { ok: true }
        },
        run() {
          touched.push('perceptionExecutor.run')
          return { ok: true }
        },
      },
      dataQueryExecutor: {
        run() {
          touched.push('dataQueryExecutor')
          return { ok: true }
        },
      },
    },
    widgetRef: 'wl://test/workspace/main/widget/scatter',
    widgetAdapter: {
      provider: 'test',
      async applyState() {},
      bindHumanInteractions() {
        return () => {}
      },
    },
  })

  await assert.rejects(
    () => widget.executeAction({ name: 'widget.test', params: {} }),
    /runtime\.executeAction/,
  )
  await assert.rejects(
    () => widget.queryPerception({ name: 'perception.test', params: {} }),
    /runtime\.queryPerception/,
  )
  await assert.rejects(
    () => widget.runDataQuery({ query: { kind: 'summary' } }),
    /runtime\.runDataQuery/,
  )
  assert.deepEqual(touched, [])
})

test('WidgetInstance.executeVerifiedAction does not synthesize verification or use agent-loop fallbacks', async () => {
  const touched = []
  const widget = createWidgetInstance({
    runtime: {
      agentLoopRuntime: {
        executeVerifiedAction() {
          touched.push('agentLoopRuntime')
          return { ok: true }
        },
      },
      executeAction() {
        touched.push('executeAction')
        return { ok: true, stateId: 'state_after', updatedRefs: [] }
      },
      queryPerception() {
        touched.push('queryPerception')
        return { ok: true, result: { verified: true } }
      },
      store: {
        readState() {
          touched.push('readState')
          return { stateId: 'state_before' }
        },
      },
    },
    widgetRef: 'wl://test/workspace/main/widget/scatter',
    widgetAdapter: {
      provider: 'test',
      async applyState() {},
      bindHumanInteractions() {
        return () => {}
      },
    },
  })

  await assert.rejects(
    () => widget.executeVerifiedAction({ name: 'widget.test', params: {} }),
    /runtime\.executeVerifiedAction/,
  )
  assert.deepEqual(touched, [])
})

test('createWidgetInstance narrows line actions to the current grouping and temporal materialization', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const spec = {
    data: {
      values: [
        { index: 1, sales: 10 },
        { index: 2, sales: 20 },
      ],
    },
    mark: 'line',
    encoding: {
      x: { field: 'index', type: 'quantitative' },
      y: { field: 'sales', type: 'quantitative' },
    },
  }
  const runtime = createWidgetVARuntime({
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'line-narrowing-test',
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
    },
  })

  try {
    const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
    const widgetState = runtime.store.getWidgetState(widgetRef)
    const widgetAdapter = getWidgetAdapter('line')
    const widget = createWidgetInstance({
      runtime,
      widgetRef,
      spec,
      widgetState,
      widgetAdapter,
    })

    const actionNames = new Set(actionNamesFor(widget))
    assert.equal(actionNames.has('line.selectSeries'), true)
    assert.equal(actionNames.has('line.selectXValue'), true)
    assert.equal(actionNames.has('line.zoomXRegion'), true)
    assert.equal(actionNames.has('line.highlightTrend'), true)
    assert.equal(actionNames.has('line.showMovingAverage'), true)
    assert.equal(actionNames.has('line.focusLines'), false)
    assert.equal(actionNames.has('line.boldLines'), false)
    assert.equal(actionNames.has('line.filterLines'), false)
    assert.equal(actionNames.has('line.drillDownXAxis'), false)
    assert.equal(actionNames.has('line.resetDrilldownXAxis'), false)
    assert.equal(actionNames.has('line.resampleXAxis'), false)
    assert.equal(actionNames.has('line.resetResampleXAxis'), false)
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})

test('createWidgetInstance normalizes mountTarget and container into persisted mount options', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const runtime = createWidgetVARuntime({
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'mount-options-session',
      readBaselineSpec: () => buildScatterSpec(),
      readCurrentSpec: () => buildScatterSpec(),
      readWorkspaceSpec: () => null,
      readPlanningRequest: () => null,
      readRunMode: () => 'goal_oriented',
      readUserIntent: () => '',
      readCurrentSelection: () => null,
      readCurrentSelections: () => ({}),
      readFocusedWidgetRef: () => null,
      readComparisonTargets: () => [],
    },
  })

  const widget = createWidgetInstance({
    runtime,
    widgetAdapter: {
      provider: 'test',
      async applyState() {},
      bindHumanInteractions() {
        return () => {}
      },
    },
    mountTarget: {
      container: { nodeName: 'DIV' },
    },
  })

  try {
    assert.equal(widget.mountOptions.container?.nodeName, 'DIV')
    assert.equal(widget.mountOptions.surface?.nodeName, 'DIV')
  } finally {
    widget.dispose()
    runtime.dispose()
    globalThis.window = previousWindow
  }
})

test('createWidgetInstance-created runtimes do not register runtime actions through the provider adapter', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}

  const widget = createWidgetInstance({
    spec: buildScatterSpec(),
    widgetAdapter: {
      provider: 'test',
      async applyState() {},
      bindHumanInteractions() {
        return () => {}
      },
      registerActions(actionExecutor) {
        actionExecutor.register(
          { name: 'widget.customInspect' },
          async () => ({ result: { shouldNotRun: true } }),
        )
      },
    },
  })

  try {
    assert.equal(widget.runtime.actionExecutor.has('widget.customInspect'), false)
    assert.equal(widget.runtime.actionExecutor.has('scatter.brushRegion'), false)
  } finally {
    widget.dispose()
    globalThis.window = previousWindow
  }
})

test('createWidgetVARuntime only registers first-party widget families when explicitly requested', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const spec = buildScatterSpec()

  const runtimeWithoutDefaults = createWidgetVARuntime({
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'runtime-without-defaults',
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
    },
  })

  const runtimeWithDefaults = createWidgetVARuntime({
    registerDefaultWidgetFamilies: true,
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'runtime-with-defaults',
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
    },
  })

  try {
    assert.equal(runtimeWithoutDefaults.actionExecutor.has('scatter.brushRegion'), false)
    assert.equal(runtimeWithDefaults.actionExecutor.has('scatter.brushRegion'), true)
  } finally {
    runtimeWithoutDefaults.dispose()
    runtimeWithDefaults.dispose()
    globalThis.window = previousWindow
  }
})
