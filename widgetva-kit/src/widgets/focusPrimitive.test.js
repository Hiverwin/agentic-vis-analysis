import test from 'node:test'
import assert from 'node:assert/strict'

import { createLineWidget, createSankeyWidget } from './index.js'

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

test('focus primitive closes observe-act-verify for line series focus', async () => {
  await withBrowserShim(async () => {
    const widget = createLineWidget({
      sessionId: 'focus-line',
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
      ],
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'line.focusLines')

      assert.equal(descriptor?.primitive, 'focus')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('focus'), true)

      const actionResult = await widget.executeAction({
        name: 'line.focusLines',
        params: {
          lines: ['A'],
          lineField: 'series',
          dimOpacity: 0.08,
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
          actionName: 'line.focusLines',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.deepEqual(widgetState?.rawSpec?._line_focus_state?.lines, ['A'])
      assert.equal(verificationState?.checks?.focusApplied, true)
      assert.deepEqual(verificationState?.view?.focusKeys, {
        focusedSeries: ['A'],
      })
      assert.deepEqual(viewConfig?.result?.view?.focusKeys, {
        focusedSeries: ['A'],
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'line.focusLines')
    } finally {
      widget.dispose()
    }
  })
})

test('focus primitive closes observe-act-verify for Sankey node tracing', async () => {
  await withBrowserShim(async () => {
    const widget = createSankeyWidget({
      sessionId: 'focus-sankey',
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
        marks: [
          { name: 'edgeMark', type: 'path', encode: { update: {} } },
          { name: 'nodeRect', type: 'rect', encode: { update: {} } },
        ],
        signals: [{ name: 'selectedNode', value: null }],
      },
    })

    try {
      const beforeObservation = widget.readObservation()
      const descriptor = findDescriptor(beforeObservation?.actionDescriptors || [], 'sankey.traceNode')

      assert.equal(descriptor?.primitive, 'focus')
      assert.equal(beforeObservation?.verification?.contract?.supportedEffectTypes.includes('focus'), true)

      const actionResult = await widget.executeAction({
        name: 'sankey.traceNode',
        params: {
          nodeName: 'A',
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
          actionName: 'sankey.traceNode',
          stateId: actionResult?.stateId || null,
          refs: actionResult?.updatedRefs || [],
        },
      })

      assert.equal(actionResult?.ok, true)
      assert.equal(widgetState?.rawSpec?._sankey_focus_state?.node_name, 'A')
      assert.equal(verificationState?.checks?.focusApplied, true)
      assert.deepEqual(verificationState?.view?.focusKeys, {
        focusedNode: 'A',
      })
      assert.deepEqual(viewConfig?.result?.view?.focusKeys, {
        focusedNode: 'A',
      })
      assert.equal(effectVerification?.ok, true)
      assert.equal(effectVerification?.result?.verified, true)
      assert.equal(effectVerification?.result?.matchedActionName, 'sankey.traceNode')
    } finally {
      widget.dispose()
    }
  })
})
