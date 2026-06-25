# ECharts Materialization

This directory packages the ECharts-side benchmark contract for `visagentbench_v2`.

Current status:

- widget-family contract: ready
- benchmark-to-ECharts materialization summary: ready
- packaged dataset loading: ready
- reference wrapper: line chart ready
- evaluator: intentionally not included

Files:

- `benchmarkEChartsMaterializer.js`
  - reads a packaged benchmark JSON
  - reads the packaged row dataset
  - maps `required_capabilities` to ECharts-facing canonical bindings
  - selects the matching runtime adapter class for the benchmark widget kind

- `reference/lineChartWrapper.js`
  - minimal real ECharts wrapper for a benchmark line chart
  - accepts `renderFromState(widgetState)` and imperative focus/highlight/domain hooks

- `reference/scatterChartWrapper.js`
  - minimal real ECharts wrapper for a benchmark scatter chart
  - accepts `renderFromState(widgetState)` and imperative brush/domain/highlight hooks

Supported widget kinds:

- `scatter`
- `bar`
- `heatmap`
- `line`
- `parallelCoordinates`
- `sankey`

Expected host chart contract:

- required:
  - `getState()`
  - `setOption(option, options?)`
- recommended:
  - `dispatchAction(action)`
- optional optimized hooks:
  - `setBrush(selection)`
  - `setDomain(xDomain, yDomain)`
  - `setFocus(focus)`
  - `setHighlights(keys)`
