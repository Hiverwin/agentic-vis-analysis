import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import * as widgetva from './index.js'
import * as widgetvaCore from './core/index.js'
import * as widgetvaAdapters from './adapters/index.js'
import * as widgetvaTransport from './transports/index.js'
import { barFamily } from './widgets/families/bar/index.js'
import { lineFamily } from './widgets/families/line/index.js'
import { heatmapFamily } from './widgets/families/heatmap/index.js'
import { createWidgetWorkspace as createInternalWidgetWorkspace } from './workspace/widgetWorkspace.js'
import { buildEmptyComputedPropagationSummary } from './workspace/coordinationOperationResult.js'
import { withViewportSubmodel } from './workspace/state/viewportStateModel.js'
import { createWidgetVARuntime } from './core/index.js'
import { attachVgplotPlotRuntimeMetadata } from './adapters/vgplot/vgplotRuntimeCapture.js'
import { workspaceDescribe as describeWorkspaceFromPage } from './transports/playwrightClient.js'

function buildScatterSpec(rows = [
  { x: 1, y: 2, category: 'a' },
  { x: 2, y: 3, category: 'b' },
]) {
  return {
    data: { values: rows },
    mark: 'point',
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      color: { field: 'category', type: 'nominal' },
    },
  }
}

function createTestRuntime(spec = buildScatterSpec()) {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const runtime = createWidgetVARuntime({
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'index-test-session',
      readBaselineSpec: () => spec,
      readCurrentSpec: () => spec,
      readWorkspaceSpec: () => null,
      readPlanningRequest: () => null,
      readRunMode: () => 'goal_oriented',
      readUserIntent: () => '',
      readCurrentSelection: () => null,
      readCurrentSelections: () => ({}),
      readFocusedWidgetRef: () => null,
      readComparisonTargets: () => [],
    },
  })

  return {
    runtime,
    restore() {
      runtime.dispose()
      globalThis.window = previousWindow
    },
  }
}

test('widgetva index exports the stable kit surface', () => {
  assert.deepEqual(Object.keys(widgetva).sort(), [
    'DEFAULT_WIDGETVA_AGENT_MODEL',
    'attachWidgetVAIntegration',
    'buildWidgetVAAgentKnowledge',
    'buildWidgetVAEmptyCoordinationResult',
    'buildWidgetVAEmptyPropagationSummary',
    'createWidgetVAHost',
    'createWidgetVARendererRegistry',
    'createWidgetVAWidget',
    'createWidgetVAWorkspace',
    'runWidgetVAAgentSession',
    'runWidgetVAAgentTurn',
  ])
  assert.equal(typeof widgetva.DEFAULT_WIDGETVA_AGENT_MODEL, 'string')
  assert.equal(typeof widgetva.buildWidgetVAAgentKnowledge, 'function')
  assert.equal(typeof widgetva.buildWidgetVAEmptyCoordinationResult, 'function')
  assert.equal(typeof widgetva.buildWidgetVAEmptyPropagationSummary, 'function')
  assert.equal(typeof widgetva.createWidgetVARendererRegistry, 'function')
  assert.equal(typeof widgetva.createWidgetVAHost, 'function')
  assert.equal(typeof widgetva.createWidgetVAWidget, 'function')
  assert.equal(typeof widgetva.createWidgetVAWorkspace, 'function')
  assert.equal(typeof widgetva.runWidgetVAAgentSession, 'function')
  assert.equal(typeof widgetva.runWidgetVAAgentTurn, 'function')
  assert.equal(typeof widgetva.attachWidgetVAIntegration, 'function')
})

test('widgetva package exports only the intended public entrypoints', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.deepEqual(
    Object.keys(pkg.exports),
    [
      '.',
      './internal/core',
      './internal/transport',
    ],
  )
})

