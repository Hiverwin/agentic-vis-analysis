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
            return self._matches_selection(actual, expected)
        if property_name == "transforms" and isinstance(expected, dict):
            return self._matches_filter(actual, expected)
        if property_name == "view" and isinstance(expected, dict) and "domain" in expected:
            domains = actual.get("xDomain") if isinstance(actual, dict) else None
            return value_match(domains, expected.get("domain"), tolerance=tolerance)
        return value_match(actual, expected, method=method, tolerance=tolerance)

    @staticmethod
    def _matches_selection(actual: Any, expected: Dict[str, Any]) -> bool:
        candidates = (
            [actual]
            if isinstance(actual, dict) and "field" in actual
            else list(actual.values()) if isinstance(actual, dict) else [actual]
        )
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            if candidate.get("field") != expected.get("field"):
                continue
            values = candidate.get("values")
            if values is None:
                predicates = candidate.get("predicates") or []
                values = predicates[0].get("value") if predicates and isinstance(predicates[0], dict) else None
            if value_match(values, expected.get("values"), method=expected.get("multiplicity", "")):
                return True
        return False

    @classmethod
    def _matches_filter(cls, actual: Any, expected: Dict[str, Any]) -> bool:
        candidates = actual if isinstance(actual, list) else [actual]
        for candidate in candidates:
            if not isinstance(candidate, dict) or candidate.get("kind") != expected.get("kind"):
                continue
            if "linkId" in expected and cls._link_identity(candidate.get("linkId")) != cls._link_identity(expected.get("linkId")):
                continue
            if "sourceWidgetId" in expected and candidate.get("sourceWidgetId") != expected.get("sourceWidgetId"):
                continue
            clauses = candidate.get("predicates") or candidate.get("params", {}).get("predicates")
            if not clauses:
                predicate = candidate.get("predicate")
                clauses = [predicate] if isinstance(predicate, dict) else []
            if not clauses and "values" in expected and value_match(candidate.get("values"), expected.get("values")):
                return True
            if cls._matches_expected_filter_clauses(clauses, expected):
                return True
        return False

    @staticmethod
    def _link_identity(value: Any) -> Any:
        if not isinstance(value, str):
            return value
        return value.rsplit("/link/", 1)[-1]

    @staticmethod
    def _matches_expected_filter_clauses(clauses: list[Any], expected: Dict[str, Any]) -> bool:
        expected_clauses = expected.get("predicates")
        if expected_clauses is not None:
            if expected.get("mode") == "all" and len(clauses) < len(expected_clauses):
                return False
            return all(
                any(StateEvaluator._matches_filter_clause(actual_clause, expected_clause) for actual_clause in clauses)
                for expected_clause in expected_clauses
            )
        if "field" in expected or "values" in expected or "range" in expected:
            return any(StateEvaluator._matches_filter_clause(clause, expected) for clause in clauses)
        return True

    @staticmethod
    def _matches_filter_clause(actual: Any, expected: Dict[str, Any]) -> bool:
        if not isinstance(actual, dict):
            return False
        if "field" in expected and actual.get("field") != expected.get("field"):
            return False
        expected_values = expected.get("values")
        actual_values = actual.get("value")
        if expected_values is not None and not value_match(actual_values, expected_values):
            return False
        expected_range = expected.get("range")
        if expected_range is not None and not value_match(actual_values, expected_range):
            return False
        mode = expected.get("mode")
        operation = actual.get("op")
        if mode == "include" and operation not in {"in", "eq", "equals"}:
            return False
        if mode == "exclude" and operation not in {"notIn", "neq", "notEquals"}:
            return False
        if mode == "between" and operation not in {"between", "inRange"}:
            return False
        return True
