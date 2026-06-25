"""MCP-only agent kernel package facade."""

from .kernel import (
    append_phase,
    build_step_record,
    compose_verify_summary,
    dedupe_insights,
    derive_final_answer,
)
from .model_registry import (
    ModelConfig,
    get_api_key,
    get_effective_runner_type,
    get_effective_runtime,
    get_model_config,
    list_available_models,
)
from .protocol_runtime import (
    convert_mcp_tools_to_openai_format,
    create_client,
    run_protocol_va_with_mcp,
)
from .runner import ProtocolAgentRunner, ProtocolRunnerDeps
from .runtime import MCPWidgetRuntime, RuntimeSnapshot

__all__ = [
    "append_phase",
    "build_step_record",
    "compose_verify_summary",
    "dedupe_insights",
    "derive_final_answer",
    "ProtocolAgentRunner",
    "ProtocolRunnerDeps",
    "MCPWidgetRuntime",
    "RuntimeSnapshot",
    "ModelConfig",
    "get_model_config",
    "get_api_key",
    "list_available_models",
    "get_effective_runtime",
    "get_effective_runner_type",
    "create_client",
    "convert_mcp_tools_to_openai_format",
    "run_protocol_va_with_mcp",
]
