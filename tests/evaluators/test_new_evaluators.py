import json
from pathlib import Path

from evaluators.answer_evaluator import AnswerEvaluator
from evaluators.tool_evaluator import ToolEvaluator
from evaluators.state_evaluator import StateEvaluator
from evaluators.run_evaluation import format_summary, summarize_results, write_instance_evaluations
from benchmark.runner import build_scoring_result, expand_task_paths
from tools.operation_equivalence import derive_alternative_params, materialize_step_alternatives


def test_openrouter_judge_request_explicitly_mentions_json(monkeypatch):
    captured = {}

    class FakeCompletions:
        def create(self, **kwargs):
            captured.update(kwargs)
            return type("Response", (), {"choices": [type("Choice", (), {"message": type("Message", (), {"content": '{"precision": 1, "recall": 1, "groundedness": 1}'})()})()]})()

    class FakeClient:
        def __init__(self, *args, **kwargs):
            self.chat = type("Chat", (), {"completions": FakeCompletions()})()

    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr("openai.OpenAI", FakeClient)
    AnswerEvaluator._openrouter_judge("answer", ["claim"])

    messages = captured["messages"]
    assert any("json" in str(message.get("content", "")).lower() for message in messages)


def test_answer_parser_handles_tatqa_number_and_percent_scale():
    evaluator = AnswerEvaluator()

    assert evaluator.evaluate(
        "The answer is -0.205.",
        {"type": "verifiable_target", "checks": [{"check": "numeric", "expected": -0.205, "tolerance": 0.001}]},
    ).score == 1.0


def test_answer_type_value_contract_scores_one_machine_answer():
    evaluator = AnswerEvaluator()
    assert evaluator.evaluate(
        {"answer": 30},
        {"type": "numeric", "value": 30, "tolerance": 0},
    ).score == 1.0
    assert evaluator.evaluate(
        {"answer": "Yes"},
        {"type": "boolean", "value": "Yes"},
    ).score == 1.0
    assert evaluator.evaluate(
        {"answer": ["2026-03-01", "2026-03-31"]},
        {"type": "interval", "value": ["2026-03-01", "2026-03-31"]},
    ).score == 1.0


def test_answer_type_value_contract_does_not_extract_multiple_facts_from_prose():
    result = AnswerEvaluator().evaluate(
        {"answer": "The anomaly was on March 9 with signal 30."},
        {"type": "numeric", "value": 30, "tolerance": 0},
    )
    assert result.score == 0.0
    assert result.details["mode"] == "typed"


def test_machine_answer_uses_typed_fields_without_text_parsing():
    result = AnswerEvaluator().evaluate(
        {"answer": [319, 89]},
        {"type": "verifiable_target", "checks": [
            {"check": "numeric", "expected": 319, "tolerance": 0},
            {"check": "numeric", "expected": 89, "tolerance": 0},
        ]},
    )

    assert result.score == 1.0
    assert result.details["mode"] == "structured"
    assert [item["actual"] for item in result.details["checks"]] == [319, 89]


def test_machine_answer_does_not_fall_back_to_prose_for_missing_typed_field():
    result = AnswerEvaluator().evaluate(
        {"answer": [319]},
        {
            "type": "verifiable_target",
            "checks": [
                {"field": "largest_count", "check": "numeric", "expected": 319},
                {"field": "smallest_count", "check": "numeric", "expected": 89},
            ],
        },
    )

    assert result.score == 0.5
    assert result.details["checks"][1]["actual"] is None


def test_machine_answer_accepts_agent_session_scalar_and_interval_values():
    evaluator = AnswerEvaluator()
    assert evaluator.evaluate(
        42,
        {"type": "verifiable_target", "checks": [{"check": "numeric", "expected": 42}]},
    ).score == 1.0
    assert evaluator.evaluate(
        ["2020-01-01", "2020-01-07"],
        {"type": "verifiable_target", "checks": [{"check": "interval", "expected": ["2020-01-01", "2020-01-07"]}]},
    ).score == 1.0


def test_open_answer_uses_reference_insight_claims_and_structured_judge():
    evaluator = AnswerEvaluator(
        judge=lambda answer, reference: {
            "precision": 1.0,
            "recall": 0.5,
            "groundedness": 1.0,
            "reference": reference,
        }
    )
    result = evaluator.evaluate(
        "The simplified chart hides the important risk signal.",
        {
            "type": "open_ended_insight",
            "metrics": ["insight_precision", "insight_recall", "groundedness"],
            "reference_insights": [{"insight_id": "i1", "claim": "The chart hides a risk signal."}],
        },
    )

    assert result.score == 2 / 3
    assert result.details["reference"] == ["The chart hides a risk signal."]


