import test from 'node:test'
import assert from 'node:assert/strict'

import { buildWorkspaceComposition } from './workspaceComposition.js'

test('buildWorkspaceComposition derives state-to-state coordination relations from compatible imported widgets', () => {
  const composition = buildWorkspaceComposition({
    id: 'imported_shared_visitors',
    widgets: [
      {
        id: 'w_bar',
        widgetKind: 'bar',
        provider: 'vega-lite',
        title: 'Visitors by Region',
        source: {
          providerSpec: {
            provider: 'vega-lite',
            spec: {
              data: {
                values: [
                  { region: 'Downtown', month: '2024-01', marketing_spend: 1200, visitors: 100 },
                  { region: 'Harbor', month: '2024-01', marketing_spend: 900, visitors: 70 },
                ],
              },
              mark: 'bar',
              encoding: {
                x: { field: 'region', type: 'nominal' },
                y: { aggregate: 'sum', field: 'visitors', type: 'quantitative' },
              },
            },
          },
        },
      },
      {
        id: 'w_line',
        widgetKind: 'line',
        provider: 'vega-lite',
        title: 'Monthly Visitors',
        source: {
          providerSpec: {
            provider: 'vega-lite',
            spec: {
              data: {
                values: [
                  { region: 'Downtown', month: '2024-01', marketing_spend: 1200, visitors: 100 },
                  { region: 'Harbor', month: '2024-01', marketing_spend: 900, visitors: 70 },
                ],
              },
              mark: 'line',
              encoding: {
                x: { field: 'month', type: 'temporal' },
                y: { field: 'visitors', type: 'quantitative' },
                color: { field: 'region', type: 'nominal' },
              },
            },
          },
        },
      },
      {
        id: 'w_scatter',
        widgetKind: 'scatter',
        provider: 'vega-lite',
        title: 'Marketing Spend vs Visitors',
        source: {
          providerSpec: {
            provider: 'vega-lite',
            spec: {
              data: {
                values: [
                  { region: 'Downtown', month: '2024-01', marketing_spend: 1200, visitors: 100 },
                  { region: 'Harbor', month: '2024-01', marketing_spend: 900, visitors: 70 },
                ],
              },
              mark: 'point',
              encoding: {
                x: { field: 'marketing_spend', type: 'quantitative' },
                y: { field: 'visitors', type: 'quantitative' },
                color: { field: 'region', type: 'nominal' },
              },
            },
          },
        },
      },
    ],
  })

  assert.equal(composition.links.length > 0, true)
  assert.equal(
    composition.links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_bar/selection/region'
      && link.targetStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_scatter/transform/region-filter'
      && link.transform?.kind === 'selectionToFilter'
    )),
    true,
  )
  assert.equal(
    composition.links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_scatter/view/zoom'
      && link.targetStateRef?.startsWith('wl://widgetva-app/workspace/imported_shared_visitors/widget/w_bar/transform/')
      && link.transform?.kind === 'domainToFilter'
      && link.transform?.channelMapping?.some((mapping) => (
        mapping.sourceChannel === 'x'
        && mapping.targetField === 'marketing_spend'
      ))
    )),
    true,
  )
  assert.equal(
    composition.links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_bar/selection/region'
      && link.targetStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_scatter/view/reencode'
      && link.transform?.kind === 'selectionToReencode'
      && link.transform?.fieldMapping?.[0]?.targetField === 'region'
    )),
    true,
  )
  assert.equal(
    composition.links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_scatter/view/zoom'
      && link.targetStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_bar/view/reencode'
      && link.transform?.kind === 'domainToReencode'
      && link.transform?.channelMapping?.some((mapping) => mapping.targetField === 'marketing_spend')
    )),
    true,
  )
  assert.equal(
    composition.links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_bar/selection/region'
      && link.targetStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_scatter/view/highlight'
      && link.transform?.kind === 'selectionToHighlight'
      && link.transform?.fieldMapping?.[0]?.targetField === 'region'
    )),
    true,
  )
  assert.equal(
    composition.links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_scatter/selection/brush'
      && link.targetStateRef?.startsWith('wl://widgetva-app/workspace/imported_shared_visitors/widget/w_bar/transform/')
      && link.transform?.kind === 'intervalToFilter'
      && link.transform?.channelMapping?.some((mapping) => (
        mapping.sourceChannel === 'x'
        && mapping.targetField === 'marketing_spend'
      ))
    )),
    true,
  )
  assert.equal(
    composition.links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_scatter/view/zoom'
      && link.targetStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_line/view/zoom'
      && link.transform?.kind === 'domainToDomain'
      && link.transform?.channelMapping?.some((mapping) => (
        mapping.sourceChannel === 'y'
        && mapping.targetChannel === 'y'
      ))
    )),
    true,
  )
})

