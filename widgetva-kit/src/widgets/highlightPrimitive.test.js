import test from 'node:test'
import assert from 'node:assert/strict'

import { createBarWidget, createHeatmapWidget, createLineWidget, createParallelCoordinatesWidget, createSankeyWidget } from './index.js'

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

test('highlight primitive closes observe-act-verify for bar top-N emphasis', async () => {
  await withBrowserShim(async () => {
    const widget = createBarWidget({
      sessionId: 'highlight-bar',
      spec: {
        mark: 'bar',
        encoding: {
          x: { field: 'category', type: 'nominal' },
          y: { field: 'value', type: 'quantitative' },
        },
      },
      data: [
        { category: 'A', value: 1 },
        { category: 'B', value: 5 },
        { category: 'C', value: 3 },
        { category: 'D', value: 2 },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const highlightDescriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'bar.highlightTopN')
      const beforeVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })

      assert.equal(highlightDescriptor?.primitive, 'highlight')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('highlight'), true)
      assert.deepEqual(highlightDescriptor?.paramsSchema?.required, ['n'])
      assert.equal(beforeVisibleRows?.result?.visibleCount, 4)

      const actionResult = await widget.executeAction({
        name: 'bar.highlightTopN',
        params: {
          n: 2,
          order: 'descending',
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
          actionName: 'bar.highlightTopN',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 4)
      assert.equal(typeof widgetState?.rawSpec?.encoding?.opacity?.condition?.test, 'string')
      assert.equal(verificationState?.checks?.highlightApplied, true)
      assert.deepEqual(verificationState?.view?.highlight?.channels, ['opacity'])
      assert.equal(verificationState?.view?.highlight?.entries?.[0]?.source, 'encoding')
      assert.equal(verificationState?.view?.highlight?.entries?.[0]?.channel, 'opacity')
      assert.deepEqual(viewConfig?.result?.view?.highlight?.channels, ['opacity'])
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'bar.highlightTopN')
    } finally {
      widget.dispose()
    }
  })
})

test('highlight primitive closes observe-act-verify for line stroke emphasis', async () => {
  await withBrowserShim(async () => {
    const widget = createLineWidget({
      sessionId: 'highlight-line',
      spec: {
        mark: 'line',
        encoding: {
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'y', type: 'quantitative' },
          color: { field: 'series', type: 'nominal' },
        },
      },
      data: [
        { x: 1, y: 2, series: 'A' },
        { x: 2, y: 3, series: 'A' },
        { x: 1, y: 5, series: 'B' },
        { x: 2, y: 6, series: 'B' },
        { x: 1, y: 4, series: 'C' },
        { x: 2, y: 4, series: 'C' },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const highlightDescriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'line.boldLines')
      const beforeVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })

      assert.equal(highlightDescriptor?.primitive, 'highlight')
      assert.deepEqual(highlightDescriptor?.paramsSchema?.required, ['lineNames'])
      assert.equal(beforeVisibleRows?.result?.visibleCount, 6)

      const actionResult = await widget.executeAction({
        name: 'line.boldLines',
        params: {
          lineNames: ['B'],
          lineField: 'series',
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
          actionName: 'line.boldLines',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 6)
      assert.equal(typeof widgetState?.rawSpec?.encoding?.strokeWidth?.condition?.test, 'string')
      assert.equal(verificationState?.checks?.highlightApplied, true)
      assert.deepEqual(verificationState?.view?.highlight?.channels, ['strokeWidth'])
      assert.equal(verificationState?.view?.highlight?.entries?.[0]?.source, 'encoding')
      assert.equal(verificationState?.view?.highlight?.entries?.[0]?.channel, 'strokeWidth')
      assert.deepEqual(viewConfig?.result?.view?.highlight?.channels, ['strokeWidth'])
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'line.boldLines')
    } finally {
      widget.dispose()
    }
  })
})

