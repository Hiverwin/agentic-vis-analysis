#!/usr/bin/env python3
"""Materialize operation alternatives into existing benchmark instance files."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from operation_equivalence import materialize_step_alternatives


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ROOTS = [
    REPO_ROOT / "visagentbench_kit" / "instances",
    REPO_ROOT / "visagentbench_kit" / "multi_widget",
    REPO_ROOT / "visagentbench_kit" / "multi-generate",
]


def materialize_file(path: Path, dry_run: bool = False) -> bool:
    instance = json.loads(path.read_text(encoding="utf-8"))
    tool = instance.get("evaluation", {}).get("tool")
    if not isinstance(tool, dict):
        return False
    steps = tool.get("steps")
    if not isinstance(steps, list):
        return False

    materialized = materialize_step_alternatives(steps)
    if materialized == steps:
        return False
    if not dry_run:
        tool["steps"] = materialized
        path.write_text(json.dumps(instance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return True


def iter_instance_paths(roots: list[Path]) -> list[Path]:
    paths: list[Path] = []
    for root in roots:
        if root.is_file() and root.suffix == ".json":
            paths.append(root)
        elif root.exists():
            paths.extend(sorted(root.rglob("*_asl[0-3].json")))
    return sorted(set(paths))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("roots", nargs="*", type=Path, default=DEFAULT_ROOTS)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    roots = [path.resolve() for path in args.roots]
    paths = iter_instance_paths(roots)
    changed = [path for path in paths if materialize_file(path, dry_run=args.dry_run)]
    print(json.dumps({
        "checked": len(paths),
        "changed": len(changed),
        "dry_run": args.dry_run,
        "paths": [str(path.relative_to(REPO_ROOT)) if path.is_relative_to(REPO_ROOT) else str(path) for path in changed],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
