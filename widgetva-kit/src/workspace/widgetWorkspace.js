import { cloneJsonValue as clone } from '../shared/clone.js'
import {
  buildTraceGraphFromStore,
  listBranchesFromStore,
  listResponsesFromStore,
  listStateSnapshotsFromStore,
  readCurrentSnapshotMetaFromStore,
  readInteractionTraceFromStore,
  readLatestResponseFromStore,
  readSnapshotFromStore,
  readWorkspaceDescriptionFromStore,
} from './store/workspaceStoreReaders.js'
import { updateSharedStateInStore } from './state/workspaceSharedStateMutators.js'
import {
  describeWorkspaceComposition,
  getWorkspaceLink,
  listWorkspaceLinks,
  readWorkspaceLinkTopology,
  registerWorkspaceLink,
  removeWorkspaceLink,
} from './coordination/workspaceLinkOperations.js'
import { readFocusState } from './state/focusStateModel.js'
import { deriveHighlightState } from './state/highlightStateModel.js'
import { deriveGlobalFiltersFromSelection } from './state/sharedStateDerivation.js'
import {
  readActiveAnalyticalContext as readActiveAnalyticalContextFromState,
  readSharedAnalyticalState as readSharedAnalyticalStateFromState,
  readSharedFilterContext as readSharedFilterContextFromState,
  readSharedSemanticFocus as readSharedSemanticFocusFromState,
  readSharedStructuralContext as readSharedStructuralContextFromState,
  readSharedTransformationContext as readSharedTransformationContextFromState,
  readSharedViewContext as readSharedViewContextFromState,
  readSharedViewportContext as readSharedViewportContextFromState,
  readViewStatesByWidget as readViewStatesByWidgetFromState,
} from './state/sharedAnalyticalStateModel.js'
import { buildCoordinationStateFromWorkspaceState } from './state/coordinationStateModel.js'
import {
  buildCoordinationOperationResult as buildCoordinationOperationResultPayload,
  buildCoordinationResult,
  buildEmptyComputedPropagationSummary,
  buildEmptyCoordinationOperationResult,
} from './coordinationOperationResult.js'
import { buildPropagationSummary } from './coordination/linkPropagationSummary.js'
import {
  clearGlobalFilters as clearGlobalFiltersOperation,
  clearHighlightState as clearHighlightStateOperation,
  clearSelectionState as clearSelectionStateOperation,
  commitClearHighlightState as commitClearHighlightStateOperation,
  commitPrimarySelectionToGlobalFilters as commitPrimarySelectionToGlobalFiltersOperation,
  commitPrimarySelectionToHighlight as commitPrimarySelectionToHighlightOperation,
  promotePrimarySelectionToGlobalFilters as promotePrimarySelectionToGlobalFiltersOperation,
  promotePrimarySelectionToHighlight as promotePrimarySelectionToHighlightOperation,
  setFocusedWidget as setFocusedWidgetOperation,
  setGlobalFilters as setGlobalFiltersOperation,
  setHighlightState as setHighlightStateOperation,
  setSelectionPrimary as setSelectionPrimaryOperation,
  setSelectionRegistry as setSelectionRegistryOperation,
  setSelectionViewsByWidget as setSelectionViewsByWidgetOperation,
  syncGlobalFiltersFromControlState as syncGlobalFiltersFromControlStateOperation,
  syncPrimarySelectionEntry as syncPrimarySelectionEntryOperation,
  upsertSelectionEntry as upsertSelectionEntryOperation,
} from './coordination/workspaceCoordinationOperations.js'
import { readObservation as readObservationFromContext } from '../core/agent/context/observation.js'

