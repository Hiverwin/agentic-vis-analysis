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

export const SUPPORTED_D3_WIDGET_KINDS = Object.freeze([
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
  bar: ['getState', 'renderFromState', 'applyAction', 'onCategoryClick'],
  heatmap: ['getState', 'renderFromState', 'applyAction', 'onCellClick'],
  line: ['getState', 'renderFromState', 'applyAction'],
  parallelCoordinates: ['getState', 'renderFromState', 'applyAction'],
  sankey: ['getState', 'renderFromState', 'applyAction'],
  scatter: ['getState', 'renderFromState', 'applyAction', 'setBrush', 'setDomain', 'onBrush'],
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

export function createD3RuntimeAdapter({ widgetKind, widgetRef, chart, dataRef }) {
  const AdapterCtor = ADAPTER_BY_WIDGET_KIND[widgetKind]
  if (!AdapterCtor) {
    throw new Error(`Unsupported D3 widget kind: ${widgetKind}`)
  }
  return new AdapterCtor(widgetRef, chart, dataRef)
}

export function collectD3CapabilityBindings({ benchmark }) {
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

export function describeD3BenchmarkMaterialization({ benchmark }) {
  const widgetKind = benchmark?.widget_kind
  const supported = SUPPORTED_D3_WIDGET_KINDS.includes(widgetKind)

  return {
    benchmarkId: benchmark?.benchmark_id || null,
    widgetKind,
    supported,
    adapterClass: supported ? ADAPTER_BY_WIDGET_KIND[widgetKind].name : null,
    packageDatasetPath: benchmark?.data_source?.dataset_path || null,
    recommendedChartHooks: supported ? RECOMMENDED_CHART_HOOKS[widgetKind] : [],
    capabilityBindings: collectD3CapabilityBindings({ benchmark }),
    semanticSurface: supported ? describeWidgetSemanticSurface(widgetKind) : null,
    transportOptions: ['in-page', 'playwright', 'websocket', 'browser-extension'],
  }
}
