export function TraceInspector({ step }) {
  if (!step) {
    return (
      <aside className="trace-inspector">
        <div className="section-head">
          <p className="eyebrow">Trace Inspector</p>
          <h4>No step selected</h4>
        </div>
        <p>Select a trace step to inspect params, deltas, and evidence.</p>
      </aside>
    )
  }

  return (
    <aside className="trace-inspector">
      <div className="section-head">
        <p className="eyebrow">Trace Inspector</p>
        <h4>{step.summary}</h4>
      </div>
      <dl className="meta-grid">
        <div>
          <dt>Actor</dt>
          <dd>{step.actor}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{step.kind}</dd>
        </div>
        <div>
          <dt>Widget</dt>
          <dd>{step.widgetTitle}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{step.status}</dd>
        </div>
        <div>
          <dt>Method</dt>
          <dd>{step.methodName || 'not captured'}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{step.time || 'n/a'}</dd>
        </div>
      </dl>
      <div className="info-block compact">
        <h4>State Delta</h4>
        <div className="trace-delta-strip">
          {step.deltaTokens.map((token) => (
            <span key={token.id} className={`trace-delta-token ${token.active ? 'active' : ''}`}>
              {token.label}
            </span>
          ))}
        </div>
        <p>{step.activeDeltaCount} state surfaces changed in this step.</p>
      </div>
      <div className="info-block compact">
        <h4>Verification</h4>
        <p>{step.verificationSummary || 'No verification summary captured yet.'}</p>
      </div>
      <div className="info-block compact">
        <h4>Detail</h4>
        <p>{step.detail || 'No additional detail.'}</p>
      </div>
      <div className="info-block compact">
        <h4>Evidence</h4>
        <p>{step.evidenceSummary || 'No evidence attached yet.'}</p>
      </div>
    </aside>
  )
}
