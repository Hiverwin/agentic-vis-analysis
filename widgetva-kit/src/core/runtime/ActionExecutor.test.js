import test from 'node:test'
import assert from 'node:assert/strict'

import { ActionExecutor } from './ActionExecutor.js'
import { registerSharedWidgetRuntimeActions } from '../../widgets/families/shared/sharedWidgetRuntimeActions.js'
import { registerScatterActions } from '../../widgets/families/scatter/runtimeActions.js'
import { registerLineActions } from '../../widgets/families/line/runtimeActions.js'
import { registerBarActions } from '../../widgets/families/bar/runtimeActions.js'

test('ActionExecutor describes the private action handler context surface', () => {
  const executor = new ActionExecutor()
  const contract = executor.describeContext()

  assert.equal(Array.isArray(contract.methods), true)
  assert.equal(contract.methods.includes('targetWidget'), true)
  assert.equal(contract.methods.includes('readRows'), true)
  assert.equal(contract.methods.includes('readCurrentState'), false)
  assert.equal(contract.methods.includes('requireTargetWidget'), false)
  assert.equal(contract.methods.includes('readStatePatch'), false)
  assert.equal(contract.methods.includes('readRowsForWidget'), false)
  assert.equal(contract.methods.includes('readRuntimeData'), false)
  assert.equal(contract.methods.includes('resolveSelectionRef'), false)
  assert.equal(contract.methods.includes('resolveSelectionRefs'), false)
  assert.equal(contract.methods.includes('executeProviderAction'), false)
  assert.equal(contract.methods.includes('writeCurrentSpec'), false)
  assert.equal(contract.capabilities.workspaceRead, true)
  assert.equal(contract.capabilities.workspaceWrite, false)
  assert.equal(contract.capabilities.specMutation, false)
  assert.equal(contract.integrations.store, false)
})

