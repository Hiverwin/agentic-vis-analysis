import {
  buildEvidenceEntry,
} from '../../app/store/sessionModel.js'
import {
  recordAgentSessionResultOnRuntime,
  recordAgentTurnResultOnRuntime,
} from '../agent/runtimeAgentRecording.js'
import {
  buildSelectionOperationResult as buildSelectionOperationResultImpl,
  buildWorkspaceGlobalFilters as buildWorkspaceGlobalFiltersInteractionImpl,
  clearWorkspaceHighlight as clearWorkspaceHighlightImpl,
  executeAgentWorkspaceAction as executeAgentWorkspaceActionImpl,
  executeWorkspaceAction as executeWorkspaceActionImpl,
  promotePrimarySelectionToGlobalFilters as promotePrimarySelectionToGlobalFiltersImpl,
  promotePrimarySelectionToHighlight as promotePrimarySelectionToHighlightImpl,
  readSelectionPropagationSummary as readSelectionPropagationSummaryImpl,
  syncWorkspaceGlobalFilters as syncWorkspaceGlobalFiltersImpl,
  syncWorkspacePrimarySelectionResult as syncWorkspacePrimarySelectionResultImpl,
} from '../workspace/runtimeWorkspaceInteractions.js'
import {
  appendAgentMessage as appendAgentMessageImpl,
  appendRuntimeTraceStep as appendRuntimeTraceStepImpl,
  disposeRuntimeSession as disposeRegisteredRuntimeSession,
  getRuntimeSession,
  readAgentMessages as readAgentMessagesImpl,
  readRuntimeTrace as readRuntimeTraceImpl,
  registerRuntimeSession,
} from '../sessions/runtimeSessionRegistry.js'
import {
  buildAppSnapshot as buildAppSnapshotImpl,
  createInitialSessionState as createInitialSessionStateImpl,
  ensureRuntimeSession as ensureRuntimeSessionImpl,
  registerWorkspaceCaseOverride as registerWorkspaceCaseOverrideBootstrapImpl,
  registerWorkspaceProviderEnvironment as registerWorkspaceProviderEnvironmentBootstrapImpl,
} from '../sessions/runtimeSessionBootstrap.js'
import { buildWorkspaceComposition, cloneWorkspaceComposition } from '../workspace/workspaceComposition.js'
import { createSystemRuntimeSession as createRuntimeSession } from '../vaHost/systemRuntimeSession.js'
import {
  buildAppSnapshotFromState,
  buildWorkspaceGlobalFilters as buildWorkspaceGlobalFiltersAdapterImpl,
  createInitialSessionStateFromCase,
} from '../sessions/sessionBootstrapAdapter.js'
import {
  getWorkspaceCase as getWorkspaceCaseImpl,
  registerWorkspaceCaseProviderEnvironment as registerWorkspaceCaseProviderEnvironmentImpl,
  registerWorkspaceCaseOverride as registerWorkspaceCaseOverrideImpl,
} from '../workspace/workspaceCaseRegistry.js'
import { cloneJsonValue as clone } from '../../shared/clone.js'
export {
  getRuntimeSession,
  getWorkspaceCaseImpl as getWorkspaceCase,
}

