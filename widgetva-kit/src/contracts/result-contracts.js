function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  )
}

export function makeResultError(error) {
  return {
    code: 'RUNTIME_ERROR',
    message: '',
    ...error,
  }
}

export function makeActionResult(result) {
  return compactObject({
    ok: false,
    callId: '',
    actionName: 'unknown',
    updatedRefs: [],
    stateId: null,
    statePatch: {},
    expectedPostconditions: [],
    verificationHints: [],
    ...result,
  })
}

export function makePerceptionResult(result) {
  return compactObject({
    ok: false,
    callId: '',
    queryName: 'unknown',
    result: null,
    ...result,
  })
}

export function makeActionVerificationResult(result) {
  return {
    verified: false,
    matchedStateId: null,
    matchedActionName: null,
    affectedRefs: [],
    missingRefs: [],
    expectedPostconditions: [],
    verificationHints: [],
    traceEvidence: null,
    statePatch: null,
    finalSnapshot: null,
    linkPropagation: [],
    semanticVerification: null,
    ...result,
  }
}

export function makeDataQueryResult(result) {
  return compactObject({
    ok: false,
    dataRef: null,
    result: null,
    ...result,
  })
}
