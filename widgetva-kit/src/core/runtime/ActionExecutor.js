import { isActionPreconditionError, throwActionPrecondition } from './actionErrors.js'
import { validateAgainstSchema } from './schemaValidation.js'
import { ActionContext } from './ActionContext.js'
import { buildActionVerificationPayload } from './actionVerification.js'
import { beginBranchFromStateInStore } from './workspaceStoreMutators.js'
import { createDefaultWidgetVAHostBridge, createWidgetVAHostBridge } from './hostBridge.js'
import { makeTransformState } from '../protocol/state.js'
import { makeActionResult, makeResultError } from '../protocol/results.js'
import {
  makeActionExecutorActionEntry,
  makeActionExecutorCapabilities,
  makeActionExecutorCounts,
  makeActionExecutorSummary,
} from '../protocol/actionExecutor.js'
import { buildSelectionPayloadFromState } from './materializers/selectionStateShape.js'
import { readSelectionRegistry } from '../../workspace/state/selectionStateModel.js'
import { deriveHighlightState, withHighlightSubmodel } from '../../workspace/state/highlightStateModel.js'
import { updateSharedStateInStore } from '../../workspace/state/workspaceSharedStateMutators.js'
import { buildScopedParams, readNormalizedQueryScope } from './queryScope.js'
import { describeActionUsageSurface } from './actionUsageSurface.js'

function buildActionError({ call, code, message, recoveryHints, details }) {
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

function selectionPayloadFromSnapshot(snapshot) {
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

function selectionPayloadsFromSnapshot(snapshot) {
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

function primaryWidgetSpecFromSnapshot(snapshot) {
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

function isFilterTransformForField(transform, field) {
  return transform?.filter?.field === field
}

function replaceFilterTransformForField(transforms, field, nextTransform) {
  const safeTransforms = Array.isArray(transforms) ? transforms : []
  const nextTransforms = safeTransforms.filter((transform) => !isFilterTransformForField(transform, field))
  return [...nextTransforms, nextTransform]
}

function replaceAggregateTransforms(transforms, nextTransform) {
  const safeTransforms = Array.isArray(transforms) ? transforms : []
  const nextTransforms = safeTransforms.filter((transform) => !Array.isArray(transform?.aggregate))
  return nextTransform ? [...nextTransforms, nextTransform] : nextTransforms
}

function isActionHighlightTransformForField(transform, field) {
  return transform?.kind === 'highlight'
    && transform?.source === 'action:widget.highlightValues'
    && transform?.spec?.field === field
}

function replaceActionHighlightTransformForField(transforms, field, nextTransform) {
  const safeTransforms = Array.isArray(transforms) ? transforms : []
  const nextTransforms = safeTransforms.filter((transform) => !isActionHighlightTransformForField(transform, field))
  return nextTransform ? [...nextTransforms, nextTransform] : nextTransforms
}

function resolvedWidgetRefForTarget(store, targetRef) {
  if (!targetRef) return null
  return store?.getResolvedWidgetForTarget?.(targetRef)?.ref
    || store?.getResolvedWidget?.(targetRef)?.ref
    || null
}

function uniqueValues(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => value != null))]
}

function markHighlightedRows(rows, field, values) {
  const highlightedValues = uniqueValues(values)
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    __widgetva_highlight: highlightedValues.includes(row?.[field]),
  }))
}

function annotationsFromSnapshot(snapshot) {
  return Array.isArray(snapshot?.shared?.annotations) ? snapshot.shared.annotations : []
}

function mergeUniqueRefs(...groups) {
  return Array.from(
    new Set(
      groups.flatMap((group) => (Array.isArray(group) ? group : [])).filter((ref) => typeof ref === 'string' && ref.length > 0),
    ),
  )
}

function callRemovesSelection(output, descriptor) {
  if (output?.clearsSelection === true) return true
  const actionName = descriptor?.name || null
  return actionName === 'widget.clearSelection'
    || actionName === 'workspace.resetWorkspace'
    || actionName === 'workspace.jumpToState'
    || actionName === 'workspace.branchFromState'
}

function buildHandlerInput(call) {
  const params = buildScopedParams({
    params: call?.params || {},
    call,
  })
  const queryScope = params?.queryScope || readNormalizedQueryScope({ call })
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
    ...(queryScope?.widgetRef ? { targetRef: queryScope.widgetRef } : {}),
    params,
    queryScope,
  }
}

function resolveActionTargetRef(call, descriptor = null) {
  return readNormalizedQueryScope({ call, descriptor }).widgetRef || null
}

function hasOwnParam(params, name) {
  return Boolean(params) && Object.prototype.hasOwnProperty.call(params, name)
}

function buildResolvedQueryScope(normalizedCall, usageSummary) {
  const currentScope = normalizedCall?.queryScope && typeof normalizedCall.queryScope === 'object'
    ? { ...normalizedCall.queryScope }
    : {}

  if (!currentScope.widgetRef && typeof usageSummary?.targetRef === 'string' && usageSummary.targetRef.length > 0) {
    currentScope.widgetRef = usageSummary.targetRef
  }

  return currentScope
}

function buildExecutableCall(call, usageSummary) {
  const normalizedCall = buildHandlerInput(call)
  const resolvedQueryScope = buildResolvedQueryScope(normalizedCall, usageSummary)
  const nextParams = {
    ...(normalizedCall.params || {}),
  }

  if (Object.keys(resolvedQueryScope).length > 0) {
    nextParams.queryScope = resolvedQueryScope
  }

  return {
    ...normalizedCall,
    ...(resolvedQueryScope?.widgetRef ? { targetRef: resolvedQueryScope.widgetRef } : {}),
    params: nextParams,
    queryScope: resolvedQueryScope,
  }
}

function buildInvalidParamsRecoveryHints({ call, usageSummary, usageEntry, executableCall }) {
  const hints = []
  const params = executableCall?.params || {}
  const missingParams = (usageEntry?.requiredParams || []).filter((param) => !hasOwnParam(params, param))

  if (missingParams.length > 0) {
    hints.push(`Provide the required params for ${call?.name || 'this action'}: ${missingParams.join(', ')}.`)
  }
  if (usageEntry && Object.keys(usageEntry.suggestedParams || {}).length > 0) {
    hints.push(`The runtime suggests these params, but does not inject them automatically: ${Object.keys(usageEntry.suggestedParams).join(', ')}.`)
  }
  if (typeof usageSummary?.targetRef === 'string' && usageSummary.targetRef.length > 0 && call?.name) {
    hints.push(`Call describeActionUsage({ targetRef: "${usageSummary.targetRef}", actionName: "${call.name}" }) to inspect recommended params.`)
  }
  return hints
}

