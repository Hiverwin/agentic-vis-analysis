import { cloneJsonValue as clone } from '../shared/clone.js'
import {
  createWidgetVAViewAdapter,
  installWidgetVAOnView,
} from '../adapters/index.js'
import { makeWidgetRef } from '../contracts/refs-contracts.js'
import { createWidgetInstance } from '../core/rendering/widgetRuntimeSurface.js'
import { createWidgetVARuntime } from '../core/runtime/RuntimeOrchestrator.js'
import { createWidgetWorkspace } from '../workspace/widgetWorkspace.js'

function readWidgetId(widget = {}) {
  return widget?.id || widget?.widgetId || null
}

function listRuntimeWidgetDescriptions(runtime = null) {
  return typeof runtime?.store?.listWidgetDescriptions === 'function'
    ? runtime.store.listWidgetDescriptions()
    : []
}

function readProviderSpec(source = {}) {
  return source?.spec
    || source?.providerSpec?.spec
    || source?.providerSpec?.option
    || source?.providerSpec
    || {}
}

function createWorkspaceWidgetInstances({
  runtime,
  workspaceId,
  widgets = [],
} = {}) {
  return (Array.isArray(widgets) ? widgets : []).map((widget) => {
    const kind = widget?.kind || widget?.widgetKind || null
    if (typeof kind !== 'string' || kind.length === 0) return null
    const widgetId = widget?.widgetId || widget?.id || null
    if (!widgetId) return null
    const provider = widget?.provider || widget?.source?.providerSpec?.provider || widget?.source?.provider || 'vega-lite'
    const widgetRef = makeWidgetRef({
      workspaceId,
      widgetId,
    })
    return createWidgetInstance({
      runtime,
      widgetAdapter: createWidgetVAViewAdapter({ kind, provider }),
      widgetRef,
      widgetId,
      spec: readProviderSpec(widget?.source || {}),
    })
  }).filter(Boolean)
}

export function resolveWidgetRuntimeBinding(runtime, widget = {}) {
  const widgetId = readWidgetId(widget)
  const description = listRuntimeWidgetDescriptions(runtime).find((entry) => (
    entry?.widgetId === widgetId
    || entry?.ref === widget?.ref
    || entry?.ref === widget?.widgetRef
  )) || null
  const widgetRef = description?.ref || widget?.ref || widget?.widgetRef || null
  if (!widgetRef) return null
  return {
    widgetRef,
    widgetState: runtime?.store?.getWidgetState?.(widgetRef) || null,
    widgetAdapter: runtime?.store?.getWidgetAdapter?.(widgetRef) || null,
  }
}