test('ActionExecutor calls action handlers with params first and keeps call metadata on ctx', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const store = {
    appId: 'demo',
    workspaceId: 'main',
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        version: 1,
      },
    },
    shared: {
      focusedWidget: widgetRef,
    },
    stateId: 'main:s1',
    version: 1,
  }
  const executor = new ActionExecutor({ store })
  let receivedParams = null
  let receivedCtx = null

  executor.register(
    { name: 'test.paramsFirst', supportedWidgetKinds: ['scatter'] },
    async (params, ctx) => {
      receivedParams = params
      receivedCtx = ctx
      return {
        patch: {
          [ctx.targetWidget().ref]: {
            feedback: {
              mode: params.mode,
            },
          },
        },
      }
    },
  )

  const result = await executor.run({
    callId: 'call_params_first',
    name: 'test.paramsFirst',
    target: { widgetRef },
    params: {
      mode: 'brush2d',
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(receivedParams, { mode: 'brush2d' })
  assert.equal(Object.hasOwn(receivedParams, 'params'), false)
  assert.equal(Object.hasOwn(receivedParams, 'name'), false)
  assert.equal(Object.hasOwn(receivedParams, 'callId'), false)
  assert.equal(receivedCtx.call.name, 'test.paramsFirst')
  assert.equal(receivedCtx.call.callId, 'call_params_first')
  assert.equal(receivedCtx.targetWidget().ref, widgetRef)
  assert.equal(Object.hasOwn(receivedCtx, 'store'), false)
  assert.equal(Object.hasOwn(receivedCtx, 'hostBridge'), false)
  assert.equal(Object.hasOwn(receivedCtx, 'resolveTargetWidget'), false)
  assert.equal(Object.hasOwn(receivedCtx, 'readCurrentState'), false)
  assert.equal(store.widgets[widgetRef].feedback.mode, 'brush2d')
})

test('ActionExecutor accepts target.widgetRef as the action target contract', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const store = {
    appId: 'demo',
    workspaceId: 'main',
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        version: 1,
      },
    },
    shared: {
      focusedWidget: widgetRef,
    },
    stateId: 'main:s1',
    version: 1,
  }
  const executor = new ActionExecutor({ store })
  let receivedParams = null
  let receivedCtx = null

  executor.register(
    { name: 'test.targetContract', supportedWidgetKinds: ['scatter'] },
    async (params, ctx) => {
      receivedParams = params
      receivedCtx = ctx
      return {
        patch: {
          [ctx.targetWidget().ref]: {
            feedback: {
              mode: params.mode,
            },
          },
        },
      }
    },
  )

  const result = await executor.run({
    callId: 'call_target_contract',
    name: 'test.targetContract',
    target: { widgetRef },
    params: {
      mode: 'brush2d',
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(receivedParams, { mode: 'brush2d' })
  assert.equal(receivedCtx.call.target.widgetRef, widgetRef)
  assert.equal(receivedCtx.call.queryScope, null)
  assert.equal(receivedCtx.targetWidget().ref, widgetRef)
  assert.equal(store.widgets[widgetRef].feedback.mode, 'brush2d')
})

test('ActionExecutor creates handler context that resolves target widgets and runtime rows', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const dataRef = 'wl://demo/workspace/main/data/current_view'
  const executor = new ActionExecutor({
    store: {
      appId: 'demo',
      workspaceId: 'main',
      descriptions: {
        [widgetRef]: {
          ref: widgetRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          title: 'Scatter A',
          primaryDataRef: dataRef,
        },
      },
      widgets: {
        [widgetRef]: {
          ref: widgetRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          version: 1,
          data: {
            sourceDataRef: dataRef,
            currentDataRef: dataRef,
          },
        },
      },
      stateId: 'main:s1',
      version: 1,
      shared: {
        focusedWidget: widgetRef,
      },
      runtimeData: {
        [dataRef]: {
          ref: dataRef,
          rows: [{ id: 1 }, { id: 2 }],
          widgetRef,
        },
      },
    },
  })

  const context = executor.createContext(
    {
      callId: 'call_plain_store',
      name: 'widget.changeEncoding',
      targetRef: widgetRef,
      params: {},
    },
    { name: 'widget.changeEncoding' },
  )

  assert.equal(context.targetWidget()?.ref, widgetRef)
  assert.deepEqual(context.readRows(widgetRef), [{ id: 1 }, { id: 2 }])
  assert.equal(Object.hasOwn(context, 'resolveTargetWidget'), false)
})

test('ActionExecutor handler context matches recognizedKinds for borrowed family actions', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/imported_primary'
  const executor = new ActionExecutor({
    store: {
      appId: 'demo',
      workspaceId: 'main',
      descriptions: {
        [widgetRef]: {
          ref: widgetRef,
          widgetId: 'imported_primary',
          kind: 'custom',
          recognizedKinds: ['scatter', 'bar'],
          title: 'Imported Primary',
        },
      },
      widgets: {
        [widgetRef]: {
          ref: widgetRef,
          widgetId: 'imported_primary',
          kind: 'custom',
          recognizedKinds: ['scatter', 'bar'],
          version: 1,
          data: {},
        },
      },
      stateId: 'main:s1',
      version: 1,
      shared: {
        focusedWidget: widgetRef,
      },
    },
  })
  const context = executor.createContext(
    {
      callId: 'call_custom_scatter',
      name: 'scatter.brushRegion',
      target: { widgetRef },
      params: {},
    },
    { name: 'scatter.brushRegion' },
  )

  assert.equal(context.targetWidget({ kind: 'scatter' })?.ref, widgetRef)
  assert.equal(context.targetWidget({ kind: 'bar' })?.ref, widgetRef)
  assert.throws(
    () => context.targetWidget({ kind: 'line' }),
    /No line-compatible target widget is available/,
  )
  assert.equal(Object.hasOwn(context, 'resolveTargetWidget'), false)
})

