import {
  buildEmptyComputedPropagationSummary,
  buildEmptyCoordinationOperationResult,
  withViewportSubmodel,
} from '../../../../widgetva-kit/src/workspace.js'
import { createWidgetWorkspaceTransportClient } from '../../../../widgetva-kit/src/transportRuntime.js'
import { buildEvidenceEntry } from '../app/sessionModel.js'
import { buildWorkspaceComposition, cloneWorkspaceComposition } from './workspaceComposition.js'
import {
  buildScatterBrushSelectionEntry,
  buildWorkspaceSelectionEntry,
  normalizeScatterBrushSelection,
} from './selectionAdapter.js'
import { createRuntimeSession } from './runtimeSessionFactory.js'
import {
  buildAppSnapshotFromState,
  buildWorkspaceGlobalFilters as buildWorkspaceGlobalFiltersImpl,
  createInitialSessionStateFromCase,
} from './sessionBootstrapAdapter.js'
import {
  getWorkspaceCase as getWorkspaceCaseImpl,
  registerWorkspaceCaseProviderEnvironment as registerWorkspaceCaseProviderEnvironmentImpl,
  registerWorkspaceCaseOverride as registerWorkspaceCaseOverrideImpl,
} from './workspaceCaseRegistry.js'
import {
  buildFirstPartyControlState,
  deriveFirstPartyInteractionFilterPatch,
  buildFirstPartyRangeDomains,
} from './workspaceControlStateAdapter.js'
import {
  clampHorsepowerRange as clampHorsepowerRangeImpl,
  clearAnalysisFilters as clearAnalysisFiltersImpl,
  createWorkspaceViewModel as createWorkspaceViewModelImpl,
  cycleAnalysisOrigin as cycleAnalysisOriginImpl,
} from './workspaceViewModel.js'

