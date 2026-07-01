import { makeSelectionScopedDataRef, parseRef } from '../protocol/refs.js'
import {
  WORKSPACE_OPTIONAL_TRANSPORT_TOOL_NAMES,
  WORKSPACE_TRANSPORT_TOOL_NAMES,
  makeWorkspaceDescription,
  makeWorkspaceTransportHints,
} from '../protocol/description.js'
import {
  getInteractionTraceEventFamily,
  getInteractionTraceQueryName,
  getInteractionTraceQuerySurface,
} from '../protocol/interactionTrace.js'
import {
  makeBranchSummary,
  makeStateSnapshotMeta,
  makeTraceGraph,
  makeTraceGraphEdge,
  makeTraceGraphNode,
} from '../protocol/results.js'
import { normalizeWidgetLink } from '../protocol/widgetLinks.js'
import { stripWidgetLinkCompatibilityFields } from '../protocol/widgetLinks.js'
import { deriveWorkspaceTopology } from './deriveWorkspaceTopology.js'
import { applyActionAnalyticalPlacementList } from '../../workspace/state/analyticalStatePlacement.js'
import {
  REPLAY_CONTEXT_REF,
  SHARED_STATE_REF,
  TASK_CONTEXT_REF,
} from './StateManager.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function normalizeActorFilter(actors) {
  return Array.isArray(actors)
    ? [...new Set(actors.filter((actor) => typeof actor === 'string' && actor.length > 0))]
    : []
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

function stableSerialize(value) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function createDeltaFallback({ previousState, nextState, previousReplayContext = undefined, nextReplayContext = undefined }) {
  const previousWidgets = previousState?.widgets || {}
  const nextWidgets = nextState?.widgets || {}
  const changedRefs = []
  const removedRefs = []

  const allRefs = new Set([...Object.keys(previousWidgets), ...Object.keys(nextWidgets)])
  for (const ref of allRefs) {
    if (!(ref in nextWidgets)) {
      removedRefs.push(ref)
      continue
    }
    if (!(ref in previousWidgets)) {
      changedRefs.push(ref)
      continue
    }
    if (stableSerialize(previousWidgets[ref]) !== stableSerialize(nextWidgets[ref])) {
      changedRefs.push(ref)
    }
  }

  if (stableSerialize(previousState?.shared || null) !== stableSerialize(nextState?.shared || null)) {
    changedRefs.push(SHARED_STATE_REF)
  }

  const previousTaskContextExists = previousState?.taskContext !== undefined
  const nextTaskContextExists = nextState?.taskContext !== undefined
  if (previousTaskContextExists || nextTaskContextExists) {
    if (!nextTaskContextExists) {
      removedRefs.push(TASK_CONTEXT_REF)
    } else if (!previousTaskContextExists || stableSerialize(previousState?.taskContext) !== stableSerialize(nextState?.taskContext)) {
      changedRefs.push(TASK_CONTEXT_REF)
    }
  }

  const previousReplayContextExists = previousReplayContext !== undefined
  const nextReplayContextExists = nextReplayContext !== undefined
  if (previousReplayContextExists || nextReplayContextExists) {
    if (!nextReplayContextExists) {
      removedRefs.push(REPLAY_CONTEXT_REF)
    } else if (!previousReplayContextExists || stableSerialize(previousReplayContext) !== stableSerialize(nextReplayContext)) {
      changedRefs.push(REPLAY_CONTEXT_REF)
    }
  }

  return {
    baseStateId: previousState?.stateId || null,
    changedRefs,
    removedRefs,
  }
}

function pickRefsFromStateFallback({ state, refs, replayContext = undefined }) {
  if (!Array.isArray(refs) || refs.length === 0) {
    return clone(state)
  }
  const widgets = {}
  const includeShared = refs.includes(SHARED_STATE_REF)
  const includeTaskContext = refs.includes(TASK_CONTEXT_REF)
  const includeReplayContext = refs.includes(REPLAY_CONTEXT_REF)
  for (const ref of refs) {
    if (state?.widgets?.[ref]) {
      widgets[ref] = clone(state.widgets[ref])
    }
  }
  const nextState = {
    ...clone(state),
    widgets,
  }
  if (!includeShared) delete nextState.shared
  if (!includeTaskContext) delete nextState.taskContext
  if (includeReplayContext) {
    nextState.replayContext = clone(replayContext)
  } else {
    delete nextState.replayContext
  }
  return nextState
}

