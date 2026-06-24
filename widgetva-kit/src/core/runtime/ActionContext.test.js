import test from 'node:test'
import assert from 'node:assert/strict'

import { ActionContext } from './ActionContext.js'
import { WidgetVARuntimeStore } from './RuntimeStore.js'

test('ActionContext.describeContract exposes the shared context summary contract', () => {
  const contract = ActionContext.describeContract()

  assert.equal(Array.isArray(contract.methods), true)
  assert.equal(contract.methods.includes('patchWidget'), true)
  assert.equal(contract.methods.includes('readWidgetAdapter'), true)
  assert.equal(contract.capabilities.workspaceWrite, true)
  assert.equal(contract.integrations.store, true)
})

test('ActionContext.readWidgetAdapter resolves the adapter for the current target widget', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const adapter = { widgetRef, applyEncodingChange() {} }
  const context = new ActionContext({
    store: {
      getResolvedWidgetForTarget(ref) {
        return ref === widgetRef ? { ref: widgetRef, widgetId: 'scatter_a', kind: 'scatter' } : null
      },
      getWidgetAdapter(ref) {
        return ref === widgetRef ? adapter : null
      },
      listWidgetDescriptions() {
        return [{ ref: widgetRef, widgetId: 'scatter_a', kind: 'scatter' }]
      },
      readState() {
        return {
          widgets: {},
          shared: {
            focusedWidget: widgetRef,
          },
        }
      },
    },
    descriptor: { name: 'widget.changeEncoding' },
    call: {
      callId: 'call_adapter',
      name: 'widget.changeEncoding',
      targetRef: widgetRef,
      params: {},
    },
    sync() {},
    getAppState() {
      return {}
    },
    linkEngine: null,
  })

  assert.equal(context.readWidgetAdapter(), adapter)
})

test('ActionContext resolves target widgets and runtime rows from plain RuntimeStore record facades', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const dataRef = 'wl://demo/workspace/main/data/current_view'
  const adapter = { widgetRef, applyEncodingChange() {} }
  const context = new ActionContext({
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
      getWidgetAdapter(ref) {
        return ref === widgetRef ? adapter : null
      },
    },
    descriptor: { name: 'widget.changeEncoding' },
    call: {
      callId: 'call_plain_store',
      name: 'widget.changeEncoding',
      targetRef: widgetRef,
      params: {},
    },
    sync() {},
    getAppState() {
      return {}
    },
    linkEngine: null,
  })

  const targetWidget = context.resolveTargetWidget()
  const rowResult = context.readRowsForWidget(widgetRef)

  assert.equal(targetWidget?.ref, widgetRef)
  assert.deepEqual(rowResult, {
    dataRef,
    rows: [{ id: 1 }, { id: 2 }],
  })
  assert.equal(context.readWidgetAdapter(), adapter)
})

test('ActionContext.patchWidget and updateRuntimeData support plain RuntimeStore record facades', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const dataRef = 'wl://demo/workspace/main/data/current_view'
  const store = {
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
        view: {},
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
  }
  const context = new ActionContext({
    store,
    descriptor: { name: 'widget.zoomDomain' },
    call: {
      callId: 'call_plain_store_write',
      name: 'widget.zoomDomain',
      targetRef: widgetRef,
      params: {},
    },
    sync() {},
    getAppState() {
      return {}
    },
    linkEngine: null,
  })

  const initialStateId = store.stateId
  const patchedState = context.patchWidget(widgetRef, {
    view: {
      zoomLevel: 2,
    },
  })
  const runtimeData = context.updateRuntimeData(dataRef, (entry) => ({
    ...entry,
    rows: [...entry.rows, { id: 3 }],
  }))
  const statePatch = context.readStatePatch([widgetRef])

  assert.equal(store.widgets[widgetRef]?.version, 2)
  assert.equal(store.widgets[widgetRef]?.view?.zoomLevel, 2)
  assert.equal(store.version, 2)
  assert.notEqual(store.stateId, initialStateId)
  assert.equal(patchedState.widgets?.[widgetRef]?.view?.zoomLevel, 2)
  assert.deepEqual(runtimeData?.rows, [{ id: 1 }, { id: 2 }, { id: 3 }])
  assert.deepEqual(statePatch?.[widgetRef]?.view, { zoomLevel: 2 })
})

