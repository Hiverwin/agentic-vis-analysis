import { cloneJsonValue as clone } from '../../../shared/clone.js'
import { buildTurnVerificationFeedback } from '../verification/turnVerification.js'

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

function deriveFormalRecoverableState(result = {}) {
  return result?.actionResult?.recoverableState
    || result?.recoverableState
    || result?.afterView
    || null
}

function deriveFormalResultFingerprint(result = {}, operationKind = null) {
  if (operationKind !== 'perception' && operationKind !== 'data_query') return null
  const runtimeResult = Object.prototype.hasOwnProperty.call(result, 'result')
    ? result.result
    : Object.prototype.hasOwnProperty.call(result?.actionResult || {}, 'result')
      ? result.actionResult.result
      : undefined
  if (runtimeResult === undefined) return null

  let serialized
  try {
    serialized = JSON.stringify(runtimeResult)
  } catch {
    return null
  }
  let hash = 0x811c9dc5
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function deriveFormalEvidence(result = {}, operationKind = null) {
  if (operationKind !== 'perception' && operationKind !== 'data_query') return null
  const runtimeResult = isPlainObject(result?.result)
    ? result.result
    : isPlainObject(result?.actionResult?.result)
      ? result.actionResult.result
      : null
  if (!runtimeResult) return null

  const recordKey = ['groups', 'aggregates', 'rows', 'anomalies', 'bottlenecks']
    .find((key) => Array.isArray(runtimeResult[key]))
  const records = recordKey
    ? runtimeResult[recordKey].slice(0, 16).map((record) => {
      if (!isPlainObject(record)) return record
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
  return {
    source: recordKey || 'result',
    scalars,
    records,
  }
}

function deriveFormalError(result = {}) {
  const error = result?.actionResult?.error || result?.error || null
  return error && typeof error === 'object' && !Array.isArray(error) ? clone(error) : null
}

function deriveFormalRecoveryHints(result = {}) {
  if (Array.isArray(result?.actionResult?.recoveryHints)) return clone(result.actionResult.recoveryHints)
  if (Array.isArray(result?.recoveryHints)) return clone(result.recoveryHints)
  return []
}

function deriveFormalVerificationOk(verification = null) {
  if (!verification || typeof verification !== 'object') return null
  if (typeof verification?.result?.verified === 'boolean') return verification.result.verified
  if (typeof verification?.result?.passed === 'boolean') return verification.result.passed
  if (typeof verification?.passed === 'boolean') return verification.passed
  if (typeof verification.ok === 'boolean') return verification.ok
  return null
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return null
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)))
}

function readResultObject(payload = null) {
  if (!payload || typeof payload !== 'object') return null
  if (isPlainObject(payload.result)) return payload.result
  if (isPlainObject(payload.actionResult?.result)) return payload.actionResult.result
  return null
}

function summarizeCorrelationResult(result = null) {
  if (!isPlainObject(result)) return null
  const coefficient = Number.isFinite(result.correlation)
    ? result.correlation
    : Number.isFinite(result.coefficient)
      ? result.coefficient
      : null
  if (!Number.isFinite(coefficient)) return null
  const parts = [`correlation=${formatNumber(coefficient)}`]
  const sampleSize = Number.isFinite(result.n)
    ? result.n
    : Number.isFinite(result.sampleSize)
      ? result.sampleSize
      : Number.isFinite(result.sample_size)
        ? result.sample_size
        : null
  if (Number.isFinite(sampleSize)) parts.push(`n=${formatNumber(sampleSize)}`)
  if (typeof result.xField === 'string' && result.xField.length > 0) parts.push(`xField=${result.xField}`)
  if (typeof result.yField === 'string' && result.yField.length > 0) parts.push(`yField=${result.yField}`)
  return parts.join('; ')
}

function readGroupLabel(group = {}) {
  const candidates = [
    group.group,
    group.category,
    group.key,
    group.name,
    group.value,
    group.label,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) return candidate
    if (Number.isFinite(candidate)) return String(candidate)
  }
  return null
}

