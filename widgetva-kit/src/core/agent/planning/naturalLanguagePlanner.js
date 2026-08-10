import { cloneJsonValue as clone } from '../../../shared/clone.js'
import { runAgentLoop, runAgentSession, runAgentTurn } from '../loop/runAgentLoop.js'
import { buildAgentObservation } from '../context/observation.js'
import {
  buildFormalActPayload,
  buildFormalPlanPayload,
  buildFormalVerifyPayload,
} from '../contracts/turnPayloads.js'

export const DEFAULT_OPENROUTER_AGENT_MODEL = 'deepseek/deepseek-v4-flash'

const JSON_OBJECT_RESPONSE_FORMAT = Object.freeze({ type: 'json_object' })

const PLANNER_RESPONSE_SHAPE = Object.freeze({
  assistantMessage: 'string',
  rationale: 'string',
  operation: {
    kind: 'action|perception',
    name: 'string when kind is action/perception',
    target: {
      widgetRef: 'copy one exact full ref string from observe.state.widgets[].ref',
    },
    params: {},
  },
})

function stripPromptExamples(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => stripPromptExamples(entry))
  }
  if (!value || typeof value !== 'object') {
    return value
  }
  const next = {}
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'examples') continue
    next[key] = stripPromptExamples(entry)
  }
  return next
}

function normalizeKnowledgeForPrompt(knowledge = null) {
  const normalized = stripPromptExamples(clone(knowledge))
  if (Array.isArray(knowledge?.agentGuidance?.workflows)) {
    normalized.agentGuidance = {
      ...normalized.agentGuidance,
      workflows: knowledge.agentGuidance.workflows.map((workflow) => ({
      ...workflow,
      examples: Array.isArray(workflow?.examples) ? clone(workflow.examples) : [],
      })),
    }
  }
  return normalized
}

const PROMPT_DROP_KEYS = new Set([
  'bodyText',
  'fullRows',
  'pageText',
  'rawCode',
  'rawRows',
  'rawSpec',
  'rowCount',
  'rows',
  'snapshot',
  'source',
  'sourceCode',
  'spec',
  'widgetId',
])

const PROMPT_ARRAY_LIMITS = {
  cells: 64,
  fieldValues: 16,
  fields: 32,
  turns: 12,
  widgets: 24,
}

function promptArrayLimitForKey(key = null) {
  return PROMPT_ARRAY_LIMITS[key] || 24
}

function sanitizePromptValue(value, key = null) {
  if (Array.isArray(value)) {
    return value
      .slice(0, promptArrayLimitForKey(key))
      .map((entry) => sanitizePromptValue(entry))
  }
  if (!value || typeof value !== 'object') return value

  const next = {}
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (PROMPT_DROP_KEYS.has(entryKey)) continue
    next[entryKey] = sanitizePromptValue(entryValue, entryKey)
  }
  return next
}

function compactMatrixForPrompt(matrix = null) {
  if (!matrix || typeof matrix !== 'object' || Array.isArray(matrix)) return matrix
  return {
    provider: matrix.provider || null,
    kind: matrix.kind || null,
    cellCount: Number.isFinite(matrix.cellCount) ? matrix.cellCount : null,
    cells: (Array.isArray(matrix.cells) ? matrix.cells : [])
      .slice(0, PROMPT_ARRAY_LIMITS.cells)
      .map((cell) => ({
        ref: cell?.ref || null,
        xField: cell?.xField || null,
        yField: cell?.yField || null,
        xDomain: Array.isArray(cell?.xDomain) ? [...cell.xDomain] : null,
        yDomain: Array.isArray(cell?.yDomain) ? [...cell.yDomain] : null,
      }))
      .filter((cell) => cell.ref),
    currentBrush: matrix.currentBrush ? sanitizePromptValue(matrix.currentBrush) : null,
    summary: matrix.summary || null,
  }
}

function sanitizeAgentObservationForPrompt(observe = null) {
  const sanitized = sanitizePromptValue(clone(observe))
  if (sanitized?.state?.matrix) {
    sanitized.state.matrix = compactMatrixForPrompt(sanitized.state.matrix)
  }
  if (sanitized?.matrix) {
    sanitized.matrix = compactMatrixForPrompt(sanitized.matrix)
  }
  if (sanitized?.view && typeof sanitized.view === 'object') {
    delete sanitized.view.snapshot
    // Image bytes are transported as a separate multimodal message part;
    // keep only metadata in the JSON observation to avoid duplicating a
    // potentially large data URL in the text prompt.
    if (sanitized.view.image && typeof sanitized.view.image === 'object') {
      const { data: _data, dataUrl: _dataUrl, base64: _base64, ...imageMeta } = sanitized.view.image
      sanitized.view.image = imageMeta
    }
  }
  return sanitized
}

function readObservationImageUrl(observe = null) {
  const image = observe?.view?.image
  if (!image || typeof image !== 'object') return null
  if (typeof image.dataUrl === 'string' && image.dataUrl.length > 0) return image.dataUrl
  if (typeof image.data === 'string' && image.data.length > 0) {
    if (image.data.startsWith('data:')) return image.data
    const mimeType = typeof image.mimeType === 'string' && image.mimeType.length > 0
      ? image.mimeType
      : 'image/png'
    return `data:${mimeType};base64,${image.data}`
  }
  if (typeof image.base64 === 'string' && image.base64.length > 0) {
    const mimeType = typeof image.mimeType === 'string' && image.mimeType.length > 0
      ? image.mimeType
      : 'image/png'
    return `data:${mimeType};base64,${image.base64}`
  }
  return null
}

