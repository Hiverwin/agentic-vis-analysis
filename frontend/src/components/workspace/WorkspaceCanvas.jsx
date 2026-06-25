import { useMemo } from 'react'
import ChartCanvas from './ChartCanvas.jsx'
import RuntimeAdapterCard from '../devtools/RuntimeAdapterCard.jsx'
import RuntimeActionCatalogCard from '../devtools/RuntimeActionCatalogCard.jsx'
import RuntimeActionRunnerCard from '../devtools/RuntimeActionRunnerCard.jsx'
import RuntimeDataQueryCard from '../devtools/RuntimeDataQueryCard.jsx'
import RuntimeDataQueryRunnerCard from '../devtools/RuntimeDataQueryRunnerCard.jsx'
import RuntimeHistoryCard from '../devtools/RuntimeHistoryCard.jsx'
import RuntimeLinkMapCard from '../devtools/RuntimeLinkMapCard.jsx'
import RuntimePageApiCard from '../devtools/RuntimePageApiCard.jsx'
import RuntimePropagationCard from '../devtools/RuntimePropagationCard.jsx'
import RuntimePerceptionCatalogCard from '../devtools/RuntimePerceptionCatalogCard.jsx'
import RuntimePlannerCard from '../devtools/RuntimePlannerCard.jsx'
import RuntimeTraceCard from '../devtools/RuntimeTraceCard.jsx'
import RuntimeVerificationCard from '../devtools/RuntimeVerificationCard.jsx'
import RuntimePerceptionCard from '../devtools/RuntimePerceptionCard.jsx'
import RuntimePerceptionRunnerCard from '../devtools/RuntimePerceptionRunnerCard.jsx'
import RuntimeRefCard from '../devtools/RuntimeRefCard.jsx'
import RuntimeViewStateCard from '../devtools/RuntimeViewStateCard.jsx'
import TableCanvas from './TableCanvas.jsx'
import RuntimeInspectorCard from '../devtools/RuntimeInspectorCard.jsx'
import { useRuntimeStoreVersion } from '../devtools/useRuntimeStoreVersion.js'
import {
  readWorkspaceDescriptionFromStore,
  readWorkspaceStateFromStore,
} from 'widgetva-kit/core-inspect'
import {
  resolveWidgetLayout,
  resolveWorkspaceCanvasWorkspace,
  shouldRenderWorkspaceCanvasPlaceholder,
} from '../workspaceCanvasModel.js'

function WidgetCard({
  runtime,
  widgetRef,
  widgetState,
  title,
  subtitle,
  spec,
  selectionEnabled,
  selectionSourceWidgetId,
  interactionConfig,
  onActionCall,
  onSelectionChange,
}) {
  const widgetKind = widgetState?.kind || null
  return (
    <section
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface2)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          padding: '8px 10px',
          borderBottom: '1px solid var(--border)',
          background: '#eef2f7',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        {subtitle ? (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.35 }}>{subtitle}</div>
        ) : null}
      </div>
      <div style={{ minHeight: 220, position: 'relative', padding: 10 }}>
        {widgetKind === 'table' ? (
          <TableCanvas
            runtime={runtime}
            widgetRef={widgetRef}
            widgetState={widgetState}
            compact={true}
            interactionConfig={interactionConfig}
            onActionCall={onActionCall}
          />
        ) : (
          <ChartCanvas
            runtime={runtime}
            widgetRef={widgetRef}
            widgetState={widgetState}
            spec={spec}
            compact={true}
            selectionEnabled={selectionEnabled}
            selectionSourceWidgetId={selectionSourceWidgetId}
            interactionConfig={interactionConfig}
            onActionCall={onActionCall}
            onSelectionChange={onSelectionChange}
          />
        )}
      </div>
    </section>
  )
}

