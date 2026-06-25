import { useEffect, useMemo, useRef, useState } from 'react'
import t from '../locale.js'
import { computeTraceGraphLayout, normalizeRuntimeTraceGraph } from './trajectory/traceGraphRuntime.js'
import { collectRuntimeSnapshotEvidence, getPrimarySnapshotSpec } from './trajectory/runtimeEvidence.js'
import {
  createRuntimeSnapshotEvidencePort,
  hasRuntimeSnapshotEvidenceAccess,
  hasRuntimeStateJumpAccess,
  hasRuntimeTraceGraphAccess,
  jumpRuntimeState,
  readRuntimeTraceGraph,
} from './trajectory/runtimeTransport.js'

const EDGE_COLORS = {
  continue: 'var(--accent)',
  branch: '#7b4cb8',
  jump_back: 'var(--warning)',
}

export default function TrajectoryModal({
  sessionId,
  open,
  onClose,
  onSelectRecord,
}) {
  const [graph, setGraph] = useState(null)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [selectedSnapshotSummary, setSelectedSnapshotSummary] = useState(null)
  const [selectedLinkPropagation, setSelectedLinkPropagation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, baseX: 0, baseY: 0 })
  const runtimeEvidencePort = useMemo(() => createRuntimeSnapshotEvidencePort(), [])

  async function loadGraph() {
    if (!open) return
    if (!hasRuntimeTraceGraphAccess()) {
      setGraph(null)
      return
    }
    setLoading(true)
    setErr('')
    try {
      const runtimeGraph = await readRuntimeTraceGraph({ limit: 200 })
      if (runtimeGraph?.nodes) {
        setGraph(normalizeRuntimeTraceGraph(runtimeGraph))
        return
      }
      setGraph(null)
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    void loadGraph()
  }, [open, sessionId])

  const layout = useMemo(() => computeTraceGraphLayout(graph), [graph])

  useEffect(() => {
    if (!open) return
    const stateId = graph?.current_node_id
    if (!stateId || !hasRuntimeSnapshotEvidenceAccess()) return
    ;(async () => {
      const evidence = await collectRuntimeSnapshotEvidence(runtimeEvidencePort, stateId)
      setSelectedSnapshotSummary(evidence?.summary || null)
      setSelectedLinkPropagation(evidence?.linkPropagation || null)
      setSelectedNodeId(stateId)
    })()
  }, [open, graph?.current_node_id, runtimeEvidencePort])

  function onHeaderDown(e) {
    if (e.target?.closest?.('button')) return
    if (e.button !== 0) return
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      baseX: pos.x,
      baseY: pos.y,
    }
    e.preventDefault()
  }

  useEffect(() => {
    function onMove(e) {
      if (!dragRef.current.dragging) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      setPos({ x: dragRef.current.baseX + dx, y: dragRef.current.baseY + dy })
    }
    function onUp() {
      dragRef.current.dragging = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [pos.x, pos.y])

  async function handleNodeClick(node) {
    if (!node?.id) return
    setSelectedNodeId(node.id)
    if (!hasRuntimeStateJumpAccess() || !hasRuntimeSnapshotEvidenceAccess()) return
    await jumpRuntimeState({ stateId: node.id, actor: 'human' })
    const evidence = await collectRuntimeSnapshotEvidence(runtimeEvidencePort, node.id)
    const snapshot = evidence?.snapshot || null
    setSelectedSnapshotSummary(evidence?.summary || null)
    setSelectedLinkPropagation(evidence?.linkPropagation || null)
    const primarySpec = getPrimarySnapshotSpec(snapshot)
    if (primarySpec && typeof onSelectRecord === 'function') {
      onSelectRecord({
        stateId: node.id,
        source: 'widgetva_runtime',
        spec: primarySpec,
        snapshot,
      })
    }
    onClose?.()
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 50,
        display: 'block',
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
          width: 'min(1100px, 96vw)',
          height: 'min(700px, 86vh)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          onMouseDown={onHeaderDown}
          style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            cursor: 'move',
            userSelect: 'none',
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{t.trajectoryTitle}</div>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => void loadGraph()} disabled={loading}>{loading ? t.loading : t.refresh}</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>{t.close}</button>
          </div>
        </div>

        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-dim)' }}>
          {t.trajectoryLegend}{' '}
          <span style={{ color: EDGE_COLORS.continue, fontWeight: 600 }}>{t.legendTool}</span>,{' '}
          <span style={{ color: EDGE_COLORS.branch, fontWeight: 600 }}>{t.legendHumanInterrupt}</span>,{' '}
          <span style={{ color: EDGE_COLORS.jump_back, fontWeight: 600 }}>{t.legendReset}</span> /{' '}
          <span style={{ color: EDGE_COLORS.jump_back, fontWeight: 600 }}>{t.legendUndo}</span>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--surface2)' }}>
          {err ? (
            <div style={{ padding: 16, color: 'var(--danger)', fontSize: 12 }}>{err}</div>
          ) : !graph ? (
            <div style={{ padding: 16, color: 'var(--text-dim)', fontSize: 12 }}>{t.noTrajectoryYet}</div>
          ) : (
            <svg width={layout.width} height={layout.height} style={{ display: 'block' }}>
              <defs>
                <marker id="trajArrowModal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                </marker>
              </defs>
              {layout.edges.map((e) => {
                const a = layout.positions.get(e.from_id)
                const b = layout.positions.get(e.to_id)
                if (!a || !b) return null
                const x1 = a.x + layout.nodeW
                const y1 = a.y + layout.nodeH / 2
                const x2 = b.x
                const y2 = b.y + layout.nodeH / 2
                const isJump = e.edge_type === 'jump_back' || e.edge_type === 'reset' || e.edge_type === 'undo'
                const cx = isJump
                  ? Math.min(x1, x2) - Math.max(50, Math.abs(x1 - x2) * 0.35)
                  : (x1 + x2) / 2
                const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`
                const stroke = EDGE_COLORS[e.edge_type] || 'var(--border-strong)'
                return (
                  <path
                    key={e.id || `${e.from_id}-${e.to_id}`}
                    d={d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={isJump ? 1.8 : 1.5}
                    strokeDasharray={isJump ? '4 3' : undefined}
                    markerEnd="url(#trajArrowModal)"
                    style={{ color: stroke }}
                  />
                )
              })}

              {layout.nodes.map((n) => {
                const p = layout.positions.get(n.id)
                if (!p) return null
                const selected = selectedNodeId === n.id
                const current = graph?.current_node_id === n.id
                return (
                  <g
                    key={n.id}
                    transform={`translate(${p.x}, ${p.y})`}
                    onClick={() => void handleNodeClick(n)}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x="0"
                      y="0"
                      width={layout.nodeW}
                      height={layout.nodeH}
                      rx="10"
                      fill="var(--surface)"
                      stroke={selected ? 'var(--accent)' : n.has_response ? 'var(--success)' : current ? 'var(--warning)' : 'var(--border)'}
                      strokeWidth={selected ? 2 : 1}
                    />
                    <text x="12" y="18" fontSize="12" fontWeight="700" fill="var(--text)">
                      {String(n.label || n.id).slice(0, 28)}
                    </text>
                    <text x="12" y="33" fontSize="10" fill="var(--text-dim)">
                      {String(n.response_preview || n.action_type || 'state').slice(0, 28)}
                    </text>
                  </g>
                )
              })}
            </svg>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 12px', fontSize: 12, color: 'var(--text-dim)' }}>
          {selectedSnapshotSummary ? (
            <>
              <span style={{ marginRight: 12 }}><strong>state</strong>: {selectedSnapshotSummary.stateId || '-'}</span>
              <span style={{ marginRight: 12 }}><strong>branch</strong>: {selectedSnapshotSummary.branchId || '-'}</span>
              <span style={{ marginRight: 12 }}><strong>transition</strong>: {selectedSnapshotSummary.transitionType || '-'}</span>
              <span style={{ marginRight: 12 }}><strong>widget</strong>: {selectedSnapshotSummary.focusedWidgetKind || '-'}</span>
              <span style={{ marginRight: 12 }}><strong>visible</strong>: {selectedSnapshotSummary.visibleCount ?? '-'}</span>
              <span style={{ marginRight: 12 }}><strong>selected</strong>: {selectedSnapshotSummary.selectedCount ?? '-'}</span>
              <span style={{ marginRight: 12 }}><strong>annotations</strong>: {selectedSnapshotSummary.annotationCount ?? 0}</span>
              <span style={{ marginRight: 12 }}><strong>compare</strong>: {selectedSnapshotSummary.comparisonTargetCount ?? 0}</span>
              {(selectedSnapshotSummary.taskMode || selectedSnapshotSummary.coordinationScope || selectedSnapshotSummary.evidenceType) ? (
                <span style={{ marginRight: 12 }}>
                  <strong>task</strong>: {[selectedSnapshotSummary.taskMode, selectedSnapshotSummary.coordinationScope, selectedSnapshotSummary.evidenceType].filter(Boolean).join(' · ')}
                </span>
              ) : null}
              {(selectedSnapshotSummary.replayRunMode || selectedSnapshotSummary.replayUserIntent) ? (
                <span style={{ marginRight: 12 }}>
                  <strong>replay</strong>: {[selectedSnapshotSummary.replayRunMode, selectedSnapshotSummary.replayUserIntent].filter(Boolean).join(' · ')}
                </span>
              ) : null}
              {selectedSnapshotSummary.sharedChanged ? (
                <span style={{ marginRight: 12 }}><strong>shared</strong>: changed</span>
              ) : null}
              {selectedSnapshotSummary.taskContextChanged ? (
                <span style={{ marginRight: 12 }}><strong>taskContext</strong>: changed</span>
              ) : null}
              {selectedSnapshotSummary.replayContextChanged ? (
                <span style={{ marginRight: 12 }}><strong>replayContext</strong>: changed</span>
              ) : null}
              {selectedLinkPropagation ? (
                <span style={{ marginRight: 12 }}>
                  <strong>{t.trajectoryLinkPropagation}</strong>: {selectedLinkPropagation.passedCount}/{selectedLinkPropagation.linkCount}
                  {' '}({Math.round((selectedLinkPropagation.consistencyScore || 0) * 100)}%)
                </span>
              ) : null}
              {selectedLinkPropagation?.failingLinks?.length ? (
                <span style={{ marginRight: 12 }}>
                  <strong>{t.trajectoryLinkIssues}</strong>: {selectedLinkPropagation.failingLinks[0]?.primitive || '-'} → {selectedLinkPropagation.failingLinks[0]?.targetRef || '-'}
                </span>
              ) : null}
              {selectedSnapshotSummary.selectionSummary ? <span><strong>selection</strong>: {selectedSnapshotSummary.selectionSummary}</span> : null}
            </>
          ) : (
            <span>{t.noTrajectoryYet}</span>
          )}
        </div>
      </div>
    </div>
  )
}