test('widgetva keeps only the stable root surface public while internal details stay on internal entrypoints', () => {
  assert.equal(typeof widgetvaCore.createWidgetVARuntime, 'function')
  assert.equal('createRuntimeManager' in widgetvaCore, false)
  assert.equal(typeof widgetvaCore.createRuntimeOrchestrator, 'function')
  assert.equal(typeof widgetvaCore.installWidgetVAPagePort, 'function')
  assert.equal(typeof widgetvaCore.runAgentSession, 'function')
  assert.equal(typeof widgetvaCore.runNaturalLanguageAgentSession, 'function')
  assert.equal(typeof widgetvaCore.runAgentLoop, 'undefined')
  assert.equal(typeof widgetvaCore.runAgentTurn, 'undefined')
  assert.equal(typeof widgetvaCore.runNaturalLanguageAgentLoop, 'undefined')
  assert.equal(typeof widgetvaCore.runNaturalLanguageAgentTurn, 'undefined')
  assert.equal(typeof widgetvaCore.createNaturalLanguagePlanner, 'undefined')
  assert.equal(typeof widgetvaCore.createWidgetVAHostBridge, 'function')
  assert.equal(typeof widgetvaCore.applyWidgetRuntimeState, 'function')
  assert.equal(typeof widgetvaCore.attachWidgetRendererBridge, 'function')

  assert.equal('ActionContext' in widgetvaCore, false)
  assert.equal('ActionExecutor' in widgetvaCore, false)
  assert.equal('DataQueryExecutor' in widgetvaCore, false)
  assert.equal(typeof widgetvaCore.TraceRecorder, 'function')
  assert.equal(typeof widgetvaCore.CoordinationEngine, 'function')
  assert.equal('PerceptionExecutor' in widgetvaCore, false)
  assert.equal('ResponseRecorder' in widgetvaCore, false)
  assert.equal(typeof widgetvaCore.StateManager, 'function')
  assert.equal('WidgetRegistry' in widgetvaCore, false)
  assert.equal(typeof widgetvaCore.WidgetVARuntimeStore, 'function')
  assert.equal(typeof widgetvaCore.createRuntimeStore, 'function')
  assert.equal(typeof widgetvaCore.PAGE_PORT_ALIASES, 'object')
  assert.equal(typeof widgetvaCore.makeCurrentSelectionDataRef, 'function')
  assert.equal(typeof widgetvaCore.makeCurrentViewDataRef, 'function')
  assert.equal(typeof widgetvaCore.makeSelectionScopedDataRef, 'function')
  assert.equal(typeof widgetvaCore.makeWidgetRef, 'function')
  assert.equal(typeof widgetvaCore.makeWidgetSelectionDataRef, 'function')
  assert.equal(typeof widgetvaCore.normalizeWidgetLink, 'function')
  assert.equal(typeof widgetvaCore.readDeclaredLinkEffect, 'function')
  assert.equal(typeof widgetvaCore.readLinkActivationPolicy, 'function')
  assert.equal(typeof widgetvaCore.readLinkEffectConstraint, 'function')
  assert.equal(typeof widgetvaCore.buildSelectionCoordinationContext, 'function')
  assert.equal(typeof widgetvaCore.buildSelectionDomainCoordinationContext, 'function')
  assert.equal(typeof widgetvaCore.buildSelectionAdvancedResponseContext, 'function')
  assert.equal(typeof widgetvaCore.resolveSelectionDrivenRows, 'function')
  assert.equal(typeof widgetvaCore.resolveSelectionDrivenViewState, 'function')
  assert.equal(typeof widgetvaCore.deriveSelectionFilteredRows, 'function')
  assert.equal(typeof widgetvaCore.deriveHighlightedRows, 'function')
  assert.equal(typeof widgetvaCore.deriveHighlightPredicatesFromState, 'function')
  assert.equal(typeof widgetvaCore.deriveHighlightSummaryFromState, 'function')
  assert.equal(typeof widgetvaCore.readRuntimeDataFromStore, 'function')
  assert.equal(typeof widgetvaCore.readWorkspaceDescriptionFromStore, 'function')
  assert.equal(typeof widgetvaCore.readWorkspaceStateFromStore, 'function')
  assert.equal(typeof widgetvaCore.summarizeInteractionTraceRecord, 'function')
  assert.equal(typeof widgetvaCore.summarizeWorkspaceState, 'function')
  assert.equal(typeof widgetvaCore.runAgentSession, 'function')
  assert.equal(typeof widgetvaCore.runNaturalLanguageAgentSession, 'function')
  assert.equal(typeof widgetvaCore.buildSingleWidgetWorkspace, 'undefined')
  assert.equal('runWidgetVAAgentLoopExample' in widgetvaCore, false)

  assert.equal(typeof widgetvaAdapters.createWidgetAdapterContract, 'undefined')
  assert.equal(typeof widgetvaAdapters.instantiateWidgetAdapter, 'undefined')
  assert.equal(typeof widgetvaAdapters.RuntimeProviderWidgetAdapter, 'undefined')
  assert.equal(typeof widgetvaAdapters.installWidgetVAOnView, 'function')
  assert.equal(typeof widgetvaAdapters.installWidgetVAOnVegaLiteView, 'function')
  assert.equal(typeof widgetvaAdapters.resolveVgplotCapabilities, 'undefined')
  assert.equal(typeof widgetvaAdapters.executeVgplotAction, 'undefined')
  assert.equal(typeof widgetvaAdapters.queryVgplotPerception, 'undefined')
  assert.equal(typeof widgetvaAdapters.readVgplotState, 'undefined')
  assert.equal(typeof widgetvaAdapters.captureVgplotRuntime, 'undefined')
  assert.equal(typeof widgetvaAdapters.attachVgplotPlotRuntimeMetadata, 'undefined')
  assert.equal(typeof widgetvaAdapters.attachVgplotContextRuntimeMetadata, 'undefined')
  assert.equal(typeof widgetvaAdapters.createWidgetVAVgplotRegistry, 'undefined')
  assert.equal(typeof widgetvaAdapters.installVgplotRuntimeAssembly, 'undefined')
  assert.equal(typeof widgetvaAdapters.wrapVgplotAPIContext, 'undefined')
  assert.equal(typeof widgetvaAdapters.wrapVgplotPlot, 'undefined')
  assert.equal(typeof widgetvaAdapters.createVegaLiteWidgetAdapter, 'undefined')
  assert.equal(typeof widgetvaAdapters.createScatterWidgetAdapter, 'undefined')
  assert.equal(typeof widgetvaAdapters.createBarWidgetAdapter, 'undefined')
  assert.equal(typeof widgetvaAdapters.createHeatmapWidgetAdapter, 'undefined')
  assert.equal(typeof widgetvaAdapters.createRegisteredWidgetAdapterInstance, 'undefined')
  assert.equal(typeof widgetvaAdapters.getRegisteredWidgetAdapter, 'undefined')
  assert.equal(typeof widgetvaAdapters.registerDefaultWidgetAdapters, 'undefined')
  assert.equal(typeof widgetvaAdapters.ScatterWidgetAdapter, 'undefined')
  assert.equal(typeof widgetvaAdapters.BarWidgetAdapter, 'undefined')

  assert.equal(typeof widgetvaTransport.createPlaywrightTransportClient, 'function')
  assert.equal(typeof widgetvaTransport.createWebSocketTransportClient, 'function')
  assert.equal(typeof widgetvaTransport.createBrowserExtensionTransportClient, 'function')
  assert.equal(typeof widgetvaTransport.WidgetVAPlaywrightClient, 'function')
  assert.equal(typeof widgetvaTransport.createPagePortClient, 'function')
  assert.equal('createWidgetWorkspaceTransportClient' in widgetvaTransport, false)
  assert.equal('attachWidgetWorkspaceTransportSurface' in widgetvaTransport, false)
  assert.equal('describeWorkspaceFromPage' in widgetvaTransport, false)
  assert.equal('createWidgetVAHostWorkspace' in widgetva, false)
  assert.equal(typeof describeWorkspaceFromPage, 'function')

  assert.equal(typeof barFamily, 'object')
  assert.equal(typeof lineFamily, 'object')
  assert.equal(typeof heatmapFamily, 'object')
  assert.equal(typeof createInternalWidgetWorkspace, 'function')
  assert.equal(typeof buildEmptyComputedPropagationSummary, 'function')
  assert.equal(typeof withViewportSubmodel, 'function')
})

