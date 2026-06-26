import {
  buildTraceGraphFromStore,
  listBranchesFromStore,
  listResponsesFromStore,
  listStateSnapshotsFromStore,
  readCurrentSnapshotMetaFromStore,
  readInteractionTraceFromStore,
  readLatestResponseFromStore,
  readSnapshotFromStore,
} from '../core/runtime/workspaceStoreReaders.js'
import { updateSharedStateInStore } from './state/workspaceSharedStateMutators.js'
import {
  normalizePrimarySelectionView,
  readSelectionByWidgetView,
  readSelectionPrimaryView,
  readSelectionRegistry,
  withSelectionSubmodel,
} from './state/selectionStateModel.js'
import {
  readLinkDefinitions,
  readLinkTopologyState,
  withLinkSubmodel,
} from './state/linkStateModel.js'
import { stripWidgetLinkCompatibilityFields } from '../core/protocol/widgetLinks.js'
import { readFocusState } from './state/focusStateModel.js'
import { deriveHighlightState, withHighlightSubmodel } from './state/highlightStateModel.js'
import { readViewportState } from './state/viewportStateModel.js'
import { deriveWorkspaceTopology } from '../core/runtime/deriveWorkspaceTopology.js'
import { makeLinkRef, parseRef } from '../core/protocol/refs.js'
import { makeWidgetLink } from '../core/protocol/widgetLinks.js'
import {
  deriveGlobalFiltersFromSelection,
  deriveHighlightStateFromSelection,
} from '../core/runtime/sharedStateDerivation.js'
import {
  buildCoordinationResult,
  buildPropagationSummary,
  buildRuntimeObservation,
} from '../core/runtime/agentFacingSurface.js'

