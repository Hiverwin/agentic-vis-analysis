import { makeRuntimeStoreCurrentStateSummary } from '../protocol/runtimeStore.js'
import { readSelectionRegistry, resolvePrimarySelectionEntry } from '../../workspace/state/selectionStateModel.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function summarizeWorkspaceState(state) {
  if (!state || typeof state !== 'object') return null

  const widgets = Object.values(state.widgets || {})
  const focusedWidgetRef = state.shared?.focusedWidget || widgets[0]?.ref || null
  const focusedWidget = focusedWidgetRef ? state.widgets?.[focusedWidgetRef] || null : widgets[0] || null
  const activeSelections = readSelectionRegistry(state.shared || {})
  const selectionEntries = Object.entries(activeSelections)
  const primarySelectionEntry = resolvePrimarySelectionEntry(state.shared || {})
  const changedRefs = Array.isArray(state.delta?.changedRefs) ? state.delta.changedRefs : []
  const removedRefs = Array.isArray(state.delta?.removedRefs) ? state.delta.removedRefs : []

  return makeRuntimeStoreCurrentStateSummary({
    stateId: state.stateId || null,
    focusedWidgetRef,
    focusedWidgetKind: focusedWidget?.kind || null,
    focusedWidgetTitle: focusedWidget?.title || null,
    visibleCount: focusedWidget?.data?.visibleCount ?? focusedWidget?.data?.rowCount ?? null,
    selectedCount: focusedWidget?.data?.selectedCount ?? null,
    selectionCount: selectionEntries.length,
    activeSelectionRefs: selectionEntries.map(([selectionRef]) => selectionRef),
    primarySelectionRef: primarySelectionEntry?.[0] || null,
    primarySelectionSummary: primarySelectionEntry?.[1]?.summary || '',
    primarySelectionPredicates: Array.isArray(primarySelectionEntry?.[1]?.predicates)
      ? clone(primarySelectionEntry[1].predicates)
      : [],
    annotationCount: Array.isArray(state.shared?.annotations) ? state.shared.annotations.length : 0,
    globalFilterCount: Object.keys(state.shared?.globalFilters || {}).length,
    taskMode: state.taskContext?.taskMode || null,
    coordinationScope: state.taskContext?.coordinationScope || null,
    evidenceType: state.taskContext?.evidenceType || null,
    interactionHorizon: state.taskContext?.interactionHorizon || null,
    replayRunMode: state.replayContext?.runMode || null,
    replayUserIntent: state.replayContext?.userIntent || '',
    changedRefs,
    removedRefs,
    sharedChanged: changedRefs.includes('shared'),
    taskContextChanged: changedRefs.includes('taskContext'),
    replayContextChanged: changedRefs.includes('replayContext'),
  })
}
