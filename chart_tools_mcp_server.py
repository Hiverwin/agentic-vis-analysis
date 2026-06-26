"""
chart tools MCP Server
wraps all visualization tools, called by Claude、GPT、Qwen etc.

usage:
    1. install dependencies: pip install mcp numpy scipy scikit-learn
    2. run server: python chart_tools_mcp_server.py
    3. or use npm tool: npx @modelcontextprotocol/inspector python chart_tools_mcp_server.py
"""

from typing import Dict, List, Any, Tuple, Optional, Union
from mcp.server.fastmcp import FastMCP


# ============================================================
# initialize MCP Server
# ============================================================
mcp = FastMCP("chart_tools_mcp_server")


# ==================== perception APIs ====================
@mcp.tool()
def get_data(vega_spec: Dict, scope: str = 'all') -> Dict[str, Any]:
    """Return raw data. scope: all | filter | visible | selected"""
    from tools import common
    return common.get_data(vega_spec, scope=scope)


@mcp.tool()
def get_data_summary(vega_spec: Dict, scope: str = 'all') -> Dict[str, Any]:
    """Return data statistical summary. scope: visible or all"""
    from tools import common
    return common.get_data_summary(vega_spec, scope=scope)


@mcp.tool()
def get_tooltip_data(vega_spec: Dict, position: Tuple[float, float]) -> Dict[str, Any]:
    """Get tooltip data at specified [x, y] position"""
    from tools import common
    return common.get_tooltip_data(vega_spec, position=position)




# ==================== bar chart tools ====================

@mcp.tool()
def sort_bars(vega_spec: Dict, order: str = "descending", by_subcategory: Optional[str] = None) -> Dict[str, Any]:
    """Sort bars. Stacked: use by_subcategory to sort x by that subcategory's value, or omit to sort stack layers by value. Grouped/simple: sort x by total."""
    from tools import bar_chart_tools
    return bar_chart_tools.sort_bars(vega_spec, order=order, by_subcategory=by_subcategory)

@mcp.tool()
def filter_categories(vega_spec: Dict, categories: List[str]) -> Dict[str, Any]:
    """Filter to specific categories"""
    from tools import bar_chart_tools
    return bar_chart_tools.filter_categories(vega_spec, categories=categories)


@mcp.tool()
def highlight_top_n(vega_spec: Dict, n: int = 5, order: str = "descending") -> Dict[str, Any]:
    """Highlight top N bars by aggregated value (supports stacked/grouped charts)"""
    from tools import bar_chart_tools
    return bar_chart_tools.highlight_top_n(vega_spec, n=n, order=order)


@mcp.tool()
def expand_stack(vega_spec: Dict, category: str) -> Dict[str, Any]:
    """Expand stacked bars in a category to parallel bars chart"""
    from tools import bar_chart_tools
    return bar_chart_tools.expand_stack(vega_spec, category=category)


@mcp.tool()
def toggle_stack_mode(vega_spec: Dict, mode: str = "grouped") -> Dict[str, Any]:
    """Toggle stacked/grouped display mode. mode: grouped or stacked"""
    from tools import bar_chart_tools
    return bar_chart_tools.toggle_stack_mode(vega_spec, mode=mode)


@mcp.tool()
def add_bars(vega_spec: Dict, values: List[Any], x_field: Optional[str] = None) -> Dict[str, Any]:
    """Add whole bars (x categories). Works for stacked or grouped bars."""
    from tools import bar_chart_tools
    return bar_chart_tools.add_bars(vega_spec, values=values, x_field=x_field)


@mcp.tool()
def remove_bars(vega_spec: Dict, values: List[Any], x_field: Optional[str] = None) -> Dict[str, Any]:
    """Remove whole bars (x categories) by hiding them via transform filter"""
    from tools import bar_chart_tools
    return bar_chart_tools.remove_bars(vega_spec, values=values, x_field=x_field)


@mcp.tool()
def change_encoding(vega_spec: Dict, channel: str, field: str) -> Dict[str, Any]:
    """Modify encoding channel field mapping. Supports bar/line/heatmap/scatter Vega-Lite charts."""
    from tools import common
    return common.change_encoding(vega_spec, channel=channel, field=field)