export const WIDGET_WORKSPACE_PUBLIC_METHODS = [
  'listWidgetDescriptions',
  'listWidgets',
  'getWidget',
  'registerWidget',
  'removeWidget',
  'listLinks',
  'getLink',
  'registerLink',
  'removeLink',
  'describe',
  'describeWorkspace',
  'describeComposition',
  'readView',
  'readState',
  'readObservation',
  'setViewSnapshotProvider',
  'readCoordinationState',
  'readSharedAnalyticalState',
  'readSharedFilterContext',
  'readSharedViewportContext',
  'readSharedSemanticFocus',
  'readSharedStructuralContext',
  'readActiveAnalyticalContext',
  'readViewStatesByWidget',
  'readSharedViewContext',
  'readSharedTransformationContext',
  'readPropagationSummary',
  'readComputedPropagationSummary',
  'readComputedCoordinationResult',
  'buildCoordinationOperationResult',
  'commitCoordinationOperationResult',
  'readLatestCoordinationResult',
  'readFocusState',
  'readHighlightState',
  'readFocusedWidget',
  'readFocusedWidgetId',
  'readSelectionState',
  'readGlobalFilters',
  'readCoordinationControlState',
  'readControlProjection',
  'buildGlobalFiltersFromControlState',
  'syncGlobalFiltersFromControlState',
  'setLatestCoordinationResult',
  'clearLatestCoordinationResult',
  'resetEphemeralCoordinationState',
  'setHighlightState',
  'clearHighlightState',
  'commitClearHighlightState',
  'setSelectionPrimary',
  'setSelectionViewsByWidget',
  'setSelectionRegistry',
  'upsertSelectionEntry',
  'syncPrimarySelectionEntry',
  'promotePrimarySelectionToGlobalFilters',
  'commitPrimarySelectionToGlobalFilters',
  'promotePrimarySelectionToHighlight',
  'commitPrimarySelectionToHighlight',
  'clearSelectionState',
  'setFocusedWidget',
  'setGlobalFilters',
  'clearGlobalFilters',
  'readStateHistory',
  'listBranches',
  'readCurrentSnapshotMeta',
  'readTraceGraph',
  'readLatestAgentResponse',
  'listAgentResponses',
  'readWidgetState',
  'readLinkTopology',
  'executeAction',
  'executeActionAndCommitCoordination',
  'queryPerception',
  'runDataQuery',
  'readTrace',
  'jumpToState',
  'jumpToStateAndClearLatestCoordinationResult',
  'branchFromState',
  'getTrace',
  'readSnapshot',
  'replay',
  'dispose',
]

function makeCallId(prefix = 'workspace_call') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function uniqueRefs(values = []) {
  return values.filter((value, index) => typeof value === 'string' && value.length > 0 && values.indexOf(value) === index)
}

function defaultControlStateAdapter() {
  return {
    deriveCoordinationControlState({
      globalFilters = {},
      primarySelection = null,
      focusedWidgetId = null,
    } = {}) {
      return {
        globalFilters: clone(globalFilters || {}),
        primarySelection: clone(primarySelection || null),
        focusedWidgetId: focusedWidgetId || null,
      }
    },
    deriveControlProjection(controlState = {}, {
      fallbackSelectedWidgetId = null,
    } = {}) {
      return {
        focusedWidgetId: controlState?.focusedWidgetId || fallbackSelectedWidgetId || null,
        globalFilters: clone(controlState?.globalFilters || {}),
        primarySelection: clone(controlState?.primarySelection || null),
      }
    },
    deriveGlobalFiltersFromControlState(controlState = {}) {
      if (controlState?.globalFilters && typeof controlState.globalFilters === 'object' && !Array.isArray(controlState.globalFilters)) {
        return clone(controlState.globalFilters)
      }
      return {}
    },
    deriveGlobalFiltersFromSelection(primarySelection = null, { rangeDomains = {} } = {}) {
      return deriveGlobalFiltersFromSelection(primarySelection, { rangeDomains })
    },
  }
}

