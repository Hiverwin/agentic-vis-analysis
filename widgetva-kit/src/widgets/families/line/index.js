import { cloneJsonValue as clone } from '../../../shared/clone.js'
import { getLineHumanInteractionConfig } from './interactionProfile.js'
import { buildLineActionDescriptors } from './actionDescriptors.js'
import { buildLinePerceptionDescriptors, registerLinePerceptionQueries } from './perception.js'

export { buildLineActionDescriptors } from './actionDescriptors.js'
export { buildLinePerceptionDescriptors, registerLinePerceptionQueries } from './perception.js'
export { getLineHumanInteractionConfig } from './interactionProfile.js'

const LINE_LOCAL_SELECTION_CONTRACT = Object.freeze({
  localSelectionFamily: 'category',
  selectionKinds: ['category', 'point'],
  sourceActionNames: ['line.selectSeries', 'line.selectXValue'],
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
    'selection-scoped perception queries should resolve the currently selected line series subset',
    'selection summaries should preserve the selected series identity for downstream comparison and anomaly checks',
  ],
})

const LINE_VERIFICATION_CONTRACT = Object.freeze({
  preferredReadMethod: 'readVerificationState',
  preferredObservationFields: [
    'verification.checks.selectionApplied',
    'verification.checks.filterApplied',
    'verification.checks.aggregateApplied',
    'verification.checks.drillDownApplied',
    'verification.checks.focusApplied',
    'verification.checks.navigateApplied',
    'verification.checks.zoomApplied',
    'verification.checks.highlightApplied',
    'verification.encodings.channels',
    'verification.view.aggregate',
    'verification.view.drillDown',
    'verification.view.focusKeys',
    'verification.view.reencode',
    'verification.view.navigate',
    'verification.view.highlight',
    'verification.transforms.kinds',
  ],
  supportedEffectTypes: ['selection', 'filter', 'aggregate', 'drillDown', 'focus', 'reencode', 'navigate', 'zoom', 'highlight', 'encoding', 'linkedPropagation'],
  effectChecks: {
    selection: ['checks.selectionApplied', 'selections.count', 'selections.activeSummary'],
    filter: ['checks.filterApplied', 'data.rowCount', 'data.visibleCount', 'transforms.kinds'],
    aggregate: ['checks.aggregateApplied', 'view.aggregate', 'encodings.aggregateChannels'],
    drillDown: ['checks.drillDownApplied', 'view.drillDown', 'transforms.kinds'],
    focus: ['checks.focusApplied', 'view.focusKeys'],
    reencode: ['checks.reencodeApplied', 'view.reencode', 'encodings.channels'],
    navigate: ['checks.navigateApplied', 'view.navigate'],
    zoom: ['checks.zoomApplied', 'view.xDomain', 'view.zoom'],
    highlight: ['checks.highlightApplied', 'view.highlight', 'feedback.highlightKeyCount', 'feedback.sharedSelectionSourceWidgetId'],
    encoding: ['checks.encodingReadable', 'encodings.channels', 'encodings.fieldsByChannel'],
    linkedPropagation: ['checks.linkedPropagationApplied', 'feedback.linkedSourceRefCount', 'feedback.sharedSelectionSourceWidgetId'],
  },
})

export function describeLineLocalSelectionContract() {
  return clone(LINE_LOCAL_SELECTION_CONTRACT)
}

export function describeLineVerificationContract() {
  return clone(LINE_VERIFICATION_CONTRACT)
}

export function describeLineWidgetContract() {
  return {
    kind: 'line',
    actionNames: ['line.selectSeries', 'line.selectXValue', 'line.zoomXRegion', 'line.focusLines', 'line.highlightTrend', 'line.showMovingAverage', 'line.drillDownXAxis', 'line.resetDrilldownXAxis', 'line.resampleXAxis', 'line.resetResampleXAxis', 'line.boldLines', 'line.filterLines'],
    perceptionNames: ['perception.detectAnomalies', 'perception.findExtremes', 'perception.compareGroups'],
    localSelection: describeLineLocalSelectionContract(),
    verification: describeLineVerificationContract(),
  }
}

export const lineFamily = Object.freeze({
  kind: 'line',
  describeContract: describeLineWidgetContract,
  actions: Object.freeze({
    buildDescriptors: buildLineActionDescriptors,
  }),
  perception: Object.freeze({
    buildDescriptors: buildLinePerceptionDescriptors,
    register: registerLinePerceptionQueries,
  }),
  interactionProfile: Object.freeze({
    getConfig: getLineHumanInteractionConfig,
  }),
})
