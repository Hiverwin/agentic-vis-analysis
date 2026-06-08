#!/usr/bin/env python3
"""
Unified Benchmark running script (Simplified Version)

Supports new format tasks (multiple questions), can call any model.

Changes:
1. key_insights changed to string array format: ["insight1", "insight2"]
2. Enhanced prompts for accurate question type detection (objective vs subjective)
3. Simplified run logic:
   - Subjective: return KEY_INSIGHTS + REASONING
   - Objective: return ANSWER (single word/number)
"""

import json
import os
import sys
import copy
import base64
import asyncio
import argparse
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional

from openai import OpenAI

# MCP client imports
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from benchmark.config import (
    get_model_config,
    get_api_key,
    list_available_models,
    ModelConfig,
    get_effective_runtime,
)
from core.vega_service import get_vega_service
from state_manager import StateManager
from agent.runners import ProtocolAgentRunner, ProtocolRunnerDeps

# MCP server path
MCP_SERVER_PATH = Path(__file__).parent.parent / 'chart_tools_mcp_server.py'
INPUT_MODES = {"text_and_image", "text_only", "image_only"}


# ============================================================
# Evaluation Format Instruction (Enhanced for Question Type Detection)
# ============================================================

EVALUATION_FORMAT = """
=== OUTPUT FORMAT INSTRUCTIONS ===

IMPORTANT: First determine the question type, then format your response accordingly.

**Question Type Detection:**
- OBJECTIVE (QA): Questions asking for specific facts, numbers, categories, yes/no answers
  Examples: "What is the correlation?", "Which country has the highest?", "Is X greater than Y?"
- SUBJECTIVE (Open-ended): Questions asking for analysis, explanation, interpretation, patterns
  Examples: "What insights can you draw?", "Describe the distribution", "What patterns do you observe?"

**For EACH iteration of analysis, output:**

REASONING: <Explain your analysis approach, observations from the current view, and preparations for the next step>

**After completing ALL iterations, provide your final output:**

For OBJECTIVE Questions:
ANSWER: <One word, number, or short phrase ONLY - e.g., "Electronics", "Google Ads", "-0.78">

For SUBJECTIVE Questions:
KEY_INSIGHTS:
- <Insight 1 with specific data>
- <Insight 2 with specific data>
- <Additional insights as needed>

ANSWER: <Comprehensive answer summarizing your analysis>

**CRITICAL: The "answer" field in your JSON is REQUIRED. Put your DIRECT final answer there—do NOT bury it in reasoning or key_insights. For objective questions, answer = ONE word/number/phrase only.**
"""

# Prompt for baseline (no-tools) mode: answer from chart view only, same JSON format as tool mode
EVALUATION_FORMAT_BASELINE = """
=== OUTPUT FORMAT (REQUIRED) ===

You have NO access to tools. Answer the question based ONLY on what you can observe from the chart image and vega_state provided.

Return your response in this EXACT JSON format (valid JSON only):

```json
{
  "question_type": "objective" or "subjective",
  "reasoning": "Your reasoning based on the chart",
  "key_insights": ["Insight 1 from the chart", "Insight 2 from the chart"],
  "answer": "YOUR ANSWER - REQUIRED, never leave empty"
}
```

CRITICAL:
- "answer" is REQUIRED. Provide your best answer from the chart. If the question asks for data you cannot see, give your best estimate or state what you can infer.
- "question_type": "objective" for specific facts/numbers; "subjective" for analysis/interpretation
- "key_insights": array of strings, observations from the chart
- Return valid JSON only.
"""


# Brief phase labels for protocol (lightweight, for visibility)
PROTOCOL_PHASE_HEADER = "Protocol: OBSERVE -> PLAN -> ACT -> VERIFY -> REASON."
PROTOCOL_OBSERVE_PLAN = "[OBSERVE & PLAN]"
PROTOCOL_VERIFY = "[VERIFY]"
PROTOCOL_REASON = "[REASON]"

# Explicit VERIFY instruction: check state vs user requirement
PROTOCOL_VERIFY_INSTRUCTION = """[VERIFY] Check the tool result and updated view above:
- Does the current state match what the user asked for?
- Can you answer the question now?
  - If YES: set exploration_complete=true and provide your answer.
  - If NO: set exploration_complete=false and specify next_action (which tool to call next)."""


# Benchmark-only: subjective "vague*" tasks (task_type contains "vague" in ground_truth).
# No path-based branching; uses question semantics from JSON only.
PROTOCOL_BENCHMARK_VAGUE_INTERACTION_GUIDE = """
## Benchmark: interaction-first tool use (vague subjective tasks)
Applies only to open-ended / vague analysis questions in this benchmark. Prefer **view-changing** tools that isolate, compare, reveal structure, or make a fuzzy visual claim checkable. Treat `get_data_summary` as a **last resort** when the question truly needs tabular aggregates and interaction cannot help.

**Decision checklist (you choose—no external routing):**
1. What evidence is still missing from the current view (occlusion, mixing groups, wrong scale, no partition)?
2. What is the **smallest** interaction chain (often 1–3 tool calls) that supplies that evidence?
3. If you skip tools, give a **one-sentence** justification: the view already encodes exactly what the question asks, and no registered tool would add information.

**Chart family → interaction tools (non-exhaustive; follow Available Tools list):**
- Scatter: `identify_clusters`, `filter_categorical`, `brush_region`, `zoom_2d_region`, `show_regression`, `calculate_correlation`
- Parallel coordinates: `filter_by_category`, `hide_dimensions`, `brush_region`, `highlight_region`
- Line: `zoom_x_region`, `filter_lines`, `highlight_region`, `detect_anomalies`, `focus_lines`
- Bar: `sort_bars`, `filter_categorical`, `toggle_stack_mode`, `filter_categories`
- Heatmap: `brush_region`, `highlight_region`, `cluster_rows_cols`, `filter_cells`, `change_encoding`
- Sankey: `trace_node`, `filter_flow`, `highlight_path`, `collapse_nodes`

### Few-shot patterns (fictional; intent → tool chain → then answer from updated view)
**Scatter — vague intent:** "Do the points fall into natural groups?"
- Sub-goals: (a) algorithmic partition (b) compare group locations
- Chain: `identify_clusters` (choose k sensibly) → optionally `filter_categorical` to inspect one cluster → reason on the updated color-encoded view.

**Parallel — vague intent:** "What separates the positive cases across axes?"
- Sub-goals: (a) isolate the target cohort (b) reduce visual clutter
- Chain: `filter_by_category` (keep/remove the right level) → `hide_dimensions` on non-informative axes → reason on the filtered bundle.

**Line — vague intent:** "Where does the series diverge the most?"
- Sub-goals: (a) focus the relevant time window (b) compare series fairly
- Chain: `zoom_x_region` → `filter_lines` or `highlight_region` as needed → reason on the focused comparison.

**Bar — vague intent:** "Who really leads once we ignore noise categories?"
- Sub-goals: (a) remove irrelevant categories (b) rank clearly
- Chain: `filter_categorical` → `sort_bars` → reason from the simplified ordering.

**Heatmap — vague intent:** "Where is the concentration / hotspot?"
- Sub-goals: (a) spatially isolate a region (b) emphasize extremes
- Chain: `brush_region` (or `select_submatrix` if available) → `highlight_region` → reason from the emphasized cells.

**Sankey — vague intent:** "Where does flow accumulate or leak?"
- Sub-goals: (a) anchor on a node or path (b) thin distractors
- Chain: `trace_node` → `filter_flow` (or `highlight_path`) → reason from the traced/thinned flow view.

**When not to call tools (rare):** the question only asks for a pattern already fully encoded (e.g., legend + unobstructed marks) and you can name concrete visual evidence; state that explicitly instead of calling tools for appearance only.
"""


