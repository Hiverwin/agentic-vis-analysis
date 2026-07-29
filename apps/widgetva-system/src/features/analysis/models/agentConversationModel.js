import {
  collectPayloadLines,
  formatPreview,
  latestAssistantMessageText,
  readMessageText,
  uniqLines,
} from '../utils/agentPayloadFormatting.js'

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseJsonObject(value) {
  if (isPlainObject(value)) return value
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null
  try {
    const parsed = JSON.parse(trimmed)
    return isPlainObject(parsed) ? parsed : null
  } catch {
    return null
  }
}

function looksJsonLike(value) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.startsWith('{')
    || trimmed.startsWith('"{')
    || trimmed.startsWith('{\\')
    || trimmed.startsWith('\\"{')
}

function readableSummary(value, fallback = null) {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  if (parseJsonObject(value) || looksJsonLike(value)) {
    return fallback || 'structured verification evidence recorded'
  }
  return value
}

function compactRef(value) {
  if (typeof value !== 'string' || value.length === 0) return null
  const widgetMatch = value.match(/\/widget\/([^/]+)$/)
  if (widgetMatch?.[1]) return widgetMatch[1]
  if (value.length <= 42) return value
  return `...${value.slice(-36)}`
}

function compactStateId(value) {
  if (typeof value !== 'string' || value.length === 0) return null
  if (value.length <= 34) return value
  const separatorIndex = value.indexOf(':')
  if (separatorIndex > 0) {
    const prefix = value.slice(0, separatorIndex + 1)
    return `${prefix}...${value.slice(-8)}`
  }
  return `...${value.slice(-12)}`
}

function formatValue(value) {
  if (value == null) return ''
  if (Array.isArray(value)) {
    if (value.every((entry) => ['string', 'number', 'boolean'].includes(typeof entry))) {
      if (value.length === 2) return `${value[0]} to ${value[1]}`
      return value.join(', ')
    }
    return `${value.length} items`
  }
  if (isPlainObject(value)) return formatPreview(value)
  return String(value)
}

function formatParamLines(params = {}) {
  if (!isPlainObject(params) || Object.keys(params).length === 0) return []
  const lines = []
  if (params.xField && Array.isArray(params.xRange)) {
    lines.push(`${params.xField}: ${formatValue(params.xRange)}`)
  } else if (Array.isArray(params.xRange)) {
    lines.push(`xRange: ${formatValue(params.xRange)}`)
  }
  if (params.yField && Array.isArray(params.yRange)) {
    lines.push(`${params.yField}: ${formatValue(params.yRange)}`)
  } else if (Array.isArray(params.yRange)) {
    lines.push(`yRange: ${formatValue(params.yRange)}`)
  }
  for (const [key, value] of Object.entries(params)) {
    if (['xField', 'xRange', 'yField', 'yRange'].includes(key)) continue
    if (value == null || value === '') continue
    lines.push(`${key}: ${formatValue(value)}`)
  }
  return lines
}

function buildObservationLines(observe = {}, traceStep = null) {
  const state = observe?.state || {}
  const widgets = Array.isArray(state?.widgets) ? state.widgets : []
  const activeContextKinds = Array.isArray(state?.sharedAnalyticalState?.activeContextKinds)
    ? state.sharedAnalyticalState.activeContextKinds
    : []
  return uniqLines([
    ...(observe?.query ? [`Query: ${observe.query}`] : []),
    ...(state?.stateId ? [`State: ${compactStateId(state.stateId)}`] : []),
    ...(widgets.length > 0 ? [`Widgets in view: ${widgets.length}`] : []),
    ...(activeContextKinds.length > 0 ? [`Active context: ${activeContextKinds.join(', ')}`] : []),
    ...(!observe?.query && traceStep?.widgetTitle ? [`Target: ${traceStep.widgetTitle}`] : []),
  ])
}

function readVerificationPayload(verify = {}, toolResult = {}) {
  return parseJsonObject(verify?.summary)
    || parseJsonObject(verify?.checks?.visualChange?.summary)
    || parseJsonObject(toolResult?.summary)
    || parseJsonObject(toolResult?.verification?.summary)
    || null
}

function buildCheckLines(checks = {}) {
  if (!isPlainObject(checks)) return []
  const labels = {
    stepChoice: 'Step',
    params: 'Parameters',
    stateChange: 'State',
    visualChange: 'Visual',
  }
  return Object.entries(labels).flatMap(([key, label]) => {
    const check = checks[key]
    if (!isPlainObject(check)) return []
    const status = check.ok === true ? 'ok' : check.ok === false ? 'failed' : 'not checked'
    const summary = readableSummary(check.summary, 'structured verification evidence recorded')
    return [`${label}: ${status}${summary ? ` - ${summary}` : ''}`]
  })
}

