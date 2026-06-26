import test from 'node:test'
import assert from 'node:assert/strict'

import { createBarWidget, createParallelCoordinatesWidget } from './index.js'

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

test('sort primitive closes observe-act-verify for bar category sorting', async () => {
  await withBrowserShim(async () => {
    const widget = createBarWidget({
      sessionId: 'sort-bar',
      spec: {
        mark: 'bar',
        encoding: {
          x: { field: 'category', type: 'nominal' },
          y: { field: 'value', type: 'quantitative', aggregate: 'sum' },
        },
      },
      data: [
        { category: 'A', value: 2 },
        { category: 'B', value: 5 },
        { category: 'C', value: 3 },
        { category: 'A', value: 4 },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const sortDescriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'bar.sortBars')
      const beforeVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })

      assert.equal(sortDescriptor?.primitive, 'sort')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('sort'), true)
      assert.deepEqual(sortDescriptor?.paramsSchema?.required, ['channel', 'order'])
      assert.equal(beforeVisibleRows?.result?.visibleCount, 4)

      const actionResult = await widget.executeAction({
        name: 'bar.sortBars',
        params: {
          channel: 'x',
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
          actionName: 'bar.sortBars',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 4)
      assert.deepEqual(widgetState?.rawSpec?.encoding?.x?.sort, ['A', 'B', 'C'])
      assert.equal(verificationState?.checks?.sortApplied, true)
      assert.deepEqual(verificationState?.view?.sort, {
        channel: 'x',
        field: 'category',
        mode: 'explicitOrder',
        values: ['A', 'B', 'C'],
      })
      assert.deepEqual(viewConfig?.result?.view?.sort, {
        channel: 'x',
        field: 'category',
        mode: 'explicitOrder',
        values: ['A', 'B', 'C'],
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'bar.sortBars')
    } finally {
      widget.dispose()
    }
  })
})

test('categorical dimension reordering does not masquerade as zoom in verification state', async () => {
  await withBrowserShim(async () => {
    const widget = createParallelCoordinatesWidget({
      sessionId: 'reorder-parallel-verification',
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
      const actionResult = await widget.executeAction({
        name: 'parallelCoordinates.reorderDimensions',
        params: {
          dimensionOrder: ['wt', 'hp', 'mpg'],
        },
      })
      const verificationState = widget.readVerificationState()

      assert.equal(actionResult?.ok, true)
      assert.deepEqual(verificationState?.view?.xDomain, ['wt', 'hp', 'mpg'])
      assert.equal(verificationState?.checks?.zoomApplied, false)
    } finally {
      widget.dispose()
    }
  })
})
