import {
  PAGE_PORT_ALIASES,
  PAGE_PORT_METHODS,
  describePagePortCapabilities,
  describePagePortSchemasForMethods,
} from '../protocol/pagePort.js'
import { describeAgentLoopContextSchema, describeVerifiedActionResultSchema } from '../protocol/agentLoop.js'
import { describeWorkspaceDescriptionSchema } from '../protocol/description.js'
import { parseRef } from '../protocol/refs.js'
import { describeRuntimeCore as buildRuntimeCoreSummary } from './RuntimeCoreIntrospector.js'
import { describeStateManagerFromStore, hasStateManagerSurface } from './StateManager.js'
import { summarizeWidgetAdapter } from './summarizeWidgetAdapter.js'
import {
  buildCoordinationStateFromWorkspaceState,
  buildPropagationSummary,
  buildRuntimeObservation,
  listAvailableActionsFromDescription,
  listAvailablePerceptionsFromDescription,
} from './agentFacingSurface.js'
import {
  buildTraceGraphFromStore,
  listBranchesFromStore,
  listResponsesFromStore,
  listStoreActions,
  listStoreDataHandles,
  listStoreLinks,
  listStorePerceptionQueries,
  listStateSnapshotsFromStore,
  listStoreWidgets,
  readLatestResponseFromStore,
  readInteractionTraceFromStore,
  readSnapshotFromStore,
  readWorkspaceDescriptionFromStore,
  readWorkspaceStateFromStore,
  valuesFromRecord,
} from './workspaceStoreReaders.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function resolveWidgetAdapterSummaries(store, description) {
  return Array.isArray(description?.widgetAdapters) && description.widgetAdapters.length > 0
    ? clone(description.widgetAdapters)
    : (typeof store?.listWidgetAdapters === 'function'
        ? store.listWidgetAdapters()
        : valuesFromRecord(store?.widgetAdapters))
        .map((item) => summarizeWidgetAdapter(item)).filter(Boolean)
}

