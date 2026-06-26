import {
  getInteractionTraceEventFamily,
  getInteractionTraceQueryName,
  getInteractionTraceQuerySurface,
  makeInteractionTraceRecordSummary,
} from '../protocol/interactionTrace.js'

function normalizeString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : ''
}

export function summarizeInteractionTraceRecord(record) {
  if (!record || typeof record !== 'object') return null

  const eventFamily = record?.eventFamily || getInteractionTraceEventFamily(record)
  const querySurface = record?.querySurface || getInteractionTraceQuerySurface(record)
  const actionName = normalizeString(record?.action?.name)
  const queryName = normalizeString(getInteractionTraceQueryName(record?.query))
  const primitive = normalizeString(record?.primitive)
  const outcome = normalizeString(record?.notes?.outcome) || 'success'
  const errorCode = normalizeString(record?.notes?.errorCode) || null
  const errorMessage = normalizeString(record?.notes?.errorMessage) || null
  const details = record?.notes?.details ?? null
  const userVisibleSummary = normalizeString(record?.notes?.userVisibleSummary) || null
  const rationale = normalizeString(record?.notes?.rationale) || null
  const verification = normalizeString(record?.notes?.verification) || null
  const recoveryHints = Array.isArray(record?.notes?.recoveryHints)
    ? record.notes.recoveryHints.filter((hint) => typeof hint === 'string' && hint.trim().length > 0)
    : []

  let displayName = normalizeString(record?.eventKind) || 'event'
  if (eventFamily === 'action') {
    displayName = actionName || 'action'
  } else if (eventFamily === 'query') {
    displayName = queryName || `${querySurface || 'query'}.query`
  } else if (eventFamily === 'systemTransition') {
    displayName = primitive || 'transition'
  }

  return makeInteractionTraceRecordSummary({
    eventFamily,
    querySurface: querySurface || null,
    displayName,
    actor: normalizeString(record?.actor) || 'agent',
    stateId: normalizeString(record?.stateId) || null,
    parentStateId: normalizeString(record?.parentStateId) || null,
    branchId: normalizeString(record?.branchId) || 'main',
    primitive: primitive || null,
    affectedRefs: Array.isArray(record?.affectedRefs) ? [...record.affectedRefs] : [],
    outcome,
    errorCode,
    errorMessage,
    details,
    userVisibleSummary,
    rationale,
    verification,
    recoveryHints,
  })
}
