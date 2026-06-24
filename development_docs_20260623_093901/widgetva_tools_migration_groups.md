# WidgetVA Tools Migration Groups

This document groups the existing Python `tools/` functions by how they should migrate into `widgetva-kit`.

The key principle is:

- Migrate **semantic capability**, not Python source code.
- Rebuild capabilities as **frontend runtime / adapter behavior** inside `widgetva-kit`.
- Treat the old `tools/` package as a **semantic reference layer**, not the long-term implementation.

## Target Layers

### `widgetva-kit/core`
Use for capabilities that are widget-agnostic or broadly reusable across widget families:

- generic action primitives
- generic perception queries
- generic data-query helpers
- generic state / selection / trace behavior

### `widgetva-kit/adapters`
Use for capabilities that are specific to a widget family or provider:

- scatter-specific action semantics
- bar-specific interaction logic
- heatmap-specific region operations
- widget-family-specific perception

### `widgetva-kit/core` with frontend rewrite
Use for capabilities that are conceptually valid but currently depend on Python scientific libraries:

- correlation
- clustering
- anomaly detection
- moving averages
- other derived analytics

These should be reimplemented in JS, worker, or optional compute modules.

### Do not migrate as primary architecture
These belong to the old backend tool framework and should not be preserved as the main runtime model:

- `tool_registry.py`
- `tool_executor.py`
- `vlm_adapter.py`
- `tool_output`
- `state_manager`-dependent wrapper logic

## Group 1: Generic Perception / Data Query

These are strong candidates for `widgetva-kit/core`.

Source: [tools/common.py](/Users/chenyutong/Desktop/agentic-visual-reframe/tools/common.py:1)

- `get_view_spec`
  - Kit target: generic perception query for view/state inspection
- `get_data`
  - Kit target: generic data query with scopes like `all/filter/visible/selected`
- `get_data_summary`
  - Kit target: generic summarize/data-query capability
- `get_tooltip_data`
  - Kit target: optional perception query; possibly provider-dependent if true tooltip hit-testing is needed

Notes:

- These are already very close to the paper's perception layer.
- They should not stay as backend tool functions long-term.

## Group 2: Generic View / Workspace Actions

These belong mostly in `widgetva-kit/core`, with state application delegated to adapters.

Source: [tools/common.py](/Users/chenyutong/Desktop/agentic-visual-reframe/tools/common.py:1)

- `change_encoding`
  - Kit target: generic action like `widget.changeEncoding`
- `reset_view`
  - Kit target: generic reset action; may map to `workspace.resetWorkspace` or widget-level reset
- `undo_view`
  - Kit target: state-history / branch / undo support in core
- `render_chart`
  - Kit target: not a user-facing action; this is runtime/provider behavior and should be absorbed into adapter/rendering logic, not exposed as an agent tool

## Group 3: Scatter-Specific Actions

These belong in `widgetva-kit/adapters/widgets/scatter`.

Source: [tools/scatter_plot_tools.py](/Users/chenyutong/Desktop/agentic-visual-reframe/tools/scatter_plot_tools.py:1)

- `zoom_2d_region`
  - Kit target: already aligns with `scatter.zoomDomain`
- `filter_categorical`
  - Kit target: generic `widget.filterByValues` or scatter-specific filter helper
- `select_region`
  - Kit target: scatter selection action
- `brush_region`
  - Kit target: already aligns with `scatter.brushRegion`
- `change_encoding`
  - Kit target: generic `widget.changeEncoding`

## Group 4: Scatter Analytical Perception / Compute

These should migrate as frontend compute/perception, not plain actions.

Source: [tools/scatter_plot_tools.py](/Users/chenyutong/Desktop/agentic-visual-reframe/tools/scatter_plot_tools.py:1)

- `calculate_correlation`
  - Kit target: scatter compute/perception query
  - Migration type: frontend rewrite
- `identify_clusters`
  - Kit target: scatter compute/perception query or optional analytic action
  - Migration type: frontend rewrite
  - Status: migrated as `scatter.identifyClusters` in `widgetva-kit/src/widgets/scatter/actions.js`
- `show_regression`
  - Kit target: either analytic augmentation action or derived overlay helper
  - Migration type: frontend rewrite
  - Status: migrated as `scatter.showRegression` in `widgetva-kit/src/widgets/scatter/actions.js`

Notes:

- These depend on `numpy`, `sklearn`, or `scipy` semantics today.
- The capability is valid; the Python implementation is not directly reusable.

## Group 5: Bar-Specific Actions

These belong in `widgetva-kit/adapters/widgets/bar`.

Source: [tools/bar_chart_tools.py](/Users/chenyutong/Desktop/agentic-visual-reframe/tools/bar_chart_tools.py:1)

