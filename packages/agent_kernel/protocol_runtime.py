"""Shared protocol runtime used by both benchmark scripts and host SDK."""

import base64
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from openai import OpenAI

from agent.runners import ProtocolAgentRunner, ProtocolRunnerDeps
from core.vega_service import get_vega_service
from packages.agent_kernel.model_registry import ModelConfig, get_api_key
from state_manager import StateManager


EVALUATION_FORMAT = """
=== OUTPUT FORMAT INSTRUCTIONS ===

IMPORTANT: First determine the question type, then format your response accordingly.

**Question Type Detection:**
- OBJECTIVE (QA): Questions asking for specific facts, numbers, categories, yes/no answers
- SUBJECTIVE (Open-ended): Questions asking for analysis, explanation, interpretation, patterns

**For EACH iteration of analysis, output:**

REASONING: <Explain your analysis approach, observations from the current view, and preparations for the next step>

**After completing ALL iterations, provide your final output:**

For OBJECTIVE Questions:
ANSWER: <One word, number, or short phrase ONLY>

For SUBJECTIVE Questions:
KEY_INSIGHTS:
- <Insight 1 with specific data>
- <Insight 2 with specific data>

ANSWER: <Comprehensive answer summarizing your analysis>
"""

PROTOCOL_OBSERVE_PLAN = "[OBSERVE & PLAN]"
PROTOCOL_REASON = "[REASON]"
PROTOCOL_VERIFY_INSTRUCTION = """[VERIFY] Check the tool result and updated view above:
- Does the current state match what the user asked for?
- Can you answer the question now?
  - If YES: set exploration_complete=true and provide your answer.
  - If NO: set exploration_complete=false and specify next_action (which tool to call next)."""

TOOL_ANALYSIS_KEYS = [
    "cluster_statistics",
    "correlation",
    "correlation_coefficient",
    "p_value",
    "summary",
    "extremes",
    "upstream",
    "downstream",
    "conversion",
    "conversions",
    "high_loss_nodes",
]


def create_client(config: ModelConfig) -> OpenAI:
    api_key = get_api_key(config) or "dummy-key"
    return OpenAI(api_key=api_key, base_url=config.base_url, timeout=config.timeout)


def extract_final_state(spec: Dict, tool_state: Dict = None) -> Dict:
    if tool_state is not None:
        state, _ = StateManager.split(tool_state) if "data" in tool_state else (tool_state, None)
        return state
    if not spec:
        return {}
    state, _ = StateManager.split(spec)
    return state


def strip_data_values(spec: Dict) -> Dict:
    if not spec:
        return spec
    result = spec.copy()
    if "data" in result and isinstance(result["data"], dict) and "values" in result["data"]:
        values = result["data"]["values"]
        count = len(values) if isinstance(values, list) else "?"
        result["data"] = {"_values_omitted": f"{count} items"}
    return result


def build_model_text_with_state(base_text: str, spec: Dict, tool_state: Dict = None) -> str:
    state_json = json.dumps(extract_final_state(spec, tool_state), ensure_ascii=False)
    return f"{base_text}\n\nCurrent vega_state (state-only, no data.values):\n{state_json}"


def format_user_message_with_state(base_text: str, spec: Dict, tool_state: Dict = None) -> Dict[str, Any]:
    return {"role": "user", "content": build_model_text_with_state(base_text, spec, tool_state)}


def format_user_message_with_image(text: str, image_base64: str, model_name: str = None) -> Dict[str, Any]:
    if model_name and "grok" in model_name.lower():
        return {
            "role": "user",
            "content": [
                {"type": "text", "text": text},
                {"type": "input_image", "image_url": {"url": f"data:image/png;base64,{image_base64}", "detail": "high"}},
            ],
        }
    return {
        "role": "user",
        "content": [
            {"type": "text", "text": text},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}", "detail": "high"}},
        ],
    }


def build_round_user_message(
    input_mode: str,
    base_text: str,
    current_spec: Dict,
    current_state: Dict,
    current_image: str,
    model_name: str = None,
) -> Dict[str, Any]:
    if input_mode == "text_only":
        return format_user_message_with_state(base_text, current_spec, current_state)
    full_text = build_model_text_with_state(base_text, current_spec, current_state)
    return format_user_message_with_image(full_text, current_image, model_name)