function summarizeGroupRow(group = {}) {
  if (!isPlainObject(group)) return null
  const label = readGroupLabel(group)
  if (!label) return null
  const parts = [label]
  for (const key of ['count', 'mean', 'average', 'avg', 'sum', 'min', 'max', 'median', 'share', 'rate']) {
    const value = group[key]
    const formatted = formatNumber(value)
    if (formatted != null) parts.push(`${key}=${formatted}`)
  }
  return parts.length > 1 ? parts.join(' ') : null
}

function summarizeGroupedResult(result = null) {
  if (!isPlainObject(result)) return null
  const groups = Array.isArray(result.groups)
    ? result.groups
    : Array.isArray(result.aggregates)
      ? result.aggregates
      : Array.isArray(result.rows)
        ? result.rows
        : []
  if (groups.length === 0) return null
  const groupSummaries = groups
    .map((group) => summarizeGroupRow(group))
    .filter(Boolean)
  if (groupSummaries.length === 0) return null
  const prefix = Number.isFinite(result.rowCount)
    ? `${formatNumber(result.rowCount)} rows`
    : Number.isFinite(result.count)
      ? `${formatNumber(result.count)} rows`
      : null
  return [prefix, ...groupSummaries].filter(Boolean).join('; ')
}

function readRowLabel(row = {}, preferredKeys = []) {
  for (const key of preferredKeys) {
    const value = row?.[key]
    if (typeof value === 'string' && value.length > 0) return value
    if (Number.isFinite(value)) return String(value)
  }
  for (const key of ['date', 'Date', 'time', 'Time', 'month', 'Month', 'node', 'name', 'id', 'category', 'group']) {
    const value = row?.[key]
    if (typeof value === 'string' && value.length > 0) return value
    if (Number.isFinite(value)) return String(value)
  }
  return null
}

function summarizeRowValues(row = {}, { skipKeys = [], preferredKeys = [] } = {}) {
  if (!isPlainObject(row)) return null
  const skip = new Set([
    ...skipKeys,
    'date',
    'Date',
    'time',
    'Time',
    'month',
    'Month',
    'node',
    'name',
    'id',
    'category',
    'group',
  ])
  const entries = []
  const orderedKeys = [
    ...preferredKeys,
    ...Object.keys(row).filter((key) => !preferredKeys.includes(key)),
  ]
  for (const key of orderedKeys) {
    if (skip.has(key)) continue
    if (key.startsWith('__widgetva_')) continue
    const value = row[key]
    if (Number.isFinite(value)) entries.push(`${key}=${formatNumber(value)}`)
    else if (typeof value === 'string' && value.length > 0 && entries.length < 2) entries.push(`${key}=${value}`)
    if (entries.length >= 3) break
  }
  return entries.join(' ')
}

function summarizeRowsResult(result = null) {
  if (!isPlainObject(result) || !Array.isArray(result.rows) || result.rows.length === 0) return null
  const field = typeof result.field === 'string' && result.field.length > 0 ? result.field : null
  const direction = typeof result.direction === 'string' && result.direction.length > 0 ? result.direction : null
  const rowSummaries = result.rows
    .map((row) => {
      const label = readRowLabel(row)
      const values = summarizeRowValues(row, { preferredKeys: field ? [field] : [] })
      return [label, values].filter(Boolean).join(' ')
    })
    .filter(Boolean)
  if (rowSummaries.length === 0) return null
  const prefix = [direction, field].filter(Boolean).join(' ')
  return `${prefix || `${rowSummaries.length} rows`}: ${rowSummaries.join('; ')}`
}

function summarizeAnomalyResult(result = null) {
  if (!isPlainObject(result) || !Array.isArray(result.anomalies)) return null
  const stats = isPlainObject(result.stats) ? result.stats : {}
  const yField = typeof stats.yField === 'string' && stats.yField.length > 0 ? stats.yField : null
  const xField = typeof stats.xField === 'string' && stats.xField.length > 0 ? stats.xField : null
  const count = Number.isFinite(result.anomaly_count) ? result.anomaly_count : result.anomalies.length
  const anomalySummaries = result.anomalies
    .map((row) => {
      const label = readRowLabel(row, xField ? [xField] : [])
      const values = summarizeRowValues(row, { preferredKeys: yField ? [yField] : [] })
      return [label, values].filter(Boolean).join(' ')
    })
    .filter(Boolean)
  const parts = [`${formatNumber(count)} anomalies${yField ? ` for ${yField}` : ''}`]
  if (anomalySummaries.length > 0) parts.push(anomalySummaries.join('; '))
  if (Number.isFinite(stats.mean)) parts.push(`mean=${formatNumber(stats.mean)}`)
  const sampleSize = Number.isFinite(stats.sample_size) ? stats.sample_size : stats.sampleSize
  if (Number.isFinite(sampleSize)) parts.push(`sampleSize=${formatNumber(sampleSize)}`)
  return parts.join('; ')
}

