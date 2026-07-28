import { RUNTIME_ACTORS } from '../../../schemas/actors.schema.js'
import {
  INTERACTION_TRACE_QUERY_EVENT_KINDS,
} from '../../../schemas/interaction-trace.schema.js'

export function getInteractionTraceEventFamily(recordOrEventKind) {
  const eventKind =
    typeof recordOrEventKind === 'string'
      ? recordOrEventKind
      : recordOrEventKind?.eventKind || null
  if (INTERACTION_TRACE_QUERY_EVENT_KINDS.includes(eventKind)) {
    return 'query'
  }
  if (eventKind === 'systemTransition') {
    return 'systemTransition'
  }
  return 'action'
}

export function getInteractionTraceQuerySurface(recordOrEventKind) {
  const eventKind =
    typeof recordOrEventKind === 'string'
      ? recordOrEventKind
      : recordOrEventKind?.eventKind || null
  if (eventKind === 'perceptionQuery') {
    return 'perception'
  }
  if (eventKind === 'dataQuery') {
    return 'data'
  }
  return null
}

export function makeInteractionTraceRecord(record = {}) {
  const hasAction = !!record?.action
  const hasQuery = !!record?.query
  const eventKind = record?.eventKind || (hasAction ? 'action' : hasQuery ? 'perceptionQuery' : 'systemTransition')
  const eventFamily = record?.eventFamily || getInteractionTraceEventFamily(eventKind)
  const querySurface = record?.querySurface || getInteractionTraceQuerySurface(eventKind)

  return {
    timestamp: new Date().toISOString(),
    actor: RUNTIME_ACTORS[0],
    eventKind,
    eventFamily,
    querySurface,
    affectedRefs: [],
    parentStateId: null,
    branchId: null,
    primitive: null,
    statePatch: {},
    notes: {},
    ...record,
  }
}

export function getInteractionTraceQueryName(query) {
  if (typeof query?.name === 'string' && query.name.length > 0) {
    return query.name
  }
  if (typeof query?.query?.kind === 'string' && query.query.kind.length > 0) {
    return `data.${query.query.kind}`
  }
  return null
}

export function makeInteractionTraceRecordSummary(summary = {}) {
  return {
    eventFamily: 'action',
    querySurface: null,
    displayName: 'event',
    actor: RUNTIME_ACTORS[0],
    stateId: null,
    parentStateId: null,
    branchId: 'main',
    primitive: null,
    affectedRefs: [],
    outcome: 'success',
    errorCode: null,
    errorMessage: null,
    details: null,
    userVisibleSummary: null,
    rationale: null,
    verification: null,
    recoveryHints: [],
    ...summary,
  }
}
