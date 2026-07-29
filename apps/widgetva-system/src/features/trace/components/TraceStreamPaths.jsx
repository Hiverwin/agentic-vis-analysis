import { buildTracePathSummary } from '../models/tracePathSummary.js'

export function TraceStreamPaths({
  paths = [],
  currentBranchId = null,
  selectedBranchId = null,
  branchFocusActive = false,
}) {
  return (
    <div className="trace-stream-paths" aria-hidden="true">
      {paths.map((path) => {
        const isCurrent = path.branchId === currentBranchId
        const isSelected = path.branchId === selectedBranchId
        const isMuted = branchFocusActive && !isCurrent && !isSelected
        const summary = buildTracePathSummary(path)

        return (
          <div
            key={path.id}
            className={`trace-stream-path-chip ${isCurrent ? 'current' : ''} ${isSelected ? 'selected' : ''} ${isMuted ? 'muted' : ''}`}
            style={{
              left: `${path.x}px`,
              top: `${path.y}px`,
              width: `${path.width}px`,
            }}
            title={`${path.label} · ${path.shortSummary}`}
          >
            <span className="trace-stream-path-label">{path.label}</span>
            <span className="trace-stream-path-descriptor">{summary.descriptor}</span>
            <span className="trace-stream-path-meta">
              {summary.tokens.map((token) => (
                <span key={`${path.id}-${token.key}`} className={`trace-stream-path-token ${token.kind}`}>
                  {token.label}
                </span>
              ))}
            </span>
          </div>
        )
      })}
    </div>
  )
}
