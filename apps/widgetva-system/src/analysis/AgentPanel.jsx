import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../app/appStore.js'
import { buildTraceTimelineModel } from '../trace/traceViewModel.js'
import { buildAnalysisProvenanceSummary } from './provenanceSummary.js'

const MODE_MESSAGES = {
  manual: '',
  copilot: 'Agent can propose next steps, summarize linked selections, and help convert observations into evidence.',
  autonomous: 'Agent becomes the active operator on the same workspace. Interrupt and takeover must remain visible.',
}

function summarizeStepResultPayload(payload) {
  if (!payload || typeof payload !== 'object') return 'No runtime payload recorded.'
  if (typeof payload.summary === 'string' && payload.summary.trim().length > 0) return payload.summary
  if (typeof payload.message === 'string' && payload.message.trim().length > 0) return payload.message
  if (typeof payload.status === 'string' && payload.status.trim().length > 0) return payload.status
  const changed = payload.changed === true ? 'changed' : payload.changed === false ? 'unchanged' : null
  const refs = Array.isArray(payload.updatedRefs) && payload.updatedRefs.length > 0
    ? `${payload.updatedRefs.length} ref${payload.updatedRefs.length === 1 ? '' : 's'} updated`
    : null
  return [changed, refs].filter(Boolean).join(' · ') || 'Runtime payload recorded.'
}

function formatAgentParams(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return 'No params'
  const entries = Object.entries(params).filter(([, value]) => value !== undefined)
  if (entries.length === 0) return 'No params'
  return entries
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
    .join(' · ')
}

