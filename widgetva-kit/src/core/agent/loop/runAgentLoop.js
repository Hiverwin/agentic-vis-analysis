import { cloneJsonValue as clone } from '../../../shared/clone.js'
import {
  buildAgentKnowledge,
  buildAgentObservation,
  mergeSessionHistory,
  projectPlannerKnowledge,
  shouldStopAgentSession,
} from '../context/index.js'
import {
  buildFormalActPayload,
  buildFormalPlanPayload,
  buildFormalReasonPayload,
  buildFormalVerifyPayload,
  summarizeFormalRuntimePayload,
} from '../contracts/turnPayloads.js'

const COMPACT_OBSERVATION_DROP_KEYS = new Set([
  'bodyText',
  'bodyTextHint',
  'bodyTextPreview',
  'fullRows',
  'marks',
  'pageText',
  'rawCode',
  'rawRows',
  'rawSpec',
  'row',
  'rowCount',
  'rows',
  'snapshot',
  'source',
  'sourceCode',
  'spec',
])

function compactArrayForTurn(value = [], key = null) {
  const limit = key === 'cells' ? 64 : key === 'widgets' ? 24 : key === 'fields' ? 32 : 16
  return value.slice(0, limit).map((entry) => compactValueForTurn(entry))
}

function compactValueForTurn(value, key = null) {
  if (Array.isArray(value)) return compactArrayForTurn(value, key)
  if (!value || typeof value !== 'object') return value
  const next = {}
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (COMPACT_OBSERVATION_DROP_KEYS.has(entryKey)) continue
    next[entryKey] = compactValueForTurn(entryValue, entryKey)
  }
  return next
}

function compactMatrixForTurn(matrix = null) {
  if (!matrix || typeof matrix !== 'object' || Array.isArray(matrix)) return matrix
  return {
    provider: matrix.provider || null,
    kind: matrix.kind || null,
    cellCount: Number.isFinite(matrix.cellCount) ? matrix.cellCount : null,
    cells: (Array.isArray(matrix.cells) ? matrix.cells : [])
      .slice(0, 64)
      .map((cell) => ({
        ref: cell?.ref || null,
        xField: cell?.xField || null,
        yField: cell?.yField || null,
        xDomain: Array.isArray(cell?.xDomain) ? [...cell.xDomain] : null,
        yDomain: Array.isArray(cell?.yDomain) ? [...cell.yDomain] : null,
      }))
      .filter((cell) => cell.ref),
    currentBrush: matrix.currentBrush ? compactValueForTurn(matrix.currentBrush) : null,
    summary: matrix.summary || null,
  }
}

function compactObservationForTurn(observe = null) {
  const snapshotRef =
    typeof observe?.view?.snapshot?.ref === 'string' && observe.view.snapshot.ref.length > 0
      ? observe.view.snapshot.ref
      : null
  const snapshotMimeType =
    typeof observe?.view?.snapshot?.mimeType === 'string' && observe.view.snapshot.mimeType.length > 0
      ? observe.view.snapshot.mimeType
      : null
  const compact = compactValueForTurn(clone(observe))
  if (compact?.state?.matrix) compact.state.matrix = compactMatrixForTurn(compact.state.matrix)
  if (compact?.matrix) compact.matrix = compactMatrixForTurn(compact.matrix)
  if (compact?.view && typeof compact.view === 'object') {
    if (snapshotRef) {
      compact.view.snapshot = {
        ref: snapshotRef,
        ...(snapshotMimeType ? { mimeType: snapshotMimeType } : {}),
      }
    } else {
      delete compact.view.snapshot
    }
  }
  return compact
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value.length > 0))]
}

function readWidgetKindsFromObservation(observation = {}) {
  const widgets = Array.isArray(observation?.state?.widgets) ? observation.state.widgets : []
  return uniqueStrings(widgets.flatMap((widget) => {
    const recognizedKinds = Array.isArray(widget?.recognizedKinds) ? widget.recognizedKinds : []
    return recognizedKinds.length > 0 ? recognizedKinds : [widget?.kind]
  }))
}

function normalizeQueryScope(call = {}, fallbackWidgetRef = null) {
  const rawQueryScope = isPlainObject(call?.queryScope) ? call.queryScope : {}
  const {
    widgetRef: _removedWidgetRef,
    widget_ref: _removedWidgetRefSnake,
    ...queryScope
  } = rawQueryScope
  return Object.keys(queryScope).length > 0 ? queryScope : null
}