export class ActionExecutor {
  constructor({ store, sync, hostBridge, getState, getAppState, subscribe, linkEngine, traceRecorder } = {}) {
    this.store = store || {
      listActions() {
        return []
      },
    }
    this.sync = typeof sync === 'function' ? sync : () => {}
    this.hostBridge = hostBridge || createWidgetVAHostBridge({ getState, getAppState, subscribe }) || createDefaultWidgetVAHostBridge()
    this.linkEngine = linkEngine || null
    this.traceRecorder = traceRecorder || null
    this.builtinDescriptors = new Map()
    this.handlers = new Map()
    this.preconditionHandlers = new Map()
    this.registerBuiltinPreconditions()
    this.registerBuiltinHandlers()
  }

  register(descriptor, handler) {
    if (!descriptor?.name || typeof handler !== 'function') {
      throw new Error('ActionExecutor.register requires a descriptor.name and handler.')
    }
    if (this.handlers.has(descriptor.name)) {
      throw new Error(`Duplicate action handler registration: ${descriptor.name}`)
    }
    this.builtinDescriptors.set(descriptor.name, descriptor)
    this.handlers.set(descriptor.name, handler)
  }

  list() {
    const descriptors = this.store?.listActions?.() || []
    if (descriptors.length > 0) {
      return descriptors.filter((descriptor) => this.handlers.has(descriptor.name))
    }
    return Array.from(this.builtinDescriptors.values())
  }

  has(name) {
    return this.handlers.has(name)
  }

  describeExecutor() {
    const actions = this.list().map((descriptor) => makeActionExecutorActionEntry({
      name: descriptor.name,
      primitive: descriptor.primitive || null,
      category: descriptor.category || null,
      targetRef: descriptor.targetRef || null,
      affectedRefs: Array.isArray(descriptor.affectedRefs) ? [...descriptor.affectedRefs] : [],
      affectedStatePaths: Array.isArray(descriptor.affectedStatePaths) ? [...descriptor.affectedStatePaths] : [],
      supportedWidgetKinds: Array.isArray(descriptor.supportedWidgetKinds)
        ? [...descriptor.supportedWidgetKinds]
        : null,
      hasPreconditions: Array.isArray(descriptor.preconditions) && descriptor.preconditions.length > 0,
      preconditionDescriptorCount: Array.isArray(descriptor.preconditions) ? descriptor.preconditions.length : 0,
      preconditionHandlerRegistered: this.preconditionHandlers.has(descriptor.name),
      postconditionCount: Array.isArray(descriptor.postconditions) ? descriptor.postconditions.length : 0,
      reversible: descriptor.reversible === true,
      effectCount: Array.isArray(descriptor.effects) ? descriptor.effects.length : 0,
      effectKinds: Array.isArray(descriptor.effects)
        ? [...new Set(descriptor.effects.map((effect) => effect?.kind).filter((kind) => typeof kind === 'string' && kind.length > 0))]
        : [],
    }))
    return makeActionExecutorSummary({
      counts: makeActionExecutorCounts({
        descriptorCount: actions.length,
        handlerCount: this.handlers.size,
        preconditionCount: this.preconditionHandlers.size,
      }),
      capabilities: makeActionExecutorCapabilities({
        paramsValidation: true,
        preconditionValidation: true,
        stateSync: typeof this.sync === 'function',
        traceRecording: typeof this.traceRecorder?.recordAction === 'function',
        linkPropagation: Boolean(this.linkEngine),
      }),
      actions,
    })
  }

  describeContext() {
    return ActionContext.describeContract()
  }

  describeActionUsage(options = {}, contextOverride = null) {
    return describeActionUsageSurface({
      actionExecutor: this,
      options,
      contextOverride,
    })
  }

  registerPrecondition(name, handler) {
    if (!name || typeof handler !== 'function') {
      throw new Error('ActionExecutor.registerPrecondition requires an action name and handler.')
    }
    this.preconditionHandlers.set(name, handler)
  }

  findCompatibleDescriptor(actionName, targetRef, storeOverride = null) {
    const store = storeOverride || this.store
    if (!actionName || !targetRef) return null
    const exactDescriptor = store?.getActionDescriptor?.(actionName, targetRef)
    if (exactDescriptor) return exactDescriptor

    const targetWidgetRef = resolvedWidgetRefForTarget(store, targetRef)
    if (!targetWidgetRef) return null

    const candidateDescriptors = (store?.listActions?.() || [])
      .filter((descriptor) => descriptor?.name === actionName)

    return candidateDescriptors.find((descriptor) => {
      const descriptorTargetRef = descriptor?.targetRef || null
      if (!descriptorTargetRef) return false
      return resolvedWidgetRefForTarget(store, descriptorTargetRef) === targetWidgetRef
    }) || null
  }

  resolveDescriptor(call, storeOverride = null) {
    return (
      this.findCompatibleDescriptor(call?.name, resolveActionTargetRef(call), storeOverride) ||
      this.builtinDescriptors.get(call?.name) ||
      null
    )
  }

  createContext(call, descriptor, contextOverride = null) {
    const normalizedCall = buildHandlerInput(call)
    if (contextOverride instanceof ActionContext) {
      contextOverride.descriptor = descriptor
      contextOverride.call = normalizedCall
      return contextOverride
    }

    const store = contextOverride?.store || this.store
    const hasStateAccessOverride = typeof contextOverride?.getState === 'function'
      || typeof contextOverride?.getAppState === 'function'
      || typeof contextOverride?.subscribe === 'function'
      || typeof contextOverride?.subscribeAppState === 'function'
    const overrideHostBridge = contextOverride?.hostBridge
      || (
        hasStateAccessOverride
          ? {
              ...this.hostBridge,
              ...createWidgetVAHostBridge({
                getState: contextOverride?.getState,
                getAppState: contextOverride?.getAppState,
                subscribe: contextOverride?.subscribe,
                subscribeAppState: contextOverride?.subscribeAppState,
              }),
            }
          : null
      )
    const ctx = new ActionContext({
      store,
      descriptor,
      call: normalizedCall,
      sync: contextOverride?.syncWorkspace || contextOverride?.sync || this.sync || (() => {}),
      hostBridge: overrideHostBridge || this.hostBridge,
      getAppState: contextOverride?.getAppState,
      linkEngine: contextOverride?.linkEngine || this.linkEngine || null,
      helpers: {
        primaryWidgetSpecFromSnapshot,
        selectionPayloadFromSnapshot,
        selectionPayloadsFromSnapshot,
        annotationsFromSnapshot,
      },
    })

    if (typeof contextOverride?.patchWidget === 'function') {
      ctx.patchWidget = contextOverride.patchWidget.bind(contextOverride)
    }
    if (typeof contextOverride?.propagate === 'function') {
      ctx.propagate = contextOverride.propagate.bind(contextOverride)
    }
    if (typeof contextOverride?.readStatePatch === 'function') {
      ctx.readStatePatch = contextOverride.readStatePatch.bind(contextOverride)
    }
    if (typeof contextOverride?.readCurrentState === 'function') {
      ctx.readCurrentState = contextOverride.readCurrentState.bind(contextOverride)
    }
    if (typeof contextOverride?.readDescription === 'function') {
      ctx.readDescription = contextOverride.readDescription.bind(contextOverride)
    }
    if (typeof contextOverride?.clearSelection === 'function') {
      ctx.clearSelection = contextOverride.clearSelection.bind(contextOverride)
    }

    return ctx
  }

