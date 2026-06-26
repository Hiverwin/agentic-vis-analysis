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

test('filter primitive closes observe-act-verify for bar categorical filtering', async () => {
  await withBrowserShim(async () => {
    const widget = createBarWidget({
      sessionId: 'filter-bar',
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
        { category: 'C', value: 3 },
        { category: 'A', value: 4 },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const filterDescriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'bar.filterCategories')
      const beforeVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })

      assert.equal(filterDescriptor?.primitive, 'filter')
      assert.deepEqual(filterDescriptor?.paramsSchema?.required, ['categories'])
      assert.equal(beforeVisibleRows?.result?.visibleCount, 4)

      const actionResult = await widget.executeAction({
        name: 'bar.filterCategories',
        params: {
          categories: ['A', 'C'],
          field: 'category',
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
      const verificationState = widget.readVerificationState()
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'bar.filterCategories',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 3)
      assert.deepEqual(
        afterVisibleRows?.result?.rows?.map((row) => row.category),
        ['A', 'C', 'A'],
      )
      assert.equal(verificationState?.checks?.filterApplied, true)
      assert.equal(verificationState?.transforms?.hasFilterTransform, true)
      assert.equal(Array.isArray(viewConfig?.result?.transforms), true)
      assert.equal(viewConfig?.result?.transforms?.[0]?.kind, 'filter')
      assert.deepEqual(viewConfig?.result?.transforms?.[0]?.spec?.predicates, [
        {
          field: 'category',
          op: 'in',
          value: ['A', 'C'],
        },
      ])
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'bar.filterCategories')
    } finally {
      widget.dispose()
    }
  })
})

test('filter primitive closes observe-act-verify for line series filtering', async () => {
  await withBrowserShim(async () => {
    const widget = createLineWidget({
      sessionId: 'filter-line',
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
        { x: 1, y: 7, series: 'C' },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const filterDescriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'line.filterLines')
      const beforeVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })

      assert.equal(filterDescriptor?.primitive, 'filter')
      assert.deepEqual(filterDescriptor?.paramsSchema?.required, ['linesToRemove'])
      assert.equal(beforeVisibleRows?.result?.visibleCount, 5)

      const actionResult = await widget.executeAction({
        name: 'line.filterLines',
        params: {
          linesToRemove: ['B'],
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
      const verificationState = widget.readVerificationState()
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'line.filterLines',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 3)
      assert.deepEqual(
        afterVisibleRows?.result?.rows?.map((row) => row.series),
        ['A', 'A', 'C'],
      )
      assert.equal(verificationState?.checks?.filterApplied, true)
      assert.equal(verificationState?.transforms?.hasFilterTransform, true)
      assert.equal(Array.isArray(viewConfig?.result?.transforms), true)
      assert.equal(viewConfig?.result?.transforms?.[0]?.kind, 'filter')
      assert.deepEqual(viewConfig?.result?.transforms?.[0]?.spec?.predicates, [
        {
          field: 'series',
          op: 'notIn',
          value: ['B'],
        },
      ])
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'line.filterLines')
    } finally {
      widget.dispose()
    }
  })
})

