import { createWidgetWorkspace } from '../../../../widgetva-kit/src/workspace.js'
import { createWidgetVARuntime } from '../../../../widgetva-kit/src/core.js'
import { buildRuntimeWorkspaceSpec, createWidgetInstances } from './runtimeWorkspaceAdapter.js'
import { buildWorkspaceComposition } from './workspaceComposition.js'
import { buildFirstPartyWorkspaceControlStateAdapter } from './workspaceControlStateAdapter.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function createRuntimeSession(caseDef) {
  const workspaceSpec = clone(buildRuntimeWorkspaceSpec(caseDef))
  const primaryWidgetId = workspaceSpec?.widgets?.[0]?.widgetId || null
  const widgetSpecsById = Object.fromEntries(
    (workspaceSpec?.widgets || []).map((widget) => [widget.widgetId, clone(widget?.source?.spec || null)]),
  )
  const baselineSpecsById = Object.fromEntries(
    Object.entries(widgetSpecsById).map(([widgetId, spec]) => [widgetId, clone(spec)]),
  )
  const sessionState = {
    workspaceSpec,
    widgetSpecsById,
    baselineSpecsById,
    activeWidgetId: primaryWidgetId,
  }
  let workspace = null
  const readCoordinationState = () => workspace?.readCoordinationState?.() || null
  const readPrimarySelection = () => readCoordinationState()?.selections?.views?.primary || null
  const readSelectionRegistry = () => clone(readCoordinationState()?.selections?.registry || {})
  const readCurrentSelection = () => {
    const primary = readPrimarySelection()
    if (!primary?.selectionRef) return null
    return readSelectionRegistry()?.[primary.selectionRef] || null
  }

  const getActiveWidgetId = () => sessionState.activeWidgetId || primaryWidgetId
  const getWidgetSpec = (widgetId) => clone(sessionState.widgetSpecsById[widgetId] || null)
  const setWidgetSpec = (widgetId, spec) => {
    if (!widgetId) return
    sessionState.widgetSpecsById[widgetId] = clone(spec)
    const widgetDef = sessionState.workspaceSpec?.widgets?.find((widget) => widget?.widgetId === widgetId)
    if (widgetDef?.source) {
      widgetDef.source = {
        ...widgetDef.source,
        spec: clone(spec),
      }
    }
  }
  const resetWidgetSpec = (widgetId) => {
    if (!widgetId) return
    setWidgetSpec(widgetId, sessionState.baselineSpecsById[widgetId] || null)
  }
  const hostBridge = {
    subscribe: () => () => {},
    readSessionId: () => caseDef?.id || 'widgetva-system-session',
    readBaselineSpec: () => getWidgetSpec(getActiveWidgetId()) || clone(sessionState.workspaceSpec?.widgets?.[0]?.source?.spec || null),
    readCurrentSpec: () => getWidgetSpec(getActiveWidgetId()) || clone(sessionState.workspaceSpec?.widgets?.[0]?.source?.spec || null),
    readWorkspaceSpec: () => clone(sessionState.workspaceSpec),
    writeCurrentSpec: (nextSpec) => {
      setWidgetSpec(getActiveWidgetId(), nextSpec)
    },
    resetCurrentSpec: () => {
      resetWidgetSpec(getActiveWidgetId())
    },
    writeWorkspaceSpec: (nextWorkspaceSpec) => {
      sessionState.workspaceSpec = clone(nextWorkspaceSpec)
    },
    readPlanningRequest: () => ({ runMode: 'goal_oriented' }),
    readRunMode: () => 'goal_oriented',
    readUserIntent: () => caseDef?.summary || '',
    readCurrentSelection,
    readCurrentSelections: readSelectionRegistry,
    readSelectionRegistry,
    readPrimarySelectionRef: () => readPrimarySelection()?.selectionRef || null,
    readFocusedWidgetRef: () => readCoordinationState()?.focusedWidgetRef || null,
    readSharedFilters: () => clone(readCoordinationState()?.globalFilters || {}),
    readViewportState: () => clone(readCoordinationState()?.viewport || {}),
    readWorkspaceAnnotations: () => clone(readCoordinationState()?.annotations || []),
  }

  const runtime = createWidgetVARuntime({
    registerDefaultWidgetFamilies: true,
    hostBridge,
  })
  const widgetInstances = createWidgetInstances(runtime, caseDef)
  workspace = createWidgetWorkspace({
    runtime,
    widgets: widgetInstances,
    links: buildWorkspaceComposition(caseDef).links || [],
    controlStateAdapter: buildFirstPartyWorkspaceControlStateAdapter(),
  })
  const initialFocusedWidgetId = buildWorkspaceComposition(caseDef).selectedWidgetId
  if (initialFocusedWidgetId) {
    workspace.setFocusedWidget(initialFocusedWidgetId)
    runtime.runtimeManager?.seedRecoverableState?.(runtime.readState?.())
  }
  return {
    runtime,
    runtimeManager: runtime.runtimeManager,
    hostBridge,
    workspace,
    widgets: widgetInstances,
    workspaceSpec: sessionState.workspaceSpec,
    activeWidgetId: primaryWidgetId,
    setActiveWidgetId(widgetId) {
      sessionState.activeWidgetId = widgetId || primaryWidgetId
      this.activeWidgetId = sessionState.activeWidgetId
    },
    trace: [],
    agentMessages: [],
    dispose() {
      widgetInstances.forEach((widget) => widget?.dispose?.())
      runtime.dispose?.()
      workspace.dispose?.()
    },
  }
}
