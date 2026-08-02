#!/usr/bin/env python3
"""Generate the first five business-oriented multi-widget benchmark bundles."""

from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from tools.operation_equivalence import materialize_step_alternatives


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def vl(title: str, mark: Any, encoding: dict[str, Any], rows: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
        "title": title,
        "data": {"values": rows},
        "mark": mark,
        "encoding": encoding,
    }


def museum_rows() -> list[dict[str, Any]]:
    sites = [
        ("America Tropical Interpretive Center", "Downtown", "Interpretive", 7200, -42, 3600, 8, 0),
        ("Chinese American Museum", "Downtown", "History", 5900, 24, 3100, 6, 2),
        ("Watts Towers Arts Center", "South LA", "Arts", 4300, 38, 2600, 9, 4),
        ("Los Angeles Maritime Museum", "Harbor", "History", 5100, 18, 2800, 5, 1),
        ("Travel Town Museum", "Valley", "Transport", 6800, 12, 3400, 7, 5),
        ("Banning Residence Museum", "Harbor", "History", 3600, 30, 1900, 4, 3),
        ("Lummis Home", "Northeast", "Historic Site", 2900, 22, 1600, 5, 6),
        ("Barnsdall Art Park Gallery", "Central", "Arts", 4700, 44, 3000, 10, 2),
    ]
    rows: list[dict[str, Any]] = []
    for museum, region, museum_type, base, trend, spend_base, event_base, phase in sites:
        for index in range(24):
            year = 2023 + index // 12
            month = index % 12 + 1
            seasonal = math.sin((index + phase) * math.pi / 6)
            summer_lift = 780 if 6 <= month <= 8 else 0
            school_lift = 520 if month in (3, 10) else 0
            spend = round(spend_base + index * 45 + seasonal * 360 + (680 if month == 7 else 0))
            events = max(1, round(event_base + seasonal * 2 + (4 if month == 10 else 0)))
            visitors = max(700, round(base + trend * index + seasonal * 980 + summer_lift + school_lift + spend * 0.36 + events * 84))
            rows.append({
                "date": f"{year}-{month:02d}-01",
                "year": year,
                "month": month,
                "month_index": index + 1,
                "quarter": f"Q{math.ceil(month / 3)}",
                "museum": museum,
                "region": region,
                "museum_type": museum_type,
                "visitors": visitors,
                "marketing_spend": spend,
                "education_events": events,
                "school_visits": round(events * 38 + school_lift / 8 + seasonal * 24),
                "ticket_revenue": round(visitors * (7.6 if museum_type == "Arts" else 6.4 if museum_type == "Transport" else 5.2)),
                "satisfaction": round(min(4.9, 3.7 + visitors / 18000 + events / 80), 2),
            })
    return rows


def saas_rows() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    segments = [("SMB", "Starter"), ("Mid-Market", "Professional"), ("Enterprise", "Enterprise")]
    regions = ["North America", "Europe", "APAC"]
    for index in range(60):
        high = index % 2 == 0
        segment, plan = segments[index % len(segments)]
        adoption = (82 + (index * 7) % 16) if high else (28 + (index * 5) % 16)
        active = (78 + (index * 3) % 18) if high else (24 + (index * 7) % 18)
        tickets = (1 + index % 3) if high else (6 + index % 5)
        renewal = round((0.82 + (index % 5) * 0.018) if high else (0.53 + (index % 5) * 0.018), 3)
        expansion = round((18000 + (index % 7) * 1600) if high else (4200 + (index % 7) * 700), 2)
        rows.append({
            "account_id": f"acct_{index + 1:03d}",
            "segment": segment,
            "plan": plan,
            "region": regions[index % len(regions)],
            "health_cohort": "high-adoption" if high else "low-adoption",
            "seats": 20 + (index * 11) % 280,
            "adoption_score": adoption,
            "weekly_active_rate": active,
            "support_tickets": tickets,
            "renewal_probability": renewal,
            "expansion_arr": expansion,
            "nps": 32 + (index * 3) % 48 if high else 4 + (index * 3) % 32,
        })
    return rows


