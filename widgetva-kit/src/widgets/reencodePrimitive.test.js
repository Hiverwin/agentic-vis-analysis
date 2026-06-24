import test from 'node:test'
import assert from 'node:assert/strict'

import { createBarWidget, createHeatmapWidget, createParallelCoordinatesWidget, createSankeyWidget } from './index.js'

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

test('reencode primitive closes observe-act-verify for bar stack-mode toggling', async () => {
  await withBrowserShim(async () => {
    const widget = createBarWidget({
      sessionId: 'reencode-bar',
      spec: {
        mark: 'bar',
        encoding: {
          x: { field: 'category', type: 'nominal' },
          y: { field: 'value', type: 'quantitative', stack: 'zero' },
          color: { field: 'segment', type: 'nominal' },
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
      const reencodeDescriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'bar.toggleStackMode')
      const beforeVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })

      assert.equal(reencodeDescriptor?.primitive, 'reencode')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('reencode'), true)
      assert.deepEqual(reencodeDescriptor?.paramsSchema?.required, ['mode'])
      assert.equal(beforeVisibleRows?.result?.visibleCount, 4)

      const actionResult = await widget.executeAction({
        name: 'bar.toggleStackMode',
        params: {
          mode: 'grouped',
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
          actionName: 'bar.toggleStackMode',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 4)
      assert.equal(widgetState?.rawSpec?._stack_mode, 'grouped')
      assert.equal(widgetState?.rawSpec?.encoding?.xOffset?.field, 'segment')
      assert.equal(verificationState?.checks?.reencodeApplied, true)
      assert.deepEqual(verificationState?.view?.reencode, {
        mode: 'stackMode',
        layout: 'grouped',
        colorField: 'segment',
      })
      assert.deepEqual(viewConfig?.result?.view?.reencode, {
        mode: 'stackMode',
        layout: 'grouped',
        colorField: 'segment',
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'bar.toggleStackMode')
    } finally {
      widget.dispose()
    }
  })
})

test('reencode primitive closes observe-act-verify for heatmap color-scale updates', async () => {
  await withBrowserShim(async () => {
    const widget = createHeatmapWidget({
      sessionId: 'reencode-heatmap',
      spec: {
        mark: 'rect',
        encoding: {
          x: { field: 'x', type: 'nominal' },
          y: { field: 'y', type: 'nominal' },
          color: { field: 'value', type: 'quantitative', scale: { scheme: 'blues' } },
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
      const reencodeDescriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'heatmap.adjustColorScale')
      const beforeVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })

      assert.equal(reencodeDescriptor?.primitive, 'reencode')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('reencode'), true)
      assert.equal(beforeVisibleRows?.result?.visibleCount, 4)

      const actionResult = await widget.executeAction({
        name: 'heatmap.adjustColorScale',
        params: {
          scheme: 'reds',
          domain: [0, 5],
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
          actionName: 'heatmap.adjustColorScale',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 4)
      assert.equal(widgetState?.rawSpec?._color_scale_state?.scheme, 'reds')
      assert.deepEqual(widgetState?.rawSpec?.encoding?.color?.scale?.domain, [0, 5])
      assert.equal(verificationState?.checks?.reencodeApplied, true)
      assert.deepEqual(verificationState?.view?.reencode, {
        mode: 'colorScale',
        channel: 'color',
        scheme: 'reds',
        domain: [0, 5],
      })
      assert.deepEqual(viewConfig?.result?.view?.reencode, {
        mode: 'colorScale',
        channel: 'color',
        scheme: 'reds',
        domain: [0, 5],
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'heatmap.adjustColorScale')
    } finally {
      widget.dispose()
    }
  })
})

test('reencode primitive closes observe-act-verify for parallel-coordinate dimension visibility changes', async () => {
  await withBrowserShim(async () => {
    const widget = createParallelCoordinatesWidget({
      sessionId: 'reencode-parallel-hide',
      spec: {
        data: {
          values: [
            { id: 1, mpg: 18, hp: 130, wt: 3500 },
            { id: 2, mpg: 22, hp: 95, wt: 2800 },
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
          x: {
            field: 'dimension',
            type: 'nominal',
            scale: { domain: ['mpg', 'hp', 'wt'] },
          },
          y: { field: 'value', type: 'quantitative' },
          detail: { field: 'id', type: 'nominal' },
        },
      },
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'parallelCoordinates.hideDimensions')

      assert.equal(descriptor?.primitive, 'reencode')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('reencode'), true)

      const actionResult = await widget.executeAction({
        name: 'parallelCoordinates.hideDimensions',
        params: {
          dimensions: ['hp'],
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
          actionName: 'parallelCoordinates.hideDimensions',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.deepEqual(widgetState?.rawSpec?.transform?.[0]?.fold, ['mpg', 'wt'])
      assert.deepEqual(widgetState?.rawSpec?._pc_reencode_state, {
        mode: 'dimensionVisibility',
        sourceAction: 'parallelCoordinates.hideDimensions',
        operation: 'hide',
        hidden_dimensions: ['hp'],
        visible_dimensions: ['mpg', 'wt'],
      })
      assert.equal(verificationState?.checks?.reencodeApplied, true)
      assert.deepEqual(verificationState?.view?.reencode, {
        mode: 'dimensionVisibility',
        sourceAction: 'parallelCoordinates.hideDimensions',
        operation: 'hide',
        hiddenDimensions: ['hp'],
        visibleDimensions: ['mpg', 'wt'],
      })
      assert.deepEqual(viewConfig?.result?.view?.reencode, {
        mode: 'dimensionVisibility',
        sourceAction: 'parallelCoordinates.hideDimensions',
        operation: 'hide',
        hiddenDimensions: ['hp'],
        visibleDimensions: ['mpg', 'wt'],
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'parallelCoordinates.hideDimensions')
    } finally {
      widget.dispose()
    }
  })
})

test('reencode primitive closes observe-act-verify for Sankey flow recoloring', async () => {
  await withBrowserShim(async () => {
    const widget = createSankeyWidget({
      sessionId: 'reencode-sankey-color',
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
        marks: [
          { name: 'edgeMark', type: 'path', encode: { update: {} } },
        ],
      },
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'sankey.colorFlows')

      assert.equal(descriptor?.primitive, 'reencode')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('reencode'), true)

      const actionResult = await widget.executeAction({
        name: 'sankey.colorFlows',
        params: {
          nodes: ['A'],
          color: '#ff0000',
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
          actionName: 'sankey.colorFlows',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.deepEqual(widgetState?.rawSpec?._sankey_reencode_state, {
        mode: 'colorFlows',
        nodes: ['A'],
        color: '#ff0000',
      })
      assert.equal(verificationState?.checks?.reencodeApplied, true)
      assert.deepEqual(verificationState?.view?.reencode, {
        mode: 'colorFlows',
        nodes: ['A'],
        color: '#ff0000',
      })
      assert.deepEqual(viewConfig?.result?.view?.reencode, {
        mode: 'colorFlows',
        nodes: ['A'],
        color: '#ff0000',
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'sankey.colorFlows')
    } finally {
      widget.dispose()
    }
  })
})

test('reencode primitive closes observe-act-verify for stacked-bar expansion', async () => {
  await withBrowserShim(async () => {
    const widget = createBarWidget({
      sessionId: 'reencode-bar-expand-stack',
      spec: {
        mark: 'bar',
        encoding: {
          x: { field: 'region', type: 'nominal' },
          y: { field: 'value', type: 'quantitative', stack: 'zero' },
          color: {
            field: 'segment',
            type: 'nominal',
            scale: { domain: ['s1', 's2'] },
          },
        },
      },
      data: [
        { region: 'East', segment: 's1', value: 10 },
        { region: 'East', segment: 's2', value: 20 },
        { region: 'West', segment: 's1', value: 15 },
        { region: 'West', segment: 's2', value: 25 },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'bar.expandStack')

      assert.equal(descriptor?.primitive, 'reencode')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('reencode'), true)

      const actionResult = await widget.executeAction({
        name: 'bar.expandStack',
        params: {
          category: 'East',
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
          actionName: 'bar.expandStack',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.deepEqual(widgetState?.rawSpec?._bar_expand_stack_state, {
        category: 'East',
        category_field: 'region',
        group_field: 'segment',
      })
      assert.equal(verificationState?.checks?.reencodeApplied, true)
      assert.deepEqual(verificationState?.view?.reencode, {
        mode: 'expandStack',
        category: 'East',
        categoryField: 'region',
        groupField: 'segment',
      })
      assert.deepEqual(viewConfig?.result?.view?.reencode, {
        mode: 'expandStack',
        category: 'East',
        categoryField: 'region',
        groupField: 'segment',
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'bar.expandStack')
    } finally {
      widget.dispose()
    }
  })
})

test('reencode primitive closes observe-act-verify for resetting hidden parallel-coordinate dimensions', async () => {
  await withBrowserShim(async () => {
    const widget = createParallelCoordinatesWidget({
      sessionId: 'reencode-parallel-reset-hidden',
      spec: {
        data: {
          values: [
            { id: 1, mpg: 18, hp: 130, wt: 3500 },
            { id: 2, mpg: 22, hp: 95, wt: 2800 },
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
          x: {
            field: 'dimension',
            type: 'nominal',
            scale: { domain: ['mpg', 'hp', 'wt'] },
          },
          y: { field: 'value', type: 'quantitative' },
          detail: { field: 'id', type: 'nominal' },
        },
      },
    })

    try {
      await widget.executeAction({
        name: 'parallelCoordinates.hideDimensions',
        params: {
          dimensions: ['hp'],
        },
      })

      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'parallelCoordinates.resetHiddenDimensions')

      assert.equal(descriptor?.primitive, 'reencode')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('reencode'), true)

      const actionResult = await widget.executeAction({
        name: 'parallelCoordinates.resetHiddenDimensions',
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
          actionName: 'parallelCoordinates.resetHiddenDimensions',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(widgetState?.rawSpec?._pc_hidden_state, undefined)
      assert.deepEqual(widgetState?.rawSpec?._pc_reencode_state, {
        mode: 'dimensionVisibility',
        sourceAction: 'parallelCoordinates.resetHiddenDimensions',
        operation: 'reset',
        hidden_dimensions: [],
        visible_dimensions: ['mpg', 'hp', 'wt'],
      })
      assert.equal(verificationState?.checks?.reencodeApplied, true)
      assert.deepEqual(verificationState?.view?.reencode, {
        mode: 'dimensionVisibility',
        sourceAction: 'parallelCoordinates.resetHiddenDimensions',
        operation: 'reset',
        hiddenDimensions: [],
        visibleDimensions: ['mpg', 'hp', 'wt'],
      })
      assert.deepEqual(viewConfig?.result?.view?.reencode, {
        mode: 'dimensionVisibility',
        sourceAction: 'parallelCoordinates.resetHiddenDimensions',
        operation: 'reset',
        hiddenDimensions: [],
        visibleDimensions: ['mpg', 'hp', 'wt'],
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'parallelCoordinates.resetHiddenDimensions')
    } finally {
      widget.dispose()
    }
  })
})

test('reencode primitive closes observe-act-verify for heatmap transposition', async () => {
  await withBrowserShim(async () => {
    const widget = createHeatmapWidget({
      sessionId: 'reencode-heatmap-transpose',
      spec: {
        width: 320,
        height: 180,
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
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'heatmap.transpose')

      assert.equal(descriptor?.primitive, 'reencode')

      const actionResult = await widget.executeAction({
        name: 'heatmap.transpose',
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
          actionName: 'heatmap.transpose',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(widgetState?.rawSpec?._transpose_state?.transposed, true)
      assert.equal(widgetState?.rawSpec?.encoding?.x?.field, 'Cylinders')
      assert.equal(widgetState?.rawSpec?.encoding?.y?.field, 'Origin')
      assert.equal(verificationState?.checks?.reencodeApplied, true)
      assert.deepEqual(verificationState?.view?.reencode, {
        mode: 'transpose',
        transposed: true,
      })
      assert.deepEqual(viewConfig?.result?.view?.reencode, {
        mode: 'transpose',
        transposed: true,
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'heatmap.transpose')
    } finally {
      widget.dispose()
    }
  })
})

test('reencode primitive closes observe-act-verify for Sankey layer reordering', async () => {
  await withBrowserShim(async () => {
    const widget = createSankeyWidget({
      sessionId: 'reencode-sankey-reorder-layer',
      spec: {
        data: [
          {
            name: 'rawLinks',
            values: [
              { source: 'A', target: 'C', value: 4 },
              { source: 'B', target: 'C', value: 6 },
            ],
          },
          {
            name: 'nodeConfig',
            values: [
              { name: 'A', depth: 0, order: 0 },
              { name: 'B', depth: 0, order: 1 },
              { name: 'C', depth: 1, order: 0 },
            ],
          },
        ],
      },
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'sankey.reorderNodesInLayer')

      assert.equal(descriptor?.primitive, 'reencode')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('reencode'), true)

      const actionResult = await widget.executeAction({
        name: 'sankey.reorderNodesInLayer',
        params: {
          depth: 0,
          order: ['B', 'A'],
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
          actionName: 'sankey.reorderNodesInLayer',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.deepEqual(widgetState?.rawSpec?._sankey_reencode_state, {
        mode: 'reorderNodesInLayer',
        depth: 0,
        order: ['B', 'A'],
      })
      assert.equal(verificationState?.checks?.reencodeApplied, true)
      assert.deepEqual(verificationState?.view?.reencode, {
        mode: 'reorderNodesInLayer',
        depth: 0,
        order: ['B', 'A'],
      })
      assert.deepEqual(viewConfig?.result?.view?.reencode, {
        mode: 'reorderNodesInLayer',
        depth: 0,
        order: ['B', 'A'],
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'sankey.reorderNodesInLayer')
    } finally {
      widget.dispose()
    }
  })
})
