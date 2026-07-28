import test from 'node:test'
import assert from 'node:assert/strict'

import { captureVgplotRuntime } from './vgplotRuntimeCapture.js'
import { createVgplotController } from './vgplotController.js'
import { resolveVgplotCapabilities } from './vgplotCapabilityResolver.js'
import { readVgplotState } from './vgplotState.js'
import {
  createWidgetVAVgplotRegistry,
  installVgplotRuntimeAssembly,
  wrapVgplotAPIContext,
  wrapVgplotPlot,
} from './vgplotRuntimeRegistry.js'

function createPlot(initialAttributes = {}) {
  const attributes = new Map(Object.entries(initialAttributes))
  return {
    attributes,
    getAttribute(name) {
      return attributes.get(name)
    },
    setAttribute(name, value) {
      attributes.set(name, value)
    },
  }
}

test('createWidgetVAVgplotRegistry registers contexts and plots without touching the public root surface', () => {
  const registry = createWidgetVAVgplotRegistry({
    registryId: 'vgplot-test-registry',
  })
  const context = {}
  const plot = createPlot({ xDomain: [0, 10], yDomain: [0, 20] })

  wrapVgplotAPIContext(context, {
    registry,
    contextId: 'ctx_weather',
  })
  wrapVgplotPlot(plot, {
    registry,
    context,
    plotId: 'weather_scatter',
    widgetKind: 'scatter',
  })

  assert.deepEqual(registry.describe(), {
    registryId: 'vgplot-test-registry',
    contextIds: ['ctx_weather'],
    plotIds: ['weather_scatter'],
  })
  assert.equal(context.namedPlots instanceof Map, true)
  assert.equal(context.namedPlots.get('weather_scatter'), plot)
  assert.equal(plot.__widgetvaVgplotMeta?.widgetKind, 'scatter')
})

test('vgplot registry attaches selections and params that runtime capture can later discover', () => {
  const registry = createWidgetVAVgplotRegistry()
  const context = {}
  const plot = createPlot({ xDomain: [1, 9], yDomain: [2, 8] })

  wrapVgplotAPIContext(context, {
    registry,
    contextId: 'ctx_cars',
  })
  wrapVgplotPlot(plot, {
    registry,
    context,
    plotId: 'cars_scatter',
    widgetKind: 'scatter',
  })
  registry.attachSelectionEntries(plot, [
    ['brush', { type: 'intervalXY', value: { xDomain: [1, 9], yDomain: [2, 8] } }],
  ])
  registry.attachParamEntries(context, [
    ['zoom_xy', { type: 'panZoom', value: { xDomain: [1, 9], yDomain: [2, 8] } }],
  ])

  const runtime = captureVgplotRuntime({
    view: { context },
  })

  assert.deepEqual([...runtime.plots.keys()], ['cars_scatter'])
  assert.deepEqual([...runtime.selections.keys()], ['brush'])
  assert.deepEqual([...runtime.params.keys()], ['zoom_xy'])
  assert.equal(runtime.plots.get('cars_scatter')?.widgetKind, 'scatter')
})

test('installVgplotRuntimeAssembly creates a minimal assembly wrapper for context and plot registration', () => {
  const assembly = installVgplotRuntimeAssembly({
    registryId: 'vgplot-assembly-test',
  })
  const context = assembly.createContext({}, {
    contextId: 'ctx_demo',
  })
  const plot = assembly.registerPlot(createPlot({ xDomain: [0, 5] }), {
    context,
    plotId: 'demo_plot',
    widgetKind: 'line',
    params: [
      ['zoom_x', { type: 'panZoomX', value: { xDomain: [0, 5] } }],
    ],
  })

  assembly.attachSelections(plot, [
    ['nearest', { type: 'nearestX', value: { field: 'date', value: '2024-01-15' } }],
  ])

  const runtime = captureVgplotRuntime({
    view: { context },
  })

  assert.equal(typeof assembly.describe, 'function')
  assert.equal(assembly.describe().registryId, 'vgplot-assembly-test')
  assert.equal(context.namedPlots.get('demo_plot'), plot)
  assert.deepEqual([...runtime.plots.keys()], ['demo_plot'])
  assert.deepEqual([...runtime.params.keys()], ['zoom_x'])
  assert.deepEqual([...runtime.selections.keys()], ['nearest'])
})

test('vgplot registry preserves config action handlers and config-state metadata for real runtime capture', () => {
  const registry = createWidgetVAVgplotRegistry()
  const context = {}
  const plot = createPlot({ stackMode: 'stacked' })

  wrapVgplotAPIContext(context, {
    registry,
    contextId: 'ctx_actions',
  })
  wrapVgplotPlot(plot, {
    registry,
    context,
    plotId: 'bars_plot',
    widgetKind: 'bar',
  })
  registry.attachConfigActions(plot, {
    'bar.toggleStackMode': ({ plot: targetPlot, params }) => {
      targetPlot.setAttribute('stackMode', params?.mode ?? null)
      return true
    },
  }, {
    stateKeys: ['stackMode'],
  })

  const runtime = captureVgplotRuntime({
    view: { context },
  })
  const view = { __widgetvaVgplotRuntime: runtime }
  const capabilities = resolveVgplotCapabilities({
    widgetKind: 'bar',
    view,
  })

  assert.equal(capabilities.supportedActionNames.includes('bar.toggleStackMode'), true)
  assert.equal(
    createVgplotController({ view }).executePlotConfigAction('bars_plot', 'bar.toggleStackMode', { mode: 'grouped' }),
    true,
  )
  assert.deepEqual(readVgplotState({ view }).config, {
    stackMode: 'grouped',
  })
})

test('installVgplotRuntimeAssembly can register config-backed actions directly on plot creation', () => {
  const assembly = installVgplotRuntimeAssembly({
    registryId: 'vgplot-config-assembly',
  })
  const context = assembly.createContext({}, {
    contextId: 'ctx_config',
  })
  assembly.registerPlot(createPlot({ drilldownLevel: 'root' }), {
    context,
    plotId: 'heatmap_plot',
    widgetKind: 'heatmap',
    configActions: {
      'heatmap.drilldownAxis': ({ plot, params }) => {
        plot.setAttribute('drilldownLevel', params?.level ?? null)
        plot.setAttribute('drilldownValue', params?.value ?? null)
        return true
      },
    },
    configStateKeys: ['drilldownLevel', 'drilldownValue'],
  })

  const runtime = captureVgplotRuntime({
    view: { context },
  })
  const view = { __widgetvaVgplotRuntime: runtime }
  const controller = createVgplotController({ view })

  assert.equal(
    controller.executePlotConfigAction('heatmap_plot', 'heatmap.drilldownAxis', { level: 'month', value: 7 }),
    true,
  )
  assert.deepEqual(readVgplotState({ view }).config, {
    drilldownLevel: 'month',
    drilldownValue: 7,
  })
})
