#!/usr/bin/env python3

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
V2_ROOT = REPO_ROOT / "visagentbench_v2"
BENCHMARK_ROOT = V2_ROOT / "benchmarks"
MANIFEST_ROOT = V2_ROOT / "manifests"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text())


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


def renderer_profiles() -> list[dict[str, Any]]:
    return [
        {
            "renderer": "vega",
            "status": "ready",
            "adapter_family": "VegaLiteWidgetAdapter",
            "transport_options": ["in-page", "playwright", "websocket", "browser-extension"],
            "required_benchmark_fields": [
                "widget_kind",
                "question_set",
                "required_capabilities",
                "renderer_state_checks.vega",
                "materializations.vega.spec_path",
            ],
        },
        {
            "renderer": "d3",
            "status": "contract_ready",
            "adapter_family": "D3WidgetAdapter",
            "transport_options": ["in-page", "playwright", "websocket", "browser-extension"],
            "required_benchmark_fields": [
                "widget_kind",
                "question_set",
                "required_capabilities",
                "data_source.dataset_path",
                "canonical_state_checks",
            ],
        },
        {
            "renderer": "echarts",
            "status": "contract_ready",
            "adapter_family": "EChartsWidgetAdapter",
            "transport_options": ["in-page", "playwright", "websocket", "browser-extension"],
            "required_benchmark_fields": [
                "widget_kind",
                "question_set",
                "required_capabilities",
                "data_source.dataset_path",
                "canonical_state_checks",
            ],
        },
        {
            "renderer": "custom",
            "status": "contract_ready",
            "adapter_family": "CustomWidgetAdapter",
            "transport_options": ["in-page", "playwright", "websocket", "browser-extension"],
            "required_benchmark_fields": [
                "widget_kind",
                "question_set",
                "required_capabilities",
                "data_source.dataset_path",
                "canonical_state_checks",
            ],
        },
    ]


def main() -> None:
    partition_counts = Counter()
    widget_kind_counts = Counter()
    question_style_counts = Counter()
    capability_counts = Counter()
    partition_widget_counts: dict[str, Counter] = defaultdict(Counter)

    for path in sorted(BENCHMARK_ROOT.rglob("*.json")):
        benchmark = read_json(path)
        partition = benchmark.get("benchmark_partition", "unknown")
        widget_kind = benchmark.get("widget_kind", "unknown")
        partition_counts[partition] += 1
        widget_kind_counts[widget_kind] += 1
        partition_widget_counts[partition][widget_kind] += 1

        for question in benchmark.get("question_set", []):
            question_style = question.get("question_style", "unknown")
            question_style_counts[question_style] += 1
            ground_truth = question.get("ground_truth") or {}
            for capability in ground_truth.get("required_capabilities", []):
                capability_counts[capability] += 1

    write_json(
        MANIFEST_ROOT / "benchmark_catalog.json",
        {
            "benchmark_counts": {
                "by_partition": dict(partition_counts),
                "by_widget_kind": dict(widget_kind_counts),
                "by_question_style": dict(question_style_counts),
            },
            "partition_widget_counts": {
                partition: dict(counter)
                for partition, counter in sorted(partition_widget_counts.items())
            },
            "top_required_capabilities": [
                {"capability": capability, "count": count}
                for capability, count in capability_counts.most_common(50)
            ],
        },
    )
    write_json(
        MANIFEST_ROOT / "renderer_profiles.json",
        {
            "renderers": renderer_profiles(),
        },
    )
    print("generated visagentbench_v2 manifests")


if __name__ == "__main__":
    main()