function buildVerificationLines(verify = {}, toolResult = {}) {
  const payload = readVerificationPayload(verify, toolResult)
  const summary = payload
    ? null
    : readableSummary(
      verify?.summary || toolResult?.verification?.summary || null,
      'Structured verification evidence recorded.',
    )
  const affectedRefs = Array.isArray(payload?.affectedRefs)
    ? payload.affectedRefs
    : Array.isArray(verify?.affectedRefs)
      ? verify.affectedRefs
      : []
  return uniqLines([
    ...(typeof summary === 'string' && summary.trim().length > 0 ? [summary] : []),
    ...(payload?.matchedActionName ? [`Verified action: ${payload.matchedActionName}`] : []),
    ...(payload?.matchedStateId ? [`Matched state: ${payload.matchedStateId}`] : []),
    ...(typeof payload?.verified === 'boolean' ? [`Visual evidence: ${payload.verified ? 'verified' : 'not fully verified'}`] : []),
    ...(affectedRefs.length > 0 ? [`Affected widgets: ${affectedRefs.map(compactRef).filter(Boolean).join(', ')}`] : []),
    ...buildCheckLines(verify?.checks),
    ...(verify?.guidance ? [`Guidance: ${verify.guidance}`] : []),
  ])
}

function buildToolDetailLines({
  actionName,
  turn,
  traceStep,
  toolArgs,
  toolResult,
} = {}) {
  const targetRef = turn?.act?.target?.widgetRef
    || turn?.plan?.step?.target?.widgetRef
    || traceStep?.target?.widgetRef
    || null
  const updatedRefs = Array.isArray(turn?.act?.updatedRefs)
    ? turn.act.updatedRefs
    : Array.isArray(toolResult?.actionResult?.updatedRefs)
      ? toolResult.actionResult.updatedRefs
      : []
  const resultPayload = readVerificationPayload(turn?.verify, toolResult)
  const selectedCount = toolResult?.actionResult?.result?.selectedCount
    ?? toolResult?.result?.selectedCount
    ?? toolResult?.selectedCount
    ?? null
  return uniqLines([
    ...(actionName ? [`Operation: ${actionName}`] : []),
    ...(turn?.act?.kind ? [`Kind: ${turn.act.kind}`] : []),
    ...(targetRef ? [`Target: ${compactRef(targetRef)}`] : []),
    ...formatParamLines(toolArgs).map((line) => `Parameter: ${line}`),
    ...(typeof selectedCount === 'number' ? [`Selected records: ${selectedCount}`] : []),
    ...(turn?.act?.stateId ? [`Result state: ${turn.act.stateId}`] : []),
    ...(updatedRefs.length > 0 ? [`Updated widgets: ${updatedRefs.map(compactRef).filter(Boolean).join(', ')}`] : []),
    ...(resultPayload?.matchedActionName ? [`Verification matched: ${resultPayload.matchedActionName}`] : []),
    ...(traceStep?.evidenceSummary ? [`Evidence: ${traceStep.evidenceSummary}`] : []),
    ...(toolResult?.actionResult?.error?.message ? [`Error: ${toolResult.actionResult.error.message}`] : []),
    ...(toolResult?.error?.message ? [`Error: ${toolResult.error.message}`] : []),
  ])
}

