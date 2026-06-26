import test from 'node:test'
import assert from 'node:assert/strict'

import { createWidgetVARuntime } from '../core.js'
import { createProviderFamilyAdapter } from '../adapters/widgetFamilies/index.js'
import { SINGLE_WIDGET_AGENT_CONTRACT_VERSION } from './agentContract.js'
import { createWidgetInstance, WidgetInstance, WIDGET_INSTANCE_PUBLIC_METHODS } from './widgetInstance.js'
import { createD3LineChartWrapper } from '../../../visagentbench_v2/materializations/d3/reference/lineChartWrapper.js'
import { createD3ScatterChartWrapper } from '../../../visagentbench_v2/materializations/d3/reference/scatterChartWrapper.js'
import { createEChartsLineChartWrapper } from '../../../visagentbench_v2/materializations/echarts/reference/lineChartWrapper.js'
import { createEChartsScatterChartWrapper } from '../../../visagentbench_v2/materializations/echarts/reference/scatterChartWrapper.js'

function buildScatterSpec(rows = [
  { x: 1, y: 2, category: 'a' },
  { x: 2, y: 3, category: 'b' },
]) {
  return {
    data: {
      values: rows,
    },
    mark: 'point',
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      color: { field: 'category', type: 'nominal' },
    },
  }
}

function buildLineSpec(rows = [
  { date: '2024-01-01', series: 'A', revenue: 10 },
  { date: '2024-01-02', series: 'A', revenue: 20 },
  { date: '2024-01-01', series: 'B', revenue: 15 },
  { date: '2024-01-02', series: 'B', revenue: 18 },
]) {
  return {
    data: {
      values: rows,
    },
    mark: 'line',
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'revenue', type: 'quantitative' },
      color: { field: 'series', type: 'nominal' },
    },
  }
}

function createRuntimeWithScatterSpec() {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const spec = buildScatterSpec()
  const dataQueryCalls = []
  const runtime = createWidgetVARuntime({
    dataQueryEngine: {
      listSupportedQueryKinds() {
        return ['summary']
      },
      query(dataRef, query) {
        dataQueryCalls.push({ dataRef, query })
        return {
          rows: [{ count: 2 }],
        }
      },
    },
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'test-session',
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
      readWorkspaceAnnotations: () => [],
    },
  })

  return {
    runtime,
    dataQueryCalls,
    restore() {
      runtime.dispose()
      globalThis.window = previousWindow
    },
  }
}

function createRuntimeWithSpecAndAdapters({ spec, widgetAdapters = [] } = {}) {
  const previousWindow = globalThis.window
  globalThis.window = {}
  let currentSpec = JSON.parse(JSON.stringify(spec))
  const runtime = createWidgetVARuntime({
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'test-session',
      readBaselineSpec: () => spec,
      readCurrentSpec: () => currentSpec,
      writeCurrentSpec(nextSpec) {
        currentSpec = JSON.parse(JSON.stringify(nextSpec))
      },
      readWorkspaceSpec: () => null,
      readPlanningRequest: () => null,
      readRunMode: () => 'goal_oriented',
      readUserIntent: () => '',
      readCurrentSelection: () => null,
      readCurrentSelections: () => ({}),
      readFocusedWidgetRef: () => null,
      readComparisonTargets: () => [],
      readWorkspaceAnnotations: () => [],
    },
    widgetAdapters,
  })

  return {
    runtime,
    restore() {
      runtime.dispose()
      globalThis.window = previousWindow
    },
  }
}

async function flushAsyncWork() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

