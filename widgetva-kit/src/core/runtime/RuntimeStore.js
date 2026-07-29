import { cloneJsonValue as clone } from '../../shared/clone.js'
import { StateManager } from './StateManager.js'
import { WidgetRegistry } from '../../workspace/widgetRegistry.js'
import { makeWidgetDescription, makeWorkspaceDescription } from '../../workspace/store/workspaceStoreReaders.js'
import {
  getInteractionTraceEventFamily,
  getInteractionTraceQueryName,
  getInteractionTraceQuerySurface,
  makeInteractionTraceRecord,
} from './shapes/interactionTraceShapes.js'
import { makeAgentResponseRecord } from './shapes/responseRecorderShapes.js'
import {
  makeBranchSummary,
  makeStateSnapshotMeta,
  makeTraceGraph,
  makeTraceGraphEdge,
  makeTraceGraphNode,
} from './shapes/historyShapes.js'
import { makeWorkspaceState } from '../../contracts/state-contracts.js'
import { makeWidgetLink } from '../../contracts/widget-links-contracts.js'
import { makeCoordinationRelation, makeCoordinationRelationMap } from '../../contracts/coordination-contracts.js'
import { makeActionDescriptor } from '../../contracts/action-contracts.js'
import { makePerceptionDescriptor } from '../../contracts/perception-contracts.js'
import { makeDataHandle } from '../../contracts/data-contracts.js'
import { deriveGlobalFiltersFromState } from '../../workspace/state/sharedStateDerivation.js'
import { summarizeWorkspaceState } from './summaries/summarizeWorkspaceState.js'
import {
  applyWidgetStatePatches,
  buildResponsePreview,
  createMutableMapFacade,
  makeDescriptorKey,
  makeRuntimeStoreCapabilities,
  makeRuntimeStoreHistory,
  makeRuntimeStoreHistoryRetention,
  makeRuntimeStoreIdentity,
  makeRuntimeStoreIndexes,
  makeRuntimeStoreStateSummary,
  makeRuntimeStoreSummary,
  mergeRuntimePatch,
  normalizeActorFilter,
  normalizeWorkspaceState,
  pickRepresentativeTraceRecord,
} from './store-support/RuntimeStoreModels.js'
import {
  readRuntimeData,
  removeRuntimeData,
  resolveSelectionDataRef,
  syncCurrentSelectionRuntimeData,
  syncCurrentViewRuntimeData,
  syncSelectionRuntimeData,
  updateRuntimeData,
  upsertRuntimeData,
} from './store-support/RuntimeStoreRuntimeData.js'

export class WidgetVARuntimeStore {
  constructor({ appId = 'widgetva-app', workspaceId = 'main' } = {}) {
    this.stateManager = new StateManager()
    this.widgetRegistry = new WidgetRegistry()
    this.appId = appId
    this.workspaceId = workspaceId
    this.description = makeWorkspaceDescription({
      appId: this.appId,
      workspaceId: this.workspaceId,
      generatedAt: new Date().toISOString(),
      workspaceCapabilities: ['singleWidgetAnalysis'],
    })
    this.state = makeWorkspaceState({
      stateId: `${this.workspaceId}:empty`,
      createdAt: new Date().toISOString(),
    })
    this.previousState = null
    this.stateSnapshots = []
    this.descriptionIndex = {}
    this.dataHandleIndex = {}
    this.linkIndex = {}
    this.widgetAdapterList = []
    this.widgetAdapterIndex = {}
    this.actionDescriptors = []
    this.actionIndex = {}
    this.actionNameIndex = {}
    this.perceptionDescriptors = []
    this.perceptionIndex = {}
    this.perceptionNameIndex = {}
    this.runtimeData = {}
    this.widgetStatePatches = {}
    this.interactionTrace = []
    this.responseHistory = []
    this.replayContext = null
    this.currentBranchId = 'main'
    this.version = 0
    this.maxSnapshotRetention = 50
    this.maxTraceRetention = 200
    this.maxResponseRetention = 100
    this.branchRegistry = {
      main: {
        branchId: 'main',
        label: 'Main Branch',
        originStateId: null,
        createdAt: new Date().toISOString(),
      },
    }
    this.pendingTransition = null
    this.listeners = new Set()
    this.descriptions = createMutableMapFacade({
      keys: () => Object.keys(this.descriptionIndex || {}),
      getEntry: (ref) => this.descriptionIndex?.[ref] || null,
      setEntry: (ref, description) => this.upsertWidgetDescription(ref, description),
      deleteEntry: (ref) => this.removeWidgetDescription(ref),
    })
    this.widgets = createMutableMapFacade({
      keys: () => Object.keys(this.state?.widgets || {}),
      getEntry: (ref) => this.state?.widgets?.[ref] || null,
      setEntry: (ref, widgetState) => this.upsertWidgetState(ref, widgetState),
      deleteEntry: (ref) => this.removeWidgetState(ref),
    })
    this.dataHandles = createMutableMapFacade({
      keys: () => Object.keys(this.dataHandleIndex || {}),
      getEntry: (ref) => this.dataHandleIndex?.[ref] || null,
      setEntry: (ref, handle) => this.upsertDataHandle(ref, handle),
      deleteEntry: (ref) => this.removeDataHandleDefinition(ref),
    })
    this.links = createMutableMapFacade({
      keys: () => Object.keys(this.linkIndex || {}),
      getEntry: (ref) => this.linkIndex?.[ref] || null,
      setEntry: (ref, link) => this.upsertLinkDefinition(ref, link),
      deleteEntry: (ref) => this.removeLinkDefinition(ref),
    })
    this.widgetAdapters = createMutableMapFacade({
      keys: () => Object.keys(this.widgetAdapterIndex || {}),
      getEntry: (ref) => this.widgetAdapterIndex?.[ref] || null,
      setEntry: (ref, adapter) => this.upsertWidgetAdapter(ref, adapter),
      deleteEntry: (ref) => this.removeWidgetAdapter(ref),
    })
    this.actions = createMutableMapFacade({
      keys: () => Object.keys(this.actionNameIndex || {}),
      getEntry: (name) => this.getActionDescriptor(name) || null,
      setEntry: (name, descriptor) => this.upsertActionDescriptor(name, descriptor),
      deleteEntry: (name) => this.removeActionDescriptor(name),
    })
    this.perceptionQueries = createMutableMapFacade({
      keys: () => Object.keys(this.perceptionNameIndex || {}),
      getEntry: (name) => this.getPerceptionDescriptor(name) || null,
      setEntry: (name, descriptor) => this.upsertPerceptionDescriptor(name, descriptor),
      deleteEntry: (name) => this.removePerceptionDescriptor(name),
    })
  }

