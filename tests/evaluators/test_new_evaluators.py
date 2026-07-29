import json
from pathlib import Path

from evaluators.answer_evaluator import AnswerEvaluator
from evaluators.tool_evaluator import ToolEvaluator
from evaluators.state_evaluator import StateEvaluator
from evaluators.run_evaluation import format_summary, summarize_results, write_instance_evaluations
from benchmark.runner import build_scoring_result, expand_task_paths


def test_answer_parser_handles_tatqa_number_and_percent_scale():
    evaluator = AnswerEvaluator()

    assert evaluator.evaluate(
        "The answer is -0.205.",
        {"type": "verifiable_target", "checks": [{"check": "numeric", "expected": -0.205, "tolerance": 0.001}]},
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
    assert evaluator.evaluate(
        "The unique anomaly occurred on 9 March 2026.",
        {
            "type": "verifiable_target",
            "checks": [{"field": "anomaly_date", "check": "categorical", "expected": "2026-03-09"}],
        },
    ).score == 1.0
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

    assert result.score == 1.0
    assert [item["actual"] for item in result.details["checks"][:2]] == [319.0, 89.0]
    assert "Group C" in result.details["checks"][2]["actual"]


def test_answer_text_supports_numeric_and_categorical_checks():
    evaluator = AnswerEvaluator()
    result = evaluator.evaluate(
        {"answer": "The count is 12 at the Firehouse Museum."},
        {"type": "verifiable_target", "checks": [
            {"field": "count", "check": "numeric", "expected": 12, "tolerance": 0},
            {"field": "museum", "check": "categorical", "expected": "Firehouse Museum"},
        ]},
    )

    assert result.score == 1.0


def test_answer_evaluation_falls_back_to_text_when_legacy_values_are_empty():
    result = AnswerEvaluator().evaluate(
        {"answer": "The largest count is 319.", "values": []},
        {"type": "verifiable_target", "checks": [
            {"field": "largest_count", "check": "numeric", "expected": 319, "tolerance": 0},
        ]},
    )

    assert result.score == 1.0
    assert result.details["checks"][0]["actual"] == 319.0


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


def test_numeric_answer_checks_bind_values_to_their_field_anchor():
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

    assert result.score == 0.5
    assert result.details["checks"][0]["score"] == 0.0


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


def test_answer_evaluator_binds_explicit_entity_metric_claims_without_expected_value_search():
    result = AnswerEvaluator().evaluate(
        (
            "Cohort A count is 6. Cohort B count is 5. "
            "Cohort A mean satisfaction is 8.17. Cohort B mean satisfaction is 5.20."
        ),
        {
            "type": "verifiable_target",
            "checks": [
                {"field": "cohort_a_count", "check": "numeric", "expected": 6},
                {"field": "cohort_b_count", "check": "numeric", "expected": 5},
                {"field": "cohort_a_satisfaction_mean", "check": "numeric", "expected": 8.17},
                {"field": "cohort_b_satisfaction_mean", "check": "numeric", "expected": 5.20},
            ],
        },
    )

    assert result.score == 1.0


def test_answer_evaluator_rejects_correct_numbers_bound_to_wrong_entities():
    result = AnswerEvaluator().evaluate(
        "North total is 642. South total is 810.",
        {
            "type": "verifiable_target",
            "checks": [
                {"field": "north_total", "check": "numeric", "expected": 810},
                {"field": "south_total", "check": "numeric", "expected": 642},
            ],
        },
    )

    assert result.score == 0.0
    assert [check["actual"] for check in result.details["checks"]] == [642.0, 810.0]


def test_categorical_distribution_preserves_label_count_associations_and_period_scope():
    config = {
        "type": "verifiable_target",
        "checks": [
            {
                "field": "january_distribution",
                "check": "categorical",
                "expected": "Direct 6, Partner 2, Online 2",
            },
            {
                "field": "february_distribution",
                "check": "categorical",
                "expected": "Direct 2, Partner 3, Online 5",
            },
        ],
    }

    assert AnswerEvaluator().evaluate(
        (
            "January distribution is Direct 6, Partner 2, Online 2. "
            "February distribution is Direct 2, Partner 3, Online 5."
        ),
        config,
    ).score == 1.0
    assert AnswerEvaluator().evaluate(
        (
            "January distribution is Direct 2, Partner 6, Online 2. "
            "February distribution is Direct 2, Partner 3, Online 5."
        ),
        config,
    ).score == 0.5


def test_share_checks_require_percentage_evidence_bound_to_period_and_channel():
    result = AnswerEvaluator().evaluate(
        "Direct January share is 60%. Direct February share is 20%.",
        {
            "type": "verifiable_target",
            "checks": [
                {"field": "direct_january_share", "check": "numeric", "expected": 0.6},
                {"field": "direct_february_share", "check": "numeric", "expected": 0.2},
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
            "target_widget_ref": "wl://widgetva-app/workspace/students/widget/bar",
            "params": {"field": "cohort", "values": ["C"]},
            "requirement": "required",
        },
        {
            "step_id": "observe_group_c",
            "operation": "perception.summarizeVisible",
            "target_widget_ref": "wl://widgetva-app/workspace/students/widget/scatter",
            "params": {"measures": [{"op": "count", "as": "count"}]},
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
                "params": {"measures": [{"op": "count", "as": "count"}]},
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


def test_tool_partial_parameter_match_does_not_satisfy_a_required_dependency():
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

    assert evaluated.details["required"]["steps"][0]["matched"] is False
    assert evaluated.details["required"]["steps"][1]["dependency_satisfied"] is False


def test_tool_rejects_linked_observation_that_happens_before_required_source_action():
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
    assert evaluated.details["required"]["steps"][1]["dependency_satisfied"] is False


def test_tool_matches_canonical_summary_metrics_and_parallel_dimension_rules():
    instance = {"evaluation": {"tool": {"steps": [
        {
            "step_id": "select_cohort",
            "operation": "parallelCoordinates.selectCohort",
            "target_widget_ref": "parallel",
            "params": {"rules": [
                {"field": "age", "range": [20, 35]},
                {"field": "engagement", "range": [70, 100]},
            ]},
            "requirement": "required",
        },
        {
            "step_id": "summarize_cohort",
            "operation": "perception.summarizeVisible",
            "target_widget_ref": "scatter",
            "params": {
                "groupBy": ["tier"],
                "measures": [
                    {"op": "average", "field": "retention", "as": "meanRetention"},
                    {"op": "count", "as": "count"},
                ],
            },
            "depends_on": ["select_cohort"],
            "requirement": "required",
        },
    ]}}}
    result = {"tool": {
        "steps": [
            {
                "step_id": "step_1",
                "operation": "parallelCoordinates.selectCohort",
                "target_widget_ref": "parallel",
                "params": {"rules": [
                    {"dimension": "engagement", "range": [70, 100]},
                    {"dimension": "age", "range": [20, 35]},
                ]},
            },
            {
                "step_id": "step_2",
                "operation": "perception.summarizeVisible",
                "target_widget_ref": "scatter",
                "params": {
                    "groupBy": ["tier"],
                    "metrics": ["mean"],
                    "fields": ["retention"],
                },
            },
        ],
        "executions": [
            {"step_id": "step_1", "execution": {"ok": True, "name": "parallelCoordinates.selectCohort"}},
            {"step_id": "step_2", "execution": {"ok": True, "name": "perception.summarizeVisible"}},
        ],
    }}

    evaluated = ToolEvaluator().evaluate(instance, result)

    assert evaluated.score == 1.0
    assert evaluated.details["required"]["matched"] == 2


def test_tool_does_not_allow_a_combined_selection_to_replace_a_required_single_selection():
    instance = {"evaluation": {"tool": {"steps": [{
        "step_id": "select_south",
        "operation": "bar.selectCategory",
        "target_widget_ref": "bar",
        "params": {"field": "category", "values": ["South"]},
        "requirement": "required",
    }]}}}
    result = {"tool": {
        "steps": [{
            "step_id": "step_1",
            "operation": "bar.selectCategory",
            "target_widget_ref": "bar",
            "params": {"field": "category", "values": ["North", "South"]},
        }],
        "executions": [
            {"step_id": "step_1", "execution": {"ok": True, "name": "bar.selectCategory"}},
        ],
    }}

    evaluated = ToolEvaluator().evaluate(instance, result)

    assert evaluated.score == 0.0
    assert evaluated.details["required"]["steps"][0]["parameter_score"] == 0.5
    assert evaluated.details["required"]["steps"][0]["matched"] is False


def test_tool_rejects_a_broad_summary_that_reads_extra_fields():
    instance = {"evaluation": {"tool": {"steps": [{
        "step_id": "summary",
        "operation": "perception.summarizeVisible",
        "target_widget_ref": "scatter",
        "params": {
            "measures": [{"op": "mean", "field": "retention", "as": "meanRetention"}],
        },
        "requirement": "required",
    }]}}}
    result = {"tool": {
        "steps": [{
            "step_id": "step_1",
            "operation": "perception.summarizeVisible",
            "target_widget_ref": "scatter",
            "params": {
                "metrics": ["mean"],
                "fields": ["retention", "satisfaction"],
            },
        }],
        "executions": [
            {"step_id": "step_1", "execution": {"ok": True, "name": "perception.summarizeVisible"}},
        ],
    }}

    assert ToolEvaluator().evaluate(instance, result).score == 0.0


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


def test_state_matches_canonical_selection_filter_and_view_domain_shapes():
    instance = {"evaluation": {"state": {"applicable": True, "checks": [
        {
            "check_id": "selection",
            "property": "selections",
            "expected": {"field": "category", "values": ["South"]},
        },
        {
            "check_id": "filter",
            "property": "transforms",
            "expected": {
                "kind": "filter",
                "linkId": "category_to_detail",
                "sourceWidgetId": "bar",
                "field": "category",
                "values": ["South"],
                "mode": "include",
            },
        },
        {
            "check_id": "domain",
            "property": "view",
            "expected": {"field": "date", "domain": ["2026-03-01", "2026-03-31"]},
        },
    ]}}}
    predicate = {"field": "category", "op": "in", "value": ["South"]}
    result = {"state": {"checks": [
        {
            "check_id": "selection",
            "actual": {
                "wl://widgetva-app/workspace/demo/widget/bar/selection/category": {
                    "predicates": [predicate],
                },
            },
        },
        {
            "check_id": "filter",
            "actual": [{
                "kind": "filter",
                "sourceWidgetId": "bar",
                "linkId": "wl://widgetva-app/workspace/demo/link/category_to_detail",
                "predicate": predicate,
            }],
        },
        {
            "check_id": "domain",
            "actual": {"xDomain": ["2026-03-01", "2026-03-31"]},
        },
    ]}}

    assert StateEvaluator().evaluate(instance, result).score == 1.0


def test_state_matches_canonical_multi_predicate_cohort_but_rejects_extra_values():
    instance = {"evaluation": {"state": {"applicable": True, "checks": [
        {
            "check_id": "cohort",
            "property": "selections",
            "expected": {
                "conjunction": "AND",
                "boundaries": "inclusive",
                "rules": [
                    {"field": "age", "range": [45, 60]},
                    {"field": "engagement", "range": [0, 40]},
                ],
            },
        },
        {
            "check_id": "single",
            "property": "selections",
            "expected": {"field": "category", "values": ["South"]},
        },
    ]}}}
    result = {"state": {"checks": [
        {
            "check_id": "cohort",
            "actual": {
                "cohort-ref": {
                    "predicates": [
                        {"field": "age", "op": "between", "value": [45, 60]},
                        {"field": "engagement", "op": "between", "value": [0, 40]},
                    ],
                },
            },
        },
        {
            "check_id": "single",
            "actual": {
                "category-ref": {
                    "predicates": [{
                        "field": "category",
                        "op": "in",
                        "value": ["North", "South"],
                    }],
                },
            },
        },
    ]}}

    evaluated = StateEvaluator().evaluate(instance, result)

    assert evaluated.score == 0.5
    assert evaluated.details["checks"][0]["score"] == 1.0
    assert evaluated.details["checks"][1]["score"] == 0.0


def test_state_matches_nested_canonical_highlight_metadata():
    instance = {"evaluation": {"state": {"applicable": True, "checks": [{
        "check_id": "highlight",
        "property": "view",
        "expected": {
            "kind": "highlight",
            "linkId": "scatter_to_heatmap",
            "sourceWidgetId": "scatter",
            "selectedCount": 3,
        },
    }]}}}
    result = {"state": {"checks": [{
        "check_id": "highlight",
        "actual": {
            "highlight": {
                "relationRef": "wl://widgetva-app/workspace/demo/link/scatter_to_heatmap",
                "sourceStateRef": "wl://widgetva-app/workspace/demo/widget/scatter/selection/brush",
                "values": ["a", "b", "c"],
            },
        },
    }]}}

    assert StateEvaluator().evaluate(instance, result).score == 1.0


def test_runner_projects_source_selected_count_into_target_highlight_check():
    evaluation = {"state": {"applicable": True, "checks": [{
        "check_id": "highlight",
        "state_ref": "wl://widgetva-app/workspace/demo/widget/heatmap",
        "property": "view",
        "expected": {
            "kind": "highlight",
            "linkId": "scatter_to_heatmap",
            "sourceWidgetId": "scatter",
            "selectedCount": 144,
        },
    }]}}
    result = build_scoring_result(
        session={"turns": [], "answer": ""},
        final_state={"widgets": {
            "wl://visagentbench/workspace/demo/widget/scatter": {
                "data": {"selectedCount": 144},
            },
            "wl://visagentbench/workspace/demo/widget/heatmap": {
                "view": {
                    "highlight": {
                        "relationRef": "wl://visagentbench/workspace/demo/link/scatter_to_heatmap",
                        "sourceStateRef": "wl://visagentbench/workspace/demo/widget/scatter/selection/brush",
                    },
                },
            },
        }},
        observation_images=[],
        evaluation=evaluation,
    )

    assert StateEvaluator().evaluate({"evaluation": evaluation}, result).score == 1.0


def test_state_matches_canonical_action_filter_transform():
    instance = {"evaluation": {"state": {"applicable": True, "checks": [{
        "check_id": "filter",
        "property": "transforms",
        "expected": {
            "kind": "filter",
            "action": "widget.filterByValues",
            "field": "diet_quality",
            "values": ["average"],
            "mode": "include",
        },
    }]}}}
    result = {"state": {"checks": [{
        "check_id": "filter",
        "actual": [{
            "kind": "filter",
            "source": "action",
            "predicate": {"field": "diet_quality", "op": "in", "value": ["average"]},
            "spec": {
                "actionName": "widget.filterByValues",
                "field": "diet_quality",
                "values": ["average"],
            },
        }],
    }]}}

    assert StateEvaluator().evaluate(instance, result).score == 1.0


def test_aligned_multi_widget_contract_marks_required_milestones_for_every_asl():
    root = Path(__file__).parents[2]
    task_dir = root / "visagentbench_kit/aligned/sp_barscatter_iterated_profile_001"

    for asl in range(4):
        instance = json.loads((task_dir / f"sp_barscatter_iterated_profile_001_asl{asl}.json").read_text())
        steps = instance["evaluation"]["tool"]["steps"]
        assert [step["requirement"] for step in steps] == ["required"] * 5
        assert instance["planner_context"] == {
            "relation_ids": ["REL-2V-BAR-SELECTCATEGORY-01"],
            "workflow_id": "WF-2V-REPEATED-CATEGORY-PROFILE-COMPARISON-10",
        }


def test_aligned_tool_steps_declare_requirement_for_every_instance():
    root = Path(__file__).parents[2]
    aligned_root = root / "visagentbench_kit/aligned"
    missing = []
    for task_dir in aligned_root.iterdir():
        if not task_dir.is_dir() or task_dir.name == "10_workflow_instance_data":
            continue
        for instance_path in task_dir.glob("*_asl[0-3].json"):
            instance = json.loads(instance_path.read_text())
            for step in instance.get("evaluation", {}).get("tool", {}).get("steps", []):
                if step.get("requirement") not in {"required", "optional"}:
                    missing.append(f"{instance_path}:{step.get('step_id')}")
    assert missing == []


def test_current_multi_widget_result_reports_partial_tool_and_failed_final_state():
    root = Path(__file__).parents[2]
    instance_path = root / "visagentbench_kit/aligned/sp_barscatter_iterated_profile_001/sp_barscatter_iterated_profile_001_asl0.json"
    result_path = root / "benchmark/results/gemini_kit/sp_barscatter_iterated_profile_001_asl0/result.json"
    instance = json.loads(instance_path.read_text())
    result = json.loads(result_path.read_text())

    tool_score = ToolEvaluator().evaluate(instance, result)
    state_score = StateEvaluator().evaluate(instance, result)

    assert tool_score.score == 0.2
    assert state_score.score == 0.0


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