test('createWidgetInstance exposes the widget-first public contract over an existing runtime', async () => {
  const { runtime, dataQueryCalls, restore } = createRuntimeWithScatterSpec()
  const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
  const widgetState = runtime.store.getWidgetState(widgetRef)

  let bindCalls = 0
  let applyCalls = 0
  const widget = createWidgetInstance({
    runtime,
    widgetRef,
    spec: buildScatterSpec(),
    widgetState,
    widgetAdapter: {
      provider: 'test',
      async applyState() {
        applyCalls += 1
      },
      bindHumanInteractions() {
        bindCalls += 1
        return () => {}
      },
    },
  })

  runtime.actionExecutor.register(
    { name: 'widget.testSelect' },
    async (call, ctx) => ({
      nextState: {
        ...ctx.readCurrentState(),
        shared: {
          ...(ctx.readCurrentState()?.shared || {}),
          testSelection: call?.params?.selection || null,
        },
      },
      result: { selection: call?.params?.selection || null },
    }),
  )

  try {
    const initialStateId = widget.readWorkspaceState()?.stateId
    await widget.mount({ view: { addSignalListener() {}, removeSignalListener() {}, data() { return [] } } })

    assert.equal(widget.isMounted(), true)
    assert.equal(bindCalls, 1)
    assert.equal(applyCalls, 1)
    assert.equal(widget.describe()?.ref, widgetRef)
    const actionNames = widget.listActionNames()
    const perceptionNames = widget.listPerceptionNames()
    const actionDescriptorNames = widget.listActionDescriptors().map((descriptor) => descriptor?.name)
    const perceptionDescriptorNames = widget.listPerceptionDescriptors().map((descriptor) => descriptor?.name)
    const observation = widget.readObservation()

    assert.equal(actionNames.includes('scatter.brushRegion'), true)
    assert.equal(actionNames.includes('scatter.zoomDomain'), true)
    assert.equal(actionNames.includes('widget.changeEncoding'), true)
    assert.equal(actionNames.includes('workspace.jumpToState'), true)
    assert.equal(perceptionNames.includes('perception.computeCorrelation'), true)
    assert.equal(perceptionNames.includes('perception.findOutliers'), true)
    assert.equal(perceptionNames.includes('perception.findExtremes'), true)
    assert.equal(actionDescriptorNames.includes('scatter.brushRegion'), true)
    assert.equal(actionDescriptorNames.includes('scatter.zoomDomain'), true)
    assert.equal(perceptionDescriptorNames.includes('perception.computeCorrelation'), true)
    assert.equal(perceptionDescriptorNames.includes('perception.findOutliers'), true)
    assert.equal(perceptionDescriptorNames.includes('perception.findExtremes'), true)
    assert.equal(widget.readState()?.ref, widgetRef)
    assert.equal(observation?.widgetRef, widgetRef)
    assert.equal(observation?.widgetId, widget.resolveWidgetId())
    assert.equal(observation?.actionNames.includes('scatter.brushRegion'), true)
    assert.equal(observation?.perceptionNames.includes('perception.findExtremes'), true)
    assert.equal(observation?.coordination?.isFocused, false)
    assert.deepEqual(observation?.coordination?.localSelectionRefs, [])
    assert.deepEqual(observation?.coordination?.linkedSourceRefs, [])
    assert.equal(observation?.selection?.contract?.localSelectionFamily, 'interval')
    assert.deepEqual(observation?.selection?.contract?.sourceActionNames, ['scatter.brushRegion'])
    assert.equal(observation?.verification?.contract?.preferredReadMethod, 'readVerificationState')
    assert.equal(observation?.verification?.contract?.supportedEffectTypes.includes('selection'), true)
    assert.equal(observation?.selection?.localSelectionCount, 0)
    assert.equal(observation?.selection?.activeSelectionRef, null)
    assert.equal(observation?.state?.ref, widgetRef)
    const verificationState = widget.readVerificationState()
    assert.equal(verificationState?.kind, 'scatter')
    assert.equal(verificationState?.contract?.preferredReadMethod, 'readVerificationState')
    assert.equal(verificationState?.checks?.selectionApplied, false)
    assert.equal(verificationState?.checks?.highlightApplied, false)
    assert.equal(verificationState?.checks?.focusApplied, false)
    assert.equal(verificationState?.checks?.linkedPropagationApplied, false)
    assert.equal(verificationState?.checks?.zoomApplied, false)
    assert.equal(verificationState?.checks?.encodingReadable, true)
    assert.equal(typeof verificationState?.signatures?.encodings, 'string')

    runtime.store.patchWidget(widgetRef, {
      data: {
        rowCount: 10,
        visibleCount: 4,
        selectedCount: 4,
      },
      transforms: [
        { kind: 'filter', spec: { field: 'category', op: 'equals', value: 'a' } },
        { kind: 'aggregate', spec: { op: 'mean', field: 'y' } },
      ],
      view: {
        xDomain: [1, 2],
        zoom: { level: 2 },
        focusedCarId: 'car_b',
      },
      feedback: {
        linkedSourceRefs: ['wl://widgetva-app/workspace/main/widget/bar_a'],
        highlightedKeys: ['category:a'],
        sharedSelectionSourceWidgetId: 'bar_a',
      },
      selections: {
        'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush': {
          kind: 'interval',
          fields: ['x', 'y'],
          summary: 'Brushed x/y interval',
        },
      },
    })

    const updatedVerificationState = widget.readVerificationState()
    assert.equal(updatedVerificationState?.checks?.selectionApplied, true)
    assert.equal(updatedVerificationState?.checks?.filterApplied, true)
    assert.equal(updatedVerificationState?.checks?.zoomApplied, true)
    assert.equal(updatedVerificationState?.checks?.highlightApplied, true)
    assert.equal(updatedVerificationState?.checks?.focusApplied, true)
    assert.equal(updatedVerificationState?.checks?.linkedPropagationApplied, true)
    assert.equal(updatedVerificationState?.selections?.count, 1)
    assert.deepEqual(updatedVerificationState?.selections?.activeKinds, ['interval'])
    assert.equal(updatedVerificationState?.transforms?.hasAggregateTransform, true)
    assert.equal(updatedVerificationState?.view?.hasXDomainOverride, true)
    assert.equal(updatedVerificationState?.view?.hasZoom, true)
    assert.equal(updatedVerificationState?.view?.focusKeys?.focusedCarId, 'car_b')
    assert.equal(updatedVerificationState?.feedback?.sharedSelectionSourceWidgetId, 'bar_a')

    const actionResult = await widget.executeAction({
      name: 'widget.testSelect',
      params: { selection: ['a'] },
    })
    assert.equal(actionResult?.ok, true)

    const perceptionResult = await widget.queryPerception({
      name: 'perception.inspectViewConfig',
      params: {},
    })
    assert.equal(perceptionResult?.ok, true)
    assert.equal(typeof perceptionResult?.result, 'object')

    const dataResult = await widget.runDataQuery({
      dataRef: runtime.describeWorkspace().dataHandles[0]?.ref,
      query: {
        kind: 'summary',
        spec: {},
      },
    })
    assert.equal(dataResult?.ok, true)
    assert.deepEqual(dataQueryCalls[0], {
      dataRef: runtime.describeWorkspace().dataHandles[0]?.ref,
      query: {
        kind: 'summary',
        spec: {
          queryScope: {
            widgetRef,
            dataRef: null,
            selectionRef: null,
            focusRef: null,
            viewportRef: null,
          },
        },
      },
    })

    const trace = widget.readTrace({ limit: 10 })
    assert.equal(Array.isArray(trace), true)
    assert.equal(trace.some((entry) => entry?.eventKind === 'action'), true)

    const replayResult = await widget.replay(initialStateId)
    assert.equal(replayResult?.ok, true)
  } finally {
    widget.dispose()
    restore()
  }
})

