import { makeInteractionTraceRecord } from '../protocol/interactionTrace.js'
import {
  makeTraceRecorderCapabilities,
  makeTraceRecorderCounters,
  makeTraceRecorderSummary,
} from '../protocol/traceRecorder.js'
import {
  readCurrentSnapshotMetaFromStore,
  readSnapshotEntryFromStore,
  readWorkspaceStateFromStore,
} from './workspaceStoreReaders.js'
import { appendTraceRecordToStore } from './workspaceStoreMutators.js'
import { readNormalizedQueryScope } from './queryScope.js'

export class InteractionTraceRecorder {
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
    const queryScope = readNormalizedQueryScope({ call, querySpec: call?.query?.spec || null })
    const dataRef = queryScope.dataRef || call?.dataRef || null
    const targetRef = queryScope.widgetRef || null
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
