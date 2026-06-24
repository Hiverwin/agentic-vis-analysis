import {
  buildBarOriginEChartsOption,
  buildBarOriginSpec,
  buildHeatmapEChartsOptionFromRenderModel,
  buildHeatmapSpec,
  buildLineEChartsOptionFromRenderModel,
  buildLineSpec,
  buildParallelCoordinatesEChartsOption,
  buildParallelCoordinatesSpec,
  buildSankeyEChartsOption,
  buildSankeyVegaSpec,
  buildScatterEChartsOptionFromRenderModel,
  buildScatterSpec,
  buildScatterVegaSpecFromRenderModel,
} from '../workspace/widgetSpecs.js'
import {
  buildBarRenderModel,
  buildHeatmapRenderModel,
  buildLineRenderModel,
  buildParallelCoordinatesRenderModel,
  buildSankeyRenderModel,
  buildScatterRenderModel,
} from '../workspace/renderModels.js'

export function summarizeOriginStats(rows) {
  const grouped = new Map()
  for (const row of rows) {
    const current = grouped.get(row.origin) || { origin: row.origin, totalHorsepower: 0, count: 0 }
    current.totalHorsepower += row.horsepower
    current.count += 1
    grouped.set(row.origin, current)
  }
  return [...grouped.values()]
    .map((entry) => ({
      origin: entry.origin,
      avgHorsepower: Number((entry.totalHorsepower / entry.count).toFixed(1)),
      count: entry.count,
    }))
    .sort((a, b) => b.avgHorsepower - a.avgHorsepower)
}

export function summarizeYearTrend(rows) {
  const grouped = new Map()
  for (const row of rows) {
    const key = `${row.year}-${row.origin}`
    const current = grouped.get(key) || { year: row.year, origin: row.origin, totalMpg: 0, count: 0 }
    current.totalMpg += row.mpg
    current.count += 1
    grouped.set(key, current)
  }
  return [...grouped.values()]
    .map((entry) => ({
      year: entry.year,
      origin: entry.origin,
      avgMpg: Number((entry.totalMpg / entry.count).toFixed(1)),
      count: entry.count,
    }))
    .sort((a, b) => a.year - b.year || a.origin.localeCompare(b.origin))
}

export function summarizeOriginCylinderMatrix(rows) {
  const grouped = new Map()
  for (const row of rows) {
    const key = `${row.origin}-${row.cylinders}`
    const current = grouped.get(key) || { origin: row.origin, cylinders: row.cylinders, totalHorsepower: 0, count: 0 }
    current.totalHorsepower += row.horsepower
    current.count += 1
    grouped.set(key, current)
  }
  return [...grouped.values()]
    .map((entry) => ({
      origin: entry.origin,
      cylinders: entry.cylinders,
      avgHorsepower: Number((entry.totalHorsepower / entry.count).toFixed(1)),
      count: entry.count,
    }))
    .sort((a, b) => a.origin.localeCompare(b.origin) || a.cylinders - b.cylinders)
}

export function buildSankeyData(rows) {
  const originNodes = new Map()
  const cylinderNodes = new Map()
  const yearNodes = new Map()
  const originToCylinder = new Map()
  const cylinderToYear = new Map()

  for (const row of rows) {
    originNodes.set(row.origin, { id: `origin:${row.origin}`, kind: 'origin', value: row.origin, label: row.origin, column: 0 })
    cylinderNodes.set(row.cylinders, { id: `cylinders:${row.cylinders}`, kind: 'cylinders', value: row.cylinders, label: `${row.cylinders} cyl`, column: 1 })
    yearNodes.set(row.year, { id: `year:${row.year}`, kind: 'year', value: row.year, label: String(row.year), column: 2 })

    const keyA = `${row.origin}|${row.cylinders}`
    const keyB = `${row.cylinders}|${row.year}`
    originToCylinder.set(keyA, (originToCylinder.get(keyA) || 0) + 1)
    cylinderToYear.set(keyB, (cylinderToYear.get(keyB) || 0) + 1)
  }

  const nodes = [...originNodes.values(), ...cylinderNodes.values(), ...yearNodes.values()]
  const links = [
    ...[...originToCylinder.entries()].map(([key, count]) => {
      const [origin, cylinders] = key.split('|')
      return { source: `origin:${origin}`, target: `cylinders:${cylinders}`, count }
    }),
    ...[...cylinderToYear.entries()].map(([key, count]) => {
      const [cylinders, year] = key.split('|')
      return { source: `cylinders:${cylinders}`, target: `year:${year}`, count }
    }),
  ]
  return { nodes, links }
}