test('WidgetInstance normalizes action targeting into queryScope instead of forwarding legacy targetRef', async () => {
  const { runtime, restore } = createRuntimeWithScatterSpec()
  const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
  const widgetState = runtime.store.getWidgetState(widgetRef)
  const widget = createWidgetInstance({
    runtime,
    widgetRef,
    spec: buildScatterSpec(),
    widgetState,
    widgetAdapter: {
      provider: 'test',
      async applyState() {},
      bindHumanInteractions() {
        return () => {}
      },
    },
  })

  runtime.actionExecutor.register(
    { name: 'widget.inspectScopedCall' },
    async (call) => ({
      result: {
        queryScope: call?.queryScope || null,
        targetRef: call?.targetRef || null,
      },
    }),
  )

  try {
    const result = await widget.executeAction({
      name: 'widget.inspectScopedCall',
      targetRef: 'wl://legacy/should_be_ignored',
      params: {},
    })

    assert.equal(result?.ok, true)
    assert.deepEqual(result?.result?.queryScope, {
      widgetRef,
      dataRef: null,
      selectionRef: null,
      focusRef: null,
      viewportRef: null,
    })
    assert.equal(result?.result?.targetRef, widgetRef)
  } finally {
    widget.dispose()
    restore()
  }
})

test('WidgetInstance.describeContract documents the stable public methods', () => {
  const contract = WidgetInstance.describeContract()
  assert.deepEqual(contract.methods, WIDGET_INSTANCE_PUBLIC_METHODS)
  assert.equal(typeof contract.constructorOptions.mountTarget, 'string')
  assert.equal(typeof contract.constructorOptions.container, 'string')
  assert.equal(typeof contract.methodSemantics.readObservation, 'string')
  assert.equal(typeof contract.methodSemantics.readVerificationState, 'string')
  assert.equal(typeof contract.methodSemantics.describeAgentContract, 'string')
  assert.equal(typeof contract.methodSemantics.executeAction, 'string')
  assert.equal(typeof contract.methodSemantics.executeVerifiedAction, 'string')
})

