import { useEffect, useMemo, useState } from 'react'

const labels = {
  phaseObserve: 'Observe',
  phasePlan: 'Plan',
  phaseAct: 'Act',
  phaseVerify: 'Verify',
  phaseReason: 'Reason',
  statusRunning: 'Running',
  statusCompleted: 'OK',
  statusInterrupted: 'Interrupted',
  statusFailed: 'Failed',
  statusPending: 'Pending',
  showDetails: 'Show Details',
  hideDetails: 'Hide Details',
  showRaw: 'Show Raw',
  hideRaw: 'Hide Raw',
  rows: 'Rows',
  numericFields: 'Numeric fields',
  categoricalFields: 'Categorical fields',
  topNumeric: 'Top numeric',
  topCategorical: 'Top categorical',
  details: 'Details',
  raw: 'Raw',
  toolFallback: 'Tool',
  iterationTitle: 'Iteration',
  observationSummary: 'Observation Summary',
  planSummary: 'Plan Summary',
  actionTrace: 'Action Trace',
  verification: 'Verification',
  reasoning: 'Reasoning',
  finalResponse: 'Final Response',
  phaseDetailsSuffix: ' Details',
  noObservationDetails: 'No observation details.',
  noPlanningDetails: 'No planning details.',
  noToolAction: 'No tool action.',
  noVerificationDetails: 'No verification details.',
  noReasoningDetails: 'No reasoning details.',
  noFinalResponseYet: 'No final response yet.',
  iterationStatusLabel: 'Iteration Status',
  stopReasonLabel: 'Stop Reason',
}

const PHASE_ORDER = ['observe', 'plan', 'act', 'verify', 'reason']
const PHASE_LABELS = {
  observe: labels.phaseObserve,
  plan: labels.phasePlan,
  act: labels.phaseAct,
  verify: labels.phaseVerify,
  reason: labels.phaseReason,
}
const STATUS_LABEL = {
  running: labels.statusRunning,
  completed: labels.statusCompleted,
  interrupted: labels.statusInterrupted,
  failed: labels.statusFailed,
  pending: labels.statusPending,
}

