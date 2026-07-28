import { makeInteractionTraceRecord } from './shapes/interactionTraceShapes.js'
import {
  makeAgentResponseRecord,
  makeResponseRecorderCapabilities,
  makeResponseRecorderCounters,
  makeResponseRecorderSummary,
} from './shapes/responseRecorderShapes.js'
import {
  readCurrentSnapshotMetaFromStore,
  readSnapshotEntryFromStore,
  readWorkspaceStateFromStore,
} from '../../workspace/store/workspaceStoreReaders.js'
import { appendTraceRecordToStore } from '../../workspace/store/workspaceStoreMutators.js'
import { readNormalizedQueryScope } from './support/queryScope.js'

function makeTraceRecorderCapabilities(capabilities = {}) {
  return {
    recordsActions: true,
    recordsPerceptionQueries: true,
    recordsPerceptionQueryFailures: true,
    recordsDataQueries: true,
    recordsDataQueryFailures: true,
    normalizedQueryFamily: true,
    recordsSystemTransitions: true,
    lineageTracking: true,
    ...capabilities,
  }
}

function makeTraceRecorderCounters(counters = {}) {
  return {
    traceCount: 0,
    latestStateId: null,
    latestBranchId: null,
    latestEventKind: null,
    latestEventFamily: null,
    latestQuerySurface: null,
    latestOutcome: null,
    ...counters,
  }
}

function makeTraceRecorderSummary(summary = {}) {
  return {
    eventKinds: [],
    eventFamilies: [],
    querySurfaces: [],
    ...summary,
    capabilities: makeTraceRecorderCapabilities(summary?.capabilities),
    counters: makeTraceRecorderCounters(summary?.counters),
  }
}

export class TraceRecorder {
  constructor({ store }) {
    this.store = store
  }

  buildLineageFields(stateId) {
    const snapshot = stateId
      ? readSnapshotEntryFromStore(this.store, stateId)
      : readCurrentSnapshotMetaFromStore(this.store)
    return {
      parentStateId: snapshot?.parentStateId || null,
      branchId: snapshot?.branchId || null,
    }
  }

  appendTrace(record) {
    return appendTraceRecordToStore(this.store, record)
  }

  recordAction({ call, updatedRefs, stateId, statePatch, primitive, notes }) {
    const lineage = this.buildLineageFields(stateId)
    this.appendTrace(makeInteractionTraceRecord({
      actor: call?.actor || 'agent',
      eventKind: 'action',
      action: call,
      primitive: primitive || null,
      affectedRefs: updatedRefs,
      stateId,
      statePatch,
      ...lineage,
      notes: {
        outcome: 'success',
        ...(notes || {}),
      },
    }))
  }

  recordActionFailure({
    call,
    primitive = null,
    code,
    message,
    details,
    recoveryHints = [],
    notes,
  }) {
    const currentStateId = readWorkspaceStateFromStore(this.store)?.stateId || 'unknown'
    const lineage = this.buildLineageFields(currentStateId)
    const targetRef = readNormalizedQueryScope({ call }).widgetRef || null
    this.appendTrace(makeInteractionTraceRecord({
      actor: call?.actor || 'agent',
      eventKind: 'action',
      action: call,
      primitive,
      affectedRefs: targetRef ? [targetRef] : [],
      stateId: currentStateId,
      statePatch: {},
      ...lineage,
      notes: {
        outcome: 'failure',
        errorCode: code || 'RUNTIME_ERROR',
        errorMessage: message || 'Action execution failed.',
        ...(details !== undefined ? { details } : {}),
        ...(Array.isArray(recoveryHints) && recoveryHints.length > 0 ? { recoveryHints } : {}),
        ...(notes || {}),
      },
    }))
  }

  recordQuery({ call, affectedRefs = [], notes }) {
    const currentStateId = readWorkspaceStateFromStore(this.store)?.stateId || 'unknown'
    const lineage = this.buildLineageFields(currentStateId)
    this.appendTrace(makeInteractionTraceRecord({
      actor: call?.actor || 'agent',
      eventKind: 'perceptionQuery',
      query: call,
      affectedRefs,
      stateId: currentStateId,
      ...lineage,
      notes: {
        outcome: 'success',
        ...(notes || {}),
      },
    }))
  }

  recordQueryFailure({
    call,
    code,
    message,
    details,
    recoveryHints = [],
    notes,
  }) {
    const currentStateId = readWorkspaceStateFromStore(this.store)?.stateId || 'unknown'
    const lineage = this.buildLineageFields(currentStateId)
    const targetRef = readNormalizedQueryScope({ call }).widgetRef || null
    this.appendTrace(makeInteractionTraceRecord({
      actor: call?.actor || 'agent',
      eventKind: 'perceptionQuery',
      query: call,
      affectedRefs: targetRef ? [targetRef] : [],
      stateId: currentStateId,
      statePatch: {},
      ...lineage,
      notes: {
        outcome: 'failure',
        errorCode: code || 'RUNTIME_ERROR',
        errorMessage: message || 'Perception query execution failed.',
        ...(details !== undefined ? { details } : {}),
        ...(Array.isArray(recoveryHints) && recoveryHints.length > 0 ? { recoveryHints } : {}),
        ...(notes || {}),
      },
    }))
  }

  recordDataQuery({ call, affectedRefs = [], notes }) {
    const currentStateId = readWorkspaceStateFromStore(this.store)?.stateId || 'unknown'
    const lineage = this.buildLineageFields(currentStateId)
    this.appendTrace(makeInteractionTraceRecord({
      actor: call?.actor || 'agent',
      eventKind: 'dataQuery',
      query: call,
      affectedRefs,
      stateId: currentStateId,
      ...lineage,
      notes: {
        outcome: 'success',
        ...(notes || {}),
      },
    }))
  }

