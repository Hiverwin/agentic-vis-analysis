import { cloneJsonValue as clone } from '../../../shared/clone.js'
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
  const target = isPlainObject(turn?.act?.target) ? clone(turn.act.target) : null
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
      ...(target ? { target } : {}),
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

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(',')}]`
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function repeatedPerceptionMadeNoProgress(turns = []) {
  if (!Array.isArray(turns) || turns.length < 2) return false
  const previous = turns.at(-2)
  const current = turns.at(-1)
  const currentKind = current?.act?.kind
  if (currentKind !== 'perception' && currentKind !== 'data_query') return false
  if (previous?.act?.kind !== currentKind) return false
  if (previous?.act?.ok !== true || current?.act?.ok !== true) return false
  if (previous?.verify?.ok !== true || current?.verify?.ok !== true) return false
  if (typeof previous?.act?.resultFingerprint !== 'string') return false
  if (typeof current?.act?.resultFingerprint !== 'string') return false

  const previousOperation = {
    name: previous.act.name || null,
    target: previous.act.target || null,
    params: previous.act.params || null,
  }
  const currentOperation = {
    name: current.act.name || null,
    target: current.act.target || null,
    params: current.act.params || null,
  }
  return stableJson(previousOperation) === stableJson(currentOperation)
    && previous.act.resultFingerprint === current.act.resultFingerprint
}

export function shouldStopAgentSession(turn = null, { turns = [] } = {}) {
  if (!turn || typeof turn !== 'object') return null

  const completionStatus = readTurnCompletionStatus(turn)
  if (
    (completionStatus === 'answered' || completionStatus === 'completed')
    && turn?.act?.ok !== false
    && turn?.verify?.ok === true
  ) {
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

  if (repeatedPerceptionMadeNoProgress(turns)) return 'no_progress'

  return null
}
