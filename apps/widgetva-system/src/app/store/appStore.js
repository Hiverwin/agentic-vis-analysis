import { create } from 'zustand'
import { getModeById } from './modes.js'
import { buildEvidenceEntry } from './sessionModel.js'
import { buildAnalysisProvenanceSummary } from '../../features/analysis/models/provenanceSummary.js'
import { deriveTraceBranchNarrative } from '../../features/trace/models/traceBranchNarrative.js'
import { deriveTraceFocus } from '../../features/trace/models/traceFocus.js'
import { buildTraceTimelineModel } from '../../features/trace/models/traceViewModel.js'
import {
  buildAppSnapshot,
  createInitialSessionState,
  disposeRuntimeSession,
  getWorkspaceCase,
  recordAgentTurnResult,
  readLatestCoordinationResult,
  registerWorkspaceProviderEnvironment,
  registerWorkspaceCaseOverride,
} from '../../appRuntime/contracts/runtimeBridge.js'
import { DEFAULT_OPENROUTER_VLM, formatAgentRuntimeError, runAgentSession } from '../../appRuntime/agent/agentRuntime.js'
import {
  beginAgentSessionControl,
  clearAgentSessionControl,
  isAgentSessionPauseRequested,
  requestAgentSessionPause,
  resumeAgentSession,
  waitForAgentSessionResume,
} from '../../appRuntime/agent/agentSessionControl.js'
import { buildImportedVisualizationCase, buildVisualizationPreview } from '../../appRuntime/imports/importedArtifactLoader.js'
import {
  buildVisualizationBindSummary,
  createImportedWidgetId,
  mergeImportedVisualizationCase,
  removeWidgetFromImportedCase,
} from './importedVisualizationState.js'
import {
  buildReplayContext,
  buildReplayContextFromFinding,
  buildReplayContextFromTraceStep,
  buildTraceNavigationTarget,
} from './replayState.js'
import {
  DEFAULT_CASE_ID,
  applyReplayInteractionState,
  buildDefaultAgentObjective,
  buildWorkspaceInteractionStatePatch,
  makeMessagePatch,
  makeTracePatch,
  readRuntimeFacadeFromState,
  readRuntimeSessionFacade,
  readRuntimeSessionKeyFromState,
  resolveWidgetIdFromAgentScope,
} from './appStoreRuntimeSession.js'

const initialMode = getModeById('manual')
const DEFAULT_WORKSPACE_PROVIDER_ENVIRONMENT = 'vega-lite'
const DEFAULT_AGENT_SESSION_MAX_TURNS = 4

