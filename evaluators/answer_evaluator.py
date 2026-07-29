"""Answer scoring for verifiable targets, with an optional open-answer hook."""

from __future__ import annotations

import json
import os
import re
from datetime import date
from dataclasses import dataclass
from typing import Any, Dict, Optional

from .common import NUMBER_RE, answer_text, categorical_match, extract_numbers, scalar_equal


FIELD_NOISE_TOKENS = {"answer", "value", "values"}
FIELD_TOKEN_ALIASES = {
    "average": {"average", "avg", "mean"},
    "avg": {"average", "avg", "mean"},
    "count": {"count", "records", "participants", "transactions"},
    "difference": {"difference", "diff", "gap", "higher", "lower"},
    "distribution": {"distribution", "composition", "breakdown"},
    "february": {"february", "feb"},
    "highest": {"highest", "largest", "maximum", "max"},
    "january": {"january", "jan"},
    "lowest": {"lowest", "smallest", "minimum", "min"},
    "mean": {"average", "avg", "mean"},
    "share": {"share", "percentage", "percent", "proportion"},
    "shift": {"shift", "change", "difference"},
}
FIELD_ROLE_TOKENS = {
    "count", "total", "mean", "average", "avg", "sum", "difference", "diff",
    "gap", "share", "shift", "change", "rate", "correlation", "outcome",
    "metric", "score", "size", "distribution", "composition",
}
FIELD_STRUCTURAL_TOKENS = {"cohort", "group", "period", "segment", "category"}


def _field_tokens(field: str) -> list[str]:
    tokens = [token for token in re.split(r"[^a-z0-9]+", str(field or "").lower()) if token]
    return [
        token for token in tokens
        if token not in FIELD_NOISE_TOKENS
    ]


def _number_candidates(text: str) -> list[Dict[str, Any]]:
    """Return normalized numeric values with stable source spans.

    Keeping the span is essential: choosing a number merely because it equals the
    expected value lets a correct value in the wrong clause receive credit.
    """
    lower_text = text.lower().replace(",", "")
    candidates = []
    for match in NUMBER_RE.finditer(lower_text):
        number = float(match.group(0))
        suffix = lower_text[match.end():].lstrip()
        is_percent = suffix.startswith("%") or suffix.startswith("percent")
        if is_percent:
            number /= 100
        elif suffix.startswith("thousand"):
            number *= 1_000
        elif suffix.startswith("million"):
            number *= 1_000_000
        elif suffix.startswith("billion"):
            number *= 1_000_000_000
        candidates.append({
            "value": number,
            "start": match.start(),
            "end": match.end(),
            "is_percent": is_percent,
        })
    return candidates


def _sentence_span(text: str, position: int) -> tuple[int, int]:
    boundaries = [0, len(text)]
    boundaries.extend(match.start() for match in re.finditer(r"[.!?;\n]", text))
    boundaries.extend(
        match.start()
        for match in re.finditer(r"\b(?:while|whereas|in contrast|compared with|compared to)\b", text)
    )
    boundaries = sorted(set(boundaries))
    left = max(boundary for boundary in boundaries if boundary <= position)
    right = min(boundary for boundary in boundaries if boundary > position)
    return left + (1 if left > 0 else 0), right


def _token_occurrences(text: str, token: str) -> list[tuple[int, int]]:
    if len(token) == 1:
        return [
            (match.start(1), match.end(1))
            for match in re.finditer(
                rf"\b(?:group|cohort|category|segment|period)\s+({re.escape(token)})\b",
                text,
            )
        ]
    aliases = FIELD_TOKEN_ALIASES.get(token, {token})
    return [
        (match.start(), match.end())
        for alias in aliases
        for match in re.finditer(rf"\b{re.escape(alias)}s?\b", text)
    ]


