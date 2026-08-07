import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../../../app/store/appStore.js'
import { buildTraceTimelineModel } from '../models/traceViewModel.js'

const OPERATION_COLORS = {
  action: 'var(--accent)',
  selection: '#5d82b2',
  filter: '#5a9b8d',
  view: '#9272b4',
  inspect: '#b47d43',
}

function clampZoom(value) {
  return Math.max(0.5, Math.min(2.4, value))
}

function buildGraphLayout(nodes = []) {
  const nodeWidth = 184
  const nodeHeight = 48
  const columnGap = 52
  const rowGap = 24
  const margin = 18
  const positions = new Map(nodes.map((node, index) => [node.id, {
    x: margin + index * (nodeWidth + columnGap),
    y: margin + (node.branchDepth || 0) * (nodeHeight + rowGap),
  }]))
  const depth = Math.max(0, ...nodes.map((node) => node.branchDepth || 0))
  return {
    positions,
    nodeWidth,
    nodeHeight,
    width: margin * 2 + Math.max(1, nodes.length) * nodeWidth + Math.max(0, nodes.length - 1) * columnGap,
    height: margin * 2 + (depth + 1) * nodeHeight + depth * rowGap,
  }
}

function TraceNode({ node, position, layout, selected, onPointerDown }) {
  const color = OPERATION_COLORS[node.operationTopic] || OPERATION_COLORS.action
  return (
    <g transform={`translate(${position.x}, ${position.y})`} onMouseDown={(event) => onPointerDown(event, node.id)} style={{ cursor: 'pointer' }}>
      <rect
        width={layout.nodeWidth}
        height={layout.nodeHeight}
        rx="7"
        fill="var(--surface)"
        stroke={selected ? 'var(--accent)' : color}
        strokeWidth={selected ? 2 : 1.2}
      />
      <circle cx="12" cy="14" r="4" fill={color} />
      <text x="22" y="17" fontSize="10" fontWeight="700" fill="var(--text)">{`${node.stepNumber}. ${node.shortLabel}`.slice(0, 26)}</text>
      <text x="10" y="33" fontSize="9" fill="var(--text-dim)">{node.widgetTitle.slice(0, 24)}</text>
    </g>
  )
}

