"""Tool Score over executed structured calls and required benchmark steps."""

from dataclasses import dataclass
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
            # Dependencies constrain ordering only. They must not prevent an
            # independently executed child step from earning its own score.
            first_index = 0
            best_index = None
            best_score = 0.0
            for index, call in enumerate(actual):
                if index < first_index:
                    continue
                if index in used:
                    continue
                score = self._match_score(step, call)
                if score > best_score:
                    best_index, best_score = index, score
            matched = best_index is not None and best_score == 1.0
            matched_call = actual[best_index] if best_index is not None else {}
            matched_candidate = self._match_candidate(step, matched_call) if matched_call else None
            if matched:
                used.add(best_index)
            match = {
                "step_id": step.get("step_id"),
                "score": best_score,
                "matched": matched,
                "expected_operation": step.get("operation"),
                "actual_operation": matched_call.get("operation"),
                "operation_match": self._operation_match_kind(step, matched_call),
                "alternative_operation": (
                    matched_candidate.get("operation")
                    if matched_candidate and matched_candidate is not step
                    else None
                ),
                "dependency_satisfied": dependency_satisfied,
                "order_ok": (
                    True if not dependencies else None
                    if not all(
                        dependency_matches[index].get("actual_index") is not None
                        for index in range(len(dependency_matches))
                    ) else bool(
                        matched and all(
                            dependency_matches[index]["actual_index"] < best_index
                            for index in range(len(dependency_matches))
                        )
                    )
                ),
                "actual_index": best_index if matched else None,
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
        candidate = self._match_candidate(expected, actual)
        if candidate is None:
            return 0.0
        target = expected.get("target_widget_ref")
        if target and self._widget_identity(actual.get("target_widget_ref")) != self._widget_identity(target):
            return 0.0
        expected_params = candidate.get("params", {})
        actual_params = actual.get("params", {})
        if not expected_params:
            return 1.0
        matched = sum(
            int(value_match(actual_params.get(key), value))
            for key, value in expected_params.items()
        )
        return matched / len(expected_params)

    @staticmethod
    def _widget_identity(widget_ref: Any) -> Any:
        return widget_ref

    @staticmethod
    def _operation_match_kind(expected: Dict[str, Any], actual: Dict[str, Any]) -> str:
        candidate = ToolEvaluator._match_candidate(expected, actual)
        if candidate is None:
            return "none"
        if candidate is expected:
            return "exact"
        return "alternative"

    @staticmethod
    def _match_candidate(expected: Dict[str, Any], actual: Dict[str, Any]) -> Dict[str, Any] | None:
        expected_operation = expected.get("operation")
        actual_operation = actual.get("operation")
        if expected_operation == actual_operation:
            return expected
        for alternative in expected.get("alternative_steps") or []:
            if alternative.get("operation") == actual_operation:
                return alternative
        return None

    @staticmethod
    def _has_operation(step: Dict[str, Any], actual: List[Dict[str, Any]]) -> bool:
        return any(ToolEvaluator._operation_match_kind(step, call) != "none" for call in actual)
