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

export function makeAgentLoopContext(context) {
  return {
    workspace: null,
    view: null,
    latestCoordinationResult: null,
    loopHints: makeAgentLoopHints(),
    ...context,
  }
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