test('WidgetInstance.describeAgentContract exposes the single-widget agent-facing contract', async () => {
  const { runtime, restore } = createRuntimeWithScatterSpec()
  const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
  const widgetState = runtime.store.getWidgetState(widgetRef)
  const widget = createWidgetInstance({
    runtime,
    widgetRef,
    spec: buildScatterSpec(),
    widgetState,
    widgetAdapter: {
      provider: 'test',
      async applyState() {},
      bindHumanInteractions() {
        return () => {}
      },
    },
  })

  try {
    const contract = widget.describeAgentContract()

    assert.equal(contract.version, SINGLE_WIDGET_AGENT_CONTRACT_VERSION)
    assert.equal(contract.widget.ref, widgetRef)
    assert.equal(contract.widget.kind, 'scatter')
    assert.equal(contract.observe.observationMethodName, 'readObservation')
    assert.equal(contract.observe.perceptionMethodName, 'queryPerception')
    assert.equal(contract.act.actionMethodName, 'executeAction')
    assert.equal(contract.act.verifiedActionMethodName, 'executeVerifiedAction')
    assert.equal(contract.verify.verifyQueryName, 'perception.verifyActionEffect')
    assert.equal(contract.catalog.availableActionNames.includes('scatter.brushRegion'), true)
    assert.equal(contract.catalog.availablePerceptionNames.includes('perception.findExtremes'), true)
    assert.equal(contract.verify.verificationContract?.preferredReadMethod, 'readVerificationState')
    assert.equal(contract.schemas.actionCall.required.includes('params'), true)
  } finally {
    widget.dispose()
    restore()
  }
})

test('WidgetInstance.executeVerifiedAction delegates through the single-widget verified-action surface', async () => {
  const { runtime, restore } = createRuntimeWithScatterSpec()
  const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
  const widgetState = runtime.store.getWidgetState(widgetRef)
  const widget = createWidgetInstance({
    runtime,
    widgetRef,
    spec: buildScatterSpec(),
    widgetState,
    widgetAdapter: {
      provider: 'test',
      async applyState() {},
      bindHumanInteractions() {
        return () => {}
      },
    },
  })

  runtime.actionExecutor.register(
    { name: 'widget.testSelect' },
    async (call, ctx) => ({
      nextState: {
        ...ctx.readCurrentState(),
        shared: {
          ...(ctx.readCurrentState()?.shared || {}),
          testSelection: call?.params?.selection || null,
        },
      },
      result: { selection: call?.params?.selection || null },
    }),
  )

  try {
    const result = await widget.executeVerifiedAction({
      name: 'widget.testSelect',
      params: {
        selection: ['a'],
      },
    })

    assert.equal(result?.ok, true)
    assert.equal(result?.actionResult?.ok, true)
    assert.equal(result?.actionResult?.actionName, 'widget.testSelect')
    assert.equal(result?.verification?.ok, true)
    assert.equal(result?.verification?.result?.verified, true)
    assert.equal(result?.verification?.result?.matchedActionName, 'widget.testSelect')
    assert.equal(typeof result?.beforeStateId, 'string')
    assert.equal(typeof result?.afterView?.stateId, 'string')
  } finally {
    widget.dispose()
    restore()
  }
})

