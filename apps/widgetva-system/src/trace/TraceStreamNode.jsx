export function TraceStreamNode({
  node,
  onSelect,
  style,
  navigationKind = null,
  isCurrentBranch = false,
  isSelectedBranch = false,
  branchFocusActive = false,
  collapsedInterior = false,
}) {
  if (collapsedInterior) {
    return (
      <button
        type="button"
        className={`trace-stream-node collapsed-interior ${node.actor} ${node.selected ? 'selected' : ''} ${isCurrentBranch ? 'current-branch' : ''} ${isSelectedBranch ? 'selected-branch' : ''} ${branchFocusActive && !isCurrentBranch && !isSelectedBranch ? 'muted' : ''}`}
        onClick={() => onSelect(node.stepId)}
        aria-pressed={node.selected}
        title={node.tooltip}
        style={style}
        data-trace-step-id={node.stepId}
      >
        <span className="trace-stream-collapsed-dot" aria-hidden="true" />
        <span className="trace-stream-collapsed-label">{node.stepNumber}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`trace-stream-node ${node.actor} ${node.transitionType === 'branch' ? 'branch' : ''} ${node.selected ? 'selected' : ''} ${navigationKind ? 'navigation-target' : ''} ${navigationKind ? `navigation-${navigationKind}` : ''} ${isCurrentBranch ? 'current-branch' : ''} ${isSelectedBranch ? 'selected-branch' : ''} ${branchFocusActive && !isCurrentBranch && !isSelectedBranch ? 'muted' : ''}`}
      onClick={() => onSelect(node.stepId)}
      aria-pressed={node.selected}
      title={node.tooltip}
      style={style}
      data-trace-step-id={node.stepId}
      data-trace-navigation-kind={navigationKind || undefined}
    >
      <div className="trace-stream-node-top">
        <span className="trace-stream-step">{node.stepNumber}</span>
        <div className="trace-stream-node-meta">
          <span className={`trace-stream-token actor ${node.actor}`}>{node.actor === 'human' ? 'H' : 'A'}</span>
          {node.transitionType === 'branch' ? <span className="trace-stream-token branch">B</span> : null}
          {node.hasStateDelta ? <span className="trace-stream-token">S</span> : null}
          {node.hasEvidence ? <span className="trace-stream-token evidence">E</span> : null}
        </div>
      </div>
      <span className="trace-stream-anchor" aria-hidden="true" />
      <strong>{node.shortLabel}</strong>
      <p>{node.widgetTitle}</p>
    </button>
  )
}
