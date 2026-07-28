import test from 'node:test'
import assert from 'node:assert/strict'

import { buildProviderCoordinationFieldModels } from '../../adapters/coordinationFieldModels.js'
import { buildDerivedCoordinationRelations } from './deriveCoordinationRelations.js'

function makeVisitorsWidgets() {
  const rows = [
    { region: 'Downtown', month: '2024-01', marketing_spend: 1200, visitors: 100 },
    { region: 'Harbor', month: '2024-01', marketing_spend: 900, visitors: 70 },
  ]
  return [
    {
      id: 'w_bar',
      widgetKind: 'bar',
      provider: 'vega-lite',
      source: {
        providerSpec: {
          provider: 'vega-lite',
          spec: {
            data: { values: rows },
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
      source: {
        providerSpec: {
          provider: 'vega-lite',
          spec: {
            data: { values: rows },
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
      source: {
        providerSpec: {
          provider: 'vega-lite',
          spec: {
            data: { values: rows },
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
  ]
}

test('buildDerivedCoordinationRelations derives canonical state-to-state links from compatible widgets', () => {
  const fieldModels = buildProviderCoordinationFieldModels(makeVisitorsWidgets(), {
    caseId: 'imported_shared_visitors',
  })
  const links = buildDerivedCoordinationRelations(
    { id: 'imported_shared_visitors' },
    fieldModels,
  )

  assert.equal(links.length > 0, true)
  assert.equal(
    links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_bar/selection/region'
      && link.targetStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_scatter/transform/region-filter'
      && link.transform?.kind === 'selectionToFilter'
    )),
    true,
  )
  assert.equal(
    links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_bar/selection/region'
      && link.targetStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_scatter/view/highlight'
      && link.transform?.kind === 'selectionToHighlight'
    )),
    true,
  )
  assert.equal(
    links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_scatter/selection/brush'
      && link.transform?.kind === 'intervalToFilter'
      && link.transform?.channelMapping?.some((mapping) => (
        mapping.sourceChannel === 'x'
        && mapping.targetField === 'marketing_spend'
      ))
    )),
    true,
  )
  assert.equal(
    links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_scatter/view/zoom'
      && link.targetStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_line/view/zoom'
      && link.transform?.kind === 'domainToDomain'
    )),
    true,
  )
  assert.equal(
    links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_scatter/view/zoom'
      && link.targetStateRef === 'wl://widgetva-app/workspace/imported_shared_visitors/widget/w_bar/view/reencode'
      && link.transform?.kind === 'domainToReencode'
    )),
    false,
  )
})

test('buildDerivedCoordinationRelations stays inside canonical relation shape', () => {
  const fieldModels = buildProviderCoordinationFieldModels(makeVisitorsWidgets(), {
    caseId: 'imported_shared_visitors',
  })
  const links = buildDerivedCoordinationRelations(
    { id: 'imported_shared_visitors' },
    fieldModels,
  )

  assert.equal(links.every((link) => typeof link.sourceStateRef === 'string'), true)
  assert.equal(links.every((link) => typeof link.targetStateRef === 'string'), true)
  assert.equal(links.every((link) => link.relation === 'controls'), true)
  assert.equal(links.every((link) => link.activation === 'automatic'), true)
})

test('buildProviderCoordinationFieldModels extracts provider-neutral field models before relation derivation', () => {
  const fieldModels = buildProviderCoordinationFieldModels(makeVisitorsWidgets(), {
    caseId: 'imported_shared_visitors',
  })

  assert.equal(fieldModels.length, 3)
  assert.equal(fieldModels.some((model) => (
    model.widget?.id === 'w_scatter'
    && model.widgetKind === 'scatter'
    && model.xField === 'marketing_spend'
    && model.yField === 'visitors'
    && model.availableFields.has('region')
  )), true)
  assert.equal(fieldModels.some((model) => (
    model.widget?.id === 'w_bar'
    && model.widgetKind === 'bar'
    && model.categoryField === 'region'
  )), true)
})