function buildPromptUserContent(userPrompt, observe = null) {
  const imageUrl = readObservationImageUrl(observe)
  if (!imageUrl) return userPrompt
  return [
    { type: 'text', text: userPrompt },
    { type: 'image_url', image_url: { url: imageUrl } },
  ]
}

function summarizePromptParams(params = null) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return null
  const parts = []
  for (const [key, value] of Object.entries(params).slice(0, 6)) {
    if (Array.isArray(value)) {
      parts.push(`${key}=[${value.slice(0, 6).join(', ')}]`)
    } else if (value && typeof value === 'object') {
      parts.push(`${key}={...}`)
    } else if (value != null) {
      parts.push(`${key}=${value}`)
    }
  }
  return parts.length > 0 ? parts.join('; ') : null
}

function normalizeHistoryTurnForPrompt(turn = null, index = 0) {
  if (!turn || typeof turn !== 'object') return turn
  const operation = turn.operation
    || turn.act?.operation
    || turn.plan?.operation
    || turn.plan
    || turn.act
    || null
  const status = turn.status || {}
  return {
    turnId: turn.turnId || `turn_${index + 1}`,
    operation: operation
      ? {
        kind: operation.kind || null,
        name: operation.name || null,
        target: operation.target ? sanitizePromptValue(operation.target) : null,
        paramsSummary: operation.paramsSummary || summarizePromptParams(operation.params),
      }
      : null,
    status: {
      outcome:
        status.outcome
        || (turn.verify?.ok === false ? 'failed' : null)
        || (turn.act?.ok === false ? 'failed' : null)
        || null,
      resultSummary:
        status.resultSummary
        || turn.act?.outputSummary
        || turn.resultSummary
        || null,
      stateSummary:
        status.stateSummary
        || turn.verify?.summary
        || turn.stateSummary
        || null,
      reasonSummary:
        status.reasonSummary
        || turn.reason?.answer
        || turn.reasonSummary
        || null,
      evidence: status.evidence ? sanitizePromptValue(status.evidence) : null,
    },
  }
}

function normalizeHistoryForPrompt(history = null) {
  if (!history || typeof history !== 'object') return history
  if (Array.isArray(history.turns)) {
    return {
      turns: history.turns
        .slice(-PROMPT_ARRAY_LIMITS.turns)
        .map(normalizeHistoryTurnForPrompt),
    }
  }
  return sanitizePromptValue(history)
}

export function formatAgentPlannerError(error) {
  if (typeof error === 'string') return error
  if (error instanceof Error) {
    if (typeof error.message === 'string' && error.message.trim().length > 0) {
      return error.message
    }
    try {
      return JSON.stringify(error.message)
    } catch {
      return 'Agent planning failed.'
    }
  }
  if (error && typeof error === 'object') {
    const message = error.error || error.message || error.detail || error.reason || null
    if (typeof message === 'string' && message.trim().length > 0) return message
    try {
      return JSON.stringify(error)
    } catch {
      return 'Agent planning failed.'
    }
  }
  return 'Agent planning failed.'
}

function buildAgentMessages({ objective, observe, knowledge = null, history = null, plannerContext = null, responseRequirements = null }) {
  const directTools = Array.isArray(knowledge?.tools)
  const systemPrompt = [
    'You are an analyst agent operating a widget-based visual analytics workspace.',
    'Your job is to convert the user objective into exactly one next structured operation.',
    'Use only the actions and perceptions already exposed by the provided knowledge and current observation.',
    'Use history to avoid repeating operations unless repetition is necessary with different parameters.',
    'If the objective requires comparing multiple subsets, use history to track which subset has already been inspected.',
    ...(directTools
      ? [
        'The provided tools are direct calls. Use the supplied target.widgetRef exactly as written.',
        'Do not infer unsupported tools, hidden targets, or implementation details.',
      ]
      : [
        'Treat action names as semantic widget operations: the runtime will update widget/workspace state and the provider will apply that state to the active visualization environment.',
        'Prefer shared-state updates that let the provider rematerialize the page instead of trying to mutate private provider internals directly.',
        'Do not reason as if you need to touch private Vega runtime internals, tuple stores, or signal handles.',
      ]),
    'Return JSON only.',
    'The JSON must contain assistantMessage, rationale, and operation.',
    'operation.kind must be exactly one of: action or perception.',
    'If operation.kind is action or perception, include operation.name.',
    'If operation.kind is action or perception, include operation.target.widgetRef. Copy exactly one full ref string from observe.state.widgets[].ref.',
    'Do not use widgetId, title, kind, or a shortened identifier as operation.target.widgetRef.',
    'For action/perception operations, put arguments in operation.params.',
    'If the objective explicitly requests a state-changing action, execute that action; a perception result that could answer the numeric question is not a substitute for the requested view change.',
    ...(!directTools ? [
      'For a linked subset, cohort, category, or interval objective, prioritize the source action that establishes the relevant linked state before using perceptions. Then use perceptions to verify the propagated target state and gather the requested evidence.',
      'Before choosing a perception, compare the requested fields and visual state with the current encodings. If the requested visual state is not present, plan the state-changing operation first.',
    ] : []),
    'When responseRequirements are present, treat them as output-format requirements only. They never contain the expected answer values.',
    ...(!directTools ? [
      'When an action requires category, series, or line identifiers, choose exact values from observe.state.widgets[].data.fieldValues when available.',
      'Use plannerContext only when it is present. It contains instance-selected analysis guidance, relation guidance, and at most one selected workflow; it is not a catalog of all possible workflows.',
      'When plannerContext.workflow is present, treat its steps as the required next-step sequence: use history to find the first unfinished step, and do not substitute another exposed operation merely because it is available.',
      'When plannerContext.workflowProgress is present, use nextStepId and nextOperation as the current workflow position; do not repeat a completed step unless its evidence was not verified.',
      'If a workflow is provided, prefer following that workflow for the analysis before choosing an alternative path.',
    ] : []),
    'Do not return markdown fences.',
    `Return exactly one JSON object matching this shape: ${JSON.stringify(PLANNER_RESPONSE_SHAPE)}.`,
  ].join(' ')

  const normalizedObserve = normalizeObserveForPrompt(observe, { objective })

  const userPrompt = JSON.stringify({
    objective,
    knowledge: normalizeKnowledgeForPrompt(knowledge),
    observe: normalizedObserve,
    history: normalizeHistoryForPrompt(history),
    plannerContext: directTools ? null : sanitizePromptValue(plannerContext),
    responseRequirements: sanitizePromptValue(responseRequirements),
    requiredResponseShape: PLANNER_RESPONSE_SHAPE,
  })

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: buildPromptUserContent(userPrompt, observe) },
  ]
}

