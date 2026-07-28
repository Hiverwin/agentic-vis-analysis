import test from 'node:test'
import assert from 'node:assert/strict'

import { makeWorkspaceState } from '../../contracts/state-contracts.js'
import {
  describeStateManagerFromStore,
  REPLAY_CONTEXT_REF,
  SHARED_STATE_REF,
  StateManager,
  TASK_CONTEXT_REF,
} from './StateManager.js'

test('StateManager.createStateMeta generates a new state id when taskContext changes', () => {
  const stateManager = new StateManager()
  const previousState = makeWorkspaceState({
    stateId: 'main:s99',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {},
    shared: {},
    taskContext: {
      taskMode: 'goal_oriented',
      evidenceType: 'summary',
    },
  })

  const nextStateMeta = stateManager.createStateMeta({
    workspaceId: 'main',
    previousState,
    nextWidgets: previousState.widgets,
    nextShared: previousState.shared,
    nextTaskContext: {
      taskMode: 'goal_oriented',
      evidenceType: 'detail',
    },
    branchId: 'main',
  })

  assert.equal(nextStateMeta.reused, false)
  assert.notEqual(nextStateMeta.stateId, previousState.stateId)
})

test('StateManager.createStateMeta reuses the state id when taskContext is unchanged', () => {
  const stateManager = new StateManager()
  const previousState = makeWorkspaceState({
    stateId: 'main:s2',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {},
    shared: {},
    taskContext: {
      taskMode: 'goal_oriented',
      evidenceType: 'summary',
    },
  })

  const nextStateMeta = stateManager.createStateMeta({
    workspaceId: 'main',
    previousState,
    nextWidgets: previousState.widgets,
    nextShared: previousState.shared,
    nextTaskContext: {
      taskMode: 'goal_oriented',
      evidenceType: 'summary',
    },
    branchId: 'main',
  })

  assert.equal(nextStateMeta.reused, true)
  assert.equal(nextStateMeta.stateId, previousState.stateId)
})

test('StateManager.createStateMeta generates a new state id when replayContext changes', () => {
  const stateManager = new StateManager()
  const previousState = makeWorkspaceState({
    stateId: 'main:s100',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {},
    shared: {},
  })
  previousState.replayContext = {
    runMode: 'goal_oriented',
    userIntent: 'baseline query',
  }

  const nextStateMeta = stateManager.createStateMeta({
    workspaceId: 'main',
    previousState,
    nextWidgets: previousState.widgets,
    nextShared: previousState.shared,
    nextReplayContext: {
      runMode: 'open_ended',
      userIntent: 'baseline query',
    },
    branchId: 'main',
  })

  assert.equal(nextStateMeta.reused, false)
  assert.notEqual(nextStateMeta.stateId, previousState.stateId)
})

test('StateManager.createDelta reports replayContext changes', () => {
  const stateManager = new StateManager()
  const previousState = makeWorkspaceState({
    stateId: 'main:s101',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {},
    shared: {},
  })
  const nextState = makeWorkspaceState({
    stateId: 'main:s102',
    createdAt: '2026-01-01T00:01:00.000Z',
    widgets: {},
    shared: {},
  })

  const delta = stateManager.createDelta({
    previousState,
    nextState,
    previousReplayContext: { runMode: 'goal_oriented' },
    nextReplayContext: { runMode: 'benchmark' },
  })

  assert.ok(delta.changedRefs.includes('replayContext'))
})

test('StateManager.describeManager exposes reserved refs for scoped reads and patches', () => {
  const stateManager = new StateManager()

  const summary = stateManager.describeManager()

  assert.equal(summary.capabilities.stateIdGeneration, true)
  assert.equal(summary.counters.generatedStateCount, 0)
  assert.deepEqual(summary.reservedRefs, [
    SHARED_STATE_REF,
    TASK_CONTEXT_REF,
    REPLAY_CONTEXT_REF,
  ])
})

test('describeStateManagerFromStore derives state-manager summary from plain snapshot facades', () => {
  const summary = describeStateManagerFromStore({
    stateId: 'main:s2',
    widgets: {},
    shared: {},
    stateSnapshots: [
      { stateId: 'main:s1', state: { widgets: {}, shared: {} } },
      { stateId: 'main:s2', state: { widgets: {}, shared: {} } },
    ],
  })

  assert.equal(summary.capabilities.stateIdGeneration, true)
  assert.equal(summary.capabilities.deltaCreation, true)
  assert.equal(summary.capabilities.statePatchCreation, true)
  assert.equal(summary.capabilities.refScopedReads, true)
  assert.equal(summary.counters.generatedStateCount, 2)
  assert.equal(summary.counters.lastGeneratedStateId, 'main:s2')
  assert.deepEqual(summary.reservedRefs, [
    SHARED_STATE_REF,
    TASK_CONTEXT_REF,
    REPLAY_CONTEXT_REF,
  ])
})