function resolveSharedRuntime(widgets = [], explicitRuntime = null) {
  if (explicitRuntime) return explicitRuntime
  const runtimes = widgets
    .map((widget) => widget?.runtime || null)
    .filter(Boolean)

  if (runtimes.length === 0) {
    throw new Error('WidgetWorkspace requires either a runtime or at least one widget instance.')
  }

  const [firstRuntime] = runtimes
  const mismatchedRuntime = runtimes.find((runtime) => runtime !== firstRuntime)
  if (mismatchedRuntime) {
    throw new Error('WidgetWorkspace requires all widget instances to share the same runtime.')
  }

  return firstRuntime
}

function uniqueWidgets(widgets = []) {
  const seen = new Set()
  const result = []
  for (const widget of widgets) {
    const key = widget?.resolveWidgetRef?.() || widget?.resolveWidgetId?.() || null
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(widget)
  }
  return result
}

export class WidgetWorkspace {
  constructor({
    widgets = [],
    links = [],
    runtime = null,
    disposeWidgetsOnDispose = false,
    controlStateAdapter = null,
    viewSnapshotProvider = null,
  } = {}) {
    this.widgets = uniqueWidgets(widgets)
    this.runtime = resolveSharedRuntime(this.widgets, runtime)
    this.disposeWidgetsOnDispose = disposeWidgetsOnDispose
    this.controlStateAdapter = {
      ...defaultControlStateAdapter(),
      ...(controlStateAdapter && typeof controlStateAdapter === 'object' ? controlStateAdapter : {}),
    }
    // Optional renderer/browser capability. The provider must return a
    // normalized view payload (for example { image: { ref, mimeType, data } })
    // synchronously for the current committed runtime state. Keeping this at
    // the workspace boundary lets every Kit agent consumer share screenshot
    // capture without coupling the agent loop to a particular renderer.
    this.viewSnapshotProvider = typeof viewSnapshotProvider === 'function'
      ? viewSnapshotProvider
      : null
    this.links = []
    this.latestCoordinationResult = null

    for (const link of links) {
      this.registerLink(link)
    }
  }

  static describeContract() {
    return {
      methods: [...WIDGET_WORKSPACE_PUBLIC_METHODS],
      constructorOptions: {
        widgets: 'optional initial widget instances sharing one runtime',
        links: 'optional initial coordination links to register on the shared runtime',
        runtime: 'optional explicit shared runtime if widgets are added later',
        disposeWidgetsOnDispose: 'whether workspace.dispose() should also dispose registered widgets',
        controlStateAdapter: 'optional app-level adapter for mapping workspace coordination state to human control-state bindings and back',
        viewSnapshotProvider: 'optional renderer/browser adapter invoked by readObservation() to attach the current visual snapshot/image to agent observation; may return the payload directly or a Promise',
      },
      composition: {
        widgets: 'workspace registers and resolves widget instances by ref or widgetId',
        links: 'workspace registers coordination links and exposes topology summaries',
        actions: 'workspace-level executeAction/queryPerception delegate through the shared runtime public API',
      },
      coordinationState: {
        sharedAnalyticalState: 'canonical workspace-level shared analytical state bundle, including shared sub-contexts for filter, viewport, semantic focus, structural context, shared view, and shared transformations',
        sharedFilterContext: 'stable read surface for the shared filtering context that subsequent analysis turns should inherit',
        sharedViewportContext: 'stable read surface for the shared viewport/focus region that subsequent analysis turns should inherit',
        sharedSemanticFocus: 'stable read surface for the workspace-shared focus/selection/highlight context',
        sharedStructuralContext: 'stable read surface for shared structural comparison context, including links and comparison targets',
        sharedViewContext: 'workspace-level summary of currently active widget view-state overrides',
        sharedTransformationContext: 'workspace-level summary of view/data/structure transformations that affect later analysis turns',
        activeAnalyticalContext: 'compact workspace-level summary of which shared analytical contexts are currently active',
        focusedWidget: 'workspace-level focus target',
        focus: 'derived convenience read exposing normalized focus metadata',
        selections: {
          registry: 'canonical shared selection registry',
          views: {
            primary: 'workspace primary-selection convenience view',
            byWidget: 'widget/source-grouped selection convenience view',
          },
        },
        globalFilters: 'workspace-level shared filter state',
        highlight: 'derived convenience read exposing cross-widget highlight feedback summaries',
        links: {
          definitions: 'canonical registered workspace link definitions with explicit kind, effect, activationPolicy, effectConstraint, and optional advanced responseSpec',
          topology: 'derived coordination topology read surface built from registered links and widget descriptions',
        },
        latestCoordinationResult: 'ephemeral workspace-level runtime result bundle for the most recent coordination-driving interaction',
        computedPropagationSummary: 'canonical workspace-owned read surface for the current computed propagation summary, with stable empty defaults',
      },
      coordinationWrites: {
        highlight: 'workspace can set or clear shared highlight state separately from selection and filters',
        selection: 'workspace can upsert a canonical shared selection entry and optionally promote it to primary focus',
        controlState: 'workspace can derive UI-facing control/binding state from canonical coordination state and sync canonical filters back from that control state',
        selectionOperations: 'workspace can atomically clear or sync a canonical primary selection entry and commit the corresponding coordination operation result',
        promotionOperations: 'workspace can promote the current primary selection into canonical global-filter or highlight state and commit the resulting coordination operation bundle',
        actionOperations: 'workspace can execute an action through the shared runtime and, when successful, commit the resulting coordination operation bundle from the workspace layer',
        highlightOperations: 'workspace can clear shared highlight state and commit the resulting coordination operation bundle from the workspace layer',
        historyOperations: 'workspace can perform history jumps and clear stale ephemeral coordination results from the workspace layer',
        ephemeralOperations: 'workspace can explicitly reset ephemeral coordination read surfaces when a new first-party session view is initialized',
      },
    }
  }

