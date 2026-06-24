import { makeVerifiedActionResult } from '../core/protocol/agentLoop.js'
import { describeSingleWidgetAgentContractFromWidget } from '../widgets/agentContract.js'
import { buildLocalSelectionObservation } from '../widgets/localSelectionContract.js'
import { describeWidgetVerificationContract } from '../widgets/verificationContract.js'
import { buildWidgetVerificationState } from '../widgets/verificationState.js'

function looksLikeWidgetState(value) {
  return value != null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (
      typeof value.widgetId === 'string'
      || typeof value.ref === 'string'
      || typeof value.kind === 'string'
      || value.view != null
      || value.selections != null
      || value.data != null
      || value.feedback != null
    )
}

function mergeBoundArgs(boundArgs, args) {
  const nextArgs = args != null && typeof args === 'object' && !Array.isArray(args) ? args : {}
  return {
    ...boundArgs,
    ...nextArgs,
  }
}

function normalizeApplyStateArgs(boundArgs, args) {
  if (args != null && typeof args === 'object' && !Array.isArray(args) && Object.prototype.hasOwnProperty.call(args, 'state')) {
    return mergeBoundArgs(boundArgs, args)
  }
  if (looksLikeWidgetState(args)) {
    return {
      ...boundArgs,
      state: args,
    }
  }
  return mergeBoundArgs(boundArgs, args)
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function uniqueNames(descriptors = []) {
  return [...new Set(
    (Array.isArray(descriptors) ? descriptors : [])
      .map((descriptor) => descriptor?.name)
      .filter((name) => typeof name === 'string' && name.length > 0),
  )]
}

function makeCallId(prefix = 'widget_adapter_call') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeActionCall(call, widgetRef) {
  if (!call || typeof call !== 'object') {
    throw new Error('RuntimeProviderWidgetAdapter.executeAction requires an action call object.')
  }
  const normalizedQueryScope = call.queryScope && typeof call.queryScope === 'object' && !Array.isArray(call.queryScope)
    ? { ...call.queryScope }
    : {}
  if (widgetRef && !normalizedQueryScope.widgetRef && !normalizedQueryScope.widget_ref) {
    normalizedQueryScope.widgetRef = widgetRef
  }
  const { targetRef: _legacyTargetRef, ...restCall } = call
  return {
    actor: call.actor || 'agent',
    callId: call.callId || makeCallId('widget_adapter_action'),
    ...restCall,
    ...(Object.keys(normalizedQueryScope).length > 0 ? { queryScope: normalizedQueryScope } : {}),
  }
}

function normalizePerceptionCall(call, widgetRef) {
  if (!call || typeof call !== 'object') {
    throw new Error('RuntimeProviderWidgetAdapter.queryPerception requires a perception call object.')
  }
  const normalizedQueryScope = call.queryScope && typeof call.queryScope === 'object' && !Array.isArray(call.queryScope)
    ? { ...call.queryScope }
    : {}
  if (widgetRef && !normalizedQueryScope.widgetRef && !normalizedQueryScope.widget_ref) {
    normalizedQueryScope.widgetRef = widgetRef
  }
  const { targetRef: _legacyTargetRef, ...restCall } = call
  return {
    actor: call.actor || 'agent',
    callId: call.callId || makeCallId('widget_adapter_perception'),
    ...restCall,
    ...(Object.keys(normalizedQueryScope).length > 0 ? { queryScope: normalizedQueryScope } : {}),
  }
}

function normalizeDataQueryCall(call, widgetRef) {
  if (!call || typeof call !== 'object') {
    throw new Error('RuntimeProviderWidgetAdapter.runDataQuery requires a data-query call object.')
  }
  const normalizedQueryScope = call.queryScope && typeof call.queryScope === 'object' && !Array.isArray(call.queryScope)
    ? { ...call.queryScope }
    : {}
  if (widgetRef && !normalizedQueryScope.widgetRef && !normalizedQueryScope.widget_ref) {
    normalizedQueryScope.widgetRef = widgetRef
  }
  const { targetRef: _legacyTargetRef, ...restCall } = call
  return {
    actor: call.actor || 'agent',
    callId: call.callId || makeCallId('widget_adapter_data_query'),
    ...restCall,
    ...(Object.keys(normalizedQueryScope).length > 0 ? { queryScope: normalizedQueryScope } : {}),
  }
}

export class RuntimeProviderWidgetAdapter {
  constructor({
    definition,
    widgetRef,
    dataRef,
    getDescription,
    getState,
    humanInteraction,
    metadata,
    bindHumanInteractions,
    applyState,
    view = null,
    surface = null,
    spec = null,
    interactionConfig = null,
    selectionSourceWidgetId = null,
    actionTargetRef = null,
    runtime = null,
  } = {}) {
    if (!definition?.createInstance || typeof definition.createInstance !== 'function') {
      throw new Error('RuntimeProviderWidgetAdapter requires a widget adapter definition with createInstance().')
    }

    this.runtime = runtime
    this._boundArgs = {
      ...(runtime ? { runtime } : {}),
      ...(view ? { view } : {}),
      ...(surface ? { surface } : {}),
      ...(spec ? { spec } : {}),
      ...(interactionConfig ? { interactionConfig } : {}),
      ...(selectionSourceWidgetId ? { selectionSourceWidgetId } : {}),
      ...(actionTargetRef ? { actionTargetRef } : {}),
    }
    this._instance = definition.createInstance({
      widgetRef,
      dataRef,
      getDescription,
      getState,
      ...(humanInteraction ? { humanInteraction } : {}),
      ...(metadata ? { metadata } : {}),
      ...(bindHumanInteractions ? { bindHumanInteractions } : {}),
      ...(applyState ? { applyState } : {}),
    })

    this.kind = this._instance.kind
    this.provider = this._instance.provider
    this.providerCapabilities = this._instance.providerCapabilities
    this.widgetRef = this._instance.widgetRef
    this.dataRef = this._instance.dataRef
    this.metadata = this._instance.metadata
  }

  getDescription() {
    return this._instance.getDescription()
  }

  getState() {
    return this._instance.getState()
  }

  resolveWidgetDescription() {
    const widgetRef = this.resolveWidgetRef()
    if (widgetRef) {
      const fromRuntime = this.runtime?.store?.getWidgetDescription?.(widgetRef)
      if (fromRuntime) return fromRuntime
    }
    return this.getDescription()
  }

  resolveWidgetRef() {
    return this.widgetRef || this.getDescription()?.ref || this.getState()?.ref || null
  }

  resolveWidgetId() {
    return this.getState()?.widgetId || this.resolveWidgetDescription()?.widgetId || null
  }

  buildActionDescriptors(args) {
    return this._instance.buildActionDescriptors(args)
  }

  buildPerceptionDescriptors(args) {
    return this._instance.buildPerceptionDescriptors(args)
  }

  registerActions(router) {
    return this._instance.registerActions(router)
  }

  registerPerceptionQueries(registry) {
    return this._instance.registerPerceptionQueries(registry)
  }

  bindHumanInteractions(args = {}) {
    return this._instance.bindHumanInteractions(mergeBoundArgs(this._boundArgs, args))
  }

  applyState(args = {}) {
    return this._instance.applyState(normalizeApplyStateArgs(this._boundArgs, args))
  }

  mount(args = {}) {
    return this._instance.mount(mergeBoundArgs(this._boundArgs, args))
  }

  update(args = {}) {
    return this._instance.update(mergeBoundArgs(this._boundArgs, args))
  }

  dispose(args = {}) {
    return this._instance.dispose(mergeBoundArgs(this._boundArgs, args))
  }

  readSelection(args = {}) {
    return this._instance.readSelection(mergeBoundArgs(this._boundArgs, args))
  }

  readViewport(args = {}) {
    return this._instance.readViewport(mergeBoundArgs(this._boundArgs, args))
  }

  describeCapabilities() {
    return this._instance.describeCapabilities()
  }

  getHumanInteractionConfig() {
    return this._instance.getHumanInteractionConfig()
  }

  listActionDescriptors() {
    const description = this.resolveWidgetDescription()
    const widgetRef = this.resolveWidgetRef()
    const builtDescriptors = this.buildActionDescriptors({
      widgetRef,
      dataRef: this.dataRef || null,
      affectedRefs: widgetRef ? [widgetRef] : [],
    })
    if (Array.isArray(builtDescriptors) && builtDescriptors.length > 0) {
      return clone(builtDescriptors)
    }
    if (Array.isArray(description?.actionDescriptors) && description.actionDescriptors.length > 0) {
      return clone(description.actionDescriptors)
    }
    return (description?.actionNames || []).map((name) => ({ name, targetRef: widgetRef || null }))
  }

  listPerceptionDescriptors() {
    const description = this.resolveWidgetDescription()
    const state = this.readState()
    const dataRef = state?.data?.currentDataRef
      || state?.data?.sourceDataRef
      || this.dataRef
      || description?.primaryDataRef
      || null
    const builtDescriptors = this.buildPerceptionDescriptors({
      widgetRef: this.resolveWidgetRef(),
      dataRef,
    })
    if (Array.isArray(builtDescriptors) && builtDescriptors.length > 0) {
      return clone(builtDescriptors)
    }
    if (Array.isArray(description?.perceptionDescriptors) && description.perceptionDescriptors.length > 0) {
      return clone(description.perceptionDescriptors)
    }
    return (description?.perceptionQueryNames || []).map((name) => ({ name, targetRef: dataRef || null }))
  }

  readState() {
    const widgetRef = this.resolveWidgetRef()
    if (!widgetRef) return null
    return this.runtime?.store?.getWidgetState?.(widgetRef) || this.getState() || null
  }

  readWorkspaceState(options = {}) {
    return this.runtime?.store?.readState?.(options) || null
  }

  readObservation(options = {}) {
    const widgetRef = this.resolveWidgetRef()
    const widgetId = this.resolveWidgetId()
    const description = this.resolveWidgetDescription()
    const state = this.readState()
    const workspaceState = this.readWorkspaceState(options.readStateOptions || {})
    const shared = workspaceState?.shared || {}
    const primarySelection = shared?.selections?.views?.primary || null
    const widgetSelectionView = widgetId
      ? shared?.selections?.views?.byWidget?.[widgetId] || null
      : null
    const actionDescriptors = this.listActionDescriptors()
    const perceptionDescriptors = this.listPerceptionDescriptors()
    const verificationContract = describeWidgetVerificationContract(description?.kind || null)

    return {
      widgetRef,
      widgetId,
      title: description?.title || null,
      kind: description?.kind || null,
      role: description?.role || null,
      state: clone(state),
      actionNames: uniqueNames(actionDescriptors),
      perceptionNames: uniqueNames(perceptionDescriptors),
      actionDescriptors: clone(actionDescriptors),
      perceptionDescriptors: clone(perceptionDescriptors),
      selection: buildLocalSelectionObservation({
        kind: description?.kind || null,
        state,
        widgetSelectionView,
      }),
      verification: {
        contract: verificationContract,
      },
      coordination: {
        isFocused: shared?.focusedWidgetRef === widgetRef,
        sharedPrimarySelectionRef: primarySelection?.selectionRef || null,
        sharedPrimarySelectionSourceWidgetId: primarySelection?.sourceWidgetId || null,
        widgetSelectionRef: widgetSelectionView?.selectionRef || null,
        localSelectionRefs: Object.keys(state?.selections || {}),
        linkedSourceRefs: Array.isArray(state?.feedback?.linkedSourceRefs)
          ? [...state.feedback.linkedSourceRefs]
          : [],
      },
    }
  }

  readVerificationState() {
    const widgetRef = this.resolveWidgetRef()
    const widgetId = this.resolveWidgetId()
    const description = this.resolveWidgetDescription()
    const state = this.readState()

    return {
      contract: describeWidgetVerificationContract(description?.kind || null),
      ...buildWidgetVerificationState({
        widgetRef,
        widgetId,
        kind: description?.kind || null,
        state,
      }),
    }
  }

  describeAgentContract() {
    return describeSingleWidgetAgentContractFromWidget(this)
  }

  async executeAction(call) {
    const executeAction = this.runtime?.executeAction
      || this.runtime?.actionExecutor?.run?.bind(this.runtime.actionExecutor)
    if (typeof executeAction !== 'function') {
      throw new Error('RuntimeProviderWidgetAdapter.executeAction requires a runtime with executeAction support.')
    }
    return executeAction(normalizeActionCall(call, this.resolveWidgetRef()))
  }

  async executeVerifiedAction(call, options = {}) {
    const normalizedCall = normalizeActionCall(call, this.resolveWidgetRef())
    const executeVerifiedAction = this.runtime?.executeVerifiedAction
      || this.runtime?.agentLoopRuntime?.executeVerifiedAction?.bind(this.runtime.agentLoopRuntime)
    if (typeof executeVerifiedAction === 'function') {
      return executeVerifiedAction(normalizedCall, options)
    }

    const beforeStateId = this.readWorkspaceState()?.stateId || null
    const actionResult = await this.executeAction(normalizedCall)
    if (!actionResult?.ok) {
      return makeVerifiedActionResult({
        ok: false,
        beforeStateId,
        actionResult,
        afterView: null,
        verification: null,
      })
    }

    const afterView = this.readWorkspaceState({
      refs: Array.isArray(actionResult?.updatedRefs) ? actionResult.updatedRefs : undefined,
      deltaSince: options?.includeDeltaSince ? beforeStateId : undefined,
    })
    const verification = options?.verify === false
      ? null
      : await this.queryPerception({
          callId: `${normalizedCall.callId}_verify`,
          actor: normalizedCall.actor || 'agent',
          name: 'perception.verifyActionEffect',
          params: {
            actionName: normalizedCall.name,
            stateId: actionResult?.stateId || null,
            refs: Array.isArray(actionResult?.updatedRefs) ? actionResult.updatedRefs : [],
          },
        })
    const verificationOk = verification?.ok !== false && (verification?.result?.verified ?? true)

    return makeVerifiedActionResult({
      ok: Boolean(actionResult?.ok) && verificationOk,
      beforeStateId,
      actionResult,
      afterView: clone(afterView),
      verification: clone(verification),
      verificationHints: clone(Array.isArray(actionResult?.verificationHints) ? actionResult.verificationHints : []),
    })
  }

  async queryPerception(call) {
    const queryPerception = this.runtime?.queryPerception
      || this.runtime?.perceptionQueryRegistry?.query?.bind(this.runtime.perceptionQueryRegistry)
      || this.runtime?.perceptionQueryRegistry?.run?.bind(this.runtime.perceptionQueryRegistry)
    if (typeof queryPerception !== 'function') {
      throw new Error('RuntimeProviderWidgetAdapter.queryPerception requires a runtime with queryPerception support.')
    }
    return queryPerception(normalizePerceptionCall(call, this.resolveWidgetRef()))
  }

  async runDataQuery(call) {
    const runDataQuery = this.runtime?.runDataQuery
      || this.runtime?.queryData
      || this.runtime?.dataQueryExecutor?.run?.bind(this.runtime.dataQueryExecutor)
    if (typeof runDataQuery !== 'function') {
      throw new Error('RuntimeProviderWidgetAdapter.runDataQuery requires a runtime with data-query support.')
    }
    return runDataQuery(normalizeDataQueryCall(call, this.resolveWidgetRef()))
  }
}
