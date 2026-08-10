"""Run a Gemini agent against a VisAgentBench Widget Kit instance.

This keeps the original OpenRouter/Gemini entry point, but replaces the old
Vega-specific MCP server with the persistent Kit runtime bridge. Every run is
stored in one result.json containing the conversation, tool trace, answer and
final Kit state.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from openai import OpenAI
from core.vega_service import VegaService

from .artifacts import result_directory
from .model_registry import get_benchmark_model, list_benchmark_models


ROOT = Path(__file__).resolve().parents[1]
BRIDGE = ROOT / "tools" / "kit_runtime_bridge.mjs"
CONFIG = {
    "api_key_env": "OPENROUTER_API_KEY",
    "base_url": "https://openrouter.ai/api/v1",
    # The observation contains a workspace image. Use a vision-capable model
    # by default; text-only models will be rejected by OpenRouter when the
    # multimodal message part is present.
    "model": "google/gemini-2.5-flash",
    "max_iterations": None,
    "temperature": 0.2,
    "timeout": 180,
    "max_tokens": 4096,
}

def clone(value: Any) -> Any:
    return json.loads(json.dumps(value, ensure_ascii=False)) if value is not None else value


def build_response_requirements(instance: dict[str, Any]) -> dict[str, Any]:
    """Expose only answer type labels to the model, never evaluator checks/values."""
    answer_config = ((instance.get("evaluation") or {}).get("answer") or {})
    declared_type = answer_config.get("type")
    if declared_type in {"numeric", "boolean", "categorical", "interval"}:
        return {"mode": "verifiable", "answerType": declared_type}
    checks = answer_config.get("checks") or []
    answer_types = []
    for check in checks:
        if not isinstance(check, dict):
            continue
        check_type = check.get("check")
        field = check.get("field")
        if check_type not in {"numeric", "boolean", "interval", "categorical"}:
            continue
        answer_types.append(check_type)
    if answer_types:
        # Verifiable instances are intentionally single-answer-type tasks.
        return {"mode": "verifiable", "answerType": answer_types[0]}
    return {"mode": "open_ended"}


def build_no_tool_messages(
    *,
    objective: str,
    observation: dict[str, Any],
    response_requirements: dict[str, Any],
) -> list[dict[str, Any]]:
    """Build the visual-only baseline prompt from the normal first observation."""
    image = ((observation.get("view") or {}).get("image") or {})
    raw_image = image.get("data") or image.get("dataUrl") or image.get("base64")
    if not isinstance(raw_image, str) or not raw_image:
        raise RuntimeError("No captured observation image is available for planner level 0.")
    mime_type = image.get("mimeType") or "image/png"
    image_url = raw_image if raw_image.startswith("data:") else f"data:{mime_type};base64,{raw_image}"
    answer_type = response_requirements.get("answerType") if response_requirements.get("mode") == "verifiable" else None
    typed_instruction = (
        f"Return one {answer_type} answer value in the answer field."
        if answer_type
        else "Return a concise answer in the answer field."
    )
    payload = json.dumps({
        "objective": objective,
        "responseRequirements": response_requirements,
        "requiredResponseShape": {"answer": "typed value or string"},
    }, ensure_ascii=False)
    return [
        {
            "role": "system",
            "content": (
                "You are answering a visual analytics question from the supplied image. "
                "Do not assume access to tools, widget state, source data, or hidden specifications. "
                f"{typed_instruction} Return JSON only with exactly one top-level answer key."
            ),
        },
        {
            "role": "user",
            "content": [
                {"type": "text", "text": payload},
                {"type": "image_url", "image_url": {"url": image_url}},
            ],
        },
    ]


EVALUATION_STATE_DROP_KEYS = {
    "rawSpec",
    "replayContext",
    "workspaceSpec",
    "baselineSpec",
    "currentSpec",
    "planningRequest",
}

TOOL_RESULT_DROP_KEYS = EVALUATION_STATE_DROP_KEYS | {
    "statePatch",
    "recoverableState",
    "finalSnapshot",
    "widgets",
}


def compact_evaluation_value(value: Any) -> Any:
    if isinstance(value, list):
        return [compact_evaluation_value(item) for item in value]
    if isinstance(value, dict):
        return {
            key: compact_evaluation_value(item)
            for key, item in value.items()
            if key not in EVALUATION_STATE_DROP_KEYS
        }
    return value


def compact_tool_result(value: Any) -> Any:
    if isinstance(value, list):
        return [compact_tool_result(item) for item in value]
    if isinstance(value, dict):
        return {
            key: compact_tool_result(item)
            for key, item in value.items()
            if key not in TOOL_RESULT_DROP_KEYS
        }
    return value


def compact_tool_execution(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    keys = (
        "ok", "success", "callId", "actionName", "name", "kind", "stateId",
        "updatedRefs", "outputSummary", "summary", "error", "result",
        "propagationSummary", "guidance",
    )
    compact = compact_evaluation_value({key: value[key] for key in keys if key in value})
    returned = value.get("result") or value.get("actionResult")
    if returned is not None:
        compact["returned_result"] = compact_tool_result(returned)
    return compact


def compact_tool_verification(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    keys = ("ok", "verified", "status", "summary", "guidance", "checks", "stateId")
    return compact_evaluation_value({key: value[key] for key in keys if key in value})


def read_state_check_actual(state_widgets: Any, state_ref: str | None, property_name: str | None) -> Any:
    """Resolve a canonical Kit state ref without storing the whole widgets map."""
    if not isinstance(state_widgets, dict) or not state_ref:
        return None
    widget_state = state_widgets.get(state_ref)
    if isinstance(widget_state, dict):
        return widget_state.get(property_name)
    state_identity = _widget_ref_identity(state_ref)
    for widget_ref, candidate in state_widgets.items():
        if not isinstance(widget_ref, str) or not isinstance(candidate, dict):
            continue
        if state_identity and _widget_ref_identity(widget_ref) == state_identity:
            return candidate.get(property_name)
        prefix = f"{widget_ref}/"
        if not state_ref.startswith(prefix):
            continue
        path = state_ref[len(prefix):].split("/")
        node: Any = candidate
        for segment in path:
            if not isinstance(node, dict):
                return None
            node = node.get(segment)
        return node
    return None


def _widget_ref_identity(widget_ref: str) -> tuple[str, str] | None:
    match = re.search(r"/workspace/([^/]+)/widget/([^/]+)", widget_ref)
    return (match.group(1), match.group(2)) if match else None


def save_observation_images(session: dict[str, Any], image_dir: Path) -> list[dict[str, Any]]:
    """Save each visual observation as a human-inspectable image file."""
    image_dir.mkdir(parents=True, exist_ok=True)
    images: list[dict[str, Any]] = []
    turns = session.get("turns", []) if isinstance(session, dict) else []
    for index, turn in enumerate(turns):
        observation = turn.get("observe", {}) if isinstance(turn, dict) else {}
        view = observation.get("view", {}) if isinstance(observation, dict) else {}
        image = view.get("image") if isinstance(view, dict) else None
        if not isinstance(image, dict) or not image.get("data"):
            continue
        raw_data = image.get("data")
        mime_type = image.get("mimeType") or "image/png"
        if isinstance(raw_data, str) and raw_data.startswith("data:"):
            header, encoded = raw_data.split(",", 1)
            mime_type = header.split(";", 1)[0].removeprefix("data:") or mime_type
        else:
            encoded = raw_data
        extension = "png" if mime_type == "image/png" else "svg" if mime_type == "image/svg+xml" else "bin"
        state_id = observation.get("state", {}).get("stateId") if isinstance(observation.get("state"), dict) else None
        safe_state = re.sub(r"[^A-Za-z0-9_.-]+", "_", str(state_id or f"turn_{index + 1}"))
        image_path = image_dir / f"turn_{index + 1:03d}_{safe_state}.{extension}"
        image_path.write_bytes(base64.b64decode(encoded))
        images.append({
            "turn": index + 1,
            "state_id": state_id,
            "ref": image.get("ref"),
            "mime_type": mime_type,
            "width": image.get("width"),
            "height": image.get("height"),
            "path": str(image_path.relative_to(image_dir.parent)) if image_dir.parent in image_path.parents else str(image_path),
        })
    return images


def save_post_turn_images(post_turn_images: list[dict[str, Any]], image_dir: Path) -> list[dict[str, Any]]:
    """Save post-action snapshots separately from pre-action observations."""
    image_dir.mkdir(parents=True, exist_ok=True)
    saved: list[dict[str, Any]] = []
    for item in post_turn_images:
        raw_data = item.get("data")
        if not raw_data:
            continue
        if isinstance(raw_data, str) and raw_data.startswith("data:"):
            raw_data = raw_data.split(",", 1)[1]
        try:
            payload = base64.b64decode(raw_data)
        except Exception:
            continue
        turn = int(item.get("turn") or len(saved) + 1)
        state_id = str(item.get("state_id") or "final").replace(":", "_")
        path = image_dir / f"turn_{turn:03d}_post_{state_id}.png"
        path.write_bytes(payload)
        saved.append({
            "turn": turn,
            "phase": "post_action",
            "state_id": item.get("state_id"),
            "ref": item.get("ref"),
            "mime_type": item.get("mime_type") or "image/png",
            "width": item.get("width"),
            "height": item.get("height"),
            "path": str(path.relative_to(image_dir.parent)),
        })
    return saved


def build_evaluation_trace(session: dict[str, Any]) -> list[dict[str, Any]]:
    """Keep only answer/state/tool evidence needed by benchmark evaluation."""
    trace = []
    for index, turn in enumerate(session.get("turns", []) if isinstance(session, dict) else []):
        observe = turn.get("observe") or {}
        plan = turn.get("plan") or {}
        act = turn.get("act") or {}
        verify = turn.get("verify") or {}
        reason = turn.get("reason") or {}
        operation = plan.get("operation") or plan.get("step") or {}
        view = observe.get("view") if isinstance(observe, dict) else {}
        image = view.get("image") if isinstance(view, dict) else {}
        trace.append({
            "turn": index + 1,
            "answer": {
                "progress": reason.get("answer"),
                "completion": reason.get("completion"),
            },
            "state": {
                "observation": compact_evaluation_value(observe.get("state")),
                "observation_image_ref": image.get("ref") if isinstance(image, dict) else None,
                "action_state_id": act.get("stateId"),
                "verification": compact_evaluation_value(verify),
            },
            "tool": {
                "operation": clone(operation),
                "execution": compact_evaluation_value(act),
                "verification": compact_evaluation_value(verify),
            },
        })
    return trace


def build_scoring_result(
    session: dict[str, Any],
    final_state: dict[str, Any],
    observation_images: list[dict[str, Any]],
    evaluation: dict[str, Any] | None = None,
    answer_determinacy: str | None = None,
) -> dict[str, Any]:
    """Build the compact actual-result surface consumed by evaluators."""
    trace = build_evaluation_trace(session)
    answer_turns = [
        {
            "turn": entry["turn"],
            "answer": entry["answer"].get("progress"),
            "completion": entry["answer"].get("completion"),
        }
        for entry in trace
    ]
    state_turns = [
        {
            "turn": entry["turn"],
            "observation_state_id": (entry["state"].get("observation") or {}).get("stateId"),
            "action_state_id": entry["state"].get("action_state_id"),
            "image_ref": entry["state"].get("observation_image_ref"),
        }
        for entry in trace
    ]
    tool_steps = []
    tool_executions = []
    tool_results = []
    for entry in trace:
        operation = entry["tool"].get("operation") or {}
        target = operation.get("target") or {}
        tool_steps.append({
            "step_id": f"step_{entry['turn']}",
            "operation": operation.get("name"),
            "target_widget_ref": target.get("widgetRef"),
            "params": operation.get("params") or {},
        })
        compact_execution = compact_tool_execution(entry["tool"].get("execution"))
        tool_executions.append({
            "step_id": f"step_{entry['turn']}",
            "execution": compact_execution,
            "verification": compact_tool_verification(entry["tool"].get("verification")),
        })
        tool_results.append({
            "step_id": f"step_{entry['turn']}",
            "result": compact_execution.get("returned_result"),
        })

    actual_state_checks = []
    answer_determinacy = answer_determinacy or (
        (evaluation or {}).get("taxonomy", {}).get("answer_determinacy")
        if isinstance(evaluation, dict) else None
    )
    state_widgets = final_state.get("widgets", {}) if isinstance(final_state, dict) else {}
    expected_state = (evaluation or {}).get("state", {}) if isinstance(evaluation, dict) else {}
    for check in expected_state.get("checks", []) if isinstance(expected_state, dict) else []:
        state_ref = check.get("state_ref")
        property_name = check.get("property")
        actual_state_checks.append({
            "check_id": check.get("check_id"),
            "state_ref": state_ref,
            "property": property_name,
            "actual": compact_evaluation_value(
                read_state_check_actual(state_widgets, state_ref, property_name)
            ),
        })

    return {
        "answer_determinacy": answer_determinacy,
        "answer": {
            "answer_determinacy": answer_determinacy,
            "answer": session.get("answer") if isinstance(session, dict) else None,
            "turns": answer_turns,
        },
        "state": {
            "checks": actual_state_checks,
            "turns": state_turns,
        },
        "tool": {
            "steps": tool_steps,
            "executions": tool_executions,
            "results": tool_results,
        },
        "images": observation_images,
    }


def json_schema_for_tool(schema: dict[str, Any] | None) -> dict[str, Any]:
    """Keep Kit descriptor schemas, while making them safe for tool APIs."""
    schema = clone(schema or {"type": "object", "properties": {}})
    if not isinstance(schema, dict):
        return {"type": "object", "properties": {}}
    schema.pop("$ref", None)
    if schema.get("type") == "object":
        schema.setdefault("properties", {})
        for name, value in list(schema["properties"].items()):
            schema["properties"][name] = json_schema_for_tool(value)
    elif schema.get("type") == "array":
        schema.setdefault("items", {"type": "string"})
        schema["items"] = json_schema_for_tool(schema["items"])
    return schema


def tool_name(prefix: str, operation: str) -> str:
    return f"{prefix}__{operation.replace('.', '__')}"


def build_model_tools(workspace: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, tuple[str, str]]]:
    tools: list[dict[str, Any]] = []
    mapping: dict[str, tuple[str, str]] = {}
    for descriptor in workspace.get("actions", []):
        operation = descriptor.get("name")
        if not operation:
            continue
        name = tool_name("kit_action", operation)
        tools.append({
            "type": "function",
            "function": {
                "name": name,
                "description": f"Kit action {operation}. {descriptor.get('description', '')}",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "target_widget_ref": {"type": "string"},
                        "params": json_schema_for_tool(descriptor.get("paramsSchema")),
                    },
                    "required": ["target_widget_ref", "params"],
                },
            },
        })
        mapping[name] = ("action", operation)
    for descriptor in workspace.get("perceptionQueries", []):
        operation = descriptor.get("name")
        if not operation:
            continue
        name = tool_name("kit_perception", operation)
        tools.append({
            "type": "function",
            "function": {
                "name": name,
                "description": f"Kit perception {operation}. {descriptor.get('description', '')}",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "target_widget_ref": {"type": "string"},
                        "params": json_schema_for_tool(descriptor.get("paramsSchema")),
                    },
                    "required": ["target_widget_ref", "params"],
                },
            },
        })
        mapping[name] = ("perception", operation)
    return tools, mapping


class KitBridge:
    def __init__(self, instance_path: Path, chat_handler=None, render_handler=None):
        self.process = subprocess.Popen(
            ["node", str(BRIDGE), str(instance_path)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        self.counter = 0
        self.chat_handler = chat_handler
        self.render_handler = render_handler
        self.post_turn_images: list[dict[str, Any]] = []

    def _send(self, request: dict[str, Any]) -> None:
        assert self.process.stdin
        self.process.stdin.write(json.dumps(request, ensure_ascii=False) + "\n")
        self.process.stdin.flush()

    def call(self, method: str, **payload: Any) -> dict[str, Any]:
        self.counter += 1
        request = {"id": self.counter, "method": method, **payload}
        assert self.process.stdout
        self._send(request)
        while True:
            line = self.process.stdout.readline()
            if not line:
                stderr = self.process.stderr.read() if self.process.stderr else ""
                raise RuntimeError(f"Kit runtime bridge exited unexpectedly: {stderr}")
            response = json.loads(line)
            event = response.get("event")
            if event == "agent_turn":
                turn = response.get("turn") or {}
                print(
                    f"\n[Kit turn {turn.get('index')}] state={turn.get('stateId')} image={turn.get('imageRef')}",
                    flush=True,
                )
                print(f"  operation: {json.dumps(turn.get('operation'), ensure_ascii=False)}", flush=True)
                print(f"  action: ok={turn.get('action', {}).get('ok')} state={turn.get('action', {}).get('stateId')} result={json.dumps(turn.get('action', {}).get('result'), ensure_ascii=False)}", flush=True)
                print(f"  verify: ok={turn.get('verification', {}).get('ok')} {turn.get('verification', {}).get('summary') or ''}", flush=True)
                print(f"  answer: {turn.get('answer') or ''}", flush=True)
                post_image = turn.get("postImage")
                if isinstance(post_image, dict) and post_image.get("data"):
                    self.post_turn_images.append({
                        "turn": turn.get("index"),
                        "state_id": post_image.get("stateId"),
                        "ref": post_image.get("ref"),
                        "mime_type": post_image.get("mimeType") or "image/png",
                        "width": post_image.get("width"),
                        "height": post_image.get("height"),
                        "data": post_image.get("data"),
                    })
                    print(f"  post_action_image: {post_image.get('ref')} state={post_image.get('stateId')}", flush=True)
                continue
            if event not in {"chat_request", "render_request"}:
                break
            if event == "chat_request":
                if self.chat_handler is None:
                    raise RuntimeError("Kit requested a chat completion but no chat handler is configured.")
                self._send({
                    "method": "chat_response",
                    "request_id": response["request_id"],
                    "response": self.chat_handler(response["request"]),
                })
            else:
                if self.render_handler is None:
                    raise RuntimeError("Kit requested a view render but no render handler is configured.")
                try:
                    render_response = self.render_handler(response["request"])
                    self._send({
                        "method": "render_response",
                        "request_id": response["request_id"],
                        "response": render_response,
                    })
                except Exception as error:
                    self._send({
                        "method": "render_response",
                        "request_id": response["request_id"],
                        "error": {"message": str(error)},
                    })
        if not response.get("ok"):
            raise RuntimeError(response.get("error", {}).get("message", "Kit runtime call failed"))
        return response.get("result")

    def close(self) -> None:
        if self.process.poll() is None:
            self.process.terminate()
            self.process.wait(timeout=5)


def configure_model(model_key: str, *, max_iterations: int | None = None) -> str:
    model = get_benchmark_model(model_key)
    CONFIG.update({
        "api_key_env": model.api_key_env,
        "base_url": model.base_url,
        "model": model.model,
        "max_tokens": model.max_tokens,
        "temperature": model.temperature,
        "timeout": model.timeout,
        "max_iterations": max_iterations if max_iterations is not None else model.max_iterations,
    })
    return model_key


def make_client() -> OpenAI:
    key = os.getenv(CONFIG["api_key_env"])
    if not key:
        raise RuntimeError(f"Please set {CONFIG['api_key_env']}")
    return OpenAI(api_key=key, base_url=CONFIG["base_url"], timeout=CONFIG["timeout"])


def system_prompt(workspace: dict[str, Any], query: str) -> str:
    return f"""You are an agent operating a visualization workspace through Widget Kit.