export function autoCollapseSankeyGraph(graph, topN = 2, expandedAggregateIds = []) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.links) || topN < 0) {
    return graph
  }
  const nodeFlowTotals = new Map()
  for (const link of graph.links) {
    const value = Number(link.count || link.value || 0)
    nodeFlowTotals.set(link.source, (nodeFlowTotals.get(link.source) || 0) + value)
    nodeFlowTotals.set(link.target, (nodeFlowTotals.get(link.target) || 0) + value)
  }
  const nodesByColumn = new Map()
  for (const node of graph.nodes) {
    if (!nodesByColumn.has(node.column)) nodesByColumn.set(node.column, [])
    nodesByColumn.get(node.column).push(node)
  }
  const keepNodeIds = new Set()
  const collapsedNodes = []
  for (const [column, nodes] of nodesByColumn.entries()) {
    const ranked = [...nodes].sort((a, b) => (nodeFlowTotals.get(b.id) || 0) - (nodeFlowTotals.get(a.id) || 0))
    const aggregateId = `collapsed:${column}:other`
    if (expandedAggregateIds.includes(aggregateId)) {
      ranked.forEach((node) => keepNodeIds.add(node.id))
      continue
    }
    ranked.slice(0, topN).forEach((node) => keepNodeIds.add(node.id))
    if (ranked.length > topN) {
      collapsedNodes.push({
        id: aggregateId,
        kind: 'aggregate',
        value: `other_${column}`,
        label: `Other (${ranked.length - topN})`,
        column,
        aggregateName: aggregateId,
      })
    }
  }
  const collapseNodeId = (nodeId) => {
    if (keepNodeIds.has(nodeId)) return nodeId
    const sourceNode = graph.nodes.find((node) => node.id === nodeId)
    return sourceNode ? `collapsed:${sourceNode.column}:other` : nodeId
  }
  const mergedLinks = new Map()
  for (const link of graph.links) {
    const source = collapseNodeId(link.source)
    const target = collapseNodeId(link.target)
    if (source === target) continue
    const key = `${source}|${target}`
    mergedLinks.set(key, {
      source,
      target,
      count: (mergedLinks.get(key)?.count || 0) + Number(link.count || link.value || 0),
    })
  }
  return {
    nodes: [
      ...graph.nodes.filter((node) => keepNodeIds.has(node.id)),
      ...collapsedNodes,
    ],
    links: [...mergedLinks.values()],
  }
}

export function collapseSankeyGraphNodes(graph, nodes = [], aggregateName = 'Other') {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.links)) return graph
  const collapseSet = new Set((Array.isArray(nodes) ? nodes : []).filter((value) => typeof value === 'string' && value.length > 0))
  if (collapseSet.size === 0) return graph
  const collapsedNodes = graph.nodes.filter((node) => collapseSet.has(node.id))
  if (collapsedNodes.length === 0) return graph
  const column = collapsedNodes[0]?.column ?? 0
  const aggregateNode = {
    id: aggregateName,
    kind: 'aggregate',
    value: aggregateName,
    label: aggregateName,
    column,
    aggregateName,
  }
  const linksByKey = new Map()
  for (const link of graph.links) {
    if (!link || typeof link !== 'object') continue
    const source = collapseSet.has(link.source) ? aggregateName : link.source
    const target = collapseSet.has(link.target) ? aggregateName : link.target
    if (source === aggregateName && target === aggregateName) continue
    const key = `${source}|${target}`
    linksByKey.set(key, {
      source,
      target,
      count: (linksByKey.get(key)?.count || 0) + Number(link.count || link.value || 0),
    })
  }
  return {
    nodes: [
      ...graph.nodes.filter((node) => !collapseSet.has(node.id)),
      aggregateNode,
    ],
    links: [...linksByKey.values()],
  }
}

export function reorderSankeyGraphLayer(graph, depth, order = []) {
  if (!graph || !Array.isArray(graph.nodes) || !Number.isFinite(depth) || !Array.isArray(order) || order.length === 0) {
    return graph
  }
  const orderMap = new Map(order.map((name, index) => [name, index]))
  const targetNodes = graph.nodes.filter((node) => node.column === depth)
  if (targetNodes.length === 0) return graph
  const reorderedLayer = [...targetNodes].sort((left, right) => {
    const leftRank = orderMap.has(left.id) ? orderMap.get(left.id) : Number.MAX_SAFE_INTEGER
    const rightRank = orderMap.has(right.id) ? orderMap.get(right.id) : Number.MAX_SAFE_INTEGER
    return leftRank - rightRank
  })
  const layerIterators = new Map([[depth, reorderedLayer]])
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (node.column !== depth) return node
      const nextLayer = layerIterators.get(depth)
      return nextLayer.shift() || node
    }),
  }
}

export function createParallelRuntimeSpec(rows, widgetDefinition) {
  const renderModel = buildParallelCoordinatesRenderModel(rows, {})
  return buildParallelCoordinatesSpec(renderModel)
}

