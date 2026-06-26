import { runPagePortAgentLoop } from './pagePortAgentLoop.js'

export const DEFAULT_OPENROUTER_AGENT_MODEL = 'deepseek/deepseek-v4-flash'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
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

function buildAgentMessages({ objective, observe }) {
  const systemPrompt = [
    'You are an analyst agent operating a widget-based visual analytics workspace.',
    'Your job is to convert the user objective into exactly one next structured operation.',
    'Use only the actions, perceptions, and data-query surfaces already exposed by the workspace observation.',
    'Return JSON only.',
    'The JSON must contain assistantMessage, rationale, and operation.',
    'operation.kind must be exactly one of: action, perception, data_query.',
    'If operation.kind is action or perception, include operation.name.',
    'If possible, include operation.queryScope.widgetRef.',
    'For action/perception operations, put arguments in operation.params.',
    'For data_query operations, include operation.dataRef and operation.query.',
    'Do not return markdown fences.',
  ].join(' ')

  const userPrompt = JSON.stringify({
    objective,
    observe,
  })

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
}

function buildRepairMessages({ objective, observe, previousContent = '' }) {
  const systemPrompt = [
    'You previously returned an invalid plan for a widget-based visual analytics agent.',
    'Return JSON only.',
    'Your JSON must contain assistantMessage, rationale, and operation.',
    'operation.kind must be exactly one of: action, perception, data_query.',
    'If operation.kind is action or perception, include operation.name.',
    'If possible, include operation.queryScope.widgetRef.',
    'Do not include markdown fences or explanatory prose.',
  ].join(' ')

  const userPrompt = JSON.stringify({
    objective,
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
  const widgets = Array.isArray(observe?.workspace?.widgets) ? observe.workspace.widgets : []
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

function buildSafeFallbackOperation(observe = {}) {
  const widgets = Array.isArray(observe?.workspace?.widgets) ? observe.workspace.widgets : []
  const focusedWidgetRef =
    observe?.observation?.focusedWidgetRef
    || observe?.loopContext?.view?.shared?.focusedWidget
    || widgets[0]?.ref
    || null

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
    actor = 'agent',
  } = {}) {
    const safeObjective = typeof objective === 'string' && objective.trim().length > 0
      ? objective.trim()
      : 'Inspect the current visualization workspace and take the next useful step.'

    const primaryResponse = await completeChat({
      model,
      temperature,
      messages: buildAgentMessages({
        objective: safeObjective,
        observe,
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

    if (!isExecutableOperation(normalizedOperation)) {
      const repairedResponse = await completeChat({
        model,
        temperature,
        messages: buildRepairMessages({
          objective: safeObjective,
          observe,
          previousContent: primaryContent,
        }),
      })
      const repairedContent = repairedResponse?.content || ''
      const repairedPlan = extractJsonObject(repairedContent)
      const repairedOperation = repairedPlan ? normalizeOperation(repairedPlan, observe) : null

      if (repairedPlan && isExecutableOperation(repairedOperation)) {
        resolvedResponse = repairedResponse
        resolvedPlan = repairedPlan
        normalizedOperation = repairedOperation
      } else {
        normalizedOperation = buildSafeFallbackOperation(observe)
      }
    }

    return {
      assistantMessage: normalizedOperation.assistantMessage,
      rationale: normalizedOperation.rationale,
      operation: {
        kind: normalizedOperation.kind,
        ...(normalizedOperation.name ? { name: normalizedOperation.name } : {}),
        ...(normalizedOperation.queryScope ? { queryScope: normalizedOperation.queryScope } : {}),
        ...(normalizedOperation.params ? { params: normalizedOperation.params } : {}),
        ...(normalizedOperation.dataRef ? { dataRef: normalizedOperation.dataRef } : {}),
        ...(normalizedOperation.query ? { query: normalizedOperation.query } : {}),
      },
      actor,
      source: 'planner',
      model,
      rawResponse: clone(resolvedResponse?.raw || null),
      rawContent: resolvedResponse?.content || '',
      rawPlan: clone(resolvedPlan),
    }
  }
}

export async function runNaturalLanguagePagePortAgentLoop(port, {
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

  return runPagePortAgentLoop(port, {
    ...loopOptions,
    objective,
    planner,
  })
}
