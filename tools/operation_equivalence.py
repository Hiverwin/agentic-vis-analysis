"""Utilities for materializing operation alternatives into benchmark steps."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EQUIVALENCE_PATH = REPO_ROOT / "visagentbench_kit" / "operation_equivalence.json"


def load_operation_equivalence(path: Path = DEFAULT_EQUIVALENCE_PATH) -> dict[str, list[str]]:
    """Load operation equivalence as operation -> candidate alternative operations."""
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    operations = data.get("operations", {})
    if not isinstance(operations, dict):
        raise ValueError(f"Invalid operation equivalence file: {path}")

    mapping: dict[str, list[str]] = {}
    for operation, config in operations.items():
        if not isinstance(config, dict):
            raise ValueError(f"Invalid operation equivalence entry for {operation!r}")
        candidates: list[str] = []
        for key in ("equivalent", "alternatives"):
            values = config.get(key, [])
            if not isinstance(values, list):
                raise ValueError(f"Invalid {key!r} list for {operation!r}")
            candidates.extend(value for value in values if isinstance(value, str))
        mapping[operation] = _unique_without(candidates, operation)
    return mapping


def materialize_step_alternatives(
    steps: list[dict[str, Any]],
    equivalence: dict[str, list[str]] | None = None,
) -> list[dict[str, Any]]:
    """Return copied tool steps with derivable runtime-shaped operation alternatives."""
    operation_alternatives = equivalence if equivalence is not None else load_operation_equivalence()
    materialized_steps: list[dict[str, Any]] = []
    for step in steps:
        materialized = dict(step)
        operation = str(materialized.get("operation") or "")
        params = materialized.get("params", {})
        if not isinstance(params, dict):
            raise ValueError(f"Invalid params for step {materialized.get('step_id')!r}")
        alternatives = operation_alternatives.get(operation, [])
        if alternatives:
            materialized["alternatives"] = alternatives
            alternative_steps = []
            for alternative in alternatives:
                alternative_params = derive_alternative_params(operation, alternative, params)
                if alternative_params is not None:
                    alternative_steps.append({
                        "operation": alternative,
                        "params": alternative_params,
                    })
            if alternative_steps:
                materialized["alternative_steps"] = alternative_steps
            else:
                materialized.pop("alternative_steps", None)
        else:
            materialized.pop("alternatives", None)
            materialized.pop("alternative_steps", None)
        materialized_steps.append(materialized)
    return materialized_steps


def derive_alternative_params(source_operation: str, target_operation: str, params: dict[str, Any]) -> dict[str, Any] | None:
    """Derive target runtime params for safe operation alternatives."""
    if source_operation == target_operation:
        return deepcopy(params)

    if {source_operation, target_operation} <= {"bar.clickCategory", "bar.selectCategory"}:
        return _derive_bar_selection_params(params)
    if source_operation in {"bar.clickCategory", "bar.selectCategory"} and target_operation == "bar.filterCategories":
        return _derive_bar_filter_params(params)
    if source_operation == "bar.filterCategories" and target_operation in {"bar.clickCategory", "bar.selectCategory"}:
        return _derive_bar_selection_from_filter_params(params)

    if {source_operation, target_operation} <= {"scatter.brushRegion", "scatter.selectRegion"}:
        return deepcopy(params)

    if {source_operation, target_operation} <= {"heatmap.filterCells", "heatmap.selectCell"}:
        return _derive_heatmap_cell_params(params)
    if source_operation in {"heatmap.selectSubmatrix", "heatmap.highlightRegion", "heatmap.filterCellsByRegion"} and target_operation in {"heatmap.selectSubmatrix", "heatmap.highlightRegion", "heatmap.filterCellsByRegion"}:
        return _derive_heatmap_region_params(params)
    if {source_operation, target_operation} <= {"heatmap.thresholdMask", "heatmap.highlightRegionByValue"}:
        return _derive_value_range_params(params)

    if source_operation in {"line.selectSeries", "line.focusLines", "line.boldLines"} and target_operation in {"line.selectSeries", "line.focusLines", "line.boldLines"}:
        return _derive_line_series_params(target_operation, params)

    return None


def _derive_bar_selection_params(params: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(params.get("field"), str) or not isinstance(params.get("values"), list):
        return None
    return _pick(params, ["field", "values", "queryScope"])


def _derive_bar_filter_params(params: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(params.get("values"), list):
        return None
    derived = {"categories": deepcopy(params["values"])}
    if isinstance(params.get("field"), str):
        derived["field"] = params["field"]
    if isinstance(params.get("queryScope"), dict):
        derived["queryScope"] = deepcopy(params["queryScope"])
    return derived


def _derive_bar_selection_from_filter_params(params: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(params.get("field"), str) or not isinstance(params.get("categories"), list):
        return None
    derived = {
        "field": params["field"],
        "values": deepcopy(params["categories"]),
    }
    if isinstance(params.get("queryScope"), dict):
        derived["queryScope"] = deepcopy(params["queryScope"])
    return derived


def _derive_heatmap_cell_params(params: dict[str, Any]) -> dict[str, Any] | None:
    required = ["xField", "yField", "xValue", "yValue"]
    if any(key not in params for key in required):
        return None
    return _pick(params, [*required, "queryScope"])


def _derive_heatmap_region_params(params: dict[str, Any]) -> dict[str, Any] | None:
    derived: dict[str, Any] = {}
    if isinstance(params.get("xValues"), list):
        derived["xValues"] = deepcopy(params["xValues"])
    elif "xValue" in params:
        derived["xValues"] = [deepcopy(params["xValue"])]
    if isinstance(params.get("yValues"), list):
        derived["yValues"] = deepcopy(params["yValues"])
    elif "yValue" in params:
        derived["yValues"] = [deepcopy(params["yValue"])]
    if not derived:
        return None
    if isinstance(params.get("queryScope"), dict):
        derived["queryScope"] = deepcopy(params["queryScope"])
    return derived


def _derive_value_range_params(params: dict[str, Any]) -> dict[str, Any] | None:
    derived = _pick(params, ["minValue", "maxValue", "outsideOpacity", "queryScope"])
    if "minValue" not in derived and "maxValue" not in derived:
        return None
    return derived


def _derive_line_series_params(target_operation: str, params: dict[str, Any]) -> dict[str, Any] | None:
    field = params.get("field") if isinstance(params.get("field"), str) else params.get("lineField")
    values = params.get("values")
    if not isinstance(values, list):
        values = params.get("lines")
    if not isinstance(values, list):
        values = params.get("lineNames")
    if not isinstance(field, str) or not isinstance(values, list):
        return None
    if target_operation == "line.selectSeries":
        derived = {"field": field, "values": deepcopy(values)}
    elif target_operation == "line.focusLines":
        derived = {"lines": deepcopy(values), "lineField": field}
    elif target_operation == "line.boldLines":
        derived = {"lineNames": deepcopy(values), "lineField": field}
    else:
        return None
    if isinstance(params.get("queryScope"), dict):
        derived["queryScope"] = deepcopy(params["queryScope"])
    return derived


def _pick(params: dict[str, Any], keys: list[str]) -> dict[str, Any]:
    return {
        key: deepcopy(params[key])
        for key in keys
        if key in params
    }


def _unique_without(values: list[str], excluded: str) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for value in values:
        if value == excluded or value in seen:
            continue
        seen.add(value)
        unique.append(value)
    return unique
