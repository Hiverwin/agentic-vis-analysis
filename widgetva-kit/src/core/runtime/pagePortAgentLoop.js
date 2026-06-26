function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
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
  return {
    answer: plan?.assistantMessage || 'Completed one agent loop step.',
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
  const workspacePlan = await readWorkspacePlan(port, planningRequest)
  const planningResult = await resolvePlanningResult({
    planner,
    observe,
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