def question_has_vague_task_type(question: Dict[str, Any]) -> bool:
    """True if ground_truth.task_type indicates a vague-style subjective task (e.g. vague_single)."""
    gt = question.get("ground_truth") or {}
    tt = str(gt.get("task_type", "")).lower()
    return "vague" in tt


# ============================================================
# Utility Functions (Same as run_benchmark)
# ============================================================

def strip_data_values(spec: Dict) -> Dict:
    """Remove data.values from spec to reduce file size."""
    if not spec:
        return spec
    result = spec.copy()
    if "data" in result and isinstance(result["data"], dict):
        if "values" in result["data"]:
            count = len(result["data"]["values"]) if isinstance(result["data"]["values"], list) else "?"
            result["data"] = {"_values_omitted": f"{count} items"}
    return result


def extract_final_state(spec: Dict, tool_state: Dict = None) -> Dict:
    """Extract pure state (no data) for evaluation.
    Prefer tool_state from last tool_result if available."""
    if tool_state is not None:
        st, _ = StateManager.split(tool_state) if "data" in tool_state else (tool_state, None)
        return st
    if not spec:
        return {}
    st, _ = StateManager.split(spec)
    return st


def serialize_vega_state_for_model(spec: Dict, tool_state: Dict = None) -> str:
    """Serialize pure vega_state (without data.values) for model input."""
    state = extract_final_state(spec, tool_state)
    try:
        return json.dumps(state, ensure_ascii=False)
    except Exception:
        return "{}"


def build_model_text_with_state(base_text: str, spec: Dict, tool_state: Dict = None) -> str:
    """Attach state-only context to model-visible text."""
    state_json = serialize_vega_state_for_model(spec, tool_state)
    return (
        f"{base_text}\n\n"
        f"Current vega_state (state-only, no data.values):\n"
        f"{state_json}"
    )


# Analysis data keys to extract from tool results (same as GPT mode)
TOOL_ANALYSIS_KEYS = [
    'cluster_statistics', 'correlation', 'correlation_coefficient', 'p_value',
    'summary', 'extremes', 'upstream', 'downstream', 'conversion',
    'conversions', 'high_loss_nodes'
]


def format_user_message_with_state(
    base_text: str,
    spec: Dict,
    tool_state: Dict = None,
) -> Dict[str, Any]:
    """Format user message with text-only state context."""
    return {
        "role": "user",
        "content": build_model_text_with_state(base_text, spec, tool_state)
    }


def load_task(task_path: str) -> Dict:
    """Load task config."""
    with open(task_path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_vega_spec(chart_id: str, task_dir: Path, vega_spec_path: Optional[str] = None) -> Dict:
    """Load Vega spec. Prefer vega_spec_path (relative to project root) when provided."""
    project_root = Path(__file__).resolve().parent.parent
    if vega_spec_path:
        path = project_root / vega_spec_path
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        raise FileNotFoundError(f"vega_spec_path not found: {vega_spec_path} (resolved: {path})")
    
    ID_MAP = {
        "cars_scatter_001": "cars_performance_efficiency",
        "cars_multivariate_002": "cars_performance_efficiency",
        "cars_multiregion_003": "cars_performance_efficiency",
        "scatter_clustering_001": "cars_performance_efficiency",
    }
    file_name = ID_MAP.get(chart_id, chart_id)
    base_paths = [
        task_dir.parent.parent.parent / "data",
        task_dir.parent.parent.parent.parent / "data",
        project_root / "benchmark" / "data",
        project_root / "data",
        project_root / "benchmark_annotation_system" / "backend" / "specs",
    ]
    if "/" in chart_id:
        full_path = Path(chart_id)
        if full_path.exists():
            with open(full_path, "r", encoding="utf-8") as f:
                return json.load(f)
    tried_paths = []
    for base in base_paths:
        for name in [file_name, chart_id]:
            p = f"{name}.json" if not str(name).endswith(".json") else name
            path = base / p
            tried_paths.append(path)
            if path.exists():
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
    raise FileNotFoundError(f"Vega spec not found for chart_id: {chart_id}. Tried: {tried_paths[:6]}")


def save_view(vega_spec: Dict, output_path: Path) -> str:
    """Save view as image."""
    vega_service = get_vega_service()
    result = vega_service.render(vega_spec)
    
    if result.get("success"):
        image_data = result["image_base64"]
        if "," in image_data:
            image_data = image_data.split(",")[1]
        
        image_bytes = base64.b64decode(image_data)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "wb") as f:
            f.write(image_bytes)
        
        return str(output_path)
    return ""


def create_client(config: ModelConfig) -> OpenAI:
    """Create OpenAI client."""
    api_key = get_api_key(config)
    if api_key is None:
        api_key = "dummy-key"
    
    return OpenAI(
        api_key=api_key,
        base_url=config.base_url,
        timeout=config.timeout
    )


def encode_image(image_base64: str) -> str:
    """Ensure image is in correct data URL format."""
    if image_base64.startswith("data:"):
        return image_base64
    return f"data:image/png;base64,{image_base64}"


def build_responses_input_content(
    input_mode: str,
    base_text: str,
    current_spec: Dict,
    current_state: Dict,
    current_image: str,
) -> List[Dict[str, Any]]:
    """Build Responses API content items for one user turn."""
    full_text = build_model_text_with_state(base_text, current_spec, current_state)
    content = [{"type": "input_text", "text": full_text}]
    if input_mode != "text_only":
        content.append({"type": "input_image", "image_url": encode_image(current_image)})
    return content


# ============================================================
# MCP Helper Functions
# ============================================================

def _fix_schema_types(schema: Dict[str, Any]) -> Dict[str, Any]:
    """Fix common incomplete definitions in JSON Schema."""
    if not isinstance(schema, dict):
        return schema
    
    schema.pop("$ref", None)
    schema.pop("nullable", None)
    
    schema_type = schema.get("type")
    
    if schema_type == "object":
        props = schema.get("properties", {})
        for prop_name, prop_def in props.items():
            props[prop_name] = _fix_schema_types_with_name(prop_def, prop_name)
        schema["properties"] = props
        if "additionalProperties" not in schema:
            schema["additionalProperties"] = True
    
    if schema_type == "array":
        if "items" not in schema:
            schema["items"] = {"type": "string"}
        else:
            schema["items"] = _fix_schema_types(schema["items"])
    
    return schema


