import test from 'node:test'
import assert from 'node:assert/strict'

import { createWidgetVAHostBridge } from './hostBridge.js'
import { createWidgetVARuntime } from '../core/runtime/RuntimeOrchestrator.js'

test('createWidgetVAHostBridge supports explicit selectors and actions without relying on app-specific state keys', () => {
  const state = {
    session: { id: 's1' },
    drafts: { intent: 'compare regions' },
    visual: {
      spec: { mark: 'point' },
      workspace: { widgets: [{ widgetId: 'scatter_a' }] },
      planning: { runMode: 'goal_oriented' },
    },
    interaction: {
      selection: { source_widget_id: 'scatter_a', selection_id: 'brush' },
      selections: { 'scatter_a::brush': { source_widget_id: 'scatter_a', selection_id: 'brush' } },
    },
    coordination: {
      primarySelectionRef: 'scatter_a::brush',
      focusedWidgetRef: 'widget://scatter_a',
      focus: {
        widgetRef: 'widget://scatter_a',
        widgetId: 'scatter_a',
        source: 'workspace',
      },
      highlight: {
        entries: [{
          widgetRef: 'widget://scatter_a',
          widgetId: 'scatter_a',
          highlightedKeys: ['Japan'],
        }],
        activeWidgetRefs: ['widget://scatter_a'],
      },
      globalFilters: { origin: ['Japan'] },
      viewport: { xDomain: [80, 160] },
    },
  }
  const calls = []
  const bridge = createWidgetVAHostBridge({
    getState: () => state,
    subscribe: () => () => {},
    selectors: {
      readSessionId: (current) => current.session.id,
      readCurrentSpec: (current) => current.visual.spec,
      readWorkspaceSpec: (current) => current.visual.workspace,
      readPlanningRequest: (current) => current.visual.planning,
      readUserIntent: (current) => current.drafts.intent,
      readCurrentSelection: (current) => current.interaction.selection,
      readCurrentSelections: (current) => current.interaction.selections,
      readPrimarySelectionRef: (current) => current.coordination.primarySelectionRef,
      readFocusedWidgetRef: (current) => current.coordination.focusedWidgetRef,
      readFocusState: (current) => current.coordination.focus,
      readHighlightState: (current) => current.coordination.highlight,
      readSharedFilters: (current) => current.coordination.globalFilters,
      readViewportState: (current) => current.coordination.viewport,
    },
    actions: {
      writeCurrentSpec: (nextSpec, options = {}) => calls.push(['writeCurrentSpec', nextSpec, options]),
      writeUserIntent: (userIntent) => calls.push(['writeUserIntent', userIntent]),
      writeCurrentSelection: (selection, options = {}) => calls.push(['writeCurrentSelection', selection, options]),
    },
  })

  assert.equal(bridge.readSessionId(), 's1')
  assert.deepEqual(bridge.readCurrentSpec(), { mark: 'point' })
  assert.deepEqual(bridge.readWorkspaceSpec(), { widgets: [{ widgetId: 'scatter_a' }] })
  assert.deepEqual(bridge.readPlanningRequest(), { runMode: 'goal_oriented' })
  assert.equal(bridge.readUserIntent(), 'compare regions')
  assert.deepEqual(bridge.readCurrentSelection(), { source_widget_id: 'scatter_a', selection_id: 'brush' })
  assert.deepEqual(bridge.readCurrentSelections(), {
    'scatter_a::brush': { source_widget_id: 'scatter_a', selection_id: 'brush' },
  })
  assert.equal(bridge.readPrimarySelectionRef(), 'scatter_a::brush')
  assert.equal(bridge.readFocusedWidgetRef(), 'widget://scatter_a')
  assert.deepEqual(bridge.readFocusState(), {
    widgetRef: 'widget://scatter_a',
    widgetId: 'scatter_a',
    source: 'workspace',
  })
  assert.deepEqual(bridge.readHighlightState(), {
    entries: [{
      widgetRef: 'widget://scatter_a',
      widgetId: 'scatter_a',
      highlightedKeys: ['Japan'],
      inboundLinkIds: [],
      highlightLinkIds: [],
      linkedSourceRefs: [],
    }],
    activeWidgetRefs: ['widget://scatter_a'],
  })
  assert.deepEqual(bridge.readSharedFilters(), { origin: ['Japan'] })
  assert.deepEqual(bridge.readViewportState(), { xDomain: [80, 160] })

  bridge.writeCurrentSpec({ mark: 'bar' }, { trackHistory: true })
  bridge.writeUserIntent('find anomalies')
  bridge.writeCurrentSelection(null, { clearAll: true })

  assert.deepEqual(calls, [
    ['writeCurrentSpec', { mark: 'bar' }, { trackHistory: true }],
    ['writeUserIntent', 'find anomalies'],
    ['writeCurrentSelection', null, { clearAll: true }],
  ])
})