export function buildIterationCardData(agentLastStep = null, agentMessages = [], assistantTextOverride = null) {
  if (!agentLastStep?.turn && !agentLastStep?.error && !agentLastStep?.traceStep) return null
  const turn = agentLastStep?.turn || {}
  const traceStep = agentLastStep?.traceStep || null
  const error = agentLastStep?.error || null
  const assistantText = typeof assistantTextOverride === 'string' && assistantTextOverride.trim().length > 0
    ? assistantTextOverride.trim()
    : latestAssistantMessageText(agentMessages)
  const planSummary = turn?.plan?.rationale || turn?.plan?.step?.name || null
  const actionName = turn?.act?.name || turn?.actionName || traceStep?.methodName || null
  const verificationSummary =
    traceStep?.verificationSummary
    || turn?.verify?.summary
    || (typeof turn?.verify?.ok === 'boolean' ? `verified: ${turn.verify.ok}` : null)
  const reasonSummary = turn?.answer || turn?.reason?.answer || assistantText || error || traceStep?.detail || traceStep?.summary || null
  const observeLines = buildObservationLines(turn?.observe, traceStep)
  const planLines = uniqLines([
    ...(planSummary ? [planSummary] : []),
    ...(turn?.plan?.step?.name ? [`Operation: ${turn.plan.step.name}`] : []),
    ...(turn?.plan?.step?.target?.widgetRef ? [`Target: ${compactRef(turn.plan.step.target.widgetRef)}`] : []),
    ...formatParamLines(turn?.plan?.step?.params || {}).map((line) => `Parameter: ${line}`),
  ])
  const reasonLines = uniqLines([
    ...(reasonSummary ? [reasonSummary] : []),
    ...collectPayloadLines(turn?.reason, { maxLines: 6 }),
  ])
  const toolArgs = turn?.act?.params || {}
  const toolResult = turn?.act?.result || turn?.act?.runtime || turn?.verify || turn?.act || {
    summary: traceStep?.summary || '',
    detail: traceStep?.detail || '',
    resultStateId: traceStep?.resultStateId || null,
  }
  const verifyLines = buildVerificationLines(turn?.verify, toolResult)
  const toolDetailLines = buildToolDetailLines({
    actionName,
    turn,
    traceStep,
    toolArgs,
    toolResult,
  })
  const toolResultPreview = formatPreview(
    turn?.act?.outputSummary
    || turn?.act?.summary
    || verifyLines[0]
    || turn?.answer
    || traceStep?.summary
    || toolResult,
  )
  const toolFailed = Boolean(
    error
    || turn?.act?.ok === false
    || turn?.verify?.ok === false
    || toolResult?.ok === false,
  )
  const phases = {
    observe: { status: observeLines.length > 0 ? 'completed' : 'pending', summary: observeLines[0] || '' },
    plan: { status: planLines.length > 0 ? 'completed' : 'pending', summary: planLines[0] || '' },
    act: { status: actionName ? 'completed' : 'pending', summary: actionName || '' },
    verify: { status: verifyLines.length > 0 ? 'completed' : 'pending', summary: verifyLines[0] || '' },
    reason: { status: reasonLines.length > 0 ? 'completed' : 'pending', summary: reasonLines[0] || '' },
  }

  const tools = actionName
    ? [{
        id: traceStep?.id || actionName,
        toolName: actionName,
        status: toolFailed ? 'failed' : 'success',
        args: toolArgs,
        result: toolResult,
        detailLines: toolDetailLines,
        resultPreview: toolResultPreview,
      }]
    : []
  const activePhase = actionName
    ? 'act'
    : verificationSummary
      ? 'verify'
      : planSummary
        ? 'plan'
        : observeLines.length > 0
          ? 'observe'
          : reasonSummary
            ? 'reason'
            : 'observe'

  return {
    iterKey: traceStep?.id || `agent-step-${agentLastStep?.recordedAt || Date.now()}`,
    iteration: traceStep?.stepNumber || 1,
    status: toolFailed || traceStep?.status === 'failed' ? 'failed' : traceStep?.status || 'completed',
    activePhase,
    phases,
    tools,
    observationLines: observeLines,
    planLines,
    verifyLines,
    reasoningLines: reasonLines,
    finalResponse: turn?.answer || turn?.reason?.answer || assistantText || error || traceStep?.detail || traceStep?.summary || '',
    stopReason: turn?.stopReason || (error ? 'failed' : traceStep?.status || ''),
    mode: agentLastStep?.model || '',
  }
}

export function buildAgentTraceIterationSources(trace = []) {
  return (Array.isArray(trace) ? trace : [])
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => step?.actor === 'agent')
    .map(({ step, index }) => ({
      model: 'trace',
      traceStep: {
        ...step,
        stepNumber: index + 1,
      },
      recordedAt: step?.time || null,
    }))
}

export function buildLatestTraceIterationSource(trace = []) {
  const safeTrace = Array.isArray(trace) ? trace : []
  for (let index = safeTrace.length - 1; index >= 0; index -= 1) {
    const step = safeTrace[index]
    if (step?.actor !== 'agent') continue
    return {
      model: 'trace',
      traceStep: {
        ...step,
        stepNumber: index + 1,
      },
      recordedAt: step?.time || null,
    }
  }
  return null
}

export function buildLatestMessageIterationSource(agentMessages = [], assistantText = null) {
  const text = typeof assistantText === 'string' && assistantText.trim().length > 0
    ? assistantText.trim()
    : latestAssistantMessageText(agentMessages)
  if (!text) return null
  return {
    model: 'message',
    traceStep: {
      id: `agent-message-${agentMessages.length}`,
      actor: 'agent',
      kind: 'reason',
      status: 'completed',
      summary: 'Agent response',
      detail: text,
      stepNumber: 1,
    },
    recordedAt: null,
  }
}

function withConversationIterationNumber(source = null, iterationNumber = 1) {
  if (!source) return source
  return {
    ...source,
    traceStep: {
      ...(source.traceStep || {}),
      stepNumber: iterationNumber,
    },
  }
}

export function buildAgentConversationItems({
  agentMessages = [],
  agentTraceSources = [],
  agentLastStep = null,
  agentError = null,
} = {}) {
  const items = []
  let assistantIndex = 0
  const safeMessages = Array.isArray(agentMessages) ? agentMessages : []
  safeMessages.forEach((message, index) => {
    const role = message?.role || 'assistant'
    const text = readMessageText(message)
    if (role === 'assistant') {
      const rawSource = index === safeMessages.length - 1 && agentLastStep
        ? agentLastStep
        : agentTraceSources[assistantIndex] || buildLatestMessageIterationSource(safeMessages, text)
      assistantIndex += 1
      items.push({
        id: `assistant-${index}`,
        type: 'iteration',
        source: withConversationIterationNumber(rawSource, assistantIndex),
        assistantText: text,
      })
      return
    }
    items.push({
      id: `${role}-${index}`,
      type: 'message',
      message: {
        ...message,
        role,
        text,
      },
    })
  })
  if (agentError) {
    items.push({
      id: 'agent-error',
      type: 'message',
      message: {
        role: 'error',
        text: agentError,
      },
    })
  }
  return items
}