def _fix_schema_types_with_name(prop_def: Any, prop_name: str) -> Any:
    """Infer reasonable default items type for arrays based on property name."""
    if not isinstance(prop_def, dict):
        return prop_def
    
    prop_type = prop_def.get("type")
    
    if prop_type == "array" and "items" not in prop_def:
        name_lower = prop_name.lower()
        if any(k in name_lower for k in ["range", "position", "coord", "point", "area", "bbox"]):
            prop_def["items"] = {"type": "number"}
        elif any(k in name_lower for k in ["id", "name", "label", "category", "field"]):
            prop_def["items"] = {"type": "string"}
        else:
            prop_def["items"] = {"type": "string"}
    
    return _fix_schema_types(prop_def)


def convert_mcp_tools_to_openai_format(mcp_tools) -> List[Dict[str, Any]]:
    """Convert MCP tool definitions to OpenAI Function Calling format."""
    openai_tools = []
    
    for tool in mcp_tools:
        parameters = tool.inputSchema if tool.inputSchema else {
            "type": "object",
            "properties": {},
            "required": []
        }
        
        params = _fix_schema_types(parameters)
        for key in ("vega_spec", "state"):
            if "properties" in params and key in params["properties"]:
                del params["properties"][key]
            if "required" in params and key in params["required"]:
                params["required"].remove(key)
        
        openai_tool = {
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description or "",
                "parameters": params
            }
        }
        
        openai_tools.append(openai_tool)
    
    return openai_tools


def _build_available_tools_section(openai_tools: Optional[List[Dict[str, Any]]]) -> str:
    """Build dynamic available-tools section from actual tool schemas."""
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


def _load_chart_skill_prompt(chart_type: str) -> str:
    """Load compact intent-decomposition skills by chart type for benchmark prompts."""
    chart_file_mapping = {
        "bar": "bar_chart.txt",
        "line": "line_chart.txt",
        "scatter": "scatter_plot.txt",
        "parallel": "parallel_coordinates.txt",
        "heatmap": "heatmap.txt",
        "sankey": "sankey_diagram.txt",
    }
    key = _normalize_chart_type_key(chart_type)
    filename = chart_file_mapping.get(key)
    if not filename:
        return ""
    file_path = Path(__file__).resolve().parents[1] / "prompts" / "chart_skills" / filename
    if not file_path.exists():
        return ""
    try:
        return file_path.read_text(encoding="utf-8")
    except Exception:
        return ""


def get_system_prompt_protocol(
    chart_type: str,
    openai_tools: Optional[List[Dict[str, Any]]] = None,
    benchmark_vague_extra: str = "",
) -> str:
    """System prompt for protocol mode: adds phase header and protocol-specific rules."""
    base = get_system_prompt(chart_type, openai_tools=openai_tools)
    protocol_rules = """
## Protocol-Specific Rules (OBSERVE → PLAN → ACT → VERIFY → REASON)
- You MUST complete the VERIFY phase before providing your final answer. Do not skip verification.
- For questions requiring calculation (e.g., correlation, aggregation), call the tool FIRST, then answer from the tool result—do not guess.
- If verification fails (state doesn't match requirement), continue with next_action—do not answer prematurely.
- Only set exploration_complete=true when the tool output or chart state confirms the answer.
"""
    extra = benchmark_vague_extra or ""
    return f"{PROTOCOL_PHASE_HEADER}\n\n{base}{protocol_rules}{extra}"

def get_system_prompt(chart_type: str, openai_tools: Optional[List[Dict[str, Any]]] = None) -> str:
    """Generate system prompt for the given chart type."""
    available_tools = _build_available_tools_section(openai_tools)
    chart_skills = _load_chart_skill_prompt(chart_type)
    chart_skills_section = (
        f"\n\n## Chart Intent Decomposition Skills\n{chart_skills.strip()}\n"
        if chart_skills.strip()
        else ""
    )
    return f"""You are a professional data visualization analysis assistant.

Current chart type: **{chart_type}**

## Analysis Strategy
1. Read the user question carefully and determine if it's OBJECTIVE (specific answer) or SUBJECTIVE (analysis/interpretation)
2. Use the provided tools for analysis - do NOT imagine or simulate tool operations
3. If a specific tool is mentioned in the question, prioritize using that tool
4. Answer based on actual tool results and observations

## Intent Grounding (Two-Phase, Per Iteration)
- Phase 1 (intent grounding): normalize the user question into a latent analytic intent and identify target entities.
- Phase 2 (tool planning): select the minimal next tool action that best serves that normalized intent.
- Prefer this compact intent set: rank_dominance, pairwise_compare_gap, relationship_strength, composition_mix, time_local_change, outlier_hotspot, flow_path_conversion, subgroup_slice.
- If multiple incompatible intents are plausible and no safe default exists, request clarification instead of guessing a random tool.

## Tool-Chain Discipline (Intent-Guided)
- If the question explicitly specifies a tool chain (e.g., "Use X then Y then Z"), execute that chain unless a step is invalid in current state.
- Do not stop after the first tool when required evidence is still missing.
- Prefer minimal sufficient actions guided by normalized intent; avoid rigid post-tool rituals that do not add evidence.
- Use available tools via function calling; each tool schema defines valid parameters.

{available_tools}
{chart_skills_section}

## Error Recovery
When a tool call fails (success: false in the tool response, with error/message in the response):
- The view state is preserved; the chart has not changed
- You can: (1) try a different tool with adjusted parameters, (2) use reset_view to restore the initial view, (3) use undo_view to revert the last operation, (4) if the task cannot be completed with available tools, provide your best answer based on the current view
- Do not give up after a single failure; explore alternative approaches before concluding

## Stop Criteria
- When the question is answered with sufficient evidence
- When all required tools have been called
- When repeating the same tool call multiple times
- When gaining no new insights from additional iterations

## Output Requirements
- For OBJECTIVE questions: provide a clear, concise answer (word/number/phrase)
- For SUBJECTIVE questions: provide key insights and comprehensive analysis
- For key_insights: include CONCRETE DATA (numbers, ranges, approximate values) when visible—e.g., "cluster around 5700 g", "HP 40-100, MPG 20-45"

## CRITICAL: Answer Field
- The "answer" field in your JSON response is REQUIRED and must contain your DIRECT final answer
- For OBJECTIVE questions: answer = ONE word, number, or short phrase ONLY (e.g., "Electronics", "Google Ads", "-0.78")
- Do NOT bury the answer in reasoning or key_insights—put it explicitly in the "answer" field
- Avoid long explanatory text in "answer"; use reasoning/key_insights for explanations

## NUMERIC FORMAT
- For counts (integers): write the integer directly (e.g., 42, 1100).
- For decimals: round to 3 decimal places (e.g., -0.123, 0.456).

## DATE FORMAT (when answer is a date or time period)
- Full date: YYYY-MM-DD (e.g., 2014-04-01)
- Year only: YYYY (e.g., 2011)
- Year + Quarter: YYYY Qn (e.g., 2026 Q1)
- Month-day: Mon DD (e.g., Apr 01)
- Months: use 3-letter abbrev (Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec)

## CORRELATION (yes/no questions)
- The calculate_correlation tool returns both correlation_coefficient and p_value.
- Use p_value for significance: when p_value >= 0.05, answer No (no significant correlation); when p_value < 0.05, answer Yes (significant correlation)."""


