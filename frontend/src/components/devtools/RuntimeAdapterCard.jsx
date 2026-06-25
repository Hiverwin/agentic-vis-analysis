import { useCallback, useEffect, useState } from 'react'
import { workspaceDescribe } from 'widgetva-kit/transport-inspect'
import t from '../../locale.js'
import { useRuntimeStoreVersion } from './useRuntimeStoreVersion.js'
import { canInspectRuntime } from './runtimeCardAvailability.js'

export default function RuntimeAdapterCard({
  runtime,
  currentSelection,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [adapters, setAdapters] = useState([])
  const storeVersion = useRuntimeStoreVersion(runtime)

  const refresh = useCallback(async () => {
    if (!canInspectRuntime(runtime)) {
      setAdapters([])
      setError('')
      return
    }

    setLoading(true)
    try {
      const workspace = await workspaceDescribe({ includeSchemas: false, includeExamples: false })
      setAdapters(Array.isArray(workspace?.widgetAdapters) ? workspace.widgetAdapters : [])
      setError('')
    } catch (nextError) {
      setAdapters([])
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Adapter introspection unavailable'))
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
          {t.runtimeAdapter}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {t.runtimeAdapterUnavailable}: {error}
        </div>
      ) : adapters.length > 0 ? (
        <div style={{ marginTop: 6, display: 'grid', gap: 8, fontSize: 11, color: 'var(--text-dim)' }}>
          {adapters.slice(0, 4).map((adapter) => (
            <div
              key={adapter.widgetRef}
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
                <strong style={{ color: 'var(--text)' }}>{adapter.title || adapter.kind || 'widget'}</strong>
                {' '}· {adapter.provider || 'custom'} · {adapter.widgetRef}
              </div>
              {adapter.description ? (
                <div>{adapter.description}</div>
              ) : null}
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeAdapterData}</strong>{' '}
                {adapter.primaryDataRef || adapter.dataRef || '-'}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeAdapterRoles}</strong>{' '}
                {(adapter.analyticRoles || []).join(', ') || '-'}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeAdapterInteraction}</strong>{' '}
                {adapter.humanInteraction?.mode || 'none'}
                {adapter.humanInteraction?.actionName ? ` · ${adapter.humanInteraction.actionName}` : ''}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeAdapterProvider}</strong>{' '}
                {adapter.providerCapabilities?.renderStrategy || '-'} / {adapter.providerCapabilities?.stateApplyStrategy || '-'}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeAdapterSpecSupport}</strong>{' '}
                {adapter.sourceKind || '-'} / {adapter.supportsSpecMutation ? t.yes : t.no}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeAdapterActions}</strong>{' '}
                {(adapter.actionNames || []).slice(0, 3).join(', ') || '-'}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeAdapterQueries}</strong>{' '}
                {(adapter.perceptionQueryNames || []).slice(0, 3).join(', ') || '-'}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeAdapterUsage}</strong>{' '}
                {(adapter.usageNotes || []).slice(0, 2).join(' | ') || '-'}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          {t.runtimeAdapterEmpty}
        </div>
      )}
    </section>
  )
}
