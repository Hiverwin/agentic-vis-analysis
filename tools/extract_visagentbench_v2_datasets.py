#!/usr/bin/env python3

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
V2_ROOT = REPO_ROOT / "visagentbench_v2"
BENCHMARK_ROOT = V2_ROOT / "benchmarks"
DATASET_ROOT = V2_ROOT / "datasets"
SPEC_ROOT = REPO_ROOT / "benchmark_annotation_system" / "backend" / "specs"
DATA_ROOT = REPO_ROOT / "benchmark_annotation_system" / "backend" / "data"
MANIFEST_ROOT = V2_ROOT / "manifests"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text())


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


def load_dataset_rows(dataset_id: str) -> tuple[list[Any] | None, str | None]:
    spec_path = SPEC_ROOT / f"{dataset_id}.json"
    if spec_path.exists():
      spec = read_json(spec_path)
      data = spec.get("data")
      if isinstance(data, dict) and isinstance(data.get("values"), list):
          return data["values"], f"benchmark_annotation_system/backend/specs/{spec_path.name}"

    data_path = DATA_ROOT / f"{dataset_id}.json"
    if data_path.exists():
        data = read_json(data_path)
        if isinstance(data, list):
            return data, f"benchmark_annotation_system/backend/data/{data_path.name}"
        if isinstance(data, dict):
            if isinstance(data.get("values"), list):
                return data["values"], f"benchmark_annotation_system/backend/data/{data_path.name}"
            if isinstance(data.get("data"), list):
                return data["data"], f"benchmark_annotation_system/backend/data/{data_path.name}"

    return None, None


def main() -> None:
    dataset_entries: dict[str, dict[str, Any]] = {}

    for benchmark_path in sorted(BENCHMARK_ROOT.rglob("*.json")):
        benchmark = read_json(benchmark_path)
        data_source = benchmark.get("data_source") or {}
        dataset_id = data_source.get("dataset_id")
        dataset_path = data_source.get("dataset_path")
        if not dataset_id or not dataset_path:
            continue

        rows, source_path = load_dataset_rows(dataset_id)
        if rows is None:
            continue

        output_path = DATASET_ROOT / f"{dataset_id}.json"
        write_json(output_path, rows)
        dataset_entries[dataset_id] = {
            "dataset_id": dataset_id,
            "dataset_path": f"datasets/{dataset_id}.json",
            "row_count": len(rows),
            "source_path": source_path,
        }

    write_json(
        MANIFEST_ROOT / "dataset_index.json",
        {
            "dataset_count": len(dataset_entries),
            "datasets": [dataset_entries[key] for key in sorted(dataset_entries)],
        },
    )
    print(f"extracted datasets: {len(dataset_entries)}")


if __name__ == "__main__":
    main()