def get_system_prompt_manual(chart_type: str) -> str:
    """Minimal system prompt for manual mode: no VA framework, only role + output format."""
    return f"""You are a data visualization assistant. Chart type: **{chart_type}**

You can choose appropriate tools to answer the question. Output in JSON: question_type, reasoning, key_insights, answer. OBJECTIVE: answer = one word/number/phrase. SUBJECTIVE: key_insights + answer. CORRELATION (yes/no): p_value >= 0.05 → No, < 0.05 → Yes. NUMERIC: 3 decimal places. DATE: YYYY-MM-DD or YYYY Qn. The "answer" field is REQUIRED."""


def get_system_prompt_baseline(chart_type: str) -> str:
    """System prompt for baseline (no-tools) mode: answer from chart view only."""
    return f"""You are a data visualization analysis assistant.

Current chart type: **{chart_type}**

You have NO access to tools. Answer the user's question based ONLY on what you can observe from the chart image and vega_state provided. Do not describe what tools you would use—give your best answer from the visible chart content. If the question asks for data not directly visible, provide your best inference from the chart."""


def get_responses_remote_mcp_prompt(question_text: str, vega_spec: Dict) -> str:
    """Prompt for OpenAI Responses API + remote MCP experiment.

    Note: current chart tools expose `vega_spec` directly in their input schema,
    so the model needs the initial spec in context for its tool calls.
    """
    return f"""You are a data visualization analysis assistant with access to remote MCP tools.

Answer the user's question by using the MCP tools only when needed.

Important constraints:
- MCP tools in this experiment require a `vega_spec` argument.
- For the first MCP tool call, use the INITIAL_VEGA_SPEC JSON below as the `vega_spec` argument.
- If an MCP tool returns an updated `vega_spec` or `vega_state`, use the latest returned state for any subsequent tool calls.
- You may call zero, one, or multiple tools.
- When you finish, return VALID JSON only in this format:
{{
  "question_type": "objective" or "subjective",
  "reasoning": "brief reasoning",
  "key_insights": ["insight 1", "insight 2"],
  "answer": "final answer"
}}

User question:
{question_text}

INITIAL_VEGA_SPEC:
{json.dumps(vega_spec, ensure_ascii=False)}
"""


def get_analysis_prompt(is_final: bool = False) -> str:
    """Generate analysis phase prompt - align with run_benchmark.py."""
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
```

CRITICAL RULES:
1. "question_type": 
   - "objective": questions asking for specific values (numbers, names, yes/no, categories)
   - "subjective": questions asking for analysis, explanation, or interpretation

2. "key_insights": MUST be an array of STRINGS. Include insights discovered in THIS round.
   - For BOTH objective and subjective questions, provide insights
   - Include CONCRETE DATA when available: numbers, ranges, approximate values (e.g., "cluster around 5700 g", "HP 40-100, MPG 20-45")
   - Depth matters: vague descriptions score lower than insights with specific data support
   - Example: ["4-cylinder cars dominate the low-HP region", "The correlation is -0.78"]

3. "answer" - REQUIRED, NEVER LEAVE EMPTY. Put your DIRECT final answer here—do NOT bury it in reasoning or key_insights:
   - OBJECTIVE: ONE word, number, or short phrase ONLY (e.g., "Electronics", "Google Ads", "-0.78", "Yes")
   - SUBJECTIVE: A concise summary paragraph
   - The "answer" field must stand alone as the primary response; use reasoning for explanations.

4. CORRELATION (yes/no questions): Use the p_value from calculate_correlation tool—when p_value >= 0.05, answer No; when p_value < 0.05, answer Yes.

5. NUMERIC FORMAT: Round numeric answers to 3 decimal places (e.g., -0.123).

6. DATE FORMAT: When the answer is a date or time period, use: YYYY-MM-DD for full dates; YYYY for year only; YYYY Qn for quarters; Mon DD for month-day; 3-letter month abbrev (Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec).

Return VALID JSON only."""
    else:
        return """Analyze the current view and tool results. Return JSON with insights from THIS round:

```json
{
  "question_type": "objective" or "subjective",
  "reasoning": "What you observed and analyzed in this round",
  "key_insights": ["Insight 1 from this round", "Insight 2 from this round"],
  "answer": "Your current best answer (update as you learn more)",
  "exploration_complete": false,
  "next_action": "What tool to use next and why"
}
```

IMPORTANT:
- "key_insights": Include what you learned THIS round. Add CONCRETE DATA (numbers, ranges) when visible from the chart or tool results—e.g., "cluster around 5700 g", "HP 40-100".
- "answer": REQUIRED. Put your direct answer here—for objective questions use ONE word/number/phrase (e.g., "Electronics", "Google Ads"). Do NOT bury the answer in reasoning.
- CORRELATION (yes/no): Use p_value from tool—p_value >= 0.05 → No; p_value < 0.05 → Yes.
- NUMERIC FORMAT: Counts use integers; decimals round to 3 places (e.g., -0.123).
- DATE FORMAT: Use YYYY-MM-DD, YYYY, YYYY Qn, or Mon DD (3-letter month abbrev) as appropriate.
- Each round should add new insights based on new observations"""


def get_image_only_analysis_prompt(is_final: bool = False) -> str:
    """Prompt for image_only ablation: keep final answer, drop reasoning/insights requirements."""
    if is_final:
        return """Based on the current chart image and vega_state, provide your FINAL response in JSON:

```json
{
  "question_type": "objective" or "subjective",
  "answer": "YOUR FINAL ANSWER - REQUIRED",
  "exploration_complete": true
}
```

CRITICAL:
- "answer" is REQUIRED. Put your DIRECT final answer in the "answer" field—do NOT bury it in other text.
- For objective questions: ONE word, number, or short phrase ONLY (e.g., "Electronics", "Google Ads").
- For subjective questions: a concise summary paragraph.
- NUMERIC: Counts use integers; decimals round to 3 places. DATE: Use YYYY-MM-DD, YYYY, YYYY Qn, or Mon DD (3-letter month).
- Return valid JSON only."""

    return """Analyze the current chart image and vega_state, then return JSON:

```json
{
  "question_type": "objective" or "subjective",
  "answer": "Current best answer (REQUIRED, can be updated later)",
  "exploration_complete": false,
  "next_action": "Which tool to use next, or none"
}
```

CRITICAL:
- "answer" is REQUIRED. Put your direct answer here—for objective questions use ONE word/number/phrase.
- NUMERIC: Counts use integers; decimals round to 3 places. DATE: Use YYYY-MM-DD, YYYY, YYYY Qn, or Mon DD (3-letter month).
- Return valid JSON only."""


def format_user_message_with_image(text: str, image_base64: str, model_name: str = None) -> dict:
    """Format user message with image."""
    # Grok 使用不同的 image 格式
    if model_name and 'grok' in model_name.lower():
        # xAI Grok 格式: input_image 类型
        return {
            'role': 'user',
            'content': [
                {'type': 'text', 'text': text},
                {
                    'type': 'input_image',
                    'image_url': {
                        'url': f'data:image/png;base64,{image_base64}',
                        'detail': 'high'
                    }
                }
            ]
        }
    
    # 标准 OpenAI 格式
    return {
        'role': 'user',
        'content': [
            {'type': 'text', 'text': text},
            {
                'type': 'image_url',
                'image_url': {
                    'url': f'data:image/png;base64,{image_base64}',
                    'detail': 'high'
                }
            }
        ]
    }


def format_user_message_image_only(image_base64: str, model_name: str = None) -> dict:
    """Format user message with image only (no text content)."""
    if model_name and 'grok' in model_name.lower():
        return {
            'role': 'user',
            'content': [
                {
                    'type': 'input_image',
                    'image_url': {
                        'url': f'data:image/png;base64,{image_base64}',
                        'detail': 'high'
                    }
                }
            ]
        }

    return {
        'role': 'user',
        'content': [
            {
                'type': 'image_url',
                'image_url': {
                    'url': f'data:image/png;base64,{image_base64}',
                    'detail': 'high'
                }
            }
        ]
    }


def build_round_user_message(
    input_mode: str,
    base_text: str,
    current_spec: Dict,
    current_state: Dict,
    current_image: str,
    model_name: str = None,
) -> Dict[str, Any]:
    """
    Build user message for each round by modality mode.

    Modes:
    - text_and_image: analysis prompt + state + image
    - text_only: analysis prompt + state (no image)
    - image_only: state + image (drops analysis prompt text for ablation)
    """
    if input_mode not in INPUT_MODES:
        raise ValueError(f"Unknown input_mode: {input_mode}. Available: {sorted(INPUT_MODES)}")

    if input_mode == "text_only":
        return format_user_message_with_state(base_text, current_spec, current_state)

    if input_mode == "image_only":
        # image_only: state + image (no insights/reasoning in history, but state is required)
        full_text = build_model_text_with_state(base_text or "", current_spec, current_state)
        return format_user_message_with_image(full_text, current_image, model_name)

    # default: text_and_image
    full_text = build_model_text_with_state(base_text, current_spec, current_state)
    return format_user_message_with_image(full_text, current_image, model_name)


def parse_json_from_response(content: str) -> dict:
    """Parse JSON from response content."""
    if not content:
        return {}
    
    if "```json" in content:
        try:
            json_str = content.split("```json")[1].split("```")[0].strip()
            return json.loads(json_str)
        except (IndexError, json.JSONDecodeError):
            pass
    
    if "```" in content:
        try:
            json_str = content.split("```")[1].split("```")[0].strip()
            return json.loads(json_str)
        except (IndexError, json.JSONDecodeError):
            pass
    
    try:
        start = content.find('{')
        end = content.rfind('}')
        if start != -1 and end != -1:
            json_str = content[start:end+1]
            return json.loads(json_str)
    except json.JSONDecodeError:
        pass
    
    return {}


