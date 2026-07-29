import { useMemo, useState } from 'react'
import { useAppStore } from '../../../app/store/appStore.js'
import { createFirstPartyRuntimeSessionFacade, getRuntimeSession } from '../../../appRuntime/contracts/runtimeBridge.js'
import { buildTraceTimelineModel } from '../../trace/models/traceViewModel.js'
import { hydrateImportedRuntimeWidgets } from '../imports/importedRuntimeHydration.js'
import { deriveWorkspaceProvenance } from '../models/workspaceProvenance.js'
import { WidgetSurface } from './WidgetSurface.jsx'

function listCoordinationSelections(coordinationState = null) {
  const registry = coordinationState?.selections?.registry
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) return []
  return Object.values(registry).filter((selection) => selection && typeof selection === 'object')
}

function summarizeSelection(selection = {}) {
  if (typeof selection.summary === 'string' && selection.summary.length > 0) return selection.summary
  if (typeof selection.field === 'string' && Array.isArray(selection.values)) {
    return `${selection.field}: ${selection.values.join(', ')}`
  }
  if (Array.isArray(selection.predicates) && selection.predicates.length > 0) {
    return selection.predicates
      .map((predicate) => `${predicate?.field || 'field'} ${predicate?.op || ''} ${Array.isArray(predicate?.value) ? predicate.value.join('..') : predicate?.value}`)
      .join('; ')
  }
  return selection.selection_type || selection.kind || 'selection'
}

function readWidgetIdFromStateRef(value = '') {
  const text = String(value || '')
  const widgetMatch = text.match(/\/widget\/([^/]+)/)
  return widgetMatch?.[1] || null
}

function summarizeLinkEndpoint(value = '', widgetLookup = new Map()) {
  const text = String(value || '')
  const widgetMatch = text.match(/\/widget\/([^/]+)/)
  const widgetId = readWidgetIdFromStateRef(text) || text
  const statePart = widgetMatch ? text.slice(widgetMatch.index + widgetMatch[0].length + 1) : ''
  const widget = widgetLookup.get(widgetId)
  const widgetLabel = widget?.kind || widget?.widgetKind || widgetId
  return statePart ? `${widgetLabel}.${statePart.replaceAll('/', '.')}` : widgetLabel
}

function readWidgetLookup(widgets = []) {
  return new Map((Array.isArray(widgets) ? widgets : [])
    .map((widget) => {
      const id = widget?.id || widget?.widgetId
      if (!id) return null
      return [id, widget]
    })
    .filter(Boolean))
}

function readLinkField(link = {}) {
  const transform = link?.transform || {}
  if (Array.isArray(transform.fieldMapping) && transform.fieldMapping.length > 0) {
    return transform.fieldMapping
      .map((mapping) => mapping?.targetField || mapping?.sourceField)
      .filter(Boolean)
      .join(', ')
  }
  if (Array.isArray(transform.channelMapping) && transform.channelMapping.length > 0) {
    return transform.channelMapping
      .map((mapping) => mapping?.targetField)
      .filter(Boolean)
      .join(', ')
  }
  return null
}

function summarizeSemanticLink(link = {}, widgetLookup = new Map()) {
  const transform = link?.transform || {}
  const transformKind = transform.kind || link?.kind || link?.relation || 'link'
  const sourceWidgetId = readWidgetIdFromStateRef(link.sourceStateRef || link.from || '')
    || link.sourceWidgetId
    || null
  const targetWidgetId = readWidgetIdFromStateRef(link.targetStateRef || link.to || '')
    || link.targetWidgetId
    || null
  const sourceWidget = widgetLookup.get(sourceWidgetId)
  const targetWidget = widgetLookup.get(targetWidgetId)
  const sourceKind = sourceWidget?.widgetKind || sourceWidget?.kind || sourceWidget?.type || sourceWidgetId || 'source'
  const targetKind = targetWidget?.widgetKind || targetWidget?.kind || targetWidget?.type || targetWidgetId || 'target'
  const field = readLinkField(link)

  if (transformKind === 'selectionToFilter') {
    return {
      relationLabel: `${sourceKind}.select${field ? `(${field})` : ''} -> ${targetKind}.filter${field ? `(${field})` : ''}`,
      transformKind,
      field,
    }
  }
  if (transformKind === 'selectionToHighlight') {
    return {
      relationLabel: `${sourceKind}.select${field ? `(${field})` : ''} -> ${targetKind}.highlight${field ? `(${field})` : ''}`,
      transformKind,
      field,
    }
  }
  if (transformKind === 'domainToFilter') {
    const channels = Array.isArray(transform.channelMapping)
      ? transform.channelMapping
        .map((mapping) => [mapping?.sourceChannel, mapping?.targetField].filter(Boolean).join(':'))
        .filter(Boolean)
        .join(', ')
      : field
    return {
      relationLabel: `${sourceKind}.zoom${channels ? `(${channels})` : ''} -> ${targetKind}.filter${field ? `(${field})` : ''}`,
      transformKind,
      field,
    }
  }
  if (transformKind === 'intervalToDomain') {
    return {
      relationLabel: `${sourceKind}.selectRegion -> ${targetKind}.zoom`,
      transformKind,
      field,
    }
  }
  return {
    relationLabel: `${summarizeLinkEndpoint(link.sourceStateRef || link.from || link.sourceWidgetId || '', widgetLookup)} -> ${summarizeLinkEndpoint(link.targetStateRef || link.to || link.targetWidgetId || '', widgetLookup)}`,
    transformKind,
    field,
  }
}