function deriveWorkspaceCapabilities({ widgets, links, store }) {
  const capabilities = new Set()
  if (Array.isArray(widgets) && widgets.length > 0) {
    capabilities.add('singleWidgetAnalysis')
  }
  if (Array.isArray(widgets) && widgets.length > 1) {
    capabilities.add('multiWidgetCoordination')
  }
  if (Array.isArray(links)) {
    if (links.some((link) => link?.kind === 'filter' || link?.kind === 'filters')) {
      capabilities.add('crossFilter')
    }
    if (links.some((link) => link?.kind === 'sharesSelection')) {
      capabilities.add('sharedSelection')
    }
    if (links.some((link) => link?.kind === 'syncDomain' || link?.kind === 'syncsDomain')) {
      capabilities.add('domainSync')
    }
  }
  if (Array.isArray(store?.interactionTrace) && store.interactionTrace.length > 0) {
    capabilities.add('traceReplay')
  }
  if (Array.isArray(store?.stateSnapshots) && store.stateSnapshots.length > 0) {
    capabilities.add('traceReplay')
  }
  return Array.from(capabilities)
}

export function valuesFromRecord(record) {
  return record && typeof record === 'object' && !Array.isArray(record)
    ? Object.values(record).filter(Boolean)
    : []
}

export function listResponsesFromStore(store, limit = 20, options = {}) {
  if (typeof store?.listResponses === 'function') {
    return store.listResponses(limit, options)
  }

  const workspaceId = options.workspaceId || store?.workspaceId || null
  const fullResponses = Array.isArray(store?.responseHistory) ? store.responseHistory : []
  const filteredResponses = workspaceId
    ? fullResponses.filter((item) => item?.workspaceId === workspaceId)
    : fullResponses
  return filteredResponses.slice(-(Number.isFinite(limit) ? limit : 20)).map((item) => clone(item))
}

export function readLatestResponseFromStore(store, options = {}) {
  if (typeof store?.readLatestResponse === 'function') {
    return store.readLatestResponse(options)
  }
  return listResponsesFromStore(store, 1, options)[0] || null
}

export function listStateSnapshotsFromStore(store, options = 50) {
  if (typeof store?.listStateSnapshots === 'function') {
    return store.listStateSnapshots(options)
  }

  const normalizedOptions = typeof options === 'number' ? { limit: options } : (options || {})
  const limit = Number.isFinite(normalizedOptions.limit) ? normalizedOptions.limit : 50
  const sinceStateId = normalizedOptions.sinceStateId || null
  const allowedActors = normalizeActorFilter(normalizedOptions.actors)
  const fullSnapshots = Array.isArray(store?.stateSnapshots) ? store.stateSnapshots : []
  const traceByStateId = new Map(
    (Array.isArray(store?.interactionTrace) ? store.interactionTrace : [])
      .filter((record) => typeof record?.stateId === 'string' && record.stateId.length > 0)
      .map((record) => [record.stateId, record]),
  )
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
    const representativeTrace = traceByStateId.get(item?.stateId)
    return makeStateSnapshotMeta({
      stateId: item?.stateId || '',
      createdAt: item?.createdAt || item?.state?.createdAt || null,
      baseStateId: (item?.parentStateId ?? item?.state?.delta?.baseStateId) || null,
      branchId: item?.branchId || null,
      transitionType: item?.transitionType || 'continue',
      branchLabel: item?.branchLabel || null,
      actor: representativeTrace?.actor || 'system',
      changedRefs: Array.isArray(item?.state?.delta?.changedRefs) ? [...item.state.delta.changedRefs] : [],
      removedRefs: Array.isArray(item?.state?.delta?.removedRefs) ? [...item.state.delta.removedRefs] : [],
    })
  })
}

export function listBranchesFromStore(store) {
  if (typeof store?.listBranches === 'function') {
    return store.listBranches()
  }
  return valuesFromRecord(store?.branchRegistry).map((entry) => makeBranchSummary(clone(entry)))
}