# ==================== 折线图专用工具 (Line Chart Tools) ====================
@mcp.tool()
def zoom_time_range(vega_spec: Dict, start: str, end: str) -> Dict[str, Any]:
    """Zoom view to specific time range (does not delete data)"""
    from tools import line_chart_tools
    return line_chart_tools.zoom_time_range(vega_spec, start=start, end=end)


@mcp.tool()
def highlight_trend(vega_spec: Dict, trend_type: str = "increasing") -> Dict[str, Any]:
    """Add regression trend line. trend_type: increasing or decreasing"""
    from tools import line_chart_tools
    return line_chart_tools.highlight_trend(vega_spec, trend_type=trend_type)



@mcp.tool()
def detect_anomalies(vega_spec: Dict, threshold: float = 2.0) -> Dict[str, Any]:
    """Detect and highlight anomalies in the view (threshold in standard deviations)"""
    from tools import line_chart_tools
    return line_chart_tools.detect_anomalies(vega_spec, threshold=threshold)


@mcp.tool()
def bold_lines(vega_spec: Dict, line_names: List[str], line_field: str = None) -> Dict[str, Any]:
    """Bold specified lines"""
    from tools import line_chart_tools
    return line_chart_tools.bold_lines(vega_spec, line_names=line_names, line_field=line_field)


@mcp.tool()
def filter_lines(vega_spec: Dict, lines_to_remove: List[str], line_field: str = None) -> Dict[str, Any]:
    """Filter out specified lines"""
    from tools import line_chart_tools
    return line_chart_tools.filter_lines(
        vega_spec, lines_to_remove=lines_to_remove, line_field=line_field
    )


@mcp.tool()
def show_moving_average(vega_spec: Dict, window_size: int = 3) -> Dict[str, Any]:
    """Add moving average line"""
    from tools import line_chart_tools
    return line_chart_tools.show_moving_average(vega_spec, window_size=window_size)


@mcp.tool()
def focus_lines(
    vega_spec: Dict,
    lines: List[str],
    line_field: Optional[str] = None,
    mode: str = "dim",
    dim_opacity: float = 0.08,
) -> Dict[str, Any]:
    """Focus on few lines, dim or hide others"""
    from tools import line_chart_tools
    return line_chart_tools.focus_lines(
        vega_spec, lines=lines, line_field=line_field, mode=mode, dim_opacity=dim_opacity
    )


@mcp.tool()
def resample_time(
    vega_spec: Dict,
    granularity: str,
    agg: str = "mean",
) -> Dict[str, Any]:
    """Resample time series to different granularity (day/week/month/quarter/year)"""
    from tools import line_chart_tools
    return line_chart_tools.resample_time(vega_spec, granularity=granularity, agg=agg)


@mcp.tool()
def reset_resample(vega_spec: Dict) -> Dict[str, Any]:
    """Reset time resampling to original granularity"""
    from tools import line_chart_tools
    return line_chart_tools.reset_resample(vega_spec)


# change_encoding is defined once above (bar section), delegates to common.change_encoding


# ==================== Scatter Plot Tools ====================
@mcp.tool()
def select_region(vega_spec: Dict, x_range: Tuple[float, float], y_range: Tuple[float, float]) -> Dict[str, Any]:
    """Select points in a specific region"""
    from tools import scatter_plot_tools
    return scatter_plot_tools.select_region(vega_spec, x_range=x_range, y_range=y_range)


@mcp.tool()
def identify_clusters(vega_spec: Dict, n_clusters: int = 3, method: str = "kmeans") -> Dict[str, Any]:
    """Identify data clusters"""
    from tools import scatter_plot_tools
    return scatter_plot_tools.identify_clusters(vega_spec, n_clusters=n_clusters, method=method)


@mcp.tool()
def calculate_correlation(vega_spec: Dict, method: str = "pearson") -> Dict[str, Any]:
    """Calculate correlation coefficient"""
    from tools import scatter_plot_tools
    return scatter_plot_tools.calculate_correlation(vega_spec, method=method)


