import { buildSingleWidgetWorkspace } from '../../adapters/vegaSpecAdapter.js'
import { registerWidgetAdapters, registerWidgetFamilyAdapters } from '../../adapters/widgetFamilies/index.js'
import { createDataQueryEngine } from '../data/index.js'
import { makeWorkspacePlanningRequest } from '../protocol/planning.js'
import { ActionExecutor } from './ActionExecutor.js'
import { AgentLoopRuntime } from './AgentLoopRuntime.js'
import { DataQueryExecutor } from './DataQueryExecutor.js'
import {
  createDefaultWidgetVAHostBridge,
  createWidgetVAHostBridge,
} from './hostBridge.js'
import { installWidgetVAPagePort } from './installPagePort.js'
import { InteractionTraceRecorder } from './InteractionTraceRecorder.js'
import { LinkEngine } from './LinkEngine.js'
import { WidgetVARuntimeStore } from './RuntimeStore.js'
import { PerceptionQueryRegistry } from './PerceptionQueryRegistry.js'
import { planWorkspace as runWorkspacePlanner } from './planning/WorkspacePlanner.js'
import { ResponseRecorder } from './ResponseRecorder.js'
import { normalizeViewportState } from '../../workspace/state/viewportStateModel.js'
import {
  buildCoordinationStateFromWorkspaceState,
  buildPropagationSummary,
  buildRuntimeObservation,
  listAvailableActionsFromDescription,
  listAvailablePerceptionsFromDescription,
} from './agentFacingSurface.js'
import {
  readInteractionTraceFromStore,
  readWorkspaceDescriptionFromStore,
  readWorkspaceStateFromStore,
} from './workspaceStoreReaders.js'

export function createRuntimeStore(options = {}) {
  return new WidgetVARuntimeStore(options)
}

export function planWorkspace(options = {}) {
  return runWorkspacePlanner(options)
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

function resolveRuntimeWidgetAdapters(options = {}) {
  if (Array.isArray(options.widgetAdapters)) {
    return options.widgetAdapters.filter(Boolean)
  }
  if (options.widgetAdapter) {
    return [options.widgetAdapter]
  }
  return []
}

export function createWidgetVARuntime(options = {}) {
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
  const traceRecorder = new InteractionTraceRecorder({ store })
  const responseRecorder = new ResponseRecorder({ store })
  const dataQueryEngine = options.dataQueryEngine || createDataQueryEngine({ kind: 'js_array' })
  const dataQueryExecutor = new DataQueryExecutor({
    store,
    dataQueryEngine,
    traceRecorder,
    hostBridge,
  })
  const linkEngine = new LinkEngine({ store })
  const planWorkspaceWithHostState = (nextOptions = {}) => {
    const request = makeWorkspacePlanningRequest({
      runMode: nextOptions.runMode || hostBridge.readRunMode(),
      userIntent: nextOptions.userIntent || hostBridge.readUserIntent() || null,
      complexityBudget: nextOptions.complexityBudget || 'standard',
      preferredTopology: nextOptions.preferredTopology || null,
      task: nextOptions.task || null,
    })
    const spec = nextOptions.spec || hostBridge.readCurrentSpec()
    return runWorkspacePlanner({
      sessionId: hostBridge.readSessionId() || 'main',
      spec,
      ...request,
    })
  }
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
    const workspace = buildSingleWidgetWorkspace({
      appId: 'widgetva-app',
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
      annotations: hostBridge.readWorkspaceAnnotations(),
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
    linkEngine,
    traceRecorder,
  })
  const executeAction = actionExecutor.run.bind(actionExecutor)
  const runDataQuery = dataQueryExecutor.run.bind(dataQueryExecutor)

  const perceptionQueryRegistry = new PerceptionQueryRegistry({
    store,
    dataQueryEngine,
    dataQueryExecutor,
    traceRecorder,
    linkEngine,
    hostBridge,
  })
  const queryPerception = perceptionQueryRegistry.query.bind(perceptionQueryRegistry)
  const describeWorkspace = () => readWorkspaceDescriptionFromStore(store, {
    actionExecutor,
    perceptionQueryRegistry,
  })
  const readView = (options = {}) => readWorkspaceStateFromStore(store, options)
  const readState = (options = {}) => readWorkspaceStateFromStore(store, options)
  const readCoordinationState = () => buildCoordinationStateFromWorkspaceState(readState(), {
    currentBranchId: store.currentBranchId,
    derivedTopology: describeWorkspace()?.runtimeTopology || {},
  })
  const listAvailableActions = () => listAvailableActionsFromDescription(describeWorkspace())
  const listAvailablePerceptions = () => listAvailablePerceptionsFromDescription(describeWorkspace())
  const readPropagationSummary = (options = {}) => buildPropagationSummary({
    state: readState(),
    description: describeWorkspace(),
    linkEngine,
    sourceRef: options?.sourceRef || null,
  })
  const readObservation = (options = {}) => buildRuntimeObservation({
    description: describeWorkspace(),
    state: readState(options.readStateOptions || options),
    coordinationState: readCoordinationState(),
    availableActions: listAvailableActions(),
    availablePerceptions: listAvailablePerceptions(),
    propagationSummary: readPropagationSummary(options.propagationOptions || {}),
    latestCoordinationResult: readLatestCoordinationResult(),
  })
  const readLatestCoordinationResult = () => (
    typeof options.readLatestCoordinationResult === 'function'
      ? options.readLatestCoordinationResult()
      : null
  )
  const readTrace = (options = {}) => readInteractionTraceFromStore(store, options)

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

  const widgetAdapters = resolveRuntimeWidgetAdapters(options)
  const shouldRegisterDefaultWidgetFamilies = options.registerDefaultWidgetFamilies
    ?? false
  if (shouldRegisterDefaultWidgetFamilies) {
    registerWidgetFamilyAdapters({
      actionExecutor,
      perceptionQueryRegistry,
    })
  }
  if (widgetAdapters.length > 0) {
    registerWidgetAdapters(widgetAdapters, {
      actionExecutor,
      perceptionQueryRegistry,
    })
  }

  const agentLoopRuntime = new AgentLoopRuntime({
    store,
    planWorkspace: planWorkspaceWithHostState,
    executeAction,
    queryPerception,
    queryData: (call) => dataQueryExecutor.run(call),
    readLatestCoordinationResult,
    responseRecorder,
    actionExecutor,
    linkEngine,
  })
  const executeVerifiedAction = agentLoopRuntime.executeVerifiedAction.bind(agentLoopRuntime)

  const uninstallPagePort = installWidgetVAPagePort({
    store,
    planWorkspace: planWorkspaceWithHostState,
    executeAction,
    readLatestCoordinationResult,
    queryPerception,
    queryData: (call) => dataQueryExecutor.run(call),
    actionExecutor,
    perceptionQueryRegistry,
    dataQueryExecutor,
    linkEngine,
    traceRecorder,
    responseRecorder,
    agentLoopRuntime,
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

  return {
    store,
    actionExecutor,
    linkEngine,
    dataQueryExecutor,
    perceptionQueryRegistry,
    agentLoopRuntime,
    responseRecorder,
    planWorkspace: planWorkspaceWithHostState,
    applyHumanSelection,
    describeWorkspace,
    readObservation,
    readCoordinationState,
    readPropagationSummary,
    readLatestCoordinationResult,
    listAvailableActions,
    listAvailablePerceptions,
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
      unsubscribe?.()
      uninstallPagePort?.()
    },
  }
}
