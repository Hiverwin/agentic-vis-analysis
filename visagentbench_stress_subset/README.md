# VisAgentBench Stress Subset

This directory contains benchmark files moved out of the main `visagentbench/` corpus because their backing datasets have `>= 20000` rows.

Purpose:

- keep the main benchmark corpus closer to a typical VIS task-evaluation regime
- preserve large datasets for scalability / stress / renderer-stability experiments
- avoid mixing agentic VA evaluation with heavy renderer-performance noise

Move rule used:

- if a benchmark's `vega_spec_path` resolves to a dataset with `row_count >= 20000`
- move that benchmark file from `visagentbench/` into `visagentbench_stress_subset/`
- preserve its original relative path under the new root

Current contents:

- moved benchmark files: `116`
- task types:
  - `clear_single`: `36`
  - `clear_multi`: `36`
  - `vague_single`: `20`
  - `vague_multi`: `24`

Backing datasets represented here:

- `24_vitamin_deficiency_disease_dataset_20260123_parallel (3).json` (`20000` rows, `20` benchmarks)
- `53_Housing_scatter.json` (`21613` rows, `12` benchmarks)
- `35_bmw_parallel.json` (`43124` rows, `8` benchmarks)
- `58_Train_parallel.json` (`54995` rows, `20` benchmarks)
- `114_sport_life_parallel.json` (`36354` rows, `20` benchmarks)
- `54_Ecommerce_Delivery_Analytics_New_bar.json` (`100000` rows, `12` benchmarks)
- `55_Ecommerce_Delivery_Analytics_New_scatter.json` (`100000` rows, `20` benchmarks)
- `56_Ecommerce_Delivery_Analytics_New_heatmap.json` (`100000` rows, `4` benchmarks)

Recommended usage:

- use `visagentbench/` as the default benchmark corpus
- use `visagentbench_stress_subset/` only for dedicated scalability or stress-track experiments