  listWidgetDescriptions() {
    const descriptions = this.runtime?.store?.listWidgetDescriptions?.() || []
    if (descriptions.length > 0) return descriptions
    return this.listWidgets().map((widget) => widget?.describe?.()).filter(Boolean)
  }

  listWidgets() {
    return [...this.widgets]
  }

  getWidget(refOrId) {
    return this.widgets.find((widget) => {
      const description = widget?.describe?.() || null
      return (
        widget?.resolveWidgetRef?.() === refOrId
        || widget?.resolveWidgetId?.() === refOrId
        || description?.ref === refOrId
        || description?.widgetId === refOrId
      )
    }) || null
  }

  registerWidget(widget) {
    if (!widget) {
      throw new Error('WidgetWorkspace.registerWidget requires a widget instance.')
    }
    const widgetRuntime = widget?.runtime || null
    if (widgetRuntime && widgetRuntime !== this.runtime) {
      throw new Error('WidgetWorkspace.registerWidget requires widget instances to share the same runtime.')
    }
    this.widgets = uniqueWidgets([...this.widgets, widget])
    return widget
  }

  removeWidget(refOrId) {
    const existing = this.getWidget(refOrId)
    if (!existing) return null
    this.widgets = this.widgets.filter((widget) => widget !== existing)
    return existing
  }

  listLinks() {
    return listWorkspaceLinks(this)
  }

  getLink(refOrId) {
    return getWorkspaceLink(this, refOrId)
  }

  registerLink(link) {
    return registerWorkspaceLink(this, link)
  }

  removeLink(refOrId) {
    return removeWorkspaceLink(this, refOrId)
  }

  describe() {
    return this.runtime?.store
      ? readWorkspaceDescriptionFromStore(this.runtime.store)
      : null
  }

  describeWorkspace() {
    return this.describe()
  }

  describeComposition() {
    return describeWorkspaceComposition(this)
  }

  readState(options = {}) {
    return this.runtime?.store?.readState?.(options) || null
  }

  readView(options = {}) {
    return this.readState(options)
  }

