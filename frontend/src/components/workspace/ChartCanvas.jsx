import { useEffect, useMemo, useRef, useState } from 'react'
import vegaEmbed from 'vega-embed'
import t from '../../locale.js'
import { applyWidgetRuntimeState, attachWidgetRendererBridge } from 'widgetva-kit/core'
import { resolveChartCanvasSpec } from '../chartCanvasModel.js'

/** True when array looks like inline tabular rows (objects), not scale domains etc. */
function isTabularValuesArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false
  const first = arr[0]
  return first !== null && typeof first === 'object' && !Array.isArray(first)
}

/**
 * Deep clone spec and omit inline data rows for safe display (no raw data.values in the panel).
 * Keeps structure, encodings, urls, and non-tabular `values` (e.g. categorical domains).
 */
function redactInlineDataForSpecDisplay(node) {
  if (node === null || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map(redactInlineDataForSpecDisplay)
  const out = {}
  for (const [k, v] of Object.entries(node)) {
    if (k === 'values' && Array.isArray(v) && (v.length === 0 || isTabularValuesArray(v))) {
      out[k] = { _omitted: 'inline data rows', rowCount: v.length }
    } else if (k === 'datasets' && v && typeof v === 'object' && !Array.isArray(v)) {
      const ds = {}
      for (const [name, rows] of Object.entries(v)) {
        if (Array.isArray(rows) && (rows.length === 0 || isTabularValuesArray(rows))) {
          ds[name] = { _omitted: 'dataset rows', rowCount: rows.length }
        } else {
          ds[name] = redactInlineDataForSpecDisplay(rows)
        }
      }
      out[k] = ds
    } else {
      out[k] = redactInlineDataForSpecDisplay(v)
    }
  }
  return out
}

function toPositiveNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function resolveBaseSize(spec) {
  const explicitWidth = toPositiveNumber(spec?.width)
  const explicitHeight = toPositiveNumber(spec?.height)
  const viewWidth = toPositiveNumber(spec?.config?.view?.continuousWidth)
  const viewHeight = toPositiveNumber(spec?.config?.view?.continuousHeight)
  return {
    width: explicitWidth ?? viewWidth ?? 700,
    height: explicitHeight ?? viewHeight ?? 420,
  }
}

export default function ChartCanvas({
  runtime = null,
  widgetRef = null,
  widgetAdapter = null,
  widgetState = null,
  spec,
  selectionEnabled = false,
  selectionSourceWidgetId = null,
  interactionConfig = null,
  onActionCall,
  onSelectionChange,
  compact = false,
}) {
  const containerRef = useRef(null)
  const viewRef = useRef(null)
  const [renderError, setRenderError] = useState('')
  const [showSpecJson, setShowSpecJson] = useState(false)
  const onActionCallRef = useRef(onActionCall)
  onActionCallRef.current = onActionCall
  const onSelectionChangeRef = useRef(onSelectionChange)
  onSelectionChangeRef.current = onSelectionChange
  const widgetStateRef = useRef(widgetState)
  widgetStateRef.current = widgetState
  const bridgeCleanupRef = useRef(() => {})
  const resolvedSpec = resolveChartCanvasSpec({ spec, widgetState })

  useEffect(() => {
    if (!selectionEnabled) onSelectionChange?.(null)
  }, [selectionEnabled, onSelectionChange])

  useEffect(() => {
    if (!resolvedSpec || !containerRef.current) return
    setRenderError('')

    if (viewRef.current) {
      try { viewRef.current.finalize() } catch {}
      viewRef.current = null
      bridgeCleanupRef.current = () => {}
    }

    const baseSize = resolveBaseSize(resolvedSpec)
    const enc = resolvedSpec.encoding || {}
    const interactionMode = selectionEnabled ? interactionConfig?.mode || 'none' : 'none'
    const hasBrushSelection = interactionMode === 'brush2d' && enc.x && enc.y
    const embedSpec = {
      ...resolvedSpec,
      width: baseSize.width,
      height: baseSize.height,
      // Keep native spec size and rely on panel scrolling for overflow.
      autosize: { type: 'pad', contains: 'padding' },
      config: {
        ...(resolvedSpec.config || {}),
        background: 'transparent',
      },
      ...(hasBrushSelection && {
        selection: { brush: { type: 'interval' } },
      }),
    }

    vegaEmbed(containerRef.current, embedSpec, {
      actions: false,
      renderer: 'canvas',
    })
      .then((result) => {
        viewRef.current = result.view
        const bridge = attachWidgetRendererBridge({
          runtime,
          widgetRef,
          widgetAdapter,
          widgetState: widgetStateRef.current,
          view: result.view,
          spec: resolvedSpec,
          interactionConfig,
          selectionSourceWidgetId,
          actionTargetRef: widgetRef,
          onActionCall: selectionEnabled ? onActionCallRef.current : null,
          onSelectionChange: selectionEnabled ? onSelectionChangeRef.current : null,
        })
        bridgeCleanupRef.current = bridge.cleanup
        void applyWidgetRuntimeState({
          runtime,
          widgetRef,
          widgetAdapter,
          widgetState: widgetStateRef.current,
          view: result.view,
          spec: resolvedSpec,
          interactionConfig,
        })
      })
      .catch((err) => setRenderError(err.message || String(err)))

    return () => {
      try {
        bridgeCleanupRef.current?.()
      } catch {}
      bridgeCleanupRef.current = () => {}
      if (viewRef.current) {
        try { viewRef.current.finalize() } catch {}
        viewRef.current = null
      }
    }
    // Re-embed when spec/view wiring changes, not for ordinary state updates.
  }, [runtime, widgetRef, widgetAdapter, resolvedSpec, selectionEnabled, selectionSourceWidgetId, interactionConfig, showSpecJson])

  useEffect(() => {
    if (!viewRef.current || !widgetState) return
    void applyWidgetRuntimeState({
      runtime,
      widgetRef,
      widgetAdapter,
      widgetState,
      view: viewRef.current,
      spec: resolvedSpec,
      interactionConfig,
    })
  }, [runtime, widgetRef, widgetAdapter, widgetState, resolvedSpec, interactionConfig])

  const specStr = useMemo(() => {
    if (!resolvedSpec) return ''
    try {
      const clone = JSON.parse(JSON.stringify(resolvedSpec))
      const redacted = redactInlineDataForSpecDisplay(clone)
      return JSON.stringify(redacted, null, 2)
    } catch {
      return JSON.stringify(resolvedSpec, null, 2)
    }
  }, [resolvedSpec])

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100%', background: 'var(--surface)' }}>
      {/* toolbar */}
      {!compact ? (
      <div className="panel-header">
        <div className="header-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <polyline points="7 14 11 10 15 13 19 8" />
          </svg>
          <span>{t.visualizationCanvas}</span>
        </div>
        {selectionEnabled && resolvedSpec && (
          <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>
            {t.selectionModeHint}
          </div>
        )}
        <div className="flex gap-2">
          {resolvedSpec && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowSpecJson(v => !v)}>
              {showSpecJson ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <polyline points="7 14 11 10 15 13 19 8" />
                  </svg>
                  {t.chart}
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  {t.spec}
                </>
              )}
            </button>
          )}
        </div>
      </div>
      ) : null}

      {/* main area */}
      <div className="flex flex-col overflow-hidden" style={{ flex: 1, background: 'var(--surface)' }}>
        {showSpecJson ? (
          <pre className="overflow-auto p-3 font-mono text-xs" style={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'auto',
            whiteSpace: 'pre',
            color: 'var(--text)',
            background: 'var(--surface2)',
          }}>
            {specStr}
          </pre>
        ) : (
          <div
            style={{
              flex: '1 1 0',
              minHeight: 0,
              overflow: 'auto',
              position: 'relative',
            }}
          >
            {!resolvedSpec ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="0.8" style={{ marginBottom: 16 }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <polyline points="7 14 11 10 15 13 19 8" />
                  <circle cx="17" cy="8" r="1.5" fill="var(--accent)" stroke="none" opacity="0.3" />
                </svg>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--text-dim)' }}>
                  {t.awaitingDataInput}
                </div>
              </div>
            ) : renderError ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ padding: 16, maxWidth: 500 }}>
                  <div className="font-semibold mb-2" style={{ color: 'var(--danger)' }}>{t.renderError}</div>
                  <pre className="text-xs font-mono" style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {renderError}
                  </pre>
                  <div className="mt-2 text-dim text-xs">{t.viewSpecViaButton}</div>
                </div>
              </div>
            ) : (
              <div ref={containerRef} id="vega-container" style={{
                minWidth: '100%',
                minHeight: '100%',
                width: 'max-content',
                height: 'max-content',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: 16,
                boxSizing: 'border-box',
              }} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
