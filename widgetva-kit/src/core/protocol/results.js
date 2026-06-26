import { describeRuntimeActorSchema } from './actors.js'
import { describeActionConditionSchema } from './actions.js'
import {
  describeInteractionTraceEventFamilySchema,
  describeInteractionTraceNotesSchema,
  describeInteractionTraceQuerySurfaceSchema,
  describeInteractionTraceRecordSchema,
} from './interactionTrace.js'
import {
  describeSelectionStateSchema,
  describeWorkspaceReplayContextSchema,
} from './state.js'
import { normalizeCanonicalPropagationSkipReason } from '../runtime/propagationReasons.js'

export { describeWorkspaceReplayContextSchema } from './state.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  )
}

export const RESULT_ERROR_CODES = [
  'UNKNOWN_OPERATION',
  'UNSUPPORTED_TARGET',
  'INVALID_PARAMS',
  'PRECONDITION_FAILED',
  'RUNTIME_ERROR',
  'UNKNOWN_QUERY',
  'UNKNOWN_DATA_REF',
  'UNKNOWN_QUERY_KIND',
  'UNSUPPORTED_QUERY_KIND',
  'INVALID_QUERY_SPEC',
]

export function describeResultErrorSchema() {
  return cloneValue({
    type: 'object',
    required: ['code', 'message'],
    properties: {
      code: { type: 'string', enum: RESULT_ERROR_CODES },
      message: { type: 'string' },
      details: {},
    },
  })
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

export function describeActionResultSchema() {
  return cloneValue({
    type: 'object',
    required: ['ok', 'callId', 'actionName'],
    properties: {
      ok: { type: 'boolean' },
      callId: { type: 'string' },
      actionName: { type: 'string' },
      updatedRefs: { type: 'array', items: { type: 'string' } },
      stateId: { type: ['string', 'null'] },
      statePatch: { type: 'object' },
      result: {},
      expectedPostconditions: { type: 'array', items: describeActionConditionSchema() },
      verificationHints: { type: 'array', items: { type: 'string' } },
      recoveryHints: { type: 'array', items: { type: 'string' } },
      error: describeResultErrorSchema(),
    },
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

export function describePerceptionResultSchema() {
  return cloneValue({
    type: 'object',
    required: ['ok', 'callId', 'queryName'],
    properties: {
      ok: { type: 'boolean' },
      callId: { type: 'string' },
      queryName: { type: 'string' },
      result: {},
      recoveryHints: { type: 'array', items: { type: 'string' } },
      error: describeResultErrorSchema(),
    },
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
    ...result,
  }
}

export function describeActionVerificationResultSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      verified: { type: 'boolean' },
      matchedStateId: { type: ['string', 'null'] },
      matchedActionName: { type: ['string', 'null'] },
      affectedRefs: { type: 'array', items: { type: 'string' } },
      missingRefs: { type: 'array', items: { type: 'string' } },
      expectedPostconditions: { type: 'array', items: describeActionConditionSchema() },
      verificationHints: { type: 'array', items: { type: 'string' } },
      traceEvidence: {
        anyOf: [describeInteractionTraceRecordSchema(), { type: 'null' }],
      },
      statePatch: { type: ['object', 'null'] },
      finalSnapshot: {
        anyOf: [describeWorkspaceSnapshotSchema(), { type: 'null' }],
      },
      linkPropagation: {
        type: 'array',
        items: describeLinkPropagationEvaluationSchema(),
      },
    },
  })
}

export function makeDataQueryResult(result) {
  return compactObject({
    ok: false,
    dataRef: null,
    result: null,
    ...result,
  })
}

export function describeDataQueryResultSchema() {
  return cloneValue({
    type: 'object',
    required: ['ok', 'dataRef'],
    properties: {
      ok: { type: 'boolean' },
      dataRef: { type: ['string', 'null'] },
      result: {},
      recoveryHints: { type: 'array', items: { type: 'string' } },
      error: describeResultErrorSchema(),
    },
  })
}

export function makeStateSnapshotMeta(meta) {
  return {
    stateId: '',
    createdAt: null,
    baseStateId: null,
    branchId: null,
    transitionType: 'continue',
    branchLabel: null,
    actor: 'system',
    changedRefs: [],
    removedRefs: [],
    ...meta,
  }
}

export function describeStateSnapshotMetaSchema() {
  return cloneValue({
    type: 'object',
    required: ['stateId'],
    properties: {
      stateId: { type: 'string' },
      createdAt: { type: ['string', 'null'] },
      baseStateId: { type: ['string', 'null'] },
      branchId: { type: ['string', 'null'] },
      transitionType: { type: 'string' },
      branchLabel: { type: ['string', 'null'] },
      actor: describeRuntimeActorSchema(),
      changedRefs: { type: 'array', items: { type: 'string' } },
      removedRefs: { type: 'array', items: { type: 'string' } },
    },
  })
}

export function makeWorkspaceSnapshotMeta(meta) {
  return {
    stateId: null,
    parentStateId: null,
    branchId: null,
    transitionType: null,
    branchLabel: null,
    ...meta,
  }
}

export function describeWorkspaceSnapshotMetaSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      stateId: { type: ['string', 'null'] },
      parentStateId: { type: ['string', 'null'] },
      branchId: { type: ['string', 'null'] },
      transitionType: { type: ['string', 'null'] },
      branchLabel: { type: ['string', 'null'] },
    },
  })
}