function ToolExecutionCard({ tool, index }) {
  const [openDetails, setOpenDetails] = useState(false)
  const [openRaw, setOpenRaw] = useState(false)
  const statusClass = tool.status === 'failed' ? 'failed' : tool.status === 'running' ? 'running' : 'success'
  const statusText = STATUS_LABEL[tool.status] || tool.status
  const detailLines = Array.isArray(tool.detailLines) ? tool.detailLines.filter(Boolean) : []
  const isDataSummary = tool.toolName === 'get_data_summary' && tool.result && typeof tool.result === 'object'
  const summary = isDataSummary && tool.result.summary && typeof tool.result.summary === 'object' ? tool.result.summary : null
  const numericKeys = summary?.numeric_fields && typeof summary.numeric_fields === 'object' ? Object.keys(summary.numeric_fields) : []
  const categoricalKeys = summary?.categorical_fields && typeof summary.categorical_fields === 'object' ? Object.keys(summary.categorical_fields) : []

  return (
    <div className="iter-tool-card">
      <div className="iter-tool-header">
        <div className="iter-tool-left">
          <span className={`iter-tool-dot ${statusClass}`} />
          <span className="iter-tool-title">{tool.toolName || `${labels.toolFallback} #${index + 1}`}</span>
          <span className={`iter-tool-status ${statusClass}`}>{statusText}</span>
        </div>
        <div className="iter-tool-actions">
          <button type="button" className="iter-tool-toggle-btn" onClick={() => setOpenDetails((value) => !value)}>
            {openDetails ? labels.hideDetails : labels.showDetails}
          </button>
          <button type="button" className="iter-tool-toggle-btn" onClick={() => setOpenRaw((value) => !value)}>
            {openRaw ? labels.hideRaw : labels.showRaw}
          </button>
        </div>
      </div>
      {openDetails ? (
        <div className="iter-tool-details">
          {summary ? (
            <div className="iter-summary-grid">
              <div className="iter-summary-item">
                <span className="iter-tool-subtitle">{labels.rows}</span>
                <span className="iter-summary-value">{Number.isFinite(summary.count) ? summary.count : '--'}</span>
              </div>
              <div className="iter-summary-item">
                <span className="iter-tool-subtitle">{labels.numericFields}</span>
                <span className="iter-summary-value">{numericKeys.length}</span>
              </div>
              <div className="iter-summary-item">
                <span className="iter-tool-subtitle">{labels.categoricalFields}</span>
                <span className="iter-summary-value">{categoricalKeys.length}</span>
              </div>
              <div className="iter-summary-item">
                <span className="iter-tool-subtitle">{labels.topNumeric}</span>
                <span className="iter-summary-value">{numericKeys.slice(0, 4).join(', ') || '--'}</span>
              </div>
              <div className="iter-summary-item">
                <span className="iter-tool-subtitle">{labels.topCategorical}</span>
                <span className="iter-summary-value">{categoricalKeys.slice(0, 4).join(', ') || '--'}</span>
              </div>
            </div>
          ) : null}
          <div className="iter-tool-subtitle">{labels.details}</div>
          {detailLines.length > 0 ? (
            <ul className="iter-detail-list">
              {detailLines.map((line, lineIndex) => (
                <li key={`${tool.id || tool.toolName}-detail-${lineIndex}`}>{line}</li>
              ))}
            </ul>
          ) : (
            <div className="iter-tool-result-preview">{tool.resultPreview || labels.noToolAction}</div>
          )}
        </div>
      ) : null}
      {openRaw ? (
        <div className="iter-tool-args">
          <div className="iter-tool-subtitle">{labels.raw}</div>
          <pre className="font-mono">{JSON.stringify({ args: tool.args || {}, result: tool.result || {} }, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  )
}

function PhaseProgress({ phases, activePhase, selectedPhase, onSelectPhase }) {
  return (
    <div className="iter-phase-strip">
      {PHASE_ORDER.map((phase, index) => {
        const status = phases?.[phase]?.status || 'pending'
        const cls = status === 'completed' ? 'done' : activePhase === phase ? 'active' : 'pending'
        return (
          <div className="iter-phase-item-wrap" key={phase}>
            <button
              type="button"
              className={`iter-phase-item ${phase} ${cls} ${selectedPhase === phase ? 'selected' : ''}`}
              onClick={() => onSelectPhase?.(phase)}
            >
              <span className="iter-phase-dot" />
              <span>{PHASE_LABELS[phase]}</span>
            </button>
            {index < PHASE_ORDER.length - 1 ? <div className="iter-phase-link" /> : null}
          </div>
        )
      })}
    </div>
  )
}

function SummaryList({ title, lines }) {
  if (!lines?.length) return null
  return (
    <div className="iter-block">
      <div className="iter-block-title">{title}</div>
      <ul className="iter-list">
        {lines.map((line, index) => <li key={`${title}-${index}`}>{line}</li>)}
      </ul>
    </div>
  )
}

export default function IterationCard({ iterationData, id }) {
  const {
    iteration,
    status = 'running',
    mode,
    activePhase,
    phases,
    tools = [],
    observationLines = [],
    planLines = [],
    verifyLines = [],
    reasoningLines = [],
    finalResponse = '',
    stopReason,
  } = iterationData || {}

  const statusText = STATUS_LABEL[status] || status
  const reasonLines = useMemo(() => reasoningLines.filter(Boolean).slice(-6), [reasoningLines])
  const [selectedPhase, setSelectedPhase] = useState(activePhase || 'observe')

  useEffect(() => {
    if (activePhase && PHASE_ORDER.includes(activePhase)) {
      setSelectedPhase(activePhase)
    }
  }, [activePhase, iteration])

  const normalizedSelectedPhase = PHASE_ORDER.includes(selectedPhase) ? selectedPhase : 'observe'

  function EmptyPhase({ text }) {
    return (
      <div className="iter-block">
        <div className="iter-block-title">{PHASE_LABELS[normalizedSelectedPhase]}{labels.phaseDetailsSuffix}</div>
        <div className="iter-empty">{text}</div>
      </div>
    )
  }

  return (
    <section id={id} className="iteration-card">
      <header className="iteration-header">
        <div>
          <div className="iteration-title">{labels.iterationTitle} {iteration}</div>
          {mode ? <div className="iteration-mode">{mode}</div> : null}
        </div>
        <span className={`iteration-status ${status}`}>{statusText}</span>
      </header>

      <PhaseProgress
        phases={phases}
        activePhase={activePhase}
        selectedPhase={normalizedSelectedPhase}
        onSelectPhase={setSelectedPhase}
      />

      {normalizedSelectedPhase === 'observe'
        ? observationLines.length > 0
          ? <SummaryList title={labels.observationSummary} lines={observationLines} />
          : <EmptyPhase text={labels.noObservationDetails} />
        : null}

      {normalizedSelectedPhase === 'plan'
        ? planLines.length > 0
          ? <SummaryList title={labels.planSummary} lines={planLines} />
          : <EmptyPhase text={labels.noPlanningDetails} />
        : null}

      {normalizedSelectedPhase === 'act'
        ? tools.length > 0
          ? (
            <div className="iter-block">
              <div className="iter-block-title">{labels.actionTrace}</div>
              <div className="iter-tool-list">
                {tools.map((tool, index) => (
                  <ToolExecutionCard key={tool.id || `${tool.toolName}-${index}`} tool={tool} index={index} />
                ))}
              </div>
            </div>
          )
          : <EmptyPhase text={labels.noToolAction} />
        : null}

      {normalizedSelectedPhase === 'verify'
        ? verifyLines.length > 0
          ? <SummaryList title={labels.verification} lines={verifyLines} />
          : <EmptyPhase text={labels.noVerificationDetails} />
        : null}

      {normalizedSelectedPhase === 'reason' ? (
        <>
          {reasonLines.length > 0
            ? <SummaryList title={labels.reasoning} lines={reasonLines} />
            : <EmptyPhase text={labels.noReasoningDetails} />}
          <div className="iter-block">
            <div className="iter-block-title">{labels.finalResponse}</div>
            <div className="iter-final-response">
              {String(finalResponse || '').trim() || labels.noFinalResponseYet}
            </div>
          </div>
        </>
      ) : null}

      {(stopReason || status !== 'running') ? (
        <footer className="iter-footer">
          <span>{labels.iterationStatusLabel}: {statusText}</span>
          {stopReason ? <span>{labels.stopReasonLabel}: {stopReason}</span> : null}
        </footer>
      ) : null}
    </section>
  )
}
