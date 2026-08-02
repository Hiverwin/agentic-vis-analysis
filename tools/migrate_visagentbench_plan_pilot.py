from __future__ import annotations

import argparse
import json
from copy import deepcopy
from pathlib import Path
from typing import Any

from operation_equivalence import materialize_step_alternatives


REPO_ROOT = Path(__file__).resolve().parents[1]
LEGACY_ROOT = REPO_ROOT / "visagentbench"

ASL_BY_SUFFIX = {
    "type1a": 3,
    "type1b": 2,
    "type2": 1,
    "type3": 0,
}

LEGACY_OPERATION_MAP = {
    "change_encoding": "widget.changeEncoding",
    "calculate_correlation": "perception.computeCorrelation",
    "calculate_conversion_rate": "perception.calculateConversionRate",
    "detect_anomalies": "perception.detectAnomalies",
    "find_bottleneck": "perception.findBottleneck",
    "reset_view": "widget.resetView",
    "undo_view": "widget.undoView",
    "auto_collapse_by_rank": "sankey.autoCollapseByRank",
    "trace_node": "sankey.traceNode",
    "sort_bars": "bar.sortBars",
    "find_extremes": "perception.findExtremes",
    "highlight_category": "parallelCoordinates.highlightCategory",
}

QUERY_TOKEN_REPLACEMENTS = {
    "change_encoding": "widget.changeEncoding",
    "calculate_correlation": "perception.computeCorrelation",
    "calculate_conversion_rate": "perception.calculateConversionRate",
    "detect_anomalies": "perception.detectAnomalies",
    "find_bottleneck": "perception.findBottleneck",
    "reset_view": "widget.resetView",
    "undo_view": "widget.undoView",
    "auto_collapse_by_rank": "sankey.autoCollapseByRank",
    "trace_node": "sankey.traceNode",
    "sort_bars": "bar.sortBars",
    "find_extremes": "perception.findExtremes",
    "highlight_category": "parallelCoordinates.highlightCategory",
    "top_n": "topN",
    " with method equal to pearson": "",
}

KIND_BY_NAME_TOKEN = {
    "bar": "bar",
    "line": "line",
    "scatter": "scatter",
    "heatmap": "heatmap",
    "parallel": "parallelCoordinates",
    "sankey": "sankey",
}


def migrate_manifest(manifest_path: Path, output_dir: Path) -> list[Path]:
    manifest = _read_json(manifest_path)
    output_dir.mkdir(parents=True, exist_ok=True)

    output_paths: list[Path] = []
    for task_spec in manifest["tasks"]:
        source_path = _resolve_repo_path(task_spec["source"])
        base = _read_json(source_path)
        task_id = base["task_id"]
        asl_sources = _collect_asl_sources(source_path, task_id)
        evaluation = _build_evaluation(base, task_spec, task_id)
        workspace = _build_workspace(task_id)
        materializations = _build_materializations(base, workspace)
        taxonomy = _build_taxonomy(base, task_spec, workspace)

        task_dir = output_dir / task_id
        task_dir.mkdir(parents=True, exist_ok=True)
        for asl, variant_path in sorted(asl_sources.items()):
            variant = _read_json(variant_path)
            instance = {
                "benchmark_id": f"{task_id}_asl{asl}",
                "task_id": task_id,
                "benchmark_partition": "pilot",
                "asl": asl,
                "query": _extract_query(variant),
                "taxonomy": taxonomy,
                "workspace": workspace,
                "materializations": materializations,
                "evaluation": evaluation,
            }
            output_path = task_dir / f"{task_id}_asl{asl}.json"
            output_path.write_text(json.dumps(instance, ensure_ascii=False, indent=2) + "\n")
            output_paths.append(output_path)

    return output_paths


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def _resolve_repo_path(path: str) -> Path:
    candidate = Path(path)
    if candidate.is_absolute():
        return candidate
    return REPO_ROOT / candidate


def _collect_asl_sources(source_path: Path, task_id: str) -> dict[int, Path]:
    sources = {ASL_BY_SUFFIX["type1a"]: source_path}
    for suffix in ("type1b", "type2", "type3"):
        pattern = f"{task_id}_type1a_{suffix}.json"
        matches = [
            path
            for path in LEGACY_ROOT.rglob(pattern)
            if "llm_generation" not in path.parts
        ]
        if len(matches) != 1:
            raise ValueError(f"Expected one {suffix} variant for {task_id}, found {len(matches)}")
        sources[ASL_BY_SUFFIX[suffix]] = matches[0]
    return sources


def _extract_query(instance: dict[str, Any]) -> str:
    questions = instance.get("questions") or []
    if len(questions) != 1:
        raise ValueError(f"Expected exactly one question in {instance.get('task_id')}")
    query = questions[0].get("question", "").strip()
    if not query:
        raise ValueError(f"Missing query in {instance.get('task_id')}")
    return _normalize_query_tokens(query)


def _normalize_query_tokens(query: str) -> str:
    normalized = query
    for old_token, new_token in QUERY_TOKEN_REPLACEMENTS.items():
        normalized = normalized.replace(old_token, new_token)
    return normalized


def _build_workspace(task_id: str) -> dict[str, Any]:
    widget_kind = _widget_kind_from_task_id(task_id)
    widget_id = _widget_id(widget_kind)
    widget_ref = _widget_ref(task_id, widget_id)
    return {
        "workspace_id": task_id,
        "widgets": {
            widget_id: {
                "ref": widget_ref,
                "kind": widget_kind,
            }
        },
        "links": [],
    }


