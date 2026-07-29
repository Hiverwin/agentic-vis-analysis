export function TraceStreamBands({
  bandFlows = [],
  branchJunctions = [],
  currentBranchId = null,
  selectedBranchId = null,
  branchFocusActive = false,
}) {
  const isBandMuted = (branchId) => (
    branchFocusActive
    && branchId !== currentBranchId
    && branchId !== selectedBranchId
  )

  return (
    <>
      <div className="trace-stream-band-flows" aria-hidden="true">
        {bandFlows.map((band) => (
          <div
            key={`${band.id}-flow`}
            className={`trace-stream-band-flow ${band.depth === 0 ? 'main' : 'branch'} ${band.branchId === currentBranchId ? 'current' : ''} ${band.branchId === selectedBranchId ? 'selected' : ''} ${isBandMuted(band.branchId) ? 'muted' : ''}`}
            style={{
              left: `${band.x}px`,
              top: `${band.y}px`,
              width: `${band.width}px`,
              height: `${band.height}px`,
            }}
          />
        ))}
      </div>
      <div className="trace-stream-branch-junctions" aria-hidden="true">
        {branchJunctions.map((junction) => (
          <div
            key={`${junction.id}-junction`}
            className={`trace-stream-branch-junction ${junction.branchId === currentBranchId ? 'current' : ''} ${junction.branchId === selectedBranchId ? 'selected' : ''} ${isBandMuted(junction.branchId) ? 'muted' : ''}`}
            style={{
              left: `${junction.x}px`,
              top: `${junction.y}px`,
            }}
          >
            <span className="trace-stream-branch-junction-dot" />
            <span>
              from step {junction.originStepNumber}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}
