import {
  actionRun,
  actionContextDescribe,
  actionExecutorDescribe,
  agentLoopDescribe,
  branchFromState,
  branchList,
  dataQuery,
  dataQueryContextDescribe,
  dataQueryEngineDescribe,
  dataQueryExecutorDescribe,
  describePagePort,
  listAvailableWidgetVAMcpTools,
  listAgentResponses,
  linkEngineDescribe,
  linkPropagationEvaluate,
  jumpToState,
  parseWidgetVARef,
  readLatestAgentResponse,
  recordAgentResponse,
  runtimeCoreDescribe,
  responseRecorderDescribe,
  stateManagerDescribe,
  traceRecorderDescribe,
  runtimeStoreDescribe,
  widgetRegistryDescribe,
  interactionTraceRead,
  listWidgetAdapters,
  perceptionQuery,
  perceptionContextDescribe,
  perceptionRegistryDescribe,
  snapshotRead,
  stateHistoryRead,
  traceGraphRead,
  verifiedActionRun,
  viewRead,
  workspaceDescribe,
  workspacePlan,
  workspaceSnapshotRead,
} from './inPageTransport.js'
import {
  buildScatterBrushCall,
  branchFromStateOnPage,
  describeAgentLoopFromPage,
  describeActionContextFromPage,
  describeActionUsageFromPage,
  describeActionExecutorFromPage,
  describeDataQueryExecutorFromPage,
  describeDataQueryContextFromPage,
  describeDataQueryEngineFromPage,
  describeLinkEngineFromPage,
  describePagePortFromPage,
  describeResponseRecorderFromPage,
  parseRefFromPage,
  describePerceptionRegistryFromPage,
  describePerceptionContextFromPage,
  describeRuntimeCoreFromPage,
  describeStateManagerFromPage,
  describeTraceRecorderFromPage,
  describeWidgetRegistryFromPage,
  describeRuntimeStoreFromPage,
  describeWorkspaceFromPage,
  evaluateLinkPropagationOnPage,
  jumpToStateOnPage,
  listAgentResponsesFromPage,
  listBranchesFromPage,
  listWidgetAdaptersFromPage,
  planWorkspaceFromPage,
  queryDataOnPage,
  queryPerceptionOnPage,
  readObservationFromPage,
  readLatestCoordinationResultFromPage,
  readSnapshotFromPage,
  readStateHistoryFromPage,
  readInteractionTraceFromPage,
  readLatestAgentResponseFromPage,
  readTraceGraphFromPage,
  readViewFromPage,
  readWorkspaceSnapshotFromPage,
  runActionOnPage,
  recordAgentResponseOnPage,
  runVerifiedActionOnPage,
} from './examples/playwrightWidgetVA.js'
import { filterAvailableWidgetVAMcpTools } from './availableMcpTools.js'
import { WIDGETVA_MCP_TOOLS } from './widgetvaMcpCatalog.js'
import {
  describeWidgetViaTransport,
  executeWidgetActionViaTransport,
  executeWorkspaceActionViaTransport,
  queryWidgetPerceptionViaTransport,
  queryWorkspacePerceptionViaTransport,
  readWidgetStateViaTransport,
  readWidgetTraceViaTransport,
  readWorkspaceStateViaTransport,
  readWorkspaceTraceViaTransport,
  replayWidgetViaTransport,
  replayWorkspaceViaTransport,
} from './widgetWorkspaceTransportSurface.js'

export class WidgetVAPlaywrightClient {
  constructor(page) {
    this.page = page
  }

  async describeWorkspace(options = {}) {
    return describeWorkspaceFromPage(this.page, options)
  }

  async parseRef(ref) {
    return parseRefFromPage(this.page, ref)
  }

  async describePagePort() {
    return describePagePortFromPage(this.page)
  }

  async listAvailableWidgetVAMcpTools() {
    let pagePortDescription = null
    try {
      pagePortDescription = await this.describePagePort()
    } catch {
      pagePortDescription = null
    }

    return filterAvailableWidgetVAMcpTools({
      allTools: WIDGETVA_MCP_TOOLS,
      pagePortDescription,
    })
  }

  async describeRuntimeCore() {
    return describeRuntimeCoreFromPage(this.page)
  }

  async describeRuntimeStore() {
    return describeRuntimeStoreFromPage(this.page)
  }

  async describeWidgetRegistry() {
    return describeWidgetRegistryFromPage(this.page)
  }

  async describeActionExecutor() {
    return describeActionExecutorFromPage(this.page)
  }

  async describeActionContext() {
    return describeActionContextFromPage(this.page)
  }

  async describeActionUsage(options = {}) {
    return describeActionUsageFromPage(this.page, options)
  }

  async describePerceptionRegistry() {
    return describePerceptionRegistryFromPage(this.page)
  }

  async describePerceptionContext() {
    return describePerceptionContextFromPage(this.page)
  }

  async describeDataQueryExecutor() {
    return describeDataQueryExecutorFromPage(this.page)
  }

  async describeDataQueryContext() {
    return describeDataQueryContextFromPage(this.page)
  }

  async describeDataQueryEngine() {
    return describeDataQueryEngineFromPage(this.page)
  }

  async describeStateManager() {
    return describeStateManagerFromPage(this.page)
  }

  async describeTraceRecorder() {
    return describeTraceRecorderFromPage(this.page)
  }