export function createWidgetVAHost({
  runtime = null,
  onActionCall = null,
  installWidgetView = installWidgetVAOnView,
} = {}) {
  function createRuntimeSession({
    sessionId = 'widgetva-host-session',
    workspaceId = sessionId,
    workspaceSpec = {},
    links = null,
    controlStateAdapter = null,
    initialFocusedWidgetId = null,
    userIntent = '',
    runtime: explicitRuntime = null,
    viewSnapshotProvider = null,
    appId = 'widgetva-app',
  } = {}) {
    const sessionWorkspaceSpec = clone(workspaceSpec || {})
    const primaryWidgetId = sessionWorkspaceSpec?.widgets?.[0]?.widgetId || null
    const widgetSpecsById = Object.fromEntries(
      (sessionWorkspaceSpec?.widgets || []).map((widget) => [
        widget.widgetId,
        clone(readProviderSpec(widget?.source || {})),
      ]),
    )
    const baselineSpecsById = Object.fromEntries(
      Object.entries(widgetSpecsById).map(([widgetId, spec]) => [widgetId, clone(spec)]),
    )
    const sessionState = {
      workspaceSpec: sessionWorkspaceSpec,
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
        const providerSpec = widgetDef.source.providerSpec && typeof widgetDef.source.providerSpec === 'object'
          ? {
              ...widgetDef.source.providerSpec,
              spec: clone(spec),
            }
          : widgetDef.source.providerSpec
        widgetDef.source = {
          ...widgetDef.source,
          spec: clone(spec),
          ...(providerSpec ? { providerSpec } : {}),
        }
      }
    }
    const resetWidgetSpec = (widgetId) => {
      if (!widgetId) return
      setWidgetSpec(widgetId, sessionState.baselineSpecsById[widgetId] || null)
    }
    const hostBridge = {
      subscribe: () => () => {},
      readSessionId: () => sessionId,
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
      readUserIntent: () => userIntent || '',
      readCurrentSelection,
      readCurrentSelections: readSelectionRegistry,
      readSelectionRegistry,
      readPrimarySelectionRef: () => readPrimarySelection()?.selectionRef || null,
      readFocusedWidgetRef: () => readCoordinationState()?.focusedWidgetRef || null,
      readSharedFilters: () => clone(readCoordinationState()?.globalFilters || {}),
      readViewportState: () => clone(readCoordinationState()?.viewport || {}),
      readWorkspaceAnnotations: () => clone(readCoordinationState()?.annotations || []),
    }

    const sessionRuntime = explicitRuntime || createWidgetVARuntime({
      appId,
      registerDefaultWidgetFamilies: true,
      hostBridge,
    })
    const widgetInstances = createWorkspaceWidgetInstances({
      runtime: sessionRuntime,
      workspaceId,
      widgets: sessionWorkspaceSpec?.widgets || [],
    })
    workspace = createWidgetWorkspace({
      runtime: sessionRuntime,
      widgets: widgetInstances,
      links: Array.isArray(links) ? links : (sessionWorkspaceSpec?.links || []),
      ...(controlStateAdapter ? { controlStateAdapter } : {}),
      ...(viewSnapshotProvider ? { viewSnapshotProvider } : {}),
    })
    if (initialFocusedWidgetId) {
      workspace.setFocusedWidget(initialFocusedWidgetId)
      sessionRuntime.runtimeManager?.seedRecoverableState?.(sessionRuntime.readState?.())
    }

    return {
      runtime: sessionRuntime,
      runtimeManager: sessionRuntime.runtimeManager,
      hostBridge,
      workspace,
      widgets: widgetInstances,
      workspaceSpec: sessionState.workspaceSpec,
      activeWidgetId: primaryWidgetId,
      setActiveWidgetId(widgetId) {
        sessionState.activeWidgetId = widgetId || primaryWidgetId
        this.activeWidgetId = sessionState.activeWidgetId
      },
      setViewSnapshotProvider(provider = null) {
        workspace.setViewSnapshotProvider(provider)
        this.viewSnapshotProvider = provider
        return provider
      },
      trace: [],
      agentMessages: [],
      dispose() {
        widgetInstances.forEach((widget) => widget?.dispose?.())
        workspace.dispose?.()
        if (!explicitRuntime) {
          sessionRuntime.dispose?.()
        }
      },
    }
  }

  async function mountWidgetView({
    widget = null,
    view = null,
    spec = null,
    provider = null,
  } = {}) {
    const binding = resolveWidgetRuntimeBinding(runtime, widget || {})
    if (!view || !binding?.widgetRef || !binding?.widgetState || !binding?.widgetAdapter) {
      return null
    }

    return installWidgetView({
      runtime,
      view,
      widgetRef: binding.widgetRef,
      widgetState: binding.widgetState,
      widgetAdapter: binding.widgetAdapter,
      provider: provider || widget?.provider || widget?.source?.providerSpec?.provider || 'vega-lite',
      spec,
      selectionSourceWidgetId: readWidgetId(widget || {}),
      actionTargetRef: binding.widgetRef,
      onActionCall,
      bindHumanInteractions: true,
    })
  }

  return {
    createRuntimeSession,
    mountWidgetView,
  }
}
