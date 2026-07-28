import test from 'node:test'
import assert from 'node:assert/strict'

import {
  attachWidgetVAToObservableD3ExplicitWorkspacePage,
  installWidgetVAWorkspaceContractRegistry,
} from './observableD3ExplicitWorkspaceContract.js'

test('explicit Observable D3 workspace contract exposes widgets, links, and action handlers', async () => {
  const calls = []
  const root = {}
  const WidgetVA = installWidgetVAWorkspaceContractRegistry(root)

  WidgetVA.registerWorkspace({
    workspaceId: 'penguin_scatter_bar',
    title: 'Penguin linked scatter and bar',
    widgets: [
      {
        widgetId: 'scatter_main',
        kind: 'scatter',
        title: 'Flipper length vs body mass',
        fields: {
          x: { field: 'flipper_length_mm', type: 'quantitative' },
          y: { field: 'body_mass_g', type: 'quantitative' },
          color: { field: 'species', type: 'nominal' },
        },
        actions: {
          'scatter.brushRegion': {
            paramsSchema: {
              type: 'object',
              required: ['xRange', 'yRange'],
            },
            apply(params, ctx) {
              calls.push(['brush', params, ctx.widget.widgetId])
              return { selectedCount: 42 }
            },
          },
        },
      },
      {
        widgetId: 'species_bar',
        kind: 'bar',
        title: 'Average body mass by species',
        fields: {
          x: { field: 'species', type: 'nominal' },
          y: { field: 'body_mass_g', type: 'quantitative' },
        },
        perceptions: ['perception.summarizeVisible'],
      },
    ],
    links: [{
      sourceWidgetId: 'scatter_main',
      sourceAction: 'scatter.brushRegion',
      targetWidgetId: 'species_bar',
      effect: 'filterVisibleRows',
    }],
    readState() {
      return {
        summary: 'Penguin linked-view state.',
        widgets: {
          scatter_main: { selectedCount: calls.length > 0 ? 42 : 0 },
          species_bar: { visibleCount: calls.length > 0 ? 42 : 333 },
        },
      }
    },
  })

  const controller = await attachWidgetVAToObservableD3ExplicitWorkspacePage({
    root,
    sessionId: 'official-observable-d3-penguin-scatter-bar',
  })

  const description = controller.workspace.describeWorkspace()
  assert.equal(description.source, 'explicit-widgetva-contract')
  assert.equal(description.widgets.length, 2)
  assert.equal(description.widgets[0].kind, 'scatter')
  assert.deepEqual(description.widgets[0].actionNames, ['scatter.brushRegion'])
  assert.equal(description.links[0].effect, 'filterVisibleRows')

  const observation = await controller.workspace.readObservation({
    query: 'How does flipper length relate to body mass?',
  })
  assert.equal(observation.state.widgets[0].data.fields[0].name, 'flipper_length_mm')
  assert.equal(observation.state.widgets[0].actionNames[0], 'scatter.brushRegion')

  const result = await controller.workspace.executeVerifiedAction({
    name: 'scatter.brushRegion',
    target: { widgetRef: description.widgets[0].ref },
    params: {
      xRange: [190, 210],
      yRange: [3500, 5000],
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.actionResult.ok, true)
  assert.equal(result.actionResult.updatedRefs[0], description.widgets[0].ref)
  assert.equal(result.actionResult.result.selectedCount, 42)
  assert.equal(result.recoverableState.stateId, 'penguin_scatter_bar:s1')
  assert.deepEqual(calls[0], [
    'brush',
    {
      xRange: [190, 210],
      yRange: [3500, 5000],
    },
    'scatter_main',
  ])
})

test('explicit Observable D3 workspace contract rejects undeclared actions', async () => {
  const root = {}
  installWidgetVAWorkspaceContractRegistry(root).registerWorkspace({
    workspaceId: 'minimal_d3',
    widgets: [{
      widgetId: 'scatter_main',
      kind: 'scatter',
      actions: ['scatter.brushRegion'],
    }],
  })

  const controller = await attachWidgetVAToObservableD3ExplicitWorkspacePage({ root })
  const widgetRef = controller.workspace.describeWorkspace().widgets[0].ref

  await assert.rejects(
    () => controller.workspace.executeVerifiedAction({
      name: 'scatter.zoomDomain',
      target: { widgetRef },
      params: {},
    }),
    /Unsupported explicit D3 workspace action: scatter\.zoomDomain/,
  )
})
