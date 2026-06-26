function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0))]
}

function formatVerificationRef(ref) {
  if (ref === 'shared') return 'shared state'
  if (ref === 'taskContext') return 'task context'
  return ref
}

export function normalizeActionConditions(conditions) {
  if (!Array.isArray(conditions)) return []
  return conditions
    .filter((condition) => condition && typeof condition === 'object')
    .map((condition) => ({
      description: typeof condition.description === 'string' ? condition.description : '',
      ...(typeof condition.checkHint === 'string' ? { checkHint: condition.checkHint } : {}),
      ...(typeof condition.failureMessage === 'string' ? { failureMessage: condition.failureMessage } : {}),
    }))
    .filter((condition) => condition.description || condition.checkHint || condition.failureMessage)
}

export function buildPostconditionVerificationHints({ descriptor, updatedRefs = [] } = {}) {
  const refs = Array.isArray(updatedRefs)
    ? updatedRefs
        .filter((ref) => typeof ref === 'string')
        .map((ref) => formatVerificationRef(ref))
    : []
  const refSummary = refs.length > 0 ? refs.join(', ') : null
  return normalizeActionConditions(descriptor?.postconditions).map((condition) => {
    if (condition.checkHint) return condition.checkHint
    if (refSummary) {
      return `Check ${refSummary} and confirm: ${condition.description}`
    }
    return `Confirm: ${condition.description}`
  })
}

export function buildActionVerificationPayload({ descriptor, updatedRefs = [], verificationHints = [] } = {}) {
  const expectedPostconditions = normalizeActionConditions(descriptor?.postconditions)
  const mergedHints = uniqueStrings([
    ...buildPostconditionVerificationHints({ descriptor, updatedRefs }),
    ...(Array.isArray(verificationHints) ? verificationHints : []),
  ])
  const verificationNote = expectedPostconditions.length === 0
    ? null
    : expectedPostconditions.length === 1
      ? `Expected postcondition: ${expectedPostconditions[0].description}`
      : `Expected postconditions: ${expectedPostconditions.map((condition) => condition.description).join('; ')}`
  return {
    expectedPostconditions: cloneValue(expectedPostconditions),
    verificationHints: mergedHints,
    verificationNote,
  }
}

export function resolveActionDescriptorForVerification({ store, actionName, targetRef, affectedRefs = [] } = {}) {
  if (!store || !actionName) return null
  const candidateRefs = [
    targetRef,
    ...(Array.isArray(affectedRefs) ? affectedRefs : []),
    null,
  ]
  for (const ref of candidateRefs) {
    const descriptor = store.getActionDescriptor(actionName, ref || undefined)
    if (descriptor) return descriptor
  }
  const descriptors = store.listActions()
  return descriptors.find((descriptor) => descriptor?.name === actionName) || null
}