export {
  clampHorsepowerRangeImpl as clampHorsepowerRange,
  clearAnalysisFiltersImpl as clearAnalysisFilters,
  createWorkspaceViewModelImpl as createWorkspaceViewModel,
  cycleAnalysisOriginImpl as cycleAnalysisOrigin,
  getWorkspaceCaseImpl as getWorkspaceCase,
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

const runtimeSessionRegistry = new Map()

function makeRuntimeId(prefix = 'runtime') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function makeTimeLabel(date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function parseBranchIdFromStateId(stateId) {
  if (typeof stateId !== 'string' || stateId.length === 0) return null
  const [branchId] = stateId.split(':')
  return typeof branchId === 'string' && branchId.length > 0 ? branchId : null
}

function readCurrentWorkspaceSnapshotMeta(caseIdOrSession) {
  const session = typeof caseIdOrSession === 'string' ? getRuntimeSession(caseIdOrSession) : caseIdOrSession
  return clone(
    session?.workspace?.readCurrentSnapshotMeta?.()
      || session?.workspace?.readCoordinationState?.()
      || null,
  )
}

function makeTraceBranchId(session) {
  session.traceBranchCounter = Number.isFinite(session.traceBranchCounter) ? session.traceBranchCounter + 1 : 1
  return `trace_branch_${session.traceBranchCounter}`
}

function normalizeTraceTransitionType(value) {
  if (value === 'continuation' || value === 'handoff' || value === 'branch') return value
  return null
}

function buildRuntimeTraceLineage(session, step = {}, nextStepId) {
  const previousStep = Array.isArray(session?.trace) && session.trace.length > 0 ? session.trace.at(-1) : null
  const snapshotMeta = readCurrentWorkspaceSnapshotMeta(session)
  const explicitTransitionType = normalizeTraceTransitionType(step?.transitionType)
  const resultStateId = step?.resultStateId
    || snapshotMeta?.stateId
    || previousStep?.resultStateId
    || null
  const sourceStateId = step?.sourceStateId
    || (
      step?.kind === 'replay'
        ? previousStep?.resultStateId || resultStateId || null
        : previousStep?.resultStateId || resultStateId || null
    )
  const stateDelta = step?.stateDelta || {}
  const actorChanged = Boolean(previousStep?.actor) && previousStep.actor !== (step?.actor || 'system')
  const requestedBranch = Boolean(stateDelta?.branch) || step?.kind === 'branch'
  const replayToHistoricalState = step?.kind === 'replay'
    && typeof resultStateId === 'string'
    && resultStateId.length > 0
    && typeof sourceStateId === 'string'
    && sourceStateId.length > 0
    && resultStateId !== sourceStateId
  const consumesPendingBranch = Boolean(
    session?.pendingTraceBranch
      && step?.kind !== 'replay'
      && sourceStateId
      && session.pendingTraceBranch.sourceStateId === sourceStateId,
  )

  let transitionType = explicitTransitionType
  if (!transitionType) {
    if (replayToHistoricalState || requestedBranch || consumesPendingBranch) transitionType = 'branch'
    else if (actorChanged || step?.handoffFrom) transitionType = 'handoff'
    else transitionType = 'continuation'
  }

  let branchId = step?.branchId
    || snapshotMeta?.branchId
    || parseBranchIdFromStateId(resultStateId)
    || session.currentTraceBranchId
    || 'main'
  let branchFromStateId = step?.branchFromStateId || null
  let parentStepId = step?.parentStepId || previousStep?.id || null

  if (replayToHistoricalState) {
    branchId = step?.branchId || makeTraceBranchId(session)
    branchFromStateId = step?.branchFromStateId || resultStateId
    parentStepId = step?.parentStepId || previousStep?.id || null
    session.pendingTraceBranch = {
      branchId,
      sourceStateId: resultStateId,
      branchFromStateId,
      replayStepId: nextStepId,
    }
    session.currentTraceBranchId = branchId
  } else if (consumesPendingBranch) {
    branchId = step?.branchId || session.pendingTraceBranch.branchId
    branchFromStateId = step?.branchFromStateId || session.pendingTraceBranch.branchFromStateId
    parentStepId = step?.parentStepId || session.pendingTraceBranch.replayStepId || previousStep?.id || null
    session.currentTraceBranchId = branchId
    session.pendingTraceBranch = null
  } else if (transitionType !== 'branch') {
    session.pendingTraceBranch = null
    session.currentTraceBranchId = parseBranchIdFromStateId(resultStateId) || snapshotMeta?.branchId || 'main'
    branchId = step?.branchId || session.currentTraceBranchId
  }

  return {
    sourceStateId,
    resultStateId,
    transitionType,
    branchId,
    branchFromStateId,
    parentStepId,
  }
}

export function getRuntimeSession(caseId) {
  return runtimeSessionRegistry.get(caseId) || null
}

export function ensureRuntimeSession(caseId) {
  const caseDef = getWorkspaceCaseImpl(caseId)
  const existing = runtimeSessionRegistry.get(caseDef.id)
  if (existing) return existing
  const session = createRuntimeSession(caseDef)
  runtimeSessionRegistry.set(caseDef.id, session)
  return session
}

export function disposeRuntimeSession(caseId) {
  const existing = runtimeSessionRegistry.get(caseId)
  if (!existing) return
  existing.dispose?.()
  runtimeSessionRegistry.delete(caseId)
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
  const session = getRuntimeSession(caseId)
  return session?.workspace?.readCoordinationState() || null
}

export function readRuntimeWorkspaceDescription(caseId) {
  const session = getRuntimeSession(caseId)
  return clone(session?.runtime?.describeWorkspace?.() || null)
}

export function describeWorkspace(caseId, options = {}) {
  const session = getRuntimeSession(caseId)
  return clone(session?.runtime?.describeWorkspace?.(options) || null)
}

export function readRuntimeObservation(caseId, options = {}) {
  const session = getRuntimeSession(caseId)
  return clone(session?.runtime?.readObservation?.(options) || null)
}

export function readObservation(caseId, options = {}) {
  return readRuntimeObservation(caseId, options)
}

export function readSharedAnalyticalState(caseId, options = {}) {
  const session = getRuntimeSession(caseId)
  return clone(session?.workspace?.readSharedAnalyticalState?.(options) || null)
}

export function readSharedFilterContext(caseId, options = {}) {
  const session = getRuntimeSession(caseId)
  return clone(session?.workspace?.readSharedFilterContext?.(options) || {
    globalFilters: {},
    selectionRef: null,
    selectionPredicates: [],
  })
}

export function readSharedViewportContext(caseId, options = {}) {
  const session = getRuntimeSession(caseId)
  return clone(session?.workspace?.readSharedViewportContext?.(options) || {
    focusedWidgetRef: null,
    viewport: null,
    comparisonTargets: [],
  })
}

export function readSharedSemanticFocus(caseId, options = {}) {
  const session = getRuntimeSession(caseId)
  return clone(session?.workspace?.readSharedSemanticFocus?.(options) || {
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
  const session = getRuntimeSession(caseId)
  return clone(session?.workspace?.readSharedStructuralContext?.(options) || {
    links: {
      definitions: [],
      topology: null,
    },
    comparisonTargets: [],
    annotations: [],
  })
}

export function readViewStatesByWidget(caseId, options = {}) {
  const session = getRuntimeSession(caseId)
  return clone(session?.workspace?.readViewStatesByWidget?.(options) || {})
}

export function readSharedViewContext(caseId, options = {}) {
  const session = getRuntimeSession(caseId)
  return clone(session?.workspace?.readSharedViewContext?.(options) || {
    activeWidgetRefs: [],
    widgets: {},
  })
}

export function readSharedTransformationContext(caseId, options = {}) {
  const session = getRuntimeSession(caseId)
  return clone(session?.workspace?.readSharedTransformationContext?.(options) || {
    activeWidgetRefs: [],
    widgets: {},
  })
}

export function readActiveAnalyticalContext(caseId, options = {}) {
  const session = getRuntimeSession(caseId)
  return clone(session?.workspace?.readActiveAnalyticalContext?.(options) || {
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

export function readRuntimeView(caseId, options = {}) {
  const session = getRuntimeSession(caseId)
  const runtimeView = session?.runtime?.readView?.(options)
  if (runtimeView) return clone(runtimeView)
  return clone(session?.workspace?.readView?.(options) || null)
}

export function readView(caseId, options = {}) {
  return readRuntimeView(caseId, options)
}

export function listRuntimeAvailableActions(caseId) {
  const session = getRuntimeSession(caseId)
  return clone(session?.runtime?.listAvailableActions?.() || [])
}

export function listAvailableActions(caseId) {
  return listRuntimeAvailableActions(caseId)
}

export function listRuntimeAvailablePerceptions(caseId) {
  const session = getRuntimeSession(caseId)
  return clone(session?.runtime?.listAvailablePerceptions?.() || [])
}

export function listAvailablePerceptions(caseId) {
  return listRuntimeAvailablePerceptions(caseId)
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
  const session = getRuntimeSession(caseId)
  return clone(session?.workspace?.readStateHistory(options) || [])
}

export function readWorkspaceInteractionBindings(caseId, {
  dataset = null,
  fallbackSelectedWidgetId = null,
} = {}) {
  const session = getRuntimeSession(caseId)
  const workspace = session?.workspace || null
  return workspace?.readInteractionBindings?.({
    rangeDomains: buildFirstPartyRangeDomains({
      dataset: {
        horsepowerDomain: dataset?.horsepowerDomain || [0, 1],
      },
    }),
    fallbackSelectedWidgetId,
  })
    || null
}

export function readLatestCoordinationResult(caseId) {
  const session = getRuntimeSession(caseId)
  return clone(session?.workspace?.readLatestCoordinationResult() || null)
}

export function readCoordinationState(caseId) {
  return readWorkspaceCoordinationState(caseId)
}

export function readWidgetRuntimeState(caseId, widgetId) {
  const session = getRuntimeSession(caseId)
  return clone(session?.workspace?.getWidget(widgetId)?.readState?.() || null)
}

export function readRuntimeTrace(caseId) {
  return clone(getRuntimeSession(caseId)?.trace || [])
}

export function readTrace(caseId, options = {}) {
  const session = getRuntimeSession(caseId)
  return clone(session?.runtime?.readTrace?.(options) || [])
}

export function readAgentMessages(caseId) {
  return clone(getRuntimeSession(caseId)?.agentMessages || [])
}

export function appendRuntimeTraceStep(caseId, step = {}) {
  const session = getRuntimeSession(caseId)
  if (!session) return null
  const clonedStep = clone(step) || {}
  const nextStepId = step.id || makeRuntimeId('trace')
  const lineage = buildRuntimeTraceLineage(session, clonedStep, nextStepId)
  const nextStep = {
    id: nextStepId,
    actor: step.actor || 'system',
    kind: step.kind || 'action',
    time: step.time || makeTimeLabel(),
    status: step.status || 'ok',
    ...clonedStep,
    ...lineage,
    stateDelta: {
      selection: false,
      focus: false,
      highlight: false,
      viewport: false,
      evidence: false,
      branch: false,
      propagation: false,
      ...(clonedStep.stateDelta || {}),
    },
  }
  session.trace = [...(Array.isArray(session.trace) ? session.trace : []), nextStep].slice(-60)
  return clone(nextStep)
}

export function appendAgentMessage(caseId, message = {}) {
  const session = getRuntimeSession(caseId)
  if (!session) return null
  const nextMessage = {
    id: message.id || makeRuntimeId('message'),
    role: message.role || 'assistant',
    text: message.text || '',
    ...clone(message),
  }
  session.agentMessages = [...(Array.isArray(session.agentMessages) ? session.agentMessages : []), nextMessage].slice(-24)
  return clone(nextMessage)
}

export function readSelectionPropagationSummary(caseId) {
  const session = getRuntimeSession(caseId)
  return clone(session?.workspace?.readComputedPropagationSummary?.() || buildEmptyComputedPropagationSummary())
}

export function readPropagationSummary(caseId) {
  return readSelectionPropagationSummary(caseId)
}

export function buildSelectionOperationResult(caseId, { changed = false } = {}) {
  const session = getRuntimeSession(caseId)
  return session?.workspace?.buildCoordinationOperationResult({ changed })
    || buildEmptyCoordinationOperationResult({
      changed,
      coordinationState: readWorkspaceCoordinationState(caseId),
    })
}

export function buildWorkspaceGlobalFilters(state = {}) {
  return buildWorkspaceGlobalFiltersImpl(state, {
    getRuntimeSession,
  })
}

export function syncWorkspaceGlobalFilters(caseId, state = {}) {
  const session = getRuntimeSession(caseId)
  if (!session?.workspace) return {}
  return session.workspace.syncGlobalFiltersFromControlState(
    buildFirstPartyControlState(state),
    {
      rangeDomains: buildFirstPartyRangeDomains(state),
    },
  )
}

export function syncScatterBrushSelectionResult(caseId, brush = null) {
  const session = getRuntimeSession(caseId)
  if (!session?.workspace) {
    return buildSelectionOperationResult(caseId, { changed: false })
  }
  const normalizedBrush = normalizeScatterBrushSelection(brush)

  if (!normalizedBrush) {
    return session.workspace.syncPrimarySelectionEntry(null)
  }

  const selectionEntry = buildScatterBrushSelectionEntry(session, normalizedBrush)
  return session.workspace.syncPrimarySelectionEntry(selectionEntry, {
    makePrimary: true,
    updateByWidget: true,
    focusSourceWidget: true,
  })
}

export function syncScatterBrushSelection(caseId, brush = null) {
  return syncScatterBrushSelectionResult(caseId, brush).changed
}

function normalizeScatterViewportState(session, viewport = null) {
  if (!viewport || typeof viewport !== 'object') return null
  const xDomain = Array.isArray(viewport.xDomain) ? [...viewport.xDomain] : null
  const yDomain = Array.isArray(viewport.yDomain) ? [...viewport.yDomain] : null
  if (!xDomain && !yDomain) return null
  const scatterWidget = session?.workspace?.getWidget?.('w_scatter_cars') || null
  const sourceWidgetRef = scatterWidget?.resolveWidgetRef?.() || scatterWidget?.describe?.()?.ref || null
  return {
    sourceWidgetRef,
    xDomain,
    yDomain,
  }
}

export function syncScatterViewportResult(caseId, viewport = null) {
  const session = getRuntimeSession(caseId)
  if (!session?.workspace) {
    return buildSelectionOperationResult(caseId, { changed: false })
  }

  const currentViewport = clone(session.workspace.readCoordinationState()?.viewport || null)
  const nextViewport = normalizeScatterViewportState(session, viewport)
  const changed = JSON.stringify(currentViewport) !== JSON.stringify(nextViewport)
  if (!changed) {
    return session.workspace.commitCoordinationOperationResult({ changed: false })
  }

  session.workspace.updateSharedCoordinationState((shared) => withViewportSubmodel(shared, nextViewport))
  return session.workspace.commitCoordinationOperationResult({ changed: true })
}

export function syncScatterViewport(caseId, viewport = null) {
  return syncScatterViewportResult(caseId, viewport).changed
}

export function syncWorkspacePrimarySelectionResult(caseId, selection = null) {
  const session = getRuntimeSession(caseId)
  if (!session?.workspace) {
    return buildSelectionOperationResult(caseId, { changed: false })
  }
  if (!selection) {
    return session.workspace.syncPrimarySelectionEntry(null)
  }

  const selectionEntry = buildWorkspaceSelectionEntry(session, selection)
  if (!selectionEntry) {
    return session.workspace.commitCoordinationOperationResult({ changed: false })
  }
  return session.workspace.syncPrimarySelectionEntry(selectionEntry, {
    makePrimary: true,
    updateByWidget: true,
    focusSourceWidget: true,
  })
}

export function syncWorkspacePrimarySelection(caseId, selection = null) {
  return syncWorkspacePrimarySelectionResult(caseId, selection).changed
}

export function clearWorkspaceSelection(caseId) {
  return syncWorkspacePrimarySelectionResult(caseId, null)
}

export function promotePrimarySelectionToGlobalFilters(caseId, state = {}) {
  const session = getRuntimeSession(caseId)
  if (!session?.workspace) {
    return { changed: false, nextFilterState: null, coordinationState: null }
  }
  const result = session.workspace.commitPrimarySelectionToGlobalFilters({
    baseGlobalFilters: session.workspace.buildGlobalFiltersFromControlState(
      buildFirstPartyControlState(state),
      {
        rangeDomains: buildFirstPartyRangeDomains(state),
      },
    ),
    rangeDomains: buildFirstPartyRangeDomains(state),
    clearSelection: true,
    focusSourceWidget: true,
  })
  if (!result?.changed) {
    return {
      ...result,
      changed: false,
      nextFilterState: null,
      coordinationState: result?.coordinationState || readWorkspaceCoordinationState(caseId),
    }
  }
  return {
    ...result,
    changed: true,
    nextFilterState: deriveFirstPartyInteractionFilterPatch(result.globalFilterPatch || {}),
  }
}

export function promotePrimarySelectionToHighlight(caseId) {
  const session = getRuntimeSession(caseId)
  if (!session?.workspace) {
    return { changed: false, coordinationState: null }
  }
  const result = session.workspace.commitPrimarySelectionToHighlight({
    clearSelection: true,
    focusSourceWidget: true,
  })
  if (!result?.changed) {
    return {
      ...result,
      changed: false,
      coordinationState: result?.coordinationState || readWorkspaceCoordinationState(caseId),
    }
  }
  return result
}

export function clearWorkspaceHighlight(caseId) {
  const session = getRuntimeSession(caseId)
  if (!session?.workspace) {
    return { changed: false, coordinationState: null }
  }
  const result = session.workspace.commitClearHighlightState()
  if (!result?.changed) {
    return {
      ...result,
      changed: false,
      coordinationState: result?.coordinationState || readWorkspaceCoordinationState(caseId),
    }
  }
  return result
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
  const session = getRuntimeSession(caseId)
  if (!session?.workspace || typeof name !== 'string' || name.length === 0) {
    throw new Error('executeWorkspaceAction requires an active workspace plus a valid action name.')
  }
  const widget = widgetId ? session.workspace.getWidget(widgetId) : null
  const widgetRef = widget?.resolveWidgetRef?.() || widget?.describe?.()?.ref || null
  const previousActiveWidgetId = session.activeWidgetId || null
  session.setActiveWidgetId?.(widgetId || previousActiveWidgetId)
  try {
    return await session.workspace.executeActionAndCommitCoordination({
      name,
      params,
      ...(widgetRef ? { queryScope: { widgetRef } } : {}),
    })
  } finally {
    session.setActiveWidgetId?.(previousActiveWidgetId)
  }
}

function detectBarCategoryField(spec = null) {
  const encoding = spec?.encoding || {}
  const xField = encoding?.x?.field || null
  const yField = encoding?.y?.field || null
  const xType = encoding?.x?.type || null
  const yType = encoding?.y?.type || null

  if ((xType === 'nominal' || xType === 'ordinal') && xField) return xField
  if ((yType === 'nominal' || yType === 'ordinal') && yField) return yField
  return xField || yField || null
}

function normalizeAgentWorkspaceActionParams(session, widgetId, actionName, params = {}) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return {}
  if (actionName !== 'bar.selectCategory') return params

  const widget = widgetId ? session?.workspace?.getWidget?.(widgetId) : null
  const widgetState = widget?.readState?.() || {}
  const currentSpec = widgetState.currentSpec || widgetState.rawSpec || null
  const explicitValues = Array.isArray(params.values) ? params.values.filter((value) => value != null) : []
  const aliasedValues = Array.isArray(params.categories) ? params.categories.filter((value) => value != null) : []
  const singletonValue = params.value != null ? [params.value] : []
  const values = explicitValues.length > 0 ? explicitValues : (aliasedValues.length > 0 ? aliasedValues : singletonValue)
  const field = typeof params.field === 'string' && params.field.trim().length > 0
    ? params.field
    : detectBarCategoryField(currentSpec)

  if (!field || values.length === 0) return params

  return {
    ...params,
    field,
    values: values.map((value) => String(value)),
  }
}

function resolveWorkspaceWidgetIdFromRef(caseId, widgetRef = null) {
  if (typeof widgetRef !== 'string' || widgetRef.length === 0) return null
  const description = describeWorkspace(caseId) || null
  const matchedWidget = Array.isArray(description?.widgets)
    ? description.widgets.find((widget) => widget?.ref === widgetRef || widget?.widgetId === widgetRef)
    : null
  return matchedWidget?.widgetId || null
}

export async function executeAgentWorkspaceAction(caseId, call = {}) {
  if (!call || typeof call !== 'object') {
    throw new Error('executeAgentWorkspaceAction requires a valid action call object.')
  }
  const widgetId = resolveWorkspaceWidgetIdFromRef(caseId, call?.queryScope?.widgetRef || null)
  const session = getRuntimeSession(caseId)
  const normalizedParams = normalizeAgentWorkspaceActionParams(session, widgetId, call.name, call.params || {})
  return executeWorkspaceAction(caseId, {
    widgetId,
    name: call.name,
    params: normalizedParams,
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

export async function describeAgentLoop(caseId, options = {}) {
  const session = getRuntimeSession(caseId)
  if (!session?.runtime) {
    throw new Error('describeAgentLoop requires an active runtime session.')
  }
  const describeLoop =
    session.runtime.describeAgentLoop
    || session.runtime.agentLoopRuntime?.describeStepContext?.bind(session.runtime.agentLoopRuntime)
  if (typeof describeLoop !== 'function') {
    throw new Error('describeAgentLoop is not available on the active runtime session.')
  }
  return clone(await describeLoop(options))
}

export async function describeActionUsage(caseId, options = {}) {
  const session = getRuntimeSession(caseId)
  if (!session?.runtime) {
    throw new Error('describeActionUsage requires an active runtime session.')
  }
  const describeUsage =
    session.runtime.describeActionUsage
    || session.runtime.actionExecutor?.describeActionUsage?.bind(session.runtime.actionExecutor)
  if (typeof describeUsage !== 'function') {
    throw new Error('describeActionUsage is not available on the active runtime session.')
  }
  return clone(await describeUsage(options))
}

function createCaseBoundRuntimeReaders(caseId) {
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
    describeAgentLoop: (options = {}) => describeAgentLoop(caseId, options),
    describeActionUsage: (options = {}) => describeActionUsage(caseId, options),
    queryPerception: (call = {}) => queryPerception(caseId, call),
    runDataQuery: (call = {}) => runDataQuery(caseId, call),
    executeVerifiedAction: (call = {}, options = {}) => executeVerifiedAction(caseId, call, options),
  }
}

export function createAgentRuntimeContract(caseId) {
  const readers = createCaseBoundRuntimeReaders(caseId)
  const baseClient = createWidgetWorkspaceTransportClient({
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
  })

  return {
    ...baseClient,
    ...readers,
  }
}

export function createFirstPartyRuntimeSessionFacade(caseId) {
  const readers = createCaseBoundRuntimeReaders(caseId)
  return {
    ...readers,
    readWorkspaceDescription: () => readRuntimeWorkspaceDescription(caseId),
    readPrimarySelection: () => readWorkspaceCoordinationState(caseId)?.selections?.views?.primary || null,
    readWidgetRuntimeState: (widgetId) => readWidgetRuntimeState(caseId, widgetId),
    readInteractionBindings: (options = {}) => readWorkspaceInteractionBindings(caseId, options),
    readStateHistory: (options = {}) => readWorkspaceStateHistory(caseId, options),
    readRuntimeTrace: () => readRuntimeTrace(caseId),
    appendTraceStep: (step = {}) => appendRuntimeTraceStep(caseId, step),
    readAgentMessages: () => readAgentMessages(caseId),
    appendAgentMessage: (message = {}) => appendAgentMessage(caseId, message),
    setFocusedWidgetId: (widgetId) => setFocusedWidgetId(caseId, widgetId),
    syncWorkspaceGlobalFilters: (state = {}) => syncWorkspaceGlobalFilters(caseId, state),
    syncScatterBrushSelection: (brush = null) => syncScatterBrushSelection(caseId, brush),
    syncScatterBrushSelectionResult: (brush = null) => syncScatterBrushSelectionResult(caseId, brush),
    syncScatterViewport: (viewport = null) => syncScatterViewport(caseId, viewport),
    syncWorkspacePrimarySelection: (selection = null) => syncWorkspacePrimarySelection(caseId, selection),
    syncWorkspacePrimarySelectionResult: (selection = null) => syncWorkspacePrimarySelectionResult(caseId, selection),
    clearWorkspaceSelection: () => clearWorkspaceSelection(caseId),
    clearWorkspaceHighlight: () => clearWorkspaceHighlight(caseId),
    promotePrimarySelectionToGlobalFilters: (state = {}) => promotePrimarySelectionToGlobalFilters(caseId, state),
    promotePrimarySelectionToHighlight: () => promotePrimarySelectionToHighlight(caseId),
    executeWorkspaceAction: (call = {}) => executeWorkspaceAction(caseId, call),
    jumpWorkspaceToState: (stateId) => jumpWorkspaceToState(caseId, stateId),
    agentContract: () => createAgentRuntimeContract(caseId),
  }
}

export function registerWorkspaceCaseOverride(caseId, caseDef) {
  const registered = registerWorkspaceCaseOverrideImpl(caseId, caseDef)
  if (!registered) return null
  disposeRuntimeSession(caseId)
  return registered
}

export function registerWorkspaceProviderEnvironment(caseId, providerEnvironment = 'mixed') {
  const registered = registerWorkspaceCaseProviderEnvironmentImpl(caseId, providerEnvironment)
  if (!registered) return null
  disposeRuntimeSession(caseId)
  return registered
}

export function createInitialSessionState(caseId) {
  const caseDef = getWorkspaceCaseImpl(caseId)
  const composition = buildWorkspaceComposition(caseDef)
  const runtimeSession = ensureRuntimeSession(caseDef.id)
  runtimeSession?.workspace?.resetEphemeralCoordinationState?.()
  const selectedWidgetId = runtimeSession?.workspace?.readFocusedWidgetId?.() || composition.selectedWidgetId

  const initialState = createInitialSessionStateFromCase(caseDef, {
    composition: {
      ...composition,
      widgets: cloneWorkspaceComposition(composition.widgets),
      links: cloneWorkspaceComposition(composition.links),
    },
    runtimeSession,
    selectedWidgetId,
    buildEvidenceEntry,
    clone,
  })
  syncWorkspaceGlobalFilters(caseDef.id, initialState)
  return initialState
}

export function buildAppSnapshot(state) {
  return buildAppSnapshotFromState(state, {
    createWorkspaceViewModel: createWorkspaceViewModelImpl,
    getRuntimeSession,
  })
}
