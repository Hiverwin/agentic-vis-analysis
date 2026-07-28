export const analysisToAction = Object.freeze({
  bar: Object.freeze([
  {
    "id": "AT-1V-IDENTIFY-THE-MOST-OR-LEAST-IMPORTANT-CATEGORIES-01",
    "scope": "single_widget",
    "families": [
      "bar"
    ],
    "goal": "Identify the most or least important categories",
    "workflow": "If the goal is to find the highest, lowest, most popular, or least popular categories, first make rank order legible, then read the leading or trailing categories instead of scanning the full chart.",
    "candidateActions": [
      "bar.sortBars",
      "bar.highlightTopN",
      "bar.selectCategory"
    ],
    "candidatePerceptions": [
      "perception.compareGroups"
    ]
  },
  {
    "id": "AT-1V-EXPLAIN-CATEGORY-IMBALANCE-OR-OVERALL-DISTRIBUTION-SHAPE-02",
    "scope": "single_widget",
    "families": [
      "bar"
    ],
    "goal": "Explain category imbalance or overall distribution shape",
    "workflow": "If the goal is to explain whether the distribution is concentrated, long-tailed, or relatively even, first isolate the categories driving that pattern and then compare their contribution against the rest of the chart.",
    "candidateActions": [
      "bar.highlightTopN",
      "bar.filterCategories",
      "bar.filterSubcategories"
    ],
    "candidatePerceptions": [
      "perception.compareGroups"
    ]
  },
  {
    "id": "AT-1V-COMPARE-A-SMALL-SUBSET-OF-CATEGORIES-03",
    "scope": "single_widget",
    "families": [
      "bar"
    ],
    "goal": "Compare a small subset of categories",
    "workflow": "If the goal is to compare a few categories, isolate those categories first and compare their magnitudes and gaps directly rather than interpreting the full chart.",
    "candidateActions": [
      "bar.selectCategory",
      "bar.filterCategories",
      "bar.clickCategory"
    ],
    "candidatePerceptions": [
      "perception.compareGroups"
    ]
  },
  {
    "id": "AT-1V-COMPARE-GROUPED-SUBSETS-MORE-CLEARLY-04",
    "scope": "single_widget",
    "families": [
      "bar"
    ],
    "goal": "Compare grouped subsets more clearly",
    "workflow": "If the goal is to compare how one variable differs across grouped subsets, reorder the bars to make cross-group contrast easier to scan before drawing conclusions.",
    "candidateActions": [
      "bar.sortBars",
      "bar.filterCategories",
      "bar.toggleStackMode",
      "bar.expandStack"
    ],
    "candidatePerceptions": [
      "perception.compareGroups"
    ]
  }
]),
  heatmap: Object.freeze([
  {
    "id": "AT-1V-FIND-HOTSPOTS-OR-COLDSPOTS-05",
    "scope": "single_widget",
    "families": [
      "heatmap"
    ],
    "goal": "Find hotspots or coldspots",
    "workflow": "If the goal is to identify hotspots, coldspots, or strong concentration, first locate the most intense and weakest regions, then interpret them in row and column context.",
    "candidateActions": [
      "heatmap.highlightRegion",
      "heatmap.highlightRegionByValue",
      "heatmap.selectSubmatrix",
      "heatmap.selectCell"
    ],
    "candidatePerceptions": [
      "perception.findExtremes",
      "perception.findOutliers"
    ]
  },
  {
    "id": "AT-1V-UNDERSTAND-INTERACTION-BETWEEN-TWO-DIMENSIONS-06",
    "scope": "single_widget",
    "families": [
      "heatmap"
    ],
    "goal": "Understand interaction between two dimensions",
    "workflow": "If the goal is to understand the x-y relationship, look for blocks, bands, or gradients rather than isolated cells, then inspect the most informative local structure.",
    "candidateActions": [
      "heatmap.selectSubmatrix",
      "heatmap.drilldownAxis",
      "heatmap.transpose"
    ],
    "candidatePerceptions": [
      "perception.findExtremes",
      "perception.findOutliers"
    ]
  },
  {
    "id": "AT-1V-EXPLAIN-AN-ANOMALOUS-LOCAL-REGION-07",
    "scope": "single_widget",
    "families": [
      "heatmap"
    ],
    "goal": "Explain an anomalous local region",
    "workflow": "If the goal is to explain an anomalous cell or local block, compare the selected region against its neighborhood to determine whether the pattern is isolated or structural.",
    "candidateActions": [
      "heatmap.selectSubmatrix",
      "heatmap.selectCell",
      "heatmap.highlightRegion"
    ],
    "candidatePerceptions": [
      "perception.findOutliers",
      "perception.findExtremes"
    ]
  },
  {
    "id": "AT-1V-FOCUS-ATTENTION-ON-LOCAL-ROWS-COLUMNS-OR-A-SUBMATRIX-08",
    "scope": "single_widget",
    "families": [
      "heatmap"
    ],
    "goal": "Focus attention on local rows, columns, or a submatrix",
    "workflow": "If the goal is to inspect local structure more clearly, highlight or isolate the relevant rows, columns, or submatrix before interpreting the pattern.",
    "candidateActions": [
      "heatmap.selectSubmatrix",
      "heatmap.highlightRegion",
      "heatmap.filterCellsByRegion"
    ],
    "candidatePerceptions": [
      "perception.findExtremes"
    ]
  },
  {
    "id": "AT-1V-MAKE-THE-X-Y-RELATIONSHIP-VISUALLY-EASIER-TO-READ-09",
    "scope": "single_widget",
    "families": [
      "heatmap"
    ],
    "goal": "Make the x-y relationship visually easier to read",
    "workflow": "If the current encoding hides the relationship, switch to a more contrastive color scheme or add a complementary encoding that makes relative magnitude easier to compare.",
    "candidateActions": [
      "heatmap.adjustColorScale",
      "heatmap.addMarginalBars",
      "heatmap.transpose",
      "heatmap.clusterRowsCols"
    ],
    "candidatePerceptions": [
      "perception.findExtremes"
    ]
  }
]),
  line: Object.freeze([
  {
    "id": "AT-1V-UNDERSTAND-OVERALL-TREND-SHAPE-10",
    "scope": "single_widget",
    "families": [
      "line"
    ],
    "goal": "Understand overall trend shape",
    "workflow": "If the goal is to understand trend shape, first identify major phases such as rise, decline, plateau, or volatility, then zoom into the phase most relevant to the query.",
    "candidateActions": [
      "line.zoomXRegion",
      "line.selectXValue"
    ],
    "candidatePerceptions": [
      "perception.findExtremes",
      "perception.compareGroups",
      "perception.detectAnomalies"
    ]
  },
  {
    "id": "AT-1V-EXPLAIN-A-LOCAL-PEAK-DIP-OR-ABRUPT-CHANGE-11",
    "scope": "single_widget",
    "families": [
      "line"
    ],
    "goal": "Explain a local peak, dip, or abrupt change",
    "workflow": "If the goal is to explain a peak, dip, or structural break, first locate the turning region, then narrow to that interval and inspect it at higher resolution.",
    "candidateActions": [
      "line.zoomXRegion",
      "line.selectXValue",
      "line.highlightTrend"
    ],
    "candidatePerceptions": [
      "perception.findExtremes",
      "perception.detectAnomalies"
    ]
  },
  {
    "id": "AT-1V-COMPARE-TEMPORAL-PATTERNS-AT-DIFFERENT-GRANULARITIES-12",
    "scope": "single_widget",
    "families": [
      "line"
    ],
    "goal": "Compare temporal patterns at different granularities",
    "workflow": "If the goal is to compare annual, quarterly, monthly, or weekly behavior, resample the series to the relevant temporal grain and compare how the pattern changes across scales.",
    "candidateActions": [
      "line.resampleXAxis",
      "line.resetResampleXAxis"
    ],
    "candidatePerceptions": [
      "perception.compareGroups",
      "perception.findExtremes"
    ]
  },
  {
    "id": "AT-1V-FOCUS-ON-ONLY-A-SUBSET-OF-LINES-IN-A-MULTI-LINE-CHART-13",
    "scope": "single_widget",
    "families": [
      "line"
    ],
    "goal": "Focus on only a subset of lines in a multi-line chart",
    "workflow": "If the chart contains multiple lines but the query concerns only a subset, suppress irrelevant series and analyze the selected lines more clearly.",
    "candidateActions": [
      "line.filterLines",
      "line.boldLines",
      "line.focusLines",
      "line.selectSeries"
    ],
    "candidatePerceptions": [
      "perception.compareGroups",
      "perception.detectAnomalies"
    ]
  },
  {
    "id": "AT-1V-COMPARE-DIFFERENT-TIME-WINDOWS-14",
    "scope": "single_widget",
    "families": [
      "line"
    ],
    "goal": "Compare different time windows",
    "workflow": "If the goal is to compare periods, define meaningful intervals first and compare their level, slope, and variability rather than relying only on endpoints.",
    "candidateActions": [
      "line.zoomXRegion",
      "line.selectXValue",
      "line.drillDownXAxis"
    ],
    "candidatePerceptions": [
      "perception.compareGroups",
      "perception.findExtremes"
    ]
  }
]),
  parallelCoordinates: Object.freeze([
  {
    "id": "AT-1V-IDENTIFY-A-COHERENT-SUBGROUP-15",
    "scope": "single_widget",
    "families": [
      "parallelCoordinates"
    ],
    "goal": "Identify a coherent subgroup",
    "workflow": "If the goal is to identify a subgroup with a shared multi-dimensional profile, first find a subset through dimension or category filtering, then inspect it across dimensions.",
    "candidateActions": [
      "parallelCoordinates.filterDimension",
      "parallelCoordinates.filterByCategory",
      "parallelCoordinates.selectRecord"
    ],
    "candidatePerceptions": [
      "perception.findOutliers"
    ]
  },
  {
    "id": "AT-1V-DETECT-ANOMALOUS-PROFILES-16",
    "scope": "single_widget",
    "families": [
      "parallelCoordinates"
    ],
    "goal": "Detect anomalous profiles",
    "workflow": "If the goal is to find unusual records, isolate lines that diverge sharply from the dominant bundles and compare them against the main population.",
    "candidateActions": [
      "parallelCoordinates.selectRecord",
      "parallelCoordinates.filterDimension"
    ],
    "candidatePerceptions": [
      "perception.findOutliers"
    ]
  },
  {
    "id": "AT-1V-ANALYZE-BEHAVIOR-BY-CATEGORY-17",
    "scope": "single_widget",
    "families": [
      "parallelCoordinates"
    ],
    "goal": "Analyze behavior by category",
    "workflow": "If the goal is to analyze a category-defined subgroup, filter or highlight the relevant categories first, then inspect how their paths move across axes.",
    "candidateActions": [
      "parallelCoordinates.filterByCategory",
      "parallelCoordinates.highlightCategory"
    ],
    "candidatePerceptions": [
      "perception.findOutliers"
    ]
  },
  {
    "id": "AT-1V-INSPECT-THE-RELATIONSHIP-BETWEEN-SPECIFIC-AXES-18",
    "scope": "single_widget",
    "families": [
      "parallelCoordinates"
    ],
    "goal": "Inspect the relationship between specific axes",
    "workflow": "If the goal is to inspect the relationship between two dimensions, bring those axes next to each other and reduce clutter from unrelated axes before interpreting crossings or separation.",
    "candidateActions": [
      "parallelCoordinates.reorderDimensions",
      "parallelCoordinates.hideDimensions",
      "parallelCoordinates.resetHiddenDimensions"
    ],
    "candidatePerceptions": [
      "perception.findOutliers"
    ]
  },
  {
    "id": "AT-1V-DEFINE-A-SUBGROUP-THROUGH-MULTI-AXIS-CONSTRAINTS-19",
    "scope": "single_widget",
    "families": [
      "parallelCoordinates"
    ],
    "goal": "Define a subgroup through multi-axis constraints",
    "workflow": "If the goal is to understand a subgroup defined by several constraints, constrain one or more decisive axes first, then inspect how the surviving subset behaves on the remaining dimensions.",
    "candidateActions": [
      "parallelCoordinates.filterDimension"
    ],
    "candidatePerceptions": [
      "perception.findOutliers"
    ]
  }
]),
  sankey: Object.freeze([
  {
    "id": "AT-1V-UNDERSTAND-THE-MAIN-FLOW-STRUCTURE-20",
    "scope": "single_widget",
    "families": [
      "sankey"
    ],
    "goal": "Understand the main flow structure",
    "workflow": "If the goal is to understand the major structure of the flow graph, first identify dominant paths and bottleneck nodes, then focus on the branches carrying the most informative volume.",
    "candidateActions": [
      "sankey.focusFlow",
      "sankey.highlightPath",
      "sankey.traceNode"
    ],
    "candidatePerceptions": [
      "perception.findBottleneck",
      "perception.findExtremes",
      "perception.compareGroups"
    ]
  },
  {
    "id": "AT-1V-EXPLAIN-WHERE-ONE-SOURCE-ENDS-UP-21",
    "scope": "single_widget",
    "families": [
      "sankey"
    ],
    "goal": "Explain where one source ends up",
    "workflow": "If the goal is to trace one source downstream, isolate that source first and follow how its flow splits across later stages.",
    "candidateActions": [
      "sankey.selectAggregateNode",
      "sankey.focusFlow",
      "sankey.traceNode"
    ],
    "candidatePerceptions": [
      "perception.compareGroups",
      "perception.findExtremes"
    ]
  },
  {
    "id": "AT-1V-COMPARE-TWO-BRANCHES-OR-DESTINATIONS-22",
    "scope": "single_widget",
    "families": [
      "sankey"
    ],
    "goal": "Compare two branches or destinations",
    "workflow": "If the goal is to compare two flow branches, compare their path width, intermediates, and concentration patterns rather than relying only on endpoints.",
    "candidateActions": [
      "sankey.highlightPath",
      "sankey.filterFlow",
      "sankey.reorderNodesInLayer"
    ],
    "candidatePerceptions": [
      "perception.compareGroups",
      "perception.findExtremes"
    ]
  },
  {
    "id": "AT-1V-INSPECT-ONE-NODE-AND-ITS-SURROUNDING-FLOWS-23",
    "scope": "single_widget",
    "families": [
      "sankey"
    ],
    "goal": "Inspect one node and its surrounding flows",
    "workflow": "If the goal is to understand one node, focus that node and trace all incoming and outgoing flows attached to it before comparing which directions dominate.",
    "candidateActions": [
      "sankey.selectAggregateNode",
      "sankey.traceNode",
      "sankey.focusFlow"
    ],
    "candidatePerceptions": [
      "perception.getNodeOptions",
      "perception.findExtremes",
      "perception.compareGroups"
    ]
  },
  {
    "id": "AT-1V-ANALYZE-CONVERSION-OR-DROP-OFF-24",
    "scope": "single_widget",
    "families": [
      "sankey"
    ],
    "goal": "Analyze conversion or drop-off",
    "workflow": "If the goal is to understand conversion efficiency or loss, trace the relevant path and quantify how much flow survives across stages.",
    "candidateActions": [
      "sankey.highlightPath",
      "sankey.filterFlow",
      "sankey.focusFlow"
    ],
    "candidatePerceptions": [
      "perception.calculateConversionRate",
      "perception.findBottleneck"
    ]
  },
  {
    "id": "AT-1V-REDUCE-CLUTTER-OR-REVEAL-HIDDEN-STRUCTURE-25",
    "scope": "single_widget",
    "families": [
      "sankey"
    ],
    "goal": "Reduce clutter or reveal hidden structure",
    "workflow": "If the layout is too cluttered or too coarse for the query, simplify or expand the node structure first, then re-read the main branches after the structure becomes more interpretable.",
    "candidateActions": [
      "sankey.collapseNodes",
      "sankey.expandNode",
      "sankey.autoCollapseByRank",
      "sankey.filterFlow"
    ],
    "candidatePerceptions": [
      "perception.findBottleneck",
      "perception.findExtremes"
    ]
  }
]),
  scatter: Object.freeze([
  {
    "id": "AT-1V-JUDGE-THE-RELATIONSHIP-BETWEEN-TWO-VARIABLES-26",
    "scope": "single_widget",
    "families": [
      "scatter"
    ],
    "goal": "Judge the relationship between two variables",
    "workflow": "If the goal is to understand how x and y relate, first assess direction, spread, and rough linearity visually, then use correlation or regression only if the visible pattern supports it.",
    "candidateActions": [
      "scatter.showRegression"
    ],
    "candidatePerceptions": [
      "perception.computeCorrelation",
      "perception.findExtremes"
    ]
  },
  {
    "id": "AT-1V-INVESTIGATE-A-LOCAL-CLUSTER-OR-NEIGHBORHOOD-27",
    "scope": "single_widget",
    "families": [
      "scatter"
    ],
    "goal": "Investigate a local cluster or neighborhood",
    "workflow": "If the goal is to understand a local cluster, region, or neighborhood, first brush or zoom into that area, then analyze local spread, density, or structure.",
    "candidateActions": [
      "scatter.brushRegion",
      "scatter.zoomDomain",
      "scatter.identifyClusters",
      "scatter.showRegression"
    ],
    "candidatePerceptions": [
      "perception.computeCorrelation",
      "perception.findOutliers",
      "perception.findExtremes"
    ]
  },
  {
    "id": "AT-1V-FIND-OUTLIERS-OR-RARE-CASES-28",
    "scope": "single_widget",
    "families": [
      "scatter"
    ],
    "goal": "Find outliers or rare cases",
    "workflow": "If the goal is to detect outliers or unusual regions, isolate sparse or boundary points first, then compare them against the main cloud.",
    "candidateActions": [
      "scatter.brushRegion",
      "scatter.zoomDomain"
    ],
    "candidatePerceptions": [
      "perception.findOutliers",
      "perception.findExtremes"
    ]
  },
  {
    "id": "AT-1V-EXPLAIN-HOW-A-SELECTED-REGION-AFFECTS-ANOTHER-LINKED-VIEW-29",
    "scope": "single_widget",
    "families": [
      "scatter"
    ],
    "goal": "Explain how a selected region affects another linked view",
    "workflow": "If the goal is to interpret another view through the scatterplot, first define a meaningful region in the scatterplot, then inspect how the linked view changes for that subset.",
    "candidateActions": [
      "scatter.brushRegion",
      "scatter.zoomDomain"
    ],
    "candidatePerceptions": [
      "perception.computeCorrelation"
    ]
  }
]),
})

export const analysisToActionList = Object.freeze(Object.values(analysisToAction).flat())

export function listAnalysisToAction(family = null) {
  return family ? [...(analysisToAction[family] || [])] : [...analysisToActionList]
}

export function getAnalysisToAction(id) {
  if (typeof id !== 'string' || !id) return null
  return analysisToActionList.find((entry) => entry.id === id) || null
}

export const barAnalysisToAction = analysisToAction.bar
export const heatmapAnalysisToAction = analysisToAction.heatmap
export const lineAnalysisToAction = analysisToAction.line
export const parallelCoordinatesAnalysisToAction = analysisToAction.parallelCoordinates
export const sankeyAnalysisToAction = analysisToAction.sankey
export const scatterAnalysisToAction = analysisToAction.scatter

export default analysisToAction

