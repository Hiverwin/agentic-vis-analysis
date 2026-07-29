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
            matched = best_index is not None and best_score == 1.0
            if matched:
                used.add(best_index)
            match = {
                "step_id": step.get("step_id"),
                "score": 1.0 if matched else 0.0,
                "parameter_score": best_score,
                "matched": matched,
                "dependency_satisfied": dependency_satisfied and (not dependencies or matched),
                "actual_index": best_index if matched else None,
            }
            matches_by_id[step.get("step_id")] = match
            matches.append(match)
        score = sum(item["score"] for item in matches) / len(matches) if matches else None
        return ToolEvalResult(
            score=score,
            details={
                "required": {"matched": sum(item["matched"] for item in matches), "total": len(required), "steps": matches},
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
        matched = sum(
            self._parameter_match(
                operation=expected.get("operation"),
                key=key,
                expected=value,
                actual_params=actual_params,
            )
            for key, value in expected_params.items()
        )
        return matched / len(expected_params)

    def _parameter_match(
        self,
        *,
        operation: str | None,
        key: str,
        expected: Any,
        actual_params: Dict[str, Any],
    ) -> bool:
        if operation == "perception.summarizeVisible" and key == "measures":
            return self._measure_match(expected, actual_params)
        if operation == "parallelCoordinates.selectCohort" and key == "rules":
            return self._rules_match(expected, actual_params.get("rules"))
        method = "set_equal" if key in {"values", "groupBy"} else ""
        return value_match(actual_params.get(key), expected, method=method)

    @staticmethod
    def _normalize_metric(value: Any) -> str:
        normalized = str(value or "").strip().lower()
        return {"avg": "mean", "average": "mean"}.get(normalized, normalized)

    def _measure_match(self, expected: Any, actual_params: Dict[str, Any]) -> bool:
        if not isinstance(expected, list):
            return value_match(actual_params.get("measures"), expected)
        expected_items = [item for item in expected if isinstance(item, dict)]
        expected_non_count = {
            (self._normalize_metric(item.get("op")), item.get("field"))
            for item in expected_items
            if self._normalize_metric(item.get("op")) != "count"
        }
        if isinstance(actual_params.get("measures"), list):
            actual_non_count = {
                (self._normalize_metric(item.get("op")), item.get("field"))
                for item in actual_params["measures"]
                if (
                    isinstance(item, dict)
                    and self._normalize_metric(item.get("op")) != "count"
                )
            }
            return actual_non_count == expected_non_count

        metrics = {
            self._normalize_metric(metric)
            for metric in actual_params.get("metrics", [])
            if self._normalize_metric(metric) != "count"
        }
        fields = set(actual_params.get("fields", []))
        expected_metrics = {op for op, _ in expected_non_count}
        expected_fields = {field for _, field in expected_non_count if field is not None}
        # summarizeVisible always returns rowCount, so an expected count need
        # not be repeated in metrics. All other requested fields/metrics must
        # match exactly to avoid rewarding broad, answer-leaking reads.
        return metrics == expected_metrics and fields == expected_fields

    @staticmethod
    def _rules_match(expected: Any, actual: Any) -> bool:
        if not isinstance(expected, list) or not isinstance(actual, list):
            return False
        normalized_actual = [
            {
                "field": item.get("field", item.get("dimension")),
                "range": item.get("range"),
            }
            for item in actual
            if isinstance(item, dict)
        ]
        normalized_expected = [
            {
                "field": item.get("field", item.get("dimension")),
                "range": item.get("range"),
            }
            for item in expected
            if isinstance(item, dict)
        ]
        return len(normalized_actual) == len(normalized_expected) and all(
            any(value_match(candidate, item) for candidate in normalized_actual)
            for item in normalized_expected
        )

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