  readObservation(options = {}) {
    const state = this.readState(options?.readStateOptions || options)
    const sharedAnalyticalState = this.readSharedAnalyticalState({ state })
    const suppliedView = options?.view && typeof options.view === 'object'
      ? options.view
      : {}
    const buildObservation = (providedView = null) => {
      const capturedView = providedView && typeof providedView === 'object' && !Array.isArray(providedView)
        ? { ...suppliedView, ...providedView }
        : suppliedView
      return readObservationFromContext({
        query: options?.query || null,
        describeWorkspace: () => this.describeWorkspace(),
        state,
        sharedAnalyticalState,
        view: Object.keys(capturedView).length > 0 ? capturedView : null,
        options,
      })
    }
    if (this.viewSnapshotProvider) {
      const provided = this.viewSnapshotProvider({
        workspace: this,
        state,
        sharedAnalyticalState,
        options,
      })
      if (provided && typeof provided.then === 'function') {
        return provided.then((resolvedView) => buildObservation(resolvedView))
      }
      return buildObservation(provided)
    }
    return buildObservation()
  }

  setViewSnapshotProvider(provider = null) {
    if (provider != null && typeof provider !== 'function') {
      throw new Error('WidgetWorkspace.setViewSnapshotProvider requires a function or null.')
    }
    this.viewSnapshotProvider = provider || null
    return this.viewSnapshotProvider
  }

  readCoordinationState() {
    return buildCoordinationStateFromWorkspaceState(this.readState() || {}, {
      currentBranchId: this.runtime?.store?.currentBranchId || null,
      derivedTopology: this.readLinkTopology(),
    })
  }

  readSharedAnalyticalState(options = {}) {
    const state = options?.state || this.readState() || {}
    return readSharedAnalyticalStateFromState(state, {
      derivedTopology: this.readLinkTopology(),
    })
  }

  readSharedFilterContext(options = {}) {
    const state = options?.state || this.readState() || {}
    return readSharedFilterContextFromState(state, {
      derivedTopology: this.readLinkTopology(),
    })
  }

  readSharedViewportContext(options = {}) {
    const state = options?.state || this.readState() || {}
    return readSharedViewportContextFromState(state, {
      derivedTopology: this.readLinkTopology(),
    })
  }

  readSharedSemanticFocus(options = {}) {
    const state = options?.state || this.readState() || {}
    return readSharedSemanticFocusFromState(state, {
      derivedTopology: this.readLinkTopology(),
    })
  }

  readSharedStructuralContext(options = {}) {
    const state = options?.state || this.readState() || {}
    return readSharedStructuralContextFromState(state, {
      derivedTopology: this.readLinkTopology(),
    })
  }

  readActiveAnalyticalContext(options = {}) {
    const state = options?.state || this.readState() || {}
    return readActiveAnalyticalContextFromState(state, {
      derivedTopology: this.readLinkTopology(),
    })
  }

  readViewStatesByWidget(options = {}) {
    const state = options?.state || this.readState() || {}
    return readViewStatesByWidgetFromState(state)
  }

  readSharedViewContext(options = {}) {
    const state = options?.state || this.readState() || {}
    return readSharedViewContextFromState(state)
  }

  readSharedTransformationContext(options = {}) {
    const state = options?.state || this.readState() || {}
    return readSharedTransformationContextFromState(state)
  }

  readPropagationSummary(options = {}) {
    return buildPropagationSummary({
      state: this.readState(),
      description: this.describeWorkspace(),
      coordinationEngine: this.runtime?.coordinationEngine || null,
      sourceRef: options?.sourceRef || null,
    })
  }

  readComputedPropagationSummary(options = {}) {
    const result = this.readComputedCoordinationResult(options)
    return clone(result?.propagationSummary || buildEmptyComputedPropagationSummary())
  }

