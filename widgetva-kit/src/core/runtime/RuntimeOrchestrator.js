import { cloneJsonValue as clone } from '../../shared/clone.js'
import { createDataQueryEngine } from '../data/index.js'
import { materializeWorkspace } from './materializers/workspace/WorkspaceMaterializer.js'
import { ActionExecutor } from './ActionExecutor.js'
import { DataQueryExecutor } from './DataQueryExecutor.js'
import {
  createDefaultWidgetVAHostBridge,
  createWidgetVAHostBridge,
} from '../../host/hostBridge.js'
import { installWidgetVAPagePort } from './pagePort/installPagePort.js'
import { TraceRecorder } from './TraceRecorder.js'
import { CoordinationEngine } from '../../workspace/coordination/CoordinationEngine.js'
import { WidgetVARuntimeStore } from './RuntimeStore.js'
import { PerceptionExecutor } from './PerceptionExecutor.js'
import { normalizeViewportState } from '../../workspace/state/viewportStateModel.js'
import {
  buildTraceGraphFromStore,
  listBranchesFromStore,
  listStateSnapshotsFromStore,
  readInteractionTraceFromStore,
  readSnapshotFromStore,
  readWorkspaceDescriptionFromStore,
  readWorkspaceStateFromStore,
} from '../../workspace/store/workspaceStoreReaders.js'
import {
  registerDefaultWidgetFamiliesRuntime,
  registerRuntimeWidgetFamily,
} from '../../widgets/families/index.js'
import { registerGenericWidgetRuntimeActions } from '../../widgets/families/generic/runtimeActions.js'
import { buildWidgetRenderPayload } from './materializers/providers/providerRenderPayload.js'

export function createRuntimeStore(options = {}) {
  return new WidgetVARuntimeStore(options)
}

export function createWidgetVARuntime(options = {}) {
  return createRuntimeOrchestrator(options)
}

async function defaultReadRecoverableState(controller = null) {
  if (!controller || typeof controller !== 'object') {
    return null
  }

  if (typeof controller.readRecoverableState === 'function') {
    return controller.readRecoverableState()
  }

  if (typeof controller.readState === 'function') {
    return controller.readState()
  }

  if (typeof controller?.pagePort?.readState === 'function') {
    return controller.pagePort.readState()
  }

  if (typeof controller?.runtime?.readState === 'function') {
    return controller.runtime.readState()
  }

  return null
}

async function defaultRestoreRecoverableState() {
  return {
    restored: false,
    reason: 'no-restore-handler',
  }
}

function defaultResolveRuntime(controller = null, binding = null) {
  if (controller?.runtime) {
    return controller.runtime
  }

  if (controller?.widget?.runtime) {
    return controller.widget.runtime
  }

  if (binding?.runtime) {
    return binding.runtime
  }

  if (controller?.pagePort?.runtime) {
    return controller.pagePort.runtime
  }

  return null
}