def extract_answer_from_text(content: str) -> Dict[str, Any]:
    """
    Extract answer from plain text response when JSON parsing fails.
    Looks for ANSWER:, KEY_INSIGHTS:, REASONING: markers.
    """
    result = {
        "question_type": "subjective",
        "answer": "",
        "key_insights": [],
        "reasoning": ""
    }
    
    # Extract ANSWER
    answer_match = re.search(r'ANSWER:\s*(.+?)(?=\n(?:KEY_INSIGHTS|REASONING)|$)', content, re.DOTALL | re.IGNORECASE)
    if answer_match:
        result["answer"] = answer_match.group(1).strip()
    
    # Extract KEY_INSIGHTS (bullet points)
    insights_match = re.search(r'KEY_INSIGHTS:\s*(.+?)(?=\n(?:ANSWER|REASONING)|$)', content, re.DOTALL | re.IGNORECASE)
    if insights_match:
        insights_text = insights_match.group(1)
        # Parse bullet points
        insights = re.findall(r'[-•]\s*(.+?)(?=\n[-•]|\n\n|$)', insights_text, re.DOTALL)
        result["key_insights"] = [ins.strip() for ins in insights if ins.strip()]
    
    # Extract REASONING
    reasoning_match = re.search(r'REASONING:\s*(.+?)(?=\n(?:ANSWER|KEY_INSIGHTS)|$)', content, re.DOTALL | re.IGNORECASE)
    if reasoning_match:
        result["reasoning"] = reasoning_match.group(1).strip()
    
    # Determine question type based on answer format
    if result["answer"]:
        # Short answers (single word/number) indicate objective
        answer_words = result["answer"].split()
        if len(answer_words) <= 3 and not result["key_insights"]:
            result["question_type"] = "objective"
    
    return result


def _response_item_field(item: Any, field: str, default: Any = None) -> Any:
    """Read a field from either SDK objects or plain dicts."""
    if isinstance(item, dict):
        return item.get(field, default)
    return getattr(item, field, default)


def extract_mcp_calls_from_response(response: Any) -> List[Dict[str, Any]]:
    """Extract remote MCP call records from a Responses API object."""
    calls: List[Dict[str, Any]] = []
    for item in getattr(response, "output", []) or []:
        if _response_item_field(item, "type") != "mcp_call":
            continue
        calls.append({
            "tool_name": _response_item_field(item, "name", ""),
            "parameters": json.loads(_response_item_field(item, "arguments", "{}") or "{}"),
            "result": {
                "success": _response_item_field(item, "error") in (None, ""),
                "error": _response_item_field(item, "error"),
                "output": _response_item_field(item, "output", ""),
            },
        })
    return calls


def update_chart_state_from_mcp_calls(
    tool_calls: List[Dict[str, Any]],
    current_spec: Dict,
    current_state: Dict,
) -> tuple[Dict, Dict]:
    """Best-effort update of final spec/state from remote MCP outputs."""
    latest_spec = current_spec
    latest_state = current_state

    for tool_call in tool_calls:
        output = tool_call.get("result", {}).get("output", "")
        if not isinstance(output, str) or not output.strip():
            continue
        try:
            parsed = json.loads(output)
        except Exception:
            continue

        updated = parsed.get("vega_spec") or parsed.get("vega_state")
        if updated:
            if isinstance(updated, dict) and ("data" not in updated or updated.get("data") is None):
                data = latest_spec.get("data")
                if data is not None:
                    updated = StateManager.reconstruct(updated, data)
            latest_spec = updated
            latest_state = parsed.get("state") or extract_final_state(latest_spec)
        elif parsed.get("state"):
            latest_state = parsed.get("state")

    return latest_spec, latest_state