function summarizeWorkspaceLink(link = {}, widgetLookup = new Map()) {
  const transformKind = link?.transform?.kind || link?.kind || link?.relation || 'link'
  const semantic = summarizeSemanticLink(link, widgetLookup)
  const sourceStateRef = link.sourceStateRef || link.from || link.sourceWidgetId || ''
  const targetStateRef = link.targetStateRef || link.to || link.targetWidgetId || ''
  const fallbackKey = `${sourceStateRef}-${targetStateRef}-${transformKind}`
  return {
    key: link.ref || link.linkRef || link.linkId || link.id || fallbackKey,
    keys: [
      link.ref,
      link.linkRef,
      link.linkId,
      link.id,
      fallbackKey,
      sourceStateRef && targetStateRef ? `${sourceStateRef}-${targetStateRef}` : null,
    ].filter(Boolean),
    source: summarizeLinkEndpoint(sourceStateRef, widgetLookup),
    target: summarizeLinkEndpoint(targetStateRef, widgetLookup),
    transformKind: semantic.transformKind || transformKind,
    relationLabel: semantic.relationLabel,
    field: semantic.field,
  }
}

function readAppliedLinkRefs(latestCoordinationResult = null) {
  const candidates = [
    latestCoordinationResult?.propagationSummary?.activatedLinks,
    latestCoordinationResult?.propagationSummary?.links,
    latestCoordinationResult?.coordinationResult?.propagationSummary?.activatedLinks,
    latestCoordinationResult?.coordinationResult?.propagationSummary?.links,
    latestCoordinationResult?.links,
    latestCoordinationResult?.coordinationResult?.links,
  ].filter(Array.isArray)
  return new Set(candidates
    .flat()
    .flatMap((link) => [
      link?.linkRef,
      link?.ref,
      link?.linkId,
      link?.id,
      link?.sourceStateRef && link?.targetStateRef ? `${link.sourceStateRef}-${link.targetStateRef}` : null,
    ])
    .filter(Boolean))
}

function WorkspaceStatusPopover({ label, title, meta = null, emptyText = 'Nothing to show.', children }) {
  return (
    <span className="workspace-status-popover">
      <button type="button" className="workspace-status-pill workspace-status-trigger">
        {label}
      </button>
      <div className="workspace-status-card" role="tooltip">
        <div className="workspace-status-card-head">
          <strong>{title}</strong>
          {meta ? <span>{meta}</span> : null}
        </div>
        {children || <p className="workspace-status-empty">{emptyText}</p>}
      </div>
    </span>
  )
}

