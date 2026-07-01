import test from 'node:test'
import assert from 'node:assert/strict'

import { createBarWidget, createHeatmapWidget, createLineWidget, createParallelCoordinatesWidget, createSankeyWidget, createScatterWidget } from './index.js'

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

test('selection primitive closes observe-act-verify for scatter interval brushing', async () => {
  await withBrowserShim(async () => {
    const widget = createScatterWidget({
      sessionId: 'selection-scatter',
      spec: {
        mark: 'point',
        encoding: {
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'y', type: 'quantitative' },
        },
      },
      data: [
        { x: 1, y: 2, category: 'a' },
        { x: 2, y: 3, category: 'b' },
        { x: 5, y: 7, category: 'c' },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const brushDescriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'scatter.brushRegion')
      const beforeVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })

      assert.equal(brushDescriptor?.primitive, 'select')
      assert.deepEqual(brushDescriptor?.paramsSchema?.required, ['xField', 'yField', 'xRange', 'yRange'])
      assert.equal(beforeObservation?.selection?.contract?.localSelectionFamily, 'interval')
      assert.equal(beforeObservation?.selection?.localSelectionCount, 0)
      assert.equal(beforeVisibleRows?.ok, true)
      assert.equal(beforeVisibleRows?.result?.visibleCount, 3)

      const actionResult = await widget.executeAction({
        name: 'scatter.brushRegion',
        params: {
          xField: 'x',
          yField: 'y',
          xRange: [0, 3],
          yRange: [0, 4],
        },
      })

      const afterObservation = widget.readObservation()
      const widgetState = widget.readState()
      const verificationState = widget.readVerificationState()
      const selectionSummary = await widget.queryPerception({
        name: 'perception.summarizeSelection',
        params: {},
      })
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'scatter.brushRegion',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(actionResult?.actionName, 'scatter.brushRegion')
      assert.equal(afterObservation?.selection?.localSelectionCount, 1)
      assert.equal(afterObservation?.selection?.activeSelectionKind, 'interval')
      assert.deepEqual(afterObservation?.selection?.activeSelectionFields, ['x', 'y'])
      assert.equal(widgetState?.rawSpec?.layer?.some((layer) => layer?._widgetvaTag === 'scatter.brushRegion') || false, false)
      assert.equal(typeof widgetState?.rawSpec?.encoding?.opacity?.condition?.test, 'string')
      assert.equal(verificationState?.checks?.selectionApplied, true)
      assert.equal(verificationState?.selections?.count, 1)
      assert.equal(selectionSummary?.ok, true)
      assert.equal(selectionSummary?.result?.hasSelection, true)
      assert.equal(selectionSummary?.result?.selectedCount, 2)
      assert.equal(selectionSummary?.result?.summary, 'x 0~3; y 0~4')
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'scatter.brushRegion')
    } finally {
      widget.dispose()
    }
  })
})

test('selection primitive closes observe-act-verify for bar categorical selection', async () => {
  await withBrowserShim(async () => {
    const widget = createBarWidget({
      sessionId: 'selection-bar',
      spec: {
        mark: 'bar',
        encoding: {
          x: { field: 'category', type: 'nominal' },
          y: { field: 'value', type: 'quantitative' },
        },
      },
      data: [
        { category: 'A', value: 1 },
        { category: 'B', value: 2 },
        { category: 'A', value: 3 },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const selectDescriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'bar.selectCategory')
      const beforeVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })

      assert.equal(selectDescriptor?.primitive, 'select')
      assert.deepEqual(selectDescriptor?.paramsSchema?.required, ['field', 'values'])
      assert.equal(beforeObservation?.selection?.contract?.localSelectionFamily, 'category')
      assert.equal(beforeObservation?.selection?.localSelectionCount, 0)
      assert.equal(beforeVisibleRows?.ok, true)
      assert.equal(beforeVisibleRows?.result?.visibleCount, 3)

      const actionResult = await widget.executeAction({
        name: 'bar.selectCategory',
        params: {
          field: 'category',
          values: ['A'],
        },
      })

      const afterObservation = widget.readObservation()
      const verificationState = widget.readVerificationState()
      const selectionSummary = await widget.queryPerception({
        name: 'perception.summarizeSelection',
        params: {},
      })
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'bar.selectCategory',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(actionResult?.actionName, 'bar.selectCategory')
      assert.equal(afterObservation?.selection?.localSelectionCount, 1)
      assert.equal(afterObservation?.selection?.activeSelectionKind, 'category')
      assert.equal(afterObservation?.selection?.activeSelectionSummary, 'category: A')
      assert.equal(verificationState?.checks?.selectionApplied, true)
      assert.equal(verificationState?.selections?.count, 1)
      assert.equal(selectionSummary?.ok, true)
      assert.equal(selectionSummary?.result?.hasSelection, true)
      assert.equal(selectionSummary?.result?.selectedCount, 2)
      assert.equal(selectionSummary?.result?.summary, 'category: A')
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'bar.selectCategory')
    } finally {
      widget.dispose()
    }
  })
})

