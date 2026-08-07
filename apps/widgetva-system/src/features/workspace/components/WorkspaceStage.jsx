import { useMemo } from 'react'
import { useAppStore } from '../../../app/store/appStore.js'
import { PanelHeader } from '../../../app/shell/PanelHeader.jsx'
import { createFirstPartyRuntimeSessionFacade, getRuntimeSession } from '../../../appRuntime/contracts/runtimeBridge.js'
import { hydrateImportedRuntimeWidgets } from '../imports/importedRuntimeHydration.js'
import { buildKitLinkRows } from '../models/coordinationPresentation.js'
import { WidgetSurface } from './WidgetSurface.jsx'

function listCoordinationSelections(coordinationState = null) {
  const registry = coordinationState?.selections?.registry
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) return []
  return Object.values(registry).filter((selection) => selection && typeof selection === 'object')
}

function WorkspaceCoordinationSummary({ links = [], selections = [], propagation = null, widgets = [] }) {
  const activeLinks = Array.isArray(propagation?.activatedLinks) ? propagation.activatedLinks : []
  const skippedTargets = Array.isArray(propagation?.skippedTargets) ? propagation.skippedTargets : []
  const linkRows = buildKitLinkRows(links, widgets)

  return (
    <div className="workspace-coordination" aria-label="Kit coordination state">
      <div className="workspace-state-detail" tabIndex={0}>
        <span className="workspace-state-trigger">{links.length} links</span>
        <div className="workspace-state-popover" role="tooltip">
          <strong>Links</strong>
        <ul>
          {linkRows.length > 0 ? linkRows.map((link) => (
            <li key={link.id}>
              <strong>{link.source} → {link.target}</strong>
              {link.transformKind ? <span>{link.transformKind}</span> : null}
            </li>
          )) : <li>No registered links.</li>}
        </ul>
        </div>
      </div>
      <div className={`workspace-state-detail ${propagation?.active ? 'active' : ''}`} tabIndex={0}>
        <span className="workspace-state-trigger">{selections.length} selections</span>
        <div className="workspace-state-popover" role="tooltip">
          <strong>Selections</strong>
        <ul>
          {selections.length > 0 ? selections.map((selection, index) => (
            <li key={selection.selectionRef || selection.id || index}>
              <strong>{selection.sourceWidgetId || selection.sourceWidgetRef || 'selection'}</strong>
              <span>{selection.summary || selection.selectionRef || 'Active selection'}</span>
            </li>
          )) : <li>No active selections.</li>}
        </ul>
          {propagation?.active ? (
            <>
              <strong>Propagation</strong>
          <ul>
            {activeLinks.map((link, index) => (
              <li key={link.linkRef || link.linkId || index}>
                <strong>{link.appliedEffect || link.effect || 'applied'}</strong>
                <span>{link.sourceWidgetId || propagation.sourceWidgetId || 'source'} → {link.targetWidgetId || link.targetRef || 'target'}</span>
              </li>
            ))}
            {skippedTargets.map((target, index) => (
              <li key={target.linkRef || target.targetWidgetId || `skipped-${index}`}>
                <strong>skipped</strong>
              <span>{target.targetWidgetId || target.targetRef || 'target'} · {target.reason || 'not applied'}</span>
            </li>
            ))}
          </ul>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function WorkspaceStage() {
  const caseTitle = useAppStore((state) => state.caseTitle)
  const caseSummary = useAppStore((state) => state.caseSummary)
  const topology = useAppStore((state) => state.topology)
  const widgetsState = useAppStore((state) => state.widgets)
  const workspaceSourceType = useAppStore((state) => state.workspaceSourceType)
  const loadedVisualizationPreview = useAppStore((state) => state.loadedVisualizationPreview)
  const selectedWidgetId = useAppStore((state) => state.selectedWidgetId)
  const setSelectedWidgetId = useAppStore((state) => state.setSelectedWidgetId)
  const runtimeSessionKey = useAppStore((state) => state.runtimeSessionKey)
  const activeCaseId = useAppStore((state) => state.activeCaseId)
  const coordinationVersion = useAppStore((state) => state.coordinationVersion)
  const analyticalVersion = useAppStore((state) => state.analyticalVersion)
  const runtime = useMemo(
    () => createFirstPartyRuntimeSessionFacade(runtimeSessionKey || activeCaseId),
    [activeCaseId, runtimeSessionKey],
  )
  const runtimeSession = useMemo(
    () => getRuntimeSession(runtimeSessionKey || activeCaseId),
    [activeCaseId, runtimeSessionKey],
  )
  const coordinationState = useMemo(
    () => runtime.readCoordinationState(),
    [coordinationVersion, runtime],
  )
  const latestCoordinationResult = useMemo(
    () => runtime.readLatestCoordinationResult?.() || null,
    [coordinationVersion, runtime],
  )
  const structuralContext = useMemo(
    () => runtime.readSharedStructuralContext?.() || null,
    [coordinationVersion, runtime, widgetsState],
  )
  const previewWorkspace = Boolean(loadedVisualizationPreview?.widget)
  const starterWorkspace = workspaceSourceType === 'starter'
  const runtimeHydratedWidgets = useMemo(
    () => hydrateImportedRuntimeWidgets(Array.isArray(widgetsState) ? widgetsState : [], {
      readWidgetRenderPayload: (widgetId) => runtime.readWidgetRenderPayload(widgetId),
      describeWorkspace: () => runtime.describeWorkspace(),
    }),
    [analyticalVersion, coordinationVersion, runtime, widgetsState],
  )
  const widgets = previewWorkspace
    ? [loadedVisualizationPreview.widget]
    : runtimeHydratedWidgets
  const widgetCount = widgets.length
  const singleView = widgetCount === 1
  const workspaceColumns = widgetCount <= 1 ? 1 : widgetCount <= 4 ? 2 : 3
  const workspaceRows = Math.max(1, Math.ceil(widgetCount / workspaceColumns))
  const activeSelections = listCoordinationSelections(coordinationState)
  const links = Array.isArray(structuralContext?.links?.definitions) ? structuralContext.links.definitions : []
  const propagation = latestCoordinationResult?.propagationSummary || null

  return (
    <section
      className={`workspace-stage ${(workspaceSourceType === 'importedSpec' || previewWorkspace) ? 'imported-workspace-stage' : ''}`}
      aria-label="Workspace stage"
    >
      <PanelHeader kind="workspace" title="Visualization Workspace">
        <span className="workspace-topology">{previewWorkspace ? 'preview' : topology}</span>
        {!previewWorkspace ? <WorkspaceCoordinationSummary links={links} selections={activeSelections} propagation={propagation} widgets={widgets} /> : null}
      </PanelHeader>
      <div className="workspace-header">
        <div>
          <h2>{previewWorkspace ? loadedVisualizationPreview.title : caseTitle}</h2>
          {(workspaceSourceType === 'importedSpec' || starterWorkspace) && caseSummary ? <p className="section-copy">{caseSummary}</p> : null}
        </div>
      </div>
      <div
        className={`workspace-grid topology-${topology} ${singleView ? 'single-widget' : ''} ${(workspaceSourceType === 'importedSpec' || previewWorkspace) ? 'imported-workspace-grid' : ''}`}
        style={{
          '--workspace-columns': workspaceColumns,
          '--workspace-rows': workspaceRows,
        }}
      >
        {widgets.map((widget) => (
          <WidgetSurface
            key={widget.id}
            widget={widget}
            runtime={runtimeSession?.runtime || null}
            singleViewMode={singleView}
            selected={previewWorkspace ? true : widget.id === selectedWidgetId}
            onSelect={previewWorkspace ? undefined : () => setSelectedWidgetId(widget.id)}
          />
        ))}
      </div>
    </section>
  )
}
