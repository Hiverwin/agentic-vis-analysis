import {
  buildWidgetVAEmptyCoordinationResult,
  buildWidgetVAEmptyPropagationSummary,
} from 'widgetva-kit'
import { cloneJsonValue as clone } from '../../shared/clone.js'
import { buildWorkspaceSelectionEntry } from './selectionAdapter.js'
import {
  buildFirstPartyControlState,
  deriveFirstPartyControlFilterPatch,
  buildFirstPartyRangeDomains,
} from './workspaceControlStateAdapter.js'

function resolveWorkspaceWidgetIdFromRef(caseId, widgetRef = null, { getRuntimeSession } = {}) {
  if (typeof widgetRef !== 'string' || widgetRef.length === 0) return null
  const description = clone(getRuntimeSession(caseId)?.runtime?.describeWorkspace?.() || null)
  const matchedWidget = Array.isArray(description?.widgets)
    ? description.widgets.find((widget) => widget?.ref === widgetRef || widget?.widgetId === widgetRef)
    : null
  return matchedWidget?.widgetId || null
}

function buildSelectionOperationResult(caseId, { changed = false } = {}, {
  getRuntimeSession,
  readWorkspaceCoordinationState,
} = {}) {
  const session = getRuntimeSession(caseId)
  return session?.workspace?.buildCoordinationOperationResult({ changed })
    || buildWidgetVAEmptyCoordinationResult({
      changed,
      coordinationState: readWorkspaceCoordinationState(caseId),
    })
}

function buildWorkspaceGlobalFilters(state = {}, {
  buildWorkspaceGlobalFiltersImpl,
  getRuntimeSession,
} = {}) {
  return buildWorkspaceGlobalFiltersImpl(state, {
    getRuntimeSession,
  })
}

function syncWorkspaceGlobalFilters(caseId, state = {}, {
  getRuntimeSession,
  buildWorkspaceGlobalFilters,
} = {}) {
  const session = getRuntimeSession(caseId)
  if (!session?.workspace) return {}
  return session.workspace.syncGlobalFiltersFromControlState(
    buildFirstPartyControlState(state),
    {
      rangeDomains: buildFirstPartyRangeDomains(state),
    },
  )
}

function readSelectionPropagationSummary(caseId, { getRuntimeSession } = {}) {
  const session = getRuntimeSession(caseId)
  return clone(session?.workspace?.readComputedPropagationSummary?.() || buildWidgetVAEmptyPropagationSummary())
}

function syncWorkspacePrimarySelectionResult(caseId, selection = null, {
  getRuntimeSession,
  buildSelectionOperationResult,
} = {}) {
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

function promotePrimarySelectionToGlobalFilters(caseId, state = {}, {
  getRuntimeSession,
  readWorkspaceCoordinationState,
} = {}) {
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
    nextFilterState: deriveFirstPartyControlFilterPatch(result.globalFilterPatch || {}),
  }
}

function promotePrimarySelectionToHighlight(caseId, {
  getRuntimeSession,
  readWorkspaceCoordinationState,
} = {}) {
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

function clearWorkspaceHighlight(caseId, {
  getRuntimeSession,
  readWorkspaceCoordinationState,
} = {}) {
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

async function executeWorkspaceAction(caseId, {
  widgetId = null,
  name,
  params = {},
} = {}, { getRuntimeSession } = {}) {
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
      ...(widgetRef ? { target: { widgetRef } } : {}),
    })
  } finally {
    session.setActiveWidgetId?.(previousActiveWidgetId)
  }
}

async function executeAgentWorkspaceAction(caseId, call = {}, {
  getRuntimeSession,
  executeWorkspaceAction,
} = {}) {
  if (!call || typeof call !== 'object') {
    throw new Error('executeAgentWorkspaceAction requires a valid action call object.')
  }
  const widgetRef = call?.target?.widgetRef || null
  const widgetId = resolveWorkspaceWidgetIdFromRef(caseId, widgetRef, { getRuntimeSession })
  return executeWorkspaceAction(caseId, {
    widgetId,
    name: call.name,
    params: call.params || {},
  }, { getRuntimeSession })
}

export {
  buildSelectionOperationResult,
  buildWorkspaceGlobalFilters,
  clearWorkspaceHighlight,
  executeAgentWorkspaceAction,
  executeWorkspaceAction,
  promotePrimarySelectionToGlobalFilters,
  promotePrimarySelectionToHighlight,
  readSelectionPropagationSummary,
  syncWorkspaceGlobalFilters,
  syncWorkspacePrimarySelectionResult,
}
