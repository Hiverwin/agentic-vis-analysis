function firstString(values = []) {
  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value === 'string' && value.length > 0) return value
  }
  return null
}

function normalizeRequiredParams(requiredParams = []) {
  return (Array.isArray(requiredParams) ? requiredParams : [])
    .filter((name, index, names) => typeof name === 'string' && name.length > 0 && names.indexOf(name) === index)
}

export function buildTurnVerificationFeedback({
  operationKind = null,
  act = null,
  beforeStateId = null,
  requiredParams = [],
  providedParams = {},
  usageConfirmed = null,
  verificationOk = null,
  verificationSummary = null,
} = {}) {
  const normalizedRequiredParams = normalizeRequiredParams(requiredParams)
  const safeProvidedParams = providedParams && typeof providedParams === 'object' && !Array.isArray(providedParams)
    ? providedParams
    : {}
  const actionErrorMessage = typeof act?.error?.message === 'string' && act.error.message.length > 0
    ? act.error.message
    : null

  const stepChoice = (() => {
    if (!act?.ok) {
      return {
        ok: false,
        summary: actionErrorMessage || 'The selected step did not execute successfully.',
      }
    }
    if (act?.kind === 'action' && usageConfirmed === false) {
      return {
        ok: false,
        summary: 'The requested action is not confirmed on the target widget.',
      }
    }
    if (act?.kind === 'action') {
      return {
        ok: true,
        summary: 'The runtime accepted and executed the requested action surface.',
      }
    }
    return {
      ok: true,
      summary: 'The turn executed a read-oriented step and produced an output.',
    }
  })()

  const params = (() => {
    if (!act?.ok) {
      const missingParams = normalizedRequiredParams.filter((paramName) => !(paramName in safeProvidedParams))
      return {
        ok: false,
        summary: missingParams.length > 0
          ? `Missing required parameters: ${missingParams.join(', ')}.`
          : 'The runtime rejected this step before parameters could be trusted.',
      }
    }
    if (normalizedRequiredParams.length === 0) {
      return {
        ok: true,
        summary: 'No required-parameter gaps were detected for this step.',
      }
    }
    const missingParams = normalizedRequiredParams.filter((paramName) => !(paramName in safeProvidedParams))
    if (missingParams.length > 0) {
      return {
        ok: false,
        summary: `Missing required parameters: ${missingParams.join(', ')}.`,
      }
    }
    return {
      ok: true,
      summary: 'Required parameters were present for this step.',
    }
  })()

  const stateChange = (() => {
    if (act?.kind !== 'action') {
      return {
        ok: null,
        summary: 'This turn did not execute a state-mutating action.',
      }
    }
    if (act?.stateId && beforeStateId && act.stateId !== beforeStateId) {
      return {
        ok: true,
        summary: `State changed from ${beforeStateId} to ${act.stateId}.`,
      }
    }
    if (!act?.ok) {
      return {
        ok: false,
        summary: 'The action did not complete successfully, so no state change can be confirmed.',
      }
    }
    return {
      ok: null,
      summary: 'The action returned success, but a distinct state transition was not confirmed.',
    }
  })()

  const visualChange = (() => {
    if (act?.kind !== 'action') {
      return {
        ok: null,
        summary: 'This turn did not request a visual state change.',
      }
    }
    if (!act?.ok) {
      return {
        ok: null,
        summary: 'Visual verification was skipped because the action did not execute successfully.',
      }
    }
    if (verificationOk === true) {
      return {
        ok: true,
        summary: verificationSummary || 'Verification confirmed the expected visible effect.',
      }
    }
    if (verificationOk === false) {
      return {
        ok: false,
        summary: verificationSummary || 'Verification reported that the visible effect was not achieved.',
      }
    }
    return {
      ok: null,
      summary: 'No explicit visual verification result was available for this action.',
    }
  })()

  const ok = Boolean(
    act?.ok
    && stepChoice.ok !== false
    && params.ok !== false
    && stateChange.ok !== false
    && visualChange.ok !== false,
  )

  const guidance = (() => {
    if (stepChoice.ok === false) {
      return 'Re-check whether the target widget actually exposes this step before retrying.'
    }
    if (params.ok === false) {
      return 'Re-check required parameters before retrying this step.'
    }
    if (stateChange.ok === false) {
      return 'Choose a simpler state-changing action or inspect the current state before retrying.'
    }
    if (visualChange.ok === false) {
      return 'Try a narrower or better-scoped action, then verify the visible effect again.'
    }
    if (act?.kind === 'action' && (stateChange.ok === null || visualChange.ok === null)) {
      return 'Inspect the current view or verification surface before deciding the next step.'
    }
    if (ok) {
      return 'This turn verified cleanly enough to answer unless the query explicitly requires another step.'
    }
    return `Choose a simpler, better-scoped next ${operationKind === 'action' ? 'action' : 'step'} based on the current state.`
  })()

  return {
    ok,
    summary: ok
      ? (visualChange.ok === true ? visualChange.summary : act?.outputSummary || 'The step executed successfully.')
      : firstString([
        stepChoice.ok === false ? stepChoice.summary : null,
        params.ok === false ? params.summary : null,
        stateChange.ok === false ? stateChange.summary : null,
        visualChange.ok === false ? visualChange.summary : null,
        params.summary,
        stateChange.summary,
        visualChange.summary,
        stepChoice.summary,
        'The step did not verify cleanly.',
      ]),
    checks: {
      stepChoice,
      params,
      stateChange,
      visualChange,
    },
    guidance,
  }
}
