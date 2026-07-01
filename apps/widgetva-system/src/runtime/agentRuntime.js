import {
  createFirstPartyRuntimeSessionFacade,
  getRuntimeSession,
  getWorkspaceCase,
} from './runtimeBridge.js'
import {
  runNaturalLanguagePagePortAgentSession,
  runNaturalLanguagePagePortAgentTurn,
} from '../../../../widgetva-kit/src/coreRuntime.js'

export const DEFAULT_OPENROUTER_VLM = 'deepseek/deepseek-v4-flash'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function formatAgentRuntimeError(error) {
  if (typeof error === 'string') return error
  if (error instanceof Error) {
    if (typeof error.message === 'string' && error.message.trim().length > 0) {
      return error.message
    }
    try {
      return JSON.stringify(error.message)
    } catch {
      return 'Agent step failed.'
    }
  }
  if (error && typeof error === 'object') {
    const message = error.error || error.message || error.detail || error.reason || null
    if (typeof message === 'string' && message.trim().length > 0) return message
    try {
      return JSON.stringify(error)
    } catch {
      return 'Agent step failed.'
    }
  }
  return 'Agent step failed.'
}

function summarizeTraceForPrompt(trace = []) {
  return (Array.isArray(trace) ? trace : []).slice(-8).map((step) => ({
    actor: step.actor,
    kind: step.kind,
    widgetTitle: step.widgetTitle,
    summary: step.summary || step.label,
    verificationSummary: step.verificationSummary || null,
  }))
}

function buildWidgetProviderIndex(description = {}) {
  const adapters = Array.isArray(description?.widgetAdapters) ? description.widgetAdapters : []
  return Object.fromEntries(
    adapters
      .filter((adapter) => typeof adapter?.widgetRef === 'string' && adapter.widgetRef.length > 0)
      .map((adapter) => [adapter.widgetRef, adapter]),
  )
}

function buildDataQueryCatalog(description = {}) {
  return Object.fromEntries(
    (Array.isArray(description?.dataHandles) ? description.dataHandles : [])
      .filter((handle) => typeof handle?.ref === 'string' && handle.ref.length > 0)
      .map((handle) => [
        handle.ref,
        Array.isArray(handle?.supportedQueryDescriptors)
          ? handle.supportedQueryDescriptors
            .map((descriptor) => descriptor?.name)
            .filter((name) => typeof name === 'string' && name.length > 0)
          : [],
      ]),
  )
}

function buildActionCatalog(actions = []) {
  return Object.fromEntries(
    (Array.isArray(actions) ? actions : [])
      .filter((action) => typeof action?.targetRef === 'string' && typeof action?.name === 'string')
      .reduce((acc, action) => {
        const entry = acc.get(action.targetRef) || new Set()
        entry.add(action.name)
        acc.set(action.targetRef, entry)
        return acc
      }, new Map())
      .entries()
      .map(([widgetRef, names]) => [widgetRef, Array.from(names)]),
  )
}

function buildPerceptionCatalog(perceptions = []) {
  return Object.fromEntries(
    (Array.isArray(perceptions) ? perceptions : [])
      .filter((query) => typeof query?.targetRef === 'string' && typeof query?.name === 'string')
      .reduce((acc, query) => {
        const entry = acc.get(query.targetRef) || new Set()
        entry.add(query.name)
        acc.set(query.targetRef, entry)
        return acc
      }, new Map())
      .entries()
      .map(([widgetRef, names]) => [widgetRef, Array.from(names)]),
  )
}

async function completeOpenRouterChat({
  model = DEFAULT_OPENROUTER_VLM,
  temperature = 0.2,
  messages = [],
} = {}) {
  const response = await fetch('/api/openrouter/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: Array.isArray(messages) ? messages : [],
    }),
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(formatAgentRuntimeError(payload) || 'OpenRouter request failed.')
  }
  return {
    raw: payload,
    content: payload?.choices?.[0]?.message?.content || '',
  }
}

function buildTraceOperationFromTurn(turn = {}) {
  const step = turn?.plan?.step || {}
  return {
    kind: step.kind || turn?.act?.kind || null,
    name: step.name || turn?.act?.name || null,
    queryScope: clone(step.queryScope || turn?.act?.queryScope || null),
    assistantMessage: turn?.reason?.answer || null,
    rationale: turn?.plan?.rationale || '',
  }
}

function readRuntimeFacade(caseId) {
  return createFirstPartyRuntimeSessionFacade(caseId)
}

