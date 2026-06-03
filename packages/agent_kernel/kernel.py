"""Pure protocol-kernel helpers for package consumers."""

from typing import Any, Dict, List


def append_phase(phase_trace: List[Dict[str, Any]], *, iteration: int, phase: str, output: Dict[str, Any]) -> None:
    phase_trace.append({"iteration": iteration, "phase": phase, "output": output})


def build_step_record(
    *,
    iteration: int,
    observe_output: Dict[str, Any],
    plan_output: Dict[str, Any],
    observation_context: Dict[str, Any],
    knowledge_context: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "iteration": iteration,
        "observe": observe_output,
        "plan": plan_output,
        "act": [],
        "verify": [],
        "reason": {},
        "observation_context": observation_context,
        "knowledge_context": knowledge_context,
        "tool_calls": [],
        "state_updated": False,
        "stop_signal": False,
    }


def compose_verify_summary(round_verify_records: List[Dict[str, Any]]) -> str:
    verify_lines = [
        f"- {record['tool_name']}: passed={record['verify'].get('passed', False)}, "
        f"mode={record['verify'].get('mode', '')}, message={record['verify'].get('message', '')}"
        for record in round_verify_records
    ]
    return "Verification summary after actions:\n" + "\n".join(verify_lines)


def dedupe_insights(insights: List[str]) -> List[str]:
    return list(dict.fromkeys(item for item in (insights or []) if item))


def derive_final_answer(question_type: str, final_answer: str, insights: List[str]) -> str:
    answer = str(final_answer or "").strip()
    if answer:
        return answer

    normalized_type = (question_type or "subjective").lower()
    if normalized_type == "objective" and insights:
        first_insight = insights[0]
        if len(first_insight.split()) <= 5:
            return first_insight
    if normalized_type == "subjective" and insights:
        return " ".join(insights)
    return ""
