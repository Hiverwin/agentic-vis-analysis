import test from 'node:test'
import assert from 'node:assert/strict'

import { createHeatmapWidget, createLineWidget, createScatterWidget } from './index.js'

async function withBrowserShim(run) {
  const previousWindow = globalThis.window
  globalThis.window = {}
  try {
    return await run()
  } finally {
    globalThis.window = previousWindow
  }
}

function findDescriptor(descriptors, name) {
  return descriptors.find((descriptor) => descriptor?.name === name) || null
}

test('annotate primitive closes observe-act-verify for line regression overlays', async () => {
  await withBrowserShim(async () => {
    const widget = createLineWidget({
      sessionId: 'annotate-line',
      spec: {
        mark: 'line',
        encoding: {
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'y', type: 'quantitative' },
        },
      },
      data: [
        { x: 1, y: 2 },
        { x: 2, y: 3 },
        { x: 3, y: 5 },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const annotateDescriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'line.highlightTrend')
      const beforeVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })

      assert.equal(annotateDescriptor?.primitive, 'annotate')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('annotate'), true)
      assert.equal(beforeVisibleRows?.result?.visibleCount, 3)

      const actionResult = await widget.executeAction({
        name: 'line.highlightTrend',
        params: {
          trendType: 'increasing',
        },
      })

      const afterVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })
      const viewConfig = await widget.queryPerception({
        name: 'perception.inspectViewConfig',
        params: {},
      })
      const widgetState = widget.readState()
      const verificationState = widget.readVerificationState()
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'line.highlightTrend',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 3)
      assert.equal(Array.isArray(widgetState?.rawSpec?.layer), true)
      assert.equal(widgetState?.rawSpec?.layer?.some((layer) => layer?._widgetvaTag === 'line.highlightTrend'), true)
      assert.equal(verificationState?.checks?.annotateApplied, true)
      assert.deepEqual(verificationState?.view?.annotate, {
        mode: 'regressionOverlay',
        sourceAction: 'line.highlightTrend',
      })
      assert.deepEqual(viewConfig?.result?.view?.annotate, {
        mode: 'regressionOverlay',
        sourceAction: 'line.highlightTrend',
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'line.highlightTrend')
    } finally {
      widget.dispose()
    }
  })
})

test('annotate primitive closes observe-act-verify for heatmap marginal summaries', async () => {
  await withBrowserShim(async () => {
    const widget = createHeatmapWidget({
      sessionId: 'annotate-heatmap',
      spec: {
        mark: 'rect',
        encoding: {
          x: { field: 'x', type: 'nominal' },
          y: { field: 'y', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      data: [
        { x: 'A', y: '1', value: 1 },
        { x: 'B', y: '1', value: 4 },
        { x: 'A', y: '2', value: 3 },
        { x: 'B', y: '2', value: 2 },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const annotateDescriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'heatmap.addMarginalBars')
      const beforeVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })

      assert.equal(annotateDescriptor?.primitive, 'annotate')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('annotate'), true)
      assert.equal(beforeVisibleRows?.result?.visibleCount, 4)

      const actionResult = await widget.executeAction({
        name: 'heatmap.addMarginalBars',
        params: {
          op: 'mean',
          showTop: true,
          showRight: true,
          barSize: 70,
          barColor: '#666666',
        },
      })

      const afterVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })
      const viewConfig = await widget.queryPerception({
        name: 'perception.inspectViewConfig',
        params: {},
      })
      const widgetState = widget.readState()
      const verificationState = widget.readVerificationState()
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'heatmap.addMarginalBars',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 0)
      assert.equal(widgetState?.rawSpec?._marginal_bars_state?.enabled, true)
      assert.equal(verificationState?.checks?.annotateApplied, true)
      assert.deepEqual(verificationState?.view?.annotate, {
        mode: 'marginalBars',
        op: 'mean',
        showTop: true,
        showRight: true,
        valueField: 'value',
      })
      assert.deepEqual(viewConfig?.result?.view?.annotate, {
        mode: 'marginalBars',
        op: 'mean',
        showTop: true,
        showRight: true,
        valueField: 'value',
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'heatmap.addMarginalBars')
    } finally {
      widget.dispose()
    }
  })
})

