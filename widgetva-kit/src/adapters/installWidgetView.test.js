import test from 'node:test'
import assert from 'node:assert/strict'

import {
  installWidgetVAOnView,
  installWidgetVAOnVgplotView,
  installWidgetVAOnVegaLiteView,
} from './installWidgetView.js'
import { createD3WidgetAdapter } from './d3/D3WidgetAdapter.js'
import { createEChartsWidgetAdapter } from './echarts/EChartsWidgetAdapter.js'
import { createVegaLiteWidgetAdapter } from './vegaLite/VegaLiteWidgetAdapter.js'
import { createVgplotWidgetAdapter } from './vgplot/VgplotWidgetAdapter.js'

test('installWidgetVAOnView requires a render target and an explicit widgetAdapter', async () => {
  await assert.rejects(
    () => installWidgetVAOnView({ widgetAdapter: {} }),
    /requires either a view, surface, or container/,
  )
  await assert.rejects(
    () => installWidgetVAOnView({ view: { id: 'vega-view' } }),
    /requires an explicit widgetAdapter/,
  )
})

test('installWidgetVAOnView accepts container as a surface alias', async () => {
  let receivedSurface = null
  const adapter = {
    bindHumanInteractions() {
      return () => {}
    },
    async applyState(args) {
      receivedSurface = args.surface
    },
  }

  const container = { nodeName: 'DIV' }
  const installed = await installWidgetVAOnView({
    container,
    widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    widgetState: { widgetId: 'scatter_a' },
    spec: { mark: 'point' },
    widgetAdapter: adapter,
  })

  assert.equal(receivedSurface, container)
  installed.dispose()
})

test('installWidgetVAOnView binds interactions and applies initial state through the adapter', async () => {
  const calls = []
  let disposed = false
  const adapter = {
    bindHumanInteractions(args) {
      calls.push({ type: 'bind', args })
      return () => {
        disposed = true
      }
    },
    async applyState(args) {
      calls.push({ type: 'apply', args })
    },
  }

  const installed = await installWidgetVAOnView({
    view: { id: 'vega-view' },
    widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    widgetState: { widgetId: 'scatter_a', data: { visibleCount: 3 } },
    spec: { mark: 'point' },
    interactionConfig: { mode: 'brush2d' },
    selectionSourceWidgetId: 'scatter_a',
    onActionCall: () => {},
    onSelectionChange: () => {},
    widgetAdapter: adapter,
  })

  assert.equal(installed.adapter, adapter)
  assert.equal(calls[0]?.type, 'bind')
  assert.equal(calls[1]?.type, 'apply')
  await installed.apply({
    widgetState: { widgetId: 'scatter_a', data: { visibleCount: 1 } },
  })
  assert.equal(calls[2]?.type, 'apply')
  installed.dispose()
  assert.equal(disposed, true)
})

test('installWidgetVAOnView can disable human interaction binding while still applying initial state', async () => {
  const calls = []
  let disposed = false
  const adapter = {
    bindHumanInteractions(args) {
      calls.push({ type: 'bind', args })
      return () => {
        disposed = true
      }
    },
    async applyState(args) {
      calls.push({ type: 'apply', args })
    },
  }

  const installed = await installWidgetVAOnView({
    view: { id: 'vega-view' },
    widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    widgetState: { widgetId: 'scatter_a', data: { visibleCount: 3 } },
    spec: { mark: 'point' },
    interactionConfig: { mode: 'brush2d' },
    bindHumanInteractions: false,
    widgetAdapter: adapter,
  })

  assert.equal(installed.adapter, adapter)
  assert.deepEqual(calls.map((call) => call.type), ['apply'])
  installed.dispose()
  assert.equal(disposed, false)
})

