import test from 'node:test'
import assert from 'node:assert/strict'

import { createHeatmapWidget, createLineWidget } from './index.js'

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

test('drillDown primitive closes observe-act-verify for line temporal x-axis drill-down', async () => {
  await withBrowserShim(async () => {
    const widget = createLineWidget({
      sessionId: 'drilldown-line',
      spec: {
        mark: 'line',
        encoding: {
          x: { field: 'date', type: 'temporal', timeUnit: 'year' },
          y: { field: 'value', type: 'quantitative' },
        },
      },
      data: [
        { date: '2024-01-01', value: 1 },
        { date: '2024-01-15', value: 2 },
        { date: '2024-02-01', value: 3 },
        { date: '2025-01-01', value: 4 },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const drillDescriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'line.drillDownXAxis')
      const beforeVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })

      assert.equal(drillDescriptor?.primitive, 'drillDown')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('drillDown'), true)
      assert.deepEqual(drillDescriptor?.paramsSchema?.required, ['level', 'value'])
      assert.equal(beforeVisibleRows?.result?.visibleCount, 4)

      const actionResult = await widget.executeAction({
        name: 'line.drillDownXAxis',
        params: {
          level: 'year',
          value: 2024,
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
          actionName: 'line.drillDownXAxis',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.ok((afterVisibleRows?.result?.visibleCount || 0) <= beforeVisibleRows?.result?.visibleCount)
      assert.equal(widgetState?.rawSpec?._line_drilldown_state?.parent?.year, 2024)
      assert.equal(widgetState?.rawSpec?.encoding?.x?.field, 'month_date')
      assert.equal(verificationState?.checks?.drillDownApplied, true)
      assert.deepEqual(verificationState?.view?.drillDown, {
        axis: 'x',
        active: true,
        level: 'year',
        parent: { year: 2024 },
        targetField: 'month_date',
      })
      assert.deepEqual(viewConfig?.result?.view?.drillDown, {
        axis: 'x',
        active: true,
        level: 'year',
        parent: { year: 2024 },
        targetField: 'month_date',
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'line.drillDownXAxis')
    } finally {
      widget.dispose()
    }
  })
})

test('drillDown primitive closes observe-act-verify for heatmap temporal axis drill-down', async () => {
  await withBrowserShim(async () => {
    const widget = createHeatmapWidget({
      sessionId: 'drilldown-heatmap',
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
        { date: '2024-01-15', category: 'A', value: 2 },
        { date: '2024-02-01', category: 'B', value: 3 },
        { date: '2025-01-01', category: 'A', value: 4 },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const drillDescriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'heatmap.drilldownAxis')
      const beforeVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })

      assert.equal(drillDescriptor?.primitive, 'drillDown')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('drillDown'), true)
      assert.deepEqual(drillDescriptor?.paramsSchema?.required, ['level', 'value'])
      assert.equal(beforeVisibleRows?.result?.visibleCount, 4)

      const actionResult = await widget.executeAction({
        name: 'heatmap.drilldownAxis',
        params: {
          level: 'year',
          value: 2024,
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
          actionName: 'heatmap.drilldownAxis',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 4)
      assert.equal(widgetState?.rawSpec?._heatmap_state?.parent?.year, 2024)
      assert.equal(widgetState?.rawSpec?.encoding?.x?.timeUnit, 'month')
      assert.equal(verificationState?.checks?.drillDownApplied, true)
      assert.deepEqual(verificationState?.view?.drillDown, {
        axis: 'x',
        active: true,
        level: 'year',
        parent: { year: 2024 },
        targetField: 'date',
      })
      assert.deepEqual(viewConfig?.result?.view?.drillDown, {
        axis: 'x',
        active: true,
        level: 'year',
        parent: { year: 2024 },
        targetField: 'date',
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'heatmap.drilldownAxis')
    } finally {
      widget.dispose()
    }
  })
})
