import { getSankeyHumanInteractionConfig } from './interactionProfile.js'
import { buildSankeyActionDescriptors } from './actionDescriptors.js'
import { buildSankeyPerceptionDescriptors, registerSankeyPerceptionQueries } from './perception.js'

export { buildSankeyActionDescriptors } from './actionDescriptors.js'
export { buildSankeyPerceptionDescriptors, registerSankeyPerceptionQueries } from './perception.js'
export { getSankeyHumanInteractionConfig } from './interactionProfile.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

const SANKEY_LOCAL_SELECTION_CONTRACT = Object.freeze({
  localSelectionFamily: 'category',
  selectionKinds: ['category', 'aggregate'],
  sourceActionNames: ['sankey.focusFlow', 'sankey.selectAggregateNode'],
  cardinality: 'singleActiveSelection',
  selectionValueShape: 'nodeOrFlowCategoriesOrAggregateName',
  observationFields: [
    'state.selections',
    'coordination.localSelectionRefs',
    'coordination.widgetSelectionRef',
    'selection.activeSelectionRef',
    'selection.activeSelectionKind',
    'selection.activeSelectionSummary',
  ],
  perceptionExpectations: [
    'selection-scoped perception queries should resolve rows or flows matching the selected node/link categories',
    'selection summaries should preserve whether the active focus refers to flow or node categories',
    'aggregate selections should preserve aggregateName even when they do not map to row-level predicates',
  ],
})

const SANKEY_VERIFICATION_CONTRACT = Object.freeze({
  preferredReadMethod: 'readVerificationState',
  preferredObservationFields: [
    'verification.checks.selectionApplied',
    'verification.checks.filterApplied',
    'verification.checks.aggregateApplied',
    'verification.checks.reencodeApplied',
    'verification.checks.navigateApplied',
    'verification.checks.highlightApplied',
    'verification.checks.focusApplied',
    'verification.view.aggregate',
    'verification.view.reencode',
    'verification.view.navigate',
    'verification.view.highlight',
    'verification.transforms.kinds',
  ],
  supportedEffectTypes: ['selection', 'filter', 'aggregate', 'reencode', 'navigate', 'highlight', 'focus', 'encoding', 'linkedPropagation'],
  effectChecks: {
    selection: ['checks.selectionApplied', 'selections.count', 'selections.activeKinds', 'selections.activeSummary'],
    filter: ['checks.filterApplied', 'data.rowCount', 'data.visibleCount', 'transforms.kinds'],
    aggregate: ['checks.aggregateApplied', 'view.aggregate'],
    reencode: ['checks.reencodeApplied', 'view.reencode', 'encodings.channels'],
    navigate: ['checks.navigateApplied', 'view.navigate'],
    highlight: ['checks.highlightApplied', 'view.highlight', 'feedback.highlightKeyCount', 'feedback.sharedSelectionSourceWidgetId'],
    focus: ['checks.focusApplied', 'view.focusKeys'],
    encoding: ['checks.encodingReadable', 'encodings.channels', 'encodings.fieldsByChannel'],
    linkedPropagation: ['checks.linkedPropagationApplied', 'feedback.linkedSourceRefCount', 'feedback.sharedSelectionSourceWidgetId'],
  },
})

export function describeSankeyLocalSelectionContract() {
  return clone(SANKEY_LOCAL_SELECTION_CONTRACT)
}

export function describeSankeyVerificationContract() {
  return clone(SANKEY_VERIFICATION_CONTRACT)
}

export function describeSankeyWidgetContract() {
  return {
    kind: 'sankey',
    actionNames: ['sankey.focusFlow', 'sankey.selectAggregateNode', 'sankey.filterFlow', 'sankey.collapseNodes', 'sankey.expandNode', 'sankey.highlightPath', 'sankey.traceNode', 'sankey.colorFlows', 'sankey.reorderNodesInLayer', 'sankey.autoCollapseByRank'],
    perceptionNames: ['perception.getNodeOptions', 'perception.calculateConversionRate', 'perception.findBottleneck', 'perception.findExtremes', 'perception.compareGroups'],
    localSelection: describeSankeyLocalSelectionContract(),
    verification: describeSankeyVerificationContract(),
  }
}

export const sankeyFamily = Object.freeze({
  kind: 'sankey',
  describeContract: describeSankeyWidgetContract,
  actions: Object.freeze({
    buildDescriptors: buildSankeyActionDescriptors,
  }),
  perception: Object.freeze({
    buildDescriptors: buildSankeyPerceptionDescriptors,
    register: registerSankeyPerceptionQueries,
  }),
  interactionProfile: Object.freeze({
    getConfig: getSankeyHumanInteractionConfig,
  }),
})