export function createSankeyRuntimeSpec(rows, widgetDefinition) {
  const graph = buildSankeyData(rows)
  return {
    kind: 'sankey',
    title: widgetDefinition?.title || 'Sankey',
    data: [
      {
        name: 'rawLinks',
        values: graph.links.map((link) => ({
          source: link.source,
          target: link.target,
          value: link.count,
        })),
      },
      {
        name: 'nodeConfig',
        values: graph.nodes.map((node, index) => ({
          name: node.id,
          depth: node.column,
          order: index,
          label: node.label,
        })),
      },
    ],
    _sankey_state: {
      original_nodes: graph.nodes.map((node, index) => ({
        name: node.id,
        depth: node.column,
        order: index,
        label: node.label,
      })),
      original_links: graph.links.map((link) => ({
        source: link.source,
        target: link.target,
        value: link.count,
      })),
      collapsed_groups: {},
    },
  }
}

function createInteractionConfig(widgetDefinition = {}) {
  const widgetKind = widgetDefinition?.widgetKind || null
  if (widgetKind === 'scatter') {
    return {
      click: 'focus-point',
      brush: 'interval-selection',
      zoom: 'viewport-domain',
    }
  }
  if (widgetKind === 'bar' || widgetKind === 'line' || widgetKind === 'heatmap') {
    return {
      click: 'select-mark',
    }
  }
  if (widgetKind === 'parallelCoordinates' || widgetKind === 'sankey') {
    return {
      click: 'focus-entity',
    }
  }
  return {}
}

function createProviderCapabilities(widgetDefinition = {}) {
  const provider = widgetDefinition?.provider || 'custom'
  const widgetKind = widgetDefinition?.widgetKind || null
  const base = {
    render: true,
    clickSelect: true,
    brush: false,
    zoom: false,
    verificationReadback: false,
  }

  if (widgetKind === 'scatter') {
    base.brush = true
    base.zoom = true
    base.verificationReadback = true
  }
  if (provider === 'vega-lite') {
    return {
      ...base,
      provider,
      signalBinding: true,
    }
  }
  if (provider === 'echarts') {
    return {
      ...base,
      provider,
      eventBinding: true,
    }
  }
  if (provider === 'd3') {
    return {
      ...base,
      provider,
      domBinding: true,
    }
  }
  return {
    ...base,
    provider,
  }
}

function createScatterRuntimeSource(widgetDefinition, rows) {
  const renderModel = buildScatterRenderModel(rows, {
    horsepowerDomain: [40, 230],
    activeRange: [40, 230],
  })
  const provider = widgetDefinition?.provider || 'vega-lite'
  return {
    kind: 'templateSpec',
    provider,
    spec: buildScatterSpec(rows, {
      horsepowerDomain: [40, 230],
      activeRange: [40, 230],
    }),
    providerSpec: provider === 'echarts'
      ? {
          provider: 'echarts',
          optionType: 'scatter',
          option: buildScatterEChartsOptionFromRenderModel(renderModel),
        }
      : provider === 'd3'
        ? {
            provider: 'd3',
            sceneType: 'scatter',
            sceneConfig: renderModel,
          }
        : {
            provider: 'vega-lite',
            specType: 'scatter',
            spec: buildScatterVegaSpecFromRenderModel(renderModel, {
              horsepowerDomain: [40, 230],
              activeRange: [40, 230],
            }),
          },
    renderModel,
    interactionConfig: createInteractionConfig(widgetDefinition),
    providerCapabilities: createProviderCapabilities(widgetDefinition),
  }
}

function createBarRuntimeSource(widgetDefinition, rows) {
  const summaryRows = summarizeOriginStats(rows)
  const renderModel = buildBarRenderModel(summaryRows, 'All')
  const provider = widgetDefinition?.provider || 'vega-lite'
  return {
    kind: 'templateSpec',
    provider,
    spec: buildBarOriginSpec(summaryRows, 'All'),
    providerSpec: provider === 'echarts'
      ? {
          provider: 'echarts',
          optionType: 'bar',
          option: buildBarOriginEChartsOption(summaryRows, 'All'),
        }
      : provider === 'd3'
        ? {
            provider: 'd3',
            sceneType: 'bar',
            sceneConfig: renderModel,
          }
        : {
            provider: 'vega-lite',
            specType: 'bar',
            spec: buildBarOriginSpec(summaryRows, 'All'),
          },
    renderModel,
    interactionConfig: createInteractionConfig(widgetDefinition),
    providerCapabilities: createProviderCapabilities(widgetDefinition),
  }
}