export function buildAgentSessionKnowledge(caseId, {
  historyLimit = 8,
} = {}) {
  const session = getRuntimeSession(caseId)
  if (!session?.runtime) return null

  const runtime = readRuntimeFacade(caseId)
  const description = runtime.readWorkspaceDescription() || {}
  const caseDef = getWorkspaceCase(caseId)
  const providerByWidgetRef = buildWidgetProviderIndex(description)
  const actions = runtime.listAvailableActions()
  const perceptions = runtime.listAvailablePerceptions()
  const history = summarizeTraceForPrompt(runtime.readRuntimeTrace())
    .slice(-historyLimit)
    .map((entry, index) => ({
      turnId: `trace_${index + 1}`,
      summary: entry.summary || `${entry.kind || 'step'} on ${entry.widgetTitle || 'workspace'}`,
    }))
  const dataQueriesByDataRef = buildDataQueryCatalog(description)
  const catalogs = {
    actionsByWidgetRef: buildActionCatalog(actions),
    perceptionsByWidgetRef: buildPerceptionCatalog(perceptions),
  }
  if (Object.keys(dataQueriesByDataRef).length > 0) {
    catalogs.dataQueriesByDataRef = dataQueriesByDataRef
  }

  return {
    workspace: {
      workspaceId: description?.workspaceId || null,
      caseId: caseDef?.id || caseId,
    },
    widgets: (Array.isArray(description?.widgets) ? description.widgets : []).map((widget) => ({
      ref: widget.ref,
      widgetId: widget.widgetId,
      kind: widget.kind,
      title: widget.title || null,
      ...(providerByWidgetRef[widget.ref]?.provider
        ? { provider: providerByWidgetRef[widget.ref].provider }
        : {}),
    })),
    catalogs,
    history: {
      turns: history,
    },
  }
}

export function summarizeObservation(caseId) {
  const session = getRuntimeSession(caseId)
  const runtime = session?.runtime
  if (!runtime) return null
  const runtimeFacade = readRuntimeFacade(caseId)
  const observation = runtimeFacade.readObservation() || null
  const description = runtimeFacade.readWorkspaceDescription() || null
  const providerByWidgetRef = buildWidgetProviderIndex(description)
  const coordination = runtimeFacade.readCoordinationState()
  const propagation = runtimeFacade.readPropagationSummary()
  const caseDef = getWorkspaceCase(caseId)
  return {
    caseTitle: caseDef?.title || caseId,
    caseSummary: caseDef?.summary || '',
    focusedWidgetRef: coordination?.focusedWidgetRef || null,
    globalFilters: coordination?.globalFilters || {},
    selectionSummary: coordination?.selections?.views?.primary?.summary || null,
    widgets: (description?.widgets || []).map((widget) => ({
      widgetId: widget.widgetId,
      ref: widget.ref,
      title: widget.title,
      kind: widget.kind,
      role: widget.role,
      provider: providerByWidgetRef[widget.ref]?.provider || null,
      providerCapabilities: providerByWidgetRef[widget.ref]?.providerCapabilities || null,
    })),
    availableActions: runtimeFacade.listAvailableActions().slice(0, 36).map((action) => ({
      name: action.name,
      title: action.title || action.name,
      description: action.description || '',
    })),
    availablePerceptions: runtimeFacade.listAvailablePerceptions().slice(0, 24).map((query) => ({
      name: query.name,
      title: query.title || query.name,
      description: query.description || '',
    })),
    availableDataQueries: (description?.dataHandles || []).flatMap((handle) => (
      Array.isArray(handle.supportedQueryDescriptors)
        ? handle.supportedQueryDescriptors.map((descriptor) => ({
          dataRef: handle.ref,
          queryKind: descriptor.name,
          title: descriptor.title || descriptor.name,
          description: descriptor.description || '',
        }))
        : []
    )).slice(0, 16),
    propagation: {
      active: propagation?.active || false,
      sourceWidgetId: propagation?.sourceWidgetId || null,
      targetWidgetIds: propagation?.targetWidgetIds || [],
    },
    traceTail: summarizeTraceForPrompt(runtimeFacade.readRuntimeTrace()),
    rawObservation: observation ? {
      workspaceId: observation.workspace?.workspaceId || null,
      stateId: observation.state?.stateId || null,
    } : null,
  }
}

