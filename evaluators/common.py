"""Small, deterministic comparison helpers shared by the three evaluators."""

import math
import re
from typing import Any, Dict, Iterable, Optional


NUMBER_RE = re.compile(r"[-+]?(?:\d[\d,]*\.?\d*|\.\d+)(?:e[-+]?\d+)?", re.I)
WORD_RE = re.compile(r"[a-z0-9]+(?:st|nd|rd|th)?", re.I)
SCALE = {"thousand": 1_000, "million": 1_000_000, "billion": 1_000_000_000}
STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "in", "is", "it", "of", "on", "or", "that", "the", "to", "with",
}


def answer_text(value: Any) -> str:
    if isinstance(value, dict):
        value = value.get("answer", value.get("text", ""))
    return "" if value is None else str(value)


def extract_number(value: Any) -> Optional[float]:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    numbers = extract_numbers(value)
    return numbers[0] if numbers else None


def extract_numbers(value: Any) -> list[float]:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return [float(value)]
    text = str(value or "").strip().lower().replace(",", "")
    numbers = []
    for match in NUMBER_RE.finditer(text):
        number = float(match.group(0))
        suffix = text[match.end():].lstrip()
        if suffix.startswith("%") or suffix.startswith("percent"):
            number /= 100
        else:
            for word, multiplier in SCALE.items():
                if suffix.startswith(word):
                    number *= multiplier
                    break
        if match.start() > 0 and text[match.start() - 1] == "(":
            number = -abs(number)
        numbers.append(number)
    return numbers


def normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def categorical_match(actual: Any, expected: Any) -> bool:
    """Match an answer label even when the agent surrounds it with evidence."""
    actual_text = normalize_text(actual)
    expected_text = normalize_text(expected)
    if not expected_text:
        return not actual_text
    if expected_text in actual_text:
        return True
    expected_words = [word for word in WORD_RE.findall(expected_text) if word not in STOPWORDS]
    actual_words = set(WORD_RE.findall(actual_text))
    if not expected_words:
        return expected_text in actual_text
    return all(word in actual_words for word in expected_words)


def scalar_equal(actual: Any, expected: Any, tolerance: float = 0.0) -> bool:
    if isinstance(expected, bool):
        return bool_value(actual) == expected
    if isinstance(expected, (int, float)) and not isinstance(expected, bool):
        actual_number = extract_number(actual)
        return actual_number is not None and math.isclose(actual_number, float(expected), abs_tol=tolerance)
    return normalize_text(actual) == normalize_text(expected)


def bool_value(value: Any) -> Optional[bool]:
    if isinstance(value, bool):
        return value
    normalized = normalize_text(value)
    if normalized in {"true", "yes", "1", "correct"}:
        return True
    if normalized in {"false", "no", "0", "incorrect"}:
        return False
    return None


def value_match(actual: Any, expected: Any, *, method: str = "", tolerance: float = 0.0) -> bool:
    if isinstance(expected, dict):
        return isinstance(actual, dict) and all(
            key in actual and value_match(actual[key], value, method=method, tolerance=tolerance)
            for key, value in expected.items()
        )
    if isinstance(expected, list):
        if not isinstance(actual, list):
            return False
        if method == "set_equal":
            return {normalize_text(item) for item in actual} == {normalize_text(item) for item in expected}
        return len(actual) == len(expected) and all(
            value_match(a, e, method=method, tolerance=tolerance) for a, e in zip(actual, expected)
        )
    return scalar_equal(actual, expected, tolerance=tolerance)
