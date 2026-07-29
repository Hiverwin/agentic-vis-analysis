import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts/core'
import {
  AriaComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  ParallelComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import {
  BarChart,
  HeatmapChart,
  LineChart,
  ParallelChart,
  SankeyChart,
  ScatterChart,
} from 'echarts/charts'
import { SVGRenderer } from 'echarts/renderers'

echarts.use([
  AriaComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  ParallelComponent,
  TooltipComponent,
  VisualMapComponent,
  BarChart,
  HeatmapChart,
  LineChart,
  ParallelChart,
  SankeyChart,
  ScatterChart,
  SVGRenderer,
])

export function EChartsView({ option, className = '', onItemClick = null }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const onItemClickRef = useRef(onItemClick)
  const [errorMessage, setErrorMessage] = useState('')
  const [diagnosticMessage, setDiagnosticMessage] = useState('')

  useEffect(() => {
    onItemClickRef.current = onItemClick
  }, [onItemClick])

  useEffect(() => {
    if (!containerRef.current || !option) return undefined

    setErrorMessage('')
    setDiagnosticMessage('')
    let disposed = false
    let resizeObserver = null
    let clickHandler = null
    let diagnosticTimer = null

    function disposeChart() {
      const activeChart = chartRef.current
      if (!activeChart) return
      if (clickHandler) {
        activeChart.off('click', clickHandler)
      }
      activeChart.dispose()
      if (chartRef.current === activeChart) {
        chartRef.current = null
      }
    }

    function mountChartIfReady() {
      if (disposed || !containerRef.current) return
      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight
      if (width <= 0 || height <= 0) {
        setDiagnosticMessage(`ECharts container has no drawable size yet (${width}x${height}).`)
        return
      }
      setDiagnosticMessage('')

      if (!chartRef.current) {
        echarts.getInstanceByDom(containerRef.current)?.dispose()
        chartRef.current = echarts.init(containerRef.current, null, {
          renderer: 'svg',
        })
      }

      try {
        clickHandler = (params) => {
          const datum = params?.data || null
          if (datum) onItemClickRef.current?.(datum)
        }
        chartRef.current.off('click')
        chartRef.current.on('click', clickHandler)
        chartRef.current.setOption(option, true)
        chartRef.current.resize()
        window.clearTimeout(diagnosticTimer)
        diagnosticTimer = window.setTimeout(() => {
          if (disposed || !containerRef.current) return
          const renderedNode = containerRef.current.querySelector('svg, canvas')
          if (!renderedNode) {
            const seriesCount = Array.isArray(option?.series) ? option.series.length : 0
            setDiagnosticMessage(`ECharts mounted but emitted no DOM nodes. series=${seriesCount}`)
          }
        }, 120)
      } catch (error) {
        if (!disposed) {
          setErrorMessage(error instanceof Error ? error.message : 'Unknown ECharts error')
        }
        disposeChart()
      }
    }

    resizeObserver = new ResizeObserver(() => {
      if (chartRef.current) {
        chartRef.current.resize()
        return
      }
      mountChartIfReady()
    })
    resizeObserver.observe(containerRef.current)
    const rafId = window.requestAnimationFrame(() => {
      mountChartIfReady()
    })

    return () => {
      disposed = true
      window.cancelAnimationFrame(rafId)
      window.clearTimeout(diagnosticTimer)
      resizeObserver?.disconnect()
      disposeChart()
    }
  }, [option])

  if (errorMessage) {
    return (
      <div className="empty-panel runtime-note">
        ECharts view failed: {errorMessage}
      </div>
    )
  }

  return (
    <div className={`echarts-view ${className}`.trim()}>
      <div ref={containerRef} className="echarts-shell" />
      {diagnosticMessage ? (
        <div className="runtime-note echarts-diagnostic">
          {diagnosticMessage}
        </div>
      ) : null}
    </div>
  )
}