export function TracePanel() {
  const trace = useAppStore((state) => state.trace)
  const selectedTraceStepId = useAppStore((state) => state.selectedTraceStepId)
  const selectTraceStep = useAppStore((state) => state.selectTraceStep)
  const [zoom, setZoom] = useState(1)
  const [nodeOffsets, setNodeOffsets] = useState({})
  const viewportRef = useRef(null)
  const panRef = useRef({ active: false, x: 0, y: 0, left: 0, top: 0 })
  const dragRef = useRef(null)
  const model = useMemo(
    () => buildTraceTimelineModel(trace, { selectedStepId: selectedTraceStepId }),
    [selectedTraceStepId, trace],
  )
  const layout = useMemo(() => buildGraphLayout(model.nodes), [model.nodes])
  const nodeById = useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model.nodes])
  const selectedStep = model.selectedStep

  const positionFor = (nodeId) => {
    const position = layout.positions.get(nodeId)
    if (!position) return null
    const offset = nodeOffsets[nodeId] || { x: 0, y: 0 }
    return { x: position.x + offset.x, y: position.y + offset.y }
  }

  const centerCurrent = () => {
    const viewport = viewportRef.current
    const position = positionFor(model.selection.currentNode?.id)
    if (!viewport || !position) return
    viewport.scrollLeft = Math.max(0, position.x * zoom - viewport.clientWidth / 2 + (layout.nodeWidth * zoom) / 2)
    viewport.scrollTop = Math.max(0, position.y * zoom - viewport.clientHeight / 2 + (layout.nodeHeight * zoom) / 2)
  }

  const fitGraph = () => {
    const viewport = viewportRef.current
    if (!viewport) return
    setZoom(clampZoom(Math.min(viewport.clientWidth / (layout.width + 40), viewport.clientHeight / (layout.height + 40))))
  }

  useEffect(() => {
    if (!model.selection.currentNode?.id) return
    requestAnimationFrame(centerCurrent)
  }, [model.selection.currentNode?.id])

  const startNodeDrag = (event, nodeId) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const offset = nodeOffsets[nodeId] || { x: 0, y: 0 }
    dragRef.current = { nodeId, x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y, moved: false }
  }

  const startPan = (event) => {
    if (event.button !== 0 || !viewportRef.current) return
    panRef.current = { active: true, x: event.clientX, y: event.clientY, left: viewportRef.current.scrollLeft, top: viewportRef.current.scrollTop }
  }

  const movePointer = (event) => {
    if (dragRef.current) {
      const drag = dragRef.current
      const x = (event.clientX - drag.x) / zoom
      const y = (event.clientY - drag.y) / zoom
      drag.moved ||= Math.abs(x) > 1 || Math.abs(y) > 1
      setNodeOffsets((offsets) => ({ ...offsets, [drag.nodeId]: { x: drag.offsetX + x, y: drag.offsetY + y } }))
      return
    }
    if (!panRef.current.active || !viewportRef.current) return
    viewportRef.current.scrollLeft = panRef.current.left - (event.clientX - panRef.current.x)
    viewportRef.current.scrollTop = panRef.current.top - (event.clientY - panRef.current.y)
  }

  const stopPointer = () => {
    const drag = dragRef.current
    if (drag && !drag.moved) selectTraceStep(drag.nodeId)
    dragRef.current = null
    panRef.current.active = false
  }

  if (model.stepCount === 0) {
    return <div className="trace-timeline-empty"><strong>No trace yet</strong><p>Interact with a widget or run an agent step to record the workspace trajectory.</p></div>
  }

  return (
    <div className="trace-graph-panel">
      <div className="trace-graph-toolbar">
        <span>{model.stepCount} steps</span>
        <div className="trace-graph-actions">
          <button type="button" onClick={() => setZoom((value) => clampZoom(value - 0.1))} aria-label="Zoom out">−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((value) => clampZoom(value + 0.1))} aria-label="Zoom in">+</button>
          <button type="button" onClick={fitGraph}>Fit</button>
          <button type="button" onClick={() => setNodeOffsets({})}>Reset</button>
          <button type="button" onClick={centerCurrent}>Center</button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className="trace-graph-viewport"
        onMouseDown={startPan}
        onMouseMove={movePointer}
        onMouseUp={stopPointer}
        onMouseLeave={stopPointer}
        onWheel={(event) => {
          if (!event.ctrlKey) return
          event.preventDefault()
          setZoom((value) => clampZoom(value + (event.deltaY > 0 ? -0.08 : 0.08)))
        }}
      >
        <svg width={Math.max(240, layout.width * zoom)} height={Math.max(150, layout.height * zoom)}>
          <defs><marker id="trace-graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>
          <g transform={`scale(${zoom})`}>
            {model.edges.map((edge) => {
              const source = positionFor(edge.from)
              const target = positionFor(edge.to)
              if (!source || !target) return null
              const targetNode = nodeById.get(edge.to)
              const color = OPERATION_COLORS[targetNode?.operationTopic] || OPERATION_COLORS.action
              const x1 = source.x + layout.nodeWidth
              const y1 = source.y + layout.nodeHeight / 2
              const x2 = target.x
              const y2 = target.y + layout.nodeHeight / 2
              const control = (x1 + x2) / 2
              return <path key={edge.id} d={`M ${x1} ${y1} C ${control} ${y1}, ${control} ${y2}, ${x2} ${y2}`} fill="none" stroke={color} strokeWidth="1.7" markerEnd="url(#trace-graph-arrow)" style={{ color }} />
            })}
            {model.nodes.map((node) => {
              const position = positionFor(node.id)
              if (!position) return null
              return <TraceNode key={node.id} node={node} position={position} layout={layout} selected={node.id === selectedTraceStep?.id} onPointerDown={startNodeDrag} />
            })}
          </g>
        </svg>
      </div>
      <div className="trace-graph-detail">
        {selectedStep ? <><span>{selectedStep.kindLabel} · {selectedStep.widgetTitle}</span><strong>{selectedStep.summary}</strong><p>{selectedStep.detail || selectedStep.verificationSummary || 'Drag nodes to arrange the trace.'}</p></> : null}
      </div>
    </div>
  )
}