function createCaseBoundRuntimeReaders(caseId, deps = {}) {
  const {
    describeWorkspace,
    readObservation,
    readSharedAnalyticalState,
    readSharedFilterContext,
    readSharedViewportContext,
    readSharedSemanticFocus,
    readSharedStructuralContext,
    readViewStatesByWidget,
    readSharedViewContext,
    readSharedTransformationContext,
    readActiveAnalyticalContext,
    readView,
    readCoordinationState,
    readLatestCoordinationResult,
    readPropagationSummary,
    listAvailableActions,
    listAvailablePerceptions,
    listAvailableDataQueries,
    readTrace,
    replay,
    queryPerception,
    runDataQuery,
    executeVerifiedAction,
  } = deps

  return {
    caseId,
    describeWorkspace: (options = {}) => describeWorkspace(caseId, options),
    readObservation: (options = {}) => readObservation(caseId, options),
    readSharedAnalyticalState: (options = {}) => readSharedAnalyticalState(caseId, options),
    readSharedFilterContext: (options = {}) => readSharedFilterContext(caseId, options),
    readSharedViewportContext: (options = {}) => readSharedViewportContext(caseId, options),
    readSharedSemanticFocus: (options = {}) => readSharedSemanticFocus(caseId, options),
    readSharedStructuralContext: (options = {}) => readSharedStructuralContext(caseId, options),
    readViewStatesByWidget: (options = {}) => readViewStatesByWidget(caseId, options),
    readSharedViewContext: (options = {}) => readSharedViewContext(caseId, options),
    readSharedTransformationContext: (options = {}) => readSharedTransformationContext(caseId, options),
    readActiveAnalyticalContext: (options = {}) => readActiveAnalyticalContext(caseId, options),
    readView: (options = {}) => readView(caseId, options),
    readCoordinationState: () => readCoordinationState(caseId),
    readLatestCoordinationResult: () => readLatestCoordinationResult(caseId),
    readPropagationSummary: () => readPropagationSummary(caseId),
    listAvailableActions: () => listAvailableActions(caseId),
    listAvailablePerceptions: () => listAvailablePerceptions(caseId),
    listAvailableDataQueries: () => listAvailableDataQueries(caseId),
    readTrace: (options = {}) => readTrace(caseId, options),
    replay: (stateIdOrOptions) => replay(caseId, stateIdOrOptions),
    queryPerception: (call = {}) => queryPerception(caseId, call),
    runDataQuery: (call = {}) => runDataQuery(caseId, call),
    executeVerifiedAction: (call = {}, options = {}) => executeVerifiedAction(caseId, call, options),
  }
}

function createAgentRuntimeContractFromDeps(caseId, deps = {}) {
  const {
    executeAgentWorkspaceAction,
  } = deps
  const readers = createCaseBoundRuntimeReaders(caseId, deps)
  const baseClient = {
    describeWorkspace: readers.describeWorkspace,
    readObservation: readers.readObservation,
    readView: readers.readView,
    readCoordinationState: readers.readCoordinationState,
    readPropagationSummary: readers.readPropagationSummary,
    listAvailableActions: readers.listAvailableActions,
    listAvailablePerceptions: readers.listAvailablePerceptions,
    executeAction: (call = {}) => executeAgentWorkspaceAction(caseId, call),
    queryPerception: readers.queryPerception,
    runDataQuery: readers.runDataQuery,
    readTrace: readers.readTrace,
    replay: readers.replay,
  }

  return {
    ...baseClient,
    ...readers,
  }
}

function createFirstPartyRuntimeSessionFacadeFromDeps(caseId, deps = {}) {
  const {
    readWorkspaceCoordinationState,
    readWidgetRenderPayload,
    readWorkspaceControlProjection,
    readWorkspaceStateHistory,
    readRuntimeTrace,
    appendRuntimeTraceStep,
    readAgentMessages,
    appendAgentMessage,
    setFocusedWidgetId,
    syncWorkspaceGlobalFilters,
    clearWorkspaceSelection,
    clearWorkspaceHighlight,
    promotePrimarySelectionToGlobalFilters,
    promotePrimarySelectionToHighlight,
    executeWorkspaceAction,
    jumpWorkspaceToState,
  } = deps

  const readers = createCaseBoundRuntimeReaders(caseId, deps)
  return {
    ...readers,
    readWorkspaceDescription: () => describeWorkspace(caseId),
    readPrimarySelection: () => readWorkspaceCoordinationState(caseId)?.selections?.views?.primary || null,
    readWidgetRenderPayload: (widgetId) => readWidgetRenderPayload(caseId, widgetId),
    readWorkspaceControlProjection: (options = {}) => readWorkspaceControlProjection(caseId, options),
    readStateHistory: (options = {}) => readWorkspaceStateHistory(caseId, options),
    readRuntimeTrace: () => readRuntimeTrace(caseId),
    appendTraceStep: (step = {}) => appendRuntimeTraceStep(caseId, step),
    readAgentMessages: () => readAgentMessages(caseId),
    appendAgentMessage: (message = {}) => appendAgentMessage(caseId, message),
    setFocusedWidgetId: (widgetId) => setFocusedWidgetId(caseId, widgetId),
    syncWorkspaceGlobalFilters: (state = {}) => syncWorkspaceGlobalFilters(caseId, state),
    clearWorkspaceSelection: () => clearWorkspaceSelection(caseId),
    clearWorkspaceHighlight: () => clearWorkspaceHighlight(caseId),
    promotePrimarySelectionToGlobalFilters: (state = {}) => promotePrimarySelectionToGlobalFilters(caseId, state),
    promotePrimarySelectionToHighlight: () => promotePrimarySelectionToHighlight(caseId),
    executeWorkspaceAction: (call = {}) => executeWorkspaceAction(caseId, call),
    jumpWorkspaceToState: (stateId) => jumpWorkspaceToState(caseId, stateId),
    agentContract: () => createAgentRuntimeContractFromDeps(caseId, deps),
  }
}