export function readInteractionTraceFromStore(store, options = {}) {
  if (typeof store?.readTraceWindow === 'function') {
    return store.readTraceWindow({
      limit: options.limit || 50,
      sinceStateId: options.sinceStateId || null,
      actors: options.actors || [],
    })
  }
  if (typeof store?.readTrace === 'function') {
    const fullTrace = store.readTrace(options.limit || 50)
    const sinceStateId = options.sinceStateId || null
    const allowedActors = normalizeActorFilter(options.actors)
    const scopedTrace = sinceStateId
      ? (() => {
          const idx = fullTrace.findIndex((record) => record?.stateId === sinceStateId)
          return idx >= 0 ? fullTrace.slice(idx + 1) : fullTrace
        })()
      : fullTrace
    return allowedActors.length > 0
      ? scopedTrace.filter((record) => allowedActors.includes(record?.actor || 'system'))
      : scopedTrace
  }

  const fullTrace = Array.isArray(store?.interactionTrace) ? [...store.interactionTrace] : []
  const sinceStateId = options.sinceStateId || null
  const allowedActors = normalizeActorFilter(options.actors)
  const scopedTrace = sinceStateId
    ? (() => {
        const idx = fullTrace.findIndex((record) => record?.stateId === sinceStateId)
        return idx >= 0 ? fullTrace.slice(idx + 1) : fullTrace
      })()
    : fullTrace
  const actorScopedTrace = allowedActors.length > 0
    ? scopedTrace.filter((record) => allowedActors.includes(record?.actor || 'system'))
    : scopedTrace
  const limit = options.limit || 50
  if (!Number.isFinite(limit) || limit <= 0) {
    return actorScopedTrace
  }
  return actorScopedTrace.slice(-limit)
}

export function readSnapshotEntryFromStore(store, stateId) {
  if (!stateId || typeof stateId !== 'string') return null
  if (typeof store?.readSnapshotEntry === 'function') {
    return store.readSnapshotEntry(stateId)
  }
  const snapshot = Array.isArray(store?.stateSnapshots)
    ? store.stateSnapshots.find((item) => item?.stateId === stateId) || null
    : null
  return snapshot ? clone(snapshot) : null
}

export function readCurrentSnapshotMetaFromStore(store) {
  if (typeof store?.readCurrentSnapshotMeta === 'function') {
    return store.readCurrentSnapshotMeta()
  }

  const fullSnapshots = Array.isArray(store?.stateSnapshots) ? store.stateSnapshots : []
  if (fullSnapshots.length === 0) return null
  const currentStateId = store?.state?.stateId || store?.stateId || null
  const matchingSnapshot = currentStateId
    ? fullSnapshots.find((entry) => entry?.stateId === currentStateId) || null
    : null
  return clone(matchingSnapshot || fullSnapshots[fullSnapshots.length - 1] || null)
}

export function readSnapshotFromStore(store, stateId, options = {}) {
  const entry = readSnapshotEntryFromStore(store, stateId)
  const snapshot = entry?.state || null
  if (!snapshot) return null

  const scopedSnapshot = Array.isArray(options.refs) && options.refs.length > 0
    ? (typeof store?.stateManager?.pickRefs === 'function'
        ? store.stateManager.pickRefs({ state: snapshot, refs: options.refs, replayContext: entry?.replayContext || null })
        : (() => {
            const refs = options.refs.filter(Boolean)
            const widgets = {}
            for (const ref of refs) {
              if (snapshot?.widgets?.[ref]) {
                widgets[ref] = clone(snapshot.widgets[ref])
              }
            }
            const nextSnapshot = {
              ...clone(snapshot),
              widgets,
            }
            if (!refs.includes(SHARED_STATE_REF)) delete nextSnapshot.shared
            if (!refs.includes(TASK_CONTEXT_REF)) delete nextSnapshot.taskContext
            if (refs.includes(REPLAY_CONTEXT_REF)) {
              nextSnapshot.replayContext = clone(entry?.replayContext || null)
            } else {
              delete nextSnapshot.replayContext
            }
            return nextSnapshot
          })())
    : {
        ...clone(snapshot),
        replayContext: clone(entry?.replayContext || null),
      }

  return options.includeMeta
    ? {
        ...scopedSnapshot,
        __meta: {
          stateId: entry?.stateId || null,
          parentStateId: entry?.parentStateId || null,
          branchId: entry?.branchId || null,
          transitionType: entry?.transitionType || 'continue',
          branchLabel: entry?.branchLabel || null,
        },
      }
    : scopedSnapshot
}

