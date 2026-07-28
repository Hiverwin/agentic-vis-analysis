import test from 'node:test'
import assert from 'node:assert/strict'

import {
  makeCurrentSelectionDataRef,
  makeCurrentViewDataRef,
  makeSelectionRef,
  makeSelectionScopedDataRef,
  makeWidgetRef,
  makeWidgetSelectionDataRef,
} from '../../contracts/refs-contracts.js'
import { makeWorkspaceState } from '../../contracts/state-contracts.js'
import { WidgetVARuntimeStore } from './RuntimeStore.js'

test('WidgetVARuntimeStore.listStateSnapshots exposes changed replayContext refs', () => {
  const store = new WidgetVARuntimeStore()
  store.replayContext = {
    runMode: 'goal_oriented',
    userIntent: 'compare cohorts',
  }

  const nextState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {},
    shared: {},
  })

  store.commitState(nextState)
  const history = store.listStateSnapshots(5)

  assert.equal(history.length, 1)
  assert.ok(Array.isArray(history[0].changedRefs))
  assert.ok(history[0].changedRefs.includes('replayContext'))
  const summary = store.describeStore().currentStateSummary
  assert.equal(summary?.replayRunMode, 'goal_oriented')
  assert.equal(summary?.replayUserIntent, 'compare cohorts')
})

test('WidgetVARuntimeStore.readState returns replayContext in full and ref-scoped reads', () => {
  const store = new WidgetVARuntimeStore()
  store.replayContext = {
    runMode: 'goal_oriented',
    userIntent: 'compare cohorts',
  }

  store.commitState(makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      'wl://widgetva-app/workspace/main/widget/scatter_a': {
        ref: 'wl://widgetva-app/workspace/main/widget/scatter_a',
        widgetId: 'scatter_a',
        kind: 'scatter',
        version: 1,
      },
    },
    shared: {},
  }))

  const fullState = store.readState()
  const scopedState = store.readState({ refs: ['replayContext'] })

  assert.equal(fullState.replayContext?.runMode, 'goal_oriented')
  assert.equal(fullState.replayContext?.userIntent, 'compare cohorts')
  assert.equal(scopedState.replayContext?.runMode, 'goal_oriented')
  assert.deepEqual(scopedState.widgets, {})
  assert.equal('shared' in scopedState, false)
})

test('WidgetVARuntimeStore exposes mutable manual-assembly facades for descriptions, widgets, dataHandles, and links', () => {
  const store = new WidgetVARuntimeStore({ appId: 'demo', workspaceId: 'main' })
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const dataRef = 'wl://demo/workspace/main/data/cars'
  const linkRef = 'wl://demo/workspace/main/link/scatter_to_bar'

  store.descriptions[widgetRef] = {
    kind: 'scatter',
    widgetId: 'scatter_a',
    title: 'Scatter A',
    actionNames: ['scatter.brushRegion'],
    perceptionQueryNames: ['perception.summarizeVisible'],
  }
  store.widgets[widgetRef] = {
    widgetId: 'scatter_a',
    kind: 'scatter',
    version: 1,
    data: {
      sourceDataRef: dataRef,
      currentDataRef: dataRef,
    },
  }
  store.dataHandles[dataRef] = {
    title: 'Cars',
    supportedQueries: ['summary'],
  }
  store.links[linkRef] = {
    kind: 'filters',
    from: widgetRef,
    to: 'wl://demo/workspace/main/widget/bar_b',
  }

  assert.equal(store.readDescription().widgets[0]?.ref, widgetRef)
  assert.equal(store.readDescription().dataHandles[0]?.ref, dataRef)
  assert.equal(store.readDescription().links[0]?.ref, linkRef)
  assert.equal(store.readState().widgets?.[widgetRef]?.ref, widgetRef)
  assert.notEqual(store.stateId, 'main:empty')
  assert.equal(store.listStateSnapshots(5).some((entry) => entry.changedRefs.includes(widgetRef)), true)
  assert.equal(store.listWidgetDescriptions()[0]?.title, 'Scatter A')
  assert.equal(store.listDataHandles()[0]?.title, 'Cars')
  assert.equal(store.listLinks()[0]?.kind, 'filter')
  assert.equal(store.getLink(linkRef)?.kind, 'filter')
  assert.equal(store.getResolvedWidgetForTarget(dataRef)?.ref, widgetRef)
})

test('WidgetVARuntimeStore.upsertWidgetDescription normalizes raw widget descriptions into protocol contract shape', () => {
  const store = new WidgetVARuntimeStore({ appId: 'demo', workspaceId: 'main' })
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'

  store.descriptions[widgetRef] = {
    widgetId: 'scatter_a',
    kind: 'scatter',
    title: 'Scatter A',
  }

  assert.equal(store.readDescription().widgets[0]?.role, 'primary')
  assert.deepEqual(store.readDescription().widgets[0]?.analyticRoles, [])
  assert.deepEqual(store.readDescription().widgets[0]?.actionNames, [])
  assert.equal(store.listWidgetDescriptions()[0]?.role, 'primary')
  assert.equal(store.getWidgetDescription(widgetRef)?.role, 'primary')
})

test('WidgetVARuntimeStore.listLinks includes canonical coordination relations from state', () => {
  const store = new WidgetVARuntimeStore({ appId: 'demo', workspaceId: 'main' })
  const scatterRef = makeWidgetRef({ appId: 'demo', workspaceId: 'main', widgetId: 'scatter_a' })
  const barRef = makeWidgetRef({ appId: 'demo', workspaceId: 'main', widgetId: 'bar_b' })
  const relationRef = 'wl://demo/workspace/main/coordination/scatter_zoom_to_bar_filter'
  const sourceStateRef = `${scatterRef}/view/zoom`
  const targetStateRef = `${barRef}/transform/marketing-spend-filter`

  store.commitState(makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [scatterRef]: { ref: scatterRef, widgetId: 'scatter_a', kind: 'scatter' },
      [barRef]: { ref: barRef, widgetId: 'bar_b', kind: 'bar' },
    },
    shared: {},
    coordination: {
      relations: {
        [relationRef]: {
          ref: relationRef,
          sourceStateRef,
          targetStateRef,
          relation: 'controls',
          transform: {
            kind: 'domainToFilter',
            channelMapping: [
              { sourceChannel: 'x', targetField: 'marketing_spend' },
            ],
          },
          activation: 'automatic',
        },
      },
    },
  }))

  const links = store.listLinks()

  assert.equal(links.length, 1)
  assert.equal(links[0]?.ref, relationRef)
  assert.equal(links[0]?.sourceStateRef, sourceStateRef)
  assert.equal(links[0]?.targetStateRef, targetStateRef)
  assert.equal(links[0]?.transform?.kind, 'domainToFilter')
})