  readComputedCoordinationResult(options = {}) {
    return buildCoordinationResult({
      state: this.readState(),
      description: this.describeWorkspace(),
      coordinationEngine: this.runtime?.coordinationEngine || null,
      store: this.runtime?.store || null,
      sourceRef: options?.sourceRef || null,
      resolveTargetWidget: (targetRef, targetWidgetId) => (
        (targetWidgetId ? this.getWidget(targetWidgetId) : null)
        || this.getWidget(targetRef)
        || null
      ),
    })
  }

  buildCoordinationOperationResult(options = {}) {
    const coordinationResult = this.readComputedCoordinationResult(options)
    return buildCoordinationOperationResultPayload({
      changed: options?.changed === true,
      coordinationState: this.readCoordinationState(),
      coordinationResult,
    })
  }

  commitCoordinationOperationResult(options = {}) {
    const result = this.buildCoordinationOperationResult(options)
    this.setLatestCoordinationResult(result)
    return result
  }

  readLatestCoordinationResult() {
    return clone(this.latestCoordinationResult)
  }

  readFocusedWidget() {
    const focusedWidgetRef = this.readCoordinationState().focusedWidgetRef
    return focusedWidgetRef ? this.getWidget(focusedWidgetRef) : null
  }

  readFocusedWidgetId() {
    const focusedWidget = this.readFocusedWidget()
    return focusedWidget?.resolveWidgetId?.()
      || focusedWidget?.describe?.()?.widgetId
      || null
  }

  readFocusState() {
    const state = this.readState() || {}
    const focusState = readFocusState(state?.shared || {}, state?.widgets || {})
    if (!focusState?.widgetRef || focusState?.widgetId) return focusState
    const focusedWidget = this.getWidget(focusState.widgetRef)
    return {
      ...focusState,
      widgetId: focusedWidget?.resolveWidgetId?.() || focusedWidget?.describe?.()?.widgetId || null,
    }
  }

  readHighlightState() {
    return deriveHighlightState(this.readState() || {})
  }

  readSelectionState() {
    const coordination = this.readCoordinationState()
    return coordination.selections
  }

  readGlobalFilters() {
    return this.readCoordinationState().globalFilters
  }

  readCoordinationControlState({ rangeDomains = {} } = {}) {
    const coordination = this.readCoordinationState()
    return this.controlStateAdapter.deriveCoordinationControlState({
      globalFilters: coordination?.globalFilters || {},
      primarySelection: coordination?.selections?.views?.primary || null,
      focusedWidgetId: this.readFocusedWidget()?.resolveWidgetId?.()
        || this.readFocusedWidget()?.describe?.()?.widgetId
        || null,
      rangeDomains,
    })
  }

  readControlProjection({
    rangeDomains = {},
    fallbackSelectedWidgetId = null,
  } = {}) {
    return this.controlStateAdapter.deriveControlProjection(
      this.readCoordinationControlState({ rangeDomains }),
      { fallbackSelectedWidgetId },
    )
  }

  buildGlobalFiltersFromControlState(controlState = {}, { rangeDomains = {} } = {}) {
    return this.controlStateAdapter.deriveGlobalFiltersFromControlState(controlState, { rangeDomains })
  }

  syncGlobalFiltersFromControlState(controlState = {}, { rangeDomains = {} } = {}) {
    return syncGlobalFiltersFromControlStateOperation(this, controlState, { rangeDomains })
  }

  setLatestCoordinationResult(result = null) {
    this.latestCoordinationResult = result == null ? null : clone(result)
    return this.readLatestCoordinationResult()
  }

  clearLatestCoordinationResult() {
    this.latestCoordinationResult = null
    return null
  }

  resetEphemeralCoordinationState() {
    this.clearLatestCoordinationResult()
    return {
      latestCoordinationResult: null,
    }
  }

  setHighlightState(highlight = null) {
    return setHighlightStateOperation(this, highlight)
  }

  clearHighlightState() {
    return clearHighlightStateOperation(this)
  }

  commitClearHighlightState(options = {}) {
    return commitClearHighlightStateOperation(this, options)
  }