test('createWidgetVAHostBridge derives legacy currentSelection reads from canonical selection registry state', () => {
  const selection = { kind: 'interval', predicates: [{ field: 'Horsepower', op: 'between', value: [80, 160] }] }
  const bridge = createWidgetVAHostBridge({
    getState: () => ({
      shared: {
        selections: {
          registry: {
            'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush': selection,
          },
          views: {
            primary: {
              ref: 'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush',
            },
          },
        },
        focus: {
          widgetRef: 'widget://scatter_a',
          widgetId: 'scatter_a',
          source: 'workspace',
        },
        highlight: {
          entries: [{
            widgetRef: 'widget://scatter_a',
            widgetId: 'scatter_a',
            highlightedKeys: ['USA'],
          }],
          activeWidgetRefs: ['widget://scatter_a'],
        },
        globalFilters: { origin: ['USA'] },
      },
      currentFocusedWidgetRef: 'widget://scatter_a',
      currentViewportState: { xDomain: [90, 150] },
    }),
  })

  assert.equal(
    bridge.readPrimarySelectionRef(),
    'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush',
  )
  assert.deepEqual(bridge.readSelectionRegistry(), {
    'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush': selection,
  })
  assert.deepEqual(bridge.readCurrentSelection(), selection)
  assert.deepEqual(bridge.readCurrentSelections(), {
    'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush': selection,
  })
  assert.deepEqual(bridge.readFocusState(), {
    widgetRef: 'widget://scatter_a',
    widgetId: 'scatter_a',
    source: 'workspace',
  })
  assert.deepEqual(bridge.readHighlightState(), {
    entries: [{
      widgetRef: 'widget://scatter_a',
      widgetId: 'scatter_a',
      highlightedKeys: ['USA'],
      inboundLinkIds: [],
      highlightLinkIds: [],
      linkedSourceRefs: [],
    }],
    activeWidgetRefs: ['widget://scatter_a'],
  })
  assert.deepEqual(bridge.readSharedFilters(), { origin: ['USA'] })
  assert.deepEqual(bridge.readViewportState(), { xDomain: [90, 150] })
})

test('createWidgetVAHostBridge also accepts direct bridge methods as the stable host contract', () => {
  const calls = []
  const bridge = createWidgetVAHostBridge({
    subscribe: () => () => {},
    readSessionId: () => 'direct-session',
    readCurrentSpec: () => ({ mark: 'line' }),
    readUserIntent: () => 'direct intent',
    writeCurrentSpec: (nextSpec, options = {}) => calls.push(['writeCurrentSpec', nextSpec, options]),
  })

  assert.equal(bridge.readSessionId(), 'direct-session')
  assert.deepEqual(bridge.readCurrentSpec(), { mark: 'line' })
  assert.equal(bridge.readUserIntent(), 'direct intent')
  bridge.writeCurrentSpec({ mark: 'area' }, { trackHistory: false })
  assert.deepEqual(calls, [['writeCurrentSpec', { mark: 'area' }, { trackHistory: false }]])
})

test('createWidgetVAHostBridge preserves the host-state receiver when using fallback state mutators', () => {
  const state = {
    currentSpec: { mark: 'point' },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }
  const bridge = createWidgetVAHostBridge({
    getAppState: () => state,
  })

  bridge.writeCurrentSpec({ mark: 'bar' })

  assert.deepEqual(state.currentSpec, { mark: 'bar' })
})

test('createWidgetVARuntime syncs host viewport state into workspace shared state', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const spec = {
    data: {
      values: [
        { Horsepower: 130, MPG: 18 },
        { Horsepower: 95, MPG: 30 },
      ],
    },
    mark: 'point',
    encoding: {
      x: { field: 'Horsepower', type: 'quantitative' },
      y: { field: 'MPG', type: 'quantitative' },
    },
  }
  try {
    const runtime = createWidgetVARuntime({
      hostBridge: {
        subscribe: () => () => {},
        readSessionId: () => 'viewport-runtime',
        readBaselineSpec: () => spec,
        readCurrentSpec: () => spec,
        readRunMode: () => 'goal_oriented',
        readUserIntent: () => '',
        readCurrentSelection: () => null,
        readCurrentSelections: () => ({}),
        readFocusedWidgetRef: () => null,
        readFocusState: () => ({
          widgetRef: 'wl://widgetva-app/workspace/main/widget/session_viewport-runtime',
          widgetId: 'session_viewport-runtime',
          source: 'workspace',
        }),
        readHighlightState: () => ({
          entries: [{
            widgetRef: 'wl://widgetva-app/workspace/main/widget/session_viewport-runtime',
            widgetId: 'session_viewport-runtime',
            highlightedKeys: ['USA'],
          }],
          activeWidgetRefs: ['wl://widgetva-app/workspace/main/widget/session_viewport-runtime'],
        }),
        readViewportState: () => ({
          sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/session_viewport-runtime',
          xDomain: [80, 160],
          yDomain: [15, 35],
        }),
      },
    })

    assert.deepEqual(runtime.store.readState()?.shared?.viewport, {
      sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/session_viewport-runtime',
      xDomain: [80, 160],
      yDomain: [15, 35],
      zoom: null,
    })
    assert.deepEqual(runtime.store.readState()?.shared?.focus, {
      widgetRef: 'wl://widgetva-app/workspace/main/widget/session_viewport-runtime',
      widgetId: 'session_viewport-runtime',
      source: 'workspace',
    })
    assert.deepEqual(runtime.store.readState()?.shared?.highlight, {
      entries: [{
        widgetRef: 'wl://widgetva-app/workspace/main/widget/session_viewport-runtime',
        widgetId: 'session_viewport-runtime',
        selectionRef: null,
        sourceWidgetRef: null,
        sourceWidgetId: null,
        summary: null,
        predicates: [],
        highlightedKeys: ['USA'],
        inboundLinkIds: [],
        highlightLinkIds: [],
        linkedSourceRefs: [],
      }],
      activeWidgetRefs: ['wl://widgetva-app/workspace/main/widget/session_viewport-runtime'],
    })
    runtime.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})
