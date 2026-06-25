# D3 Demo

This folder contains a concrete D3 webpage example that runs a real packaged benchmark.

Current demo:

- `82_line_vm_02/`
  - reads the packaged benchmark JSON
  - reads the packaged row dataset
  - renders a D3 line chart
  - applies the benchmark capability steps on the chart

- `22_scatter_vs_01/`
  - reads the packaged benchmark JSON
  - reads the packaged row dataset
  - renders a D3 scatter chart through the reference wrapper
  - applies the benchmark zoom capability on the chart

Run locally from the repo root:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/visagentbench_v2/materializations/d3/demo/82_line_vm_02/
```

or:

```text
http://localhost:8000/visagentbench_v2/materializations/d3/demo/22_scatter_vs_01/
```