  setSelectionPrimary(selection = null) {
    return setSelectionPrimaryOperation(this, selection)
  }

  setSelectionViewsByWidget(selectionViewsByWidget = {}) {
    return setSelectionViewsByWidgetOperation(this, selectionViewsByWidget)
  }

  setSelectionRegistry(selectionRegistry = {}) {
    return setSelectionRegistryOperation(this, selectionRegistry)
  }

  upsertSelectionEntry(selectionEntry, options = {}) {
    return upsertSelectionEntryOperation(this, selectionEntry, options)
  }

  syncPrimarySelectionEntry(selectionEntry = null, options = {}) {
    return syncPrimarySelectionEntryOperation(this, selectionEntry, options)
  }

  clearSelectionState() {
    return clearSelectionStateOperation(this)
  }

  promotePrimarySelectionToGlobalFilters(options = {}) {
    return promotePrimarySelectionToGlobalFiltersOperation(this, options)
  }

  commitPrimarySelectionToGlobalFilters(options = {}) {
    return commitPrimarySelectionToGlobalFiltersOperation(this, options)
  }

  promotePrimarySelectionToHighlight(options = {}) {
    return promotePrimarySelectionToHighlightOperation(this, options)
  }

  commitPrimarySelectionToHighlight(options = {}) {
    return commitPrimarySelectionToHighlightOperation(this, options)
  }

  resolveWorkspaceWidgetRef(refOrId, { allowNull = false } = {}) {
    if (refOrId == null || refOrId === '') {
      if (allowNull) return null
      throw new Error('WidgetWorkspace requires a widget ref or widgetId.')
    }
    const widget = this.getWidget(refOrId)
    if (!widget) {
      throw new Error(`Unknown widget in workspace: ${refOrId}`)
    }
    return widget.resolveWidgetRef?.() || widget.describe?.()?.ref || refOrId
  }

  resolveWorkspaceWidgetRefs(refs = []) {
    if (!Array.isArray(refs)) {
      throw new Error('WidgetWorkspace requires an array of widget refs or widgetIds.')
    }
    return uniqueRefs(refs.map((ref) => this.resolveWorkspaceWidgetRef(ref)))
  }

  updateSharedCoordinationState(updater) {
    return updateSharedStateInStore(this.runtime?.store, updater)
  }

  setFocusedWidget(refOrId) {
    return setFocusedWidgetOperation(this, refOrId)
  }

  setGlobalFilters(globalFilters = {}) {
    return setGlobalFiltersOperation(this, globalFilters)
  }

  clearGlobalFilters() {
    return clearGlobalFiltersOperation(this)
  }

  readStateHistory(options = {}) {
    return listStateSnapshotsFromStore(this.runtime?.store, options)
  }

  listBranches() {
    return listBranchesFromStore(this.runtime?.store)
  }

  readCurrentSnapshotMeta() {
    return readCurrentSnapshotMetaFromStore(this.runtime?.store)
  }

  readTraceGraph(options = {}) {
    return buildTraceGraphFromStore(this.runtime?.store, options)
  }

  readLatestAgentResponse(options = {}) {
    return readLatestResponseFromStore(this.runtime?.store, {
      workspaceId: options.workspaceId || this.describe()?.workspaceId || null,
    })
  }

  listAgentResponses(options = {}) {
    return listResponsesFromStore(
      this.runtime?.store,
      options.limit || 20,
      {
        workspaceId: options.workspaceId || this.describe()?.workspaceId || null,
      },
    )
  }

  readWidgetState(refOrId) {
    const widget = this.getWidget(refOrId)
    return widget?.readState?.() || null
  }

  readLinkTopology() {
    return readWorkspaceLinkTopology(this)
  }

