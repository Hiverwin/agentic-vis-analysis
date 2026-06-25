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

function buildFormalObservePayload(baseObserve = {}, {
  objective = null,
  previousTurnSummary = null,
  perception = null,
} = {}) {
  const observation = baseObserve?.observation || {}
  const coordination = observation?.coordination || null
  const state = observation?.state || null
  const stateSummary = summarizeStateForFormalObserve(observation)
  return {
    query: objective,
    previousTurnSummary,
    focusWidgetRef: coordination?.focusedWidgetRef || null,
    state: {
      summary: stateSummary,
      stateId: state?.stateId || null,
      rawRef: state?.stateId || null,
    },
    view: {
      snapshot: {
        ref: state?.stateId ? `widgetva-view:${state.stateId}` : null,
        mimeType: 'application/widgetva-view+json',
      },
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

  const stepChoice = act?.ok
    ? {
      status: act?.kind === 'action' ? 'uncertain' : 'pass',
      reason: act?.kind === 'action'
        ? 'The action executed, but semantic fit to the user query was not separately judged in this turn.'
        : 'The turn executed a read-oriented step and produced an output.',
    }
    : {
      status: 'fail',
      reason: 'The selected step did not execute successfully.',
    }

  const params = act?.ok
    ? {
      status: 'pass',
      reason: 'Runtime accepted the parameters for this step.',
    }
    : {
      status: 'fail',
      reason: 'The runtime rejected this step before parameters could be trusted.',
    }

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

  return {
    ok,
    summary: ok
      ? (visualChange.status === 'pass' ? visualChange.reason : act?.outputSummary || 'The step executed successfully.')
      : ([params.reason, stateChange.reason, visualChange.reason].find(Boolean) || 'The step did not verify cleanly.'),
    checks: {
      stepChoice,
      params,
      stateChange,
      visualChange,
    },
    nextStepHint: params.status === 'fail'
      ? {
        kind: operation?.kind === 'action' ? 'action' : 'perception',
        guidance: 'Re-check required parameters before retrying this step.',
      }
      : visualChange.status === 'uncertain'
        ? {
          kind: 'perception',
          guidance: 'Inspect the current view or verification surface before deciding the next step.',
        }
        : ok
          ? {
            kind: 'answer',
            guidance: 'This turn verified cleanly enough to answer unless the query explicitly requires another step.',
          }
          : {
            kind: operation?.kind === 'action' ? 'action' : 'stop',
            guidance: 'Choose a simpler, better-scoped next step based on the current state.',
          },
  }
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
  return {
    turnId: `turn_${index + 1}`,
    summary:
      turn?.reason?.answer
      || turn?.verify?.summary
      || turn?.act?.outputSummary
      || 'Completed one agent turn.',
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

export async function runPagePortAgentSession(port, options = {}) {
  const {
    objective = null,
    maxTurns = 3,
  } = options

  const safeMaxTurns = Number.isFinite(maxTurns) && maxTurns > 0
    ? Math.max(1, Math.floor(maxTurns))
    : 3

  const turns = []
  let previousTurnSummary = null
  let previousPerception = null
  let stopReason = 'turn_budget_reached'

  for (let index = 0; index < safeMaxTurns; index += 1) {
    const turn = await runPagePortAgentTurn(port, {
      ...options,
      objective,
      previousTurnSummary,
      perception: previousPerception,
      callId: `agent_step_${index + 1}`,
    })
    turns.push(turn)

    previousTurnSummary = summarizeTurnForSession(turn, index).summary
    previousPerception = buildPerceptionCarry(turn)

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
    objective: objective || null,
    ok: Boolean(lastTurn?.verify?.ok),
    answer: lastTurn?.reason?.answer || '',
    stopReason,
    turns,
  }
}
