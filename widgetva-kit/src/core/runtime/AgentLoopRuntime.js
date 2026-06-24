import { deriveWorkspaceTopology } from './deriveWorkspaceTopology.js'
import {
  makeAgentLoopContext,
  makeAgentLoopHints,
  makeVerifiedActionResult,
} from '../protocol/agentLoop.js'
import {
  readInteractionTraceFromStore,
  readSnapshotFromStore,
  readWorkspaceDescriptionFromStore,
  readWorkspaceStateFromStore,
} from './workspaceStoreReaders.js'
import { readSelectionRegistry } from '../../workspace/state/selectionStateModel.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function isNonBlockingPropagationResult(entry = {}) {
  return entry?.primitive === 'usesData' || entry?.reason === 'manual_activation_policy'
}

function hasBlockingPropagationFailure(entry = {}) {
  const results = Array.isArray(entry?.results) ? entry.results : []
  const relevantResults = results.filter((result) => !isNonBlockingPropagationResult(result))
  if (relevantResults.length === 0) return false
  return relevantResults.some((result) => result?.passed === false)
}

function pickFocusedWidgetRef(description, state) {
  const widgetRefs = Object.keys(state?.widgets || {})
  return state?.shared?.focusedWidget
    || widgetRefs[0]
    || description?.widgets?.[0]?.ref
    || null
}

function summarizeLoopDataViews(description, state) {
  const dataHandles = Array.isArray(description?.dataHandles) ? description.dataHandles : []
  const focusedWidgetRef = pickFocusedWidgetRef(description, state)
  const focusedWidget = focusedWidgetRef ? state?.widgets?.[focusedWidgetRef] || null : null
  const focusedWidgetDataRefs = new Set([
    focusedWidget?.data?.currentDataRef,
    focusedWidget?.data?.sourceDataRef,
  ].filter((ref) => typeof ref === 'string' && ref.length > 0))
  const activeSelectionRefs = Object.keys(readSelectionRegistry(state?.shared || {}))

  const sharedDataViews = dataHandles
    .filter((handle) => handle?.scope === 'workspaceCurrentView' || handle?.scope === 'workspaceCurrent')
    .map((handle) => ({
      ref: handle.ref,
      scope: handle.scope || 'workspace',
      title: handle.title || handle.ref,
    }))

  const focusedDataViews = dataHandles
    .filter((handle) => {
      if (!handle?.ref) return false
      if (handle.widgetRef && focusedWidgetRef && handle.widgetRef === focusedWidgetRef) return true
      return focusedWidgetDataRefs.has(handle.ref)
    })
    .slice(0, 6)
    .map((handle) => ({
      ref: handle.ref,
      scope: handle.scope || 'workspace',
      title: handle.title || handle.ref,
    }))

  const currentViewHandle = sharedDataViews.find((handle) => handle.scope === 'workspaceCurrentView') || null
  const currentSelectionHandle = sharedDataViews.find((handle) => handle.scope === 'workspaceCurrent') || null

  return {
    sharedDataViews,
    focusedDataViews,
    preferredEvidenceRefs: {
      currentViewRef: currentViewHandle?.ref || null,
      currentSelectionRef: activeSelectionRefs.length > 0 ? (currentSelectionHandle?.ref || null) : null,
    },
  }
}

function summarizeHumanInteractionHints(description, state) {
  const widgets = Array.isArray(description?.widgets) ? description.widgets : []
  const focusedWidgetRef = pickFocusedWidgetRef(description, state)

  return widgets
    .filter((widget) => {
      const interaction = widget?.humanInteraction
      return interaction && interaction.mode && interaction.mode !== 'none'
    })
    .map((widget) => ({
      widgetRef: widget.ref,
      mode: widget.humanInteraction.mode,
      actionName: widget.humanInteraction.actionName || null,
      supportsDirectManipulation: Boolean(widget.humanInteraction.supportsDirectManipulation),
      focused: widget.ref === focusedWidgetRef,
    }))
}