test('WidgetVARuntimeStore removes a canonical relation even without a legacy link registry entry', () => {
  const store = new WidgetVARuntimeStore({ appId: 'demo', workspaceId: 'main' })
  const relationRef = 'wl://demo/workspace/main/coordination/scatter_zoom_to_bar_filter'

  store.commitState(makeWorkspaceState({
    stateId: 'main:s1',
    widgets: {},
    shared: {},
    coordination: {
      relations: {
        [relationRef]: {
          ref: relationRef,
          sourceStateRef: 'wl://demo/workspace/main/widget/scatter_a/view/zoom',
          targetStateRef: 'wl://demo/workspace/main/widget/bar_b/transform/filter',
          relation: 'controls',
          transform: { kind: 'domainToFilter' },
          activation: 'automatic',
        },
      },
    },
  }))

  store.removeLinkDefinition(relationRef)

  assert.deepEqual(store.readState().coordination.relations, {})
  assert.deepEqual(store.listLinks(), [])
})

test('WidgetVARuntimeStore.upsertDataHandle normalizes raw data handles into protocol contract shape', () => {
  const store = new WidgetVARuntimeStore({ appId: 'demo', workspaceId: 'main' })
  const dataRef = 'wl://demo/workspace/main/data/cars'

  store.upsertDataHandle(dataRef, {
    ref: dataRef,
    title: 'Cars',
  })

  assert.equal(store.getDataHandle(dataRef)?.sourceKind, 'inline')
  assert.equal(store.getDataHandle(dataRef)?.kind, 'dataView')
  assert.equal(store.getDataHandle(dataRef)?.scope, 'workspace')
  assert.deepEqual(store.getDataHandle(dataRef)?.schema, { fields: [] })
  assert.deepEqual(store.getDataHandle(dataRef)?.stats, {})
  assert.deepEqual(store.getDataHandle(dataRef)?.supportedQueries, ['sampleRows', 'summary'])
  assert.deepEqual(store.getDataHandle(dataRef)?.supportedQueryDescriptors, [])
  assert.equal(store.readDescription().dataHandles[0]?.sourceKind, 'inline')
})

test('WidgetVARuntimeStore keeps same-name descriptors for different widget targets', () => {
  const store = new WidgetVARuntimeStore({ appId: 'demo', workspaceId: 'main' })
  const scatterARef = 'wl://demo/workspace/main/widget/scatter_a'
  const scatterBRef = 'wl://demo/workspace/main/widget/scatter_b'

  store.upsertActionDescriptor('scatter.brushRegion', {
    name: 'scatter.brushRegion',
    targetRef: scatterARef,
    title: 'Brush scatter A',
  })
  store.upsertActionDescriptor('scatter.brushRegion', {
    name: 'scatter.brushRegion',
    targetRef: scatterBRef,
    title: 'Brush scatter B',
  })
  store.upsertActionDescriptor('scatter.brushRegion', {
    name: 'scatter.brushRegion',
    targetRef: scatterBRef,
    title: 'Brush scatter B updated',
  })

  assert.equal(store.listActions().length, 2)
  assert.equal(store.getActionDescriptor('scatter.brushRegion', scatterARef)?.title, 'Brush scatter A')
  assert.equal(store.getActionDescriptor('scatter.brushRegion', scatterBRef)?.title, 'Brush scatter B updated')

  store.upsertPerceptionDescriptor('perception.summarizeVisible', {
    name: 'perception.summarizeVisible',
    targetRef: scatterARef,
    title: 'Summarize scatter A',
  })
  store.upsertPerceptionDescriptor('perception.summarizeVisible', {
    name: 'perception.summarizeVisible',
    targetRef: scatterBRef,
    title: 'Summarize scatter B',
  })
  store.upsertPerceptionDescriptor('perception.summarizeVisible', {
    name: 'perception.summarizeVisible',
    targetRef: scatterARef,
    title: 'Summarize scatter A updated',
  })

  assert.equal(store.listPerceptionQueries().length, 2)
  assert.equal(store.getPerceptionDescriptor('perception.summarizeVisible', scatterARef)?.title, 'Summarize scatter A updated')
  assert.equal(store.getPerceptionDescriptor('perception.summarizeVisible', scatterBRef)?.title, 'Summarize scatter B')
})

test('WidgetVARuntimeStore exposes registerWidget and registerLink helpers for manual assembly', () => {
  const store = new WidgetVARuntimeStore({ appId: 'demo', workspaceId: 'main' })
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const dataRef = 'wl://demo/workspace/main/data/cars'
  const linkRef = 'wl://demo/workspace/main/link/scatter_to_bar'
  const initialVersion = store.version
  const initialStateId = store.stateId

  store.registerWidget(
    {
      ref: widgetRef,
      kind: 'scatter',
      widgetId: 'scatter_a',
      title: 'Scatter A',
      actionNames: ['scatter.brushRegion'],
      perceptionQueryNames: ['perception.summarizeVisible'],
    },
    {
      ref: widgetRef,
      widgetId: 'scatter_a',
      kind: 'scatter',
      version: 1,
      data: {
        sourceDataRef: dataRef,
        currentDataRef: dataRef,
      },
    },
  )

  assert.equal(store.readDescription().widgets[0]?.ref, widgetRef)
  assert.equal(store.readState().widgets?.[widgetRef]?.ref, widgetRef)
  assert.equal(store.getWidgetDescription(widgetRef)?.title, 'Scatter A')
  assert.equal(store.version, initialVersion + 1)
  assert.notEqual(store.stateId, initialStateId)

  store.registerLink({
    ref: linkRef,
    kind: 'filter',
    from: widgetRef,
    to: 'wl://demo/workspace/main/widget/bar_b',
  })

  assert.equal(store.readDescription().links[0]?.ref, linkRef)
  assert.equal(store.listLinks()[0]?.kind, 'filter')
  assert.equal(store.getLink(linkRef)?.ref, linkRef)
  assert.equal(store.version, initialVersion + 2)
  assert.equal(store.stateId, store.readState().stateId)
})

