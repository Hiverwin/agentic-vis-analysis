import { barWidgetAdapter } from './barWidgetAdapter.js'
import { createD3WidgetAdapter } from '../D3WidgetAdapter.js'
import { defaultWidgetAdapter } from './defaultWidgetAdapter.js'
import { createEChartsWidgetAdapter } from '../EChartsWidgetAdapter.js'
import {
  bindD3FamilyInteractions,
  bindEChartsFamilyInteractions,
  buildEChartsFamilyOption,
  renderD3FamilyState,
} from '../providerFamilyBehavior.js'
import { heatmapWidgetAdapter } from './heatmapWidgetAdapter.js'
import { lineWidgetAdapter } from './lineWidgetAdapter.js'
import { mapWidgetAdapter } from './mapWidgetAdapter.js'
import { parallelCoordinatesWidgetAdapter } from './parallelCoordinatesWidgetAdapter.js'
import {
  BarWidgetAdapter,
  HeatmapWidgetAdapter,
  LineWidgetAdapter,
  ParallelCoordinatesWidgetAdapter,
  SankeyWidgetAdapter,
  ScatterWidgetAdapter,
  TableWidgetAdapter,
} from './runtimeWidgetAdapters.js'
import { scatterWidgetAdapter } from './scatterWidgetAdapter.js'
import { sankeyWidgetAdapter } from './sankeyWidgetAdapter.js'
import { tableWidgetAdapter } from './tableWidgetAdapter.js'
import { createVegaLiteWidgetAdapter } from '../VegaLiteWidgetAdapter.js'

const familyAdapters = new Map([
  ['scatter', scatterWidgetAdapter],
  ['bar', barWidgetAdapter],
  ['line', lineWidgetAdapter],
  ['heatmap', heatmapWidgetAdapter],
  ['parallelCoordinates', parallelCoordinatesWidgetAdapter],
  ['sankey', sankeyWidgetAdapter],
  ['map', mapWidgetAdapter],
  ['table', tableWidgetAdapter],
  ['custom', defaultWidgetAdapter],
])

export function getWidgetFamilyAdapter(kind) {
  return familyAdapters.get(kind) || defaultWidgetAdapter
}

export function listWidgetFamilyAdapters() {
  return Array.from(familyAdapters.values())
}

export function createWidgetFamilyAdapterInstance(kind, args = {}) {
  const adapter = getWidgetFamilyAdapter(kind)
  return adapter.createInstance(args)
}

function bindIfFunction(target, name) {
  const value = target?.[name]
  return typeof value === 'function' ? value.bind(target) : undefined
}

function pickProviderSharedDefinition(kind, { includeProviderRenderHooks = true } = {}) {
  const familyAdapter = getWidgetFamilyAdapter(kind)
  const baseDefinition = {
    kind,
    buildActionDescriptors: bindIfFunction(familyAdapter, 'buildActionDescriptors'),
    buildPerceptionDescriptors: bindIfFunction(familyAdapter, 'buildPerceptionDescriptors'),
    getHumanInteractionConfig: bindIfFunction(familyAdapter, 'getHumanInteractionConfig'),
    registerActions: bindIfFunction(familyAdapter, 'registerActions'),
    registerPerceptionQueries: bindIfFunction(familyAdapter, 'registerPerceptionQueries'),
    readSelection: bindIfFunction(familyAdapter, 'readSelection'),
    readViewport: bindIfFunction(familyAdapter, 'readViewport'),
  }
  if (!includeProviderRenderHooks) {
    return baseDefinition
  }
  return {
    ...baseDefinition,
    bindHumanInteractions: bindIfFunction(familyAdapter, 'bindHumanInteractions'),
    applyState: bindIfFunction(familyAdapter, 'applyState'),
    mount: bindIfFunction(familyAdapter, 'mount'),
    update: bindIfFunction(familyAdapter, 'update'),
    dispose: bindIfFunction(familyAdapter, 'dispose'),
  }
}

export function createProviderFamilyAdapter(kind, provider = 'vega-lite') {
  const sharedDefinition = pickProviderSharedDefinition(kind, {
    includeProviderRenderHooks: provider === 'vega-lite',
  })
  if (provider === 'echarts') {
    return createEChartsWidgetAdapter({
      ...sharedDefinition,
      bindHumanInteractions(args) {
        return bindEChartsFamilyInteractions(args)
      },
      buildOptionFromState(args) {
        return buildEChartsFamilyOption(args)
      },
    })
  }
  if (provider === 'd3') {
    return createD3WidgetAdapter({
      ...sharedDefinition,
      bindHumanInteractions(args) {
        return bindD3FamilyInteractions(args)
      },
      async renderFromState(args) {
        return renderD3FamilyState(args)
      },
    })
  }
  return createVegaLiteWidgetAdapter(sharedDefinition)
}

export function createScatterWidgetAdapter(args = {}) {
  return createWidgetFamilyAdapterInstance('scatter', args)
}

export function createBarWidgetAdapter(args = {}) {
  return createWidgetFamilyAdapterInstance('bar', args)
}

export function createHeatmapWidgetAdapter(args = {}) {
  return createWidgetFamilyAdapterInstance('heatmap', args)
}

export function createTableWidgetAdapter(args = {}) {
  return createWidgetFamilyAdapterInstance('table', args)
}

export function registerWidgetFamilyAdapters({ actionExecutor, perceptionQueryRegistry }) {
  return registerWidgetAdapters(familyAdapters.values(), {
    actionExecutor,
    perceptionQueryRegistry,
  })
}

export function registerWidgetAdapters(adapters, { actionExecutor, perceptionQueryRegistry }) {
  for (const adapter of adapters || []) {
    adapter.registerActions?.(actionExecutor)
    adapter.registerPerceptionQueries?.(perceptionQueryRegistry)
  }
}

export {
  BarWidgetAdapter,
  barWidgetAdapter,
  HeatmapWidgetAdapter,
  heatmapWidgetAdapter,
  LineWidgetAdapter,
  lineWidgetAdapter,
  ParallelCoordinatesWidgetAdapter,
  parallelCoordinatesWidgetAdapter,
  SankeyWidgetAdapter,
  sankeyWidgetAdapter,
  ScatterWidgetAdapter,
  scatterWidgetAdapter,
  TableWidgetAdapter,
  tableWidgetAdapter,
}
