import { StateManager } from './StateManager.js'
import { WidgetRegistry } from './WidgetRegistry.js'
import { makeWidgetDescription, makeWorkspaceDescription } from '../protocol/description.js'
import {
  getInteractionTraceEventFamily,
  getInteractionTraceQueryName,
  getInteractionTraceQuerySurface,
  makeInteractionTraceRecord,
} from '../protocol/interactionTrace.js'
import { makeAgentResponseRecord } from '../protocol/responses.js'
import {
  makeBranchSummary,
  makeStateSnapshotMeta,
  makeTraceGraph,
  makeTraceGraphEdge,
  makeTraceGraphNode,
} from '../protocol/results.js'
import {
  makeRuntimeStoreCapabilities,
  makeRuntimeStoreHistory,
  makeRuntimeStoreHistoryRetention,
  makeRuntimeStoreIdentity,
  makeRuntimeStoreIndexes,
  makeRuntimeStoreStateSummary,
  makeRuntimeStoreSummary,
} from '../protocol/runtimeStore.js'
import { makeWidgetState, makeWorkspaceState } from '../protocol/state.js'
import { makeWidgetLink } from '../protocol/widgetLinks.js'
import { makeActionDescriptor } from '../protocol/actions.js'
import { makePerceptionDescriptor } from '../protocol/perception.js'
import { makeDataHandle } from '../protocol/dataHandles.js'
import { applyActionAnalyticalPlacementList } from '../../workspace/state/analyticalStatePlacement.js'
import {
  makeCurrentSelectionDataRef,
  makeCurrentViewDataRef,
  makeSelectionScopedDataRef,
  makeWidgetSelectionDataRef,
  parseRef,
} from '../protocol/refs.js'
import { deriveGlobalFiltersFromState } from './sharedStateDerivation.js'
import { buildDerivedDataHandle } from './materializers/workspaceDescriptorBuilders.js'
import { rowMatchesAnySelection, rowMatchesSelection } from './materializers/selectionHelpers.js'
import { summarizeWorkspaceState } from './summarizeWorkspaceState.js'

function makeDescriptorKey(name, targetRef) {
  return `${name || 'unknown'}::${targetRef || 'workspace'}`
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function mergeRuntimePatch(base, patch) {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return clone(patch)
  }
  const nextValue = { ...clone(base) }
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(nextValue[key])) {
      nextValue[key] = mergeRuntimePatch(nextValue[key], value)
    } else {
      nextValue[key] = clone(value)
    }
  }
  return nextValue
}

function applyWidgetStatePatches(state, patches = {}) {
  if (!state?.widgets || !isPlainObject(patches) || Object.keys(patches).length === 0) {
    return state
  }

  const nextWidgets = { ...(state.widgets || {}) }
  let changed = false
  for (const [ref, patch] of Object.entries(patches)) {
    if (!nextWidgets[ref] || !isPlainObject(patch)) continue
    nextWidgets[ref] = mergeRuntimePatch(nextWidgets[ref], patch)
    changed = true
  }

  return changed
    ? {
        ...state,
        widgets: nextWidgets,
      }
    : state
}

function normalizeWidgetStateMap(widgets = {}) {
  return Object.fromEntries(
    Object.entries(widgets || {}).map(([ref, widgetState]) => [
      ref,
      makeWidgetState({
        ref,
        ...clone(widgetState),
      }),
    ]),
  )
}

function normalizeWorkspaceState(state) {
  return makeWorkspaceState({
    ...clone(state),
    widgets: normalizeWidgetStateMap(state?.widgets || {}),
  })
}

function getTraceRecordPriority(record) {
  const eventKind = record?.eventKind || null
  if (eventKind === 'action') return 3
  if (eventKind === 'perceptionQuery' || eventKind === 'dataQuery') return 2
  if (eventKind === 'systemTransition') return 1
  return 0
}

function pickRepresentativeTraceRecord(currentRecord, nextRecord) {
  if (!currentRecord) return nextRecord || null
  if (!nextRecord) return currentRecord
  return getTraceRecordPriority(nextRecord) >= getTraceRecordPriority(currentRecord)
    ? nextRecord
    : currentRecord
}