test('ActionExecutor handler context keeps target resolution simple', () => {
  const scatterRef = 'wl://demo/workspace/main/widget/scatter_a'
  const barRef = 'wl://demo/workspace/main/widget/bar_a'
  const executor = new ActionExecutor({
    store: {
      appId: 'demo',
      workspaceId: 'main',
      descriptions: {
        [scatterRef]: {
          ref: scatterRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          title: 'Scatter A',
        },
        [barRef]: {
          ref: barRef,
          widgetId: 'bar_a',
          kind: 'bar',
          title: 'Bar A',
        },
      },
      widgets: {
        [scatterRef]: {
          ref: scatterRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          version: 1,
        },
        [barRef]: {
          ref: barRef,
          widgetId: 'bar_a',
          kind: 'bar',
          version: 1,
        },
      },
      shared: {
        focusedWidget: scatterRef,
      },
    },
  })
  const context = executor.createContext(
    {
      callId: 'call_missing_explicit_target',
      name: 'scatter.zoomDomain',
      target: {
        widgetRef: 'wl://demo/workspace/main/widget/missing',
      },
      params: {},
    },
    { name: 'scatter.zoomDomain' },
  )

  assert.throws(
    () => context.targetWidget({ kind: 'scatter' }),
    /No scatter-compatible target widget is available/,
  )
  assert.equal(Object.hasOwn(context, 'resolveTargetWidget'), false)

  const mismatchContext = executor.createContext(
    {
      callId: 'call_wrong_kind_target',
      name: 'scatter.zoomDomain',
      target: { widgetRef: barRef },
      params: {},
    },
    { name: 'scatter.zoomDomain' },
  )

  assert.throws(
    () => mismatchContext.targetWidget({ kind: 'scatter' }),
    /No scatter-compatible target widget is available/,
  )
  assert.equal(Object.hasOwn(mismatchContext, 'resolveTargetWidget'), false)
})

test('ActionExecutor handler context does not guess among multiple same-kind widgets', () => {
  const scatterARef = 'wl://demo/workspace/main/widget/scatter_a'
  const scatterBRef = 'wl://demo/workspace/main/widget/scatter_b'
  const executor = new ActionExecutor({
    store: {
      appId: 'demo',
      workspaceId: 'main',
      descriptions: {
        [scatterARef]: {
          ref: scatterARef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          title: 'Scatter A',
        },
        [scatterBRef]: {
          ref: scatterBRef,
          widgetId: 'scatter_b',
          kind: 'scatter',
          title: 'Scatter B',
        },
      },
      widgets: {
        [scatterARef]: {
          ref: scatterARef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          version: 1,
        },
        [scatterBRef]: {
          ref: scatterBRef,
          widgetId: 'scatter_b',
          kind: 'scatter',
          version: 1,
        },
      },
      shared: {
        focusedWidget: null,
      },
    },
  })
  const context = executor.createContext(
    {
      callId: 'call_ambiguous_scatter',
      name: 'scatter.zoomDomain',
      params: {},
    },
    { name: 'scatter.zoomDomain' },
  )

  assert.throws(
    () => context.targetWidget({ kind: 'scatter' }),
    /No scatter-compatible target widget is available/,
  )
  assert.equal(Object.hasOwn(context, 'resolveTargetWidget'), false)
})

test('ActionExecutor owns workspace reset fallback', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const selectionRef = `${widgetRef}/selection/brush`
  const store = {
    appId: 'demo',
    workspaceId: 'main',
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        version: 1,
        data: {
          selectedCount: 2,
        },
        selections: {
          [selectionRef]: {
            kind: 'interval',
          },
        },
      },
    },
    stateId: 'main:s1',
    version: 1,
    shared: {
      selections: {
        registry: {
          [selectionRef]: {
            kind: 'interval',
          },
        },
        views: {
          primary: null,
          byWidget: {},
        },
      },
      focusedWidget: widgetRef,
      focus: {
        widgetRef,
        widgetId: 'scatter_a',
        source: 'workspace',
      },
      highlight: {
        entries: [{
          widgetRef,
          widgetId: 'scatter_a',
          highlightedKeys: ['USA'],
          inboundLinkIds: ['link://highlight'],
          highlightLinkIds: ['link://highlight'],
          linkedSourceRefs: [selectionRef],
        }],
        activeWidgetRefs: [widgetRef],
      },
    },
  }
  const executor = new ActionExecutor({ store })

  const nextState = executor.resetWorkspace()

  assert.deepEqual(store.shared.selections?.registry, {})
  assert.equal(store.shared.selections?.views?.primary, null)
  assert.deepEqual(store.shared.selections?.views?.byWidget, {})
  assert.equal(store.shared.focusedWidget, null)
  assert.equal(store.shared.focus, null)
  assert.equal(store.shared.highlight, null)
  assert.deepEqual(nextState.widgets?.[widgetRef]?.selections, {})
  assert.equal(nextState.widgets?.[widgetRef]?.data?.selectedCount, 0)
})