export class AgentLoopRuntime {
  constructor({
    store,
    planWorkspace = null,
    executeAction,
    queryPerception,
    queryData = null,
    readLatestCoordinationResult = null,
    responseRecorder = null,
    actionExecutor = null,
    linkEngine,
  }) {
    this.store = store
    this.planWorkspace = planWorkspace
    this.executeAction = executeAction
    this.queryPerception = queryPerception
    this.queryData = queryData
    this.readLatestCoordinationResult = readLatestCoordinationResult
    this.responseRecorder = responseRecorder
    this.actionExecutor = actionExecutor
    this.linkEngine = linkEngine
  }

  async describeStepContext(options = {}) {
    const description = readWorkspaceDescriptionFromStore(this.store)
    const state = readWorkspaceStateFromStore(this.store, options?.viewOptions || {})
    const workspaceTopology = description?.runtimeTopology || deriveWorkspaceTopology({
      widgets: description?.widgets || [],
      links: description?.links || [],
    })
    const dataViewHints = summarizeLoopDataViews(description, state)
    const humanInteractionHints = summarizeHumanInteractionHints(description, state)
    const hasActionHandler = (actionName) => {
      if (!actionName) return false
      if (typeof this.actionExecutor?.has === 'function') {
        return this.actionExecutor.has(actionName)
      }
      if (this.actionExecutor?.handlers instanceof Map) {
        return this.actionExecutor.handlers.has(actionName)
      }
      return false
    }
    const surfaceName = (available, name) => (available ? name : null)
    const canPlanWorkspace = typeof this.planWorkspace === 'function'
    const canQueryData = typeof this.queryData === 'function'
    const canReadInteractionTrace =
      typeof this.store?.readTraceWindow === 'function'
      || Array.isArray(this.store?.interactionTrace)
    const canReadTraceGraph =
      typeof this.store?.buildTraceGraph === 'function'
      || Array.isArray(this.store?.stateSnapshots)
    const canReadSnapshot =
      typeof this.store?.readSnapshotEntry === 'function'
      || Array.isArray(this.store?.stateSnapshots)
    const canReadStateHistory =
      typeof this.store?.listStateHistory === 'function'
      || typeof this.store?.listStateSnapshots === 'function'
      || Array.isArray(this.store?.stateSnapshots)
    const canListBranches =
      typeof this.store?.listBranches === 'function'
      || Boolean(this.store?.branchRegistry && typeof this.store.branchRegistry === 'object')
    const canJumpToState = hasActionHandler('workspace.jumpToState')
    const canBranchFromState = hasActionHandler('workspace.branchFromState')
    const canDescribeResponseRecorder = typeof this.responseRecorder?.describeRecorder === 'function'
    const canReadLatestResponse =
      typeof this.responseRecorder?.readLatestResponse === 'function'
      || typeof this.store?.readLatestResponse === 'function'
      || Array.isArray(this.store?.responseHistory)
    const canListResponses =
      typeof this.responseRecorder?.listResponses === 'function'
      || typeof this.store?.listResponses === 'function'
      || Array.isArray(this.store?.responseHistory)
    const canRecordResponse = typeof this.responseRecorder?.recordResponse === 'function'
    const canEvaluateLinkPropagation =
      typeof this.linkEngine?.evaluatePropagation === 'function'
    const canReadLatestCoordinationResult =
      typeof this.readLatestCoordinationResult === 'function'
      || typeof this.store?.readLatestCoordinationResult === 'function'
    const latestCoordinationResult = canReadLatestCoordinationResult
      ? clone(await (
          typeof this.readLatestCoordinationResult === 'function'
            ? this.readLatestCoordinationResult()
            : this.store.readLatestCoordinationResult()
        ))
      : null

    const recommendedOrder = [
      'describeWorkspace',
      ...(canPlanWorkspace ? ['planWorkspace(optional)'] : []),
      'readState',
      'queryPerception(optional)',
      ...(canQueryData ? ['runDataQuery(optional)'] : []),
      'executeAction',
      'readState(deltaSince)',
      'queryPerception(verify)',
      'produceAnswerOrContinue',
      ...(canRecordResponse ? ['recordAgentResponse(optional)'] : []),
    ]
    return makeAgentLoopContext({
      workspace: clone(description),
      view: clone(state),
      latestCoordinationResult,
      loopHints: makeAgentLoopHints({
        recommendedOrder,
        workspaceDescribeName: 'describeWorkspace',
        workspacePlanName: surfaceName(canPlanWorkspace, 'planWorkspace'),
        stateReadName: 'readState',
        viewReadName: 'readView',
        actionRunName: 'executeAction',
        perceptionQueryName: 'queryPerception',
        verifyQueryName: 'perception.verifyActionEffect',
        dataQueryRunName: surfaceName(canQueryData, 'runDataQuery'),
        dataQueryName: surfaceName(canQueryData, 'queryData'),
        traceReadName: surfaceName(canReadInteractionTrace, 'readTrace'),
        interactionTraceName: surfaceName(canReadInteractionTrace, 'getInteractionTrace'),
        traceGraphName: surfaceName(canReadTraceGraph, 'getTraceGraph'),
        snapshotName: surfaceName(canReadSnapshot, 'readSnapshot'),
        stateHistoryName: surfaceName(canReadStateHistory, 'listStateHistory'),
        branchListName: surfaceName(canListBranches, 'listBranches'),
        verifiedActionName: 'executeVerifiedAction',
        replayName: surfaceName(canJumpToState, 'replay'),
        jumpToStateName: surfaceName(canJumpToState, 'jumpToState'),
        branchFromStateName: surfaceName(canBranchFromState, 'branchFromState'),
        responseRecorderName: surfaceName(canDescribeResponseRecorder, 'describeResponseRecorder'),
        responseReadName: surfaceName(canReadLatestResponse, 'getLatestAgentResponse'),
        responseListName: surfaceName(canListResponses, 'listAgentResponses'),
        responseRecordName: surfaceName(canRecordResponse, 'recordAgentResponse'),
        latestCoordinationResultReadName: surfaceName(canReadLatestCoordinationResult, 'readLatestCoordinationResult'),
        verificationSurfaces: [
          'perception.verifyActionEffect',
          ...(canQueryData ? ['runDataQuery'] : []),
          ...(canReadInteractionTrace ? ['readTrace'] : []),
          ...(canEvaluateLinkPropagation ? ['linkPropagation'] : []),
          ...(canReadLatestCoordinationResult ? ['readLatestCoordinationResult'] : []),
        ],
        planningSurfaces: [
          ...(canPlanWorkspace ? ['planWorkspace'] : []),
          'workspace.runtimeTopology',
          'workspace.planning',
        ],
        historySurfaces: [
          ...(canReadInteractionTrace ? ['readTrace', 'getInteractionTrace'] : []),
          ...(canReadTraceGraph ? ['getTraceGraph'] : []),
          ...(canReadSnapshot ? ['readSnapshot'] : []),
          ...(canReadStateHistory ? ['listStateHistory'] : []),
          ...(canListBranches ? ['listBranches'] : []),
          ...(canReadLatestResponse ? ['getLatestAgentResponse'] : []),
          ...(canListResponses ? ['listAgentResponses'] : []),
        ],
        replaySurfaces: [
          'executeVerifiedAction',
          ...(canJumpToState ? ['replay'] : []),
          ...(canJumpToState ? ['jumpToState'] : []),
          ...(canBranchFromState ? ['branchFromState'] : []),
        ],
        answerSurfaces: [
          ...(canDescribeResponseRecorder ? ['describeResponseRecorder'] : []),
          ...(canReadLatestResponse ? ['getLatestAgentResponse'] : []),
          ...(canListResponses ? ['listAgentResponses'] : []),
          ...(canRecordResponse ? ['recordAgentResponse'] : []),
        ],
        humanInteractionHints: clone(humanInteractionHints),
        sharedDataViews: dataViewHints.sharedDataViews,
        focusedDataViews: dataViewHints.focusedDataViews,
        preferredEvidenceRefs: dataViewHints.preferredEvidenceRefs,
        workspaceTopology: clone(workspaceTopology),
      }),
    })
  }