  async checkPreconditions(call, descriptor, ctx) {
    const handler = this.preconditionHandlers.get(call?.name)
    if (!handler) return
    const outcome = await handler(buildHandlerInput(call), ctx, descriptor)
    if (outcome == null || outcome === true) return
      if (outcome === false) {
        const fallbackMessage = descriptor?.preconditions?.[0]?.failureMessage || `Preconditions failed for action ${call?.name || 'unknown'}.`
        throwActionPrecondition(fallbackMessage)
      }
      if (typeof outcome === 'string') {
        throwActionPrecondition(outcome)
      }
      if (typeof outcome === 'object' && outcome.ok === false) {
        throwActionPrecondition(
          outcome.message || descriptor?.preconditions?.[0]?.failureMessage || `Preconditions failed for action ${call?.name || 'unknown'}.`,
          outcome.details,
          outcome.recoveryHints,
        )
      }
  }

  async run(call, contextOverride = null) {
    const effectiveStore = contextOverride?.store || this.store || null
    const traceRecorder = contextOverride?.traceRecorder || this.traceRecorder || null
    const resolvedDescriptor = this.resolveDescriptor(call, effectiveStore)
    const targetRef = resolveActionTargetRef(call, resolvedDescriptor)
    const storeDescriptor = this.findCompatibleDescriptor(call?.name, targetRef, effectiveStore)
    const descriptor = storeDescriptor || resolvedDescriptor
    const storeHasActionSurface = (effectiveStore?.listActions?.() || []).length > 0
    const handler = this.handlers.get(call?.name)

    if (!handler) {
      const result = buildActionError({
        call,
        code: 'UNKNOWN_OPERATION',
        message: `Unsupported WidgetVA action: ${call?.name || 'unknown'}.`,
        recoveryHints: ['Call describeWorkspace() to inspect currently supported actions.'],
      })
      traceRecorder?.recordActionFailure?.({
        call,
        code: result.error.code,
        message: result.error.message,
        recoveryHints: result.recoveryHints,
      })
      return result
    }

    if (storeHasActionSurface && targetRef && !storeDescriptor && !this.builtinDescriptors.has(call?.name)) {
      const result = buildActionError({
        call,
        code: 'UNSUPPORTED_TARGET',
        message: `Action ${call?.name || 'unknown'} is not declared for target ${targetRef}.`,
        recoveryHints: ['Call describeWorkspace() to inspect which actions are declared on the target widget.'],
      })
      traceRecorder?.recordActionFailure?.({
        call,
        primitive: descriptor?.primitive || null,
        code: result.error.code,
        message: result.error.message,
        recoveryHints: result.recoveryHints,
      })
      return result
    }

    const usageSummary = this.describeActionUsage({
      targetRef,
      actionName: call?.name || null,
      includeSchemas: false,
      includeExamples: false,
    }, contextOverride)
    const usageEntry = Array.isArray(usageSummary?.actions)
      ? usageSummary.actions.find((entry) => entry?.name === call?.name) || null
      : null
    const executableCall = buildExecutableCall(call, usageSummary)

    if (descriptor?.paramsSchema) {
      try {
        validateAgainstSchema(executableCall.params || {}, descriptor.paramsSchema, 'params')
      } catch (error) {
        const result = buildActionError({
          call: executableCall,
          code: 'INVALID_PARAMS',
          message: error instanceof Error ? error.message : String(error),
          recoveryHints: buildInvalidParamsRecoveryHints({
            call,
            usageSummary,
            usageEntry,
            executableCall,
          }),
          details: {
            targetRef: usageSummary?.targetRef || targetRef || null,
            requiredParams: usageEntry?.requiredParams || [],
            suggestedParams: usageEntry?.suggestedParams || {},
            diagnostics: usageEntry?.diagnostics || usageSummary?.diagnostics || [],
          },
        })
        traceRecorder?.recordActionFailure?.({
          call: executableCall,
          primitive: descriptor?.primitive || null,
          code: result.error.code,
          message: result.error.message,
          recoveryHints: result.recoveryHints,
        })
        return result
      }
    }

    try {
      const ctx = this.createContext(executableCall, descriptor, contextOverride)
      const previousState = ctx.readCurrentState()
      await this.checkPreconditions(executableCall, descriptor, ctx)
      const rawOutput = await handler(buildHandlerInput(executableCall), ctx)
      const baseNextState = rawOutput?.nextState || ctx.readCurrentState()
      const output = this.enrichActionOutput({
        output: rawOutput,
        descriptor,
        ctx,
        previousState,
        nextState: baseNextState,
      })
      const nextState = output?.nextState || baseNextState
      const updatedRefs = Array.isArray(output?.updatedRefs)
        ? output.updatedRefs
        : ctx.collectUpdatedRefs(nextState, output?.extraRefs || [])
      const statePatch = output?.statePatch || ctx.readStatePatch(updatedRefs)
      const primitive = descriptor?.primitive || null
      const verificationPayload = buildActionVerificationPayload({
        descriptor,
        updatedRefs,
        verificationHints: output?.verificationHints,
      })
      traceRecorder?.recordAction?.({
        call: executableCall,
        updatedRefs,
        stateId: nextState.stateId,
        statePatch,
        primitive,
        notes: {
          ...(output?.notes || {}),
          ...(typeof verificationPayload.verificationNote === 'string'
            && verificationPayload.verificationNote.length > 0
            ? { verification: verificationPayload.verificationNote }
            : {}),
          ...(verificationPayload.verificationHints.length > 0
            ? { verificationHints: verificationPayload.verificationHints }
            : {}),
        },
      })
      if (output?.transition && typeof traceRecorder?.recordSystemTransition === 'function') {
        traceRecorder.recordSystemTransition({
          actor: call?.actor || 'agent',
          transitionType: output.transition.type || 'continue',
          stateId: nextState.stateId,
          affectedRefs: updatedRefs,
          statePatch,
          notes: output.transition.notes,
        })
      }
      return makeActionResult({
        ok: true,
        callId: call?.callId || `call_${Date.now()}`,
        actionName: call?.name || 'unknown',
        updatedRefs,
        stateId: nextState.stateId,
        statePatch,
        result: output?.result,
        expectedPostconditions: verificationPayload.expectedPostconditions,
        verificationHints: verificationPayload.verificationHints.length > 0
          ? verificationPayload.verificationHints
          : [
              'Call readState({ refs: updatedRefs }) to verify the state update.',
              'Call a perception query if the task requires numerical or aggregate evidence.',
            ],
      })
    } catch (error) {
      if (isActionPreconditionError(error)) {
        const result = buildActionError({
          call,
          code: 'PRECONDITION_FAILED',
          message: error.message,
          details: error.details,
          recoveryHints: error.recoveryHints,
        })
        traceRecorder?.recordActionFailure?.({
          call,
          primitive: descriptor?.primitive || null,
          code: result.error.code,
          message: result.error.message,
          details: result.error.details,
          recoveryHints: result.recoveryHints,
        })
        return result
      }
      const result = buildActionError({
        call,
        code: 'RUNTIME_ERROR',
        message: error instanceof Error ? error.message : String(error),
      })
      traceRecorder?.recordActionFailure?.({
        call,
        primitive: descriptor?.primitive || null,
        code: result.error.code,
        message: result.error.message,
      })
      return result
    }
  }

