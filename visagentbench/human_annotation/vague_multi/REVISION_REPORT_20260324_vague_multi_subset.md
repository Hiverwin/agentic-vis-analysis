# Vague Multi Subset Revision Report (2026-03-24)

## Scope

Revised a targeted subset of `vague_multi` tasks from the latest batch to improve interaction dependency, subjective quality, and evidence grounding.

- Batch reference: `benchmark/results/batch/20260324_195750`
- Revision language: English only (question, answer, key_insights, reasoning)
- Files revised: 7

## What Was Strengthened

- Enforced subjective phrasing that requires interpretation, not template summarization.
- Added explicit evidence-anchor expectations (named fields/nodes, trend direction, ranking/gap dynamics, before-vs-after contrast).
- Tightened answer references to tool-visible structure (especially post-filter/post-zoom states).
- Increased tool necessity in weak tasks (notably dual-method correlation in scatter task).

## Revised Files

- `benchmark_annotation_system/synthetic_task/type1a/vague_multi/104_line_vm_01_type1a.json`
- `benchmark_annotation_system/synthetic_task/type1a/vague_multi/106_line_vm_01_type1a.json`
- `benchmark_annotation_system/synthetic_task/type1a/vague_multi/107_line_vm_01_type1a.json`
- `benchmark_annotation_system/synthetic_task/type1a/vague_multi/108_sankey_vm_01_type1a.json`
- `benchmark_annotation_system/synthetic_task/type1a/vague_multi/109_sankey_vm_01_type1a.json`
- `benchmark_annotation_system/synthetic_task/type1a/vague_multi/100_sankey_vm_01_type1a.json`
- `benchmark_annotation_system/synthetic_task/type1a/vague_multi/10_scatter_vm_01_type1a.json`

## Summary Table

| Task File | Main Problem Before | Revision Focus | Tool Dependency Change |
|---|---|---|---|
| `104_line_vm_01_type1a.json` | Generic trend language, limited visible anchors | Added explicit country-level evidence anchors and local reversal/stability framing | Kept `filter_lines + zoom_x_region`, made evidence use explicit |
| `106_line_vm_01_type1a.json` | Broad “all rising” style answer | Emphasized ranking persistence, spacing/catch-up, phase slope differences | Kept same tools, tightened post-zoom interpretation requirements |
| `107_line_vm_01_type1a.json` | Weakly grounded comparative claims | Required rank/gap/catch-up assessment with named-line anchors | Kept same tools, increased interaction-grounded interpretation |
| `108_sankey_vm_01_type1a.json` | Role claim not tightly tied to visible edges | Added before-vs-after edge pruning and trunk retention logic | Kept `filter_flow + trace_node`, strengthened structural evidence requirement |
| `109_sankey_vm_01_type1a.json` | Inconsistent and over-generic node interpretation | Reframed around high-threshold trunk vs. long-tail removal | Kept `filter_flow + trace_node`, required explicit edge-level anchors |
| `100_sankey_vm_01_type1a.json` | Insight valid but not strongly tool-coupled | Bound conclusions to joint evidence from tracing and node conversion analysis | Kept `trace_node + calculate_conversion_rate`, increased analytic rigor |
| `10_scatter_vm_01_type1a.json` | Single-metric correlation interpretation too weak | Added Pearson vs Spearman comparison and robustness interpretation | Added a second `calculate_correlation` call (`spearman`) |

## Notes

- `state_eval` / `state_check_fields` were left unchanged in this pass to preserve existing state-evaluation compatibility.
- This revision targets subjective discriminativeness and tool-grounded answer quality, not schema redesign.
