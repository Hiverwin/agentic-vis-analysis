import test from 'node:test'
import assert from 'node:assert/strict'

import { createWidgetVARuntime } from '../../../core/runtime/RuntimeOrchestrator.js'

function buildBarSpec() {
  return {
    data: {
      values: [
        { category: 'A', type: 'T1', value: 10 },
        { category: 'A', type: 'T2', value: 5 },
        { category: 'B', type: 'T1', value: 7 },
        { category: 'B', type: 'T2', value: 3 },
      ],
    },
    mark: 'bar',
    encoding: {
      x: { field: 'category', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'type', type: 'nominal' },
      xOffset: { field: 'type' },
    },
  }
}

function createBarRuntime() {
  const spec = buildBarSpec()
  let providerActionCallCount = 0
  const runtime = createWidgetVARuntime({
    registerDefaultWidgetFamilies: true,
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'bar-runtime-actions',
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
        throw new Error('bar family actions should not call provider actions directly')
      },
    },
  })
  return {
    runtime,
    readProviderActionCallCount: () => providerActionCallCount,
  }
}

test('bar add/remove category visibility actions write semantic patches without calling the provider', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const { runtime, readProviderActionCallCount } = createBarRuntime()

  try {
    const widgetRef = runtime.describeWorkspace().widgets[0].ref
    const removeResult = await runtime.executeAction({
      callId: 'remove_bar',
      actor: 'agent',
      name: 'bar.removeBars',
      target: { widgetRef },
      params: { values: ['B'], field: 'category' },
    })
    let widget = runtime.readState().widgets[widgetRef]
    let visibilityTransform = widget.transforms.find((transform) =>
      transform?.spec?.actionName === 'bar.removeBars',
    )

    assert.equal(removeResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.deepEqual(widget.data.analysis.visibility.visibleValues, ['A'])
    assert.equal(widget.data.analysis.visibility.operation, 'remove')
    assert.equal(widget.view.addRemove.mode, 'categoryVisibility')
    assert.equal(widget.data.visibleCount, 2)
    assert.equal(visibilityTransform.kind, 'filter')
    assert.equal(visibilityTransform.source, 'action')

    const addResult = await runtime.executeAction({
      callId: 'add_bar',
      actor: 'agent',
      name: 'bar.addBars',
      target: { widgetRef },
      params: { values: ['B'], field: 'category' },
    })
    widget = runtime.readState().widgets[widgetRef]
    visibilityTransform = widget.transforms.find((transform) =>
      transform?.spec?.actionName === 'bar.addBars',
    )

    assert.equal(addResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.deepEqual(widget.data.analysis.visibility.visibleValues, ['A', 'B'])
    assert.equal(widget.data.analysis.visibility.operation, 'add')
    assert.equal(widget.data.visibleCount, 4)
    assert.equal(visibilityTransform.kind, 'filter')
    assert.equal(visibilityTransform.source, 'action')
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})

test('bar category selection writes a stable field-keyed selection ref', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const { runtime, readProviderActionCallCount } = createBarRuntime()

  try {
    const widgetRef = runtime.describeWorkspace().widgets[0].ref
    const result = await runtime.executeAction({
      callId: 'select_bar_category',
      actor: 'agent',
      name: 'bar.selectCategory',
      target: { widgetRef },
      params: { field: 'category', values: ['A'] },
    })
    const widget = runtime.readState().widgets[widgetRef]
    const selectionRef = `${widgetRef}/selection/category`

    assert.equal(result.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.deepEqual(Object.keys(widget.selections), [selectionRef])
    assert.deepEqual(widget.selections[selectionRef].predicates, [
      { field: 'category', op: 'in', value: ['A'] },
    ])
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})

test('bar add/remove item visibility actions write semantic tuple filters without calling the provider', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const { runtime, readProviderActionCallCount } = createBarRuntime()

  try {
    const widgetRef = runtime.describeWorkspace().widgets[0].ref
    const removeResult = await runtime.executeAction({
      callId: 'remove_item',
      actor: 'agent',
      name: 'bar.removeBarItems',
      target: { widgetRef },
      params: { items: [{ x: 'A', sub: 'T2' }], xField: 'category', subField: 'type' },
    })
    let widget = runtime.readState().widgets[widgetRef]
    let itemTransform = widget.transforms.find((transform) =>
      transform?.spec?.actionName === 'bar.removeBarItems',
    )

    assert.equal(removeResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.data.analysis.visibility.mode, 'item')
    assert.equal(widget.data.analysis.visibility.visibleItems.length, 3)
    assert.equal(widget.data.visibleCount, 3)
    assert.equal(itemTransform.kind, 'filter')
    assert.equal(itemTransform.source, 'action')
    assert.deepEqual(itemTransform.spec.fields, ['category', 'type'])

    const addResult = await runtime.executeAction({
      callId: 'add_item',
      actor: 'agent',
      name: 'bar.addBarItems',
      target: { widgetRef },
      params: { items: [{ x: 'A', sub: 'T2' }], xField: 'category', subField: 'type' },
    })
    widget = runtime.readState().widgets[widgetRef]
    itemTransform = widget.transforms.find((transform) =>
      transform?.spec?.actionName === 'bar.addBarItems',
    )

    assert.equal(addResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.data.analysis.visibility.visibleItems.length, 4)
    assert.equal(widget.data.visibleCount, 4)
    assert.equal(itemTransform.kind, 'filter')
    assert.equal(itemTransform.source, 'action')
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})

test('bar subcategory and stack actions write semantic state without calling the provider', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const { runtime, readProviderActionCallCount } = createBarRuntime()

  try {
    const widgetRef = runtime.describeWorkspace().widgets[0].ref
    const filterResult = await runtime.executeAction({
      callId: 'filter_subcategories',
      actor: 'agent',
      name: 'bar.filterSubcategories',
      target: { widgetRef },
      params: { subcategoriesToRemove: ['T2'], subField: 'type' },
    })
    let widget = runtime.readState().widgets[widgetRef]
    const filterTransform = widget.transforms.find((transform) =>
      transform?.spec?.actionName === 'bar.filterSubcategories',
    )

    assert.equal(filterResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.data.visibleCount, 2)
    assert.equal(filterTransform.kind, 'filter')
    assert.equal(filterTransform.source, 'action')
    assert.equal(filterTransform.spec.field, 'type')

    const expandResult = await runtime.executeAction({
      callId: 'expand_stack',
      actor: 'agent',
      name: 'bar.expandStack',
      target: { widgetRef },
      params: { category: 'A' },
    })
    widget = runtime.readState().widgets[widgetRef]
    const expandTransform = widget.transforms.find((transform) =>
      transform?.spec?.actionName === 'bar.expandStack',
    )

    assert.equal(expandResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.reencode.mode, 'expandStack')
    assert.equal(widget.view.reencode.category, 'A')
    assert.equal(widget.data.analysis.expandStack.subField, 'type')
    assert.equal(expandTransform.kind, 'filter')
    assert.equal(expandTransform.source, 'action')

    const stackResult = await runtime.executeAction({
      callId: 'toggle_stack',
      actor: 'agent',
      name: 'bar.toggleStackMode',
      target: { widgetRef },
      params: { mode: 'grouped' },
    })
    widget = runtime.readState().widgets[widgetRef]

    assert.equal(stackResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.reencode.mode, 'stackMode')
    assert.equal(widget.view.reencode.layout, 'grouped')
    assert.equal(widget.data.analysis.stackMode.subField, 'type')
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})