  collectTraceEvidence({ stateId, actionName }) {
    const trace = readInteractionTraceFromStore(this.store, { limit: 100 })
    const matchingRecord = [...trace].reverse().find((record) => {
      if (stateId && record.stateId !== stateId) return false
      if (actionName && record.action?.name !== actionName) return false
      return true
    })
    return matchingRecord ? clone(matchingRecord) : null
  }

  collectLinkPropagationEvidence({ snapshot }) {
    const evaluateLinkPropagation =
      typeof this.linkEngine?.evaluatePropagation === 'function'
        ? ({ sourceRef, state }) => this.linkEngine.evaluatePropagation({ sourceRef, state })
        : null
    if (!evaluateLinkPropagation) {
      return []
    }
    const selectionRefs = Object.keys(readSelectionRegistry(snapshot?.shared || {}))
    return selectionRefs.map((sourceRef) => evaluateLinkPropagation({ sourceRef, state: snapshot }))
  }

  async executeVerifiedAction(call, options = {}) {
    const beforeStateId = readWorkspaceStateFromStore(this.store)?.stateId || null
    const actionResult = await this.executeAction(call)
    const readLatestCoordinationResult =
      typeof this.readLatestCoordinationResult === 'function'
        ? this.readLatestCoordinationResult
        : typeof this.store?.readLatestCoordinationResult === 'function'
          ? () => this.store.readLatestCoordinationResult()
          : null

    if (!actionResult?.ok) {
      return makeVerifiedActionResult({
        ok: false,
        beforeStateId,
        actionResult,
        afterView: null,
        verification: null,
        latestCoordinationResult: readLatestCoordinationResult ? clone(await readLatestCoordinationResult()) : null,
      })
    }

    const afterView = readWorkspaceStateFromStore(this.store, {
      refs: actionResult.updatedRefs,
      deltaSince: options.includeDeltaSince ? beforeStateId : undefined,
    })

    let verification = null
    if (options.verify !== false) {
      verification = await this.queryPerception({
        callId: `${call?.callId || 'call'}_verify`,
        name: 'perception.verifyActionEffect',
        actor: call?.actor || 'agent',
        targetRef: call?.queryScope?.widgetRef || undefined,
        params: {
          actionName: call?.name,
          stateId: actionResult.stateId,
          refs: actionResult.updatedRefs,
        },
      })
    }

    const finalSnapshot = actionResult.stateId
      ? readSnapshotFromStore(this.store, actionResult.stateId, {
          refs: options.includeFinalSnapshotRefs === false ? undefined : actionResult.updatedRefs,
          includeMeta: true,
        })
      : null
    const fullFinalSnapshot = actionResult.stateId
      ? readSnapshotFromStore(this.store, actionResult.stateId, {
          includeMeta: true,
        }) || finalSnapshot
      : finalSnapshot
    const traceEvidence = this.collectTraceEvidence({
      stateId: actionResult.stateId,
      actionName: call?.name,
    })
    const linkPropagation = fullFinalSnapshot
      ? this.collectLinkPropagationEvidence({ snapshot: fullFinalSnapshot })
      : []
    const verificationHints = Array.isArray(actionResult?.verificationHints) ? actionResult.verificationHints : []
    const verificationOk = verification?.ok !== false && (verification?.result?.verified ?? true)
    const propagationOk = !linkPropagation.some((entry) => hasBlockingPropagationFailure(entry))
    const latestCoordinationResult = readLatestCoordinationResult
      ? clone(await readLatestCoordinationResult())
      : null

    return makeVerifiedActionResult({
      ok: Boolean(actionResult?.ok) && verificationOk && propagationOk,
      beforeStateId,
      actionResult,
      afterView: clone(afterView),
      verification: clone(verification),
      verificationHints: clone(verificationHints),
      traceEvidence,
      finalSnapshot,
      linkPropagation,
      latestCoordinationResult,
    })
  }
}