export function buildTraceGraphFromStore(store, options = 50) {
  if (typeof store?.buildTraceGraph === 'function') {
    return store.buildTraceGraph(options)
  }

  const normalizedOptions = typeof options === 'number' ? { limit: options } : (options || {})
  const limit = Number.isFinite(normalizedOptions.limit) ? normalizedOptions.limit : 50
  const sinceStateId = normalizedOptions.sinceStateId || null
  const allowedActors = normalizeActorFilter(normalizedOptions.actors)
  const fullSnapshots = Array.isArray(store?.stateSnapshots) ? store.stateSnapshots : []
  const scopedSnapshots = sinceStateId
    ? (() => {
        const idx = fullSnapshots.findIndex((snapshot) => snapshot?.stateId === sinceStateId)
        return idx >= 0 ? fullSnapshots.slice(idx + 1) : fullSnapshots
      })()
    : fullSnapshots

  const traceByStateId = new Map()
  for (const record of Array.isArray(store?.interactionTrace) ? store.interactionTrace : []) {
    if (!record?.stateId) continue
    traceByStateId.set(
      record.stateId,
      pickRepresentativeTraceRecord(traceByStateId.get(record.stateId), record),
    )
  }

  const actorScopedSnapshots = allowedActors.length > 0
    ? scopedSnapshots.filter((snapshot) => {
        const actor = traceByStateId.get(snapshot?.stateId)?.actor || 'system'
        return allowedActors.includes(actor)
      })
    : scopedSnapshots
  const snapshots = actorScopedSnapshots.slice(-limit)

  const latestResponseByStateId = new Map()
  for (const response of Array.isArray(store?.responseHistory) ? store.responseHistory : []) {
    if (!response?.stateId) continue
    latestResponseByStateId.set(response.stateId, response)
  }

  const nodes = snapshots.map((snapshot) => {
    const record = traceByStateId.get(snapshot?.stateId)
    const response = latestResponseByStateId.get(snapshot?.stateId)
    const queryName = getInteractionTraceQueryName(record?.query)
    return makeTraceGraphNode({
      id: snapshot?.stateId || '',
      stateId: snapshot?.stateId || '',
      parentStateId: snapshot?.parentStateId || null,
      branchId: snapshot?.branchId || 'main',
      branchLabel: snapshot?.branchLabel || null,
      timestamp: snapshot?.createdAt || snapshot?.state?.createdAt || null,
      actor: record?.actor || 'system',
      eventFamily: record?.eventFamily || getInteractionTraceEventFamily(record),
      querySurface: record?.querySurface || getInteractionTraceQuerySurface(record),
      actionName: record?.action?.name || null,
      queryName,
      responseId: response?.responseId || null,
      responseActor: response?.actor || null,
      responsePreview: buildResponsePreview(response?.content),
      label: record?.action?.name || queryName || snapshot?.transitionType || 'state',
      transitionType: snapshot?.transitionType || 'continue',
      current: snapshot?.stateId === (store?.state?.stateId || store?.stateId || null),
    })
  })

  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = snapshots
    .filter((snapshot) => snapshot?.parentStateId)
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
    current_state_id: store?.state?.stateId || store?.stateId || null,
    current_branch_id: store?.currentBranchId || null,
    sinceStateId,
    actors: allowedActors,
    branches: listBranchesFromStore(store),
    nodes,
    edges,
  })
}

export function listStoreWidgets(store) {
  if (typeof store?.listWidgetDescriptions === 'function') {
    return store.listWidgetDescriptions()
  }
  return valuesFromRecord(store?.descriptions)
}

export function listStoreDataHandles(store) {
  if (typeof store?.listDataHandles === 'function') {
    return store.listDataHandles()
  }
  return valuesFromRecord(store?.dataHandles)
}

export function readDataHandleFromStore(store, ref) {
  if (!ref || typeof ref !== 'string') return null
  if (typeof store?.getDataHandle === 'function') {
    return store.getDataHandle(ref)
  }
  return store?.dataHandles?.[ref] || null
}

export function listStoreLinks(store) {
  if (typeof store?.listLinks === 'function') {
    return (store.listLinks() || []).map((link) => stripWidgetLinkCompatibilityFields(normalizeWidgetLink(link)))
  }
  return valuesFromRecord(store?.links).map((link) => stripWidgetLinkCompatibilityFields(normalizeWidgetLink(link)))
}

