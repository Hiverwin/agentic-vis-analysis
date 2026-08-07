import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../../../app/store/appStore.js'
import ChatMessage from './ChatMessage.jsx'
import IterationCard from './IterationCard.jsx'
import {
  buildAgentConversationItems,
  buildAgentTraceIterationSources,
  buildIterationCardData,
  buildLatestMessageIterationSource,
  buildLatestTraceIterationSource,
} from '../models/agentConversationModel.js'

export function AgentPanel() {
  const workspaceSourceType = useAppStore((state) => state.workspaceSourceType)
  const loadedVisualizationPreview = useAppStore((state) => state.loadedVisualizationPreview)
  const bindCurrentVisualization = useAppStore((state) => state.bindCurrentVisualization)
  const visualizationBindStatus = useAppStore((state) => state.visualizationBindStatus)
  const visualizationBindError = useAppStore((state) => state.visualizationBindError)
  const caseTitle = useAppStore((state) => state.caseTitle)
  const agentMessages = useAppStore((state) => state.agentMessages)
  const agentStatus = useAppStore((state) => state.agentStatus)
  const agentError = useAppStore((state) => state.agentError)
  const agentObjective = useAppStore((state) => state.agentObjective)
  const agentLastStep = useAppStore((state) => state.agentLastStep)
  const trace = useAppStore((state) => state.trace)
  const setAgentObjective = useAppStore((state) => state.setAgentObjective)
  const runAgentStep = useAppStore((state) => state.runAgentStep)
  const [draftObjective, setDraftObjective] = useState(agentObjective)
  const chatEndRef = useRef(null)
  const isRunning = agentStatus === 'running'
  const bindRequired = Boolean(loadedVisualizationPreview?.widget)
  const isBinding = visualizationBindStatus === 'binding'
  const importedWorkspace = workspaceSourceType === 'importedSpec'
  const starterWorkspace = workspaceSourceType === 'starter'
  const latestIterationSource = useMemo(
    () => agentLastStep || buildLatestTraceIterationSource(trace) || buildLatestMessageIterationSource(agentMessages),
    [agentLastStep, agentMessages, trace],
  )
  const latestIteration = useMemo(
    () => buildIterationCardData(latestIterationSource, agentMessages),
    [agentMessages, latestIterationSource],
  )
  const agentTraceSources = useMemo(
    () => buildAgentTraceIterationSources(trace),
    [trace],
  )
  const conversationItems = useMemo(
    () => buildAgentConversationItems({
      agentMessages,
      agentTraceSources,
      agentLastStep,
      agentError,
    }),
    [agentError, agentLastStep, agentMessages, agentTraceSources],
  )
  const objectivePlaceholder = importedWorkspace
    ? `Ask about ${caseTitle || 'this chart'}...`
    : starterWorkspace
      ? 'Ask the agent to inspect or transform the current view...'
      : 'Describe the next analysis goal for the agent.'
  const composerPlaceholder = latestIteration || agentError || visualizationBindError
    ? 'Continue the analysis...'
    : objectivePlaceholder
  useEffect(() => {
    setDraftObjective(agentObjective)
  }, [agentObjective])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView?.({ block: 'end' })
  }, [conversationItems.length, isRunning])

  async function handleRunAgentStep(nextPrompt = '') {
    const nextObjective = typeof nextPrompt === 'string' && nextPrompt.trim().length > 0
      ? nextPrompt.trim()
      : draftObjective.trim() || agentObjective
    if (!nextObjective) return
    setAgentObjective(nextObjective)
    try {
      await runAgentStep(nextObjective)
      setDraftObjective('')
    } catch {
      // Store state already exposes the error in the panel.
    }
  }

  function handleComposerSubmit(event) {
    event.preventDefault()
    if (isRunning || bindRequired) return
    void handleRunAgentStep(draftObjective)
  }

  function handleComposerKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    if (isRunning || bindRequired) return
    void handleRunAgentStep(draftObjective)
  }

  async function handleBindCurrentVisualization() {
    if (isBinding) return
    try {
      await bindCurrentVisualization()
    } catch {
      // Store state already exposes the bind error in the panel.
    }
  }

  return (
    <div className="agent-chat-panel">
      <section className="agent-thread-shell" aria-label="Agent conversation">
        <div className="agent-chat-thread">
          {conversationItems.length > 0 ? conversationItems.map((item) => {
            if (item.type === 'iteration') {
              const iteration = buildIterationCardData(item.source, agentMessages, item.assistantText)
              if (!iteration) return null
              return (
                <section key={item.id} className="agent-loop-card" aria-label="Agent execution loop">
                  <div className="agent-loop-meta">
                    {item.source?.recordedAt ? (
                      <span className="agent-loop-timestamp">
                        {new Date(item.source.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : null}
                  </div>
                  <IterationCard iterationData={iteration} />
                </section>
              )
            }
            return <ChatMessage key={item.id} message={item.message} />
          }) : (
            latestIteration ? (
              <section className="agent-loop-card" aria-label="Agent execution loop">
                <div className="agent-loop-meta">
                  {latestIterationSource?.recordedAt ? (
                    <span className="agent-loop-timestamp">
                      {new Date(latestIterationSource.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  ) : null}
                </div>
                <IterationCard iterationData={latestIteration} />
              </section>
            ) : null
          )}
          {isRunning ? (
            <div className="agent-status-copy" role="status">Agent is responding...</div>
          ) : null}
          <div ref={chatEndRef} />
        </div>
      </section>
      {visualizationBindError && bindRequired ? (
        <p className="agent-error" role="status">{visualizationBindError}</p>
      ) : null}

      <form className="agent-composer" onSubmit={handleComposerSubmit}>
        {bindRequired || isRunning || isBinding ? (
          <span className="agent-status-copy agent-composer-status">
            {bindRequired
              ? 'Bind the chart before asking the agent.'
              : isBinding
                ? 'Binding chart to the runtime…'
                : 'Agent is responding…'}
          </span>
        ) : null}
        <div className="agent-composer-row">
          <textarea
            id="agent-objective"
            className="control-textarea agent-composer-input"
            value={draftObjective}
            onChange={(event) => setDraftObjective(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder={composerPlaceholder}
            rows={2}
          />
          <button
            type={bindRequired ? 'button' : 'submit'}
            className="primary-button compact"
            onClick={bindRequired ? () => { void handleBindCurrentVisualization() } : undefined}
            disabled={isRunning || isBinding || (!bindRequired && draftObjective.trim().length === 0)}
          >
            {bindRequired ? (isBinding ? 'Binding…' : 'Bind chart') : (isRunning ? 'Sending…' : 'Send')}
          </button>
        </div>
      </form>
    </div>
  )
}
