"""State Score over canonical runtime state checks."""

from dataclasses import dataclass
from typing import Any, Dict

from .common import value_match


@dataclass
class StateEvalResult:
    score: float
    details: Dict[str, Any]


class StateEvaluator:
    def evaluate(self, instance: Dict[str, Any], result: Dict[str, Any]) -> StateEvalResult:
        expected_state = instance.get("evaluation", {}).get("state", {})
        if expected_state.get("applicable") is False:
            return StateEvalResult(score=None, details={"applicable": False, "checks": []})
        expected = expected_state.get("checks", [])
        actual = {check.get("check_id"): check for check in result.get("state", {}).get("checks", [])}
        checks = []
        for check in expected:
            observed = actual.get(check.get("check_id"), {})
            ok = self._matches_check(
                observed.get("actual"),
                check.get("expected"),
                property_name=check.get("property"),
                method=check.get("method", ""),
                tolerance=float(check.get("tolerance", 0.0)),
            )
            checks.append({
                "check_id": check.get("check_id"),
                "state_ref": check.get("state_ref"),
                "property": check.get("property"),
                "score": 1.0 if ok else 0.0,
                "expected": check.get("expected"),
                "actual": observed.get("actual"),
            })
        score = sum(check["score"] for check in checks) / len(checks) if checks else None
        return StateEvalResult(score=score, details={"applicable": True, "checks": checks})

    def _matches_check(self, actual: Any, expected: Any, *, property_name: str = "", method: str = "", tolerance: float = 0.0) -> bool:
        if property_name == "selections" and isinstance(expected, dict):
            return self._matches_selection(actual, expected, tolerance=tolerance)
        if property_name == "transforms" and isinstance(expected, dict):
            return self._matches_transform(actual, expected, tolerance=tolerance)
        if property_name == "view" and isinstance(expected, dict):
            if "xDomain" in expected:
                return value_match(
                    actual.get("xDomain") if isinstance(actual, dict) else None,
                    expected.get("xDomain"),
                    tolerance=tolerance,
                )
            return self._partial_match(actual, expected, tolerance=tolerance)
        return value_match(actual, expected, method=method, tolerance=tolerance)

    @staticmethod
    def _matches_selection(actual: Any, expected: Dict[str, Any], *, tolerance: float = 0.0) -> bool:
        candidates = (
            [actual]
            if isinstance(actual, dict) and "field" in actual
            else list(actual.values()) if isinstance(actual, dict) else [actual]
        )
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            if StateEvaluator._partial_match(candidate, expected, tolerance=tolerance):
                return True
        return False

    @classmethod
    def _matches_transform(cls, actual: Any, expected: Dict[str, Any], *, tolerance: float = 0.0) -> bool:
        candidates = actual if isinstance(actual, list) else [actual]
        for candidate in candidates:
            if isinstance(candidate, dict) and cls._partial_match(candidate, expected, tolerance=tolerance):
                return True
        return False

    @staticmethod
    def _partial_match(actual: Any, expected: Any, *, tolerance: float = 0.0) -> bool:
        if isinstance(expected, dict):
            if not isinstance(actual, dict):
                return False
            return all(
                key in actual and StateEvaluator._partial_match(actual[key], value, tolerance=tolerance)
                for key, value in expected.items()
            )
        if isinstance(expected, list):
            if not isinstance(actual, list):
                return False
            return all(
                any(StateEvaluator._partial_match(item, expected_item, tolerance=tolerance) for item in actual)
                for expected_item in expected
            )
        return value_match(actual, expected, tolerance=tolerance)