export function installWidgetVAPagePort({
  store,
  planWorkspace,
  executeAction,
  actionContext,
  readLatestCoordinationResult,
  queryPerception,
  queryData,
  actionExecutor,
  perceptionQueryRegistry,
  dataQueryExecutor,
  linkEngine,
  traceRecorder,
  responseRecorder,
  agentLoopRuntime,
}) {
  const executeActionFn =
    typeof executeAction === 'function'
      ? executeAction
      : (typeof actionExecutor?.run === 'function'
          ? (call) => actionExecutor.run(call, actionContext || null)
          : null)
  const queryPerceptionFn =
    typeof queryPerception === 'function'
      ? queryPerception
      : (typeof perceptionQueryRegistry?.run === 'function'
          ? (call) => perceptionQueryRegistry.run(call)
          : typeof perceptionQueryRegistry?.query === 'function'
            ? (call) => perceptionQueryRegistry.query(call)
          : null)
  const queryDataFn =
    typeof queryData === 'function'
      ? queryData
      : (typeof dataQueryExecutor?.run === 'function' ? (call) => dataQueryExecutor.run(call) : null)
  const hasAgentLoopMethod = (methodName) => typeof agentLoopRuntime?.[methodName] === 'function'
  const hasStoreMethod = (methodName) => typeof store?.[methodName] === 'function'
  const hasActionExecutorMethod = (methodName) => typeof actionExecutor?.[methodName] === 'function'
  const hasPerceptionRegistryMethod = (methodName) => typeof perceptionQueryRegistry?.[methodName] === 'function'
  const hasDataQueryExecutorMethod = (methodName) => typeof dataQueryExecutor?.[methodName] === 'function'
  const hasLinkEngineMethod = (methodName) => typeof linkEngine?.[methodName] === 'function'
  const hasTraceRecorderMethod = (methodName) => typeof traceRecorder?.[methodName] === 'function'
  const hasResponseRecorderMethod = (methodName) => typeof responseRecorder?.[methodName] === 'function'
  const hasInteractionTraceArray = Array.isArray(store?.interactionTrace)
  const plannerInstalled = typeof planWorkspace === 'function'
  const hasActionHandler = (actionName) => {
    if (!actionName) return false
    if (typeof actionExecutor?.has === 'function') {
      return actionExecutor.has(actionName)
    }
    if (actionExecutor?.handlers instanceof Map) {
      return actionExecutor.handlers.has(actionName)
    }
    return false
  }
  const agentLoopInstalled =
    hasAgentLoopMethod('describeStepContext') || hasAgentLoopMethod('executeVerifiedAction')
  const installedPagePortMethods = new Set(
    [
      ['describePagePort', true],
      ['describeWorkspace', hasStoreMethod('readDescription') || Boolean(store?.appId || store?.workspaceId)],
      ['parseRef', true],
      ['describeRuntimeCore', true],
      ['describeRuntimeStore', hasStoreMethod('describeStore')],
      ['describeWidgetRegistry', hasStoreMethod('describeWidgetRegistry')],
      ['describeActionExecutor', hasActionExecutorMethod('describeExecutor')],
      ['describeActionContext', hasActionExecutorMethod('describeContext')],
      ['describeActionUsage', hasActionExecutorMethod('describeActionUsage')],
      ['describePerceptionRegistry', hasPerceptionRegistryMethod('describeRegistry')],
      ['describePerceptionContext', hasPerceptionRegistryMethod('describeContext')],
      ['describeDataQueryExecutor', hasDataQueryExecutorMethod('describeExecutor')],
      ['describeDataQueryContext', hasDataQueryExecutorMethod('describeContext')],
      ['describeDataQueryEngine', typeof dataQueryExecutor?.dataQueryEngine?.describeEngine === 'function'],
      ['describeStateManager', hasStateManagerSurface(store)],
      ['describeTraceRecorder', hasTraceRecorderMethod('describeRecorder')],
      ['describeResponseRecorder', hasResponseRecorderMethod('describeRecorder')],
      ['describeLinkEngine', hasLinkEngineMethod('describeEngine')],
      ['planWorkspace', plannerInstalled],
      ['describeAgentLoop', hasAgentLoopMethod('describeStepContext')],
      ['listWidgetAdapters', hasStoreMethod('listWidgetAdapters') || Boolean(store?.widgetAdapters && typeof store.widgetAdapters === 'object')],
      ['readObservation', Boolean(store)],
      ['readCoordinationState', Boolean(store)],
      ['readPropagationSummary', Boolean(store)],
      ['readLatestCoordinationResult', typeof readLatestCoordinationResult === 'function'],
      ['listAvailableActions', Boolean(store)],
      ['listAvailablePerceptions', Boolean(store)],
      ['readState', Boolean(store)],
      ['readView', Boolean(store)],
      ['readSnapshot', hasStoreMethod('readSnapshotEntry') || Array.isArray(store?.stateSnapshots)],
      ['listStateHistory', hasStoreMethod('listStateSnapshots') || Array.isArray(store?.stateSnapshots)],
      ['listBranches', hasStoreMethod('listBranches') || Boolean(store?.branchRegistry && typeof store.branchRegistry === 'object')],
      ['executeAction', typeof executeActionFn === 'function'],
      ['executeVerifiedAction', hasAgentLoopMethod('executeVerifiedAction')],
      ['jumpToState', typeof executeActionFn === 'function' && hasActionHandler('workspace.jumpToState')],
      ['branchFromState', typeof executeActionFn === 'function' && hasActionHandler('workspace.branchFromState')],
      ['queryPerception', typeof queryPerceptionFn === 'function'],
      ['runDataQuery', typeof queryDataFn === 'function'],
      ['queryData', typeof queryDataFn === 'function'],
      ['readTrace', Boolean(store)],
      ['getInteractionTrace', Boolean(store)],
      ['replay', typeof executeActionFn === 'function' && hasActionHandler('workspace.jumpToState')],
      ['getTraceGraph', hasStoreMethod('buildTraceGraph') || Array.isArray(store?.stateSnapshots)],
      ['getLatestAgentResponse', hasStoreMethod('readLatestResponse') || Array.isArray(store?.responseHistory)],
      ['listAgentResponses', hasStoreMethod('listResponses') || Array.isArray(store?.responseHistory)],
      ['evaluateLinkPropagation', hasLinkEngineMethod('evaluatePropagation')],
      ['recordAgentResponse', hasResponseRecorderMethod('recordResponse')],
    ]
      .filter(([, installed]) => installed)
      .map(([methodName]) => methodName),
  )
  const installedPagePortAliases = new Set(
    Object.entries(PAGE_PORT_ALIASES)
      .filter(([, methodName]) => installedPagePortMethods.has(methodName))
      .map(([alias]) => alias),
  )

  const port = {
    async describePagePort() {
      const description = describePagePortCapabilities({
        widgetAdapterIntrospection: true,
        runtimeCoreIntrospection: true,
        planner: plannerInstalled,
        agentLoop: agentLoopInstalled,
      })
      const methods = description.methods.filter((methodName) => installedPagePortMethods.has(methodName))
      const methodSet = new Set(methods)
      const aliases = Object.fromEntries(
        Object.entries(description.aliases || {}).filter(([, methodName]) => methodSet.has(methodName)),
      )
      const methodDescriptors = Object.fromEntries(
        Object.entries(description.methodDescriptors || {}).filter(([methodName]) => methodSet.has(methodName)),
      )
      return {
        ...description,
        methods,
        aliases,
        methodDescriptors,
        schemas: describePagePortSchemasForMethods(methods),
        transportHints: {
          ...description.transportHints,
          recommendedTools: Array.isArray(description.transportHints?.recommendedTools)
            ? description.transportHints.recommendedTools.filter((alias) => installedPagePortAliases.has(alias))
            : [],
          optionalTools: Array.isArray(description.transportHints?.optionalTools)
            ? description.transportHints.optionalTools.filter((alias) => installedPagePortAliases.has(alias))
            : [],
        },
      }
    },

    async describeWorkspace(options = {}) {
      const description = readWorkspaceDescriptionFromStore(store, {
        actionExecutor,
        perceptionQueryRegistry,
      })
      const includeSchemas = options.includeSchemas !== false
      const includeExamples = options.includeExamples !== false
      const includeProtocolSchemas = options.includeProtocolSchemas === true
      const baseActions = Array.isArray(description?.actions) && description.actions.length > 0
        ? description.actions
        : listStoreActions(store, actionExecutor)
      const actions = baseActions.map((action) => {
        const next = clone(action)
        if (!includeSchemas) delete next.paramsSchema
        if (!includeExamples) delete next.examples
        return next
      })
      const baseDataHandles = Array.isArray(description?.dataHandles) && description.dataHandles.length > 0
        ? description.dataHandles
        : listStoreDataHandles(store)
      const dataHandles = baseDataHandles.map((handle) => {
        const next = clone(handle)
        if (!includeSchemas) delete next.schema
        if (Array.isArray(next.supportedQueryDescriptors)) {
          next.supportedQueryDescriptors = next.supportedQueryDescriptors.map((descriptor) => {
            const queryDescriptor = clone(descriptor)
            if (!includeSchemas) delete queryDescriptor.inputSchema
            if (!includeSchemas) delete queryDescriptor.resultSchema
            if (!includeExamples) delete queryDescriptor.examples
            return queryDescriptor
          })
        }
        return next
      })
      const basePerceptionQueries = Array.isArray(description?.perceptionQueries) && description.perceptionQueries.length > 0
        ? description.perceptionQueries
        : listStorePerceptionQueries(store, perceptionQueryRegistry)
      const perceptionQueries = basePerceptionQueries.map((item) => {
        const next = clone(item)
        if (!includeExamples) delete next.examples
        if (!includeSchemas) delete next.paramsSchema
        if (!includeSchemas) delete next.returnsSchema
        return next
      })
      const workspaceDescription = clone(description)
      if (workspaceDescription?.transportHints) {
        workspaceDescription.transportHints = {
          ...workspaceDescription.transportHints,
          recommendedTools: Array.isArray(workspaceDescription.transportHints?.recommendedTools)
            ? workspaceDescription.transportHints.recommendedTools.filter((alias) => installedPagePortAliases.has(alias))
            : [],
          optionalTools: Array.isArray(workspaceDescription.transportHints?.optionalTools)
            ? workspaceDescription.transportHints.optionalTools.filter((alias) => installedPagePortAliases.has(alias))
            : [],
        }
      }
      return {
        ...workspaceDescription,
        widgets: Array.isArray(description?.widgets) && description.widgets.length > 0
          ? clone(description.widgets)
          : listStoreWidgets(store).map((item) => clone(item)),
        widgetAdapters: resolveWidgetAdapterSummaries(store, description),
        dataHandles,
        links: Array.isArray(description?.links) && description.links.length > 0
          ? clone(description.links)
          : listStoreLinks(store).map((item) => clone(item)),
        actions,
        perceptionQueries,
        ...(includeProtocolSchemas
          ? {
              __schemas: describePagePortSchemasForMethods(Array.from(installedPagePortMethods)),
            }
          : {}),
      }
    },

    async parseRef(options = {}) {
      return parseRef(options?.ref)
    },

    async describeRuntimeCore() {
      return buildRuntimeCoreSummary({
        store,
        planWorkspace,
        actionExecutor,
        perceptionQueryRegistry,
        dataQueryExecutor,
        linkEngine,
        traceRecorder,
        responseRecorder,
        agentLoopRuntime,
      })
    },

    async describeRuntimeStore() {
      return store.describeStore()
    },

    async describeWidgetRegistry() {
      return store.describeWidgetRegistry()
    },

    async describeActionExecutor() {
      return actionExecutor.describeExecutor()
    },

    async describeActionContext() {
      return actionExecutor.describeContext()
    },

    async describeActionUsage(options = {}) {
      return actionExecutor.describeActionUsage(options, actionContext || null)
    },

    async describePerceptionRegistry() {
      return perceptionQueryRegistry.describeRegistry()
    },

    async describePerceptionContext() {
      return perceptionQueryRegistry.describeContext()
    },

    async describeDataQueryExecutor() {
      return dataQueryExecutor.describeExecutor()
    },

    async describeDataQueryContext() {
      return dataQueryExecutor.describeContext()
    },

    async describeDataQueryEngine() {
      return dataQueryExecutor?.dataQueryEngine?.describeEngine?.() || null
    },

    async describeStateManager() {
      return describeStateManagerFromStore(store)
    },

    async describeTraceRecorder() {
      return traceRecorder.describeRecorder()
    },

    async describeResponseRecorder() {
      return responseRecorder.describeRecorder()
    },

    async describeLinkEngine() {
      return linkEngine.describeEngine()
    },

    async planWorkspace(options = {}) {
      return planWorkspace(options)
    },

    async describeAgentLoop(options = {}) {
      return agentLoopRuntime.describeStepContext(options)
    },

    async listWidgetAdapters() {
      return resolveWidgetAdapterSummaries(store, readWorkspaceDescriptionFromStore(store, {
        actionExecutor,
        perceptionQueryRegistry,
      }))
    },

    async readObservation(options = {}) {
      const description = readWorkspaceDescriptionFromStore(store, {
        actionExecutor,
        perceptionQueryRegistry,
      })
      const state = readWorkspaceStateFromStore(store, options.readStateOptions || options)
      const coordinationState = buildCoordinationStateFromWorkspaceState(state, {
        currentBranchId: store?.currentBranchId || null,
        derivedTopology: description?.runtimeTopology || {},
      })
      return buildRuntimeObservation({
        description,
        state,
        coordinationState,
        availableActions: listAvailableActionsFromDescription(description),
        availablePerceptions: listAvailablePerceptionsFromDescription(description),
        propagationSummary: buildPropagationSummary({
          state,
          description,
          linkEngine,
          sourceRef: options?.propagationOptions?.sourceRef || options?.sourceRef || null,
        }),
        latestCoordinationResult: typeof readLatestCoordinationResult === 'function'
          ? await readLatestCoordinationResult()
          : null,
      })
    },

    async readCoordinationState() {
      const description = readWorkspaceDescriptionFromStore(store, {
        actionExecutor,
        perceptionQueryRegistry,
      })
      return buildCoordinationStateFromWorkspaceState(readWorkspaceStateFromStore(store), {
        currentBranchId: store?.currentBranchId || null,
        derivedTopology: description?.runtimeTopology || {},
      })
    },

    async readPropagationSummary(options = {}) {
      return buildPropagationSummary({
        state: readWorkspaceStateFromStore(store),
        description: readWorkspaceDescriptionFromStore(store, {
          actionExecutor,
          perceptionQueryRegistry,
        }),
        linkEngine,
        sourceRef: options?.sourceRef || null,
      })
    },

    async readLatestCoordinationResult() {
      if (typeof readLatestCoordinationResult !== 'function') return null
      return clone(await readLatestCoordinationResult())
    },

    async listAvailableActions() {
      return listAvailableActionsFromDescription(readWorkspaceDescriptionFromStore(store, {
        actionExecutor,
        perceptionQueryRegistry,
      }))
    },

    async listAvailablePerceptions() {
      return listAvailablePerceptionsFromDescription(readWorkspaceDescriptionFromStore(store, {
        actionExecutor,
        perceptionQueryRegistry,
      }))
    },

    async readView(options = {}) {
      return readWorkspaceStateFromStore(store, options)
    },

    async readState(options = {}) {
      return readWorkspaceStateFromStore(store, options)
    },

    async readSnapshot(options = {}) {
      return options.stateId ? readSnapshotFromStore(store, options.stateId, options) : null
    },

    async listStateHistory(options = {}) {
      return listStateSnapshotsFromStore(store, {
        limit: options.limit || 50,
        sinceStateId: options.sinceStateId || null,
        actors: options.actors || [],
      })
    },

    async listBranches() {
      return listBranchesFromStore(store)
    },

    async executeAction(call) {
      return executeActionFn(call)
    },

    async executeVerifiedAction(call, options = {}) {
      return agentLoopRuntime.executeVerifiedAction(call, options)
    },

    async jumpToState(options = {}) {
      return executeActionFn({
        callId: options.callId || `jump_${Date.now()}`,
        name: 'workspace.jumpToState',
        actor: options.actor || 'agent',
        params: {
          stateId: options.stateId,
        },
      })
    },

    async branchFromState(options = {}) {
      return executeActionFn({
        callId: options.callId || `branch_${Date.now()}`,
        name: 'workspace.branchFromState',
        actor: options.actor || 'agent',
        params: {
          stateId: options.stateId,
          branchLabel: options.branchLabel,
        },
      })
    },

    async queryPerception(call) {
      return queryPerceptionFn(call)
    },

    async runDataQuery(call) {
      return queryDataFn(call)
    },

    async queryData(call) {
      return queryDataFn(call)
    },

    async readTrace(options = {}) {
      return readInteractionTraceFromStore(store, options)
    },

    async getInteractionTrace(options = {}) {
      return readInteractionTraceFromStore(store, options)
    },

    async replay(options = {}) {
      return executeActionFn({
        callId: options.callId || `replay_${Date.now()}`,
        name: 'workspace.jumpToState',
        actor: options.actor || 'agent',
        params: {
          stateId: options.stateId,
        },
      })
    },

    async getTraceGraph(options = {}) {
      return buildTraceGraphFromStore(store, {
        limit: options.limit || 50,
        sinceStateId: options.sinceStateId || null,
        actors: options.actors || [],
      })
    },

    async getLatestAgentResponse(options = {}) {
      return readLatestResponseFromStore(store, {
        workspaceId: options.workspaceId || null,
      })
    },

    async listAgentResponses(options = {}) {
      return listResponsesFromStore(store, options.limit || 20, {
        workspaceId: options.workspaceId || null,
      })
    },

    async evaluateLinkPropagation(options = {}) {
      return linkEngine.evaluatePropagation({
        sourceRef: options.sourceRef,
      })
    },

    async recordAgentResponse(record = {}) {
      return responseRecorder.recordResponse(record)
    },
  }

  for (const methodName of PAGE_PORT_METHODS) {
    if (!installedPagePortMethods.has(methodName)) {
      delete port[methodName]
    }
  }

  for (const [alias, methodName] of Object.entries(PAGE_PORT_ALIASES)) {
    if (typeof port[methodName] === 'function') {
      port[alias] = port[methodName]
    }
  }

  window.__widgetVA = port
  return () => {
    if (window.__widgetVA === port) {
      delete window.__widgetVA
    }
  }
}
