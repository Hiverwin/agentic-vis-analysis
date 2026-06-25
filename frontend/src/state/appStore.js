import { create } from 'zustand'

const normalizeSession = (session, fallbackTime) => ({
  session_id: session.session_id,
  chart_type: session.chart_type || '',
  created_at: session.created_at || fallbackTime,
  last_activity: session.last_activity || fallbackTime,
})

function isSelectionPayload(selection) {
  return selection != null && typeof selection === 'object' && !Array.isArray(selection)
}

function makeSelectionMapKey(selection) {
  if (!isSelectionPayload(selection)) return null
  const sourceWidgetId = selection.source_widget_id || 'workspace'
  const selectionId = selection.selection_id || selection.id || null
  return selectionId ? `${sourceWidgetId}::${selectionId}` : null
}

function normalizeSelectionMap(selections, fallbackSelection = null) {
  const entries = []
  if (selections && typeof selections === 'object' && !Array.isArray(selections)) {
    for (const [key, value] of Object.entries(selections)) {
      if (!isSelectionPayload(value)) continue
      entries.push([key || makeSelectionMapKey(value) || `selection_${entries.length}`, value])
    }
  }
  if (entries.length === 0 && isSelectionPayload(fallbackSelection)) {
    const key = makeSelectionMapKey(fallbackSelection)
    if (key) entries.push([key, fallbackSelection])
  }
  return Object.fromEntries(entries)
}

function getLatestSelection(selectionMap, fallbackSelection = null) {
  const values = Object.values(selectionMap || {})
  if (values.length > 0) return values[values.length - 1] || null
  return isSelectionPayload(fallbackSelection) ? fallbackSelection : null
}

function cloneSelectionMap(selectionMap, fallbackSelection = null) {
  return normalizeSelectionMap(selectionMap, fallbackSelection)
}

