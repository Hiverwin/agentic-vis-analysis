import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { interactionTraceRead } from 'widgetva-kit/transport-inspect'
import { summarizeInteractionTraceRecord } from 'widgetva-kit/core-inspect'
import t from '../../locale.js'
import { formatRuntimeRef } from './runtimeRefs.js'
import { canInspectRuntime } from './runtimeCardAvailability.js'

export default function RuntimeTraceCard({
  runtime,
  currentSelection,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [records, setRecords] = useState([])
  const storeVersion = useSyncExternalStore(
    (onStoreChange) => runtime?.store?.subscribe?.(onStoreChange) || (() => {}),
    () => runtime?.store?.version || 0,
    () => 0,
  )

  const refresh = useCallback(async () => {
    if (!canInspectRuntime(runtime)) {
      setRecords([])
      setError('')
      return
    }

    setLoading(true)
    try {
      const nextRecords = await interactionTraceRead({ limit: 8 })
      setRecords(Array.isArray(nextRecords) ? nextRecords : [])
      setError('')
    } catch (nextError) {
      setRecords([])
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Trace unavailable'))
    } finally {
      setLoading(false)
    }
  }, [runtime])

  useEffect(() => {
    refresh()
  }, [refresh, storeVersion])

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
          {t.runtimeTrace}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {t.runtimeTraceUnavailable}: {error}
        </div>
      ) : records.length > 0 ? (
        <div style={{ marginTop: 6, display: 'grid', gap: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          {records.slice(-5).reverse().map((record, index) => {
            const summary = summarizeInteractionTraceRecord(record)
            if (!summary) return null

            return (
            <div
              key={`${record.stateId || 'state'}-${record.timestamp || index}`}
              style={{
                display: 'grid',
                gap: 3,
                padding: '6px 8px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface)',
              }}
            >
              <div>
                <strong style={{ color: 'var(--text)' }}>{summary.eventFamily || record.eventKind || 'event'}</strong>
                {summary.querySurface ? `:${summary.querySurface}` : ''}
                {' '}· {summary.displayName} · {summary.actor}
              </div>
              <div>
                {summary.stateId || '-'} · {summary.branchId || 'main'}
                {summary.parentStateId ? ` · ${t.runtimeTraceParent} ${summary.parentStateId}` : ''}
                {summary.primitive ? ` · ${summary.primitive}` : ''}
              </div>
              <div>
                {t.runtimeTraceOutcome}: {summary.outcome}
                {summary.errorCode ? ` · ${summary.errorCode}` : ''}
              </div>
              {Array.isArray(summary.affectedRefs) && summary.affectedRefs.length > 0 ? (
                <div>{t.runtimeTraceRefs}: {summary.affectedRefs.map((ref) => formatRuntimeRef(ref)).join(', ')}</div>
              ) : null}
              {summary.userVisibleSummary ? (
                <div>{summary.userVisibleSummary}</div>
              ) : null}
              {summary.verification ? (
                <div>{t.runtimeTraceVerification}: {summary.verification}</div>
              ) : null}
              {summary.rationale ? (
                <div>{t.runtimeTraceRationale}: {summary.rationale}</div>
              ) : null}
              {summary.errorMessage ? (
                <div>{summary.errorMessage}</div>
              ) : null}
              {summary.details ? (
                <div>{t.runtimeTraceDetails}: {JSON.stringify(summary.details)}</div>
              ) : null}
              {summary.recoveryHints.length > 0 ? (
                <div>{t.runtimeTraceRecovery}: {summary.recoveryHints.join(' · ')}</div>
              ) : null}
            </div>
            )
          })}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          {t.runtimeTraceEmpty}
        </div>
      )}
    </section>
  )
}
