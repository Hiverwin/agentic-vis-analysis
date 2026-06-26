import {
  appendAgentMessage,
  appendRuntimeTraceStep,
  createAgentRuntimeContract,
  getRuntimeSession,
  getWorkspaceCase,
  listRuntimeAvailableActions,
  listRuntimeAvailablePerceptions,
  readLatestCoordinationResult,
  readRuntimeObservation,
  readRuntimeWorkspaceDescription,
  readRuntimeTrace,
  readSelectionPropagationSummary,
  readWorkspaceCoordinationState,
} from './runtimeBridge.js'

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

export function summarizeObservation(caseId) {
  const session = getRuntimeSession(caseId)
  const runtime = session?.runtime
  if (!runtime) return null
  const observation = readRuntimeObservation(caseId) || null
  const description = readRuntimeWorkspaceDescription(caseId) || null
  const providerByWidgetRef = buildWidgetProviderIndex(description)
  const coordination = readWorkspaceCoordinationState(caseId)
  const propagation = readSelectionPropagationSummary(caseId)
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
    availableActions: listRuntimeAvailableActions(caseId).slice(0, 36).map((action) => ({
      name: action.name,
      title: action.title || action.name,
      description: action.description || '',
    })),
    availablePerceptions: listRuntimeAvailablePerceptions(caseId).slice(0, 24).map((query) => ({
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
    traceTail: summarizeTraceForPrompt(readRuntimeTrace(caseId)),
    rawObservation: observation ? {
      workspaceId: observation.workspace?.workspaceId || null,
      stateId: observation.state?.stateId || null,
    } : null,
  }
}

function buildAgentMessages({ objective, observation }) {
  const systemPrompt = [
    'You are an analyst agent operating a multi-widget visual analytics workspace.',
    'Choose exactly one next step.',
    'Use only the listed actions, perceptions, or data queries.',
    'Return JSON only.',
    'Prefer one of these operation kinds: action, perception, data_query.',
    'If you choose action, include name, queryScope.widgetRef when possible, and params.',
    'If you choose perception, include name, queryScope.widgetRef when possible, and params.',
    'If you choose data_query, include dataRef, query.kind, and query.spec.',
    'Keep assistantMessage concise and task-focused.',
  ].join(' ')

  const userPrompt = JSON.stringify({
    objective,
    observation,
  })

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
}

function buildAgentRepairMessages({ objective, observation, previousContent = '' }) {
  const systemPrompt = [
    'You previously returned an invalid plan for a visual analytics agent.',
    'Return JSON only.',
    'Your JSON must contain assistantMessage and operation.',
    'operation.kind must be exactly one of: action, perception, data_query.',
    'If operation.kind is action or perception, include operation.name.',
    'If possible, include operation.queryScope.widgetRef.',
    'Do not include markdown fences or explanatory prose.',
  ].join(' ')

  const userPrompt = JSON.stringify({
    objective,
    observation,
    previousContent,
    requiredShape: {
      assistantMessage: 'string',
      rationale: 'string',
      operation: {
        kind: 'action|perception|data_query',
        name: 'string when kind is action/perception',
        queryScope: {
          widgetRef: 'string',
        },
        params: {},
        dataRef: 'string when kind is data_query',
        query: {},
      },
    },
  })

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
}

function extractJsonObject(text = '') {
  if (typeof text !== 'string') return null
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

function readPlannedOperation(plan = {}) {
  if (plan?.operation) return plan.operation
  const entries = Object.entries(plan || {})
  for (const [key, value] of entries) {
    const normalizedKey = key.toLowerCase()
    if (
      value
      && typeof value === 'object'
      && (
        normalizedKey === 'action'
        || normalizedKey === 'perception'
        || normalizedKey === 'data_query'
        || normalizedKey === 'dataquery'
      )
    ) {
      const kind = normalizedKey === 'dataquery' ? 'data_query' : normalizedKey
      return { kind, ...value }
    }
  }
  return {}
}

function inferOperationKind(plan = {}, operation = {}) {
  const explicitKind = operation.kind || plan.kind
  if (explicitKind) return explicitKind
  if (operation.dataRef || operation.query) return 'data_query'
  if (operation.name) {
    if (String(operation.name).startsWith('perception.')) return 'perception'
    return 'action'
  }
  return null
}

async function requestOpenRouterAgentPlan({ model = DEFAULT_OPENROUTER_VLM, objective, observation, messages = null }) {
  const response = await fetch('/api/openrouter/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: Array.isArray(messages) && messages.length > 0
        ? messages
        : buildAgentMessages({ objective, observation }),
    }),
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(formatAgentRuntimeError(payload) || 'OpenRouter request failed.')
  }
  const content = payload?.choices?.[0]?.message?.content || ''
  const plan = extractJsonObject(content)
  if (!plan) {
    throw new Error('Agent response did not contain valid JSON.')
  }
  return {
    raw: payload,
    content,
    plan,
  }
}

function isExecutableOperation(operation = {}) {
  if (!operation || typeof operation !== 'object') return false
  if (operation.kind === 'action' || operation.kind === 'perception') {
    return typeof operation.name === 'string' && operation.name.trim().length > 0
  }
  if (operation.kind === 'data_query') {
    return typeof operation.dataRef === 'string' && operation.dataRef.length > 0 && Boolean(operation.query)
  }
  return false
}

function buildSafeFallbackOperation(observation = {}) {
  const widgets = Array.isArray(observation?.widgets) ? observation.widgets : []
  const focusedWidgetRef = observation?.focusedWidgetRef || widgets[0]?.ref || null
  return {
    assistantMessage: 'I will first inspect the currently focused widget configuration before taking a stronger interaction step.',
    rationale: 'The model response did not yield a valid executable operation, so the runtime is falling back to a safe perception on the active widget.',
    kind: 'perception',
    name: 'perception.inspectViewConfig',
    ...(focusedWidgetRef ? { queryScope: { widgetRef: focusedWidgetRef } } : {}),
    params: {},
    dataRef: null,
    query: null,
  }
}

function normalizeOperation(plan = {}, observation = {}) {
  const operation = readPlannedOperation(plan)
  const widgets = Array.isArray(observation?.widgets) ? observation.widgets : []
  const fallbackWidgetRef = widgets[0]?.ref || null
  const flatWidgetRef = operation['queryScope.widgetRef'] || operation['query_scope.widget_ref'] || null
  const nestedWidgetRef = operation.queryScope?.widgetRef || operation.query_scope?.widget_ref || null
  const widgetRef = nestedWidgetRef || flatWidgetRef || fallbackWidgetRef || null
  return {
    assistantMessage: typeof plan?.assistantMessage === 'string' ? plan.assistantMessage : 'Planned one next analysis step.',
    rationale: typeof plan?.rationale === 'string' ? plan.rationale : '',
    kind: inferOperationKind(plan, operation),
    name: operation.name || null,
    queryScope: widgetRef ? { widgetRef } : undefined,
    params: clone(operation.params || {}),
    dataRef: operation.dataRef || null,
    query: clone(operation.query || null),
  }
}

function summarizeResult(result) {
  if (!result) return null
  if (typeof result?.result === 'string') return result.result
  if (typeof result?.summary === 'string') return result.summary
  if (typeof result?.message === 'string') return result.message
  if (result?.result && typeof result.result === 'object') {
    return JSON.stringify(result.result).slice(0, 220)
  }
  return null
}

export async function runOpenRouterAgentStep(caseId, {
  objective,
  model = DEFAULT_OPENROUTER_VLM,
} = {}) {
  const session = getRuntimeSession(caseId)
  if (!session?.runtime) {
    throw new Error('Runtime session is not available for the requested case.')
  }
  const contract = createAgentRuntimeContract(caseId)
  const safeObjective = typeof objective === 'string' && objective.trim().length > 0
    ? objective.trim()
    : 'Analyse the horsepower patterns in the USA.'

  const observation = summarizeObservation(caseId)
  const planning = await requestOpenRouterAgentPlan({
    model,
    objective: safeObjective,
    observation,
  })
  let operation = normalizeOperation(planning.plan, observation)
  let resolvedPlanning = planning
  if (!isExecutableOperation(operation)) {
    const repairedPlanning = await requestOpenRouterAgentPlan({
      model,
      objective: safeObjective,
      observation,
      messages: buildAgentRepairMessages({
        objective: safeObjective,
        observation,
        previousContent: planning.content,
      }),
    })
    const repairedOperation = normalizeOperation(repairedPlanning.plan, observation)
    if (isExecutableOperation(repairedOperation)) {
      resolvedPlanning = repairedPlanning
      operation = repairedOperation
    } else {
      operation = buildSafeFallbackOperation(observation)
    }
  }

  appendAgentMessage(caseId, {
    role: 'user',
    text: safeObjective,
  })
  appendAgentMessage(caseId, {
    role: 'assistant',
    text: operation.assistantMessage,
  })

  let result = null
  if (operation.kind === 'action') {
    result = await contract.executeAction({
      callId: `agent_action_${Date.now()}`,
      actor: 'agent',
      name: operation.name,
      ...(operation.queryScope ? { queryScope: operation.queryScope } : {}),
      params: operation.params || {},
    })
  } else if (operation.kind === 'perception') {
    result = await contract.queryPerception({
      callId: `agent_perception_${Date.now()}`,
      actor: 'agent',
      name: operation.name,
      ...(operation.queryScope ? { queryScope: operation.queryScope } : {}),
      params: operation.params || {},
    })
  } else if (operation.kind === 'data_query') {
    result = await contract.runDataQuery({
      callId: `agent_data_${Date.now()}`,
      actor: 'agent',
      dataRef: operation.dataRef,
      query: operation.query,
    })
  } else {
    throw new Error(`Unsupported planned operation kind: ${operation.kind || 'unknown'}`)
  }

  let verificationResult = null
  if (operation.kind === 'action' && operation.queryScope?.widgetRef) {
    try {
      verificationResult = await contract.queryPerception({
        callId: `agent_verify_${Date.now()}`,
        actor: 'agent',
        name: 'perception.verifyActionEffect',
        queryScope: { widgetRef: operation.queryScope.widgetRef },
        params: {
          actionName: operation.name,
          stateId: result?.stateId || contract.readObservation()?.state?.stateId || null,
          refs: result?.updatedRefs || [],
        },
      })
    } catch {
      verificationResult = null
    }
  }

  const latestCoordination = readLatestCoordinationResult(caseId)
  const widgetRef = operation.queryScope?.widgetRef || null
  const widgetTitle = observation?.widgets?.find((widget) => widget.ref === widgetRef)?.title || operation.name || 'Workspace'
  const traceStep = appendRuntimeTraceStep(caseId, {
    actor: 'agent',
    kind: operation.kind,
    widgetTitle,
    methodName: operation.name || operation.query?.kind || 'agent.step',
    summary: operation.assistantMessage,
    detail: operation.rationale || `Executed ${operation.kind}.`,
    verificationSummary: summarizeResult(verificationResult) || latestCoordination?.verification?.summary || null,
    evidenceSummary: summarizeResult(result),
    queryScope: operation.queryScope || null,
    updatedRefs: result?.updatedRefs || [],
    sourceStateId: observation?.rawObservation?.stateId || null,
    resultStateId: result?.stateId || contract.readObservation()?.state?.stateId || observation?.rawObservation?.stateId || null,
    stateDelta: {
      selection: operation.kind === 'action',
      focus: operation.kind === 'action' && operation.name === 'workspace.focusWidget',
      highlight: operation.kind === 'perception',
      viewport: false,
      evidence: operation.kind !== 'action',
      branch: false,
      propagation: Boolean(latestCoordination?.propagationSummary?.active),
    },
  })

  return {
    model,
    observation,
    planning: resolvedPlanning,
    operation,
    result,
    verificationResult,
    traceStep,
    trace: readRuntimeTrace(caseId),
  }
}
