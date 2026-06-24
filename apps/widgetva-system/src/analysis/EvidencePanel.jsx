import { useAppStore } from '../app/appStore.js'
import { buildAnalysisProvenanceSummary } from './provenanceSummary.js'
import { deriveTraceBranchNarrative } from '../trace/traceBranchNarrative.js'
import { deriveTraceFocus } from '../trace/traceFocus.js'
import { buildTraceTimelineModel } from '../trace/traceViewModel.js'
import { useMemo } from 'react'
import { groupFindingsByPath } from './evidenceGrouping.js'

export function EvidencePanel({ draftFinding, setDraftFinding }) {
  const findings = useAppStore((state) => state.findings)
  const addFinding = useAppStore((state) => state.addFinding)
  const focusFinding = useAppStore((state) => state.focusFinding)
  const focusFindingProvenance = useAppStore((state) => state.focusFindingProvenance)
  const trace = useAppStore((state) => state.trace)
  const selectedTraceStepId = useAppStore((state) => state.selectedTraceStepId)
  const activeReplayContext = useAppStore((state) => state.activeReplayContext)
  const traceModel = useMemo(
    () => buildTraceTimelineModel(trace, { selectedStepId: selectedTraceStepId }),
    [selectedTraceStepId, trace],
  )
  const selectedTraceStep = traceModel.selectedStep
  const traceFocus = useMemo(
    () => deriveTraceFocus({ traceModel, activeReplayContext }),
    [activeReplayContext, traceModel],
  )
  const branchNarrative = useMemo(
    () => deriveTraceBranchNarrative({ traceModel, traceFocus }),
    [traceFocus, traceModel],
  )
  const provenanceSummary = useMemo(
    () => buildAnalysisProvenanceSummary({
      selectedTraceStep,
      selectedSegment: traceModel.selection.selectedSegment,
      selectedPath: traceModel.selection.selectedPath,
      currentSegment: traceModel.selection.currentSegment,
      currentPath: traceModel.selection.currentPath,
      activeReplayContext,
      branchNarrative,
    }),
    [activeReplayContext, branchNarrative, selectedTraceStep, traceModel.selection.currentPath, traceModel.selection.currentSegment, traceModel.selection.selectedPath, traceModel.selection.selectedSegment],
  )

  const groupedFindings = useMemo(
    () => groupFindingsByPath(findings),
    [findings],
  )
  const selectedPathId = provenanceSummary.selectedPathId || null
  const currentPathId = provenanceSummary.currentPathId || null

  return (
    <div className="analysis-stack">
      {selectedTraceStep ? (
        <section className="info-block compact">
          <h4>Trace evidence context</h4>
          <p>{selectedTraceStep.actor} · {selectedTraceStep.kindLabel} · {selectedTraceStep.widgetTitle}</p>
          <p>{selectedTraceStep.summary}</p>
          {provenanceSummary.selectedSegmentLabel ? (
            <p>Segment {provenanceSummary.selectedSegmentLabel} · {provenanceSummary.selectedSegmentStepCount} step{provenanceSummary.selectedSegmentStepCount === 1 ? '' : 's'}</p>
          ) : null}
          {provenanceSummary.selectedPathLabel ? (
            <p>Path {provenanceSummary.selectedPathLabel} · {provenanceSummary.selectedPathSegmentCount} segment{provenanceSummary.selectedPathSegmentCount === 1 ? '' : 's'} · {provenanceSummary.selectedPathStepCount} step{provenanceSummary.selectedPathStepCount === 1 ? '' : 's'}</p>
          ) : null}
          {selectedTraceStep.evidenceSummary ? <p>Evidence: {selectedTraceStep.evidenceSummary}</p> : null}
          {selectedTraceStep.verificationSummary ? <p>Verification: {selectedTraceStep.verificationSummary}</p> : null}
        </section>
      ) : null}
      {activeReplayContext ? (
        <section className="info-block compact">
          <h4>Replay anchor</h4>
          <p>{activeReplayContext.source} · {provenanceSummary.branchLabel}</p>
          <p>{activeReplayContext.summary || 'Workspace replay anchor active.'}</p>
          {provenanceSummary.hasBranchNarrative ? <p>{provenanceSummary.forkDescription}</p> : null}
          {provenanceSummary.entryStepLabel ? <p>{provenanceSummary.entryStepLabel}</p> : null}
        </section>
      ) : null}
      <section className="info-block">
        <h4>Evidence</h4>
        <textarea
          id="finding-note"
          className="control-textarea"
          value={draftFinding}
          onChange={(event) => setDraftFinding(event.target.value)}
          placeholder="State the analytic claim you want to retain."
        />
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            addFinding(draftFinding)
            setDraftFinding('')
          }}
        >
          {selectedTraceStep ? 'Save finding from trace step' : 'Save finding'}
        </button>
        <div className="evidence-groups">
          {groupedFindings.map((group) => (
            <section
              key={group.key}
              className={`evidence-group ${group.pathId && group.pathId === selectedPathId ? 'selected-path' : ''} ${group.pathId && group.pathId === currentPathId ? 'current-path' : ''}`}
            >
              <div className="evidence-group-header">
                <button
                  type="button"
                  className="evidence-group-heading"
                  onClick={() => {
                    const firstEntry = group.entries[0] || null
                    if (firstEntry?.id) void focusFinding(firstEntry.id)
                  }}
                >
                  <strong>{group.label}</strong>
                  <span>{group.summary}</span>
                </button>
                <p className="evidence-group-comparison">{group.comparisonSummary}</p>
                {group.comparisonBadges?.length ? (
                  <div className="evidence-group-badges">
                    {group.comparisonBadges.map((badge) => (
                      <span key={`${group.key}-${badge}`} className="evidence-group-badge">
                        {badge}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="stack-list">
                {group.entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`stack-item ${entry.traceStepId && entry.traceStepId === selectedTraceStepId ? 'active' : 'static'}`}
                    onClick={() => {
                      void focusFinding(entry.id)
                    }}
                  >
                    <strong>{entry.title}</strong>
                    <span>{entry.note}</span>
                    <span>{entry.confidence} · {entry.provenance}</span>
                    {entry.branchNarrative?.branchLabel || entry.branchNarrative?.forkDescription ? (
                      <span>
                        {[entry.branchNarrative?.branchLabel, entry.branchNarrative?.forkDescription].filter(Boolean).join(' · ')}
                      </span>
                    ) : null}
                    {entry.pathContext?.pathLabel ? (
                      <span>
                        {[
                          `Path ${entry.pathContext.pathLabel}`,
                          entry.pathContext.pathSummary,
                        ].filter(Boolean).join(' · ')}
                      </span>
                    ) : null}
                    {entry.branchNarrative?.originStepId || entry.branchNarrative?.entryStepId ? (
                      <span className="stack-inline-actions">
                        {entry.branchNarrative?.originStepId ? (
                          <button
                            type="button"
                            className="mini-button"
                            onClick={(event) => {
                              event.stopPropagation()
                              void focusFindingProvenance(entry.id, 'origin')
                            }}
                          >
                            Fork origin
                          </button>
                        ) : null}
                        {entry.branchNarrative?.entryStepId ? (
                          <button
                            type="button"
                            className="mini-button"
                            onClick={(event) => {
                              event.stopPropagation()
                              void focusFindingProvenance(entry.id, 'entry')
                            }}
                          >
                            Branch entry
                          </button>
                        ) : null}
                      </span>
                    ) : null}
                    {entry.traceStepId || entry.stateId || entry.branchId ? (
                      <span>
                        {[entry.traceStepId, entry.stateId, entry.branchId].filter(Boolean).join(' · ')}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  )
}