export function ensureRuntimeSession(caseId) {
  return ensureRuntimeSessionImpl(caseId, {
    getWorkspaceCase: getWorkspaceCaseImpl,
    getRuntimeSession,
    createRuntimeSession,
    registerRuntimeSession,
  })
}

export function disposeRuntimeSession(caseId) {
  return disposeRegisteredRuntimeSession(caseId)
}

export function readFocusedWidgetId(caseId) {
  return getRuntimeSession(caseId)?.workspace?.readFocusedWidgetId?.() || null
}

export function setFocusedWidgetId(caseId, widgetId) {
  const session = getRuntimeSession(caseId)
  if (!session?.workspace || !widgetId) return null
  session.workspace.setFocusedWidget(widgetId)
  return session.workspace.readFocusedWidgetId?.() || null
}

export function readWorkspaceCoordinationState(caseId) {
  return getRuntimeSession(caseId)?.workspace?.readCoordinationState?.() || null
}

export function describeWorkspace(caseId, options = {}) {
  return clone(getRuntimeSession(caseId)?.runtime?.describeWorkspace?.(options) || null)
}

export function readObservation(caseId, options = {}) {
  const session = getRuntimeSession(caseId)
  if (!session?.workspace || typeof session.workspace.readObservation !== 'function') return null
  return clone(session.workspace.readObservation(options))
}

export function readSharedAnalyticalState(caseId, options = {}) {
  return clone(getRuntimeSession(caseId)?.workspace?.readSharedAnalyticalState?.(options) || null)
}

export function readSharedFilterContext(caseId, options = {}) {
  return clone(getRuntimeSession(caseId)?.workspace?.readSharedFilterContext?.(options) || {
    globalFilters: {},
    selectionRef: null,
    selectionPredicates: [],
  })
}

export function readSharedViewportContext(caseId, options = {}) {
  return clone(getRuntimeSession(caseId)?.workspace?.readSharedViewportContext?.(options) || {
    focusedWidgetRef: null,
    viewport: null,
    comparisonTargets: [],
  })
}

export function readSharedSemanticFocus(caseId, options = {}) {
  return clone(getRuntimeSession(caseId)?.workspace?.readSharedSemanticFocus?.(options) || {
    focusedWidgetRef: null,
    focus: null,
    primarySelection: null,
    highlight: {
      activeWidgetRefs: [],
      summaries: [],
    },
  })
}

export function readSharedStructuralContext(caseId, options = {}) {
  return clone(getRuntimeSession(caseId)?.workspace?.readSharedStructuralContext?.(options) || {
    links: {
      definitions: [],
      topology: null,
    },
    comparisonTargets: [],
    annotations: [],
  })
}

export function readViewStatesByWidget(caseId, options = {}) {
  return clone(getRuntimeSession(caseId)?.workspace?.readViewStatesByWidget?.(options) || {})
}