- `sort_bars`
  - Kit target: bar-specific explicit category ordering action
  - Status: migrated as `bar.sortBars` in `widgetva-kit/src/widgets/bar/actions.js`
- `filter_categories`
  - Kit target: generic filter or bar-specific category filter
  - Status: migrated as `bar.filterCategories` in `widgetva-kit/src/widgets/bar/actions.js`
- `filter_subcategories`
  - Kit target: bar-specific grouped/stacked filtering
  - Status: migrated as `bar.filterSubcategories` in `widgetva-kit/src/widgets/bar/actions.js`
- `highlight_top_n`
  - Kit target: bar-specific highlight/analytic augmentation
  - Status: migrated as `bar.highlightTopN` in `widgetva-kit/src/widgets/bar/actions.js`
- `expand_stack`
  - Kit target: bar-specific action; useful and distinctive
  - Status: migrated as `bar.expandStack` in `widgetva-kit/src/widgets/bar/actions.js`
- `toggle_stack_mode`
  - Kit target: bar-specific view transformation
  - Status: migrated as `bar.toggleStackMode` in `widgetva-kit/src/widgets/bar/actions.js`
- `add_bars`
  - Kit target: bar-specific structural view operation
  - Status: migrated as `bar.addBars` in `widgetva-kit/src/widgets/bar/actions.js`
- `remove_bars`
  - Kit target: bar-specific structural view operation
  - Status: migrated as `bar.removeBars` in `widgetva-kit/src/widgets/bar/actions.js`
- `add_bar_items`
  - Kit target: bar-specific structural action on grouped/stacked members
  - Status: migrated as `bar.addBarItems` in `widgetva-kit/src/widgets/bar/actions.js`
- `remove_bar_items`
  - Kit target: bar-specific structural action on grouped/stacked members
  - Status: migrated as `bar.removeBarItems` in `widgetva-kit/src/widgets/bar/actions.js`
- `change_encoding`
  - Kit target: generic `widget.changeEncoding`

## Group 6: Heatmap-Specific Actions

These belong in `widgetva-kit/adapters/widgets/heatmap`.

Source: [tools/heatmap_tools.py](/Users/chenyutong/Desktop/agentic-visual-reframe/tools/heatmap_tools.py:1)

- `adjust_color_scale`
  - Kit target: heatmap view transform / encoding action
  - Status: migrated as `heatmap.adjustColorScale` in `widgetva-kit/src/widgets/heatmap/actions.js`
- `filter_cells`
  - Kit target: already close to `heatmap.filterCells`
- `highlight_region`
  - Kit target: heatmap region highlight action
  - Status: migrated as `heatmap.highlightRegion` in `widgetva-kit/src/widgets/heatmap/actions.js`
- `highlight_region_by_value`
  - Kit target: heatmap value-conditioned highlight action
  - Status: migrated as `heatmap.highlightRegionByValue` in `widgetva-kit/src/widgets/heatmap/actions.js`
- `filter_cells_by_region`
  - Kit target: heatmap region filter action
  - Status: migrated as `heatmap.filterCellsByRegion` in `widgetva-kit/src/widgets/heatmap/actions.js`
- `select_submatrix`
  - Kit target: heatmap submatrix selection action
  - Status: migrated as `heatmap.selectSubmatrix` in `widgetva-kit/src/widgets/heatmap/actions.js`
- `threshold_mask`
  - Kit target: heatmap threshold filter/mask action
  - Status: migrated as `heatmap.thresholdMask` in `widgetva-kit/src/widgets/heatmap/actions.js`
- `drilldown_axis`
  - Kit target: heatmap hierarchical axis action
  - Status: migrated as `heatmap.drilldownAxis` in `widgetva-kit/src/widgets/heatmap/actions.js`
- `reset_drilldown`
  - Kit target: paired reset action
  - Status: migrated as `heatmap.resetDrilldown` in `widgetva-kit/src/widgets/heatmap/actions.js`
- `add_marginal_bars`
  - Kit target: heatmap analytic augmentation / structural action
  - Status: migrated as `heatmap.addMarginalBars` in `widgetva-kit/src/widgets/heatmap/actions.js`
- `transpose`
  - Kit target: heatmap structural view transform
  - Status: migrated as `heatmap.transpose` in `widgetva-kit/src/widgets/heatmap/actions.js`
- `change_encoding`
  - Kit target: generic `widget.changeEncoding`

## Group 7: Heatmap Analytical Compute

These are valid kit capabilities, but need frontend-side compute implementations.

Source: [tools/heatmap_tools.py](/Users/chenyutong/Desktop/agentic-visual-reframe/tools/heatmap_tools.py:1)