@mcp.tool()
def zoom_dense_area(vega_spec: Dict, x_range: Tuple[float, float], y_range: Tuple[float, float]) -> Dict[str, Any]:
    """Zoom to a rectangular region by filtering data and adjusting axis scales"""
    from tools import scatter_plot_tools
    return scatter_plot_tools.zoom_dense_area(vega_spec, x_range=x_range, y_range=y_range)


@mcp.tool()
def filter_categorical(vega_spec: Dict, categories_to_remove: List[str], field: str = None) -> Dict[str, Any]:
    """Filter out data points of specified categories"""
    from tools import scatter_plot_tools
    return scatter_plot_tools.filter_categorical(
        vega_spec, categories_to_remove=categories_to_remove, field=field
    )


@mcp.tool()
def brush_region(vega_spec: Dict, x_range: Tuple[float, float], y_range: Tuple[float, float]) -> Dict[str, Any]:
    """Brush select a region, points outside become fainter"""
    from tools import scatter_plot_tools
    return scatter_plot_tools.brush_region(vega_spec, x_range=x_range, y_range=y_range)


@mcp.tool()
def show_regression(vega_spec: Dict, method: str = "linear") -> Dict[str, Any]:
    """Add regression line (linear, log, exp, poly, quad)"""
    from tools import scatter_plot_tools
    return scatter_plot_tools.show_regression(vega_spec, method=method)


# ==================== Heatmap Tools ====================
@mcp.tool()
def adjust_color_scale(vega_spec: Dict, scheme: str = "viridis", domain: List = None) -> Dict[str, Any]:
    """Adjust color scale (scheme and optional domain)"""
    from tools import heatmap_tools
    return heatmap_tools.adjust_color_scale(vega_spec, scheme=scheme, domain=domain)


@mcp.tool()
def filter_cells(
    vega_spec: Dict,
    min_value: Optional[float] = None,
    max_value: Optional[float] = None,
) -> Dict[str, Any]:
    """Filter heatmap cells by value (min_value and/or max_value)"""
    from tools import heatmap_tools
    return heatmap_tools.filter_cells(vega_spec, min_value=min_value, max_value=max_value)


@mcp.tool()
def highlight_region(
    vega_spec: Dict,
    x_values: Optional[List] = None,
    y_values: Optional[List] = None,
) -> Dict[str, Any]:
    """Highlight region by x_values and/or y_values"""
    from tools import heatmap_tools
    return heatmap_tools.highlight_region(vega_spec, x_values=x_values, y_values=y_values)


@mcp.tool()
def highlight_region_by_value(
    vega_spec: Dict,
    min_value: Optional[float] = None,
    max_value: Optional[float] = None,
    outside_opacity: float = 0.12,
) -> Dict[str, Any]:
    """Highlight cells by value range (visual-only, dims outside range)"""
    from tools import heatmap_tools
    return heatmap_tools.highlight_region_by_value(
        vega_spec, min_value=min_value, max_value=max_value, outside_opacity=outside_opacity
    )


@mcp.tool()
def filter_cells_by_region(
    vega_spec: Dict,
    x_value: Any = None,
    y_value: Any = None,
    x_values: Optional[List[Any]] = None,
    y_values: Optional[List[Any]] = None,
) -> Dict[str, Any]:
    """Filter out heatmap cells by x/y coordinates"""
    from tools import heatmap_tools
    return heatmap_tools.filter_cells_by_region(
        vega_spec, x_value=x_value, y_value=y_value, x_values=x_values, y_values=y_values
    )


@mcp.tool()
def cluster_rows_cols(vega_spec: Dict, cluster_rows: bool = True,
                     cluster_cols: bool = True, method: str = "sum") -> Dict[str, Any]:
    """Reorder heatmap rows/cols by aggregate (sum/mean/max) of color field"""
    from tools import heatmap_tools
    return heatmap_tools.cluster_rows_cols(
        vega_spec, cluster_rows=cluster_rows, cluster_cols=cluster_cols, method=method
    )


