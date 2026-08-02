#!/usr/bin/env python3
"""Small deterministic bootstrap generator for the multi-widget benchmark skill.

The first slice intentionally supports one workflow. It turns one inline-data
Vega-Lite seed spec into a category-profile workspace so the contract and
materialization loop can be exercised before adding VLM planning.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path
from statistics import fmean
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from tools.operation_equivalence import materialize_step_alternatives


WORKFLOW_ID = "WF-2V-REPEATED-CATEGORY-PROFILE-COMPARISON-10"
RELATION_ID = "REL-2V-BAR-SELECTCATEGORY-01"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--spec-path", required=True, type=Path)
    parser.add_argument("--workflow-id", default=WORKFLOW_ID)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--asl", default="0", help="One ASL number or 'all'.")
    return parser.parse_args()


def load_spec(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    spec = payload.get("spec", payload)
    if not isinstance(spec, dict):
        raise ValueError("The input must be a Vega-Lite object or an object with a 'spec' field.")
    data = spec.get("data")
    rows = data.get("values") if isinstance(data, dict) else None
    if not isinstance(rows, list) or not rows:
        raise ValueError("The bootstrap generator requires inline data.values rows.")
    return spec


def is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def field_values(rows: list[dict[str, Any]], field: str) -> list[Any]:
    return [row.get(field) for row in rows if isinstance(row, dict) and row.get(field) is not None]


def infer_fields(spec: dict[str, Any]) -> tuple[str, str, str]:
    rows = spec["data"]["values"]
    fields = list(rows[0].keys()) if isinstance(rows[0], dict) else []
    if not fields:
        raise ValueError("Inline rows must be objects with named fields.")

    encoding = spec.get("encoding") if isinstance(spec.get("encoding"), dict) else {}
    encoded = []
    for channel in ("x", "y", "color", "size", "shape"):
        definition = encoding.get(channel)
        if isinstance(definition, dict) and isinstance(definition.get("field"), str):
            encoded.append(definition["field"])

    categorical_candidates = []
    numeric_candidates = []
    for field in fields:
        values = field_values(rows, field)
        if not values:
            continue
        unique_count = len({json.dumps(value, sort_keys=True) for value in values})
        if isinstance(values[0], str) and unique_count <= min(20, max(2, len(values) // 5)):
            categorical_candidates.append(field)
        if all(is_number(value) for value in values):
            numeric_candidates.append(field)

    category = next((field for field in encoded if field in categorical_candidates), None)
    category = category or (categorical_candidates[0] if categorical_candidates else None)
    numeric = [field for field in encoded if field in numeric_candidates]
    numeric.extend(field for field in numeric_candidates if field not in numeric)
    if not category or len(numeric) < 2:
        raise ValueError("Need one low-cardinality categorical field and two numeric fields.")
    return category, numeric[0], numeric[1]


def slug(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_").lower()
    return normalized or "seed"


def ref(workspace_id: str, suffix: str) -> str:
    return f"wl://widgetva-app/workspace/{workspace_id}/{suffix}"


def relative_or_absolute(path: Path, repo_root: Path) -> str:
    try:
        return path.resolve().relative_to(repo_root.resolve()).as_posix()
    except ValueError:
        return str(path.resolve())


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def build_specs(seed: dict[str, Any], category: str, x_field: str, y_field: str) -> tuple[dict[str, Any], dict[str, Any]]:
    rows = seed["data"]["values"]
    source = {
        "$schema": seed.get("$schema", "https://vega.github.io/schema/vega-lite/v5.json"),
        "title": f"Count by {category}",
        "data": {"values": rows},
        "transform": [{"aggregate": [{"op": "count", "as": "count"}], "groupby": [category]}],
        "mark": "bar",
        "encoding": {
            "x": {"field": category, "type": "nominal"},
            "y": {"field": "count", "type": "quantitative"},
        },
    }
    target = {
        "$schema": seed.get("$schema", "https://vega.github.io/schema/vega-lite/v5.json"),
        "title": f"{x_field} versus {y_field}",
        "data": {"values": rows},
        "mark": "point",
        "encoding": {
            "x": {"field": x_field, "type": "quantitative"},
            "y": {"field": y_field, "type": "quantitative"},
            "color": {"field": category, "type": "nominal"},
        },
    }
    return source, target


def build_instance(
    seed: dict[str, Any],
    category: str,
    x_field: str,
    y_field: str,
    task_id: str,
    source_spec_path: str,
    target_spec_path: str,
    asl: int,
) -> dict[str, Any]:
    rows = seed["data"]["values"]
    groups: dict[Any, list[dict[str, Any]]] = {}
    for row in rows:
        groups.setdefault(row.get(category), []).append(row)
    ranked = sorted(groups.items(), key=lambda item: (-len(item[1]), str(item[0])))
    largest, smallest = ranked[0], ranked[-1]

    def means(group_rows: list[dict[str, Any]]) -> tuple[float, float]:
        return fmean([row[x_field] for row in group_rows]), fmean([row[y_field] for row in group_rows])

    largest_x, largest_y = means(largest[1])
    smallest_x, smallest_y = means(smallest[1])
    workspace_id = f"{task_id}_workspace"
    source_widget_id = "w_source_bar"
    target_widget_id = "w_target_scatter"
    source_widget_ref = ref(workspace_id, f"widget/{source_widget_id}")
    target_widget_ref = ref(workspace_id, f"widget/{target_widget_id}")
    link_id = "l_category_profile"
    link_ref = ref(workspace_id, f"link/{link_id}")
    source_state_ref = f"{source_widget_ref}/selection/{category}"
    target_state_ref = f"{target_widget_ref}/transform/{slug(category)}-filter"

    query = (
        f"Which {category} cohorts are largest and smallest, and how do their mean "
        f"{x_field} and {y_field} values differ?"
    )
    answer = (
        f"{largest[0]} is the largest cohort with {len(largest[1])} rows, while "
        f"{smallest[0]} is the smallest with {len(smallest[1])} rows. "
        f"The largest cohort has mean {x_field} {largest_x:.4f} and mean {y_field} {largest_y:.4f}; "
        f"the smallest has mean {x_field} {smallest_x:.4f} and mean {y_field} {smallest_y:.4f}."
    )
    summary_params = [
        {"op": "count", "as": "count"},
        {"op": "mean", "field": x_field, "as": "xMean"},
        {"op": "mean", "field": y_field, "as": "yMean"},
    ]

    instance = {
        "benchmark_id": f"{task_id}_asl{asl}",
        "task_id": task_id,
        "benchmark_partition": "pilot",
        "asl": asl,
        "query": query,
        "taxonomy": {
            "answer_determinacy": "verifiable_target",
            "interaction_horizon": "multi_operation",
            "workspace_scope": "multi_widget",
        },
        "workspace": {
            "workspace_id": workspace_id,
            "widgets": {
                source_widget_id: {"ref": source_widget_ref, "kind": "bar"},
                target_widget_id: {"ref": target_widget_ref, "kind": "scatter"},
            },
            "links": [{
                "ref": link_ref,
                "id": link_id,
                "linkId": link_id,
                "sourceStateRef": source_state_ref,
                "targetStateRef": target_state_ref,
                "relation": "controls",
                "transform": {
                    "kind": "selectionToFilter",
                    "fieldMapping": [{"sourceField": category, "targetField": category}],
                },
                "activation": "automatic",
            }],
        },
        "materializations": {
            "vega": {
                "renderer": "vega-lite",
                "status": "contract_ready",
                "widgets": {
                    source_widget_id: {"spec_path": source_spec_path},
                    target_widget_id: {"spec_path": target_spec_path},
                },
            },
        },
        "evaluation": {
            "answer": {
                "type": "verifiable_target",
                "answer": answer,
                "checks": [
                    {"field": "largest_cohort", "check": "categorical", "expected": largest[0]},
                    {"field": "smallest_cohort", "check": "categorical", "expected": smallest[0]},
                    {"field": "largest_count", "check": "numeric", "expected": len(largest[1]), "tolerance": 0},
                    {"field": "smallest_count", "check": "numeric", "expected": len(smallest[1]), "tolerance": 0},
                    {"field": "largest_x_mean", "check": "numeric", "expected": round(largest_x, 4), "tolerance": 0.01},
                    {"field": "largest_y_mean", "check": "numeric", "expected": round(largest_y, 4), "tolerance": 0.01},
                    {"field": "smallest_x_mean", "check": "numeric", "expected": round(smallest_x, 4), "tolerance": 0.01},
                    {"field": "smallest_y_mean", "check": "numeric", "expected": round(smallest_y, 4), "tolerance": 0.01},
                ],
            },
            "state": {
                "applicable": True,
                "checks": [
                    {
                        "check_id": "final_source_selection",
                        "state_ref": source_widget_ref,
                        "property": "selections",
                        "check": "categorical",
                        "expected": {"field": category, "values": [smallest[0]]},
                    },
                    {
                        "check_id": "final_target_filter",
                        "state_ref": target_widget_ref,
                        "property": "transforms",
                        "check": "categorical",
                        "expected": {
                            "kind": "filter",
                            "linkId": link_id,
                            "sourceWidgetId": source_widget_id,
                            "field": category,
                            "values": [smallest[0]],
                            "mode": "include",
                        },
                    },
                ],
            },
            "tool": {
                "steps": [
                    {
                        "step_id": "discover_candidates",
                        "operation": "perception.summarizeVisible",
                        "target_widget_ref": source_widget_ref,
                        "params": {"groupBy": [category], "measures": [{"op": "count", "as": "count"}]},
                        "requirement": "required",
                    },
                    {
                        "step_id": "select_largest",
                        "operation": "bar.selectCategory",
                        "target_widget_ref": source_widget_ref,
                        "params": {"field": category, "values": [largest[0]]},
                        "depends_on": ["discover_candidates"],
                        "requirement": "required",
                    },
                    {
                        "step_id": "summarize_largest",
                        "operation": "perception.summarizeVisible",
                        "target_widget_ref": target_widget_ref,
                        "params": {"measures": summary_params},
                        "depends_on": ["select_largest"],
                        "requirement": "required",
                    },
                    {
                        "step_id": "select_smallest",
                        "operation": "bar.selectCategory",
                        "target_widget_ref": source_widget_ref,
                        "params": {"field": category, "values": [smallest[0]]},
                        "depends_on": ["summarize_largest"],
                        "requirement": "required",
                    },
                    {
                        "step_id": "summarize_smallest",
                        "operation": "perception.summarizeVisible",
                        "target_widget_ref": target_widget_ref,
                        "params": {"measures": summary_params},
                        "depends_on": ["select_smallest"],
                        "requirement": "required",
                    },
                ],
            },
        },
        "planner_context": {"relation_ids": [RELATION_ID], "workflow_id": WORKFLOW_ID},
    }
    instance["evaluation"]["tool"]["steps"] = materialize_step_alternatives(instance["evaluation"]["tool"]["steps"])
    return instance


def main() -> int:
    args = parse_args()
    if args.workflow_id != WORKFLOW_ID:
        raise SystemExit(f"The bootstrap slice only supports {WORKFLOW_ID}.")
    seed = load_spec(args.spec_path.resolve())
    category, x_field, y_field = infer_fields(seed)
    source_spec, target_spec = build_specs(seed, category, x_field, y_field)
    task_id = f"mw_{slug(args.spec_path.stem)}_category_profile_001"
    task_dir = args.output_dir.resolve() / task_id
    source_path = task_dir / "materializations" / "w_source_bar.vl.json"
    target_path = task_dir / "materializations" / "w_target_scatter.vl.json"
    write_json(source_path, source_spec)
    write_json(target_path, target_spec)

    asl_values = [0, 1, 2, 3] if args.asl == "all" else [int(args.asl)]
    instance_paths = []
    for asl in asl_values:
        instance = build_instance(
            seed,
            category,
            x_field,
            y_field,
            task_id,
            relative_or_absolute(source_path, args.repo_root),
            relative_or_absolute(target_path, args.repo_root),
            asl,
        )
        instance_path = task_dir / f"{task_id}_asl{asl}.json"
        write_json(instance_path, instance)
        instance_paths.append(str(instance_path))

    print(json.dumps({
        "task_id": task_id,
        "instance_path": instance_paths[0],
        "instance_paths": instance_paths,
        "generated_specs": [str(source_path), str(target_path)],
        "inferred_fields": {"category": category, "x": x_field, "y": y_field},
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
