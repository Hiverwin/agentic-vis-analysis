import test from 'node:test'
import assert from 'node:assert/strict'

import { createLineWidget, createScatterWidget } from './index.js'

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

test('zoom primitive closes observe-act-verify for scatter domain zoom', async () => {
  await withBrowserShim(async () => {
    const widget = createScatterWidget({
      sessionId: 'zoom-scatter',
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
        { x: 5, y: 7 },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const zoomDescriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'scatter.zoomDomain')
      const beforeVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })

      assert.equal(zoomDescriptor?.primitive, 'zoom')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('zoom'), true)
      assert.equal(beforeVisibleRows?.result?.visibleCount, 3)

      const actionResult = await widget.executeAction({
        name: 'scatter.zoomDomain',
        params: {
          xDomain: [0, 3],
          yDomain: [0, 4],
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
          actionName: 'scatter.zoomDomain',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 3)
      assert.equal(verificationState?.checks?.zoomApplied, true)
      assert.deepEqual(verificationState?.view?.xDomain, [0, 3])
      assert.deepEqual(verificationState?.view?.yDomain, [0, 4])
      assert.equal(verificationState?.view?.hasZoom, true)
      assert.deepEqual(viewConfig?.result?.view?.xDomain, [0, 3])
      assert.deepEqual(viewConfig?.result?.view?.yDomain, [0, 4])
      assert.deepEqual(viewConfig?.result?.encodings?.x?.scale?.domain, [0, 3])
      assert.deepEqual(viewConfig?.result?.encodings?.y?.scale?.domain, [0, 4])
      assert.deepEqual(widgetState?.rawSpec?.mark, { type: 'point', clip: true })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'scatter.zoomDomain')
    } finally {
      widget.dispose()
    }
  })
})

test('zoom primitive closes observe-act-verify for line x-domain zoom', async () => {
  await withBrowserShim(async () => {
    const widget = createLineWidget({
      sessionId: 'zoom-line',
      spec: {
        mark: 'line',
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'series', type: 'nominal' },
        },
      },
      data: [
        { date: '2024-01-01', value: 2, series: 'A' },
        { date: '2024-01-02', value: 3, series: 'A' },
        { date: '2024-01-03', value: 5, series: 'B' },
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const zoomDescriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'line.zoomXRegion')
      const beforeVisibleRows = await widget.queryPerception({
        name: 'perception.inspectVisibleRows',
        params: {},
      })

      assert.equal(zoomDescriptor?.primitive, 'zoom')
      assert.deepEqual(zoomDescriptor?.paramsSchema?.required, ['start', 'end'])
      assert.equal(beforeVisibleRows?.result?.visibleCount, 3)

      const actionResult = await widget.executeAction({
        name: 'line.zoomXRegion',
        params: {
          start: '2024-01-01',
          end: '2024-01-02',
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
          actionName: 'line.zoomXRegion',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(afterVisibleRows?.result?.visibleCount, 3)
      assert.equal(verificationState?.checks?.zoomApplied, true)
      assert.deepEqual(verificationState?.view?.xDomain, ['2024-01-01', '2024-01-02'])
      assert.equal(verificationState?.view?.hasXDomainOverride, true)
      assert.deepEqual(viewConfig?.result?.view?.xDomain, ['2024-01-01', '2024-01-02'])
      assert.deepEqual(viewConfig?.result?.encodings?.x?.scale?.domain, ['2024-01-01', '2024-01-02'])
      assert.deepEqual(widgetState?.rawSpec?.mark, { type: 'line', clip: true })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'line.zoomXRegion')
    } finally {
      widget.dispose()
    }
  })
})
