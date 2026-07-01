import { buildTurnVerificationFeedback } from './turnVerification.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function summarizeStateForFormalObserve(observation = {}) {
  const coordination = observation?.coordination || null
  const latestCoordinationResult = observation?.latestCoordinationResult || null
  const parts = []
  if (typeof coordination?.focusedWidgetRef === 'string' && coordination.focusedWidgetRef.length > 0) {
    parts.push(`focus ${coordination.focusedWidgetRef}`)
  }
  if (typeof coordination?.selections?.views?.primary?.summary === 'string' && coordination.selections.views.primary.summary.length > 0) {
    parts.push(coordination.selections.views.primary.summary)
  }
  if (typeof latestCoordinationResult?.verification?.summary === 'string' && latestCoordinationResult.verification.summary.length > 0) {
    parts.push(latestCoordinationResult.verification.summary)
  }
  return parts.join(' · ') || null
}

function buildObserveSharedAnalyticalState(observation = {}) {
  const shared = observation?.sharedAnalyticalState || {}
  const primarySelection = shared?.selections?.primary || null
  const highlight = shared?.highlight || null
  const activeAnalyticalContext = shared?.activeAnalyticalContext || {}
  const sharedTransformationContext = shared?.sharedTransformationContext || {}
  const sharedViewContext = shared?.sharedViewContext || {}
  return {
    filters: clone(shared?.filters || {}),
    viewport: clone(shared?.viewport || null),
    focus: {
      widgetRef: shared?.focusedWidgetRef || null,
      selectionSummary: primarySelection?.summary || null,
      highlightedWidgetRefs: Array.isArray(highlight?.activeWidgetRefs) ? [...highlight.activeWidgetRefs] : [],
    },
    activeContextKinds: Array.isArray(activeAnalyticalContext?.activeContextKinds)
      ? [...activeAnalyticalContext.activeContextKinds]
      : [],
    comparisonTargets: Array.isArray(shared?.comparisonTargets) ? [...shared.comparisonTargets] : [],
    structure: {
      annotationCount: Array.isArray(shared?.annotations) ? shared.annotations.length : 0,
      linkCount: Array.isArray(shared?.links?.definitions) ? shared.links.definitions.length : 0,
    },
    sharedView: {
      activeWidgetRefs: Array.isArray(sharedViewContext?.activeWidgetRefs)
        ? [...sharedViewContext.activeWidgetRefs]
        : [],
    },
    transformation: {
      activeWidgetRefs: Array.isArray(sharedTransformationContext?.activeWidgetRefs)
        ? [...sharedTransformationContext.activeWidgetRefs]
        : [],
      widgets: clone(sharedTransformationContext?.widgets || {}),
    },
  }
}

function deriveFormalActOk(result = {}) {
  if (typeof result?.actionResult?.ok === 'boolean') return result.actionResult.ok
  if (typeof result?.ok === 'boolean') return result.ok
  if (typeof result?.success === 'boolean') return result.success
  return true
}

function deriveFormalStateId(result = {}) {
  return result?.actionResult?.stateId || result?.stateId || null
}

function deriveFormalUpdatedRefs(result = {}) {
  if (Array.isArray(result?.actionResult?.updatedRefs)) return result.actionResult.updatedRefs
  if (Array.isArray(result?.updatedRefs)) return result.updatedRefs
  return []
}

function deriveFormalVerificationOk(verification = null) {
  if (!verification || typeof verification !== 'object') return null
  if (typeof verification.ok === 'boolean') return verification.ok
  if (typeof verification?.result?.verified === 'boolean') return verification.result.verified
  if (typeof verification?.result?.passed === 'boolean') return verification.result.passed
  if (typeof verification?.passed === 'boolean') return verification.passed
  return null
}

function summarizeFormalRuntimePayload(payload = null) {
  if (!payload || typeof payload !== 'object') return null
  if (typeof payload.summary === 'string' && payload.summary.length > 0) return payload.summary
  if (typeof payload.message === 'string' && payload.message.length > 0) return payload.message
  if (typeof payload.result === 'string' && payload.result.length > 0) return payload.result
  if (payload?.result && typeof payload.result === 'object') {
    return JSON.stringify(payload.result).slice(0, 220)
  }
  return null
}