test('filter primitive closes observe-act-verify for bar subcategory filtering', async () => {
  await withBrowserShim(async () => {
    const widget = createBarWidget({
      sessionId: 'filter-bar-subcategories',
      spec: {
        mark: 'bar',
        encoding: {
          x: { field: 'category', type: 'nominal' },
          y: { field: 'value', type: 'quantitative' },
          color: {
            field: 'segment',
            type: 'nominal',
            scale: { domain: ['s1', 's2'] },
          },
        },
      },
      data: [
        { category: 'A', segment: 's1', value: 1 },
        { category: 'A', segment: 's2', value: 2 },
        { category: 'B', segment: 's1', value: 3 },
        { category: 'B', segment: 's2', value: 4 },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'bar.filterSubcategories')

      assert.equal(descriptor?.primitive, 'filter')

      const actionResult = await widget.executeAction({
        name: 'bar.filterSubcategories',
        params: {
          subcategoriesToRemove: ['s2'],
          subField: 'segment',
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
          actionName: 'bar.filterSubcategories',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 2)
      assert.deepEqual(afterVisibleRows?.result?.rows?.map((row) => row.segment), ['s1', 's1'])
      assert.deepEqual(widgetState?.rawSpec?.encoding?.color?.scale?.domain, ['s1'])
      assert.equal(verificationState?.checks?.filterApplied, true)
      assert.equal(viewConfig?.result?.transforms?.[0]?.kind, 'filter')
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'bar.filterSubcategories')
    } finally {
      widget.dispose()
    }
  })
})

test('filter primitive closes observe-act-verify for heatmap cell filtering', async () => {
  await withBrowserShim(async () => {
    const widget = createHeatmapWidget({
      sessionId: 'filter-heatmap-cell',
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
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'heatmap.filterCells')

      assert.equal(descriptor?.primitive, 'filter')

      const actionResult = await widget.executeAction({
        name: 'heatmap.filterCells',
        params: {
          xField: 'Origin',
          yField: 'Cylinders',
          xValue: 'Japan',
          yValue: '4',
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
      const verificationState = widget.readVerificationState()
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'heatmap.filterCells',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 1)
      assert.deepEqual(afterVisibleRows?.result?.rows, [
        { Origin: 'Japan', Cylinders: '4', Horsepower: 95 },
      ])
      assert.equal(verificationState?.checks?.filterApplied, true)
      assert.deepEqual(
        viewConfig?.result?.transforms?.map((transform) => transform.kind),
        ['filter', 'filter'],
      )
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'heatmap.filterCells')
    } finally {
      widget.dispose()
    }
  })
})

test('filter primitive closes observe-act-verify for heatmap region filtering', async () => {
  await withBrowserShim(async () => {
    const widget = createHeatmapWidget({
      sessionId: 'filter-heatmap-region',
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
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'heatmap.filterCellsByRegion')

      assert.equal(descriptor?.primitive, 'filter')

      const actionResult = await widget.executeAction({
        name: 'heatmap.filterCellsByRegion',
        params: {
          xValues: ['Japan'],
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
      const verificationState = widget.readVerificationState()
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'heatmap.filterCellsByRegion',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 2)
      assert.deepEqual(afterVisibleRows?.result?.rows?.map((row) => row.Origin), ['USA', 'Europe'])
      assert.equal(verificationState?.checks?.filterApplied, true)
      assert.equal(viewConfig?.result?.transforms?.[0]?.kind, 'filter')
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'heatmap.filterCellsByRegion')
    } finally {
      widget.dispose()
    }
  })
})

test('filter primitive closes observe-act-verify for parallel-coordinate dimension corridors', async () => {
  await withBrowserShim(async () => {
    const widget = createParallelCoordinatesWidget({
      sessionId: 'filter-parallel-dimension',
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
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'parallelCoordinates.filterDimension')

      assert.equal(descriptor?.primitive, 'filter')

      const actionResult = await widget.executeAction({
        name: 'parallelCoordinates.filterDimension',
        params: {
          dimension: 'mpg',
          range: [20, 35],
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
      const verificationState = widget.readVerificationState()
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'parallelCoordinates.filterDimension',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 2)
      assert.deepEqual(afterVisibleRows?.result?.rows?.map((row) => row.id), [2, 3])
      assert.equal(verificationState?.checks?.filterApplied, true)
      assert.equal(viewConfig?.result?.transforms?.[0]?.kind, 'filter')
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'parallelCoordinates.filterDimension')
    } finally {
      widget.dispose()
    }
  })
})

test('filter primitive closes observe-act-verify for parallel-coordinate category exclusion', async () => {
  await withBrowserShim(async () => {
    const widget = createParallelCoordinatesWidget({
      sessionId: 'filter-parallel-category',
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
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'parallelCoordinates.filterByCategory')

      assert.equal(descriptor?.primitive, 'filter')

      const actionResult = await widget.executeAction({
        name: 'parallelCoordinates.filterByCategory',
        params: {
          field: 'Origin',
          values: ['USA'],
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
      const verificationState = widget.readVerificationState()
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'parallelCoordinates.filterByCategory',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 2)
      assert.deepEqual(afterVisibleRows?.result?.rows?.map((row) => row.Origin), ['Japan', 'Europe'])
      assert.equal(verificationState?.checks?.filterApplied, true)
      assert.equal(viewConfig?.result?.transforms?.[0]?.kind, 'filter')
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'parallelCoordinates.filterByCategory')
    } finally {
      widget.dispose()
    }
  })
})

test('filter primitive closes observe-act-verify for Sankey flow thresholding', async () => {
  await withBrowserShim(async () => {
    const widget = createSankeyWidget({
      sessionId: 'filter-sankey-flow',
      spec: {
        signals: [
          {
            name: 'threshold',
            value: 0,
            bind: { input: 'range', min: 0, max: 10, step: 1 },
          },
        ],
        data: [
          {
            name: 'rawLinks',
            values: [
              { source: 'A', target: 'B', value: 12 },
              { source: 'A', target: 'C', value: 3 },
              { source: 'B', target: 'D', value: 18 },
            ],
          },
          {
            name: 'nodeConfig',
            values: [
              { name: 'A', depth: 0, order: 0 },
              { name: 'B', depth: 1, order: 0 },
              { name: 'C', depth: 1, order: 1 },
              { name: 'D', depth: 2, order: 0 },
            ],
          },
        ],
      },
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'sankey.filterFlow')

      assert.equal(descriptor?.primitive, 'filter')

      const actionResult = await widget.executeAction({
        name: 'sankey.filterFlow',
        params: {
          minValue: 14,
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
          actionName: 'sankey.filterFlow',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(widgetState?.rawSpec?.signals?.[0]?.value, 14)
      assert.deepEqual(widgetState?.rawSpec?._sankey_filter_state, {
        mode: 'threshold',
        min_value: 14,
        source_action: 'sankey.filterFlow',
      })
      assert.equal(verificationState?.checks?.filterApplied, true)
      assert.equal(viewConfig?.result?.transforms?.[0]?.kind, 'filter')
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'sankey.filterFlow')
    } finally {
      widget.dispose()
    }
  })
})
