"""Models that are valid for the current multimodal Kit benchmark."""

from dataclasses import dataclass
from pathlib import Path
from typing import Dict

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency
    load_dotenv = None


if load_dotenv is not None:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")


@dataclass(frozen=True)
class BenchmarkModel:
    key: str
    model: str
    base_url: str = "https://openrouter.ai/api/v1"
    api_key_env: str = "OPENROUTER_API_KEY"
    supports_image: bool = True
    max_tokens: int = 4096
    temperature: float = 0.2
    timeout: int = 180
    max_iterations: int = 8


# Keep experiment aliases stable. The model ID is part of the experiment
# manifest and must be pinned when results are published.
BENCHMARK_MODELS: Dict[str, BenchmarkModel] = {
    "gpt5": BenchmarkModel("gpt5", "openai/gpt-5.2"),
    "claude": BenchmarkModel("claude", "anthropic/claude-opus-4.6"),
    "gemini": BenchmarkModel("gemini", "google/gemini-2.5-flash"),
    "grok": BenchmarkModel("grok", "x-ai/grok-4.1-fast"),
    "qwen": BenchmarkModel("qwen", "qwen/qwen3.5-35b-a3b"),
    "llama": BenchmarkModel("llama", "meta-llama/llama-4-maverick"),
    "kimi": BenchmarkModel("kimi", "moonshotai/kimi-k2.5"),
}


def get_benchmark_model(model_key: str) -> BenchmarkModel:
    try:
        return BENCHMARK_MODELS[model_key]
    except KeyError as error:
        available = ", ".join(BENCHMARK_MODELS)
        raise ValueError(f"Unknown benchmark model {model_key!r}. Available: {available}") from error


def list_benchmark_models() -> tuple[str, ...]:
    return tuple(BENCHMARK_MODELS)