function normalizeTarget(call = {}, fallbackWidgetRef = null) {
  const target = isPlainObject(call?.target) ? { ...call.target } : {}
  const widgetRef = target.widgetRef || call?.targetRef || fallbackWidgetRef || null
  if (widgetRef && !target.widgetRef) {
    target.widgetRef = widgetRef
  }
  return Object.keys(target).length > 0 ? target : null
}

function normalizeOperation(operation = {}, { fallbackWidgetRef = null } = {}) {
  if (!isPlainObject(operation)) return null
  const queryScope = normalizeQueryScope(operation, fallbackWidgetRef)
  const target = normalizeTarget(operation, fallbackWidgetRef || null)
  const normalized = {
    ...operation,
  }
  if (target) {
    normalized.target = target
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
  const target = normalizeTarget(operation)
  return {
    callId,
    name: operation.name,
    actor,
    ...(target ? { target } : {}),
    ...(queryScope ? { queryScope } : {}),
    params: clone(operation.params || {}),
  }
}

function buildDataQueryCall(operation = {}, {
  callId = 'agent_step_action',
  actor = 'agent',
} = {}) {
  const queryScope = normalizeQueryScope(operation)
  const target = normalizeTarget(operation)
  const query = isPlainObject(operation?.query) ? clone(operation.query) : {}
  const querySpec = isPlainObject(query?.spec) ? clone(query.spec) : {}
  const querySpecScope = normalizeQueryScope({ queryScope: querySpec.queryScope })

  if (queryScope && !querySpecScope) {
    query.spec = {
      ...querySpec,
      queryScope,
    }
  } else if (queryScope && querySpecScope) {
    query.spec = {
      ...querySpec,
      queryScope: {
        ...queryScope,
        ...querySpecScope,
      },
    }
  } else if (querySpecScope) {
    query.spec = {
      ...querySpec,
      queryScope: querySpecScope,
    }
  } else if (Object.keys(querySpec).length > 0) {
    delete querySpec.queryScope
    query.spec = querySpec
  }

  return {
    callId,
    actor,
    ...(target ? { target } : {}),
    ...(operation?.dataRef ? { dataRef: operation.dataRef } : {}),
    query,
    ...(queryScope ? { queryScope } : {}),
  }
}

function buildVerificationCall(actionCall = {}, result = {}) {
  const queryScope = normalizeQueryScope(actionCall)
  const target = normalizeTarget(actionCall)
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
    ...(target ? { target } : {}),
    ...(queryScope ? { queryScope } : {}),
    params: {
      actionName: actionCall.name || null,
      actionParams: actionCall.params || {},
      stateId,
      refs,
    },
  }
}

function resolveMethod(target, methodNames = []) {
  for (const methodName of methodNames) {
    if (typeof target?.[methodName] === 'function') {
      return target[methodName].bind(target)
    }
  }
  return null
}

async function readObserveStage(target, {
  loopOptions = {},
  observationOptions = {},
} = {}) {
  const readObservation = resolveMethod(target, ['readObservation'])
  if (typeof readObservation !== 'function') {
    throw new Error('runAgentLoop requires target.readObservation().')
  }

  const agentObservation = await readObservation({
    ...observationOptions,
    query: loopOptions?.objective || observationOptions?.query || null,
  })

  return buildAgentObservation(agentObservation)
}

async function readWorkspacePlan(target, planningRequest = null) {
  const planWorkspace = resolveMethod(target, ['planWorkspace'])
  if (!planningRequest || typeof planWorkspace !== 'function') {
    return null
  }
  return planWorkspace(planningRequest)
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
} = {}) {
  return {
    objective,
    workspacePlan: clone(workspacePlan),
    assistantMessage: planningResult?.assistantMessage || '',
    rationale: planningResult?.rationale || '',
    operation: clone(operation),
    rawPlan: clone(planningResult),
  }
}

