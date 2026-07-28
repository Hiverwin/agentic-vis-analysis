import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildActionDescriptors,
  buildPerceptionDescriptors,
} from './workspaceDescriptorBuilders.js'

const widgetRef = 'wl://widgetva-app/workspace/main/widget/cell_mpg_hp'

test('workspace descriptor builders can narrow provider-executable action and perception surfaces', () => {
  const widgetSpec = {
    mark: 'point',
    data: {
      values: [
        { mpg: 18, hp: 130 },
        { mpg: 24, hp: 95 },
      ],
    },
    encoding: {
      x: { field: 'mpg', type: 'quantitative' },
      y: { field: 'hp', type: 'quantitative' },
    },
  }
  const widgetDef = {
    widgetId: 'cell_mpg_hp',
    kind: 'scatter',
    exposedActionNames: ['scatter.brushRegion', 'widget.clearSelection'],
    exposedPerceptionNames: [
      'perception.inspectViewConfig',
      'perception.summarizeSelection',
      'perception.summarizeVisible',
    ],
  }

  const actionNames = buildActionDescriptors({
    widgetRef,
    widgetKind: 'scatter',
    widgetSpec,
    widgetDef,
  }).map((descriptor) => descriptor.name)
  const perceptionNames = buildPerceptionDescriptors({
    widgetRef,
    dataRef: 'wl://widgetva-app/workspace/main/data/current_view',
    widgetKind: 'scatter',
    widgetSpec,
    widgetDef,
  }).map((descriptor) => descriptor.name)

  assert.deepEqual(actionNames, ['scatter.brushRegion', 'widget.clearSelection'])
  assert.deepEqual(perceptionNames, [
    'perception.inspectViewConfig',
    'perception.summarizeSelection',
    'perception.summarizeVisible',
  ])
})
