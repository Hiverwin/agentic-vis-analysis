import {
  actionRun,
  agentLoopDescribe,
  perceptionQuery,
  recordAgentResponse,
  viewRead,
  workspaceDescribe,
} from '../../transports/inPageTransport.js'

async function readWorkspaceDescription(port, options = {}) {
  if (typeof port?.describeWorkspace === 'function') {
    return port.describeWorkspace(options)
  }
  if (typeof port?.workspace_describe === 'function') {
    return port.workspace_describe(options)
  }
  if (port != null) {
    throw new Error('WidgetVA page port does not expose describeWorkspace().')
  }
  return workspaceDescribe(options)
}

async function readWorkspaceView(port, options = {}) {
  if (typeof port?.readState === 'function') {
    return port.readState(options)
  }
  if (typeof port?.state_read === 'function') {
    return port.state_read(options)
  }
  if (typeof port?.readView === 'function') {
    return port.readView(options)
  }
  if (typeof port?.view_read === 'function') {
    return port.view_read(options)
  }
  if (port != null) {
    throw new Error('WidgetVA page port does not expose readState() or readView().')
  }
  return viewRead(options)
}

async function readAgentLoopContext(port, options = {}) {
  if (typeof port?.describeAgentLoop === 'function') {
    return port.describeAgentLoop(options)
  }
  if (typeof port?.agent_loop_describe === 'function') {
    return port.agent_loop_describe(options)
  }
  if (port != null) {
    throw new Error('WidgetVA page port does not expose describeAgentLoop().')
  }
  return agentLoopDescribe(options)
}

async function executeActionCall(port, call) {
  if (typeof port?.executeAction === 'function') {
    return port.executeAction(call)
  }
  if (typeof port?.action_run === 'function') {
    return port.action_run(call)
  }
  if (port != null) {
    throw new Error('WidgetVA page port does not expose executeAction().')
  }
  return actionRun(call)
}

async function runDataQueryCall(port, call) {
  if (typeof port?.runDataQuery === 'function') {
    return port.runDataQuery(call)
  }
  if (typeof port?.data_query_run === 'function') {
    return port.data_query_run(call)
  }
  if (typeof port?.queryData === 'function') {
    return port.queryData(call)
  }
  if (typeof port?.data_query === 'function') {
    return port.data_query(call)
  }
  return null
}

async function queryPerceptionCall(port, call) {
  if (typeof port?.queryPerception === 'function') {
    return port.queryPerception(call)
  }
  if (typeof port?.perception_query === 'function') {
    return port.perception_query(call)
  }
  if (port != null) {
    throw new Error('WidgetVA page port does not expose queryPerception().')
  }
  return perceptionQuery(call)
}

async function recordAgentResponseCall(port, record) {
  if (typeof port?.recordAgentResponse === 'function') {
    return port.recordAgentResponse(record)
  }
  if (typeof port?.agent_response_record === 'function') {
    return port.agent_response_record(record)
  }
  if (port != null) {
    throw new Error('WidgetVA page port does not expose recordAgentResponse().')
  }
  return recordAgentResponse(record)
}

async function readLatestCoordinationResultCall(port) {
  if (typeof port?.readLatestCoordinationResult === 'function') {
    return port.readLatestCoordinationResult()
  }
  if (typeof port?.latest_coordination_result_read === 'function') {
    return port.latest_coordination_result_read()
  }
  return null
}

function normalizeExampleOptions(options = {}) {
  const hasStructuredOptions =
    options
    && typeof options === 'object'
    && (
      'loopOptions' in options
      || 'describeOptions' in options
      || 'viewOptions' in options
      || 'afterViewOptions' in options
      || 'actionCall' in options
      || 'prePerceptionCall' in options
      || 'responseRecord' in options
      || 'verify' in options
      || 'verifyCall' in options
    )

  if (!hasStructuredOptions) {
    return {
      loopOptions: options || {},
      describeOptions: {},
      viewOptions: {},
      afterViewOptions: {},
      actionCall: null,
      prePerceptionCall: null,
      responseRecord: null,
      verify: true,
      verifyCall: null,
    }
  }

  return {
    loopOptions: options.loopOptions || {},
    describeOptions: options.describeOptions || {},
    viewOptions: options.viewOptions || {},
    afterViewOptions: options.afterViewOptions || {},
    actionCall: options.actionCall || null,
    prePerceptionCall: options.prePerceptionCall || null,
    responseRecord: options.responseRecord || null,
    verify: options.verify !== false,
    verifyCall: options.verifyCall || null,
  }
}

