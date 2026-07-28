import test from 'node:test'
import assert from 'node:assert/strict'

import { createWidgetVARuntime } from '../../../core/runtime/RuntimeOrchestrator.js'

function buildSankeySpec() {
  return {
    kind: 'sankey',
    data: [
      {
        name: 'rawLinks',
        values: [
          { source: 'A', target: 'B', value: 30 },
          { source: 'A', target: 'C', value: 10 },
          { source: 'B', target: 'D', value: 20 },
        ],
      },
      {
        name: 'nodeConfig',
        values: [
          { name: 'A', depth: 0, order: 0 },
          { name: 'B', depth: 1, order: 0 },
          { name: 'C', depth: 1, order: 1 },
          { name: 'D', depth: 2, order: 0 },
        ],
      },
    ],
    marks: [
      { name: 'edgeMark', type: 'path' },
    ],
  }
}

function createSankeyRuntime() {
  const spec = buildSankeySpec()
  let providerActionCallCount = 0
  const runtime = createWidgetVARuntime({
    registerDefaultWidgetFamilies: true,
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'sankey-runtime-actions',
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
        throw new Error('sankey family actions should not call provider actions directly')
      },
    },
  })
  return {
    runtime,
    readProviderActionCallCount: () => providerActionCallCount,
  }
}

async function execute(runtime, widgetRef, name, params) {
  return runtime.executeAction({
    callId: name.replaceAll('.', '_'),
    actor: 'agent',
    name,
    target: { widgetRef },
    params,
  })
}

test('sankey provider-backed actions write semantic state patches without calling the provider', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const { runtime, readProviderActionCallCount } = createSankeyRuntime()

  try {
    const widgetRef = runtime.describeWorkspace().widgets[0].ref

    const filterResult = await execute(runtime, widgetRef, 'sankey.filterFlow', { minValue: 20 })
    let widget = runtime.readState().widgets[widgetRef]
    assert.equal(filterResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.reencode.mode, 'flowFilter')
    assert.equal(widget.data.analysis.flowFilter.minValue, 20)
    assert.equal(widget.transforms.find((transform) => transform?.spec?.actionName === 'sankey.filterFlow')?.kind, 'filter')

    const collapseResult = await execute(runtime, widgetRef, 'sankey.collapseNodes', {
      nodes: ['B', 'C'],
      aggregateName: 'Other Middle',
    })
    widget = runtime.readState().widgets[widgetRef]
    assert.equal(collapseResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.addRemove.mode, 'nodeCollapse')
    assert.deepEqual(widget.view.addRemove.nodes, ['B', 'C'])
    assert.equal(widget.data.analysis.nodeCollapse.aggregateName, 'Other Middle')

    const expandResult = await execute(runtime, widgetRef, 'sankey.expandNode', {
      aggregateName: 'Other Middle',
    })
    widget = runtime.readState().widgets[widgetRef]
    assert.equal(expandResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.addRemove.mode, 'nodeExpansion')
    assert.equal(widget.data.analysis.nodeExpansion.aggregateName, 'Other Middle')
    assert.equal(widget.transforms.some((transform) => transform?.spec?.actionName === 'sankey.collapseNodes'), false)

    const highlightResult = await execute(runtime, widgetRef, 'sankey.highlightPath', {
      path: ['A', 'B', 'D'],
    })
    widget = runtime.readState().widgets[widgetRef]
    assert.equal(highlightResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.highlight.mode, 'pathHighlight')
    assert.deepEqual(widget.data.analysis.pathHighlight.path, ['A', 'B', 'D'])
    assert.deepEqual(highlightResult.providerParams, {
      path: ['A', 'B', 'D'],
      nodes: ['A', 'B', 'D'],
    })

    const traceResult = await execute(runtime, widgetRef, 'sankey.traceNode', { nodeName: 'B' })
    widget = runtime.readState().widgets[widgetRef]
    assert.equal(traceResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.highlight.mode, 'nodeTrace')
    assert.equal(widget.data.analysis.nodeTrace.nodeName, 'B')
    assert.deepEqual(traceResult.providerParams, {
      node: 'B',
      nodeName: 'B',
    })

    const colorResult = await execute(runtime, widgetRef, 'sankey.colorFlows', {
      nodes: ['A'],
      color: '#123456',
    })
    widget = runtime.readState().widgets[widgetRef]
    assert.equal(colorResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.reencode.mode, 'flowColor')
    assert.equal(widget.data.analysis.flowColor.color, '#123456')

    const reorderResult = await execute(runtime, widgetRef, 'sankey.reorderNodesInLayer', {
      depth: 1,
      order: ['C', 'B'],
    })
    widget = runtime.readState().widgets[widgetRef]
    assert.equal(reorderResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.reencode.mode, 'nodeLayerOrder')
    assert.deepEqual(widget.data.analysis.nodeLayerOrder.order, ['C', 'B'])

    const autoCollapseResult = await execute(runtime, widgetRef, 'sankey.autoCollapseByRank', { topN: 1 })
    widget = runtime.readState().widgets[widgetRef]
    assert.equal(autoCollapseResult.ok, true)
    assert.equal(readProviderActionCallCount(), 0)
    assert.equal(widget.view.addRemove.mode, 'autoCollapseByRank')
    assert.equal(widget.data.analysis.autoCollapse.topN, 1)
  } finally {
    runtime.dispose()
    globalThis.window = previousWindow
  }
})
