#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
LEGACY_ROOT = REPO_ROOT / "visagentbench"
STRESS_ROOT = REPO_ROOT / "visagentbench_stress_subset"
V2_ROOT = REPO_ROOT / "visagentbench_v2"
SPEC_ROOT = REPO_ROOT / "benchmark_annotation_system" / "backend" / "specs"
DATA_ROOT = REPO_ROOT / "benchmark_annotation_system" / "backend" / "data"
DATASET_OUTPUT_ROOT = V2_ROOT / "datasets"


CANONICAL_TOOL_NAME_MAP = {
    "brush_region": "scatter.brushRegion",
    "filter_categorical": "filter.categorical.exclude",
    "filter_categories": "filter.categorical.include",
    "toggle_stack_mode": "view.stackMode.set",
    "find_extremes": "perception.findExtremes",
}

SEMANTIC_CAPABILITY_MAP = {
    "auto_collapse_by_rank": "sankey.node.collapse",
    "add_bar_items": "data.subcategory.add",
    "add_bars": "data.category.add",
    "add_marginal_bars": "heatmap.marginals.add",
    "adjust_color_scale": "heatmap.colorScale.adjust",
    "bold_lines": "line.series.focus",
    "brush_region": "selection.region.set",
    "calculate_conversion_rate": "sankey.conversionRate.calculate",
    "calculate_correlation": "analysis.correlation.compute",
    "change_encoding": "view.encoding.change",
    "cluster_rows_cols": "analysis.clusters.identify",
    "collapse_nodes": "sankey.node.collapse",
    "color_flows": "sankey.path.highlight",
    "custom_focus_group": "data.highlight.values",
    "detect_anomalies": "analysis.anomalies.detect",
    "drill_down_x_axis": "axis.x.drilldown",
    "drilldown_axis": "heatmap.axis.drilldown",
    "expand_node": "sankey.node.collapse",
    "expand_stack": "view.stack.expand",
    "filter_by_category": "data.filter.categorical",
    "filter_categorical": "data.filter.categorical",
    "filter_categories": "data.filter.categorical",
    "filter_cells": "heatmap.cells.filter",
    "filter_cells_by_region": "heatmap.cells.filter",
    "filter_flow": "sankey.flow.filter",
    "filter_dimension": "data.filter.range",
    "filter_lines": "line.series.filter",
    "filter_subcategories": "data.filter.subcategory",
    "find_bottleneck": "sankey.bottleneck.find",
    "find_extreme": "analysis.extremes.find",
    "find_extremes": "analysis.extremes.find",
    "focus_lines": "line.series.focus",
    "get_data": "data.rows.inspect",
    "get_data_summary": "data.visible.summarize",
    "get_view_spec": "view.inspect",
    "get_node_options": "sankey.node.options",
    "hide_dimensions": "parallel.dimensions.hide",
    "highlight_category": "data.highlight.values",
    "highlight_path": "sankey.path.highlight",
    "highlight_region": "heatmap.region.highlight",
    "highlight_region_by_value": "heatmap.region.highlight",
    "highlight_top_n": "ranking.topN.highlight",
    "highlight_trend": "line.trend.highlight",
    "identify_clusters": "analysis.clusters.identify",
    "inspect_scatter_distribution": "analysis.distribution.inspect",
    "remove_bar_items": "data.subcategory.remove",
    "remove_bars": "data.category.remove",
    "reorder_dimensions": "view.sort.encoding",
    "reorder_nodes_in_layer": "view.sort.encoding",
    "resample_x_axis": "axis.x.resample",
    "reset_drilldown": "heatmap.axis.drilldown",
    "reset_drilldown_x_axis": "axis.x.drilldown.reset",
    "reset_hidden_dimensions": "parallel.dimensions.hide",
    "reset_resample_x_axis": "axis.x.resample.reset",
    "reset_view": "view.reset",
    "select_region": "selection.region.set",
    "select_submatrix": "selection.region.set",
    "show_moving_average": "line.movingAverage.show",
    "show_regression": "analysis.regression.show",
    "sort_bars": "view.sort.encoding",
    "threshold_mask": "heatmap.threshold.mask",
    "trace_node": "sankey.path.highlight",
    "toggle_stack_mode": "view.stackMode.set",
    "transpose": "heatmap.transpose",
    "undo_view": "history.undo",
    "zoom_2d_region": "view.domain.zoom",
    "zoom_dense_area": "view.domain.zoom",
    "zoom_time_range": "view.domain.zoom",
    "zoom_x_region": "view.domain.zoom",
}

