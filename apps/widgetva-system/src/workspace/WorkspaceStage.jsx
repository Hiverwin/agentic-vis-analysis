import { useMemo } from 'react'
import { getWorkspaceViewModel, useAppStore } from '../app/appStore.js'
import { createFirstPartyRuntimeSessionFacade } from '../runtime/runtimeBridge.js'
import { buildTraceTimelineModel } from '../trace/traceViewModel.js'
import { deriveWorkspaceProvenance } from './workspaceProvenance.js'
import { WidgetSurface } from './WidgetSurface.jsx'

export function WorkspaceStage() {
  const dataset = useAppStore((state) => state.dataset)
  const topology = useAppStore((state) => state.topology)
  const widgetsState = useAppStore((state) => state.widgets)
  const workspaceComposition = useAppStore((state) => state.workspaceComposition)
  const analysisOrigin = useAppStore((state) => state.analysisOrigin)
  const analysisYear = useAppStore((state) => state.analysisYear)
  const analysisCylinders = useAppStore((state) => state.analysisCylinders)
  const horsepowerMin = useAppStore((state) => state.horsepowerMin)
  const horsepowerMax = useAppStore((state) => state.horsepowerMax)
  const focusedCarId = useAppStore((state) => state.focusedCarId)
  const selectedWidgetId = useAppStore((state) => state.selectedWidgetId)
  const trace = useAppStore((state) => state.trace)
  const selectedTraceStepId = useAppStore((state) => state.selectedTraceStepId)
  const activeReplayContext = useAppStore((state) => state.activeReplayContext)
  const setSelectedWidgetId = useAppStore((state) => state.setSelectedWidgetId)
  const runtimeSessionKey = useAppStore((state) => state.runtimeSessionKey)
  const activeCaseId = useAppStore((state) => state.activeCaseId)
  const coordinationVersion = useAppStore((state) => state.coordinationVersion)
  const analyticalVersion = useAppStore((state) => state.analyticalVersion)
  const widgetActionOverrides = useAppStore((state) => state.widgetActionOverrides)
  const runtime = useMemo(
    () => createFirstPartyRuntimeSessionFacade(runtimeSessionKey || activeCaseId),
    [activeCaseId, runtimeSessionKey],
  )
  const coordinationState = useMemo(
    () => runtime.readCoordinationState(),
    [coordinationVersion, runtime],
  )
  const baseHostState = useMemo(() => ({
    dataset,
    topology,
    widgets: widgetsState,
    workspaceComposition,
    analysisOrigin,
    analysisYear,
    analysisCylinders,
    horsepowerMin,
    horsepowerMax,
    focusedCarId,
    widgetActionOverrides,
  }), [
    analyticalVersion,
    analysisCylinders,
    analysisOrigin,
    analysisYear,
    dataset,
    focusedCarId,
    horsepowerMax,
    horsepowerMin,
    topology,
    widgetActionOverrides,
    widgetsState,
    workspaceComposition,
  ])
  const linkedHostState = useMemo(() => ({
    ...baseHostState,
    coordinationState,
  }), [baseHostState, coordinationState])
  const baseViewModel = useMemo(
    () => getWorkspaceViewModel(baseHostState),
    [baseHostState],
  )
  const linkedViewModel = useMemo(
    () => getWorkspaceViewModel(linkedHostState),
    [linkedHostState],
  )
  const primarySelection = coordinationState?.selections?.views?.primary || null
  const preserveScatterBrushOverlay = primarySelection?.sourceWidgetId === 'w_scatter_cars'
    && (primarySelection?.selectionId === 'hpBrush' || primarySelection?.kind === 'brush')
  const scatterWidget = (
    preserveScatterBrushOverlay
      ? baseViewModel.widgetMap.w_scatter_cars
      : linkedViewModel.widgetMap.w_scatter_cars
  ) || linkedViewModel.widgetMap.w_scatter_cars || baseViewModel.widgetMap.w_scatter_cars || null
  const widgetMap = {
    ...linkedViewModel.widgetMap,
    ...(scatterWidget ? { w_scatter_cars: scatterWidget } : {}),
  }
  const widgets = Object.values(widgetMap)
  const activeFilters = Array.isArray(linkedViewModel?.activeFilters) ? linkedViewModel.activeFilters : []
  const linkedSelectionCount = Number.isFinite(linkedViewModel?.linkedSelectionCount) ? linkedViewModel.linkedSelectionCount : 0
  const filteredRows = Array.isArray(linkedViewModel?.filteredRows) ? linkedViewModel.filteredRows : []
  const selectedTraceStep = useMemo(
    () => buildTraceTimelineModel(trace, { selectedStepId: selectedTraceStepId }).selectedStep,
    [selectedTraceStepId, trace],
  )
  const provenance = useMemo(
    () => deriveWorkspaceProvenance({
      selectedWidgetId,
      selectedTraceStep,
      activeReplayContext,
    }),
    [activeReplayContext, selectedTraceStep, selectedWidgetId],
  )

  return (
    <section className="workspace-stage" aria-label="Workspace stage">
      <div className="workspace-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>Six coordinated views</h2>
        </div>
        <div className="workspace-status">
          <span>{topology}</span>
          <span>{widgets.length} widgets</span>
          <span>{linkedSelectionCount} filtered cars</span>
          <span>{filteredRows.length} rows visible</span>
          {provenance.hasReplayAnchor ? <span>{provenance.branchLabel} anchor</span> : null}
        </div>
      </div>
      {provenance.hasReplayAnchor ? (
        <div className="workspace-provenance-banner">
          <span className="workspace-provenance-pill">{provenance.branchLabel}</span>
          <strong>{provenance.focusedReplayWidgetId || 'Workspace'}</strong>
          <p>{provenance.replaySummary || 'Replay anchor active.'}</p>
        </div>
      ) : null}
      {activeFilters.length > 0 ? (
        <div className="filter-strip">
          {activeFilters.map((filter) => <span key={filter}>{filter}</span>)}
        </div>
      ) : null}
      <div className={`workspace-grid topology-${topology}`}>
        {widgets.map((widget) => (
          <WidgetSurface
            key={widget.id}
            widget={widget}
            selected={widget.id === selectedWidgetId}
            replayAnchored={provenance.focusedReplayWidgetId === widget.id}
            replayBranchActive={provenance.hasReplayAnchor}
            onSelect={() => setSelectedWidgetId(widget.id)}
          />
        ))}
      </div>
    </section>
  )
}
