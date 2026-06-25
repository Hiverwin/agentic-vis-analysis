# D3 Materialization

This directory packages the D3-side benchmark contract for `visagentbench_v2`.

Current status:

- widget-family contract: ready
- benchmark-to-D3 materialization summary: ready
- packaged dataset loading: ready
- evaluator: intentionally not included

Files:

- `benchmarkD3Materializer.js`
  - reads a packaged benchmark JSON
  - reads the packaged row dataset
  - maps `required_capabilities` to D3-facing canonical bindings
  - selects the matching runtime adapter class for the benchmark widget kind

- `reference/lineChartWrapper.js`
  - minimal real D3 wrapper for a benchmark line chart
  - accepts `renderFromState(widgetState)` and imperative domain/focus/highlight hooks

- `reference/scatterChartWrapper.js`
  - minimal real D3 wrapper for a benchmark scatter chart
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
  - `renderFromState(widgetState)`
- recommended fallback:
  - `applyAction(name, params)`
- optional optimized hooks:
  - `setBrush(selection)`
  - `setDomain(xDomain, yDomain)`
  - `changeEncoding(channel, field, options)`
  - `clearSelection(options)`
  - `onBrush(handler)`
  - `onCategoryClick(handler)`
  - `onCellClick(handler)`

Minimal usage:

```js
import {
  readBenchmarkFile,
  readPackagedDataset,
  createD3RuntimeAdapter,
  describeD3BenchmarkMaterialization,
} from './benchmarkD3Materializer.js'

const benchmark = readBenchmarkFile('visagentbench_v2/benchmarks/main/.../82_line_vm_02_type1a_type2.json')
const summary = describeD3BenchmarkMaterialization({ benchmark })
const rows = readPackagedDataset({ benchmark, packageRoot: 'visagentbench_v2' })

const adapter = createD3RuntimeAdapter({
  widgetKind: benchmark.widget_kind,
  widgetRef: 'widget/main',
  dataRef: 'data/current',
  chart: myD3Chart,
})
```
