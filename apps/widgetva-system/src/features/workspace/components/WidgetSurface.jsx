import { useCallback, useEffect, useMemo, useRef } from 'react'
import { createWidgetVAHost } from 'widgetva-kit'
import { useAppStore } from '../../../app/store/appStore.js'
import { EChartsView } from '../renderers/EChartsView.jsx'
import { VgplotView } from '../renderers/VgplotView.jsx'
import { VegaLiteView } from '../renderers/VegaLiteView.jsx'
import { resolveWidgetNativePayload, resolveWidgetRenderMode } from '../models/widgetRenderSupport.js'

function RuntimeBoundVegaLiteView({ widget, runtime, spec, className }) {
  const bindingRef = useRef(null)
  const runHumanRuntimeAction = useAppStore((state) => state.runHumanRuntimeAction)
  const vaHost = useMemo(() => createWidgetVAHost({
    runtime,
    onActionCall: runHumanRuntimeAction,
  }), [runtime, runHumanRuntimeAction])

  const cleanupBinding = useCallback(() => {
    bindingRef.current?.dispose?.()
    bindingRef.current = null
  }, [])

  useEffect(() => cleanupBinding, [cleanupBinding])

  const handleViewReady = useCallback((view) => {
    cleanupBinding()
    if (!view) return undefined

    let cancelled = false
    void vaHost.mountWidgetView({
      widget,
      view,
      spec,
    }).then((bindingHandle) => {
      if (cancelled) {
        bindingHandle?.dispose?.()
        return
      }
      bindingRef.current = bindingHandle
    }).catch((error) => {
      console.warn('WidgetVA runtime bridge install failed', error)
    })

    return () => {
      cancelled = true
      cleanupBinding()
    }
  }, [cleanupBinding, spec, vaHost, widget])

  return (
    <VegaLiteView
      spec={spec}
      className={className}
      onViewReady={handleViewReady}
    />
  )
}

function renderVisualization(widget, { runtime = null } = {}) {
  const nativePayload = resolveWidgetNativePayload(widget)
  if ((nativePayload.mode === 'vega-lite' || nativePayload.mode === 'vega') && nativePayload.payload) {
    return (
      <RuntimeBoundVegaLiteView
        widget={widget}
        runtime={runtime}
        spec={nativePayload.payload}
        className="vega-shell"
      />
    )
  }
  if (nativePayload.mode === 'echarts' && nativePayload.payload) {
    return (
      <EChartsView
        option={nativePayload.payload}
        className="vega-shell"
      />
    )
  }
  if (nativePayload.mode === 'vgplot' && nativePayload.payload) {
    return (
      <VgplotView
        scriptText={nativePayload.payload}
        className="vega-shell"
      />
    )
  }
  return <div className="empty-panel">Widget rendering unavailable.</div>
}

function resolveRendererLabel(provider, renderMode = 'unknown') {
  if (renderMode === 'vega-lite') return 'vega-lite'
  if (renderMode === 'vega') return 'vega'
  if (renderMode === 'echarts') return 'echarts'
  if (renderMode === 'vgplot') return 'vgplot'
  return provider || renderMode || 'unknown'
}

function readExplicitSize(value) {
  return Number.isFinite(value) && value > 0 ? Number(value) : null
}