function createRuntimeControllerManager({
  readRecoverableState = defaultReadRecoverableState,
  resolveRuntime = defaultResolveRuntime,
  restoreRecoverableState = defaultRestoreRecoverableState,
} = {}) {
  let activeRuntime = null
  let activeController = null
  let activeBinding = null
  let attachmentMetadata = null
  let recoverableState = null
  let replacementCount = 0

  async function captureRecoverableState(controller = activeController) {
    const nextState = await readRecoverableState(controller)
    if (nextState != null) {
      recoverableState = clone(nextState)
    }
    return clone(recoverableState)
  }

  async function attachController(controller, {
    runtime = null,
    binding = null,
    metadata = null,
  } = {}) {
    activeController = controller || null
    activeBinding = binding || controller?.pagePort || null
    activeRuntime = runtime || resolveRuntime(activeController, activeBinding) || null
    attachmentMetadata = metadata ? clone(metadata) : null
    return activeController
  }

  function seedRecoverableState(state) {
    recoverableState = clone(state)
    return clone(recoverableState)
  }

  async function replaceController(nextController, {
    runtime = null,
    binding = null,
    metadata = null,
    capturePreviousState = true,
    captureNextState = false,
    restorePreviousState = false,
    disposePrevious = true,
  } = {}) {
    const previousRuntime = activeRuntime
    const previousController = activeController
    const previousBinding = activeBinding
    const previousMetadata = attachmentMetadata ? clone(attachmentMetadata) : null
    if (capturePreviousState && previousController) {
      await captureRecoverableState(previousController)
    }

    activeController = nextController || null
    activeBinding = binding || nextController?.pagePort || null
    activeRuntime = runtime || resolveRuntime(activeController, activeBinding) || null
    attachmentMetadata = metadata ? clone(metadata) : null
    replacementCount += 1

    if (captureNextState && activeController) {
      await captureRecoverableState(activeController)
    }

    let restoreResult = {
      restored: false,
      reason: restorePreviousState ? 'missing-controller-or-state' : 'not-requested',
    }
    if (restorePreviousState && activeController && recoverableState != null) {
      restoreResult = await restoreRecoverableState(activeController, clone(recoverableState))
    }

    if (disposePrevious && previousController && typeof previousController.dispose === 'function') {
      previousController.dispose()
    }

    return {
      previousRuntime,
      previousController,
      previousBinding,
      previousMetadata,
      activeRuntime,
      activeController,
      activeBinding,
      attachmentMetadata: clone(attachmentMetadata),
      recoverableState: clone(recoverableState),
      restoreResult,
      replacementCount,
    }
  }

  async function clearController({
    capturePreviousState = true,
    disposePrevious = true,
    preserveRecoverableState = true,
  } = {}) {
    const result = await replaceController(null, {
      capturePreviousState,
      captureNextState: false,
      disposePrevious,
    })

    if (!preserveRecoverableState) {
      recoverableState = null
    }
    activeBinding = null
    attachmentMetadata = null

    return result
  }

  function canContinueRequest({
    requirePagePort = false,
  } = {}) {
    if (!activeController) {
      return false
    }

    if (!requirePagePort) {
      return true
    }

    return Boolean(activeBinding || activeController?.pagePort)
  }

  async function runWithActiveController(handler) {
    if (typeof handler !== 'function') {
      throw new Error('RuntimeOrchestrator controller manager requires a handler function.')
    }
    if (!activeController) {
      throw new Error('RuntimeOrchestrator does not have an active controller.')
    }
    return handler(activeController)
  }

  function describeRuntimeManager() {
    return {
      hasActiveRuntime: Boolean(activeRuntime),
      hasActiveController: Boolean(activeController),
      hasActiveBinding: Boolean(activeBinding),
      recoverableStateId: recoverableState?.stateId || null,
      replacementCount,
    }
  }

  return {
    attachController,
    replaceController,
    clearController,
    captureRecoverableState,
    runWithActiveController,
    readActiveRuntime() {
      return activeRuntime
    },
    readActiveController() {
      return activeController
    },
    readActiveBinding() {
      return activeBinding
    },
    readAttachmentMetadata() {
      return clone(attachmentMetadata)
    },
    readRecoverableState() {
      return clone(recoverableState)
    },
    seedRecoverableState,
    describeRuntimeManager,
    canContinueRequest,
  }
}

function normalizeReplayOptions(input) {
  if (typeof input === 'string') {
    return { stateId: input }
  }
  if (input && typeof input === 'object') {
    return { ...input }
  }
  return {}
}

function createResponseRecorderSurface(traceRecorder) {
  return {
    recordResponse: traceRecorder.recordResponse.bind(traceRecorder),
    readLatestResponse: traceRecorder.readLatestResponse.bind(traceRecorder),
    listResponses: traceRecorder.listResponses.bind(traceRecorder),
    describeRecorder: traceRecorder.describeResponseRecorder.bind(traceRecorder),
  }
}

