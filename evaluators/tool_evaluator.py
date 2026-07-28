"""Tool Score over executed structured calls and required benchmark steps."""

from dataclasses import dataclass
import re
from typing import Any, Dict, List

from .common import value_match


@dataclass
class ToolEvalResult:
    score: float
    details: Dict[str, Any]


class ToolEvaluator:
    def evaluate(self, instance: Dict[str, Any], result: Dict[str, Any]) -> ToolEvalResult:
        expected = instance.get("evaluation", {}).get("tool", {}).get("steps", [])
        required = [step for step in expected if step.get("requirement") == "required"]
        optional = [step for step in expected if step.get("requirement") != "required"]
        actual = self._successful_calls(result)
        required_ids = {step.get("step_id") for step in required}
        matches_by_id = {}
        used = set()
        matches = []
        for step in required:
            dependencies = [step_id for step_id in step.get("depends_on", []) if step_id in required_ids]
            dependency_matches = [matches_by_id.get(step_id) for step_id in dependencies]
            dependency_satisfied = all(match and match.get("matched") for match in dependency_matches)
            first_index = (
                max(match["actual_index"] for match in dependency_matches) + 1
                if dependency_satisfied and dependency_matches
                else 0
            )
            best_index = None
            best_score = 0.0
            if dependency_satisfied:
                for index, call in enumerate(actual):
                    if index < first_index:
                        continue
                    if index in used:
                        continue
                    score = self._match_score(step, call)
                    if score > best_score:
                        best_index, best_score = index, score
            if best_index is not None:
                used.add(best_index)
            match = {
                "step_id": step.get("step_id"),
                "score": best_score,
                "matched": best_index is not None,
                "dependency_satisfied": dependency_satisfied and (not dependencies or best_index is not None),
                "actual_index": best_index,
            }
            matches_by_id[step.get("step_id")] = match
            matches.append(match)
        score = sum(item["score"] for item in matches) / len(matches) if matches else None
        return ToolEvalResult(
            score=score,
            details={
                "required": {"matched": sum(item["score"] == 1.0 for item in matches), "total": len(required), "steps": matches},
                "optional": {"available": len(optional), "used": sum(self._has_operation(step, actual) for step in optional)},
                "successful_calls": actual,
                "unscored_successful_calls": [
                    call.get("operation") for index, call in enumerate(actual) if index not in used
                ],
                "extra_calls_penalized": False,
            },
        )

    def _successful_calls(self, result: Dict[str, Any]) -> List[Dict[str, Any]]:
        calls = []
        tool_result = result.get("tool", {})
        recorded_steps = tool_result.get("steps", [])
        recorded_by_id = {step.get("step_id"): step for step in recorded_steps}
        for index, item in enumerate(tool_result.get("executions", [])):
            execution = item.get("execution", {})
            if execution.get("ok") is True:
                recorded = recorded_by_id.get(item.get("step_id"), {})
                if not recorded and index < len(recorded_steps):
                    recorded = recorded_steps[index]
                calls.append({
                    "operation": execution.get("name", recorded.get("operation", "")),
                    "target_widget_ref": execution.get("target_widget_ref", recorded.get("target_widget_ref", item.get("target_widget_ref"))),
                    "params": execution.get("params", recorded.get("params", item.get("params", {}))) or {},
                    "step_id": item.get("step_id"),
                })
        return calls

    def _match_score(self, expected: Dict[str, Any], actual: Dict[str, Any]) -> float:
        if expected.get("operation") != actual.get("operation"):
            return 0.0
        target = expected.get("target_widget_ref")
        if target and self._widget_identity(actual.get("target_widget_ref")) != self._widget_identity(target):
            return 0.0
        expected_params = expected.get("params", {})
        actual_params = actual.get("params", {})
        if not expected_params:
            return 1.0
        matched = sum(value_match(actual_params.get(key), value) for key, value in expected_params.items())
        return matched / len(expected_params)

    @staticmethod
    def _widget_identity(widget_ref: Any) -> Any:
        if not isinstance(widget_ref, str):
            return widget_ref
        match = re.search(r"/workspace/([^/]+)/widget/([^/]+)", widget_ref)
        if match:
            return match.group(1), match.group(2)
        return widget_ref

    @staticmethod
    def _has_operation(step: Dict[str, Any], actual: List[Dict[str, Any]]) -> bool:
        return any(call.get("operation") == step.get("operation") for call in actual)
