import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyObservableD3NativeBrushRegion,
  clearObservableD3NativeBrush,
  readObservableD3NativeApi,
  readObservableD3NativeCaptureSnapshot,
} from './observableD3NativeCapture.js'

test('native D3 capture returns no brush bindings when the page exposes no native API', () => {
  const root = {}

  assert.equal(readObservableD3NativeApi(root), null)
  assert.deepEqual(readObservableD3NativeCaptureSnapshot(root), { brushBindings: [] })
})

test('native D3 capture reads the page exposed capture snapshot', () => {
  const root = {
    __widgetVAObservableD3Native: {
      readCaptureSnapshot() {
        return {
          brushBindings: [{
            bindingId: 'brush_1',
            targetRef: 'target_1',
          }],
        }
      },
    },
  }

  assert.deepEqual(readObservableD3NativeCaptureSnapshot(root), {
    brushBindings: [{
      bindingId: 'brush_1',
      targetRef: 'target_1',
    }],
  })
})

test('native D3 brush execution delegates only to the page native helper', () => {
  const calls = []
  const root = {
    __widgetVAObservableD3Native: {
      applyBrushRegion(command) {
        calls.push(command)
        return { ok: true, bindingId: command.bindingId }
      },
    },
  }

  const result = applyObservableD3NativeBrushRegion(root, {
    bindingId: 'brush_2',
    xDomain: [1, 2],
    yDomain: [3, 4],
  })

  assert.deepEqual(result, { ok: true, bindingId: 'brush_2' })
  assert.deepEqual(calls, [{
    bindingId: 'brush_2',
    xDomain: [1, 2],
    yDomain: [3, 4],
  }])
})

test('native D3 brush execution fails when the page exposes no native executor', () => {
  assert.throws(
    () => applyObservableD3NativeBrushRegion({}, { bindingId: 'brush_3' }),
    /does not expose a native brush-region executor/,
  )
})

test('native D3 brush clear delegates to the page native helper', () => {
  const calls = []
  const root = {
    __widgetVAObservableD3Native: {
      clearBrush(command) {
        calls.push(command)
        return { ok: true, cleared: command.bindingId }
      },
    },
  }

  assert.deepEqual(clearObservableD3NativeBrush(root, { bindingId: 'brush_4' }), {
    ok: true,
    cleared: 'brush_4',
  })
  assert.deepEqual(calls, [{ bindingId: 'brush_4' }])
})

