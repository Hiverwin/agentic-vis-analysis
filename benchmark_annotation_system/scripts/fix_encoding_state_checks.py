#!/usr/bin/env python3
"""
Remove static `encoding` from state_eval / state_check_fields when the tool chain
does not include `change_encoding`.

- If after removal nothing is left to check and `identify_clusters` is among tools,
  set cluster_field (per state_evaluator) instead of leaving state empty.
- If still nothing to check, set state_eval to null and state_check_fields to [].
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "synthetic_task" / "type1a"
SUBDIRS = ("vague_single", "vague_multi")


def tools_list(gt: dict) -> list[str]:
    return [t.get("tool") or "" for t in (gt.get("tool_eval") or {}).get("tools") or []]


def patch_ground_truth(gt: dict) -> bool:
    """Return True if modified."""
    if "vague" not in str(gt.get("task_type") or ""):
        return False
    tools = tools_list(gt)
    if "change_encoding" in tools:
        return False

    modified = False
    se = gt.get("state_eval")
    if isinstance(se, dict) and "encoding" in se:
        del se["encoding"]
        modified = True
        if not se:
            gt["state_eval"] = None

    scf = gt.get("state_check_fields")
    if isinstance(scf, list) and "encoding" in scf:
        gt["state_check_fields"] = [x for x in scf if x != "encoding"]
        modified = True

    scf2 = list(gt.get("state_check_fields") or [])
    se2 = gt.get("state_eval")

    # identify_clusters adds cluster color field — check cluster_field when nothing else remains
    if not scf2 and "identify_clusters" in tools:
        gt["state_eval"] = {"cluster_field": {"color_field_contains": "cluster"}}
        gt["state_check_fields"] = ["cluster_field"]
        return True

    if not scf2:
        if isinstance(se2, dict) and not se2:
            gt["state_eval"] = None
        gt["state_check_fields"] = []
        return True or modified

    return modified


def main() -> None:
    n = 0
    for sub in SUBDIRS:
        d = ROOT / sub
        if not d.is_dir():
            continue
        for path in sorted(d.glob("*.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except Exception as e:
                print("SKIP", path, e)
                continue
            if "vague" not in str(data.get("task_type") or ""):
                continue
            file_changed = False
            for q in data.get("questions") or []:
                gt = q.get("ground_truth")
                if not isinstance(gt, dict):
                    continue
                if patch_ground_truth(gt):
                    file_changed = True
            if file_changed:
                path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                n += 1
    print(f"Patched {n} task JSON files under type1a/vague_*")


if __name__ == "__main__":
    main()
