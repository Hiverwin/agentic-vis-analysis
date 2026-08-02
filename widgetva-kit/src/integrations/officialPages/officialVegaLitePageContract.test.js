import test from 'node:test'
import assert from 'node:assert/strict'

import {
  attachWidgetVAToVegaLiteView,
  buildOfficialPageExecutableActionDescriptors,
  buildOfficialPageExecutableActionNames,
  readOfficialPageSelectionState,
} from './officialVegaLitePageIntegrations.js'

function actionNames(descriptors = []) {
  return descriptors.map((descriptor) => descriptor.name)
}

test('official page render state includes selections written through the host bridge', () => {
  const state = readOfficialPageSelectionState({
    widgetState: { view: { zoom: { start: '2014/7/1', end: '2014/9/1' } }, selections: {} },
    workspaceState: { shared: { activeSelections: {} } },
    hostSelections: {
      'w_line::Museum-series': {
        selectionId: 'Museum-series',
        selectionRef: 'w_line::Museum-series',
        selection_type: 'category',
        field: 'Museum',
        values: ['Firehouse Museum'],
        predicates: [{ field: 'Museum', op: 'in', value: ['Firehouse Museum'] }],
      },
    },
  })

  assert.equal(state.selections['w_line::Museum-series'].field, 'Museum')
  assert.deepEqual(state.selections['w_line::Museum-series'].values, ['Firehouse Museum'])
})

test('official page contract maps point params to executable WidgetVA actions without exposing Vega-Lite native actions', () => {
  const interactionModel = {
    params: [{
      name: 'weather',
      selectionType: 'point',
      producerMark: 'point',
      consumerTypes: ['filter'],
    }],
  }

  const description = {
    actions: [
      { name: 'vegaLite.setPointParam' },
      { name: 'vegaLite.clearParam' },
      { name: 'scatter.identifyClusters' },
    ],
  }

  assert.deepEqual(
    actionNames(buildOfficialPageExecutableActionDescriptors(description, {
      interactionModel,
      recognizedKinds: ['scatter'],
    })),
    [
      'widget.clearSelection',
      'widget.resetView',
    ],
  )
})

test('official page contract exposes bar category actions only when point selection can back them', () => {
  const interactionModel = {
    params: [{
      name: 'category',
      selectionType: 'point',
      producerMark: 'bar',
      consumerTypes: ['filter', 'condition'],
    }],
  }

  assert.deepEqual(
    buildOfficialPageExecutableActionNames({
      interactionModel,
      recognizedKinds: ['bar'],
    }),
    [
      'bar.selectCategory',
      'bar.clickCategory',
      'bar.filterCategories',
      'widget.clearSelection',
      'widget.resetView',
    ],
  )
})

test('official page contract maps interval params to brush or domain semantic actions by recognized widget kind', () => {
  const interactionModel = {
    params: [{
      name: 'brush',
      selectionType: 'interval',
      producerMark: 'point',
      consumerTypes: ['scaleDomain'],
      isScaleBound: true,
    }],
  }

  assert.deepEqual(
    buildOfficialPageExecutableActionNames({
      interactionModel,
      recognizedKinds: ['scatter'],
    }),
    [
      'scatter.brushRegion',
      'scatter.zoomDomain',
      'widget.clearSelection',
      'widget.resetView',
    ],
  )
})

test('official page contract does not expose a full recognized family when the spec has no backing native interaction', () => {
  assert.deepEqual(
    buildOfficialPageExecutableActionNames({
      interactionModel: { params: [] },
      recognizedKinds: ['scatter', 'bar'],
    }),
    [],
  )
})

test('official page workspace executes exposed semantic actions through the page-backed dispatcher', async () => {
  const previousWindow = globalThis.window
  const root = {}
  globalThis.window = root

  let controller = null
  try {
    controller = await attachWidgetVAToVegaLiteView({
      root,
      view: { finalize() {} },
      spec: {
        data: {
          values: [
            { weather: 'sun', temp: 20, count: 10 },
            { weather: 'snow', temp: 2, count: 3 },
          ],
        },
        vconcat: [
          {
            mark: 'bar',
            params: [{
              name: 'weatherParam',
              select: { type: 'point', fields: ['weather'] },
            }],
            encoding: {
              x: { field: 'weather', type: 'nominal' },
              y: { field: 'count', type: 'quantitative' },
            },
          },
          {
            mark: 'point',
            transform: [{ filter: { param: 'weatherParam' } }],
            encoding: {
              x: { field: 'temp', type: 'quantitative' },
              y: { field: 'count', type: 'quantitative' },
              color: { field: 'weather', type: 'nominal' },
            },
          },
        ],
      },
    })

    const description = controller.workspace.describeWorkspace()
    const names = description.actions.map((action) => action.name)
    assert.equal(names.includes('bar.filterCategories'), true)
    assert.equal(names.includes('vegaLite.setPointParam'), false)

    const result = await controller.workspace.executeAction({
      name: 'bar.filterCategories',
      target: { widgetRef: description.widgets[0].ref },
      params: {
        field: 'weather',
        categories: ['snow'],
      },
    })

    assert.equal(result.ok, true)
    assert.equal(result.result.paramName, 'weatherParam')
    assert.notEqual(result.result.executionPath, 'runtime_action_executor')
  } finally {
    controller?.dispose?.()
    if (previousWindow === undefined) {
      delete globalThis.window
    } else {
      globalThis.window = previousWindow
    }
  }
})