export default function WorkspaceCanvas({
  runtime = null,
  spec,
  workspaceSpec = null,
  planningRequest = null,
  selectionEnabled = false,
  onActionCall,
  onSelectionChange,
  currentSelection = null,
  currentSelections = null,
}) {
  const storeVersion = useRuntimeStoreVersion(runtime)
  const runtimeStoreSnapshot = useMemo(() => {
    const store = runtime?.store
    if (!store || (
      typeof store.readDescription !== 'function'
      && typeof store.readState !== 'function'
      && !(store.appId || store.workspaceId)
    )) return null
    return {
      description: readWorkspaceDescriptionFromStore(store),
      state: readWorkspaceStateFromStore(store),
      version: storeVersion,
    }
  }, [runtime, storeVersion])

  const workspace = useMemo(() => {
    return resolveWorkspaceCanvasWorkspace({
      runtimeStoreSnapshot,
      spec,
      workspaceSpec,
      planningRequest,
      currentSelection,
      currentSelections,
    })
  }, [runtimeStoreSnapshot, spec, workspaceSpec, planningRequest, currentSelection, currentSelections])

  const widgetDescriptions = Array.isArray(workspace?.description?.widgets) ? workspace.description.widgets : []
  const widgetStatesByRef = workspace?.state?.widgets || {}
  const focusedWidgetRef = workspace?.state?.shared?.focusedWidget || null
  const { primaryWidget, secondaryWidgets } = useMemo(
    () => resolveWidgetLayout(widgetDescriptions, widgetStatesByRef, focusedWidgetRef),
    [widgetDescriptions, widgetStatesByRef, focusedWidgetRef],
  )
  const primaryWidgetKind = primaryWidget?.state?.kind || null

  if (shouldRenderWorkspaceCanvasPlaceholder({ spec, primaryWidget })) {
    return (
      <ChartCanvas
        spec={spec}
        selectionEnabled={selectionEnabled}
        onSelectionChange={onSelectionChange}
      />
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 300px',
        gap: 10,
        height: '100%',
        minHeight: 0,
        background: 'var(--surface)',
      }}
    >
      <div style={{ minWidth: 0, minHeight: 0 }}>
        {primaryWidgetKind === 'table' ? (
          <TableCanvas
            runtime={runtime}
            widgetRef={primaryWidget?.description?.ref || null}
            widgetState={primaryWidget?.state || null}
            interactionConfig={primaryWidget?.description?.humanInteraction || primaryWidget?.state?.humanInteraction || null}
            onActionCall={onActionCall}
          />
        ) : (
          <ChartCanvas
            runtime={runtime}
            widgetRef={primaryWidget?.description?.ref || null}
            widgetState={primaryWidget?.state || null}
            spec={primaryWidget?.state?.rawSpec || spec}
            selectionEnabled={selectionEnabled}
            selectionSourceWidgetId={primaryWidget?.state?.widgetId || null}
            interactionConfig={primaryWidget?.description?.humanInteraction || primaryWidget?.state?.humanInteraction || null}
            onActionCall={onActionCall}
            onSelectionChange={onSelectionChange}
          />
        )}
      </div>

      <aside
        style={{
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '10px 10px 10px 0',
          overflowY: 'auto',
        }}
      >
        <RuntimeInspectorCard
          sessionId={workspace?.description?.sessionId || null}
          runtime={runtime}
          currentSelection={currentSelection}
        />

        <RuntimeAdapterCard
          runtime={runtime}
          currentSelection={currentSelection}
        />

        <RuntimeActionCatalogCard
          runtime={runtime}
          currentSelection={currentSelection}
        />

        <RuntimeActionRunnerCard
          runtime={runtime}
          currentSelection={currentSelection}
        />

        <RuntimePerceptionCatalogCard
          runtime={runtime}
          currentSelection={currentSelection}
        />

        <RuntimePerceptionRunnerCard
          runtime={runtime}
          currentSelection={currentSelection}
        />

        <RuntimePageApiCard
          runtime={runtime}
        />

        <RuntimeRefCard
          runtime={runtime}
          currentSelection={currentSelection}
        />

        <RuntimePlannerCard
          runtime={runtime}
          planningRequest={planningRequest}
        />

        <RuntimeLinkMapCard
          runtime={runtime}
          currentSelection={currentSelection}
        />

        <RuntimePropagationCard
          runtime={runtime}
        />

        <RuntimeHistoryCard
          runtime={runtime}
          currentSelection={currentSelection}
        />

        <RuntimeViewStateCard
          runtime={runtime}
          currentSelection={currentSelection}
        />

        <RuntimeTraceCard
          runtime={runtime}
          currentSelection={currentSelection}
        />

        <RuntimeVerificationCard
          runtime={runtime}
          currentSelection={currentSelection}
        />

        <RuntimePerceptionCard
          runtime={runtime}
          currentSelection={currentSelection}
        />

        <RuntimeDataQueryCard
          runtime={runtime}
          currentSelection={currentSelection}
        />

        <RuntimeDataQueryRunnerCard
          runtime={runtime}
          currentSelection={currentSelection}
        />

        <div
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface2)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', color: 'var(--accent)' }}>
            Widget Workspace
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
            当前页面已按 workspace 方式暴露为多个独立 widget，并通过显式 link 协调。
          </div>
        </div>

        {secondaryWidgets.map(({ state: widget, description }) => (
          <WidgetCard
            key={widget.ref}
            runtime={runtime}
            widgetRef={description?.ref || widget.ref}
            widgetState={widget}
            title={widget.rawSpec?.title || widget.ref.split('/').pop()}
            subtitle={Array.isArray(widget.feedback?.inboundLinkIds) && widget.feedback.inboundLinkIds.length > 0
              ? 'Linked by workspace relation'
              : 'Independent workspace widget'}
            spec={widget.rawSpec}
            selectionEnabled={selectionEnabled}
            selectionSourceWidgetId={widget.widgetId || null}
            interactionConfig={description?.humanInteraction || widget?.humanInteraction || null}
            onActionCall={onActionCall}
            onSelectionChange={onSelectionChange}
          />
        ))}
      </aside>
    </div>
  )
}