def _field_bound_candidates(text: str, field: str) -> list[Dict[str, Any]] | None:
    """Rank numeric evidence by its textual binding to a check field.

    The ranking is independent of the expected answer. This prevents the
    evaluator from searching the whole response for a convenient matching
    number, while still accepting ordinary prose and synonymous metric labels.
    """
    tokens = _field_tokens(field)
    if not tokens:
        return None
    lower_text = text.lower().replace(",", "")
    occurrences = {token: _token_occurrences(lower_text, token) for token in tokens}
    cohort_token = "a" if "a" in tokens else "b" if "b" in tokens else None
    cohort_ordinal = (
        0 if cohort_token == "a" else 1 if cohort_token == "b" else None
    )
    if cohort_token and occurrences.get(cohort_token):
        cohort_ordinal = None
    matched_tokens = [token for token in tokens if occurrences[token]]
    if not matched_tokens:
        return None

    ranked = []
    primary_tokens = [token for token in tokens if token not in FIELD_ROLE_TOKENS]
    primary_token = primary_tokens[-1] if primary_tokens else tokens[-1]
    primary_sentences = []
    for occurrence in occurrences.get(primary_token, []):
        span = _sentence_span(lower_text, occurrence[0])
        if span not in primary_sentences:
            primary_sentences.append(span)
    preferred_cohort_sentence = (
        primary_sentences[cohort_ordinal]
        if cohort_ordinal is not None and len(primary_sentences) > cohort_ordinal
        else None
    )
    for candidate in _number_candidates(text):
        center = (candidate["start"] + candidate["end"]) / 2
        sentence_start, sentence_end = _sentence_span(lower_text, candidate["start"])
        score = 0.0
        identity_hits = 0
        role_hits = 0
        token_hits = 0
        primary_distance = float("inf")
        identity_tokens = [
            token for token in matched_tokens
            if token not in FIELD_ROLE_TOKENS and token not in FIELD_STRUCTURAL_TOKENS
        ]
        entity_token = identity_tokens[0] if identity_tokens else None
        for token in matched_tokens:
            local_occurrences = [
                span for span in occurrences[token]
                if sentence_start <= span[0] <= sentence_end
            ]
            nearest = min(
                local_occurrences or occurrences[token],
                key=lambda span: abs(((span[0] + span[1]) / 2) - center),
            )
            token_center = (nearest[0] + nearest[1]) / 2
            distance = abs(token_center - center)
            same_sentence = sentence_start <= nearest[0] <= sentence_end
            weight = (
                3.0
                if token in FIELD_ROLE_TOKENS
                else 1.0
                if token in FIELD_STRUCTURAL_TOKENS
                else 6.0
                if token == entity_token
                else 4.0
            )
            token_hits += int(same_sentence)
            if token not in FIELD_ROLE_TOKENS and token not in FIELD_STRUCTURAL_TOKENS:
                identity_hits += int(same_sentence)
            else:
                role_hits += int(same_sentence)
            if token == primary_token and same_sentence:
                primary_distance = distance
            score += weight * (1.0 if same_sentence else 0.15) / (1.0 + distance / 32.0)
            if nearest[1] <= candidate["start"] and candidate["start"] - nearest[1] <= 24:
                score += weight * 0.35
        candidate = {
            **candidate,
            "binding_score": score,
            "identity_hits": identity_hits,
            "role_hits": role_hits,
            "token_hits": token_hits,
            "primary_distance": primary_distance,
            "cohort_sentence_penalty": (
                0
                if preferred_cohort_sentence
                and preferred_cohort_sentence[0] <= candidate["start"] <= preferred_cohort_sentence[1]
                else 1
                if preferred_cohort_sentence
                else 0
            ),
            "is_percent": candidate.get("is_percent", False),
        }
        ranked.append(candidate)

    ranked = sorted(
        ranked,
        key=lambda item: (
            item["cohort_sentence_penalty"],
            0 if "share" not in tokens or item["is_percent"] else 1,
            -item["token_hits"],
            -item["identity_hits"] if "share" in tokens else -item["role_hits"],
            -item["role_hits"] if "share" in tokens else -item["identity_hits"],
            item["primary_distance"],
            -item["binding_score"],
            item["start"],
        ),
    )
    required_role_tokens = [
        token for token in tokens
        if token in FIELD_ROLE_TOKENS and token not in {"share"}
    ]
    if required_role_tokens and not any(item["role_hits"] > 0 for item in ranked):
        return []
    return ranked


def _expected_label_number_pairs(expected: Any) -> list[tuple[str, float]]:
    if not isinstance(expected, str):
        return []
    parts = re.split(r"\s*(?:,|;|\band\b)\s*", expected.strip(), flags=re.I)
    pairs = []
    for part in parts:
        match = re.fullmatch(r"(.+?)\s*[:=]?\s*(-?(?:\d+(?:\.\d+)?|\.\d+))", part.strip())
        if not match:
            return []
        label = match.group(1).strip(" '\"")
        if not re.search(r"[A-Za-z]", label):
            return []
        pairs.append((label, float(match.group(2))))
    return pairs