  enrichActionOutput({ output, descriptor, ctx, previousState, nextState }) {
    if (!output || typeof output !== 'object') return output

    const call = ctx?.call || null
    const selectionResolveOptions = {
      targetRef: resolveActionTargetRef(call, descriptor),
      kind: descriptor?.supportedWidgetKinds?.[0] || null,
    }
    const previousSelectionRef = ctx.resolveSelectionRef(previousState, selectionResolveOptions)
    const nextSelectionRef = ctx.resolveSelectionRef(nextState, selectionResolveOptions)
    const shouldPropagateSelection = Boolean(output.propagateFromSelection)
      || (descriptor?.primitive === 'select' && !Array.isArray(output.updatedRefs))
    const propagateFromRef = output.propagateFromRef
      || (shouldPropagateSelection ? nextSelectionRef : null)
      || (
        previousSelectionRef && !nextSelectionRef && (
          descriptor?.primitive === 'select'
          || descriptor?.primitive === 'reset'
          || descriptor?.primitive === 'undo'
          || callRemovesSelection(output, descriptor)
        )
          ? previousSelectionRef
          : null
      )

    if (!propagateFromRef) {
      return output
    }

      const propagation = ctx.collectPropagation(propagateFromRef, { state: nextState })
      return {
        ...output,
        nextState: propagation.nextState || nextState,
        updatedRefs: mergeUniqueRefs(
          Array.isArray(output.updatedRefs) ? output.updatedRefs : ctx.collectUpdatedRefs(nextState, output?.extraRefs || []),
          propagation.refs,
      ),
      result: {
        ...(output.result || {}),
        ...(output.result?.propagated ? {} : { propagated: propagation.links }),
        ...(output.result?.propagationEffects ? {} : { propagationEffects: propagation.effects }),
      },
    }
  }

