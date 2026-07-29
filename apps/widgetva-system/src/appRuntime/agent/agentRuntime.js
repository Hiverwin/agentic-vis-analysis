import { runWidgetVAAgentSession } from 'widgetva-kit'
import {
  createFirstPartyRuntimeSessionFacade,
  getRuntimeSession,
  getWorkspaceCase,
  recordAgentSessionResult,
  recordAgentTurnResult,
} from '../contracts/runtimeBridge.js'
import { cloneJsonValue as clone } from '../../shared/clone.js'

export const DEFAULT_OPENROUTER_VLM = 'deepseek/deepseek-v4-flash'
const DEFAULT_AGENT_QUERY = 'Inspect the current workspace, summarize the visible data, and explain the main pattern.'

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
    if (typeof message === 'string' && message.trim().length > 0) {
      const detail = typeof error.detail === 'string' ? error.detail.trim() : ''
      return detail && detail !== message ? `${message} Detail: ${detail}` : message
    }
    try {
      return JSON.stringify(error)
    } catch {
      return 'Agent step failed.'
    }
  }
  return 'Agent step failed.'
}

function buildWidgetProviderIndex(description = {}) {
  const adapters = Array.isArray(description?.widgetAdapters) ? description.widgetAdapters : []
  return Object.fromEntries(
    adapters
      .filter((adapter) => typeof adapter?.widgetRef === 'string' && adapter.widgetRef.length > 0)
      .map((adapter) => [adapter.widgetRef, adapter]),
  )
}

function summarizeTraceForPrompt(trace = []) {
  return (Array.isArray(trace) ? trace : [])
    .slice(-6)
    .map((step, index) => ({
      stepId: step?.id || `trace_${index + 1}`,
      actor: step?.actor || 'system',
      kind: step?.kind || 'action',
      methodName: step?.methodName || null,
      widgetTitle: step?.widgetTitle || null,
      summary: step?.summary || step?.detail || null,
      verificationSummary: step?.verificationSummary || null,
      evidenceSummary: step?.evidenceSummary || null,
      sourceStateId: step?.sourceStateId || null,
      resultStateId: step?.resultStateId || null,
      transitionType: step?.transitionType || null,
    }))
}

async function completeOpenRouterChat({
  model = DEFAULT_OPENROUTER_VLM,
  temperature = 0.2,
  messages = [],
  responseFormat = null,
} = {}) {
  let response = null
  try {
    response = await fetch('/api/openrouter/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature,
        messages: Array.isArray(messages) ? messages : [],
        ...(responseFormat ? { response_format: responseFormat } : {}),
      }),
    })
  } catch (error) {
    throw new Error(`OpenRouter request could not reach the local dev proxy: ${formatAgentRuntimeError(error)}`)
  }

  let payload = {}
  if (typeof response.text === 'function') {
    const rawText = await response.text()
    try {
      payload = rawText ? JSON.parse(rawText) : {}
    } catch {
      payload = { error: rawText || 'OpenRouter proxy returned a non-JSON response.' }
    }
  } else if (typeof response.json === 'function') {
    payload = await response.json()
  }
  if (!response.ok) {
    throw new Error(formatAgentRuntimeError(payload) || 'OpenRouter request failed.')
  }
  return {
    raw: payload,
    content: payload?.choices?.[0]?.message?.content || '',
  }
}

function readRuntimeFacade(caseId) {
  return createFirstPartyRuntimeSessionFacade(caseId)
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
      recognizedKinds: Array.isArray(widget.recognizedKinds) ? [...widget.recognizedKinds] : [],
      role: widget.role,
      provider: providerByWidgetRef[widget.ref]?.provider || null,
    })),
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

export async function runAgentTurn(caseId, {
  objective,
  query,
  model = DEFAULT_OPENROUTER_VLM,
  sessionKnowledge = null,
} = {}) {
  const safeQuery = typeof query === 'string' && query.trim().length > 0
    ? query.trim()
    : typeof objective === 'string' && objective.trim().length > 0
      ? objective.trim()
      : DEFAULT_AGENT_QUERY
  const session = getRuntimeSession(caseId)
  if (!session?.runtime) {
    throw new Error('Runtime session is not available for the requested case.')
  }
  const sessionResult = await runWidgetVAAgentSession({
    target: session.workspace,
    objective: safeQuery,
    completeChat: completeOpenRouterChat,
    model,
    maxTurns: 1,
    ...(sessionKnowledge ? { sessionKnowledge } : {}),
  })
  const turn = sessionResult?.turns?.[0] || null

  recordAgentTurnResult(caseId, {
    query: safeQuery,
    turn,
    ...(sessionKnowledge ? { sessionKnowledge } : {}),
  })

  return turn
}

export async function runAgentSession(caseId, {
  objective,
  query,
  model = DEFAULT_OPENROUTER_VLM,
  maxTurns = 3,
  sessionKnowledge = null,
  onTurn = null,
  recordTurns = true,
} = {}) {
  const safeMaxTurns = Number.isFinite(maxTurns) && maxTurns > 0 ? Math.max(1, Math.floor(maxTurns)) : 3
  const safeQuery = typeof query === 'string' && query.trim().length > 0
    ? query.trim()
    : typeof objective === 'string' && objective.trim().length > 0
      ? objective.trim()
      : DEFAULT_AGENT_QUERY
  const session = getRuntimeSession(caseId)
  if (!session?.runtime) {
    throw new Error('Runtime session is not available for the requested case.')
  }
  const result = await runWidgetVAAgentSession({
    target: session.workspace,
    objective: safeQuery,
    completeChat: completeOpenRouterChat,
    model,
    maxTurns: safeMaxTurns,
    ...(sessionKnowledge ? { sessionKnowledge } : {}),
    onTurn,
  })

  if (recordTurns) {
    recordAgentSessionResult(caseId, {
      query: safeQuery,
      result,
      ...(sessionKnowledge ? { fallbackKnowledge: sessionKnowledge } : {}),
    })
  }

  return result
}

export async function runOpenRouterAgentStep(caseId, options = {}) {
  return runAgentTurn(caseId, options)
}