function buildRepairMessages({ objective, observe, knowledge = null, history = null, plannerContext = null, responseRequirements = null, previousContent = '' }) {
  const directTools = Array.isArray(knowledge?.tools)
  const systemPrompt = [
    'You previously returned an invalid plan for a widget-based visual analytics agent.',
    'Remember: use only currently exposed actions and perceptions from the provided knowledge and observation.',
    ...(directTools
      ? ['Remember: choose an exact supplied direct tool and copy its target.widgetRef exactly.']
      : ['Remember: action names are semantic widget operations; do not touch private Vega runtime internals, tuple stores, or signal handles.']),
    'Return JSON only.',
    'Your JSON must contain assistantMessage, rationale, and operation.',
    'operation.kind must be exactly one of: action or perception.',
    'If operation.kind is action or perception, include operation.name.',
    'If operation.kind is action or perception, include operation.target.widgetRef. Copy exactly one full ref string from observe.state.widgets[].ref.',
    'Do not use widgetId, title, kind, or a shortened identifier as operation.target.widgetRef.',
    ...(!directTools ? [
      'When required params need category, series, or line identifiers, choose exact values from observe.state.widgets[].data.fieldValues when available.',
      'Use only the instance-selected plannerContext when present; do not assume an unseen workflow or relation.',
      'When plannerContext.workflow is present, repair toward the first unfinished workflow step instead of choosing a different available operation.',
      'When plannerContext.workflowProgress is present, repair toward its nextStepId and nextOperation.',
    ] : []),
    'When responseRequirements are present, preserve those output-format requirements without guessing or inventing expected values.',
    'Do not include markdown fences or explanatory prose.',
    `Return exactly one JSON object matching this shape: ${JSON.stringify(PLANNER_RESPONSE_SHAPE)}.`,
  ].join(' ')

  const userPrompt = JSON.stringify({
    objective,
    knowledge: normalizeKnowledgeForPrompt(knowledge),
    observe: normalizeObserveForPrompt(observe, { objective }),
    history: normalizeHistoryForPrompt(history),
    plannerContext: directTools ? null : sanitizePromptValue(plannerContext),
    responseRequirements: sanitizePromptValue(responseRequirements),
    previousContent,
    requiredResponseShape: PLANNER_RESPONSE_SHAPE,
  })

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: buildPromptUserContent(userPrompt, observe) },
  ]
}

function buildReasonMessages({
  objective,
  observe,
  history,
  plan,
  result,
  verification,
  latestCoordinationResult,
  plannerContext = null,
  responseRequirements = null,
} = {}) {
  const systemPrompt = [
    'You are the answer stage of a widget-based visual analytics agent.',
    'You have already observed, planned, executed, and verified one analysis step.',
    'Write a concise progress note for this turn, not necessarily the final answer for the whole session.',
    'Use history to avoid repeating earlier progress unless the latest step changes the conclusion.',
    'Use the actual execution result and verification outcome.',
    'Do not invent computed values that are not present in the runtime result.',
    'Return JSON only.',
    'The JSON must contain answer.',
    'Set completion.status to "answered" only when every explicit part of the user objective is satisfied by verified evidence in the current runtime result or history results, and no required selected-workflow step remains unfinished.',
    'A successful operation by itself does not mean the objective is answered.',
    'If any requested comparison, subset, action, or answer value still lacks verified evidence, set completion.status to "continue".',
    ...(responseRequirements?.mode === 'verifiable'
      ? [
        `In verifiable mode, answer must be one ${responseRequirements.answerType || 'typed'} value or null; never replace a boolean, numeric, categorical, or interval value with progress prose.`,
      ]
      : []),
  ].join(' ')

  const userPrompt = JSON.stringify({
    objective,
    observe: normalizeObserveForPrompt(observe, { objective }),
    history: normalizeHistoryForPrompt(history),
    plan: normalizePlanForPrompt(plan),
    result: normalizeResultForPrompt(plan, result),
    verification: normalizeVerificationForPrompt(plan, result, verification, observe),
    latestCoordinationResult: normalizeCoordinationResultForPrompt(latestCoordinationResult),
    plannerContext: sanitizePromptValue(plannerContext),
    responseRequirements: sanitizePromptValue(responseRequirements),
  })

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
}