test('buildDerivedCoordinationRelations derives heatmap selection links from stable state refs', () => {
  const links = buildDerivedCoordinationRelations(
    { id: 'workspace_heatmap_links' },
    [
      {
        widget: { id: 'w_heatmap' },
        widgetKind: 'heatmap',
        availableFields: new Set(['region', 'month', 'visitors']),
        xField: 'month',
        yField: 'region',
        reencodeTargets: [{ channel: 'color' }],
      },
      {
        widget: { id: 'w_scatter' },
        widgetKind: 'scatter',
        availableFields: new Set(['region', 'month', 'visitors', 'marketing_spend']),
        xField: 'marketing_spend',
        yField: 'visitors',
        reencodeTargets: [{ channel: 'color' }],
      },
    ],
  )

  assert.equal(
    links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/workspace_heatmap_links/widget/w_heatmap/selection/cell'
      && link.targetStateRef === 'wl://widgetva-app/workspace/workspace_heatmap_links/widget/w_scatter/transform/month-region-filter'
      && link.transform?.kind === 'selectionToFilter'
      && link.transform?.fieldMapping?.length === 2
    )),
    true,
  )
  assert.equal(
    links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/workspace_heatmap_links/widget/w_heatmap/selection/submatrix'
      && link.targetStateRef === 'wl://widgetva-app/workspace/workspace_heatmap_links/widget/w_scatter/view/reencode'
      && link.transform?.kind === 'selectionToReencode'
    )),
    true,
  )
})

test('buildDerivedCoordinationRelations derives multivariate source links for parallel coordinates', () => {
  const links = buildDerivedCoordinationRelations(
    { id: 'workspace_parallel_links' },
    [
      {
        widget: { id: 'w_parallel' },
        widgetKind: 'parallelCoordinates',
        availableFields: new Set(['region', 'visitors', 'marketing_spend', 'conversion_rate']),
        reencodeTargets: [{ channel: 'opacity' }],
      },
      {
        widget: { id: 'w_bar' },
        widgetKind: 'bar',
        availableFields: new Set(['region', 'visitors']),
        categoryField: 'region',
        reencodeTargets: [{ channel: 'color' }],
      },
      {
        widget: { id: 'w_scatter' },
        widgetKind: 'scatter',
        availableFields: new Set(['region', 'visitors', 'marketing_spend']),
        xField: 'marketing_spend',
        yField: 'visitors',
        reencodeTargets: [{ channel: 'color' }],
      },
    ],
  )

  assert.equal(
    links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/workspace_parallel_links/widget/w_parallel/selection/axes'
      && link.targetStateRef === 'wl://widgetva-app/workspace/workspace_parallel_links/widget/w_scatter/transform/region-visitors-marketing_spend-filter'
      && link.transform?.kind === 'selectionToFilter'
      && link.transform?.fieldMapping?.length === 3
    )),
    true,
  )
  assert.equal(
    links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/workspace_parallel_links/widget/w_parallel/selection/axes'
      && link.targetStateRef === 'wl://widgetva-app/workspace/workspace_parallel_links/widget/w_bar/view/reencode'
      && link.transform?.kind === 'selectionToReencode'
    )),
    true,
  )
})