- `cluster_rows_cols`
  - Kit target: heatmap analytic compute / augmentation
  - Migration type: frontend rewrite
  - Status: migrated as `heatmap.clusterRowsCols` in `widgetva-kit/src/widgets/heatmap/actions.js`
- `find_extremes`
  - Kit target: heatmap compute/perception query
  - Migration type: frontend rewrite

## Group 8: Line-Specific Actions

These belong in `widgetva-kit/adapters/widgets/line`.

Source: [tools/line_chart_tools.py](/Users/chenyutong/Desktop/agentic-visual-reframe/tools/line_chart_tools.py:1)

- `zoom_x_region`
  - Kit target: line zoom action
  - Status: migrated as `line.zoomXRegion` in `widgetva-kit/src/widgets/line/actions.js`
- `highlight_trend`
  - Kit target: line highlight/analytic augmentation action
  - Status: migrated as `line.highlightTrend` in `widgetva-kit/src/widgets/line/actions.js`
- `bold_lines`
  - Kit target: line emphasis action
  - Status: migrated as `line.boldLines` in `widgetva-kit/src/widgets/line/actions.js`
- `filter_lines`
  - Kit target: line filter action
  - Status: migrated as `line.filterLines` in `widgetva-kit/src/widgets/line/actions.js`
- `focus_lines`
  - Kit target: line focus action
  - Status: migrated as `line.focusLines` in `widgetva-kit/src/widgets/line/actions.js`
- `drill_down_x_axis`
  - Kit target: line structural/detail action
  - Status: migrated as `line.drillDownXAxis` in `widgetva-kit/src/widgets/line/actions.js`
- `reset_drilldown_x_axis`
  - Kit target: paired reset action
  - Status: migrated as `line.resetDrilldownXAxis` in `widgetva-kit/src/widgets/line/actions.js`
- `resample_x_axis`
  - Kit target: line transform/view action
  - Status: migrated as `line.resampleXAxis` in `widgetva-kit/src/widgets/line/actions.js`
- `reset_resample_x_axis`
  - Kit target: paired reset action
  - Status: migrated as `line.resetResampleXAxis` in `widgetva-kit/src/widgets/line/actions.js`
- `change_encoding`
  - Kit target: generic `widget.changeEncoding`

## Group 9: Line Analytical Compute

These should migrate as compute/perception features, not backend-only tools.

Source: [tools/line_chart_tools.py](/Users/chenyutong/Desktop/agentic-visual-reframe/tools/line_chart_tools.py:1)

- `detect_anomalies`
  - Kit target: line compute/perception
  - Migration type: frontend rewrite
  - Status: migrated as `perception.detectAnomalies` in `widgetva-kit/src/widgets/line/perception.js`
- `show_moving_average`
  - Kit target: analytic augmentation action
  - Migration type: frontend rewrite
  - Status: migrated as `line.showMovingAverage` in `widgetva-kit/src/widgets/line/actions.js`

## Group 10: Parallel Coordinates Actions

These belong in `widgetva-kit/adapters/widgets/parallelCoordinates`.

Source: [tools/parallel_coordinates_tools.py](/Users/chenyutong/Desktop/agentic-visual-reframe/tools/parallel_coordinates_tools.py:1)

- `reorder_dimensions`
  - Kit target: structural axis-order action
  - Status: migrated as `parallelCoordinates.reorderDimensions` in `widgetva-kit/src/widgets/parallelCoordinates/actions.js`
- `filter_dimension`
  - Kit target: parallel-coordinates range filter action
  - Status: migrated as `parallelCoordinates.filterDimension` in `widgetva-kit/src/widgets/parallelCoordinates/actions.js`
- `filter_by_category`
  - Kit target: category filter action
  - Status: migrated as `parallelCoordinates.filterByCategory` in `widgetva-kit/src/widgets/parallelCoordinates/actions.js`
- `highlight_category`
  - Kit target: highlight action
  - Status: migrated as `parallelCoordinates.highlightCategory` in `widgetva-kit/src/widgets/parallelCoordinates/actions.js`
- `hide_dimensions`
  - Kit target: dimension visibility action
  - Status: migrated as `parallelCoordinates.hideDimensions` in `widgetva-kit/src/widgets/parallelCoordinates/actions.js`
- `reset_hidden_dimensions`
  - Kit target: paired reset action
  - Status: migrated as `parallelCoordinates.resetHiddenDimensions` in `widgetva-kit/src/widgets/parallelCoordinates/actions.js`

## Group 11: Sankey Actions

These belong in `widgetva-kit/adapters/widgets/sankey`.

Source: [tools/sankey_tools.py](/Users/chenyutong/Desktop/agentic-visual-reframe/tools/sankey_tools.py:1)

