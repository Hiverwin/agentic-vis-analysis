import { createWidgetVARuntime } from '../runtime/RuntimeOrchestrator.js'
import { installWidgetVAOnView } from '../../adapters/installWidgetView.js'
import {
  readInteractionTraceFromStore,
  readSnapshotEntryFromStore,
  readSnapshotFromStore,
} from '../../workspace/store/workspaceStoreReaders.js'
import {
  getWidgetFamilyHumanInteractionConfig,
} from '../../widgets/families/index.js'

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
  delete normalizedQueryScope.widgetRef
  delete normalizedQueryScope.widget_ref
  const normalizedTarget = call.target && typeof call.target === 'object' && !Array.isArray(call.target)
    ? { ...call.target }
    : {}
  if (widgetRef && !normalizedTarget.widgetRef) {
    normalizedTarget.widgetRef = widgetRef
  }
  const { targetRef: _legacyTargetRef, ...restCall } = call
  return {
    actor: call.actor || 'agent',
    callId: call.callId || makeCallId('widget_action'),
    ...restCall,
    ...(Object.keys(normalizedTarget).length > 0 ? { target: normalizedTarget } : {}),
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
  delete normalizedQueryScope.widgetRef
  delete normalizedQueryScope.widget_ref
  const normalizedTarget = call.target && typeof call.target === 'object' && !Array.isArray(call.target)
    ? { ...call.target }
    : {}
  if (widgetRef && !normalizedTarget.widgetRef) {
    normalizedTarget.widgetRef = widgetRef
  }
  const { targetRef: _legacyTargetRef, ...restCall } = call
  return {
    actor: call.actor || 'agent',
    callId: call.callId || makeCallId('widget_perception'),
    ...restCall,
    ...(Object.keys(normalizedTarget).length > 0 ? { target: normalizedTarget } : {}),
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
  delete normalizedQueryScope.widgetRef
  delete normalizedQueryScope.widget_ref
  const normalizedTarget = call.target && typeof call.target === 'object' && !Array.isArray(call.target)
    ? { ...call.target }
    : {}
  if (widgetRef && !normalizedTarget.widgetRef) {
    normalizedTarget.widgetRef = widgetRef
  }
  const { targetRef: _legacyTargetRef, ...restCall } = call
  return {
    actor: call.actor || 'agent',
    callId: call.callId || makeCallId('widget_data_query'),
    ...restCall,
    ...(Object.keys(normalizedTarget).length > 0 ? { target: normalizedTarget } : {}),
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

    const widgetState = this.widgetState || this.readState()
    const widgetSpec = this.mountOptions.spec || this.spec
    const interactionConfig = this.mountOptions.interactionConfig
      || widgetState?.humanInteraction
      || getWidgetFamilyHumanInteractionConfig(
        widgetState?.kind || this.resolveWidgetDescription()?.kind || this.widgetAdapter?.kind || null,
        {
          widgetRef: this.resolveWidgetRef(),
          widgetDef: this.resolveWidgetDescription(),
          widgetSpec,
        },
      )
      || null

    this.installation = await installWidgetVAOnView({
      runtime: this.runtime,
      widgetAdapter: this.widgetAdapter,
      widgetRef: this.resolveWidgetRef(),
      widgetState,
      spec: widgetSpec,
      interactionConfig,
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

  readState() {
    const widgetRef = this.resolveWidgetRef()
    return widgetRef ? this.runtime?.store?.getWidgetState?.(widgetRef) || null : null
  }

  readWorkspaceState(options = {}) {
    return this.runtime?.store?.readState?.(options) || null
  }

  async executeAction(call) {
    const executeAction = this.runtime?.executeAction
    if (typeof executeAction !== 'function') {
      throw new Error('WidgetInstance.executeAction requires runtime.executeAction support.')
    }
    return executeAction(normalizeActionCall(call, this.resolveWidgetRef()))
  }

  async executeVerifiedAction(call, options = {}) {
    const normalizedCall = normalizeActionCall(call, this.resolveWidgetRef())
    const executeVerifiedAction = this.runtime?.executeVerifiedAction
    if (typeof executeVerifiedAction !== 'function') {
      throw new Error('WidgetInstance.executeVerifiedAction requires runtime.executeVerifiedAction support.')
    }
    return executeVerifiedAction(normalizedCall, options)
  }

  async queryPerception(call) {
    const queryPerception = this.runtime?.queryPerception
    if (typeof queryPerception !== 'function') {
      throw new Error('WidgetInstance.queryPerception requires runtime.queryPerception support.')
    }
    return queryPerception(normalizePerceptionCall(call, this.resolveWidgetRef()))
  }

  async runDataQuery(call) {
    const runDataQuery = this.runtime?.runDataQuery
      || this.runtime?.queryData
    if (typeof runDataQuery !== 'function') {
      throw new Error('WidgetInstance.runDataQuery requires runtime.runDataQuery or runtime.queryData support.')
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
    runtimeOptions,
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