export function readSharedViewContext(caseId, options = {}) {
  return clone(getRuntimeSession(caseId)?.workspace?.readSharedViewContext?.(options) || {
    activeWidgetRefs: [],
    widgets: {},
  })
}

export function readSharedTransformationContext(caseId, options = {}) {
  return clone(getRuntimeSession(caseId)?.workspace?.readSharedTransformationContext?.(options) || {
    activeWidgetRefs: [],
    widgets: {},
  })
}

export function readActiveAnalyticalContext(caseId, options = {}) {
  return clone(getRuntimeSession(caseId)?.workspace?.readActiveAnalyticalContext?.(options) || {
    activeContextKinds: [],
    focusedWidgetRef: null,
    globalFilters: null,
    primarySelection: null,
    highlight: null,
    viewport: null,
    comparisonTargets: null,
    structure: {
      linkCount: 0,
      annotationCount: 0,
    },
    transformationContext: {
      activeWidgetRefs: [],
      widgets: {},
    },
    viewStatesByWidget: null,
  })
}

export function readView(caseId, options = {}) {
  const session = getRuntimeSession(caseId)
  const runtimeView = session?.runtime?.readView?.(options)
  if (runtimeView) return clone(runtimeView)
  return clone(session?.workspace?.readView?.(options) || null)
}

export function listAvailableActions(caseId) {
  return clone(getRuntimeSession(caseId)?.runtime?.listAvailableActions?.() || [])
}

export function listAvailablePerceptions(caseId) {
  return clone(getRuntimeSession(caseId)?.runtime?.listAvailablePerceptions?.() || [])
}

export function listAvailableDataQueries(caseId) {
  const description = describeWorkspace(caseId)
  return clone(
    (description?.dataHandles || []).flatMap((handle) => (
      Array.isArray(handle?.supportedQueryDescriptors)
        ? handle.supportedQueryDescriptors.map((descriptor) => ({
          dataRef: handle.ref,
          queryKind: descriptor.name,
          title: descriptor.title || descriptor.name,
          description: descriptor.description || '',
        }))
        : []
    )),
  )
}

export function readWorkspaceStateHistory(caseId, options = {}) {
  return clone(getRuntimeSession(caseId)?.workspace?.readStateHistory?.(options) || [])
}

export function readWorkspaceControlProjection(caseId, {
  fallbackSelectedWidgetId = null,
} = {}) {
  const workspace = getRuntimeSession(caseId)?.workspace || null
  return workspace?.readControlProjection?.({
    fallbackSelectedWidgetId,
  }) || null
}

export function readLatestCoordinationResult(caseId) {
  return clone(getRuntimeSession(caseId)?.workspace?.readLatestCoordinationResult?.() || null)
}

export function readCoordinationState(caseId) {
  return readWorkspaceCoordinationState(caseId)
}

export function readWidgetRenderPayload(caseId, widgetId) {
  const session = getRuntimeSession(caseId)
  return clone(session?.runtime?.readWidgetRenderPayload?.(widgetId) || null)
}

export function readRuntimeTrace(caseId) {
  return readRuntimeTraceImpl(caseId)
}

export function readTrace(caseId, options = {}) {
  return clone(getRuntimeSession(caseId)?.runtime?.readTrace?.(options) || [])
}

export function readAgentMessages(caseId) {
  return readAgentMessagesImpl(caseId)
}

export function appendRuntimeTraceStep(caseId, step = {}) {
  return appendRuntimeTraceStepImpl(caseId, step)
}

export function appendAgentMessage(caseId, message = {}) {
  return appendAgentMessageImpl(caseId, message)
}

export function recordAgentTurnResult(caseId, {
  query = null,
  turn = null,
  sessionKnowledge = null,
} = {}) {
  return recordAgentTurnResultOnRuntime(createFirstPartyRuntimeSessionFacade(caseId), {
    query,
    turn,
    sessionKnowledge,
  })
}