test('selection primitive closes observe-act-verify for heatmap cell selection', async () => {
  await withBrowserShim(async () => {
    const widget = createHeatmapWidget({
      sessionId: 'selection-heatmap-cell',
      spec: {
        mark: 'rect',
        encoding: {
          x: { field: 'Origin', type: 'nominal' },
          y: { field: 'Cylinders', type: 'nominal' },
          color: { field: 'Horsepower', type: 'quantitative' },
        },
      },
      data: [
        { Origin: 'Japan', Cylinders: '4', Horsepower: 95 },
        { Origin: 'USA', Cylinders: '8', Horsepower: 180 },
        { Origin: 'Europe', Cylinders: '4', Horsepower: 88 },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'heatmap.selectCell')

      assert.equal(descriptor?.primitive, 'select')
      assert.equal(beforeObservation?.selection?.contract?.localSelectionFamily, 'cell')

      const actionResult = await widget.executeAction({
        name: 'heatmap.selectCell',
        params: {
          xField: 'Origin',
          yField: 'Cylinders',
          xValue: 'Japan',
          yValue: '4',
        },
      })

      const afterObservation = widget.readObservation()
      const verificationState = widget.readVerificationState()
      const selectionSummary = await widget.queryPerception({
        name: 'perception.summarizeSelection',
        params: {},
      })
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'heatmap.selectCell',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterObservation?.selection?.localSelectionCount, 1)
      assert.equal(afterObservation?.selection?.activeSelectionKind, 'cell')
      assert.deepEqual(afterObservation?.selection?.activeSelectionFields, ['Origin', 'Cylinders'])
      assert.equal(verificationState?.checks?.selectionApplied, true)
      assert.equal(selectionSummary?.ok, true)
      assert.equal(selectionSummary?.result?.hasSelection, true)
      assert.equal(selectionSummary?.result?.selectedCount, 1)
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'heatmap.selectCell')
    } finally {
      widget.dispose()
    }
  })
})

test('selection primitive closes observe-act-verify for Sankey flow focus selections', async () => {
  await withBrowserShim(async () => {
    const widget = createSankeyWidget({
      sessionId: 'selection-sankey-flow',
      spec: {
        data: [
          {
            name: 'rawLinks',
            values: [
              { source: 'A', target: 'B', value: 5 },
              { source: 'A', target: 'C', value: 3 },
              { source: 'B', target: 'D', value: 2 },
            ],
          },
        ],
      },
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'sankey.focusFlow')

      assert.equal(descriptor?.primitive, 'select')
      assert.equal(beforeObservation?.selection?.contract?.localSelectionFamily, 'category')

      const actionResult = await widget.executeAction({
        name: 'sankey.focusFlow',
        params: {
          field: 'source',
          values: ['A'],
        },
      })

      const afterObservation = widget.readObservation()
      const verificationState = widget.readVerificationState()
      const selectionSummary = await widget.queryPerception({
        name: 'perception.summarizeSelection',
        params: {},
      })
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'sankey.focusFlow',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterObservation?.selection?.localSelectionCount, 1)
      assert.equal(afterObservation?.selection?.activeSelectionKind, 'category')
      assert.equal(verificationState?.checks?.selectionApplied, true)
      assert.equal(selectionSummary?.ok, true)
      assert.equal(selectionSummary?.result?.hasSelection, true)
      assert.equal(selectionSummary?.result?.summary, 'source: A')
      assert.deepEqual(selectionSummary?.result?.predicates, [
        {
          field: 'source',
          op: 'in',
          value: ['A'],
        },
      ])
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'sankey.focusFlow')
    } finally {
      widget.dispose()
    }
  })
})

