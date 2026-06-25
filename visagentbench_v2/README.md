# VisAgentBench v2

`visagentbench_v2/` is the packaged benchmark layer for renderer-agnostic visual analytics evaluation.

Design goals:

- keep benchmark semantics independent from any single renderer
- expose a stable public benchmark contract
- package row-oriented datasets for external consumption
- support Vega-backed assets as one ready materialization path
- support mainstream renderer/materialization variants such as `vega`, `d3`, `echarts`, and custom widget environments
- separate `main` benchmark usage from `hinted` and `stress` subsets

Planned layout:

```text
visagentbench_v2/
  README.md
  benchmarks/
  datasets/
  materializations/
  manifests/
  schema/
```

Conventions:

- `benchmarks/`: normalized v2 benchmark JSON files
- `datasets/`: extracted row-oriented datasets referenced by `dataset_id`
- `materializations/`: environment packaging notes and renderer contracts
- `manifests/`: generated indexes and renderer profiles
- `schema/`: public JSON schema definitions for benchmark consumers

Current status:

- `benchmarks/main/` stores the default benchmark partition
- `benchmarks/hinted/` stores tool-hinted benchmark cases whose prompts explicitly reveal implementation-level operation names
- `benchmarks/stress/` stores large-row stress-track cases
- `tools/convert_visagentbench_to_v2.py` refreshes normalized v2 benchmark files
- `tools/extract_visagentbench_v2_datasets.py` packages referenced datasets into `datasets/`
- `tools/generate_visagentbench_v2_manifests.py` refreshes `manifests/`

Supported renderer packaging modes:

- `vega`: packaged-ready
- `d3`: contract-ready
- `echarts`: contract-ready
- `custom`: contract-ready

Suggested refresh flow:

```bash
python tools/convert_visagentbench_to_v2.py --include-stress
python tools/extract_visagentbench_v2_datasets.py
python tools/generate_visagentbench_v2_manifests.py
```
