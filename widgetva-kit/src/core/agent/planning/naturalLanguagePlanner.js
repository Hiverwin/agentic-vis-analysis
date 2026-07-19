import { runAgentLoop, runAgentSession, runAgentTurn } from '../loop/runAgentLoop.js'
import { buildAgentObservation } from '../context/observation.js'
import {
  buildFormalActPayload,
  buildFormalPlanPayload,
  buildFormalVerifyPayload,
} from '../contracts/turnPayloads.js'

export const DEFAULT_OPENROUTER_AGENT_MODEL = 'deepseek/deepseek-v4-flash'
const TEMP_DEMO_WEATHER_CATEGORIES = ['rain', 'fog', 'snow']

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

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
  return stripPromptExamples(clone(knowledge))
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
  }
  return sanitized
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

function isTemporarySeattleWeatherDemo({ objective = null, observe = null } = {}) {
  const objectiveText = typeof objective === 'string' ? objective.toLowerCase() : ''
  const observeText = JSON.stringify(observe || {}).toLowerCase()
  const looksLikeSeattleWeather =
    observeText.includes('seattle')
    || observeText.includes('weather')
    || observeText.includes('temp_max')
  const mentionsExplicitDemoCategories =
    objectiveText.includes('rain')
    && objectiveText.includes('fog')
    && objectiveText.includes('snow')
  const asksWeatherTemperaturePattern =
    (
      objectiveText.includes('different weather')
      || objectiveText.includes('weather condition')
      || objectiveText.includes('weather conditions')
    )
    && (
      objectiveText.includes('temperature')
      || objectiveText.includes('temp')
    )
    && (
      objectiveText.includes('over the year')
      || objectiveText.includes('across the year')
      || objectiveText.includes('season')
      || objectiveText.includes('year in seattle')
    )
  return looksLikeSeattleWeather && (mentionsExplicitDemoCategories || asksWeatherTemperaturePattern)
}

function buildTemporaryDemoWorkflowHints({ objective = null, observe = null } = {}) {
  // TEMP DEMO HINT: remove after the Seattle weather extension demo.
  if (!isTemporarySeattleWeatherDemo({ objective, observe })) return []

  return [
    'Temporary Seattle Weather demo workflow: when the objective asks how weather conditions relate to temperature over the year, every unfinished turn must execute exactly one action that changes the visible weather category. Do not use perception-only or data-query-only operations as substitutes for these category view changes. Work category-by-category across turns: first call bar.filterCategories with field weather and categories ["rain"], then call bar.filterCategories with categories ["fog"], then call bar.filterCategories with categories ["snow"]. After each action, summarize what the resulting single-weather view shows. Only synthesize the comparison after rain, fog, and snow have each been shown in separate rendered views. Use history to remember which weather category has already been inspected.',
  ]
}

function buildTemporaryWorkflowHints({ objective = null, observe = null } = {}) {
  return [
    ...buildTemporaryDemoWorkflowHints({ objective, observe }),
  ]
}

function readTemporaryDemoCompletedCategories({ history = null, plan = null } = {}) {
  const operationPayloads = []
  if (Array.isArray(history?.turns)) {
    for (const turn of history.turns) {
      operationPayloads.push(
        turn?.operation || null,
        turn?.act?.operation || null,
        turn?.plan?.operation || null,
        turn?.act || null,
        turn?.plan?.step || null,
      )
    }
  }
  operationPayloads.push(plan?.operation || plan || null)
  const operationText = JSON.stringify(operationPayloads.filter(Boolean)).toLowerCase()
  return TEMP_DEMO_WEATHER_CATEGORIES.filter((category) => operationText.includes(category))
}

function readTemporaryDemoNextCategory(history = null) {
  const completedCategories = readTemporaryDemoCompletedCategories({ history })
  return TEMP_DEMO_WEATHER_CATEGORIES.find((category) => !completedCategories.includes(category)) || null
}

function hasAvailableTemporaryDemoAction({ observe = null, knowledge = null } = {}) {
  const observeText = JSON.stringify(observe || {}).toLowerCase()
  const knowledgeText = JSON.stringify(knowledge || {}).toLowerCase()
  return observeText.includes('bar.filtercategories') || knowledgeText.includes('bar.filtercategories')
}

function matchesTemporaryDemoOperation({ operation = null, objective = null, observe = null, history = null } = {}) {
  if (!isTemporarySeattleWeatherDemo({ objective, observe })) return true
  const nextCategory = readTemporaryDemoNextCategory(history)
  if (!nextCategory) return true
  if (!operation || operation.kind !== 'action' || operation.name !== 'bar.filterCategories') return false
  const paramsText = JSON.stringify(operation.params || {}).toLowerCase()
  return paramsText.includes('weather') && paramsText.includes(nextCategory)
}

