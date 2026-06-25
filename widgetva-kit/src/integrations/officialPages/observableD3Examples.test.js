import test from 'node:test'
import assert from 'node:assert/strict'

import {
  attachWidgetVAToObservableD3BarPage,
  attachWidgetVAToObservableD3LinePage,
  attachWidgetVAToObservableD3ScatterPage,
  createObservableBarSurfaceWrapper,
  createObservableLineSurfaceWrapper,
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
  const appliedViewports = []
  const appliedClusters = []
  const appliedRegressions = []
  const messageHost = createMessageHost()
  let describeSurfaceCallCount = 0
  const frame = {
    src: 'https://d3.static.observableusercontent.com/next/worker-test.html',
    getAttribute(name) {
      return name === 'src' ? this.src : null
    },
    contentWindow: {
      postMessage(message) {
        let response = null
        if (message.method === 'describeSurface') {
          describeSurfaceCallCount += 1
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
        } else if (message.method === 'applyScatterViewport') {
          appliedViewports.push(message.params?.viewport || null)
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              viewport: message.params?.viewport || null,
            },
          }
        } else if (message.method === 'applyScatterClusters') {
          appliedClusters.push(message.params?.cluster || null)
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              applied: true,
              clusterCount: message.params?.cluster?.nClusters || 0,
            },
          }
        } else if (message.method === 'applyScatterRegression') {
          appliedRegressions.push(message.params?.regression || null)
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              applied: !!message.params?.regression,
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
              viewport: appliedViewports.at(-1) || null,
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
    appliedViewports,
    appliedClusters,
    appliedRegressions,
    getDescribeSurfaceCallCount() {
      return describeSurfaceCallCount
    },
    messageHost,
  }
}

function makeScatterBecomesReadyRpcFrame() {
  const appliedSelections = []
  const appliedViewports = []
  const appliedClusters = []
  const appliedRegressions = []
  const messageHost = createMessageHost()
  let describeSurfaceCallCount = 0
  let readScatterRowsCallCount = 0
  const readyRows = Array.from({ length: 10 }, (_, index) => ({
    id: `pt_${index + 1}`,
    __screenX: 20 + (index * 10),
    __screenY: 30 + (index * 10),
  }))

  const frame = {
    src: 'https://d3.static.observableusercontent.com/next/worker-test.html',
    getAttribute(name) {
      return name === 'src' ? this.src : null
    },
    contentWindow: {
      postMessage(message) {
        let response = null
        if (message.method === 'describeSurface') {
          describeSurfaceCallCount += 1
          const ready = describeSurfaceCallCount >= 2
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              surfaceTag: 'svg',
              inferredKind: ready ? 'scatter' : 'custom',
            },
          }
        } else if (message.method === 'readScatterRows') {
          readScatterRowsCallCount += 1
          const ready = readScatterRowsCallCount >= 2
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              rows: ready ? readyRows : [],
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
              selectedCount: readyRows.length,
              totalCount: readyRows.length,
            },
          }
        } else if (message.method === 'applyScatterViewport') {
          appliedViewports.push(message.params?.viewport || null)
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              viewport: message.params?.viewport || null,
            },
          }
        } else if (message.method === 'applyScatterClusters') {
          appliedClusters.push(message.params?.cluster || null)
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              applied: !!message.params?.cluster,
            },
          }
        } else if (message.method === 'applyScatterRegression') {
          appliedRegressions.push(message.params?.regression || null)
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              applied: !!message.params?.regression,
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
              markCount: readyRows.length,
              rowSummary: {
                count: readyRows.length,
                xMin: Math.min(...readyRows.map((row) => row.__screenX)),
                xMax: Math.max(...readyRows.map((row) => row.__screenX)),
                yMin: Math.min(...readyRows.map((row) => row.__screenY)),
                yMax: Math.max(...readyRows.map((row) => row.__screenY)),
                sample: readyRows.slice(0, 5),
              },
              viewport: appliedViewports.at(-1) || null,
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
    appliedViewports,
    appliedClusters,
    appliedRegressions,
    messageHost,
    readyRows,
    getDescribeSurfaceCallCount() {
      return describeSurfaceCallCount
    },
    getReadScatterRowsCallCount() {
      return readScatterRowsCallCount
    },
  }
}