def parse_json_from_response(content: str) -> Dict[str, Any]:
    if not content:
        return {}
    if "```json" in content:
        try:
            return json.loads(content.split("```json")[1].split("```")[0].strip())
        except (IndexError, json.JSONDecodeError):
            pass
    if "```" in content:
        try:
            return json.loads(content.split("```")[1].split("```")[0].strip())
        except (IndexError, json.JSONDecodeError):
            pass
    try:
        start = content.find("{")
        end = content.rfind("}")
        if start != -1 and end != -1:
            return json.loads(content[start : end + 1])
    except json.JSONDecodeError:
        pass
    return {}


def extract_answer_from_text(content: str) -> Dict[str, Any]:
    result = {"question_type": "subjective", "answer": "", "key_insights": [], "reasoning": ""}
    answer_match = re.search(r"ANSWER:\s*(.+?)(?=\n(?:KEY_INSIGHTS|REASONING)|$)", content, re.DOTALL | re.IGNORECASE)
    if answer_match:
        result["answer"] = answer_match.group(1).strip()
    insights_match = re.search(r"KEY_INSIGHTS:\s*(.+?)(?=\n(?:ANSWER|REASONING)|$)", content, re.DOTALL | re.IGNORECASE)
    if insights_match:
        insights = re.findall(r"[-•]\s*(.+?)(?=\n[-•]|\n\n|$)", insights_match.group(1), re.DOTALL)
        result["key_insights"] = [ins.strip() for ins in insights if ins.strip()]
    reasoning_match = re.search(r"REASONING:\s*(.+?)(?=\n(?:ANSWER|KEY_INSIGHTS)|$)", content, re.DOTALL | re.IGNORECASE)
    if reasoning_match:
        result["reasoning"] = reasoning_match.group(1).strip()
    if result["answer"] and len(result["answer"].split()) <= 3 and not result["key_insights"]:
        result["question_type"] = "objective"
    return result


def get_analysis_prompt(is_final: bool = False) -> str:
    if is_final:
        return """Based on all your analysis, provide your FINAL response in this EXACT JSON format:

```json
{
  "question_type": "objective" or "subjective",
  "reasoning": "Your step-by-step reasoning for THIS round",
  "key_insights": ["New insight from this round", "Another insight discovered"],
  "answer": "YOUR FINAL ANSWER - REQUIRED",
  "exploration_complete": true
}
```"""
    return """Analyze the current view and tool results. Return JSON with insights from THIS round:

```json
{
  "question_type": "objective" or "subjective",
  "reasoning": "What you observed and analyzed in this round",
  "key_insights": ["Insight 1 from this round", "Insight 2 from this round"],
  "answer": "Your current best answer",
  "exploration_complete": false,
  "next_action": "What tool to use next and why"
}
```"""


def get_image_only_analysis_prompt(is_final: bool = False) -> str:
    if is_final:
        return """Based on the current chart image and vega_state, provide your FINAL response in JSON:

```json
{
  "question_type": "objective" or "subjective",
  "answer": "YOUR FINAL ANSWER - REQUIRED",
  "exploration_complete": true
}
```"""
    return """Analyze the current chart image and vega_state, then return JSON:

```json
{
  "question_type": "objective" or "subjective",
  "answer": "Current best answer",
  "exploration_complete": false,
  "next_action": "Which tool to use next, or none"
}
```"""


def save_image_from_base64(image_base64: str, output_path: Path) -> str:
    image_data = base64.b64decode(image_base64)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as handle:
        handle.write(image_data)
    return str(output_path)


def _fix_schema_types(schema: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(schema, dict):
        return schema
    schema.pop("$ref", None)
    schema.pop("nullable", None)
    if schema.get("type") == "object":
        props = schema.get("properties", {})
        for prop_name, prop_def in props.items():
            props[prop_name] = _fix_schema_types_with_name(prop_def, prop_name)
        schema["properties"] = props
        schema.setdefault("additionalProperties", True)
    if schema.get("type") == "array":
        schema["items"] = _fix_schema_types(schema.get("items", {"type": "string"}))
    return schema


def _fix_schema_types_with_name(prop_def: Any, prop_name: str) -> Any:
    if not isinstance(prop_def, dict):
        return prop_def
    if prop_def.get("type") == "array" and "items" not in prop_def:
        name_lower = prop_name.lower()
        if any(k in name_lower for k in ["range", "position", "coord", "point", "area", "bbox"]):
            prop_def["items"] = {"type": "number"}
        elif any(k in name_lower for k in ["id", "name", "label", "category", "field"]):
            prop_def["items"] = {"type": "string"}
        else:
            prop_def["items"] = {"type": "string"}
    return _fix_schema_types(prop_def)


def convert_mcp_tools_to_openai_format(mcp_tools) -> List[Dict[str, Any]]:
    openai_tools = []
    for tool in mcp_tools:
        parameters = tool.inputSchema if tool.inputSchema else {"type": "object", "properties": {}, "required": []}
        params = _fix_schema_types(parameters)
        for key in ("vega_spec", "state"):
            if "properties" in params and key in params["properties"]:
                del params["properties"][key]
            if "required" in params and key in params["required"]:
                params["required"].remove(key)
        openai_tools.append(
            {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description or "",
                    "parameters": params,
                },
            }
        )
    return openai_tools


