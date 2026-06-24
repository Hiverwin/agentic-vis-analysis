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
  readRuntimeTrace,
  readRuntimeView,
  readRuntimeWorkspaceDescription,
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

function summarizeHistoryTurn(step = {}, index = 0) {
  const reasonAnswer = step?.reason?.answer || null
  const act = step?.act || null
  const summaryParts = [
    typeof reasonAnswer === 'string' && reasonAnswer.trim().length > 0 ? reasonAnswer.trim() : null,
    act?.name ? `${act.kind || 'step'}:${act.name}` : null,
    act?.outputSummary || null,
  ].filter(Boolean)
  return {
    turnId: `turn_${index + 1}`,
    summary: summaryParts[0] || 'Completed one agent turn.',
  }
}

export function buildAgentSessionKnowledge(caseId, {
  historyLimit = 8,
} = {}) {
  const session = getRuntimeSession(caseId)
  if (!session?.runtime) return null

  const description = readRuntimeWorkspaceDescription(caseId) || {}
  const caseDef = getWorkspaceCase(caseId)
  const loopContext = session?.runtime?.describeAgentLoop?.() || null
  const providerByWidgetRef = buildWidgetProviderIndex(description)
  const actions = listRuntimeAvailableActions(caseId)
  const perceptions = listRuntimeAvailablePerceptions(caseId)
  const history = summarizeTraceForPrompt(readRuntimeTrace(caseId))
    .slice(-historyLimit)
    .map((entry, index) => ({
      turnId: `trace_${index + 1}`,
      summary: entry.summary || `${entry.kind || 'step'} on ${entry.widgetTitle || 'workspace'}`,
    }))

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
      provider: providerByWidgetRef[widget.ref]?.provider || null,
    })),
    catalogs: {
      actionsByWidgetRef: buildActionCatalog(actions),
      perceptionsByWidgetRef: buildPerceptionCatalog(perceptions),
      dataQueriesByDataRef: buildDataQueryCatalog(description),
    },
    loopHints: clone(loopContext?.loopHints || null),
    history: {
      turns: history,
    },
  }
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

function summarizeState({ coordination = null, latestCoordinationResult = null } = {}) {
  const parts = []
  if (typeof coordination?.focusedWidgetRef === 'string' && coordination.focusedWidgetRef.length > 0) {
    parts.push(`focus ${coordination.focusedWidgetRef}`)
  }
  if (typeof coordination?.selections?.views?.primary?.summary === 'string' && coordination.selections.views.primary.summary.length > 0) {
    parts.push(coordination.selections.views.primary.summary)
  }
  const filterCount = Object.keys(coordination?.globalFilters || {}).length
  if (filterCount > 0) {
    parts.push(`${filterCount} global filter${filterCount === 1 ? '' : 's'}`)
  }
  if (typeof latestCoordinationResult?.verification?.summary === 'string' && latestCoordinationResult.verification.summary.length > 0) {
    parts.push(latestCoordinationResult.verification.summary)
  }
  return parts.join(' · ') || null
}

function buildSnapshotRef(view = {}) {
  const stateId = view?.stateId || null
  return stateId ? `widgetva-view:${stateId}` : null
}

function summarizeView({ stateSummary = null, view = null } = {}) {
  const refCount = Array.isArray(view?.refs) ? view.refs.length : 0
  if (stateSummary && refCount > 0) return `${stateSummary} · ${refCount} ref${refCount === 1 ? '' : 's'} materialized`
  return stateSummary || null
}

async function buildTurnObserve(caseId, {
  query,
  sessionKnowledge = null,
  previousTurnSummary = null,
  perception = null,
} = {}) {
  const contract = createAgentRuntimeContract(caseId)
  const [observation, view] = await Promise.all([
    Promise.resolve(contract.readObservation?.() || null),
    Promise.resolve(contract.readView?.() || null),
  ])
  const coordination = contract.readCoordinationState?.() || observation?.coordination || null
  const latestCoordinationResult = contract.readLatestCoordinationResult?.() || observation?.latestCoordinationResult || null
  const focusWidgetRef = coordination?.focusedWidgetRef || sessionKnowledge?.widgets?.[0]?.ref || null
  const stateId = observation?.state?.stateId || coordination?.stateId || view?.stateId || null
  const stateSummary = summarizeState({
    coordination,
    latestCoordinationResult,
  })

  return {
    query,
    previousTurnSummary,
    focusWidgetRef,
    state: {
      summary: stateSummary,
      stateId,
      rawRef: stateId,
    },
    view: {
      snapshot: {
        ref: buildSnapshotRef(view || observation?.state || {}),
        mimeType: 'application/widgetva-view+json',
      },
      summary: summarizeView({
        stateSummary,
        view,
      }),
    },
    perception: perception && typeof perception === 'object'
      ? {
        name: perception.name || 'perception',
        resultRef: perception.resultRef || null,
        summary: perception.summary || null,
      }
      : null,
  }
}