test('ActionContext.setFocusedWidgetRef falls back to plain RuntimeStore shared state when no app-state bridge is installed', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const store = {
    appId: 'demo',
    workspaceId: 'main',
    descriptions: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        title: 'Scatter A',
      },
    },
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        version: 1,
      },
    },
    stateId: 'main:s1',
    version: 1,
    shared: {
      focusedWidget: null,
    },
  }
  const context = new ActionContext({
    store,
    descriptor: null,
    call: null,
    sync() {},
    getAppState() {
      return {}
    },
    linkEngine: null,
  })

  const nextState = context.setFocusedWidgetRef(widgetRef)

  assert.equal(store.shared.focusedWidget, widgetRef)
  assert.deepEqual(store.shared.focus, {
    widgetRef,
    widgetId: 'scatter_a',
    source: 'workspace',
  })
  assert.equal(store.version, 2)
  assert.notEqual(store.stateId, 'main:s1')
  assert.equal(nextState.shared?.focusedWidget, widgetRef)
  assert.deepEqual(nextState.shared?.focus, {
    widgetRef,
    widgetId: 'scatter_a',
    source: 'workspace',
  })
})

test('ActionContext.resetWorkspace falls back to clearing interaction state on plain RuntimeStore facades', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const selectionRef = `${widgetRef}/selection/brush`
  const store = {
    appId: 'demo',
    workspaceId: 'main',
    descriptions: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        title: 'Scatter A',
      },
    },
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
      globalFilters: {
        region: 'west',
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
  const context = new ActionContext({
    store,
    descriptor: { name: 'workspace.resetWorkspace' },
    call: {
      callId: 'call_reset_workspace',
      name: 'workspace.resetWorkspace',
      params: {},
    },
    sync() {},
    getAppState() {
      return {}
    },
    linkEngine: null,
  })

  const nextState = context.resetWorkspace()

  assert.deepEqual(store.shared.selections?.registry, {})
  assert.equal(store.shared.selections?.views?.primary, null)
  assert.deepEqual(store.shared.selections?.views?.byWidget, {})
  assert.equal(store.shared.focusedWidget, null)
  assert.equal(store.shared.focus, null)
  assert.equal(store.shared.highlight, null)
  assert.deepEqual(nextState.shared?.selections?.registry, {})
  assert.equal(nextState.shared?.selections?.views?.primary, null)
  assert.deepEqual(nextState.shared?.selections?.views?.byWidget, {})
  assert.equal(nextState.shared?.focusedWidget, null)
  assert.equal(nextState.shared?.focus, null)
  assert.equal(nextState.shared?.highlight, null)
  assert.deepEqual(nextState.widgets?.[widgetRef]?.selections, {})
  assert.equal(nextState.widgets?.[widgetRef]?.data?.selectedCount, 0)
})

