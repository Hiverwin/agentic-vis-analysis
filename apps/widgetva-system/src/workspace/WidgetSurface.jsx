import { useMemo, useRef, useState } from 'react'
import { useAppStore } from '../app/appStore.js'
import { EChartsView } from './EChartsView.jsx'
import { VegaLiteView } from './VegaLiteView.jsx'
import { createWorkspaceRendererRegistry } from './workspaceRendererRegistry.js'
import {
  buildBarRenderModel,
  buildHeatmapRenderModel,
  buildLineRenderModel,
  buildParallelCoordinatesRenderModel,
  buildSankeyRenderModel,
  buildScatterRenderModel,
} from './renderModels.js'
import { buildScatterBrushFromDrag } from './scatterInteractionOverlay.js'
import {
  buildBarOriginSpec,
  buildBarOriginEChartsOption,
  buildHeatmapEChartsOptionFromRenderModel,
  buildHeatmapSpec,
  buildLineEChartsOptionFromRenderModel,
  buildLineSpec,
  buildParallelCoordinatesEChartsOption,
  buildParallelCoordinatesSpec,
  buildSankeyEChartsOption,
  buildSankeyVegaSpec,
  buildScatterEChartsOptionFromRenderModel,
  buildScatterVegaSpecFromRenderModel,
} from './widgetSpecs.js'
import { listProviderSupportedWidgetKinds, resolveWidgetNativePayload, resolveWidgetRenderMode } from './widgetRenderSupport.js'

function scaleValue(value, min, max) {
  if (max === min) return 0.5
  return (value - min) / (max - min)
}

function rowMatchesPredicate(row, predicate) {
  if (!predicate || typeof predicate !== 'object') return true
  const field = predicate.field
  const op = predicate.op
  const value = predicate.value
  if (!field || !(field in row)) return false
  if (op === 'equals') return row[field] === value
  if (op === 'in' && Array.isArray(value)) return value.includes(row[field])
  if (op === 'between' && Array.isArray(value) && value.length === 2) {
    return row[field] >= value[0] && row[field] <= value[1]
  }
  return true
}

function rowMatchesPredicates(row, predicates = []) {
  if (!Array.isArray(predicates) || predicates.length === 0) return false
  return predicates.every((predicate) => rowMatchesPredicate(row, predicate))
}

function ScatterGlyph({ renderModel, focusedCarId }) {
  const setFocusedCarId = useAppStore((state) => state.setFocusedCarId)
  const width = 440
  const height = 176
  const left = 34
  const right = 14
  const top = 16
  const bottom = 24
  const innerWidth = width - left - right
  const innerHeight = height - top - bottom
  const xDomain = renderModel?.domains?.x || [40, 230]
  const yDomain = renderModel?.domains?.y || [8, 40]
  const palette = renderModel?.palette || {}
  const highlightPredicates = renderModel?.highlightPredicates || []

  function scaleX(value) {
    return left + (scaleValue(value, xDomain[0], xDomain[1]) * innerWidth)
  }

  function scaleY(value) {
    return top + ((1 - scaleValue(value, yDomain[0], yDomain[1])) * innerHeight)
  }

  return (
    <svg className="viz-svg interactive scatter-glyph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Scatter plot">
      <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} className="viz-axis" />
      <line x1={left} y1={top} x2={left} y2={height - bottom} className="viz-axis" />
      <text x={width / 2} y={height - 6} textAnchor="middle" className="viz-label">Horsepower</text>
      <text x={14} y={height / 2} textAnchor="middle" className="viz-label" transform={`rotate(-90 14 ${height / 2})`}>MPG</text>
      {(renderModel?.rows || []).map((row) => {
        const highlighted = highlightPredicates.length === 0 || rowMatchesPredicates(row.raw, highlightPredicates)
        const strong = row.id === focusedCarId || highlighted
        const radius = 4 + (scaleValue(row.size, renderModel?.domains?.size?.[0] || 0, renderModel?.domains?.size?.[1] || 1) * 4)
        return (
          <circle
            key={row.id}
            cx={scaleX(row.x)}
            cy={scaleY(row.y)}
            r={radius}
            fill={palette[row.category] || '#2d5f98'}
            fillOpacity={strong ? 0.88 : 0.22}
            stroke={row.id === focusedCarId ? '#16324f' : '#f8fbff'}
            strokeWidth={row.id === focusedCarId ? 1.4 : 0.8}
            onClick={(event) => {
              event.stopPropagation()
              setFocusedCarId(row.id)
            }}
          />
        )
      })}
    </svg>
  )
}