  get stateId() {
    return this.state?.stateId || null
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {}
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emitChange() {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {}
    }
  }

  syncRegistryWorkspace() {
    this.widgetRegistry.replaceWorkspace({
      description: this.description,
      state: this.state,
      widgetAdapters: this.widgetAdapterList,
    })
  }

  upsertWidgetDescription(ref, description) {
    if (!ref || !description || typeof description !== 'object') return null
    const nextDescription = makeWidgetDescription({
      ref,
      ...clone(description),
    })
    this.descriptionIndex = {
      ...(this.descriptionIndex || {}),
      [ref]: nextDescription,
    }
    this.description = makeWorkspaceDescription({
      ...this.description,
      widgets: Object.values(this.descriptionIndex),
    })
    this.syncRegistryWorkspace()
    this.emitChange()
    return nextDescription
  }

  removeWidgetDescription(ref) {
    if (!ref || !this.descriptionIndex?.[ref]) return
    const nextIndex = { ...(this.descriptionIndex || {}) }
    delete nextIndex[ref]
    this.descriptionIndex = nextIndex
    this.description = makeWorkspaceDescription({
      ...this.description,
      widgets: Object.values(this.descriptionIndex),
    })
    this.syncRegistryWorkspace()
    this.emitChange()
  }

  commitWidgetStateMap(nextWidgets, transition = {}) {
    const stateMeta = this.stateManager.createStateMeta({
      workspaceId: this.workspaceId,
      previousState: this.state,
      nextWidgets,
      nextShared: this.state?.shared || {},
      nextTaskContext: this.state?.taskContext,
      nextReplayContext: this.replayContext,
      branchId: this.currentBranchId,
    })
    const nextState = makeWorkspaceState({
      ...clone(this.state),
      stateId: stateMeta.stateId,
      createdAt: stateMeta.createdAt,
      widgets: nextWidgets,
    })
    nextState.shared = {
      ...(nextState.shared || {}),
      globalFilters: deriveGlobalFiltersFromState(nextState),
    }
    return this.commitState(nextState, {
      transitionType: transition.transitionType || 'continue',
      parentStateId: transition.parentStateId,
      branchId: transition.branchId,
      branchLabel: transition.branchLabel,
    })
  }

  upsertWidgetState(ref, widgetState) {
    if (!ref || !widgetState || typeof widgetState !== 'object') return null
    const nextWidgets = {
      ...(this.state?.widgets || {}),
      [ref]: {
        ref,
        ...clone(widgetState),
      },
    }
    this.commitWidgetStateMap(nextWidgets)
    return this.state.widgets[ref]
  }

  removeWidgetState(ref) {
    if (!ref || !this.state?.widgets?.[ref]) return
    const nextWidgets = { ...(this.state?.widgets || {}) }
    delete nextWidgets[ref]
    this.commitWidgetStateMap(nextWidgets)
  }

  upsertDataHandle(ref, handle) {
    if (!ref || !handle || typeof handle !== 'object') return null
    const nextHandle = makeDataHandle({
      ref,
      ...clone(handle),
    })
    this.dataHandleIndex = {
      ...(this.dataHandleIndex || {}),
      [ref]: nextHandle,
    }
    this.description = makeWorkspaceDescription({
      ...this.description,
      dataHandles: Object.values(this.dataHandleIndex),
    })
    this.syncRegistryWorkspace()
    this.emitChange()
    return nextHandle
  }

  removeDataHandleDefinition(ref) {
    if (!ref || !this.dataHandleIndex?.[ref]) return
    const nextIndex = { ...(this.dataHandleIndex || {}) }
    delete nextIndex[ref]
    this.dataHandleIndex = nextIndex
    this.description = makeWorkspaceDescription({
      ...this.description,
      dataHandles: Object.values(this.dataHandleIndex),
    })
    this.syncRegistryWorkspace()
    this.emitChange()
  }

