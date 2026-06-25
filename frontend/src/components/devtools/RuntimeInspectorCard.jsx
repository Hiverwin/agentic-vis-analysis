import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import {
  actionContextDescribe,
  actionExecutorDescribe,
  dataQueryContextDescribe,
  dataQueryEngineDescribe,
  dataQueryExecutorDescribe,
  linkEngineDescribe,
  perceptionContextDescribe,
  perceptionRegistryDescribe,
  responseRecorderDescribe,
  runtimeCoreDescribe,
  runtimeStoreDescribe,
  stateManagerDescribe,
  traceRecorderDescribe,
  widgetRegistryDescribe,
  workspaceDescribe,
} from 'widgetva-kit/transport-inspect'
import t from '../../locale.js'
import { canInspectRuntime } from './runtimeCardAvailability.js'

function summarizeProviders(adapters) {
  const counts = new Map()
  for (const adapter of adapters || []) {
    const provider = adapter?.provider || 'custom'
    counts.set(provider, (counts.get(provider) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([provider, count]) => `${provider} × ${count}`)
    .join(', ')
}

export default function RuntimeInspectorCard({
  sessionId,
  runtime,
  currentSelection,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [snapshot, setSnapshot] = useState(null)
  const storeVersion = useSyncExternalStore(
    (onStoreChange) => runtime?.store?.subscribe?.(onStoreChange) || (() => {}),
    () => runtime?.store?.version || 0,
    () => 0,
  )

  const refresh = useCallback(async () => {
    if (!canInspectRuntime(runtime)) {
      setSnapshot(null)
      setError('')
      return
    }
    setLoading(true)
    try {
      const [
        workspace,
        core,
        store,
        registry,
        actionExecutor,
        actionContext,
        perceptionRegistry,
        perceptionContext,
        dataQueryEngine,
        dataQueryExecutor,
        dataQueryContext,
        stateManager,
        traceRecorder,
        responseRecorder,
        linkEngine,
      ] = await Promise.all([
        workspaceDescribe({ includeSchemas: false, includeExamples: false }),
        runtimeCoreDescribe(),
        runtimeStoreDescribe(),
        widgetRegistryDescribe(),
        actionExecutorDescribe(),
        actionContextDescribe(),
        perceptionRegistryDescribe(),
        perceptionContextDescribe(),
        dataQueryEngineDescribe(),
        dataQueryExecutorDescribe(),
        dataQueryContextDescribe(),
        stateManagerDescribe(),
        traceRecorderDescribe(),
        responseRecorderDescribe(),
        linkEngineDescribe(),
      ])

      setSnapshot({
        workspace,
        core,
        store,
        registry,
        actionExecutor,
        actionContext,
        perceptionRegistry,
        perceptionContext,
        dataQueryEngine,
        dataQueryExecutor,
        dataQueryContext,
        stateManager,
        traceRecorder,
        responseRecorder,
        linkEngine,
      })
      setError('')
    } catch (nextError) {
      setSnapshot(null)
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Runtime unavailable'))
    } finally {
      setLoading(false)
    }
  }, [runtime])

  useEffect(() => {
    refresh()
  }, [refresh, sessionId, storeVersion])

  const widgetCount = snapshot?.workspace?.widgets?.length || 0
  const linkCount = snapshot?.workspace?.links?.length || 0
  const runtimeTopology = snapshot?.workspace?.runtimeTopology || snapshot?.linkEngine?.topology || null
  const topology = runtimeTopology?.topology || snapshot?.workspace?.topology || snapshot?.workspace?.planning?.topology || 'T1'
  const planningStatus = snapshot?.workspace?.workspaceSpecStatus || snapshot?.workspace?.planning?.status || 'idle'
  const providerSummary = summarizeProviders(snapshot?.workspace?.widgetAdapters || [])
  const linkPrimitiveCount = snapshot?.linkEngine?.primitives?.length || 0
  const registryWidgetCount = snapshot?.registry?.counts?.widgetCount ?? 0
  const registryDataHandleCount = snapshot?.registry?.counts?.dataHandleCount ?? 0
  const currentStateSummary = snapshot?.store?.currentStateSummary || null
  const generatedStateCount = snapshot?.stateManager?.counters?.generatedStateCount ?? 0
  const lastGeneratedStateId = snapshot?.stateManager?.counters?.lastGeneratedStateId || null
  const traceCount = snapshot?.traceRecorder?.counters?.traceCount ?? 0
  const latestTraceStateId = snapshot?.traceRecorder?.counters?.latestStateId || null
  const latestTraceBranchId = snapshot?.traceRecorder?.counters?.latestBranchId || null
  const traceEventKindCount = snapshot?.traceRecorder?.eventKinds?.length ?? 0
  const responseCount = snapshot?.responseRecorder?.counters?.responseCount ?? 0
  const responseWorkspaceId = snapshot?.responseRecorder?.counters?.workspaceId || null
  const latestResponseId = snapshot?.responseRecorder?.counters?.latestResponseId || null
  const latestResponseRunId = snapshot?.responseRecorder?.counters?.latestRunId || null
  const latestResponseActor = snapshot?.responseRecorder?.counters?.latestActor || null
  const latestResponseMode = snapshot?.responseRecorder?.counters?.latestMode || null
  const latestResponseEvidenceRefCount = snapshot?.responseRecorder?.counters?.latestEvidenceRefCount ?? 0
  const actionCount = snapshot?.actionExecutor?.counts?.handlerCount ?? 0
  const actionContextMethodCount = snapshot?.actionContext?.methods?.length ?? 0
  const perceptionCount = snapshot?.perceptionRegistry?.counts?.handlerEntryCount ?? 0
  const perceptionContextMethodCount = snapshot?.perceptionContext?.methods?.length ?? 0
  const queryKindCount = snapshot?.dataQueryExecutor?.counts?.supportedQueryKindCount ?? 0
  const dataQueryContextMethodCount = snapshot?.dataQueryContext?.methods?.length ?? 0
  const queryEngineKind = snapshot?.dataQueryEngine?.engine?.kind || '-'
  const stateId = snapshot?.store?.state?.stateId || null
  const branchId = snapshot?.store?.state?.currentBranchId || null
  const version = snapshot?.store?.state?.version ?? 0
  const snapshotRetention = snapshot?.store?.history?.retention?.snapshotMax ?? snapshot?.store?.history?.maxSnapshotRetention ?? 0
  const traceRetention = snapshot?.store?.history?.retention?.traceMax ?? snapshot?.store?.history?.maxTraceRetention ?? 0
  const planningRequest = snapshot?.workspace?.planning?.planningRequest || null
  const planningContract = snapshot?.workspace?.planning || null
  const plannerSummary = snapshot?.workspace?.planning?.planner || null
  const taskContext = snapshot?.workspace?.taskContext || null
  const transportHints = snapshot?.workspace?.transportHints || null

  return (
    <section
      style={{
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--surface2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', color: 'var(--accent)' }}>
          {t.runtimeInspector}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {t.runtimeInspectorUnavailable}: {error}
        </div>
      ) : snapshot ? (
        <div style={{ marginTop: 6, display: 'grid', gap: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeInspectorWorkspace}</strong> {topology} · {widgetCount} {t.runtimeInspectorWidgets} · {linkCount} {t.runtimeInspectorLinks}
            {runtimeTopology?.topologyLabel ? ` · ${runtimeTopology.topologyLabel}` : ''}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeInspectorPlanning}</strong> {planningStatus}
            {stateId ? ` · ${t.runtimeInspectorState} ${stateId}` : ''}
            {branchId ? ` · ${t.runtimeInspectorBranch} ${branchId}` : ''}
            {Number.isFinite(version) ? ` · ${t.runtimeInspectorVersion} ${version}` : ''}
          </div>
          {currentStateSummary?.focusedWidgetRef ? (
            <div>
              <strong style={{ color: 'var(--text)' }}>{t.runtimeInspectorFocused}</strong>{' '}
              {[currentStateSummary.focusedWidgetKind, currentStateSummary.focusedWidgetRef].filter(Boolean).join(' · ')}
              {Number.isFinite(currentStateSummary.selectionCount) ? ` · ${currentStateSummary.selectionCount} selections` : ''}
            </div>
          ) : null}
          {(planningRequest?.runMode || planningRequest?.complexityBudget || planningRequest?.preferredTopology) ? (
            <div>
              <strong style={{ color: 'var(--text)' }}>{t.runtimeInspectorPlannerRequest}</strong>{' '}
              {[planningRequest?.runMode, planningRequest?.complexityBudget, planningRequest?.preferredTopology].filter(Boolean).join(' · ')}
            </div>
          ) : null}
          {Array.isArray(planningContract?.supportedTopologies) && planningContract.supportedTopologies.length > 0 ? (
            <div>
              <strong style={{ color: 'var(--text)' }}>{t.runtimeInspectorPlannerContract}</strong>{' '}
              {planningContract.supportedTopologies.join(' · ')}
              {Array.isArray(planningContract?.supportedRunModes) && planningContract.supportedRunModes.length > 0
                ? ` · ${planningContract.supportedRunModes.length} run modes`
                : ''}
              {Array.isArray(planningContract?.supportedComplexityBudgets) && planningContract.supportedComplexityBudgets.length > 0
                ? ` · ${planningContract.supportedComplexityBudgets.length} budgets`
                : ''}
            </div>
          ) : null}
          {(taskContext?.taskMode || taskContext?.coordinationScope || taskContext?.evidenceType || taskContext?.interactionHorizon) ? (
            <div>
              <strong style={{ color: 'var(--text)' }}>{t.runtimeInspectorTaskContext}</strong>{' '}
              {[taskContext?.taskMode, taskContext?.coordinationScope, taskContext?.evidenceType, taskContext?.interactionHorizon].filter(Boolean).join(' · ')}
            </div>
          ) : null}
          {(plannerSummary?.topology || plannerSummary?.planningMode) ? (
            <div>
              <strong style={{ color: 'var(--text)' }}>{t.runtimeInspectorPlannerOutput}</strong>{' '}
              {[
                plannerSummary?.title,
                plannerSummary?.topology,
                plannerSummary?.planningMode,
                plannerSummary?.primaryWidgetId,
                Array.isArray(plannerSummary?.widgets) ? `${plannerSummary.widgets.length} widgets` : null,
                Array.isArray(plannerSummary?.links) ? `${plannerSummary.links.length} links` : null,
              ].filter(Boolean).join(' · ')}
            </div>
          ) : null}
          {Array.isArray(transportHints?.recommendedTools) && transportHints.recommendedTools.length > 0 ? (
            <div>
              <strong style={{ color: 'var(--text)' }}>{t.runtimeInspectorTransport}</strong>{' '}
              {transportHints.recommendedTools.join(' · ')}
            </div>
          ) : null}
          {Array.isArray(transportHints?.optionalTools) && transportHints.optionalTools.length > 0 ? (
            <div>
              <strong style={{ color: 'var(--text)' }}>{t.runtimeInspectorOptionalTransport}</strong>{' '}
              {transportHints.optionalTools.join(' · ')}
            </div>
          ) : null}
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeInspectorCore}</strong>{' '}
            {snapshot.core?.registries?.actionHandlerCount ?? 0} actions · {snapshot.core?.registries?.perceptionHandlerCount ?? 0} queries · {snapshot.core?.registries?.dataQueryKindCount ?? 0} data kinds
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeInspectorStore}</strong>{' '}
            {snapshot.store?.history?.snapshotCount ?? 0} snapshots · {snapshot.store?.history?.traceCount ?? 0} traces · {snapshot.store?.history?.branchCount ?? 0} branches
            {(snapshotRetention || traceRetention) ? ` · ${t.runtimeInspectorRetention} ${snapshotRetention}/${traceRetention}` : ''}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeInspectorRegistry}</strong>{' '}
            {registryWidgetCount} {t.runtimeInspectorWidgets} · {registryDataHandleCount} {t.runtimeInspectorDataHandles}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeInspectorTransitions}</strong>{' '}
            {generatedStateCount} states · {traceCount} trace records
            {lastGeneratedStateId ? ` · ${t.runtimeInspectorLastState} ${lastGeneratedStateId}` : ''}
            {latestTraceStateId ? ` · ${t.runtimeInspectorLatestTrace} ${latestTraceStateId}` : ''}
            {latestTraceBranchId ? ` · ${latestTraceBranchId}` : ''}
            {traceEventKindCount ? ` · ${traceEventKindCount} ${t.runtimeInspectorEventKinds}` : ''}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeInspectorResponses}</strong>{' '}
            {responseCount}
            {responseWorkspaceId ? ` · ${responseWorkspaceId}` : ''}
            {latestResponseId ? ` · ${t.runtimeInspectorLatestResponse} ${latestResponseId}` : ''}
            {latestResponseRunId ? ` · ${latestResponseRunId}` : ''}
            {latestResponseActor ? ` · ${latestResponseActor}` : ''}
            {latestResponseMode ? ` · ${latestResponseMode}` : ''}
            {latestResponseEvidenceRefCount > 0 ? ` · ${latestResponseEvidence} ${latestResponseEvidenceRefCount}` : ''}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeInspectorExecutors}</strong>{' '}
            {actionCount} actions · {actionContextMethodCount} {t.runtimeInspectorActionContext} · {perceptionCount} perception handlers · {perceptionContextMethodCount} {t.runtimeInspectorPerceptionContext} · {queryKindCount} data kinds · {dataQueryContextMethodCount} {t.runtimeInspectorDataQueryContext} · {queryEngineKind} engine
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeInspectorLinkEngine}</strong>{' '}
            {linkPrimitiveCount} primitives
            {Array.isArray(snapshot.linkEngine?.primitives) && snapshot.linkEngine.primitives.length > 0
              ? ` · ${snapshot.linkEngine.primitives.join(', ')}`
              : ''}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeInspectorAdapters}</strong>{' '}
            {providerSummary || '-'}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          {t.runtimeInspectorEmpty}
        </div>
      )}
    </section>
  )
}