  async describeResponseRecorder() {
    return describeResponseRecorderFromPage(this.page)
  }

  async describeLinkEngine() {
    return describeLinkEngineFromPage(this.page)
  }

  async planWorkspace(options = {}) {
    return planWorkspaceFromPage(this.page, options)
  }

  async describeAgentLoop(options = {}) {
    return describeAgentLoopFromPage(this.page, options)
  }

  async readObservation(options = {}) {
    return readObservationFromPage(this.page, options)
  }

  async listWidgetAdapters() {
    return listWidgetAdaptersFromPage(this.page)
  }

  async readLatestCoordinationResult() {
    return readLatestCoordinationResultFromPage(this.page)
  }

  async readView(options = {}) {
    return readViewFromPage(this.page, options)
  }

  async describeWidget(options = {}) {
    return describeWidgetViaTransport(this, options)
  }

  async readWorkspaceState(options = {}) {
    return readWorkspaceStateViaTransport(this, options)
  }

  async readState(options = {}) {
    return readWorkspaceStateViaTransport(this, options)
  }

  async readWidgetState(options = {}) {
    return readWidgetStateViaTransport(this, options)
  }

  async readSnapshot(options = {}) {
    return readSnapshotFromPage(this.page, options)
  }

  async readStateHistory(options = {}) {
    return readStateHistoryFromPage(this.page, options)
  }

  async listBranches() {
    return listBranchesFromPage(this.page)
  }

  async jumpToState(options = {}) {
    return jumpToStateOnPage(this.page, options)
  }

  async branchFromState(options = {}) {
    return branchFromStateOnPage(this.page, options)
  }

  async runAction(call) {
    return runActionOnPage(this.page, call)
  }

  async executeWorkspaceAction(call = {}) {
    return executeWorkspaceActionViaTransport(this, call)
  }

  async executeAction(call = {}) {
    return executeWorkspaceActionViaTransport(this, call)
  }

  async executeWidgetAction(call = {}) {
    return executeWidgetActionViaTransport(this, call)
  }

  async runVerifiedAction(call, options = {}) {
    return runVerifiedActionOnPage(this.page, call, options)
  }

  async queryPerception(call) {
    return queryPerceptionOnPage(this.page, call)
  }

  async queryWorkspacePerception(call = {}) {
    return queryWorkspacePerceptionViaTransport(this, call)
  }

  async queryWidgetPerception(call = {}) {
    return queryWidgetPerceptionViaTransport(this, call)
  }

  async queryData(call) {
    return queryDataOnPage(this.page, call)
  }

  async runDataQuery(call = {}) {
    return this.queryData(call)
  }

  async readInteractionTrace(options = {}) {
    return readInteractionTraceFromPage(this.page, options)
  }

  async readWorkspaceTrace(options = {}) {
    return readWorkspaceTraceViaTransport(this, options)
  }

  async readTrace(options = {}) {
    return readWorkspaceTraceViaTransport(this, options)
  }

  async readWidgetTrace(options = {}) {
    return readWidgetTraceViaTransport(this, options)
  }

  async readTraceGraph(options = {}) {
    return readTraceGraphFromPage(this.page, options)
  }

  async readLatestAgentResponse(options = {}) {
    return readLatestAgentResponseFromPage(this.page, options)
  }

  async listAgentResponses(options = {}) {
    return listAgentResponsesFromPage(this.page, options)
  }

  async evaluateLinkPropagation(options = {}) {
    return evaluateLinkPropagationOnPage(this.page, options)
  }

  async readWorkspaceSnapshot(options = {}) {
    return readWorkspaceSnapshotFromPage(this.page, options)
  }

  async recordAgentResponse(record = {}) {
    return recordAgentResponseOnPage(this.page, record)
  }

  async replayWorkspace(stateIdOrOptions) {
    return replayWorkspaceViaTransport(this, stateIdOrOptions)
  }

  async replay(stateIdOrOptions) {
    return replayWorkspaceViaTransport(this, stateIdOrOptions)
  }

  async replayWidget(stateIdOrOptions) {
    return replayWidgetViaTransport(this, stateIdOrOptions)
  }

  buildScatterBrushCall(args) {
    return buildScatterBrushCall(args)
  }
}

export {
  actionRun,
  actionContextDescribe,
  actionExecutorDescribe,
  agentLoopDescribe,
  branchFromState,
  branchList,
  dataQuery,
  dataQueryContextDescribe,
  dataQueryEngineDescribe,
  dataQueryExecutorDescribe,
  describePagePort,
  listAvailableWidgetVAMcpTools,
  listAgentResponses,
  linkEngineDescribe,
  linkPropagationEvaluate,
  jumpToState,
  parseWidgetVARef,
  readLatestAgentResponse,
  recordAgentResponse,
  runtimeCoreDescribe,
  responseRecorderDescribe,
  stateManagerDescribe,
  traceRecorderDescribe,
  widgetRegistryDescribe,
  runtimeStoreDescribe,
  interactionTraceRead,
  listWidgetAdapters,
  perceptionQuery,
  perceptionContextDescribe,
  perceptionRegistryDescribe,
  snapshotRead,
  stateHistoryRead,
  traceGraphRead,
  verifiedActionRun,
  viewRead,
  workspaceDescribe,
  workspacePlan,
  workspaceSnapshotRead,
}
