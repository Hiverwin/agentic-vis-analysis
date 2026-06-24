import test from 'node:test'
import assert from 'node:assert/strict'

import { WORKSPACE_CASES } from '../presets/workspaceCases.js'
import { buildWorkspaceCaseForProviderEnvironment } from './workspaceProviderEnvironment.js'
import { buildRuntimeWorkspaceSpec } from './runtimeWorkspaceAdapter.js'

test('buildRuntimeWorkspaceSpec normalizes first-party widget specs and canonical link semantics', () => {
  const caseDef = WORKSPACE_CASES[0]
  const spec = buildRuntimeWorkspaceSpec(caseDef)

  assert.equal(spec.topology, 'T2')
  assert.equal(Array.isArray(spec.widgets), true)
  assert.equal(spec.widgets.length, 6)
  assert.equal(spec.widgets.every((widget) => typeof widget.kind === 'string' && widget.kind.length > 0), true)
  assert.equal(spec.widgets.every((widget) => typeof widget.provider === 'string' && widget.provider.length > 0), true)
  assert.equal(spec.widgets.every((widget) => widget.source?.kind === 'templateSpec'), true)
  assert.equal(spec.widgets.every((widget) => widget.source?.provider === widget.provider), true)
  assert.equal(spec.widgets.every((widget) => typeof widget.source?.providerSpec === 'object' && widget.source.providerSpec != null), true)
  assert.equal(spec.widgets.every((widget) => typeof widget.source?.interactionConfig === 'object' && widget.source.interactionConfig != null), true)
  assert.equal(spec.widgets.every((widget) => typeof widget.source?.providerCapabilities === 'object' && widget.source.providerCapabilities != null), true)
  const scatterWidget = spec.widgets.find((widget) => widget.widgetId === 'w_scatter_cars')
  assert.equal(scatterWidget?.source?.renderModel?.widgetKind, 'scatter')
  assert.equal(scatterWidget?.source?.providerSpec?.provider, 'vega-lite')
  assert.equal(scatterWidget?.source?.providerCapabilities?.zoom, true)
  const barWidget = spec.widgets.find((widget) => widget.widgetId === 'w_bar_origin')
  assert.equal(barWidget?.provider, 'echarts')
  assert.equal(barWidget?.source?.providerSpec?.provider, 'echarts')
  assert.equal(barWidget?.source?.providerSpec?.optionType, 'bar')
  const lineWidget = spec.widgets.find((widget) => widget.widgetId === 'w_line_year')
  assert.equal(lineWidget?.source?.providerSpec?.provider, 'vega-lite')
  assert.equal(lineWidget?.source?.providerSpec?.specType, 'line')
  const heatmapWidget = spec.widgets.find((widget) => widget.widgetId === 'w_heatmap_origin_cyl')
  assert.equal(heatmapWidget?.source?.providerSpec?.provider, 'vega-lite')
  assert.equal(heatmapWidget?.source?.providerSpec?.specType, 'heatmap')
  const parallelWidget = spec.widgets.find((widget) => widget.widgetId === 'w_parallel_cars')
  assert.equal(parallelWidget?.source?.providerSpec?.provider, 'd3')
  assert.equal(parallelWidget?.source?.providerSpec?.sceneType, 'parallelCoordinates')
  const sankeyWidget = spec.widgets.find((widget) => widget.widgetId === 'w_sankey_cars')
  assert.equal(sankeyWidget?.source?.providerSpec?.provider, 'd3')
  assert.equal(sankeyWidget?.source?.providerSpec?.sceneType, 'sankey')
  assert.equal(Array.isArray(spec.links), true)
  assert.equal(spec.links.length > 0, true)
  assert.equal(spec.links.every((link) => typeof link.sourceWidgetId === 'string'), true)
  assert.equal(spec.links.every((link) => typeof link.targetWidgetId === 'string'), true)
  assert.equal(spec.links.every((link) => link.activationPolicy === 'automatic'), true)
  assert.equal(spec.links.every((link) => link.effectConstraint == null), true)
  const reencodeLink = spec.links.find((link) => link.sourceWidgetId === 'w_line_year' && link.targetWidgetId === 'w_heatmap_origin_cyl' && link.primitive === 'reencode')
  assert.equal(reencodeLink?.effect, 'transformView')
  assert.equal(reencodeLink?.responseSpec?.kind, 'reencode')
  assert.equal(reencodeLink?.responseSpec?.params?.variant, 'transpose')
  const reorderLink = spec.links.find((link) => link.sourceWidgetId === 'w_heatmap_origin_cyl' && link.targetWidgetId === 'w_sankey_cars' && link.primitive === 'reencode')
  assert.equal(reorderLink?.effect, 'transformView')
  assert.equal(reorderLink?.responseSpec?.kind, 'reencode')
  assert.equal(reorderLink?.responseSpec?.params?.variant, 'reorderLayer')
  const drillDownLink = spec.links.find((link) => link.sourceWidgetId === 'w_bar_origin' && link.targetWidgetId === 'w_line_year' && link.primitive === 'drillDown')
  assert.equal(drillDownLink?.effect, 'transformView')
  assert.equal(drillDownLink?.responseSpec?.kind, 'drillDown')
  assert.equal(drillDownLink?.responseSpec?.params?.variant, 'recordsByModel')
  const domainLink = spec.links.find((link) => link.sourceWidgetId === 'w_scatter_cars' && link.targetWidgetId === 'w_line_year' && link.primitive === 'syncDomain')
  assert.equal(domainLink?.effect, 'syncDomain')
  const structureLink = spec.links.find((link) => link.sourceWidgetId === 'w_line_year' && link.targetWidgetId === 'w_sankey_cars' && link.primitive === 'structure')
  assert.equal(structureLink?.effect, 'transformStructure')
  assert.equal(structureLink?.responseSpec?.kind, 'collapse')
  assert.equal(structureLink?.responseSpec?.params?.variant, 'collapseNodes')
  assert.deepEqual(structureLink?.responseSpec?.params?.nodes, ['origin:Japan', 'origin:Europe'])
  const expandLink = spec.links.find((link) => link.sourceWidgetId === 'w_scatter_cars' && link.targetWidgetId === 'w_sankey_cars' && link.primitive === 'structure' && link.responseSpec?.kind === 'expand')
  assert.equal(expandLink?.effect, 'transformStructure')
  assert.equal(expandLink?.responseSpec?.params?.variant, 'expandNode')
  assert.equal(expandLink?.responseSpec?.params?.aggregateName, 'collapsed:0:other')
  const aggregateLink = spec.links.find((link) => link.sourceWidgetId === 'w_bar_origin' && link.targetWidgetId === 'w_sankey_cars' && link.primitive === 'aggregate')
  assert.equal(aggregateLink?.effect, 'transformDataView')
  assert.equal(aggregateLink?.responseSpec?.kind, 'aggregate')
  assert.equal(aggregateLink?.responseSpec?.params?.variant, 'autoCollapseByRank')
})

