import { useCallback, useEffect, useState } from 'react'
import {
  snapshotRead,
  workspaceDescribe,
} from 'widgetva-kit/transport-inspect'
import { perceptionQuery } from 'widgetva-kit/transport-execute'
import { summarizeWorkspaceState } from 'widgetva-kit/core-inspect'
import t from '../../locale.js'
import { formatRuntimeDataHandleLabel, resolveRuntimeDataHandleOptions } from './runtimeDataHandles.js'
import { useRuntimeStateId } from './useRuntimeStateId.js'
import { canInspectRuntime } from './runtimeCardAvailability.js'

export default function RuntimePerceptionCard({
  runtime,
  currentSelection,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focusedWidgetRef, setFocusedWidgetRef] = useState(null)
  const [focusedWidgetKind, setFocusedWidgetKind] = useState(null)
  const [visibleDataLabel, setVisibleDataLabel] = useState('')
  const [selectionDataLabel, setSelectionDataLabel] = useState('')
  const [visibleSummary, setVisibleSummary] = useState(null)
  const [visibleRows, setVisibleRows] = useState(null)
  const [selectionRows, setSelectionRows] = useState(null)
  const [selectionSummary, setSelectionSummary] = useState(null)
  const stateId = useRuntimeStateId(runtime)

  const refresh = useCallback(async () => {
    if (!canInspectRuntime(runtime)) {
      setFocusedWidgetRef(null)
      setFocusedWidgetKind(null)
      setVisibleDataLabel('')
      setSelectionDataLabel('')
      setVisibleSummary(null)
      setVisibleRows(null)
      setSelectionRows(null)
      setSelectionSummary(null)
      setError('')
      return
    }

    setLoading(true)
    try {
      const [snapshot, workspace] = await Promise.all([
        snapshotRead(),
        workspaceDescribe({ includeSchemas: false, includeExamples: false }),
      ])
      const stateSummary = summarizeWorkspaceState(snapshot)
      const ref = stateSummary?.focusedWidgetRef || null
      const widget = ref ? snapshot?.widgets?.[ref] || null : null
      if (!ref || !widget) {
        setFocusedWidgetRef(null)
        setFocusedWidgetKind(null)
        setVisibleDataLabel('')
        setSelectionDataLabel('')
        setVisibleSummary(null)
        setVisibleRows(null)
        setSelectionRows(null)
        setSelectionSummary(null)
        setError('')
        return
      }

      const { options } = resolveRuntimeDataHandleOptions({ snapshot, workspace })
      const selectionRef = Object.keys(widget?.selections || {})[0] || null
      const visibleHandle = options.find((handle) => handle?.scope === 'workspaceCurrentView')
        || options.find((handle) => handle?.scope === 'visible')
        || options[0]
        || null
      const selectionHandle = selectionRef
        ? options.find((handle) => handle?.scope === 'workspaceCurrent')
            || options.find((handle) => handle?.sourceSelectionRef === selectionRef)
            || options.find((handle) => handle?.scope === 'combined')
            || null
        : null

      const [nextVisibleSummary, nextVisibleRows, nextSelectionRows, nextSelectionSummary] = await Promise.all([
        perceptionQuery({
          callId: `visible_summary_${Date.now()}`,
          name: 'perception.summarizeVisible',
          actor: 'human',
          targetRef: ref,
          params: visibleHandle?.ref ? { targetDataRef: visibleHandle.ref } : {},
        }),
        perceptionQuery({
          callId: `visible_rows_${Date.now()}`,
          name: 'perception.inspectVisibleRows',
          actor: 'human',
          targetRef: ref,
          params: visibleHandle?.ref ? { targetDataRef: visibleHandle.ref, limit: 3 } : { limit: 3 },
        }),
        selectionRef
          ? perceptionQuery({
              callId: `selection_rows_${Date.now()}`,
              name: 'perception.inspectVisibleRows',
              actor: 'human',
              targetRef: ref,
              params: {
                limit: 3,
                ...(selectionHandle?.ref ? { targetDataRef: selectionHandle.ref } : { selectionRef }),
              },
            })
          : Promise.resolve(null),
        perceptionQuery({
          callId: `selection_summary_${Date.now()}`,
          name: 'perception.summarizeSelection',
          actor: 'human',
          targetRef: ref,
          params: selectionHandle?.ref ? { targetDataRef: selectionHandle.ref } : {},
        }),
      ])

      setFocusedWidgetRef(ref)
      setFocusedWidgetKind(widget.kind || null)
      setVisibleDataLabel(formatRuntimeDataHandleLabel(visibleHandle))
      setSelectionDataLabel(selectionHandle ? formatRuntimeDataHandleLabel(selectionHandle) : '')
      setVisibleSummary(nextVisibleSummary?.result || null)
      setVisibleRows(nextVisibleRows?.result || null)
      setSelectionRows(nextSelectionRows?.result || null)
      setSelectionSummary(nextSelectionSummary?.result || null)
      setError('')
    } catch (nextError) {
      setFocusedWidgetRef(null)
      setFocusedWidgetKind(null)
      setVisibleDataLabel('')
      setSelectionDataLabel('')
      setVisibleSummary(null)
      setVisibleRows(null)
      setSelectionRows(null)
      setSelectionSummary(null)
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Perception unavailable'))
    } finally {
      setLoading(false)
    }
  }, [runtime])

  useEffect(() => {
    refresh()
  }, [refresh, stateId])

  const aggregatePreview = Array.isArray(visibleSummary?.aggregates) ? visibleSummary.aggregates.slice(0, 2) : []
  const sampleRows = Array.isArray(visibleRows?.rows) ? visibleRows.rows.slice(0, 2) : []
  const selectionSampleRows = Array.isArray(selectionRows?.rows) ? selectionRows.rows.slice(0, 2) : []
  const selectedCount = selectionSummary?.selectedCount ?? 0
  const hasSelection = Boolean(selectionSummary?.hasSelection)
  const selectionCount = selectionSummary?.selectionCount ?? (hasSelection ? 1 : 0)
  const selectionLabel = selectionSummary?.selectionSummaries?.length > 0
    ? selectionSummary.selectionSummaries.join(' | ')
    : selectionSummary?.summary || ''

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
          {t.runtimePerception}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {t.runtimePerceptionUnavailable}: {error}
        </div>
      ) : focusedWidgetRef ? (
        <div style={{ marginTop: 6, display: 'grid', gap: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionFocused}</strong>{' '}
            {focusedWidgetKind || '-'} · {focusedWidgetRef}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionVisible}</strong>{' '}
            {visibleSummary?.rowCount ?? visibleRows?.visibleCount ?? '-'}
            {visibleDataLabel ? ` · ${visibleDataLabel}` : ''}
          </div>
          {aggregatePreview.length > 0 ? (
            <div style={{ display: 'grid', gap: 4, paddingLeft: 8 }}>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionAggregates}</strong>
              </div>
              {aggregatePreview.map((row, index) => (
                <div key={`aggregate-${index}`} style={{ color: 'var(--text-dim)' }}>
                  {Object.entries(row || {}).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}
                </div>
              ))}
            </div>
          ) : null}
          {sampleRows.length > 0 ? (
            <div style={{ display: 'grid', gap: 4, paddingLeft: 8 }}>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionRows}</strong>
              </div>
              {sampleRows.map((row, index) => (
                <div key={`row-${index}`} style={{ color: 'var(--text-dim)' }}>
                  {Object.entries(row || {}).slice(0, 4).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}
                </div>
              ))}
            </div>
          ) : null}
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionSelection}</strong>{' '}
            {hasSelection
              ? `${selectionCount} selections · ${selectedCount} · ${selectionLabel || t.runtimeEvidencePass}`
              : t.runtimeEvidenceProbe}
          </div>
          {selectionSampleRows.length > 0 ? (
            <div style={{ display: 'grid', gap: 4, paddingLeft: 8 }}>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimePerceptionRows}</strong>
                {selectionDataLabel ? ` · ${selectionDataLabel}` : ''}
              </div>
              {selectionSampleRows.map((row, index) => (
                <div key={`selection-row-${index}`} style={{ color: 'var(--text-dim)' }}>
                  {Object.entries(row || {}).slice(0, 4).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          {t.runtimePerceptionEmpty}
        </div>
      )}
    </section>
  )
}