export function recordAgentSessionResult(caseId, {
  query = null,
  result = null,
  fallbackKnowledge = null,
} = {}) {
  return recordAgentSessionResultOnRuntime(createFirstPartyRuntimeSessionFacade(caseId), {
    query,
    result,
    fallbackKnowledge,
  })
}

export function readSelectionPropagationSummary(caseId) {
  return readSelectionPropagationSummaryImpl(caseId, { getRuntimeSession })
}

export function readPropagationSummary(caseId) {
  return readSelectionPropagationSummary(caseId)
}

export function buildSelectionOperationResult(caseId, { changed = false } = {}) {
  return buildSelectionOperationResultImpl(caseId, { changed }, {
    getRuntimeSession,
    readWorkspaceCoordinationState,
  })
}

export function buildWorkspaceGlobalFilters(state = {}) {
  return buildWorkspaceGlobalFiltersInteractionImpl(state, {
    buildWorkspaceGlobalFiltersImpl: buildWorkspaceGlobalFiltersAdapterImpl,
    getRuntimeSession,
  })
}

export function syncWorkspaceGlobalFilters(caseId, state = {}) {
  return syncWorkspaceGlobalFiltersImpl(caseId, state, {
    getRuntimeSession,
    buildWorkspaceGlobalFilters,
  })
}

export function syncWorkspacePrimarySelectionResult(caseId, selection = null) {
  return syncWorkspacePrimarySelectionResultImpl(caseId, selection, {
    getRuntimeSession,
    buildSelectionOperationResult,
  })
}

export function syncWorkspacePrimarySelection(caseId, selection = null) {
  return syncWorkspacePrimarySelectionResult(caseId, selection).changed
}

export function clearWorkspaceSelection(caseId) {
  return syncWorkspacePrimarySelectionResult(caseId, null)
}

export function promotePrimarySelectionToGlobalFilters(caseId, state = {}) {
  return promotePrimarySelectionToGlobalFiltersImpl(caseId, state, {
    getRuntimeSession,
    readWorkspaceCoordinationState,
  })
}

export function promotePrimarySelectionToHighlight(caseId) {
  return promotePrimarySelectionToHighlightImpl(caseId, {
    getRuntimeSession,
    readWorkspaceCoordinationState,
  })
}

export function clearWorkspaceHighlight(caseId) {
  return clearWorkspaceHighlightImpl(caseId, {
    getRuntimeSession,
    readWorkspaceCoordinationState,
  })
}

export async function jumpWorkspaceToState(caseId, stateId) {
  const session = getRuntimeSession(caseId)
  if (!session?.workspace || typeof stateId !== 'string' || stateId.length === 0) {
    throw new Error('jumpWorkspaceToState requires an active workspace and a valid stateId.')
  }
  return session.workspace.jumpToStateAndClearLatestCoordinationResult({ stateId })
}

export async function executeWorkspaceAction(caseId, {
  widgetId = null,
  name,
  params = {},
} = {}) {
  return executeWorkspaceActionImpl(caseId, {
    widgetId,
    name,
    params,
  }, { getRuntimeSession })
}

export async function executeAgentWorkspaceAction(caseId, call = {}) {
  return executeAgentWorkspaceActionImpl(caseId, call, {
    getRuntimeSession,
    executeWorkspaceAction,
  })
}

export async function executeAction(caseId, call = {}) {
  const session = getRuntimeSession(caseId)
  if (!session?.runtime || !call || typeof call !== 'object') {
    throw new Error('executeAction requires an active runtime session and a valid action call object.')
  }
  return session.runtime.executeAction(call)
}

export async function executeVerifiedAction(caseId, call = {}, options = {}) {
  const session = getRuntimeSession(caseId)
  if (!session?.runtime || !call || typeof call !== 'object') {
    throw new Error('executeVerifiedAction requires an active runtime session and a valid action call object.')
  }
  return session.runtime.executeVerifiedAction(call, options)
}

