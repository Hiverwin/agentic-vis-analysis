import { useMemo } from 'react'
import { getWorkspaceViewModel, useAppStore } from '../app/appStore.js'
import { createFirstPartyRuntimeSessionFacade } from '../runtime/runtimeBridge.js'
import { buildAnalysisProvenanceSummary } from './provenanceSummary.js'
import { deriveTraceBranchNarrative } from '../trace/traceBranchNarrative.js'
import { deriveTraceFocus } from '../trace/traceFocus.js'
import { buildTraceTimelineModel } from '../trace/traceViewModel.js'

export function InspectPanel() {
  const runtimeSessionKey = useAppStore((state) => state.runtimeSessionKey)
  const activeCaseId = useAppStore((state) => state.activeCaseId)
  const selectedWidgetId = useAppStore((state) => state.selectedWidgetId)
  const coordinationVersion = useAppStore((state) => state.coordinationVersion)
  const dataset = useAppStore((state) => state.dataset)
  const topology = useAppStore((state) => state.topology)
  const widgets = useAppStore((state) => state.widgets)
  const workspaceComposition = useAppStore((state) => state.workspaceComposition)
  const analysisOrigin = useAppStore((state) => state.analysisOrigin)
  const analysisYear = useAppStore((state) => state.analysisYear)
  const analysisCylinders = useAppStore((state) => state.analysisCylinders)
  const horsepowerMin = useAppStore((state) => state.horsepowerMin)
  const horsepowerMax = useAppStore((state) => state.horsepowerMax)
  const focusedCarId = useAppStore((state) => state.focusedCarId)
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
  const hostState = useMemo(() => ({
    dataset,
    topology,
    widgets,
    workspaceComposition,
    analysisOrigin,
    analysisYear,
    analysisCylinders,
    horsepowerMin,
    horsepowerMax,
    focusedCarId,
    coordinationState,
  }), [
    analysisCylinders,
    analysisOrigin,
    analysisYear,
    coordinationState,
    dataset,
    focusedCarId,
    horsepowerMax,
    horsepowerMin,
    topology,
    widgets,
    workspaceComposition,
  ])
  const { activeFilters, linkedSelectionCount, filteredRows, widgetMap, focusedCar } = useMemo(
    () => getWorkspaceViewModel(hostState),
    [hostState],
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
      providerCapabilities: adapter?.providerCapabilities || null,
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
  const workspaceGlobalFilterLabels = [
    ...(workspaceGlobalFilters.origin ? [`origin: ${workspaceGlobalFilters.origin}`] : []),
    ...(workspaceGlobalFilters.year ? [`year: ${workspaceGlobalFilters.year}`] : []),
    ...(Array.isArray(workspaceGlobalFilters.cylinders) && workspaceGlobalFilters.cylinders.length > 0
      ? [`cylinders: ${workspaceGlobalFilters.cylinders.join(', ')}`]
      : []),
    ...(Array.isArray(workspaceGlobalFilters.horsepowerRange) && workspaceGlobalFilters.horsepowerRange.length === 2
      ? [`horsepower: ${workspaceGlobalFilters.horsepowerRange[0]}-${workspaceGlobalFilters.horsepowerRange[1]}`]
      : []),
  ]

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
        <p>{workspaceGlobalFilterLabels.length ? workspaceGlobalFilterLabels.join(' · ') : (activeFilters.length ? activeFilters.join(' · ') : 'No global filter is active.')}</p>
        <p>{filteredRows.length} visible rows · {linkedSelectionCount} coordinated views · {selectionRegistryCount} shared selections</p>
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
        {focusedCar ? (
          <>
            <p>{focusedCar.name}</p>
            <p>{focusedCar.origin} · {focusedCar.cylinders} cyl · {focusedCar.horsepower} hp · {focusedCar.mpg} mpg</p>
          </>
        ) : (
          <p>No car remains under the current filters.</p>
        )}
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
