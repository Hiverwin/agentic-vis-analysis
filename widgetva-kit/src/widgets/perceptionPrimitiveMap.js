import { describeBarWidgetContract } from './bar/index.js'
import { describeHeatmapWidgetContract } from './heatmap/index.js'
import { describeLineWidgetContract } from './line/index.js'
import { describeParallelCoordinatesWidgetContract } from './parallelCoordinates/index.js'
import { describeSankeyWidgetContract } from './sankey/index.js'
import { describeScatterWidgetContract } from './scatter/index.js'

export const WIDGET_PERCEPTION_PRIMITIVE_FAMILIES = [
  'inspect',
  'summarize',
  'compute',
  'verify',
]

export const WIDGET_PERCEPTION_PRIMITIVE_MAP = {
  'perception.getNodeOptions': 'inspect',
  'perception.findExtremes': 'summarize',
  'perception.compareGroups': 'summarize',
  'perception.computeCorrelation': 'compute',
  'perception.findOutliers': 'compute',
  'perception.detectAnomalies': 'compute',
  'perception.calculateConversionRate': 'compute',
  'perception.findBottleneck': 'compute',
}

const WIDGET_CONTRACT_DESCRIBERS = [
  describeBarWidgetContract,
  describeLineWidgetContract,
  describeScatterWidgetContract,
  describeHeatmapWidgetContract,
  describeParallelCoordinatesWidgetContract,
  describeSankeyWidgetContract,
]

export function listAllWidgetPerceptionNames() {
  return WIDGET_CONTRACT_DESCRIBERS.flatMap((describeContract) => describeContract().perceptionNames || [])
}

export function getWidgetPerceptionPrimitive(perceptionName) {
  return WIDGET_PERCEPTION_PRIMITIVE_MAP[perceptionName] || null
}

export function listUnmappedWidgetPerceptions() {
  return listAllWidgetPerceptionNames().filter((name) => !getWidgetPerceptionPrimitive(name))
}