def _build_available_tools_section(openai_tools: Optional[List[Dict[str, Any]]]) -> str:
    names = sorted(
        t.get("function", {}).get("name")
        for t in (openai_tools or [])
        if t.get("function", {}).get("name")
    )
    if not names:
        return "## Available Tools\n- (No tools available in current runtime)"
    return "## Available Tools\n- " + ", ".join(names)


def _normalize_chart_type_key(chart_type: str) -> str:
    key = str(chart_type or "").strip().lower()
    alias = {
        "scatter": "scatter",
        "scatter_plot": "scatter",
        "bar": "bar",
        "bar_chart": "bar",
        "line": "line",
        "line_chart": "line",
        "parallel": "parallel",
        "parallel_coordinates": "parallel",
        "heatmap": "heatmap",
        "sankey": "sankey",
        "sankey_diagram": "sankey",
    }
    return alias.get(key, key)


def get_system_prompt_protocol(
    chart_type: str,
    *,
    openai_tools: Optional[List[Dict[str, Any]]] = None,
    benchmark_vague_extra: str = "",
) -> str:
    available_tools = _build_available_tools_section(openai_tools)
    chart_key = _normalize_chart_type_key(chart_type)
    chart_skills_section = f"## Chart Type\nCurrent chart family: {chart_key}"
    return f"""You are a data visualization analysis assistant using an explicit protocol.

{available_tools}
{chart_skills_section}
{benchmark_vague_extra}

## Error Recovery
When a tool call fails, try another valid approach before concluding.

## Stop Criteria
- When the question is answered with sufficient evidence
- When all required tools have been called
- When additional iterations add no new evidence
"""


def _safe_json_chat_completion(
    client: OpenAI,
    config: ModelConfig,
    messages: List[Dict[str, Any]],
    openai_tools: Optional[List[Dict]] = None,
    tool_choice: Optional[Any] = None,
):
    kwargs = {"model": config.model, "messages": messages, "temperature": config.temperature}
    if openai_tools:
        kwargs["tools"] = openai_tools
        if tool_choice is not None:
            kwargs["tool_choice"] = tool_choice
    try:
        kwargs["response_format"] = {"type": "json_object"}
        return client.chat.completions.create(**kwargs)
    except Exception:
        kwargs.pop("response_format", None)
        return client.chat.completions.create(**kwargs)


def _normalize_json_result(content: str) -> Dict[str, Any]:
    parsed = parse_json_from_response(content or "")
    if not parsed:
        parsed = extract_answer_from_text(content or "")
    return parsed or {}


def deterministic_verify_tool_result(
    tool_name: str,
    tool_args: Dict[str, Any],
    tool_result: Dict[str, Any],
    previous_spec: Dict[str, Any],
    updated_spec: Dict[str, Any],
) -> Dict[str, Any]:
    success = bool(tool_result.get("success", False))
    if not success:
        return {"passed": False, "mode": "deterministic", "message": tool_result.get("error") or tool_result.get("message") or "tool reported failure"}
    try:
        if tool_name == "zoom_2d_region":
            x_domain = ((((updated_spec.get("encoding", {}) or {}).get("x", {}) or {}).get("scale", {}) or {}).get("domain"))
            y_domain = ((((updated_spec.get("encoding", {}) or {}).get("y", {}) or {}).get("scale", {}) or {}).get("domain"))
            exp_x = tool_result.get("zoom_range", {}).get("x") or list(tool_args.get("x_range", []))
            exp_y = tool_result.get("zoom_range", {}).get("y") or list(tool_args.get("y_range", []))
            passed = list(x_domain or []) == list(exp_x or []) and list(y_domain or []) == list(exp_y or [])
            return {"passed": passed, "mode": "deterministic", "message": f"x_domain={x_domain}, y_domain={y_domain}"}
        if tool_name in {"select_region", "brush_region"}:
            selected = tool_result.get("vega_state", {}).get("_selected_region") or updated_spec.get("_selected_region")
            return {"passed": bool(selected), "mode": "deterministic", "message": f"selected_region_present={bool(selected)}"}
        if tool_name == "calculate_correlation":
            points = tool_result.get("data_points", 0)
            coeff = tool_result.get("correlation_coefficient")
            return {"passed": points >= 2 and coeff is not None, "mode": "deterministic", "message": f"data_points={points}, coeff={coeff}"}
    except Exception as exc:  # pragma: no cover - defensive
        return {"passed": False, "mode": "deterministic", "message": f"verify exception: {exc}"}
    return {"passed": True, "mode": "deterministic", "message": "tool success accepted"}


