import test from 'node:test'
import assert from 'node:assert/strict'

import { PerceptionQueryRegistry } from './PerceptionQueryRegistry.js'
import { describePerceptionRegistrySummarySchema } from '../protocol/perceptionRegistry.js'
import { describeQueryScopeSchema } from '../protocol/queryScope.js'
import { registerScatterPerceptionQueries } from '../../widgets/scatter/index.js'
import { registerSankeyPerceptionQueries } from '../../widgets/sankey/index.js'
import { registerLinePerceptionQueries } from '../../widgets/line/index.js'

test('PerceptionQueryRegistry.describeRegistry exposes verification and evidence metadata across handler variants', () => {
  const registry = new PerceptionQueryRegistry({
    store: {
      listPerceptionQueries() {
        return []
      },
      getPerceptionDescriptor() {
        return null
      },
    },
    dataQueryEngine: null,
    dataQueryExecutor: null,
    traceRecorder: null,
    runtimeEvaluation: null,
    linkEngine: null,
  })

  registry.register(
    {
      name: 'perception.testVariant',
      category: 'verify',
      sideEffectFree: true,
      evidenceKinds: ['verificationEvidence', 'stateDelta'],
      verificationTargets: ['statePatch', 'workspaceState'],
    },
    async () => ({ ok: true, result: null }),
    { supportedWidgetKinds: ['scatter'] },
  )
  registry.register(
    {
      name: 'perception.testVariant',
      category: 'verify',
      sideEffectFree: true,
      evidenceKinds: ['verificationEvidence', 'stateDelta'],
      verificationTargets: ['statePatch', 'workspaceState'],
    },
    async () => ({ ok: true, result: null }),
    { supportedWidgetKinds: ['bar', 'scatter'] },
  )

  const summary = registry.describeRegistry()
  const query = summary.queries.find((entry) => entry.name === 'perception.testVariant')

  assert.deepEqual(query?.supportedWidgetKinds, ['scatter', 'bar'])
  assert.equal(query?.handlerVariantCount, 2)
  assert.equal(query?.sideEffectFree, true)
  assert.deepEqual(query?.evidenceKinds, ['verificationEvidence', 'stateDelta'])
  assert.deepEqual(query?.verificationTargets, ['statePatch', 'workspaceState'])
  assert.equal(describePerceptionRegistrySummarySchema().properties?.queries?.items?.properties?.handlerVariantCount?.type, 'integer')
})

test('PerceptionQueryRegistry supports no-arg construction and run alias for manual runtime assembly', async () => {
  const registry = new PerceptionQueryRegistry()

  registry.register(
    {
      name: 'perception.testRunAlias',
      category: 'inspect',
      sideEffectFree: true,
    },
    async () => ({ result: { ok: true } }),
  )

  const result = await registry.run({
    callId: 'pq_run_alias',
    name: 'perception.testRunAlias',
    params: {},
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.result, { ok: true })
})

test('PerceptionQueryRegistry supports documented params-first query handlers for manual runtime assembly', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  let receivedParams = null
  let receivedTargetWidgetRef = null
  const registry = new PerceptionQueryRegistry({
    store: {
      listPerceptionQueries() {
        return []
      },
      getPerceptionDescriptor() {
        return null
      },
      listWidgetDescriptions() {
        return [{
          ref: widgetRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          title: 'Scatter A',
        }]
      },
      getResolvedWidgetForTarget(ref) {
        return ref === widgetRef
          ? {
              ref,
              widgetId: 'scatter_a',
              kind: 'scatter',
              title: 'Scatter A',
            }
          : null
      },
      getResolvedWidget(ref) {
        return this.getResolvedWidgetForTarget(ref)
      },
      getWidgetDescription(ref) {
        return this.getResolvedWidgetForTarget(ref)
      },
      readState() {
        return {
          stateId: 'main:s1',
          widgets: {
            [widgetRef]: {
              ref: widgetRef,
              widgetId: 'scatter_a',
              kind: 'scatter',
            },
          },
          shared: {
            activeSelections: {},
            globalFilters: {},
            focusedWidget: widgetRef,
          },
        }
      },
    },
  })

  registry.register(
    {
      name: 'perception.testParamsFirst',
      category: 'summarize',
      sideEffectFree: true,
      paramsSchema: {
        type: 'object',
        properties: {
          queryScope: describeQueryScopeSchema(),
          groupBy: { type: 'array', items: { type: 'string' } },
        },
        required: ['queryScope'],
      },
    },
    async (params, ctx) => {
      receivedParams = params
      receivedTargetWidgetRef = ctx.requireTargetWidget({ kind: 'scatter' })?.ref || null
      return {
        result: {
          selectionRef: params.queryScope?.selectionRef || null,
          groupBy: params.groupBy || [],
        },
      }
    },
  )

  const result = await registry.query({
    callId: 'pq_params_first',
    name: 'perception.testParamsFirst',
    params: {
      groupBy: ['Origin'],
      queryScope: {
        widgetRef,
        selectionRef: `${widgetRef}/selection/current`,
      },
    },
  })

  assert.equal(result.ok, true)
  assert.equal(receivedTargetWidgetRef, widgetRef)
  assert.deepEqual(receivedParams?.groupBy, ['Origin'])
  assert.deepEqual(receivedParams?.queryScope, {
    widgetRef,
    dataRef: null,
    selectionRef: `${widgetRef}/selection/current`,
    focusRef: null,
    viewportRef: null,
  })
  assert.deepEqual(receivedParams?.params, {
    groupBy: ['Origin'],
    queryScope: {
      widgetRef,
      dataRef: null,
      selectionRef: `${widgetRef}/selection/current`,
      focusRef: null,
      viewportRef: null,
    },
  })
  assert.equal(receivedParams?.name, 'perception.testParamsFirst')
  assert.equal(receivedParams?.targetRef, undefined)
})

