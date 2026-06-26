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

test('aggregate primitive closes observe-act-verify for line temporal resampling', async () => {
  await withBrowserShim(async () => {
    const widget = createLineWidget({
      sessionId: 'aggregate-line',
      spec: {
        mark: 'line',
        encoding: {
          x: { field: 'date', type: 'temporal', timeUnit: 'day' },
          y: { field: 'value', type: 'quantitative' },
        },
      },
      data: [
        { date: '2024-01-01', value: 1 },
        { date: '2024-01-02', value: 2 },
        { date: '2024-02-01', value: 3 },
        { date: '2024-02-02', value: 5 },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const aggregateDescriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'line.resampleXAxis')
      const beforeVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })

      assert.equal(aggregateDescriptor?.primitive, 'aggregate')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('aggregate'), true)
      assert.deepEqual(aggregateDescriptor?.paramsSchema?.required, ['granularity'])
      assert.equal(beforeVisibleRows?.result?.visibleCount, 4)

      const actionResult = await widget.executeAction({
        name: 'line.resampleXAxis',
        params: {
          granularity: 'month',
          agg: 'sum',
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
          actionName: 'line.resampleXAxis',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 4)
      assert.equal(widgetState?.rawSpec?._resample_state?.current_granularity, 'month')
      assert.equal(widgetState?.rawSpec?._resample_state?.current_agg, 'sum')
      assert.equal(verificationState?.checks?.aggregateApplied, true)
      assert.deepEqual(verificationState?.view?.aggregate, {
        mode: 'resample',
        axis: 'x',
        granularity: 'month',
        agg: 'sum',
        timeField: 'date',
        valueField: 'value',
      })
      assert.deepEqual(viewConfig?.result?.view?.aggregate, {
        mode: 'resample',
        axis: 'x',
        granularity: 'month',
        agg: 'sum',
        timeField: 'date',
        valueField: 'value',
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'line.resampleXAxis')
    } finally {
      widget.dispose()
    }
  })
})

test('aggregate primitive closes observe-act-verify for heatmap aggregate-based clustering', async () => {
  await withBrowserShim(async () => {
    const widget = createHeatmapWidget({
      sessionId: 'aggregate-heatmap',
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
      const aggregateDescriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'heatmap.clusterRowsCols')
      const beforeVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })

      assert.equal(aggregateDescriptor?.primitive, 'aggregate')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('aggregate'), true)
      assert.equal(beforeVisibleRows?.result?.visibleCount, 4)

      const actionResult = await widget.executeAction({
        name: 'heatmap.clusterRowsCols',
        params: {
          clusterRows: true,
          clusterCols: true,
          method: 'sum',
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
          actionName: 'heatmap.clusterRowsCols',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 4)
      assert.equal(widgetState?.rawSpec?._cluster_rows_cols_state?.method, 'sum')
      assert.equal(verificationState?.checks?.aggregateApplied, true)
      assert.deepEqual(verificationState?.view?.aggregate, {
        mode: 'clusterRowsCols',
        clusterRows: true,
        clusterCols: true,
        method: 'sum',
        colorField: 'value',
      })
      assert.deepEqual(viewConfig?.result?.view?.aggregate, {
        mode: 'clusterRowsCols',
        clusterRows: true,
        clusterCols: true,
        method: 'sum',
        colorField: 'value',
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'heatmap.clusterRowsCols')
    } finally {
      widget.dispose()
    }
  })
})

test('aggregate primitive closes observe-act-verify for Sankey node collapsing', async () => {
  await withBrowserShim(async () => {
    const widget = createSankeyWidget({
      sessionId: 'aggregate-sankey',
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
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'sankey.collapseNodes')

      assert.equal(descriptor?.primitive, 'aggregate')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('aggregate'), true)

      const actionResult = await widget.executeAction({
        name: 'sankey.collapseNodes',
        params: {
          nodes: ['A', 'B'],
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
          actionName: 'sankey.collapseNodes',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.deepEqual(widgetState?.rawSpec?._sankey_aggregate_state, {
        mode: 'collapseNodes',
        aggregate_name: 'Other Sources',
        collapsed_nodes: ['A', 'B'],
      })
      assert.equal(verificationState?.checks?.aggregateApplied, true)
      assert.deepEqual(verificationState?.view?.aggregate, {
        mode: 'collapseNodes',
        aggregateName: 'Other Sources',
        collapsedNodes: ['A', 'B'],
      })
      assert.deepEqual(viewConfig?.result?.view?.aggregate, {
        mode: 'collapseNodes',
        aggregateName: 'Other Sources',
        collapsedNodes: ['A', 'B'],
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'sankey.collapseNodes')
    } finally {
      widget.dispose()
    }
  })
})

test('aggregate primitive closes observe-act-verify for Sankey rank-based auto collapsing', async () => {
  await withBrowserShim(async () => {
    const widget = createSankeyWidget({
      sessionId: 'aggregate-sankey-auto-collapse',
      spec: {
        data: [
          {
            name: 'rawLinks',
            values: [
              { source: 'A', target: 'D', value: 8 },
              { source: 'B', target: 'D', value: 3 },
              { source: 'C', target: 'D', value: 1 },
              { source: 'D', target: 'E', value: 12 },
            ],
          },
          {
            name: 'nodeConfig',
            values: [
              { name: 'A', depth: 0, order: 0 },
              { name: 'B', depth: 0, order: 1 },
              { name: 'C', depth: 0, order: 2 },
              { name: 'D', depth: 1, order: 0 },
              { name: 'E', depth: 2, order: 0 },
            ],
          },
        ],
      },
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'sankey.autoCollapseByRank')

      assert.equal(descriptor?.primitive, 'aggregate')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('aggregate'), true)

      const actionResult = await widget.executeAction({
        name: 'sankey.autoCollapseByRank',
        params: {
          topN: 1,
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
          actionName: 'sankey.autoCollapseByRank',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(widgetState?.rawSpec?._sankey_aggregate_state?.mode, 'autoCollapseByRank')
      assert.equal(verificationState?.checks?.aggregateApplied, true)
      assert.deepEqual(verificationState?.view?.aggregate, {
        mode: 'autoCollapseByRank',
        topN: 1,
        collapsedGroups: [
          {
            depth: 0,
            aggregateName: 'Others (Layer 0)',
            collapsedNodes: ['B', 'C'],
          },
        ],
      })
      assert.deepEqual(viewConfig?.result?.view?.aggregate, {
        mode: 'autoCollapseByRank',
        topN: 1,
        collapsedGroups: [
          {
            depth: 0,
            aggregateName: 'Others (Layer 0)',
            collapsedNodes: ['B', 'C'],
          },
        ],
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'sankey.autoCollapseByRank')
    } finally {
      widget.dispose()
    }
  })
})
