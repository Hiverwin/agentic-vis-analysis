import test from 'node:test'
import assert from 'node:assert/strict'

import { createHeatmapWidget, createLineWidget, createSankeyWidget } from './index.js'

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

test('navigate primitive closes observe-act-verify for line drill-down reset', async () => {
  await withBrowserShim(async () => {
    const widget = createLineWidget({
      sessionId: 'navigate-line',
      spec: {
        mark: 'line',
        encoding: {
          x: { field: 'date', type: 'temporal', timeUnit: 'year' },
          y: { field: 'value', type: 'quantitative' },
        },
      },
      data: [
        { date: '2024-01-01', value: 1 },
        { date: '2024-02-01', value: 3 },
        { date: '2025-01-01', value: 4 },
      ],
    })

    try {
      await widget.executeAction({
        name: 'line.drillDownXAxis',
        params: {
          level: 'year',
          value: 2024,
        },
      })

      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'line.resetDrilldownXAxis')

      assert.equal(descriptor?.primitive, 'navigate')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('navigate'), true)

      const actionResult = await widget.executeAction({
        name: 'line.resetDrilldownXAxis',
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
          actionName: 'line.resetDrilldownXAxis',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(widgetState?.rawSpec?._line_drilldown_state, undefined)
      assert.equal(widgetState?.rawSpec?._navigation_state?.sourceAction, 'line.resetDrilldownXAxis')
      assert.equal(verificationState?.checks?.navigateApplied, true)
      assert.deepEqual(verificationState?.view?.navigate, {
        mode: 'reset',
        sourceAction: 'line.resetDrilldownXAxis',
      })
      assert.deepEqual(viewConfig?.result?.view?.navigate, {
        mode: 'reset',
        sourceAction: 'line.resetDrilldownXAxis',
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'line.resetDrilldownXAxis')
    } finally {
      widget.dispose()
    }
  })
})

test('navigate primitive closes observe-act-verify for heatmap drill-down reset', async () => {
  await withBrowserShim(async () => {
    const widget = createHeatmapWidget({
      sessionId: 'navigate-heatmap',
      spec: {
        mark: 'rect',
        encoding: {
          x: { field: 'date', type: 'temporal', timeUnit: 'year' },
          y: { field: 'category', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      },
      data: [
        { date: '2024-01-01', category: 'A', value: 1 },
        { date: '2024-02-01', category: 'B', value: 3 },
        { date: '2025-01-01', category: 'A', value: 4 },
      ],
    })

    try {
      await widget.executeAction({
        name: 'heatmap.drilldownAxis',
        params: {
          level: 'year',
          value: 2024,
        },
      })

      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'heatmap.resetDrilldown')

      assert.equal(descriptor?.primitive, 'navigate')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('navigate'), true)

      const actionResult = await widget.executeAction({
        name: 'heatmap.resetDrilldown',
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
          actionName: 'heatmap.resetDrilldown',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(widgetState?.rawSpec?._heatmap_state, undefined)
      assert.equal(widgetState?.rawSpec?._navigation_state?.sourceAction, 'heatmap.resetDrilldown')
      assert.equal(verificationState?.checks?.navigateApplied, true)
      assert.deepEqual(verificationState?.view?.navigate, {
        mode: 'reset',
        sourceAction: 'heatmap.resetDrilldown',
      })
      assert.deepEqual(viewConfig?.result?.view?.navigate, {
        mode: 'reset',
        sourceAction: 'heatmap.resetDrilldown',
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'heatmap.resetDrilldown')
    } finally {
      widget.dispose()
    }
  })
})

test('navigate primitive closes observe-act-verify for Sankey node expansion', async () => {
  await withBrowserShim(async () => {
    const widget = createSankeyWidget({
      sessionId: 'navigate-sankey',
      spec: {
        data: [
          {
            name: 'rawLinks',
            values: [
              { source: 'A', target: 'C', value: 4 },
              { source: 'B', target: 'C', value: 6 },
              { source: 'C', target: 'D', value: 10 },
            ],
          },
          {
            name: 'nodeConfig',
            values: [
              { name: 'A', depth: 0, order: 0 },
              { name: 'B', depth: 0, order: 1 },
              { name: 'C', depth: 1, order: 0 },
              { name: 'D', depth: 2, order: 0 },
            ],
          },
        ],
      },
    })

    try {
      await widget.executeAction({
        name: 'sankey.collapseNodes',
        params: {
          nodes: ['A', 'B'],
          aggregateName: 'Other Sources',
        },
      })

      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'sankey.expandNode')

      assert.equal(descriptor?.primitive, 'navigate')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('navigate'), true)

      const actionResult = await widget.executeAction({
        name: 'sankey.expandNode',
        params: {
          aggregateName: 'Other Sources',
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
          actionName: 'sankey.expandNode',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(widgetState?.rawSpec?._sankey_state?.collapsed_groups?.['Other Sources'], undefined)
      assert.deepEqual(widgetState?.rawSpec?._navigation_state, {
        mode: 'expandNode',
        sourceAction: 'sankey.expandNode',
        aggregateName: 'Other Sources',
      })
      assert.equal(verificationState?.checks?.navigateApplied, true)
      assert.deepEqual(verificationState?.view?.navigate, {
        mode: 'expandNode',
        sourceAction: 'sankey.expandNode',
      })
      assert.deepEqual(viewConfig?.result?.view?.navigate, {
        mode: 'expandNode',
        sourceAction: 'sankey.expandNode',
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'sankey.expandNode')
    } finally {
      widget.dispose()
    }
  })
})

test('navigate primitive closes observe-act-verify for line resample reset', async () => {
  await withBrowserShim(async () => {
    const widget = createLineWidget({
      sessionId: 'navigate-line-reset-resample',
      spec: {
        mark: 'line',
        encoding: {
          x: { field: 'date', type: 'temporal', timeUnit: 'day' },
          y: { field: 'value', type: 'quantitative' },
        },
      },
      data: [
        { date: '2024-01-01', value: 1 },
        { date: '2024-01-02', value: 3 },
        { date: '2024-02-01', value: 4 },
      ],
    })

    try {
      await widget.executeAction({
        name: 'line.resampleXAxis',
        params: {
          granularity: 'month',
          agg: 'sum',
        },
      })

      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'line.resetResampleXAxis')

      assert.equal(descriptor?.primitive, 'navigate')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('navigate'), true)

      const actionResult = await widget.executeAction({
        name: 'line.resetResampleXAxis',
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
          actionName: 'line.resetResampleXAxis',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(widgetState?.rawSpec?._resample_state, undefined)
      assert.deepEqual(widgetState?.rawSpec?._navigation_state, {
        mode: 'reset',
        sourceAction: 'line.resetResampleXAxis',
      })
      assert.equal(verificationState?.checks?.navigateApplied, true)
      assert.deepEqual(verificationState?.view?.navigate, {
        mode: 'reset',
        sourceAction: 'line.resetResampleXAxis',
      })
      assert.deepEqual(viewConfig?.result?.view?.navigate, {
        mode: 'reset',
        sourceAction: 'line.resetResampleXAxis',
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'line.resetResampleXAxis')
    } finally {
      widget.dispose()
    }
  })
})
