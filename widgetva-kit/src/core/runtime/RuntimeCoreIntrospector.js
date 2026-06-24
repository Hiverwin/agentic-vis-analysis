import {
  makeRuntimeCoreCapabilities,
  makeRuntimeCoreComponents,
  makeRuntimeCoreRegistries,
  makeRuntimeCoreSummary,
} from '../protocol/runtimeCore.js'
import { hasStateManagerSurface } from './StateManager.js'
import { listBranchesFromStore } from './workspaceStoreReaders.js'

export function describeRuntimeCore({
  store,
  planWorkspace,
  actionExecutor,
  perceptionQueryRegistry,
  dataQueryExecutor,
  linkEngine,
  traceRecorder,
  responseRecorder,
  agentLoopRuntime,
} = {}) {
  const countPerceptionHandlers = () => {
    const entries = perceptionQueryRegistry?.handlerEntries
    if (!(entries instanceof Map)) return 0
    let count = 0
    for (const handlerEntries of entries.values()) {
      count += Array.isArray(handlerEntries) ? handlerEntries.length : 0
    }
    return count
  }

  const describeDataQueryExecutor = () =>
    typeof dataQueryExecutor?.describeExecutor === 'function'
      ? dataQueryExecutor.describeExecutor()
      : null

  const describeActionExecutor = () =>
    typeof actionExecutor?.describeExecutor === 'function'
      ? actionExecutor.describeExecutor()
      : null

  const describePerceptionRegistry = () =>
    typeof perceptionQueryRegistry?.describeRegistry === 'function'
      ? perceptionQueryRegistry.describeRegistry()
      : null

  const describeWidgetRegistry = () => {
    if (typeof store?.widgetRegistry?.describe === 'function') {
      return store.widgetRegistry.describe()
    }
    if (typeof store?.describeWidgetRegistry === 'function') {
      return store.describeWidgetRegistry()
    }
    return null
  }

  const supportsStatePatching =
    typeof store?.buildStatePatch === 'function'
    || typeof store?.stateManager?.buildStatePatch === 'function'
    || typeof store?.readState === 'function'
    || Boolean(store?.widgets && typeof store.widgets === 'object')

  const supportsStateDelta =
    Boolean(store?.readState?.({ deltaSince: store?.previousState?.stateId || undefined })?.delta || store?.state?.delta)
    || typeof store?.stateManager?.createDelta === 'function'
    || Array.isArray(store?.stateSnapshots)

  const hasActionHandler = (actionName) => {
    if (!actionName) return false
    if (actionExecutor?.handlers instanceof Map) {
      return actionExecutor.handlers.has(actionName)
    }
    if (typeof actionExecutor?.has === 'function') {
      return actionExecutor.has(actionName)
    }
    return false
  }

  const actionExecutorSummary = describeActionExecutor()
  const perceptionRegistrySummary = describePerceptionRegistry()
  const widgetRegistrySummary = describeWidgetRegistry()
  const dataQueryExecutorSummary = describeDataQueryExecutor()

  return makeRuntimeCoreSummary({
    components: makeRuntimeCoreComponents({
      workspacePlanner: typeof planWorkspace === 'function',
      widgetRegistry: Boolean(store?.widgetRegistry),
      actionExecutor: Boolean(actionExecutor),
      actionContext: typeof actionExecutor?.describeContext === 'function',
      agentLoopRuntime: Boolean(agentLoopRuntime),
      perceptionQueryRegistry: Boolean(perceptionQueryRegistry),
      perceptionContext: typeof perceptionQueryRegistry?.describeContext === 'function',
      dataQueryExecutor: Boolean(dataQueryExecutor),
      dataQueryContext: typeof dataQueryExecutor?.describeContext === 'function',
      dataQueryEngine: Boolean(dataQueryExecutor?.dataQueryEngine),
      linkEngine: Boolean(linkEngine),
      stateManager: hasStateManagerSurface(store),
      interactionTraceRecorder: Boolean(traceRecorder),
      responseRecorder: Boolean(responseRecorder),
    }),
    registries: makeRuntimeCoreRegistries({
      widgetCount:
        Number.isFinite(widgetRegistrySummary?.counts?.widgetCount)
          ? widgetRegistrySummary.counts.widgetCount
          : 0,
      dataHandleCount:
        Number.isFinite(widgetRegistrySummary?.counts?.dataHandleCount)
          ? widgetRegistrySummary.counts.dataHandleCount
          : 0,
      linkCount:
        Number.isFinite(widgetRegistrySummary?.counts?.linkCount)
          ? widgetRegistrySummary.counts.linkCount
          : 0,
      adapterCount:
        Number.isFinite(widgetRegistrySummary?.counts?.adapterCount)
          ? widgetRegistrySummary.counts.adapterCount
          : 0,
      snapshotCount: Array.isArray(store?.stateSnapshots) ? store.stateSnapshots.length : 0,
      branchCount: listBranchesFromStore(store).length,
      actionDescriptorCount:
        Number.isFinite(actionExecutorSummary?.counts?.descriptorCount)
          ? actionExecutorSummary.counts.descriptorCount
          : 0,
      actionHandlerCount: actionExecutor?.handlers instanceof Map ? actionExecutor.handlers.size : 0,
      actionPreconditionCount: actionExecutor?.preconditionHandlers instanceof Map ? actionExecutor.preconditionHandlers.size : 0,
      perceptionDescriptorCount:
        Number.isFinite(perceptionRegistrySummary?.counts?.descriptorCount)
          ? perceptionRegistrySummary.counts.descriptorCount
          : 0,
      perceptionHandlerCount: countPerceptionHandlers(),
      dataQueryKindCount:
        typeof dataQueryExecutor?.dataQueryEngine?.listSupportedQueryKinds === 'function'
          ? dataQueryExecutor.dataQueryEngine.listSupportedQueryKinds().length
          : 0,
      dataQueryDescriptorCount:
        Number.isFinite(dataQueryExecutorSummary?.counts?.supportedQueryDescriptorCount)
          ? dataQueryExecutorSummary.counts.supportedQueryDescriptorCount
          : 0,
      linkPrimitiveCount: linkEngine?.primitiveHandlers instanceof Map ? linkEngine.primitiveHandlers.size : 0,
      traceRecordCount: Array.isArray(store?.interactionTrace) ? store.interactionTrace.length : 0,
      responseCount: Array.isArray(responseRecorder?.responseHistory)
        ? responseRecorder.responseHistory.length
        : Array.isArray(store?.responseHistory)
          ? store.responseHistory.length
          : 0,
    }),
    capabilities: makeRuntimeCoreCapabilities({
      paramsValidation: true,
      perceptionReturnsValidation: Boolean(perceptionRegistrySummary?.capabilities?.returnsValidation),
      dataQueryReturnsValidation: Boolean(dataQueryExecutorSummary?.capabilities?.returnsValidation),
      actionRun: Boolean(actionExecutor),
      perceptionQueryRun: Boolean(perceptionQueryRegistry),
      dataQueryRun: Boolean(dataQueryExecutor),
      workspacePlanning: typeof planWorkspace === 'function',
      verifiedActionRun: typeof agentLoopRuntime?.executeVerifiedAction === 'function',
      agentLoopContextRead: typeof agentLoopRuntime?.describeStepContext === 'function',
      statePatching: supportsStatePatching,
      stateDelta: supportsStateDelta,
      workspaceDescriptionRead:
        typeof store?.readDescription === 'function'
        || Boolean(store?.appId || store?.workspaceId),
      runtimeStoreRead: typeof store?.describeStore === 'function',
      widgetRegistryRead: typeof store?.describeWidgetRegistry === 'function' || typeof store?.widgetRegistry?.describe === 'function',
      widgetAdapterListRead:
        typeof store?.listWidgetAdapters === 'function'
        || Boolean(store?.widgetAdapters && typeof store.widgetAdapters === 'object'),
      viewRead:
        typeof store?.readState === 'function'
        || Boolean(store?.widgets && typeof store.widgets === 'object'),
      snapshotRead:
        typeof store?.readSnapshotEntry === 'function'
        || Array.isArray(store?.stateSnapshots),
      stateHistoryRead:
        typeof store?.listStateHistory === 'function'
        || typeof store?.listStateSnapshots === 'function'
        || Array.isArray(store?.stateSnapshots),
      branchListRead:
        typeof store?.listBranches === 'function'
        || Boolean(store?.branchRegistry && typeof store.branchRegistry === 'object'),
      interactionTraceRead:
        typeof store?.readTraceWindow === 'function'
        || Array.isArray(store?.interactionTrace),
      traceGraphRead:
        typeof store?.buildTraceGraph === 'function'
        || Array.isArray(store?.stateSnapshots),
      stateJump: hasActionHandler('workspace.jumpToState'),
      branchCreate: hasActionHandler('workspace.branchFromState'),
      linkPropagationEvaluation: typeof linkEngine?.evaluatePropagation === 'function',
      traceRecording: typeof traceRecorder?.recordAction === 'function',
      branchReplay:
        (typeof store?.buildTraceGraph === 'function' || Array.isArray(store?.stateSnapshots))
        && (typeof store?.beginBranchFromState === 'function' || Object.keys(store?.branchRegistry || {}).length > 0),
      answerRecording: typeof responseRecorder?.recordResponse === 'function',
      latestResponseRead:
        typeof responseRecorder?.readLatestResponse === 'function'
        || typeof store?.readLatestResponse === 'function'
        || Array.isArray(store?.responseHistory),
      responseHistoryRead:
        typeof responseRecorder?.listResponses === 'function'
        || typeof store?.listResponses === 'function'
        || Array.isArray(store?.responseHistory),
      protocolIntrospection: true,
    }),
  })
}