test('ActionExecutor generic widget actions update semantic state without requiring a provider base spec', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/bar_a'
  const dataRef = 'wl://demo/workspace/main/data/current_view'
  const store = {
    appId: 'demo',
    workspaceId: 'main',
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'bar_a',
        kind: 'bar',
        version: 1,
        data: {
          currentDataRef: dataRef,
        },
        transforms: [],
      },
    },
    shared: {
      focusedWidget: widgetRef,
    },
    runtimeData: {
      [dataRef]: {
        rows: [
          { id: 1, region: 'west' },
          { id: 2, region: 'east' },
          { id: 3, region: 'west' },
        ],
      },
    },
    stateId: 'main:s1',
    version: 1,
  }
  const executor = new ActionExecutor({ store })
  registerSharedWidgetRuntimeActions(executor)

  const result = await executor.run({
    callId: 'call_filter_without_spec',
    name: 'widget.filterByValues',
    target: { widgetRef },
    params: {
      field: 'region',
      values: ['west'],
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.updatedRefs, [widgetRef])
  assert.equal(store.widgets[widgetRef].transforms[0].kind, 'filter')
  assert.deepEqual(store.widgets[widgetRef].transforms[0].spec.predicates, [
    { field: 'region', op: 'in', value: ['west'] },
  ])
  assert.equal(store.widgets[widgetRef].data.visibleCount, 2)
})

test('ActionExecutor scatter.zoomDomain propagates from the target view zoom state ref', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const propagatedSources = []
  const store = {
    appId: 'demo',
    workspaceId: 'main',
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        version: 1,
        view: {},
      },
    },
    shared: {
      focusedWidget: widgetRef,
    },
    stateId: 'main:s1',
    version: 1,
  }
  const executor = new ActionExecutor({
    store,
    coordinationEngine: {
      propagate({ sourceRef, state }) {
        propagatedSources.push(sourceRef)
        return {
          nextState: state,
          affectedRefs: [],
          links: [],
          effects: [],
        }
      },
    },
  })
  registerScatterActions(executor)

  const result = await executor.run({
    callId: 'call_scatter_zoom',
    name: 'scatter.zoomDomain',
    target: { widgetRef },
    params: {
      xDomain: [3000, 4500],
      yDomain: [9000, 11000],
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.result.propagationSourceRef, `${widgetRef}/view/zoom`)
  assert.deepEqual(propagatedSources, [`${widgetRef}/view/zoom`])
  assert.deepEqual(store.widgets[widgetRef].view.xDomain, [3000, 4500])
  assert.deepEqual(store.widgets[widgetRef].view.yDomain, [9000, 11000])
})