test('buildDerivedCoordinationRelations derives non-destructive brush reencode/highlight links', () => {
  const links = buildDerivedCoordinationRelations(
    { id: 'workspace_brush_reencode_links' },
    [
      {
        widget: { id: 'w_scatter' },
        widgetKind: 'scatter',
        availableFields: new Set(['marketing_spend', 'visitors', 'region']),
        xField: 'marketing_spend',
        yField: 'visitors',
        reencodeTargets: [{ channel: 'color' }],
      },
      {
        widget: { id: 'w_heatmap' },
        widgetKind: 'heatmap',
        availableFields: new Set(['marketing_spend', 'visitors', 'region']),
        xField: 'marketing_spend',
        yField: 'visitors',
        reencodeTargets: [{ channel: 'opacity' }],
      },
    ],
  )

  assert.equal(
    links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/workspace_brush_reencode_links/widget/w_scatter/selection/brush'
      && link.targetStateRef === 'wl://widgetva-app/workspace/workspace_brush_reencode_links/widget/w_heatmap/view/highlight'
      && link.transform?.kind === 'selectionToHighlight'
    )),
    true,
  )
  assert.equal(
    links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/workspace_brush_reencode_links/widget/w_scatter/selection/brush'
      && link.targetStateRef === 'wl://widgetva-app/workspace/workspace_brush_reencode_links/widget/w_heatmap/view/reencode'
      && link.transform?.kind === 'selectionToReencode'
      && link.transform?.reencode?.channel === 'opacity'
    )),
    true,
  )
  assert.equal(
    links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/workspace_brush_reencode_links/widget/w_scatter/selection/brush'
      && link.transform?.kind === 'selectionToFilter'
    )),
    false,
  )
})

test('buildDerivedCoordinationRelations keeps relation refs unique for selections that share fields', () => {
  const links = buildDerivedCoordinationRelations(
    { id: 'workspace_unique_selection_refs' },
    [
      {
        widget: { id: 'w_heatmap' },
        widgetKind: 'heatmap',
        availableFields: new Set(['month', 'region', 'visitors']),
        xField: 'month',
        yField: 'region',
        reencodeTargets: [{ channel: 'opacity' }],
      },
      {
        widget: { id: 'w_scatter' },
        widgetKind: 'scatter',
        availableFields: new Set(['month', 'region', 'visitors']),
        xField: 'month',
        yField: 'visitors',
        reencodeTargets: [{ channel: 'color' }],
      },
    ],
  )
  const refs = links.map((link) => link.ref)

  assert.equal(new Set(refs).size, refs.length)
  assert.equal(
    links.some((link) => (
      link.ref === 'wl://widgetva-app/workspace/workspace_unique_selection_refs/coordination/w_heatmap-cell-month-region-selection-to-w_scatter-month-region-highlight'
      && link.sourceStateRef === 'wl://widgetva-app/workspace/workspace_unique_selection_refs/widget/w_heatmap/selection/cell'
    )),
    true,
  )
  assert.equal(
    links.some((link) => (
      link.ref === 'wl://widgetva-app/workspace/workspace_unique_selection_refs/coordination/w_heatmap-submatrix-month-region-selection-to-w_scatter-month-region-highlight'
      && link.sourceStateRef === 'wl://widgetva-app/workspace/workspace_unique_selection_refs/widget/w_heatmap/selection/submatrix'
    )),
    true,
  )
})

test('buildDerivedCoordinationRelations derives sankey selection links from flow and node refs', () => {
  const links = buildDerivedCoordinationRelations(
    { id: 'workspace_sankey_links' },
    [
      {
        widget: { id: 'w_sankey' },
        widgetKind: 'sankey',
        availableFields: new Set(['region', 'aggregateName', 'month']),
        reencodeTargets: [{ channel: 'stroke' }],
      },
      {
        widget: { id: 'w_line' },
        widgetKind: 'line',
        availableFields: new Set(['region', 'month', 'visitors']),
        xField: 'month',
        yField: 'visitors',
        seriesField: 'region',
        reencodeTargets: [{ channel: 'color' }],
      },
      {
        widget: { id: 'w_scatter' },
        widgetKind: 'scatter',
        availableFields: new Set(['region', 'marketing_spend', 'visitors']),
        xField: 'marketing_spend',
        yField: 'visitors',
        reencodeTargets: [{ channel: 'color' }],
      },
    ],
  )

  assert.equal(
    links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/workspace_sankey_links/widget/w_sankey/selection/flow'
      && link.targetStateRef === 'wl://widgetva-app/workspace/workspace_sankey_links/widget/w_line/transform/region-month-filter'
      && link.transform?.kind === 'selectionToFilter'
      && link.transform?.fieldMapping?.length === 2
    )),
    true,
  )
  assert.equal(
    links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/workspace_sankey_links/widget/w_sankey/selection/node'
      && link.targetStateRef === 'wl://widgetva-app/workspace/workspace_sankey_links/widget/w_scatter/view/reencode'
      && link.transform?.kind === 'selectionToReencode'
      && link.transform?.reencode?.channel === 'color'
      && link.transform?.fieldMapping?.some((mapping) => mapping.sourceField === 'region')
    )),
    true,
  )
})

