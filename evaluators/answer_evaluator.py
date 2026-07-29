"""Answer scoring for verifiable targets, with an optional open-answer hook."""

import json
import os
import re
from datetime import date
from dataclasses import dataclass
from typing import Any, Dict, Optional

from .common import answer_text, categorical_match, extract_numbers, scalar_equal


DATE_PATTERNS = (
    re.compile(r"\b(?P<year>\d{4})[-/](?P<month>\d{1,2})[-/](?P<day>\d{1,2})\b", re.I),
    re.compile(
        r"\b(?P<month>january|february|march|april|may|june|july|august|september|"
        r"october|november|december)\s+(?P<day>\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(?P<year>\d{4}))?\b",
        re.I,
    ),
)
MONTHS = {name.lower(): index for index, name in enumerate(
    ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"),
    start=1,
)}


def _parse_date(value: Any) -> date | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    for pattern in DATE_PATTERNS:
        match = pattern.fullmatch(normalized)
        if not match:
            continue
        parts = match.groupdict()
        year = int(parts["year"]) if parts.get("year") else None
        if year is None:
            return None
        month = parts["month"]
        month_number = int(month) if month.isdigit() else MONTHS[month.lower()]
        try:
            return date(year, month_number, int(parts["day"]))
        except ValueError:
            return None
    return None


def _extract_dates(text: str) -> list[date]:
    dates = []
    for pattern in DATE_PATTERNS:
        for match in pattern.finditer(text):
            parsed = _parse_date(match.group(0))
            if parsed is not None:
                dates.append((match.start(), parsed))
    return [parsed for _, parsed in sorted(dates, key=lambda item: item[0])]


def _interval_bounds(value: Any) -> tuple[Any, Any] | None:
    if isinstance(value, dict) and "start" in value and "end" in value:
        return value["start"], value["end"]
    if isinstance(value, (list, tuple)) and len(value) == 2:
        return value[0], value[1]
    numbers = extract_numbers(value)
    return (numbers[0], numbers[1]) if len(numbers) == 2 else None


def _match_interval(text: str, expected: Any, tolerance: float) -> tuple[bool, Any]:
    bounds = _interval_bounds(expected)
    if bounds is None:
        return False, None
    expected_start, expected_end = bounds
    expected_dates = [_parse_date(expected_start), _parse_date(expected_end)]
    if all(expected_dates):
        actual_dates = _extract_dates(text)
        for index in range(len(actual_dates) - 1):
            start, end = actual_dates[index:index + 2]
            if start == expected_dates[0] and end == expected_dates[1]:
                return True, {"start": start.isoformat(), "end": end.isoformat()}
        return False, None
    expected_numbers = extract_numbers([expected_start, expected_end])
    if len(expected_numbers) == 2:
        actual_numbers = extract_numbers(text)
        for index in range(len(actual_numbers) - 1):
            start, end = actual_numbers[index:index + 2]
            if abs(start - expected_numbers[0]) <= tolerance and abs(end - expected_numbers[1]) <= tolerance:
                return True, {"start": start, "end": end}
        return False, None

    normalized = text.lower()
    start_text = str(expected_start).lower()
    end_text = str(expected_end).lower()
    start_index = normalized.find(start_text)
    end_index = normalized.find(end_text, start_index + len(start_text)) if start_index >= 0 else -1
    return end_index >= 0, {"start": expected_start, "end": expected_end} if end_index >= 0 else None


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
        text = answer_text(predicted)
        numeric_candidates = extract_numbers(text)
        used_numeric_candidates = set()
        results = [
            self._check(check, text, numeric_candidates, used_numeric_candidates, index, checks)
            for index, check in enumerate(checks)
        ]
        return AnswerEvalResult(
            score=sum(item["score"] for item in results) / len(results),
            details={"mode": "rules", "checks": results},
        )

    def _check(
        self,
        check: Dict[str, Any],
        text: str,
        numeric_candidates: list[float],
        used_numeric_candidates: set[int],
        index: int,
        checks: list[Dict[str, Any]],
    ) -> Dict[str, Any]:
        expected = check.get("expected", check.get("value"))
        check_type = check.get("check", "categorical")
        field = check.get("field") or f"answer_{index + 1}"
        tolerance = float(check.get("tolerance", 0.0))
        if check_type == "numeric":
            candidates = numeric_candidates
            used_candidates = used_numeric_candidates
            matching_indices = [
                index
                for index, value in enumerate(candidates)
                if index not in used_candidates and abs(value - float(expected)) <= tolerance
            ]
            if matching_indices:
                index = min(matching_indices, key=lambda item: abs(candidates[item] - float(expected)))
                used_candidates.add(index)
                actual = candidates[index]
                ok = True
            else:
                actual = None
                ok = False
        elif check_type == "interval":
            ok, actual = _match_interval(text, expected, tolerance)
        elif check_type == "boolean":
            ok = scalar_equal(text, expected)
            actual = text
        elif isinstance(expected, list):
            actual = text
            ok, match_mode, judge_details = self._categorical_match_with_fallback(text, expected)
        else:
            actual = text
            ok, match_mode, judge_details = self._categorical_match_with_fallback(text, [expected])
        details = {
            "field": field,
            "check": check_type,
            "expected": expected,
            "actual": actual,
            "score": 1.0 if ok else 0.0,
        }
        if check_type == "categorical":
            details["match_mode"] = match_mode
            if judge_details:
                details["judge"] = judge_details
        return details

    def _categorical_match_with_fallback(self, actual: str, expected_values: list[Any]):
        if any(categorical_match(actual, expected) for expected in expected_values):
            return True, "rules", None

        judge = self.judge or self._openrouter_judge
        best_judged = None
        best_score = 0.0
        for expected in expected_values:
            try:
                judged = judge(actual, [expected])
            except Exception as error:
                judged = {"score": 0.0, "error": str(error)}
            score = self._judge_score(judged)
            if score > best_score:
                best_score = score
                best_judged = judged
        return best_score >= 0.5, "llm", best_judged

    @staticmethod
    def _judge_score(judged: Any) -> float:
        if not isinstance(judged, dict):
            return 0.0
        if isinstance(judged.get("score"), (int, float)):
            return max(0.0, min(1.0, float(judged["score"])))
        precision = float(judged.get("precision", 0.0))
        recall = float(judged.get("recall", 0.0))
        groundedness = float(judged.get("groundedness", 0.0))
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        return max(0.0, min(1.0, f1 * groundedness))

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
