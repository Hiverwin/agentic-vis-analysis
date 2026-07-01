import { create } from 'zustand'
import { getModeById } from './modes.js'
import { buildEvidenceEntry } from './sessionModel.js'
import { buildAnalysisProvenanceSummary } from '../analysis/provenanceSummary.js'
import { deriveTraceBranchNarrative } from '../trace/traceBranchNarrative.js'
import { deriveTraceFocus } from '../trace/traceFocus.js'
import { buildTraceTimelineModel } from '../trace/traceViewModel.js'
import {
  buildAppSnapshot,
  createFirstPartyRuntimeSessionFacade,
  createInitialSessionState,
  disposeRuntimeSession,
  readLatestCoordinationResult,
  registerWorkspaceProviderEnvironment,
  registerWorkspaceCaseOverride,
} from '../runtime/runtimeBridge.js'
import { DEFAULT_OPENROUTER_VLM, formatAgentRuntimeError, runAgentTurn } from '../runtime/agentRuntime.js'
import {
  clampHorsepowerRange,
  clearAnalysisFilters,
  createWorkspaceViewModel,
  cycleAnalysisOrigin,
} from '../runtime/workspaceViewModel.js'
import { parseCarsCsv } from '../setup/dataImport.js'

const initialMode = getModeById('manual')
const DEFAULT_CASE_ID = 'cars-horsepower'
const DEFAULT_WORKSPACE_PROVIDER_ENVIRONMENT = 'vega-lite'
export { createWorkspaceViewModel as getWorkspaceViewModel }

registerWorkspaceProviderEnvironment(DEFAULT_CASE_ID, DEFAULT_WORKSPACE_PROVIDER_ENVIRONMENT)

function readRuntimeSessionFacade(caseId) {
  return createFirstPartyRuntimeSessionFacade(caseId)
}

function readRuntimeSessionKeyFromState(state) {
  return state?.runtimeSessionKey || state?.activeCaseId || DEFAULT_CASE_ID
}

function readRuntimeFacadeFromState(state) {
  return readRuntimeSessionFacade(readRuntimeSessionKeyFromState(state))
}

function makeTracePatch(caseId, step) {
  const runtime = readRuntimeSessionFacade(caseId)
  const appended = runtime.appendTraceStep(step)
  return appended
    ? {
        trace: runtime.readRuntimeTrace(),
        selectedTraceStepId: appended.id,
      }
    : {}
}

function makeMessagePatch(caseId, message) {
  const runtime = readRuntimeSessionFacade(caseId)
  const appended = runtime.appendAgentMessage(message)
  return appended
    ? {
        agentMessages: runtime.readAgentMessages(),
      }
    : {}
}

function buildWorkspaceInteractionStatePatch(state, sessionKey) {
  return readRuntimeSessionFacade(sessionKey).readInteractionBindings({
    dataset: state.dataset,
    fallbackSelectedWidgetId: state.selectedWidgetId,
  })
}

function deriveWidgetActionOverride(actionName, params = {}) {
  if (actionName === 'scatter.showRegression') {
    return {
      kind: 'scatterRegression',
      method: typeof params?.method === 'string' ? params.method : 'linear',
    }
  }
  if (actionName === 'scatter.identifyClusters') {
    return {
      kind: 'scatterClusters',
      nClusters: Number.isFinite(params?.nClusters) ? Number(params.nClusters) : 2,
    }
  }
  if (actionName === 'bar.highlightTopN') {
    return {
      kind: 'barHighlightTopN',
      n: Number.isFinite(params?.n) ? Number(params.n) : 2,
      order: params?.order === 'ascending' ? 'ascending' : 'descending',
    }
  }
  if (actionName === 'line.highlightTrend') {
    return {
      kind: 'lineTrendHighlight',
      trendType: typeof params?.trendType === 'string' ? params.trendType : 'regression',
    }
  }
  if (actionName === 'line.showMovingAverage') {
    return {
      kind: 'lineMovingAverage',
      windowSize: Number.isFinite(params?.windowSize) ? Number(params.windowSize) : 3,
    }
  }
  return null
}

function resolveWidgetIdFromAgentScope(sessionKey, widgetRef, fallbackWidgetId = null) {
  if (typeof widgetRef !== 'string' || widgetRef.length === 0) return fallbackWidgetId
  const runtime = readRuntimeSessionFacade(sessionKey)
  const description = runtime.describeWorkspace() || null
  const matchedWidget = Array.isArray(description?.widgets)
    ? description.widgets.find((widget) => widget?.ref === widgetRef || widget?.widgetId === widgetRef)
    : null
  return matchedWidget?.widgetId || fallbackWidgetId
}

function applyReplayInteractionState(current, sessionKey, {
  replayContext = null,
  preferredWidgetId = null,
} = {}) {
  const runtime = readRuntimeSessionFacade(sessionKey)
  let resolvedWidgetId = null
  const canFocusPreferredWidget = typeof preferredWidgetId === 'string'
    && preferredWidgetId.length > 0
    && preferredWidgetId !== 'workspace'
  if (canFocusPreferredWidget) {
    resolvedWidgetId = runtime.setFocusedWidgetId(preferredWidgetId) || null
  }

  const interactionPatch = buildWorkspaceInteractionStatePatch(current, sessionKey)
  const nextSelectedWidgetId = resolvedWidgetId || interactionPatch.selectedWidgetId || current.selectedWidgetId || null

  return {
    widgetActionOverrides: {},
    ...interactionPatch,
    selectedWidgetId: nextSelectedWidgetId,
    activeReplayContext: replayContext
      ? {
          ...replayContext,
          restoredWidgetId: nextSelectedWidgetId,
        }
      : null,
  }
}

function buildReplayContext({
  source = 'unknown',
  triggerId = null,
  selectedTraceStepId = null,
  stateId = null,
  sourceStateId = null,
  branchId = null,
  transitionType = null,
  summary = '',
  widgetId = null,
  widgetTitle = null,
  findingId = null,
  restoredWidgetId = null,
} = {}) {
  return {
    source,
    triggerId,
    selectedTraceStepId,
    stateId,
    sourceStateId,
    branchId,
    transitionType,
    summary,
    widgetId,
    widgetTitle,
    findingId,
    restoredWidgetId,
    replayedAt: Date.now(),
  }
}

function buildReplayContextFromTraceStep(step, {
  source = 'trace_step',
  triggerId = null,
  findingId = null,
} = {}) {
  if (!step || typeof step !== 'object') return null
  return buildReplayContext({
    source,
    triggerId: triggerId || step.id || null,
    selectedTraceStepId: step.id || null,
    stateId: step.resultStateId || null,
    sourceStateId: step.sourceStateId || null,
    branchId: step.branchId || null,
    transitionType: step.transitionType || null,
    summary: step.summary || step.label || '',
    widgetId: step.widgetId || null,
    widgetTitle: step.widgetTitle || step.widgetId || null,
    findingId,
  })
}

function buildReplayContextFromFinding(finding, stateId) {
  if (!finding || typeof finding !== 'object') return null
  return buildReplayContext({
    source: 'finding',
    triggerId: finding.id || null,
    selectedTraceStepId: finding.traceStepId || null,
    stateId: stateId || finding.stateId || null,
    sourceStateId: null,
    branchId: finding.branchId || null,
    transitionType: null,
    summary: finding.title || finding.note || 'Finding replay',
    widgetId: finding.widgetId || null,
    widgetTitle: finding.widgetId || 'Workspace',
    findingId: finding.id || null,
  })
}

