import path from 'node:path'
import { readFileSync } from 'node:fs'

import {
  BarWidgetAdapter,
  HeatmapWidgetAdapter,
  LineWidgetAdapter,
  ParallelCoordinatesWidgetAdapter,
  SankeyWidgetAdapter,
  ScatterWidgetAdapter,
} from '../../../widgetva-kit/src/adapters.js'
import {
  describeWidgetSemanticSurface,
  resolveSemanticCapabilityBindings,
} from '../../../widgetva-kit/src/capabilities.js'

export const SUPPORTED_ECHARTS_WIDGET_KINDS = Object.freeze([
  'bar',
  'heatmap',
  'line',
  'parallelCoordinates',
  'sankey',
  'scatter',
])

const ADAPTER_BY_WIDGET_KIND = Object.freeze({
  bar: BarWidgetAdapter,
  heatmap: HeatmapWidgetAdapter,
  line: LineWidgetAdapter,
  parallelCoordinates: ParallelCoordinatesWidgetAdapter,
  sankey: SankeyWidgetAdapter,
  scatter: ScatterWidgetAdapter,
})

const RECOMMENDED_CHART_HOOKS = Object.freeze({
  bar: ['getState', 'setOption', 'dispatchAction', 'on'],
  heatmap: ['getState', 'setOption', 'dispatchAction', 'on'],
  line: ['getState', 'setOption', 'dispatchAction'],
  parallelCoordinates: ['getState', 'setOption', 'dispatchAction', 'on'],
  sankey: ['getState', 'setOption', 'dispatchAction'],
  scatter: ['getState', 'setOption', 'dispatchAction', 'setBrush', 'setDomain', 'on'],
})

export function readBenchmarkFile(benchmarkPath) {
  return JSON.parse(readFileSync(benchmarkPath, 'utf8'))
}

export function readPackagedDataset({ benchmark, packageRoot }) {
  const datasetPath = benchmark?.data_source?.dataset_path
  if (!datasetPath) return null
  const absolutePath = path.join(packageRoot, datasetPath)
  return JSON.parse(readFileSync(absolutePath, 'utf8'))
}

export function createEChartsRuntimeAdapter({ widgetKind, widgetRef, chart, dataRef }) {
  const AdapterCtor = ADAPTER_BY_WIDGET_KIND[widgetKind]
  if (!AdapterCtor) {
    throw new Error(`Unsupported ECharts widget kind: ${widgetKind}`)
  }
  return new AdapterCtor(widgetRef, chart, dataRef)
}

export function collectEChartsCapabilityBindings({ benchmark }) {
  const widgetKind = benchmark?.widget_kind
  const requiredCapabilities = [
    ...new Set(
      (benchmark?.question_set || [])
        .flatMap((question) => question?.ground_truth?.required_capabilities || [])
        .filter(Boolean),
    ),
  ]

  return requiredCapabilities.map((capability) => ({
    capability,
    bindings: resolveSemanticCapabilityBindings({
      semanticId: capability,
      widgetKind,
    }),
  }))
}

export function describeEChartsBenchmarkMaterialization({ benchmark }) {
  const widgetKind = benchmark?.widget_kind
  const supported = SUPPORTED_ECHARTS_WIDGET_KINDS.includes(widgetKind)

  return {
    benchmarkId: benchmark?.benchmark_id || null,
    widgetKind,
    supported,
    adapterClass: supported ? ADAPTER_BY_WIDGET_KIND[widgetKind].name : null,
    packageDatasetPath: benchmark?.data_source?.dataset_path || null,
    recommendedChartHooks: supported ? RECOMMENDED_CHART_HOOKS[widgetKind] : [],
    capabilityBindings: collectEChartsCapabilityBindings({ benchmark }),
    semanticSurface: supported ? describeWidgetSemanticSurface(widgetKind) : null,
    transportOptions: ['in-page', 'playwright', 'websocket', 'browser-extension'],
  }
}