function buildSuggestedNextStep(workspace) {
  const firstAction = Array.isArray(workspace?.actions) ? workspace.actions[0] : null
  const widgetRef = firstAction?.queryScope?.widgetRef || firstAction?.targetRef || null
  return firstAction
    ? {
        actionName: firstAction.name,
        targetRef: widgetRef,
        queryScope: widgetRef ? { widgetRef } : undefined,
        verificationQuery: 'perception.verifyActionEffect',
      }
    : null
}

function normalizeScopedCall(call, { fallbackWidgetRef = null } = {}) {
  if (!call || typeof call !== 'object') return call
  const targetWidgetRef = call?.queryScope?.widgetRef || call?.targetRef || fallbackWidgetRef || null
  const normalizedQueryScope = call.queryScope && typeof call.queryScope === 'object' && !Array.isArray(call.queryScope)
    ? { ...call.queryScope }
    : {}
  if (targetWidgetRef && !normalizedQueryScope.widgetRef && !normalizedQueryScope.widget_ref) {
    normalizedQueryScope.widgetRef = targetWidgetRef
  }
  const { targetRef: _legacyTargetRef, ...restCall } = call
  return {
    ...restCall,
    ...(Object.keys(normalizedQueryScope).length > 0 ? { queryScope: normalizedQueryScope } : {}),
  }
}

function buildVerifyCall(actionCall, actionResult, afterView, override = null) {
  if (override) {
    return normalizeScopedCall(override)
  }

  const targetWidgetRef = actionCall?.queryScope?.widgetRef || actionCall?.targetRef || null

  return {
    callId: `${actionCall?.callId || 'call'}_verify`,
    name: 'perception.verifyActionEffect',
    actor: actionCall?.actor || 'agent',
    ...(targetWidgetRef ? { queryScope: { widgetRef: targetWidgetRef } } : {}),
    params: {
      actionName: actionCall?.name,
      stateId: actionResult?.stateId || afterView?.stateId || null,
      refs: actionResult?.updatedRefs || [],
    },
  }
}

function buildResponseRecord(responseRecord, { workspace, actionCall, actionResult, afterView, latestCoordinationResult } = {}) {
  if (!responseRecord || typeof responseRecord !== 'object') {
    return null
  }

  return {
    ...responseRecord,
    workspaceId: responseRecord.workspaceId || workspace?.workspaceId || null,
    stateId: responseRecord.stateId || actionResult?.stateId || afterView?.stateId || null,
    actor: responseRecord.actor || actionCall?.actor || 'agent',
    coordinationEvidence: responseRecord.coordinationEvidence || latestCoordinationResult || null,
  }
}

export async function runWidgetVAAgentLoopExample(port = null, options = {}) {
  const normalizedOptions = normalizeExampleOptions(options)
  const loopContext = await readAgentLoopContext(port, normalizedOptions.loopOptions)
  const workspace = loopContext?.workspace || await readWorkspaceDescription(port, normalizedOptions.describeOptions)
  const suggestedNextStep = buildSuggestedNextStep(workspace)

  if (!normalizedOptions.actionCall) {
    return {
      loopContext,
      suggestedNextStep,
    }
  }

  const beforeView = loopContext?.view || await readWorkspaceView(port, normalizedOptions.viewOptions)
  const preActionEvidence = normalizedOptions.prePerceptionCall
    ? await queryPerceptionCall(port, normalizeScopedCall(normalizedOptions.prePerceptionCall))
    : null
  const normalizedActionCall = normalizeScopedCall(normalizedOptions.actionCall)
  const actionResult = await executeActionCall(port, normalizedActionCall)
  const afterView = await readWorkspaceView(port, {
    ...normalizedOptions.afterViewOptions,
    deltaSince: beforeView?.stateId || undefined,
  })
  const verification = normalizedOptions.verify
    ? await queryPerceptionCall(port, buildVerifyCall(
      normalizedActionCall,
      actionResult,
      afterView,
      normalizedOptions.verifyCall,
    ))
    : null
  const latestCoordinationResult = await readLatestCoordinationResultCall(port)
  const recordedResponse = normalizedOptions.responseRecord
    ? await recordAgentResponseCall(
      port,
      buildResponseRecord(normalizedOptions.responseRecord, {
        workspace,
        actionCall: normalizedOptions.actionCall,
        actionResult,
        afterView,
        latestCoordinationResult,
      }),
    )
    : null

  return {
    loopContext,
    suggestedNextStep,
    workspace,
    beforeView,
    preActionEvidence,
    actionResult,
    afterView,
    verification,
    latestCoordinationResult,
    recordedResponse,
  }
}