test('annotate primitive closes observe-act-verify for scatter cluster annotations', async () => {
  await withBrowserShim(async () => {
    const widget = createScatterWidget({
      sessionId: 'annotate-scatter-clusters',
      spec: {
        mark: 'point',
        encoding: {
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'y', type: 'quantitative' },
        },
      },
      data: [
        { x: 1, y: 1 },
        { x: 1.2, y: 1.1 },
        { x: 9, y: 9 },
        { x: 9.1, y: 9.2 },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'scatter.identifyClusters')

      assert.equal(descriptor?.primitive, 'annotate')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('annotate'), true)

      const actionResult = await widget.executeAction({
        name: 'scatter.identifyClusters',
        params: {
          nClusters: 2,
          method: 'kmeans',
        },
      })

      const viewConfig = await widget.queryPerception({
        name: 'perception.inspectViewConfig',
        params: {},
      })
      const widgetState = widget.readState()
      const verificationState = widget.readVerificationState()
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'scatter.identifyClusters',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(widgetState?.rawSpec?._scatter_cluster_state?.cluster_field, 'cluster_2')
      assert.equal(verificationState?.checks?.annotateApplied, true)
      assert.deepEqual(verificationState?.view?.annotate, {
        mode: 'clusterAnnotation',
        method: 'kmeans',
        clusterField: 'cluster_2',
        nClusters: 2,
      })
      assert.deepEqual(viewConfig?.result?.view?.annotate, {
        mode: 'clusterAnnotation',
        method: 'kmeans',
        clusterField: 'cluster_2',
        nClusters: 2,
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'scatter.identifyClusters')
    } finally {
      widget.dispose()
    }
  })
})

test('annotate primitive closes observe-act-verify for line moving-average overlays', async () => {
  await withBrowserShim(async () => {
    const widget = createLineWidget({
      sessionId: 'annotate-line-moving-average',
      spec: {
        mark: 'line',
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
        },
      },
      data: [
        { date: '2024-01-01', value: 1 },
        { date: '2024-01-02', value: 2 },
        { date: '2024-01-03', value: 4 },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'line.showMovingAverage')

      assert.equal(descriptor?.primitive, 'annotate')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('annotate'), true)

      const actionResult = await widget.executeAction({
        name: 'line.showMovingAverage',
        params: {
          windowSize: 2,
        },
      })

      const viewConfig = await widget.queryPerception({
        name: 'perception.inspectViewConfig',
        params: {},
      })
      const widgetState = widget.readState()
      const verificationState = widget.readVerificationState()
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'line.showMovingAverage',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(Array.isArray(widgetState?.rawSpec?.layer), true)
      assert.equal(widgetState?.rawSpec?.layer?.some((layer) => layer?._widgetvaTag === 'line.showMovingAverage'), true)
      assert.equal(verificationState?.checks?.annotateApplied, true)
      assert.deepEqual(verificationState?.view?.annotate, {
        mode: 'movingAverageOverlay',
        sourceAction: 'line.showMovingAverage',
      })
      assert.deepEqual(viewConfig?.result?.view?.annotate, {
        mode: 'movingAverageOverlay',
        sourceAction: 'line.showMovingAverage',
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'line.showMovingAverage')
    } finally {
      widget.dispose()
    }
  })
})

test('annotate primitive closes observe-act-verify for scatter regression overlays', async () => {
  await withBrowserShim(async () => {
    const widget = createScatterWidget({
      sessionId: 'annotate-scatter-regression',
      spec: {
        mark: 'point',
        encoding: {
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'y', type: 'quantitative' },
        },
      },
      data: [
        { x: 1, y: 2 },
        { x: 2, y: 3 },
        { x: 3, y: 5 },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'scatter.showRegression')

      assert.equal(descriptor?.primitive, 'annotate')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('annotate'), true)

      const actionResult = await widget.executeAction({
        name: 'scatter.showRegression',
        params: {
          method: 'linear',
        },
      })

      const viewConfig = await widget.queryPerception({
        name: 'perception.inspectViewConfig',
        params: {},
      })
      const widgetState = widget.readState()
      const verificationState = widget.readVerificationState()
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'scatter.showRegression',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(Array.isArray(widgetState?.rawSpec?.layer), true)
      assert.equal(widgetState?.rawSpec?.layer?.some((layer) => layer?._widgetvaTag === 'scatter.showRegression'), true)
      assert.equal(verificationState?.checks?.annotateApplied, true)
      assert.deepEqual(verificationState?.view?.annotate, {
        mode: 'regressionOverlay',
        sourceAction: 'scatter.showRegression',
      })
      assert.deepEqual(viewConfig?.result?.view?.annotate, {
        mode: 'regressionOverlay',
        sourceAction: 'scatter.showRegression',
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'scatter.showRegression')
    } finally {
      widget.dispose()
    }
  })
})