function makeBarRpcFrame(rows = []) {
  const appliedSelections = []
  const appliedFilters = []
  const appliedSorts = []
  const messageHost = createMessageHost()
  let describeSurfaceCallCount = 0
  const frame = {
    src: 'https://d3.static.observableusercontent.com/next/worker-test.html',
    getAttribute(name) {
      return name === 'src' ? this.src : null
    },
    contentWindow: {
      postMessage(message) {
        let response = null
        if (message.method === 'describeSurface') {
          describeSurfaceCallCount += 1
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              surfaceTag: 'svg',
              inferredKind: 'bar',
            },
          }
        } else if (message.method === 'readBarRows') {
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              rows,
            },
          }
        } else if (message.method === 'applyBarSelection') {
          appliedSelections.push(message.params?.selection || null)
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              selectedCount: rows.filter((row) => (message.params?.selection?.values || []).includes(row.category)).length,
              totalCount: rows.length,
            },
          }
        } else if (message.method === 'applyBarFilter') {
          appliedFilters.push(message.params?.filter || null)
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              visibleCount: rows.filter((row) => (message.params?.filter?.categories || []).includes(row.category)).length,
              totalCount: rows.length,
            },
          }
        } else if (message.method === 'applyBarSort') {
          appliedSorts.push(message.params?.sort || null)
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              order: message.params?.sort?.values || [],
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
                inferredKind: 'bar',
              },
              barRows: rows,
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
    appliedFilters,
    appliedSorts,
    messageHost,
    getDescribeSurfaceCallCount() {
      return describeSurfaceCallCount
    },
  }
}

function makeLineRpcFrame(rows = []) {
  const appliedSelections = []
  const appliedViewports = []
  const appliedFocuses = []
  const appliedTrends = []
  const appliedMovingAverages = []
  const appliedDrilldowns = []
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
              inferredKind: 'line',
            },
          }
        } else if (message.method === 'readLineRows') {
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              rows,
            },
          }
        } else if (message.method === 'applyLineSelection') {
          appliedSelections.push(message.params?.selection || null)
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              selectedCount: rows.filter((row) => {
                const field = message.params?.selection?.field
                const values = message.params?.selection?.values || []
                return field && values.includes(row?.[field])
              }).length,
              totalCount: rows.length,
            },
          }
        } else if (message.method === 'applyLineViewport') {
          appliedViewports.push(message.params?.viewport || null)
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              viewport: message.params?.viewport || null,
            },
          }
        } else if (message.method === 'applyLineFocus') {
          appliedFocuses.push(message.params?.focus || null)
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              focusedCount: (message.params?.focus?.lines || []).length,
              totalCount: rows.length,
            },
          }
        } else if (message.method === 'applyLineTrend') {
          appliedTrends.push(message.params?.trend || null)
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              applied: !!message.params?.trend,
            },
          }
        } else if (message.method === 'applyLineMovingAverage') {
          appliedMovingAverages.push(message.params?.movingAverage || null)
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              applied: !!message.params?.movingAverage,
            },
          }
        } else if (message.method === 'applyLineDrilldown') {
          appliedDrilldowns.push(message.params?.drilldown || null)
          response = {
            source: 'widgetva-observable-d3-worker',
            type: 'widgetva:observable-d3-worker-response',
            id: message.id,
            ok: true,
            result: {
              applied: !!message.params?.drilldown,
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
                inferredKind: 'line',
              },
              lineRows: rows,
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
    appliedViewports,
    appliedFocuses,
    appliedTrends,
    appliedMovingAverages,
    appliedDrilldowns,
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

test('createObservableScatterSurfaceWrapper sends viewport updates to the Observable worker bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const { frame, appliedViewports, messageHost } = makeRpcFrame([
      { id: 'pt_1', __screenX: 10, __screenY: 10 },
      { id: 'pt_2', __screenX: 20, __screenY: 20 },
    ])
    globalThis.window = messageHost

    const wrapper = createObservableScatterSurfaceWrapper({ frame })
    await wrapper.setViewport({
      xDomain: [5, 25],
      yDomain: [5, 25],
    })

    assert.equal(appliedViewports.length, 1)
    assert.deepEqual(appliedViewports[0], {
      xDomain: [5, 25],
      yDomain: [5, 25],
    })
    assert.deepEqual(wrapper.getViewport(), {
      xDomain: [5, 25],
      yDomain: [5, 25],
    })
  } finally {
    globalThis.window = previousWindow
  }
})

