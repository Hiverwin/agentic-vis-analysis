import { useCallback, useEffect, useState } from 'react'
import { parseWidgetVARef, widgetRegistryDescribe, workspaceSnapshotRead } from 'widgetva-kit/transport-inspect'
import { summarizeWorkspaceState } from 'widgetva-kit/core-inspect'
import t from '../../locale.js'
import { useRuntimeStoreVersion } from './useRuntimeStoreVersion.js'
import { canInspectRuntime } from './runtimeCardAvailability.js'

async function loadRefSamples() {
  const [registry, snapshot] = await Promise.all([
    widgetRegistryDescribe(),
    workspaceSnapshotRead(),
  ])

  const focusedRef = summarizeWorkspaceState(snapshot)?.focusedWidgetRef || null
  const widgetRefs = Array.isArray(registry?.refs?.widgetRefs) ? registry.refs.widgetRefs : []
  const dataRefs = Array.isArray(registry?.refs?.dataRefs) ? registry.refs.dataRefs : []
  const candidates = [focusedRef, widgetRefs[0], dataRefs[0]].filter(Boolean)
  const uniqueCandidates = [...new Set(candidates)]
  const parsed = await Promise.all(
    uniqueCandidates.map(async (ref) => ({
      ref,
      parts: await parseWidgetVARef(ref),
    })),
  )
  return {
    focusedRef,
    parsed,
  }
}

export default function RuntimeRefCard({ runtime, currentSelection }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [snapshot, setSnapshot] = useState(null)
  const storeVersion = useRuntimeStoreVersion(runtime)

  const refresh = useCallback(async () => {
    if (!canInspectRuntime(runtime)) {
      setSnapshot(null)
      setError('')
      return
    }
    setLoading(true)
    try {
      const nextSnapshot = await loadRefSamples()
      setSnapshot(nextSnapshot)
      setError('')
    } catch (nextError) {
      setSnapshot(null)
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Ref runtime unavailable'))
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
          {t.runtimeRef}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {t.runtimeRefUnavailable}: {error}
        </div>
      ) : snapshot ? (
        <div style={{ marginTop: 6, display: 'grid', gap: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeRefFocused}</strong>{' '}
            {snapshot.focusedRef || '-'}
          </div>
          {snapshot.parsed?.length ? (
            <div style={{ display: 'grid', gap: 4, paddingLeft: 8 }}>
              {snapshot.parsed.map(({ ref, parts }) => (
                <div key={ref}>
                  <div style={{ color: 'var(--text)' }}>{ref}</div>
                  <div>
                    {parts?.kind || '-'} · {parts?.workspaceId || '-'} · {parts?.localId || '-'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>{t.runtimeRefEmpty}</div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          {t.runtimeRefEmpty}
        </div>
      )}
    </section>
  )
}