@mcp.tool()
def select_submatrix(vega_spec: Dict, x_values: List = None,
                    y_values: List = None) -> Dict[str, Any]:
    """Select submatrix by x_values and/or y_values"""
    from tools import heatmap_tools
    return heatmap_tools.select_submatrix(vega_spec, x_values=x_values, y_values=y_values)


@mcp.tool()
def find_extremes(vega_spec: Dict, top_n: int = 5, mode: str = "both") -> Dict[str, Any]:
    """Mark extreme points (mode: max/min/both)"""
    from tools import heatmap_tools
    return heatmap_tools.find_extremes(vega_spec, top_n=top_n, mode=mode)


@mcp.tool()
def threshold_mask(
    vega_spec: Dict,
    min_value: float,
    max_value: float,
    outside_opacity: float = 0.1,
) -> Dict[str, Any]:
    """Mask cells outside value range (visual-only, dims outside)"""
    from tools import heatmap_tools
    return heatmap_tools.threshold_mask(
        vega_spec, min_value=min_value, max_value=max_value, outside_opacity=outside_opacity
    )


@mcp.tool()
def drilldown_time(
    vega_spec: Dict,
    level: str,
    value: Union[int, str],
    parent: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Time heatmap drilldown: year -> month -> date"""
    from tools import heatmap_tools
    return heatmap_tools.drilldown_time(vega_spec, level=level, value=value, parent=parent)


@mcp.tool()
def reset_drilldown(vega_spec: Dict) -> Dict[str, Any]:
    """Reset time heatmap drilldown to original state"""
    from tools import heatmap_tools
    return heatmap_tools.reset_drilldown(vega_spec)


@mcp.tool()
def add_marginal_bars(
    vega_spec: Dict,
    op: str = "mean",
    show_top: bool = True,
    show_right: bool = True,
    bar_size: int = 70,
    bar_color: str = "#666666",
) -> Dict[str, Any]:
    """Add marginal bar charts (row/col aggregation) to heatmap"""
    from tools import heatmap_tools
    return heatmap_tools.add_marginal_bars(
        vega_spec, op=op, show_top=show_top, show_right=show_right,
        bar_size=bar_size, bar_color=bar_color
    )


@mcp.tool()
def transpose(vega_spec: Dict) -> Dict[str, Any]:
    """Transpose heatmap: swap x and y axes"""
    from tools import heatmap_tools
    return heatmap_tools.transpose(vega_spec)


# ==================== Sankey Tools ====================
@mcp.tool()
def filter_flow(vega_spec: Dict, min_value: float) -> Dict[str, Any]:
    """Filter flow: only show connections with value >= min_value"""
    from tools import sankey_tools
    return sankey_tools.filter_flow(vega_spec, min_value=min_value)


@mcp.tool()
def highlight_path(vega_spec: Dict, path: List[str]) -> Dict[str, Any]:
    """Highlight multi-step path. path: node list e.g. [\"A\", \"B\", \"C\"]"""
    from tools import sankey_tools
    return sankey_tools.highlight_path(vega_spec, path=path)


@mcp.tool()
def calculate_conversion_rate(vega_spec: Dict, node_name: Optional[str] = None) -> Dict[str, Any]:
    """Calculate conversion rate: analyze inflow, outflow, conversion rate per node"""
    from tools import sankey_tools
    return sankey_tools.calculate_conversion_rate(vega_spec, node_name=node_name)


@mcp.tool()
def trace_node(vega_spec: Dict, node_name: str) -> Dict[str, Any]:
    """Trace node: highlight all connections connected to the node"""
    from tools import sankey_tools
    return sankey_tools.trace_node(vega_spec, node_name=node_name)


@mcp.tool()
def collapse_nodes(vega_spec: Dict, nodes_to_collapse: List[str],
                   aggregate_name: str = "Other") -> Dict[str, Any]:
    """Collapse multiple nodes into a single aggregate node"""
    from tools import sankey_tools
    return sankey_tools.collapse_nodes(
        vega_spec,
        nodes_to_collapse=nodes_to_collapse,
        aggregate_name=aggregate_name
    )


@mcp.tool()
def expand_node(vega_spec: Dict, aggregate_name: str) -> Dict[str, Any]:
    """Expand aggregate node: restore collapsed original nodes"""
    from tools import sankey_tools
    return sankey_tools.expand_node(vega_spec, aggregate_name=aggregate_name)


@mcp.tool()
def auto_collapse_by_rank(vega_spec: Dict, top_n: int = 5) -> Dict[str, Any]:
    """Auto collapse: keep top N nodes per layer, collapse others to Others (Layer X)"""
    from tools import sankey_tools
    return sankey_tools.auto_collapse_by_rank(vega_spec, top_n=top_n)


@mcp.tool()
def color_flows(vega_spec: Dict, nodes: List[str], color: str = "#e74c3c") -> Dict[str, Any]:
    """Color flows connected to specified nodes"""
    from tools import sankey_tools
    return sankey_tools.color_flows(vega_spec, nodes=nodes, color=color)


@mcp.tool()
def find_bottleneck(vega_spec: Dict, top_n: int = 3) -> Dict[str, Any]:
    """Identify nodes with the most severe loss"""
    from tools import sankey_tools
    return sankey_tools.find_bottleneck(vega_spec, top_n=top_n)


@mcp.tool()
def reorder_nodes_in_layer(
    vega_spec: Dict,
    depth: int,
    order: Optional[List[str]] = None,
    sort_by: Optional[str] = None,
) -> Dict[str, Any]:
    """Reorder nodes in a layer. Provide order (list) or sort_by (value_desc|value_asc|name)"""
    from tools import sankey_tools
    return sankey_tools.reorder_nodes_in_layer(
        vega_spec, depth=depth, order=order, sort_by=sort_by
    )


# ==================== 平行坐标图专用工具 (parallel_coordinates_tools) ====================
@mcp.tool()
def filter_dimension(vega_spec: Dict, dimension: str, range: List[float]) -> Dict[str, Any]:
    """Filter by dimension range"""
    from tools import parallel_coordinates_tools
    return parallel_coordinates_tools.filter_dimension(vega_spec, dimension=dimension, range=range)


@mcp.tool()
def reorder_dimensions(vega_spec: Dict, dimension_order: List[str]) -> Dict[str, Any]:
    """Reorder dimensions (supports fold-based and pre-normalized long format)"""
    from tools import parallel_coordinates_tools
    return parallel_coordinates_tools.reorder_dimensions(vega_spec, dimension_order=dimension_order)


@mcp.tool()
def filter_by_category(vega_spec: Dict, field: str, values: Union[str, List[str]]) -> Dict[str, Any]:
    """Filter by category (before fold, wide format)"""
    from tools import parallel_coordinates_tools
    return parallel_coordinates_tools.filter_by_category(vega_spec, field=field, values=values)


@mcp.tool()
def highlight_category(vega_spec: Dict, field: str, values: Union[str, List[str]]) -> Dict[str, Any]:
    """Highlight specified category, dim others"""
    from tools import parallel_coordinates_tools
    return parallel_coordinates_tools.highlight_category(vega_spec, field=field, values=values)


@mcp.tool()
def hide_dimensions(
    vega_spec: Dict,
    dimensions: List[str],
    mode: str = "hide",
) -> Dict[str, Any]:
    """Hide/show dimensions in parallel coordinates (mode: hide|show)"""
    from tools import parallel_coordinates_tools
    return parallel_coordinates_tools.hide_dimensions(
        vega_spec, dimensions=dimensions, mode=mode
    )


@mcp.tool()
def reset_hidden_dimensions(vega_spec: Dict) -> Dict[str, Any]:
    """Reset all hidden dimensions to visible"""
    from tools import parallel_coordinates_tools
    return parallel_coordinates_tools.reset_hidden_dimensions(vega_spec)


# ============================================================
# ============================================================
# run server
# ============================================================

if __name__ == "__main__":
    print(" Starting Chart Tools MCP Server...")
    mcp.run()
