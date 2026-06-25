import { useCallback, useEffect, useState } from 'react'
import {
  linkEngineDescribe,
  workspaceDescribe,
} from 'widgetva-kit/transport-inspect'
import t from '../../locale.js'
import { summarizeRuntimeLinkMap } from './runtimeLinkSummary.js'
import { useRuntimeStoreVersion } from './useRuntimeStoreVersion.js'
import { canInspectRuntime } from './runtimeCardAvailability.js'

export default function RuntimeLinkMapCard({
  runtime,
  currentSelection,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [workspace, setWorkspace] = useState(null)
  const [engine, setEngine] = useState(null)
  const storeVersion = useRuntimeStoreVersion(runtime)

  const refresh = useCallback(async () => {
    if (!canInspectRuntime(runtime)) {
      setWorkspace(null)
      setEngine(null)
      setError('')
      return
    }

    setLoading(true)
    try {
      const [nextWorkspace, nextEngine] = await Promise.all([
        workspaceDescribe({ includeSchemas: false, includeExamples: false }),
        linkEngineDescribe(),
      ])
      setWorkspace(nextWorkspace)
      setEngine(nextEngine)
      setError('')
    } catch (nextError) {
      setWorkspace(null)
      setEngine(null)
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Link map unavailable'))
    } finally {
      setLoading(false)
    }
  }, [runtime])

  useEffect(() => {
    refresh()
  }, [refresh, storeVersion])

  const summary = summarizeRuntimeLinkMap({ workspace, engine })
  const links = summary.links
  const topology = summary.topology

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
          {t.runtimeLinkMap}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {t.runtimeLinkMapUnavailable}: {error}
        </div>
      ) : links.length > 0 ? (
        <div style={{ marginTop: 6, display: 'grid', gap: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeLinkMapCount}</strong>{' '}
            {summary.linkCount}
            {summary.primitiveNames.length > 0 ? ` · ${summary.primitiveNames.join(', ')}` : ''}
          </div>
          {(summary.coordinationLinkCount != null || summary.structuralLinkCount != null) ? (
            <div>
              <strong style={{ color: 'var(--text)' }}>{t.runtimeLinkMapStructure}</strong>{' '}
              {summary.coordinationLinkCount ?? 0} {t.runtimeLinkMapCoordination}
              {' · '}
              {summary.structuralLinkCount ?? 0} {t.runtimeLinkMapStructural}
              {' · '}
              {summary.automaticLinkCount ?? 0} {t.runtimeLinkMapAutomatic}
              {' · '}
              {summary.manualLinkCount ?? 0} {t.runtimeLinkMapManual}
            </div>
          ) : null}
          {topology ? (
            <div>
              <strong style={{ color: 'var(--text)' }}>{t.runtimeLinkMapTopology}</strong>{' '}
              {topology.topology} · {topology.topologyLabel}
              {typeof topology.linkDensity === 'number' ? ` · ${t.runtimeLinkMapDensity}: ${topology.linkDensity}` : ''}
            </div>
          ) : null}
          {topology?.rationale?.[0] ? (
            <div>{topology.rationale[0]}</div>
          ) : null}
          {links.slice(0, 5).map((link) => {
            const mappings = Array.isArray(link.fieldMappings) ? link.fieldMappings : []
            return (
              <div
                key={link.ref || link.linkId}
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
                  <strong style={{ color: 'var(--text)' }}>{link.kind}</strong>
                  {' '}· {link.source} → {link.target}
                </div>
                <div>
                  {t.runtimeLinkMapPolicy}: {link.propagationPolicy}
                  {' · '}
                  {link.automatic ? t.runtimeLinkMapAutomatic : t.runtimeLinkMapManual}
                  {link.trigger ? ` · ${t.runtimeLinkMapTrigger}: ${link.trigger}` : ''}
                  {link.effect ? ` · ${t.runtimeLinkMapEffect}: ${link.effect}` : ''}
                </div>
                {mappings.length > 0 ? (
                  <div>
                    {t.runtimeLinkMapMapping}: {mappings.join(', ')}
                  </div>
                ) : null}
                {link.description ? (
                  <div>{link.description}</div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          {t.runtimeLinkMapEmpty}
        </div>
      )}
    </section>
  )
}