def commerce_rows() -> list[dict[str, Any]]:
    paths = [
        ("Organic→Product View→Checkout→Paid", [240, 205, 171, 148], 0.58, 128.0),
        ("Paid Search→Product View→Checkout→Paid", [220, 168, 112, 82], 0.41, 101.0),
        ("Referral→Product View→Checkout→Paid", [150, 126, 92, 71], 0.63, 137.0),
        ("Social→Product View→Checkout→Paid", [180, 132, 84, 49], 0.32, 84.0),
    ]
    stages = ["Landing", "Product View", "Checkout", "Paid"]
    rows: list[dict[str, Any]] = []
    start = date(2026, 4, 1)
    for path_index, (flow_id, counts, repeat_share, revenue) in enumerate(paths):
        for stage_index, (stage, sessions) in enumerate(zip(stages, counts)):
            for record_index in range(max(1, sessions // 12)):
                rows.append({
                    "flow_id": flow_id,
                    "stage": stage,
                    "sessions": round(sessions / max(1, sessions // 12)),
                    "date": (start + timedelta(days=path_index * 5 + record_index)).isoformat(),
                    "customer_type": "repeat" if (record_index / max(1, sessions // 12)) < repeat_share else "new",
                    "net_revenue_30d": round(revenue + stage_index * 4 + record_index * 1.5, 2),
                    "acquisition_channel": flow_id.split("→", 1)[0],
                })
    return rows


def manufacturing_rows() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    lines = ["Line A", "Line B", "Line C"]
    shifts = ["Day", "Swing", "Night"]
    for index in range(144):
        line = lines[index % 3]
        shift = shifts[(index // 3) % 3]
        risk = (line == "Line B" and shift == "Night")
        temperature = round((198 + (index * 3) % 13) if risk else (184 + (index * 5) % 14), 1)
        speed = round((1.6 + (index % 7) * 0.08) if risk else (2.0 + (index % 7) * 0.07), 2)
        humidity = round((62 + (index * 7) % 17) if risk else (42 + (index * 5) % 15), 1)
        viscosity = round((4.4 + (index % 5) * 0.22) if risk else (3.2 + (index % 5) * 0.18), 2)
        defect = round((0.105 + (index % 9) * 0.006) if risk else (0.018 + (index % 9) * 0.004), 3)
        if risk and index == 73:
            defect = 0.194
        rows.append({
            "batch_id": f"batch_{index + 1:03d}",
            "production_line": line,
            "shift": shift,
            "oven_temperature": temperature,
            "conveyor_speed": speed,
            "humidity": humidity,
            "viscosity": viscosity,
            "defect_rate": defect,
            "scrap_cost": round(defect * 18000 + 200 + (index % 7) * 45, 2),
        })
    return rows


def support_rows() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = date(2026, 1, 1)
    reasons = ["Billing", "Technical", "Account", "Delivery"]
    outcomes = ["Resolved", "Escalated", "Reopened"]
    for index in range(180):
        day = start + timedelta(days=index % 60)
        after = day >= date(2026, 2, 1)
        reason = reasons[index % len(reasons)]
        wait = (18 + index % 14) if not after else (10 + index % 10)
        resolution = (42 + index % 22) if not after else (32 + index % 17)
        csat = round((3.55 + (index % 7) * 0.07) if not after else (3.86 + (index % 6) * 0.08), 2)
        outcome = outcomes[(index + (1 if after else 0)) % len(outcomes)]
        rows.append({
            "ticket_id": f"ticket_{index + 1:03d}",
            "opened_date": day.isoformat(),
            "policy_period": "After routing" if after else "Before routing",
            "queue": "Smart routing" if after else "General queue",
            "contact_reason": reason,
            "wait_minutes": wait,
            "resolution_minutes": resolution,
            "csat": csat,
            "outcome": outcome,
            "reopened": outcome == "Reopened",
        })
    return rows


def dataset_specs(dataset: str, rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    if dataset == "museum_visitors_001":
        return {
            "w_region_bar": vl("Museum visitors by region", "bar", {"x": {"field": "region", "type": "nominal"}, "y": {"field": "visitors", "type": "quantitative", "aggregate": "sum"}}, rows),
            "w_monthly_line": vl("Monthly museum visitors", "line", {"x": {"field": "date", "type": "temporal"}, "y": {"field": "visitors", "type": "quantitative", "aggregate": "sum"}, "color": {"field": "region", "type": "nominal"}}, rows),
            "w_spend_scatter": vl("Marketing spend and visitors", {"type": "point", "filled": True}, {"x": {"field": "marketing_spend", "type": "quantitative"}, "y": {"field": "visitors", "type": "quantitative"}, "color": {"field": "region", "type": "nominal"}}, rows),
        }
    if dataset == "saas_account_health_001":
        dims = ["adoption_score", "weekly_active_rate", "support_tickets", "renewal_probability", "expansion_arr"]
        parallel_rows = [{**r, "dimension": d, "value": r[d]} for r in rows for d in dims]
        return {
            "w_health_parallel": vl("Account health profile", "line", {"x": {"field": "dimension", "type": "nominal"}, "y": {"field": "value", "type": "quantitative"}, "detail": {"field": "account_id", "type": "nominal"}, "color": {"field": "health_cohort", "type": "nominal"}}, parallel_rows),
            "w_renewal_scatter": vl("Adoption and renewal probability", {"type": "point", "filled": True}, {"x": {"field": "adoption_score", "type": "quantitative"}, "y": {"field": "renewal_probability", "type": "quantitative"}, "color": {"field": "health_cohort", "type": "nominal"}}, rows),
            "w_plan_bar": vl("Plan mix by health cohort", "bar", {"x": {"field": "plan", "type": "nominal"}, "y": {"aggregate": "count", "type": "quantitative"}, "color": {"field": "health_cohort", "type": "nominal"}}, rows),
        }
    if dataset == "commerce_funnel_001":
        flow_spec = vl("Acquisition-to-payment paths", "bar", {"x": {"field": "stage", "type": "nominal"}, "y": {"field": "sessions", "type": "quantitative", "aggregate": "sum"}, "color": {"field": "flow_id", "type": "nominal"}}, rows)
        # Keep the Vega-Lite inline data while explicitly declaring the widget
        # family.  The workflow/action resolver must treat this as a Sankey
        # flow widget, not as an ordinary bar chart inferred from the mark.
        flow_spec["kind"] = "sankey"
        flow_spec["widget_kind"] = "sankey"
        return {
            "w_flow_sankey": flow_spec,
            "w_customer_mix": vl("Customer mix by path", "bar", {"x": {"field": "customer_type", "type": "nominal"}, "y": {"aggregate": "count", "type": "quantitative"}, "color": {"field": "acquisition_channel", "type": "nominal"}}, rows),
            "w_revenue_line": vl("Thirty-day revenue by path", "line", {"x": {"field": "date", "type": "temporal"}, "y": {"field": "net_revenue_30d", "type": "quantitative", "aggregate": "mean"}, "color": {"field": "acquisition_channel", "type": "nominal"}}, rows),
        }
    if dataset == "manufacturing_quality_001":
        dims = ["oven_temperature", "conveyor_speed", "humidity", "viscosity", "defect_rate"]
        parallel_rows = [{**r, "dimension": d, "value": r[d]} for r in rows for d in dims]
        return {
            "w_quality_heatmap": vl("Mean defect rate by line and shift", "rect", {"x": {"field": "production_line", "type": "nominal"}, "y": {"field": "shift", "type": "nominal"}, "color": {"field": "defect_rate", "type": "quantitative", "aggregate": "mean"}}, rows),
            "w_process_scatter": vl("Temperature and defect rate", {"type": "point", "filled": True}, {"x": {"field": "oven_temperature", "type": "quantitative"}, "y": {"field": "defect_rate", "type": "quantitative"}, "color": {"field": "production_line", "type": "nominal"}, "shape": {"field": "shift", "type": "nominal"}}, rows),
            "w_process_parallel": vl("Batch process profile", "line", {"x": {"field": "dimension", "type": "nominal"}, "y": {"field": "value", "type": "quantitative"}, "detail": {"field": "batch_id", "type": "nominal"}, "color": {"field": "shift", "type": "nominal"}}, parallel_rows),
        }
    if dataset == "support_routing_001":
        return {
            "w_case_line": vl("Support cases over time", "line", {"x": {"field": "opened_date", "type": "temporal"}, "y": {"aggregate": "count", "type": "quantitative"}, "color": {"field": "policy_period", "type": "nominal"}}, rows),
            "w_wait_csat_scatter": vl("Wait time and customer satisfaction", {"type": "point", "filled": True}, {"x": {"field": "wait_minutes", "type": "quantitative"}, "y": {"field": "csat", "type": "quantitative"}, "color": {"field": "policy_period", "type": "nominal"}}, rows),
            "w_outcome_bar": vl("Resolution outcomes", "bar", {"x": {"field": "outcome", "type": "nominal"}, "y": {"aggregate": "count", "type": "quantitative"}, "color": {"field": "policy_period", "type": "nominal"}}, rows),
        }
    raise ValueError(dataset)


DATASETS = {
    "museum_visitors_001": museum_rows,
    "saas_account_health_001": saas_rows,
    "commerce_funnel_001": commerce_rows,
    "manufacturing_quality_001": manufacturing_rows,
    "support_routing_001": support_rows,
}


TASKS = [
    {
        "dataset": "museum_visitors_001", "kind": "verifiable", "folder": "MWF-3V-CATEGORY-TREND-DRILLDOWN-12",
        "task_id": "museum_visitors_gap_001", "query": "In which month was the visitor gap between Downtown and Northeast the largest?",
        "workflow": "WF-3V-CATEGORY-TREND-DRILLDOWN-12", "answer_type": "interval", "answer": ["2023-03-01", "2023-03-31"],
        "widgets": ["w_region_bar", "w_monthly_line", "w_spend_scatter"],
        "links": [("w_region_bar", "selection/category", "w_monthly_line", "transform/region-filter", "selectionToFilter", "region"), ("w_region_bar", "selection/category", "w_spend_scatter", "transform/region-filter", "selectionToFilter", "region"), ("w_monthly_line", "view/zoom", "w_spend_scatter", "transform/date-domain-filter", "domainToFilter", "date")],
        "steps": [
            ("perception.summarizeVisible", "w_region_bar", {"groupBy": ["region"], "metrics": ["sum"], "fields": ["visitors"]}),
            ("bar.selectCategory", "w_region_bar", {"field": "region", "values": ["Downtown"]}),
            ("perception.summarizeVisible", "w_monthly_line", {"groupBy": ["date"], "metrics": ["sum"], "fields": ["visitors"]}),
            ("bar.selectCategory", "w_region_bar", {"field": "region", "values": ["Northeast"]}),
            ("perception.summarizeVisible", "w_monthly_line", {"groupBy": ["date"], "metrics": ["sum"], "fields": ["visitors"]}),
            ("line.zoomXRegion", "w_monthly_line", {"start": "2023-03-01", "end": "2023-03-31"}),
        ],
    },
    {
        "dataset": "museum_visitors_001", "kind": "open", "folder": "MWF-2V-CATEGORY-REGIME-COMPARISON-11",
        "task_id": "museum_visitors_regime_001", "query": "How did visitor trends differ between Downtown and Northeast?",
        "workflow": "WF-2V-CATEGORY-REGIME-COMPARISON-11", "answer_type": "open_ended_insight",
        "answer": "Downtown had a much larger visitor base, while Northeast followed a smaller but more consistently rising pattern across the two years.",
        "reference_insights": [
            {"insight_id": "museum_i1", "claim": "Downtown has substantially more total visitors than Northeast.", "evidence": {"fields": ["region", "visitors"]}},
            {"insight_id": "museum_i2", "claim": "The two regions show different monthly peak sizes and trend slopes.", "evidence": {"fields": ["date", "region", "visitors"]}},
            {"insight_id": "museum_i3", "claim": "The chart shows association patterns, not proof that one operational factor caused the difference.", "evidence": {"fields": ["marketing_spend", "education_events"]}},
        ],
        "widgets": ["w_region_bar", "w_monthly_line"],
        "links": [("w_region_bar", "selection/category", "w_monthly_line", "transform/category-filter", "selectionToFilter", "region")],
        "steps": [("bar.selectCategory", "w_region_bar", {"field": "region", "values": ["Downtown"]}), ("line.selectSeries", "w_monthly_line", {"field": "region", "values": ["Downtown"]}), ("bar.selectCategory", "w_region_bar", {"field": "region", "values": ["Northeast"]}), ("line.selectSeries", "w_monthly_line", {"field": "region", "values": ["Northeast"]}), ("perception.compareGroups", "w_monthly_line", {"groups": ["Downtown", "Northeast"]})],
    },
    {
        "dataset": "saas_account_health_001", "kind": "verifiable", "folder": "MWF-3V-HIGHDIM-COHORT-PROFILE-15",
        "task_id": "saas_renewal_gap_001", "query": "How much higher was renewal probability for the high-adoption cohort than the low-adoption cohort?",
        "workflow": "WF-3V-HIGHDIM-COHORT-PROFILE-15", "answer_type": "numeric", "answer_field": "renewal_probability_gap",
        "widgets": ["w_health_parallel", "w_renewal_scatter", "w_plan_bar"],
        "links": [("w_health_parallel", "selection/cohort", "w_renewal_scatter", "transform/cohort-filter", "cohortToFilter", "adoption_score"), ("w_health_parallel", "selection/cohort", "w_plan_bar", "view/highlight", "cohortToHighlight", "adoption_score")],
        "steps": [("parallelCoordinates.selectCohort", "w_health_parallel", {"rules": [{"dimension": "adoption_score", "range": [82, 96]}]}), ("perception.summarizeVisible", "w_renewal_scatter", {"metrics": ["mean"], "fields": ["renewal_probability"]}), ("perception.summarizeVisible", "w_plan_bar", {"groupBy": ["plan"], "metrics": ["count"]}), ("parallelCoordinates.selectCohort", "w_health_parallel", {"rules": [{"dimension": "adoption_score", "range": [29, 43]}]}), ("perception.summarizeVisible", "w_renewal_scatter", {"metrics": ["mean"], "fields": ["renewal_probability"]})],
    },
    {
        "dataset": "saas_account_health_001", "kind": "open", "folder": "MWF-2V-HIGH-DIMENSIONAL-COHORT-PROFILE-06",
        "task_id": "saas_risk_profile_001", "query": "What distinguishes accounts with the highest renewal risk?",
        "workflow": "WF-2V-HIGH-DIMENSIONAL-COHORT-PROFILE-06", "answer_type": "open_ended_insight",
        "answer": "The highest-risk accounts combine lower adoption and activity with more support tickets, and they show less expansion capacity than the high-adoption cohort.",
        "reference_insights": [{"insight_id": "saas_i1", "claim": "Low-adoption accounts have lower renewal probability and activity.", "evidence": {"fields": ["health_cohort", "renewal_probability", "weekly_active_rate"]}}, {"insight_id": "saas_i2", "claim": "The low-adoption cohort carries a higher support-ticket burden.", "evidence": {"fields": ["health_cohort", "support_tickets"]}}, {"insight_id": "saas_i3", "claim": "Expansion ARR is lower for the high-risk cohort.", "evidence": {"fields": ["health_cohort", "expansion_arr"]}}],
        "widgets": ["w_health_parallel", "w_renewal_scatter"],
        "links": [("w_health_parallel", "selection/cohort", "w_renewal_scatter", "transform/cohort-filter", "cohortToFilter", "health_cohort")],
        "steps": [("parallelCoordinates.selectCohort", "w_health_parallel", {"rules": [{"dimension": "adoption_score", "range": [29, 43]}]}), ("perception.findOutliers", "w_renewal_scatter", {"field": "renewal_probability"})],
    },
    {
        "dataset": "commerce_funnel_001", "kind": "verifiable", "folder": "MWF-2V-FLOW-EXPLANATION-08",
        "task_id": "commerce_funnel_dropoff_001", "query": "Which stage accounts for the largest loss in the checkout funnel?",
        "workflow": "WF-2V-FLOW-EXPLANATION-08", "answer_type": "categorical", "answer": "Product View",
        "widgets": ["w_flow_sankey", "w_customer_mix", "w_revenue_line"],
        "links": [("w_flow_sankey", "selection/flow", "w_customer_mix", "transform/flow-filter", "selectionToFilter", "flow_id"), ("w_flow_sankey", "selection/flow", "w_revenue_line", "transform/flow-filter", "selectionToFilter", "flow_id")],
        "steps": [("sankey.focusFlow", "w_flow_sankey", {"field": "flow_id", "values": ["Organic→Product View→Checkout→Paid"]}), ("perception.findBottleneck", "w_flow_sankey", {"topN": 1}), ("perception.compareGroups", "w_customer_mix", {"groupField": "customer_type", "valueField": "sessions", "groups": ["new", "repeat"]})],
    },
    {
        "dataset": "commerce_funnel_001", "kind": "open", "folder": "MWF-3V-FLOW-COHORT-EXPLANATION-14",
        "task_id": "commerce_funnel_paths_001", "query": "How do customers on the highest- and lowest-volume purchase paths differ?",
        "workflow": "WF-3V-FLOW-COHORT-EXPLANATION-14", "answer_type": "open_ended_insight",
        "answer": "The highest-volume path has a larger repeat-customer share and stronger 30-day revenue, while the lowest-volume path has weaker downstream conversion and a more acquisition-heavy mix.",
        "reference_insights": [{"insight_id": "commerce_i1", "claim": "The highest- and lowest-volume paths have different stage counts and conversion losses.", "evidence": {"fields": ["flow_id", "stage", "sessions"]}}, {"insight_id": "commerce_i2", "claim": "Repeat-customer share is higher on the strongest path.", "evidence": {"fields": ["flow_id", "customer_type"]}}, {"insight_id": "commerce_i3", "claim": "The strongest path has a higher 30-day revenue profile.", "evidence": {"fields": ["flow_id", "net_revenue_30d"]}}],
        "widgets": ["w_flow_sankey", "w_customer_mix", "w_revenue_line"],
        "links": [("w_flow_sankey", "selection/flow", "w_customer_mix", "transform/flow-filter", "selectionToFilter", "flow_id"), ("w_flow_sankey", "selection/flow", "w_revenue_line", "transform/flow-filter", "selectionToFilter", "flow_id")],
        "steps": [("sankey.focusFlow", "w_flow_sankey", {"field": "flow_id", "values": ["Organic→Product View→Checkout→Paid"]}), ("perception.summarizeVisible", "w_customer_mix", {"groupBy": ["customer_type"], "metrics": ["count"]}), ("perception.summarizeVisible", "w_revenue_line", {"metrics": ["mean"], "fields": ["net_revenue_30d"]}), ("sankey.focusFlow", "w_flow_sankey", {"field": "flow_id", "values": ["Social→Product View→Checkout→Paid"]}), ("perception.compareGroups", "w_customer_mix", {"groupField": "customer_type", "valueField": "sessions", "groups": ["new", "repeat"]})],
    },
    {
        "dataset": "manufacturing_quality_001", "kind": "verifiable", "folder": "MWF-2V-MATRIX-RELATIONSHIP-INVESTIGATION-07",
        "task_id": "manufacturing_outlier_001", "query": "What is the defect rate of the most extreme batch in the line-shift group with the highest average defect rate?",
        "workflow": "WF-2V-MATRIX-RELATIONSHIP-INVESTIGATION-07", "answer_type": "numeric", "answer_field": "extreme_batch_defect_rate",
        "widgets": ["w_quality_heatmap", "w_process_scatter"],
        "links": [("w_quality_heatmap", "selection/submatrix", "w_process_scatter", "transform/line-shift-filter", "selectionToFilter", "production_line")],
        "steps": [("heatmap.selectSubmatrix", "w_quality_heatmap", {"xValues": ["Line B"], "yValues": ["Night"]}), ("scatter.selectRegion", "w_process_scatter", {"xField": "oven_temperature", "yField": "defect_rate", "xRange": [195, 212], "yRange": [0.1, 0.2]}), ("perception.findOutliers", "w_process_scatter", {"field": "defect_rate"})],
    },
    {
        "dataset": "manufacturing_quality_001", "kind": "open", "folder": "MWF-3V-RELATIONSHIP-TRIANGULATION-17",
        "task_id": "manufacturing_pattern_001", "query": "What process conditions characterize the high-defect batches?",
        "workflow": "WF-3V-RELATIONSHIP-TRIANGULATION-17", "answer_type": "open_ended_insight",
        "answer": "High-defect batches cluster around the night shift on Line B, with higher temperature, slower conveyor speed, and higher humidity than the lower-defect groups.",
        "reference_insights": [{"insight_id": "manufacturing_i1", "claim": "Line B night shift has the highest average defect rate.", "evidence": {"fields": ["production_line", "shift", "defect_rate"]}}, {"insight_id": "manufacturing_i2", "claim": "High-defect points occupy a warmer and slower process region.", "evidence": {"fields": ["oven_temperature", "conveyor_speed", "defect_rate"]}}, {"insight_id": "manufacturing_i3", "claim": "The parallel profile shows higher humidity and viscosity in the same cohort.", "evidence": {"fields": ["humidity", "viscosity", "shift"]}}],
        "widgets": ["w_quality_heatmap", "w_process_scatter", "w_process_parallel"],
        "links": [("w_quality_heatmap", "selection/submatrix", "w_process_scatter", "transform/line-shift-filter", "selectionToFilter", "production_line"), ("w_process_scatter", "selection/brush", "w_process_parallel", "view/highlight", "brushToHighlight", "batch_id")],
        "steps": [("heatmap.selectSubmatrix", "w_quality_heatmap", {"xValues": ["Line B"], "yValues": ["Night"]}), ("perception.computeCorrelation", "w_process_scatter", {"xField": "oven_temperature", "yField": "defect_rate"}), ("perception.summarizeVisible", "w_process_parallel", {"groupBy": ["shift"], "metrics": ["mean"], "fields": ["humidity", "viscosity"]})],
    },
    {
        "dataset": "support_routing_001", "kind": "verifiable", "folder": "MWF-2V-BEFORE-AFTER-PERIOD-COMPARISON-09",
        "task_id": "support_routing_csat_001", "query": "Did average customer satisfaction improve after smart routing was introduced?",
        "workflow": "WF-2V-BEFORE-AFTER-PERIOD-COMPARISON-09", "answer_type": "boolean", "answer_field": "csat_improved",
        "widgets": ["w_case_line", "w_outcome_bar", "w_wait_csat_scatter"],
        "links": [("w_case_line", "view/zoom", "w_outcome_bar", "transform/period-filter", "domainToFilter", "opened_date"), ("w_case_line", "view/zoom", "w_wait_csat_scatter", "transform/period-filter", "domainToFilter", "opened_date")],
        "steps": [("line.zoomXRegion", "w_case_line", {"start": "2026-01-01", "end": "2026-02-28"}), ("perception.compareGroups", "w_wait_csat_scatter", {"groupField": "policy_period", "valueField": "csat", "groups": ["Before routing", "After routing"]})],
    },
    {
        "dataset": "support_routing_001", "kind": "open", "folder": "MWF-3V-PERIOD-CONDITION-COMPARISON-16",
        "task_id": "support_routing_change_001", "query": "How did service performance change after smart routing?",
        "workflow": "WF-3V-PERIOD-CONDITION-COMPARISON-16", "answer_type": "open_ended_insight",
        "answer": "After smart routing, satisfaction increased and wait times fell, while the outcome mix changed enough to warrant monitoring escalations and reopened cases.",
        "reference_insights": [{"insight_id": "support_i1", "claim": "Average CSAT is higher after smart routing.", "evidence": {"fields": ["policy_period", "csat"]}}, {"insight_id": "support_i2", "claim": "Wait-time and satisfaction patterns differ between the two periods.", "evidence": {"fields": ["wait_minutes", "csat", "policy_period"]}}, {"insight_id": "support_i3", "claim": "Resolution outcomes show a remaining escalation or reopening risk.", "evidence": {"fields": ["outcome", "policy_period"]}}],
        "widgets": ["w_case_line", "w_wait_csat_scatter", "w_outcome_bar"],
        "links": [("w_case_line", "view/zoom", "w_wait_csat_scatter", "transform/period-filter", "domainToFilter", "opened_date"), ("w_case_line", "view/zoom", "w_outcome_bar", "transform/period-filter", "domainToFilter", "opened_date")],
        "steps": [("line.zoomXRegion", "w_case_line", {"start": "2026-01-01", "end": "2026-01-31"}), ("perception.computeCorrelation", "w_wait_csat_scatter", {"xField": "wait_minutes", "yField": "csat"}), ("perception.summarizeVisible", "w_outcome_bar", {"groupBy": ["outcome"], "metrics": ["count"]}), ("line.zoomXRegion", "w_case_line", {"start": "2026-02-01", "end": "2026-02-28"}), ("perception.computeCorrelation", "w_wait_csat_scatter", {"xField": "wait_minutes", "yField": "csat"}), ("perception.summarizeVisible", "w_outcome_bar", {"groupBy": ["outcome"], "metrics": ["count"]})],
    },
]


def asl_query(query: str, asl: int, steps: list[tuple[str, str, dict[str, Any]]]) -> str:
    if asl == 0:
        return query
    if asl == 1:
        return f"Use the linked views to answer: {query}"
    if asl == 2:
        operations = ", ".join(dict.fromkeys(step[0] for step in steps))
        return f"Use the linked views and interactions ({operations}) to answer: {query}"
    operations = ", ".join(dict.fromkeys(step[0] for step in steps))
    return f"Use {operations} across the linked widgets to answer: {query}"


def build_links(task_id: str, widget_refs: dict[str, str], links: list[tuple[str, str, str, str, str, str]]) -> tuple[list[dict[str, Any]], list[str]]:
    result = []
    relation_ids = []
    for index, (source_widget, source_state, target_widget, target_state, kind, field) in enumerate(links, 1):
        source_family = (
            "PARALLELCOORDINATES" if "parallel" in source_widget
            else "BAR" if source_widget in {"w_region_bar", "w_plan_bar", "w_customer_mix", "w_outcome_bar"}
            else "LINE" if source_widget in {"w_monthly_line", "w_case_line"}
            else "HEATMAP" if source_widget == "w_quality_heatmap"
            else "SANKEY" if "sankey" in source_widget
            else "SCATTER"
        )
        op = (
            "SELECTCATEGORY" if "selection/category" in source_state
            else "SELECTCOHORT" if "selection/cohort" in source_state
            else "SELECTSUBMATRIX" if "selection/submatrix" in source_state
            else "FOCUSFLOW" if "selection/flow" in source_state
            else "ZOOMXREGION" if "view/zoom" in source_state
            else "BRUSHREGION"
        )
        relation_id = f"REL-2V-{source_family}-{op}-01"
        relation_ids.append(relation_id)
        link_id = f"link_{index}"
        mapping = (
            {"sourceChannel": "x", "targetField": field}
            if kind.startswith("domain")
            else {"sourceField": field, "targetField": field}
        )
        result.append({
            "ref": f"{widget_refs[source_widget].rsplit('/widget/', 1)[0]}/link/{link_id}",
            "id": link_id,
            "linkId": link_id,
            "sourceStateRef": f"{widget_refs[source_widget]}/{source_state}",
            "targetStateRef": f"{widget_refs[target_widget]}/{target_state}",
            "relation": "controls",
            "transform": {
                "kind": kind,
                ("channelMapping" if kind.startswith("domain") else "fieldMapping"): [mapping],
            },
            "activation": "automatic",
        })
    return result, relation_ids


def numeric_answer(task: dict[str, Any], rows: list[dict[str, Any]]) -> float:
    if task["task_id"] == "saas_renewal_gap_001":
        high = [r["renewal_probability"] for r in rows if r["health_cohort"] == "high-adoption"]
        low = [r["renewal_probability"] for r in rows if r["health_cohort"] == "low-adoption"]
        return round((sum(high) / len(high) - sum(low) / len(low)) * 100, 2)
    if task["task_id"] == "manufacturing_outlier_001":
        group = [r for r in rows if r["production_line"] == "Line B" and r["shift"] == "Night"]
        return max(r["defect_rate"] for r in group)
    raise ValueError(task["task_id"])


def _predicate(field: str, values: list[Any], op: str = "in") -> dict[str, Any]:
    return {"field": field, "op": op, "value": values}


def _selection_check(check_id: str, state_ref: str, predicates: list[dict[str, Any]], check: str = "categorical") -> dict[str, Any]:
    return {
        "check_id": check_id,
        "state_ref": state_ref,
        "property": "selections",
        "check": check,
        "expected": {"kind": "predicate", "predicates": predicates},
    }


def _filter_check(check_id: str, state_ref: str, link_ref: str, source_widget_id: str, predicate: dict[str, Any]) -> dict[str, Any]:
    return {
        "check_id": check_id,
        "state_ref": state_ref,
        "property": "transforms",
        "check": "categorical",
        "expected": {
            "kind": "filter",
            "source": "coordination",
            "linkId": link_ref,
            "sourceWidgetId": source_widget_id,
            "predicate": predicate,
        },
    }


def build_state(task: dict[str, Any], widget_refs: dict[str, str], links: list[dict[str, Any]]) -> dict[str, Any]:
    """Build the legacy multi_widget state contract used by the golden fixtures."""
    task_id = task["task_id"]
    link_refs = {index + 1: link["ref"] for index, link in enumerate(links)}
    checks: list[dict[str, Any]] = []

    if task_id.startswith("museum_visitors_"):
        region = ["Northeast"]
        checks.append(_selection_check("final_region_selection", widget_refs["w_region_bar"], [_predicate("region", region)]))
        checks.append(_filter_check("final_monthly_region_filter", widget_refs["w_monthly_line"], link_refs[1], "w_region_bar", _predicate("region", region)))
        if task_id == "museum_visitors_regime_001":
            checks.insert(1, _selection_check("final_monthly_series_selection", widget_refs["w_monthly_line"], [_predicate("region", region)]))
        else:
            checks.extend([
                {"check_id": "final_monthly_zoom", "state_ref": widget_refs["w_monthly_line"], "property": "view", "check": "interval", "expected": {"xDomain": ["2023-03-01", "2023-03-31"]}},
                _filter_check("final_spend_region_filter", widget_refs["w_spend_scatter"], link_refs[2], "w_region_bar", _predicate("region", region)),
                _filter_check("final_spend_date_filter", widget_refs["w_spend_scatter"], link_refs[3], "w_monthly_line", _predicate("date", ["2023-03-01", "2023-03-31"], "between")),
            ])
    elif task_id.startswith("commerce_funnel_"):
        flow = ["Social→Product View→Checkout→Paid"] if task_id == "commerce_funnel_paths_001" else ["Organic→Product View→Checkout→Paid"]
        predicate = _predicate("flow_id", flow)
        checks.append(_selection_check("final_flow_selection", widget_refs["w_flow_sankey"], [predicate]))
        checks.append(_filter_check("final_customer_mix_filter", widget_refs["w_customer_mix"], link_refs[1], "w_flow_sankey", predicate))
        checks.append(_filter_check("final_revenue_filter", widget_refs["w_revenue_line"], link_refs[2], "w_flow_sankey", predicate))
    elif task_id.startswith("saas_"):
        # parallelCoordinates.selectCohort commits numeric dimension ranges;
        # the semantic runtime state is not a derived health_cohort category.
        predicate = _predicate("adoption_score", [29, 43], "between")
        checks.append(_selection_check("final_health_cohort_selection", widget_refs["w_health_parallel"], [predicate]))
        checks.append(_filter_check("final_renewal_cohort_filter", widget_refs["w_renewal_scatter"], link_refs[1], "w_health_parallel", predicate))
        if task_id == "saas_renewal_gap_001":
            checks.append({
                "check_id": "final_plan_cohort_highlight",
                "state_ref": widget_refs["w_plan_bar"],
                "property": "view",
                "check": "categorical",
                "expected": {"highlight": {"sourceAction": "coordination.selectionToHighlight", "relationRef": link_refs[2], "sourceStateRef": f"{widget_refs['w_health_parallel']}/selection/cohort", "targetStateRef": f"{widget_refs['w_plan_bar']}/view/highlight", "predicates": [predicate]}},
            })
    elif task_id.startswith("manufacturing_"):
        # heatmap.selectCell commits one scalar predicate per selected cell;
        # runtime state therefore uses equals rather than the multi-value in
        # predicate emitted by bar/line category selections.
        line_predicate = _predicate("production_line", "Line B", "equals")
        shift_predicate = _predicate("shift", "Night", "equals")
        checks.append(_selection_check("final_quality_submatrix_selection", widget_refs["w_quality_heatmap"], [line_predicate, shift_predicate]))
        checks.append(_filter_check("final_process_line_shift_filter", widget_refs["w_process_scatter"], link_refs[1], "w_quality_heatmap", line_predicate))
        if task_id == "manufacturing_outlier_001":
            checks.append(_selection_check("final_process_region_selection", widget_refs["w_process_scatter"], [_predicate("oven_temperature", [195, 212], "between"), _predicate("defect_rate", [0.1, 0.2], "between")], "interval"))
    elif task_id.startswith("support_routing_"):
        period = ["2026-02-01", "2026-02-28"] if task_id == "support_routing_change_001" else ["2026-01-01", "2026-01-31"]
        checks.append({"check_id": "final_case_period_zoom", "state_ref": widget_refs["w_case_line"], "property": "view", "check": "interval", "expected": {"xDomain": period}})
        predicate = _predicate("opened_date", period, "between")
        for index, widget in enumerate(("w_wait_csat_scatter", "w_outcome_bar"), 1):
            checks.append(_filter_check(f"final_{'wait_csat' if widget == 'w_wait_csat_scatter' else 'outcome'}_period_filter", widget_refs[widget], link_refs[index], "w_case_line", predicate))
    return {"applicable": True, "checks": checks}


def build_evaluation(task: dict[str, Any], rows: list[dict[str, Any]]) -> dict[str, Any]:
    if task["answer_type"] == "open_ended_insight":
        return {"answer": {"type": "open_ended_insight", "answer": task["answer"], "metrics": ["insight_precision", "insight_recall", "groundedness"], "reference_insights": task["reference_insights"]}, "state": {"applicable": True, "checks": []}, "tool": {"steps": []}}
    answer = task.get("answer")
    check_type = task["answer_type"]
    if "answer_field" in task:
        answer = numeric_answer(task, rows) if check_type == "numeric" else (True if task["task_id"] == "support_routing_csat_001" else answer)
    result = {"type": check_type, "value": answer}
    if check_type == "numeric":
        result["tolerance"] = 0.01
    return {"answer": result, "state": {"applicable": True, "checks": []}, "tool": {"steps": []}}


def build_instance(task: dict[str, Any], rows: list[dict[str, Any]], specs: dict[str, str], asl: int) -> dict[str, Any]:
    task_id = task["task_id"]
    widget_refs = {widget: f"wl://widgetva-app/workspace/{task_id}/widget/{widget}" for widget in task["widgets"]}
    links, relation_ids = build_links(task_id, widget_refs, task["links"])
    steps = []
    for index, (operation, widget, params) in enumerate(task["steps"], 1):
        step = {"step_id": f"tool_{index}", "operation": operation, "target_widget_ref": widget_refs[widget], "params": params, "requirement": "required"}
        if index > 1:
            step["depends_on"] = [f"tool_{index - 1}"]
        steps.append(step)
    evaluation = build_evaluation(task, rows)
    evaluation["tool"]["steps"] = materialize_step_alternatives(steps)
    evaluation["state"] = build_state(task, widget_refs, links)
    materialized = {widget: {"spec_path": specs[widget]} for widget in task["widgets"]}
    return {
        "benchmark_id": f"{task_id}_asl{asl}",
        "task_id": task_id,
        "benchmark_partition": "main",
        "asl": asl,
        "query": asl_query(task["query"], asl, task["steps"]),
        "taxonomy": {"answer_determinacy": "open_ended_insight" if task["kind"] == "open" else "verifiable_target", "interaction_horizon": "multi_operation", "workspace_scope": "multi_widget"},
        "workspace": {"workspace_id": task_id, "widgets": {widget: {"ref": widget_refs[widget], "kind": ("parallelCoordinates" if "parallel" in widget else "heatmap" if "heatmap" in widget else "scatter" if "scatter" in widget else "sankey" if "sankey" in widget else "line" if "line" in widget else "bar")} for widget in task["widgets"]}, "links": links},
        "materializations": {"vega": {"renderer": "mixed-vega" if task["dataset"] == "commerce_funnel_001" else "vega-lite", "status": "contract_ready", "widgets": materialized}},
        "evaluation": evaluation,
        "planner_context": {"relation_ids": sorted(set(relation_ids)), "workflow_id": task["workflow"]},
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--spec-root", type=Path, required=True)
    parser.add_argument("--instance-root", type=Path, required=True)
    parser.add_argument("--asl", choices=["0", "1", "2", "3", "all"], default="all")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    rows_by_dataset = {dataset: factory() for dataset, factory in DATASETS.items()}
    spec_paths: dict[str, dict[str, str]] = {}
    for dataset, rows in rows_by_dataset.items():
        generated = dataset_specs(dataset, rows)
        spec_paths[dataset] = {}
        for widget, spec in generated.items():
            path = args.spec_root / dataset / f"{widget}.vl.json"
            write_json(path, spec)
            spec_paths[dataset][widget] = str(path.relative_to(args.repo_root)) if path.is_relative_to(args.repo_root) else str(path)
    asls = [0, 1, 2, 3] if args.asl == "all" else [int(args.asl)]
    count = 0
    for task in TASKS:
        task_specs = {widget: spec_paths[task["dataset"]][widget] for widget in task["widgets"]}
        for asl in asls:
            instance = build_instance(task, rows_by_dataset[task["dataset"]], task_specs, asl)
            path = args.instance_root / task["folder"] / f"{task['task_id']}_asl{asl}.json"
            write_json(path, instance)
            count += 1
    print(json.dumps({"dataset_count": len(DATASETS), "logical_task_count": len(TASKS), "instance_count": count, "asl": asls}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
