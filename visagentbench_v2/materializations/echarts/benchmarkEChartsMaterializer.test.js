import test from 'node:test'
import assert from 'node:assert/strict'

import {
  SUPPORTED_ECHARTS_WIDGET_KINDS,
  createEChartsRuntimeAdapter,
  describeEChartsBenchmarkMaterialization,
} from './benchmarkEChartsMaterializer.js'

test('benchmarkEChartsMaterializer exposes the supported widget kinds and adapter factory', () => {
  assert.deepEqual(SUPPORTED_ECHARTS_WIDGET_KINDS, [
    'bar',
    'heatmap',
    'line',
    'parallelCoordinates',
    'sankey',
    'scatter',
  ])

  const adapter = createEChartsRuntimeAdapter({
    widgetKind: 'line',
    widgetRef: 'wl://demo/workspace/main/widget/line_a',
    chart: {
      getState() {
        return { view: {} }
      },
    },
    dataRef: 'wl://demo/workspace/main/data/rows',
  })

  assert.equal(adapter.getDescription().kind, 'line')
  assert.equal(adapter.getState().kind, 'line')
})

test('describeEChartsBenchmarkMaterialization returns the expected renderer summary for a line benchmark', () => {
  const summary = describeEChartsBenchmarkMaterialization({
    benchmark: {
      benchmark_id: 'bench_001',
      widget_kind: 'line',
      data_source: {
        dataset_path: 'datasets/example.json',
      },
      question_set: [
        {
          ground_truth: {
            required_capabilities: ['view.domain.zoom', 'line.series.filter'],
          },
        },
      ],
    },
  })

  assert.equal(summary.supported, true)
  assert.equal(summary.adapterClass, 'LineWidgetAdapter')
  assert.equal(summary.packageDatasetPath, 'datasets/example.json')
  assert.deepEqual(summary.recommendedChartHooks, ['getState', 'setOption', 'dispatchAction'])
  assert.equal(Array.isArray(summary.capabilityBindings), true)
  assert.equal(summary.semanticSurface?.widgetKind, 'line')
})