function buildFinalSynthesisMessages({
  objective,
  history,
  turns,
  stopReason,
  responseRequirements = null,
} = {}) {
  const machineAnswerMode = responseRequirements?.mode === 'verifiable'
  const systemPrompt = [
    'You are the final synthesis stage of a widget-based visual analytics agent.',
    'Synthesize the final answer from the user objective and every completed turn.',
    'Do not return only the last turn or a progress note: combine all relevant facts gathered across the session.',
    'Before writing the answer, check each requested comparison, entity, metric, and conclusion against the completed turns and cover every one that has evidence.',
    'Do not propose new actions.',
    'Do not mention raw provider internals unless necessary.',
    'Ground the answer in WidgetVA observations and action/perception results.',
    ...(machineAnswerMode
      ? [
        'This is machine answer mode because responseRequirements.mode is verifiable.',
        'Use only the single answer type in responseRequirements.answerType; never emit any other type.',
        'Do not put prose, explanations, evidence, or turn summaries inside answer.',
        'For numeric return a JSON number, for categorical return a string label, for boolean return yes or no, and for interval return a two-element ordered array [start, end]. Return exactly one value, not a prose explanation or an array of different answer types.',
        'If a field is not supported by completed turns, return null rather than guessing.',
      ]
      : [
        'When responseRequirements are present in a human-readable mode, answer every listed field in readable text using its requested form.',
        'Keep the answer readable, but do not omit required fields or replace a typed value with vague prose.',
      ]),
    'Return JSON only.',
    machineAnswerMode
      ? 'The JSON must have exactly one top-level key, answer, whose value is the typed answer value or ordered array of typed values.'
      : 'The JSON must contain answer.',
  ].join(' ')

  const compactTurns = Array.isArray(turns)
    ? turns.map((turn) => ({
      index: turn?.index,
      operation: turn?.act
        ? {
          kind: turn.act.kind || null,
          name: turn.act.name || null,
          target: clone(turn.act.target || null),
          params: clone(turn.act.params || {}),
        }
        : null,
      resultSummary: turn?.act?.outputSummary || null,
      evidence: turn?.act?.evidence ? sanitizePromptValue(turn.act.evidence) : null,
      verificationSummary: turn?.verify?.summary || null,
      reasonSummary: turn?.reason?.answer || null,
      completion: clone(turn?.reason?.completion || null),
    }))
    : []

  const userPrompt = JSON.stringify({
    objective,
    history: normalizeHistoryForPrompt(history),
    turns: compactTurns,
    stopReason,
    responseRequirements: sanitizePromptValue(responseRequirements),
  })

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
}

function isTypedAnswer(value, answerType) {
  if (value == null) return false
  if (answerType === 'numeric') return typeof value === 'number' && Number.isFinite(value)
  if (answerType === 'boolean') {
    return typeof value === 'boolean' || (typeof value === 'string' && /^(yes|no|true|false)$/i.test(value.trim()))
  }
  if (answerType === 'interval') return Array.isArray(value) && value.length === 2
  if (answerType === 'categorical') return typeof value === 'string' && value.trim().length > 0
  return false
}

function normalizeTypedAnswer(value, answerType) {
  if (answerType === 'numeric' && typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : value
  }
  if (answerType === 'boolean' && typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === 'yes') return true
    if (normalized === 'false' || normalized === 'no') return false
  }
  if (answerType === 'interval' && value && typeof value === 'object' && !Array.isArray(value)) {
    if (Object.prototype.hasOwnProperty.call(value, 'start') && Object.prototype.hasOwnProperty.call(value, 'end')) {
      return [value.start, value.end]
    }
  }
  if (answerType === 'categorical' && value && typeof value === 'object' && !Array.isArray(value)) {
    if (typeof value.value === 'string') return value.value
    if (typeof value.label === 'string') return value.label
  }
  return value
}

function looksLikeAgentObservation(observe = null) {
  return Boolean(
    observe
    && typeof observe === 'object'
    && !Array.isArray(observe)
    && !('observation' in observe)
    && !('workspace' in observe)
    && (
      Object.prototype.hasOwnProperty.call(observe, 'query')
      || Object.prototype.hasOwnProperty.call(observe, 'state')
      || Object.prototype.hasOwnProperty.call(observe, 'view')
    )
  )
}

function normalizeObserveForPrompt(observe = null, { objective = null } = {}) {
  if (!observe || typeof observe !== 'object') return observe
  if (looksLikeAgentObservation(observe)) return sanitizeAgentObservationForPrompt(observe)
  if (observe.agentObservation && typeof observe.agentObservation === 'object') {
    return sanitizeAgentObservationForPrompt(buildAgentObservation(observe.agentObservation))
  }
  return sanitizeAgentObservationForPrompt(buildAgentObservation({
    query: objective,
    state: null,
    view: null,
  }))
}

function normalizePlanForPrompt(plan = null) {
  if (!plan || typeof plan !== 'object') return plan
  if (plan?.step && !plan?.operation) return clone(plan)
  return buildFormalPlanPayload(plan)
}

