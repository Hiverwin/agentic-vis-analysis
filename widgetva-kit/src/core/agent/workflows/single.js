export const singleWidgetWorkflows = Object.freeze({
  bar: Object.freeze([
  {
    "name": "filter_then_rank",
    "slug": "bar.filter_then_rank",
    "semanticName": "Constrained ranking",
    "scenarioExamples": [
      "After excluding irrelevant platforms, which Xbox product ranks first by average RPG score?",
      "Among selected countries, which region has the second-highest average employment?"
    ],
    "description": "Use when the task asks for the top, bottom, first, second, or ranked category after excluding or keeping a subset.",
    "steps": [
      {
        "kind": "action",
        "operation": "bar.filterCategories"
      },
      {
        "kind": "action",
        "operation": "bar.sortBars"
      },
      {
        "kind": "action",
        "operation": "bar.highlightTopN"
      }
    ],
    "id": "WF-1V-CONSTRAINED-RANKING-01",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "bar"
    ]
  },
  {
    "name": "filter_subcategories_then_rank",
    "slug": "bar.filter_subcategories_then_rank",
    "semanticName": "Segment-level ranking",
    "scenarioExamples": [
      "For 2025 equipment only, which company ranks second by average power consumption?",
      "Among students with a specific parental education level, which group has the highest average math score?"
    ],
    "description": "Use when the comparison depends on one subcategory slice before ranking the remaining bars.",
    "steps": [
      {
        "kind": "action",
        "operation": "bar.filterSubcategories"
      },
      {
        "kind": "action",
        "operation": "bar.sortBars"
      },
      {
        "kind": "action",
        "operation": "bar.highlightTopN"
      }
    ],
    "id": "WF-1V-SEGMENT-LEVEL-RANKING-02",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "bar"
    ]
  },
  {
    "name": "filter_then_compare_stack",
    "slug": "bar.filter_then_compare_stack",
    "semanticName": "Composition comparison after filtering",
    "scenarioExamples": [
      "After keeping West and South, which region contributes more total sales and how does the mix differ?",
      "Within one vehicle model series, which fuel type dominates after narrowing the comparison set?"
    ],
    "description": "Use when the task asks how filtered categories differ by stacked composition or subgroup contribution.",
    "steps": [
      {
        "kind": "action",
        "operation": "bar.filterCategories"
      },
      {
        "kind": "action",
        "operation": "bar.toggleStackMode"
      },
      {
        "kind": "perception",
        "operation": "perception.compareGroups"
      }
    ],
    "id": "WF-1V-COMPOSITION-COMPARISON-AFTER-FILTERING-03",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "bar"
    ]
  },
  {
    "name": "filter_subcategories_then_compare_stack",
    "slug": "bar.filter_subcategories_then_compare_stack",
    "semanticName": "Grouped segment comparison",
    "scenarioExamples": [
      "For selected chest-pain and heart-disease combinations, which group has higher average cholesterol?",
      "Across workout experience levels, which workout type shows the largest reduction in body fat percentage?"
    ],
    "description": "Use when the task asks for grouped subset comparison after keeping or removing specific subcategories.",
    "steps": [
      {
        "kind": "action",
        "operation": "bar.filterSubcategories"
      },
      {
        "kind": "action",
        "operation": "bar.toggleStackMode"
      },
      {
        "kind": "perception",
        "operation": "perception.compareGroups"
      }
    ],
    "id": "WF-1V-GROUPED-SEGMENT-COMPARISON-04",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "bar"
    ]
  },
  {
    "name": "rank_then_highlight_top_n",
    "slug": "bar.rank_then_highlight_top_n",
    "semanticName": "Top performer analysis",
    "scenarioExamples": [
      "Which companies have the strongest and weakest LinkedIn presence, and what pattern separates them?",
      "Which anime titles are top performers by popularity compared with the rest of the distribution?"
    ],
    "description": "Use when the task asks to identify or discuss top performers after ranking all visible categories.",
    "steps": [
      {
        "kind": "action",
        "operation": "bar.sortBars"
      },
      {
        "kind": "action",
        "operation": "bar.highlightTopN"
      },
      {
        "kind": "perception",
        "operation": "perception.compareGroups"
      }
    ],
    "id": "WF-1V-TOP-PERFORMER-ANALYSIS-05",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "bar"
    ]
  }
]),
  heatmap: Object.freeze([
  {
    "name": "filter_region_then_find_extremes",
    "slug": "heatmap.filter_region_then_find_extremes",
    "semanticName": "Local hotspot or coldspot lookup",
    "scenarioExamples": [
      "Within haircare products, which customer demographic has the highest mean price?",
      "For a selected city-month range, which cell has the most extreme temperature?"
    ],
    "description": "Use when the task asks for the hottest, coldest, highest, or lowest cell inside a local heatmap region.",
    "steps": [
      {
        "kind": "action",
        "operation": "heatmap.filterCellsByRegion"
      },
      {
        "kind": "perception",
        "operation": "perception.findExtremes"
      }
    ],
    "id": "WF-1V-LOCAL-HOTSPOT-OR-COLDSPOT-LOOKUP-01",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "heatmap"
    ]
  },
  {
    "name": "filter_region_then_summarize",
    "slug": "heatmap.filter_region_then_summarize",
    "semanticName": "Local block summary",
    "scenarioExamples": [
      "What is the difference in mean anxiety levels between composers who are instrumentalists and those who are not?",
      "How does one month band compare with another across the selected product categories?"
    ],
    "description": "Use when the task asks for a comparison or summary after keeping a row, column, or submatrix region.",
    "steps": [
      {
        "kind": "action",
        "operation": "heatmap.filterCellsByRegion"
      },
      {
        "kind": "perception",
        "operation": "perception.findExtremes"
      }
    ],
    "id": "WF-1V-LOCAL-BLOCK-SUMMARY-02",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "heatmap"
    ]
  },
  {
    "name": "adjust_color_then_add_marginals",
    "slug": "heatmap.adjust_color_then_add_marginals",
    "semanticName": "Row-column contribution reading",
    "scenarioExamples": [
      "Which rows and columns drive the strongest hotspot pattern after the color scale is made readable?",
      "Do marginal totals confirm that the apparent hotspot is a row effect or a column effect?"
    ],
    "description": "Use when the global heatmap structure is hard to read and row or column totals would clarify hotspots.",
    "steps": [
      {
        "kind": "action",
        "operation": "heatmap.adjustColorScale"
      },
      {
        "kind": "action",
        "operation": "heatmap.addMarginalBars"
      },
      {
        "kind": "perception",
        "operation": "perception.findExtremes"
      }
    ],
    "id": "WF-1V-ROW-COLUMN-CONTRIBUTION-READING-03",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "heatmap"
    ]
  },
  {
    "name": "cluster_then_highlight_region",
    "slug": "heatmap.cluster_then_highlight_region",
    "semanticName": "Clustered block interpretation",
    "scenarioExamples": [
      "Which months form a coherent seasonal block after clustering rows and columns?",
      "Which disease-risk features cluster together, and which region should be highlighted for explanation?"
    ],
    "description": "Use when the task asks about block structure after row or column clustering.",
    "steps": [
      {
        "kind": "action",
        "operation": "heatmap.clusterRowsCols"
      },
      {
        "kind": "action",
        "operation": "heatmap.highlightRegion"
      },
      {
        "kind": "perception",
        "operation": "perception.findOutliers"
      }
    ],
    "id": "WF-1V-CLUSTERED-BLOCK-INTERPRETATION-04",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "heatmap"
    ]
  },
  {
    "name": "adjust_color_then_cluster_then_filter_region",
    "slug": "heatmap.adjust_color_then_cluster_then_filter_region",
    "semanticName": "Noisy matrix simplification",
    "scenarioExamples": [
      "After improving contrast, which clustered crime-pattern block explains the strongest district-month anomaly?",
      "Which clustered health-measure block remains extreme after the heatmap is recolored?"
    ],
    "description": "Use when the heatmap needs stronger contrast before clustering and selecting the resulting local block.",
    "steps": [
      {
        "kind": "action",
        "operation": "heatmap.adjustColorScale"
      },
      {
        "kind": "action",
        "operation": "heatmap.clusterRowsCols"
      },
      {
        "kind": "action",
        "operation": "heatmap.filterCellsByRegion"
      },
      {
        "kind": "perception",
        "operation": "perception.findExtremes"
      }
    ],
    "id": "WF-1V-NOISY-MATRIX-SIMPLIFICATION-05",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "heatmap"
    ]
  },
  {
    "name": "change_view_then_filter_region",
    "slug": "heatmap.change_view_then_filter_region",
    "semanticName": "Reoriented matrix comparison",
    "scenarioExamples": [
      "After transposing the heatmap, which month has the lowest mean price for Cortado?",
      "When rows and columns are swapped, which category block becomes the clearest target for comparison?"
    ],
    "description": "Use when the current heatmap orientation or encoding hides the region needed for the question.",
    "steps": [
      {
        "kind": "action",
        "operation": "heatmap.transpose"
      },
      {
        "kind": "action",
        "operation": "heatmap.filterCellsByRegion"
      },
      {
        "kind": "perception",
        "operation": "perception.findExtremes"
      }
    ],
    "id": "WF-1V-REORIENTED-MATRIX-COMPARISON-06",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "heatmap"
    ]
  }
]),
  line: Object.freeze([
  {
    "name": "zoom_then_filter_series",
    "slug": "line.zoom_then_filter_series",
    "semanticName": "Time-windowed entity comparison",
    "scenarioExamples": [
      "During the selected period, which product category had the highest revenue?",
      "In the recent downturn window, which country contributed the most to the observed change?"
    ],
    "description": "Use when the comparison is limited to a time interval and only a subset of series matters.",
    "steps": [
      {
        "kind": "action",
        "operation": "line.zoomXRegion"
      },
      {
        "kind": "action",
        "operation": "line.filterLines"
      },
      {
        "kind": "perception",
        "operation": "perception.compareGroups"
      }
    ],
    "id": "WF-1V-TIME-WINDOWED-ENTITY-COMPARISON-01",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "line"
    ]
  },
  {
    "name": "filter_series_then_zoom",
    "slug": "line.filter_series_then_zoom",
    "semanticName": "Focused series inspection",
    "scenarioExamples": [
      "For New Zealand among the selected countries, which year has the highest contribution value?",
      "For two chosen stock tickers, how do their prices behave during the crash period?"
    ],
    "description": "Use when the target series are known first and the question asks about their behavior in a time window.",
    "steps": [
      {
        "kind": "action",
        "operation": "line.filterLines"
      },
      {
        "kind": "action",
        "operation": "line.zoomXRegion"
      },
      {
        "kind": "perception",
        "operation": "perception.compareGroups"
      }
    ],
    "id": "WF-1V-FOCUSED-SERIES-INSPECTION-02",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "line"
    ]
  },
  {
    "name": "compare_time_granularities",
    "slug": "line.compare_time_granularities",
    "semanticName": "Temporal granularity comparison",
    "scenarioExamples": [
      "Do monthly, quarterly, and annual visitor trends tell the same story?",
      "Does stock volatility remain visible after resampling daily prices to monthly averages?"
    ],
    "description": "Use when the task asks how monthly, quarterly, annual, or other resampled trends differ.",
    "steps": [
      {
        "kind": "action",
        "operation": "line.resampleXAxis"
      },
      {
        "kind": "action",
        "operation": "line.resampleXAxis"
      },
      {
        "kind": "perception",
        "operation": "perception.compareGroups"
      }
    ],
    "id": "WF-1V-TEMPORAL-GRANULARITY-COMPARISON-03",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "line"
    ]
  },
  {
    "name": "zoom_then_smooth",
    "slug": "line.zoom_then_smooth",
    "semanticName": "Smoothed local trend reading",
    "scenarioExamples": [
      "In the latter half of the time series, what is the lowest point of the smoothed visitor trend?",
      "During the unstable usage period, does the moving average show a real decline or just noise?"
    ],
    "description": "Use when a local peak, dip, or noisy interval needs a smoothed reading.",
    "steps": [
      {
        "kind": "action",
        "operation": "line.zoomXRegion"
      },
      {
        "kind": "action",
        "operation": "line.showMovingAverage"
      },
      {
        "kind": "perception",
        "operation": "perception.findExtremes"
      }
    ],
    "id": "WF-1V-SMOOTHED-LOCAL-TREND-READING-04",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "line"
    ]
  },
  {
    "name": "smooth_then_highlight_trend",
    "slug": "line.smooth_then_highlight_trend",
    "semanticName": "Noise-reduced trend direction",
    "scenarioExamples": [
      "After smoothing electricity access over time, does the trend mainly increase or plateau?",
      "Once short-term volatility is reduced, which segment shows a sustained decline?"
    ],
    "description": "Use when the task asks for trend direction after reducing short-term noise.",
    "steps": [
      {
        "kind": "action",
        "operation": "line.showMovingAverage"
      },
      {
        "kind": "action",
        "operation": "line.highlightTrend"
      },
      {
        "kind": "perception",
        "operation": "perception.compareGroups"
      }
    ],
    "id": "WF-1V-NOISE-REDUCED-TREND-DIRECTION-05",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "line"
    ]
  },
  {
    "name": "detect_anomalies_then_resample",
    "slug": "line.detect_anomalies_then_resample",
    "semanticName": "Anomaly stability across time scales",
    "scenarioExamples": [
      "Are unusual stock-price movements still visible after comparing daily and monthly views?",
      "Do visitor spikes remain meaningful when the series is aggregated from months to years?"
    ],
    "description": "Use when unusual events should be checked against a coarser or finer time grain.",
    "steps": [
      {
        "kind": "perception",
        "operation": "perception.detectAnomalies"
      },
      {
        "kind": "action",
        "operation": "line.resampleXAxis"
      },
      {
        "kind": "perception",
        "operation": "perception.compareGroups"
      }
    ],
    "id": "WF-1V-ANOMALY-STABILITY-ACROSS-TIME-SCALES-06",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "line"
    ]
  },
  {
    "name": "zoom_then_detect_anomalies",
    "slug": "line.zoom_then_detect_anomalies",
    "semanticName": "Interval-specific anomaly search",
    "scenarioExamples": [
      "Within the high AI-usage window, are there unusual jumps in bug count?",
      "During the selected sales campaign period, which weeks are anomalous?"
    ],
    "description": "Use when anomaly detection should be restricted to one relevant interval.",
    "steps": [
      {
        "kind": "action",
        "operation": "line.zoomXRegion"
      },
      {
        "kind": "perception",
        "operation": "perception.detectAnomalies"
      }
    ],
    "id": "WF-1V-INTERVAL-SPECIFIC-ANOMALY-SEARCH-07",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "line"
    ]
  }
]),
  parallelCoordinates: Object.freeze([
  {
    "name": "filter_category_then_reorder_dimensions",
    "slug": "parallelCoordinates.filter_category_then_reorder_dimensions",
    "semanticName": "Subgroup profile across reordered dimensions",
    "scenarioExamples": [
      "For one penguin species, how does beak depth relate to flipper length after placing those axes together?",
      "For the northwest insurance region, does BMI show a clear relationship with charges after reordering dimensions?"
    ],
    "description": "Use when the task asks how a category-defined subgroup relates across a few key dimensions.",
    "steps": [
      {
        "kind": "action",
        "operation": "parallelCoordinates.filterByCategory"
      },
      {
        "kind": "action",
        "operation": "parallelCoordinates.reorderDimensions"
      },
      {
        "kind": "perception",
        "operation": "perception.findOutliers"
      }
    ],
    "id": "WF-1V-SUBGROUP-PROFILE-ACROSS-REORDERED-DIMENSIONS-01",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "parallelCoordinates"
    ]
  },
  {
    "name": "filter_category_then_filter_category",
    "slug": "parallelCoordinates.filter_category_then_filter_category",
    "semanticName": "Multi-constraint cohort profiling",
    "scenarioExamples": [
      "How do Series A and Series C startup periods exhibit similar funding patterns after filtering each group?",
      "After narrowing to two retail channels, how do discount and final price patterns compare?"
    ],
    "description": "Use when several categorical constraints define the subgroup before reading the path pattern.",
    "steps": [
      {
        "kind": "action",
        "operation": "parallelCoordinates.filterByCategory"
      },
      {
        "kind": "action",
        "operation": "parallelCoordinates.filterByCategory"
      },
      {
        "kind": "perception",
        "operation": "perception.findOutliers"
      }
    ],
    "id": "WF-1V-MULTI-CONSTRAINT-COHORT-PROFILING-02",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "parallelCoordinates"
    ]
  },
  {
    "name": "hide_dimensions_then_filter_category",
    "slug": "parallelCoordinates.hide_dimensions_then_filter_category",
    "semanticName": "Low-clutter subgroup comparison",
    "scenarioExamples": [
      "After keeping only weight and calories axes, which workout type burns more calories at similar weights?",
      "After hiding unrelated axes, how do selected game genres distribute during platform development?"
    ],
    "description": "Use when only a few axes are relevant and the subgroup should be isolated after reducing visual clutter.",
    "steps": [
      {
        "kind": "action",
        "operation": "parallelCoordinates.hideDimensions"
      },
      {
        "kind": "action",
        "operation": "parallelCoordinates.filterByCategory"
      },
      {
        "kind": "perception",
        "operation": "perception.findOutliers"
      }
    ],
    "id": "WF-1V-LOW-CLUTTER-SUBGROUP-COMPARISON-03",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "parallelCoordinates"
    ]
  },
  {
    "name": "filter_category_then_hide_dimensions",
    "slug": "parallelCoordinates.filter_category_then_hide_dimensions",
    "semanticName": "Known subgroup profile simplification",
    "scenarioExamples": [
      "For chocolate-free candies, is there a clear relationship between sugar percent and win percent after irrelevant axes are hidden?",
      "For high-importance products, do discount and prior-purchase patterns remain visible after simplifying the axes?"
    ],
    "description": "Use when the subgroup is known first and then irrelevant axes should be removed to read its profile.",
    "steps": [
      {
        "kind": "action",
        "operation": "parallelCoordinates.filterByCategory"
      },
      {
        "kind": "action",
        "operation": "parallelCoordinates.hideDimensions"
      },
      {
        "kind": "perception",
        "operation": "perception.findOutliers"
      }
    ],
    "id": "WF-1V-KNOWN-SUBGROUP-PROFILE-SIMPLIFICATION-04",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "parallelCoordinates"
    ]
  },
  {
    "name": "highlight_category_then_reorder_dimensions",
    "slug": "parallelCoordinates.highlight_category_then_reorder_dimensions",
    "semanticName": "Highlighted category trajectory comparison",
    "scenarioExamples": [
      "After highlighting the AI-usage category, how does study hour impact appear across adjacent score dimensions?",
      "For highlighted candy categories, does sugar percent align with win percent after reordering axes?"
    ],
    "description": "Use when the task needs comparison of highlighted category paths after putting key axes next to each other.",
    "steps": [
      {
        "kind": "action",
        "operation": "parallelCoordinates.highlightCategory"
      },
      {
        "kind": "action",
        "operation": "parallelCoordinates.reorderDimensions"
      },
      {
        "kind": "perception",
        "operation": "perception.findOutliers"
      }
    ],
    "id": "WF-1V-HIGHLIGHTED-CATEGORY-TRAJECTORY-COMPARISON-05",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "parallelCoordinates"
    ]
  },
  {
    "name": "hide_dimensions_then_reorder_dimensions",
    "slug": "parallelCoordinates.hide_dimensions_then_reorder_dimensions",
    "semanticName": "Focused dimension relationship reading",
    "scenarioExamples": [
      "How does AI tool usage relate to code complexity compared with bug count after hiding unrelated dimensions?",
      "Do selected health measures move together once only the relevant axes are visible and adjacent?"
    ],
    "description": "Use when the task asks for relationship reading between specific axes and the full chart is too cluttered.",
    "steps": [
      {
        "kind": "action",
        "operation": "parallelCoordinates.hideDimensions"
      },
      {
        "kind": "action",
        "operation": "parallelCoordinates.reorderDimensions"
      },
      {
        "kind": "perception",
        "operation": "perception.findOutliers"
      }
    ],
    "id": "WF-1V-FOCUSED-DIMENSION-RELATIONSHIP-READING-06",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "parallelCoordinates"
    ]
  }
]),
  sankey: Object.freeze([
  {
    "name": "highlight_path_then_calculate_conversion",
    "slug": "sankey.highlight_path_then_calculate_conversion",
    "semanticName": "Path conversion analysis",
    "scenarioExamples": [
      "What is the conversion rate from medication to cured and discharged?",
      "Along the paid ads to purchase path, where does the funnel lose the most users?"
    ],
    "description": "Use when the task asks for conversion, survival, or drop-off along a specific flow path.",
    "steps": [
      {
        "kind": "action",
        "operation": "sankey.highlightPath"
      },
      {
        "kind": "perception",
        "operation": "perception.calculateConversionRate"
      }
    ],
    "id": "WF-1V-PATH-CONVERSION-ANALYSIS-01",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "sankey"
    ]
  },
  {
    "name": "filter_flow_then_trace_node",
    "slug": "sankey.filter_flow_then_trace_node",
    "semanticName": "High-volume path tracing",
    "scenarioExamples": [
      "After removing small flows, what is the largest downstream outcome for Engineering students?",
      "Which destinations dominate once low-volume supply-chain flows are filtered out?"
    ],
    "description": "Use when weak flows should be removed before tracing one node downstream or upstream.",
    "steps": [
      {
        "kind": "action",
        "operation": "sankey.filterFlow"
      },
      {
        "kind": "action",
        "operation": "sankey.traceNode"
      },
      {
        "kind": "perception",
        "operation": "perception.compareGroups"
      }
    ],
    "id": "WF-1V-HIGH-VOLUME-PATH-TRACING-02",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "sankey"
    ]
  },
  {
    "name": "calculate_conversion_then_highlight_path",
    "slug": "sankey.calculate_conversion_then_highlight_path",
    "semanticName": "Metric-guided path explanation",
    "scenarioExamples": [
      "Which treatment path deserves inspection after comparing conversion rates across discharge outcomes?",
      "After calculating conversion for each funnel node, which path should be highlighted to explain performance?"
    ],
    "description": "Use when the conversion metric identifies which path should be visually inspected.",
    "steps": [
      {
        "kind": "perception",
        "operation": "perception.calculateConversionRate"
      },
      {
        "kind": "action",
        "operation": "sankey.highlightPath"
      }
    ],
    "id": "WF-1V-METRIC-GUIDED-PATH-EXPLANATION-03",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "sankey"
    ]
  },
  {
    "name": "highlight_path_then_find_extremes",
    "slug": "sankey.highlight_path_then_find_extremes",
    "semanticName": "Extreme flow lookup in path context",
    "scenarioExamples": [
      "After highlighting the AAA loan path, how many loans transition from AAA Y2 to AAA Y3?",
      "Inside the selected funding path, which link carries the largest amount?"
    ],
    "description": "Use when the task asks for counts, largest links, or smallest links inside a selected path context.",
    "steps": [
      {
        "kind": "action",
        "operation": "sankey.highlightPath"
      },
      {
        "kind": "perception",
        "operation": "perception.findExtremes"
      }
    ],
    "id": "WF-1V-EXTREME-FLOW-LOOKUP-IN-PATH-CONTEXT-04",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "sankey"
    ]
  },
  {
    "name": "collapse_nodes_then_calculate_conversion",
    "slug": "sankey.collapse_nodes_then_calculate_conversion",
    "semanticName": "Aggregated conversion analysis",
    "scenarioExamples": [
      "After collapsing non-recycled product nodes, what is the conversion rate for recycled products?",
      "When low-level campaign channels are grouped, what percentage of users still purchase?"
    ],
    "description": "Use when node-level noise should be aggregated before reading conversion or loss.",
    "steps": [
      {
        "kind": "action",
        "operation": "sankey.collapseNodes"
      },
      {
        "kind": "perception",
        "operation": "perception.calculateConversionRate"
      }
    ],
    "id": "WF-1V-AGGREGATED-CONVERSION-ANALYSIS-05",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "sankey"
    ]
  },
  {
    "name": "highlight_path_then_collapse_nodes",
    "slug": "sankey.highlight_path_then_collapse_nodes",
    "semanticName": "Simplified path explanation",
    "scenarioExamples": [
      "After tracing renewables, collapse non-renewable nodes to explain the main energy-flow contrast.",
      "Highlight the operating-fund path, then group surrounding expense nodes to clarify where money flows."
    ],
    "description": "Use when a key path is known but surrounding non-key nodes need aggregation to reveal structure.",
    "steps": [
      {
        "kind": "action",
        "operation": "sankey.highlightPath"
      },
      {
        "kind": "action",
        "operation": "sankey.collapseNodes"
      },
      {
        "kind": "perception",
        "operation": "perception.compareGroups"
      }
    ],
    "id": "WF-1V-SIMPLIFIED-PATH-EXPLANATION-06",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "sankey"
    ]
  }
]),
  scatter: Object.freeze([
  {
    "name": "filter_then_compute_correlation",
    "slug": "scatter.filter_then_compute_correlation",
    "semanticName": "Subgroup relationship measurement",
    "scenarioExamples": [
      "Among non-US cars, is horsepower negatively correlated with miles per gallon?",
      "For one customer segment, does marketing spend still track visitor count?"
    ],
    "description": "Use when the relationship should be measured only within one category-defined subset.",
    "steps": [
      {
        "kind": "action",
        "operation": "scatter.filterCategorical"
      },
      {
        "kind": "perception",
        "operation": "perception.computeCorrelation"
      }
    ],
    "id": "WF-1V-SUBGROUP-RELATIONSHIP-MEASUREMENT-01",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "scatter"
    ]
  },
  {
    "name": "zoom_then_compute_local_correlation",
    "slug": "scatter.zoom_then_compute_local_correlation",
    "semanticName": "Local relationship measurement",
    "scenarioExamples": [
      "Inside the dense museum-visitor region, what is the Pearson correlation between the two visitor series?",
      "Within a high-score student region, how strongly do math and reading scores move together?"
    ],
    "description": "Use when the answer depends on correlation inside a dense or bounded local region.",
    "steps": [
      {
        "kind": "action",
        "operation": "scatter.zoomDomain"
      },
      {
        "kind": "perception",
        "operation": "perception.computeCorrelation"
      }
    ],
    "id": "WF-1V-LOCAL-RELATIONSHIP-MEASUREMENT-02",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "scatter"
    ]
  },
  {
    "name": "correlation_then_cluster",
    "slug": "scatter.correlation_then_cluster",
    "semanticName": "Relationship versus cluster structure",
    "scenarioExamples": [
      "Do the visible car clusters correspond to origin labels after checking the horsepower-mileage relationship?",
      "Do gym members separate into clusters after measuring the relation between session duration and calories?"
    ],
    "description": "Use when the task asks whether a numeric relationship also separates into visible groups.",
    "steps": [
      {
        "kind": "perception",
        "operation": "perception.computeCorrelation"
      },
      {
        "kind": "action",
        "operation": "scatter.identifyClusters"
      }
    ],
    "id": "WF-1V-RELATIONSHIP-VERSUS-CLUSTER-STRUCTURE-03",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "scatter"
    ]
  },
  {
    "name": "regression_then_correlation",
    "slug": "scatter.regression_then_correlation",
    "semanticName": "Regression-backed relationship explanation",
    "scenarioExamples": [
      "How strong is the relationship between price percent and win percent after showing a linear trend?",
      "Does distance from home meaningfully predict tenure after fitting the visible relationship?"
    ],
    "description": "Use when the task asks for relationship strength after adding a visible trend model.",
    "steps": [
      {
        "kind": "action",
        "operation": "scatter.showRegression"
      },
      {
        "kind": "perception",
        "operation": "perception.computeCorrelation"
      }
    ],
    "id": "WF-1V-REGRESSION-BACKED-RELATIONSHIP-EXPLANATION-04",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "scatter"
    ]
  },
  {
    "name": "filter_then_zoom_then_inspect_extremes",
    "slug": "scatter.filter_then_zoom_then_inspect_extremes",
    "semanticName": "Extreme case lookup in a local subgroup",
    "scenarioExamples": [
      "Among coffee drinks in the low-sugar low-calorie region, what is the minimum calories value?",
      "After keeping a workout type and zooming to a target duration range, which point has the highest calories burned?"
    ],
    "description": "Use when the target row or extreme value must be found inside a filtered local region.",
    "steps": [
      {
        "kind": "action",
        "operation": "scatter.filterCategorical"
      },
      {
        "kind": "action",
        "operation": "scatter.zoomDomain"
      },
      {
        "kind": "perception",
        "operation": "perception.findExtremes"
      }
    ],
    "id": "WF-1V-EXTREME-CASE-LOOKUP-IN-A-LOCAL-SUBGROUP-05",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "scatter"
    ]
  },
  {
    "name": "filter_then_brush_region",
    "slug": "scatter.filter_then_brush_region",
    "semanticName": "Cohort definition for follow-up comparison",
    "scenarioExamples": [
      "After removing European cars, compare Japanese and American cars inside the brushed horsepower window.",
      "Filter to a target customer group, then brush the high-spend high-visitor region for linked-view analysis."
    ],
    "description": "Use when a category-filtered scatter subset should define a local selection for closer comparison or linked views.",
    "steps": [
      {
        "kind": "action",
        "operation": "scatter.filterCategorical"
      },
      {
        "kind": "action",
        "operation": "scatter.brushRegion"
      }
    ],
    "id": "WF-1V-COHORT-DEFINITION-FOR-FOLLOW-UP-COMPARISON-06",
    "scope": "single_widget",
    "viewCount": 1,
    "families": [
      "scatter"
    ]
  }
]),
})

export const singleWidgetWorkflowList = Object.freeze(Object.values(singleWidgetWorkflows).flat())

export function listSingleWidgetWorkflows(family = null) {
  return family ? [...(singleWidgetWorkflows[family] || [])] : [...singleWidgetWorkflowList]
}

export const barWorkflows = singleWidgetWorkflows.bar
export const heatmapWorkflows = singleWidgetWorkflows.heatmap
export const lineWorkflows = singleWidgetWorkflows.line
export const parallelCoordinatesWorkflows = singleWidgetWorkflows.parallelCoordinates
export const sankeyWorkflows = singleWidgetWorkflows.sankey
export const scatterWorkflows = singleWidgetWorkflows.scatter

export default singleWidgetWorkflows

