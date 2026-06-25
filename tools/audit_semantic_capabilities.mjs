import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import path from 'node:path'

import {
  getSemanticCapability,
  resolveSemanticCapabilityBindings,
} from '../widgetva-kit/src/capabilities.js'

const LEGACY_OPERATION_TO_SEMANTIC_ID = {
  add_bar_items: 'data.subcategory.add',
  add_bars: 'data.category.add',
  add_marginal_bars: 'heatmap.marginals.add',
  adjust_color_scale: 'heatmap.colorScale.adjust',
  bold_lines: 'line.series.focus',
  brush_region: 'selection.region.set',
  calculate_correlation: 'analysis.correlation.compute',
  change_encoding: 'view.encoding.change',
  cluster_rows_cols: 'analysis.clusters.identify',
  custom_focus_group: 'data.highlight.values',
  detect_anomalies: 'analysis.anomalies.detect',
  drill_down_x_axis: 'axis.x.drilldown',
  drilldown_axis: 'heatmap.axis.drilldown',
  expand_stack: 'view.stack.expand',
  filter_by_category: 'data.filter.categorical',
  filter_categorical: 'data.filter.categorical',
  filter_categories: 'data.filter.categorical',
  filter_cells: 'heatmap.cells.filter',
  filter_cells_by_region: 'heatmap.cells.filter',
  filter_dimension: 'data.filter.range',
  filter_lines: 'line.series.filter',
  filter_subcategories: 'data.filter.subcategory',
  find_extremes: 'analysis.extremes.find',
  focus_lines: 'line.series.focus',
  get_node_options: 'sankey.node.options',
  hide_dimensions: 'parallel.dimensions.hide',
  highlight_category: 'data.highlight.values',
  highlight_region: 'heatmap.region.highlight',
  highlight_region_by_value: 'heatmap.region.highlight',
  highlight_top_n: 'ranking.topN.highlight',
  highlight_trend: 'line.trend.highlight',
  identify_clusters: 'analysis.clusters.identify',
  remove_bar_items: 'data.subcategory.remove',
  remove_bars: 'data.category.remove',
  reorder_dimensions: 'view.sort.encoding',
  resample_x_axis: 'axis.x.resample',
  reset_drilldown: 'heatmap.axis.drilldown',
  reset_drilldown_x_axis: 'axis.x.drilldown.reset',
  reset_hidden_dimensions: 'parallel.dimensions.hide',
  reset_resample_x_axis: 'axis.x.resample.reset',
  select_region: 'selection.region.set',
  select_submatrix: 'selection.region.set',
  show_moving_average: 'line.movingAverage.show',
  show_regression: 'analysis.regression.show',
  threshold_mask: 'heatmap.threshold.mask',
  toggle_stack_mode: 'view.stackMode.set',
  transpose: 'heatmap.transpose',
  zoom_2d_region: 'view.domain.zoom',
  zoom_x_region: 'view.domain.zoom',
}

function collectLegacyOperations() {
  const operations = new Set()
  for (const file of globSync('tools/*_tools.py', { cwd: process.cwd() })) {
    const text = readFileSync(path.join(process.cwd(), file), 'utf8')
    const matches = text.matchAll(/['"]operation['"]:\s*['"]([^'"]+)['"]/g)
    for (const match of matches) {
      operations.add(match[1])
    }
  }
  return [...operations].sort()
}

function collectFrontendOperationNames() {
  const names = new Set()
  for (const file of globSync('widgetva-kit/src/**/*.js', { cwd: process.cwd() })) {
    const text = readFileSync(path.join(process.cwd(), file), 'utf8')
    const matches = text.matchAll(/name:\s*'([^']+)'/g)
    for (const match of matches) {
      if (match[1].includes('.')) names.add(match[1])
    }
  }
  return names
}

const legacyOperations = collectLegacyOperations()
const frontendNames = collectFrontendOperationNames()

const report = legacyOperations.map((operation) => {
  const semanticId = LEGACY_OPERATION_TO_SEMANTIC_ID[operation] || null
  const capability = semanticId ? getSemanticCapability(semanticId) : null
  const bindings = capability ? resolveSemanticCapabilityBindings({ semanticId }) : []
  const missingBindings = bindings
    .map((binding) => binding.name)
    .filter((name) => !frontendNames.has(name))

  return {
    operation,
    semanticId,
    semanticCapabilityFound: Boolean(capability),
    bindingNames: bindings.map((binding) => binding.name),
    allBindingsPresentInFrontend: missingBindings.length === 0 && bindings.length > 0,
    missingBindings,
  }
})

const missingSemanticMappings = report.filter((entry) => !entry.semanticCapabilityFound)
const frontendCoverageGaps = report.filter((entry) => entry.semanticCapabilityFound && !entry.allBindingsPresentInFrontend)

console.log(JSON.stringify({
  totals: {
    legacyOperationCount: legacyOperations.length,
    mappedOperationCount: report.length - missingSemanticMappings.length,
    fullyBoundOperationCount: report.length - missingSemanticMappings.length - frontendCoverageGaps.length,
  },
  missingSemanticMappings,
  frontendCoverageGaps,
}, null, 2))
