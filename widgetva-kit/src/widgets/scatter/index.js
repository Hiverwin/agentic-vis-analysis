import { describeLocalSelectionContract } from '../localSelectionContract.js'
import { describeWidgetVerificationContract } from '../verificationContract.js'

export { buildScatterActionDescriptors, registerScatterActions } from './actions.js'
export { buildScatterPerceptionDescriptors, registerScatterPerceptionQueries } from './perception.js'

export function describeScatterWidgetContract() {
  return {
    kind: 'scatter',
    actionNames: ['scatter.brushRegion', 'scatter.zoomDomain', 'scatter.identifyClusters', 'scatter.showRegression'],
    perceptionNames: [
      'perception.computeCorrelation',
      'perception.findOutliers',
      'perception.findExtremes',
    ],
    localSelection: describeLocalSelectionContract('scatter'),
    verification: describeWidgetVerificationContract('scatter'),
  }
}