test('highlight primitive closes observe-act-verify for heatmap region emphasis', async () => {
  await withBrowserShim(async () => {
    const widget = createHeatmapWidget({
      sessionId: 'highlight-heatmap-region',
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
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'heatmap.highlightRegion')

      assert.equal(descriptor?.primitive, 'highlight')

      const actionResult = await widget.executeAction({
        name: 'heatmap.highlightRegion',
        params: {
          xValues: ['Japan', 'Europe'],
          yValues: ['4'],
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
          actionName: 'heatmap.highlightRegion',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 3)
      assert.equal(typeof widgetState?.rawSpec?.encoding?.opacity?.condition?.test, 'string')
      assert.equal(verificationState?.checks?.highlightApplied, true)
      assert.deepEqual(verificationState?.view?.highlight?.channels, ['opacity'])
      assert.equal(viewConfig?.result?.view?.highlight?.entries?.[0]?.channel, 'opacity')
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'heatmap.highlightRegion')
    } finally {
      widget.dispose()
    }
  })
})

test('highlight primitive closes observe-act-verify for heatmap threshold masking', async () => {
  await withBrowserShim(async () => {
    const widget = createHeatmapWidget({
      sessionId: 'highlight-heatmap-threshold',
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
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'heatmap.thresholdMask')

      assert.equal(descriptor?.primitive, 'highlight')

      const actionResult = await widget.executeAction({
        name: 'heatmap.thresholdMask',
        params: {
          minValue: 90,
          maxValue: 120,
          outsideOpacity: 0.08,
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
          actionName: 'heatmap.thresholdMask',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 3)
      assert.equal(widgetState?.rawSpec?.encoding?.opacity?.value, 0.08)
      assert.equal(verificationState?.checks?.highlightApplied, true)
      assert.deepEqual(verificationState?.view?.highlight?.channels, ['opacity'])
      assert.equal(viewConfig?.result?.view?.highlight?.entries?.[0]?.channel, 'opacity')
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'heatmap.thresholdMask')
    } finally {
      widget.dispose()
    }
  })
})

test('highlight primitive closes observe-act-verify for heatmap value-range emphasis', async () => {
  await withBrowserShim(async () => {
    const widget = createHeatmapWidget({
      sessionId: 'highlight-heatmap-value-range',
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
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'heatmap.highlightRegionByValue')

      assert.equal(descriptor?.primitive, 'highlight')

      const actionResult = await widget.executeAction({
        name: 'heatmap.highlightRegionByValue',
        params: {
          minValue: 90,
          maxValue: 120,
          outsideOpacity: 0.12,
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
          actionName: 'heatmap.highlightRegionByValue',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 3)
      assert.equal(widgetState?.rawSpec?.encoding?.opacity?.value, 0.12)
      assert.equal(verificationState?.checks?.highlightApplied, true)
      assert.deepEqual(verificationState?.view?.highlight?.channels, ['opacity'])
      assert.equal(viewConfig?.result?.view?.highlight?.entries?.[0]?.channel, 'opacity')
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'heatmap.highlightRegionByValue')
    } finally {
      widget.dispose()
    }
  })
})

test('highlight primitive closes observe-act-verify for parallel-coordinate category emphasis', async () => {
  await withBrowserShim(async () => {
    const widget = createParallelCoordinatesWidget({
      sessionId: 'highlight-parallel-category',
      spec: {
        data: {
          values: [
            { id: 1, Origin: 'USA', mpg: 18, hp: 130, wt: 3500 },
            { id: 2, Origin: 'Japan', mpg: 22, hp: 95, wt: 2800 },
            { id: 3, Origin: 'Europe', mpg: 30, hp: 70, wt: 2200 },
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
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'parallelCoordinates.highlightCategory')

      assert.equal(descriptor?.primitive, 'highlight')

      const actionResult = await widget.executeAction({
        name: 'parallelCoordinates.highlightCategory',
        params: {
          field: 'Origin',
          values: ['Japan'],
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
          actionName: 'parallelCoordinates.highlightCategory',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 3)
      assert.equal(typeof widgetState?.rawSpec?.encoding?.opacity?.condition?.test, 'string')
      assert.equal(verificationState?.checks?.highlightApplied, true)
      assert.deepEqual(verificationState?.view?.highlight?.channels, ['opacity'])
      assert.equal(viewConfig?.result?.view?.highlight?.entries?.[0]?.channel, 'opacity')
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'parallelCoordinates.highlightCategory')
    } finally {
      widget.dispose()
    }
  })
})

test('highlight primitive closes observe-act-verify for Sankey path emphasis', async () => {
  await withBrowserShim(async () => {
    const widget = createSankeyWidget({
      sessionId: 'highlight-sankey-path',
      spec: {
        data: [
          {
            name: 'rawLinks',
            values: [
              { source: 'A', target: 'B', value: 12 },
              { source: 'A', target: 'C', value: 3 },
              { source: 'B', target: 'D', value: 18 },
            ],
          },
        ],
        marks: [
          { name: 'edgeMark', type: 'path', encode: { update: {} } },
          { name: 'nodeRect', type: 'rect', encode: { update: {} } },
        ],
      },
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'sankey.highlightPath')

      assert.equal(descriptor?.primitive, 'highlight')

      const actionResult = await widget.executeAction({
        name: 'sankey.highlightPath',
        params: {
          path: ['A', 'B', 'D'],
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
          actionName: 'sankey.highlightPath',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(typeof widgetState?.rawSpec?.marks?.[0]?.encode?.update?.fillOpacity?.signal, 'string')
      assert.equal(typeof widgetState?.rawSpec?.marks?.[1]?.encode?.update?.strokeWidth?.signal, 'string')
      assert.equal(verificationState?.checks?.highlightApplied, true)
      assert.deepEqual(
        verificationState?.view?.highlight?.channels,
        ['fillOpacity', 'strokeOpacity', 'strokeWidth'],
      )
      assert.equal(viewConfig?.result?.view?.highlight?.entries?.length > 0, true)
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'sankey.highlightPath')
    } finally {
      widget.dispose()
    }
  })
})
