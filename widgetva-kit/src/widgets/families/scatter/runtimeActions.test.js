import test from 'node:test'
import assert from 'node:assert/strict'

import { createWidgetVARuntime } from '../../../core/runtime/RuntimeOrchestrator.js'

function buildScatterSpec() {
  return {
    data: {
      values: [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 10, y: 10 },
        { x: 11, y: 11 },
      ],
    },
    mark: 'point',
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
    },
  }
}

function createScatterRuntime() {
  const spec = buildScatterSpec()
  let providerActionCallCount = 0
  const runtime = createWidgetVARuntime({
    registerDefaultWidgetFamilies: true,
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'scatter-runtime-actions',
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
        throw new Error('scatter family actions should not call provider actions directly')
      },
    },
  })
  return {
    runtime,
    readProviderActionCallCount: () => providerActionCallCount,
  }
}

test('scatter.identifyClusters returns a semantic widget-state patch without calling the provider', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const { runtime, readProviderActionCallCount } = createScatterRuntime()

  try {
    const widgetRef = runtime.describeWorkspace().widgets[0].ref
    const result = await runtime.executeAction({
      callId: 'identify_clusters',
      actor: 'agent',
      name: 'scatter.identifyClusters',
      target: { widgetRef },
      params: { nClusters: 2, method: 'kmeans', xField: 'x', yField: 'y' },
    })
    const widget = runtime.readState().widgets[widgetRef]
    const clusterTransform = widget.transforms.find((transform) =>
      transform?.spec?.actionName === 'scatter.identifyClusters',
    )

    assert.equal(result.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.reencode.mode, 'clusterEncoding')
    assert.equal(widget.view.reencode.clusterField, 'cluster_2')
    assert.equal(widget.encodings.color.field, 'cluster_2')
    assert.equal(widget.data.analysis.clusters.nClusters, 2)
    assert.equal(widget.data.derivedRows.length, 4)
    assert.equal(widget.data.derivedRows.every((row) => Number.isInteger(row.cluster_2)), true)
    assert.equal(clusterTransform.kind, 'derive')
    assert.equal(clusterTransform.source, 'action')
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})

test('scatter.showRegression returns a semantic regression overlay patch without calling the provider', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const { runtime, readProviderActionCallCount } = createScatterRuntime()

  try {
    const widgetRef = runtime.describeWorkspace().widgets[0].ref
    const result = await runtime.executeAction({
      callId: 'show_regression',
      actor: 'agent',
      name: 'scatter.showRegression',
      target: { widgetRef },
      params: { method: 'linear', xField: 'x', yField: 'y' },
    })
    const widget = runtime.readState().widgets[widgetRef]
    const regressionTransform = widget.transforms.find((transform) =>
      transform?.spec?.actionName === 'scatter.showRegression',
    )

    assert.equal(result.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.reencode.mode, 'regressionOverlay')
    assert.equal(widget.view.reencode.xField, 'x')
    assert.equal(widget.view.reencode.yField, 'y')
    assert.equal(widget.data.analysis.regression.method, 'linear')
    assert.equal(widget.data.analysis.regression.slope, 1)
    assert.equal(widget.data.analysis.regression.intercept, 0)
    assert.deepEqual(widget.data.analysis.regression.domain, [1, 11])
    assert.equal(regressionTransform.kind, 'derive')
    assert.equal(regressionTransform.source, 'action')
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})