test('selection primitive closes observe-act-verify for line series selection', async () => {
  await withBrowserShim(async () => {
    const widget = createLineWidget({
      sessionId: 'selection-line-series',
      spec: {
        mark: 'line',
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'series', type: 'nominal' },
        },
      },
      data: [
        { date: '2024-01-01', value: 1, series: 'A' },
        { date: '2024-01-02', value: 2, series: 'A' },
        { date: '2024-01-01', value: 5, series: 'B' },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'line.selectSeries')

      assert.equal(descriptor?.primitive, 'select')
      assert.equal(beforeObservation?.selection?.contract?.localSelectionFamily, 'category')

      const actionResult = await widget.executeAction({
        name: 'line.selectSeries',
        params: {
          field: 'series',
          values: ['A'],
        },
      })

      const afterObservation = widget.readObservation()
      const selectionSummary = await widget.queryPerception({
        name: 'perception.summarizeSelection',
        params: {},
      })
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'line.selectSeries',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterObservation?.selection?.activeSelectionKind, 'category')
      assert.equal(afterObservation?.selection?.activeSelectionSummary, 'series: A')
      assert.equal(selectionSummary?.ok, true)
      assert.equal(selectionSummary?.result?.selectedCount, 2)
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'line.selectSeries')
    } finally {
      widget.dispose()
    }
  })
})

test('selection primitive closes observe-act-verify for line x-value selection', async () => {
  await withBrowserShim(async () => {
    const widget = createLineWidget({
      sessionId: 'selection-line-xvalue',
      spec: {
        mark: 'line',
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'series', type: 'nominal' },
        },
      },
      data: [
        { date: '2024-01-01', value: 1, series: 'A' },
        { date: '2024-01-01', value: 5, series: 'B' },
        { date: '2024-01-02', value: 2, series: 'A' },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'line.selectXValue')

      assert.equal(descriptor?.primitive, 'select')

      const actionResult = await widget.executeAction({
        name: 'line.selectXValue',
        params: {
          value: '2024-01-01',
        },
      })

      const afterObservation = widget.readObservation()
      const selectionSummary = await widget.queryPerception({
        name: 'perception.summarizeSelection',
        params: {},
      })
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'line.selectXValue',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterObservation?.selection?.activeSelectionKind, 'category')
      assert.equal(afterObservation?.selection?.activeSelectionSummary, 'date: 2024-01-01')
      assert.equal(selectionSummary?.ok, true)
      assert.equal(selectionSummary?.result?.selectedCount, 2)
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'line.selectXValue')
    } finally {
      widget.dispose()
    }
  })
})

test('selection primitive closes observe-act-verify for heatmap submatrix selection', async () => {
  await withBrowserShim(async () => {
    const widget = createHeatmapWidget({
      sessionId: 'selection-heatmap-submatrix',
      spec: {
        mark: 'rect',
        encoding: {
          x: { field: 'Origin', type: 'nominal' },
          y: { field: 'Cylinders', type: 'nominal' },
          color: { field: 'Horsepower', type: 'quantitative' },
        },
      },
      data: [
        { Origin: 'Japan', Cylinders: '4', Horsepower: 95 },
        { Origin: 'USA', Cylinders: '8', Horsepower: 180 },
        { Origin: 'Europe', Cylinders: '4', Horsepower: 88 },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'heatmap.selectSubmatrix')

      assert.equal(descriptor?.primitive, 'select')

      const actionResult = await widget.executeAction({
        name: 'heatmap.selectSubmatrix',
        params: {
          xValues: ['Japan', 'Europe'],
          yValues: ['4'],
        },
      })

      const afterObservation = widget.readObservation()
      const selectionSummary = await widget.queryPerception({
        name: 'perception.summarizeSelection',
        params: {},
      })
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'heatmap.selectSubmatrix',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterObservation?.selection?.activeSelectionKind, 'cell')
      assert.deepEqual(afterObservation?.selection?.activeSelectionFields, ['Origin', 'Cylinders'])
      assert.equal(selectionSummary?.ok, true)
      assert.equal(selectionSummary?.result?.selectedCount, 2)
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'heatmap.selectSubmatrix')
    } finally {
      widget.dispose()
    }
  })
})

