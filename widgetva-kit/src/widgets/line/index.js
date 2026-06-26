import { describeLocalSelectionContract } from '../localSelectionContract.js'
import { describeWidgetVerificationContract } from '../verificationContract.js'

export { buildLineActionDescriptors, registerLineActions } from './actions.js'
export { buildLinePerceptionDescriptors, registerLinePerceptionQueries } from './perception.js'

export function describeLineWidgetContract() {
  return {
    kind: 'line',
    actionNames: ['line.selectSeries', 'line.selectXValue', 'line.zoomXRegion', 'line.focusLines', 'line.highlightTrend', 'line.showMovingAverage', 'line.drillDownXAxis', 'line.resetDrilldownXAxis', 'line.resampleXAxis', 'line.resetResampleXAxis', 'line.boldLines', 'line.filterLines'],
    perceptionNames: ['perception.detectAnomalies', 'perception.findExtremes', 'perception.compareGroups'],
    localSelection: describeLocalSelectionContract('line'),
    verification: describeWidgetVerificationContract('line'),
  }
}