def save_image_from_base64(image_base64: str, output_path: Path) -> str:
    """Save base64 image to file."""
    image_data = base64.b64decode(image_base64)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'wb') as f:
        f.write(image_data)
    return str(output_path)


# ============================================================
# System API Calling
# ============================================================

def _extract_message_dict(message):
    """Extract dict from message object."""
    if isinstance(message, dict):
        return message
    if hasattr(message, 'model_dump'):
        return message.model_dump()
    if hasattr(message, '__dict__'):
        return message.__dict__
    result = {}
    for key in ['final_spec', 'tool_calls_history', 'reasoning', 'iterations', 'mode']:
        if hasattr(message, key):
            result[key] = getattr(message, key, None)
    return result


def run_system_api_question(
    client: OpenAI,
    config: ModelConfig,
    question: Dict,
    vega_spec: Dict,
    output_dir: Optional[Path] = None
) -> Dict:
    """
    Call the system API which has internal tool logic.
    """
    question_text = question.get("question", "")
    qid = question.get("qid", "unknown")
    
    messages = [
        {"role": "system", "content": json.dumps(vega_spec)},
        {"role": "user", "content": f"{question_text}\n\n{EVALUATION_FORMAT}"}
    ]
    
    try:
        response = client.chat.completions.create(
            model=config.model,
            messages=messages,
            max_tokens=config.max_tokens,
            temperature=config.temperature,
        )
        
        message = response.choices[0].message
        answer = message.content or ""
        
        msg_dict = _extract_message_dict(message)
        final_spec = msg_dict.get('final_spec', vega_spec)
        tool_calls_history = msg_dict.get('tool_calls_history', [])
        reasoning = msg_dict.get('reasoning', "")
        iterations = msg_dict.get('iterations', 1)
        
        tool_calls = [
            {
                "tool_name": tc.get("tool_name", ""),
                "parameters": tc.get("parameters", {}),
                "result": tc.get("result", {})
            }
            for tc in tool_calls_history if isinstance(tc, dict)
        ]
        
        # Parse structured output from answer
        parsed = parse_json_from_response(answer)
        if not parsed:
            parsed = extract_answer_from_text(answer)
        
        key_insights = parsed.get("key_insights", [])
        question_type = parsed.get("question_type", "subjective").lower()  # Normalize to lowercase
        final_answer = parsed.get("answer") or parsed.get("final_answer") or answer
        parsed_reasoning = parsed.get("reasoning", reasoning)
        
        # Build reasoning_rounds for evaluator compatibility
        reasoning_rounds = []
        if parsed_reasoning:
            reasoning_rounds.append({
                "iteration": 1,
                "reasoning": parsed_reasoning
            })
        
        final_state = msg_dict.get('final_state') or extract_final_state(final_spec)
        gt = question.get("ground_truth") or {}
        return {
            "qid": qid,
            "question": question_text,
            "success": True,
            "answer": str(final_answer).strip() if final_answer else "",
            "question_type": question_type,
            "task_type": gt.get("task_type"),
            "key_insights": key_insights,
            "reasoning_rounds": reasoning_rounds,
            "reasoning": parsed_reasoning,
            "model": config.model,
            "tool_calls": tool_calls,
            "final_spec": strip_data_values(final_spec),
            "final_state": final_state,
            "state_check_fields": gt.get("state_check_fields"),
            "iterations": iterations
        }
        
    except Exception as e:
        print(f"      System API error: {e}")
        gt = question.get("ground_truth") or {}
        return {
            "qid": qid,
            "question": question_text,
            "success": False,
            "error": str(e),
            "answer": "",
            "question_type": "unknown",
            "task_type": gt.get("task_type"),
            "key_insights": [],
            "reasoning_rounds": [],
            "reasoning": "",
            "tool_calls": [],
            "final_spec": strip_data_values(vega_spec),
            "iterations": 0
        }


def run_single_request_with_responses_mcp(
    client: OpenAI,
    config: ModelConfig,
    question: Dict,
    vega_spec: Dict,
    chart_type: str,
    remote_mcp_url: str,
    input_mode: str = "text_and_image",
    output_dir: Optional[Path] = None,
) -> Dict:
    """Delegate to shared benchmark implementation to avoid duplication."""
    from benchmark.run_benchmark import run_single_request_with_responses_mcp as _shared_run

    return _shared_run(
        client=client,
        config=config,
        question=question,
        vega_spec=vega_spec,
        chart_type=chart_type,
        remote_mcp_url=remote_mcp_url,
        input_mode=input_mode,
        output_dir=output_dir,
    )


# ============================================================
# Multi-turn MCP Tool Calling 
# ============================================================

async def run_multi_turn_with_mcp(
    mcp_session,
    client: OpenAI,
    config: ModelConfig,
    openai_tools: List[Dict],
    question: Dict,
    vega_spec: Dict,
    chart_type: str,
    input_mode: str = "text_and_image",
    output_dir: Optional[Path] = None,
    max_iterations: int = 8
) -> Dict:
    """Delegate to shared benchmark implementation to avoid duplication."""
    from benchmark.run_benchmark import run_multi_turn_with_mcp as _shared_run

    return await _shared_run(
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
    )


async def run_multi_turn_without_tools(
    client: OpenAI,
    config: ModelConfig,
    question: Dict,
    vega_spec: Dict,
    chart_type: str,
    input_mode: str = "text_and_image",
    output_dir: Optional[Path] = None,
    max_iterations: int = 8
) -> Dict:
    """Delegate to shared benchmark implementation to avoid duplication."""
    from benchmark.run_benchmark import run_multi_turn_without_tools as _shared_run

    return await _shared_run(
        client=client,
        config=config,
        question=question,
        vega_spec=vega_spec,
        chart_type=chart_type,
        input_mode=input_mode,
        output_dir=output_dir,
        max_iterations=max_iterations,
    )




def _safe_json_chat_completion(client: OpenAI, config: ModelConfig, messages: List[Dict[str, Any]], openai_tools: Optional[List[Dict]] = None, tool_choice: Optional[Any] = None):
    kwargs = {
        "model": config.model,
        "messages": messages,
        "temperature": config.temperature,
    }
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


def _allowed_tools_from_openai(openai_tools: List[Dict[str, Any]]) -> List[str]:
    """Derive allowed tool names from openai_tools (same as manual MCP)."""
    return sorted(t.get("function", {}).get("name") for t in (openai_tools or []) if t.get("function", {}).get("name"))


