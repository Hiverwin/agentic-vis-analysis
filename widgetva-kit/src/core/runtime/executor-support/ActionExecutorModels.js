import {
  listStoreWidgets,
  readRuntimeDataFromStore,
  readWorkspaceStateFromStore,
  resolveWidgetRecordFromStore,
} from '../../../workspace/store/workspaceStoreReaders.js'
import { createDefaultWidgetVAHostBridge, createWidgetVAHostBridge } from '../../../host/hostBridge.js'
import { makeActionResult, makeResultError } from '../../../contracts/result-contracts.js'
import { buildSelectionPayloadFromState } from '../materializers/state/selectionStateShape.js'
import { readSelectionRegistry } from '../../../workspace/state/selectionStateModel.js'
import {
  buildScopedParams,
  hasScopedQueryScopeValues,
  readNormalizedQueryScope,
  readScopedQueryScope,
} from '../support/queryScope.js'

function widgetMatchesKind(widget, kind) {
  if (!widget || !kind) return Boolean(widget)
  if (widget.kind === kind) return true
  return Array.isArray(widget.recognizedKinds) && widget.recognizedKinds.includes(kind)
}

export function makeActionHandlerContextSummary() {
  return {
    methods: [
      'targetWidget',
      'readRows',
    ],
    capabilities: {
      workspaceRead: true,
      workspaceWrite: false,
      specMutation: false,
      snapshotReplay: false,
      runtimeDataRead: true,
      runtimeDataWrite: false,
      widgetTargetResolution: true,
      selectionMutation: false,
      linkPropagation: false,
    },
    integrations: {
      store: false,
      appState: false,
      coordinationEngine: false,
      traceRecorder: false,
    },
  }
}

export function createActionRuntimeContext({
  store,
  descriptor,
  call,
  hostBridge,
  getState,
  getAppState,
  subscribe,
  targetWidget = null,
}) {
  const context = {
    store,
    descriptor,
    call,
    hostBridge: hostBridge || createWidgetVAHostBridge({ getState, getAppState, subscribe }) || createDefaultWidgetVAHostBridge(),
    resolvedTargetWidget: targetWidget || null,

    readCurrentState(options = {}) {
      return readWorkspaceStateFromStore(this.store, options)
    },

    readQueryScope() {
      return readNormalizedQueryScope({
        call: this.call,
        descriptor: this.descriptor,
      })
    },

    resolveTargetWidget({ kind, targetRef } = {}) {
      const resolvedRef = targetRef || this.readQueryScope()?.widgetRef || null
      if (resolvedRef) {
        const explicitTarget = resolveWidgetRecordFromStore(this.store, resolvedRef)
        if (!explicitTarget || !widgetMatchesKind(explicitTarget, kind)) return null
        return explicitTarget
      }

      const widgets = listStoreWidgets(this.store)
      if (kind) {
        const matches = widgets
          .filter((widget) => widgetMatchesKind(widget, kind))
          .map((widget) => resolveWidgetRecordFromStore(this.store, widget.ref) || widget)
          .filter(Boolean)
        if (matches.length === 1) return matches[0]
        return null
      }

      const focusedWidgetRef = this.readCurrentState()?.shared?.focusedWidget || this.hostBridge.readFocusedWidgetRef?.() || null
      if (focusedWidgetRef) {
        const focusedWidget = resolveWidgetRecordFromStore(this.store, focusedWidgetRef)
        if (focusedWidget) return focusedWidget
      }
      const firstWidget = widgets[0] || null
      return firstWidget
        ? resolveWidgetRecordFromStore(this.store, firstWidget.ref) || firstWidget
        : null
    },

    targetWidget(options = {}) {
      const kind = options?.kind || this.descriptor?.supportedWidgetKinds?.[0] || null
      const targetRef = options?.targetRef || this.readQueryScope()?.widgetRef || null
      if (this.resolvedTargetWidget
        && (!targetRef || this.resolvedTargetWidget.ref === targetRef || this.resolvedTargetWidget.widgetId === targetRef)
        && widgetMatchesKind(this.resolvedTargetWidget, kind)) {
        return this.resolvedTargetWidget
      }
      const resolvedTargetWidget = this.resolveTargetWidget({ kind, targetRef })
      if (resolvedTargetWidget) return resolvedTargetWidget
      if (kind) {
        throw new Error(`No ${kind}-compatible target widget is available for this action.`)
      }
      throw new Error('No target widget is available for this action.')
    },

    readRows(widgetRef = null) {
      const resolvedWidgetRef = widgetRef || this.targetWidget()?.ref || null
      const widgetState = this.store.getWidgetState?.(resolvedWidgetRef)
        || this.readCurrentState({ refs: [resolvedWidgetRef] })?.widgets?.[resolvedWidgetRef]
      const currentDataRef = widgetState?.data?.materializedDataRef
        || widgetState?.data?.currentDataRef
        || widgetState?.data?.sourceDataRef
      const runtimeData = readRuntimeDataFromStore(this.store, currentDataRef)
      return Array.isArray(runtimeData?.rows) ? runtimeData.rows : []
    },
  }

  return context
}

