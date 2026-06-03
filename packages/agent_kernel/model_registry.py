"""Shared model registry for protocol and host-facing runtimes."""

from dataclasses import dataclass
import os
from pathlib import Path
from typing import Dict, Optional

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency
    load_dotenv = None


def _load_project_env() -> None:
    if load_dotenv is None:
        return
    project_root = Path(__file__).resolve().parents[2]
    env_path = project_root / ".env"
    if env_path.exists():
        load_dotenv(env_path)


_load_project_env()


@dataclass
class ModelConfig:
    name: str
    base_url: str
    model: str
    api_key_env: Optional[str]
    max_tokens: int = 4096
    temperature: float = 0.0
    timeout: int = 180
    max_iterations: int = 8
    tool_choice_format: str = "dict"
    supports_external_tools: bool = True
    use_responses_api: bool = False
    use_protocol: bool = False
    use_protocol_script: bool = False
    runner_type: Optional[str] = None


MODELS: Dict[str, ModelConfig] = {
    "system": ModelConfig(
        name="My System",
        base_url="http://localhost:8000/v1",
        model="my-system",
        api_key_env=None,
        timeout=300,
        supports_external_tools=False,
    ),
    "claude": ModelConfig(
        name="Claude",
        base_url="https://openrouter.ai/api/v1",
        model="anthropic/claude-opus-4.6",
        api_key_env="OPENROUTER_API_KEY",
        tool_choice_format="string",
    ),
    "claude_protocol": ModelConfig(
        name="Claude Protocol",
        base_url="https://openrouter.ai/api/v1",
        model="anthropic/claude-opus-4.6",
        api_key_env="OPENROUTER_API_KEY",
        tool_choice_format="string",
        use_protocol=True,
    ),
    "claude_baseline": ModelConfig(
        name="Claude Baseline",
        base_url="https://openrouter.ai/api/v1",
        model="anthropic/claude-opus-4.6",
        api_key_env="OPENROUTER_API_KEY",
        tool_choice_format="string",
        supports_external_tools=False,
    ),
    "claude_manual": ModelConfig(
        name="Claude Manual",
        base_url="https://openrouter.ai/api/v1",
        model="anthropic/claude-opus-4.6",
        api_key_env="OPENROUTER_API_KEY",
        tool_choice_format="string",
        use_protocol_script=True,
    ),
    "gpt": ModelConfig(
        name="GPT-5.4-mini",
        base_url="https://openrouter.ai/api/v1",
        model="openai/gpt-5.4-mini",
        api_key_env="OPENROUTER_API_KEY",
        tool_choice_format="string",
    ),
    "gpt_protocol": ModelConfig(
        name="GPT Protocol",
        base_url="https://openrouter.ai/api/v1",
        model="openai/gpt-5.4-mini",
        api_key_env="OPENROUTER_API_KEY",
        tool_choice_format="string",
        use_protocol=True,
    ),
    "gpt_responses": ModelConfig(
        name="GPT Responses",
        base_url="https://api.openai.com/v1",
        model="openai/gpt-5.4-mini",
        api_key_env="OPENAI_API_KEY",
        use_responses_api=True,
    ),
    "gpt_baseline": ModelConfig(
        name="GPT Baseline",
        base_url="https://openrouter.ai/api/v1",
        model="openai/gpt-5.4-mini",
        api_key_env="OPENROUTER_API_KEY",
        tool_choice_format="string",
        supports_external_tools=False,
    ),
    "gpt_manual": ModelConfig(
        name="GPT Manual",
        base_url="https://openrouter.ai/api/v1",
        model="openai/gpt-5.4-mini",
        api_key_env="OPENROUTER_API_KEY",
        tool_choice_format="string",
        use_protocol_script=True,
    ),
    "gpt5": ModelConfig(
        name="GPT-5",
        base_url="https://api.oaipro.com/v1",
        model="gpt-5",
        api_key_env="OPENAI_API_KEY",
        tool_choice_format="string",
    ),
    "gpt5_baseline": ModelConfig(
        name="GPT5 Baseline",
        base_url="https://api.oaipro.com/v1",
        model="gpt-5",
        api_key_env="OPENAI_API_KEY",
        tool_choice_format="string",
        supports_external_tools=False,
    ),
    "gemini": ModelConfig(
        name="Gemini",
        base_url="https://openrouter.ai/api/v1",
        model="google/gemini-3-flash-preview",
        api_key_env="OPENROUTER_API_KEY",
    ),
    "gemini_protocol": ModelConfig(
        name="Gemini Protocol",
        base_url="https://openrouter.ai/api/v1",
        model="google/gemini-3-flash-preview",
        api_key_env="OPENROUTER_API_KEY",
        use_protocol=True,
    ),
    "gemini_baseline": ModelConfig(
        name="Gemini Baseline",
        base_url="https://openrouter.ai/api/v1",
        model="google/gemini-3-flash-preview",
        api_key_env="OPENROUTER_API_KEY",
        supports_external_tools=False,
    ),
    "gemini_manual": ModelConfig(
        name="Gemini Manual",
        base_url="https://openrouter.ai/api/v1",
        model="google/gemini-3-flash-preview",
        api_key_env="OPENROUTER_API_KEY",
        use_protocol_script=True,
    ),
    "llama": ModelConfig(
        name="Llama 4 Maverick",
        base_url="https://openrouter.ai/api/v1",
        model="meta-llama/llama-4-maverick",
        api_key_env="OPENROUTER_API_KEY",
    ),
    "llama_baseline": ModelConfig(
        name="Llama 4 Maverick Baseline",
        base_url="https://openrouter.ai/api/v1",
        model="meta-llama/llama-4-maverick",
        api_key_env="OPENROUTER_API_KEY",
        supports_external_tools=False,
    ),
    "llama_manual": ModelConfig(
        name="Llama Manual",
        base_url="https://openrouter.ai/api/v1",
        model="meta-llama/llama-4-maverick",
        api_key_env="OPENROUTER_API_KEY",
        use_protocol_script=True,
    ),
    "llama_protocol": ModelConfig(
        name="Llama Protocol",
        base_url="https://openrouter.ai/api/v1",
        model="meta-llama/llama-4-maverick",
        api_key_env="OPENROUTER_API_KEY",
        use_protocol=True,
    ),
    "qwen": ModelConfig(
        name="Qwen",
        base_url="https://openrouter.ai/api/v1",
        model="qwen/qwen3.5-35b-a3b",
        api_key_env="OPENROUTER_API_KEY",
        tool_choice_format="string",
    ),
    "qwen_baseline": ModelConfig(
        name="Qwen Baseline",
        base_url="https://openrouter.ai/api/v1",
        model="qwen/qwen3.5-35b-a3b",
        api_key_env="OPENROUTER_API_KEY",
        tool_choice_format="string",
        supports_external_tools=False,
    ),
    "qwen_manual": ModelConfig(
        name="Qwen Manual",
        base_url="https://openrouter.ai/api/v1",
        model="qwen/qwen3.5-35b-a3b",
        api_key_env="OPENROUTER_API_KEY",
        tool_choice_format="string",
        use_protocol_script=True,
    ),
    "qwen_protocol": ModelConfig(
        name="Qwen Protocol",
        base_url="https://openrouter.ai/api/v1",
        model="qwen/qwen3.5-35b-a3b",
        api_key_env="OPENROUTER_API_KEY",
        tool_choice_format="string",
        use_protocol=True,
    ),
    "mistral": ModelConfig(
        name="Mistral",
        base_url="https://openrouter.ai/api/v1",
        model="mistralai/mistral-small-3.2-24b-instruct",
        api_key_env="OPENROUTER_API_KEY",
        tool_choice_format="string",
    ),
    "mistral_baseline": ModelConfig(
        name="Mistral Baseline",
        base_url="https://openrouter.ai/api/v1",
        model="mistralai/mistral-small-3.2-24b-instruct",
        api_key_env="OPENROUTER_API_KEY",
        tool_choice_format="string",
        supports_external_tools=False,
    ),
    "mistral_manual": ModelConfig(
        name="Mistral Manual",
        base_url="https://openrouter.ai/api/v1",
        model="mistralai/mistral-small-3.2-24b-instruct",
        api_key_env="OPENROUTER_API_KEY",
        tool_choice_format="string",
        use_protocol_script=True,
    ),
    "mistral_protocol": ModelConfig(
        name="Mistral Protocol",
        base_url="https://openrouter.ai/api/v1",
        model="mistralai/mistral-small-3.2-24b-instruct",
        api_key_env="OPENROUTER_API_KEY",
        tool_choice_format="string",
        use_protocol=True,
    ),
    "grok": ModelConfig(
        name="Grok",
        base_url="https://openrouter.ai/api/v1",
        model="x-ai/grok-4.1-fast",
        api_key_env="OPENROUTER_API_KEY",
        tool_choice_format="string",
    ),
    "grok_protocol": ModelConfig(
        name="Grok Protocol",
        base_url="https://openrouter.ai/api/v1",
        model="x-ai/grok-4.1-fast",
        api_key_env="OPENROUTER_API_KEY",
        tool_choice_format="string",
        use_protocol=True,
    ),
    "grok_baseline": ModelConfig(
        name="Grok Baseline",
        base_url="https://openrouter.ai/api/v1",
        model="x-ai/grok-4.1-fast",
        api_key_env="OPENROUTER_API_KEY",
        tool_choice_format="string",
        supports_external_tools=False,
    ),
    "grok_manual": ModelConfig(
        name="Grok Manual",
        base_url="https://openrouter.ai/api/v1",
        model="x-ai/grok-4.1-fast",
        api_key_env="OPENROUTER_API_KEY",
        tool_choice_format="string",
        use_protocol_script=True,
    ),
}


def get_model_config(model_name: str) -> ModelConfig:
    if model_name not in MODELS:
        available = ", ".join(MODELS.keys())
        raise ValueError(f"Unknown model: {model_name}. Available: {available}")
    return MODELS[model_name]


def get_api_key(config: ModelConfig) -> Optional[str]:
    if config.api_key_env is None:
        return None
    return os.environ.get(config.api_key_env)


def list_available_models() -> Dict[str, str]:
    return {name: cfg.name for name, cfg in MODELS.items()}


def get_effective_runtime(model_name: str, tool_runtime_arg: str) -> str:
    if tool_runtime_arg != "auto":
        return tool_runtime_arg
    cfg = get_model_config(model_name)
    if cfg.use_responses_api:
        return "responses_mcp"
    if cfg.use_protocol:
        return "protocol_va"
    return "manual_mcp"


def get_effective_runner_type(model_name: str) -> str:
    cfg = get_model_config(model_name)
    if cfg.runner_type:
        return cfg.runner_type
    if cfg.use_protocol:
        return "agent"
    if model_name.endswith("_baseline"):
        return "baseline"
    if model_name == "system":
        return "system_api"
    return "tool_model"