  async executeAction(call) {
    if (!call || typeof call !== 'object') {
      throw new Error('WidgetWorkspace.executeAction requires an action call object.')
    }
    const executeAction = this.runtime?.executeAction
    if (typeof executeAction !== 'function') {
      throw new Error('WidgetWorkspace.executeAction requires a runtime with executeAction support.')
    }
    return executeAction({
      actor: call.actor || 'agent',
      callId: call.callId || makeCallId('workspace_action'),
      ...call,
    })
  }

  async executeActionAndCommitCoordination(call, options = {}) {
    const result = await this.executeAction(call)
    if (!result?.ok) return result
    const propagationSourceRef = result?.result?.propagationSourceRef || null
    return {
      ...result,
      coordinationResult: this.commitCoordinationOperationResult({
        ...options,
        changed: options?.changed !== false,
        ...(propagationSourceRef ? { sourceRef: propagationSourceRef } : {}),
      }),
    }
  }

  async queryPerception(call) {
    if (!call || typeof call !== 'object') {
      throw new Error('WidgetWorkspace.queryPerception requires a perception call object.')
    }
    const queryPerception = this.runtime?.queryPerception
    if (typeof queryPerception !== 'function') {
      throw new Error('WidgetWorkspace.queryPerception requires a runtime with queryPerception support.')
    }
    return queryPerception({
      actor: call.actor || 'agent',
      callId: call.callId || makeCallId('workspace_perception'),
      ...call,
    })
  }

  async runDataQuery(call) {
    if (!call || typeof call !== 'object') {
      throw new Error('WidgetWorkspace.runDataQuery requires a data-query call object.')
    }
    const runDataQuery = this.runtime?.runDataQuery
      || this.runtime?.queryData
    if (typeof runDataQuery !== 'function') {
      throw new Error('WidgetWorkspace.runDataQuery requires a runtime with data-query support.')
    }
    return runDataQuery({
      actor: call.actor || 'agent',
      callId: call.callId || makeCallId('workspace_data_query'),
      ...call,
    })
  }

  readTrace(options = {}) {
    return this.getTrace(options)
  }

  getTrace(options = {}) {
    return readInteractionTraceFromStore(this.runtime?.store, options)
  }

  readSnapshot(stateId, options = {}) {
    return readSnapshotFromStore(this.runtime?.store, stateId, options)
  }

  async replay(stateId) {
    return this.jumpToState(typeof stateId === 'string' ? { stateId } : stateId)
  }

  async jumpToState(options = {}) {
    const normalizedOptions = typeof options === 'string' ? { stateId: options } : (options || {})
    const executeAction = this.runtime?.executeAction
    if (typeof executeAction !== 'function') {
      throw new Error('WidgetWorkspace.jumpToState requires a runtime with executeAction support.')
    }
    return executeAction({
      callId: normalizedOptions.callId || makeCallId('workspace_replay'),
      actor: normalizedOptions.actor || 'agent',
      name: 'workspace.jumpToState',
      params: { stateId: normalizedOptions.stateId || null },
    })
  }

  async jumpToStateAndClearLatestCoordinationResult(options = {}) {
    const result = await this.jumpToState(options)
    this.clearLatestCoordinationResult()
    return result
  }

  async branchFromState(options = {}) {
    const normalizedOptions = options && typeof options === 'object' ? options : {}
    const executeAction = this.runtime?.executeAction
    if (typeof executeAction !== 'function') {
      throw new Error('WidgetWorkspace.branchFromState requires a runtime with executeAction support.')
    }
    return executeAction({
      callId: normalizedOptions.callId || makeCallId('workspace_branch'),
      actor: normalizedOptions.actor || 'agent',
      name: 'workspace.branchFromState',
      params: {
        stateId: normalizedOptions.stateId || null,
        branchLabel: normalizedOptions.branchLabel || null,
      },
    })
  }

  dispose() {
    if (this.disposeWidgetsOnDispose) {
      for (const widget of this.widgets) {
        widget?.dispose?.()
      }
    }
    this.widgets = []
    this.links = []
  }
}

export function createWidgetWorkspace(options = {}) {
  return new WidgetWorkspace(options)
}
