import { describeLocalSelectionContract } from '../localSelectionContract.js'
import { describeWidgetVerificationContract } from '../verificationContract.js'

export { buildSankeyActionDescriptors, registerSankeyActions } from './actions.js'
export { buildSankeyPerceptionDescriptors, registerSankeyPerceptionQueries } from './perception.js'

export function describeSankeyWidgetContract() {
  return {
    kind: 'sankey',
    actionNames: ['sankey.focusFlow', 'sankey.selectAggregateNode', 'sankey.filterFlow', 'sankey.collapseNodes', 'sankey.expandNode', 'sankey.highlightPath', 'sankey.traceNode', 'sankey.colorFlows', 'sankey.reorderNodesInLayer', 'sankey.autoCollapseByRank'],
    perceptionNames: ['perception.getNodeOptions', 'perception.calculateConversionRate', 'perception.findBottleneck', 'perception.findExtremes', 'perception.compareGroups'],
    localSelection: describeLocalSelectionContract('sankey'),
    verification: describeWidgetVerificationContract('sankey'),
  }
}
