"""State Score over canonical runtime state checks."""

from dataclasses import dataclass
import re
from typing import Any, Dict

from .common import value_match


@dataclass
class StateEvalResult:
    score: float
    details: Dict[str, Any]


def _short_ref(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    return value.rstrip("/").rsplit("/", 1)[-1]


def _as_candidates(actual: Any, property_name: str | None) -> list[Any]:
    if isinstance(actual, list):
        return actual
    if (
        property_name == "selections"
        and isinstance(actual, dict)
        and actual
        and all(isinstance(value, dict) for value in actual.values())
    ):
        return list(actual.values())
    return [actual]


def _predicates(value: Any) -> list[Dict[str, Any]]:
    if not isinstance(value, dict):
        return []
    predicates = value.get("predicates")
    if predicates is None:
        predicates = value.get("predicate")
    if predicates is None and isinstance(value.get("spec"), dict):
        predicates = value["spec"].get("predicates")
    if isinstance(predicates, dict):
        return [predicates]
    return [item for item in predicates or [] if isinstance(item, dict)]


def _expected_predicates(expected: Dict[str, Any]) -> list[Dict[str, Any]]:
    if isinstance(expected.get("rules"), list):
        return expected["rules"]
    if isinstance(expected.get("predicates"), list):
        return expected["predicates"]
    if expected.get("field") is not None:
        predicate = {"field": expected["field"]}
        if "values" in expected:
            predicate["values"] = expected["values"]
        if "range" in expected:
            predicate["range"] = expected["range"]
        return [predicate]
    return []


def _predicate_match(actual: Dict[str, Any], expected: Dict[str, Any], tolerance: float) -> bool:
    if not value_match(actual.get("field"), expected.get("field"), tolerance=tolerance):
        return False
    expected_value = (
        expected.get("range")
        if "range" in expected
        else expected.get("values", expected.get("value"))
    )
    actual_value = actual.get("value", actual.get("values", actual.get("range")))
    if expected_value is None:
        return True
    method = "set_equal" if "values" in expected else ""
    return value_match(actual_value, expected_value, method=method, tolerance=tolerance)


def _predicates_match(actual: Any, expected: Dict[str, Any], tolerance: float) -> bool:
    expected_items = _expected_predicates(expected)
    if not expected_items:
        return True
    actual_items = _predicates(actual)
    return len(actual_items) == len(expected_items) and all(
        any(_predicate_match(candidate, item, tolerance) for candidate in actual_items)
        for item in expected_items
    )


def _canonical_state_match(
    actual: Any,
    expected: Any,
    *,
    property_name: str | None,
    method: str,
    tolerance: float,
) -> bool:
    if not isinstance(expected, dict):
        return value_match(actual, expected, method=method, tolerance=tolerance)
    if not isinstance(actual, dict):
        return False

    expected_predicates = (
        _expected_predicates(expected)
        if property_name in {"selections", "transforms"}
        else []
    )
    canonical_predicates_used = bool(expected_predicates and _predicates(actual))
    if canonical_predicates_used and not _predicates_match(actual, expected, tolerance):
        return False

    for key, expected_value in expected.items():
        if key in {
            "field", "values", "range", "rules", "predicates",
            "conjunction", "boundaries", "multiplicity",
        } and canonical_predicates_used:
            # Canonical Kit state stores these semantics in predicate objects.
            continue
        if key == "linkId":
            actual_link = actual.get("linkId")
            if actual_link is None and isinstance(actual.get("params"), dict):
                actual_link = actual["params"].get("relationRef")
            if _short_ref(actual_link) != _short_ref(expected_value):
                return False
            continue
        if key == "sourceWidgetId":
            actual_source = actual.get("sourceWidgetId")
            if actual_source is None:
                actual_source = _short_ref(
                    re.sub(r"/selection/.*$|/view/.*$", "", str(actual.get("sourceRef") or ""))
                )
            if not value_match(actual_source, expected_value, tolerance=tolerance):
                return False
            continue
        if key == "mode":
            # The canonical predicate operator carries the old include/between/all mode.
            operators = {item.get("op") for item in _predicates(actual)}
            inferred = (
                "all" if len(_predicates(actual)) > 1
                else "between" if "between" in operators
                else "include" if operators & {"in", "eq"}
                else actual.get("mode")
            )
            if not value_match(inferred, expected_value, tolerance=tolerance):
                return False
            continue
        if key == "action":
            actual_action = actual.get("action")
            if actual_action is None and isinstance(actual.get("spec"), dict):
                actual_action = actual["spec"].get("actionName")
            if not value_match(actual_action, expected_value, tolerance=tolerance):
                return False
            continue
        if key == "domain" and property_name == "view":
            actual_domain = actual.get("domain", actual.get("xDomain"))
            if not value_match(actual_domain, expected_value, tolerance=tolerance):
                return False
            continue
        if key == "field" and property_name == "view" and "domain" in expected and "xDomain" in actual:
            # xDomain is the canonical Kit representation of the x-encoded field's domain.
            continue
        if key not in actual or not value_match(
            actual[key],
            expected_value,
            method=method,
            tolerance=tolerance,
        ):
            return False
    return True


def state_value_match(
    actual: Any,
    expected: Any,
    *,
    property_name: str | None,
    method: str = "",
    tolerance: float = 0.0,
) -> bool:
    candidates = _as_candidates(actual, property_name)
    if (
        property_name == "view"
        and isinstance(expected, dict)
        and expected.get("kind") == "highlight"
        and isinstance(actual, dict)
        and isinstance(actual.get("highlight"), dict)
    ):
        highlight = dict(actual["highlight"])
        highlight.setdefault("kind", "highlight")
        highlight.setdefault("linkId", highlight.get("relationRef"))
        source_ref = highlight.get("sourceStateRef")
        if "sourceWidgetId" not in highlight and isinstance(source_ref, str):
            match = re.search(r"/widget/([^/]+)", source_ref)
            if match:
                highlight["sourceWidgetId"] = match.group(1)
        if "selectedCount" not in highlight and isinstance(highlight.get("values"), list):
            highlight["selectedCount"] = len(highlight["values"])
        candidates.append(highlight)
    return any(
        _canonical_state_match(
            candidate,
            expected,
            property_name=property_name,
            method=method,
            tolerance=tolerance,
        )
        for candidate in candidates
    )


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
            ok = state_value_match(
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
