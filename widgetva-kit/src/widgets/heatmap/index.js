import { describeLocalSelectionContract } from '../localSelectionContract.js'
import { describeWidgetVerificationContract } from '../verificationContract.js'

export { buildHeatmapActionDescriptors, registerHeatmapActions } from './actions.js'
export { buildHeatmapPerceptionDescriptors, registerHeatmapPerceptionQueries } from './perception.js'

export function describeHeatmapWidgetContract() {
  return {
    kind: 'heatmap',
    actionNames: ['heatmap.filterCells', 'heatmap.selectCell', 'heatmap.selectSubmatrix', 'heatmap.drilldownAxis', 'heatmap.resetDrilldown', 'heatmap.addMarginalBars', 'heatmap.highlightRegion', 'heatmap.adjustColorScale', 'heatmap.thresholdMask', 'heatmap.filterCellsByRegion', 'heatmap.highlightRegionByValue', 'heatmap.clusterRowsCols', 'heatmap.transpose'],
    perceptionNames: ['perception.findExtremes', 'perception.findOutliers'],
    localSelection: describeLocalSelectionContract('heatmap'),
    verification: describeWidgetVerificationContract('heatmap'),
  }
}