test('createObservableBarSurfaceWrapper sends categorical selection and filter updates to the Observable worker bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const { frame, appliedSelections, appliedFilters, messageHost } = makeBarRpcFrame([
      { id: 'bar_1', category: 'A', __barHeight: 12 },
      { id: 'bar_2', category: 'B', __barHeight: 20 },
    ])
    globalThis.window = messageHost

    const currentSpecRef = {
      current: {
        transform: [
          {
            filter: {
              field: 'category',
              oneOf: ['A'],
            },
          },
        ],
      },
    }
    const wrapper = createObservableBarSurfaceWrapper({ frame, currentSpecRef })
    await wrapper.renderFromState({
      selections: {
        localSelection: {
          kind: 'point',
          field: 'category',
          values: ['B'],
        },
      },
    })

    assert.deepEqual(appliedSelections.at(-1), {
      kind: 'point',
      field: 'category',
      values: ['B'],
    })
    assert.deepEqual(appliedFilters.at(-1), {
      field: 'category',
      categories: ['A'],
    })
  } finally {
    globalThis.window = previousWindow
  }
})

test('createObservableBarSurfaceWrapper sends sort updates to the Observable worker bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const { frame, appliedSorts, messageHost } = makeBarRpcFrame([
      { id: 'bar_1', category: 'A', __barHeight: 12 },
      { id: 'bar_2', category: 'B', __barHeight: 20 },
    ])
    globalThis.window = messageHost

    const wrapper = createObservableBarSurfaceWrapper({ frame, currentSpecRef: { current: {} } })
    await wrapper.renderFromState({
      view: {
        sort: {
          channel: 'x',
          field: 'category',
          mode: 'explicitOrder',
          values: ['B', 'A'],
        },
      },
      selections: {},
    })

    assert.deepEqual(appliedSorts.at(-1), {
      channel: 'x',
      field: 'category',
      mode: 'explicitOrder',
      values: ['B', 'A'],
    })
  } finally {
    globalThis.window = previousWindow
  }
})

test('createObservableLineSurfaceWrapper sends categorical line selections to the Observable worker bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const { frame, appliedSelections, messageHost } = makeLineRpcFrame([
      { id: 'line_1_1', series: 'A', xValue: '2000', __seriesIndex: 1 },
      { id: 'line_2_1', series: 'B', xValue: '2000', __seriesIndex: 2 },
    ])
    globalThis.window = messageHost

    const wrapper = createObservableLineSurfaceWrapper({ frame })
    await wrapper.renderFromState({
      selections: {
        localSelection: {
          kind: 'category',
          field: 'series',
          values: ['A'],
        },
      },
    })

    assert.deepEqual(appliedSelections.at(-1), {
      kind: 'category',
      field: 'series',
      values: ['A'],
    })
  } finally {
    globalThis.window = previousWindow
  }
})

test('createObservableLineSurfaceWrapper sends focus, annotate, and drilldown updates to the Observable worker bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const { frame, appliedFocuses, appliedTrends, appliedMovingAverages, appliedDrilldowns, messageHost } = makeLineRpcFrame([
      { id: 'line_1_1', series: 'A', xValue: '2000', __seriesIndex: 1 },
      { id: 'line_2_1', series: 'B', xValue: '2000', __seriesIndex: 2 },
    ])
    globalThis.window = messageHost

    const wrapper = createObservableLineSurfaceWrapper({ frame })
    await wrapper.renderFromState({
      rawSpec: {
        encoding: {
          opacity: {
            condition: { test: "indexof(['A'], datum['series']) >= 0", value: 1 },
            value: 0.08,
          },
        },
        _line_focus_state: {
          lines: ['A'],
          line_field: 'series',
        },
        _line_drilldown_state: {
          parent: { year: 2024, month: 3 },
        },
        title: '2024-03 daily trend',
        layer: [
          {
            _widgetvaTag: 'line.highlightTrend',
            transform: [{ regression: 'value', on: 'xValue' }],
          },
          {
            _widgetvaTag: 'line.showMovingAverage',
            transform: [{ frame: [-2, 0] }],
          },
        ],
      },
      selections: {},
    })

    assert.deepEqual(appliedFocuses.at(-1), {
      lines: ['A'],
      lineField: 'series',
      dimOpacity: 0.08,
    })
    assert.deepEqual(appliedTrends.at(-1), {
      trendType: 'regression',
    })
    assert.deepEqual(appliedMovingAverages.at(-1), {
      windowSize: 3,
    })
    assert.deepEqual(appliedDrilldowns.at(-1), {
      level: 'month',
      value: 3,
      parent: { year: 2024 },
      title: '2024-03 daily trend',
    })
  } finally {
    globalThis.window = previousWindow
  }
})

