import { createWidgetVAHostBridge } from 'widgetva-kit/core'
import { useAppStore } from './state/appStore.js'

export function getWidgetVAWorkspaceAppState() {
  return useAppStore.getState()
}

export function subscribeWidgetVAWorkspaceAppState(listener) {
  return useAppStore.subscribe(listener)
}

export function createWidgetVAWorkspaceHostBridge() {
  return createWidgetVAHostBridge({
    getState: getWidgetVAWorkspaceAppState,
    subscribe: subscribeWidgetVAWorkspaceAppState,
    selectors: {
      readSessionId: (state) => state?.currentSessionId || null,
      readBaselineSpec: (state) => state?.baselineSpec || null,
      readCurrentSpec: (state) => state?.currentSpec || null,
      readWorkspaceSpec: (state) => state?.currentWorkspaceSpec || null,
      readPlanningRequest: (state) => state?.currentWorkspacePlanningRequest || null,
      readRunMode: (state) => state?.runMode || 'goal_oriented',
      readUserIntent: (state) => state?.presetQueryDraft || '',
      readCurrentSelection: (state) => state?.currentSelection || null,
      readCurrentSelections: (state) => state?.currentSelections || {},
      readFocusedWidgetRef: (state) => state?.currentFocusedWidgetRef || null,
      readComparisonTargets: (state) => state?.currentComparisonTargets || [],
      readWorkspaceAnnotations: (state) => state?.workspaceAnnotations || [],
      readSelectionHistory: (state) => state?.currentSelectionHistory || [],
      readSelectionsHistory: (state) => state?.currentSelectionsHistory || [],
      readSelectionFuture: (state) => state?.currentSelectionFuture || [],
      readSelectionsFuture: (state) => state?.currentSelectionsFuture || [],
    },
    actions: {
      writeCurrentSpec: (nextSpec, options = {}) => getWidgetVAWorkspaceAppState().setCurrentSpec?.(nextSpec, options),
      resetCurrentSpec: () => getWidgetVAWorkspaceAppState().resetCurrentSpec?.(),
      writeWorkspaceSpec: (workspaceSpec) => getWidgetVAWorkspaceAppState().setCurrentWorkspaceSpec?.(workspaceSpec),
      writePlanningRequest: (planningRequest) => getWidgetVAWorkspaceAppState().setCurrentWorkspacePlanningRequest?.(planningRequest),
      writeRunMode: (runMode) => getWidgetVAWorkspaceAppState().setRunMode?.(runMode),
      writeUserIntent: (userIntent) => getWidgetVAWorkspaceAppState().setPresetQueryDraft?.(userIntent),
      writeCurrentSelection: (selection, options = {}) => getWidgetVAWorkspaceAppState().setCurrentSelection?.(selection, options),
      writeCurrentSelections: (selections, options = {}) => getWidgetVAWorkspaceAppState().setCurrentSelections?.(selections, options),
      resetSelectionHistory: () => getWidgetVAWorkspaceAppState().resetSelectionHistory?.(),
      setFocusedWidgetRef: (widgetRef) => getWidgetVAWorkspaceAppState().setCurrentFocusedWidgetRef?.(widgetRef),
      setComparisonTargets: (targetRefs) => getWidgetVAWorkspaceAppState().setCurrentComparisonTargets?.(targetRefs),
      setWorkspaceAnnotations: (annotations) => getWidgetVAWorkspaceAppState().setWorkspaceAnnotations?.(annotations),
      addWorkspaceAnnotation: (annotation) => getWidgetVAWorkspaceAppState().addWorkspaceAnnotation?.(annotation),
      clearWorkspaceAnnotations: () => getWidgetVAWorkspaceAppState().clearWorkspaceAnnotations?.(),
      undoSelection: () => getWidgetVAWorkspaceAppState().undoCurrentSelection?.(),
      redoSelection: () => getWidgetVAWorkspaceAppState().redoCurrentSelection?.(),
    },
  })
}