test('WidgetVARuntimeStore.registerWidget normalizes raw widget descriptions into protocol contract shape', () => {
  const store = new WidgetVARuntimeStore({ appId: 'demo', workspaceId: 'main' })
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const dataRef = 'wl://demo/workspace/main/data/cars'

  store.registerWidget(
    {
      ref: widgetRef,
      kind: 'scatter',
      widgetId: 'scatter_a',
      title: 'Scatter A',
    },
    {
      ref: widgetRef,
      widgetId: 'scatter_a',
      kind: 'scatter',
      version: 1,
      data: {
        sourceDataRef: dataRef,
        currentDataRef: dataRef,
      },
    },
  )

  assert.equal(store.readDescription().widgets[0]?.role, 'primary')
  assert.deepEqual(store.readDescription().widgets[0]?.analyticRoles, [])
  assert.deepEqual(store.readDescription().widgets[0]?.actionNames, [])
  assert.equal(store.listWidgetDescriptions()[0]?.role, 'primary')
})

test('WidgetVARuntimeStore.registerWidget normalizes raw widget states into protocol contract shape', () => {
  const store = new WidgetVARuntimeStore({ appId: 'demo', workspaceId: 'main' })
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const dataRef = 'wl://demo/workspace/main/data/cars'

  store.registerWidget(
    {
      ref: widgetRef,
      kind: 'scatter',
      widgetId: 'scatter_a',
      title: 'Scatter A',
    },
    {
      ref: widgetRef,
      widgetId: 'scatter_a',
      kind: 'scatter',
      data: {
        sourceDataRef: dataRef,
      },
    },
  )

  assert.equal(store.readState().widgets?.[widgetRef]?.version, 1)
  assert.equal(typeof store.readState().widgets?.[widgetRef]?.updatedAt, 'string')
  assert.equal(store.readState().widgets?.[widgetRef]?.data?.currentDataRef, null)
  assert.deepEqual(store.readState().widgets?.[widgetRef]?.transforms, [])
  assert.deepEqual(store.readState().widgets?.[widgetRef]?.encodings, {})
  assert.equal(store.readState().widgets?.[widgetRef]?.feedback?.highlightedKeys?.length, 0)
})

test('WidgetVARuntimeStore.registerLink normalizes kind-only links into WidgetLink contract shape', () => {
  const store = new WidgetVARuntimeStore({ appId: 'demo', workspaceId: 'main' })
  const linkRef = 'wl://demo/workspace/main/link/scatter_to_bar'

  store.registerLink({
    ref: linkRef,
    kind: 'filter',
    from: 'wl://demo/workspace/main/widget/scatter_a',
    to: 'wl://demo/workspace/main/widget/bar_b',
  })

  assert.equal(store.readDescription().links[0]?.kind, 'filter')
  assert.equal(Object.hasOwn(store.readDescription().links[0] || {}, 'primitive'), false)
  assert.equal(store.listLinks()[0]?.kind, 'filter')
  assert.equal(store.getLink(linkRef)?.kind, 'filter')
})

test('WidgetVARuntimeStore exposes a mutable manual-assembly facade for widgetAdapters', () => {
  const store = new WidgetVARuntimeStore({ appId: 'demo', workspaceId: 'main' })
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const adapter = {
    widgetRef,
    provider: 'custom',
    metadata: {
      test: true,
    },
    getDescription() {
      return {
        ref: widgetRef,
        title: 'Scatter A',
      }
    },
    applyState() {},
  }

  store.descriptions[widgetRef] = {
    kind: 'scatter',
    widgetId: 'scatter_a',
    title: 'Scatter A',
  }
  store.widgetAdapters[widgetRef] = adapter

  assert.equal(store.getWidgetAdapter(widgetRef), adapter)
  assert.deepEqual(store.listWidgetAdapters(), [adapter])
  assert.equal(store.describeWidgetRegistry().counts.adapterCount, 1)
  assert.equal(store.getWidgetEntry(widgetRef)?.adapterProvider, 'custom')
})

test('WidgetVARuntimeStore exposes mutable manual-assembly facades for actions and perceptionQueries', () => {
  const store = new WidgetVARuntimeStore({ appId: 'demo', workspaceId: 'main' })
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const actionKey = 'scatter.brushRegion'
  const perceptionKey = 'perception.summarizeVisible'

  store.descriptions[widgetRef] = {
    ref: widgetRef,
    kind: 'scatter',
    widgetId: 'scatter_a',
    title: 'Scatter A',
  }

  store.actions[actionKey] = {
    name: actionKey,
    title: 'Brush scatter region',
    targetRef: widgetRef,
    category: 'selection',
  }
  store.perceptionQueries[perceptionKey] = {
    name: perceptionKey,
    targetRef: widgetRef,
    sideEffectFree: true,
  }

  assert.equal(store.listActions()[0]?.name, actionKey)
  assert.equal(store.getActionDescriptor(actionKey, widgetRef)?.name, actionKey)
  assert.equal(store.readDescription().actions[0]?.name, actionKey)
  assert.equal(store.listPerceptionQueries()[0]?.name, perceptionKey)
  assert.equal(store.getPerceptionDescriptor(perceptionKey, widgetRef)?.name, perceptionKey)
  assert.equal(store.readDescription().perceptionQueries[0]?.name, perceptionKey)
})

test('WidgetVARuntimeStore normalizes action and perception descriptors through protocol constructors', () => {
  const store = new WidgetVARuntimeStore({ appId: 'demo', workspaceId: 'main' })
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'

  store.upsertActionDescriptor('widget.testAction', {
    name: 'widget.testAction',
    title: 'Test action',
    description: 'A raw action descriptor.',
    primitive: 'select',
    category: 'selection',
    targetRef: widgetRef,
  })
  store.upsertPerceptionDescriptor('perception.testQuery', {
    name: 'perception.testQuery',
    title: 'Test perception',
    description: 'A raw perception descriptor.',
    category: 'inspect',
    targetRef: widgetRef,
  })

  assert.equal(store.getActionDescriptor('widget.testAction', widgetRef)?.scope, 'local')
  assert.equal(store.getActionDescriptor('widget.testAction', widgetRef)?.supportedWidgetKinds, null)
  assert.deepEqual(store.getActionDescriptor('widget.testAction', widgetRef)?.affectedRefs, [])
  assert.equal(store.getActionDescriptor('widget.testAction', widgetRef)?.reversible, false)
  assert.equal(store.getPerceptionDescriptor('perception.testQuery', widgetRef)?.sideEffectFree, true)
  assert.deepEqual(store.getPerceptionDescriptor('perception.testQuery', widgetRef)?.evidenceKinds, [])
  assert.deepEqual(store.getPerceptionDescriptor('perception.testQuery', widgetRef)?.verificationTargets, [])
  assert.equal(store.readDescription().actions[0]?.scope, 'local')
  assert.equal(store.readDescription().perceptionQueries[0]?.sideEffectFree, true)
})

