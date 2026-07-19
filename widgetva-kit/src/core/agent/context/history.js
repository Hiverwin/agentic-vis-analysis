function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function summarizeValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => summarizeValue(entry)).join(', ')}]`
  }
  if (isPlainObject(value)) {
    return `{${Object.entries(value).map(([key, entry]) => `${key}:${summarizeValue(entry)}`).join(', ')}}`
  }
  if (value == null) return 'null'
  return String(value)
}

function summarizeParams(params = null) {
  if (!isPlainObject(params)) return null
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${summarizeValue(value)}`)
  return entries.length > 0 ? entries.join('; ') : null
}

function readOutcome(turn = {}) {
  const verifyOk = typeof turn?.verify?.ok === 'boolean' ? turn.verify.ok : null
  if (verifyOk === true) return 'verified'
  if (verifyOk === false) return 'needs_retry'

  const actOk = typeof turn?.act?.ok === 'boolean' ? turn.act.ok : null
  if (actOk === true) return 'completed'
  if (actOk === false) return 'failed'

  return 'completed'
}

function readNonEmptyString(value = null) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

export function summarizeTurnForSession(turn = {}, index = 0) {
  const actKind = turn?.act?.kind || null
  const actName = turn?.act?.name || null
  const paramsSummary = summarizeParams(turn?.act?.params)
  const resultSummary = readNonEmptyString(turn?.act?.outputSummary)
    || readNonEmptyString(turn?.result?.summary)
    || null
  const stateSummary = readNonEmptyString(turn?.verify?.summary)
    || readNonEmptyString(turn?.verification?.summary)
    || null
  const reasonSummary = readNonEmptyString(turn?.reason?.answer)
    || readNonEmptyString(turn?.plan?.assistantMessage)
    || null

  return {
    turnId: `turn_${index + 1}`,
    operation: {
      kind: actKind,
      name: actName,
      ...(paramsSummary ? { paramsSummary } : {}),
    },
    status: {
      outcome: readOutcome(turn),
      ...(resultSummary ? { resultSummary } : {}),
      ...(stateSummary ? { stateSummary } : {}),
      ...(reasonSummary ? { reasonSummary } : {}),
    },
  }
}

export function buildAgentHistory({ turns = [] } = {}) {
  return {
    turns: Array.isArray(turns)
      ? turns.map((turn, index) => summarizeTurnForSession(turn, index))
      : [],
  }
}

export function mergeSessionHistory(previousHistory = null, turns = []) {
  return {
    ...(clone(previousHistory) || {}),
    ...buildAgentHistory({ turns }),
  }
}

export function readTurnCompletionStatus(turn = null) {
  if (!turn || typeof turn !== 'object') return null

  const candidates = [
    turn?.reason?.completion?.status,
    turn?.reason?.completionStatus,
    turn?.reason?.stopReason,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate
    }
  }

  if (turn?.reason?.completed === true || turn?.reason?.answered === true) {
    return 'answered'
  }

  return null
}

export function shouldStopAgentSession(turn = null) {
  if (!turn || typeof turn !== 'object') return null

  const completionStatus = readTurnCompletionStatus(turn)
  if (completionStatus === 'answered' || completionStatus === 'completed') {
    return 'answered'
  }
  if (completionStatus === 'stopped' || completionStatus === 'failed') {
    return 'stopped'
  }

  if (turn?.act?.kind === 'action' && turn?.act?.ok === false) {
    return 'stopped'
  }

  if ((turn?.act?.kind === 'perception' || turn?.act?.kind === 'data_query') && turn?.verify?.ok === false) {
    return 'stopped'
  }

  return null
}