function readRequiredParamsForOperation(plan = {}) {
  const actionName = plan?.operation?.name || null
  const actions = Array.isArray(plan?.actionUsage?.actions) ? plan.actionUsage.actions : []
  const matched = actions.find((entry) => entry?.name === actionName) || null
  return Array.isArray(matched?.requiredParams) ? matched.requiredParams : []
}

function isOperationConfirmedByUsage(plan = {}) {
  const actionName = plan?.operation?.name || null
  const actions = Array.isArray(plan?.actionUsage?.actions) ? plan.actionUsage.actions : []
  if (!actionName) return null
  if (Array.isArray(plan?.actionUsage?.actions) && actions.length === 0) return false
  return actions.some((entry) => entry?.name === actionName)
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeQueryScope(call = {}, fallbackWidgetRef = null) {
  const queryScope = isPlainObject(call?.queryScope) ? { ...call.queryScope } : {}
  const widgetRef = call?.targetRef || queryScope.widgetRef || fallbackWidgetRef || null
  if (widgetRef && !queryScope.widgetRef) {
    queryScope.widgetRef = widgetRef
  }
  return Object.keys(queryScope).length > 0 ? queryScope : null
}

function normalizeOperation(operation = {}, { fallbackWidgetRef = null } = {}) {
  if (!isPlainObject(operation)) return null
  const queryScope = normalizeQueryScope(operation, fallbackWidgetRef)
  const normalized = {
    ...operation,
  }
  if (queryScope) {
    normalized.queryScope = queryScope
  }
  return normalized
}

function buildActionCall(operation = {}, {
  callId = 'agent_step_action',
  actor = 'agent',
} = {}) {
  const queryScope = normalizeQueryScope(operation)
  return {
    callId,
    name: operation.name,
    actor,
    ...(queryScope ? { queryScope } : {}),
    params: clone(operation.params || {}),
  }
}

function buildVerificationCall(actionCall = {}, result = {}) {
  const queryScope = normalizeQueryScope(actionCall)
  const stateId = result?.actionResult?.stateId || result?.stateId || null
  const refs = Array.isArray(result?.actionResult?.updatedRefs)
    ? result.actionResult.updatedRefs
    : Array.isArray(result?.updatedRefs)
      ? result.updatedRefs
      : []

  return {
    callId: `${actionCall.callId || 'agent_step_action'}_verify`,
    name: 'perception.verifyActionEffect',
    actor: actionCall.actor || 'agent',
    ...(queryScope ? { queryScope } : {}),
    params: {
      actionName: actionCall.name || null,
      stateId,
      refs,
    },
  }
}

async function maybeInvoke(port, methodName, ...args) {
  if (typeof port?.[methodName] !== 'function') return null
  return port[methodName](...args)
}

function resolveMethod(port, methodNames = []) {
  for (const methodName of methodNames) {
    if (typeof port?.[methodName] === 'function') {
      return port[methodName].bind(port)
    }
  }
  return null
}

async function readObserveStage(port, {
  workspaceOptions = {},
  loopOptions = {},
  observationOptions = {},
} = {}) {
  const [workspace, loopContext, observation] = await Promise.all([
    port.describeWorkspace(workspaceOptions),
    port.describeAgentLoop(loopOptions),
    maybeInvoke(port, 'readObservation', observationOptions),
  ])

  return {
    workspace,
    loopContext,
    observation,
  }
}

async function readKnowledgeCatalogs(port) {
  const [availableActions, availablePerceptions, availableDataQueries] = await Promise.all([
    maybeInvoke(port, 'listAvailableActions'),
    maybeInvoke(port, 'listAvailablePerceptions'),
    maybeInvoke(port, 'listAvailableDataQueries'),
  ])

  return {
    availableActions: Array.isArray(availableActions) ? availableActions : [],
    availablePerceptions: Array.isArray(availablePerceptions) ? availablePerceptions : [],
    availableDataQueries: Array.isArray(availableDataQueries) ? availableDataQueries : [],
  }
}

function buildActionCatalogByWidgetRef(widgets = [], availableActions = []) {
  const catalog = {}
  for (const widget of Array.isArray(widgets) ? widgets : []) {
    const widgetRef = widget?.ref || null
    if (!widgetRef) continue
    catalog[widgetRef] = (Array.isArray(availableActions) ? availableActions : [])
      .filter((entry) => (entry?.targetRef || entry?.queryScope?.widgetRef || null) === widgetRef || entry?.targetRef == null)
      .map((entry) => entry?.name)
      .filter((name, index, names) => typeof name === 'string' && names.indexOf(name) === index)
  }
  return catalog
}

function buildPerceptionCatalogByWidgetRef(widgets = [], availablePerceptions = []) {
  const catalog = {}
  for (const widget of Array.isArray(widgets) ? widgets : []) {
    const widgetRef = widget?.ref || null
    if (!widgetRef) continue
    catalog[widgetRef] = (Array.isArray(availablePerceptions) ? availablePerceptions : [])
      .filter((entry) => (entry?.targetRef || entry?.queryScope?.widgetRef || null) === widgetRef || entry?.targetRef == null)
      .map((entry) => entry?.name)
      .filter((name, index, names) => typeof name === 'string' && names.indexOf(name) === index)
  }
  return catalog
}

function buildDataQueryCatalogByDataRef(workspace = {}, availableDataQueries = []) {
  const explicitCatalog = {}
  for (const entry of Array.isArray(availableDataQueries) ? availableDataQueries : []) {
    const dataRef = entry?.dataRef || null
    const queryKind = entry?.queryKind || entry?.name || null
    if (!dataRef || typeof queryKind !== 'string' || queryKind.length === 0) continue
    const names = explicitCatalog[dataRef] || new Set()
    names.add(queryKind)
    explicitCatalog[dataRef] = names
  }

  if (Object.keys(explicitCatalog).length > 0) {
    return Object.fromEntries(
      Object.entries(explicitCatalog).map(([dataRef, names]) => [dataRef, Array.from(names)]),
    )
  }

  return Object.fromEntries(
    (Array.isArray(workspace?.dataHandles) ? workspace.dataHandles : [])
      .filter((handle) => typeof handle?.ref === 'string' && handle.ref.length > 0)
      .map((handle) => [
        handle.ref,
        Array.isArray(handle?.supportedQueryDescriptors)
          ? handle.supportedQueryDescriptors
            .map((descriptor) => descriptor?.name)
            .filter((name, index, names) => typeof name === 'string' && name.length > 0 && names.indexOf(name) === index)
          : [],
      ]),
  )
}

async function readWorkspacePlan(port, planningRequest = null) {
  const planWorkspace = resolveMethod(port, ['planWorkspace'])
  if (!planningRequest || typeof planWorkspace !== 'function') {
    return null
  }
  return planWorkspace(planningRequest)
}

async function readActionUsage(port, operation = null) {
  if (!operation || operation.kind !== 'action' || typeof port?.describeActionUsage !== 'function') {
    return null
  }

  const targetRef = operation?.queryScope?.widgetRef || operation?.targetRef || null
  if (!targetRef || typeof operation?.name !== 'string' || operation.name.length === 0) {
    return null
  }

  return port.describeActionUsage({
    targetRef,
    actionName: operation.name,
  })
}

function defaultReasoner({ plan, result, verification, latestCoordinationResult }) {
  const actionApplied = Boolean(result?.actionResult?.ok ?? result?.ok ?? result?.success ?? false)
  const verificationPassed = Boolean(
    verification?.ok
    ?? verification?.result?.passed
    ?? result?.verification?.ok
    ?? false,
  )
  const operationKind = plan?.operation?.kind || null
  const runtimeSummary = summarizeFormalRuntimePayload(result)
  return {
    answer:
      operationKind === 'perception' || operationKind === 'data_query'
        ? runtimeSummary || plan?.assistantMessage || 'Completed one agent loop step.'
        : plan?.assistantMessage || runtimeSummary || 'Completed one agent loop step.',
    rationale: plan?.rationale || '',
    success: actionApplied,
    verificationPassed,
    latestCoordinationResult: clone(latestCoordinationResult),
  }
}

function buildPlanStage({
  objective = null,
  workspacePlan = null,
  planningResult = null,
  operation = null,
  actionUsage = null,
} = {}) {
  return {
    objective,
    workspacePlan: clone(workspacePlan),
    assistantMessage: planningResult?.assistantMessage || '',
    rationale: planningResult?.rationale || '',
    operation: clone(operation),
    actionUsage: clone(actionUsage),
    rawPlan: clone(planningResult),
  }
}

async function resolvePlanningResult({
  planner,
  observe,
  knowledge = null,
  workspacePlan,
  objective = null,
  operation = null,
  actor = 'agent',
} = {}) {
  if (operation) {
    return {
      assistantMessage: '',
      rationale: '',
      operation: normalizeOperation(operation),
      actor,
      source: 'provided_operation',
    }
  }

  if (typeof planner !== 'function') {
    throw new Error('runPagePortAgentLoop requires either operation or planner.')
  }

  const planningResult = await planner({
    objective,
    observe: clone(observe),
    knowledge: clone(knowledge),
    workspacePlan: clone(workspacePlan),
    actor,
  })

  if (!isPlainObject(planningResult)) {
    throw new Error('planner must return an object containing operation.')
  }

  const normalizedOperation = normalizeOperation(planningResult.operation)
  if (!normalizedOperation) {
    throw new Error('planner must return a valid operation object.')
  }

  return {
    ...planningResult,
    operation: normalizedOperation,
    actor: planningResult.actor || actor,
    source: planningResult.source || 'planner',
  }
}

async function executeOperation(port, operation, { actor = 'agent', callId = 'agent_step_action' } = {}) {
  if (!operation || typeof operation.kind !== 'string') {
    throw new Error('executeOperation requires an operation with kind.')
  }

  if (operation.kind === 'action') {
    const actionCall = buildActionCall(operation, { callId, actor })
    const runVerifiedAction = resolveMethod(port, ['executeVerifiedAction', 'runVerifiedAction'])
    if (typeof runVerifiedAction === 'function') {
      const verifiedResult = await runVerifiedAction(actionCall, {})
      return {
        executionKind: 'verified_action',
        actionCall,
        result: verifiedResult,
      }
    }
    const executeAction = resolveMethod(port, ['executeAction', 'runAction'])
    if (typeof executeAction !== 'function') {
      throw new Error('Page port does not expose executeAction() or executeVerifiedAction().')
    }
    const actionResult = await executeAction(actionCall)
    return {
      executionKind: 'action',
      actionCall,
      result: actionResult,
    }
  }

  if (operation.kind === 'perception') {
    const queryPerception = resolveMethod(port, ['queryPerception'])
    if (typeof queryPerception !== 'function') {
      throw new Error('Page port does not expose queryPerception().')
    }
    const call = {
      callId,
      name: operation.name,
      actor,
      ...(operation.queryScope ? { queryScope: clone(operation.queryScope) } : {}),
      params: clone(operation.params || {}),
    }
    return {
      executionKind: 'perception',
      actionCall: call,
      result: await queryPerception(call),
    }
  }

  if (operation.kind === 'data_query') {
    const runDataQuery = resolveMethod(port, ['runDataQuery', 'queryData'])
    if (typeof runDataQuery !== 'function') {
      throw new Error('Page port does not expose runDataQuery().')
    }
    const call = {
      callId,
      actor,
      dataRef: operation.dataRef || null,
      query: clone(operation.query || {}),
    }
    return {
      executionKind: 'data_query',
      actionCall: call,
      result: await runDataQuery(call),
    }
  }

  throw new Error(`Unsupported operation kind: ${operation.kind}`)
}

async function verifyOperation(port, execution = null, { verify = true } = {}) {
  if (
    !verify
    || !execution
    || (execution.executionKind !== 'action' && execution.executionKind !== 'verified_action')
  ) {
    return null
  }

  const resultVerification = execution?.result?.verification
  if (resultVerification) {
    return resultVerification
  }

  const queryPerception = resolveMethod(port, ['queryPerception'])
  if (typeof queryPerception !== 'function') {
    return null
  }

  const verifyCall = buildVerificationCall(execution.actionCall, execution.result)
  return queryPerception(verifyCall)
}

export async function runPagePortAgentLoop(port, options = {}) {
  if (!port || typeof port !== 'object') {
    throw new Error('runPagePortAgentLoop requires a page port object.')
  }
  if (typeof port.describeWorkspace !== 'function') {
    throw new Error('runPagePortAgentLoop requires pagePort.describeWorkspace().')
  }
  if (typeof port.describeAgentLoop !== 'function') {
    throw new Error('runPagePortAgentLoop requires pagePort.describeAgentLoop().')
  }

  const {
    objective = null,
    planner = null,
    reasoner = defaultReasoner,
    operation = null,
    planningRequest = null,
    verify = true,
    workspaceOptions = {},
    loopOptions = {},
    observationOptions = {},
    callId = 'agent_step_action',
    actor = 'agent',
  } = options

  const observe = await readObserveStage(port, {
    workspaceOptions,
    loopOptions,
    observationOptions,
  })
  const knowledgeCatalogs = await readKnowledgeCatalogs(port)
  const workspacePlan = await readWorkspacePlan(port, planningRequest)
  const baseKnowledge = buildSessionKnowledge({
    observeStage: {
      ...observe,
      knowledgeCatalogs,
    },
    turns: [],
  })
  const knowledge = mergeSessionKnowledge(
    options?.sessionKnowledge || baseKnowledge,
    options?.sessionTurns || [],
  )
  const planningResult = await resolvePlanningResult({
    planner,
    observe,
    knowledge,
    workspacePlan,
    objective,
    operation,
    actor,
  })
  const actionUsage = await readActionUsage(port, planningResult.operation)
  const plan = buildPlanStage({
    objective,
    workspacePlan,
    planningResult,
    operation: planningResult.operation,
    actionUsage,
  })
  const execution = await executeOperation(port, planningResult.operation, {
    actor: planningResult.actor || actor,
    callId,
  })
  const verification = await verifyOperation(port, execution, { verify })
  const latestCoordinationResult = await maybeInvoke(port, 'readLatestCoordinationResult')
  const reason = await reasoner({
    objective,
    observe: clone(observe),
    plan: clone(plan),
    result: clone(execution.result),
    verification: clone(verification),
    latestCoordinationResult: clone(latestCoordinationResult),
  })

  return {
    observe,
    plan,
    result: execution.result,
    verification,
    reason,
    latestCoordinationResult,
  }
}

function buildFormalObservePayload(baseObserve = {}, {
  objective = null,
  previousTurnSummary = null,
  perception = null,
} = {}) {
  const observation = baseObserve?.observation || {}
  const state = observation?.state || null
  const stateSummary = summarizeStateForFormalObserve(observation)
  const sharedAnalyticalState = buildObserveSharedAnalyticalState(observation)
  return {
    query: objective,
    previousTurnSummary,
    state: {
      stateId: state?.stateId || null,
      summary: stateSummary,
      sharedAnalyticalState,
    },
    view: {
      snapshot: state?.stateId
        ? {
          ref: `widgetva-view:${state.stateId}`,
          mimeType: 'application/widgetva-view+json',
        }
        : null,
      summary: stateSummary,
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

function buildFormalPlanPayload(plan = {}) {
  const operation = plan?.operation || {}
  return {
    objective: plan?.objective || null,
    step: {
      kind: operation.kind,
      ...(operation.name ? { name: operation.name } : {}),
      ...(operation.queryScope ? { queryScope: clone(operation.queryScope) } : {}),
      ...(operation.params && Object.keys(operation.params).length > 0 ? { params: clone(operation.params) } : {}),
      ...(operation.dataRef ? { dataRef: operation.dataRef } : {}),
      ...(operation.query ? { query: clone(operation.query) } : {}),
    },
    rationale: plan?.rationale || '',
  }
}

function buildFormalActPayload(plan = {}, result = {}) {
  const operation = plan?.operation || {}
  return {
    kind: operation.kind,
    name: operation.name || operation.query?.kind || 'data_query',
    ...(operation.params && Object.keys(operation.params).length > 0 ? { params: clone(operation.params) } : {}),
    ...(operation.queryScope ? { queryScope: clone(operation.queryScope) } : {}),
    ok: deriveFormalActOk(result),
    outputSummary: summarizeFormalRuntimePayload(result),
    stateId: deriveFormalStateId(result),
    updatedRefs: deriveFormalUpdatedRefs(result),
  }
}

function buildFormalVerifyPayload({ plan = {}, act = null, verification = null, observe = null } = {}) {
  const operation = plan?.operation || {}
  const beforeStateId = observe?.observation?.state?.stateId || null
  const verificationOk = deriveFormalVerificationOk(verification)
  const verificationSummary = summarizeFormalRuntimePayload(verification)
  const requiredParams = readRequiredParamsForOperation(plan)
  const providedParams = isPlainObject(plan?.operation?.params) ? plan.operation.params : {}
  const usageConfirmation = isOperationConfirmedByUsage(plan)
  return buildTurnVerificationFeedback({
    operationKind: operation?.kind || null,
    act,
    beforeStateId,
    requiredParams,
    providedParams,
    usageConfirmed: usageConfirmation,
    verificationOk,
    verificationSummary,
  })
}

function buildFormalReasonPayload(baseReason = {}, { act = null, verify = null, plan = null } = {}) {
  const prefersRuntimeSummary = act?.kind === 'perception' || act?.kind === 'data_query'
  if (verify?.ok) {
    const assistantText = baseReason?.answer || plan?.assistantMessage || null
    const runtimeText = act?.outputSummary || null
    return {
      answer: prefersRuntimeSummary
        ? [assistantText, runtimeText].filter((part, index, array) => typeof part === 'string' && part.length > 0 && array.indexOf(part) === index).join(' ')
          || 'Completed one agent loop step.'
        : assistantText || runtimeText || 'Completed one agent loop step.',
    }
  }
  return {
    answer: verify?.summary || baseReason?.answer || plan?.assistantMessage || 'The last step did not verify cleanly.',
  }
}

export async function runPagePortAgentTurn(port, options = {}) {
  const base = await runPagePortAgentLoop(port, options)
  const observe = buildFormalObservePayload(base.observe, {
    objective: options?.objective || null,
    previousTurnSummary: options?.previousTurnSummary || null,
    perception: options?.perception || null,
  })
  const plan = buildFormalPlanPayload(base.plan)
  const act = buildFormalActPayload(base.plan, base.result)
  const verify = buildFormalVerifyPayload({
    plan: base.plan,
    act,
    verification: base.verification,
    observe: base.observe,
  })
  const reason = buildFormalReasonPayload(base.reason, {
    act,
    verify,
    plan: base.plan,
  })

  return {
    observe,
    plan,
    act,
    verify,
    reason,
  }
}

function summarizeTurnForSession(turn = {}, index = 0) {
  const actKind = turn?.act?.kind || null
  const actName = turn?.act?.name || null
  const verifyOk = typeof turn?.verify?.ok === 'boolean' ? turn.verify.ok : null
  const outputSummary = typeof turn?.act?.outputSummary === 'string' && turn.act.outputSummary.length > 0
    ? turn.act.outputSummary
    : null
  const verificationSummary = typeof turn?.verify?.summary === 'string' && turn.verify.summary.length > 0
    ? turn.verify.summary
    : null

  if ((actKind === 'perception' || actKind === 'data_query') && outputSummary) {
    return {
      turnId: `turn_${index + 1}`,
      summary: outputSummary,
    }
  }

  if (actKind === 'action' && actName) {
    const status = verifyOk === true
      ? 'verified'
      : verifyOk === false
        ? 'needs_retry'
        : 'executed'
    return {
      turnId: `turn_${index + 1}`,
      summary: `${actName}:${status}`,
    }
  }

  if (verificationSummary) {
    return {
      turnId: `turn_${index + 1}`,
      summary: verificationSummary,
    }
  }

  return {
    turnId: `turn_${index + 1}`,
    summary: 'Completed one agent turn.',
  }
}

function mergeSessionKnowledge(previousKnowledge, turns = []) {
  const base = clone(previousKnowledge) || {
    workspace: {
      workspaceId: null,
      caseId: null,
    },
    widgets: [],
    catalogs: {
      actionsByWidgetRef: {},
      perceptionsByWidgetRef: {},
    },
  }

  return {
    ...base,
    history: {
      turns: Array.isArray(turns)
        ? turns.map((turn, index) => summarizeTurnForSession(turn, index))
        : [],
    },
  }
}

function buildPerceptionCarry(turn = null) {
  if (turn?.act?.kind !== 'perception') return null
  return {
    name: turn.act.name || 'perception',
    resultRef: null,
    summary: turn.act.outputSummary || turn.verify?.summary || null,
  }
}

function shouldStopAgentSession(turn = null) {
  if (!turn || typeof turn !== 'object') return null

  if (turn?.act?.kind === 'perception' || turn?.act?.kind === 'data_query') {
    if (turn?.verify?.ok === true) {
      return 'answered'
    }
    if (turn?.verify?.ok === false) {
      return 'stopped'
    }
  }

  if (turn?.act?.kind === 'action' && turn?.act?.ok === false) {
    return 'stopped'
  }

  return null
}

function buildSessionKnowledge({ observeStage = null, turns = [] } = {}) {
  const workspace = observeStage?.workspace || {}
  const widgets = Array.isArray(workspace?.widgets) ? workspace.widgets : []
  const knowledgeCatalogs = observeStage?.knowledgeCatalogs || {}
  const availableActions = Array.isArray(knowledgeCatalogs?.availableActions) ? knowledgeCatalogs.availableActions : []
  const availablePerceptions = Array.isArray(knowledgeCatalogs?.availablePerceptions) ? knowledgeCatalogs.availablePerceptions : []
  const availableDataQueries = Array.isArray(knowledgeCatalogs?.availableDataQueries) ? knowledgeCatalogs.availableDataQueries : []
  const dataQueriesByDataRef = buildDataQueryCatalogByDataRef(workspace, availableDataQueries)

  const workspaceKnowledge = {
    workspaceId: workspace?.workspaceId || null,
  }
  if (workspace?.caseId != null) {
    workspaceKnowledge.caseId = workspace.caseId
  }

  return {
    workspace: workspaceKnowledge,
    widgets: widgets.map((widget) => ({
      ref: widget?.ref || null,
      widgetId: widget?.widgetId || null,
      kind: widget?.kind || null,
      title: widget?.title || null,
      ...(widget?.provider != null ? { provider: widget.provider } : {}),
    })),
    catalogs: {
      actionsByWidgetRef: buildActionCatalogByWidgetRef(widgets, availableActions),
      perceptionsByWidgetRef: buildPerceptionCatalogByWidgetRef(widgets, availablePerceptions),
      ...(Object.keys(dataQueriesByDataRef).length > 0 ? { dataQueriesByDataRef } : {}),
    },
    history: mergeSessionKnowledge(null, turns).history,
  }
}

export async function runPagePortAgentSession(port, options = {}) {
  const {
    objective = null,
    maxTurns = 3,
  } = options

  const safeMaxTurns = Number.isFinite(maxTurns) && maxTurns > 0
    ? Math.max(1, Math.floor(maxTurns))
    : 3

  const turns = []
  let knowledge = buildSessionKnowledge({
    observeStage: {
      workspace: await port.describeWorkspace(options.workspaceOptions || {}),
      knowledgeCatalogs: await readKnowledgeCatalogs(port),
    },
    turns: [],
  })
  let previousTurnSummary = null
  let previousPerception = null
  let stopReason = 'turn_budget_reached'

  for (let index = 0; index < safeMaxTurns; index += 1) {
    const turn = await runPagePortAgentTurn(port, {
      ...options,
      objective,
      previousTurnSummary,
      perception: previousPerception,
      sessionKnowledge: knowledge,
      sessionTurns: turns,
      callId: `agent_step_${index + 1}`,
    })
    turns.push(turn)
    knowledge = mergeSessionKnowledge(knowledge, turns)

    previousTurnSummary = summarizeTurnForSession(turn, index).summary
    previousPerception = buildPerceptionCarry(turn)

    const resolvedStopReason = shouldStopAgentSession(turn)
    if (resolvedStopReason) {
      stopReason = resolvedStopReason
      break
    }
    if (index === safeMaxTurns - 1) {
      stopReason = 'turn_budget_reached'
    }
  }

  const lastTurn = turns.at(-1) || null
  return {
    objective: objective || null,
    ok: Boolean(lastTurn?.verify?.ok),
    answer: lastTurn?.reason?.answer || '',
    stopReason,
    knowledge: knowledge || buildSessionKnowledge({
      turns,
    }),
    turns,
  }
}
