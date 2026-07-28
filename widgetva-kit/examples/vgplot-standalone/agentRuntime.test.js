import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createStandaloneAgentPort,
  createVisibleRowsReader,
} from './agentRuntime.js'
import {
  installVgplotRuntimeAssembly,
} from '../../src/adapters/vgplot/vgplotRuntimeRegistry.js'
import {
  readVgplotState,
} from '../../src/adapters/vgplot/vgplotState.js'
import {
  orchestrateVgplotView,
} from '../../src/adapters/vgplot/vgplotOrchestration.js'

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

function domain(values) {
  return [Math.min(...values), Math.max(...values)]
}

function createHarness() {
  const rows = [
    { name: 'Ford Pinto', horsepower: 75, mpg: 27, origin: 'USA' },
    { name: 'BMW 2002', horsepower: 113, mpg: 26, origin: 'Europe' },
    { name: 'Chevrolet Chevelle', horsepower: 130, mpg: 18, origin: 'USA' },
    { name: 'Ferrari Dino', horsepower: 175, mpg: 19, origin: 'Europe' },
  ]

  const assembly = installVgplotRuntimeAssembly({
    registryId: 'widgetva-vgplot-agent-runtime-test',
  })
  const context = assembly.createContext({ label: 'test' }, { contextId: 'ctx_test' })
  assembly.registerPlot(createPlot({
    xDomain: domain(rows.map((row) => row.horsepower)),
    yDomain: domain(rows.map((row) => row.mpg)),
    regressionMode: 'off',
  }), {
    context,
    plotId: 'cars_scatter_plot',
    widgetKind: 'scatter',
    selections: [[
      'brush',
      {
        type: 'intervalXY',
        value: { xDomain: [70, 180], yDomain: [18, 28] },
      },
    ]],
    params: [[
      'zoom_xy',
      {
        type: 'panZoom',
        value: {
          xDomain: domain(rows.map((row) => row.horsepower)),
          yDomain: domain(rows.map((row) => row.mpg)),
        },
      },
    ]],
    configActions: {
      'scatter.showRegression': ({ plot, params }) => {
        plot.setAttribute('regressionMode', params?.enabled === false ? 'off' : 'on')
        return true
      },
    },
    configStateKeys: ['regressionMode'],
  })

  const view = { context }
  const binding = {
    widgetRef: 'wl://widgetva-demo/workspace/main/widget/vgplot_scatter',
    dataRef: 'wl://widgetva-demo/workspace/main/data/cars',
    widgetKind: 'scatter',
    selectionNames: ['brush'],
    paramNames: ['zoom_xy'],
    fields: ['horsepower', 'mpg', 'origin'],
    plotBindings: [{
      plotId: 'cars_scatter_plot',
      role: 'main',
      xField: 'horsepower',
      yField: 'mpg',
      colorField: 'origin',
    }],
  }
  orchestrateVgplotView({
    view,
    binding,
    widgetKind: 'scatter',
  })

  return {
    rows,
    view,
    binding,
    readRows: createVisibleRowsReader({ rows, view }),
  }
}

test('createStandaloneAgentPort exposes a focused scatter workspace and action catalog', async () => {
  const harness = createHarness()
  const port = createStandaloneAgentPort(harness)

  const workspace = await port.describeWorkspace()
  const actions = await port.listAvailableActions()
  const perceptions = await port.listAvailablePerceptions()

  assert.equal(workspace.widgets[0].kind, 'scatter')
  assert.equal(workspace.widgets[0].ref, harness.binding.widgetRef)
  assert.ok(actions.some((entry) => entry.name === 'scatter.zoomDomain'))
  assert.ok(perceptions.some((entry) => entry.name === 'perception.computeCorrelation'))
})

test('createStandaloneAgentPort executeVerifiedAction applies provider-native zoom and returns verification', async () => {
  const harness = createHarness()
  const port = createStandaloneAgentPort(harness)

  const result = await port.executeVerifiedAction({
    callId: 'agent_step_1',
    actor: 'agent',
    name: 'scatter.zoomDomain',
    queryScope: { widgetRef: harness.binding.widgetRef },
    params: {
      xDomain: [70, 140],
      yDomain: [18, 28],
    },
  })

  const state = readVgplotState({ view: harness.view })
  assert.equal(result.actionResult.ok, true)
  assert.equal(result.verification.ok, true)
  assert.deepEqual(state.viewport.xDomain, [70, 140])
})

test('createStandaloneAgentPort queryPerception can summarize correlation over the visible rows', async () => {
  const harness = createHarness()
  const port = createStandaloneAgentPort(harness)

  const result = await port.queryPerception({
    callId: 'perception_1',
    actor: 'agent',
    name: 'perception.computeCorrelation',
    queryScope: { widgetRef: harness.binding.widgetRef },
    params: {},
  })

  assert.equal(result.ok, true)
  assert.equal(typeof result.result.correlation, 'number')
  assert.equal(result.result.sampleSize > 1, true)
})

test('createStandaloneAgentPort emits runtime callbacks during action and perception execution', async () => {
  const harness = createHarness()
  const events = []
  const port = createStandaloneAgentPort({
    ...harness,
    onRuntimeMutation(event) {
      events.push(event)
    },
  })

  await port.executeVerifiedAction({
    callId: 'agent_step_1',
    actor: 'agent',
    name: 'scatter.zoomDomain',
    queryScope: { widgetRef: harness.binding.widgetRef },
    params: {
      xDomain: [70, 140],
      yDomain: [18, 28],
    },
  })

  await port.queryPerception({
    callId: 'perception_1',
    actor: 'agent',
    name: 'perception.summarizeVisibleRows',
    queryScope: { widgetRef: harness.binding.widgetRef },
    params: {},
  })

  assert.equal(events.length, 2)
  assert.equal(events[0].kind, 'action')
  assert.equal(events[0].actionName, 'scatter.zoomDomain')
  assert.deepEqual(events[0].afterState.viewport.xDomain, [70, 140])
  assert.equal(events[1].kind, 'perception')
  assert.equal(events[1].perceptionName, 'perception.summarizeVisibleRows')
})