test('WidgetVARuntimeStore keeps action descriptors free of workspace analytical placement metadata', () => {
  const store = new WidgetVARuntimeStore({ appId: 'demo', workspaceId: 'main' })
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'

  store.upsertActionDescriptor('scatter.brushRegion', {
    name: 'scatter.brushRegion',
    title: 'Brush region',
    description: 'Brush a scatter interval.',
    primitive: 'select',
    category: 'selection',
    targetRef: widgetRef,
  })

  assert.equal('analyticalPlacement' in store.getActionDescriptor('scatter.brushRegion', widgetRef), false)
  assert.equal('sharedAnalyticalSurface' in store.getActionDescriptor('scatter.brushRegion', widgetRef), false)
  assert.equal('analyticalPlacement' in store.readDescription().actions[0], false)
  assert.equal('sharedAnalyticalSurface' in store.readDescription().actions[0], false)
})

test('WidgetVARuntimeStore.readState preserves workspace delta metadata in deltaSince scoped reads', () => {
  const store = new WidgetVARuntimeStore()
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_a'

  store.commitState(makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: {},
        encodings: {},
        transforms: [],
        view: {},
        selections: {},
      },
    },
    shared: {
      activeSelections: {},
    },
  }))

  store.commitState(makeWorkspaceState({
    stateId: 'main:s2',
    createdAt: '2026-01-01T00:01:00.000Z',
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        version: 2,
        updatedAt: '2026-01-01T00:01:00.000Z',
        data: {},
        encodings: {},
        transforms: [],
        view: {
          xDomain: [0, 10],
        },
        selections: {},
      },
    },
    shared: {
      activeSelections: {},
      focusedWidget: widgetRef,
    },
  }))

  const deltaState = store.readState({
    deltaSince: 'main:s1',
    refs: [widgetRef],
  })

  assert.equal(deltaState.stateId, 'main:s2')
  assert.equal(deltaState.delta?.baseStateId, 'main:s1')
  assert.ok(deltaState.delta?.changedRefs?.includes(widgetRef))
  assert.ok(deltaState.delta?.changedRefs?.includes('shared'))
  assert.deepEqual(deltaState.delta?.removedRefs, [])
  assert.equal(deltaState.widgets?.[widgetRef]?.view?.xDomain?.[1], 10)
  assert.equal('shared' in deltaState, false)
})

test('WidgetVARuntimeStore.readTraceWindow applies sinceStateId and limit over the full trace history', () => {
  const store = new WidgetVARuntimeStore()
  store.appendTrace({ stateId: 'main:s1', eventKind: 'action', actor: 'agent', affectedRefs: [], timestamp: '2026-01-01T00:00:00.000Z' })
  store.appendTrace({ stateId: 'main:s2', eventKind: 'action', actor: 'human', affectedRefs: [], timestamp: '2026-01-01T00:00:01.000Z' })
  store.appendTrace({ stateId: 'main:s3', eventKind: 'action', actor: 'agent', affectedRefs: [], timestamp: '2026-01-01T00:00:02.000Z' })
  store.appendTrace({ stateId: 'main:s4', eventKind: 'action', actor: 'agent', affectedRefs: [], timestamp: '2026-01-01T00:00:03.000Z' })

  assert.deepEqual(
    store.readTraceWindow({ sinceStateId: 'main:s1', limit: 2 }).map((record) => record.stateId),
    ['main:s3', 'main:s4'],
  )
  assert.deepEqual(
    store.readTraceWindow({ sinceStateId: 'main:s3', limit: 10 }).map((record) => record.stateId),
    ['main:s4'],
  )
  assert.deepEqual(
    store.readTraceWindow({ sinceStateId: 'missing', limit: 2 }).map((record) => record.stateId),
    ['main:s3', 'main:s4'],
  )
  assert.deepEqual(
    store.readTraceWindow({ sinceStateId: 'main:s1', limit: 10, actors: ['human'] }).map((record) => record.stateId),
    ['main:s2'],
  )
})

test('WidgetVARuntimeStore.appendTrace normalizes raw interaction trace records into protocol contract shape', () => {
  const store = new WidgetVARuntimeStore()

  store.appendTrace({
    stateId: 'main:s1',
    eventKind: 'dataQuery',
    actor: 'agent',
    query: {
      kind: 'summary',
    },
    affectedRefs: ['wl://widgetva-app/workspace/main/data/current_view'],
    timestamp: '2026-01-01T00:00:00.000Z',
  })

  const record = store.readTraceWindow({ limit: 1 })[0]

  assert.equal(record?.eventFamily, 'query')
  assert.equal(record?.querySurface, 'data')
  assert.deepEqual(record?.statePatch, {})
  assert.deepEqual(record?.notes, {})
  assert.equal(record?.parentStateId, null)
  assert.equal(record?.branchId, null)
})

test('WidgetVARuntimeStore.buildTraceGraph applies sinceStateId and keeps only in-window edges', () => {
  const store = new WidgetVARuntimeStore()

  store.commitState(makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      a: { ref: 'a', version: 1 },
    },
    shared: {},
  }))
  store.commitState(makeWorkspaceState({
    stateId: 'main:s2',
    createdAt: '2026-01-01T00:00:01.000Z',
    widgets: {
      a: { ref: 'a', version: 2 },
    },
    shared: {},
  }))
  store.commitState(makeWorkspaceState({
    stateId: 'main:s3',
    createdAt: '2026-01-01T00:00:02.000Z',
    widgets: {
      a: { ref: 'a', version: 3 },
    },
    shared: {},
  }))
  store.commitState(makeWorkspaceState({
    stateId: 'main:s4',
    createdAt: '2026-01-01T00:00:03.000Z',
    widgets: {
      a: { ref: 'a', version: 4 },
    },
    shared: {},
  }))

  const graph = store.buildTraceGraph({ sinceStateId: 'main:s2', limit: 10 })

  assert.equal(graph.sinceStateId, 'main:s2')
  assert.deepEqual(graph.nodes.map((node) => node.stateId), ['main:s3', 'main:s4'])
  assert.deepEqual(graph.edges.map((edge) => [edge.from_id, edge.to_id]), [['main:s3', 'main:s4']])
  assert.equal(graph.nodes[0]?.current, false)
  assert.equal(graph.nodes[1]?.current, true)
  assert.equal(graph.edges[0]?.edge_type, 'continue')
})

