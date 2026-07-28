import test from 'node:test'
import assert from 'node:assert/strict'

import { createWidgetVARuntime } from '../../../core/runtime/RuntimeOrchestrator.js'

function buildLineSpec() {
  return {
    data: {
      values: [
        { t: '2024-01-01', value: 3, series: 'A' },
        { t: '2024-01-02', value: 5, series: 'A' },
        { t: '2024-01-01', value: 2, series: 'B' },
        { t: '2024-01-02', value: 4, series: 'B' },
      ],
    },
    mark: 'line',
    encoding: {
      x: { field: 't', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'series', type: 'nominal' },
    },
  }
}

function createLineRuntime() {
  const spec = buildLineSpec()
  let providerActionCallCount = 0
  const runtime = createWidgetVARuntime({
    registerDefaultWidgetFamilies: true,
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'line-runtime-actions',
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
      executeProviderAction() {
        providerActionCallCount += 1
        throw new Error('line family actions should not call provider actions directly')
      },
    },
  })
  return {
    runtime,
    readProviderActionCallCount: () => providerActionCallCount,
  }
}

test('line.highlightTrend returns a semantic trend patch without calling the provider', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const { runtime, readProviderActionCallCount } = createLineRuntime()

  try {
    const widgetRef = runtime.describeWorkspace().widgets[0].ref
    const result = await runtime.executeAction({
      callId: 'highlight_trend',
      actor: 'agent',
      name: 'line.highlightTrend',
      target: { widgetRef },
      params: { trendType: 'linear' },
    })
    const widget = runtime.readState().widgets[widgetRef]
    const trendTransform = widget.transforms.find((transform) =>
      transform?.spec?.actionName === 'line.highlightTrend',
    )

    assert.equal(result.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.reencode.mode, 'regressionOverlay')
    assert.equal(widget.view.reencode.xField, 't')
    assert.equal(widget.view.reencode.yField, 'value')
    assert.equal(widget.data.analysis.trend.trendType, 'linear')
    assert.equal(trendTransform.kind, 'derive')
    assert.equal(trendTransform.source, 'action')
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})

test('line series and x-value selections write stable semantic selection refs', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const { runtime, readProviderActionCallCount } = createLineRuntime()

  try {
    const widgetRef = runtime.describeWorkspace().widgets[0].ref
    const seriesResult = await runtime.executeAction({
      callId: 'select_series',
      actor: 'agent',
      name: 'line.selectSeries',
      target: { widgetRef },
      params: { field: 'series', values: ['A'] },
    })
    let widget = runtime.readState().widgets[widgetRef]
    const seriesSelectionRef = `${widgetRef}/selection/series-series`

    assert.equal(seriesResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.selections[seriesSelectionRef]?.field, 'series')
    assert.deepEqual(widget.selections[seriesSelectionRef]?.predicates, [
      { field: 'series', op: 'in', value: ['A'] },
    ])

    const xValueResult = await runtime.executeAction({
      callId: 'select_x_value',
      actor: 'agent',
      name: 'line.selectXValue',
      target: { widgetRef },
      params: { value: '2024-01-01' },
    })
    widget = runtime.readState().widgets[widgetRef]
    const xValueSelectionRef = `${widgetRef}/selection/t-value`

    assert.equal(xValueResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.selections[xValueSelectionRef]?.field, 't')
    assert.deepEqual(widget.selections[xValueSelectionRef]?.predicates, [
      { field: 't', op: 'in', value: ['2024-01-01'] },
    ])
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})

test('line.showMovingAverage returns a semantic overlay patch without calling the provider', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const { runtime, readProviderActionCallCount } = createLineRuntime()

  try {
    const widgetRef = runtime.describeWorkspace().widgets[0].ref
    const result = await runtime.executeAction({
      callId: 'show_moving_average',
      actor: 'agent',
      name: 'line.showMovingAverage',
      target: { widgetRef },
      params: { windowSize: 2 },
    })
    const widget = runtime.readState().widgets[widgetRef]
    const movingAverageTransform = widget.transforms.find((transform) =>
      transform?.spec?.actionName === 'line.showMovingAverage',
    )

    assert.equal(result.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.addRemove.mode, 'movingAverageOverlay')
    assert.equal(widget.view.addRemove.windowSize, 2)
    assert.equal(widget.view.addRemove.xField, 't')
    assert.equal(widget.view.addRemove.yField, 'value')
    assert.deepEqual(widget.view.addRemove.groupBy, ['series'])
    assert.equal(widget.data.analysis.movingAverage.windowSize, 2)
    assert.equal(movingAverageTransform.kind, 'derive')
    assert.equal(movingAverageTransform.source, 'action')
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})

