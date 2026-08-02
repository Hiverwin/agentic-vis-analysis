export const multiWidgetWorkflows = Object.freeze({
  '2V': Object.freeze([
  {
    "name": "aggregate_to_detail",
    "slug": "multi.aggregate_to_detail",
    "families": [
      "bar",
      "scatter"
    ],
    "viewCount": 2,
    "scenarioExamples": [
      "Find an unusual category in an aggregate chart and inspect its distribution.",
      "Select each category cohort separately and compare its linked record-level profile."
    ],
    "steps": [
      {
        "kind": "perception",
        "operation": "perception.summarizeVisible",
        "purpose": "Identify the category cohorts that require comparison."
      },
      {
        "kind": "action",
        "operation": "bar.selectCategory",
        "purpose": "Select one category with replace semantics so its membership propagates to the profile target."
      },
      {
        "kind": "perception",
        "operation": "perception.summarizeVisible",
        "purpose": "Read the filtered target profile, retain its measures, then repeat for another category."
      },
      {
        "kind": "perception",
        "operation": "perception.compareGroups",
        "purpose": "Compare the selected category with its context."
      }
    ],
    "id": "WF-2V-AGGREGATE-TO-DETAIL-INVESTIGATION-01",
    "scope": "multi_widget",
    "semanticName": "Aggregate-to-detail investigation"
  },
  {
    "name": "repeated_category_profile_comparison",
    "slug": "multi.repeated_category_profile_comparison",
    "families": [
      "bar",
      "scatter"
    ],
    "viewCount": 2,
    "scenarioExamples": [
      "Identify the largest and smallest categories, then compare their linked record-level score profiles.",
      "Select two category cohorts independently and compare their means or distributions in the linked detail view."
    ],
    "steps": [
      {
        "kind": "perception",
        "operation": "perception.summarizeVisible",
        "purpose": "Identify the category cohorts to compare from the aggregate overview."
      },
      {
        "kind": "action",
        "operation": "bar.selectCategory",
        "purpose": "Select the first cohort and replace any prior category selection."
      },
      {
        "kind": "perception",
        "operation": "perception.summarizeVisible",
        "purpose": "Read the first cohort's propagated record-level profile in the linked scatter view."
      },
      {
        "kind": "action",
        "operation": "bar.selectCategory",
        "purpose": "Select the second cohort independently and replace the first selection."
      },
      {
        "kind": "perception",
        "operation": "perception.summarizeVisible",
        "purpose": "Read the second cohort's propagated record-level profile, then compare both retained observations."
      }
    ],
    "id": "WF-2V-REPEATED-CATEGORY-PROFILE-COMPARISON-10",
    "scope": "multi_widget",
    "semanticName": "Repeated category-to-profile comparison"
  },
  {
    "name": "category_to_trend",
    "slug": "multi.category_to_trend",
    "families": [
      "bar",
      "line"
    ],
    "viewCount": 2,
    "scenarioExamples": [
      "Compare how different categories change over time."
    ],
    "steps": [
      {
        "kind": "action",
        "operation": "bar.selectCategory",
        "purpose": "Choose the category of interest."
      },
      {
        "kind": "action",
        "operation": "line.selectSeries",
        "purpose": "Inspect the corresponding time series."
      },
      {
        "kind": "perception",
        "operation": "perception.compareGroups",
        "purpose": "Compare the resulting trends."
      }
    ],
    "id": "WF-2V-CATEGORY-TO-TREND-COMPARISON-02",
    "scope": "multi_widget",
    "semanticName": "Category-to-trend comparison"
  },
  {
    "name": "linked_time_window_distribution",
    "slug": "multi.linked_time_window_distribution",
    "families": [
      "scatter",
      "bar"
    ],
    "viewCount": 2,
    "scenarioExamples": [
      "Compare category composition inside a selected time window."
    ],
    "steps": [
      {
        "kind": "action",
        "operation": "scatter.brushRegion",
        "purpose": "Select the time or value region to investigate."
      },
      {
        "kind": "perception",
        "operation": "perception.compareGroups",
        "purpose": "Compare the updated linked distributions."
      }
    ],
    "id": "WF-2V-LINKED-TIME-WINDOW-DISTRIBUTION-03",
    "scope": "multi_widget",
    "semanticName": "Linked time-window distribution"
  },
  {
    "name": "overview_to_detail_anomaly",
    "slug": "multi.overview_to_detail_anomaly",
    "families": [
      "line",
      "scatter"
    ],
    "viewCount": 2,
    "scenarioExamples": [
      "Find an unusual series and inspect the corresponding records or region."
    ],
    "steps": [
      {
        "kind": "action",
        "operation": "line.selectSeries",
        "purpose": "Focus the series that needs explanation."
      },
      {
        "kind": "perception",
        "operation": "perception.findOutliers",
        "purpose": "Locate unusual values in the linked detail view."
      },
      {
        "kind": "action",
        "operation": "scatter.brushRegion",
        "purpose": "Inspect the suspicious region more closely."
      }
    ],
    "id": "WF-2V-OVERVIEW-TO-DETAIL-ANOMALY-INVESTIGATION-04",
    "scope": "multi_widget",
    "semanticName": "Overview-to-detail anomaly investigation"
  },
  {
    "name": "series_composition_comparison",
    "slug": "multi.series_composition_comparison",
    "families": [
      "line",
      "bar"
    ],
    "viewCount": 2,
    "scenarioExamples": [
      "Compare category composition across multiple series."
    ],
    "steps": [
      {
        "kind": "action",
        "operation": "line.selectSeries",
        "purpose": "Choose the series to compare."
      },
      {
        "kind": "perception",
        "operation": "perception.summarizeVisible",
        "purpose": "Read category counts, shares, and denominator after the selected series propagates."
      }
    ],
    "id": "WF-2V-SERIES-COMPOSITION-COMPARISON-05",
    "scope": "multi_widget",
    "semanticName": "Series composition comparison"
  },
  {
    "name": "high_dimensional_cohort_profile",
    "slug": "multi.high_dimensional_cohort_profile",
    "families": [
      "parallelCoordinates",
      "scatter"
    ],
    "viewCount": 2,
    "scenarioExamples": [
      "Find a cohort satisfying several conditions and inspect its profile."
    ],
    "steps": [
      {
        "kind": "action",
        "operation": "parallelCoordinates.filterDimension",
        "purpose": "Define one numeric constraint for the multidimensional cohort."
      },
      {
        "kind": "action",
        "operation": "scatter.selectRegion",
        "purpose": "Inspect the cohort in a two-dimensional view."
      },
      {
        "kind": "perception",
        "operation": "perception.findOutliers",
        "purpose": "Identify unusual members of the cohort."
      }
    ],
    "id": "WF-2V-HIGH-DIMENSIONAL-COHORT-PROFILE-06",
    "scope": "multi_widget",
    "semanticName": "High-dimensional cohort profile"
  },
  {
    "name": "matrix_relationship_investigation",
    "slug": "multi.matrix_relationship_investigation",
    "families": [
      "heatmap",
      "scatter"
    ],
    "viewCount": 2,
    "scenarioExamples": [
      "Investigate a local relationship pattern in a matrix view."
    ],
    "steps": [
      {
        "kind": "action",
        "operation": "heatmap.selectSubmatrix",
        "purpose": "Choose the matrix region to investigate."
      },
      {
        "kind": "action",
        "operation": "scatter.selectRegion",
        "purpose": "Inspect the corresponding records."
      },
      {
        "kind": "perception",
        "operation": "perception.findOutliers",
        "purpose": "Check for unusual relationship patterns."
      }
    ],
    "id": "WF-2V-MATRIX-RELATIONSHIP-INVESTIGATION-07",
    "scope": "multi_widget",
    "semanticName": "Matrix relationship investigation"
  },
  {
    "name": "flow_explanation",
    "slug": "multi.flow_explanation",
    "families": [
      "sankey",
      "bar"
    ],
    "viewCount": 2,
    "scenarioExamples": [
      "Explain the composition and bottlenecks of a selected flow."
    ],
    "steps": [
      {
        "kind": "action",
        "operation": "sankey.focusFlow",
        "purpose": "Focus the flow that needs explanation."
      },
      {
        "kind": "perception",
        "operation": "perception.findBottleneck",
        "purpose": "Locate the main bottleneck."
      },
      {
        "kind": "perception",
        "operation": "perception.compareGroups",
        "purpose": "Compare the affected groups."
      }
    ],
    "id": "WF-2V-FLOW-EXPLANATION-08",
    "scope": "multi_widget",
    "semanticName": "Flow explanation"
  },
  {
    "name": "before_after_period_comparison",
    "slug": "multi.before_after_period_comparison",
    "families": [
      "line",
      "bar"
    ],
    "viewCount": 2,
    "scenarioExamples": [
      "Compare the same measures before and after a selected period."
    ],
    "steps": [
      {
        "kind": "action",
        "operation": "line.zoomXRegion",
        "purpose": "Set the period to inspect."
      },
      {
        "kind": "perception",
        "operation": "perception.compareGroups",
        "purpose": "Compare the resulting period summaries."
      }
    ],
    "id": "WF-2V-BEFORE-AFTER-PERIOD-COMPARISON-09",
    "scope": "multi_widget",
    "semanticName": "Before-after period comparison"
  },
  {
    "name": "category_regime_comparison",
    "slug": "multi.category_regime_comparison",
    "families": [
      "bar",
      "line"
    ],
    "viewCount": 2,
    "scenarioExamples": [
      "Compare the trends and distributions of selected categories."
    ],
    "steps": [
      {
        "kind": "action",
        "operation": "bar.selectCategory",
        "purpose": "Choose the category regime."
      },
      {
        "kind": "action",
        "operation": "line.selectSeries",
        "purpose": "Inspect its temporal behavior."
      },
      {
        "kind": "perception",
        "operation": "perception.compareGroups",
        "purpose": "Compare the selected regime with alternatives."
      }
    ],
    "id": "WF-2V-CATEGORY-REGIME-COMPARISON-11",
    "scope": "multi_widget",
    "semanticName": "Category regime comparison"
  },
  {
    "name": "repeated_category_linked_trend_comparison",
    "slug": "multi.repeated_category_linked_trend_comparison",
    "families": [
      "bar",
      "scatter"
    ],
    "viewCount": 2,
    "scenarioExamples": [
      "Compare how maximum temperature trends differ across weather categories.",
      "For each selected weather type, select the category in the bar chart, inspect the linked scatter or line result, then synthesize the trend differences."
    ],
    "steps": [
      {
        "kind": "action",
        "operation": "bar.selectCategory",
        "purpose": "Repeat this source selection for each category that must be compared; let selection-to-filter links update the linked view after each turn."
      }
    ],
    "id": "WF-2V-REPEATED-CATEGORY-LINKED-TREND-COMPARISON-12",
    "scope": "multi_widget",
    "semanticName": "Repeated category-linked trend comparison"
  },
  {
    "name": "repeated_interval_distribution_comparison",
    "slug": "multi.repeated_interval_distribution_comparison",
    "families": [
      "scatter",
      "bar"
    ],
    "viewCount": 2,
    "scenarioExamples": [
      "Compare weather-category distributions across seasons or other time intervals.",
      "Brush each inferred time interval in the scatter view, let the linked bar chart reaggregate the selected rows, then compare the resulting distributions."
    ],
    "steps": [
      {
        "kind": "action",
        "operation": "scatter.brushRegion",
        "purpose": "Repeat this source brush for each inferred interval; let brush-to-reaggregate or brush-to-filter links update linked distribution views after each turn."
      },
      {
        "kind": "perception",
        "operation": "perception.summarizeVisible",
        "purpose": "After each propagated interval, summarize the linked distribution view; use history to compare the summaries across intervals."
      }
    ],
    "id": "WF-2V-REPEATED-INTERVAL-DISTRIBUTION-COMPARISON-13",
    "scope": "multi_widget",
    "semanticName": "Repeated interval distribution comparison"
  },
  {
    "name": "repeated_temporal_composition_comparison",
    "slug": "multi.repeated_temporal_composition_comparison",
    "families": ["line", "bar"],
    "viewCount": 2,
    "scenarioExamples": [
      "Select two time windows independently and compare their linked category composition."
    ],
    "steps": [
      {
        "kind": "action",
        "operation": "line.zoomXRegion",
        "purpose": "Select the first time window with replacement semantics."
      },
      {
        "kind": "perception",
        "operation": "perception.summarizeVisible",
        "purpose": "Read and retain the linked category composition and denominator for the active window."
      },
      {
        "kind": "action",
        "operation": "line.zoomXRegion",
        "purpose": "Replace the first window with the second independent time window."
      },
      {
        "kind": "perception",
        "operation": "perception.summarizeVisible",
        "purpose": "Read the second linked composition and compare normalized shares with the retained first snapshot."
      }
    ],
    "id": "WF-2V-REPEATED-TEMPORAL-COMPOSITION-COMPARISON-14",
    "scope": "multi_widget",
    "semanticName": "Repeated temporal composition comparison"
  },
  {
    "name": "trend_break_contextualization",
    "slug": "multi.trend_break_contextualization",
    "families": ["line", "bar"],
    "viewCount": 2,
    "scenarioExamples": [
      "Find a structural break in a trend and inspect whether category composition changed around it.",
      "Identify an unusual trend transition, then compare the linked aggregate context before explaining the shift."
    ],
    "steps": [
      {
        "kind": "perception",
        "operation": "perception.detectAnomalies",
        "purpose": "Locate candidate breakpoints or unusual trend regions from the time-series evidence."
      },
      {
        "kind": "action",
        "operation": "line.zoomXRegion",
        "purpose": "Focus the evidence-derived interval so linked aggregate views update to that local context."
      },
      {
        "kind": "perception",
        "operation": "perception.summarizeVisible",
        "purpose": "Read the linked aggregate summary after propagation and compare it with retained baseline evidence."
      }
    ],
    "id": "WF-2V-TREND-BREAK-CONTEXTUALIZATION-15",
    "scope": "multi_widget",
    "semanticName": "Trend break contextualization"
  }
]),
  '3V': Object.freeze([
  {
    "name": "risk_cohort_triangulation",
    "slug": "multi.risk_cohort_triangulation",
    "families": [
      "scatter",
      "parallelCoordinates",
      "bar"
    ],
    "viewCount": 3,
    "scenarioExamples": [
      "Triangulate a suspicious cohort across spatial, high-dimensional, and summary views."
    ],
    "steps": [
      {
        "kind": "action",
        "operation": "scatter.brushRegion",
        "purpose": "Define the suspicious cohort."
      },
      {
        "kind": "action",
        "operation": "parallelCoordinates.filterDimension",
        "purpose": "Inspect one of its multidimensional constraints."
      },
      {
        "kind": "perception",
        "operation": "perception.findOutliers",
        "purpose": "Read feature and contextual evidence for the anomaly and a reference cohort without overstating causation."
      }
    ],
    "id": "WF-3V-RISK-COHORT-TRIANGULATION-10",
    "scope": "multi_widget",
    "semanticName": "Risk cohort triangulation"
  },
  {
    "name": "category_cohort_triangulation",
    "slug": "multi.category_cohort_triangulation",
    "families": ["bar", "scatter", "heatmap"],
    "viewCount": 3,
    "scenarioExamples": ["Select categories independently and compare their quantitative profile and contextual distribution."],
    "steps": [
      { "kind": "perception", "operation": "perception.summarizeVisible", "purpose": "Identify candidate categories and both linked target roles." },
      { "kind": "action", "operation": "bar.selectCategory", "purpose": "Select one category and fan its membership out to both targets." },
      { "kind": "perception", "operation": "perception.summarizeVisible", "purpose": "Read complementary target evidence, then repeat with replacement semantics." }
    ],
    "id": "WF-3V-CATEGORY-COHORT-TRIANGULATION-11",
    "scope": "multi_widget",
    "semanticName": "Category cohort triangulation"
  },
  {
    "name": "category_trend_drilldown",
    "slug": "multi.category_trend_drilldown",
    "families": ["bar", "line", "scatter"],
    "viewCount": 3,
    "scenarioExamples": ["Compare category trends, derive the strongest divergence interval, and inspect linked detail records."],
    "steps": [
      { "kind": "action", "operation": "bar.selectCategory", "purpose": "Select a category and update its linked trend." },
      { "kind": "perception", "operation": "perception.summarizeVisible", "purpose": "Compare category trend evidence before deriving a drilldown interval." },
      { "kind": "action", "operation": "line.zoomXRegion", "purpose": "Select the evidence-derived interval and expose linked details." }
    ],
    "id": "WF-3V-CATEGORY-TREND-DRILLDOWN-12",
    "scope": "multi_widget",
    "semanticName": "Category trend comparison and detail drilldown"
  },
  {
    "name": "derived_cohort_triangulation",
    "slug": "multi.derived_cohort_triangulation",
    "families": ["scatter", "bar", "heatmap"],
    "viewCount": 3,
    "scenarioExamples": ["Define a cohort, derive a category from its linked composition, then compare outcomes within that category."],
    "steps": [
      { "kind": "action", "operation": "scatter.brushRegion", "purpose": "Define the initial cohort." },
      { "kind": "perception", "operation": "perception.summarizeVisible", "purpose": "Derive the category from fresh linked composition evidence." },
      { "kind": "action", "operation": "heatmap.filterCellsByRegion", "purpose": "Condition the outcome heatmap on the observed category while preserving cohort context." }
    ],
    "id": "WF-3V-DERIVED-COHORT-TRIANGULATION-13",
    "scope": "multi_widget",
    "semanticName": "Derived-cohort triangulation"
  },
  {
    "name": "flow_cohort_explanation",
    "slug": "multi.flow_cohort_explanation",
    "families": ["sankey", "bar", "line"],
    "viewCount": 3,
    "scenarioExamples": ["Compare two flows and explain their contributor composition and contextual difference."],
    "steps": [
      { "kind": "action", "operation": "sankey.focusFlow", "purpose": "Select one flow or path and expose its contributor membership." },
      { "kind": "perception", "operation": "perception.summarizeVisible", "purpose": "Read linked contributor composition and context, then repeat for a comparison flow." },
      { "kind": "perception", "operation": "perception.compareGroups", "purpose": "Compare the two independently captured flow snapshots." }
    ],
    "id": "WF-3V-FLOW-COHORT-EXPLANATION-14",
    "scope": "multi_widget",
    "semanticName": "Flow cohort explanation"
  },
  {
    "name": "highdim_cohort_profile",
    "slug": "multi.highdim_cohort_profile",
    "families": ["parallelCoordinates", "scatter", "bar"],
    "viewCount": 3,
    "scenarioExamples": ["Apply two high-dimensional cohort rules and compare linked projection and category composition."],
    "steps": [
      { "kind": "action", "operation": "parallelCoordinates.selectCohort", "purpose": "Apply an explicit multi-dimensional cohort rule with inclusive AND semantics." },
      { "kind": "perception", "operation": "perception.summarizeVisible", "purpose": "Read projection and composition evidence for the active cohort." },
      { "kind": "action", "operation": "parallelCoordinates.selectCohort", "purpose": "Replace the prior cohort with the next independent multi-dimensional rule." }
    ],
    "id": "WF-3V-HIGHDIM-COHORT-PROFILE-15",
    "scope": "multi_widget",
    "semanticName": "High-dimensional cohort profile"
  },
  {
    "name": "period_condition_comparison",
    "slug": "multi.period_condition_comparison",
    "families": ["line", "scatter", "bar"],
    "viewCount": 3,
    "scenarioExamples": ["Select two periods independently and compare their linked relationship and composition evidence."],
    "steps": [
      { "kind": "action", "operation": "line.zoomXRegion", "purpose": "Select one frozen period without retaining the previous period." },
      { "kind": "perception", "operation": "perception.summarizeVisible", "purpose": "Read linked relationship and composition evidence with its denominator." },
      { "kind": "perception", "operation": "perception.computeCorrelation", "purpose": "Compare the relationship evidence across independently selected periods." }
    ],
    "id": "WF-3V-PERIOD-CONDITION-COMPARISON-16",
    "scope": "multi_widget",
    "semanticName": "Period condition comparison"
  },
  {
    "name": "relationship_triangulation",
    "slug": "multi.relationship_triangulation",
    "families": ["heatmap", "scatter", "parallelCoordinates"],
    "viewCount": 3,
    "scenarioExamples": ["Select candidate variable relationships, inspect their bivariate form, and qualify them with multivariate context."],
    "steps": [
      { "kind": "action", "operation": "heatmap.selectSubmatrix", "purpose": "Select a relationship candidate and configure linked targets." },
      { "kind": "perception", "operation": "perception.computeCorrelation", "purpose": "Read bivariate evidence using the current valid-row set." },
      { "kind": "perception", "operation": "perception.summarizeVisible", "purpose": "Check multivariate context before ranking or qualifying the relationship." }
    ],
    "id": "WF-3V-RELATIONSHIP-TRIANGULATION-17",
    "scope": "multi_widget",
    "semanticName": "Relationship candidate triangulation"
  },
  {
    "name": "anomaly_context_triangulation",
    "slug": "multi.anomaly_context_triangulation",
    "families": ["line", "parallelCoordinates", "bar"],
    "viewCount": 3,
    "scenarioExamples": [
      "Detect a temporal anomaly and compare its linked feature and context evidence with a nearby reference point."
    ],
    "steps": [
      {
        "kind": "perception",
        "operation": "perception.detectAnomalies",
        "purpose": "Identify the evidence-derived anomaly using the requested statistical rule."
      },
      {
        "kind": "action",
        "operation": "line.selectXValue",
        "purpose": "Select the anomaly and expose its linked feature and context records."
      },
      {
        "kind": "perception",
        "operation": "perception.summarizeVisible",
        "purpose": "Read and retain both linked evidence views for the anomaly."
      },
      {
        "kind": "action",
        "operation": "line.selectXValue",
        "purpose": "Replace the anomaly selection with the requested non-anomalous reference point."
      },
      {
        "kind": "perception",
        "operation": "perception.summarizeVisible",
        "purpose": "Read both reference views and compare them with the retained anomaly snapshot without claiming causation."
      }
    ],
    "id": "WF-3V-ANOMALY-CONTEXT-TRIANGULATION-18",
    "scope": "multi_widget",
    "semanticName": "Anomaly feature-context triangulation"
  },
  {
    "name": "progressive_cohort_narrowing",
    "slug": "multi.progressive_cohort_narrowing",
    "families": ["bar", "parallelCoordinates", "scatter"],
    "viewCount": 3,
    "scenarioExamples": [
      "Start from a business segment, refine it with multidimensional constraints, and inspect the resulting record-level pattern.",
      "Narrow a visible cohort step by step before checking whether the focused records form an unusual group."
    ],
    "steps": [
      {
        "kind": "action",
        "operation": "bar.selectCategory",
        "purpose": "Select the initial segment or category that defines the first cohort boundary."
      },
      {
        "kind": "action",
        "operation": "parallelCoordinates.selectCohort",
        "purpose": "Refine the active cohort with one or more multidimensional range constraints."
      },
      {
        "kind": "perception",
        "operation": "perception.findOutliers",
        "purpose": "Inspect the linked record-level view for unusual members inside the narrowed cohort."
      }
    ],
    "id": "WF-3V-PROGRESSIVE-COHORT-NARROWING-19",
    "scope": "multi_widget",
    "semanticName": "Progressive cohort narrowing"
  },
  {
    "name": "baseline_exception_comparison",
    "slug": "multi.baseline_exception_comparison",
    "families": ["line", "bar", "heatmap"],
    "viewCount": 3,
    "scenarioExamples": [
      "Compare an exceptional period with a baseline period to decide whether the change is broad or localized.",
      "Select an anomaly and a normal reference point, then compare linked composition and matrix context."
    ],
    "steps": [
      {
        "kind": "perception",
        "operation": "perception.detectAnomalies",
        "purpose": "Find the evidence-derived exceptional time point or interval."
      },
      {
        "kind": "action",
        "operation": "line.selectXValue",
        "purpose": "Select the exceptional point so linked context views update to that case."
      },
      {
        "kind": "perception",
        "operation": "perception.summarizeVisible",
        "purpose": "Retain the linked composition and matrix context for the exceptional case."
      },
      {
        "kind": "action",
        "operation": "line.selectXValue",
        "purpose": "Replace the exception with a baseline point for an independent comparison snapshot."
      },
      {
        "kind": "perception",
        "operation": "perception.compareGroups",
        "purpose": "Compare the retained exception evidence with the baseline-linked context."
      }
    ],
    "id": "WF-3V-BASELINE-EXCEPTION-COMPARISON-20",
    "scope": "multi_widget",
    "semanticName": "Baseline exception comparison"
  }
]),
  '4V': Object.freeze([
  {
    "name": "segment_performance_diagnosis",
    "slug": "multi.segment_performance_diagnosis",
    "families": ["bar", "line", "scatter", "parallelCoordinates"],
    "viewCount": 4,
    "scenarioExamples": [
      "Diagnose why one segment performs differently by checking aggregate, temporal, record-level, and feature-profile evidence.",
      "Select a category, inspect its trend and records, then refine the explanation with multidimensional context."
    ],
    "steps": [
      {
        "kind": "action",
        "operation": "bar.selectCategory",
        "purpose": "Select the segment that needs explanation and let linked views update from that cohort."
      },
      {
        "kind": "perception",
        "operation": "perception.summarizeVisible",
        "purpose": "Summarize the linked temporal and record-level evidence for the selected segment."
      },
      {
        "kind": "action",
        "operation": "parallelCoordinates.selectCohort",
        "purpose": "Refine the segment with feature ranges when the current evidence suggests a narrower subgroup."
      },
      {
        "kind": "perception",
        "operation": "perception.findOutliers",
        "purpose": "Check whether the refined segment contains influential or exceptional records."
      }
    ],
    "id": "WF-4V-SEGMENT-PERFORMANCE-DIAGNOSIS-01",
    "scope": "multi_widget",
    "semanticName": "Segment performance diagnosis"
  },
  {
    "name": "temporal_anomaly_cross_check",
    "slug": "multi.temporal_anomaly_cross_check",
    "families": ["line", "heatmap", "scatter", "bar"],
    "viewCount": 4,
    "scenarioExamples": [
      "Find a temporal anomaly and cross-check whether relationship, record-level, and composition views support the same interpretation.",
      "Investigate whether an unusual period is driven by a local relationship pattern or a broader category shift."
    ],
    "steps": [
      {
        "kind": "perception",
        "operation": "perception.detectAnomalies",
        "purpose": "Identify the anomalous period from the time-series view."
      },
      {
        "kind": "action",
        "operation": "line.zoomXRegion",
        "purpose": "Focus the anomaly window and let linked relationship, detail, and composition views update together."
      },
      {
        "kind": "perception",
        "operation": "perception.findOutliers",
        "purpose": "Inspect the updated detail view for records that may explain the anomaly."
      },
      {
        "kind": "perception",
        "operation": "perception.summarizeVisible",
        "purpose": "Summarize the linked aggregate and matrix context before forming the explanation."
      }
    ],
    "id": "WF-4V-TEMPORAL-ANOMALY-CROSS-CHECK-02",
    "scope": "multi_widget",
    "semanticName": "Temporal anomaly cross-check"
  },
  {
    "name": "cross_view_contradiction_resolution",
    "slug": "multi.cross_view_contradiction_resolution",
    "families": ["bar", "line", "scatter", "heatmap"],
    "viewCount": 4,
    "scenarioExamples": [
      "Resolve a disagreement between aggregate ranking, recent trend, record-level relationship, and matrix context.",
      "Check whether the top category remains important after temporal and relationship evidence are considered."
    ],
    "steps": [
      {
        "kind": "perception",
        "operation": "perception.compareGroups",
        "purpose": "Identify the aggregate contrast or disagreement that needs resolution."
      },
      {
        "kind": "action",
        "operation": "bar.selectCategory",
        "purpose": "Select the disputed category so linked views expose its temporal and record-level context."
      },
      {
        "kind": "action",
        "operation": "line.zoomXRegion",
        "purpose": "Focus the relevant period if the contradiction depends on time-local behavior."
      },
      {
        "kind": "perception",
        "operation": "perception.computeCorrelation",
        "purpose": "Use the updated relationship evidence to qualify the aggregate claim."
      }
    ],
    "id": "WF-4V-CROSS-VIEW-CONTRADICTION-RESOLUTION-03",
    "scope": "multi_widget",
    "semanticName": "Cross-view contradiction resolution"
  }
]),
  '5V': Object.freeze([
  {
    "name": "multi_angle_cohort_review",
    "slug": "multi.multi_angle_cohort_review",
    "families": ["bar", "line", "scatter", "heatmap", "parallelCoordinates"],
    "viewCount": 5,
    "scenarioExamples": [
      "Review a cohort from aggregate, temporal, bivariate, matrix, and multidimensional perspectives before answering.",
      "Select a segment and decide whether its behavior is consistent across all available non-flow views."
    ],
    "steps": [
      {
        "kind": "action",
        "operation": "bar.selectCategory",
        "purpose": "Select the cohort or segment that anchors the multi-view review."
      },
      {
        "kind": "perception",
        "operation": "perception.summarizeVisible",
        "purpose": "Read the linked aggregate and temporal context after the cohort selection propagates."
      },
      {
        "kind": "action",
        "operation": "parallelCoordinates.selectCohort",
        "purpose": "Optionally refine the cohort using feature ranges suggested by the updated views."
      },
      {
        "kind": "perception",
        "operation": "perception.computeCorrelation",
        "purpose": "Inspect the linked scatter or relationship evidence for the active cohort."
      },
      {
        "kind": "perception",
        "operation": "perception.compareGroups",
        "purpose": "Compare the selected cohort with relevant alternatives before answering."
      }
    ],
    "id": "WF-5V-MULTI-ANGLE-COHORT-REVIEW-01",
    "scope": "multi_widget",
    "semanticName": "Multi-angle cohort review"
  },
  {
    "name": "flow_bottleneck_impact_diagnosis",
    "slug": "multi.flow_bottleneck_impact_diagnosis",
    "families": ["sankey", "bar", "line", "scatter", "heatmap"],
    "viewCount": 5,
    "scenarioExamples": [
      "Locate a process bottleneck and inspect which groups, periods, and records are affected.",
      "Explain whether a flow drop-off is associated with a segment, a time interval, or a local relationship pattern."
    ],
    "steps": [
      {
        "kind": "action",
        "operation": "sankey.focusFlow",
        "purpose": "Focus the path or transition that represents the suspected process bottleneck."
      },
      {
        "kind": "perception",
        "operation": "perception.findBottleneck",
        "purpose": "Identify the main loss point or constrained step in the focused flow."
      },
      {
        "kind": "perception",
        "operation": "perception.summarizeVisible",
        "purpose": "Read linked segment and temporal context for the affected flow membership."
      },
      {
        "kind": "action",
        "operation": "scatter.brushRegion",
        "purpose": "Inspect a record-level region if the linked context suggests a concentrated subgroup."
      },
      {
        "kind": "perception",
        "operation": "perception.compareGroups",
        "purpose": "Compare the affected flow cohort with the non-affected context."
      }
    ],
    "id": "WF-5V-FLOW-BOTTLENECK-IMPACT-DIAGNOSIS-02",
    "scope": "multi_widget",
    "semanticName": "Flow bottleneck impact diagnosis"
  }
]),
  '6V': Object.freeze([
  {
    "name": "end_to_end_exception_investigation",
    "slug": "multi.end_to_end_exception_investigation",
    "families": ["line", "bar", "scatter", "heatmap", "parallelCoordinates", "sankey"],
    "viewCount": 6,
    "scenarioExamples": [
      "Investigate a KPI exception across detection, segment, record, feature, relationship, and process views.",
      "Build an end-to-end explanation for an unusual event using all coordinated views without treating every update as a separate action."
    ],
    "steps": [
      {
        "kind": "perception",
        "operation": "perception.detectAnomalies",
        "purpose": "Find the primary exception or period that should anchor the investigation."
      },
      {
        "kind": "action",
        "operation": "line.selectXValue",
        "purpose": "Select the exception so all linked views update to the same event context."
      },
      {
        "kind": "perception",
        "operation": "perception.summarizeVisible",
        "purpose": "Read the updated segment, process, and relationship summaries after propagation settles."
      },
      {
        "kind": "action",
        "operation": "parallelCoordinates.selectCohort",
        "purpose": "Refine the explanation with feature-level constraints when the linked summaries point to a subgroup."
      },
      {
        "kind": "action",
        "operation": "sankey.focusFlow",
        "purpose": "Inspect whether the refined cohort concentrates in a process path or transition."
      },
      {
        "kind": "perception",
        "operation": "perception.findOutliers",
        "purpose": "Identify exceptional records or members that carry the explanation."
      },
      {
        "kind": "perception",
        "operation": "perception.compareGroups",
        "purpose": "Compare the exception cohort with a baseline or non-exception context before answering."
      }
    ],
    "id": "WF-6V-END-TO-END-EXCEPTION-INVESTIGATION-01",
    "scope": "multi_widget",
    "semanticName": "End-to-end exception investigation"
  }
]),
})

export const multiWidgetWorkflowList = Object.freeze(Object.values(multiWidgetWorkflows).flat())

export function listMultiWidgetWorkflows(viewCount = null) {
  if (viewCount == null) return [...multiWidgetWorkflowList]
  const key = typeof viewCount === 'number' ? `${viewCount}V` : viewCount
  return [...(multiWidgetWorkflows[key] || [])]
}

export default multiWidgetWorkflows
