import test from 'node:test'
import assert from 'node:assert/strict'

import { createWidgetVARuntime } from '../../../core/runtime/RuntimeOrchestrator.js'
import { buildParallelCoordinatesActionDescriptors } from './actionDescriptors.js'

test('parallel category actions require values as an array in the agent contract', () => {
  const descriptors = buildParallelCoordinatesActionDescriptors()
  for (const name of ['parallelCoordinates.filterByCategory', 'parallelCoordinates.highlightCategory']) {
    const descriptor = descriptors.find((entry) => entry.name === name)
    assert.deepEqual(descriptor?.paramsSchema?.properties?.values, {
      type: 'array',
      minItems: 1,
      items: { type: 'string' },
    })
  }
})

function buildParallelCoordinatesSpec() {
  return {
    kind: 'parallelCoordinates',
    data: {
      values: [
        { id: 'a', Origin: 'USA', Horsepower: 120, Weight: 2400, Miles_per_Gallon: 24 },
        { id: 'b', Origin: 'Japan', Horsepower: 85, Weight: 1900, Miles_per_Gallon: 34 },
        { id: 'c', Origin: 'USA', Horsepower: 160, Weight: 3100, Miles_per_Gallon: 18 },
      ],
    },
    transform: [
      { fold: ['Horsepower', 'Weight', 'Miles_per_Gallon'], as: ['dimension', 'value'] },
    ],
    mark: 'line',
    encoding: {
      x: { field: 'dimension', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'id', type: 'nominal' },
      detail: { field: 'id', type: 'nominal' },
    },
  }
}

function createParallelCoordinatesRuntime() {
  const spec = buildParallelCoordinatesSpec()
  let providerActionCallCount = 0
  const runtime = createWidgetVARuntime({
    registerDefaultWidgetFamilies: true,
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'parallel-coordinates-runtime-actions',
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
      executeProviderAction() {
        providerActionCallCount += 1
        throw new Error('parallel coordinates family actions should not call provider actions directly')
      },
    },
  })
  return {
    runtime,
    readProviderActionCallCount: () => providerActionCallCount,
  }
}

test('parallelCoordinates.reorderDimensions writes semantic reencode state without calling the provider', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const { runtime, readProviderActionCallCount } = createParallelCoordinatesRuntime()

  try {
    const widgetRef = runtime.describeWorkspace().widgets[0].ref
    const dimensionOrder = ['Weight', 'Horsepower', 'Miles_per_Gallon']
    const result = await runtime.executeAction({
      callId: 'reorder_parallel_dimensions',
      actor: 'agent',
      name: 'parallelCoordinates.reorderDimensions',
      target: { widgetRef },
      params: { dimensionOrder },
    })
    const widget = runtime.readState().widgets[widgetRef]
    const reorderTransform = widget.transforms.find((transform) =>
      transform?.spec?.actionName === 'parallelCoordinates.reorderDimensions',
    )

    assert.equal(result.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.reencode.mode, 'dimensionOrder')
    assert.deepEqual(widget.view.reencode.dimensionOrder, dimensionOrder)
    assert.deepEqual(widget.data.analysis.dimensionOrder.dimensionOrder, dimensionOrder)
    assert.equal(reorderTransform.kind, 'reencode')
    assert.equal(reorderTransform.source, 'action')
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})

test('parallelCoordinates.highlightCategory writes semantic highlight state without calling the provider', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const { runtime, readProviderActionCallCount } = createParallelCoordinatesRuntime()

  try {
    const widgetRef = runtime.describeWorkspace().widgets[0].ref
    const result = await runtime.executeAction({
      callId: 'highlight_parallel_category',
      actor: 'agent',
      name: 'parallelCoordinates.highlightCategory',
      target: { widgetRef },
      params: { field: 'Origin', values: ['USA'] },
    })
    const widget = runtime.readState().widgets[widgetRef]

    assert.equal(result.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.highlight.mode, 'categoryEmphasis')
    assert.equal(widget.view.highlight.field, 'Origin')
    assert.deepEqual(widget.view.highlight.values, ['USA'])
    assert.deepEqual(widget.data.analysis.highlight.predicates, [
      { field: 'Origin', op: 'in', value: ['USA'] },
    ])
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})

test('parallelCoordinates dimension visibility actions write and clear semantic state without calling the provider', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const { runtime, readProviderActionCallCount } = createParallelCoordinatesRuntime()

  try {
    const widgetRef = runtime.describeWorkspace().widgets[0].ref
    const hideResult = await runtime.executeAction({
      callId: 'hide_parallel_dimension',
      actor: 'agent',
      name: 'parallelCoordinates.hideDimensions',
      target: { widgetRef },
      params: { dimensions: ['Weight'] },
    })
    let widget = runtime.readState().widgets[widgetRef]
    let visibilityTransform = widget.transforms.find((transform) =>
      transform?.spec?.actionName === 'parallelCoordinates.hideDimensions',
    )

    assert.equal(hideResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.dimensionVisibility.operation, 'hide')
    assert.deepEqual(widget.view.dimensionVisibility.hiddenDimensions, ['Weight'])
    assert.deepEqual(widget.view.dimensionVisibility.visibleDimensions, ['Horsepower', 'Miles_per_Gallon'])
    assert.equal(widget.view.reencode.mode, 'dimensionVisibility')
    assert.equal(visibilityTransform.kind, 'filter')
    assert.equal(visibilityTransform.source, 'action')

    const resetResult = await runtime.executeAction({
      callId: 'reset_parallel_hidden_dimensions',
      actor: 'agent',
      name: 'parallelCoordinates.resetHiddenDimensions',
      target: { widgetRef },
      params: {},
    })
    widget = runtime.readState().widgets[widgetRef]
    visibilityTransform = widget.transforms.find((transform) =>
      transform?.spec?.actionName === 'parallelCoordinates.hideDimensions',
    )

    assert.equal(resetResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.deepEqual(widget.view.dimensionVisibility.hiddenDimensions, [])
    assert.deepEqual(widget.view.dimensionVisibility.visibleDimensions, ['Horsepower', 'Weight', 'Miles_per_Gallon'])
    assert.equal(visibilityTransform, undefined)
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})
