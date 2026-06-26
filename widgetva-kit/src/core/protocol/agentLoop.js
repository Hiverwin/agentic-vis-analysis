import { describeWorkspaceDescriptionSchema } from './description.js'
import { describeInteractionTraceRecordSchema } from './interactionTrace.js'
import { describeLinkPropagationEvaluationSchema, describeActionResultSchema, describePerceptionResultSchema, describeWorkspaceSnapshotSchema } from './results.js'
import { describeWorkspaceStateSchema } from './state.js'
import { describeWorkspaceTopologySummarySchema } from './widgetLinks.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function makeAgentLoopHints(hints) {
  return {
    recommendedOrder: [],
    workspaceDescribeName: 'describeWorkspace',
    workspacePlanName: null,
    stateReadName: 'readState',
    viewReadName: 'readView',
    actionRunName: 'executeAction',
    perceptionQueryName: 'queryPerception',
    verifyQueryName: 'perception.verifyActionEffect',
    dataQueryRunName: null,
    dataQueryName: null,
    traceReadName: null,
    interactionTraceName: null,
    traceGraphName: null,
    snapshotName: null,
    stateHistoryName: null,
    branchListName: null,
    finalSnapshotName: null,
    verifiedActionName: 'executeVerifiedAction',
    replayName: null,
    jumpToStateName: null,
    branchFromStateName: null,
    responseRecorderName: null,
    responseReadName: null,
    responseListName: null,
    responseRecordName: null,
    latestCoordinationResultReadName: null,
    verificationSurfaces: [],
    planningSurfaces: [],
    historySurfaces: [],
    replaySurfaces: [],
    answerSurfaces: [],
    humanInteractionHints: [],
    sharedDataViews: [],
    focusedDataViews: [],
    preferredEvidenceRefs: {
      currentViewRef: null,
      currentSelectionRef: null,
    },
    workspaceTopology: null,
    ...hints,
  }
}

export function describeAgentLoopHintsSchema() {
  const optionalNameSchema = { type: ['string', 'null'] }
  return cloneValue({
    type: 'object',
    properties: {
      recommendedOrder: { type: 'array', items: { type: 'string' } },
      workspaceDescribeName: { type: 'string' },
      workspacePlanName: optionalNameSchema,
      stateReadName: { type: 'string' },
      viewReadName: { type: 'string' },
      actionRunName: { type: 'string' },
      perceptionQueryName: { type: 'string' },
      verifyQueryName: { type: 'string' },
      dataQueryRunName: optionalNameSchema,
      dataQueryName: optionalNameSchema,
      traceReadName: optionalNameSchema,
      interactionTraceName: optionalNameSchema,
      traceGraphName: optionalNameSchema,
      snapshotName: optionalNameSchema,
      stateHistoryName: optionalNameSchema,
      branchListName: optionalNameSchema,
      finalSnapshotName: optionalNameSchema,
      verifiedActionName: { type: 'string' },
      replayName: optionalNameSchema,
      jumpToStateName: optionalNameSchema,
      branchFromStateName: optionalNameSchema,
      responseRecorderName: optionalNameSchema,
      responseReadName: optionalNameSchema,
      responseListName: optionalNameSchema,
      responseRecordName: optionalNameSchema,
      latestCoordinationResultReadName: optionalNameSchema,
      verificationSurfaces: { type: 'array', items: { type: 'string' } },
      planningSurfaces: { type: 'array', items: { type: 'string' } },
      historySurfaces: { type: 'array', items: { type: 'string' } },
      replaySurfaces: { type: 'array', items: { type: 'string' } },
      answerSurfaces: { type: 'array', items: { type: 'string' } },
      humanInteractionHints: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            widgetRef: { type: 'string' },
            mode: { type: 'string' },
            actionName: { type: ['string', 'null'] },
            supportsDirectManipulation: { type: 'boolean' },
            focused: { type: 'boolean' },
          },
        },
      },
      sharedDataViews: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ref: { type: 'string' },
            scope: { type: 'string' },
            title: { type: 'string' },
          },
        },
      },
      focusedDataViews: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ref: { type: 'string' },
            scope: { type: 'string' },
            title: { type: 'string' },
          },
        },
      },
      preferredEvidenceRefs: {
        type: 'object',
        properties: {
          currentViewRef: { type: ['string', 'null'] },
          currentSelectionRef: { type: ['string', 'null'] },
        },
      },
      workspaceTopology: {
        anyOf: [describeWorkspaceTopologySummarySchema(), { type: 'null' }],
      },
    },
  })
}

export function makeVerifiedActionEvidence(evidence) {
  return {
    verificationHints: [],
    traceEvidence: null,
    finalSnapshot: null,
    linkPropagation: [],
    latestCoordinationResult: null,
    ...evidence,
  }
}

export function describeVerifiedActionEvidenceSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      verificationHints: { type: 'array', items: { type: 'string' } },
      traceEvidence: {
        anyOf: [
          { type: 'null' },
          describeInteractionTraceRecordSchema(),
        ],
      },
      finalSnapshot: {
        anyOf: [
          { type: 'null' },
          describeWorkspaceSnapshotSchema(),
        ],
      },
      linkPropagation: { type: 'array', items: describeLinkPropagationEvaluationSchema() },
      latestCoordinationResult: {
        anyOf: [
          { type: 'null' },
          { type: 'object', additionalProperties: true },
        ],
      },
    },
  })
}

export function makeAgentLoopContext(context) {
  return {
    workspace: null,
    view: null,
    latestCoordinationResult: null,
    loopHints: makeAgentLoopHints(),
    ...context,
  }
}

export function describeAgentLoopContextSchema() {
  return cloneValue({
    type: 'object',
    required: ['workspace', 'view', 'loopHints'],
    properties: {
      workspace: describeWorkspaceDescriptionSchema(),
      view: describeWorkspaceStateSchema(),
      latestCoordinationResult: {
        anyOf: [
          { type: 'null' },
          { type: 'object', additionalProperties: true },
        ],
      },
      loopHints: describeAgentLoopHintsSchema(),
    },
  })
}

export function makeVerifiedActionResult(result) {
  return {
    ok: false,
    beforeStateId: null,
    actionResult: null,
    afterView: null,
    verification: null,
    ...makeVerifiedActionEvidence(),
    ...result,
  }
}

export function describeVerifiedActionResultSchema() {
  return cloneValue({
    type: 'object',
    required: ['ok', 'beforeStateId', 'actionResult', 'afterView', 'verification'],
    properties: {
      ok: { type: 'boolean' },
      beforeStateId: { type: ['string', 'null'] },
      actionResult: {
        anyOf: [
          { type: 'null' },
          describeActionResultSchema(),
        ],
      },
      afterView: {
        anyOf: [
          { type: 'null' },
          describeWorkspaceStateSchema(),
        ],
      },
      verification: {
        anyOf: [
          { type: 'null' },
          describePerceptionResultSchema(),
        ],
      },
      verificationHints: describeVerifiedActionEvidenceSchema().properties.verificationHints,
      traceEvidence: describeVerifiedActionEvidenceSchema().properties.traceEvidence,
      finalSnapshot: describeVerifiedActionEvidenceSchema().properties.finalSnapshot,
      linkPropagation: describeVerifiedActionEvidenceSchema().properties.linkPropagation,
      latestCoordinationResult: describeVerifiedActionEvidenceSchema().properties.latestCoordinationResult,
    },
  })
}