test('WidgetInstance drives the D3 scatter reference wrapper through structured brush and zoom actions', async () => {
  const rows = [
    { id: 'a', x: 10, y: 20, category: 'c1' },
    { id: 'b', x: 20, y: 30, category: 'c2' },
    { id: 'c', x: 40, y: 50, category: 'c3' },
  ]
  const spec = buildScatterSpec(rows)
  const adapter = createProviderFamilyAdapter('scatter', 'd3')
  const { runtime, restore } = createRuntimeWithSpecAndAdapters({
    spec,
    widgetAdapters: [adapter],
  })
  const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
  const widgetState = runtime.store.getWidgetState(widgetRef)
  const renderStates = []
  const wrapper = createD3ScatterChartWrapper({
    rows,
    render(payload) {
      renderStates.push(payload)
    },
  })
  const widget = createWidgetInstance({
    runtime,
    widgetRef,
    spec,
    widgetState,
    widgetAdapter: adapter,
  })

  try {
    await widget.mount({ view: wrapper })

    const brushResult = await widget.executeVerifiedAction({
      name: 'scatter.brushRegion',
      params: {
        xField: 'x',
        yField: 'y',
        xRange: [5, 25],
        yRange: [15, 35],
      },
    })
    await flushAsyncWork()

    assert.equal(brushResult?.actionResult?.ok, true)
    assert.equal(brushResult?.verification?.result?.verified, true)
    assert.deepEqual(wrapper.getState()?.selections?.localBrush?.domain, {
      xDomain: [5, 25],
      yDomain: [15, 35],
    })
    assert.deepEqual(
      renderStates.at(-1)?.points?.filter((point) => point.selected).map((point) => point.id),
      ['a', 'b'],
    )
    assert.equal(widget.readVerificationState()?.checks?.selectionApplied, true)

    const zoomResult = await widget.executeVerifiedAction({
      name: 'scatter.zoomDomain',
      params: {
        xDomain: [0, 25],
        yDomain: [0, 35],
      },
    })
    await flushAsyncWork()

    assert.equal(zoomResult?.actionResult?.ok, true)
    assert.equal(zoomResult?.verification?.result?.verified, true)
    assert.deepEqual(wrapper.getState()?.view, {
      xDomain: [0, 25],
      yDomain: [0, 35],
    })
    assert.deepEqual(
      renderStates.at(-1)?.points?.filter((point) => point.visible).map((point) => point.id),
      ['a', 'b'],
    )
    assert.equal(widget.readVerificationState()?.checks?.zoomApplied, true)
  } finally {
    widget.dispose()
    restore()
  }
})

