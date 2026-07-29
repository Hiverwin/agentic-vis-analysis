import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_CASE_ID,
  buildDefaultAgentObjective,
  readRuntimeSessionKeyFromState,
} from './appStoreRuntimeSession.js'

test('readRuntimeSessionKeyFromState prefers runtime session key, then active case, then default case', () => {
  assert.equal(readRuntimeSessionKeyFromState({ runtimeSessionKey: 'runtime-a', activeCaseId: 'case-a' }), 'runtime-a')
  assert.equal(readRuntimeSessionKeyFromState({ activeCaseId: 'case-a' }), 'case-a')
  assert.equal(readRuntimeSessionKeyFromState({}), DEFAULT_CASE_ID)
  assert.equal(readRuntimeSessionKeyFromState(null), DEFAULT_CASE_ID)
})

test('buildDefaultAgentObjective keeps the current empty default objective contract', () => {
  assert.equal(buildDefaultAgentObjective({ sourceType: 'starter' }), '')
})