function createLineRuntimeSource(widgetDefinition, rows) {
  const summaryRows = summarizeYearTrend(rows)
  const provider = widgetDefinition?.provider || 'vega-lite'
  const renderModel = buildLineRenderModel(summaryRows, 'All')
  return {
    kind: 'templateSpec',
    provider,
    spec: buildLineSpec(summaryRows, 'All'),
    providerSpec: provider === 'echarts'
      ? {
          provider: 'echarts',
          optionType: 'line',
          option: buildLineEChartsOptionFromRenderModel(renderModel, 'All'),
        }
      : provider === 'd3'
        ? {
            provider: 'd3',
            sceneType: 'line',
            sceneConfig: renderModel,
          }
        : {
            provider: 'vega-lite',
            specType: 'line',
            spec: buildLineSpec(summaryRows, 'All'),
          },
    renderModel,
    interactionConfig: createInteractionConfig(widgetDefinition),
    providerCapabilities: createProviderCapabilities(widgetDefinition),
  }
}

function createHeatmapRuntimeSource(widgetDefinition, rows) {
  const matrixRows = summarizeOriginCylinderMatrix(rows)
  const provider = widgetDefinition?.provider || 'vega-lite'
  const renderModel = buildHeatmapRenderModel(matrixRows, 'All', [])
  return {
    kind: 'templateSpec',
    provider,
    spec: buildHeatmapSpec(matrixRows, 'All', []),
    providerSpec: provider === 'echarts'
      ? {
          provider: 'echarts',
          optionType: 'heatmap',
          option: buildHeatmapEChartsOptionFromRenderModel(renderModel, 'All', []),
        }
      : provider === 'd3'
        ? {
            provider: 'd3',
            sceneType: 'heatmap',
            sceneConfig: renderModel,
          }
        : {
            provider: 'vega-lite',
            specType: 'heatmap',
            spec: buildHeatmapSpec(matrixRows, 'All', []),
          },
    renderModel,
    interactionConfig: createInteractionConfig(widgetDefinition),
    providerCapabilities: createProviderCapabilities(widgetDefinition),
  }
}

function createParallelRuntimeSource(widgetDefinition, rows) {
  const provider = widgetDefinition?.provider || 'd3'
  const renderModel = buildParallelCoordinatesRenderModel(rows, {})
  return {
    kind: 'templateSpec',
    provider,
    spec: buildParallelCoordinatesSpec(renderModel),
    providerSpec: provider === 'echarts'
      ? {
          provider: 'echarts',
          optionType: 'parallelCoordinates',
          option: buildParallelCoordinatesEChartsOption(renderModel),
        }
      : provider === 'd3'
        ? {
            provider: 'd3',
            sceneType: 'parallelCoordinates',
            sceneConfig: renderModel,
          }
        : {
            provider: 'vega-lite',
            specType: 'parallelCoordinates',
            spec: buildParallelCoordinatesSpec(renderModel),
          },
    renderModel,
    interactionConfig: createInteractionConfig(widgetDefinition),
    providerCapabilities: createProviderCapabilities(widgetDefinition),
  }
}

function createSankeyRuntimeSource(widgetDefinition, rows) {
  const graph = buildSankeyData(rows)
  const provider = widgetDefinition?.provider || 'd3'
  const renderModel = buildSankeyRenderModel(graph, {})
  return {
    kind: 'templateSpec',
    provider,
    spec: createSankeyRuntimeSpec(rows, widgetDefinition),
    providerSpec: provider === 'echarts'
      ? {
          provider: 'echarts',
          optionType: 'sankey',
          option: buildSankeyEChartsOption(renderModel),
        }
      : provider === 'd3'
        ? {
            provider: 'd3',
            sceneType: 'sankey',
            sceneConfig: renderModel,
          }
        : {
            provider: 'vega-lite',
            specType: 'sankey',
            spec: buildSankeyVegaSpec(renderModel),
          },
    renderModel,
    interactionConfig: createInteractionConfig(widgetDefinition),
    providerCapabilities: createProviderCapabilities(widgetDefinition),
  }
}

export function createWidgetRuntimeSource(widgetDefinition, rows) {
  if (!widgetDefinition) return null
  if (widgetDefinition.widgetKind === 'scatter') return createScatterRuntimeSource(widgetDefinition, rows)
  if (widgetDefinition.widgetKind === 'bar') return createBarRuntimeSource(widgetDefinition, rows)
  if (widgetDefinition.widgetKind === 'line') return createLineRuntimeSource(widgetDefinition, rows)
  if (widgetDefinition.widgetKind === 'heatmap') return createHeatmapRuntimeSource(widgetDefinition, rows)
  if (widgetDefinition.widgetKind === 'parallelCoordinates') return createParallelRuntimeSource(widgetDefinition, rows)
  if (widgetDefinition.widgetKind === 'sankey') return createSankeyRuntimeSource(widgetDefinition, rows)
  return null
}

export function createWidgetRuntimeSpec(widgetDefinition, rows) {
  return createWidgetRuntimeSource(widgetDefinition, rows)?.spec || null
}