  upsertLinkDefinition(ref, link) {
    if (!ref || !link || typeof link !== 'object') return null
    const nextLink = makeWidgetLink({
      ref,
      ...clone(link),
    })
    this.linkIndex = {
      ...(this.linkIndex || {}),
      [ref]: nextLink,
    }
    this.description = makeWorkspaceDescription({
      ...this.description,
      links: Object.values(this.linkIndex),
    })
    this.syncRegistryWorkspace()
    this.emitChange()
    return nextLink
  }

  removeLinkDefinition(ref) {
    const currentRelations = makeCoordinationRelationMap(this.state?.coordination?.relations || {})
    if (!ref || (!this.linkIndex?.[ref] && !Object.prototype.hasOwnProperty.call(currentRelations, ref))) return
    const nextIndex = { ...(this.linkIndex || {}) }
    delete nextIndex[ref]
    this.linkIndex = nextIndex
    this.description = makeWorkspaceDescription({
      ...this.description,
      links: Object.values(this.linkIndex),
    })
    if (Object.prototype.hasOwnProperty.call(currentRelations, ref)) {
      const nextRelations = { ...currentRelations }
      delete nextRelations[ref]
      this.commitState(makeWorkspaceState({
        ...clone(this.state),
        coordination: {
          ...(this.state?.coordination || {}),
          relations: nextRelations,
        },
      }), { transitionType: 'continue' })
    }
    this.syncRegistryWorkspace()
    this.emitChange()
  }

  upsertWidgetAdapter(ref, adapter) {
    if (!ref || !adapter || typeof adapter !== 'object') return null
    const nextAdapter = adapter.widgetRef === ref
      ? adapter
      : {
          ...adapter,
          widgetRef: ref,
        }
    this.widgetAdapterIndex = {
      ...(this.widgetAdapterIndex || {}),
      [ref]: nextAdapter,
    }
    this.widgetAdapterList = Object.values(this.widgetAdapterIndex)
    this.syncRegistryWorkspace()
    this.emitChange()
    return nextAdapter
  }

  removeWidgetAdapter(ref) {
    if (!ref || !this.widgetAdapterIndex?.[ref]) return
    const nextIndex = { ...(this.widgetAdapterIndex || {}) }
    delete nextIndex[ref]
    this.widgetAdapterIndex = nextIndex
    this.widgetAdapterList = Object.values(nextIndex)
    this.syncRegistryWorkspace()
    this.emitChange()
  }

  rebuildActionIndexes(actionDescriptors = []) {
    this.actionDescriptors = actionDescriptors.map((item) => makeActionDescriptor(item))
    this.actionIndex = Object.fromEntries(
      this.actionDescriptors.map((item) => [makeDescriptorKey(item.name, item.targetRef), item]),
    )
    this.actionNameIndex = this.actionDescriptors.reduce((acc, item) => {
      if (!acc[item.name]) acc[item.name] = []
      acc[item.name].push(item)
      return acc
    }, {})
  }

  rebuildPerceptionIndexes(perceptionDescriptors = []) {
    this.perceptionDescriptors = perceptionDescriptors.map((item) => makePerceptionDescriptor(item))
    this.perceptionIndex = Object.fromEntries(
      this.perceptionDescriptors.map((item) => [makeDescriptorKey(item.name, item.targetRef), item]),
    )
    this.perceptionNameIndex = this.perceptionDescriptors.reduce((acc, item) => {
      if (!acc[item.name]) acc[item.name] = []
      acc[item.name].push(item)
      return acc
    }, {})
  }

  upsertActionDescriptor(name, descriptor) {
    const descriptorName = descriptor?.name || name
    if (!descriptorName || !descriptor || typeof descriptor !== 'object') return null
    const nextDescriptor = {
      name: descriptorName,
      ...clone(descriptor),
    }
    const nextKey = makeDescriptorKey(nextDescriptor.name, nextDescriptor.targetRef)
    const remainingDescriptors = this.actionDescriptors.filter((item) => makeDescriptorKey(item?.name, item?.targetRef) !== nextKey)
    this.rebuildActionIndexes([...remainingDescriptors, nextDescriptor])
    this.description = makeWorkspaceDescription({
      ...this.description,
      actions: [...this.actionDescriptors],
    })
    this.emitChange()
    return nextDescriptor
  }

  removeActionDescriptor(name) {
    if (!name || !this.actionNameIndex?.[name]?.length) return
    this.rebuildActionIndexes(this.actionDescriptors.filter((item) => item?.name !== name))
    this.description = makeWorkspaceDescription({
      ...this.description,
      actions: [...this.actionDescriptors],
    })
    this.emitChange()
  }

  upsertPerceptionDescriptor(name, descriptor) {
    const descriptorName = descriptor?.name || name
    if (!descriptorName || !descriptor || typeof descriptor !== 'object') return null
    const nextDescriptor = {
      name: descriptorName,
      ...clone(descriptor),
    }
    const nextKey = makeDescriptorKey(nextDescriptor.name, nextDescriptor.targetRef)
    const remainingDescriptors = this.perceptionDescriptors.filter((item) => makeDescriptorKey(item?.name, item?.targetRef) !== nextKey)
    this.rebuildPerceptionIndexes([...remainingDescriptors, nextDescriptor])
    this.description = makeWorkspaceDescription({
      ...this.description,
      perceptionQueries: [...this.perceptionDescriptors],
    })
    this.emitChange()
    return nextDescriptor
  }

  removePerceptionDescriptor(name) {
    if (!name || !this.perceptionNameIndex?.[name]?.length) return
    this.rebuildPerceptionIndexes(this.perceptionDescriptors.filter((item) => item?.name !== name))
    this.description = makeWorkspaceDescription({
      ...this.description,
      perceptionQueries: [...this.perceptionDescriptors],
    })
    this.emitChange()
  }

