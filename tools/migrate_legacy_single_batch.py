#!/usr/bin/env python3
"""Migrate supported single-widget VisAgentBench tasks to the Kit schema.

This intentionally skips operations that do not have a current Kit descriptor or
whose old parameters cannot be translated without guessing.  A JSON report is
written for skipped files so the migration remains auditable.
"""
from __future__ import annotations

import argparse, json, re
from collections import defaultdict
from pathlib import Path
from typing import Any

from operation_equivalence import materialize_step_alternatives

ROOT = Path(__file__).resolve().parents[1]
LEGACY = ROOT / "visagentbench" / "human_annotation"
OUT = ROOT / "visagentbench_kit" / "instances"
ASL = {"type1a": 3, "type1b": 2, "type2": 1, "type3": 0}

ACTION_MAP = {
    "change_encoding": "widget.changeEncoding",
    "sort_bars": "bar.sortBars",
    "filter_categories": "bar.filterCategories",
    "filter_subcategories": "bar.filterSubcategories",
    "highlight_top_n": "bar.highlightTopN",
    "expand_stack": "bar.expandStack",
    "toggle_stack_mode": "bar.toggleStackMode",
    "filter_lines": "line.filterLines",
    "zoom_x_region": "line.zoomXRegion",
    "focus_lines": "line.focusLines",
    "highlight_trend": "line.highlightTrend",
    "show_moving_average": "line.showMovingAverage",
    "resample_x_axis": "line.resampleXAxis",
    "filter_by_category": "parallelCoordinates.filterByCategory",
    "highlight_category": "parallelCoordinates.highlightCategory",
    "hide_dimensions": "parallelCoordinates.hideDimensions",
    "reorder_dimensions": "parallelCoordinates.reorderDimensions",
    "filter_flow": "sankey.filterFlow",
    "highlight_path": "sankey.highlightPath",
    "trace_node": "sankey.traceNode",
    "color_flows": "sankey.colorFlows",
    "auto_collapse_by_rank": "sankey.autoCollapseByRank",
    "collapse_nodes": "sankey.collapseNodes",
    "zoom_2d_region": "scatter.zoomDomain",
    "filter_categorical": "scatter.filterCategorical",
    "adjust_color_scale": "heatmap.adjustColorScale",
    "add_marginal_bars": "heatmap.addMarginalBars",
    "highlight_region": "heatmap.highlightRegion",
    "highlight_region_by_value": "heatmap.highlightRegionByValue",
    "filter_cells_by_region": "heatmap.filterCellsByRegion",
    "calculate_correlation": "perception.computeCorrelation",
    "calculate_conversion_rate": "perception.calculateConversionRate",
    "detect_anomalies": "perception.detectAnomalies",
    "find_bottleneck": "perception.findBottleneck",
    "find_extremes": "perception.findExtremes",
    "get_data_summary": "perception.summarizeVisible",
    "get_data": "perception.summarizeVisible",
    "get_view_spec": "perception.inspectViewConfig",
    "show_regression": "scatter.showRegression",
    "identify_clusters": "scatter.identifyClusters",
    "show_moving_average": "line.showMovingAverage",
    "zoom_time_range": "line.zoomXRegion",
    "zoom_dense_area": "scatter.zoomDomain",
    "reset_view": "widget.resetView",
    "cluster_rows_cols": "heatmap.clusterRowsCols",
    "filter_cells": "heatmap.filterCells",
    "select_region": "scatter.selectRegion",
    "find_extreme": "perception.findExtremes",
    "expand_node": "sankey.expandNode",
    "reorder_nodes_in_layer": "sankey.reorderNodesInLayer",
    "brush_region": "scatter.brushRegion",
    "drill_down_x_axis": "line.drillDownXAxis",
}

WIDGET = {"bar": "bar", "line": "line", "scatter": "scatter", "heatmap": "heatmap", "parallel": "parallelCoordinates", "sankey": "sankey"}
WIDGET_ID = {"bar": "w_bar", "line": "w_line", "scatter": "w_scatter", "heatmap": "w_heatmap", "parallel": "w_parallel_coordinates", "sankey": "w_sankey"}

