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
        alignment = self._align_required_steps(required, actual)
        used = {item["actual_index"] for item in alignment.values() if item.get("actual_index") is not None}
        matches = [self._format_match(step, actual, alignment.get(index)) for index, step in enumerate(required)]
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

    def _align_required_steps(
        self,
        required: List[Dict[str, Any]],
        actual: List[Dict[str, Any]],
    ) -> Dict[int, Dict[str, Any]]:
        row_count = len(required)
        column_count = len(actual)
        dp = [[0.0 for _ in range(column_count + 1)] for _ in range(row_count + 1)]
        decisions = [["" for _ in range(column_count + 1)] for _ in range(row_count + 1)]

        for row in range(row_count - 1, -1, -1):
            for column in range(column_count - 1, -1, -1):
                match_score = self._match_score(required[row], actual[column])
                match_total = match_score + dp[row + 1][column + 1] if match_score > 0 else -1.0
                skip_expected = dp[row + 1][column]
                skip_actual = dp[row][column + 1]
                best = max(match_total, skip_expected, skip_actual)
                dp[row][column] = best
                if match_total == best and match_score > 0:
                    decisions[row][column] = "match"
                elif skip_expected == best:
                    decisions[row][column] = "skip_expected"
                else:
                    decisions[row][column] = "skip_actual"

        alignment = {}
        row = 0
        column = 0
        while row < row_count and column < column_count:
            decision = decisions[row][column]
            if decision == "match":
                alignment[row] = {
                    "actual_index": column,
                    "score": self._match_score(required[row], actual[column]),
                }
                row += 1
                column += 1
            elif decision == "skip_expected":
                row += 1
            else:
                column += 1
        return alignment

    def _format_match(
        self,
        step: Dict[str, Any],
        actual: List[Dict[str, Any]],
        aligned: Dict[str, Any] | None,
    ) -> Dict[str, Any]:
        score = aligned.get("score", 0.0) if aligned else 0.0
        actual_index = aligned.get("actual_index") if aligned else None
        matched_call = actual[actual_index] if actual_index is not None else {}
        matched_candidate = self._match_candidate(step, matched_call) if matched_call else None
        return {
            "step_id": step.get("step_id"),
            "score": score,
            "matched": score == 1.0,
            "expected_operation": step.get("operation"),
            "actual_operation": matched_call.get("operation"),
            "operation_match": self._operation_match_kind(step, matched_call),
            "alternative_operation": (
                matched_candidate.get("operation")
                if matched_candidate and matched_candidate is not step
                else None
            ),
            "actual_index": actual_index,
        }

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
        target = candidate.get("target_widget_ref", expected.get("target_widget_ref"))
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