test('createWidgetVAWidget returns the stable mainline widget surface', () => {
  const { runtime, restore } = createTestRuntime()
  const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
  const widgetState = runtime.store.getWidgetState(widgetRef)

  const widget = widgetva.createWidgetVAWidget({
    runtime,
    widgetRef,
    spec: buildScatterSpec(),
    widgetState,
    widgetAdapter: {
      provider: 'test',
      async applyState() {},
      bindHumanInteractions() {
        return () => {}
      },
    },
  })

  try {
    for (const methodName of [
      'describe',
      'readState',
      'readWorkspaceState',
      'executeAction',
      'executeVerifiedAction',
      'queryPerception',
      'runDataQuery',
      'replay',
      'dispose',
    ]) {
      assert.equal(typeof widget?.[methodName], 'function', `Expected widget.${methodName} to exist`)
    }
    for (const methodName of [
      'readObservation',
      'buildActionDescriptors',
      'listPerceptionDescriptors',
      'readCoordinationState',
      'readPropagationSummary',
      'readVerificationState',
      'describeAgentContract',
    ]) {
      assert.equal(methodName in widget, false, `Expected widget.${methodName} to be removed`)
    }
  } finally {
    widget.dispose()
    restore()
  }
})

test('createWidgetVAWorkspace returns the stable mainline workspace surface', () => {
  const { runtime, restore } = createTestRuntime()
  const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
  const widgetState = runtime.store.getWidgetState(widgetRef)
  const widget = widgetva.createWidgetVAWidget({
    runtime,
    widgetRef,
    spec: buildScatterSpec(),
    widgetState,
    widgetAdapter: {
      provider: 'test',
      async applyState() {},
      bindHumanInteractions() {
        return () => {}
      },
    },
  })

  const workspace = widgetva.createWidgetVAWorkspace({
    runtime,
    widgets: [widget],
  })

  try {
    for (const methodName of [
      'describe',
      'readObservation',
      'listWidgets',
      'executeAction',
      'queryPerception',
      'replay',
      'dispose',
    ]) {
      assert.equal(typeof workspace?.[methodName], 'function', `Expected workspace.${methodName} to exist`)
    }
    for (const methodName of [
      'listActionNames',
      'listPerceptionNames',
      'listActionDescriptors',
      'listPerceptionDescriptors',
    ]) {
      assert.equal(methodName in workspace, false, `Expected workspace.${methodName} to be removed`)
    }
  } finally {
    workspace.dispose()
    widget.dispose()
    restore()
  }
})

