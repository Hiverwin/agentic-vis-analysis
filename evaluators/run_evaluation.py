#!/usr/bin/env python3
"""Evaluate current instance/result files with Answer, Tool and State scores."""

import argparse
import json
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

from .answer_evaluator import AnswerEvaluator
from .state_evaluator import StateEvaluator
from .tool_evaluator import ToolEvaluator


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def evaluate_one(instance: Dict[str, Any], result: Dict[str, Any]) -> Dict[str, Any]:
    answer = AnswerEvaluator().evaluate(result.get("answer", {}), instance.get("evaluation", {}).get("answer", {}))
    tool = ToolEvaluator().evaluate(instance, result)
    state = StateEvaluator().evaluate(instance, result)
    return {
        "benchmark_id": instance.get("benchmark_id", result.get("benchmark_id")),
        "task_id": instance.get("task_id", result.get("task_id")),
        "asl": instance.get("asl", result.get("asl")),
        "scores": {"answer": answer.score, "tool": tool.score, "state": state.score},
        "details": {"answer": answer.details, "tool": tool.details, "state": state.details},
    }


def evaluate_files(instance_path: Path, result_path: Path) -> Dict[str, Any]:
    return evaluate_one(load_json(instance_path), load_json(result_path))


def _find_instances(instances_dir: Path) -> Dict[str, Path]:
    return {path.stem: path for path in instances_dir.rglob("*.json")}


def evaluate_batch(instances_dir: Path, results_dir: Path) -> Iterable[Dict[str, Any]]:
    instances = _find_instances(instances_dir)
    for result_path in sorted(results_dir.rglob("result.json")):
        result = load_json(result_path)
        benchmark_id = result.get("benchmark_id")
        instance_path = instances.get(benchmark_id)
        if instance_path is None:
            continue
        evaluated = evaluate_one(load_json(instance_path), result)
        evaluated["instance_path"] = str(instance_path)
        evaluated["result_path"] = str(result_path)
        yield evaluated


SCORE_DIMENSIONS = ("answer", "tool", "state")


def _score_summary(values: Iterable[Optional[float]]) -> Dict[str, Any]:
    present = [float(value) for value in values if value is not None]
    return {
        "mean": sum(present) / len(present) if present else None,
        "count": len(present),
    }


def _failed_ids(items: Any, id_key: str) -> list[str]:
    if not isinstance(items, list):
        return []
    failed = []
    for item in items:
        if not isinstance(item, dict):
            continue
        score = item.get("score")
        is_failed = score != 1.0 if score is not None else item.get("matched") is not True
        if is_failed:
            failed.append(str(item.get(id_key, "<unknown>")))
    return failed


def _compact_failures(item: Dict[str, Any]) -> Dict[str, Any] | None:
    details = item.get("details", {})
    answer_checks = details.get("answer", {}).get("checks", [])
    tool_steps = details.get("tool", {}).get("required", {}).get("steps", [])
    state_checks = details.get("state", {}).get("checks", [])
    failure = {
        "benchmark_id": item.get("benchmark_id"),
        "answer": _failed_ids(answer_checks, "field"),
        "tool": _failed_ids(tool_steps, "step_id"),
        "state": _failed_ids(state_checks, "check_id"),
    }
    return failure if any(failure[key] for key in SCORE_DIMENSIONS) else None


