import { buildTurnVerificationFeedback } from '../verification/turnVerification.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
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

function deriveFormalRecoverableState(result = {}) {
  return result?.actionResult?.recoverableState
    || result?.recoverableState
    || result?.afterView
    || null
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

export function summarizeFormalRuntimePayload(payload = null) {
  if (!payload || typeof payload !== 'object') return null
  if (typeof payload.summary === 'string' && payload.summary.length > 0) return payload.summary
  if (typeof payload.message === 'string' && payload.message.length > 0) return payload.message
  if (typeof payload?.actionResult?.error?.message === 'string' && payload.actionResult.error.message.length > 0) return payload.actionResult.error.message
  if (typeof payload?.error?.message === 'string' && payload.error.message.length > 0) return payload.error.message
  if (typeof payload.result === 'string' && payload.result.length > 0) return payload.result
  if (payload?.result && typeof payload.result === 'object') {
    return JSON.stringify(payload.result).slice(0, 220)
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
  return {
    kind: operation.kind,
    name: operation.name || operation.query?.kind || 'data_query',
    ...(operation.params && Object.keys(operation.params).length > 0 ? { params: clone(operation.params) } : {}),
    ...(operation.target ? { target: clone(operation.target) } : {}),
    ok: deriveFormalActOk(result),
    outputSummary: summarizeFormalRuntimePayload(result),
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
    const assistantText = baseReason?.answer || plan?.assistantMessage || null
    const runtimeText = act?.outputSummary || null
    return {
      answer: prefersRuntimeSummary
        ? [assistantText, runtimeText].filter((part, index, array) => typeof part === 'string' && part.length > 0 && array.indexOf(part) === index).join(' ')
          || 'Completed one agent loop step.'
        : assistantText || runtimeText || 'Completed one agent loop step.',
      ...(completionStatus ? { completion: { status: completionStatus } } : {}),
    }
  }
  return {
    answer: verify?.summary || baseReason?.answer || plan?.assistantMessage || 'The last step did not verify cleanly.',
    ...(completionStatus ? { completion: { status: completionStatus } } : {}),
  }
}
