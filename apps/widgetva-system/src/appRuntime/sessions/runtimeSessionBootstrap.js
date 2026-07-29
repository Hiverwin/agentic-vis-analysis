import { cloneJsonValue as clone } from '../../shared/clone.js'

function ensureRuntimeSession(caseId, {
  getWorkspaceCase,
  getRuntimeSession,
  createRuntimeSession,
  registerRuntimeSession,
} = {}) {
  const caseDef = getWorkspaceCase(caseId)
  const existing = getRuntimeSession(caseDef.id)
  if (existing) return existing
  const session = createRuntimeSession(caseDef)
  return registerRuntimeSession(caseDef.id, session)
}

function registerWorkspaceCaseOverride(caseId, caseDef, {
  registerWorkspaceCaseOverrideImpl,
  disposeRuntimeSession,
} = {}) {
  const registered = registerWorkspaceCaseOverrideImpl(caseId, caseDef)
  if (!registered) return null
  disposeRuntimeSession(caseId)
  return registered
}

function registerWorkspaceProviderEnvironment(caseId, providerEnvironment = 'mixed', {
  registerWorkspaceCaseProviderEnvironmentImpl,
  disposeRuntimeSession,
} = {}) {
  const registered = registerWorkspaceCaseProviderEnvironmentImpl(caseId, providerEnvironment)
  if (!registered) return null
  disposeRuntimeSession(caseId)
  return registered
}

function createInitialSessionState(caseId, {
  getWorkspaceCase,
  buildWorkspaceComposition,
  cloneWorkspaceComposition,
  ensureRuntimeSession,
  createInitialSessionStateFromCase,
  buildEvidenceEntry,
  syncWorkspaceGlobalFilters,
} = {}) {
  const caseDef = getWorkspaceCase(caseId)
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

function buildAppSnapshot(state, {
  buildAppSnapshotFromState,
  getRuntimeSession,
} = {}) {
  return buildAppSnapshotFromState(state, {
    getRuntimeSession,
  })
}

export {
  buildAppSnapshot,
  createInitialSessionState,
  ensureRuntimeSession,
  registerWorkspaceCaseOverride,
  registerWorkspaceProviderEnvironment,
}