test('WidgetInstance drives the ECharts scatter reference wrapper through structured brush and zoom actions', async () => {
  const rows = [
    { id: 'a', x: 10, y: 20, category: 'c1' },
    { id: 'b', x: 20, y: 30, category: 'c2' },
    { id: 'c', x: 40, y: 50, category: 'c3' },
  ]
  const spec = buildScatterSpec(rows)
  const adapter = createProviderFamilyAdapter('scatter', 'echarts')
  const { runtime, restore } = createRuntimeWithSpecAndAdapters({
    spec,
    widgetAdapters: [adapter],
  })
  const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
  const widgetState = runtime.store.getWidgetState(widgetRef)
  const setOptionCalls = []
  const dispatchActionCalls = []
  let currentOption = {}
  const chart = {
    setOption(option) {
      currentOption = {
        ...currentOption,
        ...option,
      }
      setOptionCalls.push(option)
    },
    getOption() {
      return currentOption
    },
    dispatchAction(action) {
      dispatchActionCalls.push(action)
    },
  }
  const wrapper = createEChartsScatterChartWrapper({ chart, rows })
  const view = {
    ...wrapper,
    setOption: chart.setOption.bind(chart),
    getOption: chart.getOption.bind(chart),
    dispatchAction: chart.dispatchAction.bind(chart),
  }
  const widget = createWidgetInstance({
    runtime,
    widgetRef,
    spec,
    widgetState,
    widgetAdapter: adapter,
  })

  try {
    await widget.mount({ view })

    const brushResult = await widget.executeVerifiedAction({
      name: 'scatter.brushRegion',
      params: {
        xField: 'x',
        yField: 'y',
        xRange: [5, 25],
        yRange: [15, 35],
      },
    })
    await flushAsyncWork()

    assert.equal(brushResult?.actionResult?.ok, true)
    assert.equal(brushResult?.verification?.result?.verified, true)
    assert.deepEqual(wrapper.getState()?.selections?.localBrush?.domain, {
      xDomain: [5, 25],
      yDomain: [15, 35],
    })
    assert.equal(dispatchActionCalls.some((action) => action?.type === 'brush'), true)
    assert.equal(widget.readVerificationState()?.checks?.selectionApplied, true)

    const zoomResult = await widget.executeVerifiedAction({
      name: 'scatter.zoomDomain',
      params: {
        xDomain: [0, 25],
        yDomain: [0, 35],
      },
    })
    await flushAsyncWork()

    assert.equal(zoomResult?.actionResult?.ok, true)
    assert.equal(zoomResult?.verification?.result?.verified, true)
    assert.deepEqual(wrapper.getState()?.view, {
      xDomain: [0, 25],
      yDomain: [0, 35],
    })
    assert.equal(Array.isArray(currentOption?.series?.[0]?.data), true)
    assert.equal(setOptionCalls.length > 0, true)
    assert.equal(currentOption?.xAxis?.min, 0)
    assert.equal(currentOption?.xAxis?.max, 25)
    assert.equal(currentOption?.yAxis?.min, 0)
    assert.equal(currentOption?.yAxis?.max, 35)
    assert.equal(widget.readVerificationState()?.checks?.zoomApplied, true)
  } finally {
    widget.dispose()
    restore()
  }
})

test('WidgetInstance drives the D3 line reference wrapper through structured focus and zoom actions', async () => {
  const rows = [
    { date: '2024-01-01', series: 'A', revenue: 10 },
    { date: '2024-01-02', series: 'A', revenue: 20 },
    { date: '2024-01-03', series: 'A', revenue: 25 },
    { date: '2024-01-01', series: 'B', revenue: 15 },
    { date: '2024-01-02', series: 'B', revenue: 18 },
    { date: '2024-01-03', series: 'B', revenue: 16 },
  ]
  const spec = buildLineSpec(rows)
  const adapter = createProviderFamilyAdapter('line', 'd3')
  const { runtime, restore } = createRuntimeWithSpecAndAdapters({
    spec,
    widgetAdapters: [adapter],
  })
  const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
  const widgetState = runtime.store.getWidgetState(widgetRef)
  const renderStates = []
  const wrapper = createD3LineChartWrapper({
    rows,
    render(payload) {
      renderStates.push(payload)
    },
  })
  const widget = createWidgetInstance({
    runtime,
    widgetRef,
    spec,
    widgetState,
    widgetAdapter: adapter,
  })

  try {
    await widget.mount({ view: wrapper })

    const focusResult = await widget.executeVerifiedAction({
      name: 'line.focusLines',
      params: {
        lines: ['A'],
        lineField: 'series',
      },
    })
    await flushAsyncWork()

    assert.equal(focusResult?.actionResult?.ok, true)
    assert.equal(focusResult?.verification?.result?.verified, true)
    assert.deepEqual(wrapper.getState()?.view?.focusedSeries, ['A'])
    assert.deepEqual(
      renderStates.at(-1)?.series?.map((entry) => ({
        key: entry.key,
        dimmed: entry.dimmed,
      })),
      [
        { key: 'A', dimmed: false },
        { key: 'B', dimmed: true },
      ],
    )
    assert.equal(widget.readVerificationState()?.checks?.focusApplied, true)

    const zoomResult = await widget.executeVerifiedAction({
      name: 'line.zoomXRegion',
      params: {
        start: '2024-01-02',
        end: '2024-01-03',
      },
    })
    await flushAsyncWork()

    assert.equal(zoomResult?.actionResult?.ok, true)
    assert.equal(zoomResult?.verification?.result?.verified, true)
    assert.deepEqual(wrapper.getState()?.view?.xDomain, ['2024-01-02', '2024-01-03'])
    assert.deepEqual(
      renderStates.at(-1)?.series?.map((entry) => ({
        key: entry.key,
        dates: entry.values.map((point) => String(point.date).slice(0, 10)),
      })),
      [
        { key: 'A', dates: ['2024-01-02', '2024-01-03'] },
        { key: 'B', dates: ['2024-01-02', '2024-01-03'] },
      ],
    )
    assert.equal(widget.readVerificationState()?.checks?.zoomApplied, true)
  } finally {
    widget.dispose()
    restore()
  }
})