test('WidgetVARuntimeStore history readers preserve and filter actor provenance', () => {
  const store = new WidgetVARuntimeStore()

  store.commitState(makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: { a: { ref: 'a', version: 1 } },
    shared: {},
  }))
  store.commitState(makeWorkspaceState({
    stateId: 'main:s2',
    createdAt: '2026-01-01T00:00:01.000Z',
    widgets: { a: { ref: 'a', version: 2 } },
    shared: {},
  }))
  store.commitState(makeWorkspaceState({
    stateId: 'main:s3',
    createdAt: '2026-01-01T00:00:02.000Z',
    widgets: { a: { ref: 'a', version: 3 } },
    shared: {},
  }))

  store.appendTrace({
    stateId: 'main:s1',
    eventKind: 'action',
    actor: 'agent',
    action: { name: 'scatter.brushRegion' },
    affectedRefs: ['a'],
    timestamp: '2026-01-01T00:00:00.000Z',
  })
  store.appendTrace({
    stateId: 'main:s2',
    eventKind: 'action',
    actor: 'human',
    action: { name: 'workspace.focusWidget' },
    affectedRefs: ['a'],
    timestamp: '2026-01-01T00:00:01.000Z',
  })
  store.appendTrace({
    stateId: 'main:s3',
    eventKind: 'systemTransition',
    actor: 'system',
    primitive: 'continue',
    affectedRefs: [],
    timestamp: '2026-01-01T00:00:02.000Z',
  })

  const humanHistory = store.listStateSnapshots({ limit: 10, actors: ['human'] })
  assert.deepEqual(humanHistory.map((entry) => entry.stateId), ['main:s2'])
  assert.equal(humanHistory[0]?.actor, 'human')

  const graph = store.buildTraceGraph({ limit: 10, actors: ['human'] })
  assert.deepEqual(graph.actors, ['human'])
  assert.deepEqual(graph.nodes.map((node) => node.stateId), ['main:s2'])
  assert.deepEqual(graph.edges, [])
})

test('WidgetVARuntimeStore.buildTraceGraph preserves action identity when a state also has a system transition trace record', () => {
  const store = new WidgetVARuntimeStore()

  store.commitState(makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      a: { ref: 'a', version: 1 },
    },
    shared: {},
  }))

  store.appendTrace({
    stateId: 'main:s1',
    eventKind: 'action',
    actor: 'agent',
    action: {
      name: 'workspace.jumpToState',
    },
    affectedRefs: ['shared'],
    timestamp: '2026-01-01T00:00:00.000Z',
  })
  store.appendTrace({
    stateId: 'main:s1',
    eventKind: 'systemTransition',
    actor: 'agent',
    primitive: 'jump_back',
    affectedRefs: ['shared'],
    timestamp: '2026-01-01T00:00:00.100Z',
  })
  store.stateSnapshots[0].transitionType = 'jump_back'

  const graph = store.buildTraceGraph(10)
  const node = graph.nodes.find((entry) => entry.stateId === 'main:s1')

  assert.equal(node?.actionName, 'workspace.jumpToState')
  assert.equal(node?.label, 'workspace.jumpToState')
  assert.equal(node?.transitionType, 'jump_back')
  assert.equal(node?.eventFamily, 'action')
})

test('WidgetVARuntimeStore.buildTraceGraph attaches latest agent response metadata to the matching state node', () => {
  const store = new WidgetVARuntimeStore()

  store.commitState(makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      a: { ref: 'a', version: 1 },
    },
    shared: {},
  }))

  store.appendTrace({
    stateId: 'main:s1',
    eventKind: 'action',
    actor: 'agent',
    action: {
      name: 'perception.inspectVisibleRows',
    },
    affectedRefs: ['shared'],
    timestamp: '2026-01-01T00:00:00.000Z',
  })

  store.appendResponse({
    responseId: 'response_1',
    actor: 'agent',
    content: 'The selected subset is concentrated in the western region.',
    stateId: 'main:s1',
    branchId: 'main',
    createdAt: '2026-01-01T00:00:01.000Z',
  })
  store.appendResponse({
    responseId: 'response_2',
    actor: 'agent',
    content: 'Final answer: the selected subset is concentrated in the western region.',
    stateId: 'main:s1',
    branchId: 'main',
    createdAt: '2026-01-01T00:00:02.000Z',
  })

  const graph = store.buildTraceGraph(10)
  const node = graph.nodes.find((entry) => entry.stateId === 'main:s1')

  assert.equal(node?.responseId, 'response_2')
  assert.equal(node?.responseActor, 'agent')
  assert.equal(node?.responsePreview, 'Final answer: the selected subset is concentrated in the western region.')
})

test('WidgetVARuntimeStore.appendResponse normalizes raw response records into protocol contract shape', () => {
  const store = new WidgetVARuntimeStore({ appId: 'widgetva-app', workspaceId: 'main' })

  store.appendResponse({
    responseId: 'response_1',
    actor: 'agent',
    content: 'Final answer.',
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
  })

  const record = store.readLatestResponse()

  assert.equal(record?.workspaceId, 'main')
  assert.equal(record?.runId, null)
  assert.equal(record?.sessionId, null)
  assert.equal(record?.branchId, 'main')
  assert.equal(record?.mode, null)
  assert.equal(record?.query, null)
  assert.deepEqual(record?.evidenceRefs, [])
})

