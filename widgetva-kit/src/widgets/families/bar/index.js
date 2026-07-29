import { cloneJsonValue as clone } from '../../../shared/clone.js'
import { getBarHumanInteractionConfig } from './interactionProfile.js'
import { buildBarActionDescriptors } from './actionDescriptors.js'
import { buildBarPerceptionDescriptors, registerBarPerceptionQueries } from './perception.js'

export { buildBarActionDescriptors } from './actionDescriptors.js'
export { buildBarPerceptionDescriptors, registerBarPerceptionQueries } from './perception.js'
export { getBarHumanInteractionConfig } from './interactionProfile.js'

const BAR_LOCAL_SELECTION_CONTRACT = Object.freeze({
  localSelectionFamily: 'category',
  selectionKinds: ['category'],
  sourceActionNames: ['bar.clickCategory', 'bar.selectCategory'],
  cardinality: 'singleActiveSelection',
  selectionValueShape: 'categoricalValues',
  observationFields: [
    'state.selections',
    'coordination.localSelectionRefs',
    'coordination.widgetSelectionRef',
    'selection.activeSelectionRef',
    'selection.activeSelectionKind',
    'selection.activeSelectionSummary',
  ],
  perceptionExpectations: [
    'selection-scoped perception queries should accept queryScope.selectionRef when a bar selection is active',
    'selection summaries should describe selected categorical groups rather than raw pixel regions',
  ],
})

const BAR_VERIFICATION_CONTRACT = Object.freeze({
  preferredReadMethod: 'readVerificationState',
  preferredObservationFields: [
    'verification.checks.selectionApplied',
    'verification.checks.filterApplied',
    'verification.checks.sortApplied',
    'verification.checks.reencodeApplied',
    'verification.checks.addRemoveApplied',
    'verification.checks.highlightApplied',
    'verification.encodings.channels',
    'verification.view.addRemove',
    'verification.view.reencode',
    'verification.view.sort',
    'verification.view.highlight',
    'verification.transforms.kinds',
  ],
  supportedEffectTypes: ['selection', 'filter', 'sort', 'reencode', 'addRemove', 'highlight', 'encoding', 'linkedPropagation'],
  effectChecks: {
    selection: ['checks.selectionApplied', 'selections.count', 'selections.activeSummary'],
    filter: ['checks.filterApplied', 'data.rowCount', 'data.visibleCount', 'transforms.kinds'],
    sort: ['checks.sortApplied', 'view.sort'],
    reencode: ['checks.reencodeApplied', 'view.reencode', 'encodings.channels'],
    addRemove: ['checks.addRemoveApplied', 'view.addRemove', 'data.visibleCount'],
    highlight: ['checks.highlightApplied', 'view.highlight', 'feedback.highlightKeyCount', 'feedback.sharedSelectionSourceWidgetId'],
    encoding: ['checks.encodingReadable', 'encodings.channels', 'encodings.fieldsByChannel'],
    linkedPropagation: ['checks.linkedPropagationApplied', 'feedback.linkedSourceRefCount', 'feedback.sharedSelectionSourceWidgetId'],
  },
})

export function describeBarLocalSelectionContract() {
  return clone(BAR_LOCAL_SELECTION_CONTRACT)
}

export function describeBarVerificationContract() {
  return clone(BAR_VERIFICATION_CONTRACT)
}

export function describeBarWidgetContract() {
  return {
    kind: 'bar',
    actionNames: ['bar.clickCategory', 'bar.selectCategory', 'bar.sortBars', 'bar.highlightTopN', 'bar.filterCategories', 'bar.addBars', 'bar.removeBars', 'bar.addBarItems', 'bar.removeBarItems', 'bar.filterSubcategories', 'bar.expandStack', 'bar.toggleStackMode'],
    perceptionNames: [
      'perception.compareGroups',
    ],
    localSelection: describeBarLocalSelectionContract(),
    verification: describeBarVerificationContract(),
  }
}

export const barFamily = Object.freeze({
  kind: 'bar',
  describeContract: describeBarWidgetContract,
  actions: Object.freeze({
    buildDescriptors: buildBarActionDescriptors,
  }),
  perception: Object.freeze({
    buildDescriptors: buildBarPerceptionDescriptors,
    register: registerBarPerceptionQueries,
  }),
  interactionProfile: Object.freeze({
    getConfig: getBarHumanInteractionConfig,
  }),
})