function summarizePromptPayload(payload = null) {
  if (!payload || typeof payload !== 'object') return null
  if (typeof payload.summary === 'string' && payload.summary.length > 0) return payload.summary
  if (typeof payload.message === 'string' && payload.message.length > 0) return payload.message
  if (typeof payload?.actionResult?.summary === 'string' && payload.actionResult.summary.length > 0) return payload.actionResult.summary
  if (typeof payload?.actionResult?.error?.message === 'string' && payload.actionResult.error.message.length > 0) return payload.actionResult.error.message
  if (typeof payload?.error?.message === 'string' && payload.error.message.length > 0) return payload.error.message
  if (typeof payload.result === 'string' && payload.result.length > 0) return payload.result
  return null
}

function compactStructuredEvidence(plan = null, result = null) {
  const operationKind = plan?.operation?.kind || null
  if (operationKind !== 'perception' && operationKind !== 'data_query') return null
  const runtimeResult = result?.result && typeof result.result === 'object'
    ? result.result
    : result?.actionResult?.result && typeof result.actionResult.result === 'object'
      ? result.actionResult.result
      : null
  if (!runtimeResult || Array.isArray(runtimeResult)) return null

  const recordKey = ['groups', 'aggregates', 'rows', 'anomalies', 'bottlenecks']
    .find((key) => Array.isArray(runtimeResult[key]))
  const records = recordKey
    ? runtimeResult[recordKey].slice(0, 16).map((record) => {
      if (!record || typeof record !== 'object' || Array.isArray(record)) return record
      return Object.fromEntries(Object.entries(record)
        .slice(0, 12)
        .filter(([, value]) => (
          value == null
          || typeof value === 'string'
          || typeof value === 'number'
          || typeof value === 'boolean'
        )))
    })
    : []
  const scalars = Object.fromEntries(Object.entries(runtimeResult)
    .filter(([key, value]) => key !== recordKey && (
      value == null
      || typeof value === 'string'
      || typeof value === 'number'
      || typeof value === 'boolean'
    )))
  if (records.length === 0 && Object.keys(scalars).length === 0) return null
  return sanitizePromptValue({ source: recordKey || 'result', scalars, records })
}

function normalizeResultForPrompt(plan = null, result = null) {
  if (!result || typeof result !== 'object') return result
  if (Object.prototype.hasOwnProperty.call(result, 'outputSummary')) {
    return sanitizePromptValue({
      kind: result.kind || plan?.operation?.kind || null,
      name: result.name || plan?.operation?.name || null,
      ok: typeof result.ok === 'boolean' ? result.ok : null,
      outputSummary: result.outputSummary || null,
      stateId: result.stateId || null,
      updatedRefs: Array.isArray(result.updatedRefs) ? result.updatedRefs : [],
      error: result.error ? sanitizePromptValue(result.error) : null,
      evidence: result.evidence || compactStructuredEvidence(plan, result),
    })
  }
  const formal = buildFormalActPayload(plan || {}, result || {})
  return sanitizePromptValue({
    kind: formal.kind || null,
    name: formal.name || null,
    params: formal.params || null,
    target: formal.target || null,
    ok: typeof formal.ok === 'boolean' ? formal.ok : null,
    stateId: formal.stateId || null,
    updatedRefs: Array.isArray(formal.updatedRefs) ? formal.updatedRefs : [],
    error: formal.error || null,
    recoveryHints: Array.isArray(formal.recoveryHints) ? formal.recoveryHints : [],
    outputSummary: formal.outputSummary || summarizePromptPayload(result),
    evidence: formal.evidence || compactStructuredEvidence(plan, result),
  })
}

function normalizeVerificationForPrompt(plan = null, result = null, verification = null, observe = null) {
  if (!verification || typeof verification !== 'object') return verification
  const compactChecks = verification?.checks && typeof verification.checks === 'object' && !Array.isArray(verification.checks)
    ? Object.fromEntries(Object.entries(verification.checks).map(([name, check]) => [
      name,
      {
        ok: typeof check?.ok === 'boolean' ? check.ok : null,
        summary: typeof check?.summary === 'string' ? check.summary.slice(0, 500) : null,
      },
    ]))
    : null
  if (compactChecks || Object.prototype.hasOwnProperty.call(verification, 'summary')) {
    return sanitizePromptValue({
      ok: typeof verification.ok === 'boolean' ? verification.ok : null,
      summary: typeof verification.summary === 'string' ? verification.summary.slice(0, 700) : summarizePromptPayload(verification),
      checks: compactChecks,
    })
  }
  return buildFormalVerifyPayload({
    plan: plan || {},
    act: normalizeResultForPrompt(plan, result),
    verification,
    observe,
  })
}

function normalizeCoordinationResultForPrompt(result = null) {
  if (!result || typeof result !== 'object') return result
  return {
    summary:
      result?.verification?.summary
      || result?.propagationSummary?.selectionSummary
      || result?.summary
      || null,
    verification: result?.verification
      ? {
        status: result.verification.status || null,
        summary: result.verification.summary || null,
      }
      : null,
    propagation: result?.propagationSummary
      ? {
        active: Boolean(result.propagationSummary.active),
        sourceRef: result.propagationSummary.sourceRef || null,
        targetWidgetIds: Array.isArray(result.propagationSummary.targetWidgetIds)
          ? [...result.propagationSummary.targetWidgetIds]
          : [],
        linkCount: Number.isFinite(result.propagationSummary.linkCount)
          ? result.propagationSummary.linkCount
          : 0,
      }
      : null,
  }
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
  for (const [key, value] of Object.entries(plan || {})) {
    const normalizedKey = key.toLowerCase()
    if (
      value
      && typeof value === 'object'
      && (
        normalizedKey === 'action'
        || normalizedKey === 'perception'
      )
    ) {
      return { kind: normalizedKey, ...value }
    }
  }
  return {}
}