test('buildWorkspaceComposition accepts external bench-declared manual coordination links', () => {
  const caseDef = {
    id: 'bench_multi_widget_three_view',
    topology: 'grid-overview',
    autoGenerateLinks: false,
    widgets: [
      { id: 'bench_bar_category', kind: 'bar', provider: 'vega-lite', title: 'Items by Category' },
      { id: 'bench_scatter_values', kind: 'scatter', provider: 'vega-lite', title: 'Value Scatter' },
      { id: 'bench_line_time', kind: 'line', provider: 'vega-lite', title: 'Value by Time' },
    ],
    links: [
      {
        linkId: 'bench_category_filters_scatter',
        sourceWidgetId: 'bench_bar_category',
        targetWidgetId: 'bench_scatter_values',
        kind: 'filter',
        effect: 'applyFilter',
        activationPolicy: 'manual',
        fieldMapping: [{ sourceField: 'category', targetField: 'category' }],
      },
      {
        linkId: 'bench_category_filters_line',
        sourceWidgetId: 'bench_bar_category',
        targetWidgetId: 'bench_line_time',
        kind: 'filter',
        effect: 'applyFilter',
        activationPolicy: 'manual',
        fieldMapping: [{ sourceField: 'category', targetField: 'category' }],
      },
    ],
  }

  const composition = buildWorkspaceComposition(caseDef)

  assert.equal(composition.caseId, 'bench_multi_widget_three_view')
  assert.equal(composition.widgets.length, 3)
  assert.equal(composition.links.length, 2)
  assert.deepEqual(
    composition.links.map((link) => link.linkId).sort(),
    ['bench_category_filters_line', 'bench_category_filters_scatter'],
  )
  assert.equal(composition.links.every((link) => link.activationPolicy === 'manual'), true)
  assert.equal(composition.links.every((link) => link.kind === 'filter'), true)
  assert.equal(composition.links.every((link) => Object.hasOwn(link, 'primitive') === false), true)
  assert.equal(composition.links.every((link) => link.from === undefined), true)
  assert.equal(composition.links.every((link) => link.to === undefined), true)
  assert.equal(composition.links.every((link) => link.sourceWidgetId === 'bench_bar_category'), true)
  assert.deepEqual(
    composition.links.map((link) => link.targetWidgetId).sort(),
    ['bench_line_time', 'bench_scatter_values'],
  )
})

test('buildWorkspaceComposition preserves state-to-state coordination relations', () => {
  const sourceStateRef = 'wl://widgetva-app/workspace/shared_visitors/widget/w_bar/selection/region'
  const targetStateRef = 'wl://widgetva-app/workspace/shared_visitors/widget/w_scatter/transform/region-filter'
  const composition = buildWorkspaceComposition({
    id: 'shared_visitors',
    topology: 'grid-overview',
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
  })

  assert.equal(composition.links.length, 1)
  assert.equal(composition.links[0].sourceStateRef, sourceStateRef)
  assert.equal(composition.links[0].targetStateRef, targetStateRef)
  assert.equal(composition.links[0].relation, 'controls')
  assert.equal(composition.links[0].transform.kind, 'selectionToFilter')
  assert.equal(composition.links[0].activation, 'automatic')
  assert.equal(Object.hasOwn(composition.links[0], 'sourceWidgetId'), false)
  assert.equal(Object.hasOwn(composition.links[0], 'targetWidgetId'), false)
})
