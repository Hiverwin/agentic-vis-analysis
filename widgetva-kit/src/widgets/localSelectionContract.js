function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export const WIDGET_LOCAL_SELECTION_FAMILIES = [
  'category',
  'interval',
  'cell',
  'region',
]

export const WIDGET_LOCAL_SELECTION_CONTRACTS = {
  bar: {
    localSelectionFamily: 'category',
    selectionKinds: ['category'],
    sourceActionNames: ['bar.selectCategory'],
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
  },
  line: {
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
  },
  scatter: {
    localSelectionFamily: 'interval',
    selectionKinds: ['interval'],
    sourceActionNames: ['scatter.brushRegion'],
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
  },
  heatmap: {
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
  },
  parallelCoordinates: {
    localSelectionFamily: 'interval',
    selectionKinds: ['interval', 'record'],
    sourceActionNames: ['parallelCoordinates.brushAxes', 'parallelCoordinates.selectRecord'],
    cardinality: 'singleActiveSelection',
    selectionValueShape: 'multivariateAxisIntervalsOrRecordId',
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
      'selection-scoped perception queries should resolve rows that satisfy all brushed axis rules',
      'selection summaries should expose the brushed dimension list and interval predicates',
      'record-level selections should preserve the selected record identifier for downstream focus and comparison',
    ],
  },
  sankey: {
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
  },
}

export function describeLocalSelectionContract(kind) {
  return clone(WIDGET_LOCAL_SELECTION_CONTRACTS[kind] || null)
}

export function buildLocalSelectionObservation({ kind, state, widgetSelectionView = null } = {}) {
  const contract = describeLocalSelectionContract(kind)
  const localSelections = state?.selections && typeof state.selections === 'object'
    ? state.selections
    : {}
  const localSelectionRefs = Object.keys(localSelections)
  const activeSelectionRef = widgetSelectionView?.selectionRef
    || localSelectionRefs[0]
    || null
  const activeSelectionState = activeSelectionRef ? localSelections[activeSelectionRef] || null : null

  return {
    contract,
    localSelectionCount: localSelectionRefs.length,
    activeSelectionRef,
    activeSelectionKind: activeSelectionState?.kind || null,
    activeSelectionSummary: activeSelectionState?.summary || null,
    activeSelectionFields: Array.isArray(activeSelectionState?.fields)
      ? clone(activeSelectionState.fields)
      : [],
  }
}