function BarGlyph({ renderModel }) {
  const selectOrigin = useAppStore((state) => state.selectOrigin)
  const width = 440
  const height = 176
  const left = 34
  const right = 12
  const top = 16
  const bottom = 28
  const innerWidth = width - left - right
  const innerHeight = height - top - bottom
  const rows = renderModel?.rows || []
  const maxValue = Math.max(...rows.map((row) => Number(row.value) || 0), 1)
  const gap = rows.length > 0 ? innerWidth / rows.length : 0
  const barWidth = Math.max(18, gap * 0.58)

  return (
    <svg className="viz-svg interactive bar-glyph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Bar chart">
      <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} className="viz-axis" />
      {rows.map((row, index) => {
        const x = left + (gap * index) + ((gap - barWidth) / 2)
        const barHeight = innerHeight * ((Number(row.value) || 0) / maxValue)
        const y = height - bottom - barHeight
        const strong = renderModel?.selectedCategory === 'All' || renderModel?.selectedCategory === row.category
        return (
          <g
            key={row.category}
            onClick={(event) => {
              event.stopPropagation()
              selectOrigin(row.category)
            }}
          >
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx="5"
              fill={renderModel?.palette?.[row.category] || '#2d5f98'}
              opacity={strong ? 0.94 : 0.34}
            />
            <text x={x + (barWidth / 2)} y={height - 10} textAnchor="middle" className="viz-label">{row.category}</text>
          </g>
        )
      })}
    </svg>
  )
}