test('buildRuntimeWorkspaceSpec preserves one shared widget contract while rematerializing the workspace under a single provider environment', () => {
  const baseCase = WORKSPACE_CASES[0]
  const providerEnvironments = ['vega-lite', 'echarts', 'd3']

  for (const providerEnvironment of providerEnvironments) {
    const caseDef = buildWorkspaceCaseForProviderEnvironment(baseCase, providerEnvironment)
    const spec = buildRuntimeWorkspaceSpec(caseDef)

    assert.equal(spec.widgets.length, 6)
    assert.equal(spec.widgets.every((widget) => widget.provider === providerEnvironment), true)
    assert.equal(spec.widgets.every((widget) => widget.source?.provider === providerEnvironment), true)
    assert.equal(spec.widgets.every((widget) => widget.source?.providerSpec?.provider === providerEnvironment), true)
    assert.equal(spec.widgets.every((widget) => widget.kind && typeof widget.kind === 'string'), true)

    const expectedTypeSuffix = providerEnvironment === 'vega-lite' ? '-vega' : `-${providerEnvironment}`
    assert.equal(
      caseDef.widgets.every((widget) => typeof widget.type === 'string' && widget.type.endsWith(expectedTypeSuffix)),
      true,
    )

    const lineWidget = spec.widgets.find((widget) => widget.widgetId === 'w_line_year')
    const heatmapWidget = spec.widgets.find((widget) => widget.widgetId === 'w_heatmap_origin_cyl')
    const parallelWidget = spec.widgets.find((widget) => widget.widgetId === 'w_parallel_cars')
    const sankeyWidget = spec.widgets.find((widget) => widget.widgetId === 'w_sankey_cars')
    if (providerEnvironment === 'echarts') {
      assert.equal(lineWidget?.source?.providerSpec?.optionType, 'line')
      assert.equal(heatmapWidget?.source?.providerSpec?.optionType, 'heatmap')
      assert.equal(parallelWidget?.source?.providerSpec?.optionType, 'parallelCoordinates')
      assert.equal(sankeyWidget?.source?.providerSpec?.optionType, 'sankey')
    }
    if (providerEnvironment === 'd3') {
      assert.equal(lineWidget?.source?.providerSpec?.sceneType, 'line')
      assert.equal(heatmapWidget?.source?.providerSpec?.sceneType, 'heatmap')
      assert.equal(parallelWidget?.source?.providerSpec?.sceneType, 'parallelCoordinates')
      assert.equal(sankeyWidget?.source?.providerSpec?.sceneType, 'sankey')
    }
    if (providerEnvironment === 'vega-lite') {
      assert.equal(parallelWidget?.source?.providerSpec?.specType, 'parallelCoordinates')
      assert.equal(sankeyWidget?.source?.providerSpec?.specType, 'sankey')
    }
  }
})