function appendAgentTraceStep(caseId, {
  operation,
  act,
  verify,
  observe,
  sessionKnowledge,
} = {}) {
  const runtime = readRuntimeFacade(caseId)
  const latestCoordination = runtime.readLatestCoordinationResult()
  const widgetRef = operation?.queryScope?.widgetRef || null
  const widgetTitle = sessionKnowledge?.widgets?.find((widget) => widget.ref === widgetRef)?.title || operation?.name || 'Workspace'
  return runtime.appendTraceStep({
    actor: 'agent',
    kind: operation?.kind || 'action',
    widgetTitle,
    methodName: operation?.name || operation?.query?.kind || 'agent.step',
    summary: operation?.assistantMessage || 'Completed one agent step.',
    detail: operation?.rationale || `Executed ${operation?.kind || 'step'}.`,
    verificationSummary: verify?.summary || latestCoordination?.verification?.summary || null,
    evidenceSummary: act?.outputSummary || null,
    queryScope: operation?.queryScope || null,
    updatedRefs: act?.updatedRefs || [],
    sourceStateId: observe?.state?.stateId || null,
    resultStateId: act?.stateId || observe?.state?.stateId || null,
    stateDelta: {
      selection: operation?.kind === 'action',
      focus: operation?.kind === 'action' && operation?.name === 'workspace.focusWidget',
      highlight: operation?.kind === 'perception',
      viewport: false,
      evidence: operation?.kind !== 'action',
      branch: false,
      propagation: Boolean(latestCoordination?.propagationSummary?.active),
    },
  })
}

export async function runAgentTurn(caseId, {
  objective,
  query,
  model = DEFAULT_OPENROUTER_VLM,
  sessionKnowledge = null,
  previousTurnSummary = null,
  perception = null,
} = {}) {
  const session = getRuntimeSession(caseId)
  if (!session?.runtime) {
    throw new Error('Runtime session is not available for the requested case.')
  }

  const safeQuery = typeof query === 'string' && query.trim().length > 0
    ? query.trim()
    : typeof objective === 'string' && objective.trim().length > 0
      ? objective.trim()
      : 'Analyse the horsepower patterns in the USA.'
  const runtime = readRuntimeFacade(caseId)
  const contract = runtime.agentContract()
  const knowledge = sessionKnowledge || buildAgentSessionKnowledge(caseId) || {
    workspace: { workspaceId: null, caseId },
    widgets: [],
    catalogs: {
      actionsByWidgetRef: {},
      perceptionsByWidgetRef: {},
    },
    history: { turns: [] },
  }
  const turn = await runNaturalLanguagePagePortAgentTurn(contract, {
    objective: safeQuery,
    completeChat: completeOpenRouterChat,
    model,
    previousTurnSummary,
    perception,
    sessionKnowledge: knowledge,
  })

  runtime.appendAgentMessage({
    role: 'user',
    text: safeQuery,
  })
  runtime.appendAgentMessage({
    role: 'assistant',
    text: turn?.reason?.answer || '',
  })

  appendAgentTraceStep(caseId, {
    operation: buildTraceOperationFromTurn(turn),
    act: turn?.act || null,
    verify: turn?.verify || null,
    observe: turn?.observe || null,
    sessionKnowledge: knowledge,
  })

  return turn
}

export async function runAgentSession(caseId, {
  objective,
  query,
  model = DEFAULT_OPENROUTER_VLM,
  maxTurns = 3,
  sessionKnowledge = null,
} = {}) {
  const safeMaxTurns = Number.isFinite(maxTurns) && maxTurns > 0 ? Math.max(1, Math.floor(maxTurns)) : 3
  const safeQuery = typeof query === 'string' && query.trim().length > 0
    ? query.trim()
    : typeof objective === 'string' && objective.trim().length > 0
      ? objective.trim()
      : 'Analyse the horsepower patterns in the USA.'
  const runtime = readRuntimeFacade(caseId)
  const contract = runtime.agentContract()
  const knowledge = sessionKnowledge || buildAgentSessionKnowledge(caseId) || null
  const result = await runNaturalLanguagePagePortAgentSession(contract, {
    objective: safeQuery,
    completeChat: completeOpenRouterChat,
    model,
    maxTurns: safeMaxTurns,
    sessionKnowledge: knowledge,
  })

  runtime.appendAgentMessage({
    role: 'user',
    text: safeQuery,
  })
  for (const turn of Array.isArray(result?.turns) ? result.turns : []) {
    if (typeof turn?.reason?.answer === 'string' && turn.reason.answer.length > 0) {
      runtime.appendAgentMessage({
        role: 'assistant',
        text: turn.reason.answer,
      })
    }
  }
  for (const turn of Array.isArray(result?.turns) ? result.turns : []) {
    appendAgentTraceStep(caseId, {
      operation: buildTraceOperationFromTurn(turn),
      act: turn?.act || null,
      verify: turn?.verify || null,
      observe: turn?.observe || null,
      sessionKnowledge: result?.knowledge || knowledge,
    })
  }

  return result
}

export async function runOpenRouterAgentStep(caseId, options = {}) {
  return runAgentTurn(caseId, options)
}
