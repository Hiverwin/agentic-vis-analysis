import {
  describeBarWidgetContract,
  describeHeatmapWidgetContract,
  describeLineWidgetContract,
  describeParallelCoordinatesWidgetContract,
  describeSankeyWidgetContract,
  describeScatterWidgetContract,
} from '../../../../widgetva-kit/src/widgets.js'

const TYPE_TO_KIND = {
  'scatter-vega': 'scatter',
  'scatter-echarts': 'scatter',
  'scatter-d3': 'scatter',
  'bar-vega': 'bar',
  'bar-echarts': 'bar',
  'bar-d3': 'bar',
  'line-vega': 'line',
  'line-echarts': 'line',
  'line-d3': 'line',
  'heatmap-vega': 'heatmap',
  'heatmap-echarts': 'heatmap',
  'heatmap-d3': 'heatmap',
  'parallel-custom': 'parallelCoordinates',
  'parallel-vega': 'parallelCoordinates',
  'parallel-echarts': 'parallelCoordinates',
  'parallel-d3': 'parallelCoordinates',
  'sankey-custom': 'sankey',
  'sankey-vega': 'sankey',
  'sankey-echarts': 'sankey',
  'sankey-d3': 'sankey',
}

const TYPE_TO_PROVIDER = {
  'scatter-vega': 'vega-lite',
  'scatter-echarts': 'echarts',
  'scatter-d3': 'd3',
  'bar-vega': 'vega-lite',
  'bar-echarts': 'echarts',
  'bar-d3': 'd3',
  'line-vega': 'vega-lite',
  'line-echarts': 'echarts',
  'line-d3': 'd3',
  'heatmap-vega': 'vega-lite',
  'heatmap-echarts': 'echarts',
  'heatmap-d3': 'd3',
  'parallel-custom': 'd3',
  'parallel-vega': 'vega-lite',
  'parallel-echarts': 'echarts',
  'parallel-d3': 'd3',
  'sankey-custom': 'd3',
  'sankey-vega': 'vega-lite',
  'sankey-echarts': 'echarts',
  'sankey-d3': 'd3',
}

const CONTRACT_READERS = {
  scatter: describeScatterWidgetContract,
  bar: describeBarWidgetContract,
  line: describeLineWidgetContract,
  heatmap: describeHeatmapWidgetContract,
  parallelCoordinates: describeParallelCoordinatesWidgetContract,
  sankey: describeSankeyWidgetContract,
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function resolveWidgetKind(widgetType) {
  return TYPE_TO_KIND[widgetType] || null
}

export function resolveWidgetProvider(widgetType) {
  return TYPE_TO_PROVIDER[widgetType] || null
}

export function normalizeImportedWidgetDefinition(widgetDefinition = {}) {
  const legacyType = typeof widgetDefinition?.type === 'string' ? widgetDefinition.type : null
  const widgetKind = widgetDefinition?.widgetKind || resolveWidgetKind(legacyType)
  const provider = widgetDefinition?.provider || resolveWidgetProvider(legacyType) || 'custom'
  return {
    ...clone(widgetDefinition),
    ...(legacyType ? { type: legacyType } : {}),
    widgetKind,
    provider,
  }
}

export function readImportedWidgetContract(widgetType) {
  const kind = resolveWidgetKind(widgetType)
  const reader = kind ? CONTRACT_READERS[kind] : null
  if (!reader) {
    return {
      kind,
      actionNames: [],
      perceptionNames: [],
    }
  }
  return clone(reader())
}

export function decorateImportedWidget(widgetDefinition) {
  const normalizedWidget = normalizeImportedWidgetDefinition(widgetDefinition)
  const widgetContract = readImportedWidgetContract(normalizedWidget?.type)
  return {
    ...normalizedWidget,
    widgetKind: widgetContract.kind,
    provider: normalizedWidget.provider,
    widgetContract,
    contractSummary: {
      kind: widgetContract.kind,
      actionCount: widgetContract.actionNames.length,
      perceptionCount: widgetContract.perceptionNames.length,
    },
  }
}