export function makeWorkspaceSnapshot(snapshot) {
  return {
    stateId: '',
    createdAt: new Date().toISOString(),
    widgets: {},
    shared: {},
    taskContext: null,
    delta: null,
    replayContext: null,
    __meta: null,
    ...snapshot,
  }
}

export function describeWorkspaceSnapshotSchema() {
  return cloneValue({
    type: 'object',
    required: ['stateId', 'createdAt', 'widgets', 'shared'],
    properties: {
      stateId: { type: 'string' },
      createdAt: { type: 'string' },
      widgets: { type: 'object' },
      shared: { type: 'object' },
      taskContext: { type: ['object', 'null'] },
      delta: { type: ['object', 'null'] },
      replayContext: {
        anyOf: [describeWorkspaceReplayContextSchema(), { type: 'null' }],
      },
      __meta: {
        anyOf: [describeWorkspaceSnapshotMetaSchema(), { type: 'null' }],
      },
    },
  })
}

export function makeBranchSummary(summary) {
  return {
    branchId: '',
    label: '',
    originStateId: null,
    parentBranchId: null,
    createdAt: new Date().toISOString(),
    ...summary,
  }
}

export function describeBranchSummarySchema() {
  return cloneValue({
    type: 'object',
    required: ['branchId', 'label', 'createdAt'],
    properties: {
      branchId: { type: 'string' },
      label: { type: 'string' },
      originStateId: { type: ['string', 'null'] },
      parentBranchId: { type: ['string', 'null'] },
      createdAt: { type: 'string' },
    },
  })
}

export function makeTraceGraphNode(node) {
  return {
    id: '',
    stateId: '',
    parentStateId: null,
    branchId: null,
    branchLabel: null,
    timestamp: null,
    actor: 'system',
    eventFamily: 'systemTransition',
    querySurface: null,
    actionName: null,
    queryName: null,
    responseId: null,
    responseActor: null,
    responsePreview: null,
    label: '',
    transitionType: 'continue',
    current: false,
    ...node,
  }
}

export function describeTraceGraphNodeSchema() {
  return cloneValue({
    type: 'object',
    required: ['id', 'stateId'],
    properties: {
      id: { type: 'string' },
      stateId: { type: 'string' },
      parentStateId: { type: ['string', 'null'] },
      branchId: { type: ['string', 'null'] },
      branchLabel: { type: ['string', 'null'] },
      timestamp: { type: ['string', 'null'] },
      actor: describeRuntimeActorSchema(),
      eventFamily: describeInteractionTraceEventFamilySchema(),
      querySurface: {
        anyOf: [{ type: 'null' }, describeInteractionTraceQuerySurfaceSchema()],
      },
      actionName: { type: ['string', 'null'] },
      queryName: { type: ['string', 'null'] },
      responseId: { type: ['string', 'null'] },
      responseActor: {
        anyOf: [describeRuntimeActorSchema(), { type: 'null' }],
      },
      responsePreview: { type: ['string', 'null'] },
      label: { type: 'string' },
      transitionType: { type: 'string' },
      current: { type: 'boolean' },
    },
  })
}

export function makeTraceGraphEdge(edge) {
  return {
    id: '',
    from_id: '',
    to_id: '',
    edge_type: 'continue',
    branchId: null,
    label: 'continue',
    timestamp: null,
    ...edge,
  }
}

export function describeTraceGraphEdgeSchema() {
  return cloneValue({
    type: 'object',
    required: ['id', 'from_id', 'to_id'],
    properties: {
      id: { type: 'string' },
      from_id: { type: 'string' },
      to_id: { type: 'string' },
      edge_type: { type: 'string' },
      branchId: { type: ['string', 'null'] },
      label: { type: 'string' },
      timestamp: { type: ['string', 'null'] },
    },
  })
}

export function makeTraceGraph(graph) {
  return {
    current_state_id: null,
    current_branch_id: null,
    sinceStateId: null,
    actors: [],
    ...graph,
    branches: Array.isArray(graph?.branches)
      ? graph.branches.map((branch) => makeBranchSummary(branch))
      : [],
    nodes: Array.isArray(graph?.nodes)
      ? graph.nodes.map((node) => makeTraceGraphNode(node))
      : [],
    edges: Array.isArray(graph?.edges)
      ? graph.edges.map((edge) => makeTraceGraphEdge(edge))
      : [],
  }
}

