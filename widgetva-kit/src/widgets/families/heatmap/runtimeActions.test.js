import test from 'node:test'
import assert from 'node:assert/strict'

import { createWidgetVARuntime } from '../../../core/runtime/RuntimeOrchestrator.js'

function buildHeatmapSpec() {
  return {
    data: {
      values: [
        { month: 'Jan', day: 'Mon', value: 10 },
        { month: 'Jan', day: 'Tue', value: 20 },
        { month: 'Feb', day: 'Mon', value: 30 },
        { month: 'Feb', day: 'Tue', value: 40 },
      ],
    },
    mark: 'rect',
    encoding: {
      x: { field: 'month', type: 'ordinal' },
      y: { field: 'day', type: 'ordinal' },
      color: { field: 'value', type: 'quantitative' },
    },
  }
}

function createHeatmapRuntime() {
  const spec = buildHeatmapSpec()
  let providerActionCallCount = 0
  const runtime = createWidgetVARuntime({
    registerDefaultWidgetFamilies: true,
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'heatmap-runtime-actions',
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
        throw new Error('heatmap family actions should not call provider actions directly')
      },
    },
  })
  return {
    runtime,
    readProviderActionCallCount: () => providerActionCallCount,
  }
}

async function execute(runtime, widgetRef, name, params) {
  return runtime.executeAction({
    callId: name.replaceAll('.', '_'),
    actor: 'agent',
    name,
    target: { widgetRef },
    params,
  })
}

test('heatmap provider-backed actions write semantic state patches without calling the provider', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const { runtime, readProviderActionCallCount } = createHeatmapRuntime()

  try {
    const widgetRef = runtime.describeWorkspace().widgets[0].ref

    const drillResult = await execute(runtime, widgetRef, 'heatmap.drilldownAxis', {
      level: 'month',
      value: 'Jan',
      parent: { axis: 'x' },
    })
    let widget = runtime.readState().widgets[widgetRef]
    assert.equal(drillResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.drillDown.level, 'month')
    assert.equal(widget.data.analysis.drillDown.value, 'Jan')
    assert.equal(widget.transforms.find((transform) => transform?.spec?.actionName === 'heatmap.drilldownAxis')?.kind, 'filter')

    const resetResult = await execute(runtime, widgetRef, 'heatmap.resetDrilldown', {})
    widget = runtime.readState().widgets[widgetRef]
    assert.equal(resetResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.drillDown, null)
    assert.equal(widget.transforms.some((transform) => transform?.spec?.actionName === 'heatmap.drilldownAxis'), false)

    const marginalResult = await execute(runtime, widgetRef, 'heatmap.addMarginalBars', {
      op: 'sum',
      showTop: true,
      showRight: false,
      barSize: 44,
    })
    widget = runtime.readState().widgets[widgetRef]
    assert.equal(marginalResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.addRemove.mode, 'marginalBars')
    assert.equal(widget.data.analysis.marginalBars.op, 'sum')

    const highlightResult = await execute(runtime, widgetRef, 'heatmap.highlightRegion', {
      xValues: ['Jan'],
      yValues: ['Mon'],
    })
    widget = runtime.readState().widgets[widgetRef]
    assert.equal(highlightResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.highlight.mode, 'regionHighlight')
    assert.deepEqual(widget.data.analysis.regionHighlight.xValues, ['Jan'])

    const colorResult = await execute(runtime, widgetRef, 'heatmap.adjustColorScale', {
      scheme: 'viridis',
      domain: [0, 50],
    })
    widget = runtime.readState().widgets[widgetRef]
    assert.equal(colorResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.reencode.mode, 'colorScale')
    assert.deepEqual(widget.data.analysis.colorScale.domain, [0, 50])

    const thresholdResult = await execute(runtime, widgetRef, 'heatmap.thresholdMask', {
      minValue: 15,
      maxValue: 35,
      outsideOpacity: 0.2,
    })
    widget = runtime.readState().widgets[widgetRef]
    assert.equal(thresholdResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.highlight.mode, 'thresholdMask')
    assert.equal(widget.data.analysis.thresholdMask.outsideOpacity, 0.2)

    const halfOpenThresholdResult = await execute(runtime, widgetRef, 'heatmap.thresholdMask', {
      minValue: 15,
      maxValue: null,
      outsideOpacity: 0.2,
    })
    widget = runtime.readState().widgets[widgetRef]
    assert.equal(halfOpenThresholdResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.highlight.mode, 'thresholdMask')
    assert.equal(widget.view.highlight.minValue, 15)
    assert.equal('maxValue' in widget.view.highlight, false)

    const filterRegionResult = await execute(runtime, widgetRef, 'heatmap.filterCellsByRegion', {
      xValues: ['Jan'],
      yValues: ['Mon'],
    })
    widget = runtime.readState().widgets[widgetRef]
    assert.equal(filterRegionResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.transforms.find((transform) => transform?.spec?.actionName === 'heatmap.filterCellsByRegion')?.kind, 'filter')

    const valueHighlightResult = await execute(runtime, widgetRef, 'heatmap.highlightRegionByValue', {
      minValue: 20,
      maxValue: 40,
      outsideOpacity: 0.15,
    })
    widget = runtime.readState().widgets[widgetRef]
    assert.equal(valueHighlightResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.highlight.mode, 'valueHighlight')
    assert.equal(widget.data.analysis.valueHighlight.minValue, 20)

    const clusterResult = await execute(runtime, widgetRef, 'heatmap.clusterRowsCols', {
      clusterRows: true,
      clusterCols: false,
      method: 'mean',
    })
    widget = runtime.readState().widgets[widgetRef]
    assert.equal(clusterResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.reencode.mode, 'clusterRowsCols')
    assert.equal(widget.data.analysis.cluster.method, 'mean')

    const transposeResult = await execute(runtime, widgetRef, 'heatmap.transpose', {})
    widget = runtime.readState().widgets[widgetRef]
    assert.equal(transposeResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.reencode.mode, 'transpose')
    assert.equal(widget.data.analysis.transpose.transposed, true)
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})
