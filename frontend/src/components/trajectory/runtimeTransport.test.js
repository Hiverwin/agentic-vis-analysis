import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createRuntimeSnapshotEvidencePort,
  hasRuntimeSnapshotEvidenceAccess,
  hasRuntimeStateJumpAccess,
  hasRuntimeTraceGraphAccess,
} from './runtimeTransport.js'

test('runtimeTransport availability helpers reflect page-port runtime methods', () => {
  assert.equal(
    hasRuntimeTraceGraphAccess({
      __widgetVA: {
        getTraceGraph() {},
      },
    }),
    true,
  )
  assert.equal(
    hasRuntimeTraceGraphAccess({
      __widgetVA: {},
    }),
    false,
  )
  assert.equal(
    hasRuntimeStateJumpAccess({
      __widgetVA: {
        jumpToState() {},
      },
    }),
    true,
  )
  assert.equal(
    hasRuntimeStateJumpAccess({
      __widgetVA: {},
    }),
    false,
  )
  assert.equal(
    hasRuntimeSnapshotEvidenceAccess({
      __widgetVA: {
        readSnapshot() {},
      },
    }),
    true,
  )
  assert.equal(
    hasRuntimeSnapshotEvidenceAccess({
      __widgetVA: {},
    }),
    false,
  )
})

test('runtimeTransport availability helpers accept alias-only page ports', () => {
  assert.equal(
    hasRuntimeTraceGraphAccess({
      __widgetVA: {
        trace_graph_read() {},
      },
    }),
    true,
  )
  assert.equal(
    hasRuntimeStateJumpAccess({
      __widgetVA: {
        jump_to_state() {},
      },
    }),
    true,
  )
  assert.equal(
    hasRuntimeSnapshotEvidenceAccess({
      __widgetVA: {
        read_snapshot() {},
      },
    }),
    true,
  )
})

test('runtimeTransport creates a snapshot-evidence port with the required runtime methods', () => {
  const port = createRuntimeSnapshotEvidencePort()

  assert.equal(typeof port.readSnapshot, 'function')
  assert.equal(typeof port.evaluateLinkPropagation, 'function')
})
