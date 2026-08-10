"""Pure batch-matrix expansion helpers."""

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from .model_registry import get_benchmark_model


@dataclass(frozen=True)
class RunSpec:
    instance_path: Path
    model_key: str
    planner_level: int


def expand_run_specs(
    instance_paths: Iterable[Path],
    *,
    models: Iterable[str],
    planner_levels: Iterable[int],
) -> list[RunSpec]:
    paths = list(instance_paths)
    selected_models = list(models)
    levels = list(planner_levels)
    if not levels or any(level not in (0, 1, 2, 3) for level in levels):
        raise ValueError("planner_levels must contain only 0, 1, 2, or 3")
    for model_key in selected_models:
        get_benchmark_model(model_key)
    return [
        RunSpec(path, model_key, level)
        for path in paths
        for model_key in selected_models
        for level in levels
    ]