def _categorical_evidence_match(
    text: str,
    expected: Any,
    tolerance: float = 0.0,
    field: str = "",
) -> bool:
    """Match structured categorical evidence without losing label/value binding."""
    expected_date = _parse_date(expected)
    if expected_date is not None:
        return expected_date in _extract_dates(text)
    pairs = _expected_label_number_pairs(expected)
    if not pairs:
        return categorical_match(text, expected)

    lower_text = text.lower().replace(",", "")
    candidates = _number_candidates(text)
    identity_tokens = [
        token for token in _field_tokens(field)
        if token not in FIELD_ROLE_TOKENS
    ]
    discriminative_token = next(
        (token for token in identity_tokens if len(token) == 1),
        next(
            (token for token in identity_tokens if token not in {"cohort", "group", "period", "segment", "category"}),
            identity_tokens[0] if identity_tokens else None,
        ),
    )
    context_spans = (
        _token_occurrences(lower_text, discriminative_token)
        if discriminative_token
        else []
    )
    label_patterns = [
        r"\b"
        + r"\W+".join(re.escape(token) for token in re.findall(r"[a-z0-9]+", label.lower()))
        + r"\b"
        for label, _ in pairs
    ]
    candidate_sentences = []
    for pattern in label_patterns:
        for match in re.finditer(pattern, lower_text):
            span = _sentence_span(lower_text, match.start())
            if span not in candidate_sentences:
                candidate_sentences.append(span)
    complete_sentences = [
        span for span in candidate_sentences
        if all(re.search(pattern, lower_text[span[0]:span[1]]) for pattern in label_patterns)
    ]
    preferred_sentence = None
    if complete_sentences:
        role_tokens = [
            token for token in _field_tokens(field)
            if token in FIELD_ROLE_TOKENS
        ]
        cohort_token = "a" if "a" in identity_tokens else "b" if "b" in identity_tokens else None
        if not context_spans and cohort_token and len(complete_sentences) > (0 if cohort_token == "a" else 1):
            preferred_sentence = complete_sentences[0 if cohort_token == "a" else 1]
        else:
            preferred_sentence = max(
                complete_sentences,
                key=lambda span: (
                    sum(
                        1 for context in context_spans
                        if span[0] <= context[0] <= span[1]
                    ),
                    sum(
                        1 for token in role_tokens
                        if _token_occurrences(lower_text[span[0]:span[1]], token)
                    ),
                    -span[0],
                ),
            )
    for label, expected_value in pairs:
        pattern = (
            r"\b"
            + r"\W+".join(re.escape(token) for token in re.findall(r"[a-z0-9]+", label.lower()))
            + r"\b"
        )
        label_matches = list(re.finditer(pattern, lower_text))
        if preferred_sentence:
            label_matches = [
                match for match in label_matches
                if preferred_sentence[0] <= match.start() <= preferred_sentence[1]
            ]
        if not label_matches:
            return False
        if context_spans:
            label_match = min(
                label_matches,
                key=lambda match: min(
                    (
                        0
                        if _sentence_span(lower_text, context[0])[0]
                        <= match.start()
                        <= _sentence_span(lower_text, context[0])[1]
                        else 100
                    )
                    + abs(((match.start() + match.end()) / 2) - ((context[0] + context[1]) / 2))
                    for context in context_spans
                ),
            )
        else:
            label_match = label_matches[0]
        label_center = (label_match.start() + label_match.end()) / 2
        sentence_start, sentence_end = _sentence_span(lower_text, label_match.start())
        local = [
            candidate for candidate in candidates
            if sentence_start <= candidate["start"] <= sentence_end
        ]
        if not local:
            return False
        immediately_after = [
            candidate for candidate in local
            if 0 <= candidate["start"] - label_match.end() <= 3
        ]
        immediately_before = [
            candidate for candidate in local
            if 0 <= label_match.start() - candidate["end"] <= 3
        ]
        if immediately_after:
            nearest = immediately_after[0]
        elif immediately_before:
            nearest = immediately_before[-1]
        else:
            nearest = min(
                local,
                key=lambda candidate: abs(
                    ((candidate["start"] + candidate["end"]) / 2) - label_center
                ),
            )
        if abs(nearest["value"] - expected_value) > tolerance:
            return False
    return True


DATE_PATTERNS = (
    re.compile(r"\b(?P<year>\d{4})[-/](?P<month>\d{1,2})[-/](?P<day>\d{1,2})\b", re.I),
    re.compile(
        r"\b(?P<month>january|february|march|april|may|june|july|august|september|"
        r"october|november|december)\s+(?P<day>\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(?P<year>\d{4}))?\b",
        re.I,
    ),
    re.compile(
        r"\b(?P<day>\d{1,2})(?:st|nd|rd|th)?\s+"
        r"(?P<month>january|february|march|april|may|june|july|august|september|"
        r"october|november|december)(?:,?\s+(?P<year>\d{4}))?\b",
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
        numeric_candidates = _number_candidates(text)
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
        numeric_candidates: list[Dict[str, Any]],
        used_numeric_candidates: set[int],
        index: int,
        checks: list[Dict[str, Any]],
    ) -> Dict[str, Any]:
        expected = check.get("expected", check.get("value"))
        check_type = check.get("check", "categorical")
        field = check.get("field") or f"answer_{index + 1}"
        tolerance = float(check.get("tolerance", 0.0))
        if check_type == "numeric":
            bound_candidates = _field_bound_candidates(text, field)
            candidates = numeric_candidates if bound_candidates is None else bound_candidates
            available = [
                candidate for candidate in candidates
                if bound_candidates is not None
                or candidate["start"] not in used_numeric_candidates
            ]
            if available:
                selected = available[0]
                if bound_candidates is None:
                    used_numeric_candidates.add(selected["start"])
                actual = selected["value"]
                ok = abs(actual - float(expected)) <= tolerance
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
            ok = any(_categorical_evidence_match(text, item, tolerance, field) for item in expected)
        else:
            actual = text
            ok = _categorical_evidence_match(text, expected, tolerance, field)
        return {"field": field, "check": check_type, "expected": expected, "actual": actual, "score": 1.0 if ok else 0.0}

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