function buildAgentMessages({ objective, sessionKnowledge, observe }) {
  const systemPrompt = [
    'You are an analyst agent operating a visual analytics workspace through WidgetVA.',
    'Choose exactly one next step.',
    'Use only the actions, perceptions, or data queries listed in sessionKnowledge.catalogs.',
    'Return JSON only.',
    'The JSON must contain assistantMessage, rationale, and operation.',
    'operation.kind must be exactly one of: action, perception, data_query.',
    'If operation.kind is action or perception, include operation.name.',
    'If possible, include operation.queryScope.widgetRef.',
    'Keep assistantMessage concise and directly tied to the user query.',
  ].join(' ')

  const userPrompt = JSON.stringify({
    objective,
    sessionKnowledge,
    observe,
  })

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
}

function buildAgentRepairMessages({ objective, sessionKnowledge, observe, previousContent = '' }) {
  const systemPrompt = [
    'You previously returned an invalid plan for a visual analytics agent.',
    'Return JSON only.',
    'Your JSON must contain assistantMessage, rationale, and operation.',
    'operation.kind must be exactly one of: action, perception, data_query.',
    'If operation.kind is action or perception, include operation.name.',
    'If possible, include operation.queryScope.widgetRef.',
    'Do not include markdown fences or explanatory prose.',
  ].join(' ')

  const userPrompt = JSON.stringify({
    objective,
    sessionKnowledge,
    observe,
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

async function requestOpenRouterAgentPlan({
  model = DEFAULT_OPENROUTER_VLM,
  objective,
  sessionKnowledge,
  observe,
  messages = null,
}) {
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
        : buildAgentMessages({ objective, sessionKnowledge, observe }),
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

function buildSafeFallbackOperation(observe = {}, sessionKnowledge = {}) {
  const focusedWidgetRef = observe?.focusWidgetRef || sessionKnowledge?.widgets?.[0]?.ref || null
  return {
    assistantMessage: 'I will first inspect the currently focused widget before taking a stronger interaction step.',
    rationale: 'The model response did not yield a valid executable operation, so the runtime is falling back to a safe perception on the active widget.',
    kind: 'perception',
    name: 'perception.inspectViewConfig',
    ...(focusedWidgetRef ? { queryScope: { widgetRef: focusedWidgetRef } } : {}),
    params: {},
    dataRef: null,
    query: null,
  }
}

function normalizeOperation(plan = {}, sessionKnowledge = {}, observe = {}) {
  const operation = readPlannedOperation(plan)
  const widgets = Array.isArray(sessionKnowledge?.widgets) ? sessionKnowledge.widgets : []
  const fallbackWidgetRef = observe?.focusWidgetRef || widgets[0]?.ref || null
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

function deriveExecutionOk(result = {}) {
  if (typeof result?.ok === 'boolean') return result.ok
  if (typeof result?.actionResult?.ok === 'boolean') return result.actionResult.ok
  if (typeof result?.success === 'boolean') return result.success
  return true
}

function deriveResultStateId(result = {}) {
  return result?.actionResult?.stateId || result?.stateId || null
}

function deriveUpdatedRefs(result = {}) {
  if (Array.isArray(result?.actionResult?.updatedRefs)) return result.actionResult.updatedRefs
  if (Array.isArray(result?.updatedRefs)) return result.updatedRefs
  return []
}

function deriveVerificationOk(verification = null) {
  if (!verification || typeof verification !== 'object') return null
  if (typeof verification.ok === 'boolean') return verification.ok
  if (typeof verification?.result?.verified === 'boolean') return verification.result.verified
  if (typeof verification?.result?.passed === 'boolean') return verification.result.passed
  if (typeof verification?.passed === 'boolean') return verification.passed
  return null
}

async function executeOperation(contract, operation) {
  if (operation.kind === 'action') {
    return (
      typeof contract.executeVerifiedAction === 'function'
        ? contract.executeVerifiedAction({
          callId: `agent_action_${Date.now()}`,
          actor: 'agent',
          name: operation.name,
          ...(operation.queryScope ? { queryScope: operation.queryScope } : {}),
          params: operation.params || {},
        })
        : contract.executeAction({
          callId: `agent_action_${Date.now()}`,
          actor: 'agent',
          name: operation.name,
          ...(operation.queryScope ? { queryScope: operation.queryScope } : {}),
          params: operation.params || {},
        })
    )
  }

  if (operation.kind === 'perception') {
    return contract.queryPerception({
      callId: `agent_perception_${Date.now()}`,
      actor: 'agent',
      name: operation.name,
      ...(operation.queryScope ? { queryScope: operation.queryScope } : {}),
      params: operation.params || {},
    })
  }

  if (operation.kind === 'data_query') {
    return contract.runDataQuery({
      callId: `agent_data_${Date.now()}`,
      actor: 'agent',
      dataRef: operation.dataRef,
      query: operation.query,
    })
  }

  throw new Error(`Unsupported planned operation kind: ${operation.kind || 'unknown'}`)
}

async function resolveVerification(contract, operation, result) {
  if (operation.kind !== 'action') return null
  if (result?.verification) return result.verification
  if (!operation.queryScope?.widgetRef) return null
  try {
    return await contract.queryPerception({
      callId: `agent_verify_${Date.now()}`,
      actor: 'agent',
      name: 'perception.verifyActionEffect',
      queryScope: { widgetRef: operation.queryScope.widgetRef },
      params: {
        actionName: operation.name,
        stateId: deriveResultStateId(result) || contract.readObservation?.()?.state?.stateId || null,
        refs: deriveUpdatedRefs(result),
      },
    })
  } catch {
    return null
  }
}

function buildPlanPayload({ objective, operation }) {
  return {
    objective,
    step: {
      kind: operation.kind,
      ...(operation.name ? { name: operation.name } : {}),
      ...(operation.queryScope ? { queryScope: clone(operation.queryScope) } : {}),
      ...(operation.params && Object.keys(operation.params).length > 0 ? { params: clone(operation.params) } : {}),
      ...(operation.dataRef ? { dataRef: operation.dataRef } : {}),
      ...(operation.query ? { query: clone(operation.query) } : {}),
    },
    rationale: operation.rationale || '',
  }
}

function buildActPayload(operation, result) {
  return {
    kind: operation.kind,
    name: operation.name || operation.query?.kind || 'data_query',
    ...(operation.params && Object.keys(operation.params).length > 0 ? { params: clone(operation.params) } : {}),
    ...(operation.queryScope ? { queryScope: clone(operation.queryScope) } : {}),
    ok: deriveExecutionOk(result),
    outputSummary: summarizeResult(result),
    stateId: deriveResultStateId(result),
    updatedRefs: deriveUpdatedRefs(result),
  }
}

function buildVerifyPayload({
  operation,
  act,
  verification = null,
  beforeStateId = null,
  actionUsage = null,
} = {}) {
  const requiredParams = Array.isArray(actionUsage?.requiredParams)
    ? actionUsage.requiredParams.filter((name) => typeof name === 'string' && name.length > 0)
    : []
  const missingRequiredParams = requiredParams.filter((name) => act?.params?.[name] === undefined)
  const verificationOk = deriveVerificationOk(verification)
  const verificationSummary = summarizeResult(verification)

  const stepChoice = (() => {
    if (!act?.ok) {
      return {
        status: 'fail',
        reason: 'The selected step did not execute successfully.',
      }
    }
    if (act.kind === 'perception' || act.kind === 'data_query') {
      return {
        status: 'pass',
        reason: 'The turn executed a read-oriented step and produced an output.',
      }
    }
    return {
      status: 'uncertain',
      reason: 'The action executed, but semantic fit to the user query was not separately judged in this turn.',
    }
  })()

  const params = (() => {
    if (missingRequiredParams.length > 0) {
      return {
        status: 'fail',
        reason: `Missing required params: ${missingRequiredParams.join(', ')}.`,
      }
    }
    if (act?.ok) {
      return {
        status: 'pass',
        reason: 'Runtime accepted the parameters for this step.',
      }
    }
    return {
      status: 'fail',
      reason: 'The runtime rejected this step before parameters could be trusted.',
    }
  })()

  const stateChange = (() => {
    if (act?.kind !== 'action') {
      return {
        status: 'not_applicable',
        reason: 'This turn did not execute a state-mutating action.',
      }
    }
    if (act?.stateId && beforeStateId && act.stateId !== beforeStateId) {
      return {
        status: 'pass',
        reason: `State changed from ${beforeStateId} to ${act.stateId}.`,
      }
    }
    if (!act?.ok) {
      return {
        status: 'fail',
        reason: 'The action did not complete successfully, so no state change can be confirmed.',
      }
    }
    return {
      status: 'uncertain',
      reason: 'The action returned success, but a distinct state transition was not confirmed.',
    }
  })()

  const visualChange = (() => {
    if (act?.kind !== 'action') {
      return {
        status: 'not_applicable',
        reason: 'This turn did not request a visual state change.',
      }
    }
    if (verificationOk === true) {
      return {
        status: 'pass',
        reason: verificationSummary || 'Verification confirmed the expected visible effect.',
      }
    }
    if (verificationOk === false) {
      return {
        status: 'fail',
        reason: verificationSummary || 'Verification reported that the visible effect was not achieved.',
      }
    }
    return {
      status: 'uncertain',
      reason: 'No explicit visual verification result was available for this action.',
    }
  })()

  const ok = Boolean(
    act?.ok
    && params.status !== 'fail'
    && stateChange.status !== 'fail'
    && visualChange.status !== 'fail',
  )

  const summary = ok
    ? (
      visualChange.status === 'pass'
        ? visualChange.reason
        : act?.outputSummary || 'The step executed successfully.'
    )
    : (
      [params.reason, stateChange.reason, visualChange.reason].find((reason) => typeof reason === 'string' && reason.length > 0)
      || 'The step did not verify cleanly.'
    )

  const nextStepHint = (() => {
    if (params.status === 'fail') {
      return {
        kind: operation?.kind === 'action' ? 'action' : 'perception',
        guidance: 'Re-check required parameters before retrying this step.',
      }
    }
    if (visualChange.status === 'uncertain') {
      return {
        kind: 'perception',
        guidance: 'Inspect the current view or verification surface before deciding the next step.',
      }
    }
    if (ok) {
      return {
        kind: 'answer',
        guidance: 'This turn verified cleanly enough to answer unless the query explicitly requires another step.',
      }
    }
    return {
      kind: operation?.kind === 'action' ? 'action' : 'stop',
      guidance: 'Choose a simpler, better-scoped next step based on the current state.',
    }
  })()

  return {
    ok,
    summary,
    checks: {
      stepChoice,
      params,
      stateChange,
      visualChange,
    },
    nextStepHint,
  }
}

function buildReasonPayload({ operation, act, verify }) {
  if (verify?.ok) {
    return {
      answer: operation?.assistantMessage || act?.outputSummary || 'Completed one agent step.',
    }
  }
  return {
    answer: verify?.summary || operation?.assistantMessage || 'The last step did not verify cleanly.',
  }
}

function appendAgentTraceStep(caseId, {
  operation,
  act,
  verify,
  observe,
  sessionKnowledge,
} = {}) {
  const latestCoordination = readLatestCoordinationResult(caseId)
  const widgetRef = operation?.queryScope?.widgetRef || null
  const widgetTitle = sessionKnowledge?.widgets?.find((widget) => widget.ref === widgetRef)?.title || operation?.name || 'Workspace'
  return appendRuntimeTraceStep(caseId, {
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

function mergeSessionKnowledge(previousKnowledge, turns) {
  const base = clone(previousKnowledge) || {}
  base.history = {
    turns: Array.isArray(turns)
      ? turns.map(summarizeHistoryTurn)
      : Array.isArray(previousKnowledge?.history?.turns)
        ? clone(previousKnowledge.history.turns)
        : [],
  }
  return base
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
  const contract = createAgentRuntimeContract(caseId)
  const knowledge = sessionKnowledge || buildAgentSessionKnowledge(caseId) || {
    workspace: { workspaceId: null, caseId },
    widgets: [],
    catalogs: {
      actionsByWidgetRef: {},
      perceptionsByWidgetRef: {},
      dataQueriesByDataRef: {},
    },
    loopHints: null,
    history: { turns: [] },
  }

  const observe = await buildTurnObserve(caseId, {
    query: safeQuery,
    sessionKnowledge: knowledge,
    previousTurnSummary,
    perception,
  })
  const planning = await requestOpenRouterAgentPlan({
    model,
    objective: safeQuery,
    sessionKnowledge: knowledge,
    observe,
  })
  let operation = normalizeOperation(planning.plan, knowledge, observe)
  if (!isExecutableOperation(operation)) {
    const repairedPlanning = await requestOpenRouterAgentPlan({
      model,
      objective: safeQuery,
      sessionKnowledge: knowledge,
      observe,
      messages: buildAgentRepairMessages({
        objective: safeQuery,
        sessionKnowledge: knowledge,
        observe,
        previousContent: planning.content,
      }),
    })
    const repairedOperation = normalizeOperation(repairedPlanning.plan, knowledge, observe)
    if (isExecutableOperation(repairedOperation)) {
      operation = repairedOperation
    } else {
      operation = buildSafeFallbackOperation(observe, knowledge)
    }
  }

  const actionUsage = (
    operation.kind === 'action'
    && operation.queryScope?.widgetRef
    && typeof contract.describeActionUsage === 'function'
  )
    ? await contract.describeActionUsage({
      targetRef: operation.queryScope.widgetRef,
      actionName: operation.name,
    }).catch(() => null)
    : null

  const result = await executeOperation(contract, operation)
  const act = buildActPayload(operation, result)
  const verification = await resolveVerification(contract, operation, result)
  const verify = buildVerifyPayload({
    operation,
    act,
    verification,
    beforeStateId: observe?.state?.stateId || null,
    actionUsage,
  })
  const reason = buildReasonPayload({
    operation,
    act,
    verify,
  })
  const plan = buildPlanPayload({
    objective: safeQuery,
    operation,
  })

  appendAgentMessage(caseId, {
    role: 'user',
    text: safeQuery,
  })
  appendAgentMessage(caseId, {
    role: 'assistant',
    text: reason.answer,
  })

  appendAgentTraceStep(caseId, {
    operation,
    act,
    verify,
    observe,
    sessionKnowledge: knowledge,
  })

  return {
    observe,
    plan,
    act,
    verify,
    reason,
  }
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

  let knowledge = sessionKnowledge || buildAgentSessionKnowledge(caseId)
  const turns = []
  let previousTurnSummary = null
  let previousPerception = null
  let stopReason = 'turn_budget_reached'

  for (let index = 0; index < safeMaxTurns; index += 1) {
    const turn = await runAgentTurn(caseId, {
      objective: safeQuery,
      model,
      sessionKnowledge: knowledge,
      previousTurnSummary,
      perception: previousPerception,
    })
    turns.push(turn)
    knowledge = mergeSessionKnowledge(knowledge, turns)
    previousTurnSummary = summarizeHistoryTurn(turn, index).summary
    previousPerception = turn?.act?.kind === 'perception'
      ? {
        name: turn.act.name,
        summary: turn.act.outputSummary || turn.verify.summary || null,
      }
      : null

    const nextHintKind = turn?.verify?.nextStepHint?.kind || null
    if (nextHintKind === 'answer') {
      stopReason = 'answered'
      break
    }
    if (nextHintKind === 'stop') {
      stopReason = 'stopped'
      break
    }
    if (index === safeMaxTurns - 1) {
      stopReason = 'turn_budget_reached'
    }
  }

  const lastTurn = turns.at(-1) || null
  return {
    ok: Boolean(lastTurn?.verify?.ok),
    answer: lastTurn?.reason?.answer || '',
    stopReason,
    turns,
  }
}

export async function runOpenRouterAgentStep(caseId, options = {}) {
  return runAgentTurn(caseId, options)
}
