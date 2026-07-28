"""Answer scoring for verifiable targets, with an optional open-answer hook."""

import json
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional

from .common import answer_text, categorical_match, extract_numbers, normalize_text, scalar_equal, value_match


@dataclass
class AnswerEvalResult:
    score: float
    details: Dict[str, Any]


class AnswerEvaluator:
    def __init__(self, judge=None):
        self.judge = judge

    def evaluate(self, predicted: Any, config: Dict[str, Any]) -> AnswerEvalResult:
        if config.get("type") == "open_ended_insight":
            return self._evaluate_open(predicted, config)
        checks = config.get("checks", [])
        if not checks:
            expected = config.get("answer", config.get("expected"))
            checks = [{"check": "categorical", "expected": expected}]
        structured_values = self._structured_values(predicted)
        has_structured_values = isinstance(predicted, dict) and isinstance(predicted.get("values"), list)
        numeric_candidates = extract_numbers(answer_text(predicted))
        used_numeric_candidates = set()
        results = [
            self._check(predicted, check, structured_values, has_structured_values, numeric_candidates, used_numeric_candidates, index)
            for index, check in enumerate(checks)
        ]
        return AnswerEvalResult(
            score=sum(item["score"] for item in results) / len(results),
            details={"mode": "rules", "checks": results},
        )

    def _check(
        self,
        predicted: Any,
        check: Dict[str, Any],
        structured_values: Dict[str, Dict[str, Any]],
        has_structured_values: bool,
        numeric_candidates: list[float],
        used_numeric_candidates: set[int],
        index: int,
    ) -> Dict[str, Any]:
        expected = check.get("expected", check.get("value"))
        check_type = check.get("check", "categorical")
        field = check.get("field") or f"answer_{index + 1}"
        text = answer_text(predicted)
        tolerance = float(check.get("tolerance", 0.0))
        structured = structured_values.get(field)
        if structured is not None:
            actual_type = structured.get("type")
            if actual_type != check_type:
                return {"field": field, "check": check_type, "expected": expected, "actual": structured, "score": 0.0}
            if check_type == "interval":
                actual = {"start": structured.get("start"), "end": structured.get("end")}
                ok = value_match(actual, expected, tolerance=tolerance)
            else:
                actual = structured.get("value")
                ok = (
                    isinstance(actual, (int, float)) and not isinstance(actual, bool)
                    and abs(actual - float(expected)) <= tolerance
                ) if check_type == "numeric" else scalar_equal(actual, expected)
            return {"field": field, "check": check_type, "expected": expected, "actual": actual, "score": 1.0 if ok else 0.0}
        if has_structured_values:
            return {"field": field, "check": check_type, "expected": expected, "actual": None, "score": 0.0}
        if check_type == "numeric":
            matching_indices = [
                index
                for index, value in enumerate(numeric_candidates)
                if index not in used_numeric_candidates and abs(value - float(expected)) <= tolerance
            ]
            if matching_indices:
                index = min(matching_indices, key=lambda item: abs(numeric_candidates[item] - float(expected)))
                used_numeric_candidates.add(index)
                actual = numeric_candidates[index]
                ok = True
            else:
                actual = None
                ok = False
        elif check_type == "boolean":
            ok = scalar_equal(text, expected)
            actual = text
        elif isinstance(expected, list):
            actual = text
            ok = any(categorical_match(text, item) for item in expected)
        else:
            actual = text
            ok = categorical_match(text, expected)
        return {"field": field, "check": check_type, "expected": expected, "actual": actual, "score": 1.0 if ok else 0.0}

    @staticmethod
    def _structured_values(predicted: Any) -> Dict[str, Dict[str, Any]]:
        if not isinstance(predicted, dict) or not isinstance(predicted.get("values"), list):
            return {}
        return {
            item["key"]: item
            for item in predicted["values"]
            if isinstance(item, dict) and isinstance(item.get("key"), str)
        }

    def _evaluate_open(self, predicted: Any, config: Dict[str, Any]) -> AnswerEvalResult:
        reference = config.get("reference", config.get("expected"))
        if reference is None and config.get("reference_insights"):
            reference = [item.get("claim", "") for item in config["reference_insights"]]
        if reference is None:
            reference = config.get("answer", "")
        if self.judge is None:
            self.judge = self._openrouter_judge
            return AnswerEvalResult(
                score=self._evaluate_open_with_judge(predicted, reference)[0],
                details={"mode": "open", "reference": reference, "status": "llm_judge"},
            )
        judged = self.judge(answer_text(predicted), reference)
        precision = float(judged.get("precision", 0.0))
        recall = float(judged.get("recall", 0.0))
        groundedness = float(judged.get("groundedness", 0.0))
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        return AnswerEvalResult(score=f1 * groundedness, details={"mode": "open", "reference": reference, **judged})

    def _evaluate_open_with_judge(self, predicted: Any, reference: Any):
        try:
            judged = self.judge(answer_text(predicted), reference)
        except Exception as error:
            judged = {"precision": 0.0, "recall": 0.0, "groundedness": 0.0, "error": str(error)}
        precision = float(judged.get("precision", 0.0))
        recall = float(judged.get("recall", 0.0))
        groundedness = float(judged.get("groundedness", 0.0))
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        return f1 * groundedness, judged

    @staticmethod
    def _openrouter_judge(answer: str, reference: Any) -> Dict[str, Any]:
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            return {"precision": 0.0, "recall": 0.0, "groundedness": 0.0, "error": "OPENROUTER_API_KEY not set"}
        from openai import OpenAI
        client = OpenAI(api_key=api_key, base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"))
        prompt = {
            "reference_claims": reference if isinstance(reference, list) else [reference],
            "agent_answer": answer,
            "rubric": "Score claim precision, claim recall, and evidence groundedness from 0 to 1. Ignore verbosity and style.",
            "output": {"precision": "number", "recall": "number", "groundedness": "number", "matched_claims": "array", "unsupported_claims": "array"},
        }
        response = client.chat.completions.create(
            model=os.getenv("OPENROUTER_EVAL_MODEL", "openai/gpt-5.2"),
            messages=[{"role": "user", "content": json.dumps(prompt, ensure_ascii=False)}],
            temperature=0,
            response_format={"type": "json_object"},
        )
        return json.loads(response.choices[0].message.content)
