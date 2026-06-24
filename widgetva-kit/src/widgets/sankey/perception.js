import { makePerceptionDescriptor } from '../../core/protocol/perception.js'
import { buildPerceptionDataResult, runDataPerceptionQuery } from '../../adapters/widgets/shared/dataPerception.js'
import {
  appendQueryScopeGuidance,
  buildQueryScopeExample,
  buildScopedPerceptionParamsSchema,
} from '../../adapters/widgets/shared/perceptionScope.js'

function buildNodeFlows(links) {
  const flows = new Map()
  const ensure = (name) => {
    if (!flows.has(name)) {
      flows.set(name, { inflow: 0, outflow: 0, total: 0 })
    }
    return flows.get(name)
  }

  for (const link of Array.isArray(links) ? links : []) {
    if (!link || typeof link !== 'object') continue
    const source = link.source
    const target = link.target
    const value = Number(link.value || 0)
    const sourceEntry = ensure(source)
    const targetEntry = ensure(target)
    sourceEntry.outflow += value
    targetEntry.inflow += value
  }

  for (const entry of flows.values()) {
    entry.total = Math.max(entry.inflow, entry.outflow)
  }

  return flows
}

function findNamedDataSource(spec, name) {
  const data = Array.isArray(spec?.data) ? spec.data : []
  const entry = data.find((item) => item && typeof item === 'object' && item.name === name) || null
  return Array.isArray(entry?.values) ? entry.values : null
}

function buildSankeyNodeOptions(rawSpec) {
  const nodeConfig = findNamedDataSource(rawSpec, 'nodeConfig')
  const rawLinks = findNamedDataSource(rawSpec, 'rawLinks')
  const depthLabelsData = findNamedDataSource(rawSpec, 'depthLabelsData') || []
  if (!nodeConfig || !rawLinks) {
    throw new Error('perception.getNodeOptions requires rawLinks and nodeConfig data sources.')
  }

  const nodeFlows = buildNodeFlows(rawLinks)
  const depthLabelMap = new Map()
  for (const entry of depthLabelsData) {
    if (!entry || typeof entry !== 'object') continue
    depthLabelMap.set(String(entry.depth), entry.label || `Layer ${entry.depth}`)
  }

  const nodesByDepth = {}
  const allNodes = []
  for (const node of [...nodeConfig].sort((left, right) => {
    const leftDepth = Number(left?.depth ?? 0)
    const rightDepth = Number(right?.depth ?? 0)
    if (leftDepth !== rightDepth) return leftDepth - rightDepth
    return Number(left?.order ?? 0) - Number(right?.order ?? 0)
  })) {
    const name = node?.name
    if (typeof name !== 'string' || name.length === 0) continue
    const depthKey = String(Number(node?.depth ?? 0))
    const flow = nodeFlows.get(name) || { total: 0 }
    allNodes.push(name)
    if (!nodesByDepth[depthKey]) {
      nodesByDepth[depthKey] = {
        label: depthLabelMap.get(depthKey) || `Layer ${depthKey}`,
        nodes: [],
      }
    }
    const entry = {
      name,
      order: Number(node?.order ?? 0),
      total: Math.round(Number(flow.total || 0) * 100) / 100,
    }
    if (node?._is_aggregate) entry.is_aggregate = true
    if (Array.isArray(node?._collapsed_nodes) && node._collapsed_nodes.length > 0) {
      entry.collapsed_nodes = [...node._collapsed_nodes]
    }
    nodesByDepth[depthKey].nodes.push(entry)
  }

  const adjacency = Object.fromEntries(
    allNodes.map((name) => [name, { upstream: [], downstream: [] }]),
  )
  const edges = []
  const values = []
  for (const link of rawLinks) {
    if (!link || typeof link !== 'object') continue
    const source = link.source
    const target = link.target
    const value = Number(link.value || 0)
    edges.push({ source, target, value })
    values.push(value)
    if (adjacency[source] && !adjacency[source].downstream.includes(target)) {
      adjacency[source].downstream.push(target)
    }
    if (adjacency[target] && !adjacency[target].upstream.includes(source)) {
      adjacency[target].upstream.push(source)
    }
  }

  return {
    all_nodes: allNodes,
    nodes_by_depth: nodesByDepth,
    depth_count: Object.keys(nodesByDepth).length,
    depth_labels: Object.fromEntries(depthLabelMap.entries()),
    edges,
    adjacency,
    collapsed_groups: rawSpec?._sankey_state?.collapsed_groups || {},
    value_range: values.length > 0
      ? {
          min: Math.round(Math.min(...values) * 100) / 100,
          max: Math.round(Math.max(...values) * 100) / 100,
        }
      : { min: 0, max: 0 },
  }
}

