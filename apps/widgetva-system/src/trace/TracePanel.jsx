import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../app/appStore.js'
import { buildTraceTimelineModel } from './traceViewModel.js'
import { deriveTraceBranchNarrative } from './traceBranchNarrative.js'
import { deriveTraceFocus } from './traceFocus.js'
import { buildTraceStreamLayout } from './traceLayout.js'
import { TraceStreamBands } from './TraceStreamBands.jsx'
import { TraceStreamEdges } from './TraceStreamEdges.jsx'
import { TraceStreamNode } from './TraceStreamNode.jsx'
import { TraceStreamPaths } from './TraceStreamPaths.jsx'
import { TraceStreamSegments } from './TraceStreamSegments.jsx'

export function TracePanel() {
  const trace = useAppStore((state) => state.trace)
  const selectedTraceStepId = useAppStore((state) => state.selectedTraceStepId)
  const activeReplayContext = useAppStore((state) => state.activeReplayContext)
  const traceNavigationTarget = useAppStore((state) => state.traceNavigationTarget)
  const collapsedTraceSegmentIds = useAppStore((state) => state.collapsedTraceSegmentIds)
  const selectTraceStep = useAppStore((state) => state.selectTraceStep)
  const toggleTraceSegmentCollapsed = useAppStore((state) => state.toggleTraceSegmentCollapsed)
  const clearTraceNavigationTarget = useAppStore((state) => state.clearTraceNavigationTarget)
  const scrollRef = useRef(null)
  const panRef = useRef({ dragging: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const model = buildTraceTimelineModel(trace, {
    selectedStepId: selectedTraceStepId,
  })
  const layout = buildTraceStreamLayout(model, {
    collapsedSegmentIds: collapsedTraceSegmentIds,
  })
  const traceFocus = deriveTraceFocus({
    traceModel: model,
    activeReplayContext,
  })
  const branchNarrative = deriveTraceBranchNarrative({
    traceModel: model,
    traceFocus,
  })
  const currentBranchId = traceFocus.activeBranchId
  const selectedBranchId = model.selection.selectedStep?.branchId || null
  const hiddenStepIds = new Set(
    (layout.placedNodes || [])
      .filter((node) => !(layout.renderNodes || []).some((renderNode) => renderNode.id === node.id))
      .map((node) => node.stepId),
  )
  const branchById = new Map((model.streamBands || []).map((band) => [band.branchId, band]))
  const selectedBranch = selectedBranchId ? branchById.get(selectedBranchId) || null : null
  const showSelectedBranchBadge = Boolean(
    selectedBranch
    && selectedBranchId !== currentBranchId
    && selectedBranchId !== model.mainBranchId,
  )
  const isBranchMuted = (branchId) => (
    traceFocus.hasBranchFocus
    && branchId !== currentBranchId
    && branchId !== selectedBranchId
  )

  useEffect(() => {
    const container = scrollRef.current
    if (!container || !selectedTraceStepId) return
    const target = container.querySelector(`[data-trace-step-id="${selectedTraceStepId}"]`)
    if (!target) return
    const containerRect = container.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const nextLeft = container.scrollLeft + (targetRect.left - containerRect.left) - (container.clientWidth / 2) + (targetRect.width / 2)
    const nextTop = container.scrollTop + (targetRect.top - containerRect.top) - (container.clientHeight / 2) + (targetRect.height / 2)
    container.scrollTo({
      left: Math.max(0, nextLeft),
      top: Math.max(0, nextTop),
      behavior: 'smooth',
    })
  }, [selectedTraceStepId])

  useEffect(() => {
    if (!traceNavigationTarget?.stepId) return undefined
    const timerId = window.setTimeout(() => {
      clearTraceNavigationTarget()
    }, 1800)
    return () => window.clearTimeout(timerId)
  }, [clearTraceNavigationTarget, traceNavigationTarget?.stepId, traceNavigationTarget?.timestamp])

  function handlePointerDown(event) {
    if (event.button !== 0) return
    if (event.target?.closest?.('[data-trace-step-id]') || event.target?.closest?.('[data-trace-segment-id]')) return
    const container = scrollRef.current
    if (!container) return
    panRef.current = {
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    }
    setIsDragging(true)
  }

  function handlePointerMove(event) {
    if (!panRef.current.dragging) return
    const container = scrollRef.current
    if (!container) return
    const dx = event.clientX - panRef.current.startX
    const dy = event.clientY - panRef.current.startY
    container.scrollLeft = panRef.current.scrollLeft - dx
    container.scrollTop = panRef.current.scrollTop - dy
  }

  function handlePointerUp() {
    if (!panRef.current.dragging) return
    panRef.current.dragging = false
    setIsDragging(false)
  }

  return (
    <div className="trace-panel-shell">
      <div
        ref={scrollRef}
        className="trace-stream-shell"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div
          className="trace-stream-scroll"
          style={{
            '--trace-columns': model.stepCount,
            '--trace-bands': layout.bandCount,
            '--trace-gutter': `${layout.metrics.gutterWidth}px`,
          }}
        >
          {model.stepCount > 0 ? (
              <div className="trace-step-scale trace-step-scale-stream">
              <span className="trace-scale-gutter" aria-hidden="true" />
              <div className="trace-step-scale-grid" style={{ width: `${layout.canvasWidth}px` }}>
                {Array.from({ length: model.stepCount }, (_, index) => (
                  <span key={`trace-step-${index}`}>step {index + 1}</span>
                ))}
              </div>
            </div>
          ) : null}
          <div className={`trace-stream-frame ${model.stepCount === 0 ? 'empty' : ''} ${traceFocus.hasBranchFocus ? 'branch-focused' : ''}`}>
            {model.stepCount === 0 ? (
              <div className="trace-stream-empty">
                <strong>No interaction trace yet</strong>
                <p>Brush, focus, zoom, or run an agent step to start the provenance stream.</p>
              </div>
            ) : null}
            {traceFocus.hasBranchFocus ? (
              <div className="trace-stream-focus-banner">
                <div className="trace-stream-focus-banner-pills">
                  <span className="trace-stream-focus-pill">{activeReplayContext ? 'Replay branch' : 'Active branch'}</span>
                  {showSelectedBranchBadge ? <span className="trace-stream-focus-pill secondary">Selected branch</span> : null}
                </div>
                <strong>{branchNarrative?.branchLabel || currentBranchId}</strong>
                {branchNarrative ? <p>{branchNarrative.description}</p> : null}
                {showSelectedBranchBadge ? (
                  <p>
                    Inspecting {selectedBranch?.label || selectedBranchId}
                    {selectedBranch?.originStepNumber ? ` · fork from step ${selectedBranch.originStepNumber}` : ''}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="trace-stream-band-labels">
              {layout.bandLabels.map((band) => (
                <div
                  key={band.id}
                  className={`trace-stream-band-label ${band.depth === 0 ? 'main' : 'branch'} ${band.branchId === currentBranchId ? 'current' : ''} ${band.branchId === selectedBranchId ? 'selected' : ''} ${isBranchMuted(band.branchId) ? 'muted' : ''}`}
                  style={{
                    top: `${band.y}px`,
                    left: `${band.x}px`,
                  }}
                >
                  <span className={`trace-band-dot ${band.depth === 0 ? 'main' : 'branch'}`} />
                  <span>{band.label}</span>
                </div>
              ))}
            </div>
            <div
              className="trace-stream-canvas"
              style={{
                marginLeft: `${layout.metrics.gutterWidth}px`,
                width: `${layout.canvasWidth}px`,
                height: `${layout.canvasHeight}px`,
              }}
            >
              <div className="trace-stream-band-rails" aria-hidden="true">
                {layout.bandRails.map((band) => (
                  <div
                    key={`${band.id}-rail`}
                    className={`trace-stream-band-rail ${band.depth === 0 ? 'main' : 'branch'} ${band.branchId === currentBranchId ? 'current' : ''} ${band.branchId === selectedBranchId ? 'selected' : ''} ${isBranchMuted(band.branchId) ? 'muted' : ''}`}
                    style={{
                      top: `${band.y}px`,
                      left: `${band.x}px`,
                      width: `${band.width}px`,
                    }}
                  />
                ))}
              </div>
              <TraceStreamBands
                bandFlows={layout.bandFlows}
                branchJunctions={layout.branchJunctions}
                currentBranchId={currentBranchId}
                selectedBranchId={selectedBranchId}
                branchFocusActive={traceFocus.hasBranchFocus}
              />
              <TraceStreamPaths
                paths={layout.pathChips}
                currentBranchId={currentBranchId}
                selectedBranchId={selectedBranchId}
                branchFocusActive={traceFocus.hasBranchFocus}
              />
              <TraceStreamSegments
                segments={layout.segmentChips}
                currentBranchId={currentBranchId}
                selectedBranchId={selectedBranchId}
                branchFocusActive={traceFocus.hasBranchFocus}
                collapsedSegmentIds={collapsedTraceSegmentIds}
                onSelect={selectTraceStep}
                onToggleCollapsed={toggleTraceSegmentCollapsed}
              />
              <div className="trace-stream-band-markers" aria-hidden="true">
                {layout.bandMarkers.map((band) => (
                  <div
                    key={`${band.id}-marker`}
                    className={`trace-stream-band-marker ${band.branchId === currentBranchId ? 'current' : ''} ${band.branchId === selectedBranchId ? 'selected' : ''} ${isBranchMuted(band.branchId) ? 'muted' : ''}`}
                    style={{
                      left: `${band.x}px`,
                      top: `${band.y}px`,
                    }}
                  >
                    <span className="trace-stream-band-marker-dot" />
                    <span>{band.label}</span>
                  </div>
                ))}
              </div>
              <TraceStreamEdges
                edges={layout.renderEdges}
                nodes={layout.renderNodes}
                width={layout.canvasWidth}
                height={layout.canvasHeight}
                currentBranchId={currentBranchId}
                selectedBranchId={selectedBranchId}
                branchFocusActive={traceFocus.hasBranchFocus}
                selectedStepId={model.selection.selectedStepId}
              />
              <div className="trace-stream-node-layer">
                {layout.renderNodes.map((node) => (
                  <TraceStreamNode
                    key={node.id}
                    node={node}
                    onSelect={selectTraceStep}
                    navigationKind={traceNavigationTarget?.stepId === node.stepId ? traceNavigationTarget.kind : null}
                    isCurrentBranch={node.branchId === currentBranchId}
                    isSelectedBranch={node.branchId === selectedBranchId}
                    branchFocusActive={traceFocus.hasBranchFocus}
                    collapsedInterior={hiddenStepIds.has(node.stepId)}
                    style={{
                      position: 'absolute',
                      left: `${node.x}px`,
                      top: `${node.y}px`,
                      width: `${node.width}px`,
                      minHeight: `${node.height}px`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
