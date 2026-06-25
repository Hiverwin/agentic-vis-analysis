import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  stateHistoryRead,
  viewRead,
} from 'widgetva-kit/transport-inspect'
import { summarizeWorkspaceState } from 'widgetva-kit/core-inspect'
import t from '../../locale.js'
import { useRuntimeStoreVersion } from './useRuntimeStoreVersion.js'
import { formatRuntimeRef } from './runtimeRefs.js'
import { canInspectRuntime } from './runtimeCardAvailability.js'

export default function RuntimeViewStateCard({
  runtime,
  currentSelection,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [viewState, setViewState] = useState(null)
  const [history, setHistory] = useState([])
  const [deltaSince, setDeltaSince] = useState('')
  const storeVersion = useRuntimeStoreVersion(runtime)

  const refresh = useCallback(async (nextDeltaSince = deltaSince) => {
    if (!canInspectRuntime(runtime)) {
      setViewState(null)
      setHistory([])
      setDeltaSince('')
      setError('')
      return
    }

    setLoading(true)
    try {
      const nextHistory = await stateHistoryRead({ limit: 8 })
      const normalizedHistory = Array.isArray(nextHistory) ? nextHistory : []
      const effectiveDeltaSince = nextDeltaSince && normalizedHistory.some((entry) => entry?.stateId === nextDeltaSince)
        ? nextDeltaSince
        : ''
      const nextViewState = await viewRead(
        effectiveDeltaSince
          ? { deltaSince: effectiveDeltaSince }
          : {},
      )
      setHistory(normalizedHistory)
      setDeltaSince(effectiveDeltaSince)
      setViewState(nextViewState || null)
      setError('')
    } catch (nextError) {
      setViewState(null)
      setHistory([])
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'View state unavailable'))
    } finally {
      setLoading(false)
    }
  }, [runtime, deltaSince])

  useEffect(() => {
    refresh('')
  }, [refresh, storeVersion])

  const stateSummary = useMemo(() => summarizeWorkspaceState(viewState), [viewState])
  const focusedWidget = useMemo(() => {
    const focusedWidgetRef = stateSummary?.focusedWidgetRef || null
    if (!focusedWidgetRef) return null
    return viewState?.widgets?.[focusedWidgetRef] || null
  }, [stateSummary, viewState])
  const delta = viewState?.delta || null
  const changedRefs = Array.isArray(delta?.changedRefs) ? delta.changedRefs : []
  const removedRefs = Array.isArray(delta?.removedRefs) ? delta.removedRefs : []
  const sharedChanged = stateSummary?.sharedChanged || false
  const taskContextChanged = stateSummary?.taskContextChanged || false
  const replayContextChanged = stateSummary?.replayContextChanged || false
  const selectionCount = stateSummary?.selectionCount ?? 0
  const annotationCount = stateSummary?.annotationCount ?? 0
  const comparisonCount = stateSummary?.comparisonTargetCount ?? 0
  const globalFilterCount = stateSummary?.globalFilterCount ?? 0
  const taskContext = viewState?.taskContext || null
  const replayContext = viewState?.replayContext || null
  const transformKinds = Array.isArray(focusedWidget?.transforms)
    ? focusedWidget.transforms.map((transform) => transform?.kind).filter(Boolean).slice(0, 4)
    : []
  const encodingEntries = Object.entries(focusedWidget?.encodings || {}).slice(0, 4)

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
          {t.runtimeViewState}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void refresh(deltaSince)} disabled={loading}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {t.runtimeViewStateUnavailable}: {error}
        </div>
      ) : viewState ? (
        <div style={{ marginTop: 6, display: 'grid', gap: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeViewStateId}</strong>{' '}
            {viewState.stateId || '-'}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeViewStateSelections}</strong>{' '}
            {selectionCount}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeViewStateFocused}</strong>{' '}
            {stateSummary?.focusedWidgetKind || focusedWidget?.kind || '-'} · {stateSummary?.focusedWidgetRef || focusedWidget?.ref || '-'}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeViewStateShared}</strong>{' '}
            {[
              `${t.runtimeViewStateSelections}: ${selectionCount}`,
              `${t.runtimeViewStateAnnotations}: ${annotationCount}`,
              `${t.runtimeViewStateComparison}: ${comparisonCount}`,
              `${t.runtimeViewStateGlobalFilters}: ${globalFilterCount}`,
            ].join(' · ')}
            {sharedChanged ? ` · ${t.runtimeViewStateDeltaChanged}` : ''}
          </div>
          {taskContext ? (
            <div>
              <strong style={{ color: 'var(--text)' }}>{t.runtimeViewStateTaskContext}</strong>{' '}
              {[taskContext.taskMode, taskContext.coordinationScope, taskContext.evidenceType, taskContext.interactionHorizon]
                .filter(Boolean)
                .join(' · ') || '-'}
              {taskContextChanged ? ` · ${t.runtimeViewStateDeltaChanged}` : ''}
            </div>
          ) : null}
          {replayContext ? (
            <div>
              <strong style={{ color: 'var(--text)' }}>{t.runtimeViewStateReplayContext}</strong>{' '}
              {[replayContext.runMode, replayContext.userIntent].filter(Boolean).join(' · ') || '-'}
              {replayContextChanged ? ` · ${t.runtimeViewStateDeltaChanged}` : ''}
            </div>
          ) : null}

          <div style={{ display: 'grid', gap: 4 }}>
            <div>
              <strong style={{ color: 'var(--text)' }}>{t.runtimeViewStateDeltaBase}</strong>
            </div>
            <select
              value={deltaSince}
              onChange={(event) => {
                const nextValue = event.target.value
                setDeltaSince(nextValue)
                void refresh(nextValue)
              }}
              style={{
                width: '100%',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                padding: '6px 8px',
              }}
            >
              <option value="">{t.runtimeViewStateDeltaCurrent}</option>
              {history.map((entry) => (
                <option key={entry.stateId} value={entry.stateId}>
                  {entry.stateId} · {entry.transitionType || 'continue'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeViewStateChangedRefs}</strong>{' '}
            {changedRefs.length ? changedRefs.map((ref) => formatRuntimeRef(ref)).join(', ') : '-'}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeViewStateRemovedRefs}</strong>{' '}
            {removedRefs.length ? removedRefs.map((ref) => formatRuntimeRef(ref)).join(', ') : '-'}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeViewStateRows}</strong>{' '}
            {stateSummary?.visibleCount ?? focusedWidget?.data?.visibleCount ?? focusedWidget?.data?.rowCount ?? '-'}
            {' / '}
            {stateSummary?.selectedCount ?? focusedWidget?.data?.selectedCount ?? 0}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeViewStateTransforms}</strong>{' '}
            {transformKinds.join(', ') || '-'}
          </div>
          {encodingEntries.length > 0 ? (
            <div style={{ display: 'grid', gap: 4, paddingLeft: 8 }}>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeViewStateEncodings}</strong>
              </div>
              {encodingEntries.map(([channel, encoding]) => (
                <div key={channel}>
                  {channel}: {encoding?.field || '-'} / {encoding?.type || '-'}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          {t.runtimeViewStateEmpty}
        </div>
      )}
    </section>
  )
}