- `filter_flow`
  - Kit target: sankey filter action
  - Status: migrated as `sankey.filterFlow` in `widgetva-kit/src/widgets/sankey/actions.js`
- `collapse_nodes`
  - Kit target: sankey structural action
  - Status: migrated as `sankey.collapseNodes` in `widgetva-kit/src/widgets/sankey/actions.js`
- `expand_node`
  - Kit target: sankey structural action
  - Status: migrated as `sankey.expandNode` in `widgetva-kit/src/widgets/sankey/actions.js`
- `auto_collapse_by_rank`
  - Kit target: sankey structural/analytic action
  - Status: migrated as `sankey.autoCollapseByRank` in `widgetva-kit/src/widgets/sankey/actions.js`
- `reorder_nodes_in_layer`
  - Kit target: sankey layout action
  - Status: migrated as `sankey.reorderNodesInLayer` in `widgetva-kit/src/widgets/sankey/actions.js`
- `highlight_path`
  - Kit target: sankey highlight action
  - Status: migrated as `sankey.highlightPath` in `widgetva-kit/src/widgets/sankey/actions.js`
- `trace_node`
  - Kit target: sankey focused exploration action or perception
  - Status: migrated as `sankey.traceNode` in `widgetva-kit/src/widgets/sankey/actions.js`
- `color_flows`
  - Kit target: sankey styling/encoding action
  - Status: migrated as `sankey.colorFlows` in `widgetva-kit/src/widgets/sankey/actions.js`

## Group 12: Sankey Analytical / Perception

These are valid kit capabilities, but should be re-expressed as perception/data-query/compute.

Source: [tools/sankey_tools.py](/Users/chenyutong/Desktop/agentic-visual-reframe/tools/sankey_tools.py:1)

- `get_node_options`
  - Kit target: sankey perception query
  - Status: migrated as `perception.getNodeOptions` in `widgetva-kit/src/widgets/sankey/perception.js`
- `calculate_conversion_rate`
  - Kit target: sankey compute/perception query
  - Status: migrated as `perception.calculateConversionRate` in `widgetva-kit/src/widgets/sankey/perception.js`
- `find_bottleneck`
  - Kit target: sankey compute/perception query
  - Status: migrated as `perception.findBottleneck` in `widgetva-kit/src/widgets/sankey/perception.js`

## Group 13: Custom / Extension Tools

These belong in the future extension/plugin story of `widgetva-kit/adapters`.

Source: [tools/scatter_custom_tools.py](/Users/chenyutong/Desktop/agentic-visual-reframe/tools/scatter_custom_tools.py:1)

- `custom_focus_group`
  - Kit target: custom adapter extension or plugin action

## Group 14: Legacy Backend Tool Framework

These should not be the primary architecture of `widgetva-kit`.

Sources:

- [tools/tool_registry.py](/Users/chenyutong/Desktop/agentic-visual-reframe/tools/tool_registry.py:1)
- [tools/tool_executor.py](/Users/chenyutong/Desktop/agentic-visual-reframe/tools/tool_executor.py:1)
- [tools/vlm_adapter.py](/Users/chenyutong/Desktop/agentic-visual-reframe/tools/vlm_adapter.py:1)
- [tools/registration_api.py](/Users/chenyutong/Desktop/agentic-visual-reframe/tools/registration_api.py:1)

These encode the old design where:

- tools are Python functions
- tools are registered in a backend registry
- tools are executed by a backend executor
- VLM schemas are generated from the backend tool list

For `widgetva-kit`, these should be treated as:

- legacy design reference
- migration reference
- optional interoperability surface later

But not as the core kit runtime architecture.

## Recommended Migration Order

### Phase 1: Highest-value direct migrations

- `common.get_view_spec`
- `common.get_data`
- `common.get_data_summary`
- `common.change_encoding`
- `scatter.brush_region`
- `scatter.zoom_2d_region`
- `bar.sort_bars`
- `heatmap.filter_cells`
- `parallel_coordinates.reorder_dimensions`

### Phase 2: Widget-family interaction richness

- bar structural actions
- heatmap region actions
- line focus/filter/zoom actions
- sankey structural/highlight actions

### Phase 3: Frontend compute rewrites

- correlation
- clustering
- anomalies
- moving average
- bottleneck/conversion/extremes

## Practical Rule

When deciding how to migrate a Python tool, ask:

1. Is this a generic state/read/write capability?
   - Move toward `widgetva-kit/core`

2. Is this specific to one widget family?
   - Move toward `widgetva-kit/adapters/widgets/*`

3. Does it depend on `numpy/pandas/sklearn/scipy`?
   - Keep the semantic capability, but rewrite for frontend compute

4. Is it part of registry/executor plumbing?
   - Do not migrate it as the main kit architecture
