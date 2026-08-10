"""Stable paths for one benchmark experiment."""

from pathlib import Path


def result_directory(
    results_root: Path,
    *,
    model_key: str,
    planner_level: int,
    benchmark_id: str,
) -> Path:
    if planner_level not in (0, 1, 2, 3):
        raise ValueError("planner_level must be 0, 1, 2, or 3")
    if not benchmark_id:
        raise ValueError("benchmark_id is required")
    return results_root / model_key / f"planner_level_{planner_level}" / benchmark_id
