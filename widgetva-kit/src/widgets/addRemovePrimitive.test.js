import test from 'node:test'
import assert from 'node:assert/strict'

import { createBarWidget } from './index.js'

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

test('addRemove primitive closes observe-act-verify for removing bars from view', async () => {
  await withBrowserShim(async () => {
    const widget = createBarWidget({
      sessionId: 'addremove-bar-remove',
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
        { category: 'D', value: 4 },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'bar.removeBars')
      const beforeVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })

      assert.equal(descriptor?.primitive, 'addRemove')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('addRemove'), true)
      assert.equal(beforeVisibleRows?.result?.visibleCount, 4)

      const actionResult = await widget.executeAction({
        name: 'bar.removeBars',
        params: {
          values: ['B', 'D'],
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
      const widgetState = widget.readState()
      const verificationState = widget.readVerificationState()
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'bar.removeBars',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 2)
      assert.deepEqual(afterVisibleRows?.result?.rows?.map((row) => row.category), ['A', 'C'])
      assert.deepEqual(widgetState?.rawSpec?._bar_visibility_state?.visible_x, ['A', 'C'])
      assert.equal(verificationState?.checks?.addRemoveApplied, true)
      assert.deepEqual(verificationState?.view?.addRemove, {
        mode: 'categoryVisibility',
        operation: 'remove',
        field: 'category',
        visibleValues: ['A', 'C'],
      })
      assert.deepEqual(viewConfig?.result?.view?.addRemove, {
        mode: 'categoryVisibility',
        operation: 'remove',
        field: 'category',
        visibleValues: ['A', 'C'],
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'bar.removeBars')
    } finally {
      widget.dispose()
    }
  })
})

test('addRemove primitive closes observe-act-verify for adding bars back into view', async () => {
  await withBrowserShim(async () => {
    const widget = createBarWidget({
      sessionId: 'addremove-bar-add',
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
        { category: 'D', value: 4 },
      ],
    })

    try {
      await widget.executeAction({
        name: 'bar.removeBars',
        params: {
          values: ['D'],
          field: 'category',
        },
      })

      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'bar.addBars')
      const beforeVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })

      assert.equal(descriptor?.primitive, 'addRemove')
      assert.equal(beforeVisibleRows?.result?.visibleCount, 3)

      const actionResult = await widget.executeAction({
        name: 'bar.addBars',
        params: {
          values: ['D'],
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
      const widgetState = widget.readState()
      const verificationState = widget.readVerificationState()
      const effectVerification = await widget.queryPerception({
        name: 'perception.verifyActionEffect',
        params: {
          actionName: 'bar.addBars',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 4)
      assert.deepEqual(widgetState?.rawSpec?._bar_visibility_state?.visible_x, ['A', 'B', 'C', 'D'])
      assert.equal(verificationState?.checks?.addRemoveApplied, true)
      assert.deepEqual(verificationState?.view?.addRemove, {
        mode: 'categoryVisibility',
        operation: 'add',
        field: 'category',
        visibleValues: ['A', 'B', 'C', 'D'],
      })
      assert.deepEqual(viewConfig?.result?.view?.addRemove, {
        mode: 'categoryVisibility',
        operation: 'add',
        field: 'category',
        visibleValues: ['A', 'B', 'C', 'D'],
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'bar.addBars')
    } finally {
      widget.dispose()
    }
  })
})

test('addRemove primitive closes observe-act-verify for adding grouped bar items back into view', async () => {
  await withBrowserShim(async () => {
    const widget = createBarWidget({
      sessionId: 'addremove-bar-items-add',
      spec: {
        mark: 'bar',
        encoding: {
          x: { field: 'category', type: 'nominal' },
          y: { field: 'value', type: 'quantitative' },
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
      await widget.executeAction({
        name: 'bar.removeBarItems',
        params: {
          items: [{ x: 'A', sub: 's2' }],
        },
      })

      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'bar.addBarItems')

      assert.equal(descriptor?.primitive, 'addRemove')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('addRemove'), true)

      const actionResult = await widget.executeAction({
        name: 'bar.addBarItems',
        params: {
          items: [{ x: 'A', sub: 's2' }],
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
          actionName: 'bar.addBarItems',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(widgetState?.rawSpec?._bar_visibility_state?.last_operation, 'add')
      assert.equal(verificationState?.checks?.addRemoveApplied, true)
      assert.deepEqual(verificationState?.view?.addRemove, {
        mode: 'itemVisibility',
        operation: 'add',
        xField: 'category',
        subField: 'segment',
        visibleItems: [['A', 's1'], ['A', 's2'], ['B', 's1'], ['B', 's2']],
      })
      assert.deepEqual(viewConfig?.result?.view?.addRemove, {
        mode: 'itemVisibility',
        operation: 'add',
        xField: 'category',
        subField: 'segment',
        visibleItems: [['A', 's1'], ['A', 's2'], ['B', 's1'], ['B', 's2']],
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'bar.addBarItems')
    } finally {
      widget.dispose()
    }
  })
})

test('addRemove primitive closes observe-act-verify for removing grouped bar items from view', async () => {
  await withBrowserShim(async () => {
    const widget = createBarWidget({
      sessionId: 'addremove-bar-items-remove',
      spec: {
        mark: 'bar',
        encoding: {
          x: { field: 'category', type: 'nominal' },
          y: { field: 'value', type: 'quantitative' },
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
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'bar.removeBarItems')

      assert.equal(descriptor?.primitive, 'addRemove')

      const actionResult = await widget.executeAction({
        name: 'bar.removeBarItems',
        params: {
          items: [{ x: 'A', sub: 's2' }],
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
          actionName: 'bar.removeBarItems',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(widgetState?.rawSpec?._bar_visibility_state?.last_operation, 'remove')
      assert.equal(verificationState?.checks?.addRemoveApplied, true)
      assert.deepEqual(verificationState?.view?.addRemove, {
        mode: 'itemVisibility',
        operation: 'remove',
        xField: 'category',
        subField: 'segment',
        visibleItems: [['A', 's1'], ['B', 's1'], ['B', 's2']],
      })
      assert.deepEqual(viewConfig?.result?.view?.addRemove, {
        mode: 'itemVisibility',
        operation: 'remove',
        xField: 'category',
        subField: 'segment',
        visibleItems: [['A', 's1'], ['B', 's1'], ['B', 's2']],
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'bar.removeBarItems')
    } finally {
      widget.dispose()
    }
  })
})