  registerWidget(description, widgetState) {
    const ref = description?.ref || widgetState?.ref || null
    if (!ref || !description || !widgetState) return null

    const nextDescription = makeWidgetDescription({
      ref,
      ...clone(description),
    })
    const nextWidgetState = {
      ref,
      ...clone(widgetState),
    }
    const nextDescriptionIndex = {
      ...(this.descriptionIndex || {}),
      [ref]: nextDescription,
    }
    const nextWidgets = {
      ...(this.state?.widgets || {}),
      [ref]: nextWidgetState,
    }
    const stateMeta = this.stateManager.createStateMeta({
      workspaceId: this.workspaceId,
      previousState: this.state,
      nextWidgets,
      nextShared: this.state?.shared || {},
      nextTaskContext: this.state?.taskContext,
      nextReplayContext: this.replayContext,
      branchId: this.currentBranchId,
    })

    this.descriptionIndex = nextDescriptionIndex
    this.description = makeWorkspaceDescription({
      ...this.description,
      widgets: Object.values(nextDescriptionIndex),
    })

    const nextState = makeWorkspaceState({
      ...clone(this.state),
      stateId: stateMeta.stateId,
      createdAt: stateMeta.createdAt,
      widgets: nextWidgets,
    })
    nextState.shared = {
      ...(nextState.shared || {}),
      globalFilters: deriveGlobalFiltersFromState(nextState),
    }

    this.commitState(nextState, { transitionType: 'continue' })
    this.syncRegistryWorkspace()
    return this.state.widgets?.[ref] || null
  }

  registerLink(link) {
    const ref = link?.ref || null
    if (!ref || !link || typeof link !== 'object') return null

    const nextLink = makeWidgetLink({
      ref,
      ...clone(link),
    })
    this.linkIndex = {
      ...(this.linkIndex || {}),
      [ref]: nextLink,
    }
    this.description = makeWorkspaceDescription({
      ...this.description,
      links: Object.values(this.linkIndex),
    })
    const relation = makeCoordinationRelation(nextLink)
    if (relation.ref && relation.sourceStateRef && relation.targetStateRef) {
      const currentRelations = makeCoordinationRelationMap(this.state?.coordination?.relations || {})
      this.commitState(makeWorkspaceState({
        ...clone(this.state),
        coordination: {
          ...(this.state?.coordination || {}),
          relations: {
            ...currentRelations,
            [relation.ref]: relation,
          },
        },
      }), { transitionType: 'continue' })
    }
    this.syncRegistryWorkspace()
    this.version += 1
    this.emitChange()
    return nextLink
  }

  replaceWorkspace(nextWorkspace) {
    const transition = this.pendingTransition || {}
    const normalizedDescriptions = Array.isArray(nextWorkspace.description?.widgets)
      ? nextWorkspace.description.widgets.map((item) => makeWidgetDescription(item))
      : []
    const normalizedActions = Array.isArray(nextWorkspace.description?.actions)
      ? nextWorkspace.description.actions.map((item) => makeActionDescriptor(item))
      : []
    const normalizedPerceptionQueries = Array.isArray(nextWorkspace.description?.perceptionQueries)
      ? nextWorkspace.description.perceptionQueries.map((item) => makePerceptionDescriptor(item))
      : []
    this.appId = nextWorkspace.description?.appId || this.appId
    this.workspaceId = nextWorkspace.description?.workspaceId || this.workspaceId
    this.descriptionIndex = Object.fromEntries(
      normalizedDescriptions.map((item) => [item.ref, item]),
    )
    this.dataHandleIndex = Object.fromEntries(
      (nextWorkspace.description?.dataHandles || []).map((item) => {
        const normalizedHandle = makeDataHandle(item)
        return [normalizedHandle.ref, normalizedHandle]
      }),
    )
    this.linkIndex = Object.fromEntries(
      (nextWorkspace.description?.links || []).map((item) => {
        const normalizedLink = makeWidgetLink(item)
        return [normalizedLink.ref, normalizedLink]
      }),
    )
    this.description = makeWorkspaceDescription({
      ...nextWorkspace.description,
      widgets: Object.values(this.descriptionIndex),
      dataHandles: Object.values(this.dataHandleIndex),
      links: Object.values(this.linkIndex),
      actions: normalizedActions,
      perceptionQueries: normalizedPerceptionQueries,
    })
    this.widgetAdapterList = Array.isArray(nextWorkspace.widgetAdapters) ? nextWorkspace.widgetAdapters : []
    this.widgetAdapterIndex = Object.fromEntries(
      this.widgetAdapterList.map((adapter) => [adapter.widgetRef, adapter]),
    )
    this.rebuildActionIndexes(
      normalizedActions,
    )
    this.rebuildPerceptionIndexes(
      normalizedPerceptionQueries,
    )
    this.runtimeData = nextWorkspace.runtimeData || {}
    this.replayContext = clone(nextWorkspace.replayContext || null)
    const incomingState = makeWorkspaceState(nextWorkspace.state)
    const explicitRelations = incomingState?.coordination?.relations
    const hasExplicitRelations = explicitRelations
      && typeof explicitRelations === 'object'
      && !Array.isArray(explicitRelations)
    const linkRelations = makeCoordinationRelationMap(
      Object.values(this.linkIndex)
        .map((link) => makeCoordinationRelation(link))
        .filter((relation) => relation.ref && relation.sourceStateRef && relation.targetStateRef),
    )
    const patchedState = applyWidgetStatePatches({
      ...incomingState,
      coordination: {
        ...(incomingState.coordination || {}),
        relations: hasExplicitRelations
          ? makeCoordinationRelationMap(explicitRelations)
          : linkRelations,
      },
    }, this.widgetStatePatches)
    this.widgetRegistry.replaceWorkspace({
      description: this.description,
      state: patchedState,
      widgetAdapters: this.widgetAdapterList,
    })
    this.commitState(patchedState, transition)
    this.syncCurrentViewRuntimeData()
    this.syncCurrentSelectionRuntimeData()
  }