function buildSankeyConversionRate(rawSpec, nodeName = null) {
  const rawLinks = findNamedDataSource(rawSpec, 'rawLinks')
  if (!rawLinks) {
    throw new Error('perception.calculateConversionRate requires a rawLinks data source.')
  }

  const nodeFlows = buildNodeFlows(rawLinks)
  const nodeOptions = buildSankeyNodeOptions(rawSpec)
  const conversions = []

  for (const name of [...nodeFlows.keys()].sort()) {
    const info = nodeFlows.get(name) || { inflow: 0, outflow: 0 }
    const inflow = Number(info.inflow || 0)
    const outflow = Number(info.outflow || 0)

    let type = 'intermediate'
    let rate = inflow > 0 ? Math.round((outflow / inflow) * 10000) / 10000 : 0
    if (inflow === 0 && outflow > 0) {
      type = 'source'
      rate = 'source'
    } else if (outflow === 0 && inflow > 0) {
      type = 'sink'
      rate = 0
    }

    const conversion = {
      node: name,
      inflow: Math.round(inflow * 100) / 100,
      outflow: Math.round(outflow * 100) / 100,
      rate,
      type,
    }

    if (type === 'intermediate' && inflow > 0) {
      const loss = inflow - outflow
      conversion.loss = Math.round(loss * 100) / 100
      conversion.loss_rate = Math.round((loss / inflow) * 10000) / 10000
    }

    conversions.push(conversion)
  }

  if (typeof nodeName === 'string' && nodeName.length > 0) {
    const target = conversions.find((entry) => entry.node === nodeName)
    if (!target) {
      throw new Error(`perception.calculateConversionRate cannot find node "${nodeName}".`)
    }
    const upstream = rawLinks
      .filter((link) => link?.target === nodeName)
      .map((link) => ({ from: link.source, value: Number(link.value || 0) }))
    const downstream = rawLinks
      .filter((link) => link?.source === nodeName)
      .map((link) => ({ to: link.target, value: Number(link.value || 0) }))

    return {
      operation: 'calculate_conversion_rate',
      message: `Conversion analysis for ${nodeName}`,
      node: nodeName,
      conversion: target,
      upstream,
      downstream,
      ui_hints: nodeOptions,
    }
  }

  const sources = conversions.filter((entry) => entry.type === 'source')
  const sinks = conversions.filter((entry) => entry.type === 'sink')
  const intermediates = conversions.filter((entry) => entry.type === 'intermediate')
  const highLossNodes = [...intermediates]
    .filter((entry) => Number(entry.loss_rate || 0) > 0)
    .sort((left, right) => Number(right.loss_rate || 0) - Number(left.loss_rate || 0))
    .slice(0, 5)

  return {
    operation: 'calculate_conversion_rate',
    message: `Calculated conversion rates for ${conversions.length} nodes`,
    summary: {
      total_nodes: conversions.length,
      source_nodes: sources.length,
      sink_nodes: sinks.length,
      intermediate_nodes: intermediates.length,
    },
    conversions,
    high_loss_nodes: highLossNodes,
    ui_hints: nodeOptions,
  }
}

function buildSankeyBottlenecks(rawSpec, topN = 3) {
  const rawLinks = findNamedDataSource(rawSpec, 'rawLinks')
  if (!rawLinks) {
    throw new Error('perception.findBottleneck requires a rawLinks data source.')
  }

  const nodeFlows = buildNodeFlows(rawLinks)
  const nodeOptions = buildSankeyNodeOptions(rawSpec)
  const bottlenecks = []

  for (const [name, info] of nodeFlows.entries()) {
    const inflow = Number(info.inflow || 0)
    const outflow = Number(info.outflow || 0)
    if (!(inflow > 0 && outflow > 0 && inflow > outflow)) continue
    const loss = inflow - outflow
    bottlenecks.push({
      node: name,
      inflow: Math.round(inflow * 100) / 100,
      outflow: Math.round(outflow * 100) / 100,
      loss: Math.round(loss * 100) / 100,
      loss_rate: Math.round((loss / inflow) * 10000) / 10000,
    })
  }

  bottlenecks.sort((left, right) => {
    if (right.loss_rate !== left.loss_rate) return right.loss_rate - left.loss_rate
    if (right.loss !== left.loss) return right.loss - left.loss
    return String(left.node).localeCompare(String(right.node))
  })
  const limit = Number.isFinite(topN) && topN > 0 ? Math.floor(topN) : 3
  const top = bottlenecks.slice(0, limit)

  return {
    operation: 'find_bottleneck',
    message: top.length > 0
      ? `Found top ${top.length} bottleneck nodes with highest loss rates`
      : 'No bottlenecks found (no intermediate nodes with loss)',
    bottlenecks: top,
    total_bottleneck_nodes: bottlenecks.length,
    ui_hints: nodeOptions,
  }
}