test('installWidgetVAOnView routes D3 provider events through the adapter', async () => {
  let brushHandler = null
  const actions = []
  const installed = await installWidgetVAOnView({
    view: {
      onBrush(handler) {
        brushHandler = handler
        return () => {
          brushHandler = null
        }
      },
    },
    widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    widgetState: { widgetId: 'scatter_a', kind: 'scatter' },
    spec: { mark: 'point' },
    interactionConfig: { mode: 'brush2d' },
    onActionCall(actionCall) {
      actions.push(actionCall)
    },
    widgetAdapter: createD3WidgetAdapter({ kind: 'scatter' }),
  })

  brushHandler?.({
    fields: ['x', 'y'],
    value: { x: [1, 2], y: [3, 4] },
  })

  assert.equal(actions[0]?.name, 'scatter.brushRegion')
  assert.equal(actions[0]?.targetRef, 'wl://widgetva-app/workspace/main/widget/scatter_a')
  assert.deepEqual(actions[0]?.params, {
    targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    xField: 'x',
    yField: 'y',
    xRange: [1, 2],
    yRange: [3, 4],
  })
  installed.dispose()
  assert.equal(brushHandler, null)
})

test('installWidgetVAOnView routes ECharts provider events through the adapter', async () => {
  const handlers = new Map()
  const actions = []
  const installed = await installWidgetVAOnView({
    view: {
      on(eventName, handler) {
        handlers.set(eventName, handler)
      },
      off(eventName, handler) {
        if (handlers.get(eventName) === handler) handlers.delete(eventName)
      },
    },
    widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    widgetState: { widgetId: 'scatter_a', kind: 'scatter' },
    spec: { series: [{ type: 'scatter' }] },
    interactionConfig: { mode: 'brush2d' },
    onActionCall(actionCall) {
      actions.push(actionCall)
    },
    widgetAdapter: createEChartsWidgetAdapter({ kind: 'scatter' }),
  })

  handlers.get('brushselected')?.({
    widgetvaSelection: {
      fields: ['x', 'y'],
      value: { x: [1, 2], y: [3, 4] },
    },
  })

  assert.equal(actions[0]?.name, 'scatter.brushRegion')
  assert.equal(actions[0]?.targetRef, 'wl://widgetva-app/workspace/main/widget/scatter_a')
  assert.deepEqual(actions[0]?.params, {
    targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    xField: 'x',
    yField: 'y',
    xRange: [1, 2],
    yRange: [3, 4],
  })
  installed.dispose()
  assert.equal(handlers.has('brushselected'), false)
})

test('installWidgetVAOnVegaLiteView installs a provided Vega-Lite adapter', async () => {
  let runCount = 0
  const widgetAdapter = createVegaLiteWidgetAdapter({ kind: 'scatter' })
  const installed = await installWidgetVAOnVegaLiteView({
    view: {
      async runAsync() {
        runCount += 1
      },
    },
    widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    widgetState: { widgetId: 'scatter_a', kind: 'scatter' },
    spec: { mark: 'point' },
    widgetAdapter,
  })

  assert.equal(installed.adapter, widgetAdapter)
  assert.equal(runCount, 1)
})

test('installWidgetVAOnVgplotView orchestrates vgplot runtime metadata for an explicit adapter', async () => {
  const view = {}
  const runtimeCapture = {
    provider: 'vgplot',
    plots: new Map([[
      'plot_main',
      {
        widgetKind: 'scatter',
        plot: {
          getAttribute() {
            return undefined
          },
          setAttribute() {},
        },
      },
    ]]),
    selections: new Map(),
    params: new Map(),
    context: null,
  }
  const widgetAdapter = createVgplotWidgetAdapter({ kind: 'scatter' })
  const installed = await installWidgetVAOnVgplotView({
    view,
    widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    widgetState: { widgetId: 'scatter_a', kind: 'scatter' },
    spec: { mark: 'point' },
    widgetAdapter,
    runtimeCapture,
    binding: {
      widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
      dataRef: 'wl://widgetva-app/workspace/main/data/cars',
      widgetKind: 'scatter',
      fields: ['Horsepower', 'Miles_per_Gallon'],
    },
  })

  assert.equal(installed.adapter, widgetAdapter)
  assert.equal(view.__widgetvaVgplotRuntime?.plots instanceof Map, true)
  assert.equal(view.__widgetvaVgplotBinding?.widgetKind, 'scatter')
})
