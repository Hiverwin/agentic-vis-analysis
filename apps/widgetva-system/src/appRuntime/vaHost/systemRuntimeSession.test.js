import test from 'node:test'
import assert from 'node:assert/strict'

import { buildSystemRuntimeWorkspaceSpec } from './systemRuntimeSession.js'

test('buildSystemRuntimeWorkspaceSpec preserves external bench widgets and manual coordination links', () => {
  const caseDef = {
    id: 'bench_multi_widget_three_view_sales',
    topology: 'grid-overview',
    autoGenerateLinks: false,
    dataset: {
      name: 'Sales coordination subset',
      rowsData: [
        { region: 'North', revenue: 130, margin: 18, year: 2024 },
        { region: 'West', revenue: 88, margin: 27, year: 2024 },
      ],
    },
    widgets: [
      {
        id: 'bench_bar_region',
        kind: 'bar',
        widgetKind: 'bar',
        provider: 'vega-lite',
        title: 'Revenue by Region',
        source: {
          kind: 'nativeArtifact',
          provider: 'vega-lite',
          providerSpec: {
            provider: 'vega-lite',
            spec: { mark: 'bar', encoding: { x: { field: 'region' }, y: { field: 'revenue' } } },
          },
        },
      },
      {
        id: 'bench_scatter_revenue_margin',
        kind: 'scatter',
        widgetKind: 'scatter',
        provider: 'vega-lite',
        title: 'Revenue vs Margin',
        source: {
          kind: 'nativeArtifact',
          provider: 'vega-lite',
          providerSpec: {
            provider: 'vega-lite',
            spec: { mark: 'point', encoding: { x: { field: 'revenue' }, y: { field: 'margin' } } },
          },
        },
      },
      {
        id: 'bench_line_year_margin',
        kind: 'line',
        widgetKind: 'line',
        provider: 'vega-lite',
        title: 'Margin by Year',
        source: {
          kind: 'nativeArtifact',
          provider: 'vega-lite',
          providerSpec: {
            provider: 'vega-lite',
            spec: { mark: 'line', encoding: { x: { field: 'year' }, y: { field: 'margin' } } },
          },
        },
      },
    ],
    links: [
      {
        id: 'bench_region_filters_scatter',
        sourceWidgetId: 'bench_bar_region',
        targetWidgetId: 'bench_scatter_revenue_margin',
        kind: 'filter',
        effect: 'applyFilter',
        activationPolicy: 'manual',
      },
      {
        id: 'bench_region_filters_line',
        sourceWidgetId: 'bench_bar_region',
        targetWidgetId: 'bench_line_year_margin',
        kind: 'filter',
        effect: 'applyFilter',
        activationPolicy: 'manual',
      },
    ],
  }

  const spec = buildSystemRuntimeWorkspaceSpec(caseDef)

  assert.equal(spec.widgets.length, 3)
  assert.equal(spec.links.length, 2)
  assert.deepEqual(spec.widgets.map((widget) => widget.kind), ['bar', 'scatter', 'line'])
  assert.equal(spec.widgets.every((widget) => widget.source?.kind === 'nativeArtifact'), true)
  assert.equal(spec.widgets.every((widget) => widget.source?.providerSpec?.provider === 'vega-lite'), true)
  assert.deepEqual(
    spec.links.map((link) => [link.linkId, link.sourceWidgetId, link.targetWidgetId]),
    [
      ['bench_region_filters_scatter', 'bench_bar_region', 'bench_scatter_revenue_margin'],
      ['bench_region_filters_line', 'bench_bar_region', 'bench_line_year_margin'],
    ],
  )
  assert.equal(spec.links.every((link) => link.activationPolicy === 'manual'), true)
})

test('buildSystemRuntimeWorkspaceSpec preserves state-to-state coordination relations without widget-link fields', () => {
  const sourceStateRef = 'wl://widgetva-app/workspace/shared_visitors/widget/w_bar/selection/region'
  const targetStateRef = 'wl://widgetva-app/workspace/shared_visitors/widget/w_scatter/transform/region-filter'
  const caseDef = {
    id: 'shared_visitors',
    widgets: [
      { id: 'w_bar', kind: 'bar', provider: 'vega-lite', title: 'Visitors by Region' },
      { id: 'w_scatter', kind: 'scatter', provider: 'vega-lite', title: 'Marketing Spend vs Visitors' },
    ],
    coordinationLinks: [
      {
        ref: 'wl://widgetva-app/workspace/shared_visitors/coordination/bar-region-to-scatter-filter',
        sourceStateRef,
        targetStateRef,
        relation: 'controls',
        transform: {
          kind: 'selectionToFilter',
          fieldMapping: [{ sourceField: 'region', targetField: 'region' }],
        },
        activation: 'automatic',
      },
    ],
  }

  const spec = buildSystemRuntimeWorkspaceSpec(caseDef)

  assert.equal(spec.links.length, 1)
  assert.equal(spec.links[0].sourceStateRef, sourceStateRef)
  assert.equal(spec.links[0].targetStateRef, targetStateRef)
  assert.equal(spec.links[0].relation, 'controls')
  assert.equal(spec.links[0].transform.kind, 'selectionToFilter')
  assert.equal(Object.hasOwn(spec.links[0], 'sourceWidgetId'), false)
  assert.equal(Object.hasOwn(spec.links[0], 'targetWidgetId'), false)
  assert.equal(Object.hasOwn(spec.links[0], 'effect'), false)
})