async function resolvePlanningResult({
  planner,
  observe,
  knowledge = null,
  history = null,
  workspacePlan,
  objective = null,
  operation = null,
  actor = 'agent',
  plannerContext = null,
  responseRequirements = null,
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
    throw new Error('runAgentLoop requires either operation or planner.')
  }

  const planningResult = await planner({
    objective,
    observe: clone(observe),
    knowledge: clone(knowledge),
    history: clone(history),
    workspacePlan: clone(workspacePlan),
    actor,
    plannerContext: clone(plannerContext),
    responseRequirements: clone(responseRequirements),
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

async function executeOperation(target, operation, { actor = 'agent', callId = 'agent_step_action' } = {}) {
  if (!operation || typeof operation.kind !== 'string') {
    throw new Error('executeOperation requires an operation with kind.')
  }

  if (operation.kind === 'action') {
    const actionCall = buildActionCall(operation, { callId, actor })
    const runVerifiedAction = resolveMethod(target, ['executeVerifiedAction', 'runVerifiedAction'])
    if (typeof runVerifiedAction === 'function') {
      const verifiedResult = await runVerifiedAction(actionCall, {})
      return {
        executionKind: 'verified_action',
        actionCall,
        result: verifiedResult,
      }
    }
    const executeAction = resolveMethod(target, ['executeAction', 'runAction'])
    if (typeof executeAction !== 'function') {
      throw new Error('Target does not expose executeAction() or executeVerifiedAction().')
    }
    const actionResult = await executeAction(actionCall)
    return {
      executionKind: 'action',
      actionCall,
      result: actionResult,
    }
  }

  if (operation.kind === 'perception') {
    const queryPerception = resolveMethod(target, ['queryPerception'])
    if (typeof queryPerception !== 'function') {
      throw new Error('Target does not expose queryPerception().')
    }
    const call = {
      callId,
      name: operation.name,
      actor,
      ...(operation.target ? { target: clone(operation.target) } : {}),
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
    const runDataQuery = resolveMethod(target, ['runDataQuery', 'queryData'])
    if (typeof runDataQuery !== 'function') {
      throw new Error('Target does not expose runDataQuery().')
    }
    const call = buildDataQueryCall(operation, { callId, actor })
    return {
      executionKind: 'data_query',
      actionCall: call,
      result: await runDataQuery(call),
    }
  }

  throw new Error(`Unsupported operation kind: ${operation.kind}`)
}

async function verifyOperation(target, execution = null, { verify = true } = {}) {
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

  const queryPerception = resolveMethod(target, ['queryPerception'])
  if (typeof queryPerception !== 'function') {
    return null
  }

  const verifyCall = buildVerificationCall(execution.actionCall, execution.result)
  return queryPerception(verifyCall)
}

export async function runAgentLoop(target, options = {}) {
  if (!target || typeof target !== 'object') {
    throw new Error('runAgentLoop requires a target object.')
  }
  if (typeof target.readObservation !== 'function') {
    throw new Error('runAgentLoop requires target.readObservation().')
  }

  const {
    objective = null,
    planner = null,
    reasoner = defaultReasoner,
    operation = null,
    planningRequest = null,
    verify = true,
    loopOptions = {},
    observationOptions = {},
    callId = 'agent_step_action',
    actor = 'agent',
    plannerContext = null,
    plannerLevel = null,
    responseRequirements = null,
  } = options

  const observe = await readObserveStage(target, {
    loopOptions: {
      ...loopOptions,
      objective,
    },
    observationOptions,
  })
  const workspacePlan = await readWorkspacePlan(target, planningRequest)
  const baseKnowledge = buildAgentKnowledge({
    widgetKinds: readWidgetKindsFromObservation(observe),
  })
  const knowledge = options?.sessionKnowledge || projectPlannerKnowledge(baseKnowledge, {
    level: plannerLevel,
    observation: observe,
  })
  const history = mergeSessionHistory(
    options?.sessionHistory || null,
    options?.sessionTurns || [],
  )
  const planningResult = await resolvePlanningResult({
    planner,
    observe,
    knowledge,
    history,
    workspacePlan,
    objective,
    operation,
    actor,
    plannerContext,
    responseRequirements,
  })
  const plan = buildPlanStage({
    objective,
    workspacePlan,
    planningResult,
    operation: planningResult.operation,
  })
  const execution = await executeOperation(target, planningResult.operation, {
    actor: planningResult.actor || actor,
    callId,
  })
  const verification = await verifyOperation(target, execution, { verify })
  const latestCoordinationResult =
    typeof target?.readLatestCoordinationResult === 'function'
      ? await target.readLatestCoordinationResult()
      : null
  const compactObserve = compactObservationForTurn(observe)
  const reason = await reasoner({
    objective,
    observe: clone(compactObserve),
    history: clone(history),
    plan: clone(plan),
    result: clone(execution.result),
    verification: clone(verification),
    latestCoordinationResult: clone(latestCoordinationResult),
    plannerContext: clone(plannerContext),
    responseRequirements: clone(responseRequirements),
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

export async function runAgentTurn(target, options = {}) {
  const turnIndex = Number.isFinite(options?.turnIndex) && options.turnIndex >= 0
    ? Math.floor(options.turnIndex)
    : 0
  const base = await runAgentLoop(target, options)
  const observe = compactObservationForTurn(base.observe)
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
    index: turnIndex,
    observe,
    plan,
    act,
    verify,
    reason,
  }
}

export async function runAgentSession(target, options = {}) {
  const {
    objective = null,
    maxTurns = 3,
    finalSynthesizer = null,
    onTurn = null,
    plannerLevel = null,
    responseRequirements = null,
  } = options

  const safeMaxTurns = Number.isFinite(maxTurns) && maxTurns > 0
    ? Math.max(1, Math.floor(maxTurns))
    : 3

  const turns = []
  let knowledge = null
  let history = mergeSessionHistory(null, [])
  let stopReason = 'turn_budget_reached'

  for (let index = 0; index < safeMaxTurns; index += 1) {
    const turn = await runAgentTurn(target, {
      ...options,
      objective,
      sessionKnowledge: knowledge,
      sessionHistory: history,
      sessionTurns: turns,
      turnIndex: index,
      plannerLevel,
      responseRequirements,
      callId: `agent_step_${index + 1}`,
    })
    turns.push(turn)
    history = mergeSessionHistory(history, turns)
    if (!knowledge) {
      const fullKnowledge = buildAgentKnowledge({
        widgetKinds: readWidgetKindsFromObservation(turn.observe),
      })
      knowledge = plannerLevel == null
        ? fullKnowledge
        : projectPlannerKnowledge(fullKnowledge, {
          level: plannerLevel,
          observation: turn.observe,
        })
    }

    if (typeof onTurn === 'function') {
      await onTurn({
        index,
        turn: clone(turn),
        turns: clone(turns),
        history: clone(history),
        objective: objective || null,
      })
    }

    const resolvedStopReason = shouldStopAgentSession(turn, { turns })
    if (resolvedStopReason) {
      stopReason = resolvedStopReason
      break
    }
    if (index === safeMaxTurns - 1) {
      stopReason = 'turn_budget_reached'
    }
  }

  const lastTurn = turns.at(-1) || null
  let finalAnswer = lastTurn?.reason?.answer || ''

  if (typeof finalSynthesizer === 'function') {
    const synthesis = await finalSynthesizer({
      objective: objective || null,
      turns: clone(turns),
      history: clone(history),
      stopReason,
      knowledge: clone(knowledge || buildAgentKnowledge({})),
      lastTurn: clone(lastTurn),
      responseRequirements: clone(responseRequirements),
    })
    if (typeof synthesis === 'string') {
      finalAnswer = synthesis
    } else if (synthesis && typeof synthesis === 'object') {
      if (Object.prototype.hasOwnProperty.call(synthesis, 'finalAnswer')) {
        finalAnswer = synthesis.finalAnswer
      } else if (Object.prototype.hasOwnProperty.call(synthesis, 'answer')) {
        finalAnswer = synthesis.answer
      }
    }
  }

  const status =
    lastTurn?.act?.ok === false
      ? 'failed'
      : stopReason === 'answered'
      ? 'completed'
      : stopReason === 'stopped' || stopReason === 'no_progress' || stopReason === 'turn_budget_reached'
        ? 'stopped'
        : 'completed'

  return {
    objective: objective || null,
    status,
    ok: Boolean(lastTurn?.verify?.ok),
    answer: finalAnswer,
    finalAnswer,
    stopReason,
    knowledge: knowledge || buildAgentKnowledge({}),
    history,
    turns,
  }
}
