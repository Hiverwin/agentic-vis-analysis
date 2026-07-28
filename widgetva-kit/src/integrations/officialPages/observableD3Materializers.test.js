import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createObservableScatterSurfaceWrapper,
  createObservableScatterMatrixSurfaceWrapper,
} from './observableD3Materializers.js'

function createFakeMessageRoot() {
  const listeners = new Set()
  return {
    addEventListener(type, listener) {
      if (type === 'message' && typeof listener === 'function') listeners.add(listener)
    },
    removeEventListener(type, listener) {
      if (type === 'message') listeners.delete(listener)
    },
    dispatchMessage(data) {
      for (const listener of [...listeners]) {
        listener({ data })
      }
    },
  }
}

test('scatter matrix wrapper materializes runtime interval selection channels through native D3 brush', async () => {
  const previousWindow = globalThis.window
  const messageRoot = createFakeMessageRoot()
  globalThis.window = messageRoot
  const calls = []
  const host = {
    postMessage(message) {
      calls.push(message)
      queueMicrotask(() => {
        messageRoot.dispatchMessage({
          source: 'widgetva-observable-d3-worker',
          type: 'widgetva:observable-d3-worker-response',
          id: message.id,
          ok: true,
          result: { applied: true },
        })
      })
    },
  }

  try {
    const widgetRef = 'wl://widgetva-app/workspace/matrix/widget/cell_mpg_hp'
    const pageCellRef = 'wl://observable-d3/scatter-matrix/cell/mpg-hp'
    const wrapper = createObservableScatterMatrixSurfaceWrapper({
      frame: host,
      cellRefByWidgetRef: {
        [widgetRef]: pageCellRef,
      },
      nativeBrushBindings: [{
        bindingId: 'native_brush_1',
        targetRef: pageCellRef,
      }],
    })

    await wrapper.renderFromState({
      ref: widgetRef,
      selections: {
        [`${widgetRef}/selection/brush`]: {
          kind: 'interval',
          sourceWidgetRef: widgetRef,
          channels: {
            x: { field: 'mpg', domain: [10, 20] },
            y: { field: 'hp', domain: [50, 150] },
          },
        },
      },
    })

    assert.equal(calls.length, 1)
    assert.equal(calls[0]?.method, 'applyNativeBrushRegion')
    assert.deepEqual(calls[0]?.params, {
      bindingId: 'native_brush_1',
      targetRef: pageCellRef,
      xDomain: [10, 20],
      yDomain: [50, 150],
    })
  } finally {
    globalThis.window = previousWindow
  }
})

test('scatter matrix wrapper rejects brush materialization without a native D3 brush binding', async () => {
  const previousWindow = globalThis.window
  const messageRoot = createFakeMessageRoot()
  globalThis.window = messageRoot
  const host = {
    postMessage() {
      throw new Error('should not post simulated brush RPC')
    },
  }

  try {
    const widgetRef = 'wl://widgetva-app/workspace/matrix/widget/cell_mpg_hp'
    const pageCellRef = 'wl://observable-d3/scatter-matrix/cell/mpg-hp'
    const wrapper = createObservableScatterMatrixSurfaceWrapper({
      frame: host,
      cellRefByWidgetRef: {
        [widgetRef]: pageCellRef,
      },
      nativeBrushBindings: [],
    })

    await assert.rejects(
      () => wrapper.renderFromState({
        ref: widgetRef,
        selections: {
          [`${widgetRef}/selection/brush`]: {
            kind: 'interval',
            sourceWidgetRef: widgetRef,
            channels: {
              x: { field: 'mpg', domain: [10, 20] },
              y: { field: 'hp', domain: [50, 150] },
            },
          },
        },
      }),
      /does not expose a native brush binding/,
    )
  } finally {
    globalThis.window = previousWindow
  }
})

test('scatter wrapper materializes interval selection through native D3 brush', async () => {
  const previousWindow = globalThis.window
  const messageRoot = createFakeMessageRoot()
  globalThis.window = messageRoot
  const calls = []
  const host = {
    postMessage(message) {
      calls.push(message)
      queueMicrotask(() => {
        messageRoot.dispatchMessage({
          source: 'widgetva-observable-d3-worker',
          type: 'widgetva:observable-d3-worker-response',
          id: message.id,
          ok: true,
          result: { applied: true },
        })
      })
    },
  }

  try {
    const wrapper = createObservableScatterSurfaceWrapper({
      frame: host,
      nativeBrushBindings: [{
        bindingId: 'native_scatter_brush',
        targetRef: 'wl://observable-d3/scatter/primary',
      }],
    })

    await wrapper.renderFromState({
      ref: 'wl://widgetva-app/workspace/scatter/widget/primary',
      selections: {
        localBrush: {
          kind: 'interval',
          channels: {
            x: { field: 'mpg', domain: [10, 20] },
            y: { field: 'hp', domain: [50, 150] },
          },
        },
      },
    })

    assert.equal(calls.length, 1)
    assert.equal(calls[0]?.method, 'applyNativeBrushRegion')
    assert.deepEqual(calls[0]?.params, {
      bindingId: 'native_scatter_brush',
      targetRef: 'wl://observable-d3/scatter/primary',
      xDomain: [10, 20],
      yDomain: [50, 150],
    })
  } finally {
    globalThis.window = previousWindow
  }
})

test('scatter wrapper does not call simulated selection RPC without native D3 brush binding', async () => {
  const previousWindow = globalThis.window
  const messageRoot = createFakeMessageRoot()
  globalThis.window = messageRoot
  const host = {
    postMessage(message) {
      throw new Error(`unexpected ${message.method}`)
    },
  }

  try {
    const wrapper = createObservableScatterSurfaceWrapper({
      frame: host,
      nativeBrushBindings: [],
    })

    await wrapper.renderFromState({
      ref: 'wl://widgetva-app/workspace/scatter/widget/primary',
      selections: {},
      view: {},
    })

    await assert.rejects(
      () => wrapper.renderFromState({
        ref: 'wl://widgetva-app/workspace/scatter/widget/primary',
        selections: {
          localBrush: {
            kind: 'interval',
            channels: {
              x: { field: 'mpg', domain: [10, 20] },
              y: { field: 'hp', domain: [50, 150] },
            },
          },
        },
      }),
      /does not expose a native scatter brush binding/,
    )
  } finally {
    globalThis.window = previousWindow
  }
})