test('PerceptionQueryRegistry derives a minimal DataQueryExecutor from dataQueryEngine for widget compute queries', async () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_a'
  const dataRef = 'wl://widgetva-app/workspace/main/data/current_view'
  const registry = new PerceptionQueryRegistry({
    store: {
      listPerceptionQueries() {
        return []
      },
      getPerceptionDescriptor() {
        return null
      },
      readDescription() {
        return {
          widgets: [{ ref: widgetRef, kind: 'scatter', title: 'Scatter A', primaryDataRef: dataRef }],
          dataHandles: [{ ref: dataRef, supportedQueries: ['computeCorrelation'] }],
        }
      },
      readState() {
        return {
          shared: {
            focusedWidget: widgetRef,
          },
        }
      },
      getResolvedWidgetForTarget(ref) {
        if (ref !== widgetRef) return null
        return {
          ref: widgetRef,
          kind: 'scatter',
          title: 'Scatter A',
          primaryDataRef: dataRef,
          data: {
            currentDataRef: dataRef,
            sourceDataRef: dataRef,
          },
        }
      },
      getResolvedWidget(ref) {
        return this.getResolvedWidgetForTarget(ref)
      },
      getWidgetDescription(ref) {
        return this.getResolvedWidgetForTarget(ref)
      },
      listWidgetDescriptions() {
        return [this.getResolvedWidgetForTarget(widgetRef)]
      },
      getDataHandle(ref) {
        if (ref !== dataRef) return null
        return {
          ref: dataRef,
          supportedQueries: ['computeCorrelation'],
        }
      },
      readRuntimeData(ref) {
        if (ref !== dataRef) return null
        return {
          ref: dataRef,
          widgetRef,
          rows: [
            { Horsepower: 100, Miles_per_Gallon: 30 },
            { Horsepower: 120, Miles_per_Gallon: 26 },
            { Horsepower: 140, Miles_per_Gallon: 22 },
          ],
        }
      },
      resolveSelectionDataRef() {
        return null
      },
    },
    dataQueryEngine: {
      kind: 'manual',
      computeCorrelation(rows, { xField, yField }) {
        return {
          ok: true,
          coefficient: -1,
          sampleSize: rows.length,
          fields: [xField, yField],
        }
      },
    },
    traceRecorder: null,
    runtimeEvaluation: null,
    linkEngine: null,
  })

  registerScatterPerceptionQueries(registry)

  const result = await registry.run({
    callId: 'pq_manual_compute',
    name: 'perception.computeCorrelation',
    targetRef: widgetRef,
    params: {
      xField: 'Horsepower',
      yField: 'Miles_per_Gallon',
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.result?.dataRef, dataRef)
  assert.equal(result.result?.correlation, -1)
  assert.equal(result.result?.sampleSize, 3)
})

test('PerceptionQueryRegistry can run line-specific perception.detectAnomalies over visible line rows', async () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/line_anomalies'
  const dataRef = 'wl://widgetva-app/workspace/main/data/line_visible'
  const registry = new PerceptionQueryRegistry({
    store: {
      listPerceptionQueries() {
        return []
      },
      getPerceptionDescriptor() {
        return null
      },
      readState() {
        return {
          shared: {
            focusedWidget: widgetRef,
          },
        }
      },
      getResolvedWidgetForTarget(ref) {
        if (ref !== widgetRef) return null
        return {
          ref: widgetRef,
          kind: 'line',
          title: 'Line Anomalies',
          primaryDataRef: dataRef,
          data: {
            currentDataRef: dataRef,
            sourceDataRef: dataRef,
          },
          rawSpec: {
            encoding: {
              x: { field: 'date', type: 'temporal' },
              y: { field: 'value', type: 'quantitative' },
            },
          },
        }
      },
      getResolvedWidget(ref) {
        return this.getResolvedWidgetForTarget(ref)
      },
      getWidgetDescription(ref) {
        return this.getResolvedWidgetForTarget(ref)
      },
      listWidgetDescriptions() {
        return [this.getResolvedWidgetForTarget(widgetRef)]
      },
      getDataHandle(ref) {
        if (ref !== dataRef) return null
        return { ref: dataRef }
      },
      readRuntimeData(ref) {
        if (ref !== dataRef) return null
        return {
          ref: dataRef,
          widgetRef,
          rows: [
            { date: '2024-01-01', value: 10 },
            { date: '2024-01-02', value: 11 },
            { date: '2024-01-03', value: 9 },
            { date: '2024-01-04', value: 50 },
            { date: '2024-01-05', value: 10 },
          ],
        }
      },
      resolveSelectionDataRef() {
        return null
      },
    },
    traceRecorder: null,
    runtimeEvaluation: null,
    linkEngine: null,
  })

  registerLinePerceptionQueries(registry)

  const result = await registry.query({
    callId: 'pq_line_anomalies',
    name: 'perception.detectAnomalies',
    targetRef: widgetRef,
    params: {
      threshold: 1.5,
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.queryName, 'perception.detectAnomalies')
  assert.equal(result.result?.operation, 'detect_anomalies')
  assert.equal(result.result?.anomaly_count, 1)
  assert.deepEqual(result.result?.anomalies, [
    { date: '2024-01-04', value: 50 },
  ])
  assert.deepEqual(result.result?.stats, {
    mean: 18,
    std: 16.01,
    threshold: 1.5,
    sample_size: 5,
    yField: 'value',
    xField: 'date',
  })
})

test('PerceptionQueryRegistry can run sankey-specific perception.getNodeOptions and return structured node metadata', async () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/sankey_a'
  const registry = new PerceptionQueryRegistry({
    store: {
      listPerceptionQueries() {
        return []
      },
      getPerceptionDescriptor() {
        return null
      },
      readState() {
        return {
          shared: {
            focusedWidget: widgetRef,
          },
        }
      },
      getResolvedWidgetForTarget(ref) {
        if (ref !== widgetRef) return null
        return {
          ref,
          widgetId: 'sankey_a',
          kind: 'sankey',
          title: 'Sankey A',
          rawSpec: {
            data: [
              {
                name: 'rawLinks',
                values: [
                  { source: 'A', target: 'X', value: 5 },
                  { source: 'B', target: 'X', value: 7 },
                  { source: 'X', target: 'Sink', value: 12 },
                ],
              },
              {
                name: 'nodeConfig',
                values: [
                  { name: 'A', depth: 0, order: 0 },
                  { name: 'B', depth: 0, order: 1 },
                  { name: 'X', depth: 1, order: 0 },
                  { name: 'Sink', depth: 2, order: 0 },
                ],
              },
              {
                name: 'depthLabelsData',
                values: [
                  { depth: 0, label: 'Source' },
                  { depth: 1, label: 'Stage' },
                  { depth: 2, label: 'Outcome' },
                ],
              },
            ],
            _sankey_state: {
              collapsed_groups: {
                'Others (Layer 0)': ['C', 'D'],
              },
            },
          },
        }
      },
      getResolvedWidget(ref) {
        return this.getResolvedWidgetForTarget(ref)
      },
      getWidgetDescription(ref) {
        return this.getResolvedWidgetForTarget(ref)
      },
      listWidgetDescriptions() {
        return [this.getResolvedWidgetForTarget(widgetRef)]
      },
    },
    traceRecorder: null,
    runtimeEvaluation: null,
    linkEngine: null,
  })

  registerSankeyPerceptionQueries(registry)

  const result = await registry.query({
    callId: 'pq_sankey_node_options',
    name: 'perception.getNodeOptions',
    targetRef: widgetRef,
    params: {},
  })

  assert.equal(result.ok, true)
  assert.equal(result.queryName, 'perception.getNodeOptions')
  assert.equal(result.result?.operation, 'get_node_options')
  assert.deepEqual(result.result?.all_nodes, ['A', 'B', 'X', 'Sink'])
  assert.equal(result.result?.depth_count, 3)
  assert.deepEqual(result.result?.depth_labels, {
    '0': 'Source',
    '1': 'Stage',
    '2': 'Outcome',
  })
  assert.deepEqual(result.result?.nodes_by_depth?.['0']?.nodes, [
    { name: 'A', order: 0, total: 5 },
    { name: 'B', order: 1, total: 7 },
  ])
  assert.deepEqual(result.result?.adjacency?.A, {
    upstream: [],
    downstream: ['X'],
  })
  assert.deepEqual(result.result?.adjacency?.X, {
    upstream: ['A', 'B'],
    downstream: ['Sink'],
  })
  assert.deepEqual(result.result?.collapsed_groups, {
    'Others (Layer 0)': ['C', 'D'],
  })
  assert.deepEqual(result.result?.value_range, {
    min: 5,
    max: 12,
  })
})

test('PerceptionQueryRegistry can run sankey-specific perception.calculateConversionRate for global and node-scoped analyses', async () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/sankey_conversion'
  const rawSpec = {
    data: [
      {
        name: 'rawLinks',
        values: [
          { source: 'A', target: 'X', value: 10 },
          { source: 'B', target: 'X', value: 5 },
          { source: 'X', target: 'Sink1', value: 9 },
          { source: 'X', target: 'Sink2', value: 4 },
        ],
      },
      {
        name: 'nodeConfig',
        values: [
          { name: 'A', depth: 0, order: 0 },
          { name: 'B', depth: 0, order: 1 },
          { name: 'X', depth: 1, order: 0 },
          { name: 'Sink1', depth: 2, order: 0 },
          { name: 'Sink2', depth: 2, order: 1 },
        ],
      },
    ],
  }

  const registry = new PerceptionQueryRegistry({
    store: {
      listPerceptionQueries() {
        return []
      },
      getPerceptionDescriptor() {
        return null
      },
      readState() {
        return {
          shared: {
            focusedWidget: widgetRef,
          },
        }
      },
      getResolvedWidgetForTarget(ref) {
        if (ref !== widgetRef) return null
        return {
          ref,
          widgetId: 'sankey_conversion',
          kind: 'sankey',
          title: 'Sankey Conversion',
          rawSpec,
        }
      },
      getResolvedWidget(ref) {
        return this.getResolvedWidgetForTarget(ref)
      },
      getWidgetDescription(ref) {
        return this.getResolvedWidgetForTarget(ref)
      },
      listWidgetDescriptions() {
        return [this.getResolvedWidgetForTarget(widgetRef)]
      },
    },
    traceRecorder: null,
    runtimeEvaluation: null,
    linkEngine: null,
  })

  registerSankeyPerceptionQueries(registry)

  const globalResult = await registry.query({
    callId: 'pq_sankey_conversion_global',
    name: 'perception.calculateConversionRate',
    targetRef: widgetRef,
    params: {},
  })

  assert.equal(globalResult.ok, true)
  assert.equal(globalResult.result?.operation, 'calculate_conversion_rate')
  assert.deepEqual(globalResult.result?.summary, {
    total_nodes: 5,
    source_nodes: 2,
    sink_nodes: 2,
    intermediate_nodes: 1,
  })
  assert.deepEqual(globalResult.result?.high_loss_nodes, [
    {
      node: 'X',
      inflow: 15,
      outflow: 13,
      rate: 0.8667,
      type: 'intermediate',
      loss: 2,
      loss_rate: 0.1333,
    },
  ])

  const nodeResult = await registry.query({
    callId: 'pq_sankey_conversion_node',
    name: 'perception.calculateConversionRate',
    targetRef: widgetRef,
    params: {
      nodeName: 'X',
    },
  })

  assert.equal(nodeResult.ok, true)
  assert.equal(nodeResult.result?.node, 'X')
  assert.deepEqual(nodeResult.result?.conversion, {
    node: 'X',
    inflow: 15,
    outflow: 13,
    rate: 0.8667,
    type: 'intermediate',
    loss: 2,
    loss_rate: 0.1333,
  })
  assert.deepEqual(nodeResult.result?.upstream, [
    { from: 'A', value: 10 },
    { from: 'B', value: 5 },
  ])
  assert.deepEqual(nodeResult.result?.downstream, [
    { to: 'Sink1', value: 9 },
    { to: 'Sink2', value: 4 },
  ])
})

