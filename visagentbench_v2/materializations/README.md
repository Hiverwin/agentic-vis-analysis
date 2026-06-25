# Materializations

`materializations/` documents how the same benchmark contract is instantiated in different visualization environments.

Current packaging policy:

- `vega`: packaged-ready through `benchmark.materializations.vega.spec_path`
- `d3`: packaged contract-ready through `materializations/d3/benchmarkD3Materializer.js` plus reference line/scatter wrappers
- `echarts`: packaged contract-ready through `materializations/echarts/benchmarkEChartsMaterializer.js` plus reference line/scatter wrappers
- `custom`: contract-ready through the same canonical benchmark contract

Runtime expectation:

1. Load the benchmark JSON.
2. Load `data_source.dataset_path`.
3. Instantiate a widget of `widget_kind`.
4. Bind renderer-specific actions/perceptions to the semantic capabilities required by the benchmark.
5. Run the benchmark through your agent/runtime stack.
