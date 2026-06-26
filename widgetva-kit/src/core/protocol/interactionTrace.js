import { describeRuntimeActorSchema, RUNTIME_ACTORS } from './actors.js'
import { describeActionCallSchema } from './actions.js'
import { describeDataQueryCallSchema } from './dataHandles.js'
import { describeRefSchema } from './refs.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export const INTERACTION_TRACE_EVENT_KINDS = ['action', 'perceptionQuery', 'dataQuery', 'systemTransition']
export const INTERACTION_TRACE_QUERY_EVENT_KINDS = ['perceptionQuery', 'dataQuery']
export const INTERACTION_TRACE_EVENT_FAMILIES = ['action', 'query', 'systemTransition']
export const INTERACTION_TRACE_QUERY_SURFACES = ['perception', 'data']

export function describeInteractionTraceActorSchema() {
  return describeRuntimeActorSchema()
}

export function describeInteractionTraceEventKindSchema() {
  return cloneValue({
    type: 'string',
    enum: INTERACTION_TRACE_EVENT_KINDS,
  })
}

export function describeInteractionTraceEventFamilySchema() {
  return cloneValue({
    type: 'string',
    enum: INTERACTION_TRACE_EVENT_FAMILIES,
  })
}

export function describeInteractionTraceQuerySurfaceSchema() {
  return cloneValue({
    type: 'string',
    enum: INTERACTION_TRACE_QUERY_SURFACES,
  })
}

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

export function makeInteractionTraceRecord(record) {
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

export function describeInteractionTraceNotesSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      outcome: { type: 'string', enum: ['success', 'failure'] },
      errorCode: { type: 'string' },
      errorMessage: { type: 'string' },
      details: {},
      recoveryHints: { type: 'array', items: { type: 'string' } },
      rationale: { type: 'string' },
      verification: { type: 'string' },
      userVisibleSummary: { type: 'string' },
    },
  })
}

export function describeInteractionTraceActionSchema() {
  return cloneValue({
    anyOf: [
      {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          targetRef: describeRefSchema(),
          params: { type: 'object' },
          actor: describeRuntimeActorSchema(),
          callId: { type: 'string' },
        },
      },
      describeActionCallSchema(),
    ],
  })
}

export function describeInteractionTraceQuerySchema() {
  return cloneValue({
    anyOf: [
      describeDataQueryCallSchema(),
      {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          targetRef: describeRefSchema(),
          params: { type: 'object' },
          actor: describeRuntimeActorSchema(),
          callId: { type: 'string' },
        },
      },
    ],
  })
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

export function describeInteractionTraceRecordSchema() {
  return cloneValue({
    type: 'object',
    required: ['actor', 'eventFamily', 'eventKind', 'affectedRefs', 'stateId', 'timestamp'],
    properties: {
      stateId: { type: 'string' },
      parentStateId: { type: ['string', 'null'] },
      branchId: { type: ['string', 'null'] },
      actor: describeInteractionTraceActorSchema(),
      eventFamily: describeInteractionTraceEventFamilySchema(),
      eventKind: describeInteractionTraceEventKindSchema(),
      querySurface: {
        anyOf: [
          { type: 'null' },
          describeInteractionTraceQuerySurfaceSchema(),
        ],
      },
      primitive: { type: ['string', 'null'] },
      action: {
        anyOf: [
          { type: 'null' },
          describeInteractionTraceActionSchema(),
        ],
      },
      query: {
        anyOf: [
          { type: 'null' },
          describeInteractionTraceQuerySchema(),
        ],
      },
      affectedRefs: { type: 'array', items: describeRefSchema() },
      statePatch: { type: 'object' },
      timestamp: { type: 'string' },
      notes: describeInteractionTraceNotesSchema(),
    },
  })
}

export function describeInteractionTraceRecordSummarySchema() {
  return cloneValue({
    type: 'object',
    required: ['eventFamily', 'displayName', 'actor', 'affectedRefs', 'outcome', 'recoveryHints'],
    properties: {
      eventFamily: describeInteractionTraceEventFamilySchema(),
      querySurface: {
        anyOf: [
          { type: 'null' },
          describeInteractionTraceQuerySurfaceSchema(),
        ],
      },
      displayName: { type: 'string' },
      actor: describeInteractionTraceActorSchema(),
      stateId: { type: ['string', 'null'] },
      parentStateId: { type: ['string', 'null'] },
      branchId: { type: 'string' },
      primitive: { type: ['string', 'null'] },
      affectedRefs: { type: 'array', items: describeRefSchema() },
      outcome: { type: 'string', enum: ['success', 'failure'] },
      errorCode: { type: ['string', 'null'] },
      errorMessage: { type: ['string', 'null'] },
      details: {},
      userVisibleSummary: { type: ['string', 'null'] },
      rationale: { type: ['string', 'null'] },
      verification: { type: ['string', 'null'] },
      recoveryHints: { type: 'array', items: { type: 'string' } },
    },
  })
}