test('widgetva index no longer exposes runtime-first, adapter-first, or transport-first internals on the mainline export', () => {
  assert.equal('WidgetInstance' in widgetva, false)
  assert.equal('createWidgetInstance' in widgetva, false)
  assert.equal('createWidgetWorkspace' in widgetva, false)
  assert.equal('createBarWidget' in widgetva, false)
  assert.equal('createLineWidget' in widgetva, false)
  assert.equal('createScatterWidget' in widgetva, false)
  assert.equal('createParallelCoordinatesWidget' in widgetva, false)
  assert.equal('createSankeyWidget' in widgetva, false)
  assert.equal('createHeatmapWidget' in widgetva, false)
  assert.equal('createWidgetVARuntime' in widgetva, false)
  assert.equal('createRuntimeStore' in widgetva, false)
  assert.equal('createWidgetVAHostBridge' in widgetva, false)
  assert.equal('applyWidgetRuntimeState' in widgetva, false)
  assert.equal('attachWidgetRendererBridge' in widgetva, false)
  assert.equal('summarizeWorkspaceState' in widgetva, false)
  assert.equal('readWorkspaceStateFromStore' in widgetva, false)
  assert.equal('PAGE_PORT_ALIASES' in widgetva, false)
  assert.equal('ActionExecutor' in widgetva, false)
  assert.equal('CoordinationEngine' in widgetva, false)
  assert.equal('WidgetVARuntimeStore' in widgetva, false)
  assert.equal('createWidgetAdapterContract' in widgetva, false)
  assert.equal('createVegaLiteWidgetAdapter' in widgetva, false)
  assert.equal('getRegisteredWidgetAdapter' in widgetva, false)
  assert.equal('registerDefaultWidgetAdapters' in widgetva, false)
  assert.equal('WidgetVAPlaywrightClient' in widgetva, false)
  assert.equal('createWebSocketTransportClient' in widgetva, false)
  assert.equal('createBrowserExtensionTransportClient' in widgetva, false)
  assert.equal('describeWidget' in widgetva, false)
  assert.equal('executeWidgetAction' in widgetva, false)
  assert.equal('queryWorkspacePerception' in widgetva, false)
  assert.equal('describeWorkspaceFromPage' in widgetva, false)
  assert.equal('RuntimeEvaluation' in widgetva, false)
  assert.equal('BenchmarkRuntimeAdapter' in widgetva, false)
  assert.equal('installWidgetVAEvaluationPort' in widgetva, false)
  assert.equal('protocol' in widgetva, false)
  assert.equal('runtime' in widgetva, false)
  assert.equal('rendering' in widgetva, false)
})