TOOL_HINT_PATTERN = re.compile(
    r"\b("
    r"filter_[a-z_]+|toggle_stack_mode|brush_region|calculate_correlation|change_encoding|"
    r"identify_clusters|zoom_[a-z_]+|show_regression|highlight_[a-z_]+|detect_anomalies|"
    r"collapse_nodes|trace_node|filter_flow|get_node_options|find_bottleneck|drilldown_axis|"
    r"select_submatrix|reorder_dimensions|hide_dimensions|focus_lines|bold_lines|"
    r"show_moving_average|resample_x_axis|expand_stack|add_bars|remove_bars|add_bar_items|"
    r"remove_bar_items|cluster_rows_cols|threshold_mask|transpose"
    r")\b"
)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text())


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


def infer_widget_kind(task_id: str, path_name: str) -> str:
    match = re.search(r"(scatter|bar|line|heatmap|sankey|parallel)", task_id or "")
    if not match:
      match = re.search(r"(scatter|bar|line|heatmap|sankey|parallel)", path_name or "")
    if not match:
        return "custom"
    kind = match.group(1)
    return "parallelCoordinates" if kind == "parallel" else kind


def resolve_dataset_rows(spec_path_str: str | None) -> tuple[str | None, int | None]:
    if not spec_path_str:
        return None, None

    spec_path = REPO_ROOT / spec_path_str
    dataset_id = spec_path.stem

    if spec_path.exists():
        try:
            spec = read_json(spec_path)
            data = spec.get("data")
            if isinstance(data, dict) and isinstance(data.get("values"), list):
                return dataset_id, len(data["values"])
        except Exception:
            pass

    data_path = DATA_ROOT / spec_path.name
    if data_path.exists():
        try:
            dataset = read_json(data_path)
            if isinstance(dataset, list):
                return dataset_id, len(dataset)
            if isinstance(dataset, dict):
                if isinstance(dataset.get("values"), list):
                    return dataset_id, len(dataset["values"])
                if isinstance(dataset.get("data"), list):
                    return dataset_id, len(dataset["data"])
        except Exception:
            pass

    return dataset_id, None


def make_scale_tag(row_count: int | None) -> str | None:
    if row_count is None:
        return None
    if row_count < 20:
        return "demo_tiny"
    if row_count < 200:
        return "small"
    if row_count < 2000:
        return "medium"
    if row_count < 5000:
        return "large"
    if row_count < 20000:
        return "xlarge"
    return "stress"


def map_action_name(name: str | None) -> str | None:
    if not name:
        return None
    return CANONICAL_TOOL_NAME_MAP.get(name, name)


def map_semantic_capability(name: str | None) -> str | None:
    if not name:
        return None
    return SEMANTIC_CAPABILITY_MAP.get(name)


def detect_question_style(question_text: str | None) -> str:
    text = question_text or ""
    if TOOL_HINT_PATTERN.search(text):
        return "tool_hinted"
    return "natural_language"


def normalize_state_eval(state_eval: dict[str, Any] | None) -> tuple[dict[str, Any], dict[str, Any]]:
    if not isinstance(state_eval, dict):
        return {}, {}

    canonical: dict[str, Any] = {}
    legacy: dict[str, Any] = {}

    encoding = state_eval.get("encoding")
    if isinstance(encoding, dict):
        canonical["encodings"] = {k: v for k, v in encoding.items() if isinstance(v, str)}

    visible_domain = state_eval.get("visible_domain")
    if isinstance(visible_domain, dict):
        view = {}
        if "x" in visible_domain:
            view["xDomain"] = visible_domain["x"]
        if "y" in visible_domain:
            view["yDomain"] = visible_domain["y"]
        if view:
            canonical["view"] = view

    mark_mode = state_eval.get("mark_mode")
    if isinstance(mark_mode, dict) and "is_stacked" in mark_mode:
        canonical.setdefault("viewMode", {})
        canonical["viewMode"]["stackMode"] = "stacked" if mark_mode["is_stacked"] else "grouped"

    data_filtered = state_eval.get("data_filtered")
    if isinstance(data_filtered, list):
        legacy["data_filtered"] = data_filtered
    elif isinstance(data_filtered, dict):
        legacy["data_filtered"] = data_filtered

    for key, value in state_eval.items():
        if key in {"encoding", "visible_domain", "mark_mode", "data_filtered"}:
            continue
        legacy[key] = value

    return canonical, legacy