test('WidgetInstance drives the ECharts line reference wrapper through structured focus and zoom actions', async () => {
  const rows = [
    { date: '2024-01-01', series: 'A', revenue: 10 },
    { date: '2024-01-02', series: 'A', revenue: 20 },
    { date: '2024-01-03', series: 'A', revenue: 25 },
    { date: '2024-01-01', series: 'B', revenue: 15 },
    { date: '2024-01-02', series: 'B', revenue: 18 },
    { date: '2024-01-03', series: 'B', revenue: 16 },
  ]
  const spec = buildLineSpec(rows)
  const adapter = createProviderFamilyAdapter('line', 'echarts')
  const { runtime, restore } = createRuntimeWithSpecAndAdapters({
    spec,
    widgetAdapters: [adapter],
  })
  const widgetRef = runtime.store.listWidgetDescriptions()[0]?.ref
  const widgetState = runtime.store.getWidgetState(widgetRef)
  const setOptionCalls = []
  const dispatchActionCalls = []
  let currentOption = {}
  const chart = {
    setOption(option) {
      currentOption = {
        ...currentOption,
        ...option,
      }
      setOptionCalls.push(option)
    },
    getOption() {
      return currentOption
    },
    dispatchAction(action) {
      dispatchActionCalls.push(action)
    },
  }
  const wrapper = createEChartsLineChartWrapper({ chart, rows })
  const view = {
    ...wrapper,
    setOption: chart.setOption.bind(chart),
    getOption: chart.getOption.bind(chart),
    dispatchAction: chart.dispatchAction.bind(chart),
  }
  const widget = createWidgetInstance({
    runtime,
    widgetRef,
    spec,
    widgetState,
    widgetAdapter: adapter,
  })

  try {
    await widget.mount({ view })

    const focusResult = await widget.executeVerifiedAction({
      name: 'line.focusLines',
      params: {
        lines: ['A'],
        lineField: 'series',
      },
    })
    await flushAsyncWork()

    assert.equal(focusResult?.actionResult?.ok, true)
    assert.equal(focusResult?.verification?.result?.verified, true)
    assert.deepEqual(wrapper.getState()?.view?.focusedSeries, ['A'])
    assert.equal(dispatchActionCalls.some((action) => action?.type === 'highlight' && action?.seriesName === 'A'), true)
    assert.equal(widget.readVerificationState()?.checks?.focusApplied, true)

    const zoomResult = await widget.executeVerifiedAction({
      name: 'line.zoomXRegion',
      params: {
        start: '2024-01-02',
        end: '2024-01-03',
      },
    })
    await flushAsyncWork()

    assert.equal(zoomResult?.actionResult?.ok, true)
    assert.equal(zoomResult?.verification?.result?.verified, true)
    assert.deepEqual(wrapper.getState()?.view?.xDomain, ['2024-01-02', '2024-01-03'])
    assert.equal(Array.isArray(currentOption?.dataZoom), true)
    assert.equal(currentOption?.dataZoom?.[0]?.xAxisIndex, 0)
    assert.equal(currentOption?.dataZoom?.[0]?.startValue, '2024-01-02')
    assert.equal(currentOption?.dataZoom?.[0]?.endValue, '2024-01-03')
    assert.equal(setOptionCalls.length > 0, true)
    assert.equal(widget.readVerificationState()?.checks?.zoomApplied, true)
  } finally {
    widget.dispose()
    restore()
  }
})