  registerBuiltinPreconditions() {
    this.registerPrecondition('widget.undoSelection', (call, ctx) => {
      if (!ctx.hasUndoSelectionHistory()) {
        return {
          ok: false,
          message: 'No prior selection state is available to restore.',
          recoveryHints: [
            'Run a selection action first so there is history to restore.',
            'Call readState() or readTrace() to confirm whether any prior selection exists.',
          ],
        }
      }
      return { ok: true }
    })

    this.registerPrecondition('widget.redoSelection', (call, ctx) => {
      if (!ctx.hasRedoSelectionHistory()) {
        return {
          ok: false,
          message: 'No redo selection state is available to restore.',
          recoveryHints: [
            'Run widget.undoSelection first so there is a redo selection state to restore.',
            'Avoid making a new selection before redo, because new selections clear redo history.',
          ],
        }
      }
      return { ok: true }
    })

    this.registerPrecondition('workspace.jumpToState', (call, ctx) => {
      const targetStateId = call?.params?.stateId
      const snapshot = targetStateId ? ctx.readSnapshot(targetStateId) : null
      if (!snapshot) {
        return {
          ok: false,
          message: 'The requested stateId is not available in runtime history.',
          details: { stateId: targetStateId || null },
          recoveryHints: [
            'Call listStateHistory() to inspect available stateIds.',
            'Choose a valid historical state before retrying jumpToState.',
          ],
        }
      }
      return { ok: true }
    })

    this.registerPrecondition('workspace.branchFromState', (call, ctx) => {
      const targetStateId = call?.params?.stateId
      const snapshot = targetStateId ? ctx.readSnapshot(targetStateId) : null
      if (!snapshot) {
        return {
          ok: false,
          message: 'The requested branch origin stateId is not available.',
          details: { stateId: targetStateId || null },
          recoveryHints: [
            'Call listStateHistory() to inspect available branch origin stateIds.',
            'Retry branchFromState with a valid historical state.',
          ],
        }
      }
      return { ok: true }
    })

    this.registerPrecondition('table.focusRows', (call, ctx) => {
      const targetWidgetCheck = this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'table',
        message: 'table.focusRows requires a valid target table widget.',
        recoveryHints: [
          'Call describeWorkspace() to inspect valid table widget refs.',
          'Retry table.focusRows with a targetRef that resolves to a table widget.',
        ],
      })
      if (targetWidgetCheck?.ok === false) return targetWidgetCheck
      const params = call?.params || {}
      if (typeof params.keyField === 'string' && params.keyField.trim()) {
        return { ok: true }
      }
      const targetWidget = ctx.requireTargetWidget({
        targetRef: resolveActionTargetRef(call),
        kind: 'table',
        message: 'table.focusRows requires a valid target table widget.',
      })
      const widgetState = targetWidget?.ref ? ctx.readCurrentState({ refs: [targetWidget.ref] })?.widgets?.[targetWidget.ref] : null
      const columns = Array.isArray(widgetState?.rawSpec?.columns) ? widgetState.rawSpec.columns : []
      if (columns.length === 0) {
        return {
          ok: false,
          message: 'No usable key field is available for row focus.',
          details: { targetRef: targetWidget?.ref || null },
          recoveryHints: [
            'Provide an explicit keyField in the action params if the table has one.',
            'Inspect the table schema to confirm whether a stable row identity field exists.',
          ],
        }
      }
      return { ok: true }
    })

    this.registerPrecondition('scatter.brushRegion', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'scatter',
        message: 'scatter.brushRegion requires a valid scatter target widget.',
      })
    })

    this.registerPrecondition('bar.selectCategory', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'bar',
        message: 'bar.selectCategory requires a valid bar target widget.',
      })
    })

    this.registerPrecondition('bar.highlightTopN', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'bar',
        message: 'bar.highlightTopN requires a valid bar target widget.',
      })
    })

    this.registerPrecondition('bar.filterCategories', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'bar',
        message: 'bar.filterCategories requires a valid bar target widget.',
      })
    })

    this.registerPrecondition('bar.filterSubcategories', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'bar',
        message: 'bar.filterSubcategories requires a valid bar target widget.',
      })
    })

    this.registerPrecondition('bar.expandStack', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'bar',
        message: 'bar.expandStack requires a valid bar target widget.',
      })
    })

    this.registerPrecondition('bar.toggleStackMode', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'bar',
        message: 'bar.toggleStackMode requires a valid bar target widget.',
      })
    })

    this.registerPrecondition('line.selectSeries', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'line',
        message: 'line.selectSeries requires a valid line target widget.',
      })
    })

    this.registerPrecondition('line.zoomXRegion', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'line',
        message: 'line.zoomXRegion requires a valid line target widget.',
      })
    })

    this.registerPrecondition('line.focusLines', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'line',
        message: 'line.focusLines requires a valid line target widget.',
      })
    })

    this.registerPrecondition('line.filterLines', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'line',
        message: 'line.filterLines requires a valid line target widget.',
      })
    })

    this.registerPrecondition('heatmap.selectCell', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'heatmap',
        message: 'heatmap.selectCell requires a valid heatmap target widget.',
      })
    })

    this.registerPrecondition('heatmap.highlightRegion', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'heatmap',
        message: 'heatmap.highlightRegion requires a valid heatmap target widget.',
      })
    })

    this.registerPrecondition('heatmap.adjustColorScale', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'heatmap',
        message: 'heatmap.adjustColorScale requires a valid heatmap target widget.',
      })
    })

    this.registerPrecondition('heatmap.thresholdMask', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'heatmap',
        message: 'heatmap.thresholdMask requires a valid heatmap target widget.',
      })
    })

    this.registerPrecondition('heatmap.filterCellsByRegion', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'heatmap',
        message: 'heatmap.filterCellsByRegion requires a valid heatmap target widget.',
      })
    })

    this.registerPrecondition('heatmap.highlightRegionByValue', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'heatmap',
        message: 'heatmap.highlightRegionByValue requires a valid heatmap target widget.',
      })
    })

    this.registerPrecondition('heatmap.transpose', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'heatmap',
        message: 'heatmap.transpose requires a valid heatmap target widget.',
      })
    })

    this.registerPrecondition('map.selectRegion', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'map',
        message: 'map.selectRegion requires a valid map target widget.',
      })
    })

    this.registerPrecondition('sankey.focusFlow', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'sankey',
        message: 'sankey.focusFlow requires a valid sankey target widget.',
      })
    })

    this.registerPrecondition('parallelCoordinates.brushAxes', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        kind: 'parallelCoordinates',
        message: 'parallelCoordinates.brushAxes requires a valid parallel coordinates target widget.',
      })
    })

    this.registerPrecondition('widget.highlightValues', (call, ctx) => {
      const targetWidgetCheck = this.readTargetWidgetPrecondition({
        call,
        ctx,
        message: 'widget.highlightValues requires a valid target widget.',
      })
      if (targetWidgetCheck?.ok === false) return targetWidgetCheck
      return this.readBaseSpecPrecondition('highlight updates', ctx)
    })

    this.registerPrecondition('widget.aggregateData', (call, ctx) => {
      const targetWidgetCheck = this.readTargetWidgetPrecondition({
        call,
        ctx,
        message: 'widget.aggregateData requires a valid target widget.',
      })
      if (targetWidgetCheck?.ok === false) return targetWidgetCheck
      return this.readBaseSpecPrecondition('aggregate updates', ctx)
    })

    this.registerPrecondition('widget.filterByRange', (call, ctx) => {
      const targetWidgetCheck = this.readTargetWidgetPrecondition({
        call,
        ctx,
        message: 'widget.filterByRange requires a valid target widget.',
      })
      if (targetWidgetCheck?.ok === false) return targetWidgetCheck
      return this.readBaseSpecPrecondition('filter updates', ctx)
    })

    this.registerPrecondition('widget.sortEncoding', (call, ctx) => {
      const targetWidgetCheck = this.readTargetWidgetPrecondition({
        call,
        ctx,
        message: 'widget.sortEncoding requires a valid target widget.',
      })
      if (targetWidgetCheck?.ok === false) return targetWidgetCheck
      const baseSpecCheck = this.readBaseSpecPrecondition('sort updates', ctx)
      if (baseSpecCheck?.ok === false) return baseSpecCheck
      const channel = typeof call?.params?.channel === 'string' ? call.params.channel : null
      const spec = ctx.readCurrentSpec()
      const currentChannel = channel ? spec?.encoding?.[channel] : null
      if (!currentChannel || typeof currentChannel !== 'object') {
        return {
          ok: false,
          message: `The active spec does not define encoding channel "${channel || 'unknown'}".`,
          details: { channel: channel || null },
        }
      }
      return { ok: true }
    })

    this.registerPrecondition('widget.changeEncoding', (call, ctx) => {
      const targetWidgetCheck = this.readTargetWidgetPrecondition({
        call,
        ctx,
        message: 'widget.changeEncoding requires a valid target widget.',
      })
      if (targetWidgetCheck?.ok === false) return targetWidgetCheck
      return this.readBaseSpecPrecondition('encoding updates', ctx)
    })

    this.registerPrecondition('widget.zoomDomain', (call, ctx) => {
      const targetWidgetCheck = this.readTargetWidgetPrecondition({
        call,
        ctx,
        message: 'widget.zoomDomain requires a valid target widget.',
      })
      if (targetWidgetCheck?.ok === false) return targetWidgetCheck
      const baseSpecCheck = this.readBaseSpecPrecondition('domain updates', ctx)
      if (baseSpecCheck?.ok === false) return baseSpecCheck
      const spec = ctx.readCurrentSpec()
      const hasXDomain = Array.isArray(call?.params?.xDomain)
      const hasYDomain = Array.isArray(call?.params?.yDomain)
      if (hasXDomain && !spec?.encoding?.x) {
        return {
          ok: false,
          message: 'The active spec does not define the requested zoom domain channel.',
          details: { channel: 'x' },
        }
      }
      if (hasYDomain && !spec?.encoding?.y) {
        return {
          ok: false,
          message: 'The active spec does not define the requested zoom domain channel.',
          details: { channel: 'y' },
        }
      }
      return { ok: true }
    })

    this.registerPrecondition('workspace.focusWidget', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        message: 'workspace.focusWidget requires a valid target widget.',
      })
    })

    this.registerPrecondition('workspace.addAnnotation', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        allowMissing: true,
        message: 'workspace.addAnnotation targetRef must resolve to a valid widget when provided.',
        recoveryHints: [
          'Omit targetRef to create a workspace-level annotation, or use a valid widget ref from describeWorkspace().',
        ],
      })
    })

    this.registerPrecondition('widget.filterByValues', (call, ctx) => {
      const targetWidgetCheck = this.readTargetWidgetPrecondition({
        call,
        ctx,
        message: 'widget.filterByValues requires a valid target widget.',
      })
      if (targetWidgetCheck?.ok === false) return targetWidgetCheck
      return this.readBaseSpecPrecondition('filter updates', ctx)
    })
  }

  readBaseSpecPrecondition(operationName, ctx) {
    const spec = ctx?.readCurrentSpec?.()
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
      return {
        ok: false,
        message: `No active base spec is available for ${operationName}.`,
        recoveryHints: [
          'Retry the action on a base-spec widget rather than a derived or linked view.',
          'Call describeWorkspace() and inspect supportsSpecMutation/sourceKind before retrying.',
        ],
      }
    }
    return { ok: true }
  }

  readTargetWidgetPrecondition({ call, ctx, kind = null, allowMissing = false, message = null, recoveryHints = null } = {}) {
    const targetRef = resolveActionTargetRef(call)
    if (!targetRef && allowMissing) return { ok: true }
    const targetWidget = ctx?.resolveTargetWidget?.({ targetRef, ...(kind ? { kind } : {}) }) || null
    if (!targetWidget?.ref) {
      return {
        ok: false,
        message: message || 'The requested target widget is not available in the current workspace.',
        details: { targetRef: targetRef || null, kind },
        recoveryHints: Array.isArray(recoveryHints) && recoveryHints.length > 0
          ? recoveryHints
          : [
              'Call describeWorkspace() to inspect valid widget refs before retrying.',
              'Retry the action with a targetRef that resolves to a materialized widget.',
            ],
      }
    }
    return { ok: true }
  }

  resolveTargetWidgetRefs(requestedRefs, ctx) {
    const seen = new Set()
    return requestedRefs
      .map((ref) => ctx?.resolveTargetWidget?.({ targetRef: ref })?.ref || null)
      .filter((ref) => {
        if (!ref || seen.has(ref)) return false
        seen.add(ref)
        return true
      })
  }

  registerBuiltinHandlers() {
    this.register(
      { name: 'widget.updateSelection' },
      async (call, ctx) => {
        const params = call?.params || {}
        const selectionType = typeof params.selection_type === 'string' ? params.selection_type : null
        if (!selectionType) {
          throw new Error('widget.updateSelection requires a selection_type.')
        }
        const targetWidget = ctx.resolveTargetWidget({ targetRef: resolveActionTargetRef(call) })
        const selection = {
          selection_id: typeof params.selection_id === 'string' ? params.selection_id : `sel_${Date.now()}`,
          source_widget_id: typeof params.source_widget_id === 'string'
            ? params.source_widget_id
            : targetWidget?.widgetId || undefined,
          selection_type: selectionType,
          ...(params.domain && typeof params.domain === 'object' ? { domain: params.domain } : {}),
          ...(Array.isArray(params.fields) ? { fields: params.fields } : {}),
          ...(params.value && typeof params.value === 'object' && !Array.isArray(params.value) ? { value: params.value } : {}),
          ...(typeof params.keyField === 'string' ? { keyField: params.keyField } : {}),
          ...(Array.isArray(params.keys) ? { keys: params.keys } : {}),
          ...(typeof params.field === 'string' ? { field: params.field } : {}),
          ...(Array.isArray(params.values) ? { values: params.values } : {}),
          predicates: Array.isArray(params.predicates) ? params.predicates : [],
          count: Number.isFinite(params.count) ? params.count : 0,
          summary: typeof params.summary === 'string' ? params.summary : '',
        }
        if (targetWidget?.ref) {
          ctx.setFocusedWidgetRef(targetWidget.ref)
        }
        return {
          nextState: ctx.commitSelection(selection),
          propagateFromSelection: true,
          result: {
            selection,
            widgetId: targetWidget?.widgetId || null,
          },
          verificationHints: [
            'Read the widget selection state and confirm it matches the supplied runtime selection payload.',
            'Read linked widgets to confirm propagation follows the updated selection.',
          ],
          notes: {
            userVisibleSummary: selection.summary || 'Human-driven selection was applied through the shared action pipeline.',
          },
        }
      },
    )

    this.register(
      { name: 'widget.clearSelection' },
      async (call, ctx) => {
        const targetWidget = ctx.resolveTargetWidget({
          targetRef: resolveActionTargetRef(call),
        })
        const targetAdapter = targetWidget?.ref ? ctx.readWidgetAdapter(targetWidget.ref) : null
        if (typeof targetAdapter?.applySelectionClear === 'function') {
          await Promise.resolve(targetAdapter.applySelectionClear(call?.params || {}))
        }
        return {
          nextState: ctx.clearSelection(),
          result: { cleared: true },
          verificationHints: ['Read the widget state and confirm there is no active selection.'],
        }
      },
    )

    this.register(
      { name: 'widget.undoSelection' },
      async (call, ctx) => ({
        nextState: ctx.undoSelection(),
        result: { restored: true },
        verificationHints: ['Read the widget state and confirm the previous selection was restored.'],
        transition: {
          type: 'undo',
          notes: {
            userVisibleSummary: 'Selection history was rolled back to the prior state.',
          },
        },
      }),
    )

    this.register(
      { name: 'widget.redoSelection' },
      async (call, ctx) => ({
        nextState: ctx.redoSelection(),
        result: { restored: true },
        verificationHints: [
          'Read the widget state and confirm the selection matches the next recorded selection state.',
        ],
        notes: {
          userVisibleSummary: 'Selection history was replayed to the next state.',
        },
        transition: {
          type: 'redo',
          notes: {
            userVisibleSummary: 'Selection history was replayed to the next state.',
          },
        },
      }),
    )

    this.register(
      { name: 'workspace.resetWorkspace' },
      async (call, ctx) => ({
        nextState: ctx.resetWorkspace(),
        result: { reset: true },
        verificationHints: ['Read the workspace state and confirm selections and derived interaction state are cleared.'],
        transition: {
          type: 'reset',
          notes: {
            userVisibleSummary: 'Workspace interaction state was reset to its baseline.',
          },
        },
      }),
    )

    this.register(
      { name: 'workspace.jumpToState' },
      async (call, ctx) => {
        const targetStateId = call?.params?.stateId
        const snapshot = targetStateId ? ctx.readSnapshotEntry(targetStateId) : null
        if (typeof this.store?.beginTransition === 'function') {
          this.store.beginTransition({
            transitionType: 'jump_back',
            parentStateId: targetStateId,
          })
        }
        return {
          nextState: ctx.restoreSnapshotState(snapshot),
          result: { restoredStateId: targetStateId },
          verificationHints: ['Read the workspace state and confirm the restored interaction state matches the target snapshot.'],
          transition: {
            type: 'jump_back',
            notes: {
              userVisibleSummary: `Jumped workspace state back to ${targetStateId}.`,
            },
          },
        }
      },
    )

    this.register(
      { name: 'workspace.branchFromState' },
      async (call, ctx) => {
        const targetStateId = call?.params?.stateId
        const snapshot = targetStateId ? ctx.readSnapshotEntry(targetStateId) : null
        const branch = beginBranchFromStateInStore(this.store, {
          stateId: targetStateId,
          label: call?.params?.branchLabel,
        })
        return {
          nextState: ctx.restoreSnapshotState(snapshot),
          result: {
            restoredStateId: targetStateId,
            branchId: branch.branchId,
            branchLabel: branch.label,
          },
          verificationHints: [
            'Read the workspace state and confirm the restored interaction state matches the branch origin snapshot.',
            'Read trace graph or state history to confirm a new branch was created.',
          ],
          transition: {
            type: 'branch',
            notes: {
              userVisibleSummary: `Created branch ${branch.label} from ${targetStateId}.`,
            },
          },
        }
      },
    )

    this.register(
      { name: 'workspace.focusWidget' },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget({
          targetRef: resolveActionTargetRef(call),
          message: 'workspace.focusWidget requires a valid target widget.',
        })
        const previousFocusedWidgetRef = ctx.readCurrentState()?.shared?.focusedWidget || null
        return {
          nextState: ctx.setFocusedWidgetRef(targetWidget.ref),
          updatedRefs: mergeUniqueRefs([previousFocusedWidgetRef], [targetWidget.ref]),
          result: {
            focusedWidgetRef: targetWidget.ref,
            widgetId: targetWidget.widgetId,
          },
          verificationHints: [
            'Read the workspace state and confirm shared.focusedWidget matches the requested target.',
          ],
          notes: {
            userVisibleSummary: `Focused widget set to ${targetWidget.widgetId}.`,
          },
        }
      },
    )

    this.register(
      { name: 'workspace.addAnnotation' },
      async (call, ctx) => {
        const params = call?.params || {}
        const text = typeof params.text === 'string' ? params.text.trim() : ''
        const targetRef = resolveActionTargetRef(call)
        const targetWidget = targetRef
          ? ctx.requireTargetWidget({
              targetRef,
              message: 'workspace.addAnnotation targetRef must resolve to a valid widget when provided.',
            })
          : null
        if (!text) {
          throw new Error('workspace.addAnnotation requires non-empty annotation text.')
        }
        const annotation = {
          annotationId: `annotation_${Date.now()}`,
          targetRef: targetWidget?.ref || targetRef || ctx.readFocusedWidgetRef() || undefined,
          kind: typeof params.kind === 'string' ? params.kind : 'note',
          text,
          actor: call?.actor || 'agent',
          createdAt: new Date().toISOString(),
        }
        return {
          nextState: ctx.addWorkspaceAnnotation(annotation),
          updatedRefs: annotation.targetRef ? [annotation.targetRef] : [],
          result: annotation,
          verificationHints: [
            'Read the workspace state and confirm shared.annotations contains the new annotation.',
          ],
          notes: {
            userVisibleSummary: `Annotation added${annotation.targetRef ? ` for ${annotation.targetRef}.` : '.'}`,
          },
        }
      },
    )

    this.register(
      { name: 'workspace.clearAnnotations' },
      async (call, ctx) => {
        const currentAnnotations = Array.isArray(ctx.readWorkspaceAnnotations()) ? ctx.readWorkspaceAnnotations() : []
        const affectedRefs = currentAnnotations
          .map((annotation) => annotation?.targetRef)
          .filter((ref) => typeof ref === 'string' && ref.length > 0)
        return {
          nextState: ctx.clearWorkspaceAnnotations(),
          updatedRefs: mergeUniqueRefs(affectedRefs),
          result: { cleared: true },
          verificationHints: ['Read the workspace state and confirm shared.annotations is empty.'],
        }
      },
    )

    this.register(
      { name: 'widget.aggregateData' },
      async (call, ctx) => {
        const params = call?.params || {}
        const groupBy = Array.isArray(params.groupBy) ? params.groupBy.filter((field) => typeof field === 'string' && field.trim()) : []
        const measures = Array.isArray(params.measures)
          ? params.measures
              .map((measure) => ({
                op: typeof measure?.op === 'string' ? measure.op : null,
                field: typeof measure?.field === 'string' ? measure.field : undefined,
                as: typeof measure?.as === 'string' ? measure.as : null,
              }))
              .filter((measure) => measure.op && measure.as)
          : []
        const supportedMeasureOps = new Set(['count', 'sum', 'mean', 'min', 'max', 'median'])
        if (groupBy.length === 0 || measures.length === 0 || measures.some((measure) => !supportedMeasureOps.has(measure.op))) {
          throw new Error('widget.aggregateData requires non-empty groupBy and supported measures (count, sum, mean, min, max, or median) with explicit aliases.')
        }

        const targetWidget = ctx.requireTargetWidget({
          targetRef: resolveActionTargetRef(call),
          message: 'widget.aggregateData requires a valid target widget.',
        })

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throwActionPrecondition('No active base spec is available for aggregate updates.')
          }
          const aggregateTransform = {
            aggregate: measures.map((measure) => ({
              op: measure.op,
              ...(measure.field ? { field: measure.field } : {}),
              as: measure.as,
            })),
            groupby: groupBy,
          }
          return {
            ...spec,
            transform: replaceAggregateTransforms(spec.transform, aggregateTransform),
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            groupBy,
            measures,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the target spec now includes the requested aggregate transform.',
            'Call perception.inspectVisibleRows or summarizeVisible to confirm the widget now exposes grouped summary rows.',
          ],
        }
      },
    )

    this.register(
      { name: 'widget.highlightValues' },
      async (call, ctx) => {
        const params = call?.params || {}
        const field = typeof params.field === 'string' ? params.field : null
        const values = uniqueValues(params.values)
        const targetWidget = ctx.requireTargetWidget({
          targetRef: resolveActionTargetRef(call),
          message: 'widget.highlightValues requires a valid target widget.',
        })
        const targetWidgetRef = targetWidget?.ref || null
        const currentDataRef = targetWidget?.data?.currentDataRef || targetWidget?.data?.sourceDataRef || null
        if (!field || values.length === 0 || !targetWidgetRef || !currentDataRef) {
          throw new Error('widget.highlightValues requires a target widget, field, and at least one value.')
        }

        const runtimeDataEntry = ctx.readRuntimeData(currentDataRef)
        const highlightedRows = markHighlightedRows(runtimeDataEntry?.rows, field, values)
        if (runtimeDataEntry) {
          ctx.updateRuntimeData(currentDataRef, (entry) => ({
            ...entry,
            rows: markHighlightedRows(entry?.rows, field, values),
          }))
        }

        const nextState = ctx.patchWidget(targetWidgetRef, {
          transforms: replaceActionHighlightTransformForField(
            targetWidget?.transforms,
            field,
            makeTransformState({
              kind: 'highlight',
              source: 'action:widget.highlightValues',
              spec: {
                field,
                values,
              },
            }),
          ),
          feedback: {
            ...(targetWidget?.feedback || {}),
            highlightedKeys: values,
          },
          rawSpec: Array.isArray(targetWidget?.rawSpec?.data?.values)
            ? {
                ...targetWidget.rawSpec,
                data: {
                  ...targetWidget.rawSpec.data,
                  values: markHighlightedRows(targetWidget.rawSpec.data.values, field, values),
                },
              }
            : targetWidget?.rawSpec || null,
        })
        const nextStateWithSharedHighlight = updateSharedStateInStore(ctx.store, (shared) =>
          withHighlightSubmodel(shared, deriveHighlightState(nextState)),
        )

        return {
          nextState: nextStateWithSharedHighlight,
          result: {
            widgetId: targetWidget?.widgetId || null,
            field,
            values,
            highlightedCount: highlightedRows.filter((row) => row?.__widgetva_highlight === true).length,
          },
          verificationHints: [
            'Call perception.inspectVisibleRows to verify matching rows now carry highlight markers.',
            'Read the target widget state and confirm feedback.highlightedKeys contains the requested values.',
          ],
        }
      },
    )

    this.register(
      { name: 'widget.filterByValues' },
      async (call, ctx) => {
        const params = call?.params || {}
        const field = typeof params.field === 'string' ? params.field : null
        const values = Array.isArray(params.values) ? params.values.filter((value) => value != null) : []
        const targetWidget = ctx.requireTargetWidget({
          targetRef: resolveActionTargetRef(call),
          message: 'widget.filterByValues requires a valid target widget.',
        })
        const targetWidgetId = targetWidget?.widgetId || null
        if (!field || values.length === 0 || !targetWidgetId) {
          throw new Error('widget.filterByValues requires a target widget, field, and at least one value.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throwActionPrecondition('No active base spec is available for filter updates.')
          }
          return {
            ...spec,
            transform: replaceFilterTransformForField(spec.transform, field, {
              filter: {
                field,
                oneOf: values,
              },
            }),
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidgetId,
            field,
            values,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the target spec now includes the requested categorical filter transform.',
            'Read the target widget state or visible rows to confirm the filtered subset propagated.',
          ],
        }
      },
    )

    this.register(
      { name: 'widget.filterByRange' },
      async (call, ctx) => {
        const params = call?.params || {}
        const field = typeof params.field === 'string' ? params.field : null
        const range = Array.isArray(params.range) ? params.range : null
        const targetWidget = ctx.requireTargetWidget({
          targetRef: resolveActionTargetRef(call),
          message: 'widget.filterByRange requires a valid target widget.',
        })
        const targetWidgetId = targetWidget?.widgetId || null
        if (!field || !Array.isArray(range) || range.length !== 2 || !targetWidgetId) {
          throw new Error('widget.filterByRange requires a target widget, field, and a two-value range.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throwActionPrecondition('No active base spec is available for filter updates.')
          }
          return {
            ...spec,
            transform: replaceFilterTransformForField(spec.transform, field, {
              filter: {
                field,
                range,
              },
            }),
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidgetId,
            field,
            range,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the target spec now includes the requested range filter transform.',
            'Read the target widget state or visible rows to confirm the filtered numeric interval propagated.',
          ],
        }
      },
    )

    this.register(
      { name: 'widget.sortEncoding' },
      async (call, ctx) => {
        const params = call?.params || {}
        const channel = typeof params.channel === 'string' ? params.channel : null
        const order = typeof params.order === 'string' ? params.order : null
        const field = typeof params.field === 'string' ? params.field : null
        const aggregate = typeof params.aggregate === 'string' ? params.aggregate : null
        const targetWidget = ctx.requireTargetWidget({
          targetRef: resolveActionTargetRef(call),
          message: 'widget.sortEncoding requires a valid target widget.',
        })
        const targetWidgetId = targetWidget?.widgetId || null
        if (!channel || !order || !targetWidgetId) {
          throw new Error('widget.sortEncoding requires a target widget, channel, and order.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throwActionPrecondition('No active base spec is available for sort updates.')
          }
          const currentChannel = spec.encoding?.[channel]
          if (!currentChannel || typeof currentChannel !== 'object') {
            throwActionPrecondition(`The active spec does not define encoding channel "${channel}".`)
          }

          const sortField = field || currentChannel.field
          const nextEncoding = {
            ...(spec.encoding || {}),
            [channel]: {
              ...currentChannel,
              sort: sortField
                ? {
                    field: sortField,
                    order,
                    ...(aggregate ? { op: aggregate } : {}),
                  }
                : order,
            },
          }
          return {
            ...spec,
            encoding: nextEncoding,
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidgetId,
            channel,
            order,
            ...(field ? { field } : {}),
            ...(aggregate ? { aggregate } : {}),
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the target encoding now includes the requested sort rule.',
            'Read the target widget state to confirm the sort update propagated.',
          ],
        }
      },
    )

    this.register(
      { name: 'widget.changeEncoding' },
      async (call, ctx) => {
        const params = call?.params || {}
        const channel = typeof params.channel === 'string' ? params.channel : null
        const field = typeof params.field === 'string' ? params.field : null
        const targetWidget = ctx.requireTargetWidget({
          targetRef: resolveActionTargetRef(call),
          message: 'widget.changeEncoding requires a valid target widget.',
        })
        const targetWidgetId = targetWidget?.widgetId || null
        if (!channel || !field || !targetWidgetId) {
          throw new Error('widget.changeEncoding requires a target widget, channel, and field.')
        }

        const targetAdapter = ctx.readWidgetAdapter(targetWidget.ref)
        if (typeof targetAdapter?.applyEncodingChange === 'function') {
          await Promise.resolve(targetAdapter.applyEncodingChange(channel, field, params))
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throwActionPrecondition('No active base spec is available for encoding updates.')
          }
          const nextEncoding = {
            ...(spec.encoding || {}),
            [channel]: {
              ...(spec.encoding?.[channel] || {}),
              field,
              ...(typeof params.type === 'string' ? { type: params.type } : {}),
              ...(params.aggregate ? { aggregate: params.aggregate } : {}),
            },
          }
          return {
            ...spec,
            encoding: nextEncoding,
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidgetId,
            channel,
            field,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the encoding channel now points to the new field.',
            'Read the target widget state to confirm the encoding update propagated.',
          ],
        }
      },
    )

    this.register(
      { name: 'widget.zoomDomain' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: resolveActionTargetRef(call),
          message: 'widget.zoomDomain requires a valid target widget.',
        })
        const xDomain = Array.isArray(params.xDomain) ? params.xDomain : null
        const yDomain = Array.isArray(params.yDomain) ? params.yDomain : null
        if (!targetWidget || (!xDomain && !yDomain)) {
          throw new Error('widget.zoomDomain requires a target widget and at least one domain range.')
        }

        const targetAdapter = ctx.readWidgetAdapter(targetWidget.ref)
        if (typeof targetAdapter?.applyDomainZoom === 'function') {
          await Promise.resolve(targetAdapter.applyDomainZoom({
            xDomain,
            yDomain,
            options: params,
          }))
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throwActionPrecondition('No active base spec is available for domain updates.')
          }
          const nextEncoding = { ...(spec.encoding || {}) }
          if (xDomain && nextEncoding.x) {
            nextEncoding.x = {
              ...nextEncoding.x,
              scale: {
                ...(nextEncoding.x.scale || {}),
                domain: xDomain,
              },
            }
          }
          if (yDomain && nextEncoding.y) {
            nextEncoding.y = {
              ...nextEncoding.y,
              scale: {
                ...(nextEncoding.y.scale || {}),
                domain: yDomain,
              },
            }
          }
          return {
            ...spec,
            encoding: nextEncoding,
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            ...(xDomain ? { xDomain } : {}),
            ...(yDomain ? { yDomain } : {}),
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the target domain was updated.',
            'Read the target widget view state to confirm the new x/y domain values.',
          ],
        }
      },
    )

  }
}