test('ActionExecutor line.zoomXRegion propagates from the target view zoom state ref', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/line_a'
  const propagatedSources = []
  const store = {
    appId: 'demo',
    workspaceId: 'main',
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'line_a',
        kind: 'line',
        version: 1,
        view: {},
      },
    },
    shared: {
      focusedWidget: widgetRef,
    },
    stateId: 'main:s1',
    version: 1,
  }
  const executor = new ActionExecutor({
    store,
    coordinationEngine: {
      propagate({ sourceRef, state }) {
        propagatedSources.push(sourceRef)
        return {
          nextState: state,
          affectedRefs: [],
          links: [],
          effects: [],
        }
      },
    },
  })
  registerLineActions(executor)

  const result = await executor.run({
    callId: 'call_line_zoom',
    name: 'line.zoomXRegion',
    target: { widgetRef },
    params: {
      start: '2024-01-01',
      end: '2024-12-31',
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(propagatedSources, [`${widgetRef}/view/zoom`])
  assert.deepEqual(store.widgets[widgetRef].view.xDomain, ['2024-01-01', '2024-12-31'])
})

test('ActionExecutor bar.sortBars propagates from the target view sort state ref', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/bar_a'
  const propagatedSources = []
  const store = {
    appId: 'demo',
    workspaceId: 'main',
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'bar_a',
        kind: 'bar',
        version: 1,
        view: {},
        rawSpec: {
          mark: 'bar',
          encoding: {
            x: { field: 'region', type: 'nominal' },
            y: { field: 'visitors', type: 'quantitative' },
          },
        },
      },
    },
    shared: {
      focusedWidget: widgetRef,
    },
    stateId: 'main:s1',
    version: 1,
  }
  const executor = new ActionExecutor({
    store,
    coordinationEngine: {
      propagate({ sourceRef, state }) {
        propagatedSources.push(sourceRef)
        return {
          nextState: state,
          affectedRefs: [],
          links: [],
          effects: [],
        }
      },
    },
  })
  registerBarActions(executor)

  const result = await executor.run({
    callId: 'call_bar_sort',
    name: 'bar.sortBars',
    target: { widgetRef },
    params: {
      channel: 'y',
      order: 'descending',
      aggregate: 'sum',
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.result.propagationSourceRef, `${widgetRef}/view/sort`)
  assert.deepEqual(propagatedSources, [`${widgetRef}/view/sort`])
  assert.equal(store.widgets[widgetRef].view.sort.sourceAction, 'bar.sortBars')
  assert.equal(store.widgets[widgetRef].view.sort.channel, 'x')
  assert.equal(store.widgets[widgetRef].view.sort.categoryField, 'region')
  assert.equal(store.widgets[widgetRef].view.sort.sortField, 'visitors')
  assert.equal(store.widgets[widgetRef].view.sort.order, 'descending')
})

test('ActionExecutor widget.resetView clears target widget view state', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/line_a'
  const selectionRef = `${widgetRef}/selection/s1`
  const store = {
    appId: 'demo',
    workspaceId: 'main',
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'line_a',
        kind: 'line',
        version: 1,
        transforms: [{ kind: 'filter', spec: { actionName: 'line.filterLines' } }],
        selections: {
          [selectionRef]: {
            selectionRef,
            selectionId: 's1',
            sourceWidgetRef: widgetRef,
            field: 'region',
            values: ['Downtown'],
          },
        },
        feedback: { highlightedKeys: ['Downtown'] },
        view: {
          xDomain: ['2024-01-01', '2024-03-01'],
          zoom: { sourceAction: 'line.zoomXRegion' },
        },
        data: {
          rowCount: 4,
          visibleCount: 2,
          selectedCount: 2,
        },
      },
    },
    shared: {
      focusedWidget: widgetRef,
      selections: {
        registry: {
          [selectionRef]: {
            selectionRef,
            selectionId: 's1',
            sourceWidgetRef: widgetRef,
            field: 'region',
            values: ['Downtown'],
          },
        },
        views: {
          primary: { selectionRef },
          byWidget: {
            line_a: { selectionRef },
          },
        },
      },
    },
    stateId: 'main:s1',
    version: 1,
  }
  const executor = new ActionExecutor({ store })
  registerSharedWidgetRuntimeActions(executor)

  const result = await executor.run({
    callId: 'call_reset_view',
    name: 'widget.resetView',
    target: { widgetRef },
    params: {},
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.result.propagationSourceRefs, [
    selectionRef,
    `${widgetRef}/view/zoom`,
  ])
  assert.deepEqual(store.widgets[widgetRef].view, {})
  assert.deepEqual(store.widgets[widgetRef].transforms, [])
  assert.deepEqual(store.widgets[widgetRef].selections, {})
  assert.deepEqual(store.widgets[widgetRef].feedback, {})
  assert.equal(store.widgets[widgetRef].data.visibleCount, 4)
  assert.equal(store.widgets[widgetRef].data.selectedCount, 0)
  assert.deepEqual(store.shared.selections.registry, {})
  assert.equal(store.shared.selections.views.primary, null)
})