function buildTraceNavigationTarget(stepId, kind = 'trace') {
  if (typeof stepId !== 'string' || stepId.length === 0) return null
  return {
    stepId,
    kind,
    timestamp: Date.now(),
  }
}

function predicateMatchesExpected(predicate, expected = {}) {
  if (!predicate || typeof predicate !== 'object') return false
  if (predicate.field !== expected.field || predicate.op !== expected.op) return false
  if (expected.op === 'between') {
    return Array.isArray(predicate.value)
      && Array.isArray(expected.value)
      && predicate.value.length === 2
      && expected.value.length === 2
      && Number(predicate.value[0]) === Number(expected.value[0])
      && Number(predicate.value[1]) === Number(expected.value[1])
  }
  if (expected.op === 'in') {
    return Array.isArray(predicate.value)
      && Array.isArray(expected.value)
      && predicate.value.length === expected.value.length
      && predicate.value.every((value, index) => value === expected.value[index])
  }
  return predicate.value === expected.value
}

function primarySelectionMatches(primarySelection, {
  sourceWidgetId,
  predicates = [],
} = {}) {
  if (!primarySelection || primarySelection.sourceWidgetId !== sourceWidgetId) return false
  if (!Array.isArray(primarySelection.predicates) || primarySelection.predicates.length !== predicates.length) return false
  return predicates.every((expected) => primarySelection.predicates.some((predicate) => predicateMatchesExpected(predicate, expected)))
}

function deriveNumericDomain(rows = [], field) {
  const values = rows
    .map((row) => Number(row?.[field]))
    .filter((value) => Number.isFinite(value))
  if (values.length === 0) return [0, 1]
  return [Math.min(...values), Math.max(...values)]
}

function clampViewportDomain(domain, baseDomain, minSpanRatio = 0.08) {
  if (!Array.isArray(domain) || domain.length !== 2 || !Array.isArray(baseDomain) || baseDomain.length !== 2) {
    return baseDomain
  }
  const [baseMin, baseMax] = baseDomain
  const baseSpan = Math.max(baseMax - baseMin, 1)
  const minSpan = Math.max(baseSpan * minSpanRatio, 1)
  let [nextMin, nextMax] = domain
  if (!Number.isFinite(nextMin) || !Number.isFinite(nextMax)) return baseDomain
  if (nextMin > nextMax) [nextMin, nextMax] = [nextMax, nextMin]
  if ((nextMax - nextMin) < minSpan) {
    const center = (nextMin + nextMax) / 2
    nextMin = center - (minSpan / 2)
    nextMax = center + (minSpan / 2)
  }
  if (nextMin < baseMin) {
    nextMax += baseMin - nextMin
    nextMin = baseMin
  }
  if (nextMax > baseMax) {
    nextMin -= nextMax - baseMax
    nextMax = baseMax
  }
  nextMin = Math.max(baseMin, nextMin)
  nextMax = Math.min(baseMax, nextMax)
  if ((nextMax - nextMin) < minSpan) {
    return baseDomain
  }
  return [Number(nextMin.toFixed(3)), Number(nextMax.toFixed(3))]
}

function buildZoomedDomain(domain, ratio, factor, baseDomain) {
  const [min, max] = domain
  const span = max - min
  const nextSpan = span * factor
  const anchor = min + (span * ratio)
  const nextMin = anchor - (nextSpan * ratio)
  const nextMax = nextMin + nextSpan
  return clampViewportDomain([nextMin, nextMax], baseDomain)
}