test('WidgetVARuntimeStore.syncSelectionRuntimeData materializes per-selection data handles and cleans stale selection handles', () => {
  const store = new WidgetVARuntimeStore()
  const widgetRef = makeWidgetRef({ widgetId: 'scatter_a' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/scatter_a_visible'
  const selectionRef = makeSelectionRef({ widgetId: 'scatter_a', selectionId: 'region_a' })
  const selectionDataRef = makeWidgetSelectionDataRef({ widgetId: 'scatter_a' })
  const selectionScopedDataRef = makeSelectionScopedDataRef({ widgetId: 'scatter_a', selectionId: 'region_a' })
  const currentSelectionDataRef = makeCurrentSelectionDataRef()

  store.replaceWorkspace({
    description: {
      appId: 'widgetva-app',
      workspaceId: 'main',
      widgets: [
        {
          ref: widgetRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          title: 'Scatter A',
        },
      ],
      dataHandles: [
        {
          ref: visibleDataRef,
          title: 'Scatter A Visible Data',
        },
      ],
      links: [],
      actions: [],
      perceptionQueries: [],
    },
    state: makeWorkspaceState({
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [widgetRef]: {
          ref: widgetRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          version: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: {
            sourceDataRef: visibleDataRef,
            currentDataRef: visibleDataRef,
            visibleCount: 2,
            selectedCount: 1,
          },
          encodings: {},
          transforms: [],
          view: {},
          selections: {
            [selectionRef]: {
              kind: 'point',
              predicates: [{ field: 'region', op: 'equals', value: 'west' }],
            },
          },
        },
      },
      shared: {
        activeSelections: {
          [selectionRef]: {
            kind: 'point',
            predicates: [{ field: 'region', op: 'equals', value: 'west' }],
          },
        },
      },
    }),
    runtimeData: {
      [visibleDataRef]: {
        ref: visibleDataRef,
        rows: [
          { id: 1, region: 'west' },
          { id: 2, region: 'east' },
        ],
        handle: {
          ref: visibleDataRef,
          title: 'Scatter A Visible Data',
        },
        widgetRef,
      },
    },
  })

  store.syncSelectionRuntimeData(widgetRef)

  assert.equal(store.resolveSelectionDataRef(selectionRef), selectionScopedDataRef)
  assert.deepEqual(
    store.readRuntimeData(selectionDataRef)?.rows,
    [{ id: 1, region: 'west' }],
  )
  assert.deepEqual(
    store.readRuntimeData(selectionScopedDataRef)?.rows,
    [{ id: 1, region: 'west' }],
  )
  assert.deepEqual(
    store.readRuntimeData(currentSelectionDataRef)?.rows,
    [{ id: 1, region: 'west' }],
  )
  assert.equal(store.getDataHandle(selectionDataRef)?.supportedQueries?.includes('schema'), true)
  assert.equal(store.getDataHandle(selectionScopedDataRef)?.supportedQueries?.includes('schema'), true)
  assert.equal(store.getDataHandle(currentSelectionDataRef)?.supportedQueries?.includes('schema'), true)
  assert.ok(store.getDataHandle(selectionScopedDataRef))
  assert.ok(store.getDataHandle(currentSelectionDataRef))
  assert.equal(store.getResolvedWidgetForTarget(selectionRef)?.ref, widgetRef)
  assert.equal(store.getResolvedWidgetForTarget(selectionScopedDataRef)?.ref, widgetRef)
  assert.equal(store.getResolvedWidgetForTarget(currentSelectionDataRef)?.ref, widgetRef)

  const clearedState = makeWorkspaceState({
    ...store.readState(),
    stateId: 'main:s2',
    widgets: {
      [widgetRef]: {
        ...store.getWidgetState(widgetRef),
        selections: {},
      },
    },
    shared: {
      ...(store.readState()?.shared || {}),
      activeSelections: {},
    },
  })
  store.commitState(clearedState)
  store.syncSelectionRuntimeData(widgetRef)

  assert.equal(store.readRuntimeData(selectionDataRef), null)
  assert.equal(store.readRuntimeData(selectionScopedDataRef), null)
  assert.equal(store.readRuntimeData(currentSelectionDataRef), null)
  assert.equal(store.getDataHandle(selectionScopedDataRef), null)
  assert.equal(store.getDataHandle(currentSelectionDataRef), null)
})

test('WidgetVARuntimeStore keeps current_selection aligned with focused widget changes', () => {
  const store = new WidgetVARuntimeStore()
  const widgetARef = makeWidgetRef({ widgetId: 'scatter_a' })
  const widgetBRef = makeWidgetRef({ widgetId: 'bar_b' })
  const widgetAVisibleRef = 'wl://widgetva-app/workspace/main/data/scatter_a_visible'
  const widgetBVisibleRef = 'wl://widgetva-app/workspace/main/data/bar_b_visible'
  const widgetASelectionRef = makeSelectionRef({ widgetId: 'scatter_a', selectionId: 'region_a' })
  const widgetBSelectionRef = makeSelectionRef({ widgetId: 'bar_b', selectionId: 'segment_b' })
  const currentSelectionDataRef = makeCurrentSelectionDataRef()

  store.replaceWorkspace({
    description: {
      appId: 'widgetva-app',
      workspaceId: 'main',
      widgets: [
        { ref: widgetARef, widgetId: 'scatter_a', kind: 'scatter', title: 'Scatter A' },
        { ref: widgetBRef, widgetId: 'bar_b', kind: 'bar', title: 'Bar B' },
      ],
      dataHandles: [
        { ref: widgetAVisibleRef, title: 'Scatter A Visible Data' },
        { ref: widgetBVisibleRef, title: 'Bar B Visible Data' },
      ],
      links: [],
      actions: [],
      perceptionQueries: [],
    },
    state: makeWorkspaceState({
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [widgetARef]: {
          ref: widgetARef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          version: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: { sourceDataRef: widgetAVisibleRef, currentDataRef: widgetAVisibleRef },
          encodings: {},
          transforms: [],
          view: {},
          selections: {
            [widgetASelectionRef]: {
              kind: 'point',
              predicates: [{ field: 'region', op: 'equals', value: 'west' }],
            },
          },
        },
        [widgetBRef]: {
          ref: widgetBRef,
          widgetId: 'bar_b',
          kind: 'bar',
          version: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: { sourceDataRef: widgetBVisibleRef, currentDataRef: widgetBVisibleRef },
          encodings: {},
          transforms: [],
          view: {},
          selections: {
            [widgetBSelectionRef]: {
              kind: 'point',
              predicates: [{ field: 'segment', op: 'equals', value: 'fleet' }],
            },
          },
        },
      },
      shared: {
        focusedWidget: widgetARef,
        activeSelections: {
          [widgetASelectionRef]: {
            kind: 'point',
            predicates: [{ field: 'region', op: 'equals', value: 'west' }],
          },
          [widgetBSelectionRef]: {
            kind: 'point',
            predicates: [{ field: 'segment', op: 'equals', value: 'fleet' }],
          },
        },
      },
    }),
    runtimeData: {
      [widgetAVisibleRef]: {
        ref: widgetAVisibleRef,
        rows: [{ id: 1, region: 'west' }, { id: 2, region: 'east' }],
        handle: { ref: widgetAVisibleRef, title: 'Scatter A Visible Data' },
        widgetRef: widgetARef,
      },
      [widgetBVisibleRef]: {
        ref: widgetBVisibleRef,
        rows: [{ id: 10, segment: 'fleet' }, { id: 11, segment: 'retail' }],
        handle: { ref: widgetBVisibleRef, title: 'Bar B Visible Data' },
        widgetRef: widgetBRef,
      },
    },
  })

  store.syncSelectionRuntimeData(widgetARef)
  store.syncSelectionRuntimeData(widgetBRef)

  assert.deepEqual(store.readRuntimeData(currentSelectionDataRef)?.rows, [{ id: 1, region: 'west' }])
  assert.equal(store.readRuntimeData(currentSelectionDataRef)?.widgetRef, widgetARef)

  const nextState = makeWorkspaceState({
    ...store.readState(),
    stateId: 'main:s2',
    shared: {
      ...(store.readState()?.shared || {}),
      focusedWidget: widgetBRef,
    },
  })
  store.commitState(nextState)

  assert.deepEqual(store.readRuntimeData(currentSelectionDataRef)?.rows, [{ id: 10, segment: 'fleet' }])
  assert.equal(store.readRuntimeData(currentSelectionDataRef)?.widgetRef, widgetBRef)
  assert.equal(store.readRuntimeData(currentSelectionDataRef)?.sourceSelectionRef, widgetBSelectionRef)
})

