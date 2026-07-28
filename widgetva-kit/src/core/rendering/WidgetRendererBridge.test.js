import test from 'node:test'
import assert from 'node:assert/strict'

import { createWidgetVARuntime } from '../../core/index.js'
import { WidgetVARuntimeStore } from '../runtime/RuntimeStore.js'
import { applyWidgetRuntimeState, attachWidgetRendererBridge } from './WidgetRendererBridge.js'

function buildScatterSpec() {
  return {
    data: {
      values: [
        { Horsepower: 90, Miles_per_Gallon: 32, Origin: 'Japan' },
        { Horsepower: 130, Miles_per_Gallon: 24, Origin: 'USA' },
        { Horsepower: 160, Miles_per_Gallon: 18, Origin: 'USA' },
      ],
    },
    mark: 'point',
    encoding: {
      x: { field: 'Horsepower', type: 'quantitative' },
      y: { field: 'Miles_per_Gallon', type: 'quantitative' },
      color: { field: 'Origin', type: 'nominal' },
    },
  }
}

function normalizeActionTraceRecord(record) {
  return {
    eventKind: record?.eventKind || null,
    eventFamily: record?.eventFamily || null,
    primitive: record?.primitive || null,
    actionName: record?.action?.name || null,
    targetRef: record?.action?.targetRef || null,
    params: record?.action?.params || null,
    affectedRefs: record?.affectedRefs || [],
    outcome: record?.notes?.outcome || null,
  }
}

test('attachWidgetRendererBridge delegates to adapter.bindHumanInteractions when available', () => {
  let receivedArgs = null
  let cleanedUp = false
  const adapter = {
    bindHumanInteractions(args) {
      receivedArgs = args
      return () => {
        cleanedUp = true
      }
    },
  }
  const runtime = {
    store: {
      getWidgetAdapter(widgetRef) {
        return widgetRef === 'wl://widgetva-app/workspace/main/widget/scatter_a' ? adapter : null
      },
    },
  }

  const bridge = attachWidgetRendererBridge({
    runtime,
    widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    widgetState: { widgetId: 'scatter_a' },
    view: { id: 'vega-view' },
    surface: null,
    spec: { mark: 'point' },
    interactionConfig: { mode: 'brush2d', actionName: 'scatter.brushRegion' },
    selectionSourceWidgetId: 'scatter_a',
    actionTargetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    onActionCall: () => {},
    onSelectionChange: () => {},
  })

  assert.equal(bridge.adapter, adapter)
  assert.equal(receivedArgs?.interactionConfig?.mode, 'brush2d')
  assert.equal(receivedArgs?.selectionSourceWidgetId, 'scatter_a')
  assert.equal(receivedArgs?.actionTargetRef, 'wl://widgetva-app/workspace/main/widget/scatter_a')
  bridge.cleanup()
  assert.equal(cleanedUp, true)
})

test('attachWidgetRendererBridge accepts an explicit widgetAdapter when runtime store lookup is unavailable', () => {
  let receivedArgs = null
  let cleanedUp = false
  const adapter = {
    bindHumanInteractions(args) {
      receivedArgs = args
      return () => {
        cleanedUp = true
      }
    },
  }

  const bridge = attachWidgetRendererBridge({
    runtime: null,
    widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    widgetAdapter: adapter,
    widgetState: { widgetId: 'scatter_a' },
    view: { id: 'vega-view' },
    surface: null,
    spec: { mark: 'point' },
    interactionConfig: { mode: 'brush2d', actionName: 'scatter.brushRegion' },
    selectionSourceWidgetId: 'scatter_a',
    actionTargetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    onActionCall: () => {},
    onSelectionChange: () => {},
  })

  assert.equal(bridge.adapter, adapter)
  assert.equal(receivedArgs?.interactionConfig?.actionName, 'scatter.brushRegion')
  bridge.cleanup()
  assert.equal(cleanedUp, true)
})

test('attachWidgetRendererBridge consumes hand-assembled RuntimeStore widgetAdapters', () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_a'
  const store = new WidgetVARuntimeStore()
  let receivedArgs = null
  let cleanedUp = false
  const adapter = {
    widgetRef,
    provider: 'custom',
    bindHumanInteractions(args) {
      receivedArgs = args
      return () => {
        cleanedUp = true
      }
    },
  }
  const runtime = { store }

  store.descriptions[widgetRef] = {
    ref: widgetRef,
    widgetId: 'scatter_a',
    kind: 'scatter',
    title: 'Scatter A',
  }
  store.widgetAdapters[widgetRef] = adapter

  const bridge = attachWidgetRendererBridge({
    runtime,
    widgetRef,
    widgetState: { widgetId: 'scatter_a' },
    view: { id: 'vega-view' },
    surface: null,
    spec: { mark: 'point' },
    interactionConfig: { mode: 'brush2d', actionName: 'scatter.brushRegion' },
    selectionSourceWidgetId: 'scatter_a',
    actionTargetRef: widgetRef,
    onActionCall: () => {},
    onSelectionChange: () => {},
  })

  assert.equal(bridge.adapter, adapter)
  assert.equal(receivedArgs?.interactionConfig?.actionName, 'scatter.brushRegion')
  bridge.cleanup()
  assert.equal(cleanedUp, true)
})