test('ActionContext.commitSelectionFallback writes a canonical primary selection view', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const store = {
    appId: 'demo',
    workspaceId: 'main',
    descriptions: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        title: 'Scatter A',
      },
    },
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        version: 1,
        selections: {},
        data: {
          sourceDataRef: 'wl://demo/workspace/main/data/current_view',
          currentDataRef: 'wl://demo/workspace/main/data/current_view',
        },
      },
    },
    stateId: 'main:s1',
    version: 1,
    shared: {
      focusedWidget: null,
      selections: {
        registry: {},
        views: {
          primary: null,
          byWidget: {},
        },
      },
    },
  }
  const context = new ActionContext({
    store,
    descriptor: { name: 'scatter.brushRegion' },
    call: {
      callId: 'call_commit_selection',
      name: 'scatter.brushRegion',
      targetRef: widgetRef,
      params: {},
    },
    sync() {},
    getAppState() {
      return {}
    },
    linkEngine: null,
  })

  context.commitSelection({
    selection_id: 'brush',
    kind: 'interval',
    summary: 'Horsepower 80-120',
    predicates: [{ field: 'Horsepower', op: 'between', value: [80, 120] }],
    count: 5,
  })

  assert.deepEqual(store.shared.selections?.views?.primary, {
    selectionRef: `${widgetRef}/selection/brush`,
    selectionId: 'brush',
    sourceWidgetRef: widgetRef,
    sourceWidgetId: 'scatter_a',
    summary: 'Horsepower 80-120',
    predicates: [{ field: 'Horsepower', op: 'between', value: [80, 120] }],
    selectionDataRef: null,
    scope: 'local',
    kind: 'interval',
    fields: [],
    value: {},
    domain: null,
    aggregateName: null,
  })
  assert.equal(store.shared.focusedWidget, widgetRef)
})

test('ActionContext.readSnapshot falls back to readSnapshotEntry when readSnapshot is unavailable', () => {
  const context = new ActionContext({
    store: {
      readSnapshotEntry(stateId) {
        if (stateId !== 'main:s2') return null
        return {
          state: {
            stateId: 'main:s2',
            shared: {
              focusedWidget: 'scatter',
            },
          },
        }
      },
    },
    descriptor: null,
    call: null,
    sync() {},
    getAppState() {
      return {}
    },
    linkEngine: null,
  })

  assert.deepEqual(context.readSnapshot('main:s2'), {
    stateId: 'main:s2',
    shared: {
      focusedWidget: 'scatter',
    },
    replayContext: null,
  })
})

test('ActionContext.readSnapshotEntry falls back to plain stateSnapshots facades', () => {
  const context = new ActionContext({
    store: {
      stateSnapshots: [
        {
          stateId: 'main:s2',
          parentStateId: 'main:s1',
          branchId: 'branch_what_if',
          branchLabel: 'What If',
          transitionType: 'branch',
          replayContext: {
            runMode: 'benchmark',
          },
          state: {
            stateId: 'main:s2',
            shared: {
              focusedWidget: 'scatter',
            },
          },
        },
      ],
    },
    descriptor: null,
    call: null,
    sync() {},
    getAppState() {
      return {}
    },
    linkEngine: null,
  })

  const entry = context.readSnapshotEntry('main:s2')
  const snapshot = context.readSnapshot('main:s2')

  assert.equal(entry?.stateId, 'main:s2')
  assert.equal(entry?.branchLabel, 'What If')
  assert.equal(snapshot?.shared?.focusedWidget, 'scatter')
})