test('runWidgetVAAgentSession accepts a page-port compatible target', async () => {
  const result = await widgetva.runWidgetVAAgentSession({
    target: {
      describeWorkspace() {
        return {
          widgets: [],
        }
      },
      readObservation() {
        return {
          query: null,
        }
      },
      async queryPerception(call) {
        if (call?.name === 'perception.verifyActionEffect') {
          return {
            ok: true,
            result: {
              verified: true,
            },
          }
        }
        return {
          ok: true,
          result: {},
        }
      },
    },
    objective: 'Inspect the current view.',
    maxTurns: 1,
    operation: {
      kind: 'perception',
      name: 'perception.readSummary',
      params: {},
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.stopReason, 'turn_budget_reached')
  assert.equal(Array.isArray(result.turns), true)
  assert.equal(result.turns.length, 1)
})

test('runWidgetVAAgentSession accepts a widget/workspace-like agent surface without an explicit page port', async () => {
  const result = await widgetva.runWidgetVAAgentSession({
    target: {
      describeWorkspace() {
        return {
          widgets: [],
        }
      },
      readObservation() {
        return {
          query: 'Inspect the current widget.',
        }
      },
      async queryPerception(call) {
        if (call?.name === 'perception.verifyActionEffect') {
          return {
            ok: true,
            result: {
              verified: true,
            },
          }
        }
        return {
          ok: true,
          result: {},
        }
      },
    },
    objective: 'Inspect the current widget.',
    maxTurns: 1,
    operation: {
      kind: 'perception',
      name: 'perception.readSummary',
      params: {},
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.stopReason, 'turn_budget_reached')
  assert.equal(Array.isArray(result.turns), true)
  assert.equal(result.turns.length, 1)
})

test('runWidgetVAAgentSession rejects a bare runtime surface without agent-facing observation', async () => {
  const { runtime, restore } = createTestRuntime()

  try {
    assert.equal('runAgentTurn' in runtime, false)
    assert.equal('runAgentSession' in runtime, false)
    assert.equal('readAgentObservation' in runtime, false)
    assert.equal('readObservation' in runtime, false)

    await assert.rejects(
      () => widgetva.runWidgetVAAgentSession({
        target: runtime,
        objective: 'Inspect the current runtime state.',
        maxTurns: 1,
        operation: {
          kind: 'perception',
          name: 'perception.readSummary',
          params: {},
        },
      }),
      /readObservation\(\)/,
    )
  } finally {
    restore()
  }
})

test('attachWidgetVAIntegration rejects unsupported providers explicitly', async () => {
  await assert.rejects(
    () => widgetva.attachWidgetVAIntegration({
      provider: 'unknown-provider',
    }),
    /Unsupported WidgetVA integration provider/,
  )
})

test('attachWidgetVAIntegration routes Vega-Lite through the stable public view attach path', async () => {
  const previousWindow = globalThis.window
  try {
    globalThis.window = {
      addEventListener() {},
      removeEventListener() {},
    }

    const view = {
      signal() {
        return view
      },
      async runAsync() {},
      addSignalListener() {},
      removeSignalListener() {},
      addEventListener() {},
      removeEventListener() {},
      finalize() {},
    }

    const binding = await widgetva.attachWidgetVAIntegration({
      provider: 'vega-lite',
      root: globalThis.window,
      view,
      spec: {
        mark: 'bar',
        data: { values: [{ a: 'A', b: 1 }] },
        encoding: {
          x: { field: 'a', type: 'nominal' },
          y: { field: 'b', type: 'quantitative' },
        },
      },
    })

    assert.equal(typeof binding, 'object')
    assert.equal(binding.provider, 'vega-lite')
    assert.equal(typeof binding.pagePort, 'object')
    assert.equal(typeof binding.pagePort.describeWorkspace, 'function')
    assert.equal('describeAgentLoop' in binding.pagePort, false)
    assert.equal(typeof binding.runAgentLoop, 'function')
    assert.equal(typeof binding.readRecoverableState, 'function')
    assert.equal(typeof binding.restoreRecoverableState, 'function')
    assert.equal(typeof binding.dispose, 'function')
    assert.equal(typeof binding.widget, 'object')
    assert.equal(typeof binding.controller, 'object')
    const loopResult = await binding.runAgentLoop({
      objective: 'Inspect the current chart.',
      operation: {
        kind: 'perception',
        name: 'perception.findExtremes',
        queryScope: {
          widgetRef: binding.widget.resolveWidgetRef(),
        },
        params: {
          field: 'b',
          direction: 'max',
          limit: 1,
        },
      },
    })
    assert.equal(loopResult.result?.ok, true)
    binding.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAIntegration routes vgplot through the stable public view attach path', async () => {
  const previousWindow = globalThis.window
  try {
    globalThis.window = {
      addEventListener() {},
      removeEventListener() {},
    }

    const view = {}
    const binding = await widgetva.attachWidgetVAIntegration({
      provider: 'vgplot',
      root: globalThis.window,
      view,
      runtimeCapture: {
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
        selections: new Map([[
          'brush',
          {
            type: 'intervalXY',
            value: { xDomain: [0, 10], yDomain: [0, 20] },
          },
        ]]),
        params: new Map(),
        context: null,
      },
      binding: {
        widgetRef: 'wl://demo/workspace/main/widget/vgplot_scatter',
        dataRef: 'wl://demo/workspace/main/data/cars',
        widgetKind: 'scatter',
        selectionNames: ['brush'],
        fields: ['Horsepower', 'Miles_per_Gallon'],
      },
    })

    assert.equal(typeof binding, 'object')
    assert.equal(binding.provider, 'vgplot')
    assert.equal(typeof binding.pagePort, 'object')
    assert.equal(typeof binding.pagePort.describeWorkspace, 'function')
    assert.equal('describeAgentLoop' in binding.pagePort, false)
    assert.equal(typeof binding.runAgentLoop, 'function')
    assert.equal(typeof binding.readRecoverableState, 'function')
    assert.equal(typeof binding.restoreRecoverableState, 'function')
    assert.equal(typeof binding.dispose, 'function')
    assert.equal(typeof binding.widget, 'object')
    assert.equal(typeof binding.controller, 'object')
    const loopResult = await binding.runAgentLoop({
      objective: 'Inspect the current vgplot view.',
      operation: {
        kind: 'perception',
        name: 'perception.inspectViewConfig',
        queryScope: {
          widgetRef: binding.widget.resolveWidgetRef(),
        },
        params: {},
      },
    })
    assert.equal(loopResult.result?.ok, true)
    binding.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAIntegration infers vgplot runtime from a context-backed namedPlots view without an explicit runtimeCapture', async () => {
  const previousWindow = globalThis.window
  try {
    globalThis.window = {
      addEventListener() {},
      removeEventListener() {},
    }

    const plot = {
      attributes: new Map([['xDomain', [0, 10]], ['yDomain', [0, 20]]]),
      getAttribute(name) {
        return this.attributes.get(name)
      },
      setAttribute(name, value) {
        this.attributes.set(name, value)
      },
    }
    attachVgplotPlotRuntimeMetadata(plot, {
      widgetKind: 'scatter',
      selections: [
        ['brush', { type: 'intervalXY', value: { xDomain: [0, 10], yDomain: [0, 20] } }],
      ],
      params: [
        ['zoom_xy', { type: 'panZoom', value: { xDomain: [0, 10], yDomain: [0, 20] } }],
      ],
    })
    const context = {
      namedPlots: new Map([['scatter_main', plot]]),
    }
    const view = { context }

    const binding = await widgetva.attachWidgetVAIntegration({
      provider: 'vgplot',
      root: globalThis.window,
      view,
      binding: {
        widgetRef: 'wl://demo/workspace/main/widget/vgplot_scatter',
        dataRef: 'wl://demo/workspace/main/data/cars',
        widgetKind: 'scatter',
        selectionNames: ['brush'],
        fields: ['Horsepower', 'Miles_per_Gallon'],
      },
    })

    assert.equal(binding.provider, 'vgplot')
    assert.equal(typeof binding.pagePort?.describeWorkspace, 'function')
    assert.equal(typeof binding.widget?.resolveWidgetRef, 'function')
    binding.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('runWidgetVAAgentSession accepts an integration binding returned from attachWidgetVAIntegration', async () => {
  const previousWindow = globalThis.window
  try {
    globalThis.window = {
      addEventListener() {},
      removeEventListener() {},
    }

    const view = {
      signal() {
        return view
      },
      async runAsync() {},
      addSignalListener() {},
      removeSignalListener() {},
      addEventListener() {},
      removeEventListener() {},
      finalize() {},
    }

    const binding = await widgetva.attachWidgetVAIntegration({
      provider: 'vega-lite',
      root: globalThis.window,
      view,
      spec: {
        mark: 'bar',
        data: { values: [{ a: 'A', b: 1 }, { a: 'B', b: 3 }] },
        encoding: {
          x: { field: 'a', type: 'nominal' },
          y: { field: 'b', type: 'quantitative' },
        },
      },
    })

    const result = await widgetva.runWidgetVAAgentSession({
      target: binding,
      objective: 'Inspect the current chart.',
      maxTurns: 1,
      operation: {
        kind: 'perception',
        name: 'perception.findExtremes',
        queryScope: {
          widgetRef: binding.widget.resolveWidgetRef(),
        },
        params: {
          field: 'b',
          direction: 'max',
          limit: 1,
        },
      },
    })

    assert.equal(result.ok, true)
    assert.equal(result.stopReason, 'turn_budget_reached')
    assert.equal(Array.isArray(result.turns), true)
    assert.equal(result.turns.length, 1)

    binding.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})