function readObservationWidgets(observe = {}) {
  const candidates = [
    observe?.state?.widgets,
    observe?.view?.widgets,
  ]
  for (const widgets of candidates) {
    if (Array.isArray(widgets)) return widgets
  }
  return []
}

function readFocusedWidgetRef(observe = {}) {
  const widgets = readObservationWidgets(observe)
  return (
    widgets.find((widget) => widget?.focused)?.ref
    || widgets[0]?.ref
    || null
  )
}

function inferOperationKind(plan = {}, operation = {}) {
  const explicitKind = operation.kind || plan.kind
  if (explicitKind) return explicitKind
  if (operation.name) {
    if (String(operation.name).startsWith('perception.')) return 'perception'
    return 'action'
  }
  return null
}

function normalizeOperation(plan = {}, observe = {}) {
  const operation = readPlannedOperation(plan)
  const flatWidgetRef =
    operation['target.widgetRef']
    || operation['target.widget_ref']
    || null
  const nestedWidgetRef =
    operation.target?.widgetRef
    || operation.target?.widget_ref
    || null
  const widgetRef = nestedWidgetRef || flatWidgetRef || null
  return {
    assistantMessage: typeof plan?.assistantMessage === 'string' ? plan.assistantMessage : 'Planned one next analysis step.',
    rationale: typeof plan?.rationale === 'string' ? plan.rationale : '',
    kind: inferOperationKind(plan, operation),
    name: operation.name || null,
    target: widgetRef ? { widgetRef } : undefined,
    params: clone(operation.params || {}),
  }
}

function operationMatchesTargetFamily(operation = {}, observe = {}, knowledge = null) {
  const directTools = Array.isArray(knowledge?.tools) ? knowledge.tools : null
  if (directTools) {
    return directTools.some((tool) => (
      tool?.kind === operation.kind
      && tool?.name === operation.name
      && tool?.target?.widgetRef === operation?.target?.widgetRef
    ))
  }
  const widgetKind = readWidgetKindForRef(observe, operation?.target?.widgetRef || null)
  if (!widgetKind) return true
  const fieldName = operation.kind === 'perception' ? 'perceptions' : 'actions'
  const familyNames = readFamilyNamesForWidget(knowledge, widgetKind, fieldName)
  const availableNames = [...new Set(familyNames)]
  if (availableNames.length === 0) return true
  return availableNames.includes(operation.name)
}

function isExecutableOperation(operation = {}, observe = {}, knowledge = null) {
  if (!operation || typeof operation !== 'object') return false
  if (operation.kind === 'action' || operation.kind === 'perception') {
    if (!(typeof operation.name === 'string'
      && operation.name.trim().length > 0
      && typeof operation?.target?.widgetRef === 'string'
      && operation.target.widgetRef.length > 0)) {
      return false
    }
    const widgets = readObservationWidgets(observe)
    if (widgets.length > 0 && !widgets.some((widget) => widget?.ref === operation.target.widgetRef)) {
      return false
    }
    return operationMatchesTargetFamily(operation, observe, knowledge)
  }
  return false
}

function readWidgetKindForRef(observe = {}, widgetRef = null) {
  if (!widgetRef) return null
  const widgets = readObservationWidgets(observe)
  const widget = widgets.find((entry) => entry?.ref === widgetRef) || null
  if (!widget) return null
  // recognizedKinds is a capability list for composite/custom widgets, not identity.
  // Fallback planning must not guess a concrete family from that list.
  return typeof widget.kind === 'string' && widget.kind.length > 0 ? widget.kind : null
}

function readFamilyNamesForWidget(knowledge = null, widgetKind = null, fieldName = '') {
  if (!widgetKind || !fieldName) return []
  const families = Array.isArray(knowledge?.widgetFamilies) ? knowledge.widgetFamilies : []
  const family = families.find((entry) => entry?.kind === widgetKind) || null
  const descriptors = Array.isArray(family?.[fieldName]) ? family[fieldName] : []
  return descriptors
    .map((descriptor) => descriptor?.name)
    .filter((name, index, names) => typeof name === 'string' && name.length > 0 && names.indexOf(name) === index)
}

function choosePreferredName(names = [], preferredNames = []) {
  for (const preferredName of preferredNames) {
    if (names.includes(preferredName)) return preferredName
  }
  return names.find((name) => typeof name === 'string' && name.length > 0) || null
}