test('ActionContext.restoreSnapshotState restores replay context into app state before syncing', () => {
  const calls = []
  const appState = {
    setCurrentSpec(value, options) {
      calls.push(['setCurrentSpec', value, options])
    },
    setWorkspaceSpec(value) {
      calls.push(['setWorkspaceSpec', value])
    },
    setPlanningRequest(value) {
      calls.push(['setPlanningRequest', value])
    },
    setRunMode(value) {
      calls.push(['setRunMode', value])
    },
    setUserIntent(value) {
      calls.push(['setUserIntent', value])
    },
    resetSelectionHistory() {
      calls.push(['resetSelectionHistory'])
    },
    setCurrentSelections(value, options) {
      calls.push(['setCurrentSelections', value, options])
    },
    setFocusedWidgetRef(value) {
      calls.push(['setFocusedWidgetRef', value])
    },
    setWorkspaceAnnotations(value) {
      calls.push(['setWorkspaceAnnotations', value])
    },
  }
  const hostBridge = {
    subscribe() {
      return () => {}
    },
    readCurrentSpec() {
      return null
    },
    readBaselineSpec() {
      return null
    },
    readFocusedWidgetRef() {
      return null
    },
    readWorkspaceAnnotations() {
      return []
    },
    writeCurrentSpec: appState.setCurrentSpec,
    writeWorkspaceSpec: appState.setWorkspaceSpec,
    writePlanningRequest: appState.setPlanningRequest,
    writeRunMode: appState.setRunMode,
    writeUserIntent: appState.setUserIntent,
    resetSelectionHistory: appState.resetSelectionHistory,
    writeCurrentSelections: appState.setCurrentSelections,
    setFocusedWidgetRef: appState.setFocusedWidgetRef,
    setWorkspaceAnnotations: appState.setWorkspaceAnnotations,
  }

  const context = new ActionContext({
    store: {
      resetWidgetPatches() {},
      readState() {
        return { stateId: 'main:synced' }
      },
    },
    descriptor: null,
    call: null,
    hostBridge,
    sync() {
      calls.push(['sync'])
    },
    linkEngine: null,
    helpers: {
      primaryWidgetSpecFromSnapshot(snapshot) {
        return snapshot?.widgets?.scatter?.rawSpec || null
      },
      selectionPayloadFromSnapshot() {
        return null
      },
      selectionPayloadsFromSnapshot() {
        return {}
      },
      annotationsFromSnapshot(snapshot) {
        return snapshot?.shared?.annotations || []
      },
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
  const snapshotEntry = {
    state: {
      widgets: {
        scatter: {
          rawSpec: { title: 'restored' },
        },
      },
      shared: {
        focusedWidget: 'scatter',
        annotations: [{ annotationId: 'a1', text: 'note' }],
      },
    },
    replayContext,
  }

  const restoredState = context.restoreSnapshotState(snapshotEntry)

  assert.equal(restoredState.stateId, 'main:synced')
  assert.deepEqual(calls.slice(0, 11), [
    ['setCurrentSpec', replayContext.baselineSpec, { replaceBaseline: true, trackHistory: false }],
    ['setWorkspaceSpec', replayContext.workspaceSpec],
    ['setPlanningRequest', replayContext.planningRequest],
    ['setRunMode', replayContext.runMode],
    ['setUserIntent', replayContext.userIntent],
    ['setCurrentSpec', { title: 'restored' }, { trackHistory: false }],
    ['resetSelectionHistory'],
    ['setCurrentSelections', {}, { fallbackSelection: null, trackHistory: false }],
    ['setFocusedWidgetRef', 'scatter'],
    ['setWorkspaceAnnotations', [{ annotationId: 'a1', text: 'note' }]],
    ['sync'],
  ])
})

test('ActionContext.restoreSnapshotState falls back to restoring widget/shared state on plain RuntimeStore facades', () => {
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
        data: {
          selectedCount: 0,
        },
        selections: {},
      },
    },
    stateId: 'main:s1',
    version: 1,
    shared: {
      selections: {
        registry: {},
        views: {
          primary: null,
          byWidget: {},
        },
      },
      globalFilters: {},
      focusedWidget: null,
    },
  }

  const context = new ActionContext({
    store,
    descriptor: null,
    call: null,
    sync() {},
    getAppState() {
      return {}
    },
    linkEngine: null,
  })

  const restoredState = context.restoreSnapshotState({
    state: {
      widgets: {
        [widgetRef]: {
          ref: widgetRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          version: 5,
          data: {
            selectedCount: 3,
          },
          selections: {
            [`${widgetRef}/selection/brush`]: {
              kind: 'interval',
            },
          },
        },
      },
      shared: {
        selections: {
          registry: {
            [`${widgetRef}/selection/brush`]: {
              kind: 'interval',
            },
          },
          views: {
            primary: null,
            byWidget: {},
          },
        },
        globalFilters: {
          region: 'west',
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
            linkedSourceRefs: [`${widgetRef}/selection/brush`],
          }],
          activeWidgetRefs: [widgetRef],
        },
      },
    },
  })

  assert.equal(store.widgets[widgetRef]?.data?.selectedCount, 3)
  assert.equal(store.shared.focusedWidget, widgetRef)
  assert.equal(store.shared.globalFilters?.region, 'west')
  assert.equal(store.shared.selections?.registry?.[`${widgetRef}/selection/brush`]?.kind, 'interval')
  assert.deepEqual(store.shared.focus, {
    widgetRef,
    widgetId: 'scatter_a',
    source: 'workspace',
  })
  assert.deepEqual(store.shared.highlight, {
    entries: [{
      widgetRef,
      widgetId: 'scatter_a',
      selectionRef: null,
      sourceWidgetRef: null,
      sourceWidgetId: null,
      summary: null,
      predicates: [],
      highlightedKeys: ['USA'],
      inboundLinkIds: ['link://highlight'],
      highlightLinkIds: ['link://highlight'],
      linkedSourceRefs: [`${widgetRef}/selection/brush`],
    }],
    activeWidgetRefs: [widgetRef],
  })
  assert.equal(restoredState.widgets?.[widgetRef]?.data?.selectedCount, 3)
  assert.equal(restoredState.shared?.focusedWidget, widgetRef)
  assert.equal(restoredState.shared?.selections?.registry?.[`${widgetRef}/selection/brush`]?.kind, 'interval')
  assert.deepEqual(restoredState.shared?.focus, {
    widgetRef,
    widgetId: 'scatter_a',
    source: 'workspace',
  })
  assert.deepEqual(restoredState.shared?.highlight, {
    entries: [{
      widgetRef,
      widgetId: 'scatter_a',
      selectionRef: null,
      sourceWidgetRef: null,
      sourceWidgetId: null,
      summary: null,
      predicates: [],
      highlightedKeys: ['USA'],
      inboundLinkIds: ['link://highlight'],
      highlightLinkIds: ['link://highlight'],
      linkedSourceRefs: [`${widgetRef}/selection/brush`],
    }],
    activeWidgetRefs: [widgetRef],
  })
})