test('selection primitive closes observe-act-verify for parallel-coordinate axis brushing', async () => {
  await withBrowserShim(async () => {
    const widget = createParallelCoordinatesWidget({
      sessionId: 'selection-parallel-brush',
      spec: {
        data: {
          values: [
            { id: 1, mpg: 18, hp: 130, wt: 3500 },
            { id: 2, mpg: 22, hp: 95, wt: 2800 },
            { id: 3, mpg: 30, hp: 70, wt: 2200 },
          ],
        },
        transform: [
          {
            fold: ['mpg', 'hp', 'wt'],
            as: ['dimension', 'value'],
          },
        ],
        mark: 'line',
        encoding: {
          x: { field: 'dimension', type: 'nominal', scale: { domain: ['mpg', 'hp', 'wt'] } },
          y: { field: 'value', type: 'quantitative' },
          detail: { field: 'id', type: 'nominal' },
        },
      },
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'parallelCoordinates.brushAxes')

      assert.equal(descriptor?.primitive, 'select')
      assert.equal(beforeObservation?.selection?.contract?.localSelectionFamily, 'interval')

      const actionResult = await widget.executeAction({
        name: 'parallelCoordinates.brushAxes',
        params: {
          rules: [
            { field: 'mpg', range: [20, 35] },
            { field: 'hp', range: [60, 100] },
          ],
        },
      })

      const afterObservation = widget.readObservation()
      const selectionSummary = await widget.queryPerception({
        name: 'perception.summarizeSelection',
        params: {},
      })
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'parallelCoordinates.brushAxes',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterObservation?.selection?.activeSelectionKind, 'interval')
      assert.deepEqual(afterObservation?.selection?.activeSelectionFields, ['mpg', 'hp'])
      assert.equal(selectionSummary?.ok, true)
      assert.equal(selectionSummary?.result?.selectedCount, 2)
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'parallelCoordinates.brushAxes')
    } finally {
      widget.dispose()
    }
  })
})

test('selection primitive closes observe-act-verify for parallel-coordinate record selection', async () => {
  await withBrowserShim(async () => {
    const widget = createParallelCoordinatesWidget({
      sessionId: 'selection-parallel-record',
      spec: {
        data: {
          values: [
            { id: 1, name: 'Car A', mpg: 18, hp: 130, wt: 3500 },
            { id: 2, name: 'Car B', mpg: 22, hp: 95, wt: 2800 },
          ],
        },
        transform: [
          {
            fold: ['mpg', 'hp', 'wt'],
            as: ['dimension', 'value'],
          },
        ],
        mark: 'line',
        encoding: {
          x: { field: 'dimension', type: 'nominal', scale: { domain: ['mpg', 'hp', 'wt'] } },
          y: { field: 'value', type: 'quantitative' },
          detail: { field: 'id', type: 'nominal' },
        },
      },
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'parallelCoordinates.selectRecord')

      assert.equal(descriptor?.primitive, 'select')

      const actionResult = await widget.executeAction({
        name: 'parallelCoordinates.selectRecord',
        params: {
          recordId: 2,
        },
      })

      const afterObservation = widget.readObservation()
      const selectionSummary = await widget.queryPerception({
        name: 'perception.summarizeSelection',
        params: {},
      })
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'parallelCoordinates.selectRecord',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterObservation?.selection?.activeSelectionKind, 'category')
      assert.equal(afterObservation?.selection?.activeSelectionSummary, 'Record: Car B')
      assert.equal(selectionSummary?.ok, true)
      assert.equal(selectionSummary?.result?.selectedCount, 1)
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'parallelCoordinates.selectRecord')
    } finally {
      widget.dispose()
    }
  })
})

test('selection primitive closes observe-act-verify for Sankey aggregate-node selection', async () => {
  await withBrowserShim(async () => {
    const widget = createSankeyWidget({
      sessionId: 'selection-sankey-aggregate-node',
      spec: {
        data: {
          values: [],
        },
      },
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'sankey.selectAggregateNode')

      assert.equal(descriptor?.primitive, 'select')

      const actionResult = await widget.executeAction({
        name: 'sankey.selectAggregateNode',
        params: {
          aggregateName: 'collapsed:1:other',
        },
      })

      const afterObservation = widget.readObservation()
      const selectionSummary = await widget.queryPerception({
        name: 'perception.summarizeSelection',
        params: {},
      })
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'sankey.selectAggregateNode',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterObservation?.selection?.activeSelectionKind, 'category')
      assert.equal(afterObservation?.selection?.activeSelectionSummary, 'aggregateName: collapsed:1:other')
      assert.equal(selectionSummary?.ok, true)
      assert.equal(selectionSummary?.result?.summary, 'aggregateName: collapsed:1:other')
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'sankey.selectAggregateNode')
    } finally {
      widget.dispose()
    }
  })
})
