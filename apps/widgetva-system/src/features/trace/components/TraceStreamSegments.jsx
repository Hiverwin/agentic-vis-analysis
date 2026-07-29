import { buildTraceSegmentSummary } from '../models/traceSegmentSummary.js'

export function TraceStreamSegments({
  segments = [],
  currentBranchId = null,
  selectedBranchId = null,
  branchFocusActive = false,
  onSelect = null,
  collapsedSegmentIds = [],
  onToggleCollapsed = null,
}) {
  return (
    <div className="trace-stream-segments">
      {segments
        .filter((segment) => segment.stepCount > 1)
        .map((segment) => {
          const isCurrent = segment.branchId === currentBranchId
          const isSelected = segment.branchId === selectedBranchId
          const isMuted = branchFocusActive && !isCurrent && !isSelected
          const isCollapsed = collapsedSegmentIds.includes(segment.id)
          const segmentSummary = buildTraceSegmentSummary(segment)
          return (
            <div
              key={segment.id}
              className={`trace-stream-segment-chip ${isCurrent ? 'current' : ''} ${isSelected ? 'selected' : ''} ${segment.hasEvidence ? 'evidence' : ''} ${segment.hasStateDelta ? 'stateful' : ''} ${isMuted ? 'muted' : ''} ${isCollapsed ? 'collapsed' : 'expanded'}`}
              style={{
                left: `${segment.x}px`,
                top: `${segment.y}px`,
                width: `${segment.width}px`,
              }}
              title={`${segment.label} · ${segment.shortSummary} · ${segment.summary}`}
              data-trace-segment-id={segment.id}
            >
              <button
                type="button"
                className="trace-stream-segment-main"
                onClick={() => {
                  if (typeof onSelect === 'function' && segment.endStepId) onSelect(segment.endStepId)
                }}
                aria-label={`Trace segment ${segment.label}, ${segment.shortSummary}, ${segmentSummary.descriptor}`}
              >
                <span className="trace-stream-segment-range">{segment.label}</span>
                <span className="trace-stream-segment-summary">
                  {isCollapsed ? `Collapsed · ${segment.shortSummary}` : segment.shortSummary}
                </span>
                <span className="trace-stream-segment-meta" aria-hidden="true">
                  <span className={`trace-stream-segment-token ${segmentSummary.actorToken.kind}`}>
                    {segmentSummary.actorToken.label}
                  </span>
                  {segmentSummary.semanticTokens.map((token) => (
                    <span
                      key={`${segment.id}-${token.key}`}
                      className={`trace-stream-segment-token ${token.kind}`}
                      title={token.title}
                    >
                      {token.label}
                    </span>
                  ))}
                </span>
              </button>
              <button
                type="button"
                className="trace-stream-segment-toggle"
                onClick={(event) => {
                  event.stopPropagation()
                  if (typeof onToggleCollapsed === 'function') onToggleCollapsed(segment.id)
                }}
                aria-label={isCollapsed ? `Expand trace segment ${segment.label}` : `Collapse trace segment ${segment.label}`}
                aria-pressed={isCollapsed}
                title={isCollapsed ? 'Expand segment' : 'Collapse segment'}
              >
                {isCollapsed ? '+' : '−'}
              </button>
            </div>
          )
        })}
    </div>
  )
}