test('attachWidgetRendererBridge can skip human interaction binding entirely', () => {
  let bindCalled = false
  const adapter = {
    bindHumanInteractions() {
      bindCalled = true
      return () => {}
    },
  }

  const bridge = attachWidgetRendererBridge({
    runtime: null,
    widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    widgetAdapter: adapter,
    widgetState: { widgetId: 'scatter_a' },
    view: { id: 'vega-view' },
    surface: null,
    spec: { mark: 'point' },
    interactionConfig: { mode: 'brush2d', actionName: 'scatter.brushRegion' },
    bindHumanInteractions: false,
  })

  assert.equal(bindCalled, false)
  bridge.cleanup()
})

test('applyWidgetRuntimeState forwards runtime state updates to adapter.applyState', async () => {
  let receivedArgs = null
  const adapter = {
    async applyState(args) {
      receivedArgs = args
    },
  }
  const runtime = {
    store: {
      getWidgetAdapter(widgetRef) {
        return widgetRef === 'wl://widgetva-app/workspace/main/widget/detail_a' ? adapter : null
      },
    },
  }

  await applyWidgetRuntimeState({
    runtime,
    widgetRef: 'wl://widgetva-app/workspace/main/widget/detail_a',
    widgetState: { widgetId: 'detail_a', data: { visibleCount: 2 } },
    view: null,
    surface: { nodeName: 'DIV' },
    spec: { mark: 'point' },
    interactionConfig: { mode: 'brush2d' },
  })

  assert.equal(receivedArgs?.state?.widgetId, 'detail_a')
  assert.equal(receivedArgs?.surface?.nodeName, 'DIV')
  assert.equal(receivedArgs?.interactionConfig?.mode, 'brush2d')
})

test('applyWidgetRuntimeState accepts an explicit widgetAdapter when runtime store lookup is unavailable', async () => {
  let receivedArgs = null
  const adapter = {
    async applyState(args) {
      receivedArgs = args
    },
  }

  await applyWidgetRuntimeState({
    runtime: null,
    widgetRef: 'wl://widgetva-app/workspace/main/widget/detail_a',
    widgetAdapter: adapter,
    widgetState: { widgetId: 'detail_a', data: { visibleCount: 2 } },
    view: null,
    surface: { nodeName: 'DIV' },
    spec: { mark: 'point' },
    interactionConfig: { mode: 'brush2d' },
  })

  assert.equal(receivedArgs?.state?.widgetId, 'detail_a')
  assert.equal(receivedArgs?.surface?.nodeName, 'DIV')
  assert.equal(receivedArgs?.interactionConfig?.mode, 'brush2d')
})

test('attachWidgetRendererBridge re-applies widget state when the runtime store changes', async () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_a'
  const store = new WidgetVARuntimeStore()
  const appliedStates = []
  let resolveNextApply = null
  const nextApply = new Promise((resolve) => {
    resolveNextApply = resolve
  })
  const adapter = {
    async applyState(args) {
      appliedStates.push(args?.state || null)
      if (appliedStates.length === 1 && typeof resolveNextApply === 'function') {
        resolveNextApply(args?.state || null)
      }
    },
  }

  store.descriptions[widgetRef] = {
    ref: widgetRef,
    widgetId: 'scatter_a',
    kind: 'scatter',
    title: 'Scatter A',
  }
  store.widgets[widgetRef] = {
    ref: widgetRef,
    widgetId: 'scatter_a',
    kind: 'scatter',
    data: { visibleCount: 3 },
  }

  const bridge = attachWidgetRendererBridge({
    runtime: { store },
    widgetRef,
    widgetAdapter: adapter,
    widgetState: store.getWidgetState(widgetRef),
    view: { id: 'd3-wrapper' },
    surface: null,
    spec: { mark: 'point' },
    interactionConfig: { mode: 'brush2d' },
  })

  store.patchWidget(widgetRef, {
    data: { visibleCount: 1, selectedCount: 1 },
  })

  const appliedState = await nextApply
  assert.equal(appliedStates.length, 1)
  assert.equal(appliedState?.data?.visibleCount, 1)
  assert.equal(appliedState?.data?.selectedCount, 1)

  bridge.cleanup()
})

test('applyWidgetRuntimeState is a no-op without adapter.applyState or render targets', async () => {
  const runtime = {
    store: {
      getWidgetAdapter() {
        return {
          bindHumanInteractions() {},
        }
      },
    },
  }

  await assert.doesNotReject(async () => {
    await applyWidgetRuntimeState({
      runtime,
      widgetRef: 'wl://widgetva-app/workspace/main/widget/empty',
      widgetState: { widgetId: 'empty' },
      view: null,
      surface: null,
      spec: null,
      interactionConfig: null,
    })
  })
})
