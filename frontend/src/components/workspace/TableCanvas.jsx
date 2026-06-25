import { useEffect, useMemo, useRef } from 'react'
import {
  applyWidgetRuntimeState,
  attachWidgetRendererBridge,
} from 'widgetva-kit/core'
import { readRuntimeDataFromStore } from 'widgetva-kit/core-inspect'

function inferColumns(rows) {
  const firstRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
  if (!firstRow || typeof firstRow !== 'object' || Array.isArray(firstRow)) return []
  return Object.keys(firstRow)
}

function formatCellValue(value) {
  if (value == null) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function getFocusedRowKeyGroups(widgetState) {
  const groups = Object.values(widgetState?.selections || {})
    .filter((selection) => selection?.kind === 'point')
    .map((selection) => {
      const predicate = Array.isArray(selection.predicates)
        ? selection.predicates.find((item) => item?.field && (item.op === 'equals' || item.op === 'in'))
        : null
      if (!predicate?.field) return null
      const keys = (Array.isArray(predicate.value) ? predicate.value : [predicate.value])
        .filter((key) => key != null)
      if (!keys.length) return null
      return {
        keyField: predicate.field,
        keys: new Set(keys),
      }
    })
    .filter(Boolean)
  return groups
}

function rowMatchesFocusedKeys(row, keyGroups) {
  return keyGroups.some(({ keyField, keys }) => keys.has(row?.[keyField]))
}

export default function TableCanvas({
  runtime = null,
  widgetRef = null,
  widgetAdapter = null,
  widgetState = null,
  compact = false,
  interactionConfig = null,
  onActionCall = null,
}) {
  const surfaceRef = useRef(null)
  const bridgeCleanupRef = useRef(() => {})
  const widgetStateRef = useRef(widgetState)
  widgetStateRef.current = widgetState

  const rows = useMemo(() => {
    const dataRef = widgetState?.data?.currentDataRef || null
    const runtimeData = dataRef ? readRuntimeDataFromStore(runtime?.store, dataRef) : null
    if (Array.isArray(runtimeData?.rows)) return runtimeData.rows
    const specRows = widgetState?.rawSpec?.data?.values
    if (Array.isArray(specRows)) return specRows
    return []
  }, [runtime, widgetState])

  const columns = useMemo(() => inferColumns(rows), [rows])
  const previewRows = rows.slice(0, compact ? 10 : 20)
  const title = widgetState?.rawSpec?.title || widgetState?.widgetId || widgetRef || 'Table'
  const selectedCount = widgetState?.data?.selectedCount ?? 0
  const visibleCount = widgetState?.data?.visibleCount ?? rows.length
  const focusedKeyGroups = useMemo(() => getFocusedRowKeyGroups(widgetState), [widgetState])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface || !widgetRef) return

    bridgeCleanupRef.current?.()
    const bridge = attachWidgetRendererBridge({
      runtime,
      widgetRef,
      widgetAdapter,
      widgetState: widgetStateRef.current,
      view: null,
      surface,
      spec: widgetStateRef.current?.rawSpec || null,
      interactionConfig,
      selectionSourceWidgetId: widgetStateRef.current?.widgetId || null,
      actionTargetRef: widgetRef,
      onActionCall,
      onSelectionChange: null,
    })
    bridgeCleanupRef.current = bridge.cleanup
    void applyWidgetRuntimeState({
      runtime,
      widgetRef,
      widgetAdapter,
      widgetState: widgetStateRef.current,
      view: null,
      surface,
      spec: widgetStateRef.current?.rawSpec || null,
      interactionConfig,
    })

    return () => {
      try {
        bridgeCleanupRef.current?.()
      } catch {}
      bridgeCleanupRef.current = () => {}
    }
  }, [runtime, widgetRef, widgetAdapter, interactionConfig, onActionCall])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface || !widgetState) return
    void applyWidgetRuntimeState({
      runtime,
      widgetRef,
      widgetAdapter,
      widgetState,
      view: null,
      surface,
      spec: widgetState?.rawSpec || null,
      interactionConfig,
    })
  }, [runtime, widgetRef, widgetAdapter, widgetState, interactionConfig])

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100%', background: 'var(--surface)' }}>
      {!compact ? (
        <div className="panel-header">
          <div className="header-icon">
            <span>{title}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {visibleCount} rows{selectedCount > 0 ? `, ${selectedCount} selected` : ''}
          </div>
        </div>
      ) : null}

      <div
        ref={surfaceRef}
        style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: compact ? 0 : 8 }}
      >
        {columns.length === 0 ? (
          <div style={{ padding: 12, fontSize: 12, color: 'var(--text-dim)' }}>
            No visible rows.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column}
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderBottom: '1px solid var(--border)',
                      background: 'var(--surface2)',
                      color: 'var(--text)',
                      fontWeight: 700,
                    }}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, index) => (
                <tr
                  key={`row-${index}`}
                  data-widgetva-row-index={index}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: row?.__widgetva_selected
                      ? 'rgba(77,126,168,0.18)'
                      : row?.__widgetva_highlight || rowMatchesFocusedKeys(row, focusedKeyGroups)
                      ? 'rgba(77,126,168,0.12)'
                      : 'transparent',
                    cursor: interactionConfig?.mode === 'rowClick' ? 'pointer' : 'default',
                  }}
                >
                  {columns.map((column) => (
                    <td
                      key={`${index}-${column}`}
                      style={{
                        padding: '8px 10px',
                        color: 'var(--text-dim)',
                        verticalAlign: 'top',
                        maxWidth: 220,
                        wordBreak: 'break-word',
                      }}
                    >
                      {formatCellValue(row?.[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
