import test from 'node:test'
import assert from 'node:assert/strict'

import { TraceRecorder } from './TraceRecorder.js'

test('TraceRecorder.recordDataQuery stores the DataQueryCall directly in trace records', () => {
  let appendedRecord = null
  const recorder = new TraceRecorder({
    store: {
      appendTrace(record) {
        appendedRecord = record
      },
      readState() {
        return { stateId: 'main:s1' }
      },
      readCurrentSnapshotMeta() {
        return {
          stateId: 'main:s1',
          parentStateId: 'main:s0',
          branchId: 'main',
        }
      },
      readSnapshotEntry(stateId) {
        if (stateId !== 'main:s1') return null
        return {
          stateId: 'main:s1',
          parentStateId: 'main:s0',
          branchId: 'main',
        }
      },
    },
  })

  const call = {
    callId: 'dq_1',
    actor: 'human',
    dataRef: 'wl://widgetva-app/workspace/main/data/scatter_visible',
    query: {
      kind: 'summary',
      spec: {
        queryScope: {
          selectionRef: 'wl://widgetva-app/workspace/main/widget/scatter/selection/brush',
        },
      },
    },
  }

  recorder.recordDataQuery({
    call,
    affectedRefs: ['wl://widgetva-app/workspace/main/widget/scatter'],
    notes: {
      userVisibleSummary: 'Data query: summary',
    },
  })

  assert.equal(appendedRecord?.eventKind, 'dataQuery')
  assert.equal(appendedRecord?.eventFamily, 'query')
  assert.equal(appendedRecord?.querySurface, 'data')
  assert.deepEqual(appendedRecord?.query, call)
  assert.equal(appendedRecord?.actor, 'human')
  assert.equal(appendedRecord?.parentStateId, 'main:s0')
  assert.equal(appendedRecord?.branchId, 'main')
  assert.equal(appendedRecord?.notes?.outcome, 'success')
})

test('TraceRecorder records failed perception and data queries as trace records', () => {
  const appendedRecords = []
  const recorder = new TraceRecorder({
    store: {
      appendTrace(record) {
        appendedRecords.push(record)
      },
      readState() {
        return { stateId: 'main:s1' }
      },
      readCurrentSnapshotMeta() {
        return {
          stateId: 'main:s1',
          parentStateId: 'main:s0',
          branchId: 'main',
        }
      },
      readSnapshotEntry(stateId) {
        if (stateId !== 'main:s1') return null
        return {
          stateId: 'main:s1',
          parentStateId: 'main:s0',
          branchId: 'main',
        }
      },
    },
  })

  recorder.recordQueryFailure({
    call: {
      callId: 'pq_fail',
      actor: 'agent',
      name: 'perception.inspectVisibleRows',
      queryScope: {
        widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
      },
    },
    code: 'RUNTIME_ERROR',
    message: 'No active scatter widget in the current workspace.',
  })

  recorder.recordDataQueryFailure({
    call: {
      callId: 'dq_fail',
      actor: 'human',
      dataRef: 'wl://widgetva-app/workspace/main/data/current_selection',
      query: {
        kind: 'summary',
      },
    },
    code: 'UNKNOWN_DATA_REF',
    message: 'Unknown data ref: wl://widgetva-app/workspace/main/data/current_selection.',
  })

  assert.equal(appendedRecords.length, 2)
  assert.equal(appendedRecords[0]?.eventKind, 'perceptionQuery')
  assert.equal(appendedRecords[0]?.notes?.outcome, 'failure')
  assert.equal(appendedRecords[0]?.notes?.errorCode, 'RUNTIME_ERROR')
  assert.equal(appendedRecords[1]?.eventKind, 'dataQuery')
  assert.equal(appendedRecords[1]?.querySurface, 'data')
  assert.equal(appendedRecords[1]?.notes?.outcome, 'failure')
  assert.equal(appendedRecords[1]?.notes?.errorCode, 'UNKNOWN_DATA_REF')
})

test('TraceRecorder.describeRecorder exposes latest normalized trace metadata', () => {
  const recorder = new TraceRecorder({
    store: {
      interactionTrace: [
        {
          stateId: 'main:s2',
          branchId: 'main',
          eventKind: 'dataQuery',
          eventFamily: 'query',
          querySurface: 'data',
          notes: {
            outcome: 'failure',
          },
        },
      ],
      appendTrace() {},
      readState() {
        return { stateId: 'main:s2' }
      },
      readCurrentSnapshotMeta() {
        return {
          stateId: 'main:s2',
          parentStateId: 'main:s1',
          branchId: 'main',
        }
      },
      readSnapshotEntry() {
        return {
          stateId: 'main:s2',
          parentStateId: 'main:s1',
          branchId: 'main',
        }
      },
    },
  })

  const summary = recorder.describeRecorder()

  assert.equal(summary.capabilities.recordsPerceptionQueryFailures, true)
  assert.equal(summary.capabilities.recordsDataQueryFailures, true)
  assert.equal(summary.capabilities.normalizedQueryFamily, true)
  assert.equal(summary.capabilities.recordsSystemTransitions, true)
  assert.equal(summary.counters.latestEventKind, 'dataQuery')
  assert.equal(summary.counters.latestEventFamily, 'query')
  assert.equal(summary.counters.latestQuerySurface, 'data')
  assert.equal(summary.counters.latestOutcome, 'failure')
  assert.deepEqual(summary.eventFamilies, ['action', 'query', 'systemTransition'])
  assert.deepEqual(summary.querySurfaces, ['perception', 'data'])
})

test('TraceRecorder falls back to plain manual-assembly snapshot and trace facades', () => {
  const store = {
    stateId: 'main:s2',
    version: 0,
    stateSnapshots: [
      {
        stateId: 'main:s2',
        parentStateId: 'main:s1',
        branchId: 'branch_what_if',
      },
    ],
    interactionTrace: [],
  }

  const recorder = new TraceRecorder({ store })

  recorder.recordSystemTransition({
    transitionType: 'branch',
    notes: {
      userVisibleSummary: 'Created a new branch.',
    },
  })

  assert.equal(store.interactionTrace.length, 1)
  assert.equal(store.interactionTrace[0]?.stateId, 'main:s2')
  assert.equal(store.interactionTrace[0]?.parentStateId, 'main:s1')
  assert.equal(store.interactionTrace[0]?.branchId, 'branch_what_if')
  assert.equal(store.interactionTrace[0]?.primitive, 'branch')
})
