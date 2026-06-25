import { useCallback, useEffect, useState } from 'react'
import { workspaceDescribe } from 'widgetva-kit/transport-inspect'
import t from '../../locale.js'
import { useRuntimeStoreVersion } from './useRuntimeStoreVersion.js'
import { canInspectRuntime } from './runtimeCardAvailability.js'

export default function RuntimeActionCatalogCard({
  runtime,
  currentSelection,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [actions, setActions] = useState([])
  const storeVersion = useRuntimeStoreVersion(runtime)

  const refresh = useCallback(async () => {
    if (!canInspectRuntime(runtime)) {
      setActions([])
      setError('')
      return
    }

    setLoading(true)
    try {
      const description = await workspaceDescribe({
        includeSchemas: false,
        includeExamples: true,
      })
      setActions(Array.isArray(description?.actions) ? description.actions : [])
      setError('')
    } catch (nextError) {
      setActions([])
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Action catalog unavailable'))
    } finally {
      setLoading(false)
    }
  }, [runtime])

  useEffect(() => {
    refresh()
  }, [refresh, storeVersion])

  const visibleActions = actions.slice(0, 6)

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
          {t.runtimeActionCatalog}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {t.runtimeActionCatalogUnavailable}: {error}
        </div>
      ) : visibleActions.length > 0 ? (
        <div style={{ marginTop: 6, display: 'grid', gap: 8, fontSize: 11, color: 'var(--text-dim)' }}>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeActionCatalogCount}</strong>{' '}
            {actions.length}
          </div>
          {visibleActions.map((action) => (
            <div
              key={`${action.name}:${action.targetRef || 'workspace'}`}
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
                <strong style={{ color: 'var(--text)' }}>{action.name}</strong>
                {' '}· {action.primitive || '-'} · {action.category || '-'}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeActionCatalogTarget}</strong>{' '}
                {action.targetRef || action.scope || '-'}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeActionCatalogEffects}</strong>{' '}
                {(action.effects || []).slice(0, 2).map((effect) => effect.kind).join(', ') || '-'}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeActionCatalogPreconditions}</strong>{' '}
                {action.preconditions?.length || 0}
              </div>
              {action.examples?.[0]?.userGoal ? (
                <div>
                  <strong style={{ color: 'var(--text)' }}>{t.runtimeActionCatalogExample}</strong>{' '}
                  {action.examples[0].userGoal}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          {t.runtimeActionCatalogEmpty}
        </div>
      )}
    </section>
  )
}