def normalize_question(question: dict[str, Any]) -> dict[str, Any]:
    ground_truth = question.get("ground_truth") or {}
    tool_eval = ground_truth.get("tool_eval") or {}
    tool_entries = tool_eval.get("tools") if isinstance(tool_eval, dict) else []

    required_capabilities = []
    capability_param_checks = []
    for entry in tool_entries if isinstance(tool_entries, list) else []:
        tool_name = entry.get("tool")
        semantic_capability = map_semantic_capability(tool_name)
        if semantic_capability:
            required_capabilities.append(semantic_capability)
        param_eval = entry.get("param_eval")
        if semantic_capability and isinstance(param_eval, dict):
            capability_param_checks.append(
                {
                    "capability": semantic_capability,
                    "param_eval": param_eval,
                }
            )

    canonical_state_checks, renderer_state_checks = normalize_state_eval(ground_truth.get("state_eval"))

    reasoning_trace = []
    for step in ground_truth.get("reasoning", []) if isinstance(ground_truth.get("reasoning"), list) else []:
        semantic_capability = map_semantic_capability(step.get("tool"))
        reasoning_trace.append(
            {
                "iteration": step.get("iteration"),
                "capability": semantic_capability,
                "rationale": step.get("reasoning", ""),
            }
        )

    return {
        "qid": question.get("qid"),
        "question": question.get("question", ""),
        "question_style": detect_question_style(question.get("question")),
        "ground_truth": {
            "task_type": ground_truth.get("task_type"),
            "answer": ground_truth.get("answer", {}),
            "key_insights": ground_truth.get("key_insights", []),
            "reasoning_trace": reasoning_trace,
            "required_capabilities": [name for name in required_capabilities if name],
            "required_perceptions": [],
            "capability_param_checks": capability_param_checks,
            "canonical_state_checks": canonical_state_checks,
            "renderer_state_checks": {"vega": renderer_state_checks} if renderer_state_checks else {},
            "state_check_fields": ground_truth.get("state_check_fields", []),
        },
    }


def convert_file(path: Path, source_root: Path) -> dict[str, Any]:
    legacy = read_json(path)
    spec_path = legacy.get("vega_spec_path")
    dataset_id, row_count = resolve_dataset_rows(spec_path)
    scale_tag = make_scale_tag(row_count)
    question_set = [normalize_question(question) for question in legacy.get("questions", [])]

    if source_root == STRESS_ROOT:
        benchmark_partition = "stress"
    elif any(question.get("question_style") == "tool_hinted" for question in question_set):
        benchmark_partition = "hinted"
    else:
        benchmark_partition = "main"

    result = {
        "benchmark_id": legacy.get("task_id"),
        "task_type": legacy.get("task_type"),
        "widget_kind": infer_widget_kind(legacy.get("task_id", ""), path.name),
        "question_set": question_set,
        "data_source": {
            "kind": "rows_json" if dataset_id else "unknown",
            "dataset_id": dataset_id,
            "dataset_path": f"datasets/{dataset_id}.json" if dataset_id else None,
            "row_count": row_count,
            "dataset_scale_tag": scale_tag,
        },
        "materializations": {
            "vega": {
                "spec_path": spec_path,
            }
        },
        "benchmark_partition": benchmark_partition,
    }

    return result


def convert_tree(source_root: Path, output_root: Path) -> dict[str, int]:
    counts = {"main": 0, "hinted": 0, "stress": 0}
    for path in sorted(source_root.rglob("*.json")):
        try:
            payload = convert_file(path, source_root)
        except Exception as exc:
            print(f"skip {path}: {exc}")
            continue
        partition = payload.get("benchmark_partition", "main")
        target = output_root / partition / path.relative_to(source_root)
        write_json(target, payload)
        counts[partition] = counts.get(partition, 0) + 1
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert legacy visagentbench JSON files into visagentbench_v2 format.")
    parser.add_argument(
        "--include-stress",
        action="store_true",
        help="Also convert files from visagentbench_stress_subset/ into visagentbench_v2/benchmarks/stress/",
    )
    args = parser.parse_args()

    benchmark_output = V2_ROOT / "benchmarks"
    for partition_dir in ("main", "hinted", "stress"):
        shutil.rmtree(benchmark_output / partition_dir, ignore_errors=True)

    counts = convert_tree(LEGACY_ROOT, benchmark_output)
    print(f"converted main benchmarks: {counts['main']}")
    print(f"converted hinted benchmarks: {counts['hinted']}")

    if args.include_stress:
        stress_counts = convert_tree(STRESS_ROOT, benchmark_output)
        print(f"converted stress benchmarks: {stress_counts['stress']}")


if __name__ == "__main__":
    main()
