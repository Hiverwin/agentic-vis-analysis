import { createWidgetVARuntime } from '../core/runtime/createWidgetRuntime.js'
import { installWidgetVAOnView } from '../adapters/installWidgetView.js'
import { makeVerifiedActionResult } from '../core/protocol/agentLoop.js'
import {
  readInteractionTraceFromStore,
  readSnapshotEntryFromStore,
  readSnapshotFromStore,
} from '../core/runtime/workspaceStoreReaders.js'
import { describeSingleWidgetAgentContractFromWidget } from './agentContract.js'
import { buildLocalSelectionObservation } from './localSelectionContract.js'
import { describeWidgetVerificationContract } from './verificationContract.js'
import { buildWidgetVerificationState } from './verificationState.js'

export const WIDGET_INSTANCE_PUBLIC_METHODS = [
  'mount',
  'unmount',
  'isMounted',
  'describe',
  'listAvailableActions',
  'listActionNames',
  'listAvailablePerceptions',
  'listPerceptionNames',
  'listActionDescriptors',
  'listPerceptionDescriptors',
  'readState',
  'readObservation',
  'readVerificationState',
  'describeAgentContract',
  'readWorkspaceState',
  'readCoordinationState',
  'readPropagationSummary',
  'executeAction',
  'executeVerifiedAction',
  'queryPerception',
  'runDataQuery',
  'readTrace',
  'getTrace',
  'readSnapshot',
  'readSnapshotEntry',
  'replay',
  'dispose',
]

function makeCallId(prefix = 'widget_call') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function resolveWidgetDescription(runtime, { widgetRef = null, widgetId = null } = {}) {
  const descriptions = runtime?.store?.listWidgetDescriptions?.() || []
  if (widgetRef) {
    return descriptions.find((entry) => entry?.ref === widgetRef) || null
  }
  if (widgetId) {
    return descriptions.find((entry) => entry?.widgetId === widgetId) || null
  }
  return descriptions[0] || null
}

function normalizeActionCall(call, widgetRef) {
  if (!call || typeof call !== 'object') {
    throw new Error('WidgetInstance.executeAction requires an action call object.')
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
    callId: call.callId || makeCallId('widget_action'),
    ...restCall,
    ...(Object.keys(normalizedQueryScope).length > 0 ? { queryScope: normalizedQueryScope } : {}),
  }
}

function normalizePerceptionCall(call, widgetRef) {
  if (!call || typeof call !== 'object') {
    throw new Error('WidgetInstance.queryPerception requires a perception call object.')
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
    callId: call.callId || makeCallId('widget_perception'),
    ...restCall,
    ...(Object.keys(normalizedQueryScope).length > 0 ? { queryScope: normalizedQueryScope } : {}),
  }
}

function normalizeDataQueryCall(call, widgetRef) {
  if (!call || typeof call !== 'object') {
    throw new Error('WidgetInstance.runDataQuery requires a data-query call object.')
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
    callId: call.callId || makeCallId('widget_data_query'),
    ...restCall,
    ...(Object.keys(normalizedQueryScope).length > 0 ? { queryScope: normalizedQueryScope } : {}),
  }
}

function normalizeMountTarget({
  mountTarget = null,
  renderTarget = null,
  view = null,
  surface = null,
  container = null,
} = {}) {
  const target = mountTarget || renderTarget || null
  return {
    ...(target?.view || view ? { view: target?.view || view } : {}),
    ...(target?.surface || surface || target?.container || container
      ? { surface: target?.surface || surface || target?.container || container }
      : {}),
    ...(target?.container || container ? { container: target?.container || container } : {}),
  }
}