export function createActionHandlerContext(runtimeContext) {
  const context = {
    call: runtimeContext.call,

    targetWidget(options = {}) {
      return runtimeContext.targetWidget(options)
    },

    readRows(widgetRef = null) {
      return runtimeContext.readRows(widgetRef)
    },
  }

  Object.defineProperty(context, '__widgetvaActionHandlerContext', {
    value: true,
    enumerable: false,
    configurable: false,
  })
  return context
}

function cloneArray(value) {
  return Array.isArray(value) ? [...value] : []
}

export function makeActionExecutorCounts(counts = {}) {
  return {
    descriptorCount: 0,
    handlerCount: 0,
    preconditionCount: 0,
    ...counts,
  }
}

export function makeActionExecutorCapabilities(capabilities = {}) {
  return {
    paramsValidation: false,
    preconditionValidation: false,
    stateSync: false,
    traceRecording: false,
    linkPropagation: false,
    ...capabilities,
  }
}

export function makeActionExecutorActionEntry(action = {}) {
  return {
    name: action?.name || '',
    category: action?.category ?? null,
    targetRef: action?.targetRef ?? null,
    affectedRefs: cloneArray(action?.affectedRefs),
    affectedStatePaths: cloneArray(action?.affectedStatePaths),
    supportedWidgetKinds: Array.isArray(action?.supportedWidgetKinds)
      ? [...action.supportedWidgetKinds]
      : null,
    hasPreconditions: action?.hasPreconditions === true,
    preconditionDescriptorCount: action?.preconditionDescriptorCount || 0,
    preconditionHandlerRegistered: action?.preconditionHandlerRegistered === true,
    postconditionCount: action?.postconditionCount || 0,
    reversible: action?.reversible === true,
    effectCount: action?.effectCount || 0,
    effectKinds: cloneArray(action?.effectKinds),
  }
}

export function makeActionExecutorSummary(summary = {}) {
  return {
    counts: makeActionExecutorCounts(summary?.counts),
    capabilities: makeActionExecutorCapabilities(summary?.capabilities),
    actions: Array.isArray(summary?.actions)
      ? summary.actions.map((action) => makeActionExecutorActionEntry(action))
      : [],
  }
}

export function buildActionError({ call, code, message, recoveryHints, details }) {
  return makeActionResult({
    ok: false,
    callId: call?.callId || `call_${Date.now()}`,
    actionName: call?.name || 'unknown',
    error: makeResultError({
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    }),
    ...(Array.isArray(recoveryHints) && recoveryHints.length > 0 ? { recoveryHints } : {}),
  })
}