function WorkspaceWidgetsPopover({ widgets = [], removable = false, onRemoveWidget = null }) {
  const listedWidgets = (Array.isArray(widgets) ? widgets : []).map((widget) => ({
    key: widget?.id || widget?.widgetId || widget?.title,
    id: widget?.id || widget?.widgetId || null,
    title: widget?.title || widget?.name || 'Untitled widget',
    kind: widget?.widgetKind || widget?.kind || widget?.type || 'widget',
    provider: widget?.provider || widget?.source?.providerSpec?.provider || null,
    role: widget?.role || null,
  })).filter((widget) => widget.key)

  return (
    <WorkspaceStatusPopover
      label={`${listedWidgets.length} widgets`}
      title="Widgets"
      emptyText="No widgets in this workspace."
    >
      {listedWidgets.length > 0 ? (
        <ul>
          {listedWidgets.map((widget) => (
            <li key={widget.key}>
              <span>{widget.kind}</span>
              <strong>{widget.title}</strong>
              <p>{[widget.role, widget.provider].filter(Boolean).join(' · ') || 'rendered widget'}</p>
              {removable && widget.id ? (
                <button
                  type="button"
                  className="workspace-status-card-action"
                  onClick={() => onRemoveWidget?.(widget.id)}
                  aria-label={`Remove ${widget.title}`}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </WorkspaceStatusPopover>
  )
}

function WorkspaceSelectionsPopover({ selections = [], widgetLookup = new Map() }) {
  const listedSelections = (Array.isArray(selections) ? selections : []).map((selection, index) => {
    const sourceWidgetId = selection?.sourceWidgetId || readWidgetIdFromStateRef(selection?.sourceWidgetRef || '')
    const sourceWidget = widgetLookup.get(sourceWidgetId)
    const sourceKind = sourceWidget?.widgetKind || sourceWidget?.kind || sourceWidget?.type || sourceWidgetId || 'source'
    return {
      key: selection?.selectionRef || selection?.id || `${sourceWidgetId || 'selection'}-${index}`,
      sourceKind,
      summary: summarizeSelection(selection),
      field: selection?.field || selection?.predicates?.[0]?.field || null,
    }
  }).filter((selection) => selection.key)

  return (
    <WorkspaceStatusPopover
      label={`${listedSelections.length} active selections`}
      title="Active Selections"
      emptyText="No active selections."
    >
      {listedSelections.length > 0 ? (
        <ul>
          {listedSelections.map((selection) => (
            <li key={selection.key} className="active">
              <span>Active</span>
              <strong>{selection.sourceKind}.selection{selection.field ? `(${selection.field})` : ''}</strong>
              <p>{selection.summary}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </WorkspaceStatusPopover>
  )
}

function WorkspaceLinksPopover({ links = [], latestCoordinationResult = null, widgets = [] }) {
  const widgetLookup = readWidgetLookup(widgets)
  const summarizedLinks = links.map((link) => summarizeWorkspaceLink(link, widgetLookup)).filter((link) => link.key)
  const appliedRefs = readAppliedLinkRefs(latestCoordinationResult)
  const activeCount = summarizedLinks.filter((link) => link.keys.some((key) => appliedRefs.has(key))).length

  return (
    <WorkspaceStatusPopover
      label={`${summarizedLinks.length} links`}
      title="Coordination Links"
      meta={`${activeCount} used last turn`}
      emptyText="No coordination links in this workspace."
    >
      {summarizedLinks.length > 0 ? (
        <ul>
          {summarizedLinks.map((link) => {
            const active = link.keys.some((key) => appliedRefs.has(key))
            return (
              <li key={link.key} className={active ? 'active' : ''}>
                <span>{active ? 'Used' : 'Ready'}</span>
                <strong>{link.transformKind}</strong>
                <p>{link.relationLabel}</p>
                {link.field ? <em>{link.field}</em> : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </WorkspaceStatusPopover>
  )
}

export function WorkspaceStage() {
  const caseTitle = useAppStore((state) => state.caseTitle)
  const caseSummary = useAppStore((state) => state.caseSummary)
  const topology = useAppStore((state) => state.topology)
  const widgetsState = useAppStore((state) => state.widgets)
  const workspaceSourceType = useAppStore((state) => state.workspaceSourceType)
  const workspaceComposition = useAppStore((state) => state.workspaceComposition)
  const loadedVisualizationPreview = useAppStore((state) => state.loadedVisualizationPreview)
  const selectedWidgetId = useAppStore((state) => state.selectedWidgetId)
  const trace = useAppStore((state) => state.trace)
  const selectedTraceStepId = useAppStore((state) => state.selectedTraceStepId)
  const activeReplayContext = useAppStore((state) => state.activeReplayContext)
  const setSelectedWidgetId = useAppStore((state) => state.setSelectedWidgetId)
  const runtimeSessionKey = useAppStore((state) => state.runtimeSessionKey)
  const activeCaseId = useAppStore((state) => state.activeCaseId)
  const coordinationVersion = useAppStore((state) => state.coordinationVersion)
  const analyticalVersion = useAppStore((state) => state.analyticalVersion)
  const restorePreviousWorkspaceState = useAppStore((state) => state.restorePreviousWorkspaceState)
  const restoreEarliestWorkspaceState = useAppStore((state) => state.restoreEarliestWorkspaceState)
  const removeImportedWidget = useAppStore((state) => state.removeImportedWidget)
  const [restoreStatus, setRestoreStatus] = useState(null)
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
  const widgetLookup = useMemo(() => readWidgetLookup(widgets), [widgets])
  const widgetCount = widgets.length
  const singleView = widgetCount === 1
  const workspaceColumns = widgetCount <= 1 ? 1 : widgetCount <= 4 ? 2 : 3
  const activeSelections = listCoordinationSelections(coordinationState)
  const activeFilters = activeSelections.map(summarizeSelection).filter(Boolean)
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
  const showRestoreControls = !previewWorkspace && workspaceSourceType === 'importedSpec'
  const allowWidgetRemoval = !previewWorkspace && workspaceSourceType === 'importedSpec'
  const restoring = restoreStatus === 'initial' || restoreStatus === 'previous'
  const restoreWorkspace = async (kind) => {
    const restore = kind === 'initial'
      ? restoreEarliestWorkspaceState
      : restorePreviousWorkspaceState
    if (typeof restore !== 'function' || restoring) return
    setRestoreStatus(kind)
    try {
      await restore()
    } finally {
      setRestoreStatus(null)
    }
  }

  return (
    <section
      className={`workspace-stage ${(workspaceSourceType === 'importedSpec' || previewWorkspace) ? 'imported-workspace-stage' : ''}`}
      aria-label="Workspace stage"
    >
      <div className="workspace-header">
        <div>
          {singleView ? null : <p className="eyebrow">Workspace</p>}
          <h2>{previewWorkspace ? loadedVisualizationPreview.title : caseTitle}</h2>
          {singleView ? null : ((workspaceSourceType === 'importedSpec' || starterWorkspace) && caseSummary ? <p className="section-copy">{caseSummary}</p> : null)}
        </div>
        {singleView && !showRestoreControls ? null : (
          <div className="workspace-status">
            {singleView ? null : <span>{previewWorkspace ? 'single-view-preview' : topology}</span>}
            {widgetCount > 0 ? (
              <WorkspaceWidgetsPopover
                widgets={widgets}
                removable={allowWidgetRemoval}
                onRemoveWidget={removeImportedWidget}
              />
            ) : null}
            {!singleView && workspaceSourceType === 'importedSpec' ? (
              <WorkspaceLinksPopover
                links={workspaceComposition?.links || []}
                latestCoordinationResult={latestCoordinationResult}
                widgets={widgets}
              />
            ) : null}
            {!singleView && workspaceSourceType === 'importedSpec' ? (
              <WorkspaceSelectionsPopover
                selections={activeSelections}
                widgetLookup={widgetLookup}
              />
            ) : null}
            {showRestoreControls ? (
              <>
                <button
                  type="button"
                  className="workspace-status-pill workspace-status-action"
                  disabled={restoring}
                  onClick={() => restoreWorkspace('previous')}
                >
                  {restoreStatus === 'previous' ? 'Undoing...' : 'Undo view'}
                </button>
                <button
                  type="button"
                  className="workspace-status-pill workspace-status-action"
                  disabled={restoring}
                  onClick={() => restoreWorkspace('initial')}
                >
                  {restoreStatus === 'initial' ? 'Resetting...' : 'Reset view'}
                </button>
              </>
            ) : null}
            {provenance.hasReplayAnchor ? <span>{provenance.branchLabel} anchor</span> : null}
          </div>
        )}
      </div>
      {provenance.hasReplayAnchor ? (
        <div className="workspace-provenance-banner">
          <span className="workspace-provenance-pill">{provenance.branchLabel}</span>
          <strong>{provenance.focusedReplayWidgetId || 'Workspace'}</strong>
          <p>{provenance.replaySummary || 'Replay anchor active.'}</p>
        </div>
      ) : null}
      {!previewWorkspace && activeFilters.length > 0 ? (
        <div className="filter-strip">
          {activeFilters.map((filter) => <span key={filter}>{filter}</span>)}
        </div>
      ) : null}
      <div
        className={`workspace-grid topology-${topology} ${singleView ? 'single-widget' : ''} ${(workspaceSourceType === 'importedSpec' || previewWorkspace) ? 'imported-workspace-grid' : ''}`}
        style={{ '--workspace-columns': workspaceColumns }}
      >
        {widgets.map((widget) => (
          <WidgetSurface
            key={widget.id}
            widget={widget}
            runtime={runtimeSession?.runtime || null}
            singleViewMode={singleView}
            selected={previewWorkspace ? true : widget.id === selectedWidgetId}
            replayAnchored={provenance.focusedReplayWidgetId === widget.id}
            replayBranchActive={provenance.hasReplayAnchor}
            onSelect={previewWorkspace ? undefined : () => setSelectedWidgetId(widget.id)}
          />
        ))}
      </div>
    </section>
  )
}
