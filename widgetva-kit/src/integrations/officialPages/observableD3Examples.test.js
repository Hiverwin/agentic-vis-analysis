import test from 'node:test'
import assert from 'node:assert/strict'

import {
  attachWidgetVAToObservableD3ScatterPage,
  createObservableScatterSurfaceWrapper,
} from './observableD3Examples.js'

function createMessageHost() {
  const listeners = new Set()
  return {
    addEventListener(type, handler) {
      if (type === 'message') listeners.add(handler)
    },
    removeEventListener(type, handler) {
      if (type === 'message') listeners.delete(handler)
    },
    dispatchMessage(event) {
      for (const handler of listeners) {
        handler(event)
      }
    },
  }
}

function makeRpcFrame(rows = []) {
  const appliedSelections = []
  const messageHost = createMessageHost()
  const frame = {
    src: 'https://d3.static.observableusercontent.com/next/worker-test.html',
    getAttribute(name) {
      return name === 'src' ? this.src : null
    },
    contentWindow: {
      postMessage(message) {
        let response = null
        if (message.method === 'describeSurface') {
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              surfaceTag: 'svg',
              inferredKind: 'scatter',
            },
          }
        } else if (message.method === 'readScatterRows') {
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              rows,
            },
          }
        } else if (message.method === 'applyScatterSelection') {
          appliedSelections.push(message.params?.selection || null)
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              selectedCount: rows.length,
              totalCount: rows.length,
            },
          }
        } else if (message.method === 'readDebugSnapshot') {
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              route: 'worker',
              surface: {
                surfaceTag: 'svg',
                inferredKind: 'scatter',
              },
              markCount: rows.length,
              rowSummary: {
                count: rows.length,
                xMin: Math.min(...rows.map((row) => row.__screenX)),
                xMax: Math.max(...rows.map((row) => row.__screenX)),
                yMin: Math.min(...rows.map((row) => row.__screenY)),
                yMax: Math.max(...rows.map((row) => row.__screenY)),
                sample: rows.slice(0, 5),
              },
            },
          }
        } else {
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: false,
            error: {
              message: `Unsupported worker method: ${message.method}`,
            },
          }
        }

        setTimeout(() => {
          messageHost.dispatchMessage({
            data: response,
          })
        }, 0)
      },
    },
  }

  return {
    frame,
    appliedSelections,
    messageHost,
  }
}

test('createObservableScatterSurfaceWrapper sends interval selections to the Observable worker bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const { frame, appliedSelections, messageHost } = makeRpcFrame([
      { id: 'pt_1', __screenX: 10, __screenY: 10 },
      { id: 'pt_2', __screenX: 20, __screenY: 20 },
    ])
    globalThis.window = messageHost

    const wrapper = createObservableScatterSurfaceWrapper({ frame })
    await wrapper.setSelection({
      kind: 'interval',
      domain: {
        xDomain: [0, 30],
        yDomain: [0, 30],
      },
    })

    assert.equal(appliedSelections.length, 1)
    assert.deepEqual(appliedSelections[0], {
      kind: 'interval',
      domain: {
        xDomain: [0, 30],
        yDomain: [0, 30],
      },
    })
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToObservableD3ScatterPage mounts WidgetVA over an Observable worker bridge and executes brushRegion', async () => {
  const previousWindow = globalThis.window
  try {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      id: `pt_${index + 1}`,
      __screenX: 20 + (index * 10),
      __screenY: 30 + (index * 10),
    }))
    const { frame, appliedSelections, messageHost } = makeRpcFrame(rows)
    const root = {
      ...messageHost,
      location: {
        href: 'https://observablehq.com/@d3/scatterplot',
      },
      document: {
        documentElement: {
          dataset: {},
        },
        body: {
          innerText: 'D3 scatterplot',
        },
        querySelectorAll(selector) {
          if (selector === 'iframe') return [frame]
          return []
        },
      },
    }
    globalThis.window = root

    const controller = await attachWidgetVAToObservableD3ScatterPage({
      root,
      timeoutMs: 200,
      pollMs: 5,
    })

    const workspace = await root.__widgetVA.describeWorkspace()
    const widgetRef = workspace.widgets[0].ref
    const result = await controller.widget.executeVerifiedAction({
      callId: 'accept_observable_scatter_brush_1',
      name: 'scatter.brushRegion',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        xField: '__screenX',
        yField: '__screenY',
        xRange: [15, 55],
        yRange: [25, 65],
      },
    })

    assert.equal(result.ok, true)
    assert.equal(appliedSelections.length > 0, true)
    const latestSelection = appliedSelections.at(-1)
    assert.deepEqual(latestSelection?.domain, {
      xDomain: [15, 55],
      yDomain: [25, 65],
    })
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})
