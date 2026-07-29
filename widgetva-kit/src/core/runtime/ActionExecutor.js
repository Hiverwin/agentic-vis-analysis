import { isActionPreconditionError, throwActionPrecondition } from './support/actionErrors.js'
import { validateAgainstSchema } from './support/schemaValidation.js'
import { beginBranchFromStateInStore } from '../../workspace/store/workspaceStoreMutators.js'
import {
  readWorkspaceStateFromStore,
  readSnapshotEntryFromStore,
  readSnapshotFromStore,
} from '../../workspace/store/workspaceStoreReaders.js'
import { createDefaultWidgetVAHostBridge, createWidgetVAHostBridge } from '../../host/hostBridge.js'
import { withFocusSubmodel } from '../../workspace/state/focusStateModel.js'
import {
  hasRedoSelectionHistoryInStore,
  hasUndoSelectionHistoryInStore,
  resetWorkspaceInteractionsInStore,
  restoreSnapshotStateInStore,
  redoSelectionInStore,
  undoSelectionInStore,
} from '../../workspace/state/workspaceSharedStateMutators.js'
import {
  buildActionCallSchemaInput,
  buildActionError,
  buildExecutableCall,
  buildHandlerInput,
  buildHandlerParams,
  buildInvalidParamsRecoveryHints,
  createActionHandlerContext,
  createActionRuntimeContext,
  descriptorCanTargetWidget,
  makeActionExecutorActionEntry,
  makeActionExecutorCapabilities,
  makeActionExecutorCounts,
  makeActionExecutorSummary,
  makeActionHandlerContextSummary,
  mergeUniqueRefs,
  primaryWidgetSpecFromSnapshot,
  readRequiredParamsFromSchema,
  readWidgetKindForTarget,
  resolveActionTargetRef,
  resolvedWidgetRefForTarget,
  selectionPayloadFromSnapshot,
  selectionPayloadsFromSnapshot,
} from './executor-support/ActionExecutorModels.js'
import { ACTION_CALL_SCHEMA } from '../../schemas/actions.schema.js'
import {
  commitActionPatch,
  enrichActionOutputWithPropagation,
  finalizeActionCommit,
} from './StateCommitter.js'

export class ActionExecutor {
  constructor({ store, sync, hostBridge, getState, getAppState, subscribe, coordinationEngine, traceRecorder } = {}) {
    this.store = store || {
      listActions() {
        return []
      },
    }
    this.sync = typeof sync === 'function' ? sync : () => {}
    this.hostBridge = hostBridge || createWidgetVAHostBridge({ getState, getAppState, subscribe }) || createDefaultWidgetVAHostBridge()
    this.coordinationEngine = coordinationEngine || null
    this.traceRecorder = traceRecorder || null
    this.builtinDescriptors = new Map()
    this.handlers = new Map()
    this.preconditionHandlers = new Map()
    this.runtimeHandlerNames = new Set()
    this.isRegisteringRuntimeHandlers = false
    this.registerBuiltinPreconditions()
    this.isRegisteringRuntimeHandlers = true
    this.registerBuiltinHandlers()
    this.isRegisteringRuntimeHandlers = false
  }

  register(descriptor, handler, options = {}) {
    if (!descriptor?.name || typeof handler !== 'function') {
      throw new Error('ActionExecutor.register requires a descriptor.name and handler.')
    }
    if (this.handlers.has(descriptor.name)) {
      throw new Error(`Duplicate action handler registration: ${descriptor.name}`)
    }
    this.builtinDescriptors.set(descriptor.name, descriptor)
    this.handlers.set(descriptor.name, handler)
    if (this.isRegisteringRuntimeHandlers || options.runtimeHandler === true) {
      this.runtimeHandlerNames.add(descriptor.name)
    }
  }

