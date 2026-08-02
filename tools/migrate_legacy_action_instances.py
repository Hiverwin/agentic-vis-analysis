"""Create a small action-required pilot from legacy clear-single annotations.

The source annotations are read-only inputs.  The emitted instances use Kit
operation names and parameter casing; no legacy operation names are retained.
Each ASL level is a separate instance file so the same task can be run under
different prompt conditions later.
"""

from __future__ import annotations

import json
from pathlib import Path

from operation_equivalence import materialize_step_alternatives


ROOT = Path(__file__).resolve().parents[1]
INSTANCES_ROOT = ROOT / "visagentbench_kit" / "instances"


TASKS = [
    {
        "task_id": "95_sankey_01",
        "query": "Use sankey.filterFlow with minValue 50, then identify which material contributes the most to the Tire Plant.",
        "spec_path": "benchmark_annotation_system/backend/specs/95_sankey_supply.json",
        "widget_id": "w_sankey",
        "kind": "sankey",
        "operation": "sankey.filterFlow",
        "params": {"minValue": 50},
        "answer": "Rubber is the material that contributes the most to the Tire Plant",
        "answer_type": "verifiable_target",
        "answer_check": "categorical",
        "state_ref": "view/reencode",
        "state_property": "reencode",
        "state_expected": {"mode": "flowFilter", "minValue": 50},
        "analysis_to_action_id": "AT-1V-UNDERSTAND-THE-MAIN-FLOW-STRUCTURE-20",
        "workflow_id": "WF-1V-HIGH-VOLUME-PATH-TRACING-02",
    },
    {
        "task_id": "14_line_01",
        "query": "Use line.zoomXRegion with start 2014/7/1 and end 2014/9/1, then determine whether the high attendance was a single day or a sustained period for Firehouse Museum.",
        "spec_path": "benchmark_annotation_system/backend/specs/14_museum_visitors_line_multi.json",
        "widget_id": "w_line",
        "kind": "line",
        "operation": "line.zoomXRegion",
        "params": {"start": "2014/7/1", "end": "2014/9/1"},
        "answer": "On September 1st.",
        "answer_type": "verifiable_target",
        "answer_check": "categorical",
        "state_ref": "view/zoom",
        "state_property": "zoom",
        "state_expected": {"start": "2014/7/1", "end": "2014/9/1"},
        "analysis_to_action_id": "AT-1V-EXPLAIN-A-LOCAL-PEAK-DIP-OR-ABRUPT-CHANGE-11",
        "workflow_id": "WF-1V-TIME-WINDOWED-ENTITY-COMPARISON-01",
    },
    {
        "task_id": "100_sankey_03_v02",
        "query": "Use sankey.highlightPath for Emergency → Surgery → Blood Panel, then report the number of individuals on that path.",
        "spec_path": "benchmark_annotation_system/backend/specs/100_sankey_patient.json",
        "widget_id": "w_sankey",
        "kind": "sankey",
        "operation": "sankey.highlightPath",
        "params": {"path": ["Emergency", "Surgery", "Blood Panel"]},
        "answer": 110,
        "answer_type": "verifiable_target",
        "answer_check": "numeric",
        "state_ref": "view/highlight",
        "state_property": "highlight",
        "state_expected": {"path": ["Emergency", "Surgery", "Blood Panel"]},
        "analysis_to_action_id": "AT-1V-INSPECT-ONE-NODE-AND-ITS-SURROUNDING-FLOWS-23",
        "workflow_id": "WF-1V-PATH-CONVERSION-ANALYSIS-01",
    },
]


def build_instance(task: dict, asl: int = 0) -> dict:
    workspace_id = task["task_id"]
    widget_ref = f"wl://visagentbench/workspace/{workspace_id}/widget/{task['widget_id']}"
    state_ref = f"{widget_ref}/{task['state_ref']}"
    check = {
        "check_id": "state_1",
        "state_ref": state_ref,
        "property": task["state_property"],
        "check": "categorical",
        "expected": task["state_expected"],
    }
    if task["answer_check"] == "numeric":
        check_answer = {"field": "answer", "check": "numeric", "expected": task["answer"], "tolerance": 0}
    else:
        check_answer = {"field": "answer", "check": task["answer_check"], "expected": task["answer"]}
    tool_steps = materialize_step_alternatives([{
        "step_id": "tool_1",
        "operation": task["operation"],
        "target_widget_ref": widget_ref,
        "params": task["params"],
        "requirement": "required",
    }])
    return {
        "benchmark_id": f"{workspace_id}_asl{asl}",
        "task_id": workspace_id,
        "benchmark_partition": "pilot",
        "asl": asl,
        "query": task["query"],
        "taxonomy": {
            "answer_determinacy": "verifiable_target",
            "interaction_horizon": "single_operation",
            "workspace_scope": "single_widget",
        },
        "planner_context": {
            "analysis_to_action_ids": [task["analysis_to_action_id"]],
            "relation_ids": [],
            "workflow_id": task["workflow_id"],
        },
        "workspace": {
            "workspace_id": workspace_id,
            "widgets": {task["widget_id"]: {"ref": widget_ref, "kind": task["kind"]}},
            "links": [],
        },
        "materializations": {
            "vega": {
                "renderer": "vega-lite",
                "status": "contract_ready",
                "widgets": {task["widget_id"]: {"spec_path": task["spec_path"]}},
            }
        },
        "evaluation": {
            "answer": {"type": task["answer_type"], "answer": task["answer"], "checks": [check_answer]},
            "state": {"applicable": True, "checks": [check]},
            "tool": {"steps": tool_steps},
        },
    }


def main() -> None:
    for task in TASKS:
        out = INSTANCES_ROOT / task["task_id"]
        out.mkdir(parents=True, exist_ok=True)
        for asl in range(4):
            path = out / f"{task['task_id']}_asl{asl}.json"
            path.write_text(json.dumps(build_instance(task, asl), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(TASKS) * 4} instances under {INSTANCES_ROOT}")


if __name__ == "__main__":
    main()