export function listStoreActions(store, actionExecutor = null) {
  if (typeof store?.listActions === 'function') {
    const listedActions = store.listActions()
    if (Array.isArray(listedActions) && listedActions.length > 0) {
      return listedActions
    }
  }
  if (typeof actionExecutor?.list === 'function') {
    const listedActions = actionExecutor.list()
    if (Array.isArray(listedActions) && listedActions.length > 0) {
      return listedActions
    }
  }
  return valuesFromRecord(store?.actions)
}

export function listStorePerceptionQueries(store, perceptionQueryRegistry = null) {
  if (typeof store?.listPerceptionQueries === 'function') {
    const listedQueries = store.listPerceptionQueries()
    if (Array.isArray(listedQueries) && listedQueries.length > 0) {
      return listedQueries
    }
  }
  if (typeof perceptionQueryRegistry?.list === 'function') {
    const listedQueries = perceptionQueryRegistry.list()
    if (Array.isArray(listedQueries) && listedQueries.length > 0) {
      return listedQueries
    }
  }
  return valuesFromRecord(store?.perceptionQueries)
}

export function readRuntimeDataFromStore(store, dataRef) {
  if (!dataRef || typeof dataRef !== 'string') return null
  if (typeof store?.readRuntimeData === 'function') {
    return store.readRuntimeData(dataRef)
  }
  return store?.runtimeData?.[dataRef] || null
}

export function resolveWidgetRecordFromStore(store, ref) {
  if (!ref || typeof ref !== 'string') return null
  if (typeof store?.getResolvedWidgetForTarget === 'function') {
    const resolvedTarget = store.getResolvedWidgetForTarget(ref)
    if (resolvedTarget) return resolvedTarget
  }
  if (typeof store?.getResolvedWidget === 'function') {
    const resolvedWidget = store.getResolvedWidget(ref)
    if (resolvedWidget) return resolvedWidget
  }
  if (typeof store?.getWidgetDescription === 'function') {
    const widgetDescription = store.getWidgetDescription(ref)
    if (widgetDescription) return widgetDescription
  }

  const widgetDescription = store?.descriptions?.[ref] || null
  const widgetState = store?.widgets?.[ref] || null
  if (widgetDescription || widgetState) {
    return {
      ...(widgetDescription || {}),
      ...(widgetState || {}),
      ref,
      data: {
        ...(widgetDescription?.data || {}),
        ...(widgetState?.data || {}),
      },
    }
  }

  const widgets = listStoreWidgets(store)
  const widgetByDataRef = widgets.find((widget) => {
    const currentDataRef = widget?.data?.currentDataRef || null
    const sourceDataRef = widget?.data?.sourceDataRef || null
    const primaryDataRef = widget?.primaryDataRef || null
    return currentDataRef === ref || sourceDataRef === ref || primaryDataRef === ref
  }) || null

  if (!widgetByDataRef?.ref) return null
  const widgetStateByDataRef = store?.widgets?.[widgetByDataRef.ref] || null
  return {
    ...widgetByDataRef,
    ...(widgetStateByDataRef || {}),
    ref: widgetByDataRef.ref,
    data: {
      ...(widgetByDataRef?.data || {}),
      ...(widgetStateByDataRef?.data || {}),
    },
  }
}

export function resolveSelectionDataRefFromStore(store, selectionRef) {
  if (!selectionRef || typeof selectionRef !== 'string') return null
  if (typeof store?.resolveSelectionDataRef === 'function') {
    const resolvedDataRef = store.resolveSelectionDataRef(selectionRef)
    if (resolvedDataRef) return resolvedDataRef
  }

  const parts = parseRef(selectionRef)
  if (!parts?.widgetId || !parts?.selectionId) return null
  return makeSelectionScopedDataRef({
    appId: parts.appId || store?.appId || 'widgetva-app',
    workspaceId: parts.workspaceId || store?.workspaceId || 'main',
    widgetId: parts.widgetId,
    selectionId: parts.selectionId,
  })
}