async def perceptual_verify_if_needed(
    client: OpenAI,
    config: ModelConfig,
    input_mode: str,
    current_spec: Dict[str, Any],
    current_state: Dict[str, Any],
    current_image: str,
    question_text: str,
    expected_observation: str,
    deterministic_verify: Dict[str, Any],
) -> Dict[str, Any]:
    if deterministic_verify.get("passed", False) or input_mode == "text_only":
        return deterministic_verify
    prompt = (
        f"Question: {question_text}\n\n"
        f"Expected observation after the last action: {expected_observation}\n"
        f"Deterministic verification failed with: {deterministic_verify.get('message', '')}\n\n"
        "Based on the current chart view and state, decide whether the expected effect is nonetheless visible. "
        'Return valid JSON only: {"passed": true or false, "message": "brief judgment"}'
    )
    messages = [
        {"role": "system", "content": "You are a strict visual verifier for chart interaction effects."},
        build_round_user_message(
            input_mode=input_mode,
            base_text=prompt,
            current_spec=current_spec,
            current_state=current_state,
            current_image=current_image,
            model_name=config.model,
        ),
    ]
    resp = _safe_json_chat_completion(client, config, messages)
    content = (resp.choices[0].message.content or "").strip()
    parsed = _normalize_json_result(content)
    return {
        "passed": bool(parsed.get("passed", False)),
        "mode": "perceptual",
        "message": parsed.get("message", ""),
        "deterministic_fallback": deterministic_verify,
    }


async def run_protocol_va_with_mcp(
    mcp_session,
    client: OpenAI,
    config: ModelConfig,
    openai_tools: List[Dict],
    question: Dict,
    vega_spec: Dict,
    chart_type: str,
    input_mode: str = "text_and_image",
    output_dir: Optional[Path] = None,
    max_iterations: int = 8,
    benchmark_vague_interaction_guide: str = "",
) -> Dict:
    deps = ProtocolRunnerDeps(
        build_round_user_message=build_round_user_message,
        parse_json_from_response=parse_json_from_response,
        extract_answer_from_text=extract_answer_from_text,
        normalize_json_result=_normalize_json_result,
        get_analysis_prompt=get_analysis_prompt,
        get_image_only_analysis_prompt=get_image_only_analysis_prompt,
        extract_final_state=extract_final_state,
        strip_data_values=strip_data_values,
        save_image_from_base64=save_image_from_base64,
        protocol_verify_instruction=PROTOCOL_VERIFY_INSTRUCTION,
        protocol_reason=PROTOCOL_REASON,
        tool_analysis_keys=TOOL_ANALYSIS_KEYS,
        deterministic_verify_tool_result=deterministic_verify_tool_result,
        perceptual_verify_if_needed=perceptual_verify_if_needed,
    )
    runner = ProtocolAgentRunner(deps)
    question_text = question.get("question", "")
    system_prompt = get_system_prompt_protocol(
        chart_type,
        openai_tools=openai_tools,
        benchmark_vague_extra=benchmark_vague_interaction_guide,
    )
    initial_prompt = f"{PROTOCOL_OBSERVE_PLAN} Please answer the following question:\n\n{question_text}\n\n{EVALUATION_FORMAT}"
    return await runner.run(
        mcp_session=mcp_session,
        client=client,
        config=config,
        openai_tools=openai_tools,
        question=question,
        vega_spec=vega_spec,
        chart_type=chart_type,
        input_mode=input_mode,
        output_dir=output_dir,
        max_iterations=max_iterations,
        vega_service=get_vega_service(),
        system_prompt=system_prompt,
        initial_prompt=initial_prompt,
    )