function summarizeConversionResult(result = null) {
  if (!isPlainObject(result) || !isPlainObject(result.conversion)) return null
  const conversion = result.conversion
  const node = conversion.node || result.node || null
  const parts = []
  if (node) {
    const rate = Number.isFinite(conversion.rate) ? ` rate=${formatNumber(conversion.rate)}` : ''
    parts.push(`${node} conversion${rate}`)
  } else if (Number.isFinite(conversion.rate)) {
    parts.push(`conversion rate=${formatNumber(conversion.rate)}`)
  }
  for (const [key, label] of [
    ['inflow', 'inflow'],
    ['outflow', 'outflow'],
    ['loss', 'loss'],
    ['loss_rate', 'lossRate'],
  ]) {
    const formatted = formatNumber(conversion[key])
    if (formatted != null) parts.push(`${label}=${formatted}`)
  }
  return parts.length > 0 ? parts.join('; ') : null
}

function summarizeBottleneckResult(result = null) {
  if (!isPlainObject(result) || !Array.isArray(result.bottlenecks)) return null
  const bottleneckSummaries = result.bottlenecks
    .map((entry) => {
      const node = entry?.node || null
      if (!node) return null
      const parts = [node]
      for (const [key, label] of [
        ['loss_rate', 'lossRate'],
        ['loss', 'loss'],
        ['inflow', 'inflow'],
        ['outflow', 'outflow'],
      ]) {
        const formatted = formatNumber(entry?.[key])
        if (formatted != null) parts.push(`${label}=${formatted}`)
      }
      return parts.join(' ')
    })
    .filter(Boolean)
  if (bottleneckSummaries.length === 0) return typeof result.message === 'string' ? result.message : null
  return `bottlenecks: ${bottleneckSummaries.join('; ')}`
}

function compactEvidenceValue(value, depth = 0) {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (depth >= 4) return '[nested evidence]'
  if (Array.isArray(value)) {
    const compacted = value.map((entry) => compactEvidenceValue(entry, depth + 1))
    return compacted
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, compactEvidenceValue(entry, depth + 1)]),
    )
  }
  return String(value)
}

function summarizeNestedResult(payload = null) {
  const result = readResultObject(payload)
  if (!result) return null
  return (
    summarizeCorrelationResult(result)
    || summarizeAnomalyResult(result)
    || summarizeConversionResult(result)
    || summarizeBottleneckResult(result)
    || summarizeGroupedResult(result)
    || summarizeRowsResult(result)
    || (typeof result.message === 'string' && result.message.length > 0 ? result.message : null)
    || (typeof result.summary === 'string' && result.summary.length > 0 ? result.summary : null)
  )
}

export function summarizeFormalRuntimePayload(payload = null) {
  if (!payload || typeof payload !== 'object') return null
  if (typeof payload.summary === 'string' && payload.summary.length > 0) return payload.summary
  if (typeof payload.message === 'string' && payload.message.length > 0) return payload.message
  const nestedSummary = summarizeNestedResult(payload)
  if (nestedSummary) return nestedSummary
  if (typeof payload?.actionResult?.error?.message === 'string' && payload.actionResult.error.message.length > 0) return payload.actionResult.error.message
  if (typeof payload?.error?.message === 'string' && payload.error.message.length > 0) return payload.error.message
  if (typeof payload.result === 'string' && payload.result.length > 0) return payload.result
  if (payload?.result && typeof payload.result === 'object') {
    return JSON.stringify(compactEvidenceValue(payload.result))
  }
  return null
}