test('ActionExecutor widget.undoView restores the previous runtime state snapshot', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/line_a'
  const previousState = {
    stateId: 'main:s1',
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'line_a',
        kind: 'line',
        version: 1,
        view: {},
        transforms: [],
        selections: {},
        data: { visibleCount: 4 },
      },
    },
    shared: { focusedWidget: widgetRef },
  }
  const currentState = {
    stateId: 'main:s2',
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'line_a',
        kind: 'line',
        version: 2,
        view: { xDomain: ['2024-01-01', '2024-03-01'] },
        transforms: [],
        selections: {},
        data: { visibleCount: 2 },
      },
    },
    shared: { focusedWidget: widgetRef },
  }
  const store = {
    appId: 'demo',
    workspaceId: 'main',
    ...currentState,
    stateSnapshots: [
      { stateId: previousState.stateId, state: previousState },
      { stateId: currentState.stateId, state: currentState },
    ],
  }
  const executor = new ActionExecutor({ store })
  registerSharedWidgetRuntimeActions(executor)

  const result = await executor.run({
    callId: 'call_undo_view',
    name: 'widget.undoView',
    target: { widgetRef },
    params: {},
  })

  assert.equal(result.ok, true)
  assert.deepEqual(store.widgets[widgetRef].view, {})
  assert.equal(store.stateId, previousState.stateId)
  assert.equal(result.result.restoredStateId, previousState.stateId)
})

test('ActionExecutor restores replay context through the host bridge before syncing', () => {
  const calls = []
  const hostBridge = {
    writeCurrentSpec(value, options) {
      calls.push(['writeCurrentSpec', value, options])
    },
    writeWorkspaceSpec(value) {
      calls.push(['writeWorkspaceSpec', value])
    },
    writePlanningRequest(value) {
      calls.push(['writePlanningRequest', value])
    },
    writeRunMode(value) {
      calls.push(['writeRunMode', value])
    },
    writeUserIntent(value) {
      calls.push(['writeUserIntent', value])
    },
    resetSelectionHistory() {
      calls.push(['resetSelectionHistory'])
    },
    writeCurrentSelections(value, options) {
      calls.push(['writeCurrentSelections', value, options])
    },
    setFocusedWidgetRef(value) {
      calls.push(['setFocusedWidgetRef', value])
    },
  }
  const executor = new ActionExecutor({
    store: {
      resetWidgetPatches() {},
      readState() {
        return { stateId: 'main:synced' }
      },
    },
    hostBridge,
    sync() {
      calls.push(['sync'])
    },
  })
  const replayContext = {
    baselineSpec: { title: 'baseline' },
    currentSpec: { title: 'current' },
    workspaceSpec: { widgets: [{ widgetId: 'scatter' }] },
    planningRequest: { runMode: 'goal_oriented', task: { taskId: 't1' } },
    runMode: 'open_ended',
    userIntent: 'compare distributions',
  }

  const restoredState = executor.restoreSnapshotState({
    state: {
      widgets: {
        scatter: {
          rawSpec: { title: 'restored' },
        },
      },
      shared: {
        focusedWidget: 'scatter',
      },
    },
    replayContext,
  })

  assert.equal(restoredState.stateId, 'main:synced')
  assert.deepEqual(calls.slice(0, 10), [
    ['writeCurrentSpec', replayContext.baselineSpec, { replaceBaseline: true, trackHistory: false }],
    ['writeWorkspaceSpec', replayContext.workspaceSpec],
    ['writePlanningRequest', replayContext.planningRequest],
    ['writeRunMode', replayContext.runMode],
    ['writeUserIntent', replayContext.userIntent],
    ['writeCurrentSpec', { title: 'restored' }, { trackHistory: false }],
    ['resetSelectionHistory'],
    ['writeCurrentSelections', {}, { fallbackSelection: null, trackHistory: false }],
    ['setFocusedWidgetRef', 'scatter'],
    ['sync'],
  ])
})
