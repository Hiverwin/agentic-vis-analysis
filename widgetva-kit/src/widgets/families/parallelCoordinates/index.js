import { cloneJsonValue as clone } from '../../../shared/clone.js'
import { getParallelCoordinatesHumanInteractionConfig } from './interactionProfile.js'
import { buildParallelCoordinatesActionDescriptors } from './actionDescriptors.js'
import { buildParallelCoordinatesPerceptionDescriptors, registerParallelCoordinatesPerceptionQueries } from './perception.js'

export { buildParallelCoordinatesActionDescriptors } from './actionDescriptors.js'
export { buildParallelCoordinatesPerceptionDescriptors, registerParallelCoordinatesPerceptionQueries } from './perception.js'
export { getParallelCoordinatesHumanInteractionConfig } from './interactionProfile.js'

const PARALLEL_COORDINATES_LOCAL_SELECTION_CONTRACT = Object.freeze({
  localSelectionFamily: 'record',
  selectionKinds: ['record', 'predicate'],
  sourceActionNames: ['parallelCoordinates.selectRecord', 'parallelCoordinates.selectCohort'],
  cardinality: 'singleActiveSelection',
  selectionValueShape: 'recordIdOrPredicateRules',
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
    'record-level or predicate selections should preserve the selected cohort for downstream focus and comparison',
  ],
})

const PARALLEL_COORDINATES_VERIFICATION_CONTRACT = Object.freeze({
  preferredReadMethod: 'readVerificationState',
  preferredObservationFields: [
    'verification.checks.selectionApplied',
    'verification.checks.filterApplied',
    'verification.checks.highlightApplied',
    'verification.checks.reencodeApplied',
    'verification.checks.focusApplied',
    'verification.selections.activeKinds',
    'verification.view.highlight',
    'verification.view.reencode',
    'verification.transforms.kinds',
  ],
  supportedEffectTypes: ['selection', 'filter', 'highlight', 'focus', 'reencode', 'encoding', 'linkedPropagation'],
  effectChecks: {
    selection: ['checks.selectionApplied', 'selections.count', 'selections.activeKinds', 'selections.activeSummary'],
    filter: ['checks.filterApplied', 'data.rowCount', 'data.visibleCount', 'transforms.kinds'],
    highlight: ['checks.highlightApplied', 'view.highlight', 'feedback.highlightKeyCount', 'feedback.sharedSelectionSourceWidgetId'],
    focus: ['checks.focusApplied', 'view.focusKeys'],
    reencode: ['checks.reencodeApplied', 'view.reencode', 'encodings.channels'],
    encoding: ['checks.encodingReadable', 'encodings.channels', 'encodings.fieldsByChannel'],
    linkedPropagation: ['checks.linkedPropagationApplied', 'feedback.linkedSourceRefCount', 'feedback.sharedSelectionSourceWidgetId'],
  },
})

export function describeParallelCoordinatesLocalSelectionContract() {
  return clone(PARALLEL_COORDINATES_LOCAL_SELECTION_CONTRACT)
}

export function describeParallelCoordinatesVerificationContract() {
  return clone(PARALLEL_COORDINATES_VERIFICATION_CONTRACT)
}

export function describeParallelCoordinatesWidgetContract() {
  return {
    kind: 'parallelCoordinates',
    actionNames: ['parallelCoordinates.selectRecord', 'parallelCoordinates.selectCohort', 'parallelCoordinates.reorderDimensions', 'parallelCoordinates.filterDimension', 'parallelCoordinates.filterByCategory', 'parallelCoordinates.highlightCategory', 'parallelCoordinates.hideDimensions', 'parallelCoordinates.resetHiddenDimensions'],
    perceptionNames: ['perception.findOutliers'],
    localSelection: describeParallelCoordinatesLocalSelectionContract(),
    verification: describeParallelCoordinatesVerificationContract(),
  }
}

export const parallelCoordinatesFamily = Object.freeze({
  kind: 'parallelCoordinates',
  describeContract: describeParallelCoordinatesWidgetContract,
  actions: Object.freeze({
    buildDescriptors: buildParallelCoordinatesActionDescriptors,
  }),
  perception: Object.freeze({
    buildDescriptors: buildParallelCoordinatesPerceptionDescriptors,
    register: registerParallelCoordinatesPerceptionQueries,
  }),
  interactionProfile: Object.freeze({
    getConfig: getParallelCoordinatesHumanInteractionConfig,
  }),
})
