import test from 'node:test'
import assert from 'node:assert/strict'

import { ActionExecutor } from '../runtime/ActionExecutor.js'
import { LinkEngine } from '../runtime/LinkEngine.js'
import { PerceptionQueryRegistry } from '../runtime/PerceptionQueryRegistry.js'
import { WidgetVARuntimeStore } from '../runtime/RuntimeStore.js'
import { readStatePatch } from '../runtime/readStatePatch.js'
import { installWidgetVAManualPagePortExample } from './manualPagePortExample.js'
import { ScatterWidgetAdapter } from '../../adapters/widgetFamilies/runtimeWidgetAdapters.js'

test('installWidgetVAManualPagePortExample installs the documented minimal manual page-port flow and returns the page port', async () => {
  const fakeWindow = {}
  const store = new WidgetVARuntimeStore({ appId: 'demo', workspaceId: 'main' })
  const actionExecutor = new ActionExecutor()
  const perceptionQueryRegistry = new PerceptionQueryRegistry()
  const linkEngine = new LinkEngine(store)
  const widgetRef = 'wl://demo/workspace/main/widget/scatter'
  const dataRef = 'wl://demo/workspace/main/data/cars'

  const scatterChart = {
    getState() {
      return {
        ref: widgetRef,
        widgetId: 'scatter',
        kind: 'scatter',
        version: 1,
        rawSpec: {
          mark: 'point',
          data: {
            values: [
              { Horsepower: 70, MPG: 18 },
              { Horsepower: 90, MPG: 24 },
            ],
          },
          encoding: {
            x: { field: 'Horsepower', type: 'quantitative' },
            y: { field: 'MPG', type: 'quantitative' },
          },
        },
        data: {
          sourceDataRef: dataRef,
          currentDataRef: dataRef,
        },
        view: {},
        selections: {},
      }
    },
    setBrush() {},
  }

  const adapter = new ScatterWidgetAdapter(widgetRef, scatterChart, dataRef)
  store.descriptions[adapter.widgetRef] = adapter.getDescription()
  store.widgets[adapter.widgetRef] = adapter.getState()
  store.dataHandles[dataRef] = {
    ref: dataRef,
    title: 'Cars',
    supportedQueries: ['inspectVisibleRows', 'computeCorrelation'],
  }
  store.upsertRuntimeData(dataRef, {
    ref: dataRef,
    rows: scatterChart.getState().rawSpec.data.values,
    baseRows: scatterChart.getState().rawSpec.data.values,
    widgetRef,
    kind: 'dataView',
    scope: 'visible',
    handle: store.getDataHandle(dataRef),
  })
  adapter.registerActions(actionExecutor)
  adapter.registerPerceptionQueries(perceptionQueryRegistry)

  const installed = installWidgetVAManualPagePortExample({
    windowObject: fakeWindow,
    store,
    actionExecutor,
    perceptionQueryRegistry,
    actionContext: {
      store,
      patchWidget: (ref, patch) => store.patchWidget(ref, patch),
      propagate: (ref) => linkEngine.propagate(ref),
      readStatePatch: (refs) => readStatePatch(store, refs),
    },
  })

  assert.equal(installed.windowObject, fakeWindow)
  assert.equal(typeof installed.uninstall, 'function')
  assert.equal(typeof installed.port?.describeWorkspace, 'function')

  const workspace = await installed.port.describeWorkspace()
  assert.equal(workspace.workspaceId, 'main')
  assert.equal(workspace.widgets.some((widget) => widget?.ref === widgetRef), true)

  installed.uninstall()
})

test('installWidgetVAManualPagePortExample validates the required runtime pieces', () => {
  assert.throws(
    () => installWidgetVAManualPagePortExample({
      windowObject: {},
      store: null,
      actionExecutor: {},
      perceptionQueryRegistry: {},
    }),
    /requires a runtime store/i,
  )

  assert.throws(
    () => installWidgetVAManualPagePortExample({
      windowObject: {},
      store: {},
      actionExecutor: null,
      perceptionQueryRegistry: {},
    }),
    /requires an action executor/i,
  )

  assert.throws(
    () => installWidgetVAManualPagePortExample({
      windowObject: {},
      store: {},
      actionExecutor: {},
      perceptionQueryRegistry: null,
    }),
    /requires a perception query registry/i,
  )
})
