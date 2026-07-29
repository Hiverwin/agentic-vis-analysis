import { useMemo } from 'react'
import { useAppStore } from '../../../app/store/appStore.js'
import { createFirstPartyRuntimeSessionFacade } from '../../../appRuntime/contracts/runtimeBridge.js'

export function ControlsPanel() {
  const workspaceSourceType = useAppStore((state) => state.workspaceSourceType)
  const loadedVisualizationPreview = useAppStore((state) => state.loadedVisualizationPreview)
  const runtimeSessionKey = useAppStore((state) => state.runtimeSessionKey)
  const activeCaseId = useAppStore((state) => state.activeCaseId)
  const coordinationVersion = useAppStore((state) => state.coordinationVersion)
  const resetWorkspaceView = useAppStore((state) => state.resetWorkspaceView)
  const clearFilters = useAppStore((state) => state.clearFilters)
  const clearSelection = useAppStore((state) => state.clearSelection)
  const clearHighlight = useAppStore((state) => state.clearHighlight)
  const promoteSelectionToFilter = useAppStore((state) => state.promoteSelectionToFilter)
  const promoteSelectionToHighlight = useAppStore((state) => state.promoteSelectionToHighlight)
  const undoSelectionHistory = useAppStore((state) => state.undoSelectionHistory)
  const redoSelectionHistory = useAppStore((state) => state.redoSelectionHistory)
  const resetWorkspaceInteractions = useAppStore((state) => state.resetWorkspaceInteractions)
  const restorePreviousWorkspaceState = useAppStore((state) => state.restorePreviousWorkspaceState)
  const restoreEarliestWorkspaceState = useAppStore((state) => state.restoreEarliestWorkspaceState)

  const runtime = useMemo(
    () => createFirstPartyRuntimeSessionFacade(runtimeSessionKey || activeCaseId),
    [activeCaseId, runtimeSessionKey],
  )
  const coordinationState = useMemo(
    () => runtime.readCoordinationState(),
    [coordinationVersion, runtime],
  )
  const stateHistory = useMemo(
    () => runtime.readStateHistory({ limit: 12 }),
    [coordinationVersion, runtime],
  )
  const primarySelection = coordinationState?.selections?.views?.primary || null
  const hasHighlight = Array.isArray(coordinationState?.highlight?.entries) && coordinationState.highlight.entries.length > 0
  const canRestorePreviousState = stateHistory.length > 1
  const canRestoreEarliestState = stateHistory.length > 0
  const canCommitSelectionAsFilter = Boolean(primarySelection?.selectionRef)
    && Array.isArray(primarySelection?.predicates)
    && primarySelection.predicates.length > 0

  if (loadedVisualizationPreview?.widget) {
    return (
      <div className="analysis-stack">
        <section className="info-block compact">
          <h4>Preview mode</h4>
          <p>
            This visualization is currently rendered as a preview only.
            Bind it first before using runtime interaction controls.
          </p>
          <p>
            {loadedVisualizationPreview.provider} · {loadedVisualizationPreview.widgetKind} · {loadedVisualizationPreview.title}
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="analysis-stack">
      <section className="info-block compact">
        <h4>{workspaceSourceType === 'starter' ? 'Starter mode' : 'Runtime controls'}</h4>
        <p>
          {workspaceSourceType === 'starter'
            ? 'Load and bind a visualization to mount it into the host VA.'
            : 'Controls here operate on the current kit runtime state, independent of any demo-specific dataset.'}
        </p>
      </section>
      <section className="info-block">
        <h4>Interaction state</h4>
        <div className="button-grid">
          <button type="button" className="primary-button" onClick={promoteSelectionToFilter} disabled={!canCommitSelectionAsFilter}>Filter to current selection</button>
          <button type="button" className="primary-button" onClick={promoteSelectionToHighlight} disabled={!primarySelection}>Highlight current selection</button>
          <button type="button" className="ghost-toggle block" onClick={clearSelection} disabled={!primarySelection}>Clear selection only</button>
          <button type="button" className="ghost-toggle block" onClick={clearHighlight} disabled={!hasHighlight}>Clear highlight</button>
          <button type="button" className="primary-button" onClick={clearFilters}>Clear active filters</button>
          <button type="button" className="ghost-toggle block" onClick={() => void undoSelectionHistory()}>Undo selection</button>
          <button type="button" className="ghost-toggle block" onClick={() => void redoSelectionHistory()}>Redo selection</button>
          <button type="button" className="ghost-toggle block" onClick={() => void resetWorkspaceInteractions()}>Reset interaction state</button>
          <button type="button" className="ghost-toggle block" onClick={() => void restorePreviousWorkspaceState()} disabled={!canRestorePreviousState}>Back to previous state</button>
          <button type="button" className="ghost-toggle block" onClick={() => void restoreEarliestWorkspaceState()} disabled={!canRestoreEarliestState}>Restore earliest state</button>
          <button type="button" className="ghost-toggle block" onClick={resetWorkspaceView}>Rebuild workspace view</button>
        </div>
      </section>
    </div>
  )
}
