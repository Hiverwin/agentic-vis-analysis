import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createOfficialPageParamActionDispatcher,
} from './officialVegaLitePageAgentActions.js'

function createFakeWidget() {
  return {
    readWorkspaceState() {
      return {
        stateId: 'state:1',
      }
    },
  }
}

function createSelectionHostBridge(initialRegistry = {}) {
  let registry = { ...initialRegistry }
  return {
    readCurrentSelections() {
      return registry
    },
    writeCurrentSelections(nextRegistry) {
      registry = { ...nextRegistry }
    },
    readRegistry() {
      return registry
    },
  }
}

test('official page dispatcher routes bar.filterCategories through a matching Vega-Lite point param', async () => {
  const hostBridge = createSelectionHostBridge()
  const dispatcher = createOfficialPageParamActionDispatcher({
    widget: createFakeWidget(),
    sourceWidgetId: 'weather',
    sourceWidgetRef: 'weather-ref',
    hostBridge,
    spec: {
      mark: 'bar',
      encoding: {
        x: { field: 'weather' },
      },
    },
    interactionModel: {
      params: [{
        name: 'weatherParam',
        selectionType: 'point',
        fields: ['weather'],
        producerMark: 'bar',
        producerViewId: 'root',
        consumerTypes: ['filter'],
      }],
    },
  })

  const result = await dispatcher.executeParamAction({
    name: 'bar.filterCategories',
    target: { widgetRef: 'weather-ref' },
    params: {
      field: 'weather',
      categories: ['sun'],
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.result.paramName, 'weatherParam')
  assert.deepEqual(Object.values(hostBridge.readRegistry())[0].value, { weather: 'sun' })
  assert.deepEqual(
    Object.values(result.recoverableState.shared.activeSelections)[0].value,
    { weather: 'sun' },
  )
})

test('official page dispatcher routes line.zoomXRegion start/end params through an interval param', async () => {
  const hostBridge = createSelectionHostBridge()
  const dispatcher = createOfficialPageParamActionDispatcher({
    widget: createFakeWidget(),
    sourceWidgetId: 'stocks',
    sourceWidgetRef: 'stocks-ref',
    hostBridge,
    spec: {
      mark: 'line',
      encoding: {
        x: { field: 'date' },
      },
    },
    interactionModel: {
      params: [{
        name: 'brush',
        selectionType: 'interval',
        encodings: ['x'],
        producerMark: 'line',
        producerViewId: 'root',
        consumerTypes: ['scaleDomain'],
      }],
    },
  })

  const result = await dispatcher.executeParamAction({
    name: 'line.zoomXRegion',
    target: { widgetRef: 'stocks-ref' },
    params: {
      start: '2024-01-01',
      end: '2024-02-01',
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.result.paramName, 'brush')
  assert.deepEqual(Object.values(hostBridge.readRegistry())[0].domain, {
    xDomain: ['2024-01-01', '2024-02-01'],
  })
})

test('official page dispatcher clears page-backed selections for widget.resetView', async () => {
  const hostBridge = createSelectionHostBridge({
    existing: {
      selectionId: 'weatherParam',
    },
  })
  const dispatcher = createOfficialPageParamActionDispatcher({
    widget: createFakeWidget(),
    sourceWidgetId: 'weather',
    sourceWidgetRef: 'weather-ref',
    hostBridge,
    spec: {},
    interactionModel: {
      params: [{
        name: 'weatherParam',
        selectionType: 'point',
      }],
    },
  })

  const result = await dispatcher.executeParamAction({
    name: 'widget.resetView',
    target: { widgetRef: 'weather-ref' },
    params: {},
  })

  assert.equal(result.ok, true)
  assert.deepEqual(hostBridge.readRegistry(), {})
})
