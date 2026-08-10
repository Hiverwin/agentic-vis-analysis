"""Run the WidgetVA Kit benchmark matrix.

This is only an experiment scheduler. The actual model/runtime execution lives
in ``benchmark.runner`` and every model uses that same Kit path.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from benchmark.artifacts import result_directory
from benchmark.matrix import RunSpec, expand_run_specs
from benchmark.model_registry import get_benchmark_model, list_benchmark_models


ROOT = Path(__file__).resolve().parent


def load_instances(raw_paths: list[str]) -> list[Path]:
    paths: list[Path] = []
    seen: set[Path] = set()
    for raw_path in raw_paths:
        path = Path(raw_path).expanduser().resolve()
        candidates = sorted(path.rglob("*.json")) if path.is_dir() else [path]
        for candidate in candidates:
            if candidate.is_file() and candidate not in seen:
                seen.add(candidate)
                paths.append(candidate)
    return paths


def filter_instances(paths: list[Path], prefixes: list[str] | None, pattern: str | None) -> list[Path]:
    filtered = paths
    if prefixes:
        allowed = {item for raw in prefixes for item in raw.replace(",", " ").split()}
        filtered = [path for path in filtered if any(path.stem.startswith(prefix) for prefix in allowed)]
    if pattern:
        import fnmatch

        filtered = [path for path in filtered if fnmatch.fnmatch(path.name, pattern)]
    return filtered


def instance_benchmark_id(instance_path: Path) -> str:
    instance = json.loads(instance_path.read_text(encoding="utf-8"))
    benchmark_id = instance.get("benchmark_id")
    if not benchmark_id:
        raise ValueError(f"Missing benchmark_id in {instance_path}")
    return benchmark_id


def result_path_for(spec: RunSpec, results_root: Path) -> Path:
    return (
        result_directory(
            results_root,
            model_key=spec.model_key,
            planner_level=spec.planner_level,
            benchmark_id=instance_benchmark_id(spec.instance_path),
        )
        / "result.json"
    )


async def run_job(
    spec: RunSpec,
    *,
    results_root: Path,
    log_path: Path,
    semaphore: asyncio.Semaphore,
    retries: int,
    timeout: int,
    max_iterations: int | None,
) -> dict[str, Any]:
    result_path = result_path_for(spec, results_root)
    instance_snapshot = result_path.parent / "instance.json"
    instance_snapshot.parent.mkdir(parents=True, exist_ok=True)
    if not instance_snapshot.exists():
        shutil.copy2(spec.instance_path, instance_snapshot)
    evaluator_cmd = [
        sys.executable,
        "-m",
        "evaluators.run_evaluation",
        "--instance",
        str(instance_snapshot),
        "--result",
        str(result_path),
    ]
    runner_cmd = [
        sys.executable,
        "-m",
        "benchmark.runner",
        str(spec.instance_path),
        "--model",
        spec.model_key,
        "--planner-level",
        str(spec.planner_level),
        "--results-root",
        str(results_root),
    ]
    if max_iterations is not None:
        runner_cmd.extend(["--max-iterations", str(max_iterations)])

    async with semaphore:
        for attempt in range(retries + 1):
            log_path.parent.mkdir(parents=True, exist_ok=True)
            with log_path.open("w", encoding="utf-8") as log:
                log.write("$ " + " ".join(runner_cmd) + "\n\n")
                process = await asyncio.create_subprocess_exec(
                    *runner_cmd,
                    cwd=ROOT,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                )
                try:
                    return_code = await asyncio.wait_for(process.wait(), timeout=timeout or None)
                except asyncio.TimeoutError:
                    process.kill()
                    await process.wait()
                    return_code = -9
                    log.write(f"\nTimed out after {timeout}s\n")

            if return_code == 0 and result_path.exists():
                evaluator = await asyncio.create_subprocess_exec(
                    *evaluator_cmd,
                    cwd=ROOT,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                )
                evaluator_output, _ = await evaluator.communicate()
                log_path.open("a", encoding="utf-8").write(
                    "\n$ " + " ".join(evaluator_cmd) + "\n" + evaluator_output.decode(errors="replace")
                )
                if evaluator.returncode == 0:
                    return {"ok": True, "result_path": str(result_path), "attempt": attempt + 1}

            if attempt < retries:
                continue
            return {
                "ok": False,
                "result_path": str(result_path),
                "attempt": attempt + 1,
                "error": f"runner exit code {return_code}",
            }

    raise AssertionError("unreachable")


def read_scores(result_path: Path) -> dict[str, Any]:
    evaluation_path = result_path.parent / "evaluation.json"
    if not evaluation_path.exists():
        return {}
    try:
        evaluation = json.loads(evaluation_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return evaluation.get("scores", {})


async def main() -> None:
    parser = argparse.ArgumentParser(description="Run the WidgetVA Kit benchmark matrix")
    parser.add_argument("instances", nargs="+", help="Instance JSON files or directories")
    parser.add_argument("--models", nargs="+", choices=list_benchmark_models(), default=list_benchmark_models())
    parser.add_argument("--planner-levels", nargs="+", type=int, choices=(0, 1, 2, 3), default=[0, 1, 2, 3])
    parser.add_argument("--task-filter", nargs="*", help="Filter by instance filename prefix")
    parser.add_argument("--task-pattern", help="Filter by instance filename glob")
    parser.add_argument("--output-dir", default="benchmark/results/batch")
    parser.add_argument("--log-dir", default="benchmark/logs/batch")
    parser.add_argument("--resume-dir", help="Reuse an existing batch directory")
    parser.add_argument("--skip-done", action="store_true")
    parser.add_argument("--concurrency", type=int, default=1)
    parser.add_argument("--retries", type=int, default=1)
    parser.add_argument("--job-timeout", type=int, default=0)
    parser.add_argument("--max-iterations", type=int, default=None)
    args = parser.parse_args()

    instances = filter_instances(load_instances(args.instances), args.task_filter, args.task_pattern)
    if not instances:
        parser.error("No benchmark instances matched the supplied paths")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_root = Path(args.resume_dir) if args.resume_dir else Path(args.output_dir) / timestamp
    logs_root = Path(args.log_dir) / results_root.name
    results_root.mkdir(parents=True, exist_ok=True)
    logs_root.mkdir(parents=True, exist_ok=True)

    specs = expand_run_specs(instances, models=args.models, planner_levels=args.planner_levels)
    manifest = {
        "schema_version": 1,
        "created_at": datetime.now().isoformat(),
        "models": list(args.models),
        "planner_levels": list(args.planner_levels),
        "max_iterations": args.max_iterations,
        "model_max_iterations": {
            model_key: (args.max_iterations if args.max_iterations is not None else get_benchmark_model(model_key).max_iterations)
            for model_key in args.models
        },
        "instances": [str(path) for path in instances],
        "runtime": "widgetva-kit",
    }
    (results_root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    semaphore = asyncio.Semaphore(max(1, args.concurrency))
    jobs: list[tuple[RunSpec, Path, asyncio.Task[dict[str, Any]] | None]] = []
    for spec in specs:
        result_path = result_path_for(spec, results_root)
        log_path = logs_root / spec.model_key / f"{spec.instance_path.stem}_planner_{spec.planner_level}.log"
        if args.skip_done and result_path.exists():
            jobs.append((spec, result_path, None))
        else:
            task = asyncio.create_task(
                run_job(
                    spec,
                    results_root=results_root,
                    log_path=log_path,
                    semaphore=semaphore,
                    retries=max(0, args.retries),
                    timeout=max(0, args.job_timeout),
                    max_iterations=args.max_iterations,
                )
            )
            jobs.append((spec, result_path, task))

    print(f"Running {len(jobs)} jobs with runtime=widgetva-kit")
    outcomes: list[dict[str, Any]] = []

    def write_manifest() -> None:
        (results_root / "manifest.json").write_text(
            json.dumps({**manifest, "outcomes": outcomes}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    for index, (spec, result_path, task) in enumerate(jobs, start=1):
        outcome = {"model": spec.model_key, "planner_level": spec.planner_level, "instance": spec.instance_path.name}
        if task is None:
            outcome["ok"] = True
            outcome["skipped"] = True
        else:
            outcome.update(await task)
        outcome["scores"] = read_scores(result_path)
        outcomes.append(outcome)
        write_manifest()
        print(f"[{index}/{len(jobs)}] {spec.model_key}/L{spec.planner_level}/{spec.instance_path.stem}: {outcome}")

    failed = sum(not outcome.get("ok") for outcome in outcomes)
    print(f"Finished: {len(outcomes) - failed} succeeded, {failed} failed")


if __name__ == "__main__":
    asyncio.run(main())
