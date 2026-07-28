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
            ok = value_match(
                observed.get("actual"),
                check.get("expected"),
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