  readDescription() {
    return this.description
  }

  listWidgetDescriptions() {
    return Object.values(this.descriptionIndex)
  }

  getWidgetDescription(ref) {
    return ref ? this.widgetRegistry.getWidget(ref) : null
  }

  getWidgetState(ref) {
    return ref ? this.widgetRegistry.getWidgetState(ref) : null
  }

  getWidgetEntry(ref) {
    return ref ? this.widgetRegistry.getWidgetEntry(ref) : null
  }

  getResolvedWidget(ref) {
    return ref ? this.widgetRegistry.getResolvedWidget(ref) : null
  }

  getResolvedWidgetForTarget(ref) {
    if (!ref) return null
    const directTarget = this.widgetRegistry.getResolvedWidgetForTarget(ref)
    if (directTarget) return directTarget

    const runtimeDataEntry = this.readRuntimeData(ref)
    const widgetRef = runtimeDataEntry?.widgetRef || null
    return widgetRef ? this.widgetRegistry.getResolvedWidget(widgetRef) : null
  }

  listDataHandles() {
    return Object.values(this.dataHandleIndex)
  }

  getDataHandle(ref) {
    return ref ? this.widgetRegistry.getDataHandle(ref) : null
  }

  listWidgetAdapters() {
    return [...this.widgetAdapterList]
  }

  getWidgetAdapter(widgetRef) {
    return widgetRef ? this.widgetAdapterIndex?.[widgetRef] || null : null
  }

  describeWidgetRegistry() {
    return this.widgetRegistry.describe()
  }

  listLinks() {
    const links = Object.values(this.linkIndex)
    const relationLinks = Object.values(makeCoordinationRelationMap(this.state?.coordination?.relations || {}))
    const deduped = new Map()
    for (const link of [...links, ...relationLinks]) {
      if (!link?.ref) continue
      deduped.set(link.ref, link)
    }
    return Array.from(deduped.values())
  }

  getLink(ref) {
    return ref ? this.widgetRegistry.getLink(ref) : null
  }

  listActions() {
    return [...this.actionDescriptors]
  }

  listPerceptionQueries() {
    return [...this.perceptionDescriptors]
  }

  getActionDescriptor(name, targetRef) {
    if (!name) return null
    if (targetRef) {
      return this.actionIndex?.[makeDescriptorKey(name, targetRef)] || null
    }
    const matches = this.actionNameIndex?.[name] || []
    if (matches.length === 1) return matches[0]
    return matches.find((item) => item.scope === 'workspace') || matches[0] || null
  }

  getPerceptionDescriptor(name, targetRef) {
    if (!name) return null
    if (targetRef) {
      return this.perceptionIndex?.[makeDescriptorKey(name, targetRef)] || null
    }
    const matches = this.perceptionNameIndex?.[name] || []
    if (matches.length === 1) return matches[0]
    return matches.find((item) => item.scope === 'workspace') || matches[0] || null
  }

  readState(options = {}) {
    if (options.deltaSince) {
      const baseSnapshot = this.stateSnapshots.find((snapshot) => snapshot.stateId === options.deltaSince)
      if (baseSnapshot) {
        const delta = this.stateManager.createDelta({
          previousState: baseSnapshot.state,
          nextState: this.state,
        })
        return this.stateManager.pickRefs({
          state: {
            ...this.state,
            delta,
          },
          replayContext: this.replayContext,
          refs: Array.isArray(options.refs) && options.refs.length > 0
            ? (delta.changedRefs || []).filter((ref) => options.refs.includes(ref))
            : (delta.changedRefs || []),
        })
      }
    }
    if (options.deltaSince && this.previousState?.stateId === options.deltaSince) {
      return this.stateManager.pickRefs({
        state: this.state,
        replayContext: this.replayContext,
        refs: Array.isArray(options.refs) && options.refs.length > 0
          ? (this.state?.delta?.changedRefs || []).filter((ref) => options.refs.includes(ref))
          : (this.state?.delta?.changedRefs || []),
      })
    }
    if (Array.isArray(options.refs) && options.refs.length > 0) {
      return this.stateManager.pickRefs({
        state: this.state,
        replayContext: this.replayContext,
        refs: options.refs,
      })
    }
    return this.state
  }

  buildStatePatch(refs) {
    return this.stateManager.buildStatePatch({
      state: this.state,
      replayContext: this.replayContext,
      refs,
    })
  }

  summarizeState(state = this.state) {
    const nextState = state === this.state
      ? {
          ...state,
          replayContext: clone(this.replayContext),
        }
      : state
    return summarizeWorkspaceState(nextState)
  }