export function readWorkspaceDescriptionFromStore(store, {
  actionExecutor = null,
  perceptionQueryRegistry = null,
} = {}) {
  if (typeof store?.readDescription === 'function') {
    const description = store.readDescription() || {}
    return makeWorkspaceDescription({
      ...description,
      actions: applyActionAnalyticalPlacementList(
        Array.isArray(description?.actions) ? description.actions : [],
      ),
    })
  }
  const widgets = listStoreWidgets(store)
  const links = listStoreLinks(store)
  const workspaceCapabilities = deriveWorkspaceCapabilities({ widgets, links, store })
  return makeWorkspaceDescription({
    appId: store?.appId || null,
    workspaceId: store?.workspaceId || null,
    generatedAt: new Date().toISOString(),
    workspaceCapabilities,
    transportHints: makeWorkspaceTransportHints({
      recommendedTools: [...WORKSPACE_TRANSPORT_TOOL_NAMES],
      optionalTools: [...WORKSPACE_OPTIONAL_TRANSPORT_TOOL_NAMES],
      note: 'External transports should prefer the stable workspace/view/action/perception/trace surface.',
    }),
    runtimeTopology: deriveWorkspaceTopology({ widgets, links }),
    widgets,
    dataHandles: listStoreDataHandles(store),
    links,
    actions: applyActionAnalyticalPlacementList(listStoreActions(store, actionExecutor)),
    perceptionQueries: listStorePerceptionQueries(store, perceptionQueryRegistry),
  })
}

export function readWorkspaceStateFromStore(store, options = {}) {
  if (typeof store?.readState === 'function') {
    return store.readState(options)
  }
  const normalizedRefs = Array.isArray(options?.refs) ? options.refs.filter(Boolean) : null
  const allWidgets = store?.widgets && typeof store.widgets === 'object' && !Array.isArray(store.widgets)
    ? store.widgets
    : {}
  const widgetEntries = normalizedRefs
    ? normalizedRefs
        .map((ref) => [ref, allWidgets?.[ref] || null])
        .filter(([, widgetState]) => Boolean(widgetState))
    : Object.entries(allWidgets).filter(([, widgetState]) => Boolean(widgetState))
  const fallbackState = {
    stateId: store?.stateId || null,
    createdAt: new Date().toISOString(),
    widgets: Object.fromEntries(widgetEntries.map(([ref, widgetState]) => [ref, clone(widgetState)])),
    shared: {
      selections: {
        registry: {},
        views: {
          primary: null,
          byWidget: {},
        },
      },
      focus: null,
      highlight: null,
      viewport: null,
      globalFilters: {},
      focusedWidget: undefined,
      annotations: [],
      links: {
        definitions: [],
        topology: {},
      },
      ...(clone(store?.shared) || {}),
    },
  }

  if (options?.deltaSince) {
    const baseEntry = readSnapshotEntryFromStore(store, options.deltaSince)
    if (baseEntry?.state) {
      const currentSnapshotEntry = readCurrentSnapshotMetaFromStore(store)
      const currentState = clone(currentSnapshotEntry?.state || {
        ...fallbackState,
        ...(store?.taskContext !== undefined ? { taskContext: clone(store.taskContext) } : {}),
      })
      const delta =
        typeof store?.stateManager?.createDelta === 'function'
          ? store.stateManager.createDelta({
              previousState: baseEntry.state,
              nextState: currentState,
              previousReplayContext: baseEntry.replayContext,
              nextReplayContext: currentSnapshotEntry?.replayContext ?? store?.replayContext,
            })
          : createDeltaFallback({
              previousState: baseEntry.state,
              nextState: currentState,
              previousReplayContext: baseEntry.replayContext,
              nextReplayContext: currentSnapshotEntry?.replayContext ?? store?.replayContext,
            })
      const scopedRefs = normalizedRefs && normalizedRefs.length > 0
        ? (delta.changedRefs || []).filter((ref) => normalizedRefs.includes(ref))
        : null
      const nextState = {
        ...currentState,
        delta,
      }
      return typeof store?.stateManager?.pickRefs === 'function'
        ? store.stateManager.pickRefs({
            state: nextState,
            replayContext: currentSnapshotEntry?.replayContext ?? store?.replayContext,
            refs: scopedRefs || delta.changedRefs || [],
          })
        : pickRefsFromStateFallback({
            state: nextState,
            replayContext: currentSnapshotEntry?.replayContext ?? store?.replayContext,
            refs: scopedRefs || delta.changedRefs || [],
          })
    }
  }

  return fallbackState
}