test('line drill-down actions write and clear semantic drill-down state without calling the provider', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const { runtime, readProviderActionCallCount } = createLineRuntime()

  try {
    const widgetRef = runtime.describeWorkspace().widgets[0].ref
    const drillResult = await runtime.executeAction({
      callId: 'drill_line',
      actor: 'agent',
      name: 'line.drillDownXAxis',
      target: { widgetRef },
      params: { level: 'year', value: 2024, parent: { source: 'test' } },
    })
    let widget = runtime.readState().widgets[widgetRef]
    let drillTransform = widget.transforms.find((transform) =>
      transform?.spec?.actionName === 'line.drillDownXAxis',
    )

    assert.equal(drillResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.drillDown.level, 'year')
    assert.equal(widget.view.drillDown.value, 2024)
    assert.equal(widget.data.analysis.drillDown.rawTimeField, 't')
    assert.equal(drillTransform.kind, 'filter')
    assert.equal(drillTransform.source, 'action')

    const resetResult = await runtime.executeAction({
      callId: 'reset_drill_line',
      actor: 'agent',
      name: 'line.resetDrilldownXAxis',
      target: { widgetRef },
      params: {},
    })
    widget = runtime.readState().widgets[widgetRef]
    drillTransform = widget.transforms.find((transform) =>
      transform?.spec?.actionName === 'line.drillDownXAxis',
    )

    assert.equal(resetResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.drillDown, null)
    assert.equal(widget.data.analysis.drillDown, null)
    assert.equal(drillTransform, undefined)
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})

test('line resample actions write and clear semantic reencode state without calling the provider', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const { runtime, readProviderActionCallCount } = createLineRuntime()

  try {
    const widgetRef = runtime.describeWorkspace().widgets[0].ref
    const resampleResult = await runtime.executeAction({
      callId: 'resample_line',
      actor: 'agent',
      name: 'line.resampleXAxis',
      target: { widgetRef },
      params: { granularity: 'month', agg: 'mean' },
    })
    let widget = runtime.readState().widgets[widgetRef]
    let resampleTransform = widget.transforms.find((transform) =>
      transform?.spec?.actionName === 'line.resampleXAxis',
    )

    assert.equal(resampleResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.reencode.mode, 'resample')
    assert.equal(widget.view.reencode.granularity, 'month')
    assert.equal(widget.view.reencode.timeUnit, 'yearmonth')
    assert.equal(widget.view.reencode.rawTimeField, 't')
    assert.equal(widget.view.reencode.rawValueField, 'value')
    assert.deepEqual(widget.view.reencode.groupBy, ['series'])
    assert.equal(widget.data.analysis.resample.valueField, 'mean_value')
    assert.equal(resampleTransform.kind, 'aggregate')
    assert.equal(resampleTransform.source, 'action')

    const resetResult = await runtime.executeAction({
      callId: 'reset_resample_line',
      actor: 'agent',
      name: 'line.resetResampleXAxis',
      target: { widgetRef },
      params: {},
    })
    widget = runtime.readState().widgets[widgetRef]
    resampleTransform = widget.transforms.find((transform) =>
      transform?.spec?.actionName === 'line.resampleXAxis',
    )

    assert.equal(resetResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.reencode, null)
    assert.equal(widget.data.analysis.resample, null)
    assert.equal(resampleTransform, undefined)
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})

test('line style and filter actions write semantic state without calling the provider', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const { runtime, readProviderActionCallCount } = createLineRuntime()

  try {
    const widgetRef = runtime.describeWorkspace().widgets[0].ref
    const boldResult = await runtime.executeAction({
      callId: 'bold_line',
      actor: 'agent',
      name: 'line.boldLines',
      target: { widgetRef },
      params: { lineNames: ['A'], boldWidth: 5, baseWidth: 1 },
    })
    let widget = runtime.readState().widgets[widgetRef]
    const boldTransform = widget.transforms.find((transform) =>
      transform?.spec?.actionName === 'line.boldLines',
    )

    assert.equal(boldResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.highlight.mode, 'seriesEmphasis')
    assert.equal(widget.view.highlight.lineField, 'series')
    assert.deepEqual(widget.view.highlight.lineNames, ['A'])
    assert.equal(boldTransform.kind, 'derive')
    assert.equal(boldTransform.source, 'action')

    const filterResult = await runtime.executeAction({
      callId: 'filter_line',
      actor: 'agent',
      name: 'line.filterLines',
      target: { widgetRef },
      params: { linesToRemove: ['B'] },
    })
    widget = runtime.readState().widgets[widgetRef]
    const filterTransform = widget.transforms.find((transform) =>
      transform?.spec?.actionName === 'line.filterLines',
    )

    assert.equal(filterResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.data.visibleCount, 2)
    assert.equal(filterTransform.kind, 'filter')
    assert.equal(filterTransform.source, 'action')
    assert.equal(filterTransform.spec.field, 'series')
    assert.deepEqual(filterTransform.spec.values, ['B'])
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})