export function buildSankeyPerceptionDescriptors({ dataRef }) {
  return [
    makePerceptionDescriptor({
      name: 'perception.getNodeOptions',
      title: 'Get Sankey node options',
      description: appendQueryScopeGuidance('Return structured Sankey node, layer, adjacency, and collapsed-group metadata for UI controls and agent-side exploration.'),
      category: 'inspect',
      targetRef: dataRef,
      paramsSchema: buildScopedPerceptionParamsSchema({
        includeEdges: { type: 'boolean' },
      }),
      sideEffectFree: true,
      evidenceKinds: ['topologyEvidence', 'uiMetadata'],
      examples: [
        {
          userGoal: 'Inspect all current Sankey node and layer options before choosing a path, collapse target, or filter threshold.',
          params: {},
        },
        buildQueryScopeExample({
          userGoal: 'Inspect Sankey node options for one focused flow view.',
          params: {},
          widgetRef: 'wl://demo/workspace/main/widget/sankey_a',
          dataRef: 'wl://demo/workspace/main/data/current_view',
        }),
      ],
    }),
    makePerceptionDescriptor({
      name: 'perception.calculateConversionRate',
      title: 'Calculate Sankey conversion rate',
      description: appendQueryScopeGuidance('Compute inflow, outflow, conversion rate, and loss information for all Sankey nodes or one target node.'),
      category: 'compute',
      targetRef: dataRef,
      paramsSchema: buildScopedPerceptionParamsSchema({
        nodeName: { type: 'string' },
      }),
      sideEffectFree: true,
      evidenceKinds: ['flowEvidence', 'conversionEvidence', 'topologyEvidence'],
      examples: [
        {
          userGoal: 'Inspect conversion and loss rates across the whole Sankey, or drill into one node.',
          params: {},
        },
        buildQueryScopeExample({
          userGoal: 'Inspect conversion rates inside one focused Sankey view.',
          params: {},
          widgetRef: 'wl://demo/workspace/main/widget/sankey_a',
          dataRef: 'wl://demo/workspace/main/data/current_view',
        }),
      ],
    }),
    makePerceptionDescriptor({
      name: 'perception.findBottleneck',
      title: 'Find Sankey bottlenecks',
      description: appendQueryScopeGuidance('Identify the intermediate Sankey nodes with the highest loss rates by comparing inflow and outflow.'),
      category: 'compute',
      targetRef: dataRef,
      paramsSchema: buildScopedPerceptionParamsSchema({
        topN: { type: 'number' },
      }),
      sideEffectFree: true,
      evidenceKinds: ['flowEvidence', 'conversionEvidence', 'rankEvidence'],
      examples: [
        {
          userGoal: 'Find the worst flow drop-off points in the current Sankey.',
          params: { topN: 3 },
        },
        buildQueryScopeExample({
          userGoal: 'Find bottlenecks inside one focused Sankey view.',
          params: { topN: 3 },
          widgetRef: 'wl://demo/workspace/main/widget/sankey_a',
          dataRef: 'wl://demo/workspace/main/data/current_view',
        }),
      ],
    }),
    makePerceptionDescriptor({
      name: 'perception.findExtremes',
      title: 'Find extremes',
      description: appendQueryScopeGuidance('Return the highest- or lowest-valued flows in the visible Sankey data.'),
      category: 'compute',
      targetRef: dataRef,
      paramsSchema: buildScopedPerceptionParamsSchema({
        field: { type: 'string' },
        direction: { type: 'string' },
        limit: { type: 'number' },
      }),
      sideEffectFree: true,
      evidenceKinds: ['flowEvidence', 'rankEvidence'],
      examples: [
        {
          userGoal: 'Find the largest or smallest visible flows.',
          params: { field: 'value', direction: 'max', limit: 5 },
        },
        buildQueryScopeExample({
          userGoal: 'Find extreme flows inside one focused Sankey selection.',
          params: { field: 'value', direction: 'max', limit: 5 },
          widgetRef: 'wl://demo/workspace/main/widget/sankey_a',
          dataRef: 'wl://demo/workspace/main/data/current_selection',
          selectionRef: 'wl://demo/workspace/main/widget/sankey_a/selection/current',
        }),
      ],
    }),
    makePerceptionDescriptor({
      name: 'perception.compareGroups',
      title: 'Compare flow groups',
      description: appendQueryScopeGuidance('Compare grouped flow magnitudes in the visible Sankey data.'),
      category: 'compute',
      targetRef: dataRef,
      paramsSchema: buildScopedPerceptionParamsSchema({
        groupField: { type: 'string' },
        valueField: { type: 'string' },
        groups: { type: 'array', items: { type: 'string' } },
      }),
      sideEffectFree: true,
      evidenceKinds: ['groupComparison', 'flowEvidence'],
      examples: [
        {
          userGoal: 'Compare grouped flow magnitudes across categories.',
          params: { groupField: 'source', valueField: 'value', groups: ['A', 'B'] },
        },
        buildQueryScopeExample({
          userGoal: 'Compare grouped flows inside one focused Sankey selection.',
          params: { groupField: 'source', valueField: 'value', groups: ['A', 'B'] },
          widgetRef: 'wl://demo/workspace/main/widget/sankey_a',
          dataRef: 'wl://demo/workspace/main/data/current_selection',
          selectionRef: 'wl://demo/workspace/main/widget/sankey_a/selection/current',
        }),
      ],
    }),
  ]
}