test('ActionContext.commitSelection falls back to direct RuntimeStore mutation when no app-state bridge is installed', () => {
  const store = new WidgetVARuntimeStore({ appId: 'demo', workspaceId: 'main' })
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'

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
    version: 1,
    data: {
      sourceDataRef: 'wl://demo/workspace/main/data/cars',
      currentDataRef: 'wl://demo/workspace/main/data/cars',
      selectedCount: 0,
    },
    selections: {},
    view: {},
  }

  const context = new ActionContext({
    store,
    descriptor: { name: 'scatter.brushRegion' },
    call: {
      callId: 'call_selection',
      name: 'scatter.brushRegion',
      targetRef: widgetRef,
      params: {},
    },
    sync() {},
    getAppState() {
      return {}
    },
    linkEngine: null,
  })

  const nextState = context.commitSelection({
    selection_id: 'brush',
    source_widget_id: 'scatter_a',
    selection_type: 'interval',
    fields: ['Horsepower', 'MPG'],
    value: {
      Horsepower: [60, 120],
      MPG: [20, 40],
    },
    domain: {
      xDomain: [60, 120],
      yDomain: [20, 40],
    },
    count: 2,
    summary: 'Horsepower 60~120; MPG 20~40',
  })

  const selectionRef = `${widgetRef}/selection/brush`

  assert.equal(nextState.widgets?.[widgetRef]?.selections?.[selectionRef]?.kind, 'interval')
  assert.deepEqual(nextState.widgets?.[widgetRef]?.selections?.[selectionRef]?.value, {
    Horsepower: [60, 120],
    MPG: [20, 40],
  })
  assert.equal(nextState.widgets?.[widgetRef]?.data?.selectedCount, 2)
  assert.equal(nextState.shared?.focusedWidget, widgetRef)
  assert.equal(nextState.shared?.selections?.registry?.[selectionRef]?.kind, 'interval')
  assert.equal(nextState.shared?.selections?.views?.primary?.kind, 'interval')
  assert.equal(nextState.shared?.selections?.views?.byWidget?.scatter_a?.kind, 'interval')
  assert.equal(nextState.shared?.selections?.views?.byWidget?.scatter_a?.selectionRef, selectionRef)
})
