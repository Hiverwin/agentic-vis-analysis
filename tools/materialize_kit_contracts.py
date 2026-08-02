"""Materialize replay-derived contracts into Kit benchmark instances."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from operation_equivalence import materialize_step_alternatives


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ROOT = REPO_ROOT / "visagentbench_kit"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    args = parser.parse_args()
    root = args.root.resolve()
    audit = json.loads((root / "audits" / "counterfactual_replay.json").read_text(encoding="utf-8"))
    by_id = {entry["benchmark_id"]: entry for entry in audit["instances"]}

    for instance_path in sorted((root / "instances").rglob("*.json")):
        instance = json.loads(instance_path.read_text(encoding="utf-8"))
        entry = by_id.get(instance.get("benchmark_id"))
        if not entry:
            continue
        contract = entry["canonical_contract"]
        optional_ids = {step["step_id"] for step in contract["tool"].get("optional_steps", [])}
        steps = []
        for step in instance.get("evaluation", {}).get("tool", {}).get("steps", []):
            materialized = dict(step)
            materialized["requirement"] = "optional" if step.get("step_id") in optional_ids else "required"
            steps.append(materialized)
        steps = materialize_step_alternatives(steps)
        instance["evaluation"] = {
            "answer": contract["answer"],
            "state": contract["state"],
            "tool": {"steps": steps},
        }
        instance_path.write_text(json.dumps(instance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    for directory in (root / "provenance", root / "contracts"):
        if directory.exists():
            shutil.rmtree(directory)
    print(json.dumps({"materialized_instances": len(by_id), "removed": ["provenance", "contracts"]}, indent=2))


if __name__ == "__main__":
    main()