test('PerceptionQueryRegistry can run sankey-specific perception.findBottleneck and rank high-loss intermediate nodes', async () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/sankey_bottlenecks'
  const rawSpec = {
    data: [
      {
        name: 'rawLinks',
        values: [
          { source: 'A', target: 'X', value: 12 },
          { source: 'B', target: 'X', value: 8 },
          { source: 'X', target: 'Y', value: 10 },
          { source: 'X', target: 'Drop', value: 2 },
          { source: 'Y', target: 'Sink', value: 6 },
        ],
      },
      {
        name: 'nodeConfig',
        values: [
          { name: 'A', depth: 0, order: 0 },
          { name: 'B', depth: 0, order: 1 },
          { name: 'X', depth: 1, order: 0 },
          { name: 'Y', depth: 2, order: 0 },
          { name: 'Drop', depth: 2, order: 1 },
          { name: 'Sink', depth: 3, order: 0 },
        ],
      },
    ],
  }

  const registry = new PerceptionQueryRegistry({
    store: {
      listPerceptionQueries() {
        return []
      },
      getPerceptionDescriptor() {
        return null
      },
      readState() {
        return {
          shared: {
            focusedWidget: widgetRef,
          },
        }
      },
      getResolvedWidgetForTarget(ref) {
        if (ref !== widgetRef) return null
        return {
          ref,
          widgetId: 'sankey_bottlenecks',
          kind: 'sankey',
          title: 'Sankey Bottlenecks',
          rawSpec,
        }
      },
      getResolvedWidget(ref) {
        return this.getResolvedWidgetForTarget(ref)
      },
      getWidgetDescription(ref) {
        return this.getResolvedWidgetForTarget(ref)
      },
      listWidgetDescriptions() {
        return [this.getResolvedWidgetForTarget(widgetRef)]
      },
    },
    traceRecorder: null,
    runtimeEvaluation: null,
    linkEngine: null,
  })

  registerSankeyPerceptionQueries(registry)

  const result = await registry.query({
    callId: 'pq_sankey_bottlenecks',
    name: 'perception.findBottleneck',
    targetRef: widgetRef,
    params: {
      topN: 2,
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.result?.operation, 'find_bottleneck')
  assert.equal(result.result?.total_bottleneck_nodes, 2)
  assert.deepEqual(result.result?.bottlenecks, [
    {
      node: 'X',
      inflow: 20,
      outflow: 12,
      loss: 8,
      loss_rate: 0.4,
    },
    {
      node: 'Y',
      inflow: 10,
      outflow: 6,
      loss: 4,
      loss_rate: 0.4,
    },
  ])
})

test('PerceptionQueryRegistry records structured trace notes for inspectViewConfig', async () => {
  let recorded = null
  const registry = new PerceptionQueryRegistry({
    store: {
      listPerceptionQueries() {
        return []
      },
      getPerceptionDescriptor() {
        return null
      },
      readState() {
        return {
          shared: {
            focusedWidget: 'wl://widgetva-app/workspace/main/widget/scatter_a',
          },
        }
      },
      getResolvedWidgetForTarget(ref) {
        if (ref !== 'wl://widgetva-app/workspace/main/widget/scatter_a') return null
        return {
          ref,
          kind: 'scatter',
          encodings: {},
          transforms: [],
          view: {},
          selections: {},
        }
      },
      getResolvedWidget(ref) {
        return this.getResolvedWidgetForTarget(ref)
      },
      getWidgetDescription(ref) {
        return this.getResolvedWidgetForTarget(ref)
      },
      listWidgetDescriptions() {
        return [this.getResolvedWidgetForTarget('wl://widgetva-app/workspace/main/widget/scatter_a')]
      },
    },
    dataQueryEngine: {
      filter(rows) {
        return rows
      },
      summarize(rows) {
        return { rows }
      },
    },
    dataQueryExecutor: {
      run() {
        return { ok: true, result: [] }
      },
    },
    traceRecorder: {
      recordQuery(payload) {
        recorded = payload
      },
    },
    runtimeEvaluation: null,
    linkEngine: null,
  })

  const result = await registry.query({
    callId: 'pq_1',
    actor: 'agent',
    name: 'perception.inspectViewConfig',
    targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    params: {},
  })

  assert.equal(result.ok, true)
  assert.equal(recorded?.notes?.userVisibleSummary, 'Inspected the scatter view configuration.')
  assert.equal(recorded?.notes?.rationale, 'View configuration evidence was requested for the current target widget.')
})

test('PerceptionQueryRegistry records verification notes for verifyActionEffect', async () => {
  let recorded = null
  const registry = new PerceptionQueryRegistry({
    store: {
      replayContext: null,
      listPerceptionQueries() {
        return []
      },
      getPerceptionDescriptor() {
        return null
      },
      readState() {
        return {
          stateId: 'main:s2',
          shared: {
            activeSelections: {},
          },
        }
      },
      readTrace() {
        return [
          {
            stateId: 'main:s2',
            action: {
              name: 'widget.filterByValues',
              targetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
            },
            affectedRefs: ['wl://widgetva-app/workspace/main/widget/bar_a'],
          },
        ]
      },
      readSnapshotEntry(stateId) {
        if (stateId !== 'main:s2') return null
        return {
          state: {
            stateId: 'main:s2',
            shared: {
              activeSelections: {},
            },
          },
          replayContext: null,
        }
      },
      stateManager: {
        buildStatePatch() {
          return {}
        },
      },
      listActions() {
        return []
      },
      getActionDescriptor() {
        return null
      },
      getActionDescriptorsByName() {
        return []
      },
      getResolvedWidgetForTarget() {
        return null
      },
      getResolvedWidget() {
        return null
      },
      getWidgetDescription() {
        return null
      },
      listWidgetDescriptions() {
        return []
      },
    },
    dataQueryEngine: {
      filter(rows) {
        return rows
      },
      summarize(rows) {
        return { rows }
      },
    },
    dataQueryExecutor: {
      run() {
        return { ok: true, result: [] }
      },
    },
    traceRecorder: {
      recordQuery(payload) {
        recorded = payload
      },
    },
    runtimeEvaluation: {
      getFinalWorkspaceSnapshot() {
        return {
          stateId: 'main:s2',
          shared: {
            activeSelections: {},
          },
        }
      },
      evaluateLinkPropagation() {
        return {
          ok: true,
          sourceRef: 'selection',
          linkCount: 0,
          passedCount: 0,
          consistencyScore: 1,
          results: [],
        }
      },
    },
    linkEngine: null,
  })

  const result = await registry.query({
    callId: 'pq_verify',
    actor: 'agent',
    name: 'perception.verifyActionEffect',
    params: {
      stateId: 'main:s2',
      actionName: 'widget.filterByValues',
      refs: ['wl://widgetva-app/workspace/main/widget/bar_a'],
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.result.verified, true)
  assert.equal(recorded?.notes?.userVisibleSummary, 'Verified the effect of widget.filterByValues on the requested runtime refs.')
  assert.equal(recorded?.notes?.rationale, 'Post-action verification evidence was requested from the runtime trace and state patch.')
  assert.equal(
    recorded?.notes?.verification,
    'Trace evidence, state patch, and link propagation checks all matched the requested action effect.',
  )
})

test('PerceptionQueryRegistry records failed perception queries into the interaction trace', async () => {
  let recordedFailure = null
  const registry = new PerceptionQueryRegistry({
    store: {
      listPerceptionQueries() {
        return []
      },
      getPerceptionDescriptor() {
        return null
      },
      readState() {
        return {
          shared: {
            focusedWidget: null,
          },
        }
      },
      getResolvedWidgetForTarget() {
        return null
      },
      getResolvedWidget() {
        return null
      },
      getWidgetDescription() {
        return null
      },
      listWidgetDescriptions() {
        return []
      },
    },
    dataQueryEngine: {
      filter(rows) {
        return rows
      },
      summarize(rows) {
        return { rows }
      },
    },
    dataQueryExecutor: {
      run() {
        return { ok: true, result: [] }
      },
    },
    traceRecorder: {
      recordQueryFailure(payload) {
        recordedFailure = payload
      },
    },
    runtimeEvaluation: null,
    linkEngine: null,
  })

  const result = await registry.query({
    callId: 'pq_fail',
    actor: 'agent',
    name: 'perception.inspectVisibleRows',
    targetRef: 'wl://widgetva-app/workspace/main/widget/missing_scatter',
    params: {},
  })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'RUNTIME_ERROR')
  assert.equal(recordedFailure?.code, 'RUNTIME_ERROR')
  assert.equal(recordedFailure?.call?.name, 'perception.inspectVisibleRows')
})

test('PerceptionQueryRegistry validates returnsSchema before recording a successful query trace', async () => {
  let recordedSuccess = null
  let recordedFailure = null
  const registry = new PerceptionQueryRegistry({
    store: {
      listPerceptionQueries() {
        return []
      },
      getPerceptionDescriptor() {
        return null
      },
      readState() {
        return {
          stateId: 'main:s2',
          shared: {
            focusedWidget: null,
          },
        }
      },
      readCurrentSnapshotMeta() {
        return {
          stateId: 'main:s2',
          parentStateId: 'main:s1',
          branchId: 'main',
        }
      },
      getResolvedWidgetForTarget() {
        return null
      },
      getResolvedWidget() {
        return null
      },
      getWidgetDescription() {
        return null
      },
      listWidgetDescriptions() {
        return []
      },
    },
    dataQueryEngine: null,
    dataQueryExecutor: null,
    traceRecorder: {
      recordQuery(payload) {
        recordedSuccess = payload
      },
      recordQueryFailure(payload) {
        recordedFailure = payload
      },
    },
    runtimeEvaluation: null,
    linkEngine: null,
  })

  registry.register(
    {
      name: 'perception.invalidResult',
      title: 'Invalid result query',
      description: 'Returns a payload that violates its declared contract.',
      category: 'inspect',
      paramsSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
      returnsSchema: {
        type: 'object',
        required: ['summary'],
        properties: {
          summary: { type: 'string' },
        },
        additionalProperties: false,
      },
      sideEffectFree: true,
    },
    async (call, ctx) => {
      ctx.recordQuery({
        affectedRefs: [],
        notes: {
          userVisibleSummary: 'Returned a malformed perception payload.',
        },
      })
      return {
        result: {
          summary: 42,
        },
      }
    },
  )

  const result = await registry.query({
    callId: 'pq_invalid_result',
    actor: 'agent',
    name: 'perception.invalidResult',
    params: {},
  })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'RUNTIME_ERROR')
  assert.match(result.error.message, /params?\.summary|result\.summary/)
  assert.equal(recordedSuccess, null)
  assert.equal(recordedFailure?.code, 'RUNTIME_ERROR')
  assert.equal(recordedFailure?.call?.name, 'perception.invalidResult')
})