function uniqueNames(descriptors = []) {
  return descriptors
    .map((descriptor) => descriptor?.name)
    .filter((name, index, names) => typeof name === 'string' && name.length > 0 && names.indexOf(name) === index)
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function normalizeWidgetInstanceOptions({
  mountOptions = {},
  mountTarget = null,
  renderTarget = null,
  view = null,
  surface = null,
  container = null,
  ...options
} = {}) {
  return {
    ...options,
    mountOptions: {
      ...mountOptions,
      ...normalizeMountTarget({
        mountTarget,
        renderTarget,
        view,
        surface,
        container,
      }),
    },
  }
}

export class WidgetInstance {
  constructor({
    runtime = null,
    ownsRuntime = false,
    widgetAdapter = null,
    widgetRef = null,
    widgetId = null,
    spec = null,
    widgetState = null,
    mountOptions = {},
  } = {}) {
    if (!runtime) {
      throw new Error('WidgetInstance requires a runtime.')
    }
    if (!widgetAdapter) {
      throw new Error('WidgetInstance requires a widgetAdapter.')
    }

    this.runtime = runtime
    this.widgetAdapter = widgetAdapter
    this.widgetRef = widgetRef
    this.widgetId = widgetId
    this.spec = spec
    this.widgetState = widgetState
    this.mountOptions = { ...mountOptions }
    this.ownsRuntime = ownsRuntime
    this.installation = null
  }

  static describeContract() {
    return {
      methods: [...WIDGET_INSTANCE_PUBLIC_METHODS],
      methodSemantics: {
        describe: 'returns the normalized widget description registered on the shared runtime',
        readState: 'returns the current widget-local state stored for this widget ref',
        readObservation: 'returns a VLM-facing observation envelope including identity, state, action/perception surfaces, and lightweight coordination hints',
        readVerificationState: 'returns a verification-oriented widget summary covering selection, transforms, view domains, encodings, and comparable signatures',
        describeAgentContract: 'returns the single-widget agent-facing contract including action/perception surfaces, verification surface names, and stable call/result schemas',
        readWorkspaceState: 'returns the current shared runtime state snapshot that contains this widget',
        readCoordinationState: 'returns the shared coordination state from the enclosing runtime/workspace surface',
        readPropagationSummary: 'returns a propagation summary centered on this widget ref when link coordination is available',
        executeAction: 'executes a widget/runtime action call with this widget as the default queryScope target',
        executeVerifiedAction: 'executes a widget action and returns post-action verification evidence through the stable single-widget observe-act-verify surface',
        queryPerception: 'executes a widget/runtime perception query with this widget as the default queryScope target',
        runDataQuery: 'executes a data query with this widget as the default queryScope target when one is not provided explicitly',
      },
      constructorOptions: {
        runtime: 'optional shared runtime instance',
        widgetAdapter: 'required widget/provider adapter',
        widgetRef: 'optional explicit widget ref',
        widgetId: 'optional explicit widget id',
        spec: 'optional widget spec when runtime is created internally',
        widgetState: 'optional initial widget state override',
        mountOptions: 'optional persisted mount options',
        mountTarget: 'optional persisted { view | surface | container } target',
        renderTarget: 'optional alias for mountTarget',
        view: 'optional direct render view target',
        surface: 'optional direct DOM/surface target',
        container: 'optional direct DOM container alias',
      },
    }
  }

  resolveWidgetDescription() {
    return resolveWidgetDescription(this.runtime, {
      widgetRef: this.widgetRef,
      widgetId: this.widgetId,
    })
  }

  resolveWidgetRef() {
    return this.widgetRef || this.resolveWidgetDescription()?.ref || null
  }

  resolveWidgetId() {
    return this.widgetId || this.resolveWidgetDescription()?.widgetId || null
  }

  isMounted() {
    return Boolean(this.installation)
  }

  async mount(nextMountOptions = {}) {
    if (this.installation?.dispose) {
      this.installation.dispose()
      this.installation = null
    }

    this.mountOptions = {
      ...this.mountOptions,
      ...normalizeMountTarget(nextMountOptions),
      ...nextMountOptions,
    }

    this.installation = await installWidgetVAOnView({
      runtime: this.runtime,
      widgetAdapter: this.widgetAdapter,
      widgetRef: this.resolveWidgetRef(),
      widgetState: this.widgetState || this.readState(),
      spec: this.mountOptions.spec || this.spec,
      ...this.mountOptions,
    })

    return this
  }

  unmount() {
    this.installation?.dispose?.()
    this.installation = null
  }

  describe() {
    return this.resolveWidgetDescription()
  }

  listActionDescriptors() {
    const widgetRef = this.resolveWidgetRef()
    const description = this.resolveWidgetDescription()
    const builder = this.widgetAdapter?.buildActionDescriptors
    if (typeof builder === 'function') {
      return builder.call(this.widgetAdapter, {
        widgetRef,
        selectionRef: null,
        scope: 'local',
        affectedRefs: widgetRef ? [widgetRef] : [],
      }) || []
    }
    return (description?.actionNames || []).map((name) => ({ name, targetRef: widgetRef || null }))
  }

  listPerceptionDescriptors() {
    const state = this.readState()
    const description = this.resolveWidgetDescription()
    const dataRef = state?.data?.currentDataRef
      || state?.data?.sourceDataRef
      || description?.primaryDataRef
      || null
    const builder = this.widgetAdapter?.buildPerceptionDescriptors
    if (typeof builder === 'function') {
      return builder.call(this.widgetAdapter, { dataRef }) || []
    }
    return (description?.perceptionQueryNames || []).map((name) => ({ name, targetRef: dataRef || null }))
  }

  listActionNames() {
    return uniqueNames(this.listActionDescriptors())
  }

  listAvailableActions() {
    return this.listActionDescriptors()
  }

  listPerceptionNames() {
    return uniqueNames(this.listPerceptionDescriptors())
  }

  listAvailablePerceptions() {
    return this.listPerceptionDescriptors()
  }

  readState() {
    const widgetRef = this.resolveWidgetRef()
    return widgetRef ? this.runtime?.store?.getWidgetState?.(widgetRef) || null : null
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

  readWorkspaceState(options = {}) {
    return this.runtime?.store?.readState?.(options) || null
  }

  readCoordinationState() {
    const readCoordinationState = this.runtime?.readCoordinationState
    if (typeof readCoordinationState === 'function') {
      return readCoordinationState()
    }
    return null
  }

  readPropagationSummary(options = {}) {
    const readPropagationSummary = this.runtime?.readPropagationSummary
    if (typeof readPropagationSummary !== 'function') {
      return null
    }
    return readPropagationSummary({
      sourceRef: options?.sourceRef || this.resolveWidgetRef() || null,
    })
  }

  async executeAction(call) {
    const executeAction = this.runtime?.executeAction
      || this.runtime?.actionExecutor?.run?.bind(this.runtime.actionExecutor)
    if (typeof executeAction !== 'function') {
      throw new Error('WidgetInstance.executeAction requires a runtime with executeAction support.')
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
      throw new Error('WidgetInstance.queryPerception requires a runtime with queryPerception support.')
    }
    return queryPerception(normalizePerceptionCall(call, this.resolveWidgetRef()))
  }

  async runDataQuery(call) {
    const runDataQuery = this.runtime?.runDataQuery
      || this.runtime?.queryData
      || this.runtime?.dataQueryExecutor?.run?.bind(this.runtime.dataQueryExecutor)
    if (typeof runDataQuery !== 'function') {
      throw new Error('WidgetInstance.runDataQuery requires a runtime with data-query support.')
    }
    return runDataQuery(normalizeDataQueryCall(call, this.resolveWidgetRef()))
  }

  readTrace(options = {}) {
    return this.getTrace(options)
  }

  getTrace(options = {}) {
    return readInteractionTraceFromStore(this.runtime?.store, options)
  }

  readSnapshot(stateId, options = {}) {
    return readSnapshotFromStore(this.runtime?.store, stateId, options)
  }

  readSnapshotEntry(stateId) {
    return readSnapshotEntryFromStore(this.runtime?.store, stateId)
  }

  async replay(stateId) {
    return this.runtime.executeAction({
      callId: makeCallId('widget_replay'),
      actor: 'agent',
      name: 'workspace.jumpToState',
      params: { stateId },
    })
  }

  dispose() {
    this.unmount()
    if (this.ownsRuntime) {
      this.runtime?.dispose?.()
    }
  }
}

export function createWidgetInstance({
  runtime = null,
  widgetAdapter = null,
  widgetRef = null,
  widgetId = null,
  spec = null,
  widgetState = null,
  mountTarget = null,
  renderTarget = null,
  view = null,
  surface = null,
  container = null,
  mountOptions = {},
  runtimeOptions = {},
} = {}) {
  const nextRuntimeOptions = runtime
    ? runtimeOptions
    : {
        ...runtimeOptions,
        widgetAdapters: Array.isArray(runtimeOptions.widgetAdapters)
          ? runtimeOptions.widgetAdapters
          : [widgetAdapter].filter(Boolean),
      }
  const normalizedOptions = normalizeWidgetInstanceOptions({
    runtime,
    widgetAdapter,
    widgetRef,
    widgetId,
    spec,
    widgetState,
    mountTarget,
    renderTarget,
    view,
    surface,
    container,
    mountOptions,
    runtimeOptions: nextRuntimeOptions,
  })
  const nextRuntime = normalizedOptions.runtime || createWidgetVARuntime(normalizedOptions.runtimeOptions)
  return new WidgetInstance({
    runtime: nextRuntime,
    ownsRuntime: !runtime,
    widgetAdapter: normalizedOptions.widgetAdapter,
    widgetRef: normalizedOptions.widgetRef,
    widgetId: normalizedOptions.widgetId,
    spec: normalizedOptions.spec,
    widgetState: normalizedOptions.widgetState,
    mountOptions: normalizedOptions.mountOptions,
  })
}