export function buildFormalPlanPayload(plan = {}) {
  const operation = plan?.operation || {}
  return {
    objective: plan?.objective || null,
    step: {
      kind: operation.kind,
      ...(operation.name ? { name: operation.name } : {}),
      ...(operation.target ? { target: clone(operation.target) } : {}),
      ...(operation.params && Object.keys(operation.params).length > 0 ? { params: clone(operation.params) } : {}),
      ...(operation.dataRef ? { dataRef: operation.dataRef } : {}),
      ...(operation.query ? { query: clone(operation.query) } : {}),
    },
    rationale: plan?.rationale || '',
  }
}

export function buildFormalActPayload(plan = {}, result = {}) {
  const operation = plan?.operation || {}
  const error = deriveFormalError(result)
  const recoveryHints = deriveFormalRecoveryHints(result)
  const recoverableState = deriveFormalRecoverableState(result)
  const resultFingerprint = deriveFormalResultFingerprint(result, operation.kind)
  const evidence = deriveFormalEvidence(result, operation.kind)
  return {
    kind: operation.kind,
    name: operation.name || operation.query?.kind || 'data_query',
    ...(operation.params && Object.keys(operation.params).length > 0 ? { params: clone(operation.params) } : {}),
    ...(operation.target ? { target: clone(operation.target) } : {}),
    ok: deriveFormalActOk(result),
    outputSummary: summarizeFormalRuntimePayload(result),
    ...(evidence ? { evidence } : {}),
    ...(resultFingerprint ? { resultFingerprint } : {}),
    stateId: deriveFormalStateId(result),
    updatedRefs: deriveFormalUpdatedRefs(result),
    ...(recoverableState ? { recoverableState: clone(recoverableState) } : {}),
    ...(error ? { error } : {}),
    ...(recoveryHints.length > 0 ? { recoveryHints } : {}),
  }
}

export function buildFormalVerifyPayload({ plan = {}, act = null, verification = null, observe = null } = {}) {
  const operation = plan?.operation || {}
  const beforeStateId = observe?.state?.stateId || null
  const verificationOk = deriveFormalVerificationOk(verification)
  const verificationSummary = summarizeFormalRuntimePayload(verification)
  const providedParams = plan?.operation?.params && typeof plan.operation.params === 'object' && !Array.isArray(plan.operation.params)
    ? plan.operation.params
    : {}
  const requiredParams = Array.isArray(act?.error?.details?.requiredParams)
    ? act.error.details.requiredParams
    : []
  return buildTurnVerificationFeedback({
    operationKind: operation?.kind || null,
    act,
    beforeStateId,
    requiredParams,
    providedParams,
    usageConfirmed: null,
    verificationOk,
    verificationSummary,
  })
}

export function buildFormalReasonPayload(baseReason = {}, { act = null, verify = null, plan = null } = {}) {
  const prefersRuntimeSummary = act?.kind === 'perception' || act?.kind === 'data_query'
  const completionStatus =
    typeof baseReason?.completion?.status === 'string' && baseReason.completion.status.length > 0
      ? baseReason.completion.status
      : typeof baseReason?.completionStatus === 'string' && baseReason.completionStatus.length > 0
        ? baseReason.completionStatus
        : null

  if (verify?.ok) {
    const assistantText = baseReason && Object.prototype.hasOwnProperty.call(baseReason, 'answer')
      && baseReason.answer !== null && baseReason.answer !== undefined
      ? baseReason.answer
      : plan?.assistantMessage || null
    const runtimeText = act?.outputSummary || null
    if (typeof assistantText !== 'string') {
      return {
        answer: assistantText,
        ...(completionStatus ? { completion: { status: completionStatus } } : {}),
      }
    }
    return {
      answer: prefersRuntimeSummary
        ? [assistantText, runtimeText].filter((part, index, array) => typeof part === 'string' && part.length > 0 && array.indexOf(part) === index).join(' ')
          || 'Completed one agent loop step.'
        : assistantText || runtimeText || 'Completed one agent loop step.',
      ...(completionStatus ? { completion: { status: completionStatus } } : {}),
    }
  }
  const fallbackAnswer = baseReason && Object.prototype.hasOwnProperty.call(baseReason, 'answer')
    && baseReason.answer !== null && baseReason.answer !== undefined
    ? baseReason.answer
    : plan?.assistantMessage
  return {
    answer: verify?.summary ?? fallbackAnswer ?? 'The last step did not verify cleanly.',
    ...(completionStatus ? { completion: { status: completionStatus } } : {}),
  }
}
