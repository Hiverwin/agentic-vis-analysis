import { describeLocalSelectionContract } from '../localSelectionContract.js'
import { describeWidgetVerificationContract } from '../verificationContract.js'

export { buildParallelCoordinatesActionDescriptors, registerParallelCoordinatesActions } from './actions.js'
export { buildParallelCoordinatesPerceptionDescriptors, registerParallelCoordinatesPerceptionQueries } from './perception.js'

export function describeParallelCoordinatesWidgetContract() {
  return {
    kind: 'parallelCoordinates',
    actionNames: ['parallelCoordinates.brushAxes', 'parallelCoordinates.selectRecord', 'parallelCoordinates.reorderDimensions', 'parallelCoordinates.filterDimension', 'parallelCoordinates.filterByCategory', 'parallelCoordinates.highlightCategory', 'parallelCoordinates.hideDimensions', 'parallelCoordinates.resetHiddenDimensions'],
    perceptionNames: ['perception.findOutliers'],
    localSelection: describeLocalSelectionContract('parallelCoordinates'),
    verification: describeWidgetVerificationContract('parallelCoordinates'),
  }
}