test('createObservableLineSurfaceWrapper sends viewport updates to the Observable worker bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const { frame, appliedViewports, messageHost } = makeLineRpcFrame([
      { id: 'line_1_1', series: 'A', xValue: '2000', __seriesIndex: 1 },
      { id: 'line_2_1', series: 'B', xValue: '2001', __seriesIndex: 2 },
    ])
    globalThis.window = messageHost

    const wrapper = createObservableLineSurfaceWrapper({ frame, currentSpecRef: { current: {} } })
    await wrapper.renderFromState({
      rawSpec: {
        encoding: {
          x: {
            field: 'xValue',
            scale: {
              domain: ['2000', '2001'],
            },
          },
        },
      },
      selections: {},
    })

    assert.deepEqual(appliedViewports.at(-1), {
      xDomain: ['2000', '2001'],
    })
  } finally {
    globalThis.window = previousWindow
  }
})

test('createObservableScatterSurfaceWrapper sends annotate updates to the Observable worker bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const { frame, appliedClusters, appliedRegressions, messageHost } = makeRpcFrame([
      { id: 'pt_1', __screenX: 10, __screenY: 10 },
      { id: 'pt_2', __screenX: 20, __screenY: 20 },
    ])
    globalThis.window = messageHost

    const wrapper = createObservableScatterSurfaceWrapper({ frame })
    await wrapper.renderFromState({
      rawSpec: {
        _scatter_cluster_state: {
          method: 'kmeans',
          cluster_field: 'cluster_3',
          n_clusters: 3,
        },
        layer: [
          {
            _widgetvaTag: 'scatter.showRegression',
            transform: [{ regression: '__screenY', on: '__screenX', method: 'linear' }],
          },
        ],
      },
      selections: {},
    })

    assert.deepEqual(appliedClusters.at(-1), {
      nClusters: 3,
      clusterField: 'cluster_3',
      method: 'kmeans',
    })
    assert.deepEqual(appliedRegressions.at(-1), {
      method: 'linear',
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

test('attachWidgetVAToObservableD3ScatterPage executes scatter.zoomDomain through the Observable worker viewport bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      id: `pt_${index + 1}`,
      __screenX: 20 + (index * 10),
      __screenY: 30 + (index * 10),
    }))
    const { frame, appliedViewports, messageHost } = makeRpcFrame(rows)
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
      callId: 'accept_observable_scatter_zoom_1',
      name: 'scatter.zoomDomain',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        xDomain: [30, 70],
        yDomain: [40, 90],
      },
    })

    assert.equal(result.ok, true)
    assert.equal(appliedViewports.length > 0, true)
    assert.deepEqual(appliedViewports.at(-1), {
      xDomain: [30, 70],
      yDomain: [40, 90],
    })
    const snapshot = await controller.readDebugSnapshot()
    assert.deepEqual(snapshot.viewport, {
      xDomain: [30, 70],
      yDomain: [40, 90],
    })
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToObservableD3ScatterPage executes scatter.identifyClusters through the Observable worker annotation bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      id: `pt_${index + 1}`,
      __screenX: 20 + (index * 10),
      __screenY: 30 + (index * 10),
    }))
    const { frame, appliedClusters, messageHost } = makeRpcFrame(rows)
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
      callId: 'accept_observable_scatter_cluster_1',
      name: 'scatter.identifyClusters',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        nClusters: 3,
      },
    })

    assert.equal(result.ok, true)
    assert.deepEqual(appliedClusters.at(-1), {
      nClusters: 3,
      clusterField: 'cluster_3',
      method: 'kmeans',
    })
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToObservableD3ScatterPage executes scatter.showRegression through the Observable worker annotation bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      id: `pt_${index + 1}`,
      __screenX: 20 + (index * 10),
      __screenY: 30 + (index * 10),
    }))
    const { frame, appliedRegressions, messageHost } = makeRpcFrame(rows)
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
      callId: 'accept_observable_scatter_regression_1',
      name: 'scatter.showRegression',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        method: 'linear',
      },
    })

    assert.equal(result.ok, true)
    assert.deepEqual(appliedRegressions.at(-1), {
      method: 'linear',
    })
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToObservableD3BarPage executes bar.selectCategory through the Observable worker selection bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const rows = [
      { id: 'bar_1', category: 'A', __barHeight: 12 },
      { id: 'bar_2', category: 'B', __barHeight: 24 },
      { id: 'bar_3', category: 'C', __barHeight: 16 },
    ]
    const { frame, appliedSelections, messageHost } = makeBarRpcFrame(rows)
    const root = {
      ...messageHost,
      location: {
        href: 'https://observablehq.com/@d3/bar-chart/2',
      },
      document: {
        documentElement: {
          dataset: {},
        },
        body: {
          innerText: 'D3 bar chart',
        },
        querySelectorAll(selector) {
          if (selector === 'iframe') return [frame]
          return []
        },
      },
    }
    globalThis.window = root

    const controller = await attachWidgetVAToObservableD3BarPage({
      root,
      timeoutMs: 200,
      pollMs: 5,
    })

    const workspace = await root.__widgetVA.describeWorkspace()
    const widgetRef = workspace.widgets[0].ref
    const result = await controller.widget.executeVerifiedAction({
      callId: 'accept_observable_bar_select_1',
      name: 'bar.selectCategory',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        field: 'category',
        values: ['B'],
      },
    })

    assert.equal(result.ok, true)
    assert.equal(appliedSelections.at(-1)?.field, 'category')
    assert.deepEqual(appliedSelections.at(-1)?.values, ['B'])
    assert.equal(appliedSelections.at(-1)?.kind, 'category')
    assert.equal(appliedSelections.at(-1)?.summary, 'category: B')
    assert.deepEqual(appliedSelections.at(-1)?.predicates, [{ field: 'category', op: 'in', value: ['B'] }])
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToObservableD3BarPage executes bar.filterCategories through the Observable worker filter bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const rows = [
      { id: 'bar_1', category: 'A', __barHeight: 12 },
      { id: 'bar_2', category: 'B', __barHeight: 24 },
      { id: 'bar_3', category: 'C', __barHeight: 16 },
    ]
    const { frame, appliedFilters, messageHost } = makeBarRpcFrame(rows)
    const root = {
      ...messageHost,
      location: {
        href: 'https://observablehq.com/@d3/bar-chart/2',
      },
      document: {
        documentElement: {
          dataset: {},
        },
        body: {
          innerText: 'D3 bar chart',
        },
        querySelectorAll(selector) {
          if (selector === 'iframe') return [frame]
          return []
        },
      },
    }
    globalThis.window = root

    const controller = await attachWidgetVAToObservableD3BarPage({
      root,
      timeoutMs: 200,
      pollMs: 5,
    })

    const workspace = await root.__widgetVA.describeWorkspace()
    const widgetRef = workspace.widgets[0].ref
    const result = await controller.widget.executeVerifiedAction({
      callId: 'accept_observable_bar_filter_1',
      name: 'bar.filterCategories',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        field: 'category',
        categories: ['A', 'C'],
      },
    })

    assert.equal(result.ok, true)
    assert.deepEqual(appliedFilters.at(-1), {
      field: 'category',
      categories: ['A', 'C'],
    })
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToObservableD3BarPage executes bar.sortBars through the Observable worker sort bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const rows = [
      { id: 'bar_1', category: 'A', __barHeight: 12 },
      { id: 'bar_2', category: 'B', __barHeight: 24 },
      { id: 'bar_3', category: 'C', __barHeight: 16 },
      { id: 'bar_4', category: 'A', __barHeight: 8 },
    ]
    const { frame, appliedSorts, messageHost } = makeBarRpcFrame(rows)
    const root = {
      ...messageHost,
      location: {
        href: 'https://observablehq.com/@d3/bar-chart/2',
      },
      document: {
        documentElement: {
          dataset: {},
        },
        body: {
          innerText: 'D3 bar chart',
        },
        querySelectorAll(selector) {
          if (selector === 'iframe') return [frame]
          return []
        },
      },
    }
    globalThis.window = root

    const controller = await attachWidgetVAToObservableD3BarPage({
      root,
      timeoutMs: 200,
      pollMs: 5,
    })

    const workspace = await root.__widgetVA.describeWorkspace()
    const widgetRef = workspace.widgets[0].ref
    const result = await controller.widget.executeVerifiedAction({
      callId: 'accept_observable_bar_sort_1',
      name: 'bar.sortBars',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        channel: 'x',
        order: 'descending',
      },
    })

    assert.equal(result.ok, true)
    assert.deepEqual(appliedSorts.at(-1), {
      channel: 'x',
      field: 'category',
      mode: 'explicitOrder',
      values: ['B', 'C', 'A'],
    })
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToObservableD3LinePage executes line.selectSeries through the Observable worker selection bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const rows = [
      { id: 'line_1_1', series: 'A', xValue: '2000', __seriesIndex: 1 },
      { id: 'line_1_2', series: 'A', xValue: '2001', __seriesIndex: 1 },
      { id: 'line_2_1', series: 'B', xValue: '2000', __seriesIndex: 2 },
    ]
    const { frame, appliedSelections, messageHost } = makeLineRpcFrame(rows)
    const root = {
      ...messageHost,
      location: {
        href: 'https://observablehq.com/@d3/index-chart/2',
      },
      document: {
        documentElement: {
          dataset: {},
        },
        body: {
          innerText: 'D3 line chart',
        },
        querySelectorAll(selector) {
          if (selector === 'iframe') return [frame]
          return []
        },
      },
    }
    globalThis.window = root

    const controller = await attachWidgetVAToObservableD3LinePage({
      root,
      timeoutMs: 200,
      pollMs: 5,
    })

    const workspace = await root.__widgetVA.describeWorkspace()
    const widgetRef = workspace.widgets[0].ref
    const result = await controller.widget.executeVerifiedAction({
      callId: 'accept_observable_line_series_1',
      name: 'line.selectSeries',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        field: 'series',
        values: ['A'],
      },
    })

    assert.equal(result.ok, true)
    assert.equal(appliedSelections.at(-1)?.field, 'series')
    assert.deepEqual(appliedSelections.at(-1)?.values, ['A'])
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToObservableD3LinePage executes line.selectXValue through the Observable worker selection bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const rows = [
      { id: 'line_1_1', series: 'A', xValue: '2000', __seriesIndex: 1 },
      { id: 'line_1_2', series: 'A', xValue: '2001', __seriesIndex: 1 },
      { id: 'line_2_1', series: 'B', xValue: '2000', __seriesIndex: 2 },
    ]
    const { frame, appliedSelections, messageHost } = makeLineRpcFrame(rows)
    const root = {
      ...messageHost,
      location: {
        href: 'https://observablehq.com/@d3/index-chart/2',
      },
      document: {
        documentElement: {
          dataset: {},
        },
        body: {
          innerText: 'D3 line chart',
        },
        querySelectorAll(selector) {
          if (selector === 'iframe') return [frame]
          return []
        },
      },
    }
    globalThis.window = root

    const controller = await attachWidgetVAToObservableD3LinePage({
      root,
      timeoutMs: 200,
      pollMs: 5,
    })

    const workspace = await root.__widgetVA.describeWorkspace()
    const widgetRef = workspace.widgets[0].ref
    const result = await controller.widget.executeVerifiedAction({
      callId: 'accept_observable_line_xvalue_1',
      name: 'line.selectXValue',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        value: '2000',
      },
    })

    assert.equal(result.ok, true)
    assert.equal(appliedSelections.at(-1)?.field, 'xValue')
    assert.deepEqual(appliedSelections.at(-1)?.values, ['2000'])
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToObservableD3LinePage executes line.focusLines through the Observable worker focus bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const rows = [
      { id: 'line_1_1', series: 'A', xValue: '2000', __seriesIndex: 1 },
      { id: 'line_1_2', series: 'A', xValue: '2001', __seriesIndex: 1 },
      { id: 'line_2_1', series: 'B', xValue: '2000', __seriesIndex: 2 },
    ]
    const { frame, appliedFocuses, messageHost } = makeLineRpcFrame(rows)
    const root = {
      ...messageHost,
      location: {
        href: 'https://observablehq.com/@d3/index-chart/2',
      },
      document: {
        documentElement: {
          dataset: {},
        },
        body: {
          innerText: 'D3 line chart',
        },
        querySelectorAll(selector) {
          if (selector === 'iframe') return [frame]
          return []
        },
      },
    }
    globalThis.window = root

    const controller = await attachWidgetVAToObservableD3LinePage({
      root,
      timeoutMs: 200,
      pollMs: 5,
    })

    const workspace = await root.__widgetVA.describeWorkspace()
    const widgetRef = workspace.widgets[0].ref
    const result = await controller.widget.executeVerifiedAction({
      callId: 'accept_observable_line_focus_1',
      name: 'line.focusLines',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        lines: ['A'],
        lineField: 'series',
        dimOpacity: 0.08,
      },
    })

    assert.equal(result.ok, true)
    assert.deepEqual(appliedFocuses.at(-1), {
      lines: ['A'],
      lineField: 'series',
      dimOpacity: 0.08,
    })
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToObservableD3LinePage executes line.highlightTrend and line.showMovingAverage through the Observable worker annotation bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const rows = [
      { id: 'line_1_1', series: 'A', xValue: '2000', __seriesIndex: 1 },
      { id: 'line_1_2', series: 'A', xValue: '2001', __seriesIndex: 1 },
      { id: 'line_2_1', series: 'B', xValue: '2000', __seriesIndex: 2 },
    ]
    const { frame, appliedTrends, appliedMovingAverages, messageHost } = makeLineRpcFrame(rows)
    const root = {
      ...messageHost,
      location: {
        href: 'https://observablehq.com/@d3/index-chart/2',
      },
      document: {
        documentElement: {
          dataset: {},
        },
        body: {
          innerText: 'D3 line chart',
        },
        querySelectorAll(selector) {
          if (selector === 'iframe') return [frame]
          return []
        },
      },
    }
    globalThis.window = root

    const controller = await attachWidgetVAToObservableD3LinePage({
      root,
      timeoutMs: 200,
      pollMs: 5,
    })

    const workspace = await root.__widgetVA.describeWorkspace()
    const widgetRef = workspace.widgets[0].ref

    const trendResult = await controller.widget.executeVerifiedAction({
      callId: 'accept_observable_line_trend_1',
      name: 'line.highlightTrend',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        trendType: 'increasing',
      },
    })
    assert.equal(trendResult.ok, true)
    assert.deepEqual(appliedTrends.at(-1), {
      trendType: 'increasing',
    })

    const maResult = await controller.widget.executeVerifiedAction({
      callId: 'accept_observable_line_ma_1',
      name: 'line.showMovingAverage',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        windowSize: 3,
      },
    })
    assert.equal(maResult.ok, true)
    assert.deepEqual(appliedMovingAverages.at(-1), {
      windowSize: 3,
    })
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToObservableD3LinePage executes line.drillDownXAxis through the Observable worker drilldown bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const rows = [
      { id: 'line_1_1', series: 'A', xValue: '2000', __seriesIndex: 1 },
      { id: 'line_1_2', series: 'A', xValue: '2001', __seriesIndex: 1 },
      { id: 'line_2_1', series: 'B', xValue: '2000', __seriesIndex: 2 },
    ]
    const { frame, appliedDrilldowns, messageHost } = makeLineRpcFrame(rows)
    const root = {
      ...messageHost,
      location: {
        href: 'https://observablehq.com/@d3/index-chart/2',
      },
      document: {
        documentElement: {
          dataset: {},
        },
        body: {
          innerText: 'D3 line chart',
        },
        querySelectorAll(selector) {
          if (selector === 'iframe') return [frame]
          return []
        },
      },
    }
    globalThis.window = root

    const controller = await attachWidgetVAToObservableD3LinePage({
      root,
      timeoutMs: 200,
      pollMs: 5,
    })

    const workspace = await root.__widgetVA.describeWorkspace()
    const widgetRef = workspace.widgets[0].ref
    const result = await controller.widget.executeVerifiedAction({
      callId: 'accept_observable_line_drill_1',
      name: 'line.drillDownXAxis',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        level: 'year',
        value: 2000,
      },
    })

    assert.equal(result.ok, true)
    assert.deepEqual(appliedDrilldowns.at(-1), {
      level: 'year',
      value: 2000,
      parent: {},
      title: '2000 monthly trend',
    })
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToObservableD3LinePage executes line.zoomXRegion through the Observable worker viewport bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const rows = [
      { id: 'line_1_1', series: 'A', xValue: '2000', __seriesIndex: 1 },
      { id: 'line_1_2', series: 'A', xValue: '2001', __seriesIndex: 1 },
      { id: 'line_2_1', series: 'B', xValue: '2000', __seriesIndex: 2 },
    ]
    const { frame, appliedViewports, messageHost } = makeLineRpcFrame(rows)
    const root = {
      ...messageHost,
      location: {
        href: 'https://observablehq.com/@d3/index-chart/2',
      },
      document: {
        documentElement: {
          dataset: {},
        },
        body: {
          innerText: 'D3 line chart',
        },
        querySelectorAll(selector) {
          if (selector === 'iframe') return [frame]
          return []
        },
      },
    }
    globalThis.window = root

    const controller = await attachWidgetVAToObservableD3LinePage({
      root,
      timeoutMs: 200,
      pollMs: 5,
    })

    const workspace = await root.__widgetVA.describeWorkspace()
    const widgetRef = workspace.widgets[0].ref
    const result = await controller.widget.executeVerifiedAction({
      callId: 'accept_observable_line_zoom_1',
      name: 'line.zoomXRegion',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        start: '2000',
        end: '2001',
      },
    })

    assert.equal(result.ok, true)
    assert.deepEqual(appliedViewports.at(-1), {
      xDomain: ['2000', '2001'],
    })
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToObservableD3LinePage executes line.resetDrilldownXAxis by clearing the Observable worker drilldown bridge', async () => {
  const previousWindow = globalThis.window
  try {
    const rows = [
      { id: 'line_1_1', series: 'A', xValue: '2000', __seriesIndex: 1 },
      { id: 'line_1_2', series: 'A', xValue: '2001', __seriesIndex: 1 },
      { id: 'line_2_1', series: 'B', xValue: '2000', __seriesIndex: 2 },
    ]
    const { frame, appliedDrilldowns, messageHost } = makeLineRpcFrame(rows)
    const root = {
      ...messageHost,
      location: {
        href: 'https://observablehq.com/@d3/index-chart/2',
      },
      document: {
        documentElement: {
          dataset: {},
        },
        body: {
          innerText: 'D3 line chart',
        },
        querySelectorAll(selector) {
          if (selector === 'iframe') return [frame]
          return []
        },
      },
    }
    globalThis.window = root

    const controller = await attachWidgetVAToObservableD3LinePage({
      root,
      timeoutMs: 200,
      pollMs: 5,
    })

    const workspace = await root.__widgetVA.describeWorkspace()
    const widgetRef = workspace.widgets[0].ref

    const drillResult = await controller.widget.executeVerifiedAction({
      callId: 'accept_observable_line_drill_for_reset_1',
      name: 'line.drillDownXAxis',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        level: 'year',
        value: 2000,
      },
    })
    assert.equal(drillResult.ok, true)
    assert.deepEqual(appliedDrilldowns.at(-1), {
      level: 'year',
      value: 2000,
      parent: {},
      title: '2000 monthly trend',
    })

    const resetResult = await controller.widget.executeVerifiedAction({
      callId: 'accept_observable_line_reset_drill_1',
      name: 'line.resetDrilldownXAxis',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {},
    })
    assert.equal(resetResult.ok, true)
    assert.equal(appliedDrilldowns.at(-1), null)
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToObservableD3ScatterPage waits until the Observable worker scatter surface is actually ready', async () => {
  const previousWindow = globalThis.window
  try {
    const { frame, messageHost, readyRows, getDescribeSurfaceCallCount, getReadScatterRowsCallCount } = makeScatterBecomesReadyRpcFrame()
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
      timeoutMs: 500,
      pollMs: 5,
    })

    const snapshot = await controller.readDebugSnapshot()

    assert.equal(snapshot.route, 'worker')
    assert.equal(snapshot.rowSummary.count, readyRows.length)
    assert.equal(getDescribeSurfaceCallCount() >= 2, true)
    assert.equal(getReadScatterRowsCallCount() >= 2, true)
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})