  list() {
    const descriptors = this.store?.listActions?.() || []
    if (descriptors.length > 0) {
      const listedDescriptors = descriptors.filter((descriptor) => this.handlers.has(descriptor.name))
      const listedNames = new Set(listedDescriptors.map((descriptor) => descriptor?.name).filter(Boolean))
      const exposedBuiltinDescriptors = Array.from(this.builtinDescriptors.values())
        .filter((descriptor) => descriptor?.exposeInWorkspace === true && !listedNames.has(descriptor.name))
      return [...listedDescriptors, ...exposedBuiltinDescriptors]
    }
    return Array.from(this.builtinDescriptors.values())
  }

  has(name) {
    return this.handlers.has(name)
  }

  describeExecutor() {
    const actions = this.list().map((descriptor) => makeActionExecutorActionEntry({
      name: descriptor.name,
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
        linkPropagation: Boolean(this.coordinationEngine),
      }),
      actions,
    })
  }

  describeContext() {
    return makeActionHandlerContextSummary()
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
    const targetWidgetKind = readWidgetKindForTarget(store, targetRef)

    const candidateDescriptors = (store?.listActions?.() || [])
      .filter((descriptor) => descriptor?.name === actionName)

    return candidateDescriptors.find((descriptor) => {
      const descriptorTargetRef = descriptor?.targetRef || null
      if (!descriptorTargetRef) {
        return descriptorCanTargetWidget(descriptor, actionName, targetWidgetKind)
      }
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

  createRuntimeContext(call, descriptor, contextOverride = null) {
    const normalizedCall = buildHandlerInput(call)
    if (contextOverride?.__widgetvaActionRuntimeContext === true) {
      contextOverride.descriptor = descriptor
      contextOverride.call = normalizedCall
      return contextOverride
    }

    const store = contextOverride?.store || this.store
    const targetRef = resolveActionTargetRef(normalizedCall, descriptor)
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
    const ctx = createActionRuntimeContext({
      store,
      descriptor,
      call: normalizedCall,
      hostBridge: overrideHostBridge || this.hostBridge,
      getAppState: contextOverride?.getAppState,
      targetWidget: contextOverride?.targetWidget || null,
    })

    if (!ctx.resolvedTargetWidget && (targetRef || descriptor?.supportedWidgetKinds?.length > 0)) {
      ctx.resolvedTargetWidget = ctx.resolveTargetWidget({
        targetRef,
        kind: descriptor?.supportedWidgetKinds?.[0] || null,
      })
    }
    if (typeof contextOverride?.readCurrentState === 'function') {
      ctx.readCurrentState = contextOverride.readCurrentState.bind(contextOverride)
    }
    Object.defineProperty(ctx, '__widgetvaActionRuntimeContext', {
      value: true,
      enumerable: false,
      configurable: false,
    })
    return ctx
  }

  createContext(call, descriptor, contextOverride = null) {
    return createActionHandlerContext(this.createRuntimeContext(call, descriptor, contextOverride))
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
    try {
      validateAgainstSchema(buildActionCallSchemaInput(call), ACTION_CALL_SCHEMA, 'action')
    } catch (error) {
      const result = buildActionError({
        call,
        code: 'INVALID_PARAMS',
        message: error instanceof Error ? error.message : String(error),
        recoveryHints: ['Inspect the action call schema in describeWorkspace() before retrying.'],
      })
      traceRecorder?.recordActionFailure?.({
        call,
        code: result.error.code,
        message: result.error.message,
        recoveryHints: result.recoveryHints,
      })
      return result
    }
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
        code: result.error.code,
        message: result.error.message,
        recoveryHints: result.recoveryHints,
      })
      return result
    }

    const executableCall = buildExecutableCall(call)

    if (descriptor?.paramsSchema) {
      try {
        validateAgainstSchema(executableCall.params || {}, descriptor.paramsSchema, 'params')
      } catch (error) {
        const requiredParams = readRequiredParamsFromSchema(descriptor.paramsSchema)
        const result = buildActionError({
          call: executableCall,
          code: 'INVALID_PARAMS',
          message: error instanceof Error ? error.message : String(error),
          recoveryHints: buildInvalidParamsRecoveryHints({
            call,
            requiredParams,
            executableCall,
          }),
          details: {
            targetRef: targetRef || null,
            requiredParams,
          },
        })
        traceRecorder?.recordActionFailure?.({
          call: executableCall,
          code: result.error.code,
          message: result.error.message,
          recoveryHints: result.recoveryHints,
        })
        return result
      }
    }

    try {
      const runtimeCtx = this.createRuntimeContext(executableCall, descriptor, contextOverride)
      const handlerCtx = this.runtimeHandlerNames.has(executableCall.name)
        ? runtimeCtx
        : createActionHandlerContext(runtimeCtx)
      const runtimeCoordinationEngine = contextOverride?.coordinationEngine || this.coordinationEngine || null
      const previousState = runtimeCtx.readCurrentState()
      await this.checkPreconditions(executableCall, descriptor, runtimeCtx)
      const rawOutput = commitActionPatch(await handler(buildHandlerParams(executableCall), handlerCtx), runtimeCtx)
      const baseNextState = rawOutput?.nextState || runtimeCtx.readCurrentState()
      const output = enrichActionOutputWithPropagation({
        output: rawOutput,
        descriptor,
        call: executableCall,
        ctx: runtimeCtx,
        coordinationEngine: runtimeCoordinationEngine,
        previousState,
        nextState: baseNextState,
        collectUpdatedRefs: (state, extraRefs) => this.collectUpdatedRefs(state, extraRefs),
      })
      const nextState = output?.nextState || baseNextState
      return finalizeActionCommit({
        store: effectiveStore,
        traceRecorder,
        call: executableCall,
        descriptor,
        output,
        nextState,
        collectUpdatedRefs: (state, extraRefs) => this.collectUpdatedRefs(state, extraRefs),
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
        code: result.error.code,
        message: result.error.message,
      })
      return result
    }
  }

  collectUpdatedRefs(nextState, extraRefs = []) {
    const changedRefs = nextState?.delta?.changedRefs?.length
      ? nextState.delta.changedRefs
      : Object.keys(nextState?.widgets || {})
    return Array.from(new Set([...(changedRefs || []), ...(extraRefs || [])]))
  }

  syncWorkspace() {
    this.sync()
    return readWorkspaceStateFromStore(this.store)
  }

  readSnapshot(stateId) {
    return readSnapshotFromStore(this.store, stateId) || this.store.readSnapshot?.(stateId) || null
  }

  readSnapshotEntry(stateId) {
    return readSnapshotEntryFromStore(this.store, stateId)
  }

  hasUndoSelectionHistory() {
    const history = this.hostBridge.readSelectionHistory()
    const selectionsHistory = this.hostBridge.readSelectionsHistory()
    return (Array.isArray(history) && history.length > 0)
      || (Array.isArray(selectionsHistory) && selectionsHistory.length > 0)
      || hasUndoSelectionHistoryInStore(this.store)
  }

  hasRedoSelectionHistory() {
    const future = this.hostBridge.readSelectionFuture()
    const selectionsFuture = this.hostBridge.readSelectionsFuture()
    return (Array.isArray(future) && future.length > 0)
      || (Array.isArray(selectionsFuture) && selectionsFuture.length > 0)
      || hasRedoSelectionHistoryInStore(this.store)
  }

  undoSelection() {
    if (typeof this.store?.beginTransition !== 'function'
      || typeof this.hostBridge.undoSelection !== 'function') {
      return undoSelectionInStore(this.store)
    }
    this.store.beginTransition({ transitionType: 'undo' })
    this.hostBridge.undoSelection()
    return this.syncWorkspace()
  }

  redoSelection() {
    if (typeof this.store?.beginTransition !== 'function'
      || typeof this.hostBridge.redoSelection !== 'function') {
      return redoSelectionInStore(this.store)
    }
    this.store.beginTransition({ transitionType: 'redo' })
    this.hostBridge.redoSelection()
    return this.syncWorkspace()
  }

  resetWorkspace() {
    if (typeof this.store?.beginTransition !== 'function'
      || typeof this.hostBridge.resetCurrentSpec !== 'function'
      || typeof this.hostBridge.writeCurrentSelection !== 'function'
      || typeof this.hostBridge.resetSelectionHistory !== 'function'
      || typeof this.hostBridge.setFocusedWidgetRef !== 'function') {
      return resetWorkspaceInteractionsInStore(this.store)
    }
    this.store.beginTransition({ transitionType: 'reset' })
    this.store.resetWidgetPatches?.()
    this.hostBridge.resetCurrentSpec()
    this.hostBridge.writeCurrentSelection(null, { trackHistory: false })
    this.hostBridge.resetSelectionHistory()
    this.hostBridge.setFocusedWidgetRef(null)
    return this.syncWorkspace()
  }

  restoreSnapshotState(snapshot) {
    const snapshotState = snapshot?.state || snapshot
    const replayContext = snapshot?.replayContext || null
    const restoredSpec = primaryWidgetSpecFromSnapshot(snapshotState)
    if (typeof this.hostBridge.resetSelectionHistory !== 'function'
      || typeof this.hostBridge.writeCurrentSelections !== 'function'
      || typeof this.hostBridge.setFocusedWidgetRef !== 'function'
      || typeof this.hostBridge.writeCurrentSpec !== 'function') {
      return restoreSnapshotStateInStore(this.store, snapshot)
    }
    this.store.resetWidgetPatches?.()
    if (Object.prototype.hasOwnProperty.call(replayContext || {}, 'baselineSpec')) {
      this.hostBridge.writeCurrentSpec(replayContext?.baselineSpec ?? null, {
        replaceBaseline: true,
        trackHistory: false,
      })
    }
    this.hostBridge.writeWorkspaceSpec?.(replayContext?.workspaceSpec ?? null)
    this.hostBridge.writePlanningRequest?.(replayContext?.planningRequest ?? null)
    if (replayContext?.runMode) this.hostBridge.writeRunMode?.(replayContext.runMode)
    this.hostBridge.writeUserIntent?.(replayContext?.userIntent ?? '')
    if (restoredSpec) {
      this.hostBridge.writeCurrentSpec(restoredSpec, { trackHistory: false })
    } else if (Object.prototype.hasOwnProperty.call(replayContext || {}, 'currentSpec')) {
      this.hostBridge.writeCurrentSpec(replayContext?.currentSpec ?? null, { trackHistory: false })
    }
    const selection = selectionPayloadFromSnapshot(snapshotState)
    const selections = selectionPayloadsFromSnapshot(snapshotState)
    this.hostBridge.resetSelectionHistory()
    this.hostBridge.writeCurrentSelections(selections, { fallbackSelection: selection, trackHistory: false })
    this.hostBridge.setFocusedWidgetRef(snapshotState?.shared?.focusedWidget || null)
    return this.syncWorkspace()
  }

  registerBuiltinPreconditions() {
    this.registerPrecondition('widget.undoSelection', (call, ctx) => {
      if (!this.hasUndoSelectionHistory()) {
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
      if (!this.hasRedoSelectionHistory()) {
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
      const snapshot = targetStateId ? this.readSnapshot(targetStateId) : null
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
      const snapshot = targetStateId ? this.readSnapshot(targetStateId) : null
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

    this.registerPrecondition('workspace.focusWidget', (call, ctx) => {
      return this.readTargetWidgetPrecondition({
        call,
        ctx,
        message: 'workspace.focusWidget requires a valid target widget.',
      })
    })

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
      {
        name: 'coordination.applyLink',
        category: 'coordination',
        exposeInWorkspace: true,
        affectedStatePaths: ['shared.links', 'shared.selections', 'widgets'],
        paramsSchema: {
          type: 'object',
          properties: {
            linkId: { type: 'string' },
            linkRef: { type: 'string' },
            sourceSelectionRef: { type: 'string' },
            sourceRef: { type: 'string' },
          },
        },
        examples: [{
          label: 'Apply an existing coordination link',
          spec: {
            linkId: 'scatter_filters_bar',
            sourceSelectionRef: 'wl://widgetva-app/workspace/main/widget/scatter/selection/brush',
          },
        }],
      },
      async (params, ctx) => {
        const linkRef = params.linkRef || params.linkId || params.ref || null
        if (!linkRef) {
          throwActionPrecondition('coordination.applyLink requires linkId or linkRef.', {
            requiredParams: ['linkId'],
          }, [
            'Call describeWorkspace() or coordination.describeLinks to inspect available links.',
          ])
        }
        const coordinationEngine = this.coordinationEngine
        if (typeof coordinationEngine?.applyLink !== 'function') {
          throwActionPrecondition('No link engine is available for coordination.applyLink.', {
            coordinationEngine: false,
          }, [
            'Use this action in a multi-widget runtime that provides CoordinationEngine.',
          ])
        }

        const sourceRef = params.sourceSelectionRef || params.sourceRef || null
        const currentState = ctx.readCurrentState()
        const coordinationResult = coordinationEngine.applyLink({
          linkRef,
          sourceRef,
          state: currentState,
        })

        if (coordinationResult?.ok !== true) {
          throwActionPrecondition(
            `coordination.applyLink could not apply link ${linkRef}.`,
            {
              linkRef,
              sourceRef,
              reason: coordinationResult?.reason || null,
              skippedTargets: coordinationResult?.skippedTargets || [],
            },
            [
              'Confirm the link exists and has an active source selection.',
              'If no source selection exists, create one first or pass sourceSelectionRef.',
            ],
          )
        }

        return {
          patch: coordinationResult.patch,
          nextState: coordinationResult.nextState || ctx.readCurrentState(),
          updatedRefs: Array.isArray(coordinationResult.affectedRefs)
            ? coordinationResult.affectedRefs
            : [],
          result: {
            coordination: coordinationResult,
          },
          verificationHints: [
            'Inspect the affected target widgets and confirm the visible view changed according to the link summary.',
            'Read trace and coordination state to confirm this was an agent-invoked coordination link.',
          ],
          notes: {
            userVisibleSummary: `Applied coordination link ${linkRef}.`,
          },
        }
      },
    )

    this.register(
      { name: 'widget.undoSelection' },
      async (params, ctx) => ({
        nextState: this.undoSelection(),
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
      async (params, ctx) => ({
        nextState: this.redoSelection(),
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
      async (params, ctx) => ({
        nextState: this.resetWorkspace(),
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
      async (params, ctx) => {
        const targetStateId = params.stateId
        const snapshot = targetStateId ? this.readSnapshotEntry(targetStateId) : null
        if (typeof this.store?.beginTransition === 'function') {
          this.store.beginTransition({
            transitionType: 'jump_back',
            parentStateId: targetStateId,
          })
        }
        return {
          nextState: this.restoreSnapshotState(snapshot),
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
      async (params, ctx) => {
        const targetStateId = params.stateId
        const snapshot = targetStateId ? this.readSnapshotEntry(targetStateId) : null
        const branch = beginBranchFromStateInStore(this.store, {
          stateId: targetStateId,
          label: params.branchLabel,
        })
        return {
          nextState: this.restoreSnapshotState(snapshot),
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
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const currentState = ctx.readCurrentState()
        const previousFocusedWidgetRef = currentState?.shared?.focusedWidget || null
        const nextShared = withFocusSubmodel(currentState?.shared || {}, {
          widgetRef: targetWidget.ref,
          widgetId: targetWidget.widgetId || null,
          source: 'workspace',
        }, currentState?.widgets || {})
        return {
          patch: {
            shared: {
              ...nextShared,
              focusedWidget: targetWidget.ref,
            },
          },
          affectedRefs: mergeUniqueRefs([previousFocusedWidgetRef], [targetWidget.ref, 'shared']),
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

  }
}