function makeVerifiedRuntimeActionResult(result = {}) {
  return {
    ok: false,
    beforeStateId: null,
    actionResult: null,
    afterView: null,
    verification: null,
    verificationHints: [],
    traceEvidence: null,
    finalSnapshot: null,
    linkPropagation: [],
    latestCoordinationResult: null,
    ...clone(result),
  }
}

export function createRuntimeOrchestrator(options = {}) {
  const defaultHostBridge = createDefaultWidgetVAHostBridge()
  const providedHostBridge = options.hostBridge || null
  const derivedHostBridge = providedHostBridge
    ? null
    : createWidgetVAHostBridge({
      getState: options.getState,
      getAppState: options.getAppState,
      subscribe: options.subscribe,
      subscribeAppState: options.subscribeAppState,
    })
  const hostBridge = providedHostBridge
    ? { ...defaultHostBridge, ...providedHostBridge }
    : derivedHostBridge || defaultHostBridge

  const store = createRuntimeStore()
  const runtimeManager = createRuntimeControllerManager()
  const traceRecorder = new TraceRecorder({ store })
  const responseRecorder = createResponseRecorderSurface(traceRecorder)
  const dataQueryEngine = options.dataQueryEngine || createDataQueryEngine({ kind: 'js_array' })
  const dataQueryExecutor = new DataQueryExecutor({
    store,
    dataQueryEngine,
    traceRecorder,
    hostBridge,
  })
  const coordinationEngine = new CoordinationEngine({ store })
  const buildReplayContext = () => ({
    baselineSpec: hostBridge.readBaselineSpec() ?? null,
    currentSpec: hostBridge.readCurrentSpec() ?? null,
    workspaceSpec: hostBridge.readWorkspaceSpec() ?? null,
    planningRequest: hostBridge.readPlanningRequest() ?? null,
    runMode: hostBridge.readRunMode() || 'goal_oriented',
    userIntent: hostBridge.readUserIntent() || '',
  })
  const sync = () => {
    const replayContext = buildReplayContext()
    const workspace = materializeWorkspace({
      appId: options.appId || 'widgetva-app',
      workspaceId: hostBridge.readSessionId() || 'main',
      sessionId: hostBridge.readSessionId(),
      spec: hostBridge.readCurrentSpec(),
      workspaceSpec: hostBridge.readWorkspaceSpec(),
      planningRequest: {
        ...(hostBridge.readPlanningRequest() || {}),
        runMode: hostBridge.readRunMode(),
        userIntent: hostBridge.readUserIntent() || null,
      },
      selection: hostBridge.readCurrentSelection(),
      selections: hostBridge.readCurrentSelections(),
      focusedWidgetRef: hostBridge.readFocusedWidgetRef(),
      focusState: hostBridge.readFocusState(),
      highlightState: hostBridge.readHighlightState(),
      viewportState: normalizeViewportState(hostBridge.readViewportState()),
      previousState: store.readState(),
      currentBranchId: store.currentBranchId,
      stateManager: store.stateManager,
      replayContext,
    })
    store.replaceWorkspace(workspace)
  }

  sync()
  const unsubscribe = hostBridge.subscribe(sync)
  const actionExecutor = new ActionExecutor({
    store,
    sync,
    hostBridge,
    coordinationEngine,
    traceRecorder,
  })
  registerGenericWidgetRuntimeActions(actionExecutor)
  const executeActionRaw = actionExecutor.run.bind(actionExecutor)
  const runDataQuery = dataQueryExecutor.run.bind(dataQueryExecutor)

  const perceptionExecutor = new PerceptionExecutor({
    store,
    dataQueryEngine,
    dataQueryExecutor,
    traceRecorder,
    coordinationEngine,
    hostBridge,
  })
  const queryPerception = perceptionExecutor.query.bind(perceptionExecutor)
  const describeWorkspace = () => readWorkspaceDescriptionFromStore(store, {
    actionExecutor,
    perceptionExecutor,
  })
  const readView = (options = {}) => readWorkspaceStateFromStore(store, options)
  const readState = (options = {}) => readWorkspaceStateFromStore(store, options)
  const readWidgetRenderPayload = (widgetIdOrRef = null) => {
    const widgetDescription = store.listWidgetDescriptions()
      .find((widget) => widget?.widgetId === widgetIdOrRef || widget?.ref === widgetIdOrRef) || null
    const widgetRef = widgetDescription?.ref || widgetIdOrRef || null
    const widgetState = widgetRef ? store.getWidgetState?.(widgetRef) || null : null
    return buildWidgetRenderPayload({
      widgetDescription,
      widgetState,
      runtime,
    })
  }
  const readLatestCoordinationResult = () => (
    typeof options.readLatestCoordinationResult === 'function'
      ? options.readLatestCoordinationResult()
      : null
  )
  const readTrace = (options = {}) => readInteractionTraceFromStore(store, options)
  const captureCurrentRecoverableState = () => {
    runtimeManager.seedRecoverableState(readState())
  }
  const executeAction = async (call) => {
    const result = await executeActionRaw(call)
    captureCurrentRecoverableState()
    return result
  }

  const jumpToState = async (options = {}) => executeAction({
    callId: options.callId || `jump_${Date.now()}`,
    name: 'workspace.jumpToState',
    actor: options.actor || 'agent',
    params: {
      stateId: options.stateId || null,
    },
  })

  const branchFromState = async (options = {}) => executeAction({
    callId: options.callId || `branch_${Date.now()}`,
    name: 'workspace.branchFromState',
    actor: options.actor || 'agent',
    params: {
      stateId: options.stateId || null,
      branchLabel: options.branchLabel || null,
    },
  })

  const replay = async (stateIdOrOptions) => jumpToState(normalizeReplayOptions(stateIdOrOptions))

  const shouldRegisterDefaultWidgetFamilies = options.registerDefaultWidgetFamilies
    ?? false
  if (shouldRegisterDefaultWidgetFamilies) {
    registerDefaultWidgetFamiliesRuntime({
      actionExecutor,
      perceptionExecutor,
    })
  }

  const registerWidgetFamily = (family) => registerRuntimeWidgetFamily(family, {
    actionExecutor,
    perceptionExecutor,
    store,
  })

  for (const family of Array.isArray(options.widgetFamilies) ? options.widgetFamilies : []) {
    registerWidgetFamily(family)
  }

  const executeVerifiedAction = async (call, verifyOptions = {}) => {
    const beforeStateId = readState()?.stateId || null
    const actionResult = await executeAction(call)
    captureCurrentRecoverableState()
    const latestCoordinationResult = readLatestCoordinationResult()

    if (!actionResult?.ok) {
      return makeVerifiedRuntimeActionResult({
        ok: false,
        beforeStateId,
        actionResult,
        latestCoordinationResult,
      })
    }

    const afterView = readState({
      refs: actionResult.updatedRefs,
      deltaSince: verifyOptions?.includeDeltaSince ? beforeStateId : undefined,
    })
    const verification = verifyOptions?.verify === false
      ? null
      : await queryPerception({
          callId: `${call?.callId || 'call'}_verify`,
          name: 'perception.verifyActionEffect',
          actor: call?.actor || 'agent',
          ...(call?.target?.widgetRef ? { target: { widgetRef: call.target.widgetRef } } : {}),
          params: {
            actionName: call?.name,
            actionParams: call?.params || {},
            stateId: actionResult.stateId,
            refs: actionResult.updatedRefs,
          },
        })
    const finalSnapshot = actionResult.stateId
      ? readSnapshotFromStore(store, actionResult.stateId, {
          refs: verifyOptions?.includeFinalSnapshotRefs === false ? undefined : actionResult.updatedRefs,
          includeMeta: true,
        })
      : null
    const verificationOk = verification?.ok !== false && (verification?.result?.verified ?? true)
    return makeVerifiedRuntimeActionResult({
      ok: Boolean(actionResult?.ok) && verificationOk,
      beforeStateId,
      actionResult,
      afterView,
      verification,
      verificationHints: Array.isArray(actionResult?.verificationHints) ? actionResult.verificationHints : [],
      finalSnapshot,
      latestCoordinationResult,
    })
  }

  const uninstallPagePort = installWidgetVAPagePort({
    api: {
      describeWorkspace,
      readState,
      readView,
      readSnapshot: (snapshotOptions = {}) => readSnapshotFromStore(store, snapshotOptions.stateId, snapshotOptions),
      listStateHistory: (historyOptions = {}) => listStateSnapshotsFromStore(store, historyOptions),
      listBranches: () => listBranchesFromStore(store),
      readTrace,
      getInteractionTrace: readTrace,
      getTraceGraph: (graphOptions = {}) => buildTraceGraphFromStore(store, graphOptions),
      getLatestAgentResponse: (responseOptions = {}) => responseRecorder.readLatestResponse(responseOptions),
      listAgentResponses: (responseOptions = {}) => responseRecorder.listResponses(responseOptions.limit, responseOptions),
      evaluateLinkPropagation: (propagationOptions = {}) => coordinationEngine.evaluatePropagation({
        sourceRef: propagationOptions.sourceRef || null,
        state: propagationOptions.state || readState(),
      }),
      recordAgentResponse: (record = {}) => responseRecorder.recordResponse(record),
    },
    executeAction,
    executeVerifiedAction,
    jumpToState,
    branchFromState,
    replay,
    queryPerception,
    queryData: (call) => dataQueryExecutor.run(call),
  })

  function inferHumanActionName(selection) {
    if (!selection) return 'widget.clearSelection'
    const sourceWidgetId = selection?.source_widget_id
    const sourceWidget = store.listWidgetDescriptions().find((widget) => widget.widgetId === sourceWidgetId)
    const declaredAction = sourceWidget?.humanInteraction?.actionName
    if (declaredAction) return declaredAction
    return 'widget.updateSelection'
  }

  async function applyHumanSelection(selection) {
    const actionName = inferHumanActionName(selection)
    const sourceWidget = selection?.source_widget_id
      ? store.listWidgetDescriptions().find((widget) => widget.widgetId === selection.source_widget_id) || null
      : null
    const result = await executeAction({
      callId: `human_${Date.now()}`,
      name: actionName,
      actor: 'human',
      targetRef: sourceWidget?.ref || undefined,
      params: selection || {},
    })
    return {
      updatedRefs: result?.updatedRefs || [],
      stateId: result?.stateId || null,
    }
  }

  const runtime = {
    store,
    actionExecutor,
    coordinationEngine,
    dataQueryExecutor,
    perceptionExecutor,
    responseRecorder,
    runtimeManager,
    registerWidgetFamily,
    describeRuntimeManager: runtimeManager.describeRuntimeManager,
    readRecoverableState: runtimeManager.readRecoverableState,
    applyHumanSelection,
    describeWorkspace,
    readWidgetRenderPayload,
    readView,
    readState,
    readTrace,
    executeAction,
    executeVerifiedAction,
    queryPerception,
    queryData: runDataQuery,
    runDataQuery,
    getTrace: readTrace,
    jumpToState,
    branchFromState,
    replay,
    dispose() {
      captureCurrentRecoverableState()
      void runtimeManager.clearController({
        capturePreviousState: false,
        disposePrevious: false,
      })
      unsubscribe?.()
      uninstallPagePort?.()
    },
  }

  const runtimeController = {
    readRecoverableState: () => readState(),
    readState,
    pagePort: globalThis.window?.__widgetVA || null,
    runtime,
  }
  runtimeManager.attachController(runtimeController, { runtime })
  captureCurrentRecoverableState()

  return runtime
}