def deterministic_verify_tool_result(tool_name: str, tool_args: Dict[str, Any], tool_result: Dict[str, Any], previous_spec: Dict[str, Any], updated_spec: Dict[str, Any]) -> Dict[str, Any]:
    success = bool(tool_result.get("success", False))
    if not success:
        return {"passed": False, "mode": "deterministic", "message": tool_result.get("error") or tool_result.get("message") or "tool reported failure"}

    try:
        if tool_name == "zoom_2d_region":
            x_domain = (((updated_spec.get("encoding", {}) or {}).get("x", {}) or {}).get("scale", {}) or {}).get("domain")
            y_domain = (((updated_spec.get("encoding", {}) or {}).get("y", {}) or {}).get("scale", {}) or {}).get("domain")
            exp_x = tool_result.get("zoom_range", {}).get("x") or list(tool_args.get("x_range", []))
            exp_y = tool_result.get("zoom_range", {}).get("y") or list(tool_args.get("y_range", []))
            passed = (list(x_domain or []) == list(exp_x or [])) and (list(y_domain or []) == list(exp_y or []))
            return {"passed": passed, "mode": "deterministic", "message": f"x_domain={x_domain}, y_domain={y_domain}"}

        if tool_name == "filter_categorical":
            transforms = updated_spec.get("transform", []) or []
            passed = len(transforms) > len(previous_spec.get("transform", []) or [])
            return {"passed": passed, "mode": "deterministic", "message": f"transform_count={len(transforms)}"}

        if tool_name in {"select_region", "brush_region"}:
            selected = tool_result.get("vega_state", {}).get("_selected_region") or updated_spec.get("_selected_region")
            passed = bool(selected)
            return {"passed": passed, "mode": "deterministic", "message": f"selected_region_present={passed}"}

        if tool_name == "calculate_correlation":
            points = tool_result.get("data_points", 0)
            coeff = tool_result.get("correlation_coefficient")
            passed = points >= 2 and coeff is not None
            return {"passed": passed, "mode": "deterministic", "message": f"data_points={points}, coeff={coeff}"}

        if tool_name == "identify_clusters":
            color_field = ((((updated_spec.get("encoding", {}) or {}).get("color", {}) or {}).get("field")))
            passed = isinstance(color_field, str) and color_field.startswith("cluster_")
            return {"passed": passed, "mode": "deterministic", "message": f"color_field={color_field}"}

        if tool_name == "show_regression":
            layers = updated_spec.get("layer", []) or []
            passed = len(layers) >= 2
            return {"passed": passed, "mode": "deterministic", "message": f"layer_count={len(layers)}"}

        if tool_name == "change_encoding":
            channel = tool_args.get("channel")
            field = tool_args.get("field")
            enc_field = ((((updated_spec.get("encoding", {}) or {}).get(channel, {}) or {}).get("field"))) if channel else None
            passed = bool(channel) and enc_field == field
            return {"passed": passed, "mode": "deterministic", "message": f"channel={channel}, field={enc_field}"}
    except Exception as e:
        return {"passed": False, "mode": "deterministic", "message": f"verify exception: {e}"}

    return {"passed": True, "mode": "deterministic", "message": "no specialized deterministic verify; accepted tool success"}


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
    if deterministic_verify.get("passed", False):
        return deterministic_verify
    if input_mode == "text_only":
        return deterministic_verify

    prompt = (
        f"Question: {question_text}\n\n"
        f"Expected observation after the last action: {expected_observation}\n"
        f"Deterministic verification failed with: {deterministic_verify.get('message', '')}\n\n"
        "Based on the current chart view and state, decide whether the expected effect is nonetheless visible. Return valid JSON only: "
        "{\"passed\": true or false, \"message\": \"brief judgment\"}"
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
        )
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
    benchmark_vague_interaction_guide: bool = False,
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
    sys_extra = PROTOCOL_BENCHMARK_VAGUE_INTERACTION_GUIDE if benchmark_vague_interaction_guide else ""
    system_prompt = get_system_prompt_protocol(
        chart_type, openai_tools=openai_tools, benchmark_vague_extra=sys_extra
    )
    initial_prompt = (
        f"{PROTOCOL_OBSERVE_PLAN} Please answer the following question:\n\n{question_text}\n\n{EVALUATION_FORMAT}"
    )
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


