# Manifests

`manifests/` stores generated package-level indexes and environment contracts.

Current files:

- `benchmark_catalog.json`: partition, widget-kind, and capability coverage summary
- `dataset_index.json`: packaged dataset inventory
- `renderer_profiles.json`: renderer/materialization contract for Vega, D3, ECharts, and custom environments

Generate or refresh:

```bash
python tools/generate_visagentbench_v2_manifests.py
python tools/extract_visagentbench_v2_datasets.py
```
