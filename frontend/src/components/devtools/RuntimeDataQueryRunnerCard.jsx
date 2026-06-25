import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  snapshotRead,
  workspaceDescribe,
} from 'widgetva-kit/transport-inspect'
import { dataQuery } from 'widgetva-kit/transport-execute'
import t from '../../locale.js'
import { useRuntimeStoreVersion } from './useRuntimeStoreVersion.js'
import { formatRuntimeDataHandleLabel, resolveRuntimeDataHandleOptions } from './runtimeDataHandles.js'
import { canInspectRuntime } from './runtimeCardAvailability.js'

function previewValue(value) {
  if (value == null) return '-'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

export default function RuntimeDataQueryRunnerCard({
  runtime,
  currentSelection,
}) {
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [dataHandles, setDataHandles] = useState([])
  const [selectedDataRef, setSelectedDataRef] = useState('')
  const [dataHandle, setDataHandle] = useState(null)
  const [descriptors, setDescriptors] = useState([])
  const [selectedKind, setSelectedKind] = useState('')
  const [lastResult, setLastResult] = useState(null)
  const storeVersion = useRuntimeStoreVersion(runtime)

  const refresh = useCallback(async (preferredDataRef = selectedDataRef) => {
    if (!canInspectRuntime(runtime)) {
      setDataHandles([])
      setSelectedDataRef('')
      setDataHandle(null)
      setDescriptors([])
      setSelectedKind('')
      setLastResult(null)
      setError('')
      return
    }

    setLoading(true)
    try {
      const [snapshot, workspace] = await Promise.all([
        snapshotRead(),
        workspaceDescribe({ includeSchemas: false, includeExamples: true }),
      ])
      const { options } = resolveRuntimeDataHandleOptions({ snapshot, workspace })
      const handle = options.find((item) => item?.ref === preferredDataRef) || options[0] || null
      const nextDescriptors = Array.isArray(handle?.supportedQueryDescriptors)
        ? handle.supportedQueryDescriptors.filter((descriptor) => descriptor?.name && descriptor?.examples?.[0]?.spec)
        : []

      setDataHandles(options)
      setSelectedDataRef(handle?.ref || '')
      setDataHandle(handle)
      setDescriptors(nextDescriptors)
      setSelectedKind((currentKind) => {
        if (currentKind && nextDescriptors.some((descriptor) => descriptor.name === currentKind)) {
          return currentKind
        }
        return nextDescriptors[0]?.name || ''
      })
      setError('')
    } catch (nextError) {
      setDataHandle(null)
      setDescriptors([])
      setSelectedKind('')
      setLastResult(null)
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Data query runner unavailable'))
    } finally {
      setLoading(false)
    }
  }, [runtime, selectedDataRef])

  useEffect(() => {
    refresh('')
  }, [refresh, storeVersion])

  const selectedDescriptor = useMemo(
    () => descriptors.find((descriptor) => descriptor.name === selectedKind) || null,
    [descriptors, selectedKind],
  )

  const runSelectedQuery = useCallback(async () => {
    if (!dataHandle?.ref || !selectedDescriptor) return

    const example = selectedDescriptor.examples?.[0] || {}
    setRunning(true)
    try {
      const result = await dataQuery({
        actor: 'human',
        dataRef: dataHandle.ref,
        query: {
          kind: selectedDescriptor.name,
          spec: example.spec || {},
        },
      })
      setLastResult(result)
      setError('')
    } catch (nextError) {
      setLastResult(null)
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Data query failed'))
    } finally {
      setRunning(false)
    }
  }, [dataHandle?.ref, selectedDescriptor])

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
          {t.runtimeDataQueryRunner}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading || running}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {t.runtimeDataQueryRunnerUnavailable}: {error}
        </div>
      ) : dataHandle && descriptors.length > 0 ? (
        <div style={{ marginTop: 6, display: 'grid', gap: 8, fontSize: 11, color: 'var(--text-dim)' }}>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeDataQueryRunnerHandle}</strong>{' '}
            {formatRuntimeDataHandleLabel(dataHandle)}
          </div>
          {dataHandles.length > 1 ? (
            <>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeDataQueryRunnerHandle}</strong>
              </div>
              <select
                value={selectedDataRef}
                onChange={(event) => {
                  const nextDataRef = event.target.value
                  setSelectedDataRef(nextDataRef)
                  void refresh(nextDataRef)
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
                {dataHandles.map((handleOption) => (
                  <option key={handleOption.ref} value={handleOption.ref}>
                    {formatRuntimeDataHandleLabel(handleOption)}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeDataQueryRunnerSelect}</strong>
          </div>
          <select
            value={selectedKind}
            onChange={(event) => setSelectedKind(event.target.value)}
            style={{
              width: '100%',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              padding: '6px 8px',
            }}
          >
            {descriptors.slice(0, 12).map((descriptor) => (
              <option key={descriptor.name} value={descriptor.name}>
                {descriptor.name} · {descriptor.resultKind || '-'}
              </option>
            ))}
          </select>

          {selectedDescriptor ? (
            <>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeDataQueryRunnerKind}</strong>{' '}
                {selectedDescriptor.resultKind || '-'}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeDataQueryRunnerDescription}</strong>{' '}
                {selectedDescriptor.description || '-'}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeDataQueryRunnerReturns}</strong>{' '}
                {Object.keys(selectedDescriptor.resultSchema?.properties || {}).slice(0, 3).join(', ') || selectedDescriptor.resultSchema?.type || '-'}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeDataQueryRunnerSpec}</strong>{' '}
                <code style={{ fontSize: 10 }}>{JSON.stringify(selectedDescriptor.examples?.[0]?.spec || {})}</code>
              </div>
              <button className="btn btn-sm" onClick={() => void runSelectedQuery()} disabled={running}>
                {running ? t.loading : t.runtimeDataQueryRunnerRun}
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
                <strong style={{ color: 'var(--text)' }}>{t.runtimeDataQueryRunnerStatus}</strong>{' '}
                {lastResult.ok ? t.runtimeEvidencePass : t.runtimeEvidenceProbe}
              </div>
              {queryError?.code ? (
                <div>
                  <strong style={{ color: 'var(--text)' }}>{t.runtimeDataQueryRunnerError}</strong>{' '}
                  {queryError.code}
                  {queryError.message ? ` · ${queryError.message}` : ''}
                </div>
              ) : null}
              {recoveryHints.length > 0 ? (
                <div>
                  <strong style={{ color: 'var(--text)' }}>{t.runtimeDataQueryRunnerRecovery}</strong>{' '}
                  {recoveryHints.slice(0, 2).join(' · ')}
                </div>
              ) : null}
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeDataQueryRunnerRef}</strong>{' '}
                {lastResult.dataRef || dataHandle.ref}
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
                  <strong style={{ color: 'var(--text)' }}>{t.runtimeDataQueryRunnerResult}</strong>{' '}
                  {previewValue(lastResult.result)}
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          {t.runtimeDataQueryRunnerEmpty}
        </div>
      )}
    </section>
  )
}
