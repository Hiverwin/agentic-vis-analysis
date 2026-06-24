import { describeLocalSelectionContract } from '../localSelectionContract.js'
import { describeWidgetVerificationContract } from '../verificationContract.js'

export { buildBarActionDescriptors, registerBarActions } from './actions.js'
export { buildBarPerceptionDescriptors, registerBarPerceptionQueries } from './perception.js'

export function describeBarWidgetContract() {
  return {
    kind: 'bar',
    actionNames: ['bar.selectCategory', 'bar.sortBars', 'bar.highlightTopN', 'bar.filterCategories', 'bar.addBars', 'bar.removeBars', 'bar.addBarItems', 'bar.removeBarItems', 'bar.filterSubcategories', 'bar.expandStack', 'bar.toggleStackMode'],
    perceptionNames: [
      'perception.compareGroups',
      'perception.findExtremes',
    ],
    localSelection: describeLocalSelectionContract('bar'),
    verification: describeWidgetVerificationContract('bar'),
  }
}