function buildResponsePreview(content, maxLength = 160) {
  const text = String(content || '').trim()
  if (!text) return null
  if (!Number.isFinite(maxLength) || maxLength <= 0 || text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, maxLength - 3)}...`
}

function normalizeActorFilter(actors) {
  if (!Array.isArray(actors) || actors.length === 0) return []
  return Array.from(
    new Set(
      actors.filter((actor) => typeof actor === 'string' && actor.length > 0),
    ),
  )
}

function createMutableMapFacade({ keys, getEntry, setEntry, deleteEntry }) {
  return new Proxy({}, {
    get(_target, prop) {
      if (typeof prop === 'symbol') return undefined
      return getEntry(prop)
    },
    set(_target, prop, value) {
      if (typeof prop === 'symbol') return true
      setEntry(prop, value)
      return true
    },
    deleteProperty(_target, prop) {
      if (typeof prop === 'symbol') return true
      deleteEntry(prop)
      return true
    },
    ownKeys() {
      return keys()
    },
    has(_target, prop) {
      if (typeof prop === 'symbol') return false
      return keys().includes(prop)
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop === 'symbol') return undefined
      const value = getEntry(prop)
      if (value == null) return undefined
      return {
        configurable: true,
        enumerable: true,
        writable: true,
        value,
      }
    },
  })
}

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

  upsertWidgetState(ref, widgetState) {
    if (!ref || !widgetState || typeof widgetState !== 'object') return null
    this.state = normalizeWorkspaceState({
      ...clone(this.state),
      widgets: {
        ...(this.state?.widgets || {}),
        [ref]: {
          ref,
          ...clone(widgetState),
        },
      },
    })
    this.syncRegistryWorkspace()
    this.emitChange()
    return this.state.widgets[ref]
  }

  removeWidgetState(ref) {
    if (!ref || !this.state?.widgets?.[ref]) return
    const nextWidgets = { ...(this.state?.widgets || {}) }
    delete nextWidgets[ref]
    this.state = makeWorkspaceState({
      ...clone(this.state),
      widgets: nextWidgets,
    })
    this.syncRegistryWorkspace()
    this.emitChange()
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
    if (!ref || !this.linkIndex?.[ref]) return
    const nextIndex = { ...(this.linkIndex || {}) }
    delete nextIndex[ref]
    this.linkIndex = nextIndex
    this.description = makeWorkspaceDescription({
      ...this.description,
      links: Object.values(this.linkIndex),
    })
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
    this.actionDescriptors = applyActionAnalyticalPlacementList(
      actionDescriptors.map((item) => makeActionDescriptor(item)),
    )
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
    const remainingDescriptors = this.actionDescriptors.filter((item) => item?.name !== descriptorName)
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
    const remainingDescriptors = this.perceptionDescriptors.filter((item) => item?.name !== descriptorName)
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
      ? applyActionAnalyticalPlacementList(
          nextWorkspace.description.actions.map((item) => makeActionDescriptor(item)),
        )
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
    const patchedState = applyWidgetStatePatches(nextWorkspace.state, this.widgetStatePatches)
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
    return Object.values(this.linkIndex)
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
    return ref ? this.runtimeData?.[ref] || null : this.runtimeData
  }

  resolveSelectionDataRef(selectionRef) {
    const parts = parseRef(selectionRef)
    if (!parts?.widgetId || !parts?.selectionId) return null
    return makeSelectionScopedDataRef({
      appId: parts.appId || this.appId,
      workspaceId: parts.workspaceId || this.workspaceId,
      widgetId: parts.widgetId,
      selectionId: parts.selectionId,
    })
  }

  updateRuntimeData(ref, updater) {
    if (!ref || typeof updater !== 'function') return null
    const currentEntry = this.runtimeData?.[ref]
    if (!currentEntry) return null
    const nextEntry = updater(clone(currentEntry))
    if (!nextEntry || typeof nextEntry !== 'object') return currentEntry
    this.upsertRuntimeData(ref, nextEntry)
    this.emitChange()
    return nextEntry
  }

  upsertRuntimeData(ref, entry) {
    if (!ref || !entry || typeof entry !== 'object') return null
    this.runtimeData = {
      ...(this.runtimeData || {}),
      [ref]: entry,
    }
    const nextHandle = entry.handle || this.dataHandleIndex?.[ref] || null
    if (nextHandle) {
      this.dataHandleIndex = {
        ...(this.dataHandleIndex || {}),
        [ref]: nextHandle,
      }
      this.widgetRegistry.updateDataHandle?.(ref, nextHandle)
    }
    if (Array.isArray(this.description?.dataHandles)) {
      const hasExistingHandle = this.description.dataHandles.some((handle) => handle?.ref === ref)
      this.description = {
        ...this.description,
        dataHandles: hasExistingHandle
          ? this.description.dataHandles.map((handle) => (handle?.ref === ref ? (nextHandle || handle) : handle))
          : nextHandle
            ? [...this.description.dataHandles, nextHandle]
            : this.description.dataHandles,
      }
    }
    return entry
  }

  removeRuntimeData(ref) {
    if (!ref || !this.runtimeData?.[ref]) return
    const nextRuntimeData = { ...(this.runtimeData || {}) }
    delete nextRuntimeData[ref]
    this.runtimeData = nextRuntimeData

    if (this.dataHandleIndex?.[ref]) {
      const nextDataHandleIndex = { ...(this.dataHandleIndex || {}) }
      delete nextDataHandleIndex[ref]
      this.dataHandleIndex = nextDataHandleIndex
      this.widgetRegistry.removeDataHandle?.(ref)
    }

    if (Array.isArray(this.description?.dataHandles)) {
      this.description = {
        ...this.description,
        dataHandles: this.description.dataHandles.filter((handle) => handle?.ref !== ref),
      }
    }
  }

  syncCurrentSelectionRuntimeData() {
    const currentSelectionDataRef = makeCurrentSelectionDataRef({
      appId: this.appId,
      workspaceId: this.workspaceId,
    })
    const focusedWidgetRef =
      this.state?.shared?.focusedWidget
      || Object.keys(this.state?.widgets || {})[0]
      || this.listWidgetDescriptions()[0]?.ref
      || null
    const focusedWidget = focusedWidgetRef ? this.getWidgetState(focusedWidgetRef) : null
    const focusedWidgetId = focusedWidget?.widgetId || null
    const focusedSelectionDataRef = focusedWidgetId
      ? makeWidgetSelectionDataRef({
          appId: this.appId,
          workspaceId: this.workspaceId,
          widgetId: focusedWidgetId,
        })
      : null
    const focusedSelectionEntry = focusedSelectionDataRef ? this.readRuntimeData(focusedSelectionDataRef) : null
    const focusedSelectionRef =
      focusedWidgetRef
        ? Object.keys(this.state?.widgets?.[focusedWidgetRef]?.selections || {})[0] || null
        : null

    if (!focusedSelectionEntry?.widgetRef || !Array.isArray(focusedSelectionEntry?.rows)) {
      this.removeRuntimeData(currentSelectionDataRef)
      return null
    }

    const currentSelectionHandle = buildDerivedDataHandle({
      ref: currentSelectionDataRef,
      title: 'Current Selection Data',
      description: 'Current rows for the focused widget selection.',
      rows: focusedSelectionEntry.rows,
      selectedCount: focusedSelectionEntry.rows.length,
      kind: 'selectionData',
      scope: 'workspaceCurrent',
      widgetRef: focusedSelectionEntry.widgetRef,
      sourceSelectionRef: focusedSelectionRef,
    })
    const nextEntry = {
      ref: currentSelectionDataRef,
      rows: focusedSelectionEntry.rows,
      baseRows: focusedSelectionEntry.baseRows,
      handle: currentSelectionHandle,
      widgetRef: focusedSelectionEntry.widgetRef,
      sourceSelectionRef: focusedSelectionRef,
      kind: 'selectionData',
      scope: 'workspaceCurrent',
    }
    this.upsertRuntimeData(currentSelectionDataRef, nextEntry)
    return nextEntry
  }

  syncCurrentViewRuntimeData() {
    const currentViewDataRef = makeCurrentViewDataRef({
      appId: this.appId,
      workspaceId: this.workspaceId,
    })
    const focusedWidgetRef =
      this.state?.shared?.focusedWidget
      || Object.keys(this.state?.widgets || {})[0]
      || this.listWidgetDescriptions()[0]?.ref
      || null
    const focusedWidget = focusedWidgetRef ? this.getWidgetState(focusedWidgetRef) : null
    const focusedDataRef = focusedWidget?.data?.currentDataRef || focusedWidget?.data?.sourceDataRef || null
    const focusedDataEntry = focusedDataRef ? this.readRuntimeData(focusedDataRef) : null

    if (!focusedDataEntry?.widgetRef || !Array.isArray(focusedDataEntry?.rows)) {
      this.removeRuntimeData(currentViewDataRef)
      return null
    }

    const currentViewHandle = buildDerivedDataHandle({
      ref: currentViewDataRef,
      title: 'Current View Data',
      description: 'Current visible rows for the focused widget.',
      rows: focusedDataEntry.rows,
      selectedCount: focusedDataEntry.handle?.stats?.selectedCount || 0,
      kind: 'dataView',
      scope: 'workspaceCurrentView',
      widgetRef: focusedDataEntry.widgetRef,
    })
    const nextEntry = {
      ref: currentViewDataRef,
      rows: focusedDataEntry.rows,
      baseRows: focusedDataEntry.baseRows,
      handle: currentViewHandle,
      widgetRef: focusedDataEntry.widgetRef,
      kind: 'dataView',
      scope: 'workspaceCurrentView',
    }
    this.upsertRuntimeData(currentViewDataRef, nextEntry)
    return nextEntry
  }

  syncSelectionRuntimeData(widgetRef) {
    if (!widgetRef) return null
    const widgetState = this.getWidgetState(widgetRef)
    const widgetDescription = this.getWidgetDescription(widgetRef)
    const widgetId = widgetState?.widgetId || widgetDescription?.widgetId || null
    const managedSelectionDataRefs = Object.values(this.runtimeData || {})
      .filter((entry) => entry?.widgetRef === widgetRef && entry?.kind === 'selectionData')
      .map((entry) => entry?.ref)
      .filter((ref) => typeof ref === 'string')
    const currentDataRef = widgetState?.data?.currentDataRef || null
    const currentDataEntry = currentDataRef ? this.readRuntimeData(currentDataRef) : null
    if (!widgetId || !currentDataEntry) {
      for (const managedRef of managedSelectionDataRefs) {
        this.removeRuntimeData(managedRef)
      }
      this.syncCurrentViewRuntimeData()
      this.syncCurrentSelectionRuntimeData()
      this.emitChange()
      return null
    }

    const activeSelectionEntries = Object.entries(widgetState?.selections || {})
      .filter(([selectionRef, selectionState]) => Boolean(selectionRef) && Boolean(selectionState))
    const selectionDataRef = makeWidgetSelectionDataRef({
      appId: this.appId,
      workspaceId: this.workspaceId,
      widgetId,
    })
    if (activeSelectionEntries.length === 0) {
      for (const managedRef of managedSelectionDataRefs) {
        this.removeRuntimeData(managedRef)
      }
      this.syncCurrentViewRuntimeData()
      this.syncCurrentSelectionRuntimeData()
      this.emitChange()
      return null
    }

    const visibleRows = Array.isArray(currentDataEntry?.rows) ? currentDataEntry.rows : []
    const selections = activeSelectionEntries.map(([, selectionState]) => selectionState)
    const selectedRows = visibleRows.filter((row) => rowMatchesAnySelection(row, selections))
    const nextManagedRefs = new Set([selectionDataRef])
    const handle = buildDerivedDataHandle({
      ref: selectionDataRef,
      title: `${widgetDescription?.title || widgetId} Selection Data`,
      description: `Current rows selected on widget ${widgetId}.`,
      rows: selectedRows,
      selectedCount: selectedRows.length,
      kind: 'selectionData',
      scope: 'combined',
      widgetRef,
    })

    const nextEntry = {
      ref: selectionDataRef,
      rows: selectedRows,
      baseRows: visibleRows,
      handle,
      widgetRef,
      kind: 'selectionData',
      scope: 'combined',
    }
    this.upsertRuntimeData(selectionDataRef, nextEntry)

    for (const [selectionRef, selectionState] of activeSelectionEntries) {
      const selectionScopedDataRef = this.resolveSelectionDataRef(selectionRef)
      if (!selectionScopedDataRef) continue
      nextManagedRefs.add(selectionScopedDataRef)
      const selectionId = selectionRef.split('/').pop() || 'selection'
      const selectionRows = visibleRows.filter((row) => rowMatchesSelection(row, selectionState))
      const selectionScopedHandle = buildDerivedDataHandle({
        ref: selectionScopedDataRef,
        title: `${widgetDescription?.title || widgetId} Selection ${selectionId} Data`,
        description: `Current rows for selection ${selectionId} on widget ${widgetId}.`,
        rows: selectionRows,
        selectedCount: selectionRows.length,
        kind: 'selectionData',
        scope: 'selection',
        widgetRef,
        sourceSelectionRef: selectionRef,
      })
      this.upsertRuntimeData(selectionScopedDataRef, {
        ref: selectionScopedDataRef,
        rows: selectionRows,
        baseRows: visibleRows,
        handle: selectionScopedHandle,
        widgetRef,
        sourceSelectionRef: selectionRef,
        kind: 'selectionData',
        scope: 'selection',
      })
    }

    for (const managedRef of managedSelectionDataRefs) {
      if (!nextManagedRefs.has(managedRef)) {
        this.removeRuntimeData(managedRef)
      }
    }
    this.syncCurrentViewRuntimeData()
    this.syncCurrentSelectionRuntimeData()
    this.emitChange()
    return nextEntry
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
        adapterRegistry: true,
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
