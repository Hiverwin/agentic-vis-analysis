from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator


REPO_ROOT = Path(__file__).resolve().parents[2]
SKILL_ROOT = REPO_ROOT / "synthesize-multi-widget-benchmark"
SYNTHESIZE = SKILL_ROOT / "scripts" / "synthesize.py"
SCHEMA = REPO_ROOT / "visagentbench_v2/schema/benchmark-plan.schema.json"
SEED_SPEC = REPO_ROOT / "benchmark_annotation_system/backend/specs/74_StudentsPerformance_bar.json"


class SynthesisSmokeTest(unittest.TestCase):
    def test_generates_category_profile_instance_from_one_seed_spec(self) -> None:
        with tempfile.TemporaryDirectory(prefix="multi-widget-smoke-") as temp_dir:
            result = subprocess.run(
                [
                    "python",
                    str(SYNTHESIZE),
                    "--spec-path",
                    str(SEED_SPEC),
                    "--workflow-id",
                    "WF-2V-REPEATED-CATEGORY-PROFILE-COMPARISON-10",
                    "--output-dir",
                    temp_dir,
                    "--repo-root",
                    str(REPO_ROOT),
                ],
                cwd=REPO_ROOT,
                check=True,
                capture_output=True,
                text=True,
            )
            output = json.loads(result.stdout)
            instance_path = Path(output["instance_path"])
            instance = json.loads(instance_path.read_text(encoding="utf-8"))
            schema = json.loads(SCHEMA.read_text(encoding="utf-8"))

            self.assertEqual(list(Draft202012Validator(schema).iter_errors(instance)), [])
            self.assertEqual(instance["taxonomy"]["workspace_scope"], "multi_widget")
            self.assertEqual(len(instance["workspace"]["widgets"]), 2)
            self.assertEqual(len(instance["workspace"]["links"]), 1)
            self.assertEqual(
                instance["planner_context"]["workflow_id"],
                "WF-2V-REPEATED-CATEGORY-PROFILE-COMPARISON-10",
            )
            self.assertEqual(
                [step["operation"] for step in instance["evaluation"]["tool"]["steps"]],
                [
                    "perception.summarizeVisible",
                    "bar.selectCategory",
                    "perception.summarizeVisible",
                    "bar.selectCategory",
                    "perception.summarizeVisible",
                ],
            )
            select_steps = [
                step for step in instance["evaluation"]["tool"]["steps"]
                if step["operation"] == "bar.selectCategory"
            ]
            self.assertTrue(all(
                "bar.clickCategory" in [
                    alternative["operation"]
                    for alternative in step.get("alternative_steps", [])
                ]
                for step in select_steps
            ))
            self.assertTrue(output["generated_specs"])


if __name__ == "__main__":
    unittest.main()
