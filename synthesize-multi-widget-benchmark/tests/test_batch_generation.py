from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator

REPO_ROOT = Path(__file__).resolve().parents[2]
SKILL_ROOT = REPO_ROOT / "synthesize-multi-widget-benchmark"
GENERATOR = SKILL_ROOT / "scripts" / "generate_batch.py"
SCHEMA = REPO_ROOT / "visagentbench_v2/schema/benchmark-plan.schema.json"
LEGACY_ANSWER_TYPES = {"numeric", "categorical", "interval", "boolean", "open_ended_insight"}


class BatchGenerationTest(unittest.TestCase):
    def test_generates_five_bundles_and_ten_logical_tasks(self) -> None:
        with tempfile.TemporaryDirectory(prefix="multi-widget-batch-") as temp_dir:
            result = subprocess.run(
                [
                    "python",
                    str(GENERATOR),
                    "--repo-root",
                    str(REPO_ROOT),
                    "--spec-root",
                    str(Path(temp_dir) / "spec"),
                    "--instance-root",
                    str(Path(temp_dir) / "multi_widget"),
                    "--asl",
                    "all",
                ],
                cwd=REPO_ROOT,
                check=True,
                capture_output=True,
                text=True,
            )
            summary = json.loads(result.stdout)
            self.assertEqual(summary["dataset_count"], 5)
            self.assertEqual(summary["logical_task_count"], 10)
            self.assertEqual(summary["instance_count"], 40)

            instances = sorted(Path(temp_dir).joinpath("multi_widget").rglob("*_asl*.json"))
            self.assertEqual(len(instances), 40)
            alternative_steps = 0
            validator = Draft202012Validator(json.loads(SCHEMA.read_text(encoding="utf-8")))
            for path in instances:
                instance = json.loads(path.read_text(encoding="utf-8"))
                self.assertEqual(list(validator.iter_errors(instance)), [])
                self.assertEqual(instance["taxonomy"]["workspace_scope"], "multi_widget")
                self.assertGreaterEqual(len(instance["workspace"]["widgets"]), 2)
                self.assertTrue(instance["workspace"]["links"])
                answer = instance["evaluation"]["answer"]
                self.assertIn(answer["type"], LEGACY_ANSWER_TYPES)
                if answer["type"] != "open_ended_insight":
                    self.assertIn("value", answer)
                refs = [w["ref"] for w in instance["workspace"]["widgets"].values()]
                self.assertTrue(all(ref.startswith("wl://widgetva-app/workspace/") for ref in refs))
                self.assertTrue(instance["evaluation"]["state"]["applicable"])
                self.assertTrue(instance["evaluation"]["state"]["checks"])
                alternative_steps += sum(
                    bool(step.get("alternatives"))
                    for step in instance["evaluation"]["tool"]["steps"]
                )
            self.assertGreater(alternative_steps, 0)

    def test_verifiable_and_open_queries_are_short_and_single_intent(self) -> None:
        with tempfile.TemporaryDirectory(prefix="multi-widget-batch-") as temp_dir:
            subprocess.run(
                [
                    "python",
                    str(GENERATOR),
                    "--repo-root",
                    str(REPO_ROOT),
                    "--spec-root",
                    str(Path(temp_dir) / "spec"),
                    "--instance-root",
                    str(Path(temp_dir) / "multi_widget"),
                    "--asl",
                    "0",
                ],
                cwd=REPO_ROOT,
                check=True,
                capture_output=True,
                text=True,
            )
            queries = []
            for path in sorted(Path(temp_dir).joinpath("multi_widget").rglob("*_asl0.json")):
                instance = json.loads(path.read_text(encoding="utf-8"))
                query = instance["query"]
                queries.append(query)
                self.assertLessEqual(len(query.split()), 22)
                self.assertNotIn("Return only", query)
                self.assertNotIn("Perform the full analysis", query)
                self.assertNotIn("ground", query.lower())
            self.assertEqual(len(queries), 10)


if __name__ == "__main__":
    unittest.main()