test('buildDerivedCoordinationRelations uses target-preferred channels for reencode links', () => {
  const links = buildDerivedCoordinationRelations(
    { id: 'workspace_reencode_channel_links' },
    [
      {
        widget: { id: 'w_parallel' },
        widgetKind: 'parallelCoordinates',
        availableFields: new Set(['region', 'visitors']),
        reencodeTargets: [{ channel: 'opacity' }],
      },
      {
        widget: { id: 'w_sankey' },
        widgetKind: 'sankey',
        availableFields: new Set(['region', 'visitors']),
        reencodeTargets: [{ channel: 'stroke' }],
      },
    ],
  )

  assert.equal(
    links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/workspace_reencode_channel_links/widget/w_parallel/selection/axes'
      && link.targetStateRef === 'wl://widgetva-app/workspace/workspace_reencode_channel_links/widget/w_sankey/view/reencode'
      && link.transform?.kind === 'selectionToReencode'
      && link.transform?.reencode?.channel === 'stroke'
    )),
    true,
  )
})

test('buildDerivedCoordinationRelations derives bar sort to target reencode links from view/sort', () => {
  const links = buildDerivedCoordinationRelations(
    { id: 'workspace_sort_reencode_links' },
    [
      {
        widget: { id: 'w_bar' },
        widgetKind: 'bar',
        availableFields: new Set(['region', 'visitors']),
        categoryField: 'region',
        reencodeTargets: [{ channel: 'color' }],
      },
      {
        widget: { id: 'w_heatmap' },
        widgetKind: 'heatmap',
        availableFields: new Set(['region', 'month', 'visitors']),
        xField: 'month',
        yField: 'region',
        reencodeTargets: [{ channel: 'opacity' }],
      },
    ],
  )

  assert.equal(
    links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/workspace_sort_reencode_links/widget/w_bar/view/sort'
      && link.targetStateRef === 'wl://widgetva-app/workspace/workspace_sort_reencode_links/widget/w_heatmap/view/reencode'
      && link.transform?.kind === 'reencodeToReencode'
      && link.transform?.reencode?.mode === 'alignSortOrder'
      && link.transform?.fieldMapping?.some((mapping) => (
        mapping.sourceField === 'region'
        && mapping.targetField === 'region'
      ))
    )),
    true,
  )
})

test('buildDerivedCoordinationRelations derives sankey structure grouping to bar reencode links from view/addRemove', () => {
  const links = buildDerivedCoordinationRelations(
    { id: 'workspace_structure_reencode_links' },
    [
      {
        widget: { id: 'w_sankey' },
        widgetKind: 'sankey',
        availableFields: new Set(['region', 'aggregateName', 'flow']),
        reencodeTargets: [{ channel: 'stroke' }],
      },
      {
        widget: { id: 'w_bar' },
        widgetKind: 'bar',
        availableFields: new Set(['region', 'visitors']),
        categoryField: 'region',
        reencodeTargets: [{ channel: 'color' }],
      },
    ],
  )

  assert.equal(
    links.some((link) => (
      link.sourceStateRef === 'wl://widgetva-app/workspace/workspace_structure_reencode_links/widget/w_sankey/view/addRemove'
      && link.targetStateRef === 'wl://widgetva-app/workspace/workspace_structure_reencode_links/widget/w_bar/view/reencode'
      && link.transform?.kind === 'reencodeToReencode'
      && link.transform?.reencode?.mode === 'projectGrouping'
      && link.transform?.fieldMapping?.some((mapping) => (
        mapping.sourceField === 'region'
        && mapping.targetField === 'region'
      ))
    )),
    true,
  )
})
