import { TraceStreamNode } from './TraceStreamNode.jsx'

export function TraceStreamLane({ lane, nodes, stepCount, onSelect }) {
  return (
    <div className={`trace-stream-lane ${lane.id}`}>
      <div className="trace-stream-lane-label">
        <span className={`trace-lane-dot ${lane.id}`} />
        <span>{lane.label}</span>
      </div>
      <div className="trace-stream-lane-track">
        <div className="trace-stream-lane-line" aria-hidden="true" />
        <div className="trace-stream-lane-grid" style={{ '--trace-columns': stepCount }}>
          {Array.from({ length: stepCount }, (_, index) => {
            const node = nodes.find((item) => item.sequenceIndex === index) || null
            return node
              ? <TraceStreamNode key={node.id} node={node} onSelect={onSelect} />
              : <div key={`${lane.id}-empty-${index}`} className="trace-stream-slot" aria-hidden="true" />
          })}
        </div>
      </div>
    </div>
  )
}