function LineGlyph({ renderModel, analyticalOverlay = null }) {
  const selectYear = useAppStore((state) => state.selectYear)
  const width = 440
  const height = 176
  const left = 34
  const right = 14
  const top = 18
  const bottom = 26
  const innerWidth = width - left - right
  const innerHeight = height - top - bottom
  const rows = Array.isArray(renderModel?.rows) ? renderModel.rows : []

  if (analyticalOverlay?.kind === 'lineDrillDownRecords') {
    const maxValue = Math.max(...rows.map((row) => Number(row.value) || 0), 1)
    const gap = rows.length > 1 ? innerWidth / (rows.length - 1) : innerWidth / 2
    return (
      <svg className="viz-svg interactive line-glyph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Line chart">
        <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} className="viz-axis" />
        <line x1={left} y1={top} x2={left} y2={height - bottom} className="viz-axis" />
        {rows.map((row, index) => {
          const x = left + (gap * index)
          const y = height - bottom - (innerHeight * ((Number(row.value) || 0) / maxValue))
          return (
            <g key={`${row.series}-${row.x}-${index}`}>
              {index > 0 ? (
                <line
                  x1={left + (gap * (index - 1))}
                  y1={height - bottom - (innerHeight * ((Number(rows[index - 1]?.value) || 0) / maxValue))}
                  x2={x}
                  y2={y}
                  stroke={renderModel?.palette?.[row.series] || '#2d5f98'}
                  strokeWidth="2.1"
                  opacity="0.8"
                />
              ) : null}
              <circle cx={x} cy={y} r="4.2" fill={renderModel?.palette?.[row.series] || '#2d5f98'} />
            </g>
          )
        })}
      </svg>
    )
  }

  const xValues = [...new Set(rows.map((row) => Number(row.x)))]
  const minX = Math.min(...xValues, 0)
  const maxX = Math.max(...xValues, 1)
  const yValues = rows.map((row) => Number(row.value) || 0)
  const minY = Math.min(...yValues, 0)
  const maxY = Math.max(...yValues, 1)
  const seriesMap = rows.reduce((acc, row) => {
    if (!acc.has(row.series)) acc.set(row.series, [])
    acc.get(row.series).push(row)
    return acc
  }, new Map())

  function scaleX(value) {
    return left + (scaleValue(value, minX, maxX) * innerWidth)
  }

  function scaleY(value) {
    return top + ((1 - scaleValue(value, minY, maxY)) * innerHeight)
  }

  return (
    <svg className="viz-svg interactive line-glyph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Line chart">
      <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} className="viz-axis" />
      <line x1={left} y1={top} x2={left} y2={height - bottom} className="viz-axis" />
      {[...seriesMap.entries()].map(([series, points]) => {
        const sortedPoints = [...points].sort((a, b) => Number(a.x) - Number(b.x))
        const path = sortedPoints
          .map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.x)} ${scaleY(point.value)}`)
          .join(' ')
        return (
          <g key={series}>
            <path d={path} fill="none" stroke={renderModel?.palette?.[series] || '#2d5f98'} strokeWidth="2.1" />
            {sortedPoints.map((point) => {
              const selected = renderModel?.selectedX === 'All' || renderModel?.selectedX === point.x
              return (
                <circle
                  key={`${series}-${point.x}`}
                  cx={scaleX(point.x)}
                  cy={scaleY(point.value)}
                  r="4.1"
                  fill={renderModel?.palette?.[series] || '#2d5f98'}
                  opacity={selected ? 0.94 : 0.35}
                  onClick={(event) => {
                    event.stopPropagation()
                    selectYear(point.x)
                  }}
                />
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}

function HeatmapGlyph({ renderModel, analyticalOverlay = null }) {
  const selectHeatmapCell = useAppStore((state) => state.selectHeatmapCell)
  const width = 440
  const height = 176
  const left = 46
  const right = 12
  const top = 18
  const bottom = 24
  const rows = renderModel?.rows || []
  const transposed = analyticalOverlay?.kind === 'heatmapTranspose' && analyticalOverlay?.transposed !== false
  const xValues = [...new Set(rows.map((row) => (transposed ? row.y : row.x)))]
  const yValues = [...new Set(rows.map((row) => (transposed ? row.x : row.y)))]
  const cellWidth = xValues.length > 0 ? (width - left - right) / xValues.length : 0
  const cellHeight = yValues.length > 0 ? (height - top - bottom) / yValues.length : 0
  const values = rows.map((row) => Number(row.value) || 0)
  const minValue = Math.min(...values, 0)
  const maxValue = Math.max(...values, 1)

  function cellColor(value) {
    const ratio = scaleValue(value, minValue, maxValue)
    const channel = Math.round(229 - (ratio * 120))
    return `rgb(${channel}, ${channel + 10}, ${247 - Math.round(ratio * 70)})`
  }

  return (
    <svg className="viz-svg interactive heatmap-glyph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Heatmap">
      {xValues.map((value, index) => (
        <text key={`x-${value}`} x={left + (cellWidth * index) + (cellWidth / 2)} y={height - 8} textAnchor="middle" className="viz-label">
          {value}
        </text>
      ))}
      {yValues.map((value, index) => (
        <text key={`y-${value}`} x={18} y={top + (cellHeight * index) + (cellHeight / 2) + 3} textAnchor="start" className="viz-label">
          {value}
        </text>
      ))}
      {rows.map((row) => {
        const xValue = transposed ? row.y : row.x
        const yValue = transposed ? row.x : row.y
        const xIndex = xValues.indexOf(xValue)
        const yIndex = yValues.indexOf(yValue)
        const isSelectedOrigin = renderModel?.selectedOrigin === 'All' || renderModel?.selectedOrigin === row.y
        const isSelectedCylinder = renderModel?.selectedCylinders?.length === 0 || renderModel.selectedCylinders.includes(row.x)
        return (
          <rect
            key={`${row.y}-${row.x}`}
            x={left + (cellWidth * xIndex) + 2}
            y={top + (cellHeight * yIndex) + 2}
            width={Math.max(cellWidth - 4, 8)}
            height={Math.max(cellHeight - 4, 8)}
            rx="4"
            fill={cellColor(row.value)}
            opacity={isSelectedOrigin && isSelectedCylinder ? 0.96 : 0.38}
            onClick={(event) => {
              event.stopPropagation()
              selectHeatmapCell({
                origin: row.y,
                cylinders: row.x,
              })
            }}
          />
        )
      })}
    </svg>
  )
}

function ParallelCoordinatesGlyph({ rows, focusedCarId, highlightPredicates = [], visibleDimensionKeys = null }) {
  const selectParallelCar = useAppStore((state) => state.selectParallelCar)
  const allDimensions = [
    { key: 'horsepower', label: 'HP' },
    { key: 'mpg', label: 'MPG' },
    { key: 'weight', label: 'WT' },
    { key: 'acceleration', label: 'ACC' },
  ]
  const dimensions = Array.isArray(visibleDimensionKeys) && visibleDimensionKeys.length > 0
    ? allDimensions.filter((dimension) => visibleDimensionKeys.includes(dimension.key))
    : allDimensions
  const width = 440
  const height = 166
  const top = 18
  const bottom = 18
  const left = 28
  const right = 18
  const innerWidth = width - left - right
  const innerHeight = height - top - bottom
  const gap = dimensions.length > 1 ? innerWidth / (dimensions.length - 1) : 0
  const domains = Object.fromEntries(dimensions.map(({ key }) => {
    const values = rows.map((row) => row[key])
    return [key, [Math.min(...values), Math.max(...values)]]
  }))

  return (
    <svg className="viz-svg interactive parallel-glyph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Parallel coordinates chart">
      {dimensions.map((dimension, index) => {
        const x = left + gap * index
        return (
          <g key={dimension.key}>
            <line x1={x} y1={top} x2={x} y2={height - bottom} className="viz-axis" />
            <text x={x} y={12} textAnchor="middle" className="viz-label strong">{dimension.label}</text>
          </g>
        )
      })}
      {rows.map((row) => {
        const path = dimensions.map((dimension, index) => {
          const x = left + gap * index
          const [min, max] = domains[dimension.key]
          const y = top + innerHeight * (1 - scaleValue(row[dimension.key], min, max))
          return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
        }).join(' ')
        const strong = row.id === focusedCarId || rowMatchesPredicates(row, highlightPredicates)
        return (
          <path
            key={row.id}
            d={path}
            className={`parallel-line ${strong ? 'strong' : 'dimmed'}`}
            onClick={(event) => {
              event.stopPropagation()
              selectParallelCar(row)
            }}
          />
        )
      })}
    </svg>
  )
}

function SankeyGlyph({ graph, highlightPredicates = [], analyticalOverlay = null }) {
  const selectSankeyNode = useAppStore((state) => state.selectSankeyNode)
  const width = 440
  const height = 166
  const top = 18
  const left = 20
  const columnX = [left + 28, left + 180, left + 332]
  const columnGroups = [0, 1, 2].map((column) => (graph?.nodes || []).filter((node) => node.column === column))

  const nodeBoxes = {}
  columnGroups.forEach((nodes, column) => {
    const step = nodes.length > 1 ? 108 / (nodes.length - 1) : 0
    nodes.forEach((node, index) => {
      nodeBoxes[node.id] = {
        x: columnX[column],
        y: top + index * step,
        width: 84,
        height: 22,
        ...node,
        ...(node.kind ? { [node.kind]: node.kind === 'cylinders' ? Number(node.value) : node.value } : {}),
      }
    })
  })

  return (
    <svg className="viz-svg interactive sankey-glyph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sankey flow chart">
      {(graph?.links || []).map((link, index) => {
        const source = nodeBoxes[link.source]
        const target = nodeBoxes[link.target]
        if (!source || !target) return null
        const isConnectedToTraceNode = analyticalOverlay?.kind === 'sankeyTraceNode'
          && typeof analyticalOverlay.nodeName === 'string'
          && (link.source === analyticalOverlay.nodeName || link.target === analyticalOverlay.nodeName)
        const isConnectedToColorNode = analyticalOverlay?.kind === 'sankeyColorFlows'
          && Array.isArray(analyticalOverlay.nodes)
          && (
            analyticalOverlay.nodes.includes(link.source || '')
            || analyticalOverlay.nodes.includes(link.target || '')
          )
        const x1 = source.x + source.width
        const y1 = source.y + source.height / 2
        const x2 = target.x
        const y2 = target.y + target.height / 2
        const c1 = x1 + (x2 - x1) * 0.35
        const c2 = x1 + (x2 - x1) * 0.65
        return (
          <path
            key={`${link.source}-${link.target}-${index}`}
            d={`M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}`}
            className="sankey-link"
            style={{
              strokeWidth: Math.max(2, link.count * 1.2),
              stroke: isConnectedToColorNode ? (analyticalOverlay?.color || '#d9485f') : undefined,
              strokeOpacity: analyticalOverlay?.kind === 'sankeyTraceNode'
                ? (isConnectedToTraceNode ? 0.9 : 0.12)
                : analyticalOverlay?.kind === 'sankeyColorFlows'
                  ? (isConnectedToColorNode ? 0.92 : 0.18)
                  : undefined,
            }}
          />
        )
      })}
      {Object.values(nodeBoxes).map((node) => {
        const strong = highlightPredicates.length === 0 || rowMatchesPredicates(node, highlightPredicates)
        const tracedNode = analyticalOverlay?.kind === 'sankeyTraceNode'
          && typeof analyticalOverlay.nodeName === 'string'
          && node.name === analyticalOverlay.nodeName
        const connectedColorNode = analyticalOverlay?.kind === 'sankeyColorFlows'
          && Array.isArray(analyticalOverlay.nodes)
          && analyticalOverlay.nodes.includes(node.name || '')
        return (
        <g
          key={node.id}
          onClick={(event) => {
            event.stopPropagation()
            selectSankeyNode(node)
          }}
        >
          <rect
            x={node.x}
            y={node.y}
            width={node.width}
            height={node.height}
            rx="6"
            className={`sankey-node ${strong ? 'strong' : 'dimmed'}`}
            style={{
              opacity: analyticalOverlay?.kind === 'sankeyTraceNode'
                ? (tracedNode ? 1 : 0.22)
                : analyticalOverlay?.kind === 'sankeyColorFlows'
                  ? (connectedColorNode ? 1 : 0.5)
                  : undefined,
              stroke: tracedNode ? '#d9485f' : undefined,
              strokeWidth: tracedNode ? 2.2 : undefined,
            }}
          />
          <text x={node.x + 8} y={node.y + 14} className="viz-label sankey-label">{node.label}</text>
        </g>
      )})}
    </svg>
  )
}

const WORKSPACE_RENDERER_REGISTRY = createWorkspaceRendererRegistry([
  {
    provider: 'vega-lite',
    supportedWidgetKinds: listProviderSupportedWidgetKinds('vega-lite'),
    renderWidget({ widget, store }) {
      const widgetKind = widget.widgetKind || widget.kind || null
      const nativePayload = resolveWidgetNativePayload(widget)
      if (widgetKind === 'scatter') {
        const renderModel = buildScatterRenderModel(widget.derivedData || [], widget.viewState || {})
        return (
          <VegaLiteView
            spec={nativePayload.payload || buildScatterVegaSpecFromRenderModel(renderModel, widget.viewState || {})}
            className="vega-shell"
            signalListeners={[
              {
                name: 'hpBrush',
                handler: (_name, value) => {
                  store.syncScatterBrushSelection(value)
                },
              },
            ]}
            onItemClick={(datum) => {
              if (datum?.id) store.setFocusedCarId(datum.id)
            }}
          />
        )
      }
      if (widgetKind === 'bar') {
        return (
          <VegaLiteView
            spec={nativePayload.payload || buildBarOriginSpec(widget.derivedData || [], widget.viewState)}
            className="vega-shell"
            onItemClick={(datum) => {
              if (datum?.origin) store.selectOrigin(datum.origin)
            }}
          />
        )
      }
      if (widgetKind === 'line') {
        return (
          <VegaLiteView
            spec={nativePayload.payload || buildLineSpec(widget.derivedData || [], widget.viewState)}
            className="vega-shell"
            onItemClick={(datum) => {
              if (Number.isFinite(datum?.year)) {
                store.selectYear(datum.year)
              }
            }}
          />
        )
      }
      if (widgetKind === 'heatmap') {
        return (
          <VegaLiteView
            spec={nativePayload.payload || buildHeatmapSpec(widget.derivedData || [], widget.viewState, widget.viewState)}
            className="vega-shell"
            onItemClick={(datum) => {
              if (datum?.origin && Number.isFinite(datum?.cylinders)) {
                store.selectHeatmapCell({
                  origin: datum.origin,
                  cylinders: datum.cylinders,
                })
              }
            }}
          />
        )
      }
      if (widgetKind === 'parallelCoordinates') {
        return (
          <VegaLiteView
            spec={nativePayload.payload || buildParallelCoordinatesSpec(buildParallelCoordinatesRenderModel(widget.derivedData || [], widget.viewState || {}))}
            className="vega-shell"
            onItemClick={(datum) => {
              if (datum?.id) store.selectParallelCar(datum)
            }}
          />
        )
      }
      if (widgetKind === 'sankey') {
        return (
          <VegaLiteView
            spec={nativePayload.payload || buildSankeyVegaSpec(buildSankeyRenderModel(widget.derivedData, widget.viewState || {}))}
            className="vega-shell"
            onItemClick={(datum) => {
              if (datum?.kind) store.selectSankeyNode(datum)
            }}
          />
        )
      }
      return null
    },
  },
  {
    provider: 'echarts',
    supportedWidgetKinds: listProviderSupportedWidgetKinds('echarts'),
    renderWidget({ widget, store, resolution }) {
      const nativePayload = resolveWidgetNativePayload(widget)
      if (resolution.widgetKind === 'scatter') {
        return (
          <EChartsView
            option={nativePayload.payload || buildScatterEChartsOptionFromRenderModel(buildScatterRenderModel(widget.derivedData || [], widget.viewState || {}))}
            className="vega-shell"
            onItemClick={(datum) => {
              if (datum?.id) store.setFocusedCarId(datum.id)
            }}
          />
        )
      }
      if (resolution.widgetKind === 'bar') {
        return (
          <EChartsView
            option={nativePayload.payload || buildBarOriginEChartsOption(widget.derivedData || [], widget.viewState)}
            className="vega-shell"
            onItemClick={(datum) => {
              if (datum?.origin) store.selectOrigin(datum.origin)
            }}
          />
        )
      }
      if (resolution.widgetKind === 'line') {
        return (
          <EChartsView
            option={nativePayload.payload || buildLineEChartsOptionFromRenderModel(
              buildLineRenderModel(widget.derivedData || [], widget.viewState || {}),
              widget.viewState || {},
            )}
            className="vega-shell"
            onItemClick={(datum) => {
              if (Number.isFinite(datum?.year)) {
                store.selectYear(datum.year)
              }
            }}
          />
        )
      }
      if (resolution.widgetKind === 'heatmap') {
        return (
          <EChartsView
            option={nativePayload.payload || buildHeatmapEChartsOptionFromRenderModel(
              buildHeatmapRenderModel(widget.derivedData || [], widget.viewState || {}, widget.viewState || {}),
              widget.viewState || {},
              widget.viewState || {},
            )}
            className="vega-shell"
            onItemClick={(datum) => {
              const value = Array.isArray(datum?.value) ? datum.value : null
              if (value && typeof value[4] === 'string' && Number.isFinite(value[3])) {
                store.selectHeatmapCell({
                  origin: value[4],
                  cylinders: value[3],
                })
              }
            }}
          />
        )
      }
      if (resolution.widgetKind === 'parallelCoordinates') {
        return (
          <EChartsView
            option={nativePayload.payload || buildParallelCoordinatesEChartsOption(buildParallelCoordinatesRenderModel(widget.derivedData || [], widget.viewState || {}))}
            className="vega-shell"
            onItemClick={(datum) => {
              if (datum?.id) store.selectParallelCar(datum.raw || datum)
            }}
          />
        )
      }
      if (resolution.widgetKind === 'sankey') {
        return (
          <EChartsView
            option={nativePayload.payload || buildSankeyEChartsOption(buildSankeyRenderModel(widget.derivedData, widget.viewState || {}))}
            className="vega-shell"
            onItemClick={(datum) => {
              if (datum?.kind) store.selectSankeyNode(datum)
            }}
          />
        )
      }
      return null
    },
  },
  {
    provider: 'd3',
    supportedWidgetKinds: listProviderSupportedWidgetKinds('d3'),
    renderWidget({ widget, resolution }) {
      if (resolution.widgetKind === 'scatter') {
        return (
          <ScatterGlyph
            renderModel={buildScatterRenderModel(widget.derivedData || [], widget.viewState || {})}
            focusedCarId={widget.viewState?.focusedCarId}
          />
        )
      }
      if (resolution.widgetKind === 'bar') {
        return (
          <BarGlyph
            renderModel={buildBarRenderModel(widget.derivedData || [], widget.viewState || {})}
          />
        )
      }
      if (resolution.widgetKind === 'line') {
        return (
          <LineGlyph
            renderModel={buildLineRenderModel(widget.derivedData || [], widget.viewState || {})}
            analyticalOverlay={widget.viewState?.analyticalOverlay || null}
          />
        )
      }
      if (resolution.widgetKind === 'heatmap') {
        return (
          <HeatmapGlyph
            renderModel={buildHeatmapRenderModel(widget.derivedData || [], widget.viewState || {}, widget.viewState || {})}
            analyticalOverlay={widget.viewState?.analyticalOverlay || null}
          />
        )
      }
      if (resolution.widgetKind === 'parallelCoordinates') {
        return (
          <ParallelCoordinatesGlyph
            rows={widget.derivedData || []}
            focusedCarId={widget.viewState?.focusedCarId}
            highlightPredicates={widget.viewState?.highlightPredicates || []}
            visibleDimensionKeys={widget.viewState?.visibleDimensionKeys || null}
          />
        )
      }
      if (resolution.widgetKind === 'sankey') {
        return (
          <SankeyGlyph
            graph={widget.derivedData}
            highlightPredicates={widget.viewState?.highlightPredicates || []}
            analyticalOverlay={widget.viewState?.analyticalOverlay || null}
          />
        )
      }
      return null
    },
  },
])

function renderVisualization(widget) {
  return WORKSPACE_RENDERER_REGISTRY.renderWidget({
    widget,
    store: useAppStore.getState(),
  }) || <div className="empty-panel">Widget rendering unavailable.</div>
}

function resolveRendererLabel(provider, rendererFamily, renderMode = 'glyph') {
  if (provider === 'vega-lite') {
    if (renderMode !== 'vega-lite') return 'vega-lite fallback'
    if (rendererFamily === 'echarts') return 'vega-lite fallback'
    if (rendererFamily === 'svg-custom') return 'vega-lite fallback'
    return 'vega-lite'
  }
  if (provider === 'd3') {
    if (rendererFamily === 'echarts') return 'svg fallback'
    return 'd3'
  }
  if (provider === 'echarts') {
    if (renderMode !== 'echarts') return 'echarts fallback'
    return 'echarts'
  }
  return provider || rendererFamily || 'auto'
}

export function WidgetSurface({ widget, selected, replayAnchored = false, replayBranchActive = false, onSelect }) {
  const rendererFamily = useAppStore((state) => state.rendererFamily)
  const zoomScatterViewport = useAppStore((state) => state.zoomScatterViewport)
  const resetScatterViewport = useAppStore((state) => state.resetScatterViewport)
  const syncScatterBrushSelection = useAppStore((state) => state.syncScatterBrushSelection)
  const [scatterBrushRect, setScatterBrushRect] = useState(null)
  const scatterBrushDragRef = useRef(null)
  const metricSummary = useMemo(
    () => (Array.isArray(widget?.metrics) ? widget.metrics.join(' · ') : ''),
    [widget?.metrics],
  )
  const rendererResolution = useMemo(() => WORKSPACE_RENDERER_REGISTRY.resolveWidget(widget), [widget])
  const renderMode = useMemo(() => resolveWidgetRenderMode(widget), [widget])
  const scatterRenderModel = useMemo(
    () => ((widget.widgetKind || widget.kind || widget.type) === 'scatter'
      ? buildScatterRenderModel(widget.derivedData || [], widget.viewState || {})
      : null),
    [widget],
  )
  const visualization = useMemo(() => renderVisualization(widget), [widget])
  const typeLabelMap = {
    scatter: 'scatter',
    bar: 'bar',
    line: 'line',
    heatmap: 'heatmap',
    parallelCoordinates: 'parallel',
    sankey: 'sankey',
  }
  const widgetKind = widget.widgetKind || widget.kind || widget.type
  const typeLabel = typeLabelMap[widgetKind] || widgetKind
  const rendererLabel = resolveRendererLabel(rendererResolution?.provider || widget.provider, rendererFamily, renderMode.mode)
  const scatterInteractive = rendererResolution?.widgetKind === 'scatter'
  const supportsManualScatterBrush = scatterInteractive && rendererResolution?.provider !== 'vega-lite'

  function handleScatterWheel(event) {
    if (!scatterInteractive) return
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    event.stopPropagation()
    const bounds = event.currentTarget.getBoundingClientRect()
    const anchorX = bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0.5
    const anchorY = bounds.height > 0 ? (event.clientY - bounds.top) / bounds.height : 0.5
    zoomScatterViewport({
      deltaY: event.deltaY,
      anchorX,
      anchorY,
    })
  }

  function handleScatterDoubleClick(event) {
    if (!scatterInteractive) return
    event.preventDefault()
    event.stopPropagation()
    resetScatterViewport()
  }

  function handleScatterPointerDown(event) {
    if (!supportsManualScatterBrush || !event.shiftKey || event.button !== 0) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const nextRect = {
      left: event.clientX,
      right: event.clientX,
      top: event.clientY,
      bottom: event.clientY,
    }
    scatterBrushDragRef.current = {
      pointerId: event.pointerId,
      bounds,
      rect: nextRect,
    }
    setScatterBrushRect(nextRect)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.preventDefault()
    event.stopPropagation()
  }

  function handleScatterPointerMove(event) {
    const drag = scatterBrushDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const nextRect = {
      left: drag.rect.left,
      top: drag.rect.top,
      right: event.clientX,
      bottom: event.clientY,
    }
    scatterBrushDragRef.current = {
      ...drag,
      rect: nextRect,
    }
    setScatterBrushRect(nextRect)
    event.preventDefault()
    event.stopPropagation()
  }

  function finishScatterBrush(event) {
    const drag = scatterBrushDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const brush = buildScatterBrushFromDrag({
      dragRect: drag.rect,
      bounds: drag.bounds,
      xDomain: scatterRenderModel?.domains?.x || [40, 230],
      yDomain: scatterRenderModel?.domains?.y || [8, 40],
    })
    scatterBrushDragRef.current = null
    setScatterBrushRect(null)
    syncScatterBrushSelection(brush)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <article
      className={`widget-surface role-${widget.role} ${selected ? 'selected' : ''} ${replayAnchored ? 'replay-anchored' : ''} ${replayBranchActive ? 'replay-active' : ''}`}
      onClick={onSelect}
    >
      <div className="widget-hitbox">
        <div className="widget-heading">
          <div>
            <p className="widget-kicker">{widget.role}</p>
            <h3>{widget.title}</h3>
            <p>{widget.subtitle}</p>
          </div>
          <span className="widget-type">{typeLabel} · {rendererLabel}</span>
        </div>
        <div
          className="widget-viz"
          onPointerDown={(event) => {
            event.stopPropagation()
            if (supportsManualScatterBrush) {
              handleScatterPointerDown(event)
            }
          }}
          onClick={(event) => event.stopPropagation()}
          onPointerMove={supportsManualScatterBrush ? handleScatterPointerMove : undefined}
          onPointerUp={supportsManualScatterBrush ? finishScatterBrush : undefined}
          onPointerCancel={supportsManualScatterBrush ? finishScatterBrush : undefined}
          onWheel={scatterInteractive ? handleScatterWheel : undefined}
          onDoubleClick={scatterInteractive ? handleScatterDoubleClick : undefined}
        >
          {supportsManualScatterBrush && scatterBrushRect && scatterBrushDragRef.current?.bounds ? (
            <div
              className="scatter-brush-overlay"
              style={{
                left: `${Math.min(scatterBrushRect.left, scatterBrushRect.right) - scatterBrushDragRef.current.bounds.left}px`,
                top: `${Math.min(scatterBrushRect.top, scatterBrushRect.bottom) - scatterBrushDragRef.current.bounds.top}px`,
                width: `${Math.abs(scatterBrushRect.right - scatterBrushRect.left)}px`,
                height: `${Math.abs(scatterBrushRect.bottom - scatterBrushRect.top)}px`,
              }}
            />
          ) : null}
          <div className={`widget-render-frame renderer-${rendererResolution?.provider || widget.provider || 'unknown'}`}>
            {visualization}
          </div>
        </div>
        <div className="widget-footer compact">
          <div className="metric-list">
            <span>{metricSummary}</span>
          </div>
        </div>
      </div>
    </article>
  )
}