def test_open_answer_does_not_turn_unavailable_judge_into_a_zero_score(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    result = AnswerEvaluator().evaluate(
        "The chart shows a higher value after the intervention.",
        {
            "type": "open_ended_insight",
            "reference_insights": [{"claim": "The value is higher after the intervention."}],
        },
    )

    assert result.score is None
    assert result.details["status"] == "judge_unavailable"
    assert result.details["error"] == "OPENROUTER_API_KEY not set"


def test_categorical_answer_allows_explanation_and_quotes():
    evaluator = AnswerEvaluator()
    result = evaluator.evaluate(
        "After filtering the flows with a minimum value of 50, 'Rubber' is the material that contributes the most to the Tire Plant, with a value of $85M.",
        {"type": "verifiable_target", "checks": [{
            "check": "categorical",
            "expected": "Rubber is the material that contributes the most to the Tire Plant",
        }]},
    )
    assert result.score == 1.0


def test_categorical_answer_allows_date_evidence_and_different_wording():
    evaluator = AnswerEvaluator()
    result = evaluator.evaluate(
        "Within the zoomed period of July 1st to September 1st, 2014, the Firehouse Museum shows a sustained period of high attendance, with the maximum visitors occurring on 2014/9/1.",
        {"type": "verifiable_target", "checks": [{
            "check": "categorical",
            "expected": "On September 1st.",
        }]},
    )
    assert result.score == 1.0
    assert evaluator.evaluate(
        "The conversion rate is 100%.",
        {"type": "verifiable_target", "checks": [{"check": "numeric", "expected": 1, "tolerance": 0.001}]},
    ).score == 1.0


def test_categorical_answer_falls_back_to_semantic_judge_after_rule_miss():
    calls = []

    def judge(answer, reference):
        calls.append((answer, reference))
        return {
            "precision": 1.0,
            "recall": 1.0,
            "groundedness": 1.0,
            "matched_claims": ["same date"],
        }

    result = AnswerEvaluator(judge=judge).evaluate(
        "The maximum occurred on 2014-09-01.",
        {"type": "verifiable_target", "checks": [{
            "check": "categorical",
            "expected": "On September 1st.",
        }]},
    )

    assert result.score == 1.0
    assert result.details["checks"][0]["match_mode"] == "llm"
    assert calls == [("The maximum occurred on 2014-09-01.", ["On September 1st."])]


def test_answer_matches_multiple_numeric_checks_to_distinct_numbers():
    evaluator = AnswerEvaluator()
    answer = (
        "Group C has 319 students and group A has 89 students. "
        "Their mean math scores are 64.46 and 61.63, while their mean reading scores are 69.10 and 64.67."
    )
    config = {
        "type": "verifiable_target",
        "checks": [
            {"check": "numeric", "expected": 319, "tolerance": 0},
            {"check": "numeric", "expected": 89, "tolerance": 0},
            {"check": "numeric", "expected": 64.4639, "tolerance": 0.01},
            {"check": "numeric", "expected": 61.6292, "tolerance": 0.01},
            {"check": "numeric", "expected": 69.1034, "tolerance": 0.01},
            {"check": "numeric", "expected": 64.6742, "tolerance": 0.01},
        ],
    }

    evaluated = evaluator.evaluate(answer, config)

    assert evaluated.score == 1.0
    assert [check["actual"] for check in evaluated.details["checks"]] == [319.0, 89.0, 64.46, 61.63, 69.1, 64.67]


def test_multi_widget_answer_does_not_require_field_name_binding():
    answer = (
        'The largest race/ethnicity cohort is "group C" with 319 students, '
        'and the smallest is "group A" with 89 students. '
        'For math scores, "group C" has a mean of 64.46, and "group A" has a mean of 61.62, '
        'a difference of 2.84. For reading scores, "group C" has a mean of 69.10, '
        'and "group A" has a mean of 64.67, a difference of 4.43.'
    )
    checks = [
        {"field": "largest_count", "check": "numeric", "expected": 319, "tolerance": 0},
        {"field": "smallest_count", "check": "numeric", "expected": 89, "tolerance": 0},
        {"field": "group_c_math_mean", "check": "numeric", "expected": 64.4639, "tolerance": 0.01},
        {"field": "group_c_reading_mean", "check": "numeric", "expected": 69.1034, "tolerance": 0.01},
        {"field": "group_a_math_mean", "check": "numeric", "expected": 61.6292, "tolerance": 0.01},
        {"field": "group_a_reading_mean", "check": "numeric", "expected": 64.6742, "tolerance": 0.01},
        {"field": "math_difference", "check": "numeric", "expected": 2.8347, "tolerance": 0.01},
        {"field": "reading_difference", "check": "numeric", "expected": 4.4293, "tolerance": 0.01},
    ]

    assert AnswerEvaluator().evaluate(answer, {"type": "verifiable_target", "checks": checks}).score == 1.0


def test_answer_evaluation_uses_answer_text_even_when_legacy_values_are_present():
    evaluator = AnswerEvaluator()
    result = evaluator.evaluate(
        {
            "answer": "Group A has 319 students and Group C has 89 students.",
            "values": [
                {"key": "largest_count", "type": "numeric", "value": 999},
            ],
        },
        {
            "type": "verifiable_target",
            "checks": [
                {"field": "largest_count", "check": "numeric", "expected": 319, "tolerance": 0},
                {"field": "smallest_count", "check": "numeric", "expected": 89, "tolerance": 0},
                {"field": "largest_cohort", "check": "categorical", "expected": "group C"},
            ],
        },
    )

    assert result.score == 0.0
    assert result.details["mode"] == "structured"


def test_answer_text_supports_numeric_and_categorical_checks():
    evaluator = AnswerEvaluator()
    result = evaluator.evaluate(
        {"answer": "The count is 12 at the Firehouse Museum."},
        {"type": "verifiable_target", "checks": [
            {"field": "count", "check": "numeric", "expected": 12, "tolerance": 0},
            {"field": "museum", "check": "categorical", "expected": "Firehouse Museum"},
        ]},
    )

    assert result.score == 0.0


def test_answer_evaluation_falls_back_to_text_when_legacy_values_are_empty():
    result = AnswerEvaluator().evaluate(
        {"answer": "The largest count is 319.", "values": []},
        {"type": "verifiable_target", "checks": [
            {"field": "largest_count", "check": "numeric", "expected": 319, "tolerance": 0},
        ]},
    )

    assert result.score == 0.0
    assert result.details["mode"] == "structured"


def test_answer_evaluation_uses_readable_answer_when_values_are_empty():
    result = AnswerEvaluator().evaluate(
        {
            "answer": "Yes, there is a negative correlation.",
            "values": [],
        },
        {
            "type": "verifiable_target",
            "checks": [{"field": "answer", "check": "categorical", "expected": "Yes"}],
        },
    )

    assert result.score == 1.0
    assert result.details["checks"][0]["actual"].startswith("Yes")


def test_numeric_answer_checks_match_expected_values_without_field_name_binding():
    result = AnswerEvaluator().evaluate(
        "North has the highest total at 642, while South has the lowest total at 810.",
        {
            "type": "verifiable_target",
            "checks": [
                {"field": "north_total", "check": "numeric", "expected": 810},
                {"field": "south_total", "check": "numeric", "expected": 642},
            ],
        },
    )

    assert result.score == 1.0
    assert result.details["checks"][0]["actual"] == 810.0


def test_numeric_answer_checks_do_not_reuse_local_field_candidate_indexes():
    result = AnswerEvaluator().evaluate(
        "North has 810, while South has 642.",
        {
            "type": "verifiable_target",
            "checks": [
                {"field": "north_total", "check": "numeric", "expected": 810},
                {"field": "south_total", "check": "numeric", "expected": 642},
            ],
        },
    )

    assert result.score == 1.0


def test_boolean_answer_checks_understand_natural_language_negation():
    result = AnswerEvaluator().evaluate(
        "The two periods differ, but this association does not establish causation.",
        {
            "type": "verifiable_target",
            "checks": [{"field": "causal_claim", "check": "boolean", "expected": False}],
        },
    )

    assert result.score == 1.0


def test_boolean_answer_does_not_infer_truth_from_unrelated_is_or_are_words():
    result = AnswerEvaluator().evaluate(
        "The data is observational and does not establish causation.",
        {
            "type": "verifiable_target",
            "checks": [{"field": "causal_claim", "check": "boolean", "expected": False}],
        },
    )


    assert result.score == 1.0


def test_categorical_answer_rejects_a_negated_expected_label():
    result = AnswerEvaluator().evaluate(
        "The maximum did not occur on September 1st.",
        {
            "type": "verifiable_target",
            "checks": [{"field": "date", "check": "categorical", "expected": "On September 1st."}],
        },
    )

    assert result.score == 0.0


def test_interval_answer_checks_compare_ordered_numeric_bounds():
    evaluator = AnswerEvaluator()
    config = {
        "type": "verifiable_target",
        "checks": [{"field": "range", "check": "interval", "expected": [10, 20], "tolerance": 0}],
    }

    assert evaluator.evaluate("The observed interval is 10 to 20.", config).score == 1.0
    assert evaluator.evaluate("The observed interval is 20 to 10.", config).score == 0.0


def test_interval_answer_normalizes_common_date_formats_and_order():
    evaluator = AnswerEvaluator()
    config = {
        "type": "verifiable_target",
        "checks": [{
            "field": "period",
            "check": "interval",
            "expected": {"start": "2014-07-01", "end": "2014-09-01"},
        }],
    }

    assert evaluator.evaluate("From July 1, 2014 through 2014/9/1.", config).score == 1.0
    assert evaluator.evaluate("From 2014/9/1 back to July 1, 2014.", config).score == 0.0


def test_tool_scores_required_steps_only_and_ignores_optional_dependency():
    instance = {
        "evaluation": {
            "tool": {
                "steps": [
                    {
                        "step_id": "tool_1",
                        "operation": "widget.changeEncoding",
                        "target_widget_ref": "widget-1",
                        "params": {"channel": "y", "field": "mpg"},
                        "requirement": "optional",
                    },
                    {
                        "step_id": "tool_2",
                        "operation": "perception.computeCorrelation",
                        "target_widget_ref": "widget-1",
                        "params": {"xField": "price", "yField": "mpg"},
                        "depends_on": ["tool_1"],
                        "requirement": "required",
                    },
                ]
            }
        }
    }
    result = {
        "tool": {
            "steps": [{
                "step_id": "step_1",
                "operation": "perception.computeCorrelation",
                "target_widget_ref": "widget-1",
                "params": {"xField": "price", "yField": "mpg"},
            }],
            "executions": [
                {
                    "step_id": "step_1",
                    "execution": {
                        "ok": True,
                        "name": "perception.computeCorrelation",
                    },
                }
            ]
        }
    }

    evaluated = ToolEvaluator().evaluate(instance, result)

    assert evaluated.score == 1.0
    assert evaluated.details["required"]["total"] == 1
    assert evaluated.details["optional"]["available"] == 1


def test_tool_does_not_match_failed_execution():
    instance = {"evaluation": {"tool": {"steps": [{
        "step_id": "tool_1",
        "operation": "scatter.zoomDomain",
        "target_widget_ref": "widget-1",
        "params": {"x_range": [1, 2], "y_range": [3, 4]},
        "requirement": "required",
    }]}}}
    result = {"tool": {"executions": [{
        "step_id": "step_1",
        "execution": {"ok": False, "name": "scatter.zoomDomain"},
    }]}}

    assert ToolEvaluator().evaluate(instance, result).score == 0.0


def test_tool_matches_required_cross_widget_milestones_in_dependency_order():
    instance = {"evaluation": {"tool": {"steps": [
        {
            "step_id": "select_group_c",
            "operation": "bar.selectCategory",
                "target_widget_ref": "wl://visagentbench/workspace/students/widget/bar",
            "params": {"field": "cohort", "values": ["C"]},
            "requirement": "required",
        },
        {
            "step_id": "observe_group_c",
            "operation": "perception.summarizeVisible",
                "target_widget_ref": "wl://visagentbench/workspace/students/widget/scatter",
            "params": {"metrics": ["count"]},
            "depends_on": ["select_group_c"],
            "requirement": "required",
        },
    ]}}}
    result = {"tool": {
        "steps": [
            {
                "step_id": "step_1",
                "operation": "bar.selectCategory",
                "target_widget_ref": "wl://visagentbench/workspace/students/widget/bar",
                "params": {"field": "cohort", "values": ["C"]},
            },
            {
                "step_id": "step_2",
                "operation": "perception.summarizeVisible",
                "target_widget_ref": "wl://visagentbench/workspace/students/widget/scatter",
                "params": {"metrics": ["count"]},
            },
        ],
        "executions": [
            {"step_id": "step_1", "execution": {"ok": True, "name": "bar.selectCategory"}},
            {"step_id": "step_2", "execution": {"ok": True, "name": "perception.summarizeVisible"}},
        ],
    }}

    evaluated = ToolEvaluator().evaluate(instance, result)

    assert evaluated.score == 1.0
    assert evaluated.details["required"]["matched"] == 2


def test_tool_matches_canonical_runtime_metrics_and_fields():
    instance = {"evaluation": {"tool": {"steps": [{
        "step_id": "summarize_profile",
        "operation": "perception.summarizeVisible",
        "target_widget_ref": "widget-1",
        "params": {
            "groupBy": ["segment"],
            "metrics": ["count", "mean"],
            "fields": ["math score", "reading score"],
        },
        "requirement": "required",
    }]}}}
    result = {"tool": {
        "steps": [{
            "step_id": "step_1",
            "operation": "perception.summarizeVisible",
            "target_widget_ref": "widget-1",
            "params": {
                "groupBy": ["segment"],
                "metrics": ["count", "mean"],
                "fields": ["math score", "reading score"],
            },
        }],
        "executions": [{
            "step_id": "step_1",
            "execution": {
                "ok": True,
                "name": "perception.summarizeVisible",
                "params": {
                    "groupBy": ["segment"],
                    "metrics": ["count", "mean"],
                    "fields": ["math score", "reading score"],
                },
            },
        }],
    }}

    evaluated = ToolEvaluator().evaluate(instance, result)

    assert evaluated.score == 1.0
    assert evaluated.details["required"]["matched"] == 1


def test_tool_scores_partial_parameter_match_and_continues_sequence():
    instance = {"evaluation": {"tool": {"steps": [
        {
            "step_id": "select_source",
            "operation": "bar.selectCategory",
            "target_widget_ref": "bar",
            "params": {"field": "cohort", "values": ["C"]},
            "requirement": "required",
        },
        {
            "step_id": "observe_target",
            "operation": "perception.summarizeVisible",
            "target_widget_ref": "scatter",
            "params": {},
            "depends_on": ["select_source"],
            "requirement": "required",
        },
    ]}}}
    result = {"tool": {"executions": [
        {
            "step_id": "step_1",
            "execution": {
                "ok": True,
                "name": "bar.selectCategory",
                "target_widget_ref": "bar",
                "params": {"field": "cohort", "values": ["A"]},
            },
        },
        {
            "step_id": "step_2",
            "execution": {
                "ok": True,
                "name": "perception.summarizeVisible",
                "target_widget_ref": "scatter",
                "params": {},
            },
        },
    ]}}

    evaluated = ToolEvaluator().evaluate(instance, result)

    assert evaluated.score == 0.75
    assert evaluated.details["required"]["steps"][0]["score"] == 0.5
    assert evaluated.details["required"]["steps"][0]["matched"] is False
    assert evaluated.details["required"]["steps"][1]["matched"] is True
    assert evaluated.details["required"]["steps"][1]["actual_index"] == 1


def test_tool_scores_required_steps_by_trajectory_order():
    instance = {"evaluation": {"tool": {"steps": [
        {
            "step_id": "select_source",
            "operation": "bar.selectCategory",
            "target_widget_ref": "bar",
            "params": {"values": ["C"]},
            "requirement": "required",
        },
        {
            "step_id": "observe_target",
            "operation": "perception.summarizeVisible",
            "target_widget_ref": "scatter",
            "params": {},
            "depends_on": ["select_source"],
            "requirement": "required",
        },
    ]}}}
    result = {"tool": {
        "steps": [
            {"step_id": "step_1", "operation": "perception.summarizeVisible", "target_widget_ref": "scatter", "params": {}},
            {"step_id": "step_2", "operation": "bar.selectCategory", "target_widget_ref": "bar", "params": {"values": ["C"]}},
        ],
        "executions": [
            {"step_id": "step_1", "execution": {"ok": True, "name": "perception.summarizeVisible"}},
            {"step_id": "step_2", "execution": {"ok": True, "name": "bar.selectCategory"}},
        ],
    }}

    evaluated = ToolEvaluator().evaluate(instance, result)

    assert evaluated.score == 0.5
    assert evaluated.details["required"]["matched"] == 1
    assert evaluated.details["required"]["steps"][0]["matched"] is False
    assert evaluated.details["required"]["steps"][1]["matched"] is True
    assert evaluated.details["required"]["steps"][1]["actual_index"] == 0


def test_state_uses_canonical_checks_and_returns_null_when_inapplicable():
    instance = {"evaluation": {"state": {"applicable": True, "checks": [{
        "check_id": "state_1",
        "property": "view",
        "check": "categorical",
        "expected": {"field": "Heart Disease"},
    }]}}}
    result = {"state": {"checks": [{
        "check_id": "state_1",
        "actual": {"field": "Heart Disease", "values": ["Presence"]},
    }]}}

    assert StateEvaluator().evaluate(instance, result).score == 1.0
    assert StateEvaluator().evaluate(
        {"evaluation": {"state": {"applicable": False, "checks": []}}},
        result,
    ).score is None


def test_state_reports_each_final_multi_widget_check_and_runner_resolves_host_agnostic_refs():
    evaluation = {"state": {"applicable": True, "checks": [
        {
            "check_id": "source_final",
            "state_ref": "wl://widgetva-app/workspace/students/widget/bar",
            "property": "selections",
            "expected": {"field": "cohort", "values": ["A"]},
        },
        {
            "check_id": "target_final",
            "state_ref": "wl://widgetva-app/workspace/students/widget/scatter",
            "property": "transforms",
            "expected": {"kind": "filter", "values": ["A"]},
        },
    ]}}
    result = build_scoring_result(
        session={"turns": [], "answer": ""},
        final_state={"widgets": {
            "wl://visagentbench/workspace/students/widget/bar": {
                "selections": {"field": "cohort", "values": ["A"]},
            },
            "wl://visagentbench/workspace/students/widget/scatter": {
                "transforms": {"kind": "filter", "values": ["A"], "linkId": "bar-filter"},
            },
        }},
        observation_images=[],
        evaluation=evaluation,
    )

    evaluated = StateEvaluator().evaluate({"evaluation": evaluation}, result)

    assert evaluated.score == 1.0
    assert evaluated.details["checks"][0]["state_ref"].endswith("/widget/bar")
    assert evaluated.details["checks"][1]["property"] == "transforms"
    assert "values" not in result["answer"]


def test_state_matches_runtime_selection_and_filter_semantics_without_representation_fields():
    evaluation = {"state": {"applicable": True, "checks": [
        {
            "check_id": "source_final",
            "state_ref": "wl://widgetva-app/workspace/students/widget/bar",
            "property": "selections",
            "expected": {
                "kind": "predicate",
                "predicates": [{"field": "cohort", "op": "in", "value": ["A"]}],
            },
        },
        {
            "check_id": "target_final",
            "state_ref": "wl://widgetva-app/workspace/students/widget/scatter",
            "property": "transforms",
            "expected": {
                "kind": "filter",
                "linkId": "wl://widgetva-app/workspace/students/link/bar-filter",
                "sourceWidgetId": "bar",
                "predicate": {"field": "cohort", "op": "in", "value": ["A"]},
            },
        },
    ]}}
    result = {"state": {"checks": [
        {
            "check_id": "source_final",
            "actual": {
                "wl://widgetva-app/workspace/students/widget/bar/selection/cohort": {
                    "kind": "predicate",
                    "predicates": [{"field": "cohort", "op": "in", "value": ["A"]}],
                },
            },
        },
        {
            "check_id": "target_final",
            "actual": [{
                "kind": "filter",
                "linkId": "wl://widgetva-app/workspace/students/link/bar-filter",
                "sourceWidgetId": "bar",
                "predicate": {"field": "cohort", "op": "in", "value": ["A"]},
            }],
        },
    ]}}

    evaluated = StateEvaluator().evaluate({"evaluation": evaluation}, result)

    assert evaluated.score == 1.0


def test_state_preserves_between_and_all_filter_semantics():
    evaluation = {"state": {"applicable": True, "checks": [{
        "check_id": "compound_filter",
        "state_ref": "wl://widgetva-app/workspace/demo/widget/target",
        "property": "transforms",
        "expected": {
            "kind": "filter",
            "linkId": "wl://widgetva-app/workspace/demo/link/source-target",
            "sourceWidgetId": "source",
            "predicate": [
                {"field": "age", "op": "between", "value": [45, 60]},
                {"field": "engagement", "op": "between", "value": [0, 40]},
            ],
        },
    }]}}
    result = {"state": {"checks": [{
        "check_id": "compound_filter",
        "actual": [{
            "kind": "filter",
            "linkId": "wl://widgetva-app/workspace/demo/link/source-target",
            "sourceWidgetId": "source",
            "predicate": [
                {"field": "age", "op": "between", "value": [45, 60]},
                {"field": "engagement", "op": "between", "value": [0, 40]},
            ],
        }],
    }]}}

    assert StateEvaluator().evaluate({"evaluation": evaluation}, result).score == 1.0


def test_state_matches_canonical_runtime_brush_and_highlight_view():
    evaluation = {"state": {"applicable": True, "checks": [
        {
            "check_id": "brush",
            "property": "selections",
            "expected": {
                "kind": "predicate",
                "predicates": [
                    {"field": "age", "op": "between", "value": [45, 60]},
                    {"field": "engagement", "op": "between", "value": [0, 40]},
                ],
            },
        },
        {
            "check_id": "highlight",
            "property": "view",
            "expected": {
                "highlight": {
                    "relationRef": "wl://widgetva-app/workspace/demo/link/source-highlight",
                    "sourceStateRef": "wl://widgetva-app/workspace/demo/widget/source/selection/brush",
                    "predicates": [
                        {"field": "age", "op": "between", "value": [45, 60]},
                    ],
                },
            },
        },
    ]}}
    result = {"state": {"checks": [
        {
            "check_id": "brush",
            "actual": {
                "wl://widgetva-app/workspace/demo/widget/source/selection/brush": {
                    "kind": "predicate",
                    "predicates": [
                        {"field": "age", "op": "between", "value": [45, 60]},
                        {"field": "engagement", "op": "between", "value": [0, 40]},
                    ],
                },
            },
        },
        {
            "check_id": "highlight",
            "actual": {
                "xDomain": None,
                "highlight": {
                    "relationRef": "wl://widgetva-app/workspace/demo/link/source-highlight",
                    "sourceStateRef": "wl://widgetva-app/workspace/demo/widget/source/selection/brush",
                    "predicates": [
                        {"field": "age", "op": "between", "value": [45, 60]},
                    ],
                    "values": [],
                },
            },
        },
    ]}}

    assert StateEvaluator().evaluate({"evaluation": evaluation}, result).score == 1.0


def test_human_summary_shows_three_scores_and_unverified_calls():
    summary = format_summary([{
        "benchmark_id": "demo",
        "scores": {"answer": 1.0, "tool": 1.0, "state": None},
        "details": {
            "tool": {
                "required": {"matched": 1, "total": 1},
                "unscored_successful_calls": ["line.selectSeries"],
            },
            "state": {"applicable": False, "checks": []},
        },
    }])

    assert "Answer: 1.00" in summary
    assert "Tool:   1.00 (required 1/1)" in summary
    assert "State:  N/A (not applicable)" in summary
    assert "line.selectSeries" in summary


def test_evaluation_report_aggregates_three_scores_and_compact_failure_reasons():
    report = summarize_results([
        {
            "benchmark_id": "task_a_asl0",
            "task_id": "task_a",
            "asl": 0,
            "scores": {"answer": 0.5, "tool": 0.5, "state": 0.0},
            "details": {
                "answer": {"checks": [
                    {"field": "peak", "score": 0.0},
                    {"field": "count", "score": 1.0},
                ]},
                "tool": {"required": {"steps": [
                    {"step_id": "select_peak", "matched": False, "dependency_satisfied": False},
                    {"step_id": "read_peak", "matched": True, "dependency_satisfied": True, "score": 0.5},
                ]}},
                "state": {"applicable": True, "checks": [
                    {"check_id": "final_selection", "score": 0.0},
                ]},
            },
        },
        {
            "benchmark_id": "task_b_asl1",
            "task_id": "task_b",
            "asl": 1,
            "scores": {"answer": 1.0, "tool": 1.0, "state": None},
            "details": {"answer": {"checks": []}, "tool": {"required": {"steps": []}}, "state": {"applicable": False, "checks": []}},
        },
    ])

    assert report["overall"]["answer"] == {"mean": 0.75, "count": 2}
    assert report["overall"]["state"] == {"mean": 0.0, "count": 1}
    assert report["by_asl"]["0"]["tool"] == {"mean": 0.5, "count": 1}
    assert report["failures"][0] == {
        "benchmark_id": "task_a_asl0",
        "answer": ["peak"],
        "tool": ["select_peak", "read_peak"],
        "state": ["final_selection"],
    }


def test_batch_evaluation_writes_one_evaluation_file_next_to_each_result(tmp_path):
    result_path = tmp_path / "task_a_asl0" / "result.json"
    result_path.parent.mkdir()
    result_path.write_text("{}")
    rows = [{
        "benchmark_id": "task_a_asl0",
        "task_id": "task_a",
        "asl": 0,
        "scores": {"answer": 1.0, "tool": 0.5, "state": None},
        "details": {"answer": {"checks": []}, "tool": {"required": {"steps": []}}, "state": {"checks": []}},
        "result_path": str(result_path),
    }]

    paths = write_instance_evaluations(rows)
    evaluation = json.loads((result_path.parent / "evaluation.json").read_text())

    assert paths == [result_path.parent / "evaluation.json"]
    assert evaluation["scores"] == {"answer": 1.0, "tool": 0.5, "state": None}
    assert not (tmp_path / "evaluation_result.json").exists()


def test_benchmark_runner_expands_files_and_directories_without_duplicates():
    root = Path(__file__).parents[2]
    one = root / "visagentbench_kit/instances/95_sankey_verifiable_short_01/95_sankey_verifiable_short_01_asl0.json"
    paths = expand_task_paths([
        str(one),
        str(root / "visagentbench_kit/instances/100_sankey_verifiable_short_03"),
        str(root / "visagentbench_kit/instances/14_line_verifiable_short_01"),
        str(root / "visagentbench_kit/instances/95_sankey_verifiable_short_01"),
    ])
    assert len(paths) == 12
    assert paths[0] == one
    assert len({path.name for path in paths}) == 12


def test_tool_evaluator_accepts_instance_operation_alternatives():
    instance = {
        "evaluation": {
            "tool": {
                "steps": [{
                    "step_id": "tool_1",
                    "operation": "scatter.brushRegion",
                    "alternative_steps": [{
                        "operation": "scatter.selectRegion",
                        "params": {"xRange": [0, 10], "yRange": [20, 30]},
                    }],
                    "target_widget_ref": "w_scatter",
                    "params": {"xRange": [99, 100], "yRange": [20, 30]},
                    "requirement": "required",
                }]
            }
        }
    }
    result = {
        "tool": {
            "executions": [{
                "step_id": "agent_1",
                "execution": {
                    "ok": True,
                    "name": "scatter.selectRegion",
                    "target_widget_ref": "w_scatter",
                    "params": {"xRange": [0, 10], "yRange": [20, 30]},
                },
            }]
        }
    }

    evaluated = ToolEvaluator().evaluate(instance, result)

    assert evaluated.score == 1.0
    step = evaluated.details["required"]["steps"][0]
    assert step["operation_match"] == "alternative"
    assert step["actual_operation"] == "scatter.selectRegion"
    assert step["alternative_operation"] == "scatter.selectRegion"


def test_tool_evaluator_keeps_sequence_after_alternative_step_match():
    instance = {
        "evaluation": {
            "tool": {
                "steps": [
                    {
                        "step_id": "tool_1",
                        "operation": "scatter.brushRegion",
                        "alternative_steps": [{
                            "operation": "scatter.selectRegion",
                            "target_widget_ref": "w_scatter",
                            "params": {"xRange": [0, 10]},
                        }],
                        "target_widget_ref": "w_scatter",
                        "params": {"xRange": [99, 100]},
                        "requirement": "required",
                    },
                    {
                        "step_id": "tool_2",
                        "operation": "perception.summarizeVisible",
                        "target_widget_ref": "w_bar",
                        "params": {"metrics": ["count"]},
                        "requirement": "required",
                    },
                ]
            }
        }
    }
    result = {
        "tool": {
            "executions": [
                {
                    "execution": {
                        "ok": True,
                        "name": "scatter.selectRegion",
                        "target_widget_ref": "w_scatter",
                        "params": {"xRange": [0, 10]},
                    },
                },
                {
                    "execution": {
                        "ok": True,
                        "name": "perception.summarizeVisible",
                        "target_widget_ref": "w_bar",
                        "params": {"metrics": ["count"]},
                    },
                },
            ]
        }
    }

    evaluated = ToolEvaluator().evaluate(instance, result)

    assert evaluated.score == 1.0
    assert [step["actual_index"] for step in evaluated.details["required"]["steps"]] == [0, 1]
    assert evaluated.details["required"]["steps"][0]["operation_match"] == "alternative"


def test_tool_evaluator_allows_alternative_specific_target():
    instance = {
        "evaluation": {
            "tool": {
                "steps": [{
                    "step_id": "tool_1",
                    "operation": "bar.selectCategory",
                    "target_widget_ref": "w_source",
                    "params": {"values": ["A"]},
                    "alternative_steps": [{
                        "operation": "scatter.selectRegion",
                        "target_widget_ref": "w_target",
                        "params": {"xRange": [1, 2]},
                    }],
                    "requirement": "required",
                }]
            }
        }
    }
    result = {
        "tool": {
            "executions": [{
                "execution": {
                    "ok": True,
                    "name": "scatter.selectRegion",
                    "target_widget_ref": "w_target",
                    "params": {"xRange": [1, 2]},
                },
            }]
        }
    }

    evaluated = ToolEvaluator().evaluate(instance, result)

    assert evaluated.score == 1.0
    assert evaluated.details["required"]["steps"][0]["operation_match"] == "alternative"


def test_tool_evaluator_does_not_use_alternative_params_when_operation_matches():
    instance = {
        "evaluation": {
            "tool": {
                "steps": [{
                    "step_id": "tool_1",
                    "operation": "scatter.brushRegion",
                    "alternative_steps": [{
                        "operation": "scatter.selectRegion",
                        "params": {"xRange": [0, 10], "yRange": [20, 30]},
                    }],
                    "target_widget_ref": "w_scatter",
                    "params": {"xRange": [99, 100], "yRange": [20, 30]},
                    "requirement": "required",
                }]
            }
        }
    }
    result = {
        "tool": {
            "executions": [{
                "execution": {
                    "ok": True,
                    "name": "scatter.brushRegion",
                    "target_widget_ref": "w_scatter",
                    "params": {"xRange": [0, 10], "yRange": [20, 30]},
                },
            }]
        }
    }

    evaluated = ToolEvaluator().evaluate(instance, result)

    assert evaluated.score == 0.5
    step = evaluated.details["required"]["steps"][0]
    assert step["operation_match"] == "exact"
    assert step["alternative_operation"] is None


def test_materialize_step_alternatives_generates_only_derivable_runtime_shaped_steps():
    steps = [{
        "step_id": "tool_1",
        "operation": "bar.selectCategory",
        "target_widget_ref": "w_bar",
        "params": {"field": "region", "values": ["West"]},
    }]
    equivalence = {"bar.selectCategory": ["bar.clickCategory", "bar.filterCategories", "not.derivable"]}

    materialized = materialize_step_alternatives(steps, equivalence)

    assert "alternatives" not in materialized[0]
    assert materialized[0]["alternative_steps"] == [
        {"operation": "bar.clickCategory", "params": {"field": "region", "values": ["West"]}},
        {"operation": "bar.filterCategories", "params": {"categories": ["West"], "field": "region"}},
    ]
    assert "alternatives" not in steps[0]


def test_alternative_param_derivation_uses_runtime_facing_shapes():
    assert derive_alternative_params(
        "bar.selectCategory",
        "bar.filterCategories",
        {"field": "region", "values": ["West"]},
    ) == {"categories": ["West"], "field": "region"}
    assert derive_alternative_params(
        "line.selectSeries",
        "line.focusLines",
        {"field": "series", "values": ["A"]},
    ) == {"lines": ["A"], "lineField": "series"}
    assert derive_alternative_params(
        "line.focusLines",
        "line.boldLines",
        {"lineField": "series", "lines": ["A"]},
    ) == {"lineNames": ["A"], "lineField": "series"}
    assert derive_alternative_params(
        "heatmap.filterCellsByRegion",
        "heatmap.highlightRegion",
        {"xValue": "Q1", "yValue": "A"},
    ) == {"xValues": ["Q1"], "yValues": ["A"]}
    assert derive_alternative_params(
        "bar.filterCategories",
        "bar.selectCategory",
        {"categoriesToRemove": ["East"], "field": "region"},
    ) is None


def test_alternative_param_derivation_uses_widget_context_fields():
    assert derive_alternative_params(
        "bar.filterCategories",
        "bar.selectCategory",
        {"categories": ["East", "North"]},
        {"categoryField": "region"},
    ) == {"field": "region", "values": ["East", "North"]}
    assert derive_alternative_params(
        "line.focusLines",
        "line.boldLines",
        {"mode": "dim", "lines": ["China"]},
        {"lineField": "Entity"},
    ) == {"lineNames": ["China"], "lineField": "Entity"}