registerWorkspaceProviderEnvironment(DEFAULT_CASE_ID, DEFAULT_WORKSPACE_PROVIDER_ENVIRONMENT)

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
  loadedVisualizationPreview: null,
  visualizationLoadError: null,
  visualizationLoadSummary: '',
  visualizationBindStatus: 'idle',
  visualizationBindError: null,
  visualizationBindSummary: '',
  agentStatus: 'idle',
  agentError: null,
  agentModel: DEFAULT_OPENROUTER_VLM,
  agentObjective: buildDefaultAgentObjective({ sourceType: 'starter' }),
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
      ...createInitialSessionState(state.activeCaseId),
      workspaceProviderEnvironment: registered.workspaceProviderEnvironment || providerEnvironment || 'mixed',
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
  loadVisualizationScript: async (scriptText) => {
    try {
      const state = get()
      const preview = buildVisualizationPreview({
        scriptText,
        preferredProvider: state.workspaceProviderEnvironment || DEFAULT_WORKSPACE_PROVIDER_ENVIRONMENT,
      })
      set((current) => ({
        visualizationLoadError: null,
        visualizationLoadSummary: `Visualization rendered successfully via ${preview.provider}.`,
        loadedVisualizationPreview: {
          ...preview,
          scriptText,
        },
        visualizationBindStatus: 'idle',
        visualizationBindError: null,
        visualizationBindSummary: '',
        agentStatus: 'idle',
        agentError: null,
        agentLastStep: null,
        rendererFamily: current.rendererFamily,
        mode: current.mode,
        analysisTab: current.analysisTab,
        traceOpen: current.traceOpen,
      }))
    } catch (error) {
      set({
        visualizationLoadError: formatAgentRuntimeError(error),
        visualizationLoadSummary: '',
        loadedVisualizationPreview: null,
        visualizationBindStatus: 'idle',
        visualizationBindError: null,
        visualizationBindSummary: '',
      })
    }
  },
  bindCurrentVisualization: async () => {
    const state = get()
    const preview = state.loadedVisualizationPreview
    if (!preview?.scriptText) {
      set({
        visualizationBindStatus: 'idle',
        visualizationBindError: 'Load and render a visualization before binding it.',
        visualizationBindSummary: '',
      })
      return null
    }

    set({
      visualizationBindStatus: 'binding',
      visualizationBindError: null,
      visualizationBindSummary: '',
    })

    try {
      const previewProvider = preview.provider || state.workspaceProviderEnvironment || DEFAULT_WORKSPACE_PROVIDER_ENVIRONMENT
      const appendingToImportedWorkspace = state.workspaceSourceType === 'importedSpec'
        && typeof state.activeCaseId === 'string'
        && state.activeCaseId.length > 0
        && (state.workspaceProviderEnvironment || DEFAULT_WORKSPACE_PROVIDER_ENVIRONMENT) === previewProvider
      const importedCaseId = appendingToImportedWorkspace ? state.activeCaseId : `imported_spec_${Date.now()}`
      const currentImportedCase = appendingToImportedWorkspace ? getWorkspaceCase(importedCaseId) : null
      const widgetId = createImportedWidgetId(currentImportedCase?.widgets)
      const importedWidgetCase = buildImportedVisualizationCase({
        scriptText: preview.scriptText,
        caseId: importedCaseId,
        widgetId,
        preferredProvider: previewProvider,
      })
      const nextCase = appendingToImportedWorkspace
        ? mergeImportedVisualizationCase(currentImportedCase, importedWidgetCase)
        : importedWidgetCase
      registerWorkspaceCaseOverride(importedCaseId, nextCase)
      const nextSessionState = createInitialSessionState(importedCaseId)
      const runtime = readRuntimeSessionFacade(importedCaseId)
      const description = runtime.readWorkspaceDescription() || runtime.describeWorkspace() || {}
      const primaryWidget = Array.isArray(description?.widgets) ? description.widgets[0] || null : null
      const bindSummary = buildVisualizationBindSummary(description, primaryWidget)

      set((current) => ({
        coordinationVersion: 0,
        analyticalVersion: 0,
        loadedVisualizationPreview: null,
        visualizationLoadError: null,
        visualizationBindStatus: 'bound',
        visualizationBindError: null,
        visualizationBindSummary: bindSummary,
        agentStatus: 'idle',
        agentError: null,
        agentObjective: '',
        agentLastStep: null,
        workspaceProviderEnvironment: nextCase.workspaceProviderEnvironment || DEFAULT_WORKSPACE_PROVIDER_ENVIRONMENT,
        ...nextSessionState,
        rendererFamily: current.rendererFamily,
        mode: current.mode,
        analysisTab: current.analysisTab,
        traceOpen: current.traceOpen,
      }))
      return description
    } catch (error) {
      set({
        visualizationBindStatus: 'idle',
        visualizationBindError: formatAgentRuntimeError(error),
        visualizationBindSummary: '',
      })
      return null
    }
  },
  removeImportedWidget: async (widgetId) => {
    const state = get()
    if (state.workspaceSourceType !== 'importedSpec') return null
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const currentCase = getWorkspaceCase(sessionKey)
    const nextCase = removeWidgetFromImportedCase(currentCase, widgetId)
    if (!nextCase) return null
    registerWorkspaceCaseOverride(sessionKey, nextCase)
    const nextSessionState = createInitialSessionState(sessionKey)
    set((current) => ({
      coordinationVersion: 0,
      analyticalVersion: 0,
      loadedVisualizationPreview: null,
      visualizationLoadError: null,
      visualizationBindStatus: nextCase.widgets.length > 0 ? 'bound' : 'idle',
      visualizationBindError: null,
      visualizationBindSummary: nextCase.widgets.length > 0
        ? `Removed ${widgetId}. ${nextCase.widgets.length} widget${nextCase.widgets.length === 1 ? '' : 's'} remain.`
        : `Removed ${widgetId}. No widgets remain in this imported workspace.`,
      agentStatus: 'idle',
      agentError: null,
      agentLastStep: null,
      ...nextSessionState,
      rendererFamily: current.rendererFamily,
      mode: current.mode,
      analysisTab: current.analysisTab,
      traceTab: current.traceTab,
      traceOpen: current.traceOpen,
    }))
    return nextCase
  },
  setActiveCase: (caseId) => set((state) => {
    disposeRuntimeSession(readRuntimeSessionKeyFromState(state))
    const nextCase = getWorkspaceCase(caseId)
    return {
      coordinationVersion: 0,
      analyticalVersion: 0,
      loadedVisualizationPreview: null,
      agentStatus: 'idle',
      agentError: null,
      agentObjective: buildDefaultAgentObjective(nextCase),
      visualizationBindStatus: 'idle',
      visualizationBindError: null,
      visualizationBindSummary: '',
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
  clearSelection: () => set((state) => {
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const result = runtime.clearWorkspaceSelection()
    return result.changed
      ? {
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
    const nextPartial = { controlState: {} }
    runtime.syncWorkspaceGlobalFilters(nextPartial)
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
  dispatchWidgetAction: async ({ widgetId, name, actionName = null, params = {}, summary, detail } = {}) => {
    const state = get()
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const methodName = name || actionName
    const result = await runtime.executeWorkspaceAction({
      widgetId,
      name: methodName,
      params,
    })
    set((current) => ({
      analyticalVersion: current.analyticalVersion + 1,
      ...makeTracePatch(sessionKey, {
        actor: 'human',
        kind: 'action',
        widgetId,
        widgetTitle: widgetId,
        methodName,
        summary: summary || methodName,
        detail: detail || `Executed ${methodName} through the shared workspace runtime.`,
        verificationSummary: Array.isArray(result?.verificationHints) ? result.verificationHints[0] : null,
        stateDelta: { evidence: true, viewport: true },
      }),
    }))
    return result
  },
  runHumanRuntimeAction: async (call = {}) => {
    const state = get()
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const targetRef = call?.target?.widgetRef || call?.targetRef || call?.params?.targetRef || null
    const rawQueryScope = call?.queryScope && typeof call.queryScope === 'object' && !Array.isArray(call.queryScope)
      ? call.queryScope
      : {}
    const {
      widgetRef: _removedWidgetRef,
      widget_ref: _removedWidgetRefSnake,
      ...queryScope
    } = rawQueryScope
    const normalizedCall = {
      ...call,
      target: {
        ...(call?.target || {}),
        ...(targetRef ? { widgetRef: targetRef } : {}),
      },
      ...(Object.keys(queryScope).length > 0 ? { queryScope } : {}),
      actor: call?.actor || 'human',
    }
    const result = await runtime.agentContract().executeAction(normalizedCall)
    set((current) => ({
      coordinationVersion: current.coordinationVersion + 1,
      analyticalVersion: current.analyticalVersion + 1,
      ...makeTracePatch(sessionKey, {
        actor: 'human',
        kind: 'action',
        widgetId: targetRef || 'workspace',
        widgetTitle: targetRef || 'Workspace',
        methodName: normalizedCall.name || 'widget.interact',
        summary: normalizedCall.name || 'Widget interaction',
        detail: `Executed ${normalizedCall.name || 'widget interaction'} through the workspace runtime contract.`,
        verificationSummary: result?.verification?.summary || (Array.isArray(result?.verificationHints) ? result.verificationHints[0] : null),
        stateDelta: { selection: true, propagation: true },
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
  pauseAgentSession: () => {
    const state = get()
    if (state.agentStatus !== 'running') return
    requestAgentSessionPause(readRuntimeSessionKeyFromState(state))
    set({ agentStatus: 'paused' })
  },
  resumeAgentSession: () => {
    const state = get()
    if (state.agentStatus !== 'paused') return
    resumeAgentSession(readRuntimeSessionKeyFromState(state))
    set({ agentStatus: 'running' })
  },
  runAgentStep: async (objectiveOverride) => {
    const state = get()
    const sessionKey = readRuntimeSessionKeyFromState(state)
    const runtime = readRuntimeSessionFacade(sessionKey)
    const objective = typeof objectiveOverride === 'string' && objectiveOverride.trim().length > 0
      ? objectiveOverride.trim()
      : state.agentObjective
    beginAgentSessionControl(sessionKey)
    runtime.appendAgentMessage({
      role: 'user',
      text: objective,
    })
    set({
      agentStatus: 'running',
      agentError: null,
      agentObjective: objective,
      agentMessages: runtime.readAgentMessages(),
    })
    try {
      const result = await runAgentSession(sessionKey, {
        objective,
        model: state.agentModel,
        maxTurns: DEFAULT_AGENT_SESSION_MAX_TURNS,
        recordTurns: false,
        onTurn: async ({ turn, turns }) => {
          recordAgentTurnResult(sessionKey, {
            query: null,
            turn,
          })
          set((current) => {
            const interactionPatch = buildWorkspaceInteractionStatePatch(current, sessionKey) || {}
            const scopedWidgetId = resolveWidgetIdFromAgentScope(
              sessionKey,
              turn?.act?.target?.widgetRef || null,
              current.selectedWidgetId,
            )
            const focusedWidgetId = typeof scopedWidgetId === 'string' && scopedWidgetId.length > 0
              ? runtime.setFocusedWidgetId(scopedWidgetId) || null
              : null
            const nextTrace = runtime.readRuntimeTrace()
            const traceStep = Array.isArray(nextTrace) && nextTrace.length > 0 ? nextTrace.at(-1) : null
            return {
              agentStatus: 'running',
              agentError: null,
              agentObjective: objective,
              agentLastStep: {
                objective,
                model: current.agentModel,
                turn,
                session: {
                  objective,
                  turns: Array.isArray(turns) ? turns : [turn].filter(Boolean),
                  status: 'running',
                },
                traceStep,
                recordedAt: Date.now(),
              },
              coordinationVersion: current.coordinationVersion + 1,
              analyticalVersion: current.analyticalVersion + 1,
              ...interactionPatch,
              selectedWidgetId: focusedWidgetId || interactionPatch.selectedWidgetId || current.selectedWidgetId,
              trace: nextTrace,
              selectedTraceStepId: traceStep?.id || current.selectedTraceStepId,
              agentMessages: runtime.readAgentMessages(),
            }
          })
          if (isAgentSessionPauseRequested(sessionKey)) {
            set({ agentStatus: 'paused' })
            await waitForAgentSessionResume(sessionKey)
            set({ agentStatus: 'running' })
          }
        },
      })
      set((current) => {
        const interactionPatch = buildWorkspaceInteractionStatePatch(current, sessionKey) || {}
        const turns = Array.isArray(result?.turns) ? result.turns : []
        const lastTurn = turns.length > 0 ? turns.at(-1) : null
        const scopedWidgetId = resolveWidgetIdFromAgentScope(
          sessionKey,
          lastTurn?.act?.target?.widgetRef || null,
          current.selectedWidgetId,
        )
        const focusedWidgetId = typeof scopedWidgetId === 'string' && scopedWidgetId.length > 0
          ? runtime.setFocusedWidgetId(scopedWidgetId) || null
          : null
        const nextTrace = runtime.readRuntimeTrace()
        const traceStep = Array.isArray(nextTrace) && nextTrace.length > 0 ? nextTrace.at(-1) : null
        return {
          agentStatus: 'idle',
          agentError: null,
          agentObjective: objective,
          agentLastStep: {
            objective,
            model: current.agentModel,
            turn: lastTurn,
            session: result || null,
            traceStep,
            recordedAt: Date.now(),
          },
          coordinationVersion: current.coordinationVersion + 1,
          analyticalVersion: current.analyticalVersion + 1,
          ...interactionPatch,
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
    } finally {
      clearAgentSessionControl(sessionKey)
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
        note: 'Captured from current workspace state',
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