def _group_scores(rows: list[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    return {
        dimension: _score_summary(row.get("scores", {}).get(dimension) for row in rows)
        for dimension in SCORE_DIMENSIONS
    }


def summarize_results(results: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    """Build an evaluator-owned experiment report from detailed per-run scores."""
    rows = list(results)
    by_asl: Dict[str, list[Dict[str, Any]]] = {}
    by_task: Dict[str, list[Dict[str, Any]]] = {}
    failures = []
    for row in rows:
        asl = row.get("asl")
        if asl is not None:
            by_asl.setdefault(str(asl), []).append(row)
        task_id = row.get("task_id")
        if task_id:
            by_task.setdefault(str(task_id), []).append(row)
        failure = _compact_failures(row)
        if failure:
            failures.append(failure)
    return {
        "schema_version": 1,
        "evaluated": len(rows),
        "overall": _group_scores(rows),
        "by_asl": {key: _group_scores(group) for key, group in sorted(by_asl.items())},
        "by_task": {key: _group_scores(group) for key, group in sorted(by_task.items())},
        "failures": failures,
    }


def write_instance_evaluations(results: Iterable[Dict[str, Any]]) -> list[Path]:
    """Write evaluator-owned output beside each immutable benchmark result."""
    paths = []
    for result in results:
        result_path = result.get("result_path")
        if not result_path:
            continue
        evaluation_path = Path(result_path).parent / "evaluation.json"
        evaluation = {"schema_version": 1, **result}
        evaluation_path.write_text(json.dumps(evaluation, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        paths.append(evaluation_path)
    return paths


def format_summary(results: Iterable[Dict[str, Any]]) -> str:
    """Render a compact report for people; JSON remains the detailed artifact."""
    rows = list(results)
    report = summarize_results(rows)
    lines = ["WidgetVA Evaluation Summary", "=" * 28, ""]
    lines.append(f"Evaluated: {report['evaluated']}")
    lines.append("Overall: " + ", ".join(
        f"{dimension}={summary['mean']:.2f} (n={summary['count']})"
        if summary["mean"] is not None else f"{dimension}=N/A"
        for dimension, summary in report["overall"].items()
    ))
    if report["by_asl"]:
        lines.append("By ASL:")
        for asl, scores in report["by_asl"].items():
            lines.append("  ASL " + asl + ": " + ", ".join(
                f"{dimension}={summary['mean']:.2f}"
                if summary["mean"] is not None else f"{dimension}=N/A"
                for dimension, summary in scores.items()
            ))
    if report["failures"]:
        lines.extend(["", "Failure reasons:"])
        for failure in report["failures"]:
            reasons = [
                f"{dimension}: {', '.join(failure[dimension])}"
                for dimension in SCORE_DIMENSIONS if failure[dimension]
            ]
            lines.append(f"  {failure['benchmark_id']}: " + "; ".join(reasons))
    lines.append("")
    for item in rows:
        scores = item.get("scores", {})
        details = item.get("details", {})
        required = details.get("tool", {}).get("required", {})
        state_details = details.get("state", {})
        answer = scores.get("answer")
        tool = scores.get("tool")
        state = scores.get("state")
        answer_text = "N/A" if answer is None else f"{answer:.2f}"
        tool_text = "N/A" if tool is None else f"{tool:.2f} (required {required.get('matched', 0)}/{required.get('total', 0)})"
        if state is None:
            state_text = "N/A (not applicable)"
        else:
            checks = state_details.get("checks", [])
            passed = sum(check.get("score") == 1.0 for check in checks)
            state_text = f"{state:.2f} ({passed}/{len(checks)} checks)"
        lines.extend([
            f"{item.get('benchmark_id', '<unknown>')}",
            f"  Answer: {answer_text}",
            f"  Tool:   {tool_text}",
            f"  State:  {state_text}",
        ])
        unscored = details.get("tool", {}).get("unscored_successful_calls", [])
        if unscored:
            lines.append("  Executed but not scored by required steps/state: " + ", ".join(unscored))
        lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--instance")
    parser.add_argument("--result")
    parser.add_argument("--instances-dir")
    parser.add_argument("--results-dir")
    parser.add_argument("-o", "--output", help="Output path for a single --instance/--result evaluation only.")
    args = parser.parse_args()

    if args.instance and args.result:
        output: Any = evaluate_files(Path(args.instance), Path(args.result))
        output["instance_path"] = str(Path(args.instance))
        output["result_path"] = str(Path(args.result))
        write_instance_evaluations([output])
        rows = [output]
        if args.output:
            Path(args.output).write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        else:
            print(json.dumps(output, ensure_ascii=False, indent=2))
    elif args.instances_dir and args.results_dir:
        if args.output:
            parser.error("--output is only supported with --instance/--result; batch evaluation writes evaluation.json beside each result.json")
        output = list(evaluate_batch(Path(args.instances_dir), Path(args.results_dir)))
        written = write_instance_evaluations(output)
        print(format_summary(output))
        print(f"\nWrote {len(written)} instance evaluation files.")
    else:
        parser.error("provide --instance/--result or --instances-dir/--results-dir")


if __name__ == "__main__":
    main()