test('createWidgetInstance normalizes mountTarget and container into persisted mount options', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const runtime = createWidgetVARuntime({
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'mount-options-session',
      readBaselineSpec: () => buildScatterSpec(),
      readCurrentSpec: () => buildScatterSpec(),
      readWorkspaceSpec: () => null,
      readPlanningRequest: () => null,
      readRunMode: () => 'goal_oriented',
      readUserIntent: () => '',
      readCurrentSelection: () => null,
      readCurrentSelections: () => ({}),
      readFocusedWidgetRef: () => null,
      readComparisonTargets: () => [],
      readWorkspaceAnnotations: () => [],
    },
  })

  const widget = createWidgetInstance({
    runtime,
    widgetAdapter: {
      provider: 'test',
      async applyState() {},
      bindHumanInteractions() {
        return () => {}
      },
    },
    mountTarget: {
      container: { nodeName: 'DIV' },
    },
  })

  try {
    assert.equal(widget.mountOptions.container?.nodeName, 'DIV')
    assert.equal(widget.mountOptions.surface?.nodeName, 'DIV')
  } finally {
    widget.dispose()
    runtime.dispose()
    globalThis.window = previousWindow
  }
})

test('createWidgetInstance-created runtimes register the provided widget adapter without auto-installing the full first-party family set', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}

  const customActionCalls = []
  const widget = createWidgetInstance({
    spec: buildScatterSpec(),
    widgetAdapter: {
      provider: 'test',
      async applyState() {},
      bindHumanInteractions() {
        return () => {}
      },
      registerActions(actionExecutor) {
        actionExecutor.register(
          { name: 'widget.customInspect' },
          async (call) => {
            customActionCalls.push(call?.params || null)
            return {
              result: {
                echoed: call?.params || null,
              },
            }
          },
        )
      },
    },
  })

  try {
    assert.equal(widget.runtime.actionExecutor.has('widget.customInspect'), true)
    assert.equal(widget.runtime.actionExecutor.has('scatter.brushRegion'), false)

    const result = await widget.executeAction({
      name: 'widget.customInspect',
      params: { foo: 'bar' },
    })

    assert.equal(result?.ok, true)
    assert.deepEqual(result?.result, { echoed: { foo: 'bar' } })
    assert.deepEqual(customActionCalls, [{ foo: 'bar' }])
  } finally {
    widget.dispose()
    globalThis.window = previousWindow
  }
})

test('createWidgetVARuntime only registers first-party widget families when explicitly requested', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const spec = buildScatterSpec()

  const runtimeWithoutDefaults = createWidgetVARuntime({
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'runtime-without-defaults',
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
      readWorkspaceAnnotations: () => [],
    },
  })

  const runtimeWithDefaults = createWidgetVARuntime({
    registerDefaultWidgetFamilies: true,
    hostBridge: {
      subscribe: () => () => {},
      readSessionId: () => 'runtime-with-defaults',
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
      readWorkspaceAnnotations: () => [],
    },
  })

  try {
    assert.equal(runtimeWithoutDefaults.actionExecutor.has('scatter.brushRegion'), false)
    assert.equal(runtimeWithDefaults.actionExecutor.has('scatter.brushRegion'), true)
  } finally {
    runtimeWithoutDefaults.dispose()
    runtimeWithDefaults.dispose()
    globalThis.window = previousWindow
  }
})
