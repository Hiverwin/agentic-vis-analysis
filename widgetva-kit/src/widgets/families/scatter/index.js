import { cloneJsonValue as clone } from '../../../shared/clone.js'
import { getScatterHumanInteractionConfig } from './interactionProfile.js'
import { buildScatterActionDescriptors } from './actionDescriptors.js'
import { buildScatterPerceptionDescriptors, registerScatterPerceptionQueries } from './perception.js'

export { buildScatterActionDescriptors } from './actionDescriptors.js'
export { buildScatterPerceptionDescriptors, registerScatterPerceptionQueries } from './perception.js'
export { getScatterHumanInteractionConfig } from './interactionProfile.js'

const SCATTER_LOCAL_SELECTION_CONTRACT = Object.freeze({
  localSelectionFamily: 'interval',
  selectionKinds: ['interval'],
  sourceActionNames: ['scatter.brushRegion', 'scatter.selectRegion'],
  cardinality: 'singleActiveSelection',
  selectionValueShape: 'xAndYIntervals',
  observationFields: [
    'state.selections',
    'coordination.localSelectionRefs',
    'coordination.widgetSelectionRef',
    'selection.activeSelectionRef',
    'selection.activeSelectionKind',
    'selection.activeSelectionSummary',
    'selection.activeSelectionFields',
  ],
  perceptionExpectations: [
    'selection-scoped perception queries should resolve rows inside the brushed x/y interval',
    'selection summaries should expose interval predicates rather than only selected row ids',
  ],
})

const SCATTER_VERIFICATION_CONTRACT = Object.freeze({
  preferredReadMethod: 'readVerificationState',
  preferredObservationFields: [
    'verification.checks.selectionApplied',
    'verification.checks.filterApplied',
    'verification.checks.reencodeApplied',
    'verification.checks.zoomApplied',
    'verification.encodings.channels',
    'verification.view.reencode',
    'verification.selections.activeKinds',
  ],
  supportedEffectTypes: ['selection', 'filter', 'zoom', 'highlight', 'reencode', 'encoding', 'linkedPropagation'],
  effectChecks: {
    selection: ['checks.selectionApplied', 'selections.count', 'selections.activeKinds', 'selections.activeSummary'],
    filter: ['checks.filterApplied', 'data.rowCount', 'data.visibleCount', 'transforms.kinds'],
    zoom: ['checks.zoomApplied', 'view.xDomain', 'view.yDomain', 'view.zoom'],
    reencode: ['checks.reencodeApplied', 'view.reencode', 'encodings.channels'],
    highlight: ['checks.highlightApplied', 'feedback.highlightKeyCount', 'feedback.sharedSelectionSourceWidgetId'],
    encoding: ['checks.encodingReadable', 'encodings.channels', 'encodings.fieldsByChannel'],
    linkedPropagation: ['checks.linkedPropagationApplied', 'feedback.linkedSourceRefCount', 'feedback.sharedSelectionSourceWidgetId'],
  },
})

export function describeScatterLocalSelectionContract() {
  return clone(SCATTER_LOCAL_SELECTION_CONTRACT)
}

export function describeScatterVerificationContract() {
  return clone(SCATTER_VERIFICATION_CONTRACT)
}

export function describeScatterWidgetContract() {
  return {
    kind: 'scatter',
    actionNames: ['scatter.brushRegion', 'scatter.selectRegion', 'scatter.zoomDomain', 'scatter.filterCategorical', 'scatter.identifyClusters', 'scatter.showRegression'],
    perceptionNames: [
      'perception.computeCorrelation',
      'perception.findOutliers',
      'perception.findExtremes',
    ],
    localSelection: describeScatterLocalSelectionContract(),
    verification: describeScatterVerificationContract(),
  }
}

export const scatterFamily = Object.freeze({
  kind: 'scatter',
  describeContract: describeScatterWidgetContract,
  actions: Object.freeze({
    buildDescriptors: buildScatterActionDescriptors,
  }),
  perception: Object.freeze({
    buildDescriptors: buildScatterPerceptionDescriptors,
    register: registerScatterPerceptionQueries,
  }),
  interactionProfile: Object.freeze({
    getConfig: getScatterHumanInteractionConfig,
  }),
})