  patchWidget(ref, patch = {}) {
    const currentWidget = this.state?.widgets?.[ref]
    if (!currentWidget) {
      throw new Error(`Unknown widget: ${ref}`)
    }

    this.widgetStatePatches = {
      ...this.widgetStatePatches,
      [ref]: mergeRuntimePatch(this.widgetStatePatches?.[ref] || {}, patch),
    }

    const nextWidgets = {
      ...(this.state?.widgets || {}),
      [ref]: mergeRuntimePatch(
        {
          ...clone(currentWidget),
          version: (currentWidget.version || 0) + 1,
          updatedAt: new Date().toISOString(),
        },
        patch,
      ),
    }
    const stateMeta = this.stateManager.createStateMeta({
      workspaceId: this.workspaceId,
      previousState: this.state,
      nextWidgets,
      nextShared: this.state?.shared || {},
      nextTaskContext: this.state?.taskContext,
      nextReplayContext: this.replayContext,
      branchId: this.currentBranchId,
    })
    const nextState = makeWorkspaceState({
      ...clone(this.state),
      stateId: stateMeta.stateId,
      createdAt: stateMeta.createdAt,
      widgets: nextWidgets,
    })
    nextState.shared = {
      ...(nextState.shared || {}),
      globalFilters: deriveGlobalFiltersFromState(nextState),
    }
    this.commitState(nextState, { transitionType: 'continue' })
    return nextState
  }

  resetWidgetPatches() {
    this.widgetStatePatches = {}
  }

  clearWidgetPatches(refs = []) {
    if (!Array.isArray(refs) || refs.length === 0) return
    const nextPatches = { ...(this.widgetStatePatches || {}) }
    let changed = false
    for (const ref of refs) {
      if (!ref || !Object.prototype.hasOwnProperty.call(nextPatches, ref)) continue
      delete nextPatches[ref]
      changed = true
    }
    if (changed) {
      this.widgetStatePatches = nextPatches
    }
  }

  readRuntimeData(ref) {
    return readRuntimeData(this, ref)
  }

  resolveSelectionDataRef(selectionRef) {
    return resolveSelectionDataRef(this, selectionRef)
  }

  updateRuntimeData(ref, updater) {
    return updateRuntimeData(this, ref, updater)
  }

  upsertRuntimeData(ref, entry) {
    return upsertRuntimeData(this, ref, entry)
  }

  removeRuntimeData(ref) {
    return removeRuntimeData(this, ref)
  }

  syncCurrentSelectionRuntimeData() {
    return syncCurrentSelectionRuntimeData(this)
  }

  syncCurrentViewRuntimeData() {
    return syncCurrentViewRuntimeData(this)
  }

  syncSelectionRuntimeData(widgetRef) {
    return syncSelectionRuntimeData(this, widgetRef)
  }

  readSnapshot(stateId) {
    const snapshot = this.stateSnapshots.find((item) => item.stateId === stateId)
    return snapshot ? clone(snapshot.state) : null
  }

  readSnapshotEntry(stateId) {
    const snapshot = this.stateSnapshots.find((item) => item.stateId === stateId)
    return snapshot ? clone(snapshot) : null
  }

  readCurrentSnapshotMeta() {
    const stateId = this.state?.stateId
    return stateId ? this.readSnapshotEntry(stateId) : null
  }

  describeStore() {
    return makeRuntimeStoreSummary({
      identity: makeRuntimeStoreIdentity({
        appId: this.appId || null,
        workspaceId: this.workspaceId || null,
      }),
      state: makeRuntimeStoreStateSummary({
        stateId: this.readState()?.stateId || null,
        currentBranchId: this.currentBranchId || null,
        previousStateId: this.previousState?.stateId || null,
        version: this.version || 0,
      }),
      currentStateSummary: this.summarizeState(),
      indexes: makeRuntimeStoreIndexes({
        widgetCount: this.listWidgetDescriptions().length,
        dataHandleCount: this.listDataHandles().length,
        linkCount: this.listLinks().length,
        widgetAdapterCount: this.listWidgetAdapters().length,
        actionDescriptorCount: this.listActions().length,
        perceptionDescriptorCount: this.listPerceptionQueries().length,
        widgetPatchCount: Object.keys(this.widgetStatePatches || {}).length,
      }),
      history: makeRuntimeStoreHistory({
        snapshotCount: Array.isArray(this.stateSnapshots) ? this.stateSnapshots.length : 0,
        traceCount: Array.isArray(this.interactionTrace) ? this.interactionTrace.length : 0,
        responseCount: Array.isArray(this.responseHistory) ? this.responseHistory.length : 0,
        branchCount: this.listBranches().length,
        retention: makeRuntimeStoreHistoryRetention({
          snapshotMax: this.maxSnapshotRetention,
          traceMax: this.maxTraceRetention,
          responseMax: this.maxResponseRetention,
        }),
        maxSnapshotRetention: this.maxSnapshotRetention,
        maxTraceRetention: this.maxTraceRetention,
        maxResponseRetention: this.maxResponseRetention,
      }),
      capabilities: makeRuntimeStoreCapabilities({
        deltaTracking: true,
        snapshotHistory: true,
        actorScopedHistory: true,
        branchReplay: true,
        traceGraph: true,
        runtimeDataIndex: true,
        widgetAdapterIndex: true,
        widgetStatePatching: true,
      }),
    })
  }

