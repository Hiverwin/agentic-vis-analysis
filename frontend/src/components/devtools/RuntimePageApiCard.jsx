import { useCallback, useEffect, useState } from 'react'
import { describePagePort } from 'widgetva-kit/transport-inspect'
import t from '../../locale.js'
import { canInspectRuntime } from './runtimeCardAvailability.js'

function firstEntries(value, limit = 4) {
  return Object.entries(value || {}).slice(0, limit)
}

export default function RuntimePageApiCard({
  runtime,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [description, setDescription] = useState(null)

  const refresh = useCallback(async () => {
    if (!canInspectRuntime(runtime)) {
      setDescription(null)
      setError('')
      return
    }

    setLoading(true)
    try {
      const nextDescription = await describePagePort()
      setDescription(nextDescription)
      setError('')
    } catch (nextError) {
      setDescription(null)
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Page API unavailable'))
    } finally {
      setLoading(false)
    }
  }, [runtime])

  useEffect(() => {
    refresh()
  }, [refresh])

  const methods = Array.isArray(description?.methods) ? description.methods : []
  const aliases = description?.aliases && typeof description.aliases === 'object' ? description.aliases : {}
  const schemas = description?.schemas && typeof description.schemas === 'object' ? description.schemas : {}
  const errorCatalog = description?.errorCatalog && typeof description.errorCatalog === 'object' ? description.errorCatalog : {}
  const sampleMethods = methods.slice(0, 5)
  const sampleAliases = firstEntries(aliases, 4)
  const sampleSchemas = Object.keys(schemas).slice(0, 6)
  const errorFamilies = Object.keys(errorCatalog)

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
          {t.runtimePageApi}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {t.runtimePageApiUnavailable}: {error}
        </div>
      ) : description ? (
        <div style={{ marginTop: 6, display: 'grid', gap: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimePageApiVersion}</strong>{' '}
            {description.version || '-'}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimePageApiMethods}</strong>{' '}
            {methods.length}
          </div>
          {sampleMethods.length > 0 ? (
            <div style={{ display: 'grid', gap: 4, paddingLeft: 8 }}>
              {sampleMethods.map((name) => {
                const descriptor = description?.methodDescriptors?.[name]
                return (
                  <div key={name} style={{ color: 'var(--text-dim)' }}>
                    {name} · {descriptor?.returns?.kind || 'result'}
                  </div>
                )
              })}
            </div>
          ) : null}
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimePageApiAliases}</strong>{' '}
            {Object.keys(aliases).length}
          </div>
          {sampleAliases.length > 0 ? (
            <div style={{ display: 'grid', gap: 4, paddingLeft: 8 }}>
              {sampleAliases.map(([alias, method]) => (
                <div key={alias} style={{ color: 'var(--text-dim)' }}>
                  {alias} → {method}
                </div>
              ))}
            </div>
          ) : null}
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimePageApiSchemas}</strong>{' '}
            {Object.keys(schemas).length}
          </div>
          {sampleSchemas.length > 0 ? (
            <div style={{ display: 'grid', gap: 4, paddingLeft: 8 }}>
              {sampleSchemas.map((name) => (
                <div key={name} style={{ color: 'var(--text-dim)' }}>
                  {name}
                </div>
              ))}
            </div>
          ) : null}
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimePageApiErrors}</strong>{' '}
            {errorFamilies.join(', ') || '-'}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          {t.runtimePageApiEmpty}
        </div>
      )}
    </section>
  )
}
