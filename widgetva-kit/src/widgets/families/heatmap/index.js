import { getHeatmapHumanInteractionConfig } from './interactionProfile.js'
import { buildHeatmapActionDescriptors } from './actionDescriptors.js'
import { buildHeatmapPerceptionDescriptors, registerHeatmapPerceptionQueries } from './perception.js'

export { buildHeatmapActionDescriptors } from './actionDescriptors.js'
export { buildHeatmapPerceptionDescriptors, registerHeatmapPerceptionQueries } from './perception.js'
export { getHeatmapHumanInteractionConfig } from './interactionProfile.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

const HEATMAP_LOCAL_SELECTION_CONTRACT = Object.freeze({
  localSelectionFamily: 'cell',
  selectionKinds: ['cell', 'region'],
  sourceActionNames: ['heatmap.selectCell', 'heatmap.selectSubmatrix'],
  cardinality: 'singleActiveSelection',
  selectionValueShape: 'cellOrRegionCoordinates',
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
    'selection-scoped perception queries should resolve either one cell or a selected submatrix subset',
    'selection summaries should distinguish cell selections from broader row/column region selections',
  ],
})

const HEATMAP_VERIFICATION_CONTRACT = Object.freeze({
  preferredReadMethod: 'readVerificationState',
  preferredObservationFields: [
    'verification.checks.selectionApplied',
    'verification.checks.filterApplied',
    'verification.checks.aggregateApplied',
    'verification.checks.drillDownApplied',
    'verification.checks.reencodeApplied',
    'verification.checks.navigateApplied',
    'verification.checks.highlightApplied',
    'verification.encodings.channels',
    'verification.view.aggregate',
    'verification.view.drillDown',
    'verification.view.reencode',
    'verification.view.navigate',
    'verification.view.highlight',
    'verification.selections.activeKinds',
  ],
  supportedEffectTypes: ['selection', 'filter', 'aggregate', 'drillDown', 'reencode', 'navigate', 'highlight', 'encoding', 'linkedPropagation'],
  effectChecks: {
    selection: ['checks.selectionApplied', 'selections.count', 'selections.activeKinds', 'selections.activeSummary'],
    filter: ['checks.filterApplied', 'data.rowCount', 'data.visibleCount', 'transforms.kinds'],
    aggregate: ['checks.aggregateApplied', 'view.aggregate', 'view.sort'],
    drillDown: ['checks.drillDownApplied', 'view.drillDown', 'transforms.kinds'],
    reencode: ['checks.reencodeApplied', 'view.reencode', 'encodings.channels'],
    navigate: ['checks.navigateApplied', 'view.navigate'],
    highlight: ['checks.highlightApplied', 'view.highlight', 'feedback.highlightKeyCount', 'feedback.sharedSelectionSourceWidgetId'],
    encoding: ['checks.encodingReadable', 'encodings.channels', 'encodings.fieldsByChannel'],
    linkedPropagation: ['checks.linkedPropagationApplied', 'feedback.linkedSourceRefCount', 'feedback.sharedSelectionSourceWidgetId'],
  },
})

export function describeHeatmapLocalSelectionContract() {
  return clone(HEATMAP_LOCAL_SELECTION_CONTRACT)
}

export function describeHeatmapVerificationContract() {
  return clone(HEATMAP_VERIFICATION_CONTRACT)
}

export function describeHeatmapWidgetContract() {
  return {
    kind: 'heatmap',
    actionNames: ['heatmap.filterCells', 'heatmap.selectCell', 'heatmap.selectSubmatrix', 'heatmap.drilldownAxis', 'heatmap.resetDrilldown', 'heatmap.addMarginalBars', 'heatmap.highlightRegion', 'heatmap.adjustColorScale', 'heatmap.thresholdMask', 'heatmap.filterCellsByRegion', 'heatmap.highlightRegionByValue', 'heatmap.clusterRowsCols', 'heatmap.transpose'],
    perceptionNames: ['perception.findExtremes', 'perception.findOutliers'],
    localSelection: describeHeatmapLocalSelectionContract(),
    verification: describeHeatmapVerificationContract(),
  }
}

export const heatmapFamily = Object.freeze({
  kind: 'heatmap',
  describeContract: describeHeatmapWidgetContract,
  actions: Object.freeze({
    buildDescriptors: buildHeatmapActionDescriptors,
  }),
  perception: Object.freeze({
    buildDescriptors: buildHeatmapPerceptionDescriptors,
    register: registerHeatmapPerceptionQueries,
  }),
  interactionProfile: Object.freeze({
    getConfig: getHeatmapHumanInteractionConfig,
  }),
})