async def run_task_async(
    task_path: str,
    model_name: str,
    input_mode: str = "text_and_image",
    save_views: bool = True,
    output_dir: Optional[str] = None,
    tool_runtime: str = "auto",
    remote_mcp_url: Optional[str] = None,
) -> Dict:
    """
    Run full task (all questions).
    """
    config_for_runtime = get_model_config(model_name)
    effective_runtime = get_effective_runtime(model_name, tool_runtime)
    if effective_runtime != "protocol_va":
        # Non-protocol runtimes reuse the shared benchmark implementation.
        from benchmark.run_benchmark import run_task_async as _shared_run_task_async

        return await _shared_run_task_async(
            task_path=task_path,
            model_name=model_name,
            input_mode=input_mode,
            save_views=save_views,
            output_dir=output_dir,
            tool_runtime=effective_runtime,
            remote_mcp_url=remote_mcp_url,
        )

    # Load task
    task = load_task(task_path)
    task_id = task.get("task_id", task.get("chart_id", Path(task_path).stem))
    questions = task.get("questions", [])
    chart_type = task_id.split("_")[1] if len(task_id.split("_")) >= 2 else "scatter_plot"
    
    if not questions:
        return {"success": False, "error": "No questions found in task"}
    
    # Get model config
    config = config_for_runtime
    client = create_client(config)
    
    # Load Vega spec (prefer vega_spec_path when present)
    task_dir = Path(task_path).parent
    chart_id = task.get("chart_id", task_id)
    vega_spec_path = task.get("vega_spec_path")
    vega_spec = load_vega_spec(chart_id, task_dir, vega_spec_path=vega_spec_path)
    # Unwrap if task spec is wrapped as { "spec": { ... } } so MCP tools get standard Vega-Lite
    if isinstance(vega_spec.get("spec"), dict):
        vega_spec = vega_spec["spec"]

    # Output directory
    if output_dir:
        out_path = Path(output_dir)
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_path = Path("benchmark/results/new") / f"{task_id}_{model_name}_{timestamp}"
    
    out_path.mkdir(parents=True, exist_ok=True)
    
    print(f"\nRunning task: {task_id}")
    print(f"Model: {config.name} ({model_name})")
    print(f"Questions: {len(questions)}")
    print(f"Max iterations: {config.max_iterations}")
    print(f"Input mode: {input_mode}")
    print(f"Tool runtime: {tool_runtime}")
    print("-" * 50)
    
    results = []
    effective_runtime = "protocol_va"

    # This script now focuses on protocol runtime only.
    print("Connecting to MCP server...")
    server_params = StdioServerParameters(
        command="python",
        args=[str(MCP_SERVER_PATH)]
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as mcp_session:
            await mcp_session.initialize()
            print("MCP server connected")

            mcp_tools_response = await mcp_session.list_tools()
            mcp_tools = mcp_tools_response.tools
            openai_tools = convert_mcp_tools_to_openai_format(mcp_tools)
            print(f"Retrieved {len(openai_tools)} tools")
            custom_like = sorted(
                t.get("function", {}).get("name", "")
                for t in openai_tools
                if t.get("function", {}).get("name", "").startswith("custom_")
            )
            if custom_like:
                print(f"Custom tools visible to protocol: {custom_like}")
            print("-" * 50)

            # Run each question with protocol runner
            for i, question in enumerate(questions):
                qid = question.get("qid", f"q_{i}")
                print(f"\n[{i+1}/{len(questions)}] {qid}: {question.get('question', '')[:50]}...")

                result = await run_protocol_va_with_mcp(
                    mcp_session=mcp_session,
                    client=client,
                    config=config,
                    openai_tools=openai_tools,
                    question=question,
                    vega_spec=copy.deepcopy(vega_spec),
                    chart_type=chart_type,
                    input_mode=input_mode,
                    output_dir=out_path,
                    max_iterations=config.max_iterations,
                    benchmark_vague_interaction_guide=question_has_vague_task_type(question),
                )
                results.append(result)

                if result.get("success"):
                    print(f"    Type: {result.get('question_type', 'unknown')}")
                    print(f"    Answer: {result.get('answer', '')[:80]}...")
                    tools_used = [tc['tool_name'] for tc in result.get('tool_calls', [])]
                    print(f"    Tools: {tools_used}")
                else:
                    print(f"    Failed: {result.get('error', 'Unknown')}")
    
    # Summarize results (task_type is per-question in ground_truth; no top-level task_type)
    final_result = {
        "task_id": task_id,
        "model": model_name,
        "model_name": config.name,
        "runner_type": "agent",
        "effective_runtime": effective_runtime,
        "input_mode": input_mode,
        "timestamp": datetime.now().isoformat(),
        "questions_count": len(questions),
        "success_count": sum(1 for r in results if r.get("success")),
        "results": results
    }
    
    # Save results
    out_path.mkdir(parents=True, exist_ok=True)
    result_path = out_path / "result.json"
    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(final_result, f, indent=2, ensure_ascii=False)
    
    final_result["_output_dir"] = str(out_path)
    
    print("-" * 50)
    print(f"Results saved to: {result_path}")
    print(f"Success: {final_result['success_count']}/{len(questions)}")
    
    return final_result


def run_task(
    task_path: str,
    model_name: str,
    input_mode: str = "text_and_image",
    save_views: bool = True,
    output_dir: Optional[str] = None,
    tool_runtime: str = "auto",
    remote_mcp_url: Optional[str] = None,
) -> Dict:
    """Run full task (sync wrapper)."""
    return asyncio.run(run_task_async(task_path, model_name, input_mode, save_views, output_dir, tool_runtime, remote_mcp_url))


# ============================================================
# Command Line Entry
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="Unified Benchmark Runner (Simplified)")
    parser.add_argument("--task", help="Path to task JSON file")
    parser.add_argument("--model", help="Model to use (see --list-models)")
    parser.add_argument("--models", help="Comma-separated list of models")
    parser.add_argument("--output-dir", help="Output directory")
    parser.add_argument(
        "--tool-runtime",
        choices=["auto", "manual_mcp", "protocol_va", "responses_mcp"],
        default="auto",
        help="Tool execution runtime: manual_mcp (free-form loop), protocol_va (observe-plan-act-verify-reason), or responses_mcp (OpenAI Responses API + remote MCP)",
    )
    parser.add_argument(
        "--remote-mcp-url",
        help="Remote MCP server URL for responses_mcp mode",
    )
    parser.add_argument(
        "--input-mode",
        choices=sorted(INPUT_MODES),
        default="text_and_image",
        help="Round input mode: text_and_image | text_only | image_only",
    )
    parser.add_argument("--no-save-views", action="store_true", help="Don't save view images")
    parser.add_argument("--eval", action="store_true", help="Run evaluation after benchmark")
    parser.add_argument("--list-models", action="store_true", help="List available models")
    
    args = parser.parse_args()
    
    if args.list_models:
        print("Available models:")
        for name, display in list_available_models().items():
            print(f"  {name}: {display}")
        return
    
    if not args.task:
        print("Error: --task is required when running benchmarks")
        parser.print_help()
        return
    
    if args.models:
        models = [m.strip() for m in args.models.split(",")]
    elif args.model:
        models = [args.model]
    else:
        print("Error: --model or --models required")
        parser.print_help()
        return
    
    all_results = []
    for model in models:
        try:
            result = run_task(
                args.task,
                model,
                input_mode=args.input_mode,
                save_views=not args.no_save_views,
                output_dir=args.output_dir,
                tool_runtime=args.tool_runtime,
                remote_mcp_url=args.remote_mcp_url,
            )
            all_results.append(result)
        except Exception as e:
            print(f"Error running model {model}: {e}")
            import traceback
            traceback.print_exc()
    
    # Evaluation (run when --eval, always save results to output dir)
    if args.eval and all_results:
        print("\n" + "=" * 50)
        print("Running evaluation...")
        from benchmark.evaluators import UnifiedEvaluator
        from benchmark.run_evaluation import result_to_dict
        
        evaluator = UnifiedEvaluator()
        task_config = load_task(args.task)
        
        for result in all_results:
            if result.get("results"):
                print(f"\nModel: {result['model_name']}")
                eval_results_list = []
                for i, q_result in enumerate(result["results"]):
                    if q_result.get("success"):
                        # Build evaluation input
                        agent_result = {
                            "answer": q_result.get("answer"),
                            "question_type": q_result.get("question_type", "subjective"),
                            "key_insights": q_result.get("key_insights", []),  # List[str]
                            "reasoning_rounds": q_result.get("reasoning_rounds", []),  # List[Dict]
                            "reasoning": q_result.get("reasoning", ""),  # String
                            "tool_calls": q_result.get("tool_calls", []),
                            "final_spec": q_result.get("final_spec", {})
                        }
                        
                        eval_result = evaluator.evaluate_task(task_config, agent_result, i)
                        qid = q_result.get("qid", f"q_{i}")
                        _st = eval_result.state_score
                        _ss = f"{_st:.2f}" if _st is not None else "n/a"
                        line = f"  {qid}: answer={eval_result.answer_score:.2f}, " \
                               f"tool={eval_result.tool_score:.2f}, " \
                               f"state={_ss}"
                        print(line)
                        d = result_to_dict(eval_result)
                        d["qid"] = qid
                        d["question_idx"] = i
                        eval_results_list.append(d)
                    else:
                        eval_results_list.append({"qid": q_result.get("qid", f"q_{i}"), "success": False})
                
                # Save eval results to output dir (alongside result.json)
                output_dir = result.get("_output_dir")
                if output_dir and eval_results_list:
                    eval_path = Path(output_dir) / "eval_result.json"
                    with open(eval_path, "w", encoding="utf-8") as f:
                        json.dump({
                            "model": result.get("model_name", result.get("model", "")),
                            "task_id": result.get("task_id", ""),
                            "timestamp": datetime.now().isoformat(),
                            "results": eval_results_list
                        }, f, indent=2, ensure_ascii=False)
                    print(f"  Evaluation saved to: {eval_path}")


if __name__ == "__main__":
    main()