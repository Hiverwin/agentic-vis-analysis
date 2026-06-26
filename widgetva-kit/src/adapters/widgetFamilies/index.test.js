import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createBarWidgetAdapter,
  createHeatmapWidgetAdapter,
  createScatterWidgetAdapter,
  createTableWidgetAdapter,
  createWidgetFamilyAdapterInstance,
  getWidgetFamilyAdapter,
} from './index.js'

test('createWidgetFamilyAdapterInstance materializes a scatter family adapter instance', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const dataRef = 'wl://demo/workspace/main/data/cars'
  const instance = createWidgetFamilyAdapterInstance('scatter', {
    widgetRef,
    dataRef,
    getDescription() {
      return {
        ref: widgetRef,
        title: 'Scatter A',
      }
    },
    getState() {
      return {
        ref: widgetRef,
        widgetId: 'scatter_a',
      }
    },
  })

  assert.equal(instance.widgetRef, widgetRef)
  assert.equal(instance.dataRef, dataRef)
  assert.equal(instance.kind, 'scatter')
  assert.equal(instance.provider, 'vega-lite')
  assert.equal(instance.getDescription()?.title, 'Scatter A')
  assert.equal(instance.getHumanInteractionConfig()?.mode, 'brush2d')
})

test('createWidgetFamilyAdapterInstance falls back to the default family adapter for unknown kinds', () => {
  const instance = createWidgetFamilyAdapterInstance('unknown_kind', {
    widgetRef: 'wl://demo/workspace/main/widget/custom_a',
    dataRef: 'wl://demo/workspace/main/data/custom_rows',
    getDescription() {
      return {
        ref: 'wl://demo/workspace/main/widget/custom_a',
      }
    },
    getState() {
      return {
        ref: 'wl://demo/workspace/main/widget/custom_a',
      }
    },
  })

  assert.equal(instance.kind, getWidgetFamilyAdapter('custom').kind)
  assert.equal(instance.provider, 'custom')
})

test('createScatterWidgetAdapter, createBarWidgetAdapter, createHeatmapWidgetAdapter, and createTableWidgetAdapter expose widget-specific adapter factories', () => {
  const scatter = createScatterWidgetAdapter({
    widgetRef: 'wl://demo/workspace/main/widget/scatter_a',
    dataRef: 'wl://demo/workspace/main/data/cars',
    getDescription() {
      return { ref: 'wl://demo/workspace/main/widget/scatter_a' }
    },
    getState() {
      return { ref: 'wl://demo/workspace/main/widget/scatter_a' }
    },
  })
  const bar = createBarWidgetAdapter({
    widgetRef: 'wl://demo/workspace/main/widget/bar_b',
    dataRef: 'wl://demo/workspace/main/data/cars_grouped',
    getDescription() {
      return { ref: 'wl://demo/workspace/main/widget/bar_b' }
    },
    getState() {
      return { ref: 'wl://demo/workspace/main/widget/bar_b' }
    },
  })
  const heatmap = createHeatmapWidgetAdapter({
    widgetRef: 'wl://demo/workspace/main/widget/heatmap_c',
    dataRef: 'wl://demo/workspace/main/data/heatmap_cells',
    getDescription() {
      return { ref: 'wl://demo/workspace/main/widget/heatmap_c' }
    },
    getState() {
      return { ref: 'wl://demo/workspace/main/widget/heatmap_c' }
    },
  })
  const table = createTableWidgetAdapter({
    widgetRef: 'wl://demo/workspace/main/widget/table_d',
    dataRef: 'wl://demo/workspace/main/data/detail_rows',
    getDescription() {
      return { ref: 'wl://demo/workspace/main/widget/table_d' }
    },
    getState() {
      return { ref: 'wl://demo/workspace/main/widget/table_d' }
    },
  })

  assert.equal(scatter.kind, 'scatter')
  assert.equal(scatter.provider, 'vega-lite')
  assert.equal(scatter.getHumanInteractionConfig()?.mode, 'brush2d')
  assert.equal(bar.kind, 'bar')
  assert.equal(bar.provider, 'vega-lite')
  assert.equal(bar.getHumanInteractionConfig()?.mode, 'categoryClick')
  assert.equal(heatmap.kind, 'heatmap')
  assert.equal(heatmap.provider, 'vega-lite')
  assert.equal(heatmap.getHumanInteractionConfig()?.actionName, 'heatmap.filterCells')
  assert.equal(table.kind, 'table')
  assert.equal(table.provider, 'custom')
  assert.equal(table.getHumanInteractionConfig()?.actionName, 'table.focusRows')
})