function estimateVegaLayout(spec = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null

  const width = readExplicitSize(spec.width)
  const height = readExplicitSize(spec.height)
  if (width && height) {
    return { width, height }
  }

  if (Array.isArray(spec.vconcat) && spec.vconcat.length > 0) {
    const childSizes = spec.vconcat.map((entry) => estimateVegaLayout(entry)).filter(Boolean)
    if (childSizes.length > 0) {
      return {
        width: width || Math.max(...childSizes.map((size) => size.width || 320), 320),
        height: height || childSizes.reduce((total, size) => total + (size.height || 220), 0),
      }
    }
  }

  if ((Array.isArray(spec.hconcat) && spec.hconcat.length > 0) || (Array.isArray(spec.concat) && spec.concat.length > 0)) {
    const children = spec.hconcat?.length ? spec.hconcat : spec.concat
    const childSizes = children.map((entry) => estimateVegaLayout(entry)).filter(Boolean)
    if (childSizes.length > 0) {
      return {
        width: width || childSizes.reduce((total, size) => total + (size.width || 280), 0),
        height: height || Math.max(...childSizes.map((size) => size.height || 220), 220),
      }
    }
  }

  if (Array.isArray(spec.layer) && spec.layer.length > 0) {
    const childSizes = spec.layer.map((entry) => estimateVegaLayout(entry)).filter(Boolean)
    if (childSizes.length > 0) {
      return {
        width: width || Math.max(...childSizes.map((size) => size.width || 320), 320),
        height: height || Math.max(...childSizes.map((size) => size.height || 220), 220),
      }
    }
  }

  if (spec.spec && typeof spec.spec === 'object' && !Array.isArray(spec.spec)) {
    const nestedSize = estimateVegaLayout(spec.spec)
    if (nestedSize) {
      return {
        width: width || nestedSize.width || 320,
        height: height || nestedSize.height || 220,
      }
    }
  }

  if (width || height) {
    return {
      width: width || 360,
      height: height || 240,
    }
  }

  return null
}

function resolveWidgetPreferredFrame(widget = {}) {
  const provider = widget?.provider || widget?.source?.providerSpec?.provider || null
  if (provider !== 'vega-lite' && provider !== 'vega') return null
  const spec = widget?.source?.providerSpec?.spec || widget?.source?.spec || null
  return estimateVegaLayout(spec)
}

export function WidgetSurface({ widget, runtime = null, singleViewMode = false, selected, replayAnchored = false, replayBranchActive = false, onSelect }) {
  const metricSummary = useMemo(
    () => (Array.isArray(widget?.metrics) ? widget.metrics.join(' · ') : ''),
    [widget?.metrics],
  )
  const renderMode = useMemo(() => resolveWidgetRenderMode(widget), [widget])
  const visualization = useMemo(() => renderVisualization(widget, { runtime }), [runtime, widget])
  const widgetKind = widget.widgetKind || widget.kind || widget.type
  const typeLabel = widgetKind || 'widget'
  const rendererLabel = resolveRendererLabel(widget.provider, renderMode.mode)
  const preferredFrame = useMemo(() => resolveWidgetPreferredFrame(widget), [widget])
  const surfaceStyle = useMemo(() => {
    if (!singleViewMode) return undefined
    return {
      width: '100%',
      justifySelf: 'center',
      ...(preferredFrame?.width ? { maxWidth: `${preferredFrame.width}px` } : null),
    }
  }, [preferredFrame, singleViewMode])
  const vizStyle = useMemo(() => {
    const nextStyle = {}
    if (preferredFrame?.width && preferredFrame?.height) {
      nextStyle.aspectRatio = `${preferredFrame.width} / ${preferredFrame.height}`
    }
    if (preferredFrame?.height) {
      nextStyle.minHeight = `${Math.max(240, Math.min(preferredFrame.height, 760))}px`
    } else if (singleViewMode) {
      nextStyle.minHeight = '420px'
    }
    return nextStyle
  }, [preferredFrame, singleViewMode])

  return (
    <article
      className={`widget-surface role-${widget.role} ${singleViewMode ? 'single-view' : ''} ${selected ? 'selected' : ''} ${replayAnchored ? 'replay-anchored' : ''} ${replayBranchActive ? 'replay-active' : ''}`}
      onClick={onSelect}
      style={surfaceStyle}
    >
      <div className="widget-hitbox">
        {singleViewMode ? null : (
          <div className="widget-heading">
            <div>
              <h3>{widget.title}</h3>
            </div>
            <span className="widget-type">{typeLabel} · {rendererLabel}</span>
          </div>
        )}
        <div
          className="widget-viz"
          style={vizStyle}
          onClick={(event) => event.stopPropagation()}
        >
          <div className={`widget-render-frame renderer-${renderMode.mode || widget.provider || 'unknown'}`}>
            {visualization}
          </div>
        </div>
        {singleViewMode ? null : (
          <div className="widget-footer compact">
            <div className="metric-list">
              <span>{metricSummary}</span>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
