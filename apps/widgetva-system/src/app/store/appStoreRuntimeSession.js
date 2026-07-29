import {
  createFirstPartyRuntimeSessionFacade,
} from '../../appRuntime/contracts/runtimeBridge.js'

export const DEFAULT_CASE_ID = 'starter-workspace'

export function buildDefaultAgentObjective(workspaceCase) {
  return ''
}

export function readRuntimeSessionFacade(caseId) {
  return createFirstPartyRuntimeSessionFacade(caseId)
}

export function readRuntimeSessionKeyFromState(state) {
  return state?.runtimeSessionKey || state?.activeCaseId || DEFAULT_CASE_ID
}

export function readRuntimeFacadeFromState(state) {
  return readRuntimeSessionFacade(readRuntimeSessionKeyFromState(state))
}

export function makeTracePatch(caseId, step) {
  const runtime = readRuntimeSessionFacade(caseId)
  const appended = runtime.appendTraceStep(step)
  return appended
    ? {
        trace: runtime.readRuntimeTrace(),
        selectedTraceStepId: appended.id,
      }
    : {}
}

export function makeMessagePatch(caseId, message) {
  const runtime = readRuntimeSessionFacade(caseId)
  const appended = runtime.appendAgentMessage(message)
  return appended
    ? {
        agentMessages: runtime.readAgentMessages(),
      }
    : {}
}

export function buildWorkspaceInteractionStatePatch(state, sessionKey) {
  return readRuntimeSessionFacade(sessionKey).readWorkspaceControlProjection({
    dataset: state.dataset,
    fallbackSelectedWidgetId: state.selectedWidgetId,
  })
}

export function resolveWidgetIdFromAgentScope(sessionKey, widgetRef, fallbackWidgetId = null) {
  if (typeof widgetRef !== 'string' || widgetRef.length === 0) return fallbackWidgetId
  const runtime = readRuntimeSessionFacade(sessionKey)
  const description = runtime.describeWorkspace() || null
  const matchedWidget = Array.isArray(description?.widgets)
    ? description.widgets.find((widget) => widget?.ref === widgetRef || widget?.widgetId === widgetRef)
    : null
  return matchedWidget?.widgetId || fallbackWidgetId
}

export function applyReplayInteractionState(current, sessionKey, {
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