function resolveRepresentativeActiveSelection(snapshot) {
  const activeSelections = readSelectionRegistry(snapshot?.shared || {})
  const activeSelectionEntries = Object.entries(activeSelections).filter(([, selectionState]) => Boolean(selectionState))
  if (activeSelectionEntries.length === 0) return [null, null]

  const focusedWidgetRef = snapshot?.shared?.focusedWidget || null
  if (focusedWidgetRef) {
    const focusedSelectionRef = Object.keys(snapshot?.widgets?.[focusedWidgetRef]?.selections || {})
      .find((selectionRef) => activeSelections[selectionRef])
    if (focusedSelectionRef) {
      return [focusedSelectionRef, activeSelections[focusedSelectionRef]]
    }
  }

  const primaryWidgetEntry = Object.entries(snapshot?.widgets || {})
    .find(([, widgetState]) => widgetState?.role === 'primary')
  if (primaryWidgetEntry) {
    const [primaryWidgetRef] = primaryWidgetEntry
    const primarySelectionRef = Object.keys(snapshot?.widgets?.[primaryWidgetRef]?.selections || {})
      .find((selectionRef) => activeSelections[selectionRef])
    if (primarySelectionRef) {
      return [primarySelectionRef, activeSelections[primarySelectionRef]]
    }
  }

  if (activeSelectionEntries.length === 1) return activeSelectionEntries[0]
  return activeSelectionEntries[activeSelectionEntries.length - 1]
}

export function selectionPayloadFromSnapshot(snapshot) {
  const [selectionRef, selectionState] = resolveRepresentativeActiveSelection(snapshot)
  if (!selectionRef || !selectionState) return null
  const sourceWidget = Object.values(snapshot?.widgets || {}).find((widget) => widget?.selections?.[selectionRef])
  return buildSelectionPayloadFromState({
    selectionRef,
    selectionState,
    sourceWidgetId: sourceWidget?.widgetId || undefined,
    selectedCount: sourceWidget?.data?.selectedCount || 0,
  })
}

export function selectionPayloadsFromSnapshot(snapshot) {
  const activeSelections = readSelectionRegistry(snapshot?.shared || {})
  const widgets = Object.values(snapshot?.widgets || {})
  return Object.fromEntries(
    Object.entries(activeSelections)
      .map(([selectionRef, selectionState]) => {
        if (!selectionRef || !selectionState) return null
        const sourceWidget = widgets.find((widget) => widget?.selections?.[selectionRef]) || null
        const payload = buildSelectionPayloadFromState({
          selectionRef,
          selectionState,
          sourceWidgetId: sourceWidget?.widgetId || undefined,
          selectedCount: sourceWidget?.data?.selectedCount || 0,
        })
        return [selectionRef, payload]
      })
      .filter(Boolean),
  )
}

export function primaryWidgetSpecFromSnapshot(snapshot) {
  const widgetEntries = Object.entries(snapshot?.widgets || {})
  if (widgetEntries.length === 0) return null
  const focusedWidgetRef = snapshot?.shared?.focusedWidget
  const focusedWidget = focusedWidgetRef ? snapshot.widgets?.[focusedWidgetRef] : null
  if (focusedWidget?.rawSpec) return focusedWidget.rawSpec

  const primaryWidget = widgetEntries
    .map(([, widgetState]) => widgetState)
    .find((widgetState) => widgetState?.role === 'primary' && widgetState?.rawSpec)
  if (primaryWidget?.rawSpec) return primaryWidget.rawSpec

  const firstWidget = widgetEntries[0]?.[1]
  return firstWidget?.rawSpec || null
}

export function resolvedWidgetRefForTarget(store, targetRef) {
  if (!targetRef) return null
  return store?.getResolvedWidgetForTarget?.(targetRef)?.ref
    || store?.getResolvedWidget?.(targetRef)?.ref
    || null
}

export function readWidgetKindForTarget(store, targetRef) {
  if (!targetRef) return null
  const widget = store?.getResolvedWidgetForTarget?.(targetRef)
    || store?.getResolvedWidget?.(targetRef)
    || store?.getWidgetDescription?.(targetRef)
    || store?.getWidgetState?.(targetRef)
    || null
  return typeof widget?.kind === 'string' && widget.kind.length > 0 ? widget.kind : null
}

