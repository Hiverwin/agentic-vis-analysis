import { useCallback, useEffect, useState } from 'react'
import {
  snapshotRead,
  workspaceDescribe,
} from 'widgetva-kit/transport-inspect'
import { dataQuery } from 'widgetva-kit/transport-execute'
import t from '../../locale.js'
import { useRuntimeStateId } from './useRuntimeStateId.js'
import { formatRuntimeDataHandleLabel, resolveRuntimeDataHandleOptions } from './runtimeDataHandles.js'
import { canInspectRuntime } from './runtimeCardAvailability.js'

export default function RuntimeDataQueryCard({
  runtime,
  currentSelection,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dataHandles, setDataHandles] = useState([])
  const [selectedDataRef, setSelectedDataRef] = useState('')
  const [dataHandle, setDataHandle] = useState(null)
  const [schemaResult, setSchemaResult] = useState(null)
  const [sampleRowsResult, setSampleRowsResult] = useState(null)
  const [summaryResult, setSummaryResult] = useState(null)
  const stateId = useRuntimeStateId(runtime)

  const refresh = useCallback(async (preferredDataRef = selectedDataRef) => {
    if (!canInspectRuntime(runtime)) {
      setDataHandles([])
      setSelectedDataRef('')
      setDataHandle(null)
      setSchemaResult(null)
      setSampleRowsResult(null)
      setSummaryResult(null)
      setError('')
      return
    }

    setLoading(true)
    try {
      const [snapshot, workspace] = await Promise.all([
        snapshotRead(),
        workspaceDescribe({ includeSchemas: false, includeExamples: false }),
      ])
      const { options } = resolveRuntimeDataHandleOptions({ snapshot, workspace })
      const handle = options.find((item) => item?.ref === preferredDataRef) || options[0] || null
      const dataRef = handle?.ref || null

      setDataHandles(options)
      setSelectedDataRef(dataRef || '')

      if (!dataRef || !handle) {
        setDataHandle(null)
        setSchemaResult(null)
        setSampleRowsResult(null)
        setSummaryResult(null)
        setError('')
        return
      }

      const [nextSchema, nextSampleRows, nextSummary] = await Promise.all([
        dataQuery({ actor: 'human', dataRef, query: { kind: 'schema', spec: {} } }),
        dataQuery({ actor: 'human', dataRef, query: { kind: 'sampleRows', spec: { limit: 3 } } }),
        dataQuery({ actor: 'human', dataRef, query: { kind: 'summary', spec: {} } }),
      ])

      setDataHandle(handle)
      setSchemaResult(nextSchema?.result || null)
      setSampleRowsResult(nextSampleRows?.result || null)
      setSummaryResult(nextSummary?.result || null)
      setError('')
    } catch (nextError) {
      setDataHandle(null)
      setSchemaResult(null)
      setSampleRowsResult(null)
      setSummaryResult(null)
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Data query unavailable'))
    } finally {
      setLoading(false)
    }
  }, [runtime, selectedDataRef])

  useEffect(() => {
    refresh('')
  }, [refresh, stateId])

  const fields = Array.isArray(schemaResult?.fields) ? schemaResult.fields.slice(0, 4) : []
  const sampleRows = Array.isArray(sampleRowsResult) ? sampleRowsResult.slice(0, 2) : []
  const summaryRows = Array.isArray(summaryResult?.rows) ? summaryResult.rows.slice(0, 2) : []
  const supportedQueries = Array.isArray(dataHandle?.supportedQueries) ? dataHandle.supportedQueries : []

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
          {t.runtimeDataQuery}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {t.runtimeDataQueryUnavailable}: {error}
        </div>
      ) : dataHandle ? (
        <div style={{ marginTop: 6, display: 'grid', gap: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          {dataHandles.length > 1 ? (
            <>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeDataQueryHandle}</strong>
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
            <strong style={{ color: 'var(--text)' }}>{t.runtimeDataQueryHandle}</strong>{' '}
            {formatRuntimeDataHandleLabel(dataHandle)}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeDataQueryRows}</strong>{' '}
            {dataHandle.stats?.rowCount ?? dataHandle.stats?.visibleCount ?? '-'}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeDataQuerySupported}</strong>{' '}
            {supportedQueries.slice(0, 5).join(', ') || '-'}
          </div>
          {fields.length > 0 ? (
            <div style={{ display: 'grid', gap: 4, paddingLeft: 8 }}>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeDataQuerySchema}</strong>
              </div>
              {fields.map((field) => (
                <div key={field.name} style={{ color: 'var(--text-dim)' }}>
                  {field.name}: {field.type}
                </div>
              ))}
            </div>
          ) : null}
          {summaryRows.length > 0 ? (
            <div style={{ display: 'grid', gap: 4, paddingLeft: 8 }}>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeDataQuerySummary}</strong>
              </div>
              {summaryRows.map((row, index) => (
                <div key={`summary-row-${index}`} style={{ color: 'var(--text-dim)' }}>
                  {Object.entries(row || {}).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}
                </div>
              ))}
            </div>
          ) : null}
          {sampleRows.length > 0 ? (
            <div style={{ display: 'grid', gap: 4, paddingLeft: 8 }}>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeDataQuerySamples}</strong>
              </div>
              {sampleRows.map((row, index) => (
                <div key={`sample-row-${index}`} style={{ color: 'var(--text-dim)' }}>
                  {Object.entries(row || {}).slice(0, 4).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          {t.runtimeDataQueryEmpty}
        </div>
      )}
    </section>
  )
}
