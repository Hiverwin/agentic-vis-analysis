import { useMemo } from 'react'
import { useAppStore } from '../../../app/store/appStore.js'
import { createFirstPartyRuntimeSessionFacade } from '../../../appRuntime/contracts/runtimeBridge.js'
import { buildAnalysisProvenanceSummary } from '../models/provenanceSummary.js'
import { deriveTraceBranchNarrative } from '../../trace/models/traceBranchNarrative.js'
import { deriveTraceFocus } from '../../trace/models/traceFocus.js'
import { buildTraceTimelineModel } from '../../trace/models/traceViewModel.js'

export function InspectPanel() {
  const workspaceSourceType = useAppStore((state) => state.workspaceSourceType)
  const loadedVisualizationPreview = useAppStore((state) => state.loadedVisualizationPreview)
  const runtimeSessionKey = useAppStore((state) => state.runtimeSessionKey)
  const activeCaseId = useAppStore((state) => state.activeCaseId)
  const selectedWidgetId = useAppStore((state) => state.selectedWidgetId)
  const coordinationVersion = useAppStore((state) => state.coordinationVersion)
  const dataset = useAppStore((state) => state.dataset)
  const topology = useAppStore((state) => state.topology)
  const widgets = useAppStore((state) => state.widgets)
  const workspaceComposition = useAppStore((state) => state.workspaceComposition)
  const trace = useAppStore((state) => state.trace)
  const selectedTraceStepId = useAppStore((state) => state.selectedTraceStepId)
  const activeReplayContext = useAppStore((state) => state.activeReplayContext)
  const runtime = useMemo(
    () => createFirstPartyRuntimeSessionFacade(runtimeSessionKey || activeCaseId),
    [activeCaseId, runtimeSessionKey],
  )
  const coordinationState = useMemo(
    () => runtime.readCoordinationState(),
    [coordinationVersion, runtime],
  )
  const propagationSummary = useMemo(
    () => runtime.readPropagationSummary(),
    [coordinationVersion, runtime],
  )
  const workspaceDescription = useMemo(
    () => runtime.readWorkspaceDescription() || null,
    [coordinationVersion, runtime],
  )
  const availableActions = useMemo(
    () => runtime.listAvailableActions(),
    [coordinationVersion, runtime],
  )
  const availablePerceptions = useMemo(
    () => runtime.listAvailablePerceptions(),
    [coordinationVersion, runtime],
  )
  const widgetMap = useMemo(
    () => Object.fromEntries((Array.isArray(widgets) ? widgets : []).map((widget) => [widget.id, widget])),
    [widgets],
  )
  const traceModel = useMemo(
    () => buildTraceTimelineModel(trace, { selectedStepId: selectedTraceStepId }),
    [selectedTraceStepId, trace],
  )
  const selectedTraceStep = traceModel.selectedStep
  const traceFocus = useMemo(
    () => deriveTraceFocus({ traceModel, activeReplayContext }),
    [activeReplayContext, traceModel],
  )
  const branchNarrative = useMemo(
    () => deriveTraceBranchNarrative({ traceModel, traceFocus }),
    [traceFocus, traceModel],
  )
  const provenanceSummary = useMemo(
    () => buildAnalysisProvenanceSummary({
      selectedTraceStep,
      selectedSegment: traceModel.selection.selectedSegment,
      selectedPath: traceModel.selection.selectedPath,
      currentSegment: traceModel.selection.currentSegment,
      currentPath: traceModel.selection.currentPath,
      activeReplayContext,
      branchNarrative,
    }),
    [activeReplayContext, branchNarrative, selectedTraceStep, traceModel.selection.currentPath, traceModel.selection.currentSegment, traceModel.selection.selectedPath, traceModel.selection.selectedSegment],
  )
  const focusedWidgetRef = coordinationState?.focusedWidgetRef || null
  const widgetDescription = useMemo(() => {
    const widgets = Array.isArray(workspaceDescription?.widgets) ? workspaceDescription.widgets : []
    const adapters = Array.isArray(workspaceDescription?.widgetAdapters) ? workspaceDescription.widgetAdapters : []
    const targetWidget = widgets.find((entry) => (
      entry?.widgetId === selectedWidgetId || entry?.ref === focusedWidgetRef
    )) || null
    if (!targetWidget) return null
    const adapter = adapters.find((entry) => entry?.widgetRef === targetWidget.ref) || null
    const actionNames = availableActions
      .filter((entry) => entry?.targetRef === targetWidget.ref && typeof entry?.name === 'string')
      .map((entry) => entry.name)
    const perceptionNames = availablePerceptions
      .filter((entry) => entry?.targetRef === targetWidget.ref && typeof entry?.name === 'string')
      .map((entry) => entry.name)
    return {
      widgetId: targetWidget.widgetId,
      ref: targetWidget.ref,
      title: targetWidget.title || null,
      kind: targetWidget.kind || null,
      role: targetWidget.role || null,
      provider: adapter?.provider || null,
      actionNames,
      perceptionNames,
    }
  }, [availableActions, availablePerceptions, focusedWidgetRef, selectedWidgetId, workspaceDescription])
  const widgetPerceptionNames = widgetDescription?.perceptionNames || []
  const widget = widgetMap[selectedWidgetId] || widgetDescription || null
  const selectionRegistryCount = Object.keys(coordinationState?.selections?.registry || {}).length
  const primarySelection = coordinationState?.selections?.views?.primary || null
  const highlightEntries = coordinationState?.highlight?.entries || []
  const linkTopology = coordinationState?.links?.topology || null
  const workspaceGlobalFilters = coordinationState?.globalFilters || {}
  const workspaceGlobalFilterLabels = Object.entries(workspaceGlobalFilters)
    .filter(([, value]) => value != null && value !== '' && !(Array.isArray(value) && value.length === 0))
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
  const datasetRows = Array.isArray(dataset?.rows) ? dataset.rows : []
  const linkedSelectionCount = Array.isArray(workspaceComposition?.links)
    ? workspaceComposition.links.length
    : Array.isArray(coordinationState?.links?.definitions)
      ? coordinationState.links.definitions.length
      : 0

  if (loadedVisualizationPreview?.widget) {
    return (
      <div className="empty-panel">
        The current visualization is rendered as a preview. Bind it to the runtime before inspecting widget refs, actions, or perceptions.
      </div>
    )
  }

  if (!widget) {
    return <div className="empty-panel">Select a widget to inspect its current state.</div>
  }

  return (
    <div className="analysis-stack">
      {selectedTraceStep ? (
        <section className="info-block compact">
          <h4>Selected trace step</h4>
          <p>{selectedTraceStep.actor} · {selectedTraceStep.kindLabel} · {selectedTraceStep.widgetTitle}</p>
          <p>{selectedTraceStep.summary}</p>
          <p>{selectedTraceStep.transitionType} · {selectedTraceStep.branchId || 'main'} · {selectedTraceStep.resultStateId || 'no state id'}</p>
          {provenanceSummary.selectedSegmentLabel ? (
            <p>Segment {provenanceSummary.selectedSegmentLabel} · {provenanceSummary.selectedSegmentStepCount} step{provenanceSummary.selectedSegmentStepCount === 1 ? '' : 's'}</p>
          ) : null}
          {provenanceSummary.selectedPathLabel ? (
            <p>Path {provenanceSummary.selectedPathLabel} · {provenanceSummary.selectedPathSegmentCount} segment{provenanceSummary.selectedPathSegmentCount === 1 ? '' : 's'} · {provenanceSummary.selectedPathStepCount} step{provenanceSummary.selectedPathStepCount === 1 ? '' : 's'}</p>
          ) : null}
        </section>
      ) : null}
      {activeReplayContext ? (
        <section className="info-block compact">
          <h4>Replay context</h4>
          <p>{activeReplayContext.source} · {activeReplayContext.widgetTitle || activeReplayContext.widgetId || 'Workspace'}</p>
          <p>{activeReplayContext.summary || 'Workspace replay context active.'}</p>
          <p>{activeReplayContext.branchId || 'main'} · {activeReplayContext.stateId || 'no state id'}</p>
          {provenanceSummary.hasBranchNarrative ? <p>{provenanceSummary.forkDescription}</p> : null}
          {provenanceSummary.entryStepLabel ? <p>{provenanceSummary.entryStepLabel}</p> : null}
        </section>
      ) : null}
      <section className="info-block">
        <h4>{widget.title}</h4>
        <p>{widget.insight || 'Current focused view.'}</p>
        <p>{workspaceGlobalFilterLabels.length ? workspaceGlobalFilterLabels.join(' · ') : 'No global filter is active.'}</p>
        <p>{datasetRows.length} source rows · {linkedSelectionCount} coordination links · {selectionRegistryCount} shared selections</p>
      </section>
      <section className="info-block compact">
        <h4>Selection</h4>
        {primarySelection ? (
          <>
            <p>{primarySelection.summary || 'Primary shared selection active.'}</p>
            <p>{primarySelection.sourceWidgetId || primarySelection.sourceWidgetRef || 'unknown source'}</p>
          </>
        ) : (
          <p>No shared selection is active.</p>
        )}
        {propagationSummary?.active ? (
          <p>{propagationSummary.sourceWidgetId} → {propagationSummary.targetWidgetIds.length ? propagationSummary.targetWidgetIds.join(', ') : 'no targets'} · {linkTopology?.topology || topology}</p>
        ) : highlightEntries.length > 0 ? (
          <p>{highlightEntries[0]?.summary || 'Shared highlight active.'}</p>
        ) : (
          <p>No active selection propagation.</p>
        )}
        {selectedTraceStep?.verificationSummary ? (
          <p>Trace verification: {selectedTraceStep.verificationSummary}</p>
        ) : null}
      </section>
      <section className="info-block compact">
        <h4>Focus</h4>
        {focusedWidgetRef ? <p>{focusedWidgetRef}</p> : <p>No widget focus is active.</p>}
      </section>
      <section className="info-block compact">
        <h4>Runtime</h4>
        {widgetDescription ? (
          <>
          <p>{widgetDescription.kind} · {widgetDescription.role}</p>
          <p>{(widgetDescription.actionNames || []).length} actions · {widgetPerceptionNames.length} perception queries</p>
          </>
        ) : (
          <p>No runtime metadata available.</p>
        )}
      </section>
    </div>
  )
}
