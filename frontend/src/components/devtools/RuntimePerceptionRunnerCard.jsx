import { useCallback, useEffect, useMemo, useState } from 'react'
import { perceptionQuery } from 'widgetva-kit/transport-execute'
import { workspaceDescribe } from 'widgetva-kit/transport-inspect'
import t from '../../locale.js'
import { useRuntimeStoreVersion } from './useRuntimeStoreVersion.js'
import { formatRuntimeDataHandleLabel } from './runtimeDataHandles.js'
import { canInspectRuntime } from './runtimeCardAvailability.js'

function previewValue(value) {
  if (value == null) return '-'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

export default function RuntimePerceptionRunnerCard({
  runtime,
  currentSelection,
}) {
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [queries, setQueries] = useState([])
  const [dataHandles, setDataHandles] = useState({})
  const [selectedKey, setSelectedKey] = useState('')
  const [lastResult, setLastResult] = useState(null)
  const storeVersion = useRuntimeStoreVersion(runtime)

  const refresh = useCallback(async () => {
    if (!canInspectRuntime(runtime)) {
      setQueries([])
      setDataHandles({})
      setSelectedKey('')
      setLastResult(null)
      setError('')
      return
    }

    setLoading(true)
    try {
      const description = await workspaceDescribe({
        includeSchemas: false,
        includeExamples: true,
      })
      const nextQueries = (Array.isArray(description?.perceptionQueries) ? description.perceptionQueries : []).filter(
        (query) => query?.name && query?.examples?.[0]?.params,
      )
      const nextDataHandles = Object.fromEntries(
        (Array.isArray(description?.dataHandles) ? description.dataHandles : [])
          .filter((handle) => typeof handle?.ref === 'string')
          .map((handle) => [handle.ref, handle]),
      )
      setQueries(nextQueries)
      setDataHandles(nextDataHandles)
      setSelectedKey((currentKey) => {
        if (currentKey && nextQueries.some((query) => `${query.name}:${query.targetRef || 'workspace'}` === currentKey)) {
          return currentKey
        }
        const fallbackQuery = nextQueries[0]
        return fallbackQuery ? `${fallbackQuery.name}:${fallbackQuery.targetRef || 'workspace'}` : ''
      })
      setError('')
    } catch (nextError) {
      setQueries([])
      setSelectedKey('')
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Perception runner unavailable'))
    } finally {
      setLoading(false)
    }
  }, [runtime])

  useEffect(() => {
    refresh()
  }, [refresh, storeVersion])

  const selectedQuery = useMemo(
    () => queries.find((query) => `${query.name}:${query.targetRef || 'workspace'}` === selectedKey) || null,
    [queries, selectedKey],
  )
  const selectedTargetLabel = selectedQuery?.targetRef
    ? formatRuntimeDataHandleLabel(dataHandles[selectedQuery.targetRef] || { ref: selectedQuery.targetRef })
    : 'workspace'

  const runSelectedQuery = useCallback(async () => {
    if (!selectedQuery) return

    const example = selectedQuery.examples?.[0] || {}
    setRunning(true)
    try {
      const result = await perceptionQuery({
        callId: `runtime_perception_runner_${Date.now()}`,
        name: selectedQuery.name,
        actor: 'human',
        targetRef: selectedQuery.targetRef || undefined,
        params: example.params || {},
      })
      setLastResult(result)
      setError('')
    } catch (nextError) {
      setLastResult(null)
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Perception query failed'))
    } finally {
      setRunning(false)
    }
  }, [selectedQuery])

  const resultEntries = Object.entries(lastResult?.result || {}).slice(0, 4)
  const queryError = lastResult?.error || null
  const recoveryHints = Array.isArray(lastResult?.recoveryHints) ? lastResult.recoveryHints : []

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
          {t.runtimePerceptionRunner}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading || running}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {t.runtimePerceptionRunnerUnavailable}: {error}
        </div>
      ) : queries.length > 0 ? (
        <div style={{ marginTop: 6, display: 'grid', gap: 8, fontSize: 11, color: 'var(--text-dim)' }}>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionRunnerSelect}</strong>
          </div>
          <select
            value={selectedKey}
            onChange={(event) => setSelectedKey(event.target.value)}
            style={{
              width: '100%',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              padding: '6px 8px',
            }}
          >
            {queries.slice(0, 12).map((query) => {
              const key = `${query.name}:${query.targetRef || 'workspace'}`
              return (
                <option key={key} value={key}>
                  {query.name} · {query.targetRef ? formatRuntimeDataHandleLabel(dataHandles[query.targetRef] || { ref: query.targetRef }) : (query.category || 'workspace')}
                </option>
              )
            })}
          </select>

          {selectedQuery ? (
            <>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionRunnerCategory}</strong>{' '}
                {selectedQuery.category || '-'}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionCatalogTarget}</strong>{' '}
                {selectedTargetLabel}
              </div>
              {selectedQuery.examples?.[0]?.userGoal ? (
                <div>
                  <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionRunnerGoal}</strong>{' '}
                  {selectedQuery.examples[0].userGoal}
                </div>
              ) : null}
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionRunnerParams}</strong>{' '}
                <code style={{ fontSize: 10 }}>{JSON.stringify(selectedQuery.examples?.[0]?.params || {})}</code>
              </div>
              <button className="btn btn-sm" onClick={() => void runSelectedQuery()} disabled={running}>
                {running ? t.loading : t.runtimePerceptionRunnerRun}
              </button>
            </>
          ) : null}

          {lastResult ? (
            <div
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
                <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionRunnerStatus}</strong>{' '}
                {lastResult.ok ? t.runtimeEvidencePass : t.runtimeEvidenceProbe}
              </div>
              {queryError?.code ? (
                <div>
                  <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionRunnerError}</strong>{' '}
                  {queryError.code}
                  {queryError.message ? ` · ${queryError.message}` : ''}
                </div>
              ) : null}
              {recoveryHints.length > 0 ? (
                <div>
                  <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionRunnerRecovery}</strong>{' '}
                  {recoveryHints.slice(0, 2).join(' · ')}
                </div>
              ) : null}
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionRunnerQuery}</strong>{' '}
                {lastResult.queryName || selectedQuery?.name || '-'}
              </div>
              {resultEntries.length > 0 ? (
                <div style={{ display: 'grid', gap: 4 }}>
                  {resultEntries.map(([key, value]) => (
                    <div key={key}>
                      <strong style={{ color: 'var(--text)' }}>{key}</strong>{' '}
                      {previewValue(value)}
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionRunnerResult}</strong>{' '}
                  {previewValue(lastResult.result)}
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          {t.runtimePerceptionRunnerEmpty}
        </div>
      )}
    </section>
  )
}