function buildSafeFallbackOperation(observe = {}, knowledge = null) {
  const focusedWidgetRef = readFocusedWidgetRef(observe)
  const focusedWidgetKind = readWidgetKindForRef(observe, focusedWidgetRef)
  const directTools = Array.isArray(knowledge?.tools) ? knowledge.tools : null
  const perceptionNames = directTools
    ? directTools
      .filter((tool) => tool?.kind === 'perception' && tool?.target?.widgetRef === focusedWidgetRef)
      .map((tool) => tool?.name)
      .filter((name, index, names) => typeof name === 'string' && name.length > 0 && names.indexOf(name) === index)
    : [
      ...readFamilyNamesForWidget(knowledge, focusedWidgetKind, 'perceptions'),
    ].filter((name, index, names) => names.indexOf(name) === index)
  const fallbackPerception = choosePreferredName(perceptionNames, [
    'perception.inspectViewConfig',
    'perception.summarizeVisible',
    'perception.inspectSelection',
    'perception.inspectVisibleRows',
  ])

  if (fallbackPerception) {
    return {
      assistantMessage: 'I will inspect the current widget before taking a stronger interaction step.',
      rationale: 'The model response did not yield a valid executable operation, so the runtime is falling back to a perception that this workspace actually exposes.',
      kind: 'perception',
      name: fallbackPerception,
      ...(focusedWidgetRef ? { target: { widgetRef: focusedWidgetRef } } : {}),
      params: {},
    }
  }

  return {
    assistantMessage: 'I could not produce a valid operation for the current workspace.',
    rationale: 'The model response did not yield a valid executable operation, and the current workspace catalog does not expose a fallback perception for the focused widget. WidgetVA will not guess a state-changing fallback action.',
    kind: null,
    name: null,
    ...(focusedWidgetRef ? { target: { widgetRef: focusedWidgetRef } } : {}),
    params: {},
  }
}

export function createNaturalLanguagePlanner({
  completeChat,
  model = DEFAULT_OPENROUTER_AGENT_MODEL,
  temperature = 0.2,
} = {}) {
  if (typeof completeChat !== 'function') {
    throw new Error('createNaturalLanguagePlanner requires completeChat().')
  }

  return async function planner({
    objective = null,
    observe = null,
    knowledge = null,
    history = null,
    plannerContext = null,
    responseRequirements = null,
  } = {}) {
    const safeObjective = typeof objective === 'string' && objective.trim().length > 0
      ? objective.trim()
      : 'Inspect the current visualization workspace and take the next useful step.'

    const primaryMessages = buildAgentMessages({
      objective: safeObjective,
      knowledge,
      observe,
      history,
      plannerContext,
      responseRequirements,
    })
    const primaryResponse = await completeChat({
      model,
      temperature,
      responseFormat: JSON_OBJECT_RESPONSE_FORMAT,
      messages: primaryMessages,
    })

    const primaryContent = primaryResponse?.content || ''
    const primaryPlan = extractJsonObject(primaryContent)

    let normalizedOperation = primaryPlan ? normalizeOperation(primaryPlan, observe) : null
    let resolvedResponse = primaryResponse
    let resolvedPlan = primaryPlan

    if (!isExecutableOperation(normalizedOperation, observe, knowledge)) {
      const repairMessages = buildRepairMessages({
        objective: safeObjective,
        knowledge,
        observe,
        history,
        plannerContext,
        responseRequirements,
        previousContent: primaryContent,
      })
      const repairedResponse = await completeChat({
        model,
        temperature,
        responseFormat: JSON_OBJECT_RESPONSE_FORMAT,
        messages: repairMessages,
      })
      const repairedContent = repairedResponse?.content || ''
      const repairedPlan = extractJsonObject(repairedContent)
      const repairedOperation = repairedPlan ? normalizeOperation(repairedPlan, observe) : null

      if (
        repairedPlan
        && isExecutableOperation(repairedOperation, observe, knowledge)
      ) {
        resolvedResponse = repairedResponse
        resolvedPlan = repairedPlan
        normalizedOperation = repairedOperation
      } else {
        normalizedOperation = buildSafeFallbackOperation(observe, knowledge)
      }
    }

    if (!isExecutableOperation(normalizedOperation, observe, knowledge)) {
      throw new Error(normalizedOperation?.rationale || 'Agent planning did not yield an executable operation.')
    }

    return {
      assistantMessage: normalizedOperation.assistantMessage,
      rationale: normalizedOperation.rationale,
      operation: {
        kind: normalizedOperation.kind,
        ...(normalizedOperation.name ? { name: normalizedOperation.name } : {}),
        ...(normalizedOperation.target ? { target: normalizedOperation.target } : {}),
        ...(normalizedOperation.params ? { params: normalizedOperation.params } : {}),
      },
      source: 'planner',
      model,
      rawResponse: clone(resolvedResponse?.raw || null),
      rawContent: resolvedResponse?.content || '',
      rawPlan: clone(resolvedPlan),
    }
  }
}

export function createNaturalLanguageReasoner({
  completeChat,
  model = DEFAULT_OPENROUTER_AGENT_MODEL,
  temperature = 0.2,
} = {}) {
  if (typeof completeChat !== 'function') {
    throw new Error('createNaturalLanguageReasoner requires completeChat().')
  }

  return async function reasoner({
    objective = null,
    observe = null,
    history = null,
    plan = null,
    result = null,
    verification = null,
    latestCoordinationResult = null,
    plannerContext = null,
    responseRequirements = null,
  } = {}) {
    const response = await completeChat({
      model,
      temperature,
      responseFormat: JSON_OBJECT_RESPONSE_FORMAT,
      messages: buildReasonMessages({
        objective,
        observe,
        history,
        plan,
        result,
        verification,
        latestCoordinationResult,
        plannerContext,
        responseRequirements,
      }),
    })

    const content = response?.content || ''
    const parsed = extractJsonObject(content)
    if (parsed && Object.prototype.hasOwnProperty.call(parsed, 'answer')) {
      const completionStatus =
        typeof parsed?.completion?.status === 'string' && parsed.completion.status.trim().length > 0
          ? parsed.completion.status.trim()
          : null
      const parsedAnswer = responseRequirements?.mode === 'verifiable'
        ? normalizeTypedAnswer(parsed.answer, responseRequirements.answerType)
        : parsed.answer
      const answerIsValid = responseRequirements?.mode === 'verifiable'
        ? (parsedAnswer == null || isTypedAnswer(parsedAnswer, responseRequirements.answerType))
        : (typeof parsedAnswer === 'string' && parsedAnswer.trim().length > 0)
      if (!answerIsValid) {
        return {
          answer: 'The reason stage returned an answer in an invalid format.',
          rawResponse: clone(response?.raw || null),
          rawContent: content,
        }
      }
      return {
        answer: typeof parsedAnswer === 'string' ? parsedAnswer.trim() : parsedAnswer,
        ...(completionStatus ? { completion: { status: completionStatus } } : {}),
        rawResponse: clone(response?.raw || null),
        rawContent: content,
      }
    }

    const fallbackAnswer =
      (typeof result?.summary === 'string' && result.summary.length > 0 ? result.summary : null)
      || (typeof result?.message === 'string' && result.message.length > 0 ? result.message : null)
      || (typeof plan?.assistantMessage === 'string' && plan.assistantMessage.length > 0 ? plan.assistantMessage : null)
      || 'Completed one agent step.'

    return {
      answer: fallbackAnswer,
      rawResponse: clone(response?.raw || null),
      rawContent: content,
    }
  }
}