def _build_materializations(base: dict[str, Any], workspace: dict[str, Any]) -> dict[str, Any]:
    widget_id = next(iter(workspace["widgets"]))
    spec_path = base["vega_spec_path"]
    return {
        "vega": {
            "renderer": _renderer_for_spec_path(spec_path),
            "status": "contract_ready",
            "widgets": {
                widget_id: {
                    "spec_path": spec_path,
                }
            },
        }
    }


def _renderer_for_spec_path(spec_path: str) -> str:
    path = _resolve_repo_path(spec_path)
    if not path.exists():
        return "vega-lite"
    spec = _read_json(path)
    schema = str(spec.get("$schema", "")).lower()
    return "vega-lite" if "vega-lite" in schema else "vega"


def _build_taxonomy(
    base: dict[str, Any],
    task_spec: dict[str, Any],
    workspace: dict[str, Any],
) -> dict[str, str]:
    task_type = str(base.get("task_type", ""))
    return {
        "answer_determinacy": "open_ended_insight"
        if task_type.startswith("vague")
        else "verifiable_target",
        "interaction_horizon": "multi_operation"
        if len(task_spec.get("steps", [])) > 1
        else "single_operation",
        "workspace_scope": "multi_widget"
        if len(workspace["widgets"]) > 1
        else "single_widget",
    }


def _build_evaluation(
    base: dict[str, Any],
    task_spec: dict[str, Any],
    task_id: str,
) -> dict[str, Any]:
    question = base["questions"][0]
    ground_truth = question["ground_truth"]
    widget_kind = _widget_kind_from_task_id(task_id)
    widget_ref = _widget_ref(task_id, _widget_id(widget_kind))
    return {
        "answer": _build_answer_evaluation(ground_truth, widget_ref),
        "state": {
            "applicable": bool(task_spec.get("state_checks")),
            "checks": _build_state_checks(task_spec, widget_ref),
        },
        "tool": {
            "steps": materialize_step_alternatives(_build_tool_steps(task_spec, widget_ref)),
        },
    }


def _build_answer_evaluation(
    ground_truth: dict[str, Any],
    widget_ref: str,
) -> dict[str, Any]:
    answer = ground_truth["answer"]
    answer_type = str(answer.get("type"))
    answer_value = _normalize_answer_value(answer.get("value"))
    if answer_type == "open_ended":
        key_insights = ground_truth.get("key_insights") or [str(answer_value)]
        return {
            "type": "open_ended_insight",
            "answer": str(answer_value),
            "metrics": ["insight_precision", "insight_recall", "groundedness"],
            "reference_insights": [
                {
                    "insight_id": f"i{index}",
                    "claim": insight,
                    "evidence": {"widget_ref": widget_ref},
                }
                for index, insight in enumerate(key_insights, start=1)
            ],
        }

    check = {
        "field": "answer",
        "check": _answer_check_type(answer_type),
        "expected": answer_value,
    }
    if "tolerance" in answer:
        check["tolerance"] = float(answer["tolerance"])
    return {
        "type": "verifiable_target",
        "answer": answer_value,
        "checks": [check],
    }


def _normalize_answer_value(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            try:
                return float(value)
            except ValueError:
                return value
    return value


def _answer_check_type(answer_type: str) -> str:
    if answer_type in {"numeric", "categorical", "interval", "boolean"}:
        return answer_type
    return "categorical"


def _build_tool_steps(task_spec: dict[str, Any], widget_ref: str) -> list[dict[str, Any]]:
    steps = []
    previous_step_id: str | None = None
    for index, step_spec in enumerate(task_spec["steps"], start=1):
        step_id = f"tool_{index}"
        step = {
            "step_id": step_id,
            "operation": step_spec["operation"],
            "target_widget_ref": widget_ref,
            "params": deepcopy(step_spec.get("params", {})),
        }
        if previous_step_id is not None:
            step["depends_on"] = [previous_step_id]
        steps.append(step)
        previous_step_id = step_id
    return steps


def _build_state_checks(task_spec: dict[str, Any], widget_ref: str) -> list[dict[str, Any]]:
    checks = []
    for index, check_spec in enumerate(task_spec.get("state_checks", []), start=1):
        state_slot = check_spec["state_slot"]
        expected = deepcopy(check_spec["expected"])
        key = check_spec.get("key")
        if key:
            expected = {key: expected}
        check = {
            "check_id": f"state_{index}",
            "state_ref": f"{widget_ref}/{state_slot}",
            "property": check_spec["state_field"],
            "check": check_spec["check"],
            "expected": expected,
        }
        if "mode" in check_spec:
            check["method"] = deepcopy(check_spec["mode"])
        if "tolerance" in check_spec:
            check["tolerance"] = deepcopy(check_spec["tolerance"])
        checks.append(check)
    return checks


def _widget_kind_from_task_id(task_id: str) -> str:
    for token, kind in KIND_BY_NAME_TOKEN.items():
        if f"_{token}_" in task_id:
            return kind
    return "custom"


def _widget_id(widget_kind: str) -> str:
    if widget_kind == "parallelCoordinates":
        return "w_parallel_coordinates"
    return f"w_{widget_kind}"


def _widget_ref(task_id: str, widget_id: str) -> str:
    return f"wl://visagentbench/workspace/{task_id}/widget/{widget_id}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate pilot VisAgentBench tasks to plan instances.")
    parser.add_argument(
        "--manifest",
        type=Path,
        default=REPO_ROOT / "visagentbench_v2" / "migration" / "pilot_tasks.json",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=REPO_ROOT / "visagentbench_v2" / "instances" / "pilot_plan",
    )
    args = parser.parse_args()

    outputs = migrate_manifest(args.manifest, args.output_dir)
    print(f"Generated {len(outputs)} plan instances under {args.output_dir}")


if __name__ == "__main__":
    main()