export function AgentPanel() {
  const mode = useAppStore((state) => state.mode)
  const workspaceProviderEnvironment = useAppStore((state) => state.workspaceProviderEnvironment)
  const selectedWidgetId = useAppStore((state) => state.selectedWidgetId)
  const coordinationVersion = useAppStore((state) => state.coordinationVersion)
  const runtimeSessionKey = useAppStore((state) => state.runtimeSessionKey)
  const activeCaseId = useAppStore((state) => state.activeCaseId)
  const trace = useAppStore((state) => state.trace)
  const selectedTraceStepId = useAppStore((state) => state.selectedTraceStepId)
  const activeReplayContext = useAppStore((state) => state.activeReplayContext)
  const agentMessages = useAppStore((state) => state.agentMessages)
  const agentStatus = useAppStore((state) => state.agentStatus)
  const agentError = useAppStore((state) => state.agentError)
  const agentObjective = useAppStore((state) => state.agentObjective)
  const agentModel = useAppStore((state) => state.agentModel)
  const agentLastStep = useAppStore((state) => state.agentLastStep)
  const setAgentObjective = useAppStore((state) => state.setAgentObjective)
  const runAgentStep = useAppStore((state) => state.runAgentStep)
  const getActiveAgentRuntimeContract = useAppStore((state) => state.getActiveAgentRuntimeContract)
  const [draftObjective, setDraftObjective] = useState(agentObjective)
  const runtimeContract = useMemo(
    () => getActiveAgentRuntimeContract(),
    [activeCaseId, getActiveAgentRuntimeContract, runtimeSessionKey],
  )
  const workspaceDescription = useMemo(
    () => runtimeContract?.describeWorkspace?.() || null,
    [runtimeContract],
  )
  const coordinationState = useMemo(
    () => runtimeContract?.readCoordinationState?.() || null,
    [coordinationVersion, runtimeContract],
  )
  const propagationSummary = useMemo(
    () => runtimeContract?.readPropagationSummary?.() || null,
    [coordinationVersion, runtimeContract],
  )
  const latestCoordinationResult = useMemo(
    () => runtimeContract?.readObservation?.()?.latestCoordinationResult || null,
    [coordinationVersion, runtimeContract],
  )
  const focusedWidgetRef = coordinationState?.focusedWidgetRef || null
  const selectionRegistryCount = Object.keys(coordinationState?.selections?.registry || {}).length
  const topology = coordinationState?.links?.topology?.topology || null
  const selectedWidgetDescription = workspaceDescription?.widgets?.find((entry) => entry?.widgetId === selectedWidgetId) || null
  const selectedWidgetPerceptionNames = selectedWidgetDescription?.perceptionNames
    || selectedWidgetDescription?.perceptionQueryNames
    || []
  const traceModel = useMemo(
    () => buildTraceTimelineModel(trace, { selectedStepId: selectedTraceStepId }),
    [selectedTraceStepId, trace],
  )
  const provenanceSummary = useMemo(
    () => buildAnalysisProvenanceSummary({
      selectedTraceStep: traceModel.selectedStep,
      selectedSegment: traceModel.selection.selectedSegment,
      selectedPath: traceModel.selection.selectedPath,
      currentSegment: traceModel.selection.currentSegment,
      currentPath: traceModel.selection.currentPath,
      activeReplayContext,
      branchNarrative: null,
    }),
    [activeReplayContext, traceModel],
  )
  const isRunning = agentStatus === 'running'

  useEffect(() => {
    setDraftObjective(agentObjective)
  }, [agentObjective])

  async function handleRunAgentStep() {
    const nextObjective = draftObjective.trim() || agentObjective
    setAgentObjective(nextObjective)
    try {
      await runAgentStep(nextObjective)
    } catch {
      // Store state already exposes the error in the panel.
    }
  }

  return (
    <div className="analysis-stack">
      <section className="focus-card chat-shell">
        <p className="eyebrow">Agent Chat</p>
        <h3>{mode === 'autonomous' ? 'Autonomous execution ready' : 'Shared-control planning'}</h3>
        <p>{agentModel} · {MODE_MESSAGES[mode]}</p>
        <div className="chip-row">
          <span className="filter-chip active">Environment: {workspaceProviderEnvironment}</span>
          <span className="filter-chip">Contract: executeAction / queryPerception</span>
        </div>
        <p className="section-copy">
          Select the renderer environment from the system controls, then ask the agent to operate on the current workspace through the shared widget contract.
        </p>
        <label className="control-stack" htmlFor="agent-objective">
          <span>Objective</span>
          <textarea
            id="agent-objective"
            className="control-textarea"
            value={draftObjective}
            onChange={(event) => setDraftObjective(event.target.value)}
            placeholder="Describe the next analysis goal for the agent."
            rows={4}
          />
        </label>
        <div className="control-row">
          <button
            type="button"
            className="primary-button"
            onClick={handleRunAgentStep}
            disabled={isRunning}
          >
            {isRunning ? 'Running agent…' : 'Run one agent step'}
          </button>
          <span className={`status-pill ${agentStatus}`}>{agentStatus}</span>
        </div>
        {agentError ? (
          <p className="agent-error" role="status">{agentError}</p>
        ) : null}
        {agentLastStep ? (
          <article className="agent-step-card">
            <div className="agent-step-header">
              <div>
                <p className="eyebrow">Last Agent Step</p>
                <h4>{agentLastStep?.traceStep?.summary || agentLastStep?.operation?.name || 'Agent update'}</h4>
              </div>
              <span className={`status-pill ${agentError ? 'error' : 'idle'}`}>
                {agentLastStep?.operation?.kind || 'result'}
              </span>
            </div>
            <div className="agent-token-row">
              <span className="filter-chip active">{agentLastStep?.operation?.queryScope?.widgetRef || 'workspace scope'}</span>
              {agentLastStep?.traceStep?.verificationSummary ? (
                <span className="filter-chip">verified</span>
              ) : null}
              {agentLastStep?.traceStep?.evidenceSummary ? (
                <span className="filter-chip">evidence</span>
              ) : null}
            </div>
            <div className="agent-step-grid">
              <p><strong>Objective</strong> {agentLastStep?.objective || 'None'}</p>
              <p><strong>Operation</strong> {agentLastStep?.operation?.name || 'None'}</p>
              <p><strong>Params</strong> {formatAgentParams(agentLastStep?.operation?.params)}</p>
              <p><strong>Runtime</strong> {summarizeStepResultPayload(agentLastStep?.result)}</p>
              <p><strong>Verification</strong> {agentLastStep?.traceStep?.verificationSummary || summarizeStepResultPayload(agentLastStep?.verificationResult)}</p>
              <p><strong>Evidence</strong> {agentLastStep?.traceStep?.evidenceSummary || 'None recorded'}</p>
            </div>
            {agentLastStep?.error ? (
              <p className="agent-error" role="status">{agentLastStep.error}</p>
            ) : null}
          </article>
        ) : null}
        <div className="chat-thread">
          {agentMessages.map((message) => (
            <article key={message.id} className={`chat-bubble ${message.role}`}>
              <strong>{message.role === 'assistant' ? 'Agent' : 'Researcher'}</strong>
              <p>{message.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="info-block compact">
        <h4>Current context</h4>
        {traceModel.selectedStep ? (
          <p>{traceModel.selectedStep.actor} · {traceModel.selectedStep.kind} · {traceModel.selectedStep.widgetTitle} · {traceModel.selectedStep.summary}</p>
        ) : (
          <p>No trace step selected yet.</p>
        )}
        {provenanceSummary.selectedSegmentLabel ? (
          <p>Segment {provenanceSummary.selectedSegmentLabel} · {provenanceSummary.selectedSegmentStepCount} step{provenanceSummary.selectedSegmentStepCount === 1 ? '' : 's'}</p>
        ) : null}
        {provenanceSummary.selectedPathLabel ? (
          <p>Path {provenanceSummary.selectedPathLabel} · {provenanceSummary.selectedPathSegmentCount} segment{provenanceSummary.selectedPathSegmentCount === 1 ? '' : 's'} · {provenanceSummary.selectedPathStepCount} step{provenanceSummary.selectedPathStepCount === 1 ? '' : 's'}</p>
        ) : null}
        {activeReplayContext ? (
          <p>Replay anchor: {activeReplayContext.source} · {activeReplayContext.branchId || 'main'} · {activeReplayContext.stateId || 'no state id'}</p>
        ) : null}
        <ul className="flat-list">
          <li>Observe the focused widget first: {focusedWidgetRef || selectedWidgetId}</li>
          <li>Selection source: {propagationSummary?.sourceWidgetId || 'none active'}</li>
          <li>Propagation targets: {propagationSummary?.targetWidgetIds?.length ? propagationSummary.targetWidgetIds.join(', ') : 'none'}</li>
          <li>Verification: {latestCoordinationResult?.verification?.summary || 'none'}</li>
        </ul>
      </section>
      {workspaceDescription ? (
        <section className="info-block compact">
          <h4>Runtime</h4>
          <p>{selectedWidgetDescription?.kind || 'unknown'} · {(selectedWidgetDescription?.actionNames || []).length} actions · {selectedWidgetPerceptionNames.length} perception queries</p>
          <p>{selectionRegistryCount} shared selections · {topology || 'unknown'} topology</p>
          <p>Current renderer environment: {workspaceProviderEnvironment}</p>
        </section>
      ) : null}
    </div>
  )
}