function buildTemporaryDemoFallbackOperation({ objective = null, observe = null, knowledge = null, history = null } = {}) {
  const nextCategory = readTemporaryDemoNextCategory(history)
  if (!nextCategory || !hasAvailableTemporaryDemoAction({ observe, knowledge })) return null
  const focusedWidgetRef = readFocusedWidgetRef(observe)
  if (!focusedWidgetRef) return null
  return {
    assistantMessage: `I will filter the weather view to ${nextCategory} so this category can be inspected as its own rendered view.`,
    rationale: 'The temporary Seattle Weather demo workflow requires one weather-category action per turn before synthesis.',
    kind: 'action',
    name: 'bar.filterCategories',
    target: { widgetRef: focusedWidgetRef },
    params: {
      field: 'weather',
      categories: [nextCategory],
    },
    dataRef: null,
    query: null,
  }
}

function shouldContinueTemporaryDemo({ objective = null, observe = null, history = null, plan = null, result = null } = {}) {
  if (!isTemporarySeattleWeatherDemo({ objective, observe })) return false
  void result
  const completedCategories = readTemporaryDemoCompletedCategories({ history, plan })
  return TEMP_DEMO_WEATHER_CATEGORIES.some((category) => !completedCategories.includes(category))
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

function buildAgentMessages({ objective, observe, knowledge = null, history = null }) {
  const systemPrompt = [
    'You are an analyst agent operating a widget-based visual analytics workspace.',
    'Your job is to convert the user objective into exactly one next structured operation.',
    'Use only the actions, perceptions, and data-query surfaces already exposed by the provided knowledge and current observation.',
    'Use history to avoid repeating operations unless repetition is necessary with different parameters.',
    'If the objective requires comparing multiple subsets, use history to track which subset has already been inspected.',
    'Treat action names as semantic widget operations: the runtime will update widget/workspace state and the provider will apply that state to the active visualization environment.',
    'For page-linked visualizations, use the page-linked action surface for brush, overview-detail, and domain-sync semantics when those actions are exposed.',
    'For page-linked visualizations, use the page-linked action surface for click, select, hover, and bound-parameter semantics when those actions are exposed.',
    'Prefer shared-state updates that let the provider rematerialize the page instead of trying to mutate private provider internals directly.',
    'Do not reason as if you need to touch private Vega runtime internals, tuple stores, or signal handles.',
    'When bar actions are available, use bar.clickCategory for explicit click/tap language that should preserve the page’s existing category-linked interaction, and use bar.selectCategory for general selection semantics.',
    'If the user asks to update linked views, propagate a bar choice, drive cross-widget filtering, create a source selection, or use existing coordination links from a bar chart, choose bar.selectCategory unless the language explicitly says click/tap.',
    'Use bar.filterCategories only when the user explicitly wants to keep only, filter to, exclude, or remove categories from the visible view, and never for linked-view propagation.',
    'When the user asks to reset or undo a chart/view/zoom/filter view state, use widget.resetView or widget.undoView when those actions are exposed; do not substitute workspace.resetWorkspace or widget.undoSelection for view reset/undo requests.',
    'Return JSON only.',
    'The JSON must contain assistantMessage, rationale, and operation.',
    'operation.kind must be exactly one of: action, perception, data_query.',
    'If operation.kind is action or perception, include operation.name.',
    'If operation.kind is action or perception, include operation.target.widgetRef. Choose exactly one widgetRef from observe.state.widgets[].ref.',
    'For action/perception operations, put arguments in operation.params.',
    'When an action requires category, series, or line identifiers, choose exact values from observe.state.widgets[].data.fieldValues when available.',
    'For data_query operations, include operation.dataRef and operation.query.',
    'Do not return markdown fences.',
    ...buildTemporaryWorkflowHints({ objective, observe }),
  ].join(' ')

  const normalizedObserve = normalizeObserveForPrompt(observe, { objective })

  const userPrompt = JSON.stringify({
    objective,
    knowledge: normalizeKnowledgeForPrompt(knowledge),
    observe: normalizedObserve,
    history: normalizeHistoryForPrompt(history),
  })

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
}

function buildRepairMessages({ objective, observe, knowledge = null, history = null, previousContent = '' }) {
  const systemPrompt = [
    'You previously returned an invalid plan for a widget-based visual analytics agent.',
    'Remember: use only currently exposed actions, perceptions, and data-query surfaces from the provided knowledge and observation.',
    'Remember: action names are semantic widget operations; do not touch private Vega runtime internals, tuple stores, or signal handles.',
    'Remember: bar.clickCategory is for explicit in-page category click semantics, bar.selectCategory is for general selection semantics, and bar.filterCategories is for keep-only/filter-visible semantics.',
    'Remember: linked-view bar interactions must use bar.selectCategory or bar.clickCategory because bar.filterCategories is view-local and does not create a source selection for coordination links.',
    'Remember: reset or undo chart/view/zoom/filter view requests should use widget.resetView or widget.undoView when exposed, not workspace.resetWorkspace or widget.undoSelection.',
    'Return JSON only.',
    'Your JSON must contain assistantMessage, rationale, and operation.',
    'operation.kind must be exactly one of: action, perception, data_query.',
    'If operation.kind is action or perception, include operation.name.',
    'If operation.kind is action or perception, include operation.target.widgetRef. Choose exactly one widgetRef from observe.state.widgets[].ref.',
    'When required params need category, series, or line identifiers, choose exact values from observe.state.widgets[].data.fieldValues when available.',
    ...buildTemporaryWorkflowHints({ objective, observe }),
    'Do not include markdown fences or explanatory prose.',
  ].join(' ')

  const userPrompt = JSON.stringify({
    objective,
    knowledge: normalizeKnowledgeForPrompt(knowledge),
    observe: normalizeObserveForPrompt(observe, { objective }),
    history: normalizeHistoryForPrompt(history),
    previousContent,
    requiredShape: {
      assistantMessage: 'string',
      rationale: 'string',
      operation: {
        kind: 'action|perception|data_query',
        name: 'string when kind is action/perception',
        target: {
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

function buildReasonMessages({
  objective,
  observe,
  history,
  plan,
  result,
  verification,
  latestCoordinationResult,
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
    'If the overall user objective has been sufficiently answered, include completion.status as "answered".',
    'If another turn is still needed, omit completion or set completion.status to "continue".',
    ...buildTemporaryWorkflowHints({ objective, observe }),
  ].join(' ')

  const userPrompt = JSON.stringify({
    objective,
    observe: normalizeObserveForPrompt(observe, { objective }),
    history: normalizeHistoryForPrompt(history),
    plan: normalizePlanForPrompt(plan),
    result: normalizeResultForPrompt(plan, result),
    verification: normalizeVerificationForPrompt(plan, result, verification, observe),
    latestCoordinationResult: normalizeCoordinationResultForPrompt(latestCoordinationResult),
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
} = {}) {
  const systemPrompt = [
    'You are the final synthesis stage of a widget-based visual analytics agent.',
    'Synthesize the final answer from the user objective and all completed turns.',
    'Do not propose new actions.',
    'Do not mention raw provider internals unless necessary.',
    'Ground the answer in WidgetVA observations and action/perception results.',
    'Return JSON only.',
    'The JSON must contain answer.',
  ].join(' ')

  const compactTurns = Array.isArray(turns)
    ? turns.map((turn) => ({
      index: turn?.index,
      operation: turn?.act
        ? {
          kind: turn.act.kind || null,
          name: turn.act.name || null,
          params: clone(turn.act.params || {}),
        }
        : null,
      resultSummary: turn?.act?.outputSummary || null,
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
  })

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
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
  if (operation.dataRef || operation.query) return 'data_query'
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
    dataRef: operation.dataRef || null,
    query: clone(operation.query || null),
  }
}

function isExecutableOperation(operation = {}) {
  if (!operation || typeof operation !== 'object') return false
  if (operation.kind === 'action' || operation.kind === 'perception') {
    return typeof operation.name === 'string'
      && operation.name.trim().length > 0
      && typeof operation?.target?.widgetRef === 'string'
      && operation.target.widgetRef.length > 0
  }
  if (operation.kind === 'data_query') {
    return typeof operation.dataRef === 'string' && operation.dataRef.length > 0 && Boolean(operation.query)
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

function readCommonToolNames(knowledge = null, fieldName = '') {
  if (!fieldName) return []
  const descriptors = Array.isArray(knowledge?.commonTools?.[fieldName]) ? knowledge.commonTools[fieldName] : []
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
  const perceptionNames = [
    ...readFamilyNamesForWidget(knowledge, focusedWidgetKind, 'perceptions'),
    ...readCommonToolNames(knowledge, 'perceptions'),
  ].filter((name, index, names) => names.indexOf(name) === index)
  const fallbackPerception = choosePreferredName(perceptionNames, [
    'perception.inspectVisibleRows',
    'perception.inspectSelection',
    'perception.inspectViewConfig',
  ])

  if (fallbackPerception) {
    return {
      assistantMessage: 'I will inspect the current widget before taking a stronger interaction step.',
      rationale: 'The model response did not yield a valid executable operation, so the runtime is falling back to a perception that this workspace actually exposes.',
      kind: 'perception',
      name: fallbackPerception,
      ...(focusedWidgetRef ? { target: { widgetRef: focusedWidgetRef } } : {}),
      params: {},
      dataRef: null,
      query: null,
    }
  }

  return {
    assistantMessage: 'I could not produce a valid operation for the current workspace.',
    rationale: 'The model response did not yield a valid executable operation, and the current workspace catalog does not expose a fallback perception for the focused widget. WidgetVA will not guess a state-changing fallback action.',
    kind: null,
    name: null,
    ...(focusedWidgetRef ? { target: { widgetRef: focusedWidgetRef } } : {}),
    params: {},
    dataRef: null,
    query: null,
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
  } = {}) {
    const safeObjective = typeof objective === 'string' && objective.trim().length > 0
      ? objective.trim()
      : 'Inspect the current visualization workspace and take the next useful step.'

    const primaryResponse = await completeChat({
      model,
      temperature,
      messages: buildAgentMessages({
        objective: safeObjective,
        knowledge,
        observe,
        history,
      }),
    })

    const primaryContent = primaryResponse?.content || ''
    const primaryPlan = extractJsonObject(primaryContent)
    if (!primaryPlan) {
      throw new Error('Agent response did not contain valid JSON.')
    }

    let normalizedOperation = normalizeOperation(primaryPlan, observe)
    let resolvedResponse = primaryResponse
    let resolvedPlan = primaryPlan

    if (
      !isExecutableOperation(normalizedOperation)
      || !matchesTemporaryDemoOperation({
        operation: normalizedOperation,
        objective: safeObjective,
        observe,
        history,
      })
    ) {
      const repairedResponse = await completeChat({
        model,
        temperature,
        messages: buildRepairMessages({
          objective: safeObjective,
          knowledge,
          observe,
          history,
          previousContent: primaryContent,
        }),
      })
      const repairedContent = repairedResponse?.content || ''
      const repairedPlan = extractJsonObject(repairedContent)
      const repairedOperation = repairedPlan ? normalizeOperation(repairedPlan, observe) : null

      if (
        repairedPlan
        && isExecutableOperation(repairedOperation)
        && matchesTemporaryDemoOperation({
          operation: repairedOperation,
          objective: safeObjective,
          observe,
          history,
        })
      ) {
        resolvedResponse = repairedResponse
        resolvedPlan = repairedPlan
        normalizedOperation = repairedOperation
      } else {
        normalizedOperation = buildTemporaryDemoFallbackOperation({
          objective: safeObjective,
          observe,
          knowledge,
          history,
        }) || buildSafeFallbackOperation(observe, knowledge)
      }
    }

    if (!isExecutableOperation(normalizedOperation)) {
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
        ...(normalizedOperation.dataRef ? { dataRef: normalizedOperation.dataRef } : {}),
        ...(normalizedOperation.query ? { query: normalizedOperation.query } : {}),
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
  } = {}) {
    const response = await completeChat({
      model,
      temperature,
      messages: buildReasonMessages({
        objective,
        observe,
        history,
        plan,
        result,
        verification,
        latestCoordinationResult,
      }),
    })

    const content = response?.content || ''
    const parsed = extractJsonObject(content)
    if (parsed && typeof parsed.answer === 'string' && parsed.answer.trim().length > 0) {
      let completionStatus =
        typeof parsed?.completion?.status === 'string' && parsed.completion.status.trim().length > 0
          ? parsed.completion.status.trim()
          : null
      if (
        completionStatus === 'answered'
        && shouldContinueTemporaryDemo({
          objective,
          observe,
          history,
          plan,
          result,
        })
      ) {
        completionStatus = 'continue'
      }
      return {
        answer: parsed.answer.trim(),
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
  } = {}) {
    const response = await completeChat({
      model,
      temperature,
      messages: buildFinalSynthesisMessages({
        objective,
        history,
        turns,
        stopReason,
      }),
    })

    const content = response?.content || ''
    const parsed = extractJsonObject(content)
    const fallbackAnswer =
      Array.isArray(turns) && turns.length > 0
        ? turns.at(-1)?.reason?.answer || 'Completed the requested WidgetVA analysis.'
        : 'Completed the requested WidgetVA analysis.'

    return {
      answer: typeof parsed?.answer === 'string' && parsed.answer.trim().length > 0
        ? parsed.answer.trim()
        : fallbackAnswer,
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
    planner,
    reasoner,
  })
}

export async function runNaturalLanguageAgentSession(target, {
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
