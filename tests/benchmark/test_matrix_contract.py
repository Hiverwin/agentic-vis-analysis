from pathlib import Path

from benchmark.matrix import RunSpec, expand_run_specs
from benchmark.model_registry import get_benchmark_model, list_benchmark_models
from benchmark.artifacts import result_directory


def test_benchmark_model_set_replaces_mistral_with_kimi():
    models = list_benchmark_models()

    assert "kimi" in models
    assert "mistral" not in models
    assert "deepseek" not in models
    assert get_benchmark_model("kimi").model == "moonshotai/kimi-k2.5"


def test_matrix_expands_all_planner_levels_for_each_instance():
    specs = expand_run_specs(
        [Path("instances/a.json"), Path("instances/b.json")],
        models=["gemini"],
        planner_levels=[1, 2, 3],
    )

    assert [(spec.instance_path.name, spec.planner_level) for spec in specs] == [
        ("a.json", 1),
        ("a.json", 2),
        ("a.json", 3),
        ("b.json", 1),
        ("b.json", 2),
        ("b.json", 3),
    ]
    assert all(isinstance(spec, RunSpec) for spec in specs)


def test_result_directory_is_stable_and_model_agnostic():
    path = result_directory(
        Path("benchmark/results/20260728_120000"),
        model_key="kimi",
        planner_level=2,
        benchmark_id="sp_barscatter_001",
    )

    assert path == Path(
        "benchmark/results/20260728_120000/kimi/planner_level_2/sp_barscatter_001"
    )