export const useAppStore = create((set) => ({
  modelAvailable: null,
  sessions: [],
  currentSessionId: null,
  baselineSpec: null,
  currentSpec: null,
  currentSpecHistory: [],
  currentWorkspaceSpec: null,
  currentWorkspacePlanningRequest: null,
  isRunning: false,
  runMode: 'goal_oriented',
  scrollToIteration: null,
  currentSelection: null,
  currentSelections: {},
  currentSelectionHistory: [],
  currentSelectionFuture: [],
  currentSelectionsHistory: [],
  currentSelectionsFuture: [],
  currentFocusedWidgetRef: null,
  currentComparisonTargets: [],
  workspaceAnnotations: [],
  samplingInfo: null,
  presetQueryDraft: '',

  setModelAvailable: (modelAvailable) => set({ modelAvailable }),
  setSessions: (sessions) => set({ sessions: Array.isArray(sessions) ? sessions : [] }),
  setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),
  setCurrentSpec: (currentSpec, options = {}) =>
    set((state) => {
      const trackHistory = options?.trackHistory === true
      const replaceBaseline = options?.replaceBaseline === true
      return {
        baselineSpec: replaceBaseline ? currentSpec : state.baselineSpec,
        currentSpec,
        currentSpecHistory: trackHistory
          ? [...(state.currentSpecHistory || []), state.currentSpec ?? null].slice(-50)
          : (replaceBaseline ? [] : state.currentSpecHistory || []),
      }
    }),
  resetCurrentSpec: () =>
    set((state) => ({
      currentSpec: state.baselineSpec,
      currentSpecHistory: [],
    })),
  undoCurrentSpec: () =>
    set((state) => {
      const history = [...(state.currentSpecHistory || [])]
      if (history.length === 0) {
        return {
          currentSpec: state.currentSpec,
          currentSpecHistory: [],
        }
      }
      const previousSpec = history.pop()
      return {
        currentSpec: previousSpec ?? state.baselineSpec ?? null,
        currentSpecHistory: history,
      }
    }),
  setCurrentWorkspaceSpec: (currentWorkspaceSpec) => set({ currentWorkspaceSpec }),
  setCurrentWorkspacePlanningRequest: (currentWorkspacePlanningRequest) => set({ currentWorkspacePlanningRequest }),
  setIsRunning: (isRunning) => set({ isRunning: !!isRunning }),
  setRunMode: (runMode) => set({ runMode }),
  setScrollToIteration: (scrollToIteration) => set({ scrollToIteration }),
  setCurrentFocusedWidgetRef: (currentFocusedWidgetRef) => set({ currentFocusedWidgetRef: currentFocusedWidgetRef || null }),
  setCurrentComparisonTargets: (currentComparisonTargets) =>
    set({ currentComparisonTargets: Array.isArray(currentComparisonTargets) ? currentComparisonTargets : [] }),
  setWorkspaceAnnotations: (workspaceAnnotations) =>
    set({ workspaceAnnotations: Array.isArray(workspaceAnnotations) ? workspaceAnnotations : [] }),
  addWorkspaceAnnotation: (annotation) =>
    set((state) => ({
      workspaceAnnotations: [...(state.workspaceAnnotations || []), annotation].slice(-200),
    })),
  clearWorkspaceAnnotations: () => set({ workspaceAnnotations: [] }),
  setCurrentSelection: (currentSelection, options = {}) =>
    set((state) => {
      const trackHistory = options?.trackHistory !== false
      const preserveFuture = options?.preserveFuture === true
      const clearAll = options?.clearAll === true
      const removeSourceWidgetId = options?.removeSourceWidgetId || null
      const removeSelectionKey = options?.removeSelectionKey || null
      const nextSelectionHistory = trackHistory
        ? [...(state.currentSelectionHistory || []), state.currentSelection ?? null].slice(-50)
        : (state.currentSelectionHistory || [])
      const nextSelectionsHistory = trackHistory
        ? [...(state.currentSelectionsHistory || []), cloneSelectionMap(state.currentSelections, state.currentSelection)].slice(-50)
        : (state.currentSelectionsHistory || [])
      let nextSelections = { ...(state.currentSelections || {}) }
      if (isSelectionPayload(currentSelection)) {
        const selectionKey = makeSelectionMapKey(currentSelection)
        if (selectionKey) {
          nextSelections[selectionKey] = currentSelection
        }
      } else if (clearAll) {
        nextSelections = {}
      } else if (removeSelectionKey && Object.prototype.hasOwnProperty.call(nextSelections, removeSelectionKey)) {
        delete nextSelections[removeSelectionKey]
      } else if (removeSourceWidgetId) {
        nextSelections = Object.fromEntries(
          Object.entries(nextSelections).filter(([, selection]) => selection?.source_widget_id !== removeSourceWidgetId),
        )
      } else if (currentSelection == null) {
        nextSelections = {}
      }
      const resolvedCurrentSelection = isSelectionPayload(currentSelection)
        ? currentSelection
        : getLatestSelection(nextSelections, null)
      return {
        currentSelection: resolvedCurrentSelection,
        currentSelections: nextSelections,
        currentSelectionHistory: nextSelectionHistory,
        currentSelectionFuture: preserveFuture ? (state.currentSelectionFuture || []) : [],
        currentSelectionsHistory: nextSelectionsHistory,
        currentSelectionsFuture: preserveFuture ? (state.currentSelectionsFuture || []) : [],
      }
    }),
  setCurrentSelections: (currentSelections, options = {}) =>
    set((state) => {
      const nextSelections = normalizeSelectionMap(currentSelections, options?.fallbackSelection || state.currentSelection)
      return {
        currentSelections: nextSelections,
        currentSelection: getLatestSelection(nextSelections, options?.fallbackSelection || state.currentSelection),
      }
    }),
  clearCurrentSelections: () => set({ currentSelection: null, currentSelections: {} }),
  undoCurrentSelection: () =>
    set((state) => {
      const selectionHistory = [...(state.currentSelectionHistory || [])]
      const selectionsHistory = [...(state.currentSelectionsHistory || [])]
      if (selectionHistory.length === 0 && selectionsHistory.length === 0) {
        return {
          currentSelection: null,
          currentSelections: {},
          currentSelectionHistory: [],
          currentSelectionFuture: state.currentSelectionFuture || [],
          currentSelectionsHistory: [],
          currentSelectionsFuture: state.currentSelectionsFuture || [],
        }
      }
      const previousSelection = selectionHistory.pop()
      const previousSelections = selectionsHistory.pop() || {}
      const nextSelections = cloneSelectionMap(previousSelections, previousSelection ?? null)
      return {
        currentSelection: previousSelection ?? null,
        currentSelections: nextSelections,
        currentSelectionHistory: selectionHistory,
        currentSelectionFuture: [...(state.currentSelectionFuture || []), state.currentSelection ?? null].slice(-50),
        currentSelectionsHistory: selectionsHistory,
        currentSelectionsFuture: [...(state.currentSelectionsFuture || []), cloneSelectionMap(state.currentSelections, state.currentSelection)].slice(-50),
      }
    }),
  redoCurrentSelection: () =>
    set((state) => {
      const selectionFuture = [...(state.currentSelectionFuture || [])]
      const selectionsFuture = [...(state.currentSelectionsFuture || [])]
      if (selectionFuture.length === 0 && selectionsFuture.length === 0) {
        return {
          currentSelection: state.currentSelection ?? null,
          currentSelections: normalizeSelectionMap(state.currentSelections, state.currentSelection ?? null),
          currentSelectionHistory: state.currentSelectionHistory || [],
          currentSelectionFuture: [],
          currentSelectionsHistory: state.currentSelectionsHistory || [],
          currentSelectionsFuture: [],
        }
      }
      const nextSelection = selectionFuture.pop()
      const nextSelections = cloneSelectionMap(selectionsFuture.pop() || {}, nextSelection ?? null)
      return {
        currentSelection: nextSelection ?? null,
        currentSelections: nextSelections,
        currentSelectionHistory: [...(state.currentSelectionHistory || []), state.currentSelection ?? null].slice(-50),
        currentSelectionFuture: selectionFuture,
        currentSelectionsHistory: [...(state.currentSelectionsHistory || []), cloneSelectionMap(state.currentSelections, state.currentSelection)].slice(-50),
        currentSelectionsFuture: selectionsFuture,
      }
    }),
  resetSelectionHistory: () => set({
    currentSelectionHistory: [],
    currentSelectionFuture: [],
    currentSelectionsHistory: [],
    currentSelectionsFuture: [],
  }),
  setSamplingInfo: (samplingInfo) => set({ samplingInfo }),
  setPresetQueryDraft: (presetQueryDraft) => set({ presetQueryDraft: presetQueryDraft || '' }),
  clearPresetQueryDraft: () => set({ presetQueryDraft: '' }),

  hydrateSessions: (sessions) =>
    set(() => ({
      sessions: (sessions || []).map((s) => normalizeSession(s, Date.now())),
    })),

  applySessionCreated: (res) =>
    set((state) => {
      const now = Date.now()
      const sessionId = res.session_id
      const baselineSpec = res.baseline_spec
      const already = state.sessions.some((s) => s.session_id === sessionId)
      return {
        currentSessionId: sessionId,
        baselineSpec,
        currentSpec: baselineSpec,
        currentSpecHistory: [],
        currentWorkspaceSpec: null,
        currentWorkspacePlanningRequest: null,
        samplingInfo: res.sampling_info ?? null,
        currentFocusedWidgetRef: null,
        currentComparisonTargets: [],
        workspaceAnnotations: [],
        currentSelection: null,
        currentSelections: {},
        currentSelectionHistory: [],
        currentSelectionFuture: [],
        currentSelectionsHistory: [],
        currentSelectionsFuture: [],
        sessions: already
          ? state.sessions
          : [
              {
                session_id: sessionId,
                chart_type: res.chart_type || '',
                created_at: now,
                last_activity: now,
              },
              ...state.sessions,
            ],
      }
    }),

  applySessionSwitched: (sessionId, statePayload) =>
    set(() => {
      return {
        currentSessionId: sessionId,
        baselineSpec: statePayload?.baseline_spec || statePayload?.current_spec || null,
        currentSpec: statePayload?.current_spec || null,
        currentSpecHistory: [],
        currentWorkspaceSpec: null,
        currentWorkspacePlanningRequest: null,
        samplingInfo: statePayload?.sampling_info ?? null,
        currentFocusedWidgetRef: null,
        currentComparisonTargets: [],
        workspaceAnnotations: [],
        currentSelection: null,
        currentSelections: {},
        currentSelectionHistory: [],
        currentSelectionFuture: [],
        currentSelectionsHistory: [],
        currentSelectionsFuture: [],
        scrollToIteration: null,
      }
    }),
}))