def read(p: Path) -> dict[str, Any]: return json.loads(p.read_text())

def parse_name(p: Path) -> tuple[str, str, str, str]:
    m = re.match(r"(?P<num>\d+)_(?P<widget>[a-zA-Z]+)_(?:cs|vs|cm|vm)_(?P<task>\d+)_type1a(?:_(?P<asl2>type1b|type2|type3))?\.json$", p.name)
    if not m:
        # A few legacy filenames contain an accidental space/"json" token.
        loose = re.match(r"(?P<num>\d+)_(?P<widget>bar|line|scatter|heatmap|parallel|sankey).*?_(?P<task>\d+).*?type1a(?:_(?P<asl2>type1b|type2|type3))?\.json$", p.name)
        if not loose: raise ValueError(f"unsupported legacy filename: {p.name}")
        return loose.group("num"), loose.group("widget"), loose.group("task"), loose.group("asl2") or "type1a"
    return m.group("num"), m.group("widget"), m.group("task"), m.group("asl2") or "type1a"

def old_tools(q: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    ts = (q.get("ground_truth", {}).get("tool_eval", {}).get("tools") or [])
    result = []
    for t in ts:
        name = t.get("tool")
        if not name or name not in ACTION_MAP: return []
        value = (t.get("param_eval") or {}).get("target", {})
        result.append((name, value if isinstance(value, dict) else {"value": value}))
    return result

def params_for(old: str, raw: dict[str, Any], q: dict[str, Any]) -> dict[str, Any]:
    p = dict(raw)
    rename = {"min_value":"minValue", "max_value":"maxValue", "top_n":"topN", "node_name":"nodeName", "lines_to_remove":"linesToRemove", "dimension_order":"dimensionOrder", "subcategories_to_remove":"subcategoriesToRemove", "x_range":"xRange", "y_range":"yRange", "x_values":"xValues", "y_values":"yValues", "x_value":"xValue", "y_value":"yValue", "outside_opacity":"outsideOpacity", "window_size":"windowSize", "trend_type":"trendType", "show_top":"showTop", "show_right":"showRight", "aggregate_name":"aggregateName", "nodes_to_collapse":"nodesToCollapse", "categories_to_remove":"categoriesToRemove", "layer_depth":"depth", "node_order":"order"}
    for a,b in rename.items():
        if a in p: p[b] = p.pop(a)
    if old == "change_encoding" and "field" in p:
        p = {"channel": p.get("channel"), "field": p["field"]}
    if old == "filter_subcategories" and "value" in p and "subcategoriesToRemove" not in p:
        p["subcategoriesToRemove"] = [x.strip() for x in str(p.pop("value")).split(",")]
    if old == "filter_categories" and "categories" in p: p["categories"] = p.pop("categories")
    if old in ("expand_stack", "toggle_stack_mode", "adjust_color_scale") and "value" in p:
        key = {"expand_stack": "category", "toggle_stack_mode": "mode", "adjust_color_scale": "scheme"}[old]
        p[key] = p.pop("value")
    if old in ("filter_by_category", "highlight_category") and "values" not in p and "value" in p: p["values"] = [p.pop("value")]
    if old == "filter_lines" and "linesToRemove" not in p: p["linesToRemove"] = []
    if old == "sort_bars":
        p.setdefault("channel", "x")
    if old == "zoom_2d_region":
        p = {"xDomain": p.get("xRange"), "yDomain": p.get("yRange")}
    if old in ("zoom_time_range", "zoom_x_region"):
        p = {"start": p.get("start"), "end": p.get("end")}
    if old == "resample_x_axis" and "granularity" not in p and "value" in p: p["granularity"] = p.pop("value")
    if old in ("get_data_summary", "get_data"):
        p.pop("scope", None)
    if old == "show_regression": p.setdefault("method", "linear")
    if old == "identify_clusters": p.setdefault("method", "kmeans")
    if old == "reset_view": p = {}
    if old == "find_extreme": old = "find_extremes"
    if old == "filter_cells":
        p = {"xField": p.get("xField"), "yField": p.get("yField"), "xValue": p.get("xValue"), "yValue": p.get("yValue")}
    if old == "expand_node" and "aggregateName" not in p and "aggregate_name" in raw: p["aggregateName"] = raw["aggregate_name"]
    if old == "calculate_correlation":
        # Old records often omitted fields; these are recoverable from the query only
        # when explicitly present, otherwise skip at validation time.
        m = re.search(r"between ([A-Za-z0-9_ -]+) and ([A-Za-z0-9_ -]+)", q.get("question", ""), re.I)
        if m: p = {"xField": m.group(1).strip(), "yField": m.group(2).strip()}
    return {k:v for k,v in p.items() if v is not None}

def widget_kind(widget: str) -> str: return WIDGET[widget]

def base_id(num: str, widget: str, task: str) -> str: return f"{num}_{widget}_{task}"

def spec_path(d: dict[str, Any]) -> str: return d["vega_spec_path"]

def build_state(q: dict[str, Any], ref: str) -> dict[str, Any]:
    gt = q.get("ground_truth", {}); fields = gt.get("state_check_fields") or []
    old = gt.get("state_eval") or {}
    checks=[]
    props={"encoding":"encodings","encodings":"encodings","sorting":"view","view":"view","node_visibility":"view","data_filtered":"transforms","zoom":"view"}
    for i, f in enumerate(fields, 1):
        if f not in old: continue
        expected=old[f]; prop=props.get(f)
        if not prop: continue
        checks.append({"check_id":f"state_{i}","state_ref":ref,"property":prop,"check":"categorical","expected":expected,"method":"exact"})
    return {"applicable": bool(checks), "checks": checks}

def convert_group(paths: list[Path], task_id: str, out_dir: Path) -> list[Path]:
    first=read(paths[0]); q=first["questions"][0]; tools=old_tools(q)
    if not tools: raise ValueError("no supported operation")
    converted_steps=[(ACTION_MAP[name], params_for(name, raw, q)) for name, raw in tools]
    widget_token=parse_name(paths[0])[1]; kind=widget_kind(widget_token); wid=WIDGET_ID[widget_token]; ref=f"wl://visagentbench/workspace/{task_id}/widget/{wid}"
    answer=q.get("ground_truth",{}).get("answer",{}); aval=answer.get("value")
    taxonomy={"answer_determinacy":"open_ended_insight" if first.get("task_type","").startswith("vague") else "verifiable_target","interaction_horizon":"multi_operation" if len(converted_steps)>1 else "single_operation","workspace_scope":"single_widget"}
    out=[]
    for p in paths:
        d=read(p); qq=d["questions"][0]; ans=qq.get("ground_truth",{}).get("answer",{}); val=ans.get("value")
        asl=ASL[parse_name(p)[3]]
        steps = materialize_step_alternatives([{"step_id":f"tool_{i}","operation":op,"target_widget_ref":ref,"params":params,"requirement":"required"} for i,(op,params) in enumerate(converted_steps,1)])
        inst={"benchmark_id":f"{task_id}_asl{asl}","task_id":task_id,"benchmark_partition":"main","asl":asl,"query":qq["question"],"taxonomy":taxonomy,"workspace":{"workspace_id":task_id,"widgets":{wid:{"ref":ref,"kind":kind}},"links":[]},"materializations":{"vega":{"renderer":"vega-lite","status":"contract_ready","widgets":{wid:{"spec_path":spec_path(d)}}}},"evaluation":{"answer":{"type":"open_ended_insight" if first.get("task_type","").startswith("vague") else "verifiable_target","answer":val},"state":build_state(qq,ref),"tool":{"steps":steps}}}
        if inst["evaluation"]["answer"]["type"]=="verifiable_target":
            if isinstance(val, (int, float)) and not isinstance(val, bool):
                check = {"field":"answer","check":"numeric","expected":val,"tolerance":0}
            elif isinstance(val, str) and re.fullmatch(r"[-+]?\\d+(?:\\.\\d+)?%?", val.strip()):
                numeric = float(val[:-1]) / 100 if val.endswith("%") else float(val)
                check = {"field":"answer","check":"numeric","expected":numeric,"tolerance":0}
            else:
                check = {"field":"answer","check":"categorical","expected":val}
            inst["evaluation"]["answer"]["checks"]=[check]
        else: inst["evaluation"]["answer"].update({"metrics":["insight_precision","insight_recall","groundedness"],"reference_insights":[]})
        dest=out_dir/task_id; dest.mkdir(parents=True,exist_ok=True); target=dest/f"{task_id}_asl{asl}.json"; target.write_text(json.dumps(inst,ensure_ascii=False,indent=2)+"\n"); out.append(target)
    return out

def main() -> None:
    ap=argparse.ArgumentParser(); ap.add_argument("--dry-run",action="store_true"); ap.add_argument("--report",default="visagentbench_kit/migration/single_batch_report.json"); args=ap.parse_args()
    groups=defaultdict(list); skipped=[]
    source_roots = [
        LEGACY / "clear_single", LEGACY / "vague_single",
        LEGACY / "clear_multi", LEGACY / "vague_multi",
        ROOT / "visagentbench" / "clear_single_variant" / "type1b" / "clear_single",
        ROOT / "visagentbench" / "clear_single_variant" / "type2" / "clear_single",
        ROOT / "visagentbench" / "clear_single_variant" / "type3" / "clear_single",
        ROOT / "visagentbench" / "vague_single_variants" / "type1b" / "vague_single",
        ROOT / "visagentbench" / "vague_single_variants" / "type2" / "vague_single",
        ROOT / "visagentbench" / "vague_single_variants" / "type3" / "vague_single",
        ROOT / "visagentbench" / "clear_multi_variant" / "type1b" / "clear_multi",
        ROOT / "visagentbench" / "clear_multi_variant" / "type2" / "clear_multi",
        ROOT / "visagentbench" / "clear_multi_variant" / "type3" / "clear_multi",
        ROOT / "visagentbench" / "vague_multi_variants" / "type1b" / "vague_multi",
        ROOT / "visagentbench" / "vague_multi_variants" / "type2" / "vague_multi",
        ROOT / "visagentbench" / "vague_multi_variants" / "type3" / "vague_multi",
    ]
    for root in source_roots:
        for p in sorted(root.glob("*.json")):
            try:
                num,w,t,a=parse_name(p); d=read(p); q=d["questions"][0]
                if not old_tools(q): skipped.append({"file":str(p.relative_to(ROOT)),"reason":"unsupported_operation"}); continue
                # clear/vague variants with the same numeric source are separate
                # benchmark tasks; keep them separate so their ASL files never
                # overwrite one another.
                groups[(num,w,t,root.name)].append(p)
            except Exception as e: skipped.append({"file":str(p.relative_to(ROOT)),"reason":str(e)})
    used={p.name for p in OUT.iterdir() if p.is_dir()}; initial_used=set(used); outputs=[]; migrated=[]
    for (num,w,t,_source_kind), paths in sorted(groups.items()):
        base=base_id(num,w,t); task=base
        if task in initial_used and _source_kind not in {"clear_multi", "vague_multi"}:
            skipped.append({"task_id":base,"reason":"already_exists"}); continue
        v=1
        while task in used: v+=1; task=f"{base}_v{v:02d}"
        try:
            if not args.dry_run: outputs += convert_group(paths,task,OUT)
            used.add(task); migrated.append({"task_id":task,"source_files":[str(x.relative_to(ROOT)) for x in paths]})
        except Exception as e: skipped.append({"task_id":base,"reason":str(e)})
    report={"migrated":migrated,"skipped":skipped,"counts":{"migrated_tasks":len(migrated),"written_files":len(outputs),"skipped":len(skipped)}}
    rp=ROOT/args.report; rp.parent.mkdir(parents=True,exist_ok=True); rp.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n"); print(json.dumps(report["counts"],ensure_ascii=False))

if __name__ == "__main__": main()