export function registerSankeyPerceptionQueries(perceptionRegistry) {
  if (!perceptionRegistry.has('perception.getNodeOptions', { supportedWidgetKinds: ['sankey'] })) {
    perceptionRegistry.register(
      { name: 'perception.getNodeOptions', supportedWidgetKinds: ['sankey'] },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget({ kind: 'sankey' })
        const rawSpec = targetWidget?.rawSpec || targetWidget?.spec || null
        const options = buildSankeyNodeOptions(rawSpec)
        ctx.recordQuery({ affectedRefs: [targetWidget.ref] })
        return {
          result: {
            operation: 'get_node_options',
            message: `Extracted ${options.all_nodes.length} nodes across ${options.depth_count} layers`,
            ...options,
          },
        }
      },
      { supportedWidgetKinds: ['sankey'] },
    )
  }

  if (!perceptionRegistry.has('perception.calculateConversionRate', { supportedWidgetKinds: ['sankey'] })) {
    perceptionRegistry.register(
      { name: 'perception.calculateConversionRate', supportedWidgetKinds: ['sankey'] },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget({ kind: 'sankey' })
        const rawSpec = targetWidget?.rawSpec || targetWidget?.spec || null
        const result = buildSankeyConversionRate(rawSpec, call?.params?.nodeName || null)
        ctx.recordQuery({ affectedRefs: [targetWidget.ref] })
        return { result }
      },
      { supportedWidgetKinds: ['sankey'] },
    )
  }

  if (!perceptionRegistry.has('perception.findBottleneck', { supportedWidgetKinds: ['sankey'] })) {
    perceptionRegistry.register(
      { name: 'perception.findBottleneck', supportedWidgetKinds: ['sankey'] },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget({ kind: 'sankey' })
        const rawSpec = targetWidget?.rawSpec || targetWidget?.spec || null
        const result = buildSankeyBottlenecks(rawSpec, call?.params?.topN)
        ctx.recordQuery({ affectedRefs: [targetWidget.ref] })
        return { result }
      },
      { supportedWidgetKinds: ['sankey'] },
    )
  }

  if (!perceptionRegistry.has('perception.findExtremes', { supportedWidgetKinds: ['sankey'] })) {
    perceptionRegistry.register(
      { name: 'perception.findExtremes', supportedWidgetKinds: ['sankey'] },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget({ kind: 'sankey' })
        const params = ctx.readCallParams()
        const extremes = runDataPerceptionQuery({
          ctx,
          dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
          targetWidget,
          kind: 'findExtremes',
          spec: params,
        })
        ctx.recordQuery({ affectedRefs: [targetWidget.ref] })
        return {
          result: buildPerceptionDataResult({
            dataQueryResult: extremes,
            fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, params).dataRef,
          }),
        }
      },
      { supportedWidgetKinds: ['sankey'] },
    )
  }

  if (!perceptionRegistry.has('perception.compareGroups', { supportedWidgetKinds: ['sankey'] })) {
    perceptionRegistry.register(
      { name: 'perception.compareGroups', supportedWidgetKinds: ['sankey'] },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget({ kind: 'sankey' })
        const params = ctx.readCallParams()
        const comparison = runDataPerceptionQuery({
          ctx,
          dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
          targetWidget,
          kind: 'compareGroups',
          spec: params,
        })
        ctx.recordQuery({ affectedRefs: [targetWidget.ref] })
        return {
          result: buildPerceptionDataResult({
            dataQueryResult: comparison,
            fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, params).dataRef,
          }),
        }
      },
      { supportedWidgetKinds: ['sankey'] },
    )
  }
}
