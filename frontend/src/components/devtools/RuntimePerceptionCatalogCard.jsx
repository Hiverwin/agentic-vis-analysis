import { useCallback, useEffect, useState } from 'react'
import { workspaceDescribe } from 'widgetva-kit/transport-inspect'
import t from '../../locale.js'
import { useRuntimeStoreVersion } from './useRuntimeStoreVersion.js'
import { formatRuntimeDataHandleLabel } from './runtimeDataHandles.js'
import { canInspectRuntime } from './runtimeCardAvailability.js'

export default function RuntimePerceptionCatalogCard({
  runtime,
  currentSelection,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [queries, setQueries] = useState([])
  const [dataHandles, setDataHandles] = useState({})
  const storeVersion = useRuntimeStoreVersion(runtime)

  const refresh = useCallback(async () => {
    if (!canInspectRuntime(runtime)) {
      setQueries([])
      setDataHandles({})
      setError('')
      return
    }

    setLoading(true)
    try {
      const description = await workspaceDescribe({
        includeSchemas: false,
        includeExamples: true,
      })
      setQueries(Array.isArray(description?.perceptionQueries) ? description.perceptionQueries : [])
      setDataHandles(
        Object.fromEntries(
          (Array.isArray(description?.dataHandles) ? description.dataHandles : [])
            .filter((handle) => typeof handle?.ref === 'string')
            .map((handle) => [handle.ref, handle]),
        ),
      )
      setError('')
    } catch (nextError) {
      setQueries([])
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Perception catalog unavailable'))
    } finally {
      setLoading(false)
    }
  }, [runtime])

  useEffect(() => {
    refresh()
  }, [refresh, storeVersion])

  const visibleQueries = queries.slice(0, 6)

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
          {t.runtimePerceptionCatalog}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {t.runtimePerceptionCatalogUnavailable}: {error}
        </div>
      ) : visibleQueries.length > 0 ? (
        <div style={{ marginTop: 6, display: 'grid', gap: 8, fontSize: 11, color: 'var(--text-dim)' }}>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionCatalogCount}</strong>{' '}
            {queries.length}
          </div>
          {visibleQueries.map((query) => (
            <div
              key={`${query.name}:${query.targetRef || 'workspace'}`}
              style={{
                display: 'grid',
                gap: 4,
                padding: '6px 8px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface)',
              }}
            >
              <div>
                <strong style={{ color: 'var(--text)' }}>{query.name}</strong>
                {' '}· {query.category || '-'}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionCatalogTarget}</strong>{' '}
                {query.targetRef
                  ? formatRuntimeDataHandleLabel(dataHandles[query.targetRef] || { ref: query.targetRef })
                  : '-'}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionCatalogEvidence}</strong>{' '}
                {(query.evidenceKinds || []).slice(0, 3).join(', ') || '-'}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionCatalogReturns}</strong>{' '}
                {Object.keys(query.returnsSchema?.properties || {}).slice(0, 3).join(', ') || '-'}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionCatalogVerification}</strong>{' '}
                {(query.verificationTargets || []).slice(0, 2).join(', ') || '-'}
              </div>
              {query.examples?.[0]?.userGoal ? (
                <div>
                  <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionCatalogExample}</strong>{' '}
                  {query.examples[0].userGoal}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          {t.runtimePerceptionCatalogEmpty}
        </div>
      )}
    </section>
  )
}