export const useAppStore = create((set, get) => ({
  mode: initialMode.id,
  analysisTab: initialMode.defaultAnalysisTab,
  traceTab: initialMode.defaultTraceTab,
  traceOpen: initialMode.traceOpen,
  coordinationVersion: 0,
  analyticalVersion: 0,
  workspaceProviderEnvironment: DEFAULT_WORKSPACE_PROVIDER_ENVIRONMENT,
  activeReplayContext: null,
  traceNavigationTarget: null,
  rendererFamily: 'auto',
  dataUploadError: null,
  dataUploadName: '',
  agentStatus: 'idle',
  agentError: null,
  agentModel: DEFAULT_OPENROUTER_VLM,
  agentObjective: 'Analyse the horsepower patterns in the USA.',
  agentLastStep: null,
  ...createInitialSessionState(DEFAULT_CASE_ID),

  setMode: (modeId) =>
    set(() => {
      const mode = getModeById(modeId)
      return {
        mode: mode.id,
        analysisTab: mode.defaultAnalysisTab,
        traceTab: mode.defaultTraceTab,
        traceOpen: mode.traceOpen,
      }
    }),
  setAnalysisTab: (tab) => set({ analysisTab: tab }),
  setRendererFamily: (rendererFamily) => set({ rendererFamily }),
  setWorkspaceProviderEnvironment: (providerEnvironment) => set((state) => {
    const registered = registerWorkspaceProviderEnvironment(state.activeCaseId, providerEnvironment)
    if (!registered) return state
    return {
      coordinationVersion: 0,
      analyticalVersion: 0,
      dataUploadError: state.dataUploadError,
      dataUploadName: state.dataUploadName,
      workspaceProviderEnvironment: registered.workspaceProviderEnvironment || providerEnvironment || 'mixed',
      ...createInitialSessionState(state.activeCaseId),
      rendererFamily: state.rendererFamily,
      mode: state.mode,
      analysisTab: state.analysisTab,
      traceTab: state.traceTab,
      traceOpen: state.traceOpen,
      agentStatus: state.agentStatus,
      agentError: state.agentError,
      agentModel: state.agentModel,
      agentObjective: state.agentObjective,
    }
  }),
  setTraceTab: (tab) => set({ traceTab: tab }),
  toggleTraceOpen: () => set((state) => ({ traceOpen: !state.traceOpen })),
  setSelectedTraceStepId: (stepId) => set({ selectedTraceStepId: stepId }),
  toggleTraceSegmentCollapsed: (segmentId) => set((state) => {
    if (typeof segmentId !== 'string' || segmentId.length === 0) return state
    const current = Array.isArray(state.collapsedTraceSegmentIds) ? state.collapsedTraceSegmentIds : []
    return {
      collapsedTraceSegmentIds: current.includes(segmentId)
        ? current.filter((id) => id !== segmentId)
        : [...current, segmentId],
    }
  }),
  clearCollapsedTraceSegments: () => set({ collapsedTraceSegmentIds: [] }),
  setTraceNavigationTarget: (target) => set({ traceNavigationTarget: target || null }),
  clearTraceNavigationTarget: () => set({ traceNavigationTarget: null }),
  selectTraceStep: async (stepId) => {
    const state = get()
    const trace = Array.isArray(state.trace) ? state.trace : []
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const targetStep = trace.find((step) => step?.id === stepId) || null
    if (!targetStep) {
      set({ selectedTraceStepId: stepId || null, activeReplayContext: null, traceNavigationTarget: null })
      return null
    }

    const replayContext = buildReplayContextFromTraceStep(targetStep, {
      source: 'trace_step',
      triggerId: targetStep.id,
    })
    const runtime = readRuntimeSessionFacade(sessionKey)

    const targetStateId = typeof targetStep.resultStateId === 'string' && targetStep.resultStateId.length > 0
      ? targetStep.resultStateId
      : null
    const currentStateId = runtime.readCoordinationState()?.stateId || null

    if (!targetStateId || targetStateId === currentStateId) {
      set((current) => ({
        selectedTraceStepId: targetStep.id,
        traceNavigationTarget: current.traceNavigationTarget,
        ...applyReplayInteractionState(current, sessionKey, {
          replayContext,
          preferredWidgetId: targetStep.widgetId || null,
        }),
      }))
      return { step: targetStep, replayed: false, stateId: targetStateId, replayContext }
    }

    const result = await runtime.jumpWorkspaceToState(targetStateId)
    set((current) => ({
      selectedTraceStepId: targetStep.id,
      traceNavigationTarget: current.traceNavigationTarget,
      coordinationVersion: current.coordinationVersion + 1,
      analyticalVersion: current.analyticalVersion + 1,
      ...applyReplayInteractionState(current, sessionKey, {
        replayContext,
        preferredWidgetId: targetStep.widgetId || null,
      }),
    }))
    return { step: targetStep, replayed: true, stateId: targetStateId, result, replayContext }
  },
  toggleTraceFilter: (filterId) => set((state) => {
    const current = Array.isArray(state.traceFilters) && state.traceFilters.length > 0 ? state.traceFilters : ['all']
    if (filterId === 'all') return { traceFilters: ['all'] }
    const withoutAll = current.filter((item) => item !== 'all')
    const next = withoutAll.includes(filterId)
      ? withoutAll.filter((item) => item !== filterId)
      : [...withoutAll, filterId]
    return { traceFilters: next.length > 0 ? next : ['all'] }
  }),
  setTraceDensity: (traceDensity) => set({ traceDensity }),
  setAgentObjective: (agentObjective) => set({ agentObjective }),
  getActiveAgentRuntimeContract: () => {
    const state = get()
    return readRuntimeFacadeFromState(state).agentContract()
  },
  setSelectedWidgetId: (widgetId) => set((state) => (
    (() => {
      const sessionKey = readRuntimeSessionKeyFromState(state)
      const runtime = readRuntimeSessionFacade(sessionKey)
      const nextWidgetId = runtime.setFocusedWidgetId(widgetId) || widgetId
      return state.selectedWidgetId === nextWidgetId
        ? state
        : (() => {
            const nextState = {
              ...state,
              selectedWidgetId: nextWidgetId,
            }
            return {
              selectedWidgetId: nextWidgetId,
              ...makeTracePatch(sessionKey, {
              actor: 'human',
              kind: 'action',
              widgetId: nextWidgetId,
              widgetTitle: nextWidgetId,
              methodName: 'workspace.focusWidget',
              summary: `Focused ${nextWidgetId}`,
              detail: `The analyst promoted ${nextWidgetId} as the active widget.`,
              stateDelta: { focus: true },
              }),
            }
          })()
    })()
  )),
  importDatasetFromCsv: async (file) => {
    if (!(file instanceof File)) {
      set({ dataUploadError: 'Select a CSV file first.' })
      return
    }
    try {
      const text = await file.text()
      const parsed = parseCarsCsv(text)
      const state = get()
      registerWorkspaceCaseOverride(state.activeCaseId, {
        id: state.activeCaseId,
        title: file.name.replace(/\.csv$/i, '') || state.caseTitle,
        summary: 'Uploaded dataset driving the same six-widget host VA.',
        topology: state.topology,
        workspaceProviderEnvironment: state.workspaceProviderEnvironment || DEFAULT_WORKSPACE_PROVIDER_ENVIRONMENT,
        dataset: parsed.dataset,
        widgets: state.widgets,
        findings: state.findings,
        trace: state.trace,
        agentChat: state.agentMessages,
        replaySteps: state.replaySteps,
        branches: state.branches,
        log: state.log,
      })
      set({
        coordinationVersion: 0,
        analyticalVersion: 0,
        dataUploadError: null,
        dataUploadName: file.name,
        workspaceProviderEnvironment: state.workspaceProviderEnvironment || DEFAULT_WORKSPACE_PROVIDER_ENVIRONMENT,
        ...createInitialSessionState(state.activeCaseId),
        rendererFamily: state.rendererFamily,
        mode: state.mode,
        analysisTab: state.analysisTab,
        traceOpen: state.traceOpen,
      })
    } catch (error) {
      set({ dataUploadError: formatAgentRuntimeError(error) })
    }
  },
  setActiveCase: (caseId) => set((state) => {
    disposeRuntimeSession(readRuntimeSessionKeyFromState(state))
    return {
      coordinationVersion: 0,
      analyticalVersion: 0,
      agentStatus: 'idle',
      agentError: null,
      agentObjective: 'Analyse the horsepower patterns in the USA.',
      workspaceProviderEnvironment: DEFAULT_WORKSPACE_PROVIDER_ENVIRONMENT,
      ...(() => {
        registerWorkspaceProviderEnvironment(caseId, DEFAULT_WORKSPACE_PROVIDER_ENVIRONMENT)
        return createInitialSessionState(caseId)
      })(),
    }
  }),
  setTopology: (topology) => set((state) => (
    state.topology === topology
      ? state
      : { topology }
  )),
  setAnalysisOrigin: (origin) => set((state) => {
    if (state.analysisOrigin === origin) return state
    const nextState = { ...state, analysisOrigin: origin }
    readRuntimeFacadeFromState(state).syncWorkspaceGlobalFilters(nextState)
    return { analysisOrigin: origin }
  }),
  toggleAnalysisOrigin: (origin) =>
    set((state) => {
      const analysisOrigin = state.analysisOrigin === origin ? 'All' : origin
      const nextState = { ...state, analysisOrigin }
      readRuntimeFacadeFromState(state).syncWorkspaceGlobalFilters(nextState)
      return { analysisOrigin }
    }),
  setAnalysisYear: (year) => set((state) => {
    if (state.analysisYear === year) return state
    const nextState = { ...state, analysisYear: year }
    readRuntimeFacadeFromState(state).syncWorkspaceGlobalFilters(nextState)
    return { analysisYear: year }
  }),
  toggleAnalysisYear: (year) =>
    set((state) => {
      const analysisYear = state.analysisYear === year ? 'All' : year
      const nextState = { ...state, analysisYear }
      readRuntimeFacadeFromState(state).syncWorkspaceGlobalFilters(nextState)
      return { analysisYear }
    }),
  toggleCylinder: (cylinder) =>
    set((state) => {
      const analysisCylinders = state.analysisCylinders.includes(cylinder)
        ? state.analysisCylinders.filter((value) => value !== cylinder)
        : [...state.analysisCylinders, cylinder].sort((a, b) => a - b)
      const nextState = { ...state, analysisCylinders }
      readRuntimeFacadeFromState(state).syncWorkspaceGlobalFilters(nextState)
      return { analysisCylinders }
    }),
  setHorsepowerMin: (value) =>
    set((state) => {
      const [nextMin, nextMax] = clampHorsepowerRange(Number(value), state.horsepowerMax, state.dataset.horsepowerDomain)
      if (state.horsepowerMin === nextMin && state.horsepowerMax === nextMax) return state
      readRuntimeFacadeFromState(state).syncWorkspaceGlobalFilters({
        ...state,
        horsepowerMin: nextMin,
        horsepowerMax: nextMax,
      })
      return { horsepowerMin: nextMin, horsepowerMax: nextMax }
    }),
  setHorsepowerMax: (value) =>
    set((state) => {
      const [nextMin, nextMax] = clampHorsepowerRange(state.horsepowerMin, Number(value), state.dataset.horsepowerDomain)
      if (state.horsepowerMin === nextMin && state.horsepowerMax === nextMax) return state
      readRuntimeFacadeFromState(state).syncWorkspaceGlobalFilters({
        ...state,
        horsepowerMin: nextMin,
        horsepowerMax: nextMax,
      })
      return { horsepowerMin: nextMin, horsepowerMax: nextMax }
    }),
  setHorsepowerRange: (minValue, maxValue) =>
    set((state) => {
      const [nextMin, nextMax] = clampHorsepowerRange(Number(minValue), Number(maxValue), state.dataset.horsepowerDomain)
      if (state.horsepowerMin === nextMin && state.horsepowerMax === nextMax) return state
      readRuntimeFacadeFromState(state).syncWorkspaceGlobalFilters({
        ...state,
        horsepowerMin: nextMin,
        horsepowerMax: nextMax,
      })
      return { horsepowerMin: nextMin, horsepowerMax: nextMax }
    }),
  setFocusedCarId: (carId) => set((state) => (
    state.focusedCarId === carId
      ? state
      : { focusedCarId: carId }
  )),
  zoomScatterViewport: ({ deltaY = 0, anchorX = 0.5, anchorY = 0.5 } = {}) => set((state) => {
    const rows = state.dataset?.rowsData || []
    const baseXDomain = state.dataset?.horsepowerDomain || deriveNumericDomain(rows, 'horsepower')
    const baseYDomain = deriveNumericDomain(rows, 'mpg')
    const currentViewport = state.scatterViewport || {}
    const currentXDomain = Array.isArray(currentViewport.xDomain)
      ? currentViewport.xDomain
      : [state.horsepowerMin, state.horsepowerMax]
    const currentYDomain = Array.isArray(currentViewport.yDomain)
      ? currentViewport.yDomain
      : baseYDomain
    const zoomFactor = deltaY < 0 ? 0.84 : 1.19
    const nextXDomain = buildZoomedDomain(currentXDomain, Math.min(Math.max(anchorX, 0), 1), zoomFactor, baseXDomain)
    const nextYDomain = buildZoomedDomain(currentYDomain, 1 - Math.min(Math.max(anchorY, 0), 1), zoomFactor, baseYDomain)
    const sessionKey = readRuntimeSessionKeyFromState(state)
    readRuntimeSessionFacade(sessionKey).syncScatterViewport({
      xDomain: nextXDomain,
      yDomain: nextYDomain,
    })
    return {
      scatterViewport: {
        xDomain: nextXDomain,
        yDomain: nextYDomain,
      },
      coordinationVersion: state.coordinationVersion + 1,
      analyticalVersion: state.analyticalVersion + 1,
      ...makeTracePatch(sessionKey, {
        actor: 'human',
        kind: 'action',
        widgetId: 'w_scatter_cars',
        widgetTitle: 'Horsepower vs MPG',
        methodName: 'scatter.zoomViewport',
        summary: 'Adjusted scatter viewport',
        detail: 'The analyst adjusted the scatter viewport through direct chart zoom interaction.',
        stateDelta: { viewport: true },
      }),
    }
  }),
  resetScatterViewport: () => set((state) => {
    const sessionKey = readRuntimeSessionKeyFromState(state)
    readRuntimeSessionFacade(sessionKey).syncScatterViewport(null)
    return {
      scatterViewport: null,
      coordinationVersion: state.coordinationVersion + 1,
      analyticalVersion: state.analyticalVersion + 1,
      ...makeTracePatch(sessionKey, {
        actor: 'human',
        kind: 'action',
        widgetId: 'w_scatter_cars',
        widgetTitle: 'Horsepower vs MPG',
        methodName: 'scatter.resetViewport',
        summary: 'Reset scatter viewport',
        detail: 'The analyst reset the scatter viewport to the base domain.',
        stateDelta: { viewport: true },
      }),
    }
  }),
  selectOrigin: (origin) => set((state) => {
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const primarySelection = runtime.readPrimarySelection()
    const sameSelection = primarySelectionMatches(primarySelection, {
      sourceWidgetId: 'w_bar_origin',
      predicates: [{ field: 'origin', op: 'in', value: [origin] }],
    })
    queueMicrotask(async () => {
      const result = sameSelection
        ? runtime.clearWorkspaceSelection()
        : await runtime.executeWorkspaceAction({
            widgetId: 'w_bar_origin',
            name: 'bar.selectCategory',
            params: {
              field: 'origin',
              values: [origin],
            },
          })
      const coordinationResult = readLatestCoordinationResult(sessionKey)
      set((current) => ({
        coordinationVersion: current.coordinationVersion + 1,
        ...makeTracePatch(sessionKey, {
          actor: 'human',
          kind: 'action',
          widgetId: 'w_bar_origin',
          widgetTitle: 'Average Horsepower by Origin',
          methodName: 'bar.selectCategory',
          summary: sameSelection ? 'Cleared origin selection' : `Selected origin: ${origin}`,
          detail: sameSelection ? 'The analyst cleared the origin selection.' : `The analyst selected ${origin} in the origin summary chart through the canonical widget action path.`,
          verificationSummary: coordinationResult?.verification?.summary || result?.verification?.summary || null,
          stateDelta: { selection: true, propagation: true },
        }),
      }))
    })
    return state
  }),
  selectYear: (year) => set((state) => {
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const primarySelection = runtime.readPrimarySelection()
    const sameSelection = primarySelectionMatches(primarySelection, {
      sourceWidgetId: 'w_line_year',
      predicates: [{ field: 'year', op: 'in', value: [year] }],
    })
    queueMicrotask(async () => {
      const result = sameSelection
        ? runtime.clearWorkspaceSelection()
        : await runtime.executeWorkspaceAction({
            widgetId: 'w_line_year',
            name: 'line.selectXValue',
            params: {
              field: 'year',
              value: year,
            },
          })
      const coordinationResult = readLatestCoordinationResult(sessionKey)
      set((current) => ({
        coordinationVersion: current.coordinationVersion + 1,
        ...makeTracePatch(sessionKey, {
          actor: 'human',
          kind: 'action',
          widgetId: 'w_line_year',
          widgetTitle: 'MPG Trend by Model Year',
          methodName: 'line.selectXValue',
          summary: sameSelection ? 'Cleared year selection' : `Selected year: ${year}`,
          detail: sameSelection ? 'The analyst cleared the year selection.' : `The analyst selected model year ${year} through the canonical widget action path.`,
          verificationSummary: coordinationResult?.verification?.summary || result?.verification?.summary || null,
          stateDelta: { selection: true, propagation: true },
        }),
      }))
    })
    return state
  }),
  selectHeatmapCell: ({ origin, cylinders }) => set((state) => {
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const primarySelection = runtime.readPrimarySelection()
    const sameCell = primarySelectionMatches(primarySelection, {
      sourceWidgetId: 'w_heatmap_origin_cyl',
      predicates: [
        { field: 'cylinders', op: 'in', value: [cylinders] },
        { field: 'origin', op: 'in', value: [origin] },
      ],
    })
    queueMicrotask(async () => {
      const result = sameCell
        ? runtime.clearWorkspaceSelection()
        : await runtime.executeWorkspaceAction({
            widgetId: 'w_heatmap_origin_cyl',
            name: 'heatmap.selectSubmatrix',
            params: {
              xValues: [cylinders],
              yValues: [origin],
            },
          })
      const coordinationResult = readLatestCoordinationResult(sessionKey)
      set((current) => ({
        coordinationVersion: current.coordinationVersion + 1,
        ...makeTracePatch(sessionKey, {
          actor: 'human',
          kind: 'action',
          widgetId: 'w_heatmap_origin_cyl',
          widgetTitle: 'Origin x Cylinders',
          methodName: 'heatmap.selectSubmatrix',
          summary: sameCell ? 'Cleared heatmap cell selection' : `Selected ${origin} · ${cylinders} cyl`,
          detail: sameCell ? 'The analyst cleared the current origin-cylinder cell focus.' : `The analyst drilled into ${origin} and ${cylinders} cylinders through the canonical widget action path.`,
          verificationSummary: coordinationResult?.verification?.summary || result?.verification?.summary || null,
          stateDelta: { selection: true, focus: true, propagation: true },
        }),
      }))
    })
    return state
  }),
  selectSankeyNode: (node) => set((state) => {
    if (!node?.kind) return state
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const primarySelection = runtime.readPrimarySelection()
    if (node.kind === 'aggregate') {
      const aggregateName = node.aggregateName || node.id || node.value
      const sameSelection = primarySelection?.sourceWidgetId === 'w_sankey_cars'
        && primarySelection?.aggregateName === aggregateName
      queueMicrotask(async () => {
        const result = sameSelection
          ? runtime.clearWorkspaceSelection()
          : await runtime.executeWorkspaceAction({
              widgetId: 'w_sankey_cars',
              name: 'sankey.selectAggregateNode',
              params: {
                aggregateName,
              },
            })
        const coordinationResult = readLatestCoordinationResult(sessionKey)
        set((current) => ({
          coordinationVersion: current.coordinationVersion + 1,
          ...makeTracePatch(sessionKey, {
            actor: 'human',
            kind: 'action',
            widgetId: 'w_sankey_cars',
            widgetTitle: 'Origin to Cylinders to Year',
            methodName: 'sankey.selectAggregateNode',
            summary: sameSelection ? 'Cleared sankey aggregate node' : `Selected sankey aggregate: ${node.label || aggregateName}`,
            detail: sameSelection ? `The analyst cleared the sankey aggregate node ${node.label || aggregateName}.` : `The analyst selected the sankey aggregate node ${node.label || aggregateName} through the canonical widget action path.`,
            verificationSummary: coordinationResult?.verification?.summary || result?.verification?.summary || null,
            stateDelta: { selection: true, focus: true, propagation: true },
          }),
        }))
      })
      return state
    }
    if (node.kind === 'origin') {
      const sameSelection = primarySelectionMatches(primarySelection, {
        sourceWidgetId: 'w_sankey_cars',
        predicates: [{ field: 'origin', op: 'in', value: [node.value] }],
      })
      queueMicrotask(async () => {
        const result = sameSelection
          ? runtime.clearWorkspaceSelection()
          : await runtime.executeWorkspaceAction({
              widgetId: 'w_sankey_cars',
              name: 'sankey.focusFlow',
              params: {
                field: 'origin',
                values: [node.value],
              },
            })
        const coordinationResult = readLatestCoordinationResult(sessionKey)
        set((current) => ({
          coordinationVersion: current.coordinationVersion + 1,
          ...makeTracePatch(sessionKey, {
            actor: 'human',
            kind: 'action',
            widgetId: 'w_sankey_cars',
            widgetTitle: 'Origin to Cylinders to Year',
            methodName: 'sankey.focusFlow',
            summary: sameSelection ? 'Cleared sankey origin node' : `Selected sankey origin: ${node.value}`,
            detail: sameSelection ? `The analyst cleared the sankey origin node ${node.value}.` : `The analyst selected the sankey origin node ${node.value} through the canonical widget action path.`,
            verificationSummary: coordinationResult?.verification?.summary || result?.verification?.summary || null,
            stateDelta: { selection: true, propagation: true },
          }),
        }))
      })
      return state
    }
    if (node.kind === 'year') {
      const numericYear = Number(node.value)
      const sameSelection = primarySelectionMatches(primarySelection, {
        sourceWidgetId: 'w_sankey_cars',
        predicates: [{ field: 'year', op: 'in', value: [numericYear] }],
      })
      queueMicrotask(async () => {
        const result = sameSelection
          ? runtime.clearWorkspaceSelection()
          : await runtime.executeWorkspaceAction({
              widgetId: 'w_sankey_cars',
              name: 'sankey.focusFlow',
              params: {
                field: 'year',
                values: [numericYear],
              },
            })
        const coordinationResult = readLatestCoordinationResult(sessionKey)
        set((current) => ({
          coordinationVersion: current.coordinationVersion + 1,
          ...makeTracePatch(sessionKey, {
            actor: 'human',
            kind: 'action',
            widgetId: 'w_sankey_cars',
            widgetTitle: 'Origin to Cylinders to Year',
            methodName: 'sankey.focusFlow',
            summary: sameSelection ? 'Cleared sankey year node' : `Selected sankey year: ${numericYear}`,
            detail: sameSelection ? `The analyst cleared the sankey year node ${numericYear}.` : `The analyst selected the sankey year node ${numericYear} through the canonical widget action path.`,
            verificationSummary: coordinationResult?.verification?.summary || result?.verification?.summary || null,
            stateDelta: { selection: true, propagation: true },
          }),
        }))
      })
      return state
    }
    if (node.kind === 'cylinders') {
      const numericCylinders = Number(node.value)
      const sameSelection = primarySelectionMatches(primarySelection, {
        sourceWidgetId: 'w_sankey_cars',
        predicates: [{ field: 'cylinders', op: 'in', value: [numericCylinders] }],
      })
      queueMicrotask(async () => {
        const result = sameSelection
          ? runtime.clearWorkspaceSelection()
          : await runtime.executeWorkspaceAction({
              widgetId: 'w_sankey_cars',
              name: 'sankey.focusFlow',
              params: {
                field: 'cylinders',
                values: [numericCylinders],
              },
            })
        const coordinationResult = readLatestCoordinationResult(sessionKey)
        set((current) => ({
          coordinationVersion: current.coordinationVersion + 1,
          ...makeTracePatch(sessionKey, {
            actor: 'human',
            kind: 'action',
            widgetId: 'w_sankey_cars',
            widgetTitle: 'Origin to Cylinders to Year',
            methodName: 'sankey.focusFlow',
            summary: sameSelection ? 'Cleared sankey cylinders node' : `Selected sankey cylinders: ${numericCylinders}`,
            detail: sameSelection ? `The analyst cleared the sankey cylinders node ${numericCylinders}.` : `The analyst selected the sankey cylinders node ${numericCylinders} through the canonical widget action path.`,
            verificationSummary: coordinationResult?.verification?.summary || result?.verification?.summary || null,
            stateDelta: { selection: true, propagation: true },
          }),
        }))
      })
      return state
    }
    return state
  }),
  selectParallelCar: (row) => set((state) => {
    if (!row?.id) return state
    const sameCar = state.focusedCarId === row.id
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    queueMicrotask(async () => {
      const result = sameCar
        ? runtime.clearWorkspaceSelection()
        : await runtime.executeWorkspaceAction({
            widgetId: 'w_parallel_cars',
            name: 'parallelCoordinates.selectRecord',
            params: {
              field: 'id',
                recordId: row.id,
              },
            })
      const coordinationResult = readLatestCoordinationResult(sessionKey)
      const interactionBindings = runtime.readInteractionBindings({
        dataset: state.dataset,
        fallbackSelectedWidgetId: state.selectedWidgetId,
      })
      set((current) => ({
        ...interactionBindings,
        coordinationVersion: current.coordinationVersion + 1,
        ...makeTracePatch(sessionKey, {
          actor: 'human',
          kind: 'action',
          widgetId: 'w_parallel_cars',
          widgetTitle: 'Parallel Coordinates',
          methodName: 'parallelCoordinates.selectRecord',
          summary: sameCar ? 'Cleared focused car' : `Focused ${row.name || row.id}`,
          detail: sameCar ? 'The analyst cleared the focused car line.' : `The analyst focused ${row.name || row.id} through the canonical widget action path.`,
          verificationSummary: coordinationResult?.verification?.summary || result?.verification?.summary || null,
          stateDelta: { selection: true, focus: true, propagation: true },
        }),
      }))
    })
    return state
  }),
  syncScatterBrushSelection: (brush) => set((state) => {
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const normalizedBrush = brush && typeof brush === 'object'
      ? {
          horsepower: Array.isArray(brush.horsepower) ? brush.horsepower : Array.isArray(brush.x) ? brush.x : null,
          mpg: Array.isArray(brush.mpg) ? brush.mpg : Array.isArray(brush.y) ? brush.y : null,
        }
      : null
    const primarySelection = runtime.readPrimarySelection()
    const sameBrush = normalizedBrush
      && primarySelectionMatches(primarySelection, {
        sourceWidgetId: 'w_scatter_cars',
        predicates: [
          { field: 'horsepower', op: 'between', value: normalizedBrush.horsepower || [] },
          { field: 'mpg', op: 'between', value: normalizedBrush.mpg || [] },
        ],
    })
    queueMicrotask(async () => {
      const result = !normalizedBrush || sameBrush
        ? runtime.clearWorkspaceSelection()
        : await runtime.executeWorkspaceAction({
            widgetId: 'w_scatter_cars',
            name: 'scatter.brushRegion',
            params: {
              xField: 'horsepower',
              yField: 'mpg',
              xRange: normalizedBrush.horsepower,
              yRange: normalizedBrush.mpg,
            },
          })
      const coordinationResult = readLatestCoordinationResult(sessionKey)
      set((current) => ({
        coordinationVersion: current.coordinationVersion + 1,
        ...makeTracePatch(sessionKey, {
          actor: 'human',
          kind: 'action',
          widgetId: 'w_scatter_cars',
          widgetTitle: 'Horsepower vs MPG',
          methodName: 'scatter.brushRegion',
          summary: normalizedBrush && !sameBrush ? 'Brushed scatter region' : 'Cleared scatter brush',
          detail: normalizedBrush && !sameBrush
            ? 'The analyst updated the scatter brush through the canonical widget action path.'
            : 'The analyst cleared the active scatter brush.',
          verificationSummary: coordinationResult?.verification?.summary || result?.verification?.summary || null,
          stateDelta: { selection: true, viewport: true, propagation: true },
        }),
      }))
    })
    return state
  }),
  setWidgetActionOverride: (widgetId, override = null) => set((state) => {
    if (!widgetId) return state
    const nextOverrides = { ...(state.widgetActionOverrides || {}) }
    if (override == null) {
      delete nextOverrides[widgetId]
    } else {
      nextOverrides[widgetId] = override
    }
    return {
      widgetActionOverrides: nextOverrides,
      analyticalVersion: state.analyticalVersion + 1,
    }
  }),
  clearSelection: () => set((state) => {
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const result = runtime.clearWorkspaceSelection()
    return result.changed
      ? {
          focusedCarId: null,
          coordinationVersion: state.coordinationVersion + 1,
          ...makeTracePatch(sessionKey, {
            actor: 'human',
            kind: 'action',
            widgetId: 'workspace',
            widgetTitle: 'Workspace',
            methodName: 'workspace.clearSelection',
            summary: 'Cleared shared selection',
            detail: 'The analyst cleared the active shared selection without resetting global filters.',
            verificationSummary: result?.verification?.summary || null,
            stateDelta: { selection: true, propagation: true },
          }),
        }
      : state
  }),
  promoteSelectionToHighlight: () => set((state) => {
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const result = runtime.promotePrimarySelectionToHighlight()
    return result.changed
      ? {
          coordinationVersion: state.coordinationVersion + 1,
          ...makeTracePatch(sessionKey, {
            actor: 'human',
            kind: 'action',
            widgetId: 'workspace',
            widgetTitle: 'Workspace',
            methodName: 'workspace.promoteSelectionToHighlight',
            summary: 'Promoted selection to highlight',
            detail: 'The analyst preserved the current subset as a shared highlight while restoring full context.',
            stateDelta: { highlight: true, selection: true, propagation: true },
          }),
        }
      : state
  }),
  promoteSelectionToFilter: () => set((state) => {
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const result = runtime.promotePrimarySelectionToGlobalFilters(state)
    return result.changed
      ? {
          ...result.nextFilterState,
          focusedCarId: null,
          coordinationVersion: state.coordinationVersion + 1,
          ...makeTracePatch(sessionKey, {
            actor: 'human',
            kind: 'action',
            widgetId: 'workspace',
            widgetTitle: 'Workspace',
            methodName: 'workspace.promoteSelectionToFilter',
            summary: 'Committed selection as filter',
            detail: 'The analyst converted the current shared selection into persistent workspace filters and cleared the transient selection.',
            verificationSummary: result?.verification?.summary || null,
            stateDelta: { selection: true, propagation: true, focus: true },
          }),
        }
      : state
  }),
  clearHighlight: () => set((state) => {
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const result = runtime.clearWorkspaceHighlight()
    return result.changed
      ? {
          coordinationVersion: state.coordinationVersion + 1,
          ...makeTracePatch(sessionKey, {
            actor: 'human',
            kind: 'action',
            widgetId: 'workspace',
            widgetTitle: 'Workspace',
            methodName: 'workspace.clearHighlight',
            summary: 'Cleared shared highlight',
            detail: 'The analyst removed the shared highlight layer while keeping current filters and focus intact.',
            stateDelta: { highlight: true },
          }),
        }
      : state
  }),
  clearFilters: () => set((state) => {
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const nextPartial = clearAnalysisFilters(state)
    runtime.syncWorkspaceGlobalFilters({
      ...state,
      ...nextPartial,
    })
    const nextState = {
      ...state,
      ...nextPartial,
    }
    return {
      ...nextPartial,
      ...makeTracePatch(sessionKey, {
        actor: 'human',
        kind: 'action',
        widgetId: 'workspace',
        widgetTitle: 'Workspace',
        methodName: 'workspace.clearFilters',
        summary: 'Cleared active filters',
        detail: 'The analyst reset all active workspace filters and brush constraints.',
        stateDelta: { selection: true, focus: true, viewport: true, propagation: true },
      }),
    }
  }),
  runWidgetAnalyticalAction: async ({ widgetId, actionName, params = {}, summary, detail, override = null }) => {
    const state = get()
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const result = await runtime.executeWorkspaceAction({
      widgetId,
      name: actionName,
      params,
    })
    if (override !== undefined) {
      get().setWidgetActionOverride(widgetId, override)
    }
    set((current) => ({
      analyticalVersion: current.analyticalVersion + 1,
      ...makeTracePatch(sessionKey, {
        actor: 'human',
        kind: 'action',
        widgetId,
        widgetTitle: widgetId,
        methodName: actionName,
        summary: summary || actionName,
        detail: detail || `Executed ${actionName} through the shared workspace runtime.`,
        verificationSummary: Array.isArray(result?.verificationHints) ? result.verificationHints[0] : null,
        stateDelta: { evidence: true, viewport: true },
      }),
    }))
    return result
  },
  undoSelectionHistory: async () => {
    const state = get()
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const result = await runtime.executeWorkspaceAction({
      widgetId: state.selectedWidgetId,
      name: 'widget.undoSelection',
    })
    set((current) => ({
      coordinationVersion: current.coordinationVersion + 1,
      ...makeTracePatch(sessionKey, {
        actor: 'human',
        kind: 'action',
        widgetId: state.selectedWidgetId || 'workspace',
        widgetTitle: state.selectedWidgetId || 'workspace',
        methodName: 'widget.undoSelection',
        summary: 'Restored previous selection state',
        detail: 'The analyst stepped back to the prior selection state using workspace-backed selection history.',
        stateDelta: { selection: true, propagation: true },
      }),
    }))
    return result
  },
  redoSelectionHistory: async () => {
    const state = get()
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const result = await runtime.executeWorkspaceAction({
      widgetId: state.selectedWidgetId,
      name: 'widget.redoSelection',
    })
    set((current) => ({
      coordinationVersion: current.coordinationVersion + 1,
      ...makeTracePatch(sessionKey, {
        actor: 'human',
        kind: 'action',
        widgetId: state.selectedWidgetId || 'workspace',
        widgetTitle: state.selectedWidgetId || 'workspace',
        methodName: 'widget.redoSelection',
        summary: 'Reapplied next selection state',
        detail: 'The analyst reapplied the next selection state using workspace-backed selection history.',
        stateDelta: { selection: true, propagation: true },
      }),
    }))
    return result
  },
  resetWorkspaceInteractions: async () => {
    const state = get()
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const result = await runtime.executeWorkspaceAction({
      widgetId: state.selectedWidgetId,
      name: 'workspace.resetWorkspace',
    })
    set((current) => ({
      coordinationVersion: current.coordinationVersion + 1,
      widgetActionOverrides: {},
      analyticalVersion: current.analyticalVersion + 1,
      ...buildWorkspaceInteractionStatePatch(current, sessionKey),
      ...makeTracePatch(sessionKey, {
        actor: 'human',
        kind: 'action',
        widgetId: 'workspace',
        widgetTitle: 'Workspace',
        methodName: 'workspace.resetWorkspace',
        summary: 'Reset workspace interaction state',
        detail: 'The analyst reset workspace interaction state through the canonical runtime action path.',
        stateDelta: { selection: true, focus: true, highlight: true, propagation: true, viewport: true },
      }),
    }))
    return result
  },
  restorePreviousWorkspaceState: async () => {
    const state = get()
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const history = runtime.readStateHistory({ limit: 24 })
    const target = history.length > 1 ? history.at(-2) : null
    if (!target?.stateId) return null
    const beforeReplayStateId = runtime.readCoordinationState()?.stateId || null
    const result = await runtime.jumpWorkspaceToState(target.stateId)
    const replayContext = buildReplayContext({
      source: 'history_restore',
      triggerId: target.stateId,
      stateId: result?.stateId || target.stateId,
      sourceStateId: beforeReplayStateId,
      branchId: null,
      transitionType: 'branch',
      summary: 'Restored previous workspace state',
      widgetId: 'workspace',
      widgetTitle: 'Workspace',
    })
    set((current) => ({
      coordinationVersion: current.coordinationVersion + 1,
      analyticalVersion: current.analyticalVersion + 1,
      ...applyReplayInteractionState(current, sessionKey, {
        replayContext,
        preferredWidgetId: replayContext?.widgetId || null,
      }),
      ...makeTracePatch(sessionKey, {
        actor: 'human',
        kind: 'replay',
        widgetId: 'workspace',
        widgetTitle: 'Workspace',
        methodName: 'workspace.jumpToState',
        summary: 'Restored previous workspace state',
        detail: `The analyst jumped back to ${target.stateId} through the canonical workspace replay surface.`,
        sourceStateId: beforeReplayStateId,
        resultStateId: result?.stateId || target.stateId,
        stateDelta: { selection: true, focus: true, highlight: true, viewport: true, propagation: true, branch: true },
      }),
    }))
    return result
  },
  restoreEarliestWorkspaceState: async () => {
    const state = get()
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const history = runtime.readStateHistory({ limit: 200 })
    const target = history[0] || null
    if (!target?.stateId) return null
    const beforeReplayStateId = runtime.readCoordinationState()?.stateId || null
    const result = await runtime.jumpWorkspaceToState(target.stateId)
    const replayContext = buildReplayContext({
      source: 'history_restore',
      triggerId: target.stateId,
      stateId: result?.stateId || target.stateId,
      sourceStateId: beforeReplayStateId,
      branchId: null,
      transitionType: 'branch',
      summary: 'Restored earliest workspace state',
      widgetId: 'workspace',
      widgetTitle: 'Workspace',
    })
    set((current) => ({
      coordinationVersion: current.coordinationVersion + 1,
      analyticalVersion: current.analyticalVersion + 1,
      ...applyReplayInteractionState(current, sessionKey, {
        replayContext,
        preferredWidgetId: replayContext?.widgetId || null,
      }),
      ...makeTracePatch(sessionKey, {
        actor: 'human',
        kind: 'replay',
        widgetId: 'workspace',
        widgetTitle: 'Workspace',
        methodName: 'workspace.jumpToState',
        summary: 'Restored earliest workspace state',
        detail: `The analyst restored the earliest available state ${target.stateId} through the canonical workspace replay surface.`,
        sourceStateId: beforeReplayStateId,
        resultStateId: result?.stateId || target.stateId,
        stateDelta: { selection: true, focus: true, highlight: true, viewport: true, propagation: true, branch: true },
      }),
    }))
    return result
  },
  runAgentStep: async (objectiveOverride) => {
    const state = get()
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const objective = typeof objectiveOverride === 'string' && objectiveOverride.trim().length > 0
      ? objectiveOverride.trim()
      : state.agentObjective
    set({ agentStatus: 'running', agentError: null })
    try {
      const result = await runAgentTurn(sessionKey, {
        objective,
        model: state.agentModel,
      })
      set((current) => {
        const interactionPatch = buildWorkspaceInteractionStatePatch(current, sessionKey) || {}
        const scopedWidgetId = resolveWidgetIdFromAgentScope(
          sessionKey,
          result?.act?.queryScope?.widgetRef || null,
          current.selectedWidgetId,
        )
        const focusedWidgetId = typeof scopedWidgetId === 'string' && scopedWidgetId.length > 0
          ? runtime.setFocusedWidgetId(scopedWidgetId) || null
          : null
        const nextOverrides = { ...(current.widgetActionOverrides || {}) }
        if (result?.act?.kind === 'action' && scopedWidgetId) {
          const derivedOverride = deriveWidgetActionOverride(result.act.name, result.act.params || {})
          if (derivedOverride) {
            nextOverrides[scopedWidgetId] = derivedOverride
          }
        }
        const nextTrace = runtime.readRuntimeTrace()
        const traceStep = Array.isArray(nextTrace) && nextTrace.length > 0 ? nextTrace.at(-1) : null
        return {
          agentStatus: 'idle',
          agentError: null,
          agentObjective: objective,
          agentLastStep: {
            objective,
            model: current.agentModel,
            turn: result || null,
            traceStep,
            recordedAt: Date.now(),
          },
          coordinationVersion: current.coordinationVersion + 1,
          analyticalVersion: current.analyticalVersion + 1,
          ...interactionPatch,
          widgetActionOverrides: nextOverrides,
          selectedWidgetId: focusedWidgetId || interactionPatch.selectedWidgetId || current.selectedWidgetId,
          trace: nextTrace,
          selectedTraceStepId: traceStep?.id || current.selectedTraceStepId,
          agentMessages: runtime.readAgentMessages(),
        }
      })
      return result
    } catch (error) {
      const errorText = formatAgentRuntimeError(error)
      const failureStep = runtime.appendTraceStep({
        actor: 'agent',
        kind: 'action',
        widgetTitle: 'Agent runtime',
        methodName: 'agent.step',
        summary: 'Agent step failed',
        detail: errorText,
        status: 'failed',
        stateDelta: { evidence: true },
      })
      set({
        agentStatus: 'error',
        agentError: errorText,
        agentLastStep: {
          objective,
          model: state.agentModel,
          turn: null,
          traceStep: failureStep || null,
          error: errorText,
          recordedAt: Date.now(),
        },
        trace: runtime.readRuntimeTrace(),
        selectedTraceStepId: failureStep?.id || state.selectedTraceStepId,
        agentMessages: runtime.readAgentMessages(),
      })
      throw error
    }
  },
  addFinding: (title) =>
    set((state) => {
      if (!title?.trim()) return state
      const traceModel = buildTraceTimelineModel(state.trace, {
        selectedStepId: state.selectedTraceStepId,
      })
      const selectedTraceStep = traceModel.selectedStep
      const traceFocus = deriveTraceFocus({
        traceModel,
        activeReplayContext: state.activeReplayContext,
      })
      const branchNarrative = deriveTraceBranchNarrative({
        traceModel,
        traceFocus,
      })
      const provenanceSummary = buildAnalysisProvenanceSummary({
        selectedTraceStep,
        selectedSegment: traceModel.selection.selectedSegment,
        selectedPath: traceModel.selection.selectedPath,
        currentSegment: traceModel.selection.currentSegment,
        currentPath: traceModel.selection.currentPath,
        activeReplayContext: state.activeReplayContext,
        branchNarrative,
      })
      const nextFinding = buildEvidenceEntry({
        id: `evidence_${Date.now()}`,
        title: title.trim(),
        note: state.focusedCarId ? `Captured while focused on ${state.focusedCarId}` : 'Captured from current workspace filters',
        widgetId: state.selectedWidgetId,
        confidence: 'working',
        provenance: selectedTraceStep ? 'manual_trace' : 'manual',
        traceStepId: selectedTraceStep?.id || null,
        stateId: selectedTraceStep?.resultStateId || null,
        branchId: selectedTraceStep?.branchId || null,
        branchNarrative: provenanceSummary.hasBranchNarrative
          ? {
              branchLabel: provenanceSummary.branchLabel,
              forkDescription: provenanceSummary.forkDescription,
              entryStepLabel: provenanceSummary.entryStepLabel,
              originStepId: branchNarrative?.originStepId || null,
              entryStepId: branchNarrative?.entryStepId || null,
            }
          : null,
        pathContext: provenanceSummary.selectedPathId
          ? {
              pathId: provenanceSummary.selectedPathId,
              pathLabel: provenanceSummary.selectedPathLabel,
              pathSummary: provenanceSummary.selectedPathSummary,
              segmentCount: provenanceSummary.selectedPathSegmentCount,
              stepCount: provenanceSummary.selectedPathStepCount,
            }
          : null,
      }, state.findings.length)
      return { findings: [nextFinding, ...state.findings].slice(0, 10) }
    }),
  focusFinding: async (findingId) => {
    const state = get()
    const findings = Array.isArray(state.findings) ? state.findings : []
    const finding = findings.find((entry) => entry?.id === findingId) || null
    if (!finding) return null

    if (finding.traceStepId) {
      return get().selectTraceStep(finding.traceStepId)
    }

    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    if (!finding.stateId) return null
    const result = await runtime.jumpWorkspaceToState(finding.stateId)
    const replayContext = buildReplayContextFromFinding(finding, finding.stateId)
    set((current) => ({
      coordinationVersion: current.coordinationVersion + 1,
      analyticalVersion: current.analyticalVersion + 1,
      ...applyReplayInteractionState(current, sessionKey, {
        replayContext,
        preferredWidgetId: finding.widgetId || null,
      }),
    }))
    return { finding, replayed: true, stateId: finding.stateId, result, replayContext }
  },
  focusFindingProvenance: async (findingId, target = 'trace') => {
    const state = get()
    const findings = Array.isArray(state.findings) ? state.findings : []
    const finding = findings.find((entry) => entry?.id === findingId) || null
    if (!finding) return null

    if (target === 'origin') {
      const originStepId = finding.branchNarrative?.originStepId || null
      if (!originStepId) return null
      set({ traceNavigationTarget: buildTraceNavigationTarget(originStepId, 'origin') })
      return get().selectTraceStep(originStepId)
    }

    if (target === 'entry') {
      const entryStepId = finding.branchNarrative?.entryStepId || null
      if (!entryStepId) return null
      set({ traceNavigationTarget: buildTraceNavigationTarget(entryStepId, 'entry') })
      return get().selectTraceStep(entryStepId)
    }

    return get().focusFinding(findingId)
  },
  cycleSelection: () =>
    set((state) => {
      const analysisOrigin = cycleAnalysisOrigin(state)
      const nextState = { ...state, analysisOrigin }
      readRuntimeFacadeFromState(state).syncWorkspaceGlobalFilters(nextState)
      return { analysisOrigin }
    }),
  resetWorkspaceView: () => set((state) => {
    disposeRuntimeSession(readRuntimeSessionKeyFromState(state))
    registerWorkspaceProviderEnvironment(state.activeCaseId, state.workspaceProviderEnvironment || DEFAULT_WORKSPACE_PROVIDER_ENVIRONMENT)
    return {
      ...createInitialSessionState(state.activeCaseId),
      coordinationVersion: 0,
      analyticalVersion: 0,
      mode: state.mode,
      analysisTab: state.analysisTab,
      traceTab: state.traceTab,
      traceOpen: state.traceOpen,
      activeReplayContext: null,
      agentStatus: 'idle',
      agentError: null,
      agentModel: state.agentModel,
      agentObjective: state.agentObjective,
    }
  }),
}))

export function getAppSnapshot() {
  const state = useAppStore.getState()
  return buildAppSnapshot(state)
}