User query: {query}

Use the supplied Kit actions and perceptions. Every tool call must contain:
- target_widget_ref: the exact widget ref from the workspace description
- params: the native Kit parameter object for that descriptor

Do not invent Vega-specific operations, raw specs, or hidden parameters. Use
perception tools to obtain evidence and use actions when the query requires a
state-changing interaction. For linked widgets, inspect the resulting target
state after a source action. Finish with a concise direct answer. Always provide
an answer, even when a tool fails.

Workspace summary:
{json.dumps({k: workspace.get(k) for k in ('runtimeTopology', 'widgets', 'links')}, ensure_ascii=False)}
"""


def parse_json(content: str) -> dict[str, Any]:
    if not content:
        return {}
    try:
        value = json.loads(content)
        return value if isinstance(value, dict) else {"answer": value}
    except json.JSONDecodeError:
        match = re.search(r"```json\s*(.*?)\s*```", content, re.S)
        if match:
            try:
                value = json.loads(match.group(1))
                return value if isinstance(value, dict) else {"answer": value}
            except json.JSONDecodeError:
                pass
    return {"answer": content}


def run_benchmark(
    task_path: str,
    *,
    planner_level: int,
    model_key: str = "gemini",
    results_root: Path | None = None,
    max_iterations: int | None = None,
) -> dict[str, Any]:
    configure_model(model_key, max_iterations=max_iterations)
    instance_path = Path(task_path).resolve()
    instance = json.loads(instance_path.read_text(encoding="utf-8"))
    client = make_client()
    vega_service = VegaService()
    started = datetime.now().isoformat()
    chat_requests: list[dict[str, Any]] = []

    def complete_chat(request: dict[str, Any]) -> dict[str, Any]:
        chat_requests.append(clone(request))
        model = request.get("model") or CONFIG["model"]
        try:
            response = client.chat.completions.create(
                model=model,
                messages=request.get("messages") or [],
                temperature=request.get("temperature", CONFIG["temperature"]),
                response_format=request.get("responseFormat") or {"type": "json_object"},
                max_tokens=CONFIG["max_tokens"],
            )
        except Exception as error:
            if "image input" in str(error).lower() or "vision" in str(error).lower():
                raise RuntimeError(
                    f"Model {model!r} does not support image input. "
                    "Use a vision-capable model such as google/gemini-2.5-flash "
                    "or pass --model explicitly."
                ) from error
            raise
        message = response.choices[0].message
        return {
            "content": message.content or "",
            "raw": response.model_dump() if hasattr(response, "model_dump") else None,
        }

    def render_view(request: dict[str, Any]) -> dict[str, Any]:
        widgets = request.get("widgets") or []
        focused_id = request.get("focusedWidgetId")
        if not widgets:
            return {"success": False, "error": "No widget spec was supplied for rendering."}
        rendered = vega_service.render_workspace(
            widgets,
            focused_widget_id=focused_id,
            output_format="png",
            columns=request.get("columns", 1),
        )
        if not rendered.get("success"):
            raise RuntimeError(rendered.get("error", "Vega rendering failed."))
        return {
            "image_base64": rendered.get("image_base64"),
            "mimeType": "image/png",
            "ref": f"widgetva-image:{request.get('stateId') or 'workspace'}",
            "renderer": rendered.get("renderer"),
            "widgetIds": rendered.get("widgetIds", []),
            "width": rendered.get("width"),
            "height": rendered.get("height"),
        }

    bridge = KitBridge(instance_path, chat_handler=complete_chat, render_handler=render_view)
    try:
        described = bridge.call("describe")
        workspace = described["workspace"]
        query = instance["query"]
        output_dir = result_directory(
            results_root or ROOT / "benchmark" / "results",
            model_key=model_key,
            planner_level=planner_level,
            benchmark_id=instance["benchmark_id"],
        )
        output_dir.mkdir(parents=True, exist_ok=True)
        instance_snapshot = output_dir / "instance.json"
        if not instance_snapshot.exists():
            shutil.copy2(instance_path, instance_snapshot)
        image_dir = output_dir / "images"
        response_requirements = build_response_requirements(instance)
        if planner_level == 0:
            initial_observation = bridge.call("observe", query=query)
            no_tool_response = complete_chat({
                "model": CONFIG["model"],
                "temperature": CONFIG["temperature"],
                "responseFormat": {"type": "json_object"},
                "messages": build_no_tool_messages(
                    objective=query,
                    observation=initial_observation,
                    response_requirements=response_requirements,
                ),
            })
            parsed = parse_json(no_tool_response.get("content") or "")
            session = {
                "answer": parsed.get("answer") if isinstance(parsed, dict) else parsed,
                "turns": [],
                "status": "completed",
            }
            observation_images = save_observation_images(
                {"turns": [{"observe": initial_observation}]},
                image_dir,
            )
            post_images = []
        else:
            session = bridge.call(
                "agent_session",
                objective=query,
                model=CONFIG["model"],
                temperature=CONFIG["temperature"],
                maxTurns=CONFIG["max_iterations"],
                plannerContext=instance.get("planner_context") or instance.get("plannerContext"),
                plannerLevel=planner_level,
                responseRequirements=response_requirements,
            )
            observation_images = save_observation_images(session, image_dir)
            post_images = save_post_turn_images(bridge.post_turn_images, image_dir)
        final_state = bridge.call("state")
        all_images = observation_images + post_images
        scoring = build_scoring_result(
            session,
            final_state,
            all_images,
            evaluation=instance.get("evaluation"),
            answer_determinacy=(instance.get("taxonomy") or {}).get("answer_determinacy"),
        )
        result = {
            "task_id": instance["task_id"],
            "benchmark_id": instance["benchmark_id"],
            "asl": instance["asl"],
            "planner_level": planner_level,
            "query": query,
            "model_key": model_key,
            "model": CONFIG["model"],
            "max_iterations": CONFIG["max_iterations"],
            "started_at": started,
            "finished_at": datetime.now().isoformat(),
            "runtime": "widgetva-kit",
            # Actual model-produced evidence only. The benchmark instance's
            # ground-truth evaluation block is intentionally not copied here.
            "answer_determinacy": scoring.get("answer_determinacy"),
            "answer": scoring["answer"],
            "state": scoring["state"],
            "tool": scoring["tool"],
            "images": scoring["images"],
        }
        output_path = output_dir / "result.json"
        output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        return result
    finally:
        bridge.close()


def expand_task_paths(task_paths: list[str]) -> list[Path]:
    """Resolve one or more instance files/directories for a batch run."""
    resolved: list[Path] = []
    seen: set[Path] = set()
    for raw_path in task_paths:
        path = Path(raw_path).expanduser().resolve()
        candidates = sorted(path.glob("*.json")) if path.is_dir() else [path]
        for candidate in candidates:
            if not candidate.is_file() or candidate.suffix.lower() != ".json":
                continue
            if candidate not in seen:
                seen.add(candidate)
                resolved.append(candidate)
    if not resolved:
        raise FileNotFoundError("No benchmark JSON instances were found in the supplied paths.")
    return resolved


def main() -> None:
    parser = argparse.ArgumentParser(description="Run one model on a WidgetVA Kit benchmark instance")
    parser.add_argument(
        "task_paths",
        nargs="+",
        help="One or more instance JSON files, or directories containing JSON instances.",
    )
    parser.add_argument("--model", choices=list_benchmark_models(), default="gemini")
    parser.add_argument(
        "--max-iterations",
        type=int,
        default=None,
        help="Override the model's agent-turn safety budget.",
    )
    parser.add_argument(
        "--planner-level",
        type=int,
        choices=(0, 1, 2, 3),
        required=True,
        help="Planner guidance level, independent of the instance ASL variant.",
    )
    parser.add_argument(
        "--results-root",
        default=str(ROOT / "benchmark" / "results"),
        help="Root directory for result.json and images.",
    )
    args = parser.parse_args()
    results = []
    for task_path in expand_task_paths(args.task_paths):
        result = run_benchmark(
            str(task_path),
            planner_level=args.planner_level,
            model_key=args.model,
            results_root=Path(args.results_root),
            max_iterations=args.max_iterations,
        )
        results.append({
            "task_id": result.get("task_id"),
            "benchmark_id": result.get("benchmark_id"),
            "planner_level": result.get("planner_level"),
            "result_path": str(
                result_directory(
                    Path(args.results_root),
                    model_key=args.model,
                    planner_level=args.planner_level,
                    benchmark_id=result["benchmark_id"],
                )
                / "result.json"
            ),
            "answer": result["answer"].get("answer") if isinstance(result.get("answer"), dict) else result.get("answer"),
            "turns": len(result.get("answer", {}).get("turns", [])) if isinstance(result.get("answer"), dict) else 0,
        })
    print(json.dumps(results[0] if len(results) == 1 else {"runs": results}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