  buildRepresentativeTraceMap() {
    const traceByStateId = new Map()
    for (const record of this.interactionTrace) {
      if (!record?.stateId) continue
      traceByStateId.set(
        record.stateId,
        pickRepresentativeTraceRecord(traceByStateId.get(record.stateId), record),
      )
    }
    return traceByStateId
  }

  listStateSnapshots(options = 50) {
    const normalizedOptions = typeof options === 'number' ? { limit: options } : (options || {})
    const limit = Number.isFinite(normalizedOptions.limit) ? normalizedOptions.limit : 50
    const sinceStateId = normalizedOptions.sinceStateId || null
    const allowedActors = normalizeActorFilter(normalizedOptions.actors)
    const traceByStateId = this.buildRepresentativeTraceMap()
    const fullSnapshots = Array.isArray(this.stateSnapshots) ? this.stateSnapshots : []
    const scopedSnapshots = sinceStateId
      ? (() => {
          const idx = fullSnapshots.findIndex((snapshot) => snapshot?.stateId === sinceStateId)
          return idx >= 0 ? fullSnapshots.slice(idx + 1) : fullSnapshots
        })()
      : fullSnapshots
    const filteredSnapshots = allowedActors.length > 0
      ? scopedSnapshots.filter((snapshot) => {
          const actor = traceByStateId.get(snapshot?.stateId)?.actor || 'system'
          return allowedActors.includes(actor)
        })
      : scopedSnapshots
    return filteredSnapshots.slice(-limit).map((item) => {
      const representativeTrace = traceByStateId.get(item.stateId)
      return makeStateSnapshotMeta({
        stateId: item.stateId,
        createdAt: item.createdAt || item.state?.createdAt || null,
        baseStateId: (item.parentStateId ?? item.state?.delta?.baseStateId) || null,
        branchId: item.branchId || null,
        transitionType: item.transitionType || 'continue',
        branchLabel: item.branchLabel || null,
        actor: representativeTrace?.actor || 'system',
        changedRefs: Array.isArray(item.state?.delta?.changedRefs) ? [...item.state.delta.changedRefs] : [],
        removedRefs: Array.isArray(item.state?.delta?.removedRefs) ? [...item.state.delta.removedRefs] : [],
      })
    })
  }

  commitState(nextState, transition = {}) {
    const previousReplayContext = clone(this.state?.replayContext)
    this.previousState = this.state
    this.state = normalizeWorkspaceState(nextState)
    this.state.replayContext = clone(this.replayContext)
    this.widgetRegistry.setState(this.state)
    this.version += 1
    this.state.delta = this.stateManager.createDelta({
      previousState: this.previousState,
      nextState: this.state,
      previousReplayContext,
      nextReplayContext: this.replayContext,
    })
    const snapshotEntry = {
      stateId: this.state.stateId,
      state: clone(this.state),
      replayContext: clone(this.replayContext || null),
      branchId: transition.branchId || this.currentBranchId,
      parentStateId: transition.parentStateId ?? this.previousState?.stateId ?? null,
      transitionType: transition.transitionType || 'continue',
      branchLabel: transition.branchLabel || null,
      createdAt: this.state.createdAt || new Date().toISOString(),
    }
    const hasStateChange = (this.state.delta?.changedRefs?.length || 0) > 0 || (this.state.delta?.removedRefs?.length || 0) > 0
    const latestSnapshot = this.stateSnapshots[this.stateSnapshots.length - 1] || null
    const shouldAppendSnapshot =
      !latestSnapshot ||
      latestSnapshot.stateId !== snapshotEntry.stateId ||
      snapshotEntry.transitionType !== 'continue' ||
      hasStateChange
    if (shouldAppendSnapshot) {
      this.stateSnapshots.push(snapshotEntry)
      if (this.stateSnapshots.length > this.maxSnapshotRetention) {
        this.stateSnapshots = this.stateSnapshots.slice(-this.maxSnapshotRetention)
      }
    }
    this.syncCurrentViewRuntimeData()
    this.syncCurrentSelectionRuntimeData()
    this.pendingTransition = null
    this.emitChange()
    return this.state
  }

  listBranches() {
    return Object.values(this.branchRegistry).map((entry) => makeBranchSummary(clone(entry)))
  }

  beginTransition({ transitionType = 'continue', parentStateId = undefined, branchId = undefined, branchLabel = undefined } = {}) {
    this.pendingTransition = {
      transitionType,
      parentStateId,
      branchId,
      branchLabel,
    }
  }

  beginBranchFromState({ stateId, label } = {}) {
    if (!stateId) {
      throw new Error('beginBranchFromState requires a stateId.')
    }
    const existing = this.readSnapshotEntry(stateId)
    if (!existing) {
      throw new Error(`Unknown branch origin state: ${stateId}`)
    }
    const branchId = `branch_${Date.now()}`
    const branchLabel = label || `Branch from ${stateId}`
    this.branchRegistry[branchId] = {
      branchId,
      label: branchLabel,
      originStateId: stateId,
      parentBranchId: existing.branchId || this.currentBranchId,
      createdAt: new Date().toISOString(),
    }
    this.currentBranchId = branchId
    this.beginTransition({
      transitionType: 'branch',
      parentStateId: stateId,
      branchId,
      branchLabel,
    })
    return this.branchRegistry[branchId]
  }