  recordDataQueryFailure({
    call,
    code,
    message,
    details,
    recoveryHints = [],
    notes,
  }) {
    const currentStateId = readWorkspaceStateFromStore(this.store)?.stateId || 'unknown'
    const lineage = this.buildLineageFields(currentStateId)
    const normalizedScope = readNormalizedQueryScope({ call, querySpec: call?.query?.spec || null })
    const dataRef = normalizedScope.dataRef || call?.dataRef || null
    const targetRef = normalizedScope.widgetRef || null
    const affectedRefs = [targetRef, dataRef].filter(Boolean)
    this.appendTrace(makeInteractionTraceRecord({
      actor: call?.actor || 'agent',
      eventKind: 'dataQuery',
      query: call,
      affectedRefs,
      stateId: currentStateId,
      statePatch: {},
      ...lineage,
      notes: {
        outcome: 'failure',
        errorCode: code || 'RUNTIME_ERROR',
        errorMessage: message || 'Data query execution failed.',
        ...(details !== undefined ? { details } : {}),
        ...(Array.isArray(recoveryHints) && recoveryHints.length > 0 ? { recoveryHints } : {}),
        ...(notes || {}),
      },
    }))
  }

  recordSystemTransition({
    actor = 'system',
    transitionType = 'continue',
    stateId,
    affectedRefs = [],
    statePatch = {},
    notes,
  }) {
    const currentStateId = stateId || readWorkspaceStateFromStore(this.store)?.stateId || 'unknown'
    const lineage = this.buildLineageFields(currentStateId)
    this.appendTrace(makeInteractionTraceRecord({
      actor,
      eventKind: 'systemTransition',
      primitive: transitionType,
      affectedRefs,
      stateId: currentStateId,
      statePatch,
      ...lineage,
      notes,
    }))
  }

  recordResponse({
    responseId,
    runId = null,
    sessionId = null,
    actor = 'agent',
    mode = null,
    query = null,
    content,
    evidenceRefs = [],
    usage = null,
  } = {}) {
    const safeContent = String(content || '').trim()
    if (!safeContent) {
      throw new Error('TraceRecorder.recordResponse requires non-empty content.')
    }
    const state = this.store.readState()
    const record = makeAgentResponseRecord({
      responseId: responseId || `response_${Date.now()}`,
      runId: runId || null,
      sessionId: sessionId || this.store.workspaceId || null,
      workspaceId: this.store.workspaceId || null,
      actor,
      mode: mode || null,
      query: query ? String(query) : null,
      content: safeContent,
      stateId: state?.stateId || null,
      branchId: this.store.currentBranchId || null,
      evidenceRefs: Array.isArray(evidenceRefs) ? [...evidenceRefs] : [],
      usage: usage && typeof usage === 'object' ? usage : null,
      createdAt: new Date().toISOString(),
    })
    this.store.appendResponse(record)
    return record
  }

  readLatestResponse(options = {}) {
    return this.store.readLatestResponse(options)
  }

  listResponses(limit = 20, options = {}) {
    return this.store.listResponses(limit, options)
  }

  describeResponseRecorder() {
    const workspaceId = this.store.workspaceId || null
    const latest = this.store.readLatestResponse({ workspaceId }) || null
    const responses = Array.isArray(this.store?.responseHistory)
      ? this.store.responseHistory.filter((record) => {
          if (!workspaceId) return true
          return record?.workspaceId === workspaceId
        })
      : []
    return makeResponseRecorderSummary({
      capabilities: makeResponseRecorderCapabilities({
        recordsFinalResponses: true,
        latestResponseRead: true,
        responseHistoryRead: true,
        workspaceScopedReads: true,
        lineageTracking: true,
      }),
      counters: makeResponseRecorderCounters({
        workspaceId,
        responseCount: responses.length,
        latestResponseId: latest?.responseId || null,
        latestRunId: latest?.runId || null,
        latestStateId: latest?.stateId || null,
        latestBranchId: latest?.branchId || null,
        latestActor: latest?.actor || null,
        latestMode: latest?.mode || null,
        latestQuery: latest?.query || null,
        latestEvidenceRefCount: Array.isArray(latest?.evidenceRefs) ? latest.evidenceRefs.length : 0,
      }),
    })
  }

  describeRecorder() {
    const trace = Array.isArray(this.store?.interactionTrace) ? this.store.interactionTrace : []
    const latestRecord = trace[trace.length - 1] || null
    return makeTraceRecorderSummary({
      capabilities: makeTraceRecorderCapabilities({
        recordsActions: true,
        recordsPerceptionQueries: true,
        recordsPerceptionQueryFailures: true,
        recordsDataQueries: true,
        recordsDataQueryFailures: true,
        normalizedQueryFamily: true,
        recordsSystemTransitions: true,
        lineageTracking: true,
      }),
      counters: makeTraceRecorderCounters({
        traceCount: trace.length,
        latestStateId: latestRecord?.stateId || null,
        latestBranchId: latestRecord?.branchId || null,
        latestEventKind: latestRecord?.eventKind || null,
        latestEventFamily: latestRecord?.eventFamily || null,
        latestQuerySurface: latestRecord?.querySurface || null,
        latestOutcome: latestRecord?.notes?.outcome || null,
      }),
      eventKinds: ['action', 'perceptionQuery', 'dataQuery', 'systemTransition'],
      eventFamilies: ['action', 'query', 'systemTransition'],
      querySurfaces: ['perception', 'data'],
    })
  }
}
