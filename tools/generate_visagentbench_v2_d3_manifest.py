#!/usr/bin/env python3

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
V2_ROOT = REPO_ROOT / "visagentbench_v2"
BENCHMARK_ROOT = V2_ROOT / "benchmarks"
MANIFEST_ROOT = V2_ROOT / "manifests"
SUPPORTED_WIDGET_KINDS = {
    "scatter",
    "bar",
    "heatmap",
    "line",
    "parallelCoordinates",
    "sankey",
}


def read_json(path: Path) -> Any:
    return json.loads(path.read_text())


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


def main() -> None:
    partition_counts = Counter()
    supported_paths: list[dict[str, Any]] = []

    for path in sorted(BENCHMARK_ROOT.rglob("*.json")):
        benchmark = read_json(path)
        widget_kind = benchmark.get("widget_kind")
        if widget_kind not in SUPPORTED_WIDGET_KINDS:
            continue

        partition = benchmark.get("benchmark_partition", "unknown")
        partition_counts[partition] += 1
        supported_paths.append(
            {
                "benchmark_id": benchmark.get("benchmark_id"),
                "partition": partition,
                "widget_kind": widget_kind,
                "path": str(path.relative_to(V2_ROOT)),
                "dataset_path": benchmark.get("data_source", {}).get("dataset_path"),
            }
        )

    write_json(
        MANIFEST_ROOT / "d3_materialization_catalog.json",
        {
            "supported_widget_kinds": sorted(SUPPORTED_WIDGET_KINDS),
            "benchmark_counts": dict(partition_counts),
            "benchmarks": supported_paths,
        },
    )
    print(f"generated d3 materialization manifest: {len(supported_paths)} benchmarks")


if __name__ == "__main__":
    main()