  buildTraceGraph(options = 50) {
    const normalizedOptions = typeof options === 'number' ? { limit: options } : (options || {})
    const limit = Number.isFinite(normalizedOptions.limit) ? normalizedOptions.limit : 50
    const sinceStateId = normalizedOptions.sinceStateId || null
    const allowedActors = normalizeActorFilter(normalizedOptions.actors)
    const fullSnapshots = Array.isArray(this.stateSnapshots) ? this.stateSnapshots : []
    const scopedSnapshots = sinceStateId
      ? (() => {
          const idx = fullSnapshots.findIndex((snapshot) => snapshot?.stateId === sinceStateId)
          return idx >= 0 ? fullSnapshots.slice(idx + 1) : fullSnapshots
        })()
      : fullSnapshots
    const traceByStateId = this.buildRepresentativeTraceMap()
    const actorScopedSnapshots = allowedActors.length > 0
      ? scopedSnapshots.filter((snapshot) => {
          const actor = traceByStateId.get(snapshot?.stateId)?.actor || 'system'
          return allowedActors.includes(actor)
        })
      : scopedSnapshots
    const snapshots = actorScopedSnapshots.slice(-limit)
    const latestResponseByStateId = new Map()
    for (const response of this.responseHistory) {
      if (!response?.stateId) continue
      latestResponseByStateId.set(response.stateId, response)
    }
    const nodes = snapshots.map((snapshot) => {
      const record = traceByStateId.get(snapshot.stateId)
      const response = latestResponseByStateId.get(snapshot.stateId)
      const queryName = getInteractionTraceQueryName(record?.query)
      return makeTraceGraphNode({
        id: snapshot.stateId,
        stateId: snapshot.stateId,
        parentStateId: snapshot.parentStateId || null,
        branchId: snapshot.branchId || 'main',
        branchLabel: snapshot.branchLabel || null,
        timestamp: snapshot.createdAt || snapshot.state?.createdAt || null,
        actor: record?.actor || 'system',
        eventFamily: record?.eventFamily || getInteractionTraceEventFamily(record),
        querySurface: record?.querySurface || getInteractionTraceQuerySurface(record),
        actionName: record?.action?.name || null,
        queryName,
        responseId: response?.responseId || null,
        responseActor: response?.actor || null,
        responsePreview: buildResponsePreview(response?.content),
        label: record?.action?.name || queryName || snapshot.transitionType || 'state',
        transitionType: snapshot.transitionType || 'continue',
        current: snapshot.stateId === this.state?.stateId,
      })
    })

    const nodeIds = new Set(nodes.map((node) => node.id))
    const edges = snapshots
      .filter((snapshot) => snapshot.parentStateId)
      .filter((snapshot) => nodeIds.has(snapshot.stateId) && nodeIds.has(snapshot.parentStateId))
      .map((snapshot) => makeTraceGraphEdge({
        id: `${snapshot.parentStateId}->${snapshot.stateId}`,
        from_id: snapshot.parentStateId,
        to_id: snapshot.stateId,
        edge_type: snapshot.transitionType || 'continue',
        branchId: snapshot.branchId || 'main',
        label: snapshot.transitionType || 'continue',
        timestamp: snapshot.createdAt || snapshot.state?.createdAt || null,
      }))

    return makeTraceGraph({
      current_state_id: this.state?.stateId || null,
      current_branch_id: this.currentBranchId,
      sinceStateId,
      actors: allowedActors,
      branches: this.listBranches(),
      nodes,
      edges,
    })
  }

  readTrace(limit = 50) {
    return this.interactionTrace.slice(-limit)
  }

  readTraceWindow({ limit = 50, sinceStateId = null, actors = [] } = {}) {
    const fullTrace = Array.isArray(this.interactionTrace) ? this.interactionTrace : []
    const scopedTrace = sinceStateId
      ? (() => {
          const idx = fullTrace.findIndex((record) => record?.stateId === sinceStateId)
          return idx >= 0 ? fullTrace.slice(idx + 1) : fullTrace
        })()
      : fullTrace
    const allowedActors = normalizeActorFilter(actors)
    const actorScopedTrace = allowedActors.length > 0
      ? scopedTrace.filter((record) => allowedActors.includes(record?.actor || 'system'))
      : scopedTrace
    if (!Number.isFinite(limit) || limit <= 0) {
      return [...actorScopedTrace]
    }
    return actorScopedTrace.slice(-limit)
  }

  appendTrace(record) {
    this.interactionTrace.push(makeInteractionTraceRecord(record))
    if (this.interactionTrace.length > this.maxTraceRetention) {
      this.interactionTrace = this.interactionTrace.slice(-this.maxTraceRetention)
    }
    this.version += 1
    this.emitChange()
  }

  listResponses(limit = 20, options = {}) {
    const workspaceId = options.workspaceId || this.workspaceId || null
    const filtered = workspaceId
      ? this.responseHistory.filter((item) => item?.workspaceId === workspaceId)
      : this.responseHistory
    return filtered.slice(-limit).map((item) => clone(item))
  }

  readLatestResponse(options = {}) {
    const items = this.listResponses(1, options)
    return items[0] || null
  }

  appendResponse(record) {
    this.responseHistory.push(makeAgentResponseRecord({
      workspaceId: this.workspaceId || null,
      branchId: this.currentBranchId || null,
      ...record,
    }))
    if (this.responseHistory.length > this.maxResponseRetention) {
      this.responseHistory = this.responseHistory.slice(-this.maxResponseRetention)
    }
    this.version += 1
    this.emitChange()
  }
}