test('WidgetVARuntimeStore.replaceWorkspace normalizes kind-only workspace links into WidgetLink contract shape', () => {
  const store = new WidgetVARuntimeStore({ appId: 'widgetva-app', workspaceId: 'main' })
  const sourceWidgetRef = makeWidgetRef({ widgetId: 'scatter_a' })
  const targetWidgetRef = makeWidgetRef({ widgetId: 'bar_b' })
  const linkRef = 'wl://widgetva-app/workspace/main/link/scatter_to_bar'

  store.replaceWorkspace({
    description: {
      appId: 'widgetva-app',
      workspaceId: 'main',
      widgets: [
        { ref: sourceWidgetRef, widgetId: 'scatter_a', kind: 'scatter', title: 'Scatter A' },
        { ref: targetWidgetRef, widgetId: 'bar_b', kind: 'bar', title: 'Bar B' },
      ],
      dataHandles: [],
      links: [
        {
          ref: linkRef,
          kind: 'filter',
          from: sourceWidgetRef,
          to: targetWidgetRef,
        },
      ],
      actions: [],
      perceptionQueries: [],
    },
    state: makeWorkspaceState({
      widgets: {
        [sourceWidgetRef]: { ref: sourceWidgetRef, widgetId: 'scatter_a', kind: 'scatter' },
        [targetWidgetRef]: { ref: targetWidgetRef, widgetId: 'bar_b', kind: 'bar' },
      },
    }),
  })

  assert.equal(store.readDescription().links[0]?.kind, 'filter')
  assert.equal(Object.hasOwn(store.readDescription().links[0] || {}, 'primitive'), false)
  assert.equal(store.listLinks()[0]?.kind, 'filter')
  assert.equal(store.getLink(linkRef)?.kind, 'filter')
})

test('WidgetVARuntimeStore.replaceWorkspace normalizes raw action and perception descriptors into protocol contract shape', () => {
  const store = new WidgetVARuntimeStore({ appId: 'widgetva-app', workspaceId: 'main' })
  const widgetRef = makeWidgetRef({ widgetId: 'scatter_a' })

  store.replaceWorkspace({
    description: {
      appId: 'widgetva-app',
      workspaceId: 'main',
      widgets: [
        { ref: widgetRef, widgetId: 'scatter_a', kind: 'scatter', title: 'Scatter A' },
      ],
      dataHandles: [],
      links: [],
      actions: [
        {
          name: 'widget.testAction',
          title: 'Test action',
          description: 'A raw action descriptor.',
          primitive: 'select',
          category: 'selection',
          targetRef: widgetRef,
        },
      ],
      perceptionQueries: [
        {
          name: 'perception.testQuery',
          title: 'Test perception',
          description: 'A raw perception descriptor.',
          category: 'inspect',
          targetRef: widgetRef,
        },
      ],
    },
    state: makeWorkspaceState({
      widgets: {
        [widgetRef]: { ref: widgetRef, widgetId: 'scatter_a', kind: 'scatter' },
      },
    }),
  })

  assert.equal(store.readDescription().actions[0]?.scope, 'local')
  assert.equal(store.readDescription().actions[0]?.supportedWidgetKinds, null)
  assert.equal(store.readDescription().perceptionQueries[0]?.sideEffectFree, true)
  assert.deepEqual(store.readDescription().perceptionQueries[0]?.evidenceKinds, [])
  assert.equal(store.getActionDescriptor('widget.testAction', widgetRef)?.scope, 'local')
  assert.equal(store.getPerceptionDescriptor('perception.testQuery', widgetRef)?.sideEffectFree, true)
})

test('WidgetVARuntimeStore.replaceWorkspace normalizes raw data handles into protocol contract shape', () => {
  const store = new WidgetVARuntimeStore({ appId: 'widgetva-app', workspaceId: 'main' })
  const widgetRef = makeWidgetRef({ widgetId: 'scatter_a' })
  const dataRef = 'wl://widgetva-app/workspace/main/data/cars'

  store.replaceWorkspace({
    description: {
      appId: 'widgetva-app',
      workspaceId: 'main',
      widgets: [
        { ref: widgetRef, widgetId: 'scatter_a', kind: 'scatter', title: 'Scatter A' },
      ],
      dataHandles: [
        {
          ref: dataRef,
          title: 'Cars',
        },
      ],
      links: [],
      actions: [],
      perceptionQueries: [],
    },
    state: makeWorkspaceState({
      widgets: {
        [widgetRef]: { ref: widgetRef, widgetId: 'scatter_a', kind: 'scatter' },
      },
    }),
  })

  assert.equal(store.readDescription().dataHandles[0]?.sourceKind, 'inline')
  assert.equal(store.readDescription().dataHandles[0]?.kind, 'dataView')
  assert.equal(store.readDescription().dataHandles[0]?.scope, 'workspace')
  assert.deepEqual(store.readDescription().dataHandles[0]?.schema, { fields: [] })
  assert.deepEqual(store.readDescription().dataHandles[0]?.stats, {})
  assert.deepEqual(store.readDescription().dataHandles[0]?.supportedQueries, ['sampleRows', 'summary'])
  assert.deepEqual(store.readDescription().dataHandles[0]?.supportedQueryDescriptors, [])
  assert.equal(store.getDataHandle(dataRef)?.sourceKind, 'inline')
})