function actionFamilyName(actionName) {
  if (typeof actionName !== 'string' || actionName.length === 0) return null
  const [family] = actionName.split('.')
  return family || null
}

export function descriptorCanTargetWidget(descriptor, actionName, targetKind) {
  if (!descriptor?.name || descriptor.name !== actionName || !targetKind) return false
  if (Array.isArray(descriptor.supportedWidgetKinds) && descriptor.supportedWidgetKinds.length > 0) {
    return descriptor.supportedWidgetKinds.includes(targetKind)
  }
  return actionFamilyName(actionName) === targetKind
}

export function mergeUniqueRefs(...groups) {
  return Array.from(
    new Set(
      groups.flatMap((group) => (Array.isArray(group) ? group : [])).filter((ref) => typeof ref === 'string' && ref.length > 0),
    ),
  )
}

export function buildHandlerInput(call) {
  const params = buildScopedParams({
    params: call?.params || {},
    call,
  })
  const targetRef = readNormalizedQueryScope({ call }).widgetRef || null
  const scopedQueryScope = readScopedQueryScope({ call })
  const {
    targetRef: _legacyTargetRef,
    dataRef: _legacyDataRef,
    params: _legacyParams,
    queryScope: _legacyQueryScope,
    ...rawCall
  } = call && typeof call === 'object' ? call : {}
  return {
    ...params,
    ...rawCall,
    ...(targetRef ? { targetRef } : {}),
    params,
    queryScope: hasScopedQueryScopeValues(scopedQueryScope) ? scopedQueryScope : null,
  }
}

export function buildHandlerParams(call) {
  return buildScopedParams({
    params: call?.params || {},
    call,
  })
}

export function buildActionCallSchemaInput(call) {
  const {
    targetRef: _legacyTargetRef,
    dataRef: _legacyDataRef,
    queryScope: _legacyQueryScope,
    ...rawCall
  } = call && typeof call === 'object' ? call : {}
  const queryScope = readScopedQueryScope({ call })
  return {
    ...rawCall,
    ...(hasScopedQueryScopeValues(queryScope) ? { queryScope } : {}),
  }
}

export function resolveActionTargetRef(call, descriptor = null) {
  return readNormalizedQueryScope({ call, descriptor }).widgetRef || null
}

function hasOwnParam(params, name) {
  return Boolean(params) && Object.prototype.hasOwnProperty.call(params, name)
}

function buildResolvedQueryScope(normalizedCall) {
  const currentScope = normalizedCall?.queryScope && typeof normalizedCall.queryScope === 'object'
    ? { ...normalizedCall.queryScope }
    : {}

  return currentScope
}

export function buildExecutableCall(call) {
  const normalizedCall = buildHandlerInput(call)
  const resolvedQueryScope = buildResolvedQueryScope(normalizedCall)
  return {
    ...normalizedCall,
    ...(normalizedCall?.targetRef ? { targetRef: normalizedCall.targetRef } : {}),
    params: {
      ...(normalizedCall.params || {}),
    },
    queryScope: resolvedQueryScope,
  }
}

export function readRequiredParamsFromSchema(schema) {
  return Array.isArray(schema?.required)
    ? schema.required.filter((param) => typeof param === 'string' && param.length > 0)
    : []
}

export function buildInvalidParamsRecoveryHints({ call, requiredParams, executableCall }) {
  const hints = []
  const params = executableCall?.params || {}
  const missingParams = (requiredParams || []).filter((param) => !hasOwnParam(params, param))

  if (missingParams.length > 0) {
    hints.push(`Provide the required params for ${call?.name || 'this action'}: ${missingParams.join(', ')}.`)
  }
  if (call?.name) {
    hints.push(`Call describeWorkspace() to inspect the action descriptor and params schema for ${call.name}.`)
  }
  return hints
}