export async function queryRuntimePerception(caseId, call = {}) {
  const session = getRuntimeSession(caseId)
  if (!session?.runtime || !call || typeof call !== 'object') {
    throw new Error('queryRuntimePerception requires an active runtime session and a valid perception call object.')
  }
  return session.runtime.queryPerception(call)
}

export async function queryPerception(caseId, call = {}) {
  return queryRuntimePerception(caseId, call)
}

export async function runDataQuery(caseId, call = {}) {
  const session = getRuntimeSession(caseId)
  if (!session?.runtime || !call || typeof call !== 'object') {
    throw new Error('runDataQuery requires an active runtime session and a valid data-query call object.')
  }
  return session.runtime.runDataQuery(call)
}

export async function replayRuntimeState(caseId, stateIdOrOptions) {
  const session = getRuntimeSession(caseId)
  if (!session?.runtime) {
    throw new Error('replayRuntimeState requires an active runtime session.')
  }
  return session.runtime.replay(stateIdOrOptions)
}

export async function replay(caseId, stateIdOrOptions) {
  return replayRuntimeState(caseId, stateIdOrOptions)
}

function contractDeps() {
  return {
    describeWorkspace,
    readObservation,
    readSharedAnalyticalState,
    readSharedFilterContext,
    readSharedViewportContext,
    readSharedSemanticFocus,
    readSharedStructuralContext,
    readViewStatesByWidget,
    readSharedViewContext,
    readSharedTransformationContext,
    readActiveAnalyticalContext,
    readView,
    readCoordinationState,
    readLatestCoordinationResult,
    readPropagationSummary,
    listAvailableActions,
    listAvailablePerceptions,
    listAvailableDataQueries,
    readTrace,
    replay,
    queryPerception,
    runDataQuery,
    executeVerifiedAction,
    executeAgentWorkspaceAction,
    readWorkspaceCoordinationState,
    readWidgetRenderPayload,
    readWorkspaceControlProjection,
    readWorkspaceStateHistory,
    readRuntimeTrace,
    appendRuntimeTraceStep,
    readAgentMessages,
    appendAgentMessage,
    getWorkspaceCase: getWorkspaceCaseImpl,
    setFocusedWidgetId,
    syncWorkspaceGlobalFilters,
    syncWorkspacePrimarySelection,
    syncWorkspacePrimarySelectionResult,
    clearWorkspaceSelection,
    clearWorkspaceHighlight,
    promotePrimarySelectionToGlobalFilters,
    promotePrimarySelectionToHighlight,
    executeWorkspaceAction,
    jumpWorkspaceToState,
  }
}

export function createAgentRuntimeContract(caseId) {
  return createAgentRuntimeContractFromDeps(caseId, contractDeps())
}

export function createFirstPartyRuntimeSessionFacade(caseId) {
  return createFirstPartyRuntimeSessionFacadeFromDeps(caseId, contractDeps())
}

export function registerWorkspaceCaseOverride(caseId, caseDef) {
  return registerWorkspaceCaseOverrideBootstrapImpl(caseId, caseDef, {
    registerWorkspaceCaseOverrideImpl,
    disposeRuntimeSession,
  })
}

export function registerWorkspaceProviderEnvironment(caseId, providerEnvironment = 'mixed') {
  return registerWorkspaceProviderEnvironmentBootstrapImpl(caseId, providerEnvironment, {
    registerWorkspaceCaseProviderEnvironmentImpl,
    disposeRuntimeSession,
  })
}

export function createInitialSessionState(caseId) {
  return createInitialSessionStateImpl(caseId, {
    getWorkspaceCase: getWorkspaceCaseImpl,
    buildWorkspaceComposition,
    cloneWorkspaceComposition,
    ensureRuntimeSession,
    createInitialSessionStateFromCase,
    buildEvidenceEntry,
    syncWorkspaceGlobalFilters,
  })
}

export function buildAppSnapshot(state) {
  return buildAppSnapshotImpl(state, {
    buildAppSnapshotFromState,
    getRuntimeSession,
  })
}