export const WIDGET_WORKSPACE_PUBLIC_METHODS = [
  'listWidgetDescriptions',
  'listWidgets',
  'getWidget',
  'registerWidget',
  'removeWidget',
  'listActionNames',
  'listAvailableActions',
  'listPerceptionNames',
  'listAvailablePerceptions',
  'listActionDescriptors',
  'listPerceptionDescriptors',
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
  'readCoordinationState',
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
  'readInteractionBindings',
  'buildGlobalFiltersFromControlState',
  'syncGlobalFiltersFromControlState',
  'readAnnotations',
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
  'setAnnotations',
  'addAnnotation',
  'clearAnnotations',
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

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function uniqueNames(descriptors = []) {
  return descriptors
    .map((descriptor) => descriptor?.name)
    .filter((name, index, names) => typeof name === 'string' && name.length > 0 && names.indexOf(name) === index)
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
    deriveInteractionBindings(controlState = {}, {
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

function cloneObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? clone(value)
    : {}
}

export function buildEmptyComputedPropagationSummary() {
  return {
    active: false,
    sourceWidgetId: null,
    sourceSelectionRef: null,
    selectionRef: null,
    selectionSummary: null,
    targetWidgetIds: [],
    linkCount: 0,
    links: [],
    activatedLinks: [],
    affectedTargets: [],
    skippedTargets: [],
    verificationGuidance: [],
    verificationSteps: [],
    topology: null,
  }
}

export function buildEmptyCoordinationOperationResult({
  changed = false,
  coordinationState = null,
} = {}) {
  return {
    changed,
    coordinationState,
    propagationSummary: buildEmptyComputedPropagationSummary(),
    verificationSteps: [],
    verificationResults: [],
    verification: null,
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

function resolveWorkspaceIdentity(runtime) {
  const description = runtime?.store?.readDescription?.() || {}
  return {
    appId: description?.appId || parseRef(description?.widgets?.[0]?.ref)?.appId || 'widgetva-app',
    workspaceId: description?.workspaceId || parseRef(description?.widgets?.[0]?.ref)?.workspaceId || 'main',
  }
}

function resolveLinkEndpointWidgetId(value, widgets = []) {
  if (typeof value !== 'string' || value.length === 0) return null
  const parsedWidgetId = parseRef(value)?.widgetId
  if (parsedWidgetId) return parsedWidgetId
  const byWidgetRef = widgets.find((widget) => widget?.resolveWidgetRef?.() === value)?.resolveWidgetId?.()
  if (byWidgetRef) return byWidgetRef
  const byWidgetId = widgets.find((widget) => widget?.resolveWidgetId?.() === value)?.resolveWidgetId?.()
  if (byWidgetId) return byWidgetId
  return value
}

function inferLinkId(link = {}, widgets = []) {
  const explicitId = parseRef(link?.ref)?.linkId || link?.linkId || null
  if (explicitId) return explicitId
  const sourceRef = link?.from || link?.sourceRef || null
  const targetRef = link?.to || link?.targetRef || null
  const sourceWidgetId = link?.sourceWidgetId
    || resolveLinkEndpointWidgetId(sourceRef, widgets)
    || 'source'
  const targetWidgetId = link?.targetWidgetId
    || resolveLinkEndpointWidgetId(targetRef, widgets)
    || 'target'
  const primitive = link?.primitive || link?.kind || 'link'
  return `${sourceWidgetId}_${primitive}_${targetWidgetId}`
}

function normalizeWorkspaceLink(link, widgets, runtime) {
  const { appId, workspaceId } = resolveWorkspaceIdentity(runtime)
  const linkId = inferLinkId(link, widgets)
  const sourceWidgetId = link?.sourceWidgetId
    || resolveLinkEndpointWidgetId(link?.from || link?.sourceRef || null, widgets)
    || null
  const targetWidgetId = link?.targetWidgetId
    || resolveLinkEndpointWidgetId(link?.to || link?.targetRef || null, widgets)
    || null
  return makeWidgetLink({
    ...link,
    ...(sourceWidgetId ? { sourceWidgetId } : {}),
    ...(targetWidgetId ? { targetWidgetId } : {}),
    ref: link?.ref || makeLinkRef({ appId, workspaceId, linkId }),
  })
}

export class WidgetWorkspace {
  constructor({
    widgets = [],
    links = [],
    runtime = null,
    disposeWidgetsOnDispose = false,
    controlStateAdapter = null,
  } = {}) {
    this.widgets = uniqueWidgets(widgets)
    this.runtime = resolveSharedRuntime(this.widgets, runtime)
    this.disposeWidgetsOnDispose = disposeWidgetsOnDispose
    this.controlStateAdapter = {
      ...defaultControlStateAdapter(),
      ...(controlStateAdapter && typeof controlStateAdapter === 'object' ? controlStateAdapter : {}),
    }
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
      },
      composition: {
        widgets: 'workspace registers and resolves widget instances by ref or widgetId',
        links: 'workspace registers coordination links and exposes topology summaries',
        actions: 'workspace-level executeAction/queryPerception delegate through the shared runtime',
        contractReads: 'workspace can enumerate widget descriptions plus workspace-level action/perception descriptors and names',
      },
      coordinationState: {
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
        annotations: 'workspace-level shared notes/evidence markers',
        links: {
          definitions: 'canonical registered workspace link definitions with explicit primitive, effect, activationPolicy, effectConstraint, and optional advanced responseSpec',
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

  listActionDescriptors() {
    return this.describe()?.actions || []
  }

  listPerceptionDescriptors() {
    return this.describe()?.perceptionQueries || []
  }

  listActionNames() {
    return uniqueNames(this.listActionDescriptors())
  }

  listAvailableActions() {
    return this.listActionDescriptors()
  }

  listPerceptionNames() {
    return uniqueNames(this.listPerceptionDescriptors())
  }

  listAvailablePerceptions() {
    return this.listPerceptionDescriptors()
  }

  listLinks() {
    const registeredLinks = this.runtime?.store?.listLinks?.() || []
    if (registeredLinks.length > 0) return registeredLinks.map((link) => stripWidgetLinkCompatibilityFields(link))
    return this.links.map((link) => stripWidgetLinkCompatibilityFields(link))
  }

  getLink(refOrId) {
    const links = this.listLinks()
    return links.find((link) => link?.ref === refOrId || parseRef(link?.ref)?.linkId === refOrId || link?.linkId === refOrId) || null
  }

  registerLink(link) {
    if (!link || typeof link !== 'object') {
      throw new Error('WidgetWorkspace.registerLink requires a link object.')
    }
    const normalizedLink = normalizeWorkspaceLink(link, this.widgets, this.runtime)
    if (typeof this.runtime?.store?.registerLink === 'function') {
      this.runtime.store.registerLink(normalizedLink)
    }
    const existingIndex = this.links.findIndex((entry) => entry?.ref === normalizedLink.ref)
    if (existingIndex >= 0) {
      this.links.splice(existingIndex, 1, normalizedLink)
    } else {
      this.links.push(normalizedLink)
    }
    this.updateSharedCoordinationState((shared) => withLinkSubmodel(shared, {
      definitions: this.links,
      topology: this.readLinkTopology(),
    }))
    return normalizedLink
  }

  removeLink(refOrId) {
    const existing = this.getLink(refOrId)
    if (!existing) return null
    if (typeof this.runtime?.store?.removeLinkDefinition === 'function') {
      this.runtime.store.removeLinkDefinition(existing.ref)
    } else if (this.runtime?.store?.links && existing.ref in this.runtime.store.links) {
      delete this.runtime.store.links[existing.ref]
    }
    this.links = this.links.filter((entry) => entry?.ref !== existing.ref)
    this.updateSharedCoordinationState((shared) => withLinkSubmodel(shared, {
      definitions: this.links,
      topology: this.readLinkTopology(),
    }))
    return existing
  }

  describe() {
    return this.runtime?.store?.readDescription?.() || null
  }

  describeWorkspace() {
    return this.describe()
  }

  describeComposition() {
    return {
      widgetRefs: this.listWidgets().map((widget) => widget?.resolveWidgetRef?.()).filter(Boolean),
      widgetIds: this.listWidgets().map((widget) => widget?.resolveWidgetId?.()).filter(Boolean),
      links: this.listLinks(),
      topology: this.readLinkTopology(),
    }
  }

  readState(options = {}) {
    return this.runtime?.store?.readState?.(options) || null
  }

  readView(options = {}) {
    return this.readState(options)
  }

  readObservation(options = {}) {
    return buildRuntimeObservation({
      description: this.describeWorkspace(),
      state: this.readState(options.readStateOptions || options),
      coordinationState: this.readCoordinationState(),
      availableActions: this.listAvailableActions(),
      availablePerceptions: this.listAvailablePerceptions(),
      propagationSummary: this.readPropagationSummary(options.propagationOptions || {}),
      latestCoordinationResult: this.readLatestCoordinationResult(),
    })
  }

  readCoordinationState() {
    const state = this.readState() || {}
    const shared = state?.shared || {}
    const derivedTopology = this.readLinkTopology()
    return {
      stateId: state?.stateId || null,
      branchId: state?.branchId || this.runtime?.store?.currentBranchId || null,
      focusedWidgetRef: shared?.focusedWidget || null,
      selections: {
        registry: readSelectionRegistry(shared),
        views: {
          primary: readSelectionPrimaryView(shared),
          byWidget: readSelectionByWidgetView(shared),
        },
      },
      focus: readFocusState(shared, state?.widgets || {}),
      highlight: deriveHighlightState(state),
      viewport: readViewportState(shared),
      globalFilters: clone(shared?.globalFilters || {}),
      annotations: clone(state?.annotations || shared?.annotations || []),
      links: {
        definitions: readLinkDefinitions(shared),
        topology: (() => {
          const sharedTopology = readLinkTopologyState(shared)
          return Object.keys(sharedTopology).length > 0 ? sharedTopology : derivedTopology
        })(),
      },
    }
  }

  readPropagationSummary(options = {}) {
    return buildPropagationSummary({
      state: this.readState(),
      description: this.describeWorkspace(),
      linkEngine: this.runtime?.linkEngine || null,
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
      linkEngine: this.runtime?.linkEngine || null,
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
    return {
      changed: options?.changed === true,
      coordinationState: this.readCoordinationState(),
      propagationSummary: clone(coordinationResult?.propagationSummary || null),
      verificationSteps: Array.isArray(coordinationResult?.verificationSteps)
        ? [...coordinationResult.verificationSteps]
        : [],
      verificationResults: Array.isArray(coordinationResult?.verificationResults)
        ? [...coordinationResult.verificationResults]
        : [],
      verification: clone(coordinationResult?.verification || null),
    }
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

  readInteractionBindings({
    rangeDomains = {},
    fallbackSelectedWidgetId = null,
  } = {}) {
    return this.controlStateAdapter.deriveInteractionBindings(
      this.readCoordinationControlState({ rangeDomains }),
      { fallbackSelectedWidgetId },
    )
  }

  buildGlobalFiltersFromControlState(controlState = {}, { rangeDomains = {} } = {}) {
    return this.controlStateAdapter.deriveGlobalFiltersFromControlState(controlState, { rangeDomains })
  }

  syncGlobalFiltersFromControlState(controlState = {}, { rangeDomains = {} } = {}) {
    const globalFilters = this.buildGlobalFiltersFromControlState(controlState, { rangeDomains })
    this.setGlobalFilters(globalFilters)
    return globalFilters
  }

  readAnnotations() {
    return this.readCoordinationState().annotations
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
    return this.updateSharedCoordinationState((shared) => withHighlightSubmodel(shared, highlight))
  }

  clearHighlightState() {
    const previousHighlightState = this.readHighlightState()
    const hadHighlight = Array.isArray(previousHighlightState?.entries) && previousHighlightState.entries.length > 0
    if (!hadHighlight) {
      return {
        changed: false,
        previousHighlightState,
        nextHighlightState: previousHighlightState,
      }
    }
    this.setHighlightState(null)
    return {
      changed: true,
      previousHighlightState,
      nextHighlightState: this.readHighlightState(),
    }
  }

  commitClearHighlightState(options = {}) {
    const transition = this.clearHighlightState()
    return this.commitCoordinationOperationResult({
      ...options,
      changed: transition?.changed === true,
    })
  }

  setSelectionPrimary(selection = null) {
    const currentState = this.readState() || {}
    const currentShared = currentState?.shared || {}
    const normalizedSelection = selection == null
      ? null
      : normalizePrimarySelectionView(selection, readSelectionRegistry(currentShared))
    return this.updateSharedCoordinationState((shared) => withSelectionSubmodel(shared, {
      primary: normalizedSelection,
    }))
  }

  setSelectionViewsByWidget(selectionViewsByWidget = {}) {
    return this.updateSharedCoordinationState((shared) => withSelectionSubmodel(shared, {
      byWidget: cloneObject(selectionViewsByWidget),
    }))
  }

  setSelectionRegistry(selectionRegistry = {}) {
    return this.updateSharedCoordinationState((shared) => withSelectionSubmodel(shared, {
      registry: cloneObject(selectionRegistry),
    }))
  }

  upsertSelectionEntry(selectionEntry, options = {}) {
    if (!selectionEntry || typeof selectionEntry !== 'object') {
      throw new Error('WidgetWorkspace.upsertSelectionEntry requires a selection entry object.')
    }

    const selectionRef = typeof selectionEntry.selectionRef === 'string' && selectionEntry.selectionRef.length > 0
      ? selectionEntry.selectionRef
      : null
    if (!selectionRef) {
      throw new Error('WidgetWorkspace.upsertSelectionEntry requires selectionEntry.selectionRef.')
    }

    const sourceWidget = this.getWidget(selectionEntry.sourceWidgetId || selectionEntry.sourceWidgetRef || null)
    const sourceWidgetId = selectionEntry.sourceWidgetId
      || sourceWidget?.resolveWidgetId?.()
      || sourceWidget?.describe?.()?.widgetId
      || null
    const sourceWidgetRef = selectionEntry.sourceWidgetRef
      || sourceWidget?.resolveWidgetRef?.()
      || sourceWidget?.describe?.()?.ref
      || null

    if (!sourceWidgetId) {
      throw new Error('WidgetWorkspace.upsertSelectionEntry requires a sourceWidgetId or resolvable source widget.')
    }

    const makePrimary = options?.makePrimary !== false
    const updateByWidget = options?.updateByWidget !== false
    const focusSourceWidget = options?.focusSourceWidget !== false

    const currentSelectionState = this.readSelectionState() || { registry: {}, views: { primary: null, byWidget: {} } }
    const previousFocusedWidgetRef = this.readCoordinationState()?.focusedWidgetRef || null
    const nextRegistry = {
      ...(currentSelectionState?.registry || {}),
      [selectionRef]: clone({
        ...selectionEntry,
        selectionRef,
        sourceWidgetId,
        sourceWidgetRef,
      }),
    }
    const nextByWidget = updateByWidget
      ? {
          ...(currentSelectionState?.views?.byWidget || {}),
          [sourceWidgetId]: { selectionRef },
        }
      : (currentSelectionState?.views?.byWidget || {})
    const nextPrimary = makePrimary
      ? normalizePrimarySelectionView({ selectionRef }, nextRegistry)
      : currentSelectionState?.views?.primary || null

    this.updateSharedCoordinationState((shared) => {
      const nextShared = withSelectionSubmodel(shared, {
        registry: nextRegistry,
        byWidget: cloneObject(nextByWidget),
        primary: nextPrimary,
      })
      if (focusSourceWidget) {
        nextShared.focusedWidget = sourceWidgetRef || nextShared.focusedWidget || null
      }
      return nextShared
    })

    const nextSelectionState = this.readSelectionState() || { registry: {}, views: { primary: null, byWidget: {} } }
    const nextFocusedWidgetRef = this.readCoordinationState()?.focusedWidgetRef || null
    return {
      changed:
        JSON.stringify(nextSelectionState) !== JSON.stringify(currentSelectionState)
        || nextFocusedWidgetRef !== previousFocusedWidgetRef,
      previousSelectionState: currentSelectionState,
      nextSelectionState,
      previousFocusedWidgetRef,
      nextFocusedWidgetRef,
      selectionRef,
      sourceWidgetId,
      sourceWidgetRef,
    }
  }

  syncPrimarySelectionEntry(selectionEntry = null, options = {}) {
    if (selectionEntry == null) {
      const transition = this.clearSelectionState()
      return this.commitCoordinationOperationResult({
        ...options,
        changed: transition?.changed === true,
      })
    }

    const transition = this.upsertSelectionEntry(selectionEntry, {
      makePrimary: options?.makePrimary !== false,
      updateByWidget: options?.updateByWidget !== false,
      focusSourceWidget: options?.focusSourceWidget !== false,
    })
    return this.commitCoordinationOperationResult({
      ...options,
      changed: transition?.changed === true,
    })
  }

  clearSelectionState() {
    const previousSelectionState = this.readSelectionState() || { registry: {}, views: { primary: null, byWidget: {} } }
    const hadSelection = Object.keys(previousSelectionState?.registry || {}).length > 0
      || previousSelectionState?.views?.primary != null
      || Object.keys(previousSelectionState?.views?.byWidget || {}).length > 0
    if (!hadSelection) {
      return {
        changed: false,
        previousSelectionState,
        nextSelectionState: previousSelectionState,
      }
    }
    this.updateSharedCoordinationState((shared) => withSelectionSubmodel(shared, {
      primary: null,
      byWidget: {},
      registry: {},
    }))
    return {
      changed: true,
      previousSelectionState,
      nextSelectionState: this.readSelectionState() || { registry: {}, views: { primary: null, byWidget: {} } },
    }
  }

  promotePrimarySelectionToGlobalFilters(options = {}) {
    const primarySelection = this.readSelectionState()?.views?.primary || null
    if (!primarySelection?.selectionRef) {
      return {
        changed: false,
        globalFilterPatch: null,
        nextGlobalFilters: this.readGlobalFilters(),
      }
    }

    const globalFilterPatch = this.controlStateAdapter.deriveGlobalFiltersFromSelection(primarySelection, {
      rangeDomains: options?.rangeDomains || {},
    })
    if (!globalFilterPatch) {
      return {
        changed: false,
        globalFilterPatch: null,
        nextGlobalFilters: this.readGlobalFilters(),
      }
    }

    const baseGlobalFilters = options?.baseGlobalFilters && typeof options.baseGlobalFilters === 'object' && !Array.isArray(options.baseGlobalFilters)
      ? clone(options.baseGlobalFilters)
      : clone(this.readGlobalFilters() || {})
    const nextGlobalFilters = {
      ...baseGlobalFilters,
      ...globalFilterPatch,
    }
    const clearSelection = options?.clearSelection !== false
    const focusSourceWidget = options?.focusSourceWidget !== false
    const focusedWidgetRef = focusSourceWidget
      ? this.resolveWorkspaceWidgetRef(primarySelection.sourceWidgetId || primarySelection.sourceWidgetRef, { allowNull: true })
      : null

    this.updateSharedCoordinationState((shared) => {
      const nextShared = {
        ...(shared || {}),
        globalFilters: clone(nextGlobalFilters),
      }
      if (clearSelection) {
        return withSelectionSubmodel({
          ...nextShared,
          focusedWidget: focusedWidgetRef || nextShared.focusedWidget || null,
        }, {
          primary: null,
          byWidget: {},
          registry: {},
        })
      }
      if (focusSourceWidget) {
        nextShared.focusedWidget = focusedWidgetRef || nextShared.focusedWidget || null
      }
      return nextShared
    })

    return {
      changed: true,
      selectionRef: primarySelection.selectionRef,
      globalFilterPatch,
      nextGlobalFilters,
    }
  }

  commitPrimarySelectionToGlobalFilters(options = {}) {
    const promotionResult = this.promotePrimarySelectionToGlobalFilters(options)
    if (!promotionResult?.changed) {
      return {
        ...this.commitCoordinationOperationResult({
          ...options,
          changed: false,
        }),
        changed: false,
        selectionRef: promotionResult?.selectionRef || null,
        globalFilterPatch: promotionResult?.globalFilterPatch || null,
        nextGlobalFilters: promotionResult?.nextGlobalFilters || this.readGlobalFilters(),
      }
    }

    return {
      ...this.commitCoordinationOperationResult({
        ...options,
        changed: true,
      }),
      changed: true,
      selectionRef: promotionResult.selectionRef || null,
      globalFilterPatch: promotionResult.globalFilterPatch || null,
      nextGlobalFilters: promotionResult.nextGlobalFilters || this.readGlobalFilters(),
    }
  }

  promotePrimarySelectionToHighlight(options = {}) {
    const primarySelection = this.readSelectionState()?.views?.primary || null
    if (!primarySelection?.selectionRef) {
      return {
        changed: false,
        highlightState: this.readHighlightState(),
      }
    }

    const highlightState = deriveHighlightStateFromSelection(primarySelection, this.listWidgets())
    const clearSelection = options?.clearSelection !== false
    const focusSourceWidget = options?.focusSourceWidget !== false
    const focusedWidgetRef = focusSourceWidget
      ? this.resolveWorkspaceWidgetRef(primarySelection.sourceWidgetId || primarySelection.sourceWidgetRef, { allowNull: true })
      : null

    this.updateSharedCoordinationState((shared) => {
      const nextShared = withHighlightSubmodel(shared, highlightState)
      if (clearSelection) {
        return withSelectionSubmodel({
          ...nextShared,
          focusedWidget: focusedWidgetRef || nextShared.focusedWidget || null,
        }, {
          primary: null,
          byWidget: {},
          registry: {},
        })
      }
      if (focusSourceWidget) {
        nextShared.focusedWidget = focusedWidgetRef || nextShared.focusedWidget || null
      }
      return nextShared
    })

    return {
      changed: true,
      selectionRef: primarySelection.selectionRef,
      highlightState: this.readHighlightState(),
    }
  }

  commitPrimarySelectionToHighlight(options = {}) {
    const promotionResult = this.promotePrimarySelectionToHighlight(options)
    if (!promotionResult?.changed) {
      return {
        ...this.commitCoordinationOperationResult({
          ...options,
          changed: false,
        }),
        changed: false,
        selectionRef: promotionResult?.selectionRef || null,
        highlightState: promotionResult?.highlightState || this.readHighlightState(),
      }
    }

    return {
      ...this.commitCoordinationOperationResult({
        ...options,
        changed: true,
      }),
      changed: true,
      selectionRef: promotionResult.selectionRef || null,
      highlightState: promotionResult.highlightState || this.readHighlightState(),
    }
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
    const widgetRef = this.resolveWorkspaceWidgetRef(refOrId, { allowNull: true })
    return this.updateSharedCoordinationState((shared) => ({
      ...shared,
      focusedWidget: widgetRef,
    }))
  }

  setGlobalFilters(globalFilters = {}) {
    const nextGlobalFilters = globalFilters && typeof globalFilters === 'object' && !Array.isArray(globalFilters)
      ? clone(globalFilters)
      : {}
    return this.updateSharedCoordinationState((shared) => ({
      ...shared,
      globalFilters: nextGlobalFilters,
    }))
  }

  clearGlobalFilters() {
    return this.setGlobalFilters({})
  }

  setAnnotations(annotations = []) {
    const nextAnnotations = Array.isArray(annotations) ? clone(annotations) : []
    return this.updateSharedCoordinationState((shared) => ({
      ...shared,
      annotations: nextAnnotations,
    }))
  }

  addAnnotation(annotation) {
    return this.updateSharedCoordinationState((shared) => ({
      ...shared,
      annotations: [...(Array.isArray(shared?.annotations) ? shared.annotations : []), clone(annotation)],
    }))
  }

  clearAnnotations() {
    return this.setAnnotations([])
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
    const widgets = this.describe()?.widgets || this.listWidgets().map((widget) => widget?.describe?.()).filter(Boolean)
    return deriveWorkspaceTopology({
      widgets,
      links: this.listLinks(),
    })
  }

  async executeAction(call) {
    if (!call || typeof call !== 'object') {
      throw new Error('WidgetWorkspace.executeAction requires an action call object.')
    }
    const executeAction = this.runtime?.executeAction
      || this.runtime?.actionExecutor?.run?.bind(this.runtime.actionExecutor)
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
    return {
      ...result,
      coordinationResult: this.commitCoordinationOperationResult({
        ...options,
        changed: options?.changed !== false,
      }),
    }
  }

  async queryPerception(call) {
    if (!call || typeof call !== 'object') {
      throw new Error('WidgetWorkspace.queryPerception requires a perception call object.')
    }
    const queryPerception = this.runtime?.queryPerception
      || this.runtime?.perceptionQueryRegistry?.query?.bind(this.runtime.perceptionQueryRegistry)
      || this.runtime?.perceptionQueryRegistry?.run?.bind(this.runtime.perceptionQueryRegistry)
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
      || this.runtime?.dataQueryExecutor?.run?.bind(this.runtime.dataQueryExecutor)
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
      || this.runtime?.actionExecutor?.run?.bind(this.runtime.actionExecutor)
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
      || this.runtime?.actionExecutor?.run?.bind(this.runtime.actionExecutor)
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
