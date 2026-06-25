import { useCallback, useEffect, useState } from 'react'
import {
  linkPropagationEvaluate,
  snapshotRead,
} from 'widgetva-kit/transport-inspect'
import t from '../../locale.js'
import { useRuntimeStoreVersion } from './useRuntimeStoreVersion.js'
import { formatRuntimeRef } from './runtimeRefs.js'
import { summarizeRuntimePropagation } from './runtimePropagationSummary.js'
import { canInspectRuntime } from './runtimeCardAvailability.js'

export default function RuntimePropagationCard({
  runtime,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)
  const storeVersion = useRuntimeStoreVersion(runtime)

  const refresh = useCallback(async () => {
    if (!canInspectRuntime(runtime)) {
      setSummary(null)
      setError('')
      return
    }

    setLoading(true)
    try {
      const snapshot = await snapshotRead({ includeMeta: true })
      const activeSelectionRefs = Object.keys(snapshot?.shared?.selections?.registry || {})
      const evaluations = activeSelectionRefs.length > 0
        ? await Promise.all(activeSelectionRefs.map((sourceRef) => linkPropagationEvaluate({ sourceRef })))
        : []
      setSummary(summarizeRuntimePropagation({ snapshot, evaluations }))
      setError('')
    } catch (nextError) {
      setSummary(null)
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Propagation unavailable'))
    } finally {
      setLoading(false)
    }
  }, [runtime])

  useEffect(() => {
    refresh()
  }, [refresh, storeVersion])

  const sources = Array.isArray(summary?.sources) ? summary.sources : []
  const propagation = summary?.propagation || null
  const failingLinks = Array.isArray(propagation?.failingLinks) ? propagation.failingLinks : []
  const targetRefs = Array.isArray(summary?.targetRefs) ? summary.targetRefs : []

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
          {t.runtimePropagation}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {t.runtimePropagationUnavailable}: {error}
        </div>
      ) : summary ? (
        <div style={{ marginTop: 6, display: 'grid', gap: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimePropagationState}</strong>{' '}
            {summary.stateId || '-'}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimePropagationSources}</strong>{' '}
            {summary.sourceCount}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimePropagationCoverage}</strong>{' '}
            {propagation?.passedCount ?? 0}/{propagation?.linkCount ?? 0}
            {typeof propagation?.consistencyScore === 'number'
              ? ` · ${t.runtimePropagationScore}: ${propagation.consistencyScore.toFixed(2)}`
              : ''}
          </div>
          {propagation?.primitives?.length > 0 ? (
            <div>
              <strong style={{ color: 'var(--text)' }}>{t.runtimePropagationPrimitives}</strong>{' '}
              {propagation.primitives.join(', ')}
            </div>
          ) : null}
          {sources.length > 0 ? (
            <div style={{ display: 'grid', gap: 4, paddingLeft: 8 }}>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimePropagationActiveSelections}</strong>
              </div>
              {sources.slice(0, 4).map((source) => (
                <div key={source.sourceRef}>
                  {formatRuntimeRef(source.sourceRef)} · {source.selectionCount}
                  {source.summary ? ` · ${source.summary}` : ''}
                </div>
              ))}
            </div>
          ) : (
            <div>{t.runtimePropagationEmpty}</div>
          )}
          {targetRefs.length > 0 ? (
            <div>
              <strong style={{ color: 'var(--text)' }}>{t.runtimePropagationTargets}</strong>{' '}
              {targetRefs.slice(0, 4).map((ref) => formatRuntimeRef(ref)).join(', ')}
            </div>
          ) : null}
          {failingLinks.length > 0 ? (
            <div style={{ display: 'grid', gap: 4, paddingLeft: 8 }}>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimePropagationFailures}</strong>
              </div>
              {failingLinks.slice(0, 3).map((entry, index) => (
                <div key={`${entry.linkId || entry.targetRef || 'failure'}-${index}`}>
                  {(entry.primitive || 'link')} · {formatRuntimeRef(entry.targetRef || '-')}
                  {entry.reason ? ` · ${entry.reason}` : ''}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          {t.runtimePropagationEmpty}
        </div>
      )}
    </section>
  )
}