export function createNaturalLanguageFinalSynthesizer({
  completeChat,
  model = DEFAULT_OPENROUTER_AGENT_MODEL,
  temperature = 0.2,
} = {}) {
  if (typeof completeChat !== 'function') {
    throw new Error('createNaturalLanguageFinalSynthesizer requires completeChat().')
  }

  return async function finalSynthesizer({
    objective = null,
    history = null,
    turns = [],
    stopReason = null,
    responseRequirements = null,
  } = {}) {
    const response = await completeChat({
      model,
      temperature,
      responseFormat: JSON_OBJECT_RESPONSE_FORMAT,
      messages: buildFinalSynthesisMessages({
        objective,
        history,
        turns,
        stopReason,
        responseRequirements,
      }),
    })

    const content = response?.content || ''
    const parsed = extractJsonObject(content)
    const fallbackAnswers = Array.isArray(turns)
      ? turns
        .map((turn) => typeof turn?.reason?.answer === 'string' ? turn.reason.answer.trim() : '')
        .filter(Boolean)
      : []
    const fallbackAnswer = fallbackAnswers.length > 0
      ? fallbackAnswers.join('\n')
      : 'Completed the requested WidgetVA analysis.'
    const machineAnswer = null
    const parsedAnswer = parsed?.answer
    const normalizedParsedAnswer = responseRequirements?.mode === 'verifiable'
      ? normalizeTypedAnswer(parsedAnswer, responseRequirements.answerType)
      : parsedAnswer
    const typedAnswer = responseRequirements?.mode === 'verifiable'
      ? (isTypedAnswer(normalizedParsedAnswer, responseRequirements.answerType) ? normalizedParsedAnswer : null)
      : parsedAnswer

    return {
      answer: responseRequirements?.mode === 'verifiable'
        ? (typedAnswer !== null
          ? typedAnswer
          : machineAnswer)
        : (typeof parsedAnswer === 'string' && parsedAnswer.trim().length > 0
          ? parsedAnswer.trim()
          : fallbackAnswer),
      rawResponse: clone(response?.raw || null),
      rawContent: content,
    }
  }
}

export async function runNaturalLanguageAgentLoop(target, {
  objective = null,
  completeChat,
  model = DEFAULT_OPENROUTER_AGENT_MODEL,
  temperature = 0.2,
  plannerContext = null,
  plannerLevel = null,
  ...loopOptions
} = {}) {
  const planner = createNaturalLanguagePlanner({
    completeChat,
    model,
    temperature,
  })
  const reasoner = createNaturalLanguageReasoner({
    completeChat,
    model,
    temperature,
  })

  return runAgentLoop(target, {
    ...loopOptions,
    objective,
    plannerContext,
    plannerLevel,
    planner,
    reasoner,
  })
}

export async function runNaturalLanguageAgentSession(target, {
  objective = null,
  completeChat,
  model = DEFAULT_OPENROUTER_AGENT_MODEL,
  temperature = 0.2,
  plannerContext = null,
  plannerLevel = null,
  ...loopOptions
} = {}) {
  const planner = createNaturalLanguagePlanner({
    completeChat,
    model,
    temperature,
  })
  const reasoner = createNaturalLanguageReasoner({
    completeChat,
    model,
    temperature,
  })
  const finalSynthesizer = typeof loopOptions?.finalSynthesizer === 'function'
    ? loopOptions.finalSynthesizer
    : createNaturalLanguageFinalSynthesizer({
      completeChat,
      model,
      temperature,
    })

  return runAgentSession(target, {
    ...loopOptions,
    objective,
    plannerContext,
    plannerLevel,
    planner,
    reasoner,
    finalSynthesizer,
  })
}

export async function runNaturalLanguageAgentTurn(target, {
  objective = null,
  completeChat,
  model = DEFAULT_OPENROUTER_AGENT_MODEL,
  temperature = 0.2,
  ...loopOptions
} = {}) {
  const planner = createNaturalLanguagePlanner({
    completeChat,
    model,
    temperature,
  })
  const reasoner = createNaturalLanguageReasoner({
    completeChat,
    model,
    temperature,
  })

  return runAgentTurn(target, {
    ...loopOptions,
    objective,
    planner,
    reasoner,
  })
}