export function describeTraceGraphSchema() {
  return cloneValue({
    type: 'object',
    required: ['current_state_id', 'current_branch_id', 'branches', 'nodes', 'edges'],
    properties: {
      current_state_id: { type: ['string', 'null'] },
      current_branch_id: { type: ['string', 'null'] },
      sinceStateId: { type: ['string', 'null'] },
      actors: { type: 'array', items: describeRuntimeActorSchema() },
      branches: { type: 'array', items: describeBranchSummarySchema() },
      nodes: { type: 'array', items: describeTraceGraphNodeSchema() },
      edges: { type: 'array', items: describeTraceGraphEdgeSchema() },
    },
  })
}

export function describeLinkPropagationCheckSchema() {
  return cloneValue({
    type: 'object',
    required: ['name', 'passed'],
    properties: {
      name: { type: 'string' },
      passed: { type: 'boolean' },
      actual: {},
      expected: {},
    },
  })
}

export function makeLinkPropagationCheck(check) {
  return compactObject({
    name: '',
    passed: false,
    ...check,
  })
}

export function describeLinkPropagationResultSchema() {
  return cloneValue({
    type: 'object',
    required: ['linkRef', 'primitive', 'passed', 'checks'],
    properties: {
      linkRef: { type: 'string' },
      primitive: { type: 'string' },
      targetRef: { type: ['string', 'null'] },
      activationPolicy: { type: 'string' },
      effectConstraint: { type: ['string', 'null'] },
      responseSpec: { type: ['object', 'null'] },
      reason: { type: ['string', 'null'] },
      passed: { type: 'boolean' },
      checks: {
        type: 'array',
        items: describeLinkPropagationCheckSchema(),
      },
    },
  })
}

export function makeLinkPropagationResult(result) {
  return compactObject({
    linkRef: '',
    primitive: '',
    targetRef: null,
    activationPolicy: 'automatic',
    effectConstraint: null,
    responseSpec: null,
    reason: null,
    passed: false,
    ...result,
    reason: typeof result?.reason === 'string' && result.reason.length > 0
      ? normalizeCanonicalPropagationSkipReason(result.reason, 'mappingFailed')
      : null,
    checks: Array.isArray(result?.checks)
      ? result.checks.map((item) => makeLinkPropagationCheck(item))
      : [],
  })
}

export function describeLinkPropagationEvaluationSchema() {
  return cloneValue({
    type: 'object',
    required: ['ok', 'sourceRef', 'linkCount', 'passedCount', 'consistencyScore', 'results'],
    properties: {
      ok: { type: 'boolean' },
      sourceRef: { type: ['string', 'null'] },
      activeSelection: {
        anyOf: [describeSelectionStateSchema(), { type: 'null' }],
      },
      linkCount: { type: 'integer' },
      passedCount: { type: 'integer' },
      consistencyScore: { type: 'number' },
      results: {
        type: 'array',
        items: describeLinkPropagationResultSchema(),
      },
    },
  })
}

export function makeLinkPropagationEvaluation(evaluation) {
  return {
    ok: true,
    sourceRef: null,
    activeSelection: null,
    linkCount: 0,
    passedCount: 0,
    consistencyScore: 1,
    ...evaluation,
    results: Array.isArray(evaluation?.results)
      ? evaluation.results.map((item) => makeLinkPropagationResult(item))
      : [],
  }
}

export function makeStateDeltaTraceEntry(entry) {
  return {
    stateId: '',
    actor: 'agent',
    eventKind: null,
    eventFamily: null,
    querySurface: null,
    actionName: null,
    queryName: null,
    primitive: null,
    affectedRefs: [],
    statePatch: {},
    timestamp: null,
    ...entry,
  }
}

export function describeStateDeltaTraceEntrySchema() {
  return cloneValue({
    type: 'object',
    properties: {
      stateId: { type: 'string' },
      actor: describeRuntimeActorSchema(),
      eventKind: { type: ['string', 'null'] },
      eventFamily: { type: ['string', 'null'] },
      querySurface: {
        anyOf: [{ type: 'null' }, describeInteractionTraceQuerySurfaceSchema()],
      },
      actionName: { type: ['string', 'null'] },
      queryName: { type: ['string', 'null'] },
      primitive: { type: ['string', 'null'] },
      affectedRefs: { type: 'array', items: { type: 'string' } },
      statePatch: { type: 'object' },
      timestamp: { type: ['string', 'null'] },
    },
  })
}

export function makeBranchReplayEventEntry(entry) {
  return {
    stateId: '',
    parentStateId: null,
    branchId: null,
    actor: 'system',
    transitionType: null,
    affectedRefs: [],
    statePatch: {},
    notes: {},
    timestamp: null,
    ...entry,
  }
}

export function describeBranchReplayEventEntrySchema() {
  return cloneValue({
    type: 'object',
    properties: {
      stateId: { type: 'string' },
      parentStateId: { type: ['string', 'null'] },
      branchId: { type: ['string', 'null'] },
      actor: describeRuntimeActorSchema(),
      transitionType: { type: ['string', 'null'] },
      affectedRefs: { type: 'array', items: { type: 'string' } },
      statePatch: { type: 'object' },
      notes: describeInteractionTraceNotesSchema(),
      timestamp: { type: ['string', 'null'] },
    },
  })
}