test('WidgetVARuntimeStore.replaceWorkspace normalizes raw widget descriptions into protocol contract shape', () => {
  const store = new WidgetVARuntimeStore({ appId: 'widgetva-app', workspaceId: 'main' })
  const widgetRef = makeWidgetRef({ widgetId: 'scatter_a' })

  store.replaceWorkspace({
    description: {
      appId: 'widgetva-app',
      workspaceId: 'main',
      widgets: [
        {
          ref: widgetRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          title: 'Scatter A',
        },
      ],
      dataHandles: [],
      links: [],
      actions: [],
      perceptionQueries: [],
    },
    state: makeWorkspaceState({
      widgets: {
        [widgetRef]: { ref: widgetRef, widgetId: 'scatter_a', kind: 'scatter' },
      },
    }),
  })

  assert.equal(store.readDescription().widgets[0]?.role, 'primary')
  assert.deepEqual(store.readDescription().widgets[0]?.analyticRoles, [])
  assert.deepEqual(store.readDescription().widgets[0]?.actionNames, [])
  assert.equal(store.readDescription().widgets[0]?.humanInteraction?.mode, 'none')
  assert.equal(store.listWidgetDescriptions()[0]?.role, 'primary')
  assert.deepEqual(store.listWidgetDescriptions()[0]?.analyticRoles, [])
  assert.equal(store.getWidgetDescription(widgetRef)?.role, 'primary')
})

test('WidgetVARuntimeStore.replaceWorkspace normalizes raw widget states into protocol contract shape', () => {
  const store = new WidgetVARuntimeStore({ appId: 'widgetva-app', workspaceId: 'main' })
  const widgetRef = makeWidgetRef({ widgetId: 'scatter_a' })
  const dataRef = 'wl://widgetva-app/workspace/main/data/cars'

  store.replaceWorkspace({
    description: {
      appId: 'widgetva-app',
      workspaceId: 'main',
      widgets: [
        {
          ref: widgetRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          title: 'Scatter A',
        },
      ],
      dataHandles: [],
      links: [],
      actions: [],
      perceptionQueries: [],
    },
    state: makeWorkspaceState({
      widgets: {
        [widgetRef]: {
          ref: widgetRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          data: {
            sourceDataRef: dataRef,
          },
        },
      },
    }),
  })

  assert.equal(store.readState().widgets?.[widgetRef]?.version, 1)
  assert.equal(typeof store.readState().widgets?.[widgetRef]?.updatedAt, 'string')
  assert.equal(store.readState().widgets?.[widgetRef]?.data?.currentDataRef, null)
  assert.deepEqual(store.readState().widgets?.[widgetRef]?.transforms, [])
  assert.deepEqual(store.readState().widgets?.[widgetRef]?.encodings, {})
  assert.equal(store.readState().widgets?.[widgetRef]?.feedback?.highlightedKeys?.length, 0)
})

test('WidgetVARuntimeStore keeps current_view aligned with focused widget changes', () => {
  const store = new WidgetVARuntimeStore()
  const widgetARef = makeWidgetRef({ widgetId: 'scatter_a' })
  const widgetBRef = makeWidgetRef({ widgetId: 'bar_b' })
  const widgetAVisibleRef = 'wl://widgetva-app/workspace/main/data/scatter_a_visible'
  const widgetBVisibleRef = 'wl://widgetva-app/workspace/main/data/bar_b_visible'
  const currentViewDataRef = makeCurrentViewDataRef()

  store.replaceWorkspace({
    description: {
      appId: 'widgetva-app',
      workspaceId: 'main',
      widgets: [
        { ref: widgetARef, widgetId: 'scatter_a', kind: 'scatter', title: 'Scatter A' },
        { ref: widgetBRef, widgetId: 'bar_b', kind: 'bar', title: 'Bar B' },
      ],
      dataHandles: [
        { ref: widgetAVisibleRef, title: 'Scatter A Visible Data' },
        { ref: widgetBVisibleRef, title: 'Bar B Visible Data' },
      ],
      links: [],
      actions: [],
      perceptionQueries: [],
    },
    state: makeWorkspaceState({
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [widgetARef]: {
          ref: widgetARef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          version: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: { sourceDataRef: widgetAVisibleRef, currentDataRef: widgetAVisibleRef },
          encodings: {},
          transforms: [],
          view: {},
          selections: {},
        },
        [widgetBRef]: {
          ref: widgetBRef,
          widgetId: 'bar_b',
          kind: 'bar',
          version: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: { sourceDataRef: widgetBVisibleRef, currentDataRef: widgetBVisibleRef },
          encodings: {},
          transforms: [],
          view: {},
          selections: {},
        },
      },
      shared: {
        focusedWidget: widgetARef,
        activeSelections: {},
      },
    }),
    runtimeData: {
      [widgetAVisibleRef]: {
        ref: widgetAVisibleRef,
        rows: [{ id: 1, region: 'west' }, { id: 2, region: 'east' }],
        handle: { ref: widgetAVisibleRef, title: 'Scatter A Visible Data', scope: 'visible' },
        widgetRef: widgetARef,
      },
      [widgetBVisibleRef]: {
        ref: widgetBVisibleRef,
        rows: [{ id: 10, segment: 'fleet' }, { id: 11, segment: 'retail' }],
        handle: { ref: widgetBVisibleRef, title: 'Bar B Visible Data', scope: 'visible' },
        widgetRef: widgetBRef,
      },
    },
  })

  assert.deepEqual(store.readRuntimeData(currentViewDataRef)?.rows, [{ id: 1, region: 'west' }, { id: 2, region: 'east' }])
  assert.equal(store.readRuntimeData(currentViewDataRef)?.widgetRef, widgetARef)
  assert.equal(store.getDataHandle(currentViewDataRef)?.supportedQueries?.includes('schema'), true)

  const nextState = makeWorkspaceState({
    ...store.readState(),
    stateId: 'main:s2',
    shared: {
      ...(store.readState()?.shared || {}),
      focusedWidget: widgetBRef,
    },
  })
  store.commitState(nextState)

  assert.deepEqual(store.readRuntimeData(currentViewDataRef)?.rows, [{ id: 10, segment: 'fleet' }, { id: 11, segment: 'retail' }])
  assert.equal(store.readRuntimeData(currentViewDataRef)?.widgetRef, widgetBRef)
  assert.equal(store.getDataHandle(currentViewDataRef)?.supportedQueries?.includes('schema'), true)
})
